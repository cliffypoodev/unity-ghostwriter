import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ArrowRight, AlertTriangle } from "lucide-react";
import ChapterProgressCard from "./ChapterProgressCard";

const TARGET_WORDS_PER_CHAPTER = {
  short: 3750,
  medium: 3750,
  long: 4166,
  epic: 4375,
};

function formatTime(ms) {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}m ${secs}s`;
}

export default function WriteAllChaptersModal({
  isOpen,
  onClose,
  onProceed,
  progress,
  onStop,
  targetLength = "medium",
}) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [estRemaining, setEstRemaining] = useState(null);
  const [showErrors, setShowErrors] = useState(false);

  const {
    current,
    total,
    currentTitle,
    successes,
    failures,
    startTime,
    done,
    wordsWritten = 0,
    chapterWords = 0,
    error = null,
    phaseLabel = null,
    paused = false,
    pausedAt = null,
    chapterNumber = null,
  } = progress;

  const targetChapterWords = TARGET_WORDS_PER_CHAPTER[targetLength] || 3750;

  const queueIndex = progress.queueIndex ?? current;
  const overallPercent =
    total > 0
      ? Math.min(((queueIndex + Math.min(chapterWords / targetChapterWords, 1)) / total) * 100, 100)
      : 0;

  const displayPercent = done ? 100 : Math.round(overallPercent);

  // Live elapsed timer
  useEffect(() => {
    if (!isOpen || done || !startTime) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setElapsedMs(elapsed);
      if (overallPercent > 2) {
        setEstRemaining((elapsed / overallPercent) * (100 - overallPercent));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, done, startTime, overallPercent]);

  // Freeze elapsed at done time
  useEffect(() => {
    if (done && startTime) {
      setElapsedMs(Date.now() - startTime);
    }
  }, [done]);

  const elapsedTime = formatTime(elapsedMs);
  const remainingTime =
    done ? "—" :
    estRemaining != null && estRemaining > 0
      ? formatTime(estRemaining)
      : "calculating...";

  const totalWordsDisplay = (wordsWritten + (done ? 0 : chapterWords)).toLocaleString();

  return (
    <Dialog open={isOpen} onOpenChange={done ? onClose : undefined}>
      <DialogContent className="max-w-[540px] p-8">
        <style>{`
          .wac-pct {
            font-size: 52px;
            font-weight: 700;
            text-align: center;
            background: linear-gradient(135deg, #7c3aed, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            line-height: 1.1;
          }
          .wac-bar-track {
            height: 12px;
            background: #e5e7eb;
            border-radius: 6px;
            overflow: hidden;
          }
          .wac-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #7c3aed, #3b82f6);
            border-radius: 6px;
            transition: width 0.3s ease;
          }
          .wac-pulse {
            width: 8px;
            height: 8px;
            background: #22c55e;
            border-radius: 50%;
            display: inline-block;
            flex-shrink: 0;
            animation: wac-pulse-anim 1.5s ease-in-out infinite;
          }
          @keyframes wac-pulse-anim {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.3); }
          }
          .wac-chapter-bar-track {
            height: 6px;
            background: #d1fae5;
            border-radius: 3px;
            overflow: hidden;
            margin: 6px 0 4px;
          }
          .wac-chapter-bar-fill {
            height: 100%;
            background: #22c55e;
            border-radius: 3px;
            transition: width 0.3s ease;
          }
        `}</style>

        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">
            {done ? (paused ? "Writing Paused" : "Book Complete! 🎉") : "Writing Your Book..."}
          </DialogTitle>
          {phaseLabel && !done && (
            <p className="text-sm font-semibold text-indigo-600 mt-1">{phaseLabel}</p>
          )}
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Large percentage */}
          <div className="text-center">
            <div className="wac-pct">{displayPercent}%</div>
            {!done && (
              <p className="text-sm text-slate-400 mt-1">In progress — do not close this window</p>
            )}
          </div>

          {/* Main progress bar */}
          <div className="wac-bar-track">
            <div className="wac-bar-fill" style={{ width: `${displayPercent}%` }} />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Chapter", value: `${Math.min(queueIndex + (done ? 0 : 1), total)} / ${total}` },
              { label: "Words", value: totalWordsDisplay },
              { label: "Elapsed", value: elapsedTime },
              { label: "Est. Left", value: remainingTime },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center">
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</span>
                <span className="block text-base font-bold text-slate-800 leading-tight">{value}</span>
              </div>
            ))}
          </div>

          {/* Current chapter — shown while writing */}
          {!done && currentTitle && (
            <ChapterProgressCard
              current={current}
              currentTitle={currentTitle}
              chapterWords={chapterWords}
              targetChapterWords={targetChapterWords}
              startTime={startTime}
              successes={successes}
              chapterNumber={chapterNumber}
            />
          )}

          {/* ISSUE 6 FIX: Error display during generation */}
          {!done && error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-red-900 mb-2">Error during generation:</p>
              <p className="text-sm text-red-700 mb-2">{error}</p>
              <button
                onClick={() => setShowErrors(!showErrors)}
                className="text-xs text-red-600 hover:text-red-700 underline"
              >
                {showErrors ? 'Hide' : 'View'} full error details
              </button>
            </div>
          )}

          {/* Done state */}
          {done && (
            <div className="space-y-3">
              {paused ? (
                <div className="text-center py-3 px-4 rounded-xl font-semibold text-amber-800 text-base"
                  style={{ background: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "1px solid #fcd34d" }}>
                  <AlertTriangle className="w-5 h-5 inline-block mr-2 -mt-0.5" />
                  Paused at Chapter {pausedAt} — {successes} of {total} written ({(wordsWritten).toLocaleString()} words)
                </div>
              ) : (
                <div className="text-center py-3 px-4 rounded-xl font-semibold text-green-800 text-base"
                  style={{ background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)", border: "1px solid #bbf7d0" }}>
                  All done! {(wordsWritten).toLocaleString()} words in {elapsedTime}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-100 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <div>
                    <span className="text-sm font-bold text-green-900">{successes} succeeded</span>
                  </div>
                </div>
                {failures?.length > 0 && (
                  <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <div>
                      <span className="text-sm font-bold text-red-900">{failures.length} failed</span>
                    </div>
                  </div>
                )}
              </div>

              {failures?.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <p className="text-xs font-semibold text-red-800 mb-1.5">
                    {paused ? "Blocked chapters:" : `Failed chapters (${failures.length}):`}
                  </p>
                  <ul className="space-y-1">
                    {failures.map((f, idx) => (
                      <li key={idx} className="text-xs text-red-700">
                        • Ch {f.number}: {f.title} — {f.error}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-red-600 mt-2">
                    {paused
                      ? "Fix the failed chapter, then click 'Write All' again to resume from where it stopped."
                      : "You can regenerate failed chapters individually after closing this dialog."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {!done && (
            <Button variant="outline" onClick={onStop} className="text-slate-600">
              Stop After Current Chapter
            </Button>
          )}
          {done && (
            <>
              <Button variant="outline" onClick={onClose}>Close</Button>
              {onProceed && (
                <Button onClick={() => { onClose(); onProceed(); }} className="bg-indigo-600 hover:bg-indigo-700">
                  Proceed to Editor <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}