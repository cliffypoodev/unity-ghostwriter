// MODAL ISOLATION RULE:
// This modal performs a single-purpose AI call via rewriteInVoice backend function.
// NEVER call from modals: resolveModel, enforceProseCompliance, getTopRepeatedWords,
// generateChapterWithCompliance, verifyExplicitTags, prepareChapterGeneration.

import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const REWRITE_MODES = [
  { id: 'voice',       label: 'Author Voice',    desc: 'Rewrite in your style sample' },
  { id: 'tighten',     label: 'Tighten',         desc: 'Cut 20-30%, sharpen every line' },
  { id: 'expand',      label: 'Expand',          desc: 'Add depth and texture, +30%' },
  { id: 'tension',     label: 'Add Tension',     desc: 'Sharpen rhythm and forward pull' },
  { id: 'dialogue',    label: 'Fix Dialogue',    desc: 'More natural, character-specific' },
  { id: 'description', label: 'Fix Description', desc: 'Specific sensory detail over generic' },
  { id: 'emotion',     label: 'Deepen Emotion',  desc: 'Show feeling through behavior' },
];

export default function RewriteInVoiceModal({ isOpen, onClose, chapter, spec, project }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedText, setSelectedText] = useState("");
  const [styleSample, setStyleSample] = useState(project?.style_sample || "");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [rewrittenText, setRewrittenText] = useState("");
  const [loading, setLoading] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [mode, setMode] = useState('voice');
  const [error, setError] = useState("");
  const textAreaRef = useRef(null);

  useEffect(() => {
    if (isOpen && project?.style_sample) {
      setStyleSample(project.style_sample);
    }
  }, [isOpen, project?.style_sample]);

  const resolvedContent = useRef("");

  useEffect(() => {
    if (!isOpen || !chapter?.content) return;
    const content = chapter.content;
    if (content.startsWith('http://') || content.startsWith('https://')) {
      fetch(content).then(r => r.text()).then(t => { resolvedContent.current = t; });
    } else {
      resolvedContent.current = content;
    }
  }, [isOpen, chapter?.content]);

  const handleCapture = () => {
    const ta = textAreaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) return;
    const text = resolvedContent.current.substring(start, end);
    setSelectedText(text);
  };

  const handleRewrite = async () => {
    if (!selectedText.trim() || !styleSample.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke('rewriteInVoice', {
        selected_text: selectedText,
        style_sample: styleSample,
        genre: spec?.genre || '',
        beat_style: spec?.beat_style || spec?.tone_style || '',
        chapter_number: chapter?.chapter_number || '',
        project_id: project?.id || '',
        save_as_default: saveAsDefault,
        mode,
      });
      if (res.data?.rewritten_text) {
        setRewrittenText(res.data.rewritten_text);
        setStep(3);
      } else {
        setError(res.data?.error || 'No rewritten text returned');
        setStep(1);
      }
    } catch (err) {
      console.error('Rewrite error:', err);
      setError(err?.response?.data?.error || err.message || 'Rewrite failed');
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const handleReplace = async () => {
    if (!rewrittenText || !selectedText) return;
    setReplacing(true);
    try {
      let content = resolvedContent.current;
      content = content.replace(selectedText, rewrittenText);

      let contentValue = content;
      if (content.length > 15000) {
        const f = new File([content], `chapter_${chapter.id}.txt`, { type: 'text/plain' });
        const up = await base44.integrations.Core.UploadFile({ file: f });
        if (up?.file_url) contentValue = up.file_url;
      }

      const wc = content.trim().split(/\s+/).length;
      await base44.entities.Chapter.update(chapter.id, { content: contentValue, word_count: wc });
      queryClient.invalidateQueries({ queryKey: ["chapters", chapter.project_id] });
      onClose();
    } catch (err) {
      console.error('Replace error:', err);
    } finally {
      setReplacing(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setSelectedText("");
    setRewrittenText("");
    setError("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Rewrite in My Voice</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Select a passage, choose a rewrite mode, and let AI match your writing style.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Select Passage to Rewrite</Label>
              <p className="text-xs text-slate-500 mb-2">Highlight the passage you want rewritten, then click "Use This Selection"</p>
              <Textarea
                ref={textAreaRef}
                readOnly
                className="font-serif text-sm leading-relaxed h-48 resize-none"
                value={resolvedContent.current}
              />
              <Button size="sm" className="mt-2 bg-[#5b50f0] hover:bg-[#4a40d0]" onClick={handleCapture}>
                Use This Selection
              </Button>
              {selectedText && (
                <div className="mt-2 p-2 bg-violet-50 border border-violet-200 rounded-md">
                  <p className="text-xs font-semibold text-[#5b50f0] mb-1">Selected:</p>
                  <p className="text-xs text-slate-700 italic line-clamp-3">{selectedText}</p>
                </div>
              )}
            </div>

            {/* Rewrite Mode Selector */}
            <div>
              <Label className="text-sm font-medium">Rewrite Mode</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-1.5">
                {REWRITE_MODES.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={cn(
                      "text-left p-2 rounded-md border text-xs transition-colors",
                      mode === m.id
                        ? "border-violet-400 bg-violet-50 text-[#5b50f0]"
                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                    )}
                  >
                    <div className="font-medium">{m.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Paste Your Writing Sample</Label>
              <p className="text-xs text-slate-500 mb-2">Paste 100-300 words written in your own voice. This is how your rewrite will sound.</p>
              <Textarea
                className="text-sm h-32"
                placeholder="Paste a paragraph or two of your own writing here — from a previous book, a journal entry, anything you've written yourself..."
                value={styleSample}
                onChange={e => setStyleSample(e.target.value)}
              />
              <label className="flex items-center gap-2 mt-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveAsDefault}
                  onChange={e => setSaveAsDefault(e.target.checked)}
                  className="rounded"
                />
                Save as default style sample for this project
              </label>
            </div>

            <Button
              className="w-full bg-[#5b50f0] hover:bg-[#4a40d0]"
              disabled={!selectedText.trim() || !styleSample.trim() || loading}
              onClick={() => { setStep(2); handleRewrite(); }}
            >
              Rewrite This Passage
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#5b50f0] mb-4" />
            <p className="text-sm text-slate-600 font-medium">Rewriting in your voice...</p>
            <p className="text-xs text-slate-400 mt-1">Mode: {REWRITE_MODES.find(m => m.id === mode)?.label || 'Author Voice'}</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-500">Original</Label>
              <div className="p-3 bg-slate-50 rounded-md border text-sm text-slate-600 leading-relaxed max-h-32 overflow-y-auto">
                {selectedText}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-[#5b50f0]">Your Rewrite ({REWRITE_MODES.find(m => m.id === mode)?.label})</Label>
              <div className="p-3 bg-violet-50 border border-violet-200 rounded-md text-sm text-slate-800 leading-relaxed max-h-48 overflow-y-auto">
                {rewrittenText}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={replacing}
                onClick={handleReplace}
              >
                {replacing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                Replace in Chapter
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={loading}
                onClick={() => { setStep(2); handleRewrite(); }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}