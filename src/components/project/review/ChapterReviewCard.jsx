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

function isTimeoutError(err) {
  var msg = (err && err.message ? err.message : "").toLowerCase();
  return msg.indexOf("timeout") >= 0 || msg.indexOf("econnaborted") >= 0 || msg.indexOf("aborted") >= 0;
}

// Save chapter content — tries file upload first, falls back to direct save
async function saveChapterContent(chapterId, content) {
  console.log("[saveChapter] Saving chapter", chapterId, "content length:", content.length);

  // Approach 1: Try file upload via integrations API
  try {
    console.log("[saveChapter] Trying file upload approach...");
    var blob = new Blob([content], { type: "text/plain" });
    var file = new File([blob], "chapter_" + chapterId + "_fixed.txt", { type: "text/plain" });
    var uploadResult = await base44.integrations.Core.UploadFile({ file: file });
    console.log("[saveChapter] Upload result:", JSON.stringify(uploadResult));
    if (uploadResult && uploadResult.file_url) {
      await base44.entities.Chapter.update(chapterId, { content: uploadResult.file_url });
      console.log("[saveChapter] Saved via file upload. URL:", uploadResult.file_url);
      return true;
    }
    console.warn("[saveChapter] Upload returned no file_url");
  } catch (uploadErr) {
    console.warn("[saveChapter] File upload failed:", uploadErr.message || uploadErr);
  }

  // Approach 2: Try direct save (works if content is small enough)
  try {
    console.log("[saveChapter] Trying direct save...");
    await base44.entities.Chapter.update(chapterId, { content: content });
    console.log("[saveChapter] Direct save succeeded");
    return true;
  } catch (directErr) {
    console.error("[saveChapter] Direct save also failed:", directErr.message || directErr);
  }

  throw new Error("Could not save — both file upload and direct save failed. Check browser console.");
}

export default function ChapterReviewCard({
  chapterEntity,
  findings,
  words,
  targetWords,
  tense,
  onScanUpdated,
  projectId,
}) {
  const [expanded, setExpanded] = useState(false);
  const [action, setAction] = useState(null);
  const [actionStep, setActionStep] = useState("");
  const [lastResult, setLastResult] = useState(null);

  var chapterNum = chapterEntity.chapter_number;
  var chFindings = findings;
  var totalInstances = chFindings.reduce(function(sum, f) { return sum + f.count; }, 0);
  var hasLeaks = chFindings.some(function(f) { return f.category === "instruction_leak"; });
  var hasTenseDrift = chFindings.some(function(f) { return f.category === "tense_drift"; });
  var hasDupes = chFindings.some(function(f) { return f.category === "duplicate_paragraph"; });
  var isWorking = !!action;

  var statusColor = hasLeaks || hasDupes
    ? "border-red-200 bg-red-50"
    : hasTenseDrift
    ? "border-amber-200 bg-amber-50"
    : chFindings.length > 0
    ? "border-[var(--nb-border)]"
    : "border-emerald-200 bg-emerald-50";

  async function rescanAndUpdate() {
    setActionStep("Re-scanning chapter...");
    try {
      var results = await base44.entities.Chapter.filter({ id: chapterEntity.id });
      var refreshed = results[0];
      if (!refreshed) return null;
      var content = await resolveChapterContent(refreshed);
      if (!content || content.length < 50) return null;
      var scanResult = scanChapter(content, chapterNum, tense, targetWords);
      onScanUpdated(chapterNum, scanResult.findings, scanResult.words);
      return scanResult.findings;
    } catch (err) {
      console.error("[rescanAndUpdate] Error:", err);
      return null;
    }
  }

  // Categories that need AI rewrite (can't be fixed by regex alone)
  var AI_FIXABLE = ['formulaic_intro', 'car_opening_cliche', 'simile_overload', 'narrator_repetition',
    'participle_chain', 'ai_sensory_default', 'sentence_rhythm', 'interiority_repetition',
    'sensory_opener', 'tense_drift', 'the_noun_opener', 'philosophical_ending', 'fiction_cliche', 'recap_bloat'];

  // FIX ISSUES — regex autoFix first, then AI targeted rewrite for remaining issues
  async function handleFix() {
    var issuesBefore = totalInstances;
    setAction("fixing");
    setLastResult(null);
    setActionStep("Loading chapter content...");

    try {
      console.log("[handleFix] Starting fix for chapter", chapterNum);

      var content = await resolveChapterContent(chapterEntity);
      console.log("[handleFix] Loaded content, length:", content ? content.length : 0);

      if (!content || content.length < 100) {
        setLastResult({ type: "fix", error: "No content to fix (length: " + (content ? content.length : 0) + ")" });
        return;
      }

      // Pass 1: Regex-based autoFix
      setActionStep("Running regex fixes...");
      var fixedContent = autoFixChapter(content);
      var regexChanged = fixedContent !== content;
      console.log("[handleFix] Regex pass. Changed:", regexChanged);

      if (regexChanged && fixedContent && fixedContent.trim().length >= 100) {
        setActionStep("Saving regex fixes...");
        await saveChapterContent(chapterEntity.id, fixedContent);
      }

      // Re-scan after regex pass to see what's left
      var currentContent = regexChanged ? fixedContent : content;
      var midScan = scanChapter(currentContent, chapterNum, tense, targetWords);
      var aiFindings = midScan.findings.filter(function(f) { return AI_FIXABLE.indexOf(f.category) >= 0; });

      // Pass 2: AI targeted rewrite for remaining AI-fixable issues
      if (aiFindings.length > 0) {
        setActionStep("AI rewriting " + aiFindings.length + " issue type(s)...");
        console.log("[handleFix] Sending", aiFindings.length, "AI-fixable finding types to bot_targetedRewrite");
        try {
          var rewriteResp = await base44.functions.invoke("bot_targetedRewrite", {
            project_id: projectId,
            chapter_id: chapterEntity.id,
            findings: aiFindings,
          });
          var rewriteResult = rewriteResp.data;
          console.log("[handleFix] AI rewrite result:", JSON.stringify(rewriteResult));

          if (rewriteResult && rewriteResult.changed) {
            console.log("[handleFix] AI rewrite made changes");
          }
        } catch (aiErr) {
          if (isTimeoutError(aiErr)) {
            console.warn("[handleFix] AI rewrite timed out, polling for update...");
            setActionStep("AI rewrite running (waiting)...");
            // Poll for update
            var origResults = await base44.entities.Chapter.filter({ id: chapterEntity.id });
            var origUpdated = origResults[0] ? origResults[0].updated_date : null;
            for (var poll = 0; poll < 30; poll++) {
              await new Promise(function(r) { setTimeout(r, 4000); });
              setActionStep("AI rewrite running (" + ((poll + 1) * 4) + "s)...");
              var polled = (await base44.entities.Chapter.filter({ id: chapterEntity.id }))[0];
              if (polled && polled.updated_date !== origUpdated) break;
            }
          } else {
            console.error("[handleFix] AI rewrite error:", aiErr.message);
          }
        }
      }

      // Final re-scan
      setActionStep("Re-scanning...");
      var finalFindings = await rescanAndUpdate();
      var issuesAfter = finalFindings ? finalFindings.reduce(function(s, f) { return s + f.count; }, 0) : issuesBefore;
      var delta = issuesBefore - issuesAfter;
      console.log("[handleFix] Done. Issues before:", issuesBefore, "after:", issuesAfter, "fixed:", delta);

      if (delta > 0) {
        setLastResult({ type: "fix", issuesBefore: issuesBefore, issuesAfter: issuesAfter, fixed: delta });
      } else {
        setLastResult({ type: "fix", issuesBefore: issuesBefore, issuesAfter: issuesAfter, fixed: 0, message: "No fixable issues found" });
      }
    } catch (err) {
      console.error("[handleFix] Error:", err);
      setLastResult({ type: "fix", error: err.message || "Unknown error" });
    } finally {
      setAction(null);
      setActionStep("");
    }
  }

  // POLISH PROSE — calls backend bot
  async function handlePolish() {
    var issuesBefore = totalInstances;
    setAction("polishing");
    setLastResult(null);
    setActionStep("Sending to prose polisher...");

    try {
      var response = await base44.functions.invoke("bot_prosePolisher", {
        project_id: projectId,
        chapter_id: chapterEntity.id,
      });
      var result = response.data;

      if (result && result.error) {
        setLastResult({ type: "polish", error: result.error });
        return;
      }

      if (result && result.changed) {
        var newFindings = await rescanAndUpdate();
        var issuesAfter = newFindings ? newFindings.reduce(function(s, f) { return s + f.count; }, 0) : issuesBefore;
        setLastResult({ type: "polish", issuesBefore: issuesBefore, issuesAfter: issuesAfter, fixed: issuesBefore - issuesAfter });
      } else {
        setLastResult({ type: "polish", issuesBefore: issuesBefore, issuesAfter: issuesBefore, fixed: 0, message: "No changes needed" });
      }
    } catch (err) {
      if (isTimeoutError(err)) {
        console.warn("Polish invoke timed out, polling...", err.message);
        setActionStep("Waiting for backend...");
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

  // REGENERATE — calls backend orchestrator
  async function handleRegenerate() {
    if (!window.confirm("Regenerate Chapter " + chapterNum + "? This will re-run the full write pipeline.")) return;
    var issuesBefore = totalInstances;
    setAction("regenerating");
    setLastResult(null);
    setActionStep("Resetting chapter...");

    try {
      await base44.entities.Chapter.update(chapterEntity.id, { status: "pending" });
      setActionStep("Running full write pipeline...");
      await base44.functions.invoke("bot_orchestrator", {
        action: "write_chapter",
        project_id: projectId,
        chapter_id: chapterEntity.id,
      });
      var newFindings = await rescanAndUpdate();
      var issuesAfter = newFindings ? newFindings.reduce(function(s, f) { return s + f.count; }, 0) : 0;
      setLastResult({ type: "regenerate", issuesBefore: issuesBefore, issuesAfter: issuesAfter });
    } catch (err) {
      if (isTimeoutError(err)) {
        console.warn("Regenerate timed out, polling...", err.message);
        setActionStep("Waiting for pipeline...");
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

  async function pollForUpdate(issuesBefore, actionType) {
    var results = await base44.entities.Chapter.filter({ id: chapterEntity.id });
    var current = results[0];
    var originalUpdated = current ? current.updated_date : null;

    for (var i = 0; i < 45; i++) {
      await new Promise(function(r) { setTimeout(r, 4000); });
      setActionStep("Waiting for backend... (" + (i * 4) + "s)");
      var updated = (await base44.entities.Chapter.filter({ id: chapterEntity.id }))[0];
      if (updated && updated.updated_date !== originalUpdated) {
        var newFindings = await rescanAndUpdate();
        var issuesAfter = newFindings ? newFindings.reduce(function(s, f) { return s + f.count; }, 0) : issuesBefore;
        setLastResult({ type: actionType, issuesBefore: issuesBefore, issuesAfter: issuesAfter, fixed: issuesBefore - issuesAfter });
        return;
      }
    }
    setLastResult({ type: actionType, error: "Timed out waiting for backend (3 min)" });
  }

  return (
    <div className={cn("rounded-xl border p-4 transition-all bg-white/40", statusColor)}>
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
            hasLeaks || hasDupes ? "bg-red-500 text-white" : hasTenseDrift ? "bg-amber-500 text-white" : chFindings.length > 0 ? "bg-slate-500 text-white" : "bg-emerald-500 text-white"
          )}>{chapterNum}</div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate max-w-[300px]" style={{ color: 'var(--ink)' }}>
              {(chapterEntity.title || "").replace(/^Chapter \d+:\s*/, "")}
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className={cn("text-xs", targetWords && words > targetWords * 1.3 ? "text-red-600 font-medium" : "")} style={!(targetWords && words > targetWords * 1.3) ? { color: 'var(--ink2)' } : {}}>
                {words.toLocaleString()} words
              </span>
              {isWorking ? (
                <span className="text-xs text-violet-600 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> {actionStep}
                </span>
              ) : chFindings.length > 0 ? (
                <span className="text-xs text-amber-700">{totalInstances} issue{totalInstances !== 1 ? "s" : ""}</span>
              ) : (
                <span className="text-xs text-emerald-700">✓ Clean</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastResult && !isWorking && (
            <ResultBadge result={lastResult} />
          )}
          {expanded ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--ink2)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--ink2)' }} />}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--nb-border)' }}>
          {(chFindings.length > 0 || (lastResult && lastResult.error)) && (
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
                  className="text-xs h-8 border-red-200 text-red-700 hover:bg-red-50 gap-1.5"
                  onClick={(e) => { e.stopPropagation(); handleRegenerate(); }}>
                  {action === "regenerating" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Regenerate
                </Button>
              )}
            </div>
          )}

          {lastResult && !isWorking && (
            <ResultDetail result={lastResult} />
          )}

          {chFindings.length > 0 && (
            <div className="space-y-2">
              {chFindings.map((f, i) => {
                const cat = SCAN_CATEGORIES[f.category];
                return (
                  <div key={i} className={cn("flex items-start gap-2 text-xs p-2 rounded-lg",
                    f.category === "instruction_leak" || f.category === "duplicate_paragraph" ? "bg-red-50" : "bg-white/50"
                  )}>
                    <span className="shrink-0 mt-0.5">{cat ? cat.icon : "•"}</span>
                    <div className="flex-1 min-w-0">
                      <span className={cn("font-medium",
                        f.category === "instruction_leak" || f.category === "duplicate_paragraph" ? "text-red-700" :
                        f.category === "tense_drift" ? "text-amber-700" : ""
                      )} style={!(f.category === "instruction_leak" || f.category === "duplicate_paragraph" || f.category === "tense_drift") ? { color: 'var(--ink)' } : {}}>{cat ? cat.label : f.category}:</span>{" "}
                      <span style={{ color: 'var(--ink2)' }}>{f.label} ({f.count}×)</span>
                      {f.samples && (
                        <div className="mt-1 space-y-1">
                          {f.samples.map((s, j) => (
                            <div key={j} className="pl-3 border-l-2 italic truncate max-w-full" style={{ borderColor: 'var(--nb-border)', color: 'var(--ink2)' }}>"{s}"</div>
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
            <p className="text-xs text-emerald-700/70 py-2">No issues detected in this chapter.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ResultBadge({ result }) {
  if (result.error) {
    return <Badge className="bg-red-100 text-red-700 border border-red-200 text-[10px]">Error</Badge>;
  }
  var delta = (result.issuesBefore || 0) - (result.issuesAfter || 0);
  if (delta > 0) {
    return <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px]">−{delta} issues</Badge>;
  }
  if (result.message) {
    return <Badge className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px]">{result.message}</Badge>;
  }
  return <Badge className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px]">No change</Badge>;
}

function ResultDetail({ result }) {
  if (result.error) {
    return (
      <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200">
        <p className="text-xs text-red-700"><AlertTriangle className="w-3 h-3 inline mr-1" />{result.error}</p>
      </div>
    );
  }
  var delta = (result.issuesBefore || 0) - (result.issuesAfter || 0);
  var label = result.type === "fix" ? "Auto-Fix" : result.type === "polish" ? "Prose Polisher" : "Regeneration";
  return (
    <div className={cn("mb-3 p-2.5 rounded-lg border", delta > 0 ? "bg-emerald-50 border-emerald-200" : "bg-white/50 border-[var(--nb-border)]")}>
      <div className="flex items-center gap-2 text-xs">
        <Check className={cn("w-3 h-3", delta > 0 ? "text-emerald-600" : "")} style={delta <= 0 ? { color: 'var(--ink2)' } : {}} />
        <span className={cn("font-medium", delta > 0 ? "text-emerald-700" : "")} style={delta <= 0 ? { color: 'var(--ink)' } : {}}>{label} complete</span>
        {delta > 0 ? (
          <span className="text-emerald-700/80">— {result.issuesBefore} → {result.issuesAfter} issues ({delta} fixed)</span>
        ) : (
          <span style={{ color: 'var(--ink2)' }}>— {result.message || "no change detected"}</span>
        )}
      </div>
    </div>
  );
}