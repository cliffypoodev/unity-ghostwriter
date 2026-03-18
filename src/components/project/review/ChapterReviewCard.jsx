import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Loader2, RefreshCw, Wand2, Zap, ChevronDown, ChevronUp, Check, AlertTriangle
} from "lucide-react";
import { SCAN_CATEGORIES, scanChapter, resolveChapterContent, autoFixChapter } from "./ScanPatterns";

// ═══════════════════════════════════════════════════════════════════════════════
// CHAPTER REVIEW CARD — self-contained fix/polish with inline status updates
// ═══════════════════════════════════════════════════════════════════════════════

// Only poll on actual timeout errors, not 4xx/5xx/network failures
function isTimeoutError(err) {
  const msg = (err?.message || "").toLowerCase();
  // Network errors usually mean the request never reached the server — don't poll
  return msg.includes("timeout") || msg.includes("econnaborted") || msg.includes("aborted");
}

export default function ChapterReviewCard({
  chapterEntity, // raw chapter entity from DB
  findings,      // current scan findings for this chapter
  words,         // current word count
  targetWords,
  tense,
  onScanUpdated, // callback(chapterNum, newFindings, newWords) — updates parent scan state
  projectId,
}) {
  const [expanded, setExpanded] = useState(false);
  const [action, setAction] = useState(null); // null | 'fixing' | 'polishing' | 'regenerating'
  const [actionStep, setActionStep] = useState(""); // human-readable progress
  const [lastResult, setLastResult] = useState(null); // { type, issuesBefore, issuesAfter, error }

  const chapterNum = chapterEntity.chapter_number;
  const chFindings = findings;
  const totalInstances = chFindings.reduce((sum, f) => sum + f.count, 0);
  const hasLeaks = chFindings.some(f => f.category === "instruction_leak");
  const hasTenseDrift = chFindings.some(f => f.category === "tense_drift");
  const isWorking = !!action;

  const statusColor = hasLeaks
    ? "border-red-500/50 bg-red-500/5"
    : hasTenseDrift
    ? "border-amber-500/50 bg-amber-500/5"
    : chFindings.length > 0
    ? "border-slate-600"
    : "border-emerald-500/30 bg-emerald-500/5";

  // ── CORE FLOW: action → wait for backend → re-fetch content → re-scan → update parent ──

  async function rescanAndUpdate() {
    setActionStep("Re-scanning chapter…");
    // Re-fetch the chapter entity from DB to get updated content
    const [refreshed] = await base44.entities.Chapter.filter({ id: chapterEntity.id });
    if (!refreshed) return;
    const content = await resolveChapterContent(refreshed);
    if (!content || content.length < 50) return;
    const { findings: newFindings, words: newWords } = scanChapter(content, chapterNum, tense, targetWords);
    onScanUpdated(chapterNum, newFindings, newWords);
    return newFindings;
  }

  async function handleFix() {
    const issuesBefore = totalInstances;
    setAction("fixing");
    setLastResult(null);
    setActionStep("Fixing issues…");

    try {
      const content = await resolveChapterContent(chapterEntity);
      if (!content || content.length < 100) {
        setLastResult({ type: "fix", error: "No content to fix" });
        return;
      }

      const fixedContent = autoFixChapter(content);

      if (fixedContent !== content) {
        setActionStep("Saving…");
        const blob = new Blob([fixedContent], { type: 'text/plain' });
        const file = new File([blob], `chapter_${chapterEntity.id}_fixed.txt`, { type: 'text/plain' });
        const uploadResult = await base44.integrations.Core.UploadFile({ file });
        const fileUrl = uploadResult?.file_url;
        if (!fileUrl) throw new Error('File upload failed — no URL returned');
        await base44.entities.Chapter.update(chapterEntity.id, { content: fileUrl });
        const { findings: newFindings, words: newWords } = scanChapter(fixedContent, chapterNum, tense, targetWords);
        onScanUpdated(chapterNum, newFindings, newWords);
        const issuesAfter = newFindings.reduce((s, f) => s + f.count, 0);
        setLastResult({ type: "fix", issuesBefore, issuesAfter, fixed: issuesBefore - issuesAfter });
      } else {
        setLastResult({ type: "fix", issuesBefore, issuesAfter: issuesBefore, fixed: 0, message: "No fixable issues found" });
      }
    } catch (err) {
      console.error("Fix failed:", err);
      setLastResult({ type: "fix", error: err.message });
    } finally {
      setAction(null);
      setActionStep("");
    }
  }

  async function handlePolish() {
    const issuesBefore = totalInstances;
    setAction("polishing");
    setLastResult(null);
    setActionStep("Sending to prose polisher…");

    try {
      const response = await base44.functions.invoke("bot_prosePolisher", {
        project_id: projectId,
        chapter_id: chapterEntity.id,
      });
      const result = response.data;

      if (result?.error) {
        setLastResult({ type: "polish", error: result.error });
        return;
      }

      if (result?.changed) {
        const newFindings = await rescanAndUpdate();
        const issuesAfter = newFindings ? newFindings.reduce((s, f) => s + f.count, 0) : issuesBefore;
        setLastResult({ type: "polish", issuesBefore, issuesAfter, fixed: issuesBefore - issuesAfter });
      } else {
        setLastResult({ type: "polish", issuesBefore, issuesAfter: issuesBefore, fixed: 0, message: "No changes needed" });
      }
    } catch (err) {
      if (isTimeoutError(err)) {
        console.warn("Polish invoke timed out, polling…", err.message);
        setActionStep("Waiting for backend…");
        await pollForUpdate(issuesBefore, "polish");
      } else {
        console.error("Polish invoke failed:", err.message);
        setLastResult({ type: "polish", error: err.message || "Backend call failed" });
      }
    } finally {
      setAction(null);
      setActionStep("");
    }
  }

  async function handleRegenerate() {
    if (!window.confirm(`Regenerate Chapter ${chapterNum}? This will re-run the full write pipeline.`)) return;
    const issuesBefore = totalInstances;
    setAction("regenerating");
    setLastResult(null);
    setActionStep("Resetting chapter…");

    try {
      await base44.entities.Chapter.update(chapterEntity.id, { status: "pending" });
      setActionStep("Running full write pipeline…");
      await base44.functions.invoke("bot_orchestrator", {
        action: "write_chapter",
        project_id: projectId,
        chapter_id: chapterEntity.id,
      });
      const newFindings = await rescanAndUpdate();
      const issuesAfter = newFindings ? newFindings.reduce((s, f) => s + f.count, 0) : 0;
      setLastResult({ type: "regenerate", issuesBefore, issuesAfter });
    } catch (err) {
      if (isTimeoutError(err)) {
        console.warn("Regenerate timed out, polling…", err.message);
        setActionStep("Waiting for pipeline…");
        await pollForUpdate(issuesBefore, "regenerate");
      } else {
        console.error("Regenerate failed:", err.message);
        setLastResult({ type: "regenerate", error: err.message || "Backend call failed" });
      }
    } finally {
      setAction(null);
      setActionStep("");
    }
  }

  // Poll the DB until the chapter's updated_date changes, then re-scan
  async function pollForUpdate(issuesBefore, actionType) {
    const [current] = await base44.entities.Chapter.filter({ id: chapterEntity.id });
    const originalUpdated = current?.updated_date;
    
    for (let i = 0; i < 45; i++) {
      await new Promise(r => setTimeout(r, 4000));
      setActionStep(`Waiting for backend… (${i * 4}s)`);
      const [updated] = await base44.entities.Chapter.filter({ id: chapterEntity.id });
      if (updated && updated.updated_date !== originalUpdated) {
        const newFindings = await rescanAndUpdate();
        const issuesAfter = newFindings ? newFindings.reduce((s, f) => s + f.count, 0) : issuesBefore;
        setLastResult({ type: actionType, issuesBefore, issuesAfter, fixed: issuesBefore - issuesAfter });
        return;
      }
    }
    setLastResult({ type: actionType, error: "Timed out waiting for backend (3 min)" });
  }

  return (
    <div className={cn("rounded-xl border p-4 transition-all", statusColor)}>
      {/* ── Header row ── */}
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
            hasLeaks ? "bg-red-500 text-white" : hasTenseDrift ? "bg-amber-500 text-white" : chFindings.length > 0 ? "bg-slate-600 text-white" : "bg-emerald-500 text-white"
          )}>{chapterNum}</div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-200 truncate max-w-[300px]">
              {(chapterEntity.title || "").replace(/^Chapter \d+:\s*/, "")}
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className={cn("text-xs", targetWords && words > targetWords * 1.3 ? "text-red-400 font-medium" : "text-slate-400")}>
                {words.toLocaleString()} words
              </span>
              {isWorking ? (
                <span className="text-xs text-violet-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> {actionStep}
                </span>
              ) : chFindings.length > 0 ? (
                <span className="text-xs text-amber-400">{totalInstances} issue{totalInstances !== 1 ? "s" : ""}</span>
              ) : (
                <span className="text-xs text-emerald-400">✓ Clean</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Inline result badge */}
          {lastResult && !isWorking && (
            <ResultBadge result={lastResult} />
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          {/* Action buttons */}
          {(chFindings.length > 0 || lastResult?.error) && (
            <div className="flex flex-wrap gap-2 mb-3">
              <Button size="sm" disabled={isWorking}
                className="text-xs h-8 bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                onClick={(e) => { e.stopPropagation(); handleFix(); }}>
                {action === "fixing" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Fix Issues
              </Button>
              <Button size="sm" disabled={isWorking}
                className="text-xs h-8 bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
                onClick={(e) => { e.stopPropagation(); handlePolish(); }}>
                {action === "polishing" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                Polish Prose
              </Button>
              {hasLeaks && (
                <Button size="sm" disabled={isWorking} variant="outline"
                  className="text-xs h-8 border-red-500/40 text-red-400 hover:bg-red-500/10 gap-1.5"
                  onClick={(e) => { e.stopPropagation(); handleRegenerate(); }}>
                  {action === "regenerating" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Regenerate
                </Button>
              )}
            </div>
          )}

          {/* Inline result detail */}
          {lastResult && !isWorking && (
            <ResultDetail result={lastResult} />
          )}

          {/* Issue list */}
          {chFindings.length > 0 && (
            <div className="space-y-2">
              {chFindings.map((f, i) => {
                const cat = SCAN_CATEGORIES[f.category];
                return (
                  <div key={i} className={cn("flex items-start gap-2 text-xs p-2 rounded-lg",
                    f.category === "instruction_leak" ? "bg-red-500/10" : "bg-slate-800/50"
                  )}>
                    <span className="shrink-0 mt-0.5">{cat?.icon || "•"}</span>
                    <div className="flex-1 min-w-0">
                      <span className={cn("font-medium",
                        f.category === "instruction_leak" ? "text-red-400" :
                        f.category === "tense_drift" ? "text-amber-400" : "text-slate-300"
                      )}>{cat?.label}:</span>{" "}
                      <span className="text-slate-400">{f.label} ({f.count}×)</span>
                      {f.samples && (
                        <div className="mt-1 space-y-1">
                          {f.samples.map((s, j) => (
                            <div key={j} className="pl-3 border-l-2 border-slate-700 text-slate-500 italic truncate max-w-full">"{s}"</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {chFindings.length === 0 && !lastResult && (
            <p className="text-xs text-emerald-400/70 py-2">No issues detected in this chapter.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Inline result badge (shown in collapsed header) ──
function ResultBadge({ result }) {
  if (result.error) {
    return <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px]">Error</Badge>;
  }
  const delta = (result.issuesBefore || 0) - (result.issuesAfter || 0);
  if (delta > 0) {
    return <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">−{delta} issues</Badge>;
  }
  if (result.message) {
    return <Badge className="bg-slate-500/20 text-slate-400 border border-slate-500/30 text-[10px]">{result.message}</Badge>;
  }
  return <Badge className="bg-slate-500/20 text-slate-400 border border-slate-500/30 text-[10px]">No change</Badge>;
}

// ── Inline result detail (shown in expanded body) ──
function ResultDetail({ result }) {
  if (result.error) {
    return (
      <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
        <p className="text-xs text-red-400"><AlertTriangle className="w-3 h-3 inline mr-1" />{result.error}</p>
      </div>
    );
  }
  const delta = (result.issuesBefore || 0) - (result.issuesAfter || 0);
  const label = result.type === "fix" ? "Style Enforcer" : result.type === "polish" ? "Prose Polisher" : "Regeneration";
  return (
    <div className={cn("mb-3 p-2.5 rounded-lg border", delta > 0 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-slate-800/50 border-slate-700")}>
      <div className="flex items-center gap-2 text-xs">
        <Check className={cn("w-3 h-3", delta > 0 ? "text-emerald-400" : "text-slate-400")} />
        <span className={cn("font-medium", delta > 0 ? "text-emerald-400" : "text-slate-300")}>{label} complete</span>
        {delta > 0 ? (
          <span className="text-emerald-400/80">— {result.issuesBefore} → {result.issuesAfter} issues ({delta} fixed)</span>
        ) : (
          <span className="text-slate-500">— {result.message || "no change detected"}</span>
        )}
      </div>
    </div>
  );
}