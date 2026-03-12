import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Zap, Pencil, X } from "lucide-react";

const INTIMACY_KEYWORDS = /\b(kiss|touch|bond|ceremony|restraint|submit|naked|bed|intimate|seduc|strip|undress|caress|thrust|moan|climax|orgasm|arousal|erotic|lust|desire|passion|embrace|skin\s+against|bare|uncloth|pleasure|sensual|carnal)\b/i;

function autoPlaceExplicitTags(outlineData) {
  if (!outlineData?.chapters) return outlineData;
  const updated = { ...outlineData, chapters: outlineData.chapters.map(ch => {
    const text = ((ch.summary || '') + ' ' + (ch.prompt || '') + ' ' + (ch.title || '')).toLowerCase();
    if (INTIMACY_KEYWORDS.test(text) && !/\[EXPLICIT\]/i.test(text)) {
      return { ...ch, summary: `[EXPLICIT]\n${ch.summary || ''}\n[/EXPLICIT]` };
    }
    return ch;
  })};
  return updated;
}

function countExplicitTags(outlineData) {
  if (!outlineData?.chapters) return 0;
  return outlineData.chapters.filter(ch => {
    const text = ((ch.summary || '') + ' ' + (ch.prompt || '')).toLowerCase();
    return /\[explicit\]/.test(text);
  }).length;
}

function getTaggedChapterNumbers(outlineData) {
  if (!outlineData?.chapters) return [];
  return outlineData.chapters
    .filter(ch => /\[explicit\]/i.test((ch.summary || '') + ' ' + (ch.prompt || '')))
    .map(ch => ch.number || ch.chapter_number);
}

export default function ExplicitTagsWarning({ outlineData, outlineRaw, outline, projectId, onResolved }) {
  const [placing, setPlacing] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (!outlineData) return null;

  const tagCount = countExplicitTags(outlineData);
  const hasExplicitTags = tagCount > 0;

  // No tags at all — critical warning
  if (!hasExplicitTags) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">No [EXPLICIT] tags found in beat sheet</p>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              This is an Erotica project but the outline contains no [EXPLICIT]...[/EXPLICIT] tags. 
              Without these tags, explicit scenes will not be routed to the appropriate content model 
              and may be generated at reduced intensity.
            </p>
          </div>
          <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {previewData ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-amber-700">Preview — tags will be added to these chapters:</p>
            <div className="bg-white rounded-lg border border-amber-200 p-3 max-h-48 overflow-y-auto space-y-1">
              {previewData.chapters.filter(ch => /\[EXPLICIT\]/i.test((ch.summary || '') + ' ' + (ch.prompt || ''))).map(ch => (
                <div key={ch.number || ch.chapter_number} className="text-xs text-slate-700">
                  <span className="font-semibold text-indigo-600">Ch {ch.number || ch.chapter_number}:</span> {ch.title}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs"
                disabled={placing}
                onClick={async () => {
                  setPlacing(true);
                  try {
                    const updatedStr = JSON.stringify(previewData);
                    if (updatedStr.length > 15000 && outline?.outline_url) {
                      const file = new File([updatedStr], 'outline.json', { type: 'application/json' });
                      const { file_url } = await base44.integrations.Core.UploadFile({ file });
                      await base44.entities.Outline.update(outline.id, { outline_url: file_url, outline_data: '' });
                    } else {
                      await base44.entities.Outline.update(outline.id, { outline_data: updatedStr });
                    }
                    if (onResolved) onResolved();
                    setPreviewData(null);
                    setDismissed(true);
                  } catch (err) {
                    console.error('Failed to save explicit tags:', err.message);
                  } finally {
                    setPlacing(false);
                  }
                }}
              >
                <Zap className="w-3 h-3 mr-1" />Confirm & Save Tags
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setPreviewData(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs"
              onClick={() => {
                const placed = autoPlaceExplicitTags(outlineData);
                setPreviewData(placed);
              }}
            >
              <Zap className="w-3 h-3 mr-1" />Auto-place tags based on content
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs border-amber-300 text-amber-700" onClick={() => setDismissed(true)}>
              <Pencil className="w-3 h-3 mr-1" />Place tags manually
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs text-slate-500" onClick={() => setDismissed(true)}>
              Skip — keep SFW
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Has tags but very few — soft warning
  if (tagCount < 2) {
    return (
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3">
        <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0" />
        <p className="text-xs text-slate-600 flex-1">
          Only {tagCount} [EXPLICIT]-tagged scene(s) across all chapters. Consider whether additional scenes should be tagged for full genre delivery.
        </p>
        <button onClick={() => setDismissed(true)} className="text-slate-400 hover:text-slate-600 shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return null;
}

export { countExplicitTags, autoPlaceExplicitTags };