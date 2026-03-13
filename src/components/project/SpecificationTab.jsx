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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Loader2, Send, ArrowRight, BookOpen, MessageSquare, Wand2, Search, X, Lightbulb, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import SourceFilesCard from "./SourceFilesCard";
import PromptSuggestions from "./PromptSuggestions";
import PromptCatalogBrowser from "./PromptCatalogBrowser";
import AuthorVoiceSelector from "./AuthorVoiceSelector";
import { BeatStyleSelect, SpiceLevelSelect, LanguageIntensitySelect } from "./BeatStyleSelector";
import ModelSuggestionPanel from "./ModelSuggestionPanel";
import CharacterInterviewPanel from "./CharacterInterviewPanel";
import ProtagonistInterioritySection from "./ProtagonistInterioritySection";

const FICTION_GENRES = ["Fantasy", "Science Fiction", "Mystery", "Thriller", "Romance", "Historical Fiction", "Horror", "Literary Fiction", "Adventure", "Dystopian", "Young Adult", "Crime", "Magical Realism", "Western", "Satire", "Erotica"];
const NONFICTION_GENRES = ["Self-Help", "Business", "Biography", "History", "Science", "Technology", "Philosophy", "Psychology", "Health", "Travel", "Education", "Politics", "True Crime", "Memoir", "Cooking"];

const ALL_VOICE_IDS = ["basic","hemingway","austen","morrison","mccarthy","vonnegut","didion","tolkien","rowling","leguin","gaiman","pratchett","chandler","christie","marquez","atwood","king","gladwell","bryson","sagan"];

function mapToAuthorVoiceOption(inferred) {
  const key = inferred?.trim();
  if (!key) return null;
  // Direct ID match
  if (ALL_VOICE_IDS.includes(key)) return key;
  if (ALL_VOICE_IDS.includes(key.toLowerCase())) return key.toLowerCase();
  // Label-to-ID fuzzy map for common AI variations
  const fuzzy = {
    'ernest hemingway':'hemingway','jane austen':'austen','toni morrison':'morrison',
    'cormac mccarthy':'mccarthy','kurt vonnegut':'vonnegut','joan didion':'didion',
    'j.r.r. tolkien':'tolkien','jrr tolkien':'tolkien','j.k. rowling':'rowling','jk rowling':'rowling',
    'ursula k. le guin':'leguin','ursula le guin':'leguin','neil gaiman':'gaiman',
    'terry pratchett':'pratchett','raymond chandler':'chandler','agatha christie':'christie',
    'gabriel garcia marquez':'marquez','gabriel garcía márquez':'marquez',
    'margaret atwood':'atwood','stephen king':'king','malcolm gladwell':'gladwell',
    'bill bryson':'bryson','carl sagan':'sagan',
    'terse':'hemingway','understated':'hemingway','witty':'austen','ironic':'austen',
    'lyrical':'morrison','poetic':'morrison','sparse':'mccarthy','biblical':'mccarthy',
    'absurdist':'vonnegut','darkly humorous':'vonnegut','cool':'didion','precise':'didion',
    'mythic':'tolkien','elevated':'tolkien','accessible':'rowling','whimsical':'rowling',
    'philosophical':'leguin','genre-blending':'gaiman','satirical':'pratchett','comedic':'pratchett',
    'hardboiled':'chandler','cynical':'chandler','noir':'chandler',
    'puzzle':'christie','misdirecting':'christie',
    'lush':'marquez','sprawling':'marquez','sharp':'atwood','sardonic':'atwood',
    'conversational':'king','dread':'king','horror':'king',
    'narrative-driven':'gladwell','counterintuitive':'gladwell',
    'humorous':'bryson','curious':'bryson','awe-inspiring':'sagan',
  };
  const lk = key.toLowerCase();
  if (fuzzy[lk]) return fuzzy[lk];
  for (const [label, value] of Object.entries(fuzzy)) {
    if (lk.includes(label) || label.includes(lk)) return value;
  }
  console.warn(`mapToAuthorVoiceOption: no match for "${inferred}"`);
  return null;
}

function mapToBeatStyleOption(inferred) {
  const map = {
    'Fast-Paced Thriller':'fast-paced-thriller','Gritty Cinematic':'gritty-cinematic',
    'Hollywood Blockbuster':'hollywood-blockbuster','Slow Burn':'slow-burn',
    'Clean Romance':'clean-romance','Faith-Infused Contemporary':'faith-infused-contemporary',
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
    'romance':'clean-romance','slow burn':'slow-burn','slow-burn romance':'slow-burn',
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

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    base44.functions.invoke('configSubgenres', {})
      .then(res => setSubgenresData(res.data || {}))
      .catch(err => console.error('Failed to load configs:', err));
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
      if (field === "book_type") { updated.genre = ""; updated.subgenre = ""; updated.beat_style = ""; updated.tone_style = ""; updated.beat_sheet_template = "auto"; }
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

      // Map beat_style through fuzzy mapper
      const beatKey = mapToBeatStyleOption(expanded.beat_style) || "";

      setForm(prev => {
        const next = { ...prev };
        next.topic = expanded.expanded_brief || prev.topic;

        const fill = (field, val) => {
          if (val && !prev[field]) { next[field] = val; filled.push(field); }
        };
        fill("subgenre", expanded.subgenre);
        fill("beat_style", beatKey);
        fill("detail_level", expanded.detail_level);
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
        if (voiceId !== "basic" || !prev.author_voice) {
          next.author_voice = voiceId;
          filled.push("author_voice");
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

  const canProceed = form.book_type && form.genre && form.topic?.trim();
  const genres = form.book_type === "fiction" ? FICTION_GENRES : NONFICTION_GENRES;
  const currentSubgenres = form.genre && subgenresData[form.book_type]?.[form.genre]
    ? subgenresData[form.book_type][form.genre] : [];

  const hl = (field) => highlightedFields[field]
    ? "ring-2 ring-violet-400 ring-offset-1 rounded-md transition-all duration-500"
    : "";

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes field-glow {
          0%   { box-shadow: 0 0 0 0 rgba(124,58,237,0.5); }
          50%  { box-shadow: 0 0 0 6px rgba(124,58,237,0.15); }
          100% { box-shadow: 0 0 0 0 rgba(124,58,237,0); }
        }
        .field-highlight { animation: field-glow 1.8s ease-out; }
      `}</style>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-4 h-4 text-indigo-500" />
            Project Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Topic / Premise — full width */}
          <div>
            <Label className="text-sm font-medium">Topic / Premise</Label>
            <Textarea
              className="mt-1.5"
              rows={3}
              placeholder="A story about..."
              value={form.topic}
              onChange={e => handleChange("topic", e.target.value)}
            />
            <div className="flex gap-2 mt-2 flex-wrap">
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
          </div>

          {/* Prompt Catalog Suggestions */}
          <PromptSuggestions
            bookType={form.book_type}
            genre={form.genre}
            onSelect={handleSelectPrompt}
            onBrowseAll={() => setShowCatalogBrowser(true)}
          />

          {/* 2-column grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left column */}
            <div className="space-y-4">
              <div className={hl("book_type")}>
                <Label className="text-sm font-medium">Book Type</Label>
                <Select value={form.book_type} onValueChange={v => handleChange("book_type", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fiction">Fiction</SelectItem>
                    <SelectItem value="nonfiction">Nonfiction</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className={hl("genre")}>
                <Label className="text-sm font-medium">Genre / Category</Label>
                <Select value={form.genre} onValueChange={v => handleChange("genre", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select genre..." /></SelectTrigger>
                  <SelectContent>
                    {genres.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {currentSubgenres.length > 0 && (
                <div className={hl("subgenre")}>
                  <Label className="text-sm font-medium">Subgenre <span className="text-slate-400 font-normal">(optional)</span></Label>
                  <Select value={form.subgenre} onValueChange={v => handleChange("subgenre", v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select a subgenre..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {currentSubgenres.map(sg => <SelectItem key={sg} value={sg}>{sg}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className={hl("target_length")}>
                <Label className="text-sm font-medium">Target Length</Label>
                <Select value={form.target_length} onValueChange={v => handleChange("target_length", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TARGET_LENGTHS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Chapter Count <span className="text-slate-400 font-normal">(optional)</span></Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min={1}
                  max={100}
                  placeholder="e.g. 20"
                  value={form.chapter_count || ""}
                  onChange={e => handleChange("chapter_count", e.target.value ? parseInt(e.target.value) : "")}
                />
              </div>

              <div className={hl("detail_level")}>
                <Label className="text-sm font-medium">Detail Level</Label>
                <Select value={form.detail_level} onValueChange={v => handleChange("detail_level", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DETAIL_LEVELS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <div className={hl("target_audience")}>
                <Label className="text-sm font-medium">Target Audience</Label>
                <Input
                  className="mt-1.5"
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

              <div className={hl("beat_style")}>
                <Label className="text-sm font-medium">Beat Style</Label>
                <BeatStyleSelect value={form.beat_style} onChange={v => handleChange("beat_style", v)} bookType={form.book_type} />
              </div>

              <div className={hl("beat_sheet_template")}>
                <Label className="text-sm font-medium">Story Structure</Label>
                <Select value={form.beat_sheet_template || "auto"} onValueChange={v => handleChange("beat_sheet_template", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
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
                    ? "Controls pacing structure — what kind of chapter goes where. Auto picks the best fit for your genre."
                    : "Controls argument structure — what each chapter's job is. Auto picks the best fit for your genre."}
                </p>
              </div>

              {form.book_type === "fiction" && (
                <div>
                  <Label className="text-sm font-medium">Spice Level</Label>
                  <SpiceLevelSelect value={form.spice_level} onChange={v => handleChange("spice_level", v)} />
                </div>
              )}

              <div>
                <Label className="text-sm font-medium">Language Intensity</Label>
                <LanguageIntensitySelect value={form.language_intensity} onChange={v => handleChange("language_intensity", v)} />
              </div>

              <div className={hl("author_voice")}>
                <Label className="text-sm font-medium">Author Voice</Label>
                <AuthorVoiceSelector value={form.author_voice} onValueChange={v => handleChange("author_voice", v)} />
                {autoHints.author_voice?.reasoning && (
                  <p className="text-xs text-violet-600 flex items-start gap-1 mt-1.5">
                    <span className="shrink-0">✦</span>
                    <span>Auto-selected: {autoHints.author_voice.reasoning}</span>
                  </p>
                )}
              </div>

              <div className={hl("ai_model")}>
                <ModelSuggestionPanel
                  genre={form.genre}
                  bookType={form.book_type}
                  selectedModel={form.ai_model}
                  onSelectModel={(id) => handleChange("ai_model", id)}
                />
              </div>
            </div>
          </div>

          {/* Genre Content Enforcement (DeepSeek only) */}
          {form.ai_model?.includes("deepseek") && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
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
                  <p className="text-xs text-slate-600 mt-1">When enabled, DeepSeek will be required to include genre-appropriate content (intimate scenes in erotica/romance). Disable for cleaner content regardless of genre tag.</p>
                </div>
              </div>
            </div>
          )}

          {/* Protagonist Interiority — shown for all fiction */}
          {form.book_type === "fiction" && (
            <ProtagonistInterioritySection form={form} onChange={handleChange} />
          )}

          {/* Additional Requirements — full width */}
          <div className={hl("additional_requirements")}>
            <Label className="text-sm font-medium">Additional Requirements</Label>
            <Textarea
              className="mt-1.5"
              rows={2}
              placeholder="Any other requirements or notes..."
              value={form.additional_requirements}
              onChange={e => handleChange("additional_requirements", e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} variant="outline" className="flex-1">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Specifications
            </Button>
            <Button disabled={!canProceed} onClick={onProceed} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
              Proceed to Outline
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

        </CardContent>
      </Card>

      <SourceFilesCard projectId={projectId} />

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