import React from "react";
import { cn } from "@/lib/utils";
import { Check, Loader2, Play, RotateCcw, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const ACT_THEMES = {
  1: {
    complete: { bg: "bg-green-50", border: "border-green-200", fill: "bg-green-500" },
    active:   { bg: "bg-blue-50",  border: "border-blue-200",  fill: "bg-blue-500" },
    locked:   { bg: "bg-slate-50", border: "border-slate-200", fill: "bg-slate-300" },
    badge: "bg-blue-100 text-blue-700",
    btn: "bg-blue-600 hover:bg-blue-700",
  },
  2: {
    complete: { bg: "bg-green-50", border: "border-green-200", fill: "bg-green-500" },
    active:   { bg: "bg-amber-50", border: "border-amber-200", fill: "bg-amber-500" },
    locked:   { bg: "bg-slate-50", border: "border-slate-200", fill: "bg-slate-300" },
    badge: "bg-amber-100 text-amber-700",
    btn: "bg-amber-600 hover:bg-amber-700",
  },
  3: {
    complete: { bg: "bg-green-50", border: "border-green-200", fill: "bg-green-500" },
    active:   { bg: "bg-rose-50",  border: "border-rose-200",  fill: "bg-rose-500" },
    locked:   { bg: "bg-slate-50", border: "border-slate-200", fill: "bg-slate-300" },
    badge: "bg-rose-100 text-rose-700",
    btn: "bg-rose-600 hover:bg-rose-700",
  },
};

export default function ActHeader({ actNumber, act, status, chapterCount, generatedCount, onWriteAct, isWriting, disabled, prevActComplete }) {
  if (!act) return null;

  const theme = ACT_THEMES[actNumber] || ACT_THEMES[1];
  const isComplete = generatedCount === chapterCount && chapterCount > 0;
  const isLocked = disabled;
  const remaining = chapterCount - generatedCount;
  const progress = chapterCount > 0 ? Math.round((generatedCount / chapterCount) * 100) : 0;

  const state = isComplete ? "complete" : isLocked ? "locked" : "active";
  const colors = theme[state];

  return (
    <div className={cn("rounded-xl border p-4 space-y-2.5", colors.bg, colors.border, isLocked && "opacity-60")}>
      {/* Header row — badge, title, progress text, icons */}
      <div className="flex items-center gap-2.5">
        <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full tracking-wide shrink-0 uppercase", theme.badge)}>
          Act {actNumber}
        </span>
        <span className="text-[15px] font-semibold text-slate-800 flex-1 min-w-0 truncate sm:whitespace-nowrap leading-tight" style={{ WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'normal' }}>
          {act.label}
        </span>
        <span className="text-xs text-slate-500 shrink-0 whitespace-nowrap">
          Ch {act.start}–{act.end} · {generatedCount}/{chapterCount}
        </span>
        {isLocked && <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
        {isComplete && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
        {status === 'generating' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />}
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-black/5 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", colors.fill)}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Act dependency notice */}
      {actNumber > 1 && !prevActComplete && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-slate-50 border-slate-200 text-slate-500 text-[13px]">
          <span className="font-bold text-sm shrink-0">🔒</span>
          <span>Complete Act {actNumber - 1} first</span>
        </div>
      )}

      {/* Action button — full width */}
      {isComplete ? (
        <Button size="sm" variant="outline" className="w-full h-9 text-xs border-emerald-300 text-emerald-700" disabled>
          <Check className="w-3.5 h-3.5 mr-1.5" /> Act {actNumber} Complete
        </Button>
      ) : (
        <Button
          className={cn("w-full h-10 text-sm font-semibold text-white", theme.btn)}
          disabled={isLocked || isWriting}
          onClick={() => onWriteAct(actNumber)}
        >
          {isWriting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Writing…</>
          ) : generatedCount === 0 ? (
            <><Play className="w-4 h-4 mr-2" />Write Act {actNumber}</>
          ) : (
            <><RotateCcw className="w-4 h-4 mr-2" />Resume Act {actNumber} ({remaining} remaining)</>
          )}
        </Button>
      )}
    </div>
  );
}