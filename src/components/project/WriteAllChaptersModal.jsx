import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

export default function WriteAllChaptersModal({ isOpen, onClose, progress, onStop }) {
  const { current, total, currentTitle, successes, failures, done, elapsed } = progress;
  const progressPercent = total > 0 ? (current / total) * 100 : 0;

  return (
    <Dialog open={isOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Writing All Chapters</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Main progress bar */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-700">
                {isComplete ? "Complete!" : `Chapter ${currentChapter} of ${totalChapters}`}
              </span>
              <span className="text-sm font-mono text-slate-500">
                {Math.round(progressPercent)}%
              </span>
            </div>
            <Progress value={progressPercent} className="h-3" />
          </div>

          {/* Timing info */}
          {!isComplete && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Elapsed</div>
                <div className="font-mono font-semibold text-slate-900">{formatTime(elapsedTime)}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Est. Remaining</div>
                <div className="font-mono font-semibold text-slate-900">{formatTime(estimatedRemaining)}</div>
              </div>
            </div>
          )}

          {/* Completion summary */}
          {isComplete && (
            <div className="space-y-3">
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">All chapters written!</p>
                    <p className="text-xs text-emerald-700 mt-1">
                      Completed in {formatTime(totalTimeSeconds)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Results summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-900">{successCount} Success</span>
                  </div>
                </div>
                {failCount > 0 && (
                  <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span className="text-sm font-semibold text-red-900">{failCount} Failed</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Failed chapters list */}
              {failCount > 0 && results && (
                <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                  <p className="text-xs font-semibold text-red-900 mb-2">Failed Chapters:</p>
                  <ul className="space-y-1">
                    {results
                      .filter(r => !r.success)
                      .map((r, idx) => (
                        <li key={idx} className="text-xs text-red-700">
                          • Chapter {r.chapterNumber}: {r.message}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Loading indicator */}
          {!isComplete && (
            <div className="flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}