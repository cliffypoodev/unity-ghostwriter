import React from "react";
import { Progress } from "@/components/ui/progress";

const TARGET_WORDS = {
  short: 37500,
  medium: 75000,
  long: 125000,
  epic: 175000,
};

export default function ProjectWordCount({ chapters, targetLength }) {
  const generatedChapters = chapters.filter(c => c.status === "generated" && c.content && c.content.trim() !== '');
  const totalWords = generatedChapters.reduce((sum, c) => sum + (c.word_count || 0), 0);
  const target = TARGET_WORDS[targetLength] || TARGET_WORDS.medium;
  const completedCount = generatedChapters.length;
  const totalCount = chapters.length;
  const chapterProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Chapter progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-600 font-medium">
            Chapters: {completedCount} of {totalCount} complete
          </span>
          <span className="text-slate-400 text-xs">{chapterProgress}%</span>
        </div>
        <Progress value={chapterProgress} className="h-2 [&>div]:bg-slate-400" />
      </div>

      {/* Word count */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Total: ~{totalWords.toLocaleString()} words</span>
        <span>Target: {target.toLocaleString()}</span>
      </div>
    </div>
  );
}