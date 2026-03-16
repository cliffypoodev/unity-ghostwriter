// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — REVIEW & POLISH (v10)
// ═══════════════════════════════════════════════════════════════════════════════
// Scanner dashboard (Rotten Tomatoes score), per-chapter quality cards,
// on-demand Prose Polisher. Uses the same regex patterns as the bot pipeline.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Loader2, RefreshCw, Sparkles, Check, X, AlertCircle,
  AlertTriangle, ChevronDown, ChevronUp, Wand2, BookOpen, Zap,
  FileText, Target, Eye, MessageSquare, Clock, BarChart3, Download
} from "lucide-react";
import ManuscriptUploader from "./ManuscriptUploader";
import DeepReviewPanel from "./DeepReviewPanel";

// ═══ SCANNER PATTERNS (mirrored from bot pipeline) ═══

const SCAN_CATEGORIES = {
  instruction_leak: { label: "Instruction Leaks", icon: "🚨", weight: 25, color: "red" },
  tense_drift: { label: "Tense Drift", icon: "⏱", weight: 15, color: "red" },
  interiority_repetition: { label: "Interiority Repetition", icon: "🔁", weight: 10, color: "amber" },
  transition_crutch: { label: "Transition Crutches", icon: "🔗", weight: 8, color: "amber" },
  sensory_opener: { label: "Sensory Opener Monotony", icon: "👁", weight: 8, color: "amber" },
  scaffolding: { label: "Placeholder Scaffolding", icon: "🏗", weight: 10, color: "amber" },
  fiction_cliche: { label: "Fiction Clichés", icon: "📝", weight: 5, color: "blue" },
  hedging: { label: "Hedging Fog", icon: "🌫", weight: 5, color: "blue" },
  recap_bloat: { label: "Recap Bloat", icon: "♻️", weight: 5, color: "blue" },
  generic_conclusion: { label: "Generic Conclusions", icon: "🔚", weight: 5, color: "blue" },
  word_count: { label: "Word Count Issues", icon: "📏", weight: 4, color: "blue" },
  nf_fiction_trap: { label: "NF Crutch / Fiction Trap", icon: "📖", weight: 10, color: "amber" },
  nf_thesis_ending: { label: "NF Thesis Restatement", icon: "🔄", weight: 5, color: "amber" },
  nf_padding: { label: "NF Repetitive Padding", icon: "📋", weight: 8, color: "amber" },
  nf_unlabeled_reconstruction: { label: "NF Unlabeled Reconstruction", icon: "🎭", weight: 12, color: "red" },
  nf_polish: { label: "NF Polish Target", icon: "✨", weight: 5, color: "blue" },
  gemini_nf_cap: { label: "NF Frequency Cap", icon: "🔢", weight: 5, color: "amber" },
  gemini_nf_ban: { label: "NF Banned Phrase", icon: "🚫", weight: 10, color: "red" },
  gemini_nf_manuscript_cap: { label: "NF Manuscript Cap", icon: "📊", weight: 5, color: "amber" },
};

const PATTERNS = {
  instruction_leak: [
    [/\bAdjust the (year|name|time|date|setting|location|chapter) to (be |match |reflect )/gi, "Adjust the [X] to..."],
    [/\bRewrite to (focus|include|show|address|reflect|incorporate|emphasize)/gi, "Rewrite to..."],
    [/\bAddress the .{1,40}(incident|event|scene|cliffhanger|plot point) from the previous/gi, "Address the [X] from previous"],
    [/\b(consistent|inconsistent) with the (established |)?(timeline|outline|beat sheet|story bible)/gi, "consistent with the timeline"],
    [/\blike an anchor to this moment/gi, "like an anchor to this moment"],
    [/\badd a clear time transition/gi, "add a clear time transition"],
    [/\bchapter break indicator/gi, "chapter break indicator"],
    [/complete the (chapter|scene|story|section) or indicate/gi, "complete the chapter or indicate"],
    [/indicate if this is intentional/gi, "indicate if this is intentional"],
    [/should (I|we) (continue|complete|finish|expand)/gi, "should I continue/complete"],
    [/\[NOTE TO (AUTHOR|EDITOR|AI|SELF)\b/gi, "[NOTE TO AUTHOR/AI]"],
    [/\[TODO[:\s]/gi, "[TODO]"],
    [/as (instructed|requested|specified) (in|by) the (prompt|system|user)/gi, "as instructed by the prompt"],
    [/per the (outline|beat sheet|specification)/gi, "per the outline/beat sheet"],
    // NF editorial instruction leaks (v11.6)
    [/\bRemove specific (day|time|date|location|details?|sensory|first-person|atmospheric)/gi, "Remove specific [X]..."],
    [/\b(Anchor|anchor) (these|this|the) (detail|fact|claim)s? to/gi, "Anchor details to..."],
    [/\bEither (cite|source|reference|identify) (the |a )?(specific|actual|real)/gi, "Either cite/identify the specific..."],
    [/\bReplace with documented (examples?|historical|facts|evidence)/gi, "Replace with documented..."],
    [/\bUse general (timeframe|terms|reference|description)/gi, "Use general [X]..."],
    [/\bProvide (documentary|specific|archival) source/gi, "Provide documentary source..."],
    [/\bLabel as (representative|illustrative|composite|general)/gi, "Label as representative..."],
    [/\bFrame as (hypothetical|composite|reconstructed|general)/gi, "Frame as [X]..."],
    [/\bor (clearly |)label as (representative|composite|illustrative)/gi, "or label as representative..."],
    [/\bor (remove|begin with|provide|cite) (this |)(fictional|specific|actual|documented)/gi, "or remove/cite fictional/documented..."],
    [/\bCite specific (memoir|interview|archive|document|published)/gi, "Cite specific [source]..."],
  ],
  tense_past_drift: [
    [/\b(he|she|they|it|I|we)\s+(walks|runs|says|thinks|feels|knows|sees|hears|stands|sits|looks|moves|turns|opens|closes|steps|reaches|pulls|pushes|watches|presses|asks|cuts|fills|takes|sets|picks|drops|begins|starts|stops|grabs|holds|catches|lifts|places)\b/gi, "present-tense verb in past-tense narrative"],
  ],
  tense_present_drift: [
    [/\b(he|she|they|it|I|we)\s+(walked|ran|said|thought|felt|knew|saw|heard|stood|sat|looked|moved|turned|opened|closed|stepped|reached|pulled|pushed|watched|pressed|asked|cut|filled|took|set|picked|dropped|began|started|stopped|grabbed|held|caught|lifted|placed)\b/gi, "past-tense verb in present-tense narrative"],
  ],
  interiority_repetition: [
    [/\bhollow\b/gi, "hollow", 2], [/\bhollowness\b/gi, "hollowness", 1],
    [/\bempty\b/gi, "empty", 3], [/\bemptiness\b/gi, "emptiness", 2],
    [/\bshattered\b/gi, "shattered", 2], [/\bbroken\b/gi, "broken", 3],
    [/\bnumb(ness)?\b/gi, "numb/numbness", 2], [/\bvoid\b/gi, "void", 2],
    [/\baching?\b/gi, "ache/aching", 4], [/\bfragile\b/gi, "fragile", 3],
  ],
  transition_crutch: [
    [/\bFurthermore\b/g, "Furthermore"], [/\bMoreover\b/g, "Moreover"],
    [/\bIn addition\b/gi, "In addition"], [/\bAdditionally\b/g, "Additionally"],
    [/\bIt'?s worth noting that\b/gi, "It's worth noting that"],
    [/\bAs (mentioned|discussed|noted|stated) (earlier|above|previously|before)\b/gi, "As mentioned earlier"],
    [/\bThis (brings|leads|takes) us to\b/gi, "This brings/leads us to"],
    [/\bLet us (now )?turn (our attention )?to\b/gi, "Let us turn to"],
    [/\bWith this (understanding|context|background|foundation)\b/gi, "With this understanding"],
    [/\bUltimately\b/g, "Ultimately"],
  ],
  scaffolding: [
    [/\bThis (chapter|section|part) (will )?(explore|examine|discuss|investigate|look at|delve into|unpack)\b/gi, "This chapter explores..."],
    [/\bIn this (chapter|section|part),? we (will|shall|are going to)\b/gi, "In this chapter, we will..."],
    [/\bBefore (we|I) (begin|dive in|proceed|explore|examine)\b/gi, "Before we begin..."],
    [/\bLet'?s (begin|start|dive in|explore|examine|unpack)\b/gi, "Let's begin/explore..."],
    [/\bWhat (follows|comes next) is\b/gi, "What follows is..."],
  ],
  fiction_cliche: [
    [/\bLittle did (he|she|they) know\b/gi, "Little did they know"],
    [/\bUnbeknownst to\b/gi, "Unbeknownst to"],
    [/\bA (chill|shiver) (ran|crept|went|traveled) (down|up) (his|her|their) spine\b/gi, "A chill ran down their spine"],
    [/\b(He|She|They) let out a breath (he|she|they) didn'?t (know|realize)/gi, "breath they didn't know they were holding"],
    [/\bTime (seemed to|appeared to) (slow|stop|stand still|freeze)\b/gi, "Time seemed to slow"],
    [/\bA (single|lone) tear (rolled|slid|traced|tracked) down\b/gi, "A single tear rolled down"],
    [/\bDarkness (claimed|consumed|swallowed|took) (him|her|them)\b/gi, "Darkness claimed them"],
  ],
  hedging: [
    [/\bIt could be argued that\b/gi, "It could be argued that"],
    [/\bOne (might|could|may) (suggest|argue|say|think) that\b/gi, "One might suggest that"],
    [/\bPerhaps (it is|it's) (the case|true|fair to say) that\b/gi, "Perhaps it is the case that"],
    [/\bTo be (sure|fair|certain)\b/gi, "To be sure/fair"],
  ],
  recap_bloat: [
    [/\bAs (we'?ve?|I'?ve?) (discussed|seen|explored|examined|noted|mentioned|established)\b/gi, "As we've discussed"],
    [/\bTo (summarize|recap|sum up|review) (what we'?ve?|the above|our discussion)\b/gi, "To summarize..."],
    [/\bIn (summary|conclusion|closing|short)\b/gi, "In summary/conclusion"],
    [/\bThe (bottom line|key takeaway|main point) (is|here is)\b/gi, "The bottom line is"],
  ],
  generic_conclusion: [
    [/\bThe (story|tale|saga|history|legacy) of .{5,60} (reminds|teaches|shows|tells|demonstrates) us that\b/gi, "The story of X reminds us"],
    [/\bOnly time (will|would|could) tell\b/gi, "Only time will tell"],
    [/\bThe rest,? as they say,? is history\b/gi, "The rest is history"],
    [/\bAnd (so|thus),? the (stage was set|seeds were sown|wheels were set in motion)\b/gi, "And so the stage was set"],
  ],
};

// ═══ SCANNING ENGINE ═══

function stripDialogue(text) {
  return text.replace(/["\u201C][^"\u201D]*["\u201D]/g, "").replace(/'[^']*'/g, "");
}

function scanChapter(chapterText, chapterNum, tense) {
  const findings = [];
  const clean = stripDialogue(chapterText);
  const words = chapterText.trim().split(/\s+/).length;

  for (const [rx, label] of PATTERNS.instruction_leak) {
    const m = chapterText.match(rx);
    if (m) findings.push({ category: "instruction_leak", label, count: m.length, chapter: chapterNum, samples: m.slice(0, 2).map(s => s.slice(0, 100)) });
  }

  if (tense === "past") {
    for (const [rx] of PATTERNS.tense_past_drift) {
      const m = clean.match(rx);
      if (m && m.length > 3) findings.push({ category: "tense_drift", label: `${m.length} present-tense verbs in past-tense narrative`, count: m.length, chapter: chapterNum, samples: m.slice(0, 5).map(s => s.slice(0, 60)) });
    }
  } else if (tense === "present") {
    for (const [rx] of PATTERNS.tense_present_drift) {
      const m = clean.match(rx);
      if (m && m.length > 3) findings.push({ category: "tense_drift", label: `${m.length} past-tense verbs in present-tense narrative`, count: m.length, chapter: chapterNum, samples: m.slice(0, 5).map(s => s.slice(0, 60)) });
    }
  }

  for (const [rx, label, cap] of PATTERNS.interiority_repetition) {
    const m = chapterText.match(rx);
    if (m && m.length > cap) findings.push({ category: "interiority_repetition", label: `"${label}" x${m.length} (cap: ${cap})`, count: m.length, chapter: chapterNum });
  }

  const scanSimple = (patternKey, category) => {
    for (const [rx, label] of PATTERNS[patternKey]) {
      const m = chapterText.match(rx);
      if (m) findings.push({ category, label, count: m.length, chapter: chapterNum });
    }
  };
  scanSimple("transition_crutch", "transition_crutch");
  scanSimple("scaffolding", "scaffolding");
  scanSimple("fiction_cliche", "fiction_cliche");
  scanSimple("hedging", "hedging");
  scanSimple("recap_bloat", "recap_bloat");
  scanSimple("generic_conclusion", "generic_conclusion");

  const firstSentence = chapterText.trim().split(/[.!?]/)[0] || "";
  if (/^The\s+\w+[\s,]+\w*\s*(scent|smell|aroma|tang|taste|hum|buzz|drone|clinking|drumming|squeak|screech|creak|glow|glare|flicker|shimmer|warmth|chill|cold|cool|heat|damp|sharp|bitter|sweet|acrid|musty|stale|lingering)\b/i.test(firstSentence)) {
    findings.push({ category: "sensory_opener", label: "Sensory atmosphere formula", count: 1, chapter: chapterNum });
  } else if (/\b(scent|smell|aroma|odor|fragrance|stench|whiff)\b/i.test(firstSentence)) {
    findings.push({ category: "sensory_opener", label: "Scent description opener", count: 1, chapter: chapterNum });
  }

  return { findings, words };
}

function computeScore(allFindings, totalChapters) {
  let deductions = 0;
  for (const f of allFindings) {
    if (f.category === "instruction_leak") deductions += f.count * 8;
    else if (f.category === "tense_drift") deductions += Math.min(f.count * 0.5, 15);
    else if (f.category === "interiority_repetition") deductions += f.count * 0.3;
    else if (f.category === "sensory_opener") deductions += f.count * 1.5;
    else deductions += f.count * 0.5;
  }
  return Math.max(0, Math.min(100, Math.round(100 - deductions)));
}

// ═══ COMPONENTS ═══

function RTScoreGauge({ score }) {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  const label = score >= 80 ? "CERTIFIED FRESH" : score >= 60 ? "FRESH" : "ROTTEN";
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#1e293b" strokeWidth="10" />
        <circle cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round"
          transform="rotate(-90 70 70)" style={{ transition: "stroke-dasharray 1s ease" }} />
        <text x="70" y="62" textAnchor="middle" fontSize="32" fontWeight="bold" fill={color}>{score}</text>
        <text x="70" y="82" textAnchor="middle" fontSize="11" fill="#94a3b8">/ 100</text>
      </svg>
      <div className="flex items-center gap-1.5">
        <span className="text-lg">🍅</span>
        <span className={cn("text-sm font-bold tracking-wide", score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400")}>{label}</span>
      </div>
    </div>
  );
}

function CategoryRow({ category, findings }) {
  const cat = SCAN_CATEGORIES[category];
  if (!cat) return null;
  const totalInstances = findings.reduce((sum, f) => sum + f.count, 0);
  const colorMap = { red: "bg-red-500/20 text-red-400 border-red-500/30", amber: "bg-amber-500/20 text-amber-400 border-amber-500/30", blue: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/50">
      <div className="flex items-center gap-2">
        <span className="text-base">{cat.icon}</span>
        <span className="text-sm text-slate-200">{cat.label}</span>
      </div>
      <Badge className={cn("text-xs border", findings.length === 0 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : colorMap[cat.color])}>
        {findings.length === 0 ? "✓ Clean" : `${totalInstances} instance${totalInstances !== 1 ? "s" : ""}`}
      </Badge>
    </div>
  );
}

function ChapterCard({ chapter, findings, words, targetWords, onPolish, onFix, onRegenerate, polishing, fixing }) {
  const [expanded, setExpanded] = useState(false);
  const chFindings = findings.filter(f => f.chapter === chapter.number);
  const totalInstances = chFindings.reduce((sum, f) => sum + f.count, 0);
  const overTarget = targetWords && words > targetWords * 1.3;
  const hasLeaks = chFindings.some(f => f.category === "instruction_leak");
  const hasTenseDrift = chFindings.some(f => f.category === "tense_drift");
  const statusColor = hasLeaks ? "border-red-500/50 bg-red-500/5" : hasTenseDrift ? "border-amber-500/50 bg-amber-500/5" : chFindings.length > 0 ? "border-slate-600" : "border-emerald-500/30 bg-emerald-500/5";
  const isWorking = polishing || fixing;

  return (
    <div className={cn("rounded-xl border p-4 transition-all", statusColor)}>
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
            hasLeaks ? "bg-red-500 text-white" : hasTenseDrift ? "bg-amber-500 text-white" : chFindings.length > 0 ? "bg-slate-600 text-white" : "bg-emerald-500 text-white"
          )}>{chapter.number}</div>
          <div>
            <div className="text-sm font-medium text-slate-200 truncate max-w-[300px]">{chapter.title.replace(/^Chapter \d+:\s*/, "")}</div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className={cn("text-xs", overTarget ? "text-red-400 font-medium" : "text-slate-400")}>{words.toLocaleString()} words{overTarget ? " ⚠️" : ""}</span>
              {chFindings.length > 0 ? <span className="text-xs text-amber-400">{totalInstances} issue{totalInstances !== 1 ? "s" : ""}</span> : <span className="text-xs text-emerald-400">✓ Clean</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          {/* ── Action buttons ── */}
          {chFindings.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {/* Polish — fixes transition crutches, clichés, hedging, etc */}
              <Button size="sm" disabled={isWorking}
                className="text-xs h-8 bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
                onClick={(e) => { e.stopPropagation(); onPolish(chapter.number); }}>
                {polishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                Polish Prose
              </Button>

              {/* Fix — runs style enforcer on this chapter */}
              <Button size="sm" disabled={isWorking}
                className="text-xs h-8 bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                onClick={(e) => { e.stopPropagation(); onFix(chapter.number); }}>
                {fixing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Fix Issues
              </Button>

              {/* Regenerate — for instruction leaks that can't be patched */}
              {hasLeaks && (
                <Button size="sm" disabled={isWorking} variant="outline"
                  className="text-xs h-8 border-red-500/40 text-red-400 hover:bg-red-500/10 gap-1.5"
                  onClick={(e) => { e.stopPropagation(); onRegenerate(chapter.number); }}>
                  <RefreshCw className="w-3 h-3" />
                  Regenerate Chapter
                </Button>
              )}
            </div>
          )}

          {/* ── Issue list ── */}
          {chFindings.length > 0 && (
            <div className="space-y-2">
              {chFindings.map((f, i) => {
                const cat = SCAN_CATEGORIES[f.category];
                return (
                  <div key={i} className={cn("flex items-start gap-2 text-xs p-2 rounded-lg",
                    f.category === "instruction_leak" ? "bg-red-500/10" : "bg-slate-800/50"
                  )}>
                    <span className="shrink-0 mt-0.5">{cat?.icon || "•"}</span>
                    <div className="flex-1">
                      <span className={cn("font-medium", f.category === "instruction_leak" ? "text-red-400" : f.category === "tense_drift" ? "text-amber-400" : "text-slate-300")}>{cat?.label}:</span>{" "}
                      <span className="text-slate-400">{f.label} ({f.count}×)</span>
                      {f.samples && <div className="mt-1 space-y-1">{f.samples.map((s, j) => <div key={j} className="pl-3 border-l-2 border-slate-700 text-slate-500 italic truncate max-w-full">"{s}"</div>)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {chFindings.length === 0 && (
            <p className="text-xs text-emerald-400/70 py-2">No issues detected in this chapter.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ═══ MAIN COMPONENT ═══

export default function ReviewPolishTab({ projectId }) {
  const [scanResults, setScanResults] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [polishing, setPolishing] = useState({});
  const [polishAll, setPolishAll] = useState(false);
  const [polishResults, setPolishResults] = useState({});
  const [fixing, setFixing] = useState({});
  const [fixResults, setFixResults] = useState({});
  const [uploadedText, setUploadedText] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState(null);

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", projectId],
    queryFn: () => base44.entities.Chapter.filter({ project_id: projectId }),
    enabled: !!projectId,
  });
  const { data: specs = [] } = useQuery({
    queryKey: ["specifications", projectId],
    queryFn: () => base44.entities.Specification.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const spec = specs[0];
  const tense = spec?.tense || "";
  const targetWords = { short: 2500, medium: 2500, long: 2800, epic: 3000 }[spec?.target_length || "medium"] || 2500;
  const generatedChapters = chapters.filter(c => c.status === "generated").sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

  const handleScan = useCallback(async () => {
    if (generatedChapters.length === 0) return;
    setScanning(true);
    setScanResults(null);
    try {
      const chapterData = [];
      const allFindings = [];
      for (const ch of generatedChapters) {
        let content = ch.content || "";
        if (content.startsWith("http")) { try { content = await (await fetch(content)).text(); } catch { content = ""; } }
        if (!content || content.length < 50) continue;
        const title = `Chapter ${ch.chapter_number}: ${ch.title || ""}`;
        const { findings, words } = scanChapter(content, ch.chapter_number, tense);
        allFindings.push(...findings);
        chapterData.push({ number: ch.chapter_number, title, text: content, words, chapterId: ch.id });
      }
      const fullText = chapterData.map(c => c.text).join("\n\n");
      for (const [rx, label, manuscriptCap] of PATTERNS.interiority_repetition) {
        const m = fullText.match(rx);
        const manuscriptMax = manuscriptCap * Math.max(1, Math.floor(chapterData.length / 5));
        if (m && m.length > manuscriptMax) {
          allFindings.push({ category: "interiority_repetition", label: `MANUSCRIPT-WIDE: "${label}" x${m.length} (max ~${manuscriptMax})`, count: m.length - manuscriptMax, chapter: 0 });
        }
      }
      const sensoryOpeners = allFindings.filter(f => f.category === "sensory_opener").length;
      const openerRatio = chapterData.length > 0 ? sensoryOpeners / chapterData.length : 0;
      const score = computeScore(allFindings, chapterData.length);
      setScanResults({
        score, allFindings, chapterData,
        totalWords: chapterData.reduce((sum, c) => sum + c.words, 0),
        totalChapters: chapterData.length, openerRatio,
        scannedAt: new Date().toISOString(),
      });
    } finally { setScanning(false); }
  }, [generatedChapters, tense]);

  const handlePolishChapter = async (chapterNum) => {
    const ch = generatedChapters.find(c => c.chapter_number === chapterNum);
    if (!ch) return;
    setPolishing(prev => ({ ...prev, [chapterNum]: true }));
    try {
      const result = await base44.functions.invoke("bot_prosePolisher", { project_id: projectId, chapter_id: ch.id }, { timeout: 120000 });
      const data = result?.data || result;
      setPolishResults(prev => ({ ...prev, [chapterNum]: data }));
      if (data?.changed) setTimeout(() => handleScan(), 1000);
    } catch (err) {
      setPolishResults(prev => ({ ...prev, [chapterNum]: { error: err.message } }));
    } finally { setPolishing(prev => ({ ...prev, [chapterNum]: false })); }
  };

  const handlePolishAll = async () => {
    if (!scanResults) return;
    setPolishAll(true);
    const chaptersWithIssues = scanResults.chapterData.filter(ch => scanResults.allFindings.some(f => f.chapter === ch.number));
    for (const ch of chaptersWithIssues) {
      await handlePolishChapter(ch.number);
      await new Promise(r => setTimeout(r, 2000));
    }
    setPolishAll(false);
  };

  // Fix — runs the style enforcer to fix detected violations
  const handleFixChapter = async (chapterNum) => {
    const ch = generatedChapters.find(c => c.chapter_number === chapterNum);
    if (!ch) return;
    setFixing(prev => ({ ...prev, [chapterNum]: true }));
    try {
      const result = await base44.functions.invoke("bot_styleEnforcer", {
        project_id: projectId,
        chapter_id: ch.id,
      }, { timeout: 180000 });
      const data = result?.data || result;
      setFixResults(prev => ({ ...prev, [chapterNum]: { success: true, fixed: data?.violations_fixed || 0, total: data?.violations_found || 0 } }));
      // Re-scan after fix
      setTimeout(() => handleScan(), 1500);
    } catch (err) {
      setFixResults(prev => ({ ...prev, [chapterNum]: { error: err.message } }));
    } finally {
      setFixing(prev => ({ ...prev, [chapterNum]: false }));
    }
  };

  // Regenerate — re-runs the full write pipeline for chapters with instruction leaks
  const handleRegenerateChapter = async (chapterNum) => {
    const ch = generatedChapters.find(c => c.chapter_number === chapterNum);
    if (!ch) return;
    if (!window.confirm(`Regenerate Chapter ${chapterNum}? This will re-run the full write pipeline and replace the current content.`)) return;
    setFixing(prev => ({ ...prev, [chapterNum]: true }));
    try {
      // Reset chapter status so the orchestrator picks it up
      await base44.entities.Chapter.update(ch.id, { status: "pending" });
      // Fire the orchestrator
      await base44.functions.invoke("bot_orchestrator", {
        action: "write_chapter",
        project_id: projectId,
        chapter_id: ch.id,
      }, { timeout: 600000 });
      setFixResults(prev => ({ ...prev, [chapterNum]: { success: true, regenerated: true } }));
      setTimeout(() => handleScan(), 2000);
    } catch (err) {
      setFixResults(prev => ({ ...prev, [chapterNum]: { error: err.message } }));
    } finally {
      setFixing(prev => ({ ...prev, [chapterNum]: false }));
    }
  };

  // Fix All — runs style enforcer on all chapters with issues (not leaks)
  const handleFixAll = async () => {
    if (!scanResults) return;
    setPolishAll(true);
    const chaptersWithIssues = scanResults.chapterData.filter(ch =>
      scanResults.allFindings.some(f => f.chapter === ch.number && f.category !== "instruction_leak")
    );
    for (const ch of chaptersWithIssues) {
      await handleFixChapter(ch.number);
      await new Promise(r => setTimeout(r, 3000)); // Rate limit spacing
    }
    setPolishAll(false);
  };

  const leakCount = scanResults ? scanResults.allFindings.filter(f => f.category === "instruction_leak").reduce((s, f) => s + f.count, 0) : 0;

  // ── EXPORT SCAN RESULTS ──
  const handleExportScanResults = () => {
    if (!scanResults) return;
    const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const lines = [];
    lines.push(`═══ MANUSCRIPT SCAN REPORT ═══`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push(`Project: ${projectId}`);
    lines.push(`Chapters scanned: ${scanResults.chapterData.length}`);
    lines.push(`Total issues: ${scanResults.allFindings.reduce((s, f) => s + f.count, 0)}`);
    lines.push(`Instruction leaks: ${leakCount}`);
    lines.push(`\n═══ SCORE BREAKDOWN ═══`);

    // Category summary
    const catCounts = {};
    for (const f of scanResults.allFindings) {
      const key = f.category || 'unknown';
      if (!catCounts[key]) catCounts[key] = { count: 0, instances: 0 };
      catCounts[key].count++;
      catCounts[key].instances += f.count;
    }
    for (const [cat, data] of Object.entries(catCounts).sort((a, b) => b[1].instances - a[1].instances)) {
      const catInfo = SCAN_CATEGORIES[cat];
      lines.push(`  ${catInfo?.icon || '•'} ${catInfo?.label || cat}: ${data.count} findings, ${data.instances} total instances`);
    }

    // Per-chapter details
    lines.push(`\n═══ PER-CHAPTER DETAILS ═══`);
    for (const ch of scanResults.chapterData) {
      const chFindings = scanResults.allFindings.filter(f => f.chapter === ch.number);
      const totalInstances = chFindings.reduce((s, f) => s + f.count, 0);
      lines.push(`\n── Ch ${ch.number}: ${ch.title} ──`);
      lines.push(`   Words: ${ch.words.toLocaleString()}`);
      if (chFindings.length === 0) {
        lines.push(`   ✓ Clean — no issues detected`);
      } else {
        lines.push(`   Issues: ${totalInstances}`);
        for (const f of chFindings) {
          const catInfo = SCAN_CATEGORIES[f.category];
          lines.push(`   ${catInfo?.icon || '•'} [${catInfo?.label || f.category}] ${f.label} (${f.count}×)`);
          if (f.samples) {
            for (const s of f.samples) {
              lines.push(`      → "${s.slice(0, 120)}${s.length > 120 ? '...' : ''}"`);
            }
          }
        }
      }
    }

    lines.push(`\n═══ END REPORT ═══`);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scan-report-${now}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Manuscript Scanner & Polisher</h2>
          <p className="text-sm text-slate-400 mt-0.5">{generatedChapters.length} chapter{generatedChapters.length !== 1 ? "s" : ""} ready for review</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleScan} disabled={scanning || generatedChapters.length === 0} className="bg-violet-600 hover:bg-violet-700 gap-2">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
            {scanning ? "Scanning..." : scanResults ? "Re-Scan" : "Scan Manuscript"}
          </Button>
          {scanResults && scanResults.allFindings.length > 0 && (
            <>
              <Button onClick={handleFixAll} disabled={polishAll || scanning} className="bg-amber-600 hover:bg-amber-700 gap-2">
                {polishAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {polishAll ? "Fixing..." : "Fix All Issues"}
              </Button>
              <Button onClick={handlePolishAll} disabled={polishAll || scanning} variant="outline" className="gap-2 border-violet-500/40 text-violet-300 hover:bg-violet-500/10">
                <Wand2 className="w-4 h-4" />
                Polish All
              </Button>
            </>
          )}
          {scanResults && (
            <Button onClick={handleExportScanResults} variant="outline" className="gap-2 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10">
              <Download className="w-4 h-4" />
              Export Report
            </Button>
          )}
        </div>
      </div>

      {/* Upload section */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium text-slate-300">External Manuscript</p>
            <p className="text-xs text-slate-500 mt-0.5">Upload a .txt, .md, .docx, or .pdf file to review alongside or instead of project chapters</p>
          </div>
          <ManuscriptUploader onTextLoaded={(text, name) => { setUploadedText(text); setUploadedFileName(name); }} />
        </div>
        {uploadedText && (
          <div className="rounded-lg border border-slate-600 bg-slate-900/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3 h-3" />
                {uploadedFileName || "Uploaded manuscript"} · {uploadedText.trim().split(/\s+/).length.toLocaleString()} words
              </span>
              <button onClick={() => { setUploadedText(""); setUploadedFileName(null); }} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
            </div>
            <div className="max-h-32 overflow-y-auto text-xs text-slate-500 font-mono whitespace-pre-wrap leading-relaxed">
              {uploadedText.slice(0, 2000)}{uploadedText.length > 2000 ? "…" : ""}
            </div>
          </div>
        )}
      </div>

      {generatedChapters.length === 0 && !scanning && !uploadedText && (
        <div className="flex items-center justify-center py-20 text-center">
          <div>
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No generated chapters yet</p>
            <p className="text-sm text-slate-500 mt-1">Generate chapters in the Write tab first, or upload a manuscript above</p>
          </div>
        </div>
      )}

      {scanning && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-16 h-16 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
          <p className="text-slate-300 font-medium">Scanning {generatedChapters.length} chapters...</p>
          <p className="text-xs text-slate-500">Checking instruction leaks, tense drift, interiority repetition, openers, clichés...</p>
        </div>
      )}

      {scanResults && !scanning && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-6 flex flex-col items-center justify-center">
              <RTScoreGauge score={scanResults.score} />
              <div className="mt-3 text-center">
                <p className="text-xs text-slate-500">{scanResults.totalWords.toLocaleString()} words · {scanResults.totalChapters} chapters</p>
                <p className="text-xs text-slate-500 mt-0.5">Scanned {new Date(scanResults.scannedAt).toLocaleTimeString()}</p>
              </div>
            </div>
            <div className="lg:col-span-2 rounded-xl border border-slate-700 bg-slate-800/60 p-5">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">Scanner Results</h3>
              <div className="space-y-1.5">
                {Object.keys(SCAN_CATEGORIES).map(key => (
                  <CategoryRow key={key} category={key} findings={scanResults.allFindings.filter(f => f.category === key)} />
                ))}
              </div>
              {leakCount > 0 && (
                <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-xs text-red-400 font-medium">🚨 {leakCount} instruction leak{leakCount !== 1 ? "s" : ""} detected — bot directives printed as prose. Regenerate affected chapters or manually edit.</p>
                </div>
              )}
              {scanResults.openerRatio > 0.5 && (
                <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-xs text-amber-400 font-medium">👁 {Math.round(scanResults.openerRatio * 100)}% of chapters open with sensory atmosphere. Vary with dialogue, action, or thought openers.</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Chapter Breakdown</h3>
            <div className="space-y-2">
              {scanResults.chapterData.map(ch => (
                <ChapterCard key={ch.number} chapter={ch} findings={scanResults.allFindings} words={ch.words} targetWords={targetWords} onPolish={handlePolishChapter} onFix={handleFixChapter} onRegenerate={handleRegenerateChapter} polishing={!!polishing[ch.number]} fixing={!!fixing[ch.number]} />
              ))}
            </div>
          </div>

          {Object.keys(polishResults).length > 0 && (
            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
              <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Polish Results</h3>
              <div className="space-y-2">
                {Object.entries(polishResults).map(([chNum, result]) => (
                  <div key={chNum} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/80">
                    <span className="text-sm text-slate-300">Chapter {chNum}</span>
                    {result.error ? (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Error: {result.error}</Badge>
                    ) : result.changed ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">✓ {result.violations_found} issues, {result.total_instances} instances fixed</Badge>
                    ) : (
                      <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-xs">No changes needed</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(fixResults).length > 0 && (
            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
              <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2"><Zap className="w-4 h-4" /> Fix Results</h3>
              <div className="space-y-2">
                {Object.entries(fixResults).map(([chNum, result]) => (
                  <div key={chNum} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/80">
                    <span className="text-sm text-slate-300">Chapter {chNum}</span>
                    {result.error ? (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Error: {result.error}</Badge>
                    ) : result.regenerated ? (
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">✓ Chapter regenerated</Badge>
                    ) : result.success ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">✓ {result.fixed}/{result.total} violations fixed</Badge>
                    ) : (
                      <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-xs">No changes</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Deep Continuity Review — always visible when chapters exist */}
      {generatedChapters.length > 0 && (
        <DeepReviewPanel projectId={projectId} chapters={chapters} specs={specs} />
      )}
    </div>
  );
}