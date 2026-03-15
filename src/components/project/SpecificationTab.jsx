// ARCHITECTURAL RULE — DO NOT VIOLATE:
//
// Phase 1 (Specification) is ISOLATED from the chapter pipeline.
// The following systems must NEVER be called from SpecificationTab:
//
//   ✗ enforceProseCompliance()
//   ✗ verifyExplicitTags()
//   ✗ getTopRepeatedWords()
//   ✗ verifyGeminiProse()
//   ✗ verifyGPTVolume()
//   ✗ verifyNonfictionVolume()
//   ✗ generateChapterWithCompliance()
//   ✗ prepareChapterGeneration()
//   ✗ protagonist_interiority validation gate
//
// These systems require chapters, beat sheets, and project data
// that do not exist at Phase 1. Calling them here will always
// throw a 500.
//
// Phase 1 AI calls use dedicated backend functions:
//   developIdea, expandPremise, bookConsultantChat, configSubgenres
// That is the only pattern permitted in this file.
//
// PIPELINE PHASE ISOLATION MAP:
//   Phase 1  SpecificationTab    → developIdea, expandPremise, extractMetadata
//   Phase 2  OutlineTab          → generateOutline, generateOutlineDetail, beatSheetEngine
//   Phase 3  GenerateTab         → writeChapter (prose compliance, volume gates, quality gates)
//   Phase 4  ReviewPolishTab     → consistencyCheck, rewriteInVoice, characterInterview
//
// No phase may call a function designated for another phase.

import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2, Send, ArrowRight, MessageSquare, Wand2, Search, X, Lightbulb, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import SourceFilesCard from "./SourceFilesCard";
import PromptSuggestions from "./PromptSuggestions";
import PromptCatalogBrowser from "./PromptCatalogBrowser";
import AuthorVoiceSelector, { ALL_AUTHOR_PROFILES, resolveAuthorId } from "./AuthorVoiceSelector";
import { BeatStyleSelect, SpiceLevelSelect, LanguageIntensitySelect } from "./BeatStyleSelector";
import ModelSelector from "../ModelSelector";
import CharacterInterviewPanel from "./CharacterInterviewPanel";
import ProtagonistInterioritySection from "./ProtagonistInterioritySection";
import ProtagonistInteriorityInferButton from "./ProtagonistInteriorityInferButton";

const FICTION_GENRES = ["Fantasy", "Science Fiction", "Mystery", "Thriller", "Romance", "Historical Fiction", "Horror", "Literary Fiction", "Adventure", "Dystopian", "Young Adult", "Crime", "Magical Realism", "Western", "Satire", "Erotica"];
const NONFICTION_GENRES = ["Self-Help", "Business", "Biography", "History", "Science", "Technology", "Philosophy", "Psychology", "Health", "Travel", "Education", "Politics", "True Crime", "Memoir", "Cooking"];

// ── POV & TENSE SYSTEM ──────────────────────────────────────────────────────
const POV_OPTIONS = [
  { value: "first-person", label: "First Person (I/me)", desc: "Intimate, immersive. Best for memoir, romance, thriller." },
  { value: "third-close", label: "Third Person Close (he/she — single POV)", desc: "Deep character access with narrative flexibility. Most common in fiction." },
  { value: "third-multi", label: "Third Person Multiple POV", desc: "Multiple character perspectives across chapters. Best for ensemble casts, epic scope." },
  { value: "third-omniscient", label: "Third Person Omniscient", desc: "All-seeing narrator. Best for historical, literary, epic fantasy." },
  { value: "second-person", label: "Second Person (you)", desc: "Rare. Immersive/experimental. Best for self-help, choose-your-own-adventure." },
];

const NF_POV_OPTIONS = [
  { value: "nf-author", label: "Author Voice (I/we)", desc: "Personal authority. Best for memoir, personal essay, opinion." },
  { value: "nf-direct", label: "Direct Address (you)", desc: "Reader-facing instruction. Best for self-help, how-to, prescriptive." },
  { value: "nf-third", label: "Third Person Narrative", desc: "Observational distance. Best for biography, history, true crime." },
  { value: "nf-editorial", label: "Editorial Mix (I + you + they)", desc: "Flexible authority. Best for investigative, longform journalism, hybrid nonfiction." },
];

const TENSE_OPTIONS = [
  { value: "past", label: "Past Tense (he walked, she said)", desc: "Standard narrative tense. Feels natural, established." },
  { value: "present", label: "Present Tense (he walks, she says)", desc: "Immediate, urgent. Common in YA, thriller, literary fiction." },
  { value: "mixed", label: "Mixed (editorial present + historical past)", desc: "Present tense for analysis, past for events. Standard for investigative and narrative nonfiction." },
];

// ── EROTICA PROSE REGISTER ──────────────────────────────────────────────────
// Controls the vocabulary and tone of intimate scenes. Only visible when Spice ≥ 2.
const EROTICA_REGISTER_OPTIONS = [
  { value: 0, label: "Literary", desc: "Lyrical, metaphorical, emotionally rich. Poetic descriptions of intimacy." },
  { value: 1, label: "Naturalistic", desc: "Plain, direct language. Anatomically accurate but not crude." },
  { value: 2, label: "Vernacular", desc: "Common slang, casual dirty talk. Body parts named bluntly." },
  { value: 3, label: "Raw / Smut", desc: "Explicit, vulgar, unapologetic. Four-letter words. Zero euphemism." },
];

// ── NONFICTION STRUCTURE MODES ──────────────────────────────────────────────
const NF_STRUCTURE_MODES = [
  { value: "prescriptive", label: "Prescriptive / How-To",
    desc: "Step-by-step guidance organized around actionable frameworks. Each chapter teaches a skill or principle.",
    examples: "Atomic Habits, The 4-Hour Workweek, caregiving manuals",
    chapterStyle: "Framework → Evidence → Application → Exercise/Takeaway" },
  { value: "narrative", label: "Narrative Nonfiction",
    desc: "True events told with cinematic pacing. Characters, scenes, and dramatic arc — but everything is real.",
    examples: "In Cold Blood, The Devil in the White City, Killers of the Flower Moon",
    chapterStyle: "Scene → Context → Tension → Resolution → Implication" },
  { value: "reference", label: "Reference / Academic",
    desc: "Comprehensive, organized by topic. Readers dip in and out. Each chapter is self-contained.",
    examples: "Textbooks, encyclopedias, technical manuals, field guides",
    chapterStyle: "Definition → Deep Explanation → Examples → Cross-references" },
  { value: "investigative", label: "Investigative / Exposé",
    desc: "Evidence-driven revelation. Each chapter builds the case, peels back a layer, follows the trail.",
    examples: "She Said, Dark Money, Catch and Kill",
    chapterStyle: "Evidence → Reconstruction → Analysis → Implication → Next lead" },
];

// ── POV/TENSE PRESETS ────────────────────────────────────────────────────────
// One-click combinations that auto-fill both POV and Tense fields.
const FICTION_PRESETS = [
  { id: "classic", label: "Classic Novel", pov: "third-close", tense: "past",
    desc: "Deep in one character's head, told in past tense. The industry standard.",
    examples: "Stephen King, Colleen Hoover, most bestselling fiction" },
  { id: "confessional", label: "Confessional / Diary", pov: "first-person", tense: "past",
    desc: "The narrator tells their own story, looking back on events.",
    examples: "Gone Girl, The Great Gatsby, Catcher in the Rye" },
  { id: "urgent", label: "Urgent / YA", pov: "first-person", tense: "present",
    desc: "Happening right now, through one person's eyes. Maximum immediacy.",
    examples: "The Hunger Games, Divergent, fast-paced thriller" },
  { id: "epic", label: "Epic / Ensemble", pov: "third-multi", tense: "past",
    desc: "Multiple character viewpoints across chapters. Big-scope storytelling.",
    examples: "Game of Thrones, Wheel of Time, multi-POV sci-fi" },
  { id: "cinematic", label: "Cinematic / God's Eye", pov: "third-omniscient", tense: "past",
    desc: "The narrator sees everything — zooms into any character's mind.",
    examples: "Lord of the Rings, Dune, historical epics" },
  { id: "horror", label: "Immersive Horror", pov: "third-close", tense: "present",
    desc: "Trapped in one perspective, happening NOW. Maximum tension.",
    examples: "Horror, psychological thriller, survival fiction" },
  { id: "experimental", label: "Experimental", pov: "second-person", tense: "present",
    desc: "Puts the reader IN the story as 'you.' Rare but striking.",
    examples: "Bright Lights Big City, choose-your-own-adventure, literary experiments" },
];

const NONFICTION_PRESETS = [
  { id: "memoir", label: "Memoir / Personal", pov: "nf-author", tense: "past",
    desc: "Your story, told by you, looking back. Reflective and personal.",
    examples: "Educated, Becoming, personal essays" },
  { id: "selfhelp", label: "Self-Help / How-To", pov: "nf-direct", tense: "present",
    desc: "Talking directly to the reader. 'Here's what you need to do.'",
    examples: "Atomic Habits, The 4-Hour Workweek, cookbooks" },
  { id: "biography", label: "Biography / History", pov: "nf-third", tense: "past",
    desc: "Telling someone else's story from a distance. Authoritative.",
    examples: "Walter Isaacson's bios, David McCullough, Ken Burns" },
  { id: "truecrime", label: "True Crime / Investigative", pov: "nf-editorial", tense: "mixed",
    desc: "Part detective, part storyteller. Shifts between 'I found...' and 'The evidence showed...'",
    examples: "In Cold Blood, Serial podcast style, longform journalism" },
  { id: "narrative", label: "Narrative Nonfiction", pov: "nf-editorial", tense: "mixed",
    desc: "Flexible authority — weaves personal insight, reader engagement, and storytelling.",
    examples: "Malcolm Gladwell, Michael Lewis, Erik Larson" },
  { id: "academic", label: "Academic / Reference", pov: "nf-third", tense: "present",
    desc: "Authoritative present-tense analysis. No 'I' or 'you.' Formal.",
    examples: "Textbooks, reference guides, technical manuals" },
];

// Suggest POV + tense based on genre and book type
function suggestPovTense(bookType, genre) {
  const g = (genre || '').toLowerCase();
  if (bookType === 'nonfiction') {
    if (/memoir/.test(g)) return { pov: 'nf-author', tense: 'past', preset: 'memoir', reason: 'Memoir is almost always author voice past tense — personal reflection on lived experience.' };
    if (/self-help|business|education|health|cooking/.test(g)) return { pov: 'nf-direct', tense: 'present', preset: 'selfhelp', reason: 'Instructional nonfiction addresses the reader directly in present tense.' };
    if (/biography/.test(g)) return { pov: 'nf-third', tense: 'past', preset: 'biography', reason: 'Biography uses third-person narrative past tense to inhabit the subject\'s perspective.' };
    if (/true.crime|investigat/.test(g)) return { pov: 'nf-editorial', tense: 'mixed', preset: 'truecrime', reason: 'Investigative nonfiction uses editorial mix — present for analysis, past for reconstructed events.' };
    if (/history|political/.test(g)) return { pov: 'nf-third', tense: 'past', preset: 'biography', reason: 'Historical nonfiction uses third-person narrative past tense for authority and scope.' };
    return { pov: 'nf-editorial', tense: 'mixed', preset: 'narrative', reason: 'Narrative nonfiction typically uses editorial mix for authority with reader engagement.' };
  }
  // Fiction suggestions
  if (/erotica|romance/.test(g)) return { pov: 'third-close', tense: 'past', preset: 'classic', reason: 'Romance/erotica needs deep character interiority. Third-close past is the genre standard.' };
  if (/thriller|mystery|crime/.test(g)) return { pov: 'third-close', tense: 'past', preset: 'classic', reason: 'Thriller/mystery benefits from close POV to control information reveal. Past tense is standard.' };
  if (/young adult/.test(g)) return { pov: 'first-person', tense: 'present', preset: 'urgent', reason: 'YA commonly uses first-person present for immediacy and teen voice.' };
  if (/literary/.test(g)) return { pov: 'third-close', tense: 'past', preset: 'classic', reason: 'Literary fiction favors close third for interiority with narrative distance.' };
  if (/fantasy|science fiction|dystopian/.test(g)) return { pov: 'third-multi', tense: 'past', preset: 'epic', reason: 'Epic/speculative fiction often uses multiple POVs to show world scope.' };
  if (/horror/.test(g)) return { pov: 'third-close', tense: 'present', preset: 'horror', reason: 'Horror benefits from present tense immediacy and single POV vulnerability.' };
  if (/historical/.test(g)) return { pov: 'third-omniscient', tense: 'past', preset: 'cinematic', reason: 'Historical fiction uses omniscient past for period authority and scope.' };
  return { pov: 'third-close', tense: 'past', preset: 'classic', reason: 'Third-person close past tense is the most versatile default for fiction.' };
}

// Fuzzy genre matcher — handles AI returning "Sci-Fi" vs dropdown "Science Fiction", etc.
function matchGenre(aiGenre, bookType) {
  if (!aiGenre) return null;
  const genres = bookType === "fiction" ? FICTION_GENRES : NONFICTION_GENRES;
  const lower = aiGenre.trim().toLowerCase();
  // Exact match (case-insensitive)
  const exact = genres.find(g => g.toLowerCase() === lower);
  if (exact) return exact;
  // Common aliases
  const ALIASES = {
    'sci-fi': 'Science Fiction', 'scifi': 'Science Fiction', 'sf': 'Science Fiction',
    'true crime': 'True Crime', 'truecrime': 'True Crime',
    'historical fiction': 'Historical Fiction', 'historical': 'Historical Fiction',
    'literary fiction': 'Literary Fiction', 'literary': 'Literary Fiction',
    'self-help': 'Self-Help', 'selfhelp': 'Self-Help', 'self help': 'Self-Help',
    'ya': 'Young Adult', 'young-adult': 'Young Adult',
    'magical realism': 'Magical Realism', 'magic realism': 'Magical Realism',
    'bio': 'Biography', 'autobiography': 'Biography',
    'tech': 'Technology', 'psych': 'Psychology',
  };
  if (ALIASES[lower] && genres.includes(ALIASES[lower])) return ALIASES[lower];
  // Partial/contains match
  const partial = genres.find(g => lower.includes(g.toLowerCase()) || g.toLowerCase().includes(lower));
  if (partial) return partial;
  console.warn(`matchGenre: no match for "${aiGenre}" in`, genres);
  return null;
}

const ALL_VOICE_IDS = ALL_AUTHOR_PROFILES.map(a => a.id);

function mapToAuthorVoiceOption(inferred) {
  const key = inferred?.trim();
  if (!key) return null;
  // Direct ID match
  if (ALL_VOICE_IDS.includes(key)) return key;
  const lk = key.toLowerCase();
  if (ALL_VOICE_IDS.includes(lk)) return lk;
  // Name-to-ID: match against author name field
  const nameMatch = ALL_AUTHOR_PROFILES.find(a =>
    a.name.toLowerCase() === lk ||
    a.name.toLowerCase().includes(lk) ||
    lk.includes(a.name.toLowerCase().split(' ').pop())
  );
  if (nameMatch) return nameMatch.id;
  // Legacy ID fallback
  const resolved = resolveAuthorId(key);
  if (resolved !== 'basic') return resolved;
  // Fuzzy descriptor match
  const descMatch = ALL_AUTHOR_PROFILES.find(a =>
    a.descriptor && a.descriptor.toLowerCase().split(',').some(d => lk.includes(d.trim()))
  );
  if (descMatch) return descMatch.id;
  console.warn(`mapToAuthorVoiceOption: no match for "${inferred}"`);
  return null;
}

function mapToBeatStyleOption(inferred) {
  const map = {
    'Fast-Paced Thriller':'fast-paced-thriller','Gritty Cinematic':'gritty-cinematic',
    'Hollywood Blockbuster':'hollywood-blockbuster','Slow Burn':'slow-burn',
    'Clean Romance':'clean-romance','Faith-Infused Contemporary':'faith-infused','Faith-Infused':'faith-infused',
    'Investigative / Nonfiction':'investigative-nonfiction','Reference / Educational':'reference-educational',
    'Intellectual Psychological':'intellectual-psychological','Dark Suspense':'dark-suspense',
    'Satirical':'satirical','Epic Historical':'epic-historical','Whimsical Cozy':'whimsical-cozy',
    'Hard-Boiled Noir':'hard-boiled-noir','Grandiose Space Opera':'grandiose-space-opera',
    'Visceral Horror':'visceral-horror','Poetic Magical Realism':'poetic-magical-realism',
    'Clinical Procedural':'clinical-procedural','Hyper-Stylized Action':'hyper-stylized-action',
    'Nostalgic Coming-of-Age':'nostalgic-coming-of-age','Cerebral Sci-Fi':'cerebral-sci-fi',
    'High-Stakes Political':'high-stakes-political','Surrealist Avant-Garde':'surrealist-avant-garde',
    'Melancholic Literary':'melancholic-literary','Urban Gritty Fantasy':'urban-gritty-fantasy',
    'thriller':'fast-paced-thriller','fast paced':'fast-paced-thriller',
    'cinematic':'gritty-cinematic','gritty':'gritty-cinematic',
    'Steamy Romance':'steamy-romance','Slow Burn Romance':'slow-burn-romance','Dark Erotica':'dark-erotica',
    'Journal / Personal Essay':'journal-personal','Longform Article':'longform-article',
    'Deep Investigative':'deep-investigative','Historical Account':'historical-account',
    'True Crime Account':'true-crime-account','Memoir / Narrative Nonfiction':'memoir-narrative',
    'Academic but Accessible':'academic-accessible',
    'romance':'clean-romance','slow burn':'slow-burn','slow-burn romance':'slow-burn-romance',
    'steamy':'steamy-romance','erotica':'dark-erotica',
    'horror':'visceral-horror','noir':'hard-boiled-noir','cozy':'whimsical-cozy',
    'literary':'melancholic-literary','historical':'epic-historical',
    'sci-fi':'cerebral-sci-fi','science fiction':'cerebral-sci-fi',
    'space opera':'grandiose-space-opera','investigative':'investigative-nonfiction',
    'nonfiction':'investigative-nonfiction','educational':'reference-educational',
    'coming of age':'nostalgic-coming-of-age','coming-of-age':'nostalgic-coming-of-age',
    'psychological':'intellectual-psychological','suspense':'dark-suspense',
    'political':'high-stakes-political','action':'hyper-stylized-action',
    'magical realism':'poetic-magical-realism','urban fantasy':'urban-gritty-fantasy',
    'procedural':'clinical-procedural','satire':'satirical',
  };
  const key = inferred?.trim();
  if (!key) return null;
  if (map[key]) return map[key];
  const lowerKey = key.toLowerCase();
  for (const [label, value] of Object.entries(map)) {
    if (label.toLowerCase() === lowerKey) return value;
  }
  for (const [label, value] of Object.entries(map)) {
    if (lowerKey.includes(label.toLowerCase()) || label.toLowerCase().includes(lowerKey)) return value;
  }
  // If it's already a valid slug, pass through
  const VALID_BEAT_KEYS = ["basic","fast-paced-thriller","hyper-stylized-action","hollywood-blockbuster","visceral-horror","grandiose-space-opera","gritty-cinematic","dark-suspense","hard-boiled-noir","urban-gritty-fantasy","high-stakes-political","epic-historical","intellectual-psychological","cerebral-sci-fi","clinical-procedural","satirical","surrealist-avant-garde","clean-romance","slow-burn","nostalgic-coming-of-age","melancholic-literary","poetic-magical-realism","faith-infused","whimsical-cozy","steamy-romance","slow-burn-romance","dark-erotica","journal-personal","longform-article","formal-report","deep-investigative","historical-account","true-crime-account","memoir-narrative","academic-accessible","investigative-nonfiction","reference-educational"];
  if (VALID_BEAT_KEYS.includes(lowerKey)) return lowerKey;
  console.warn(`mapToBeatStyleOption: no match for "${inferred}"`);
  return null;
}

// ── Phase 1 Validation — catches cross-domain mismatches before Phase 2 ──
function validatePhase1Settings(settings) {
  const issues = [];
  const { genre, beat_style, author_voice, book_type } = settings;

  const FICTION_ONLY_BEATS = ['visceral-horror','whimsical-cozy','urban-gritty-fantasy','grandiose-space-opera','clean-romance','fast-paced-thriller','gritty-cinematic','dark-suspense','slow-burn','hard-boiled-noir','nostalgic-coming-of-age','steamy-romance','slow-burn-romance','dark-erotica','hyper-stylized-action','cerebral-sci-fi','epic-historical','melancholic-literary','poetic-magical-realism','intellectual-psychological','surrealist-avant-garde','high-stakes-political'];
  const NF_ONLY_BEATS = ['investigative-nonfiction','reference-educational','deep-investigative','historical-account','true-crime-account','memoir-narrative','academic-accessible','longform-article','journal-personal','formal-report'];
  const LITERARY_AUTHORS = ['toni-morrison','cormac-mccarthy','kazuo-ishiguro','zadie-smith','donna-tartt','colm-toibin','hilary-mantel'];
  const FICTION_AUTHORS = ['colleen-hoover','stephen-king','brandon-sanderson','james-patterson','lee-child','joe-abercrombie','robin-hobb','terry-pratchett','agatha-christie','penelope-douglas','shirley-jackson','nk-jemisin'];
  const NF_AUTHORS = ['erik-larson','david-grann','malcolm-gladwell','jon-krakauer','michelle-mcnamara','robert-kolker','brene-brown','james-clear','ryan-holiday'];

  // 1. Nonfiction + fiction beat style
  if (book_type === 'nonfiction' && FICTION_ONLY_BEATS.includes(beat_style)) {
    issues.push({ field: 'beat_style', problem: `${beat_style} is fiction-only`, fix: 'investigative-nonfiction' });
    settings.beat_style = 'investigative-nonfiction';
  }
  // 2. Fiction + nonfiction beat style
  if (book_type === 'fiction' && NF_ONLY_BEATS.includes(beat_style)) {
    issues.push({ field: 'beat_style', problem: `${beat_style} is nonfiction-only`, fix: 'auto-detect from genre' });
    settings.beat_style = '';
  }
  // 3. Romance + literary fiction author
  if (genre?.toLowerCase().includes('romance') && LITERARY_AUTHORS.includes(author_voice)) {
    issues.push({ field: 'author_voice', problem: `${author_voice} mismatched with romance`, fix: 'colleen-hoover' });
    settings.author_voice = 'colleen-hoover';
  }
  // 4. Nonfiction + fiction-only author
  if (book_type === 'nonfiction' && FICTION_AUTHORS.includes(author_voice)) {
    issues.push({ field: 'author_voice', problem: `${author_voice} is fiction-only for nonfiction book`, fix: 'erik-larson' });
    settings.author_voice = 'erik-larson';
  }
  // 5. Fiction + nonfiction-only author
  if (book_type === 'fiction' && NF_AUTHORS.includes(author_voice)) {
    issues.push({ field: 'author_voice', problem: `${author_voice} is nonfiction-only for fiction book`, fix: 'basic' });
    settings.author_voice = 'basic';
  }

  if (issues.length > 0) console.warn('validatePhase1Settings corrected:', issues);
  return { settings, issues };
}

// Injected Phase 1 styles — ensures CSS connects regardless of global import order
const PHASE1_INJECTED_STYLES = `
.phase1-wrap {
  max-width: 960px;
  margin: 0 auto;
  padding: 28px 24px 100px;
  display: grid;
  grid-template-columns: 192px 1fr;
  gap: 24px;
  align-items: start;
}
.phase1-nav {
  position: sticky;
  top: 108px;
  background: #ffffff;
  border: 1px solid #e8e8ec;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.phase1-nav-header {
  padding: 10px 14px 7px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1.2px;
  color: #9997b0;
  background: #fafafa;
  border-bottom: 1px solid #e8e8ec;
  text-transform: uppercase;
}
.phase1-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  font-size: 12px;
  font-weight: 500;
  color: #52516a;
  cursor: pointer;
  border-left: 3px solid transparent;
  border-bottom: 1px solid #f5f5f7;
  text-decoration: none;
  transition: all 0.15s;
}
.phase1-nav-item:last-child { border-bottom: none; }
.phase1-nav-item:hover { color: #5b50f0; background: #ede9fe; }
.phase1-nav-item.p1-active {
  color: #5b50f0;
  border-left-color: #5b50f0;
  background: #ede9fe;
  font-weight: 600;
}
.phase1-nav-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #d1d0d8; flex-shrink: 0; transition: background 0.15s;
}
.phase1-nav-item.p1-active .phase1-nav-dot { background: #5b50f0; }
.phase1-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}
.p1-card {
  background: #ffffff;
  border: 1px solid #e8e8ec;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  transition: box-shadow 0.2s;
  scroll-margin-top: 120px;
}
.p1-card:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.07); }
.p1-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 18px 11px;
  border-bottom: 1px solid #e8e8ec;
  background: #fafafa;
}
.p1-card-icon {
  width: 28px; height: 28px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; flex-shrink: 0;
}
.p1-card-title { font-size: 13px; font-weight: 700; color: #18171f; }
.p1-card-subtitle { font-size: 11px; color: #9997b0; margin-top: 1px; }
.p1-card-badge {
  margin-left: auto; font-size: 9px; font-weight: 700;
  padding: 2px 8px; border-radius: 10px;
  background: #f3f4f6; color: #9997b0;
}
.p1-card-body { padding: 16px 18px; }
.p1-field-group { margin-bottom: 14px; }
.p1-field-group:last-child { margin-bottom: 0; }
.p1-label {
  font-size: 11px; font-weight: 600; color: #52516a;
  margin-bottom: 5px; display: flex; align-items: center; gap: 4px;
}
.p1-label-opt { font-weight: 400; color: #9997b0; font-size: 10px; }
.p1-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.p1-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.p1-premise-actions { display: flex; gap: 7px; margin-top: 9px; flex-wrap: wrap; }
.p1-psych-controls {
  display: flex; align-items: center;
  justify-content: space-between; margin-bottom: 2px;
}
.p1-psych-toggle {
  font-size: 11px; font-weight: 600; color: #5b50f0;
  background: none; border: none; cursor: pointer;
  display: flex; align-items: center; gap: 4px;
  padding: 0; font-family: inherit; transition: opacity 0.15s;
}
.p1-psych-toggle:hover { opacity: 0.75; }
.p1-psych-arrow { font-size: 10px; transition: transform 0.2s; }
.p1-psych-arrow.open { transform: rotate(180deg); }
.p1-psych-fields { margin-top: 14px; display: flex; flex-direction: column; gap: 13px; }
.p1-psych-num { font-size: 10px; font-weight: 700; color: #5b50f0; margin-bottom: 3px; }
.p1-footer {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: rgba(247,247,249,0.95);
  backdrop-filter: blur(8px);
  border-top: 1px solid #e8e8ec;
  padding: 12px 32px;
  display: flex; justify-content: flex-end; gap: 10px; z-index: 40;
}
@media (max-width: 800px) {
  .phase1-wrap { grid-template-columns: 1fr; padding: 16px 12px 100px; }
  .phase1-nav { display: none; }
  .p1-grid-2 { grid-template-columns: 1fr; }
  .p1-grid-3 { grid-template-columns: 1fr; }
}
`;

const TARGET_LENGTHS = [
  { value: "short", label: "Short (25K–50K words)" },
  { value: "medium", label: "Medium (50K–100K words)" },
  { value: "long", label: "Long (100K–150K words)" },
  { value: "epic", label: "Epic (150K–200K+ words)" },
];

const DETAIL_LEVELS = [
  { value: "minimal", label: "Minimal" },
  { value: "moderate", label: "Moderate" },
  { value: "comprehensive", label: "Comprehensive" },
];

// ─── Floating Chat Widget ────────────────────────────────────────────────────

function FloatingChat({ projectId, form }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [pulsing, setPulsing] = useState(true);
  const [mode, setMode] = useState("chat"); // "chat" or "interview"
  const chatBottomRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setPulsing(false), 4000);
    return () => clearTimeout(t);
  }, []);

  const { data: messages = [] } = useQuery({
    queryKey: ["conversations", projectId],
    queryFn: () => base44.entities.Conversation.filter({ project_id: projectId }, "created_date"),
    refetchInterval: false,
  });

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [messages, isOpen, isChatting]);

  const sendMessage = async () => {
    if (!chatInput.trim() || isChatting) return;
    const msg = chatInput.trim();
    setChatInput("");
    setIsChatting(true);
    try {
      await base44.functions.invoke('bookConsultantChat', { project_id: projectId, message: msg, spec: form });
      await queryClient.invalidateQueries({ queryKey: ["conversations", projectId] });
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes chat-pulse {
          0%, 100% { box-shadow: 0 4px 12px rgba(124,58,237,0.4), 0 0 0 0 rgba(124,58,237,0.4); }
          50% { box-shadow: 0 4px 12px rgba(124,58,237,0.4), 0 0 0 10px rgba(124,58,237,0); }
        }
        .chat-fab-pulse { animation: chat-pulse 1.5s ease-in-out 3; }
        .chat-popup-enter { animation: chat-popup-in 0.2s ease-out; }
        @keyframes chat-popup-in {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {isOpen && (
        <div className="chat-popup-enter" style={{ position: "fixed", bottom: "84px", right: "20px", width: "380px", maxWidth: "calc(100vw - 32px)", maxHeight: "500px", background: "white", borderRadius: "16px", boxShadow: "0 8px 30px rgba(0,0,0,0.15)", zIndex: 1000, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ background: "#7c3aed", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div className="flex items-center gap-2">
              {mode === "interview" ? <UserCircle className="w-4 h-4 text-white" /> : <MessageSquare className="w-4 h-4 text-white" />}
              <span className="text-white font-semibold text-sm">{mode === "interview" ? "Character Interview" : "AI Book Consultant"}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode(mode === "chat" ? "interview" : "chat")}
                className="text-white/80 hover:text-white transition-colors text-xs px-2 py-0.5 rounded-full border border-white/30 hover:border-white/60"
              >
                {mode === "chat" ? "Interview →" : "← Chat"}
              </button>
              <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {mode === "interview" ? (
            <div className="flex-1 overflow-y-auto p-4" style={{ minHeight: 0 }}>
              <CharacterInterviewPanel
                projectId={projectId}
                premise={form.topic}
                genre={form.genre}
                onBack={() => setMode("chat")}
              />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
                {messages.length === 0 && !isChatting && (
                  <div className="flex items-center justify-center h-full py-8">
                    <div className="text-center text-slate-400">
                      <MessageSquare className="w-7 h-7 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Ask me anything about your book concept!</p>
                      <p className="text-xs mt-1 text-slate-300">Genre suggestions, plot ideas, and more.</p>
                    </div>
                  </div>
                )}
                {messages.map(msg => (
                  <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm", msg.role === "user" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-800")}>
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isChatting && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 rounded-2xl px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>
              <div style={{ padding: "12px", borderTop: "1px solid #f1f5f9", flexShrink: 0, display: "flex", gap: "8px" }}>
                <Input
                  placeholder="Ask about your book idea..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  disabled={isChatting}
                  className="flex-1 text-sm"
                />
                <Button onClick={sendMessage} disabled={!chatInput.trim() || isChatting} size="icon" style={{ background: "#7c3aed", border: "none", flexShrink: 0 }} className="hover:opacity-90">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setIsOpen(o => !o)}
        className={cn(pulsing && !isOpen ? "chat-fab-pulse" : "")}
        style={{ position: "fixed", bottom: "20px", right: "20px", width: "56px", height: "56px", borderRadius: "50%", background: "#7c3aed", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.2)", zIndex: 999, transition: "transform 0.15s ease" }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.08)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        aria-label={isOpen ? "Close chat" : "Open AI Book Consultant"}
      >
        {isOpen ? <X className="w-5 h-5 text-white" /> : <MessageSquare className="w-5 h-5 text-white" />}
      </button>
    </>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SpecificationTab({ projectId, onProceed }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    project_id: projectId,
    book_type: "fiction",
    genre: "",
    subgenre: "",
    topic: "",
    target_length: "medium",
    chapter_count: "",
    detail_level: "moderate",
    target_audience: "",
    beat_style: "",
    tone_style: "",
    beat_sheet_template: "auto",
    spice_level: 0,
    language_intensity: 0,
    author_voice: "basic",
    additional_requirements: "",
    enforce_genre_content: true,
    writing_model: "claude-sonnet",
    budget_mode: false,
    pov_mode: "",
    tense: "",
    erotica_register: 0,
    nf_structure_mode: "",
    nf_key_frameworks: "",
    nf_audience_needs: "",
    nf_knowledge_base_status: "",
    protagonist_life_purpose: "",
    protagonist_core_wound: "",
    protagonist_self_belief: "",
    protagonist_secret_desire: "",
    protagonist_behavioral_tells: "",
  });
  const [extracting, setExtracting] = useState(false);
  const [developingIdea, setDevelopingIdea] = useState(false);
  const [marketNotes, setMarketNotes] = useState(null);
  const [highlightedFields, setHighlightedFields] = useState({});
  const [showCatalogBrowser, setShowCatalogBrowser] = useState(false);
  const [subgenresData, setSubgenresData] = useState({});
  const [autoHints, setAutoHints] = useState({});  // { field: { reasoning, secondary } }
  const pendingSubgenreRef = useRef(null);  // deferred subgenre from auto-extract

  useEffect(() => { window.scrollTo(0, 0); }, []);

  // Inject Phase 1 styles once on mount
  useEffect(() => {
    const id = 'phase1-injected-styles';
    if (!document.getElementById(id)) {
      const tag = document.createElement('style');
      tag.id = id;
      tag.textContent = PHASE1_INJECTED_STYLES;
      document.head.appendChild(tag);
    }
  }, []);

  useEffect(() => {
    base44.functions.invoke('configSubgenres', {})
      .then(res => setSubgenresData(res.data || {}))
      .catch(err => console.warn('Subgenre config unavailable, using defaults'));
  }, []);

  const { data: specs = [] } = useQuery({
    queryKey: ["specification", projectId],
    queryFn: () => base44.entities.Specification.filter({ project_id: projectId }),
  });
  const spec = specs[0];

  useEffect(() => {
    if (spec) {
      setForm(prev => ({
        ...prev,
        ...spec,
        beat_style: spec.beat_style || spec.tone_style || "",
        spice_level: spec.spice_level ?? 0,
        language_intensity: spec.language_intensity ?? 0,
      }));
    }
  }, [spec]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form };
      ["id", "created_date", "updated_date", "created_by"].forEach(k => delete payload[k]);
      
      // Persist protagonist interiority on the Project entity for cross-phase access
      const interiority = {
        core_wound: form.protagonist_core_wound || "",
        self_belief: form.protagonist_self_belief || "",
        secret_desire: form.protagonist_secret_desire || "",
        behavioral_tells: form.protagonist_behavioral_tells || "",
        life_purpose: form.protagonist_life_purpose || "",
      };
      const hasInteriority = Object.values(interiority).some(v => v.trim());
      if (hasInteriority) {
        base44.entities.Project.update(projectId, {
          protagonist_interiority: JSON.stringify(interiority),
        }).catch(err => console.warn("Failed to persist interiority on project:", err.message));
      }
      
      if (spec) return base44.entities.Specification.update(spec.id, payload);
      return base44.entities.Specification.create(payload);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["specification", projectId] }),
  });

  const handleChange = (field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === "book_type") { updated.genre = ""; updated.subgenre = ""; updated.beat_style = ""; updated.tone_style = ""; updated.beat_sheet_template = "auto"; updated.pov_mode = ""; updated.tense = ""; }
      if (field === "genre") { updated.subgenre = ""; }
      return updated;
    });
    // Clear auto-selection reasoning when user manually changes the field
    if (autoHints[field]) {
      setAutoHints(prev => { const next = { ...prev }; delete next[field]; return next; });
    }
  };

  const handleDevelopIdea = async () => {
    setDevelopingIdea(true);
    setMarketNotes(null);
    try {
      const res = await base44.functions.invoke('developIdea', {
        idea: form.topic.trim(),
        book_type: form.book_type,
        genre: form.genre || "",
      });
      const data = res.data;
      setForm(prev => {
        const next = { ...prev, topic: data.developed_premise };
        if (data.book_type && data.book_type !== prev.book_type) {
          next.book_type = data.book_type;
          next.genre = "";
          next.subgenre = "";
        }
        return next;
      });
      setMarketNotes(data.market_notes);
      toast.success("Idea developed! Click 'Auto-Extract Metadata' to populate all fields");
    } catch (err) {
      console.error("Develop idea error:", err);
      toast.error("Failed to develop idea");
    } finally {
      setDevelopingIdea(false);
    }
  };

  const handleAutoExtract = async () => {
    if (!form.topic.trim()) { toast.error("Please enter a topic/premise first"); return; }
    setExtracting(true);
    setAutoHints({});
    try {
      const response = await base44.functions.invoke('expandPremise', {
        topic: form.topic,
        book_type: form.book_type,
        genre: form.genre,
      });
      const expanded = response.data;
      const filled = [];

      // Normalize target_audience — might be string or {selected, secondary, reasoning}
      const rawAudience = expanded.target_audience;
      const audienceData = typeof rawAudience === "string"
        ? { selected: rawAudience, secondary: "", reasoning: "" }
        : (rawAudience || {});
      const audienceString = audienceData.selected || "";

      // Normalize author_voice — might be string or {selected, reasoning}
      const rawVoice = expanded.author_voice;
      const voiceData = typeof rawVoice === "string"
        ? { selected: rawVoice, reasoning: "" }
        : (rawVoice || {});

      // Map author_voice through fuzzy mapper
      const voiceId = mapToAuthorVoiceOption(voiceData.selected) || "basic";

      // Normalize beat_style — might be string or {selected, reasoning}
      const rawBeat = expanded.beat_style;
      const beatData = typeof rawBeat === "string"
        ? { selected: rawBeat, reasoning: "" }
        : (rawBeat || {});
      const beatKey = mapToBeatStyleOption(beatData.selected) || "";

      // Normalize spice_level — might be number or {selected, reasoning}
      const rawSpice = expanded.spice_level;
      const spiceData = typeof rawSpice === "number"
        ? { selected: rawSpice, reasoning: "" }
        : (rawSpice || {});
      const spiceVal = Math.max(0, Math.min(4, parseInt(spiceData.selected) || 0));

      // Normalize language_intensity — might be number or {selected, reasoning}
      const rawLang = expanded.language_intensity;
      const langData = typeof rawLang === "number"
        ? { selected: rawLang, reasoning: "" }
        : (rawLang || {});
      const langVal = Math.max(0, Math.min(4, parseInt(langData.selected) || 0));

      // ── Validate cross-domain mismatches before applying ──
      const preValidation = { book_type: form.book_type, genre: matchGenre(expanded.genre, form.book_type) || form.genre, beat_style: beatKey, author_voice: voiceId };
      const { settings: validated, issues: valIssues } = validatePhase1Settings(preValidation);
      if (valIssues.length > 0) {
        const correctedFields = valIssues.map(i => i.field).join(', ');
        toast.info(`Auto-corrected: ${correctedFields}`, { description: valIssues.map(i => `${i.field}: ${i.problem} → ${i.fix}`).join('; ') });
      }
      // Apply corrections back
      const vBeatKey = validated.beat_style !== beatKey ? validated.beat_style : beatKey;
      const vVoiceId = validated.author_voice !== voiceId ? validated.author_voice : voiceId;

      setForm(prev => {
        const next = { ...prev };
        next.topic = expanded.expanded_brief || prev.topic;

        const fill = (field, val) => {
          if (val && !prev[field]) { next[field] = val; filled.push(field); }
        };
        // Auto-select genre — fuzzy match against known genre lists
        if (expanded.genre && !prev.genre) {
          const matched = matchGenre(expanded.genre, prev.book_type);
          if (matched) {
            next.genre = matched;
            next.subgenre = ""; // clear so dependent dropdown reloads
            filled.push("genre");
          }
        }
        // Defer subgenre — it depends on genre being set first and options loading
        if (expanded.subgenre && (next.genre || prev.genre)) {
          pendingSubgenreRef.current = expanded.subgenre;
          // Don't fill("subgenre") — the useEffect will handle it
        }
        fill("beat_style", vBeatKey);
        fill("detail_level", expanded.detail_level);
        // Auto-select story structure
        const VALID_TEMPLATES = ["auto","save-the-cat","romance-arc","thriller-tension","heros-journey","argument-driven","narrative-nonfiction","reference-structured","investigative-nonfiction"];
        if (expanded.beat_sheet_template && VALID_TEMPLATES.includes(expanded.beat_sheet_template) && (!prev.beat_sheet_template || prev.beat_sheet_template === "auto")) {
          next.beat_sheet_template = expanded.beat_sheet_template;
          filled.push("beat_sheet_template");
        }
        if (expanded.chapter_count && !prev.chapter_count) {
          next.chapter_count = expanded.chapter_count;
          filled.push("chapter_count");
        }

        // Auto-select target_audience — always a string
        if (audienceString) {
          next.target_audience = audienceString;
          filled.push("target_audience");
        }

        // Auto-select author_voice — always a valid dropdown ID
        if (vVoiceId !== "basic" || !prev.author_voice) {
          next.author_voice = vVoiceId;
          filled.push("author_voice");
        }

        // Auto-select spice_level
        if (spiceVal !== prev.spice_level) {
          next.spice_level = spiceVal;
          filled.push("spice_level");
        }

        // Auto-select language_intensity
        if (langVal !== prev.language_intensity) {
          next.language_intensity = langVal;
          filled.push("language_intensity");
        }

        // Auto-suggest POV and tense based on genre
        if (!prev.pov_mode || !prev.tense) {
          const suggestion = suggestPovTense(next.book_type || prev.book_type, next.genre || prev.genre);
          if (!prev.pov_mode && suggestion.pov) {
            next.pov_mode = suggestion.pov;
            filled.push("pov_mode");
          }
          if (!prev.tense && suggestion.tense) {
            next.tense = suggestion.tense;
            filled.push("tense");
          }
        }

        return next;
      });

      // Set reasoning hints for display beneath fields
      const hints = {};
      if (audienceData.reasoning) {
        hints.target_audience = { reasoning: audienceData.reasoning, secondary: audienceData.secondary || "" };
      }
      if (voiceData.reasoning) {
        hints.author_voice = { reasoning: voiceData.reasoning };
      }
      if (beatData.reasoning) {
        hints.beat_style = { reasoning: beatData.reasoning };
      }
      if (spiceData.reasoning) {
        hints.spice_level = { reasoning: spiceData.reasoning };
      }
      if (langData.reasoning) {
        hints.language_intensity = { reasoning: langData.reasoning };
      }
      // POV/tense reasoning from genre suggestion
      {
        const suggestion = suggestPovTense(form.book_type, form.genre);
        if (suggestion.reason) {
          hints.pov_mode = { reasoning: suggestion.reason, preset: suggestion.preset };
          hints.tense = { reasoning: suggestion.reason };
        }
      }
      setAutoHints(hints);

      if (filled.length > 0) {
        const highlights = {};
        filled.forEach(f => { highlights[f] = true; });
        setHighlightedFields(highlights);
        setTimeout(() => setHighlightedFields({}), 1800);
      }

      toast.success("Premise expanded and settings auto-selected");
    } catch (err) {
      console.error('Expand error:', err);
      toast.error("Failed to expand premise");
    } finally {
      setExtracting(false);
    }
  };

  const handleSelectPrompt = (prompt) => {
    if (form.topic.trim()) {
      if (!window.confirm(`Replace current premise with "${prompt.title}"?`)) return;
    }
    const fullContent = prompt.content || prompt.description || "";
    setForm(prev => ({
      ...prev,
      topic: fullContent,
      genre: prompt.genre || prev.genre,
      book_type: prompt.book_type || prev.book_type,
    }));
    toast.success(`Loaded: ${prompt.title}`);
  };

  // ── Nonfiction Topic Research ──
  const triggerTopicResearch = async () => {
    if (!form.topic || form.topic.trim().length < 10) {
      toast.error("Enter a detailed topic/premise before running research.");
      return;
    }
    handleChange("nf_knowledge_base_status", "researching");
    try {
      const result = await base44.functions.invoke('bot_researchChronicler', {
        project_id: projectId,
        mode: 'topic_research',
      }, { timeout: 120000 });

      const data = result?.data || result;
      if (data?.success && data?.knowledge_base) {
        const kb = data.knowledge_base;
        // Populate key frameworks
        if (kb.key_frameworks?.length > 0) {
          const fwText = kb.key_frameworks.map(f => `${f.name}: ${f.description}`).join('\n');
          handleChange("nf_key_frameworks", fwText);
        }
        // Populate audience needs
        if (kb.target_audience_needs) {
          const needs = kb.target_audience_needs;
          const needsText = [
            needs.primary_reader ? `Reader: ${needs.primary_reader}` : '',
            needs.knowledge_level ? `Level: ${needs.knowledge_level}` : '',
            needs.pain_points?.length ? `Pain points: ${needs.pain_points.join('; ')}` : '',
            needs.desired_outcomes?.length ? `Goals: ${needs.desired_outcomes.join('; ')}` : '',
          ].filter(Boolean).join('\n');
          handleChange("nf_audience_needs", needsText);
        }
        // Auto-suggest structure mode if not set
        if (!form.nf_structure_mode && kb.suggested_chapters?.length > 0) {
          const g = (form.genre || '').toLowerCase();
          if (/self.help|business|education|health|how.to|cooking/.test(g)) handleChange("nf_structure_mode", "prescriptive");
          else if (/true.crime|investigat|journalism|expos/.test(g)) handleChange("nf_structure_mode", "investigative");
          else if (/memoir|biography|history/.test(g)) handleChange("nf_structure_mode", "narrative");
          else if (/reference|technical|science/.test(g)) handleChange("nf_structure_mode", "reference");
          else handleChange("nf_structure_mode", "prescriptive");
        }
        handleChange("nf_knowledge_base_status", "complete");
        toast.success(`Research complete — ${data.source_count} sources, ${data.theme_count} themes, ${data.chapter_suggestions} suggested chapters`);
      } else {
        handleChange("nf_knowledge_base_status", "");
        toast.error(data?.error || "Research failed — try again");
      }
    } catch (err) {
      console.error("Topic research error:", err);
      handleChange("nf_knowledge_base_status", "");
      toast.error(`Research failed: ${err.message}`);
    }
  };

  // Auto-trigger topic research when nonfiction topic is entered for the first time
  const topicResearchTriggered = useRef(false);
  useEffect(() => {
    if (
      form.book_type === 'nonfiction' &&
      form.topic && form.topic.trim().length >= 20 &&
      form.genre &&
      !form.nf_knowledge_base_status &&
      !topicResearchTriggered.current &&
      projectId
    ) {
      topicResearchTriggered.current = true;
      // Small delay so other auto-fills complete first
      const timer = setTimeout(() => triggerTopicResearch(), 2000);
      return () => clearTimeout(timer);
    }
  }, [form.book_type, form.topic, form.genre, form.nf_knowledge_base_status, projectId]);

  const canProceed = form.book_type && form.genre && form.topic?.trim();
  const genres = form.book_type === "fiction" ? FICTION_GENRES : NONFICTION_GENRES;
  const currentSubgenres = form.genre && subgenresData[form.book_type]?.[form.genre]
    ? subgenresData[form.book_type][form.genre] : [];

  // Apply deferred subgenre once genre is set and subgenre options are loaded
  useEffect(() => {
    const pending = pendingSubgenreRef.current;
    if (!pending || !form.genre || currentSubgenres.length === 0) return;
    const lower = pending.trim().toLowerCase();
    const matched = currentSubgenres.find(sg => sg.toLowerCase() === lower)
      || currentSubgenres.find(sg => lower.includes(sg.toLowerCase()) || sg.toLowerCase().includes(lower));
    if (matched) {
      setForm(prev => ({ ...prev, subgenre: matched }));
      setHighlightedFields(prev => ({ ...prev, subgenre: true }));
      setTimeout(() => setHighlightedFields(prev => { const n = { ...prev }; delete n.subgenre; return n; }), 1800);
    } else {
      console.warn(`subgenre: no match for "${pending}" in`, currentSubgenres);
    }
    pendingSubgenreRef.current = null;
  }, [form.genre, currentSubgenres]);

  const [psychOpen, setPsychOpen] = useState(true);

  const sectionIds = ['sec-premise','sec-basics','sec-style','sec-voice','sec-psych','sec-resources'];
  const [activeSection, setActiveSection] = useState('sec-premise');

  useEffect(() => {
    const handler = () => {
      let current = sectionIds[0];
      sectionIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < 160) current = id;
      });
      setActiveSection(current);
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const hl = (field) => highlightedFields[field]
    ? "ring-2 ring-violet-400 ring-offset-1 rounded-md transition-all duration-500"
    : "";

  return (
    <div className="phase1-wrap">
      <style>{`
        @keyframes field-glow {
          0%   { box-shadow: 0 0 0 0 rgba(124,58,237,0.5); }
          50%  { box-shadow: 0 0 0 6px rgba(124,58,237,0.15); }
          100% { box-shadow: 0 0 0 0 rgba(124,58,237,0); }
        }
        .field-highlight { animation: field-glow 1.8s ease-out; }
      `}</style>

      {/* ── LEFT: Section Nav ── */}
      <nav className="phase1-nav">
        <div className="phase1-nav-header">ON THIS PAGE</div>
        {[
          { id: 'sec-premise',   label: 'Premise'       },
          { id: 'sec-basics',    label: 'Book Basics'   },
          { id: 'sec-style',     label: 'Style & Tone'  },
          { id: 'sec-voice',     label: 'Voice & Model' },
          { id: 'sec-psych',     label: 'Psychology'    },
          { id: 'sec-resources', label: 'Resources'     },
        ].map(({ id, label }) => (
          <a
            key={id}
            className={`phase1-nav-item${activeSection === id ? ' p1-active' : ''}`}
            href={`#${id}`}
            onClick={e => {
              e.preventDefault();
              document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <div className="phase1-nav-dot" />
            {label}
          </a>
        ))}
      </nav>

      {/* ── RIGHT: Form ── */}
      <div className="phase1-form">

        {/* ══ SECTION 1 — PREMISE ══ */}
        <div className="p1-card" id="sec-premise">
          <div className="p1-card-header">
            <div className="p1-card-icon" style={{ background:'#ede9fe', color:'#7c3aed' }}>📝</div>
            <div>
              <div className="p1-card-title">Premise</div>
              <div className="p1-card-subtitle">Your book's core idea and concept</div>
            </div>
          </div>
          <div className="p1-card-body">
            <div className="p1-field-group">
              <div className="p1-label">Topic / Premise</div>
              <Textarea
                rows={3}
                placeholder="A story about..."
                value={form.topic}
                onChange={e => handleChange("topic", e.target.value)}
              />
            </div>

            <div className="p1-premise-actions">
              <Button
                onClick={handleDevelopIdea}
                disabled={developingIdea}
                size="sm"
                variant="outline"
                style={{ border: "1.5px solid #7c3aed", color: "#7c3aed", background: "transparent" }}
                className="hover:bg-violet-50"
              >
                {developingIdea ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lightbulb className="w-4 h-4 mr-2" />}
                {developingIdea ? "Developing..." : form.topic.trim() ? "Develop Idea" : "Idea?"}
              </Button>
              <Button onClick={handleAutoExtract} disabled={!form.topic.trim() || extracting} variant="outline" size="sm">
                {extracting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                {extracting ? "Analyzing..." : "Auto-Extract Metadata"}
              </Button>
              <Button onClick={() => setShowCatalogBrowser(true)} variant="outline" size="sm">
                <Search className="w-4 h-4 mr-2" /> Browse Catalog
              </Button>
            </div>

            {marketNotes && (
              <div className="mt-3 flex items-start gap-2 rounded-lg px-4 py-3 text-sm" style={{ background: "#f5f3ff", borderLeft: "3px solid #7c3aed" }}>
                <div className="flex-1 text-slate-700 leading-relaxed">{marketNotes}</div>
                <button onClick={() => setMarketNotes(null)} className="text-slate-400 hover:text-slate-600 shrink-0 mt-0.5">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="mt-3">
              <PromptSuggestions
                bookType={form.book_type}
                genre={form.genre}
                onSelect={handleSelectPrompt}
                onBrowseAll={() => setShowCatalogBrowser(true)}
              />
            </div>
          </div>
        </div>

        {/* ══ SECTION 2 — BOOK BASICS ══ */}
        <div className="p1-card" id="sec-basics">
          <div className="p1-card-header">
            <div className="p1-card-icon" style={{ background:'#dbeafe', color:'#1d4ed8' }}>📚</div>
            <div>
              <div className="p1-card-title">Book Basics</div>
              <div className="p1-card-subtitle">Type, genre, audience, and length</div>
            </div>
          </div>
          <div className="p1-card-body">
            {/* Row 1: Book Type + Genre */}
            <div className="p1-grid-2 p1-field-group">
              <div className={hl("book_type")}>
                <div className="p1-label">Book Type</div>
                <Select value={form.book_type} onValueChange={v => handleChange("book_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fiction">Fiction</SelectItem>
                    <SelectItem value="nonfiction">Nonfiction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className={hl("genre")}>
                <div className="p1-label">Genre / Category</div>
                <Select value={form.genre} onValueChange={v => handleChange("genre", v)}>
                  <SelectTrigger><SelectValue placeholder="Select genre..." /></SelectTrigger>
                  <SelectContent>
                    {genres.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Subgenre (conditional) */}
            {currentSubgenres.length > 0 && (
              <div className={`p1-field-group ${hl("subgenre")}`}>
                <div className="p1-label">Subgenre <span className="p1-label-opt">(optional)</span></div>
                <Select value={form.subgenre} onValueChange={v => handleChange("subgenre", v)}>
                  <SelectTrigger><SelectValue placeholder="Select a subgenre..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {currentSubgenres.map(sg => <SelectItem key={sg} value={sg}>{sg}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Row 2: Target Audience + Story Structure */}
            <div className="p1-grid-2 p1-field-group">
              <div className={hl("target_audience")}>
                <div className="p1-label">Target Audience</div>
                <Input
                  placeholder="e.g. Young adults aged 16–25..."
                  value={form.target_audience}
                  onChange={e => handleChange("target_audience", e.target.value)}
                />
                {autoHints.target_audience?.reasoning && (
                  <div className="mt-1.5 space-y-0.5">
                    <p className="text-xs text-violet-600 flex items-start gap-1">
                      <span className="shrink-0">✦</span>
                      <span>Auto-selected: {autoHints.target_audience.reasoning}</span>
                    </p>
                    {autoHints.target_audience.secondary && (
                      <p className="text-xs text-slate-400 ml-4">Also consider: {autoHints.target_audience.secondary}</p>
                    )}
                  </div>
                )}
              </div>
              <div className={hl("beat_sheet_template")}>
                <div className="p1-label">Story Structure</div>
                <Select value={form.beat_sheet_template || "auto"} onValueChange={v => handleChange("beat_sheet_template", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect (based on genre)</SelectItem>
                    {form.book_type === "fiction" ? (
                      <>
                        <SelectItem value="save-the-cat">Save the Cat (Hollywood)</SelectItem>
                        <SelectItem value="romance-arc">Romance Arc (Relationship-Driven)</SelectItem>
                        <SelectItem value="thriller-tension">Thriller / Suspense Arc</SelectItem>
                        <SelectItem value="heros-journey">Hero's Journey (Campbell/Vogler)</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="argument-driven">Argument-Driven (Self-Help / Business)</SelectItem>
                        <SelectItem value="narrative-nonfiction">Narrative Nonfiction (Memoir / True Crime)</SelectItem>
                        <SelectItem value="reference-structured">Reference / Educational (How-To / Guides)</SelectItem>
                        <SelectItem value="investigative-nonfiction">Investigative / Exposé</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400 mt-1">
                  {form.book_type === "fiction" 
                    ? "Controls pacing structure — Auto picks the best fit for your genre."
                    : "Controls argument structure — Auto picks the best fit for your genre."}
                </p>
              </div>
            </div>

            {/* Row 3: Target Length + Chapter Count + Detail Level */}
            <div className="p1-grid-3 p1-field-group">
              <div className={hl("target_length")}>
                <div className="p1-label">Target Length</div>
                <Select value={form.target_length} onValueChange={v => handleChange("target_length", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TARGET_LENGTHS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="p1-label">Chapter Count <span className="p1-label-opt">(optional)</span></div>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  placeholder="e.g. 20"
                  value={form.chapter_count || ""}
                  onChange={e => handleChange("chapter_count", e.target.value ? parseInt(e.target.value) : "")}
                />
              </div>
              <div className={hl("detail_level")}>
                <div className="p1-label">Detail Level</div>
                <Select value={form.detail_level} onValueChange={v => handleChange("detail_level", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DETAIL_LEVELS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* ══ SECTION 3 — STYLE & TONE ══ */}
        <div className="p1-card" id="sec-style">
          <div className="p1-card-header">
            <div className="p1-card-icon" style={{ background:'#fce7f3', color:'#be185d' }}>🎭</div>
            <div>
              <div className="p1-card-title">Style &amp; Tone</div>
              <div className="p1-card-subtitle">Beat style, pacing, language intensity, and spice</div>
            </div>
          </div>
          <div className="p1-card-body">
            {/* Beat Style */}
            <div className={`p1-field-group ${hl("beat_style")}`}>
              <div className="p1-label">Beat Style</div>
              <BeatStyleSelect value={form.beat_style} onChange={v => handleChange("beat_style", v)} bookType={form.book_type} />
              {autoHints.beat_style?.reasoning && (
                <p className="text-xs text-violet-600 flex items-start gap-1 mt-1.5">
                  <span className="shrink-0">✦</span>
                  <span>Auto-selected: {autoHints.beat_style.reasoning}</span>
                </p>
              )}
            </div>

            {/* Spice Level + Language Intensity side by side */}
            <div className="p1-grid-2 p1-field-group">
              {/* POV/Tense Presets */}
              <div className="col-span-2">
                <div className="p1-label mb-2">Narrative Style Preset</div>
                <p className="text-xs text-slate-400 mb-3">Pick a preset to auto-fill POV and tense, or choose manually below.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
                  {(form.book_type === 'nonfiction' ? NONFICTION_PRESETS : FICTION_PRESETS).map(preset => {
                    const isActive = form.pov_mode === preset.pov && form.tense === preset.tense;
                    const isSuggested = autoHints.pov_mode?.preset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => { handleChange("pov_mode", preset.pov); handleChange("tense", preset.tense); }}
                        className={`text-left p-2.5 rounded-lg border transition-all ${
                          isActive
                            ? 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30'
                            : isSuggested
                              ? 'border-violet-400/40 bg-violet-500/5 hover:border-violet-400'
                              : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-medium ${isActive ? 'text-violet-300' : 'text-slate-200'}`}>{preset.label}</span>
                          {isSuggested && !isActive && <span className="text-[10px] text-violet-400 bg-violet-500/20 px-1.5 py-0.5 rounded-full">Suggested</span>}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-tight">{preset.desc}</p>
                        <p className="text-[10px] text-slate-500 mt-1 italic">{preset.examples}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* POV Mode */}
              <div className={hl("pov_mode")}>
                <div className="p1-label">Point of View</div>
                <Select value={form.pov_mode || ""} onValueChange={v => handleChange("pov_mode", v)}>
                  <SelectTrigger><SelectValue placeholder="Select POV..." /></SelectTrigger>
                  <SelectContent>
                    {(form.book_type === 'nonfiction' ? NF_POV_OPTIONS : POV_OPTIONS).map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        <span>{p.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.pov_mode && <p className="text-xs text-slate-400 mt-1">{[...POV_OPTIONS, ...NF_POV_OPTIONS].find(p => p.value === form.pov_mode)?.desc}</p>}
                {autoHints.pov_mode?.reasoning && (
                  <p className="text-xs text-violet-600 flex items-start gap-1 mt-1.5">
                    <span className="shrink-0">✦</span>
                    <span>Suggested: {autoHints.pov_mode.reasoning}</span>
                  </p>
                )}
              </div>
              {/* Tense */}
              <div className={hl("tense")}>
                <div className="p1-label">Narrative Tense</div>
                <Select value={form.tense || ""} onValueChange={v => handleChange("tense", v)}>
                  <SelectTrigger><SelectValue placeholder="Select tense..." /></SelectTrigger>
                  <SelectContent>
                    {TENSE_OPTIONS.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <span>{t.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.tense && <p className="text-xs text-slate-400 mt-1">{TENSE_OPTIONS.find(t => t.value === form.tense)?.desc}</p>}
                {autoHints.tense?.reasoning && !autoHints.pov_mode?.reasoning && (
                  <p className="text-xs text-violet-600 flex items-start gap-1 mt-1.5">
                    <span className="shrink-0">✦</span>
                    <span>Suggested: {autoHints.tense.reasoning}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Spice Level + Language Intensity side by side */}
            <div className="p1-grid-2 p1-field-group">
              {form.book_type === "fiction" && (
                <div className={hl("spice_level")}>
                  <div className="p1-label">Spice Level</div>
                  <SpiceLevelSelect value={form.spice_level} onChange={v => handleChange("spice_level", v)} />
                  {autoHints.spice_level?.reasoning && (
                    <p className="text-xs text-violet-600 flex items-start gap-1 mt-1.5">
                      <span className="shrink-0">✦</span>
                      <span>Auto-selected: {autoHints.spice_level.reasoning}</span>
                    </p>
                  )}
                </div>
              )}
              <div className={hl("language_intensity")}>
                <div className="p1-label">Language Intensity</div>
                <LanguageIntensitySelect value={form.language_intensity} onChange={v => handleChange("language_intensity", v)} />
                {autoHints.language_intensity?.reasoning && (
                  <p className="text-xs text-violet-600 flex items-start gap-1 mt-1.5">
                    <span className="shrink-0">✦</span>
                    <span>Auto-selected: {autoHints.language_intensity.reasoning}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Erotica Prose Register — only visible when Spice Level >= 2 */}
            {form.book_type === "fiction" && (parseInt(form.spice_level) || 0) >= 2 && (
              <div className={`p1-field-group ${hl("erotica_register")}`}>
                <div className="p1-label">Intimate Scene Prose Style</div>
                <p className="text-xs text-slate-500 mb-2">Controls the vocabulary and tone of explicit scenes. Does not affect non-intimate prose.</p>
                <div className="grid grid-cols-4 gap-2">
                  {EROTICA_REGISTER_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleChange("erotica_register", opt.value)}
                      className={`p-2.5 rounded-lg border text-center transition-all ${
                        (parseInt(form.erotica_register) || 0) === opt.value
                          ? "border-pink-500 bg-pink-50 text-pink-900 ring-1 ring-pink-300"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{opt.label}</span>
                      <span className="block text-[10px] mt-0.5 text-slate-400">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Genre Content Enforcement (DeepSeek only) */}
            {form.ai_model?.includes("deepseek") && (
              <div className="p1-field-group rounded-lg bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="enforce_genre"
                    checked={form.enforce_genre_content}
                    onChange={e => handleChange("enforce_genre_content", e.target.checked)}
                    className="mt-1"
                  />
                  <div>
                    <label htmlFor="enforce_genre" className="font-medium text-sm text-slate-800 cursor-pointer">Enforce Genre Content Requirements</label>
                    <p className="text-xs text-slate-600 mt-1">When enabled, DeepSeek will be required to include genre-appropriate content. Disable for cleaner content regardless of genre tag.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ SECTION 3b — NONFICTION RESEARCH & STRUCTURE (NF only) ══ */}
        {form.book_type === "nonfiction" && (
          <div className="p1-card" id="sec-nf-research">
            <div className="p1-card-header">
              <div className="p1-card-icon" style={{ background:'#dbeafe', color:'#1d4ed8' }}>🔬</div>
              <div>
                <div className="p1-card-title">Nonfiction Research &amp; Structure</div>
                <div className="p1-card-subtitle">Topic research, knowledge base, and chapter organization mode</div>
              </div>
            </div>
            <div className="p1-card-body">
              {/* NF Structure Mode */}
              <div className="p1-field-group">
                <div className="p1-label mb-2">Book Structure</div>
                <p className="text-xs text-slate-400 mb-3">How should the chapters be organized? This shapes the outline generator's approach.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {NF_STRUCTURE_MODES.map(mode => {
                    const isActive = form.nf_structure_mode === mode.value;
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => handleChange("nf_structure_mode", mode.value)}
                        className={`text-left p-3 rounded-lg border transition-all ${
                          isActive
                            ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
                            : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                        }`}
                      >
                        <span className={`text-sm font-medium ${isActive ? 'text-blue-300' : 'text-slate-200'}`}>{mode.label}</span>
                        <p className="text-[11px] text-slate-400 mt-1 leading-tight">{mode.desc}</p>
                        <p className="text-[10px] text-slate-500 mt-1 italic">{mode.examples}</p>
                        <p className="text-[10px] text-blue-400/60 mt-1">Chapter pattern: {mode.chapterStyle}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Topic Research Trigger */}
              <div className="p1-field-group">
                <div className="p1-label mb-2">Topic Research</div>
                <p className="text-xs text-slate-400 mb-3">
                  AI will research your topic deeply — finding real frameworks, authoritative sources, competing books, and suggested chapter structure. This knowledge base feeds into the outline generator.
                </p>
                {form.nf_knowledge_base_status === "researching" ? (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-blue-300">Researching topic... this may take 30-60 seconds</span>
                  </div>
                ) : form.nf_knowledge_base_status === "complete" ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30">
                      <span className="text-green-400">✓</span>
                      <span className="text-sm text-green-300">Knowledge base generated — will be used for outline generation</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => triggerTopicResearch()}
                      className="text-xs text-slate-400 hover:text-slate-200 underline"
                    >
                      Re-run research with updated topic
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => triggerTopicResearch()}
                    disabled={!form.topic || form.topic.trim().length < 10}
                    className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    🔬 Research This Topic
                  </button>
                )}
                {!form.topic || form.topic.trim().length < 10 ? (
                  <p className="text-xs text-amber-400/70 mt-2">Enter a detailed topic/premise above to enable research</p>
                ) : null}
              </div>

              {/* NF Key Frameworks (populated by research, editable) */}
              <div className="p1-field-group">
                <div className="p1-label">Key Frameworks</div>
                <p className="text-xs text-slate-400 mb-1">Major models, theories, or organizing principles for your topic. Auto-populated by research, editable.</p>
                <textarea
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm p-3 min-h-[80px] resize-y"
                  value={form.nf_key_frameworks || ""}
                  onChange={e => handleChange("nf_key_frameworks", e.target.value)}
                  placeholder="e.g., Person-Centered Care Model, Maslow's Hierarchy applied to caregiving, Trauma-Informed Care framework..."
                />
              </div>

              {/* NF Audience Needs (populated by research, editable) */}
              <div className="p1-field-group">
                <div className="p1-label">Target Audience Needs</div>
                <p className="text-xs text-slate-400 mb-1">What your readers need to learn, their pain points, their knowledge gaps. Auto-populated by research, editable.</p>
                <textarea
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm p-3 min-h-[80px] resize-y"
                  value={form.nf_audience_needs || ""}
                  onChange={e => handleChange("nf_audience_needs", e.target.value)}
                  placeholder="e.g., New caregivers overwhelmed by daily challenges, lack of training in behavioral support, need practical not theoretical guidance..."
                />
              </div>
            </div>
          </div>
        )}

        {/* ══ SECTION 4 — VOICE & WRITING MODEL ══ */}
        <div className="p1-card" id="sec-voice">
          <div className="p1-card-header">
            <div className="p1-card-icon" style={{ background:'#dcfce7', color:'#15803d' }}>🖊</div>
            <div>
              <div className="p1-card-title">Voice &amp; Writing Model</div>
              <div className="p1-card-subtitle">Author style and AI engine selection</div>
            </div>
          </div>
          <div className="p1-card-body">
            <div className={`p1-field-group ${hl("author_voice")}`}>
              <div className="p1-label">Author Voice</div>
              <AuthorVoiceSelector value={form.author_voice} onValueChange={v => handleChange("author_voice", v)} />
              {autoHints.author_voice?.reasoning && (
                <p className="text-xs text-violet-600 flex items-start gap-1 mt-1.5">
                  <span className="shrink-0">✦</span>
                  <span>Auto-selected: {autoHints.author_voice.reasoning}</span>
                </p>
              )}
            </div>

            <div className="p1-field-group" style={{ marginBottom: 0 }}>
              <div className="p1-label">Writing Model</div>
              <ModelSelector
                project={form}
                updateProject={(updates) => {
                  Object.entries(updates).forEach(([k, v]) => handleChange(k, v));
                }}
              />
            </div>
          </div>
        </div>

        {/* ══ SECTION 5 — PROTAGONIST PSYCHOLOGY ══ */}
        {form.book_type === "fiction" && (
          <div className="p1-card" id="sec-psych">
            <div className="p1-card-header">
              <div className="p1-card-icon" style={{ background:'#fce7f3', color:'#9d174d' }}>🧠</div>
              <div>
                <div className="p1-card-title">Protagonist Psychology</div>
                <div className="p1-card-subtitle">Deep interiority — injected into every chapter prompt</div>
              </div>
              <span className="p1-card-badge">Optional</span>
            </div>
            <div className="p1-card-body">
              <p style={{ fontSize:12, color:'#52516a', marginBottom:12, lineHeight:1.5 }}>
                Define your protagonist's deep interior psychology. At least one scene beat per chapter will connect to one of these layers.
              </p>

              <div className="p1-psych-controls">
                <ProtagonistInteriorityInferButton form={form} onChange={handleChange} />
                <button
                  className="p1-psych-toggle"
                  onClick={() => setPsychOpen(o => !o)}
                >
                  {psychOpen ? 'Hide fields' : 'Show fields'}
                  <span className={`p1-psych-arrow${psychOpen ? ' open' : ''}`}>▾</span>
                </button>
              </div>

              {psychOpen && (
                <div className="p1-psych-fields">
                  <div className="p1-field-group">
                    <div className="p1-psych-num">1. Before Belief</div>
                    <div className="p1-label">What did the protagonist believe their life was FOR before this story?</div>
                    <Textarea
                      className="text-sm"
                      rows={2}
                      placeholder="Their identity, role, what gave them meaning before the story upended everything..."
                      value={form.protagonist_life_purpose || ""}
                      onChange={e => handleChange("protagonist_life_purpose", e.target.value)}
                    />
                  </div>
                  <div className="p1-field-group">
                    <div className="p1-psych-num">2. Core Wound</div>
                    <div className="p1-label">What failure or loss still defines how they see themselves?</div>
                    <Textarea
                      className="text-sm"
                      rows={2}
                      placeholder="A specific event or pattern, not vague — the wound that shaped their worldview..."
                      value={form.protagonist_core_wound || ""}
                      onChange={e => handleChange("protagonist_core_wound", e.target.value)}
                    />
                  </div>
                  <div className="p1-field-group">
                    <div className="p1-psych-num">3. Hidden Self-Belief</div>
                    <div className="p1-label">What do they privately believe is WRONG with them?</div>
                    <Textarea
                      className="text-sm"
                      rows={2}
                      placeholder="The thing they've never said aloud — their deepest shame or inadequacy..."
                      value={form.protagonist_self_belief || ""}
                      onChange={e => handleChange("protagonist_self_belief", e.target.value)}
                    />
                  </div>
                  <div className="p1-field-group">
                    <div className="p1-psych-num">4. Secret Desire</div>
                    <div className="p1-label">What does the supernatural/alien/fantasy element offer them?</div>
                    <Textarea
                      className="text-sm"
                      rows={2}
                      placeholder="What the bond/relationship offers that the human world never could..."
                      value={form.protagonist_secret_desire || ""}
                      onChange={e => handleChange("protagonist_secret_desire", e.target.value)}
                    />
                  </div>
                  <div className="p1-field-group" style={{ marginBottom: 0 }}>
                    <div className="p1-psych-num">5. Behavioral Tells</div>
                    <div className="p1-label">Observable patterns that reveal interiority without stating it</div>
                    <Textarea
                      className="text-sm"
                      rows={2}
                      placeholder="e.g. Defers decisions, keeps exits available, can't commit, fidgets when cornered..."
                      value={form.protagonist_behavioral_tells || ""}
                      onChange={e => handleChange("protagonist_behavioral_tells", e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ SECTION 6 — RESOURCES & NOTES ══ */}
        <div className="p1-card" id="sec-resources">
          <div className="p1-card-header">
            <div className="p1-card-icon" style={{ background:'#fef3c7', color:'#92400e' }}>📂</div>
            <div>
              <div className="p1-card-title">Resources &amp; Notes</div>
              <div className="p1-card-subtitle">Additional requirements and source files for context</div>
            </div>
          </div>
          <div className="p1-card-body">
            <div className={`p1-field-group ${hl("additional_requirements")}`}>
              <div className="p1-label">Additional Requirements</div>
              <Textarea
                rows={2}
                placeholder="Any other requirements or notes..."
                value={form.additional_requirements}
                onChange={e => handleChange("additional_requirements", e.target.value)}
              />
            </div>

            <div className="p1-field-group" style={{ marginBottom: 0 }}>
              <SourceFilesCard projectId={projectId} />
            </div>
          </div>
        </div>

        {/* ══ FOOTER BUTTONS ══ */}
        <div className="flex justify-end gap-3 py-6 mt-4 border-t border-slate-200 bg-white rounded-xl px-4">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} variant="outline">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Specifications
          </Button>
          <Button disabled={!canProceed} onClick={onProceed} className="bg-indigo-600 hover:bg-indigo-700">
            Proceed to Outline
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

      </div>{/* /phase1-form */}

      <PromptCatalogBrowser
        isOpen={showCatalogBrowser}
        onClose={() => setShowCatalogBrowser(false)}
        onSelectPrompt={handleSelectPrompt}
        preselectedGenre={form.genre}
        preselectedBookType={form.book_type}
      />

      <FloatingChat projectId={projectId} form={form} />
    </div>
  );
}