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
  if (severity === "critical") return "bg-red-100 text-red-700 border-red-200";
  if (severity === "warning") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-blue-100 text-blue-700 border-blue-200";
}

function ViolationItem({ v, index, onDismiss, onFix, fixing }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className={cn("rounded-lg border p-3", v.severity === "critical" ? "border-red-200 bg-red-50" : "border-[#e8e8ec] bg-[#fafafa]")}>
      <div className="flex items-start gap-2 cursor-pointer" onClick={() => setOpen(!open)}>
        <Badge className={cn("text-[10px] border shrink-0 mt-0.5", severityBadge(v.severity))}>
          {v.severity || "info"}
        </Badge>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#18171f]">{v.description || v.label || "Unnamed issue"}</p>
          {v.character && <p className="text-xs mt-0.5 text-[#9997b0]">Character: {v.character}</p>}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 shrink-0 text-[#9997b0]" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[#9997b0]" />}
      </div>
      {open && (
        <div className="mt-2 pt-2 border-t border-[#e8e8ec] space-y-2">
          {v.location && (
            <div>
              <span className="text-[10px] uppercase font-semibold text-[#9997b0]">Location</span>
              <p className="text-xs italic mt-0.5 text-[#9997b0]">"{v.location}"</p>
            </div>
          )}
          {v.suggested_fix && (
            <div>
              <span className="text-[10px] uppercase font-semibold text-[#9997b0]">Suggestion</span>
              <p className="text-xs mt-0.5 text-[#18171f]">{v.suggested_fix}</p>
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
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-100 hover:bg-slate-200 text-[#9997b0] transition-colors"
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
      // Use targeted rewrite (lightweight) instead of full style enforcer (times out)
      await base44.functions.invoke("bot_targetedRewrite", {
        project_id: projectId,
        chapter_id: ch.id,
        findings: [{
          category: "instruction_leak",
          label: violation.description || "Continuity issue",
          count: 1,
        }],
      });
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
    <div className="p1-card"><div className="p1-card-body space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#5b50f0]" />
          <h3 className="text-sm font-semibold text-[#18171f]">Deep Continuity Review</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleDeepReview}
            disabled={reviewing || generatedChapters.length === 0}
            className="bg-[#5b50f0] hover:bg-[#4a40d0] gap-2 text-xs h-8"
          >
            {reviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
            {reviewing ? "Reviewing…" : results ? "Re-Run Review" : "Run Deep Review"}
          </Button>
        </div>
      </div>

      <p className="text-xs text-[#9997b0]">
        Checks every chapter against the Story Bible for character contradictions, timeline violations, location errors, and name inconsistencies.
      </p>

      {isHistoricalOrInvestigative && results && totalViolations > 0 && !dismissedAll && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-amber-800 font-medium">Historical/Investigative nonfiction detected</p>
              <p className="text-xs text-amber-700/70 mt-1">
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
          <Loader2 className="w-4 h-4 animate-spin text-[#5b50f0]" />
          <p className="text-sm text-[#18171f]">{reviewProgress}</p>
        </div>
      )}

      {results && !reviewing && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex gap-3 flex-wrap">
            <div className={cn("px-3 py-2 rounded-lg text-center", totalViolations === 0 ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200")}>
              <p className={cn("text-lg font-bold", totalViolations === 0 ? "text-emerald-700" : "text-red-600")}>{totalViolations}</p>
              <p className="text-[10px] uppercase text-[#9997b0]">Issues</p>
            </div>
            {criticalCount > 0 && (
              <div className="px-3 py-2 rounded-lg text-center bg-red-50 border border-red-200">
                <p className="text-lg font-bold text-red-600">{criticalCount}</p>
                <p className="text-[10px] uppercase text-[#9997b0]">Critical</p>
              </div>
            )}
            <div className="px-3 py-2 rounded-lg text-center bg-emerald-50 border border-emerald-200">
              <p className="text-lg font-bold text-emerald-700">{cleanCount}</p>
              <p className="text-[10px] uppercase text-[#9997b0]">Clean</p>
            </div>
          </div>

          {/* Per-chapter results */}
          {results.map(r => (
            <div key={r.chapterNumber} className={cn(
              "rounded-lg border p-3",
              r.error ? "border-amber-200 bg-amber-50" :
              r.violations.length > 0 ? "border-red-200 bg-red-50" :
              "border-emerald-200 bg-emerald-50"
            )}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-[#18171f]">Ch {r.chapterNumber}: {r.title || ""}</span>
                {r.error ? (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Error</Badge>
                ) : r.violations.length === 0 ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                    <Check className="w-3 h-3 mr-1" /> Clear
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">
                    <AlertTriangle className="w-3 h-3 mr-1" /> {r.violations.length} flag{r.violations.length !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              {r.error && <p className="text-xs text-amber-700">{r.error}</p>}
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
    </div>
  );
}