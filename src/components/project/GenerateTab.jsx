// PIPELINE PHASE ISOLATION — Phase 3 (Chapter Generation)
//
// Permitted AI calls: writeChapter, generateScenes, generateAllScenes,
//   writeAllChapters, generateChapterState, resumeFromChapter
// Prose quality gates (enforceProseCompliance, verifyGeminiProse, verifyGPTVolume,
//   verifyNonfictionVolume) run INSIDE writeChapter on the backend — not called from here directly.
//
// Forbidden: developIdea, expandPremise, generateOutline (Phase 1/2),
//            consistencyCheck, rewriteInVoice (Phase 4).
//
// This file may read Specification + Outline data for display but must NOT
// call Phase 1 metadata or Phase 4 review functions.

import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, Sparkles, ChevronDown, ChevronRight, Copy, RefreshCw,
  Pencil, BookOpen, Users, Globe, ArrowRight, Check, Zap, LayoutGrid, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import WriteAllChaptersModal from "./WriteAllChaptersModal";
import SpecSettingsSummary from "./SpecSettingsSummary";
import SceneSection from "./SceneSection";
import NonfictionBeatSection from "./NonfictionBeatSection";
import BeatBadge from "./BeatBadge";
import ChapterStatusDot from "./ChapterStatusDot";
import ConsistencyFlagsBanner from "./ConsistencyFlagsBanner";
import RewriteInVoiceModal from "./RewriteInVoiceModal";
import ProjectWordCount from "./ProjectWordCount";
import ExplicitTagsWarning from "./ExplicitTagsWarning";
import InteriorityGateBanner, { hasProtagonistInteriority, needsInteriorityGate } from "./InteriorityGateBanner";
import { detectActBoundaries, getActChapters, getActStatus } from "./ActDetection";
import ActHeader from "./ActHeader";
import ActSplitEditor from "./ActSplitEditor";
import { healthMonitor } from "../utils/appHealthMonitor";

// ── helpers ──────────────────────────────────────────────────────────────────

// DISPLAY RULE: Chapter numbers shown in UI must ALWAYS come from
// chapter.chapter_number — never from loop index, array position,
// or queue order. These diverge whenever chapters are skipped,
// retried, or written out of order.

// Status dots now handled by ChapterStatusDot component

const ROLE_COLORS = {
  protagonist: "bg-indigo-100 text-indigo-700",
  antagonist:  "bg-red-100 text-red-700",
  supporting:  "bg-amber-100 text-amber-700",
  minor:       "bg-slate-100 text-slate-600",
};

const THEME_COLORS = ["bg-violet-100 text-violet-700","bg-sky-100 text-sky-700","bg-emerald-100 text-emerald-700","bg-amber-100 text-amber-700","bg-pink-100 text-pink-700","bg-indigo-100 text-indigo-700"];

function safeParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

// ── Collapsible wrapper ───────────────────────────────────────────────────────

function CollapsibleCard({ title, icon: CardIcon, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  
  // Prevent scroll when expanding
  const handleToggle = () => {
    const scrollPos = window.scrollY;
    setOpen(o => !o);
    setTimeout(() => window.scrollTo(0, scrollPos), 0);
  };
  
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="py-3 px-4 cursor-pointer" onClick={handleToggle}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <CardIcon className="w-4 h-4 text-indigo-500" />
            {title}
          </CardTitle>
          {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </CardHeader>
      {open && <CardContent className="pt-0 px-4 pb-4">{children}</CardContent>}
    </Card>
  );
}

// ── Book Metadata card ────────────────────────────────────────────────────────

const KEYWORD_COLORS = [
  "bg-violet-100 text-violet-700", "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700",
  "bg-pink-100 text-pink-700", "bg-indigo-100 text-indigo-700",
  "bg-rose-100 text-rose-700",
];

function BookMetadataCard({ metadataRaw }) {
  const meta = safeParse(metadataRaw);
  if (!meta) return null;
  return (
    <CollapsibleCard title="Book Metadata — Publishing Details" icon={BookOpen} defaultOpen={false}>
      <div className="space-y-4">
        {meta.title && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Title</p>
            <p className="font-bold text-slate-900 leading-tight" style={{ fontSize: "18px" }}>{meta.title}</p>
          </div>
        )}
        {meta.subtitle && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Subtitle</p>
            <p className="text-sm text-slate-700 italic">{meta.subtitle}</p>
          </div>
        )}
        {meta.description && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Book Description</p>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{meta.description}</p>
          </div>
        )}
        {meta.keywords?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Keywords</p>
            <div className="flex flex-wrap gap-1.5">
              {meta.keywords.map((kw, i) => (
                <span key={i} className={cn("text-xs px-2.5 py-1 rounded-full font-medium", KEYWORD_COLORS[i % KEYWORD_COLORS.length])}>
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
}

// ── Outline display ───────────────────────────────────────────────────────────

function OutlineCard({ outlineData }) {
  const outline = safeParse(outlineData);
  if (!outline) return null;
  return (
    <CollapsibleCard title={`Book Outline — ${outline.title || "Untitled"}`} icon={BookOpen} defaultOpen={false}>
      <div className="space-y-4">
        {outline.narrative_arc && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Narrative Arc</p>
            <p className="text-sm text-slate-700 leading-relaxed">{outline.narrative_arc}</p>
          </div>
        )}
        {outline.themes && outline.themes.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Themes</p>
            <div className="flex gap-2 flex-wrap">
              {outline.themes.map((t, i) => (
                <span key={i} className={cn("text-xs px-2.5 py-1 rounded-full font-medium", THEME_COLORS[i % THEME_COLORS.length])}>{t}</span>
              ))}
            </div>
          </div>
        )}
        {outline.chapters && outline.chapters.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Chapter Overview</p>
            <div className="space-y-2">
              {outline.chapters.map((ch, i) => (
                <div key={i} className="text-sm p-2 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-800">Ch {ch.number}: {ch.title}</p>
                    {ch.beat_function && <BeatBadge beatFunction={ch.beat_function} beatName={ch.beat_name} />}
                  </div>
                  {ch.summary && <p className="text-xs text-slate-600 mt-1 opacity-80">{ch.summary}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        {!outline.narrative_arc && (!outline.themes || outline.themes.length === 0) && (!outline.chapters || outline.chapters.length === 0) && (
          <p className="text-sm text-slate-500">Outline data is available but contains no displayable summary fields.</p>
        )}
      </div>
    </CollapsibleCard>
  );
}

// ── Story Bible display ───────────────────────────────────────────────────────

function toStr(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.map(toStr).join(', ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function StoryBibleCard({ storyBible }) {
  const bible = safeParse(storyBible);
  if (!bible) return null;

  const fields = [
    { key: 'world', label: 'World & Setting' },
    { key: 'setting', label: 'Setting' },
    { key: 'tone_voice', label: 'Tone & Voice' },
    { key: 'tone', label: 'Tone' },
    { key: 'style_guidelines', label: 'Style Guidelines' },
    { key: 'atmosphere', label: 'Atmosphere' },
    { key: 'geography', label: 'Geography' },
    { key: 'magic_system', label: 'Magic System' },
    { key: 'technology', label: 'Technology' },
    { key: 'society', label: 'Society' },
    { key: 'history', label: 'History' },
  ];

  return (
    <CollapsibleCard title="Story Bible" icon={Globe} defaultOpen={false}>
      <div className="space-y-4">
        {fields.map(({ key, label }) => {
          const val = bible[key];
          if (!val) return null;
          const text = toStr(val);
          if (!text) return null;
          return (
            <div key={key}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
              <p className="text-sm text-slate-700 leading-relaxed">{text}</p>
            </div>
          );
        })}

        {bible.characters?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Characters</p>
            <div className="space-y-2">
              {bible.characters.map((char, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-slate-800">{toStr(char.name)}</span>
                    {char.role && (
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", ROLE_COLORS[toStr(char.role).toLowerCase()] || ROLE_COLORS.minor)}>
                        {toStr(char.role)}
                      </span>
                    )}
                  </div>
                  {char.description && <p className="text-xs text-slate-600 mb-1">{toStr(char.description)}</p>}
                  {char.arc && <p className="text-xs text-slate-500 italic">{toStr(char.arc)}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {bible.rules && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Consistency Rules</p>
            {Array.isArray(bible.rules)
              ? <ul className="list-disc list-inside space-y-1">{bible.rules.map((r, i) => <li key={i} className="text-sm text-slate-700">{toStr(r)}</li>)}</ul>
              : <p className="text-sm text-slate-700">{toStr(bible.rules)}</p>
            }
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
}

// ── Chapter item ──────────────────────────────────────────────────────────────

function useResolvedContent(rawContent) {
  const isUrl = rawContent && (rawContent.startsWith('http://') || rawContent.startsWith('https://'));
  const { data: fetched } = useQuery({
    queryKey: ["chapter_content", rawContent],
    enabled: !!isUrl,
    queryFn: () => fetch(rawContent).then(r => r.text()),
    staleTime: Infinity,
  });
  return isUrl ? (fetched || "") : (rawContent || "");
}

function ChapterItem({ chapter, spec, onWrite, onRewrite, onResume, streamingContent, isStreaming, isWriting, chapterProgress, onScenesUpdated, beatData, isResuming, project }) {
  const [expanded, setExpanded] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptValue, setPromptValue] = useState(chapter.prompt || "");
  const [copied, setCopied] = useState(false);
  const [writeConfirm, setWriteConfirm] = useState(false);
  const [generatingScenesThenWrite, setGeneratingScenesThenWrite] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [showRewriteModal, setShowRewriteModal] = useState(false);
  const queryClient = useQueryClient();

  let hasFlags = false;
  try {
    if (chapter.consistency_flags) {
      const flags = JSON.parse(chapter.consistency_flags);
      hasFlags = flags.some(f => !f.dismissed);
    }
  } catch {}

  const isFiction = spec?.book_type !== 'nonfiction';
  function safeParseCh(str) {
    try { if (!str || str.trim() === 'null' || str.trim() === '[]' || str.trim() === '{}') return null; return JSON.parse(str); } catch { return null; }
  }
  const parsedScenes = safeParseCh(chapter.scenes);
  const hasScenes = isFiction && Array.isArray(parsedScenes) && parsedScenes.length > 0;
  const hasNfBeatSheet = !isFiction && parsedScenes && typeof parsedScenes === 'object' && parsedScenes.opening_hook;

  const resolvedContent = useResolvedContent(chapter.content);
  const content = isStreaming ? streamingContent : resolvedContent;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const savePrompt = async () => {
    await base44.entities.Chapter.update(chapter.id, { prompt: promptValue });
    queryClient.invalidateQueries({ queryKey: ["chapters", chapter.project_id] });
    setEditingPrompt(false);
  };

  const handleWriteClick = () => {
    if (isFiction && !hasScenes) {
      setWriteConfirm(true);
    } else {
      onWrite(chapter);
    }
  };

  const handleRewrite = async () => {
    setRewriting(true);
    try {
      await base44.entities.Chapter.update(chapter.id, {
        content: "",
        status: "pending",
        word_count: 0,
        quality_scan: "",
        distinctive_phrases: "",
        state_document: "",
        generated_at: "",
      });
      queryClient.invalidateQueries({ queryKey: ["chapters", chapter.project_id] });
      onRewrite(chapter);
    } catch (err) {
      console.error('Rewrite clear error:', err.message);
    } finally {
      setRewriting(false);
    }
  };

  const handleGenerateScenesThenWrite = async () => {
    setWriteConfirm(false);
    setGeneratingScenesThenWrite(true);
    try {
      await base44.functions.invoke('generateScenes', {
        projectId: chapter.project_id,
        chapterNumber: chapter.chapter_number,
      });
      let polls = 0;
      while (polls < 45) {
        await new Promise(r => setTimeout(r, 2000));
        polls++;
        const updated = await base44.entities.Chapter.filter({ project_id: chapter.project_id });
        const updCh = updated.find(c => c.id === chapter.id);
        if (updCh?.scenes && updCh.scenes.trim() !== 'null' && updCh.scenes.trim() !== '[]') {
          if (onScenesUpdated) onScenesUpdated();
          break;
        }
      }
    } catch (err) {
      console.error('generateScenesThenWrite error:', err.message);
    } finally {
      setGeneratingScenesThenWrite(false);
      onWrite(chapter);
    }
  };

  // Status label + color
  const statusConfig = {
    generated:  { label: "COMPLETE",  color: "text-green-700",  dot: "bg-green-500",  row: "bg-green-50" },
    generating: { label: "WRITING…",  color: "text-blue-600",   dot: "bg-blue-500",   row: "bg-blue-50" },
    error:      { label: "ERROR",     color: "text-red-600",    dot: "bg-red-500",    row: "bg-red-50" },
    pending:    { label: "PENDING",   color: "text-gray-400",   dot: "bg-gray-300",   row: "bg-gray-50" },
  };
  const effectiveStatus = isWriting ? "generating" : chapter.status;
  const st = statusConfig[effectiveStatus] || statusConfig.pending;

  const isComplete = chapter.status === "generated";
  const isPendingOrError = chapter.status === "error" || chapter.status === "pending";

  return (
    <div className={cn(
      "rounded-[10px] overflow-hidden bg-white mb-2.5",
      "border",
      chapter.status === "error" ? "border-red-200 bg-[#fff8f8]" :
      isWriting ? "border-blue-200" :
      isComplete ? "border-green-200 bg-[#f9fffe]" :
      "border-gray-200"
    )}>
      {/* ROW 1 — Status */}
      <div className={cn(
        "flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold tracking-[0.8px] uppercase border-b border-gray-100",
        st.row
      )}>
        <span className={cn("w-[7px] h-[7px] rounded-full shrink-0", st.dot, isWriting && "animate-pulse")} />
        <span className={st.color}>{st.label}</span>
        {hasFlags && (
          <span className="text-amber-500 ml-auto" title="Continuity flags detected">
            <AlertTriangle className="w-3 h-3" />
          </span>
        )}
        {chapterProgress && isWriting && (
          <span className="ml-auto text-[10px] font-medium text-blue-500 normal-case tracking-normal truncate max-w-[220px]">{chapterProgress}</span>
        )}
      </div>

      {/* ROW 2 — Chapter info (clickable to expand) */}
      <div
        className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <button className="text-gray-400 shrink-0" onClick={e => { e.stopPropagation(); setExpanded(e2 => !e2); }}>
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 text-[13px] font-semibold flex items-center justify-center shrink-0">
          {chapter.chapter_number}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-[14px] font-medium text-gray-900 block truncate mb-0.5">{chapter.title}</span>
          <div className="flex items-center gap-2 flex-wrap">
            {chapter.word_count > 0 && (
              <span className="text-xs text-gray-500">~{chapter.word_count.toLocaleString()} words</span>
            )}
            {(() => { try { const qs = chapter.quality_scan ? JSON.parse(chapter.quality_scan) : null; if (!qs) return null; return (<>
              {qs.genAttempts > 1 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200">{qs.genAttempts} attempts</span>}
              {qs.structural?.needsRetry && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 font-bold border border-red-200" title={`Retry reason: ${qs.structural.retryReason}`}>structure issue</span>}
              {qs.warnings?.length > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200 cursor-help" title={qs.warnings.join('\n')}>⚠ {qs.warnings.length} warning{qs.warnings.length > 1 ? 's' : ''}</span>}
            </>); } catch { return null; } })()}
            {content && (
              <button
                className="text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 flex items-center gap-1 px-1.5 py-0.5 rounded border border-gray-200 transition-colors"
                onClick={(e) => { e.stopPropagation(); handleCopy(); }}
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                {copied ? "copied" : "copy"}
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          {beatData?.beat_function && <BeatBadge beatFunction={beatData.beat_function} beatName={beatData.beat_name} />}
          {hasScenes && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-semibold border border-green-200">{parsedScenes.length} scenes</span>
          )}
          {hasNfBeatSheet && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-semibold border border-green-200">beat sheet</span>
          )}
        </div>
      </div>

      {/* ROW 3 — Action buttons */}
      <div className={cn(
        "flex gap-2 px-3.5 py-2.5 border-t border-gray-100",
        isComplete && "flex-wrap",
      )}>
        {isComplete && (
          <>
            <button
              className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-[7px] text-[13px] font-medium bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors whitespace-nowrap"
              onClick={() => setShowRewriteModal(true)}
            >
              <Pencil className="w-3.5 h-3.5" />Voice
            </button>
            <button
              className={cn("flex-1 min-w-[80px] flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-[7px] text-[13px] font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors whitespace-nowrap", (isWriting || rewriting) && "opacity-50 cursor-not-allowed")}
              disabled={isWriting || generatingScenesThenWrite || rewriting}
              onClick={handleRewrite}
            >
              {rewriting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Clearing…</> : <><RefreshCw className="w-3.5 h-3.5" />Rewrite</>}
            </button>
            <button
              className={cn("flex-1 basis-full sm:basis-0 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-[7px] text-[13px] font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors whitespace-nowrap", (isWriting || generatingScenesThenWrite) && "opacity-50 cursor-not-allowed")}
              disabled={isWriting || generatingScenesThenWrite || rewriting}
              onClick={handleWriteClick}
            >
              {generatingScenesThenWrite
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Scenes…</>
                : isWriting
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Writing…</>
                  : <><RefreshCw className="w-3.5 h-3.5" />Regenerate</>}
            </button>
          </>
        )}
        {isPendingOrError && (
          <>
            {chapter.chapter_number > 1 && onResume && (
              <button
                className={cn("flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-[7px] text-[13px] font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors whitespace-nowrap", (isWriting || isResuming) && "opacity-50 cursor-not-allowed")}
                disabled={isWriting || isResuming}
                onClick={() => onResume(chapter)}
              >
                {isResuming ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Resuming…</> : <><ArrowRight className="w-3.5 h-3.5" />Resume from here</>}
              </button>
            )}
            <button
              className={cn("flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-[7px] text-[13px] font-medium text-white border-0 transition-colors whitespace-nowrap", (isWriting || generatingScenesThenWrite) ? "bg-yellow-500 hover:bg-yellow-600" : "bg-indigo-600 hover:bg-indigo-700", (isWriting || generatingScenesThenWrite || rewriting) && "opacity-50 cursor-not-allowed")}
              disabled={isWriting || generatingScenesThenWrite || rewriting}
              onClick={handleWriteClick}
            >
              {generatingScenesThenWrite
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Scenes…</>
                : isWriting
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Writing…</>
                  : <><RefreshCw className="w-3.5 h-3.5" />Write</>}
            </button>
          </>
        )}
        {effectiveStatus === "generating" && !isComplete && !isPendingOrError && (
          <button
            className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-[7px] text-[13px] font-medium text-white bg-yellow-500 opacity-50 cursor-not-allowed whitespace-nowrap"
            disabled
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin" />Writing…
          </button>
        )}
      </div>

      {/* Write-without-scenes confirmation */}
      {writeConfirm && (
        <div className="border-t border-slate-100 bg-amber-50 px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-amber-800 font-medium flex-1">This chapter has no scenes. Generate scenes first for better results?</span>
          <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700" onClick={handleGenerateScenesThenWrite}>
            <LayoutGrid className="w-3 h-3 mr-1" />Generate Scenes First
          </Button>
          <button
            className="text-xs text-slate-400 hover:text-slate-600 underline"
            onClick={() => { setWriteConfirm(false); onWrite(chapter); }}
          >Write Without Scenes</button>
          <button className="text-xs text-slate-400 hover:text-slate-600" onClick={() => setWriteConfirm(false)}>Cancel</button>
        </div>
      )}

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-3">
          {chapterProgress && !isWriting && (
            <div className="text-xs text-indigo-600 font-medium">{chapterProgress}</div>
          )}
          {chapter.status === "error" && chapter.quality_scan && (() => {
            try { const qs = JSON.parse(chapter.quality_scan); if (qs.error) return <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2"><span className="font-semibold">Error:</span> {qs.error}</div>; } catch {}
            return null;
          })()}
          <ConsistencyFlagsBanner chapter={chapter} />
          {chapter.summary && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Summary</p>
              <p className="text-sm text-slate-700 leading-relaxed">{chapter.summary}</p>
            </div>
          )}
          {isFiction ? (
            <SceneSection chapter={chapter} onScenesUpdated={onScenesUpdated} />
          ) : (
            <NonfictionBeatSection chapter={chapter} onScenesUpdated={onScenesUpdated} />
          )}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                {hasScenes ? "Extra Instructions" : "Writing Prompt"}
              </p>
              <Button size="sm" variant="ghost" className="h-6 text-xs text-slate-500 px-2" onClick={() => setEditingPrompt(e => !e)}>
                <Pencil className="w-3 h-3 mr-1" />{editingPrompt ? "Cancel" : "Edit"}
              </Button>
            </div>
            {editingPrompt ? (
              <div className="space-y-2">
                <Textarea className="text-xs font-mono" rows={4} value={promptValue} onChange={e => setPromptValue(e.target.value)} />
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-7 text-xs" onClick={savePrompt}>Save</Button>
              </div>
            ) : (
              <p className="text-sm text-slate-600 leading-relaxed">{chapter.prompt}</p>
            )}
          </div>
          {(content || isStreaming) && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Content</p>
              <div className="bg-white rounded-lg border border-slate-200 p-3 max-h-80 overflow-y-auto">
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{content}{isStreaming && <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-0.5 align-text-bottom" />}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <RewriteInVoiceModal
        isOpen={showRewriteModal}
        onClose={() => setShowRewriteModal(false)}
        chapter={chapter}
        spec={spec}
        project={project}
      />
    </div>
  );
}

// ── Main GenerateTab ──────────────────────────────────────────────────────────

export default function GenerateTab({ projectId, onProceed }) {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [retryCountdown, setRetryCountdown] = useState(0);

  // CHANGE 5 FIX: Countdown timer for rate limit retry
  useEffect(() => {
    if (retryCountdown <= 0) return;
    const interval = setInterval(() => {
      setRetryCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [retryCountdown]);

  // Scroll to top on component mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const [generationProgress, setGenerationProgress] = useState("");
  const [streamingChapterId, setStreamingChapterId] = useState(null);
  const [activeChapterIds, setActiveChapterIds] = useState(new Set()); // tracks chapters being written (polling)
  const [streamingContent, setStreamingContent] = useState({});
  const [chapterProgress, setChapterProgress] = useState({});
  const [generatingAllScenes, setGeneratingAllScenes] = useState(false);
  const [allScenesProgress, setAllScenesProgress] = useState("");
  const [writeAllModalOpen, setWriteAllModalOpen] = useState(false);
  const [writeAllActive, setWriteAllActive] = useState(false);
  const [writeAllProgress, setWriteAllProgress] = useState({
    current: 0,
    total: 0,
    currentTitle: "",
    successes: 0,
    failures: [],
    startTime: null,
    done: false,
    elapsed: "",
    wordsWritten: 0,
    totalWords: 0,
    chapterWords: 0,
    targetChapterWords: 3750,
  });
  const writeAllAbortRef = useRef(false);
  const generatingRef = useRef(false);
  const [targetLength, setTargetLength] = useState("medium");
  const [resumingFromChapter, setResumingFromChapter] = useState(null);
  const [regenOutlineConfirm, setRegenOutlineConfirm] = useState(false);
  const [writingActNumber, setWritingActNumber] = useState(null);
  const [actBridges, setActBridges] = useState({});
  const [customActSplits, setCustomActSplits] = useState(null);

  const { data: projectData } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const ps = await base44.entities.Project.filter({ id: projectId });
      return ps[0];
    },
  });

  const { data: specifications = [] } = useQuery({
    queryKey: ["specification", projectId],
    queryFn: () => base44.entities.Specification.filter({ project_id: projectId }),
  });

  const { data: outlines = [] } = useQuery({
    queryKey: ["outline", projectId],
    queryFn: () => base44.entities.Outline.filter({ project_id: projectId }),
    refetchInterval: generating ? 4000 : false,
  });

  const { data: chapters = [], refetch: refetchChapters } = useQuery({
    queryKey: ["chapters", projectId],
    queryFn: () => base44.entities.Chapter.filter({ project_id: projectId }, "chapter_number"),
    refetchInterval: (writeAllActive || resumingFromChapter || streamingChapterId) ? 3000 : false,
  });

  const outline = outlines[0];
  const hasOutline = !!(outline?.outline_data || outline?.outline_url);
  const isPartial = outline?.status === 'partial' || outline?.status === 'shell_complete';

  // If the outline query picks up completion via auto-refetch, stop the spinner
  useEffect(() => {
    if (generating && (outline?.status === 'complete' || outline?.status === 'shell_complete')) {
      // Don't stop spinner for shell_complete — detail phase follows
      if (outline?.status === 'complete') {
        generatingRef.current = false;
        setGenerating(false);
        setGenerationProgress("");
        queryClient.invalidateQueries({ queryKey: ["chapters", projectId] });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
      }
    } else if (generating && outline?.status === 'error') {
      generatingRef.current = false;
      setGenerating(false);
      setGenerationProgress("");
      setGenerateError(outline.error_message || 'Generation failed');
    }
  }, [outline?.status]);
  const spec = specifications[0] ? {
    ...specifications[0],
    beat_style: specifications[0].beat_style || specifications[0].tone_style || "",
    spice_level: specifications[0].spice_level ?? 0,
    language_intensity: specifications[0].language_intensity ?? 0,
  } : null;

  // Fetch outline/story_bible from URL if inline data is empty
  const { data: outlineData } = useQuery({
    queryKey: ["outline_data", outline?.id],
    enabled: !!outline?.outline_url && !outline?.outline_data,
    queryFn: async () => {
      const res = await fetch(outline.outline_url);
      return res.text();
    },
  });
  const { data: storyBibleData } = useQuery({
    queryKey: ["story_bible_data", outline?.id],
    enabled: !!outline?.story_bible_url && !outline?.story_bible,
    queryFn: async () => {
      const res = await fetch(outline.story_bible_url);
      return res.text();
    },
  });

  const resolvedOutlineData = outline?.outline_data || outlineData;
  const resolvedStoryBible = outline?.story_bible || storyBibleData;
  const resolvedBookMetadata = outline?.book_metadata || null;

  const generatedCount = chapters.filter(c => c.status === "generated").length;
  const totalCount = chapters.length;
  const allGenerated = totalCount > 0 && generatedCount === totalCount;
  const progress = totalCount > 0 ? Math.round((generatedCount / totalCount) * 100) : 0;

  // ── Act Detection (auto-detected, overridable by user) ──
  const parsedOutline = safeParse(resolvedOutlineData);
  const autoActs = totalCount > 0 ? detectActBoundaries(chapters, parsedOutline) : null;
  const acts = (autoActs && customActSplits && totalCount > 3) ? {
    act1: { start: 1, end: customActSplits.act1End, label: 'Act 1 — Establish & Disrupt' },
    act2: { start: customActSplits.act1End + 1, end: customActSplits.act2End, label: 'Act 2 — Escalate & Break' },
    act3: { start: customActSplits.act2End + 1, end: totalCount, label: 'Act 3 — Fracture & Resolve' },
  } : autoActs;

  // Load act bridge files on mount
  useEffect(() => {
    if (!projectId) return;
    base44.entities.SourceFile.filter({ project_id: projectId }).then(files => {
      const bridges = {};
      for (const f of files) {
        const m = f.filename?.match(/^act_(\d+)_bridge\.txt$/);
        if (m) bridges[parseInt(m[1])] = true;
      }
      setActBridges(bridges);
    }).catch(() => {});
  }, [projectId, generatedCount]);

  const handleGenerateOutline = async () => {
    setGenerating(true);
    generatingRef.current = true;
    setGenerationProgress("Step 1/2 — Building structure…");
    setGenerateError("");

    try {
      // ── STEP 1: Shell (fast — titles + summaries) ──
      const shellRes = await base44.functions.invoke('generateOutlineShell', { project_id: projectId }, { timeout: 60000 });
      if (shellRes.status !== 200) {
        setGenerateError(shellRes.data?.error || 'Failed to generate shell');
        setGenerating(false);
        setGenerationProgress("");
        return;
      }

      const shellStatus = shellRes.data?.status;
      if (shellStatus === 'partial') {
        // Shell timed out — save what we have, let user resume
        await queryClient.invalidateQueries({ queryKey: ["outline", projectId] });
        await queryClient.invalidateQueries({ queryKey: ["chapters", projectId] });
        setGenerating(false);
        setGenerationProgress("");
        setGenerateError("Structure was partially generated. Click 'Resume Detail' to continue.");
        return;
      }

      // Shell complete — refresh chapters list, then start detail
      await queryClient.invalidateQueries({ queryKey: ["outline", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["chapters", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });

      setGenerationProgress("Step 2/2 — Filling in detail…");

      // ── STEP 2: Detail (story bible, prompts, beats) ──
      const detailRes = await base44.functions.invoke('generateOutlineDetail', { project_id: projectId }, { timeout: 120000 });

      const detailStatus = detailRes.data?.status;
      
      await queryClient.invalidateQueries({ queryKey: ["outline", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["chapters", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });

      generatingRef.current = false;
      setGenerating(false);
      setGenerationProgress("");

      if (detailStatus === 'partial') {
        setGenerateError("Outline partially detailed — some chapters may lack prompts. Click 'Resume Detail' to complete.");
      }

    } catch (err) {
      console.error('generateOutline error:', err);
      generatingRef.current = false;
      
      healthMonitor.report({
        severity: err.message?.includes('rate limit') ? 'warning' : 'error',
        category: 'pipeline',
        message: `Outline generation failed: ${err.message}`,
        context: { projectId },
        raw: err,
      });
      if (err.message?.includes('rate limit') || err.message?.includes('Rate limit')) {
        setGenerateError('AI rate limit reached — please wait 60 seconds and click Retry.');
        setRetryCountdown(60);
      } else {
        setGenerateError(err.message || 'Failed to generate outline');
      }
      
      setGenerating(false);
      setGenerationProgress("");
    }
  };

  const handleResumeDetail = async () => {
    setGenerating(true);
    generatingRef.current = true;
    setGenerationProgress("Resuming — Filling in detail…");
    setGenerateError("");

    try {
      const detailRes = await base44.functions.invoke('generateOutlineDetail', { project_id: projectId }, { timeout: 120000 });
      
      await queryClient.invalidateQueries({ queryKey: ["outline", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["chapters", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });

      generatingRef.current = false;
      setGenerating(false);
      setGenerationProgress("");

      if (detailRes.data?.status === 'partial') {
        setGenerateError("Still partially detailed. You can retry or proceed with what's available.");
      }
    } catch (err) {
      console.error('resumeDetail error:', err);
      generatingRef.current = false;
      setGenerateError(err.message || 'Failed to resume detail generation');
      setGenerating(false);
      setGenerationProgress("");
    }
  };

  // Shared helper: fire writeChapter and poll until chapter reaches generated/error status.
  // Returns "generated" | "error" | "timeout"
  const writeAndPollChapter = async (chapterId, chapterNumber, onProgress) => {
    let httpDone = false;
    let httpError = null;

    // Pre-reset chapter status in DB to prevent polling from picking up stale "error" status
    try {
      await base44.entities.Chapter.update(chapterId, { status: "generating" });
    } catch (e) { console.warn('Failed to reset chapter status before polling:', e.message); }

    // Fire the writeChapter request — track when it completes/fails
    base44.functions.invoke('writeChapter', {
      project_id: projectId,
      chapter_id: chapterId,
    }, { timeout: 600000 }).then(() => {
      httpDone = true;
    }).catch(err => {
      httpDone = true;
      httpError = err?.message || 'HTTP error';
      console.log(`writeChapter HTTP returned/errored for ch ${chapterNumber}:`, httpError);
    });

    // Poll chapter status until done
    const startedAt = Date.now();
    const maxWaitMs = 12 * 60 * 1000; // 12 min max per chapter (nonfiction with research+quality passes can take 10+ min)
    const progressMessages = ["Writing chapter prose…", "Building narrative…", "Crafting scenes…", "Running continuity check…", "Updating story bible…"];
    let lastUpdatedAt = null; // Track when the chapter record was last modified

    while (Date.now() - startedAt < maxWaitMs) {
      await new Promise(r => setTimeout(r, 3000));
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      const msgIdx = Math.floor(elapsed / 20) % progressMessages.length;

      const updatedChapters = await base44.entities.Chapter.filter({ project_id: projectId });
      const ch = updatedChapters.find(c => c.id === chapterId);

      if (ch?.status === 'generated') {
        if (onProgress) onProgress(`Complete — ${ch.word_count || 0} words (${timeStr})`);
        return "generated";
      }
      // Ignore "error" status in the first 15 seconds — it could be stale from a previous attempt
      // (the backend needs a few seconds to receive the request and set status to "generating")
      if (ch?.status === 'error' && elapsed > 15) {
        if (onProgress) onProgress(`Error during generation`);
        return "error";
      }

      // Detect Deno crash: if HTTP request completed with error but chapter is still "generating",
      // the backend may have crashed OR the gateway timed out (504) while the worker continues.
      // Gateway 504s are common for long-running AI generation (3-5 min) — the worker keeps running.
      // Only mark as error after a generous grace period (3+ minutes after HTTP error).
      if (httpDone && httpError && ch?.status === 'generating') {
        const is504 = httpError.includes('504') || httpError.includes('Gateway');
        const gracePeriod = is504 ? 420 : 180; // 7 min grace for 504, 3 min for other errors (generation takes 60-90s)
        if (elapsed > gracePeriod) {
          console.warn(`Ch ${chapterNumber}: Backend likely crashed (${httpError}, ${elapsed}s elapsed) — marking as error`);
          if (onProgress) onProgress(`Generation timed out — skipping to next chapter`);
          try {
            await base44.entities.Chapter.update(chapterId, { status: 'error' });
          } catch (e) { console.warn('Failed to mark crashed chapter:', e.message); }
          return "error";
        }
        // Still within grace period — keep polling, worker may still be running
        if (onProgress) onProgress(`Gateway timeout — worker still running… (${timeStr})`);
      }

      // Detect stale "generating": if 10+ minutes have passed and the chapter updated_date
      // hasn't changed in 5+ minutes, the worker likely died silently.
      // (Generous thresholds because nonfiction with research+multi-pass quality can take 8-10 min)
      if (ch?.updated_date) {
        const updMs = new Date(ch.updated_date).getTime();
        if (lastUpdatedAt && updMs === lastUpdatedAt && elapsed > 600) {
          const staleSecs = Math.floor((Date.now() - updMs) / 1000);
          if (staleSecs > 300) {
            console.warn(`Ch ${chapterNumber}: Stale "generating" for ${staleSecs}s — marking as error`);
            if (onProgress) onProgress(`Worker timed out — skipping to next chapter`);
            try {
              await base44.entities.Chapter.update(chapterId, { status: 'error' });
            } catch (e) { console.warn('Failed to mark stale chapter:', e.message); }
            return "error";
          }
        }
        lastUpdatedAt = updMs;
      }

      if (onProgress) onProgress(`${progressMessages[msgIdx]} (${timeStr})`);
    }

    // Timeout — check one last time, then mark as error so pipeline continues
    const finalCheck = await base44.entities.Chapter.filter({ project_id: projectId });
    const finalCh = finalCheck.find(c => c.id === chapterId);
    if (finalCh?.status === 'generated') return "generated";
    if (finalCh?.status === 'error') return "error";
    // Force-mark as error so Write All pipeline doesn't get stuck
    try {
      await base44.entities.Chapter.update(chapterId, { status: 'error' });
    } catch (e) { console.warn('Failed to mark timed-out chapter:', e.message); }
    return "timeout";
  };

  const interiorityMissing = needsInteriorityGate(spec) && !hasProtagonistInteriority(spec, projectData);

  const handleWriteChapter = async (chapter) => {
    if (interiorityMissing) {
      toast.error("Complete Protagonist Interiority in Specifications before generating.");
      return;
    }
    setStreamingChapterId(chapter.id);
    setActiveChapterIds(prev => new Set([...prev, chapter.id]));
    setChapterProgress(prev => ({ ...prev, [chapter.id]: "Starting generation…" }));

    // Update status optimistically in cache
    queryClient.setQueryData(["chapters", projectId], old =>
      (old || []).map(c => c.id === chapter.id ? { ...c, status: "generating" } : c)
    );

    try {
      const result = await writeAndPollChapter(chapter.id, chapter.chapter_number, (msg) => {
        setChapterProgress(prev => ({ ...prev, [chapter.id]: msg }));
      });

      if (result === "timeout") {
        setChapterProgress(prev => ({ ...prev, [chapter.id]: "Generation timeout — refresh to check status." }));
      }
      await refetchChapters();
    } catch (err) {
      console.error('writeChapter error:', err.message);
      healthMonitor.report({
        severity: err.message === 'timeout' ? 'warning' : 'error',
        category: 'generation',
        message: `Chapter generation failed: Ch ${chapter.chapter_number}`,
        context: { chapterNumber: chapter.chapter_number, chapterId: chapter.id },
        raw: err,
      });
      setChapterProgress(prev => ({ ...prev, [chapter.id]: `Error: ${err.message}` }));
    } finally {
      setActiveChapterIds(prev => { const s = new Set(prev); s.delete(chapter.id); return s; });
      setStreamingChapterId(null);
    }
  };

  const TARGET_WORDS_PER_CHAPTER = {
    short: 3750,
    medium: 3750,
    long: 4166,
    epic: 4375,
  };

  const handleWriteAllChapters = async () => {
    if (interiorityMissing) {
      toast.error("Complete Protagonist Interiority in Specifications before generating.");
      return;
    }
    // Filter chapters that don't have content yet (not generated)
    const toWrite = chapters.filter(c => c.status !== 'generated');
    
    if (toWrite.length === 0) {
      alert("All chapters are already written!");
      return;
    }

    // Get target length from spec
    const spec = specifications?.[0];
    const tLen = spec?.target_length || "medium";
    setTargetLength(tLen);

    const targetChapterWords = TARGET_WORDS_PER_CHAPTER[tLen];
    const targetTotalWords = toWrite.length * targetChapterWords;

    writeAllAbortRef.current = false;
    setWriteAllActive(true);
    setWriteAllModalOpen(true);

    const startTime = Date.now();
    setWriteAllProgress({
      current: 0,
      total: toWrite.length,
      currentTitle: toWrite[0]?.title || "",
      successes: 0,
      failures: [],
      startTime,
      done: false,
      elapsed: "",
      wordsWritten: 0,
      totalWords: targetTotalWords,
      chapterWords: 0,
      targetChapterWords,
      error: null,
    });

    // ── PHASE 1: Generate scenes (fiction) or beat sheets (nonfiction) ──
    {
      const needScenes = toWrite.filter(c => !c.scenes || c.scenes.trim() === 'null' || c.scenes.trim() === '[]' || c.scenes.trim() === '' || c.scenes.trim() === '{}');
      if (needScenes.length > 0) {
        const isNF = spec?.book_type === 'nonfiction';
        setWriteAllProgress(prev => ({ ...prev, phase: 1, phaseLabel: isNF ? "Phase 1: Generating Beat Sheets" : "Phase 1: Generating Scenes", currentTitle: needScenes[0].title }));
        for (let i = 0; i < needScenes.length; i++) {
          if (writeAllAbortRef.current) break;
          const ch = needScenes[i];
          setWriteAllProgress(prev => ({ ...prev, currentTitle: `Scene gen: Ch ${ch.chapter_number} — ${ch.title} (${i + 1}/${needScenes.length})` }));
          try {
            await base44.functions.invoke('generateScenes', { projectId, chapterNumber: ch.chapter_number });
            let polls = 0;
            while (polls < 45) {
              await new Promise(r => setTimeout(r, 2000));
              polls++;
              const updated = await base44.entities.Chapter.filter({ project_id: projectId });
              const updCh = updated.find(c => c.id === ch.id);
              if (updCh?.scenes && updCh.scenes.trim() !== 'null' && updCh.scenes.trim() !== '[]') break;
            }
          } catch (err) {
            console.warn(`Scene gen failed for ch ${ch.chapter_number}:`, err.message);
          }
        }
        await refetchChapters();
      }
    }
    // ── PHASE 2: Sequential chapter writing (frontend-driven to avoid backend timeout) ──
    setWriteAllProgress(prev => ({ ...prev, phase: 2, phaseLabel: "Phase 2: Writing Chapters" }));

    // Call backend to prep (reset error statuses) and get ordered list
    let chaptersToWrite = toWrite;
    try {
      const prepRes = await base44.functions.invoke('writeAllChapters', { projectId });
      if (prepRes.data?.toWrite?.length > 0) {
        // Use the backend's ordered list (may have refreshed statuses)
        const backendIds = new Set(prepRes.data.toWrite.map(c => c.id));
        chaptersToWrite = toWrite.filter(c => backendIds.has(c.id));
      }
    } catch (err) {
      console.warn('writeAllChapters prep failed, proceeding with frontend list:', err.message);
    }

    let successes = 0;
    let totalWordsWritten = 0;
    const failedChapters = [];

    for (let i = 0; i < chaptersToWrite.length; i++) {
      if (writeAllAbortRef.current) break;

      const ch = chaptersToWrite[i];
      setWriteAllProgress(prev => ({
        ...prev,
        current: successes,
        queueIndex: i,
        successes,
        failures: [...failedChapters],
        currentTitle: `Ch ${ch.chapter_number}: ${ch.title}`,
        chapterNumber: ch.chapter_number,
        chapterWords: 0,
        wordsWritten: totalWordsWritten,
      }));

      let result;
      try {
        result = await writeAndPollChapter(ch.id, ch.chapter_number, (msg) => {
          setWriteAllProgress(prev => ({
            ...prev,
            currentTitle: `Ch ${ch.chapter_number}: ${msg}`,
            chapterNumber: ch.chapter_number,
          }));
        });
      } catch (pollErr) {
        console.error(`WriteAll Ch ${ch.chapter_number} poll error:`, pollErr.message);
        healthMonitor.report({
          severity: 'error',
          category: 'generation',
          message: `WriteAll Ch ${ch.chapter_number} failed: ${pollErr.message}`,
          context: { chapterNumber: ch.chapter_number },
          raw: pollErr,
        });
        result = 'error';
      }

      if (result === 'generated') {
        successes++;
        try {
          const updated = await base44.entities.Chapter.filter({ project_id: projectId });
          totalWordsWritten = updated.filter(c => c.status === 'generated').reduce((sum, c) => sum + (c.word_count || 0), 0);
        } catch (e) { console.warn('Failed to fetch updated word count:', e.message); }

        base44.functions.invoke('generateChapterState', {
          project_id: projectId,
          chapter_id: ch.id,
        }).catch(err => console.warn(`State doc gen failed for ch ${ch.chapter_number}:`, err.message));

        if (i < chaptersToWrite.length - 1) {
          await new Promise(r => setTimeout(r, 3000));
        }
      } else {
        failedChapters.push({ number: ch.chapter_number, title: ch.title, error: result === 'timeout' ? 'Timed out' : 'Generation failed' });
      }

      setWriteAllProgress(prev => ({
        ...prev,
        current: successes,
        queueIndex: i + 1,
        successes,
        failures: [...failedChapters],
        wordsWritten: totalWordsWritten,
      }));
    }

    const elapsed = Date.now() - startTime;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);

    setWriteAllProgress(prev => ({
      ...prev,
      current: successes,
      successes,
      failures: failedChapters,
      done: true,
      paused: writeAllAbortRef.current && successes < chaptersToWrite.length,
      pausedAt: writeAllAbortRef.current ? successes + failedChapters.length + 1 : null,
      elapsed: `${mins}m ${secs}s`,
      wordsWritten: totalWordsWritten,
      chapterWords: 0,
      error: failedChapters.length > 0
        ? `${failedChapters.length} chapter(s) failed. You can regenerate them individually.`
        : null,
    }));

    setWriteAllActive(false);
    await refetchChapters();
  };

  const stopWriteAll = () => {
    writeAllAbortRef.current = true;
  };

  const handleResumeFromChapter = async (chapter) => {
    setResumingFromChapter(chapter.chapter_number);
    setWriteAllModalOpen(true);
    setWriteAllActive(true);

    const toWrite = chapters.filter(c => c.chapter_number >= chapter.chapter_number && c.status !== 'generated');
    const startTime = Date.now();
    const tLen = specifications?.[0]?.target_length || "medium";
    setTargetLength(tLen);

    setWriteAllProgress({
      current: 0,
      total: toWrite.length,
      currentTitle: `Resuming from Ch ${chapter.chapter_number}...`,
      successes: 0,
      failures: [],
      startTime,
      done: false,
      wordsWritten: 0,
      chapterWords: 0,
      phaseLabel: `Resuming from Chapter ${chapter.chapter_number}`,
    });

    let successes = 0;
    let totalWordsWritten = 0;
    const failedChapters = [];

    for (let i = 0; i < toWrite.length; i++) {
      if (writeAllAbortRef.current) break;

      const ch = toWrite[i];
      setWriteAllProgress(prev => ({
        ...prev,
        current: successes,
        queueIndex: i,
        successes,
        failures: [...failedChapters],
        currentTitle: `Ch ${ch.chapter_number}: ${ch.title}`,
        chapterNumber: ch.chapter_number,
        chapterWords: 0,
        wordsWritten: totalWordsWritten,
      }));

      let result;
      try {
        result = await writeAndPollChapter(ch.id, ch.chapter_number, (msg) => {
          setWriteAllProgress(prev => ({
            ...prev,
            currentTitle: `Ch ${ch.chapter_number}: ${msg}`,
            chapterNumber: ch.chapter_number,
          }));
        });
      } catch (pollErr) {
        console.error(`Resume Ch ${ch.chapter_number} poll error:`, pollErr.message);
        healthMonitor.report({
          severity: 'error',
          category: 'generation',
          message: `Resume Ch ${ch.chapter_number} failed: ${pollErr.message}`,
          context: { chapterNumber: ch.chapter_number },
          raw: pollErr,
        });
        result = 'error';
      }

      if (result === 'generated') {
        successes++;
        try {
          const updated = await base44.entities.Chapter.filter({ project_id: projectId });
          totalWordsWritten = updated.filter(c => c.status === 'generated').reduce((sum, c) => sum + (c.word_count || 0), 0);
        } catch (e) { console.warn('Failed to fetch updated word count:', e.message); }

        base44.functions.invoke('generateChapterState', {
          project_id: projectId,
          chapter_id: ch.id,
        }).catch(err => console.warn(`State doc gen failed for ch ${ch.chapter_number}:`, err.message));

        if (i < toWrite.length - 1) {
          await new Promise(r => setTimeout(r, 3000));
        }
      } else {
        failedChapters.push({ number: ch.chapter_number, title: ch.title, error: result === 'timeout' ? 'Timed out' : 'Generation failed' });
      }

      setWriteAllProgress(prev => ({
        ...prev,
        current: successes,
        queueIndex: i + 1,
        successes,
        failures: [...failedChapters],
        wordsWritten: totalWordsWritten,
      }));
    }

    const elapsed = Date.now() - startTime;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);

    setWriteAllProgress(prev => ({
      ...prev,
      current: successes,
      successes,
      failures: failedChapters,
      done: true,
      paused: false,
      pausedAt: null,
      elapsed: `${mins}m ${secs}s`,
      wordsWritten: totalWordsWritten,
      chapterWords: 0,
      error: failedChapters.length > 0 ? `${failedChapters.length} chapter(s) failed. You can regenerate them individually.` : null,
    }));

    setWriteAllActive(false);
    setResumingFromChapter(null);
    await refetchChapters();
  };

  const handleGenerateAllScenes = async () => {
    setGeneratingAllScenes(true);
    setAllScenesProgress("Checking chapters…");
    try {
      // Find chapters needing scenes (fiction) or beat sheets (nonfiction)
      const needScenes = chapters.filter(c => {
        const s = c.scenes?.trim();
        return !s || s === 'null' || s === '[]' || s === '{}';
      });
      if (needScenes.length === 0) {
        setAllScenesProgress("All chapters already have scenes.");
        setTimeout(() => setAllScenesProgress(""), 3000);
        return;
      }
      // Generate scenes sequentially from frontend (avoids backend-to-backend 403)
      for (let i = 0; i < needScenes.length; i++) {
        const ch = needScenes[i];
        setAllScenesProgress(`Generating scenes… ${i} of ${needScenes.length} done (Ch ${ch.chapter_number}: ${ch.title})`);
        try {
          await base44.functions.invoke('generateScenes', { projectId, chapterNumber: ch.chapter_number });
        } catch (err) {
          console.warn(`Scene gen failed for ch ${ch.chapter_number}:`, err.message);
        }
        // Brief delay between calls
        if (i < needScenes.length - 1) await new Promise(r => setTimeout(r, 1000));
      }
      setAllScenesProgress("Scenes ready!");
      await refetchChapters();
      setTimeout(() => setAllScenesProgress(""), 3000);
    } catch (err) {
      healthMonitor.report({
        severity: 'error',
        category: 'pipeline',
        message: `Scene generation failed: ${err.message}`,
        context: { projectId },
        raw: err,
      });
      setAllScenesProgress(`Error: ${err.message}`);
      setTimeout(() => setAllScenesProgress(""), 5000);
    } finally {
      setGeneratingAllScenes(false);
    }
  };

  // ── Write Act handler ──
  // Writes only chapters within a single act (smaller blast radius: 5-8 calls vs 20-25).
  // On per-chapter failure, continues to the next chapter (doesn't abort the act).
  // After full completion, prompts user to generate a continuity bridge before moving on.
  const handleWriteAct = async (actNumber) => {
    if (interiorityMissing) {
      toast.error("Complete Protagonist Interiority in Specifications before generating.");
      return;
    }
    const act = acts?.[`act${actNumber}`];
    if (!act) return;

    // If act > 1, inject continuity bridge context from the previous act
    // Auto-generate bridge for previous act if it's complete but bridge is missing
    if (actNumber > 1 && !actBridges[actNumber - 1]) {
      const prevAct = acts[`act${actNumber - 1}`];
      const prevStatus = getActStatus(chapters, acts, actNumber - 1);
      if (prevStatus === 'complete') {
        toast.info(`Generating Act ${actNumber - 1} continuity bridge…`);
        try {
          await base44.functions.invoke('generateActBridge', {
            project_id: projectId,
            act_number: actNumber - 1,
            act_start: prevAct.start,
            act_end: prevAct.end,
          });
          setActBridges(prev => ({ ...prev, [actNumber - 1]: true }));
          toast.success(`Act ${actNumber - 1} bridge ready — context will be injected`);
        } catch (err) {
          console.warn('Bridge generation failed:', err.message);
          toast.error('Bridge generation failed — proceeding without continuity context');
        }
      }
    }

    const actChapters = getActChapters(chapters, acts, actNumber);
    const toWrite = actChapters.filter(c => c.status !== 'generated');
    if (toWrite.length === 0) {
      toast.info(`Act ${actNumber} is already complete!`);
      return;
    }

    // Use the Write All modal for act-based writing
    const tLen = spec?.target_length || "medium";
    setTargetLength(tLen);
    const targetChapterWords = TARGET_WORDS_PER_CHAPTER[tLen];

    writeAllAbortRef.current = false;
    setWritingActNumber(actNumber);
    setWriteAllActive(true);
    setWriteAllModalOpen(true);

    const startTime = Date.now();
    setWriteAllProgress({
      current: 0,
      total: toWrite.length,
      currentTitle: `Act ${actNumber}: ${toWrite[0]?.title || ""}`,
      successes: 0,
      failures: [],
      startTime,
      done: false,
      elapsed: "",
      wordsWritten: 0,
      totalWords: toWrite.length * targetChapterWords,
      chapterWords: 0,
      targetChapterWords,
      phase: 2,
      phaseLabel: `Writing Act ${actNumber} (Ch ${act.start}–${act.end})`,
    });

    // Phase 1: Generate scenes (fiction) or beat sheets (nonfiction) for chapters that need them
    {
      const needScenes = toWrite.filter(c => !c.scenes || c.scenes.trim() === 'null' || c.scenes.trim() === '[]' || c.scenes.trim() === '' || c.scenes.trim() === '{}');
      if (needScenes.length > 0) {
        const isNF = spec?.book_type === 'nonfiction';
        setWriteAllProgress(prev => ({ ...prev, phase: 1, phaseLabel: `Act ${actNumber}: ${isNF ? 'Generating Beat Sheets' : 'Generating Scenes'}` }));
        for (let i = 0; i < needScenes.length; i++) {
          if (writeAllAbortRef.current) break;
          const ch = needScenes[i];
          setWriteAllProgress(prev => ({ ...prev, currentTitle: `Scene gen: Ch ${ch.chapter_number} (${i + 1}/${needScenes.length})` }));
          try {
            await base44.functions.invoke('generateScenes', { projectId, chapterNumber: ch.chapter_number });
            let polls = 0;
            while (polls < 45) {
              await new Promise(r => setTimeout(r, 2000));
              polls++;
              const updated = await base44.entities.Chapter.filter({ project_id: projectId });
              const updCh = updated.find(c => c.id === ch.id);
              if (updCh?.scenes && updCh.scenes.trim() !== 'null' && updCh.scenes.trim() !== '[]') break;
            }
          } catch (err) {
            console.warn(`Scene gen failed for ch ${ch.chapter_number}:`, err.message);
            // Don't abort — continue with next chapter's scenes
          }
        }
        await refetchChapters();
      }
    }
    // Phase 2: Sequential chapter writing within the act
    setWriteAllProgress(prev => ({ ...prev, phase: 2, phaseLabel: `Writing Act ${actNumber}` }));

    let successes = 0;
    let totalWordsWritten = 0;
    const failedChapters = [];

    for (let i = 0; i < toWrite.length; i++) {
      if (writeAllAbortRef.current) break;
      const ch = toWrite[i];
      setWriteAllProgress(prev => ({
        ...prev,
        current: successes,
        queueIndex: i,
        successes,
        failures: [...failedChapters],
        currentTitle: `Ch ${ch.chapter_number}: ${ch.title}`,
        chapterNumber: ch.chapter_number,
        wordsWritten: totalWordsWritten,
      }));

      // Write chapter — on failure, log it and continue to next (don't abort the act)
      let result;
      try {
        result = await writeAndPollChapter(ch.id, ch.chapter_number, (msg) => {
          setWriteAllProgress(prev => ({ ...prev, currentTitle: `Ch ${ch.chapter_number}: ${msg}` }));
        });
      } catch (pollErr) {
        console.error(`Act ${actNumber} Ch ${ch.chapter_number} poll error:`, pollErr.message);
        result = 'error';
      }

      if (result === 'generated') {
        successes++;
        try {
          const updated = await base44.entities.Chapter.filter({ project_id: projectId });
          totalWordsWritten = updated.filter(c => c.status === 'generated').reduce((sum, c) => sum + (c.word_count || 0), 0);
        } catch (e) { console.warn('Failed to fetch updated word count:', e.message); }
        base44.functions.invoke('generateChapterState', { project_id: projectId, chapter_id: ch.id })
          .catch(err => console.warn(`State doc gen failed for ch ${ch.chapter_number}:`, err.message));
        if (i < toWrite.length - 1) await new Promise(r => setTimeout(r, 3000));
      } else {
        // Per-chapter failure — record it but keep going
        console.error(`Act ${actNumber} Ch ${ch.chapter_number} failed: ${result}`);
        failedChapters.push({ number: ch.chapter_number, title: ch.title, error: result === 'timeout' ? 'Timed out' : 'Generation failed' });
      }

      setWriteAllProgress(prev => ({ ...prev, current: successes, queueIndex: i + 1, successes, failures: [...failedChapters], wordsWritten: totalWordsWritten }));
    }

    // Check if act is fully complete after writing
    const actFullyComplete = failedChapters.length === 0 && successes === toWrite.length && successes > 0;

    const elapsed = Date.now() - startTime;
    setWriteAllProgress(prev => ({
      ...prev, current: successes, successes, failures: failedChapters, done: true,
      paused: writeAllAbortRef.current, elapsed: `${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`,
      wordsWritten: totalWordsWritten,
      error: failedChapters.length > 0 ? `${failedChapters.length} chapter(s) failed. You can retry them individually.` : null,
    }));

    setWriteAllActive(false);
    setWritingActNumber(null);
    await refetchChapters();

    // After act completion, prompt user to generate bridge (non-blocking toast)
    if (actFullyComplete && actNumber < 3) {
      toast.success(`Act ${actNumber} complete!`, {
        description: `Generate the continuity bridge before writing Act ${actNumber + 1} for best story consistency.`,
        duration: 15000,
        action: {
          label: `Generate Bridge`,
          onClick: () => handleGenerateBridge(actNumber),
        },
      });
    } else if (actFullyComplete && actNumber === 3) {
      toast.success('Act 3 complete — all acts finished!');
    }
  };

  // ── Generate Bridge handler (manual trigger from ActHeader) ──
  const handleGenerateBridge = async (actNumber) => {
    const act = acts?.[`act${actNumber}`];
    if (!act) return;
    toast.info(`Generating Act ${actNumber} bridge document…`);
    try {
      await base44.functions.invoke('generateActBridge', {
        project_id: projectId,
        act_number: actNumber,
        act_start: act.start,
        act_end: act.end,
      });
      setActBridges(prev => ({ ...prev, [actNumber]: true }));
      toast.success(`Act ${actNumber} bridge ready`);
    } catch (err) {
      console.warn('Bridge generation failed:', err.message);
      toast.error('Bridge generation failed');
    }
  };

  // ── Empty state ──
  if (!hasOutline && !generating) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-indigo-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Your book starts here</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Generate your outline to begin. The AI will build your chapter structure based on your premise.
          </p>
          {generateError && (
            <div className="mb-4 space-y-3">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 text-left">
                {generateError}
              </div>
              {retryCountdown > 0 && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 text-center font-medium">
                  Ready to retry in: {retryCountdown}s...
                </div>
              )}
            </div>
          )}
          <Button 
            onClick={handleGenerateOutline} 
            disabled={retryCountdown > 0}
            className="bg-indigo-600 hover:bg-indigo-700 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4 mr-2" /> {generateError ? 'Retry Generation' : 'Generate Outline & Story Bible'}
          </Button>
          {spec && <div className="mt-4 text-left"><SpecSettingsSummary spec={spec} /></div>}
        </div>
      </div>
    );
  }

  if (generating) {
    const isStep2 = generationProgress.includes('2/2') || generationProgress.includes('Resuming');
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center max-w-sm">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Generating your book outline…</p>
          {generationProgress && (
            <p className="text-sm text-indigo-600 mt-2 font-medium">{generationProgress}</p>
          )}
          <div className="flex items-center gap-2 mt-4 justify-center">
            <div className={cn("h-2 flex-1 rounded-full", isStep2 ? "bg-indigo-500" : "bg-indigo-400 animate-pulse")} />
            <div className={cn("h-2 flex-1 rounded-full", isStep2 ? "bg-indigo-400 animate-pulse" : "bg-slate-200")} />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-1">
            <span className={isStep2 ? "text-indigo-600 font-medium" : ""}>Structure</span>
            <span className={isStep2 ? "text-indigo-600 font-medium" : ""}>Detail</span>
          </div>
          <p className="text-xs text-slate-400 mt-3">Usually completes in under 2 minutes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Settings summary */}
      <SpecSettingsSummary spec={spec} />

      {/* Progress + Word Count */}
      {totalCount > 0 && (
        <ProjectWordCount chapters={chapters} targetLength={spec?.target_length || "medium"} />
      )}

      {/* Book Metadata */}
      <BookMetadataCard metadataRaw={resolvedBookMetadata} />

      {/* Outline & Story Bible */}
      <OutlineCard outlineData={resolvedOutlineData} />
      <StoryBibleCard storyBible={resolvedStoryBible} />

      {/* Protagonist interiority gate for fiction */}
      {needsInteriorityGate(spec) && !hasProtagonistInteriority(spec, projectData) && (
        <InteriorityGateBanner onGoToSpec={() => window.dispatchEvent(new CustomEvent('navigateToPhase', { detail: 'specify' }))} />
      )}

      {/* Explicit tags warning for erotica projects */}
      {spec && /erotica|erotic/i.test(((spec.genre || '') + ' ' + (spec.subgenre || ''))) && resolvedOutlineData && (() => {
        const parsed = safeParse(resolvedOutlineData);
        if (!parsed) return null;
        return (
          <ExplicitTagsWarning
            outlineData={parsed}
            outlineRaw={resolvedOutlineData}
            outline={outline}
            projectId={projectId}
            onResolved={() => queryClient.invalidateQueries({ queryKey: ["outline", projectId] })}
          />
        );
      })()}

      {/* Partial outline banner */}
      {isPartial && !generating && !generateError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center justify-between">
          <span>Outline structure is ready but detail is incomplete. Resume to add prompts and story bible.</span>
          <Button size="sm" onClick={handleResumeDetail} className="bg-amber-600 hover:bg-amber-700 text-white ml-3 shrink-0">
            <Sparkles className="w-3 h-3 mr-1" /> Resume
          </Button>
        </div>
      )}

      {/* Error banner */}
      {generateError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {generateError}
        </div>
      )}

      {/* Regenerate outline + One-click write buttons */}
      <div className="flex flex-wrap justify-end gap-2">
        {isPartial && (
          <Button size="sm" onClick={handleResumeDetail} disabled={generating} className="bg-amber-600 hover:bg-amber-700 text-white">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Resume Detail Generation
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => {
          const hasWrittenChapters = chapters.some(c => c.status === 'generated');
          if (hasWrittenChapters) { setRegenOutlineConfirm(true); } else { handleGenerateOutline(); }
        }} className="text-slate-500">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> {generateError ? 'Retry' : 'Regenerate Outline'}
        </Button>
        {totalCount > 0 && chapters.some(c => !c.scenes || c.scenes.trim() === 'null' || c.scenes.trim() === '[]' || c.scenes.trim() === '' || c.scenes.trim() === '{}') && (
          <Button
            onClick={handleGenerateAllScenes}
            disabled={generatingAllScenes || writeAllActive}
            className={spec?.book_type === 'nonfiction' ? "bg-teal-600 hover:bg-teal-700 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"}
          >
            {generatingAllScenes
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{spec?.book_type === 'nonfiction' ? 'Generating Beat Sheets…' : 'Generating Scenes…'}</>
              : <><LayoutGrid className="w-4 h-4 mr-2" />{spec?.book_type === 'nonfiction' ? 'Generate All Beat Sheets' : 'Generate All Scenes'}</>}
          </Button>
        )}
        {totalCount > 0 && generatedCount < totalCount && (
          <Button 
            variant="outline"
            size="sm"
            onClick={handleWriteAllChapters} 
            disabled={generating || writeAllActive}
            className="text-slate-500 border-slate-300"
            title="Write all chapters sequentially — prefer Write Act buttons for better results"
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" /> 
            {writeAllActive ? "Writing..." : `Write All (${totalCount - generatedCount} remaining)`}
          </Button>
        )}
      </div>
      {allScenesProgress && (
        <div className="text-sm text-indigo-600 font-medium text-right">{allScenesProgress}</div>
      )}

      {/* Chapters — grouped by Act */}
      {chapters.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 text-base">Chapters</h3>
            {acts && <ActSplitEditor acts={acts} totalChapters={totalCount} onSave={setCustomActSplits} />}
          </div>
          {[1, 2, 3].map(actNum => {
            const act = acts?.[`act${actNum}`];
            if (!act) return null;
            const actChapters = getActChapters(chapters, acts, actNum);
            if (actChapters.length === 0) return null;
            const actStatus = getActStatus(chapters, acts, actNum);
            const actGenerated = actChapters.filter(c => c.status === 'generated').length;
            // Disable write if previous act isn't complete (except act 1)
            const prevComplete = actNum === 1 || getActStatus(chapters, acts, actNum - 1) === 'complete';

            return (
              <div key={actNum} className="space-y-2">
                <ActHeader
                  actNumber={actNum}
                  act={act}
                  status={actStatus}
                  chapterCount={actChapters.length}
                  generatedCount={actGenerated}
                  onWriteAct={handleWriteAct}
                  onGenerateBridge={handleGenerateBridge}
                  isWriting={writingActNumber === actNum}
                  hasBridge={actNum === 1 ? !!actBridges[1] : !!actBridges[actNum - 1]}
                  disabled={!prevComplete || writeAllActive || interiorityMissing}
                  prevActComplete={prevComplete}
                />
                {actChapters.map(chapter => {
                  const olCh = parsedOutline?.chapters?.find(c => (c.number || c.chapter_number) === chapter.chapter_number);
                  const beatData = olCh?.beat_function ? { beat_name: olCh.beat_name, beat_function: olCh.beat_function } : null;
                  return (
                    <ChapterItem
                      key={chapter.id}
                      chapter={chapter}
                      spec={spec}
                      project={projectData}
                      onWrite={handleWriteChapter}
                      onRewrite={handleWriteChapter}
                      onResume={handleResumeFromChapter}
                      streamingContent={streamingContent[chapter.id] || ""}
                      isStreaming={streamingChapterId === chapter.id}
                      isWriting={activeChapterIds.has(chapter.id)}
                      isResuming={resumingFromChapter === chapter.chapter_number}
                      chapterProgress={chapterProgress[chapter.id] || null}
                      onScenesUpdated={refetchChapters}
                      beatData={beatData}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Proceed button */}
      {allGenerated && (
        <div className="flex justify-end pt-2">
          <Button onClick={onProceed} className="bg-indigo-600 hover:bg-indigo-700 px-6">
            Proceed to Editor <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      {/* Write All Chapters Modal */}
      <WriteAllChaptersModal
        isOpen={writeAllModalOpen}
        onClose={() => setWriteAllModalOpen(false)}
        onProceed={onProceed}
        progress={writeAllProgress}
        onStop={stopWriteAll}
        targetLength={targetLength}
      />

      {/* Regenerate Outline Confirmation */}
      <AlertDialog open={regenOutlineConfirm} onOpenChange={setRegenOutlineConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Outline?</AlertDialogTitle>
            <AlertDialogDescription>
              This will erase all written chapters and generate a completely new outline. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { setRegenOutlineConfirm(false); handleGenerateOutline(); }}>
              Erase Chapters & Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}