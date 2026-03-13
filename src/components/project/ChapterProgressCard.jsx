import React, { useState, useEffect } from "react";

const STAGE_MESSAGES = [
  "Generating prose…",
  "Running quality scan…",
  "Applying corrections…",
  "Building state document…",
  "Finalizing chapter…",
];

// DISPLAY RULE: Chapter numbers shown in UI must ALWAYS come from
// chapter.chapter_number — never from loop index, array position,
// or queue order. These diverge whenever chapters are skipped,
// retried, or written out of order.

export default function ChapterProgressCard({ current, currentTitle, chapterWords, targetChapterWords, startTime, successes, chapterNumber }) {
  const [chapterElapsed, setChapterElapsed] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);

  // Track time since this chapter started (resets when `current` changes)
  useEffect(() => {
    const chapterStart = Date.now();
    setStageIdx(0);
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - chapterStart) / 1000);
      setChapterElapsed(elapsed);
      // Rotate stage messages every ~90 seconds
      setStageIdx(Math.min(Math.floor(elapsed / 90), STAGE_MESSAGES.length - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [current]);

  const mins = Math.floor(chapterElapsed / 60);
  const secs = chapterElapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  // If we have real word count data, show the bar; otherwise show stage-based progress
  const hasWordData = chapterWords > 0;
  const stagePercent = Math.min(((stageIdx + 1) / STAGE_MESSAGES.length) * 100, 95);

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="wac-pulse" />
          <span className="text-sm font-semibold text-slate-700">
            Writing Chapter {current + 1}
          </span>
        </div>
        <span className="text-xs font-medium text-slate-500">{timeStr}</span>
      </div>
      <p className="text-sm font-medium text-slate-900 truncate mb-1">{currentTitle}</p>
      
      {hasWordData ? (
        <>
          <div className="wac-chapter-bar-track">
            <div
              className="wac-chapter-bar-fill"
              style={{ width: `${Math.min((chapterWords / targetChapterWords) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {chapterWords.toLocaleString()} / ~{targetChapterWords.toLocaleString()} words
          </p>
        </>
      ) : (
        <>
          <div className="wac-chapter-bar-track">
            <div
              className="wac-chapter-bar-fill"
              style={{ width: `${stagePercent}%`, background: '#22c55e' }}
            />
          </div>
          <p className="text-xs text-green-700 mt-1 font-medium">
            {STAGE_MESSAGES[stageIdx]}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Each chapter typically takes 5–10 minutes
          </p>
        </>
      )}
    </div>
  );
}