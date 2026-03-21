// ChapterItem — Extracted from GenerateTab (Phase 6 split)
// Individual chapter row with status, actions, expand/collapse, content preview

import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, ChevronDown, ChevronRight, Copy, RefreshCw,
  Pencil, ArrowRight, Check, LayoutGrid, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import BeatBadge from "../BeatBadge";
import ConsistencyFlagsBanner from "../ConsistencyFlagsBanner";
import RewriteInVoiceModal from "../RewriteInVoiceModal";
import SceneSection from "../SceneSection";
import NonfictionBeatSection from "../NonfictionBeatSection";

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

function safeParseCh(str) {
  try { if (!str || str.trim() === 'null' || str.trim() === '[]' || str.trim() === '{}') return null; return JSON.parse(str); } catch { return null; }
}

export default function ChapterItem({ chapter, spec, onWrite, onRewrite, onResume, streamingContent, isStreaming, isWriting, chapterProgress, onScenesUpdated, beatData, isResuming, project }) {
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
  try { if (chapter.consistency_flags) { const flags = JSON.parse(chapter.consistency_flags); hasFlags = flags.some(f => !f.dismissed); } } catch {}

  const isFiction = spec?.book_type !== 'nonfiction';
  const parsedScenes = safeParseCh(chapter.scenes);
  const hasScenes = isFiction && Array.isArray(parsedScenes) && parsedScenes.length > 0;
  const hasNfBeatSheet = !isFiction && parsedScenes && typeof parsedScenes === 'object' && (parsedScenes.opening_hook || parsedScenes.sections);

  const resolvedContent = useResolvedContent(chapter.content);
  const content = isStreaming ? streamingContent : resolvedContent;

  // Determine if chapter actually has content by checking both the raw field AND the resolved text
  const rawFieldPresent = !!(chapter.content && chapter.content.trim() !== '');
  const resolvedHasText = !!(resolvedContent && resolvedContent.trim().length > 50);
  const hasActualContent = rawFieldPresent && resolvedHasText;

  const handleCopy = () => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const savePrompt = async () => {
    await base44.entities.Chapter.update(chapter.id, { prompt: promptValue });
    queryClient.invalidateQueries({ queryKey: ["chapters", chapter.project_id] });
    setEditingPrompt(false);
  };

  const handleWriteClick = () => {
    if (isFiction && !hasScenes) { setWriteConfirm(true); } else { onWrite(chapter); }
  };

  const handleRewrite = async () => {
    setRewriting(true);
    try {
      await base44.entities.Chapter.update(chapter.id, { content: "", status: "pending", word_count: 0, quality_scan: "", distinctive_phrases: "", state_document: "", generated_at: "" });
      queryClient.invalidateQueries({ queryKey: ["chapters", chapter.project_id] });
      onRewrite(chapter);
    } catch (err) { console.error('Rewrite clear error:', err.message); }
    finally { setRewriting(false); }
  };

  const handleGenerateScenesThenWrite = async () => {
    setWriteConfirm(false);
    setGeneratingScenesThenWrite(true);
    try {
      await base44.functions.invoke('generateScenes', { projectId: chapter.project_id, chapterNumber: chapter.chapter_number });
      let polls = 0;
      while (polls < 45) {
        await new Promise(r => setTimeout(r, 2000)); polls++;
        const updated = await base44.entities.Chapter.filter({ project_id: chapter.project_id });
        const updCh = updated.find(c => c.id === chapter.id);
        if (updCh?.scenes && updCh.scenes.trim() !== 'null' && updCh.scenes.trim() !== '[]') { if (onScenesUpdated) onScenesUpdated(); break; }
      }
    } catch (err) { console.error('generateScenesThenWrite error:', err.message); }
    finally { setGeneratingScenesThenWrite(false); onWrite(chapter); }
  };

  const hasContentDespiteError = chapter.status === "error" && hasActualContent;
  const isGeneratedButEmpty = chapter.status === "generated" && !hasActualContent;
  const statusConfig = {
    generated: { label: "COMPLETE", color: "text-green-700", dot: "bg-green-500", row: "bg-green-50" },
    generated_empty: { label: "EMPTY — NEEDS REWRITE", color: "text-amber-700", dot: "bg-amber-500", row: "bg-amber-50" },
    generating: { label: "WRITING…", color: "text-blue-600", dot: "bg-blue-500", row: "bg-blue-50" },
    error: { label: "ERROR", color: "text-red-600", dot: "bg-red-500", row: "bg-red-50" },
    error_with_content: { label: "NEEDS REVIEW", color: "text-amber-700", dot: "bg-amber-500", row: "bg-amber-50" },
    pending: { label: "PENDING", color: "text-gray-400", dot: "bg-gray-300", row: "bg-gray-50" },
  };
  const effectiveStatus = isWriting ? "generating" : hasContentDespiteError ? "error_with_content" : isGeneratedButEmpty ? "generated_empty" : chapter.status;
  const st = statusConfig[effectiveStatus] || statusConfig.pending;
  const isComplete = (chapter.status === "generated" && hasActualContent) || hasContentDespiteError;
  const isPendingOrError = (chapter.status === "error" && !hasContentDespiteError) || chapter.status === "pending" || isGeneratedButEmpty;

  return (
    <div className={cn("rounded-[10px] overflow-hidden bg-white mb-2.5 border",
      isGeneratedButEmpty ? "border-amber-300 bg-[#fffbf0]" : hasContentDespiteError ? "border-amber-200 bg-[#fffbf5]" : chapter.status === "error" ? "border-red-200 bg-[#fff8f8]" : isWriting ? "border-blue-200" : isComplete ? "border-green-200 bg-[#f9fffe]" : "border-gray-200"
    )}>
      {/* ROW 1 — Status */}
      <div className={cn("flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold tracking-[0.8px] uppercase border-b border-gray-100", st.row)}>
        <span className={cn("w-[7px] h-[7px] rounded-full shrink-0", st.dot, isWriting && "animate-pulse")} />
        <span className={st.color}>{st.label}</span>
        {hasFlags && <span className="text-amber-500 ml-auto" title="Continuity flags detected"><AlertTriangle className="w-3 h-3" /></span>}
        {chapterProgress && isWriting && <span className="ml-auto text-[10px] font-medium text-blue-500 normal-case tracking-normal truncate max-w-[220px]">{chapterProgress}</span>}
      </div>

      {/* ROW 2 — Chapter info */}
      <div className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-gray-50/50 transition-colors" onClick={() => setExpanded(e => !e)}>
        <button className="text-gray-400 shrink-0" onClick={e => { e.stopPropagation(); setExpanded(e2 => !e2); }}>
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 text-[13px] font-semibold flex items-center justify-center shrink-0">{chapter.chapter_number}</span>
        <div className="flex-1 min-w-0">
          <span className="text-[14px] font-medium text-gray-900 block truncate mb-0.5">{chapter.title}</span>
          <div className="flex items-center gap-2 flex-wrap">
            {hasActualContent && chapter.word_count > 0 && <span className="text-xs text-gray-500">~{chapter.word_count.toLocaleString()} words</span>}
            {isGeneratedButEmpty && <span className="text-xs text-amber-600 font-semibold">⚠ Content missing — needs rewrite</span>}
            {(() => { try { const qs = chapter.quality_scan ? JSON.parse(chapter.quality_scan) : null; if (!qs) return null; return (<>
              {qs.genAttempts > 1 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200">{qs.genAttempts} attempts</span>}
              {qs.structural?.needsRetry && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 font-bold border border-red-200" title={`Retry reason: ${qs.structural.retryReason}`}>structure issue</span>}
              {qs.warnings?.length > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200 cursor-help" title={qs.warnings.join('\n')}>⚠ {qs.warnings.length} warning{qs.warnings.length > 1 ? 's' : ''}</span>}
            </>); } catch { return null; } })()}
            {content && <button className="text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 flex items-center gap-1 px-1.5 py-0.5 rounded border border-gray-200 transition-colors" onClick={(e) => { e.stopPropagation(); handleCopy(); }}>
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}{copied ? "copied" : "copy"}
            </button>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          {beatData?.beat_function && <BeatBadge beatFunction={beatData.beat_function} beatName={beatData.beat_name} />}
          {hasScenes && <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-semibold border border-green-200">{parsedScenes.length} scenes</span>}
          {hasNfBeatSheet && <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-semibold border border-green-200">beat sheet</span>}
        </div>
      </div>

      {/* ROW 3 — Action buttons */}
      <div className={cn("flex gap-2 px-3.5 py-2.5 border-t border-gray-100", isComplete && "flex-wrap")}>
        {isComplete && (<>
          <button className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-[7px] text-[13px] font-medium bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors whitespace-nowrap" onClick={() => setShowRewriteModal(true)}><Pencil className="w-3.5 h-3.5" />Voice</button>
          <button className={cn("flex-1 min-w-[80px] flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-[7px] text-[13px] font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors whitespace-nowrap", (isWriting || rewriting) && "opacity-50 cursor-not-allowed")} disabled={isWriting || generatingScenesThenWrite || rewriting} onClick={handleRewrite}>
            {rewriting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Clearing…</> : <><RefreshCw className="w-3.5 h-3.5" />Rewrite</>}
          </button>
          <button className={cn("flex-1 basis-full sm:basis-0 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-[7px] text-[13px] font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors whitespace-nowrap", (isWriting || generatingScenesThenWrite) && "opacity-50 cursor-not-allowed")} disabled={isWriting || generatingScenesThenWrite || rewriting} onClick={handleWriteClick}>
            {generatingScenesThenWrite ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Scenes…</> : isWriting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Writing…</> : <><RefreshCw className="w-3.5 h-3.5" />Regenerate</>}
          </button>
        </>)}
        {isPendingOrError && (<>
          {chapter.chapter_number > 1 && onResume && (
            <button className={cn("flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-[7px] text-[13px] font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors whitespace-nowrap", (isWriting || isResuming) && "opacity-50 cursor-not-allowed")} disabled={isWriting || isResuming} onClick={() => onResume(chapter)}>
              {isResuming ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Resuming…</> : <><ArrowRight className="w-3.5 h-3.5" />Resume from here</>}
            </button>
          )}
          <button className={cn("flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-[7px] text-[13px] font-medium text-white border-0 transition-colors whitespace-nowrap", (isWriting || generatingScenesThenWrite) ? "bg-yellow-500 hover:bg-yellow-600" : "bg-indigo-600 hover:bg-indigo-700", (isWriting || generatingScenesThenWrite || rewriting) && "opacity-50 cursor-not-allowed")} disabled={isWriting || generatingScenesThenWrite || rewriting} onClick={handleWriteClick}>
            {generatingScenesThenWrite ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Scenes…</> : isWriting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Writing…</> : <><RefreshCw className="w-3.5 h-3.5" />Write</>}
          </button>
        </>)}
        {effectiveStatus === "generating" && !isComplete && !isPendingOrError && (
          <button className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-[7px] text-[13px] font-medium text-white bg-yellow-500 opacity-50 cursor-not-allowed whitespace-nowrap" disabled><Loader2 className="w-3.5 h-3.5 animate-spin" />Writing…</button>
        )}
      </div>

      {/* Write-without-scenes confirmation */}
      {writeConfirm && (
        <div className="border-t border-slate-100 bg-amber-50 px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-amber-800 font-medium flex-1">This chapter has no scenes. Generate scenes first for better results?</span>
          <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700" onClick={handleGenerateScenesThenWrite}><LayoutGrid className="w-3 h-3 mr-1" />Generate Scenes First</Button>
          <button className="text-xs text-slate-400 hover:text-slate-600 underline" onClick={() => { setWriteConfirm(false); onWrite(chapter); }}>Write Without Scenes</button>
          <button className="text-xs text-slate-400 hover:text-slate-600" onClick={() => setWriteConfirm(false)}>Cancel</button>
        </div>
      )}

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-3">
          {chapterProgress && !isWriting && <div className="text-xs text-indigo-600 font-medium">{chapterProgress}</div>}
          {chapter.status === "error" && chapter.quality_scan && (() => { try { const qs = JSON.parse(chapter.quality_scan); if (qs.error) return <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2"><span className="font-semibold">Error:</span> {qs.error}</div>; } catch {} return null; })()}
          <ConsistencyFlagsBanner chapter={chapter} />
          {chapter.summary && <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Summary</p><p className="text-sm text-slate-700 leading-relaxed">{chapter.summary}</p></div>}
          {isFiction ? <SceneSection chapter={chapter} onScenesUpdated={onScenesUpdated} /> : <NonfictionBeatSection chapter={chapter} onScenesUpdated={onScenesUpdated} />}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{hasScenes ? "Extra Instructions" : "Writing Prompt"}</p>
              <Button size="sm" variant="ghost" className="h-6 text-xs text-slate-500 px-2" onClick={() => setEditingPrompt(e => !e)}><Pencil className="w-3 h-3 mr-1" />{editingPrompt ? "Cancel" : "Edit"}</Button>
            </div>
            {editingPrompt ? (
              <div className="space-y-2"><Textarea className="text-xs font-mono" rows={4} value={promptValue} onChange={e => setPromptValue(e.target.value)} /><Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-7 text-xs" onClick={savePrompt}>Save</Button></div>
            ) : <p className="text-sm text-slate-600 leading-relaxed">{chapter.prompt}</p>}
          </div>
          {(content || isStreaming) && (
            <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Content</p>
            <div className="bg-white rounded-lg border border-slate-200 p-3 max-h-80 overflow-y-auto"><p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{content}{isStreaming && <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-0.5 align-text-bottom" />}</p></div></div>
          )}
        </div>
      )}

      <RewriteInVoiceModal isOpen={showRewriteModal} onClose={() => setShowRewriteModal(false)} chapter={chapter} spec={spec} project={project} />
    </div>
  );
}