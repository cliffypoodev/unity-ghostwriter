import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Check, RefreshCw, Save } from "lucide-react";

export default function RewriteInVoiceModal({ isOpen, onClose, chapter, spec, project }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedText, setSelectedText] = useState("");
  const [styleSample, setStyleSample] = useState(project?.style_sample || "");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [rewrittenText, setRewrittenText] = useState("");
  const [loading, setLoading] = useState(false);
  const [replacing, setReplacing] = useState(false);
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
    try {
      const res = await base44.functions.invoke('rewriteInVoice', {
        selected_text: selectedText,
        style_sample: styleSample,
        genre: spec?.genre || '',
        beat_style: spec?.beat_style || spec?.tone_style || '',
        chapter_number: chapter?.chapter_number,
        project_id: project?.id,
        save_as_default: saveAsDefault,
      });
      setRewrittenText(res.data.rewritten_text);
      setStep(3);
    } catch (err) {
      console.error('Rewrite error:', err);
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
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Rewrite in My Voice</DialogTitle>
        </DialogHeader>

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
              <Button size="sm" className="mt-2 bg-indigo-600 hover:bg-indigo-700" onClick={handleCapture}>
                Use This Selection
              </Button>
              {selectedText && (
                <div className="mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded-md">
                  <p className="text-xs font-semibold text-indigo-700 mb-1">Selected:</p>
                  <p className="text-xs text-slate-700 italic line-clamp-3">{selectedText}</p>
                </div>
              )}
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
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              disabled={!selectedText.trim() || !styleSample.trim() || loading}
              onClick={() => { setStep(2); handleRewrite(); }}
            >
              Rewrite This Passage
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
            <p className="text-sm text-slate-600 font-medium">Rewriting in your voice...</p>
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
              <Label className="text-sm font-medium text-indigo-600">Your Rewrite</Label>
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-md text-sm text-slate-800 leading-relaxed max-h-48 overflow-y-auto">
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