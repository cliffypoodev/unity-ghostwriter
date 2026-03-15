import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, FileText } from "lucide-react";

function safeParse(str) {
  try {
    if (!str || str.trim() === 'null' || str.trim() === '{}' || str.trim() === '') return null;
    return JSON.parse(str);
  } catch { return null; }
}

const ARGUMENT_FIELDS = [
  { key: "prior_chapter_endpoint", label: "PRIOR ENDPOINT", color: "text-slate-600 bg-slate-50 border-slate-300" },
  { key: "this_chapter_advances", label: "ADVANCES", color: "text-emerald-700 bg-emerald-50 border-emerald-300" },
  { key: "new_ground", label: "NEW GROUND", color: "text-green-700 bg-green-50 border-green-300" },
  { key: "handoff", label: "HANDOFF", color: "text-sky-700 bg-sky-50 border-sky-300" },
];

const BEAT_FIELDS = [
  { key: "opening_hook", label: "HOOK", color: "text-orange-700 bg-orange-50 border-orange-200" },
  { key: "context_block", label: "CONTEXT", color: "text-slate-700 bg-slate-50 border-slate-200" },
  { key: "central_evidence", label: "EVIDENCE", color: "text-blue-700 bg-blue-50 border-blue-200" },
  { key: "human_focus", label: "HUMAN FOCUS", color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  { key: "myth_vs_fact", label: "MYTH vs FACT", color: "text-amber-700 bg-amber-50 border-amber-200" },
  { key: "complication", label: "COMPLICATION", color: "text-red-700 bg-red-50 border-red-200" },
  { key: "implication", label: "IMPLICATION", color: "text-teal-700 bg-teal-50 border-teal-200" },
  { key: "closing_beat", label: "CLOSING BEAT", color: "text-violet-700 bg-violet-50 border-violet-200" },
];

function BeatRow({ field, value }) {
  if (!value) return null;
  const [labelColor, bgColor, borderColor] = field.color.split(' ');
  return (
    <div className={`flex gap-3 items-start border-l-2 ${borderColor} pl-3 py-1.5`}>
      <span className={`text-[10px] font-bold uppercase tracking-wider ${labelColor} w-24 shrink-0 pt-0.5`}>
        {field.label}
      </span>
      <span className="text-xs text-slate-700 leading-relaxed flex-1">{value}</span>
    </div>
  );
}

export default function NonfictionBeatSection({ chapter, onScenesUpdated }) {
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Nonfiction beat sheet is stored in the `scenes` field as JSON
  const beatSheet = safeParse(chapter.scenes);
  const hasBeatSheet = beatSheet && beatSheet.opening_hook;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await base44.functions.invoke('generateScenes', {
        projectId: chapter.project_id,
        chapterNumber: chapter.chapter_number,
      });
      // Poll until beat sheet appears
      let polls = 0;
      while (polls < 30) {
        await new Promise(r => setTimeout(r, 2000));
        polls++;
        const updated = await base44.entities.Chapter.filter({ project_id: chapter.project_id });
        const updCh = updated.find(c => c.id === chapter.id);
        const parsed = safeParse(updCh?.scenes);
        if (parsed?.opening_hook) break;
      }
      if (onScenesUpdated) onScenesUpdated();
    } catch (err) {
      console.error('generateNonfictionBeat error:', err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    setGenerating(true);
    try {
      await base44.entities.Chapter.update(chapter.id, { scenes: null });
      await handleGenerate();
    } catch (err) {
      console.error('regenerateNonfictionBeat error:', err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (!hasBeatSheet) {
    return (
      <div className="border-t border-dashed border-slate-200 pt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400 italic">No nonfiction beat sheet yet. Generate to structure this chapter.</p>
        <Button
          size="sm"
          className="h-7 text-xs bg-teal-600 hover:bg-teal-700 flex-shrink-0"
          disabled={generating}
          onClick={handleGenerate}
        >
          {generating
            ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Generating…</>
            : <><FileText className="w-3 h-3 mr-1" />Generate Beat Sheet</>}
        </Button>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-100 pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nonfiction Beat Sheet</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[11px] px-2 border-teal-200 text-teal-600 hover:bg-teal-50"
            disabled={generating}
            onClick={handleRegenerate}
          >
            {generating
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <><RefreshCw className="w-3 h-3 mr-1" />Regenerate</>}
          </Button>
          <button
            className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? <><ChevronDown className="w-3 h-3" />Collapse</> : <><ChevronRight className="w-3 h-3" />Expand</>}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-1 bg-white rounded-lg border border-slate-200 p-3">
          {/* Argument Progression */}
          {beatSheet.argument_progression && (
            <div className="mb-2 pb-2 border-b border-slate-100">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Argument Progression</p>
              {ARGUMENT_FIELDS.map(field => (
                <BeatRow key={field.key} field={field} value={beatSheet.argument_progression?.[field.key]} />
              ))}
              {beatSheet.argument_progression?.new_ground?.includes('[RESTRUCTURE NEEDED') && (
                <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-700 font-medium">This chapter lacks distinct new ground and may overlap with another chapter. Revise the chapter concept before generating prose.</p>
                </div>
              )}
            </div>
          )}
          {BEAT_FIELDS.map(field => (
            <BeatRow key={field.key} field={field} value={beatSheet[field.key]} />
          ))}
          {beatSheet.word_target && (
            <div className="pt-1 text-[10px] text-slate-400 text-right">
              Target: ~{beatSheet.word_target} words
            </div>
          )}
          {beatSheet.fabrication_warnings?.length > 0 && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5" />
                Fabrication Warnings
              </div>
              {beatSheet.fabrication_warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-600 pl-5">• {w}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}