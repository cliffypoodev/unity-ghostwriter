import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronDown, ChevronRight, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ConsistencyFlagsBanner({ chapter, onEditChapter }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  let flags = [];
  try {
    if (chapter.consistency_flags) {
      flags = JSON.parse(chapter.consistency_flags);
    }
  } catch { return null; }

  const activeFlags = flags.filter(f => !f.dismissed);
  if (activeFlags.length === 0) return null;

  const handleDismiss = async (index) => {
    const updated = [...flags];
    // Find the actual index in the full array
    let realIndex = -1;
    let activeCount = 0;
    for (let i = 0; i < updated.length; i++) {
      if (!updated[i].dismissed) {
        if (activeCount === index) { realIndex = i; break; }
        activeCount++;
      }
    }
    if (realIndex >= 0) {
      updated[realIndex].dismissed = true;
      await base44.entities.Chapter.update(chapter.id, {
        consistency_flags: JSON.stringify(updated),
      });
      queryClient.invalidateQueries({ queryKey: ["chapters", chapter.project_id] });
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-amber-100/50 transition-colors"
      >
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <span className="text-xs font-semibold text-amber-800 flex-1">
          Continuity Flags Detected — {activeFlags.length} issue{activeFlags.length !== 1 ? 's' : ''} found
        </span>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-amber-500" /> : <ChevronRight className="w-3.5 h-3.5 text-amber-500" />}
      </button>

      {expanded && (
        <div className="border-t border-amber-200 px-3 py-2 space-y-2">
          {activeFlags.map((flag, i) => (
            <div key={i} className="bg-white rounded-md border border-amber-100 p-2.5 text-xs space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-amber-900 font-medium leading-snug">{flag.contradiction}</p>
                <div className="flex gap-1 flex-shrink-0">
                  {onEditChapter && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-indigo-600 hover:bg-indigo-50"
                      onClick={() => onEditChapter(flag.chapter_sentence)}
                    >
                      <Pencil className="w-3 h-3 mr-1" />Fix
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] text-slate-500 hover:bg-slate-100"
                    onClick={() => handleDismiss(i)}
                  >
                    <X className="w-3 h-3 mr-1" />Ignore
                  </Button>
                </div>
              </div>
              {flag.chapter_sentence && (
                <p className="text-slate-600">
                  <span className="font-semibold text-slate-500">Chapter: </span>
                  <span className="italic">"{flag.chapter_sentence}"</span>
                </p>
              )}
              {flag.bible_reference && (
                <p className="text-slate-500">
                  <span className="font-semibold">Ref: </span>{flag.bible_reference}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}