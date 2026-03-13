// PIPELINE PHASE ISOLATION — Phase 4 (Review + Polish)
//
// Permitted AI calls: InvokeLLM (manuscript analysis, issue fixing, passage rewriting),
//   consistencyCheck, rewriteInVoice, characterInterview
//
// Forbidden: developIdea, expandPremise (Phase 1), generateOutline (Phase 2),
//            writeChapter, enforceProseCompliance, verifyGeminiProse (Phase 3).
//
// This file reads completed chapter content for review but must NOT
// trigger generation or outline functions.

import React, { useState, useRef, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Upload, BookOpen, Loader2, RefreshCw, Download, Sparkles,
  Check, X, ChevronDown, AlertCircle, AlertTriangle, Info,
  Wand2, FileText
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-500";
  return "text-red-500";
}

function scoreBarColor(score) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-400";
  return "bg-red-400";
}

function severityConfig(severity) {
  if (severity === "high") return { label: "High", className: "bg-red-100 text-red-700 border-red-200" };
  if (severity === "medium") return { label: "Medium", className: "bg-amber-100 text-amber-700 border-amber-200" };
  return { label: "Low", className: "bg-blue-100 text-blue-700 border-blue-200" };
}

const REWRITE_STYLES = [
  { id: "descriptive", label: "More Descriptive", desc: "Adds richer sensory details, vivid imagery, and atmosphere" },
  { id: "concise", label: "More Concise", desc: "Tightens the prose, removes filler, sharpens impact" },
  { id: "emotional", label: "More Emotional", desc: "Deepens internal monologue, heightens feeling and vulnerability" },
  { id: "dramatic", label: "More Dramatic", desc: "Raises stakes, adds tension, intensifies conflict" },
  { id: "conversational", label: "More Conversational", desc: "Makes prose feel natural, warm, accessible" },
  { id: "literary", label: "More Literary", desc: "Elevates language, adds poetic rhythm and metaphor" },
  { id: "action", label: "More Action-Packed", desc: "Punchy short sentences, rapid pacing, kinetic energy" },
  { id: "darker", label: "Darker Tone", desc: "Adds edge, menace, psychological weight" },
  { id: "lighter", label: "Lighter Tone", desc: "Softens mood, adds warmth or humor" },
  { id: "grammar", label: "Fix Grammar & Flow", desc: "Corrects grammar, smooths awkward phrasing, improves readability" },
  { id: "custom", label: "Custom Instructions", desc: "Type your own rewrite instructions" },
];

function countWords(text) {
  return text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

// ── Overall Score Gauge ───────────────────────────────────────────────────────

function ScoreGauge({ score }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <circle
          cx="70" cy="70" r={radius}
          fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
        <text x="70" y="66" textAnchor="middle" fontSize="28" fontWeight="bold" fill={color}>{score}</text>
        <text x="70" y="84" textAnchor="middle" fontSize="11" fill="#94a3b8">/100</text>
      </svg>
      <p className={cn("text-base font-semibold", scoreColor(score))}>
        {score >= 80 ? "Strong Manuscript" : score >= 60 ? "Needs Polish" : "Requires Revision"}
      </p>
    </div>
  );
}

// ── Category Score Bar ────────────────────────────────────────────────────────

function CategoryBar({ label, score, notes }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700 capitalize">{label.replace(/_/g, " ")}</span>
        <span className={cn("font-bold text-sm", scoreColor(score))}>{score}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", scoreBarColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      {notes && <p className="text-xs text-slate-400 leading-relaxed">{notes}</p>}
    </div>
  );
}

// ── Issue Card ────────────────────────────────────────────────────────────────

function IssueCard({ issue, onFix, fixing, fixed, selected, onToggleSelect }) {
  const sc = severityConfig(issue.severity);
  return (
    <div className={cn("border rounded-xl p-4 space-y-2 transition-all", fixed ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200")}>
      <div className="flex items-start gap-2">
        {/* Selection checkbox — only for auto-fixable, unfixed issues */}
        {issue.auto_fixable && !fixed && (
          <label className="flex items-center mt-0.5 flex-shrink-0 cursor-pointer" onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={!!selected}
              onChange={() => onToggleSelect(issue.id)}
              className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
            />
          </label>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge className={cn("text-xs border", sc.className)}>{sc.label}</Badge>
              <Badge variant="outline" className="text-xs capitalize">{issue.category?.replace(/_/g, " ")}</Badge>
              {issue.chapter && <Badge variant="outline" className="text-xs">Ch. {issue.chapter}</Badge>}
            </div>
            {fixed ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium flex-shrink-0">
                <Check className="w-3.5 h-3.5" /> Fixed
              </span>
            ) : issue.auto_fixable ? (
              <Button
                size="sm"
                className="h-7 text-xs px-3 bg-violet-600 hover:bg-violet-700 flex-shrink-0"
                onClick={() => onFix(issue)}
                disabled={fixing}
              >
                {fixing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3 mr-1" />}
                {fixing ? "Fixing…" : "Fix"}
              </Button>
            ) : null}
          </div>
          <p className="text-sm font-medium text-slate-800 mt-1">{issue.description}</p>
          {issue.location && <p className="text-xs text-slate-400">{issue.location}</p>}
          {issue.suggestion && <p className="text-xs text-slate-500 italic leading-relaxed">💡 {issue.suggestion}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Fix Comparison Panel ──────────────────────────────────────────────────────

function FixComparison({ issue, fixedText, onApply, onReject }) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <span className="text-sm font-semibold text-slate-700">Review Fix — {issue.description}</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onReject}><X className="w-4 h-4" /></Button>
      </div>
      <div className="grid grid-cols-2 divide-x divide-slate-200">
        <div className="p-4">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">Original</p>
          <p className="text-sm text-slate-700 leading-relaxed bg-red-50 rounded-lg p-3 whitespace-pre-wrap">{issue.original_text || "(no original text provided)"}</p>
        </div>
        <div className="p-4">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">Fixed</p>
          <p className="text-sm text-slate-700 leading-relaxed bg-emerald-50 rounded-lg p-3 whitespace-pre-wrap">{fixedText}</p>
        </div>
      </div>
      <div className="flex gap-2 px-4 py-3 bg-slate-50 border-t border-slate-200">
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs" onClick={onApply}>
          <Check className="w-3 h-3 mr-1" /> Apply Fix
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onReject}>Reject</Button>
      </div>
    </div>
  );
}

// ── Rewrite Style Picker ──────────────────────────────────────────────────────

function RewriteStylePicker({ onSelect, onClose }) {
  const [customText, setCustomText] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-72 max-h-80 overflow-y-auto z-50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Choose Rewrite Style</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
      </div>
      {REWRITE_STYLES.map(style => (
        <button
          key={style.id}
          className="w-full text-left px-3 py-2.5 hover:bg-violet-50 transition-colors border-b border-slate-50 last:border-0"
          onClick={() => {
            if (style.id === "custom") { setShowCustom(true); return; }
            onSelect(style);
          }}
        >
          <p className="text-sm font-medium text-slate-800">{style.label}</p>
          <p className="text-xs text-slate-400 mt-0.5">{style.desc}</p>
        </button>
      ))}
      {showCustom && (
        <div className="p-3 border-t border-slate-100">
          <textarea
            className="w-full text-sm border border-slate-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300"
            rows={3}
            placeholder="e.g. Make the dialogue sound more Southern..."
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <Button size="sm" className="h-7 text-xs bg-violet-600 hover:bg-violet-700 flex-1"
              disabled={!customText.trim()}
              onClick={() => onSelect({ id: "custom", label: "Custom", desc: customText.trim() })}>
              Rewrite
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowCustom(false)}>Back</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Selection Toolbar ─────────────────────────────────────────────────────────

function SelectionToolbar({ position, onRewrite, onClose }) {
  if (!position) return null;
  return (
    <div
      className="fixed z-50 bg-white border border-slate-200 rounded-xl shadow-xl px-3 py-2 flex items-center gap-2"
      style={{ top: position.y, left: position.x, transform: "translateX(-50%)" }}
    >
      <Button size="sm" className="h-7 text-xs bg-violet-600 hover:bg-violet-700 gap-1.5" onClick={onRewrite}>
        <Wand2 className="w-3 h-3" /> Rewrite
      </Button>
    </div>
  );
}

// ── Rewrite Comparison Panel ──────────────────────────────────────────────────

function RewriteComparison({ original, rewrites, activeTab, onTabChange, onAccept, onTryAnother, onCancel }) {
  const current = rewrites[activeTab];
  const origWords = countWords(original);
  const newWords = current ? countWords(current.text) : 0;
  const diff = newWords - origWords;
  return (
    <div className="border border-violet-200 rounded-xl overflow-hidden bg-white shadow-lg">
      {rewrites.length > 1 && (
        <div className="flex gap-1 px-3 py-2 bg-violet-50 border-b border-violet-100 overflow-x-auto">
          {rewrites.map((r, i) => (
            <button key={i}
              className={cn("text-xs px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors",
                i === activeTab ? "bg-violet-600 text-white" : "text-violet-600 hover:bg-violet-100")}
              onClick={() => onTabChange(i)}>
              {r.style}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 divide-x divide-slate-200">
        <div className="p-4">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">Original</p>
          <p className="text-sm text-slate-700 leading-relaxed bg-red-50 rounded-lg p-3 whitespace-pre-wrap max-h-48 overflow-y-auto">{original}</p>
        </div>
        <div className="p-4">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">{current?.style || "Rewritten"}</p>
          <p className="text-sm text-slate-700 leading-relaxed bg-emerald-50 rounded-lg p-3 whitespace-pre-wrap max-h-48 overflow-y-auto">{current?.text || ""}</p>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
        <span className="text-xs text-slate-400">
          {origWords} words → {newWords} words {diff !== 0 && <span className={diff > 0 ? "text-emerald-600" : "text-red-400"}>({diff > 0 ? "+" : ""}{diff})</span>}
        </span>
        <div className="flex gap-2">
          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => onAccept(current?.text)}>
            <Check className="w-3 h-3 mr-1" /> Accept
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs border-violet-300 text-violet-600" onClick={onTryAnother}>
            Try Another Style
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ReviewPolishTab({ projectId }) {
  const [manuscript, setManuscript] = useState("");
  const [manuscriptModified, setManuscriptModified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [analyzed, setAnalyzed] = useState(false);
  const [fixStates, setFixStates] = useState({}); // id -> "fixing" | "comparing" | "fixed"
  const [fixTexts, setFixTexts] = useState({}); // id -> fixed text
  const [fixAllProgress, setFixAllProgress] = useState(null);
  const [selectedIssues, setSelectedIssues] = useState({}); // id -> boolean
  const [saveFormat, setSaveFormat] = useState("txt");
  const [lastAnalyzedManuscript, setLastAnalyzedManuscript] = useState("");

  // Selection / rewrite state
  const [selection, setSelection] = useState(null); // { start, end, text, position }
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [rewrites, setRewrites] = useState([]); // [{style, text}]
  const [activeRewriteTab, setActiveRewriteTab] = useState(0);
  const [showRewriteComparison, setShowRewriteComparison] = useState(false);
  const [flashRange, setFlashRange] = useState(null);

  const previewRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load spec for context
  const { data: specs = [] } = useQuery({
    queryKey: ["specification", projectId],
    queryFn: () => base44.entities.Specification.filter({ project_id: projectId }),
  });
  const spec = specs[0] || null;

  // Load chapters
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", projectId],
    queryFn: () => base44.entities.Chapter.filter({ project_id: projectId }, "chapter_number"),
  });

  const generatedChapters = chapters.filter(c => c.status === "generated");
  const wordCount = countWords(manuscript);
  const chapterCount = generatedChapters.length;
  const manuscriptChanged = analyzed && manuscript !== lastAnalyzedManuscript;

  // ── Load current project ───────────────────────────────────────────────────
  const handleLoadProject = async () => {
    setLoading(true);
    setLoadingMsg("Loading chapters...");
    try {
      const parts = [];
      for (const ch of generatedChapters) {
        let content = ch.content || "";
        if (content.startsWith("http://") || content.startsWith("https://")) {
          try { content = await (await fetch(content)).text(); } catch { content = ""; }
        }
        if (content) parts.push(`Chapter ${ch.chapter_number}: ${ch.title}\n\n${content}`);
      }
      const joined = parts.join("\n\n---\n\n");
      setManuscript(joined);
      setManuscriptModified(false);
      setAnalysis(null);
      setAnalyzed(false);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  // ── File upload ────────────────────────────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setManuscript(ev.target.result || "");
      setManuscriptModified(false);
      setAnalysis(null);
      setAnalyzed(false);
    };
    reader.readAsText(file);
  };

  // ── Analyze ────────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!manuscript) return;
    setLoading(true);
    setLoadingMsg("Analyzing your manuscript...");
    setAnalysis(null);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert manuscript editor. Analyze this manuscript and return a comprehensive quality analysis as JSON.

MANUSCRIPT:
${manuscript.slice(0, 40000)}

Return JSON with this exact structure:
{
  "overall_score": <integer 0-100>,
  "scores": {
    "prose_quality": { "score": <int>, "max": 100, "notes": "<string>" },
    "continuity": { "score": <int>, "max": 100, "notes": "<string>" },
    "pacing": { "score": <int>, "max": 100, "notes": "<string>" },
    "character_consistency": { "score": <int>, "max": 100, "notes": "<string>" },
    "dialogue_quality": { "score": <int>, "max": 100, "notes": "<string>" },
    "repetition": { "score": <int>, "max": 100, "notes": "<string>" },
    "structure": { "score": <int>, "max": 100, "notes": "<string>" }
  },
  "issues": [
    {
      "id": <int>,
      "severity": "high"|"medium"|"low",
      "category": "<string>",
      "chapter": <int or null>,
      "description": "<string>",
      "location": "<string>",
      "original_text": "<short excerpt or null>",
      "suggestion": "<string>",
      "auto_fixable": <boolean>
    }
  ]
}

Provide 8-20 specific, actionable issues. Sort by severity (high first). Be precise and helpful.`,
        response_json_schema: {
          type: "object",
          properties: {
            overall_score: { type: "number" },
            scores: { type: "object" },
            issues: { type: "array", items: { type: "object" } }
          }
        }
      });
      setAnalysis(result);
      setAnalyzed(true);
      setLastAnalyzedManuscript(manuscript);
      setFixStates({});
      setFixTexts({});
      setSelectedIssues({});
    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  // ── Fix single issue ───────────────────────────────────────────────────────
  const handleFix = async (issue) => {
    setFixStates(s => ({ ...s, [issue.id]: "fixing" }));
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert manuscript editor. Apply this fix to the passage.

ISSUE: ${issue.description}
ORIGINAL TEXT: ${issue.original_text || "(no excerpt provided — apply fix conceptually)"}
SUGGESTION: ${issue.suggestion}

Return ONLY the corrected text. No preamble, no explanation.`,
      });
      setFixTexts(t => ({ ...t, [issue.id]: result }));
      setFixStates(s => ({ ...s, [issue.id]: "comparing" }));
    } catch {
      setFixStates(s => ({ ...s, [issue.id]: null }));
    }
  };

  const handleApplyFix = (issue) => {
    const fixedText = fixTexts[issue.id];
    if (fixedText && issue.original_text) {
      setManuscript(m => m.replace(issue.original_text, fixedText));
    }
    setFixStates(s => ({ ...s, [issue.id]: "fixed" }));
  };

  const handleRejectFix = (issueId) => {
    setFixStates(s => ({ ...s, [issueId]: null }));
  };

  // ── Fix selected issues ─────────────────────────────────────────────────────
  const handleFixSelected = async () => {
    const selectedIds = Object.keys(selectedIssues).filter(id => selectedIssues[id]);
    const fixable = (analysis?.issues || []).filter(i => selectedIds.includes(String(i.id)) && i.auto_fixable && fixStates[i.id] !== "fixed");
    if (!fixable.length) return;
    setFixAllProgress({ current: 0, total: fixable.length });
    for (let i = 0; i < fixable.length; i++) {
      const issue = fixable[i];
      setFixAllProgress({ current: i + 1, total: fixable.length });
      setFixStates(s => ({ ...s, [issue.id]: "fixing" }));
      try {
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `Apply this editorial fix. Return only the corrected text.\n\nISSUE: ${issue.description}\nORIGINAL: ${issue.original_text || ""}\nSUGGESTION: ${issue.suggestion}`,
        });
        if (issue.original_text) setManuscript(m => m.replace(issue.original_text, result));
        setFixStates(s => ({ ...s, [issue.id]: "fixed" }));
        setSelectedIssues(s => ({ ...s, [issue.id]: false }));
      } catch {
        setFixStates(s => ({ ...s, [issue.id]: null }));
      }
    }
    setFixAllProgress(null);
  };

  const toggleIssueSelection = (id) => {
    setSelectedIssues(s => ({ ...s, [id]: !s[id] }));
  };

  const toggleSelectAll = () => {
    const fixable = (analysis?.issues || []).filter(i => i.auto_fixable && fixStates[i.id] !== "fixed");
    const allSelected = fixable.every(i => selectedIssues[i.id]);
    const newSelection = {};
    fixable.forEach(i => { newSelection[i.id] = !allSelected; });
    setSelectedIssues(s => ({ ...s, ...newSelection }));
  };

  // ── Text selection handling ────────────────────────────────────────────────
  const handleMouseUp = useCallback(() => {
    if (showRewriteComparison) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelection(null);
      setShowStylePicker(false);
      return;
    }
    const text = sel.toString();
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelection({
      text,
      start: manuscript.indexOf(text),
      end: manuscript.indexOf(text) + text.length,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top - 50 + window.scrollY,
      }
    });
    setShowStylePicker(false);
  }, [manuscript, showRewriteComparison]);

  // ── Rewrite ────────────────────────────────────────────────────────────────
  const handleRewriteStyle = async (style) => {
    if (!selection) return;
    setShowStylePicker(false);
    setRewriting(true);

    // Get surrounding context
    const before = manuscript.slice(Math.max(0, selection.start - 500), selection.start);
    const after = manuscript.slice(selection.end, Math.min(manuscript.length, selection.end + 500));

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a professional fiction ghostwriter. Rewrite ONLY the selected passage in the requested style. Keep the same characters, events, and plot points. Match the surrounding prose style. Return ONLY the rewritten text — no preamble, no explanation.

BOOK GENRE: ${spec?.genre || "fiction"}
BEAT STYLE: ${spec?.beat_style || spec?.tone_style || "not specified"}
AUTHOR VOICE: ${spec?.author_voice || "not specified"}

REWRITE STYLE: ${style.label} — ${style.desc}

CONTEXT BEFORE:
${before}

---SELECTED PASSAGE TO REWRITE---
${selection.text}
---END SELECTED PASSAGE---

CONTEXT AFTER:
${after}

Rewrite the selected passage now:`,
      });
      const newRewrites = [...rewrites, { style: style.label, text: result }];
      setRewrites(newRewrites);
      setActiveRewriteTab(newRewrites.length - 1);
      setShowRewriteComparison(true);
    } catch (err) {
      console.error("Rewrite failed:", err);
    } finally {
      setRewriting(false);
    }
  };

  const handleAcceptRewrite = (newText) => {
    if (!selection || !newText) return;
    const before = manuscript.slice(0, selection.start);
    const after = manuscript.slice(selection.end);
    const updated = before + newText + after;
    setManuscript(updated);
    setManuscriptModified(true);
    setShowRewriteComparison(false);
    setRewrites([]);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    setFlashRange({ start: selection.start, end: selection.start + newText.length });
    setTimeout(() => setFlashRange(null), 1200);
  };

  const handleCancelRewrite = () => {
    setShowRewriteComparison(false);
    setRewrites([]);
    setShowStylePicker(false);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleTryAnother = () => {
    setShowRewriteComparison(false);
    setShowStylePicker(true);
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = () => {
    const blob = new Blob([manuscript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manuscript_corrected.${saveFormat}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const sortedIssues = [...(analysis?.issues || [])].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  const autoFixableCount = sortedIssues.filter(i => i.auto_fixable && fixStates[i.id] !== "fixed").length;
  const fixedCount = Object.values(fixStates).filter(v => v === "fixed").length;
  const selectedCount = Object.keys(selectedIssues).filter(id => selectedIssues[id] && fixStates[id] !== "fixed").length;

  return (
    <div className="p-6 space-y-6" onClick={(e) => {
      if (!e.target.closest("[data-selection-toolbar]") && !e.target.closest("[data-style-picker]")) {
        if (!showRewriteComparison) {
          setSelection(null);
          setShowStylePicker(false);
        }
      }
    }}>
      {/* Load / Upload */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={handleLoadProject}
          disabled={loading || generatedChapters.length === 0}
          className="bg-indigo-600 hover:bg-indigo-700 gap-2"
        >
          <BookOpen className="w-4 h-4" />
          Load Current Project ({generatedChapters.length} chapters)
        </Button>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading} className="gap-2">
          <Upload className="w-4 h-4" /> Upload Manuscript
        </Button>
        <input ref={fileInputRef} type="file" accept=".txt,.md,.docx" className="hidden" onChange={handleFileUpload} />
        {manuscript && (
          <span className="text-sm text-slate-500 ml-1">
            {wordCount.toLocaleString()} words · {chapterCount} chapters
          </span>
        )}
      </div>

      {!manuscript && !loading && (
        <div className="flex items-center justify-center py-20 text-center">
          <div>
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Load your project or upload a manuscript to get started</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          <p className="text-slate-600 font-medium">{loadingMsg}</p>
        </div>
      )}

      {manuscript && !loading && (
        <>
          {/* Analyze button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleAnalyze}
              className="bg-violet-600 hover:bg-violet-700 gap-2 px-6"
              disabled={loading}
            >
              <Sparkles className="w-4 h-4" /> Analyze Manuscript
            </Button>
            {analyzed && (
              <Button
                variant="outline"
                onClick={handleAnalyze}
                className={cn("gap-2 relative", manuscriptChanged && "border-amber-400 text-amber-600")}
                disabled={loading}
              >
                <RefreshCw className="w-4 h-4" /> Re-Analyze
                {manuscriptChanged && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400" />
                )}
              </Button>
            )}
          </div>

          {/* Main two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT — Manuscript preview */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Manuscript Preview</p>
              <div className="relative">
                <div
                  ref={previewRef}
                  className="border border-slate-200 rounded-xl p-4 h-[600px] overflow-y-auto font-mono text-xs leading-relaxed text-slate-700 bg-slate-50 whitespace-pre-wrap select-text cursor-text"
                  onMouseUp={handleMouseUp}
                >
                  {manuscript}
                </div>

                {/* Floating rewrite toolbar */}
                {selection && !rewriting && !showRewriteComparison && (
                  <div
                    data-selection-toolbar
                    className="fixed z-50 bg-white border border-slate-200 rounded-xl shadow-xl px-3 py-2 flex items-center gap-2"
                    style={{
                      top: Math.max(10, selection.position.y),
                      left: Math.min(window.innerWidth - 160, Math.max(80, selection.position.x)),
                      transform: "translateX(-50%)"
                    }}
                  >
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-violet-600 hover:bg-violet-700 gap-1.5"
                      onClick={(e) => { e.stopPropagation(); setShowStylePicker(true); }}
                    >
                      <Wand2 className="w-3 h-3" /> Rewrite
                    </Button>
                  </div>
                )}

                {/* Rewriting spinner overlay */}
                {rewriting && (
                  <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                      <span className="text-sm font-medium text-violet-700">Rewriting…</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Style picker popover */}
              {showStylePicker && selection && (
                <div data-style-picker className="mt-2">
                  <RewriteStylePicker
                    onSelect={handleRewriteStyle}
                    onClose={() => { setShowStylePicker(false); setSelection(null); }}
                  />
                </div>
              )}

              {/* Rewrite comparison */}
              {showRewriteComparison && rewrites.length > 0 && (
                <div className="mt-2">
                  <RewriteComparison
                    original={selection?.text || ""}
                    rewrites={rewrites}
                    activeTab={activeRewriteTab}
                    onTabChange={setActiveRewriteTab}
                    onAccept={handleAcceptRewrite}
                    onTryAnother={handleTryAnother}
                    onCancel={handleCancelRewrite}
                  />
                </div>
              )}
            </div>

            {/* RIGHT — Analysis results */}
            <div className="space-y-4">
              {!analysis ? (
                <div className="flex items-center justify-center h-full py-16 text-center">
                  <div>
                    <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">Run analysis to see quality scores and issues</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Overall score */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 text-center">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Overall Score</p>
                    <ScoreGauge score={analysis.overall_score} />
                  </div>

                  {/* Category scores */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Category Scores</p>
                    {Object.entries(analysis.scores || {}).map(([key, val]) => (
                      <CategoryBar key={key} label={key} score={val.score} notes={val.notes} />
                    ))}
                  </div>

                  {/* Issues */}
                  {sortedIssues.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Issues ({sortedIssues.length}) · {fixedCount} fixed
                        </p>
                        {autoFixableCount > 0 && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={toggleSelectAll}
                              className="text-xs text-violet-600 hover:text-violet-800 font-medium underline underline-offset-2"
                            >
                              {sortedIssues.filter(i => i.auto_fixable && fixStates[i.id] !== "fixed").every(i => selectedIssues[i.id]) ? "Deselect All" : "Select All"}
                            </button>
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-violet-600 hover:bg-violet-700"
                              onClick={handleFixSelected}
                              disabled={!!fixAllProgress || selectedCount === 0}
                            >
                              {fixAllProgress
                                ? `Fixing ${fixAllProgress.current} of ${fixAllProgress.total}…`
                                : `Fix Selected (${selectedCount})`}
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                        {sortedIssues.map(issue => (
                          <div key={issue.id}>
                            <IssueCard
                              issue={issue}
                              onFix={handleFix}
                              fixing={fixStates[issue.id] === "fixing"}
                              fixed={fixStates[issue.id] === "fixed"}
                              selected={!!selectedIssues[issue.id]}
                              onToggleSelect={toggleIssueSelection}
                            />
                            {fixStates[issue.id] === "comparing" && fixTexts[issue.id] && (
                              <div className="mt-2">
                                <FixComparison
                                  issue={issue}
                                  fixedText={fixTexts[issue.id]}
                                  onApply={() => handleApplyFix(issue)}
                                  onReject={() => handleRejectFix(issue.id)}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Save footer */}
          {manuscript && (
            <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
              <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                <Download className="w-4 h-4" /> Save Corrected Manuscript
              </Button>
              <select
                value={saveFormat}
                onChange={e => setSaveFormat(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                <option value="txt">.txt</option>
                <option value="md">.md</option>
                <option value="docx">.docx</option>
              </select>
              {(manuscriptModified || fixedCount > 0) && (
                <span className="text-xs text-emerald-600 font-medium">
                  {fixedCount > 0 ? `${fixedCount} fix${fixedCount > 1 ? "es" : ""} applied` : "Modified"}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}