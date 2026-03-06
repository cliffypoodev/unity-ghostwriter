import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";

const TARGET_WORDS_PER_CHAPTER = {
  short: 3750,
  medium: 3750,
  long: 4166,
  epic: 4375,
};

function ShimmerBar({ value }) {
  return (
    <div className="w-full">
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .shimmer-fill {
          animation: shimmer 2s infinite;
          background: linear-gradient(90deg, var(--primary), #818cf8);
          position: relative;
          overflow: hidden;
        }
        .shimmer-fill::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          right: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          animation: shimmer 2s infinite;
        }
      `}</style>
      <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="shimmer-fill h-full transition-all duration-300 ease-out rounded-full"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

function PulsingDot() {
  return (
    <div className="relative">
      <style>{`
        @keyframes pulse-scale {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        .pulsing-dot {
          animation: pulse-scale 1.5s ease-in-out infinite;
        }
      `}</style>
      <div className="w-2 h-2 bg-blue-500 rounded-full pulsing-dot" />
    </div>
  );
}

function formatTime(ms) {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}m ${secs}s`;
}

export default function WriteAllChaptersModal({
  isOpen,
  onClose,
  progress,
  onStop,
  targetLength = "medium",
}) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [estRemaining, setEstRemaining] = useState(null);

  const {
    current,
    total,
    currentTitle,
    successes,
    failures,
    startTime,
    done,
    wordsWritten = 0,
    totalWords = 0,
    chapterWords = 0,
    targetChapterWords = TARGET_WORDS_PER_CHAPTER[targetLength],
  } = progress;

  // Calculate target total words
  const targetTotalWords = total * targetChapterWords;

  // Calculate overall percentage
  const overallPercent =
    total > 0
      ? ((current + (chapterWords / targetChapterWords)) / total) * 100
      : 0;

  // Timer for elapsed time
  useEffect(() => {
    if (!isOpen || done || !startTime) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setElapsedMs(elapsed);

      // Calculate estimated remaining
      if (overallPercent > 2) {
        const estRemain = (elapsed / overallPercent) * (100 - overallPercent);
        setEstRemaining(estRemain);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, done, startTime, overallPercent]);

  const elapsedTime = formatTime(elapsedMs);
  const remainingTime =
    estRemaining !== null && estRemaining > 0
      ? formatTime(estRemaining)
      : "calculating...";

  const displayPercent = Math.min(Math.round(overallPercent), 100);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Writing All Chapters</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Large percentage display */}
          <div className="text-center">
            <div className="text-5xl font-bold text-slate-900 mb-1">
              {displayPercent}%
            </div>
            {!done && <p className="text-sm text-slate-500">In progress...</p>}
          </div>

          {/* Main progress bar */}
          {!done && <ShimmerBar value={overallPercent} />}

          {/* Stats row */}
          {!done && (
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-slate-100 rounded-lg p-3 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Chapter
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {current + 1}/{total}
                </p>
              </div>
              <div className="bg-slate-100 rounded-lg p-3 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Words
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {(wordsWritten + chapterWords).toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-100 rounded-lg p-3 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Elapsed
                </p>
                <p className="text-lg font-bold text-slate-900">{elapsedTime}</p>
              </div>
              <div className="bg-slate-100 rounded-lg p-3 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Est. Remaining
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {remainingTime}
                </p>
              </div>
            </div>
          )}

          {/* Current chapter section */}
          {!done && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <PulsingDot />
                <p className="text-sm font-semibold text-slate-700">
                  Writing Chapter {current + 1}
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-900 mb-3 truncate">
                {currentTitle}
              </p>
              <div className="space-y-1.5">
                <div className="h-1.5 bg-blue-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300 ease-out rounded-full"
                    style={{
                      width: `${Math.min(
                        (chapterWords / targetChapterWords) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-600">
                  {chapterWords.toLocaleString()} / ~{targetChapterWords.toLocaleString()} words
                </p>
              </div>
            </div>
          )}

          {/* Completion summary */}
          {done && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-900">
                      Writing complete!
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      {(wordsWritten + chapterWords).toLocaleString()} total words •{" "}
                      {elapsedTime} elapsed
                    </p>
                  </div>
                </div>
              </div>

              {/* Results summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-900">
                      {successes}
                    </span>
                  </div>
                  <p className="text-xs text-green-700 mt-1">Success</p>
                </div>
                {failures.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span className="text-sm font-semibold text-red-900">
                        {failures.length}
                      </span>
                    </div>
                    <p className="text-xs text-red-700 mt-1">Failed</p>
                  </div>
                )}
              </div>

              {/* Failed chapters list */}
              {failures.length > 0 && (
                <div className="bg-red-50 rounded-lg p-3 border border-red-100 max-h-48 overflow-y-auto">
                  <p className="text-xs font-semibold text-red-900 mb-2">
                    Failed Chapters:
                  </p>
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
            <Button
              variant="outline"
              onClick={onStop}
              className="text-slate-600"
            >
              Stop After Current
            </Button>
          )}
          {done && (
            <Button
              onClick={onClose}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}