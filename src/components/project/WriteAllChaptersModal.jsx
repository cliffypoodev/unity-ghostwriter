import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

export default function WriteAllChaptersModal({ isOpen, onClose, progress, onStop }) {
  const { current, total, currentTitle, successes, failures, done, elapsed } = progress;
  const progressPercent = total > 0 ? (current / total) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Writing All Chapters</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">
                {done ? "Complete!" : `Chapter ${current} of ${total}`}
              </span>
              <span className="text-sm font-mono text-slate-500">
                {Math.round(progressPercent)}%
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Current chapter being written */}
          {!done && (
            <div className="flex items-center gap-3 bg-indigo-50 rounded-lg p-3">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500">Writing:</p>
                <p className="text-sm font-semibold text-slate-900 truncate">{currentTitle}</p>
              </div>
            </div>
          )}

          {/* Completion summary */}
          {done && (
            <div className="space-y-3">
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Writing complete!</p>
                    <p className="text-xs text-emerald-700 mt-1">
                      {successes} successful, {failures.length} failed • {elapsed}
                    </p>
                  </div>
                </div>
              </div>

              {/* Results summary */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-900">{successes}</span>
                  </div>
                  <p className="text-xs text-emerald-700 mt-1">Success</p>
                </div>
                {failures.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span className="text-sm font-semibold text-red-900">{failures.length}</span>
                    </div>
                    <p className="text-xs text-red-700 mt-1">Failed</p>
                  </div>
                )}
              </div>

              {/* Failed chapters list */}
              {failures.length > 0 && (
                <div className="bg-red-50 rounded-lg p-3 border border-red-100 max-h-48 overflow-y-auto">
                  <p className="text-xs font-semibold text-red-900 mb-2">Failed Chapters:</p>
                  <ul className="space-y-1">
                    {failures.map((f, idx) => (
                      <li key={idx} className="text-xs text-red-700">
                        • Ch {f.number}: {f.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {!done && (
            <Button variant="outline" onClick={onStop} className="text-slate-600">
              Stop After Current
            </Button>
          )}
          {done && (
            <Button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}