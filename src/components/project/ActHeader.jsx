import React from "react";
import { cn } from "@/lib/utils";
import { Check, Loader2, Circle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

const ACT_COLORS = {
  1: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", badge: "bg-blue-100 text-blue-700", progress: "bg-blue-500" },
  2: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-700", progress: "bg-amber-500" },
  3: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", badge: "bg-rose-100 text-rose-700", progress: "bg-rose-500" },
};

const STATUS_LABELS = {
  complete: "Complete",
  partial: "In Progress",
  generating: "Writing…",
  pending: "Not Started",
  empty: "No Chapters",
};

export default function ActHeader({ actNumber, act, status, chapterCount, generatedCount, onWriteAct, isWriting, hasBridge, disabled }) {
  if (!act) return null;
  const colors = ACT_COLORS[actNumber] || ACT_COLORS[1];
  const progress = chapterCount > 0 ? Math.round((generatedCount / chapterCount) * 100) : 0;

  return (
    <div className={cn("rounded-xl border p-3 flex items-center gap-3 flex-wrap", colors.bg, colors.border)}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", colors.badge)}>
          ACT {actNumber}
        </span>
        <span className={cn("text-sm font-semibold truncate", colors.text)}>
          {act.label}
        </span>
        <span className="text-xs text-slate-400">
          Ch {act.start}–{act.end} · {generatedCount}/{chapterCount}
        </span>
        {status === 'complete' && <Check className="w-4 h-4 text-emerald-500" />}
        {status === 'generating' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Mini progress bar */}
        <div className="w-20 h-1.5 bg-white/70 rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", colors.progress)} style={{ width: `${progress}%` }} />
        </div>
        
        {/* Bridge indicator */}
        {actNumber > 1 && (
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
            hasBridge ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
          )}>
            {hasBridge ? "Bridge ✓" : "No Bridge"}
          </span>
        )}

        {/* Write Act button */}
        {status !== 'complete' && (
          <Button
            size="sm"
            className={cn("h-7 text-xs px-3", 
              actNumber === 1 ? "bg-blue-600 hover:bg-blue-700" :
              actNumber === 2 ? "bg-amber-600 hover:bg-amber-700" :
              "bg-rose-600 hover:bg-rose-700",
              "text-white"
            )}
            disabled={disabled || isWriting}
            onClick={() => onWriteAct(actNumber)}
          >
            {isWriting ? (
              <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Writing…</>
            ) : (
              <><Play className="w-3 h-3 mr-1" />Write Act {actNumber}</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}