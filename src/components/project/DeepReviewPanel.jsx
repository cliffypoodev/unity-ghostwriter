import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Loader2, Shield, AlertTriangle, Check, ChevronDown, ChevronUp,
  Eye, Zap
} from "lucide-react";

function severityBadge(severity) {
  if (severity === "critical") return "bg-red-500/20 text-red-400 border-red-500/30";
  if (severity === "warning") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-blue-500/20 text-blue-400 border-blue-500/30";
}

function ViolationItem({ v, index, onDismiss, onFix, fixing }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className={cn("rounded-lg border p-3", v.severity === "critical" ? "border-red-500/30 bg-red-500/5" : "border-slate-700 bg-slate-800/40")}>
      <div className="flex items-start gap-2 cursor-pointer" onClick={() => setOpen(!open)}>
        <Badge className={cn("text-[10px] border shrink-0 mt-0.5", severityBadge(v.severity))}>
          {v.severity || "info"}
        </Badge>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-200">{v.description || v.label || "Unnamed issue"}</p>
          {v.character && <p className="text-xs text-slate-500 mt-0.5">Character: {v.character}</p>}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
      </div>
      {open && (
        <div className="mt-2 pt-2 border-t border-slate-700 space-y-2">
          {v.location && (
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Location</span>
              <p className="text-xs text-slate-400 italic mt-0.5">"{v.location}"</p>
            </div>
          )}
          {v.suggested_fix && (
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Suggestion</span>
              <p className="text-xs text-slate-300 mt-0.5">{v.suggested_fix}</p>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={(e) => { e.stopPropagation(); onFix && onFix(v); }}
              disabled={fixing}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-50"
            >
              {fixing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              Fix This
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setDismissed(true); onDismiss && onDismiss(v); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            >
              Dismiss — Intentional
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DeepReviewPanel({ projectId, chapters, specs }) {
  const [reviewing, setReviewing] = useState(false);
  const [reviewProgress, setReviewProgress] = useState("");
  const [results, setResults] = useState(null);
  const [fixing, setFixing] = useState({});
  const [dismissedAll, setDismissedAll] = useState(false);
  const [dismissedFlags, setDismissedFlags] = useState(new Set());

  const spec = specs?.[0] || null;
  const isNonfiction = spec?.book_type === "nonfiction";
  const isHistoricalOrInvestigative = isNonfiction && /history|investigat|true.crime|biography|memoir/i.test((spec?.genre || "") + " " + (spec?.subgenre || "") + " " + (spec?.nf_structure_mode || ""));

  const generatedChapters = chapters.filter(c => c.status === "generated").sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

  const handleDeepReview = async () => {
    if (generatedChapters.length === 0) return;
    setReviewing(true);
    setResults(null);

    const allResults = [];

    for (let i = 0; i < generatedChapters.length; i++) {
      const ch = generatedChapters[i];
      setReviewProgress(`Reviewing Ch ${ch.chapter_number}: ${ch.title || ""} (${i + 1}/${generatedChapters.length})`);

      // Resolve content if URL
      let content = ch.content || "";
      if (content.startsWith("http")) {
        try { content = await (await fetch(content)).text(); } catch { content = ""; }
      }
      if (!content || content.length < 100) {
        allResults.push({ chapterNumber: ch.chapter_number, title: ch.title, violations: [], error: "No content" });
        continue;
      }

      try {
        // Run consistency check
        const checkResult = await base44.functions.invoke("consistencyCheck", {
          project_id: projectId,
          chapter_id: ch.id,
          chapter_text: content.slice(0, 6000),
        });

        const data = checkResult?.data || checkResult;
        const flags = (data?.flags || []).map(f => ({
          type: "continuity",
          severity: "critical",
          description: f.contradiction,
          location: f.chapter_sentence?.slice(0, 100),
          suggested_fix: f.bible_reference ? `Conflicts with: ${f.bible_reference}` : null,
          character: null,
        }));

        allResults.push({
          chapterNumber: ch.chapter_number,
          title: ch.title,
          violations: flags,
          result: data?.result || "CLEAR",
        });
      } catch (err) {
        allResults.push({
          chapterNumber: ch.chapter_number,
          title: ch.title,
          violations: [],
          error: err.message,
        });
      }

      // Brief delay between calls
      if (i < generatedChapters.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    setResults(allResults);
    setReviewProgress("");
    setReviewing(false);
  };

  const handleFixViolation = async (chapterNumber, violation) => {
    const ch = generatedChapters.find(c => c.chapter_number === chapterNumber);
    if (!ch) return;
    const key = `${chapterNumber}-${violation.description?.slice(0, 30)}`;
    setFixing(prev => ({ ...prev, [key]: true }));
    try {
      await base44.functions.invoke("bot_styleEnforcer", {
        project_id: projectId,
        chapter_id: ch.id,
      }, { timeout: 180000 });
      // Mark as dismissed after fix attempt
      setDismissedFlags(prev => new Set([...prev, key]));
    } catch (err) {
      console.error("Fix failed:", err.message);
    } finally {
      setFixing(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleDismissViolation = (chapterNumber, violation) => {
    const key = `${chapterNumber}-${violation.description?.slice(0, 30)}`;
    setDismissedFlags(prev => new Set([...prev, key]));
  };

  const handleDismissAllTimeline = () => {
    setDismissedAll(true);
  };

  const totalViolations = results ? results.reduce((sum, r) => sum + r.violations.length, 0) : 0;
  const criticalCount = results ? results.reduce((sum, r) => sum + r.violations.filter(v => v.severity === "critical").length, 0) : 0;
  const cleanCount = results ? results.filter(r => r.violations.length === 0 && !r.error).length : 0;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-slate-200">Deep Continuity Review</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleDeepReview}
            disabled={reviewing || generatedChapters.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 gap-2 text-xs h-8"
          >
            {reviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
            {reviewing ? "Reviewing…" : results ? "Re-Run Review" : "Run Deep Review"}
          </Button>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Checks every chapter against the Story Bible for character contradictions, timeline violations, location errors, and name inconsistencies.
      </p>

      {isHistoricalOrInvestigative && results && totalViolations > 0 && !dismissedAll && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-amber-300 font-medium">Historical/Investigative nonfiction detected</p>
              <p className="text-xs text-amber-400/70 mt-1">
                This book covers multiple time periods by design. Timeline flags comparing historical chapters (1940s, 1950s, etc.) against the Story Bible's final chapter position are likely intentional, not errors.
              </p>
              <button
                onClick={handleDismissAllTimeline}
                className="mt-2 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white transition-colors"
              >
                Dismiss All Timeline Flags — Intentional Structure
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewing && (
        <div className="flex items-center gap-3 py-4">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          <p className="text-sm text-slate-300">{reviewProgress}</p>
        </div>
      )}

      {results && !reviewing && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex gap-3 flex-wrap">
            <div className={cn("px-3 py-2 rounded-lg text-center", totalViolations === 0 ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-red-500/10 border border-red-500/30")}>
              <p className={cn("text-lg font-bold", totalViolations === 0 ? "text-emerald-400" : "text-red-400")}>{totalViolations}</p>
              <p className="text-[10px] text-slate-500 uppercase">Issues</p>
            </div>
            {criticalCount > 0 && (
              <div className="px-3 py-2 rounded-lg text-center bg-red-500/10 border border-red-500/30">
                <p className="text-lg font-bold text-red-400">{criticalCount}</p>
                <p className="text-[10px] text-slate-500 uppercase">Critical</p>
              </div>
            )}
            <div className="px-3 py-2 rounded-lg text-center bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-lg font-bold text-emerald-400">{cleanCount}</p>
              <p className="text-[10px] text-slate-500 uppercase">Clean</p>
            </div>
          </div>

          {/* Per-chapter results */}
          {results.map(r => (
            <div key={r.chapterNumber} className={cn(
              "rounded-lg border p-3",
              r.error ? "border-amber-500/30 bg-amber-500/5" :
              r.violations.length > 0 ? "border-red-500/30 bg-red-500/5" :
              "border-emerald-500/30 bg-emerald-500/5"
            )}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-200">Ch {r.chapterNumber}: {r.title || ""}</span>
                {r.error ? (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">Error</Badge>
                ) : r.violations.length === 0 ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                    <Check className="w-3 h-3 mr-1" /> Clear
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">
                    <AlertTriangle className="w-3 h-3 mr-1" /> {r.violations.length} flag{r.violations.length !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              {r.error && <p className="text-xs text-amber-400">{r.error}</p>}
              {r.violations.length > 0 && !dismissedAll && (
                <div className="mt-2 space-y-2">
                  {r.violations.map((v, i) => {
                    const key = `${r.chapterNumber}-${v.description?.slice(0, 30)}`;
                    if (dismissedFlags.has(key)) return null;
                    return (
                      <ViolationItem
                        key={i}
                        v={v}
                        index={i}
                        onFix={(violation) => handleFixViolation(r.chapterNumber, violation)}
                        onDismiss={(violation) => handleDismissViolation(r.chapterNumber, violation)}
                        fixing={!!fixing[key]}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}