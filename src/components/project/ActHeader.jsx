import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Loader2, Play, RotateCcw, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const ACT_COLORS = {
  1: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", badge: "bg-blue-100 text-blue-700", progress: "bg-blue-500", btn: "bg-blue-600 hover:bg-blue-700", bridgeBg: "bg-blue-50 text-blue-700 border-blue-200" },
  2: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-700", progress: "bg-amber-500", btn: "bg-amber-600 hover:bg-amber-700", bridgeBg: "bg-amber-50 text-amber-700 border-amber-200" },
  3: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", badge: "bg-rose-100 text-rose-700", progress: "bg-rose-500", btn: "bg-rose-600 hover:bg-rose-700", bridgeBg: "bg-rose-50 text-rose-700 border-rose-200" },
};

export default function ActHeader({ actNumber, act, status, chapterCount, generatedCount, onWriteAct, onGenerateBridge, isWriting, hasBridge, disabled, prevActComplete }) {
  if (!act) return null;
  const colors = ACT_COLORS[actNumber] || ACT_COLORS[1];
  const progress = chapterCount > 0 ? Math.round((generatedCount / chapterCount) * 100) : 0;
  const isComplete = generatedCount === chapterCount && chapterCount > 0;
  const remaining = chapterCount - generatedCount;
  const isLocked = disabled;

  return (
    <div className={cn("rounded-xl border p-4 space-y-3", colors.bg, colors.border, isLocked && "opacity-60")}>
      {/* Header row */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full", colors.badge)}>
          ACT {actNumber}
        </span>
        <span className={cn("text-sm font-semibold flex-1 min-w-0 truncate", colors.text)}>
          {act.label}
        </span>
        <span className="text-xs text-slate-500">
          Chapters {act.start}–{act.end} · {generatedCount}/{chapterCount} complete
        </span>
        {isLocked && <Lock className="w-3.5 h-3.5 text-slate-400" />}
        {isComplete && <Check className="w-4 h-4 text-emerald-500" />}
        {status === 'generating' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-white/70 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", colors.progress)}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Bridge status for Acts 2 and 3 */}
      {actNumber > 1 && (
        <div className={cn("text-xs px-3 py-1.5 rounded-lg border flex items-center gap-2 flex-wrap relative z-10", hasBridge
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : prevActComplete
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : "bg-slate-50 text-slate-500 border-slate-200"
        )}>
          <span className="flex-1">
            {hasBridge
              ? `✓ Continuity bridge ready — Act ${actNumber - 1} context loaded`
              : prevActComplete
                ? `⚡ Act ${actNumber - 1} complete — generate bridge for better continuity, or start writing`
                : `⚠ Complete Act ${actNumber - 1} to unlock continuity bridge`
            }
          </span>
          {!hasBridge && prevActComplete && onGenerateBridge && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[11px] px-2.5 border-indigo-300 text-indigo-700 hover:bg-indigo-50 shrink-0"
              onClick={(e) => { e.stopPropagation(); onGenerateBridge(actNumber - 1); }}
            >
              <Sparkles className="w-3 h-3 mr-1" /> Generate Bridge
            </Button>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Write / Resume / Complete button */}
        {isComplete ? (
          <Button size="sm" variant="outline" className="h-8 text-xs px-4 border-emerald-300 text-emerald-700" disabled>
            <Check className="w-3.5 h-3.5 mr-1.5" /> Act {actNumber} Complete
          </Button>
        ) : (
          <Button
            size="sm"
            className={cn("h-8 text-xs px-4 text-white", colors.btn)}
            disabled={isLocked || isWriting}
            onClick={() => onWriteAct(actNumber)}
          >
            {isWriting ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Writing…</>
            ) : generatedCount === 0 ? (
              <><Play className="w-3.5 h-3.5 mr-1.5" />Write Act {actNumber}</>
            ) : (
              <><RotateCcw className="w-3.5 h-3.5 mr-1.5" />Resume Act {actNumber} ({remaining} remaining)</>
            )}
          </Button>
        )}

        {/* Generate bridge button — appears when act is complete and no bridge yet */}
        {isComplete && actNumber < 3 && !hasBridge && onGenerateBridge && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs px-3 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            onClick={() => onGenerateBridge(actNumber)}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate Act {actNumber} Bridge
          </Button>
        )}
      </div>
    </div>
  );
}