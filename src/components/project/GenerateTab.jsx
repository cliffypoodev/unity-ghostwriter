import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, Sparkles, ChevronDown, ChevronRight, Copy, RefreshCw,
  Pencil, BookOpen, Users, Globe, ArrowRight, Check
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:    { label: "Pending",    className: "bg-slate-100 text-slate-600" },
  generating: { label: "Generating", className: "bg-yellow-100 text-yellow-700" },
  generated:  { label: "Generated",  className: "bg-emerald-100 text-emerald-700" },
  error:      { label: "Error",      className: "bg-red-100 text-red-600" },
};

const ROLE_COLORS = {
  protagonist: "bg-indigo-100 text-indigo-700",
  antagonist:  "bg-red-100 text-red-700",
  supporting:  "bg-amber-100 text-amber-700",
  minor:       "bg-slate-100 text-slate-600",
};

const THEME_COLORS = ["bg-violet-100 text-violet-700","bg-sky-100 text-sky-700","bg-emerald-100 text-emerald-700","bg-amber-100 text-amber-700","bg-pink-100 text-pink-700","bg-indigo-100 text-indigo-700"];

function safeParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

// ── Collapsible wrapper ───────────────────────────────────────────────────────

function CollapsibleCard({ title, icon: CardIcon, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <CardIcon className="w-4 h-4 text-indigo-500" />
            {title}
          </CardTitle>
          {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </CardHeader>
      {open && <CardContent className="pt-0 px-4 pb-4">{children}</CardContent>}
    </Card>
  );
}

// ── Outline display ───────────────────────────────────────────────────────────

function OutlineCard({ outlineData }) {
  const outline = safeParse(outlineData);
  if (!outline) return null;
  return (
    <CollapsibleCard title="Book Outline" icon={BookOpen}>
      {outline.title && <h3 className="font-semibold text-slate-800 mb-2">{outline.title}</h3>}
      {outline.narrative_arc && (
        <p className="text-sm text-slate-600 mb-3 leading-relaxed">{outline.narrative_arc}</p>
      )}
      {outline.themes?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {outline.themes.map((t, i) => (
            <span key={i} className={cn("text-xs px-2.5 py-1 rounded-full font-medium", THEME_COLORS[i % THEME_COLORS.length])}>{t}</span>
          ))}
        </div>
      )}
    </CollapsibleCard>
  );
}

// ── Story Bible display ───────────────────────────────────────────────────────

function StoryBibleCard({ storyBible }) {
  const bible = safeParse(storyBible);
  if (!bible) return null;
  return (
    <CollapsibleCard title="Story Bible" icon={Globe} defaultOpen={false}>
      <div className="space-y-4">
        {bible.world && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">World & Setting</p>
            <p className="text-sm text-slate-700 leading-relaxed">{bible.world}</p>
          </div>
        )}
        {bible.tone_voice && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Tone & Voice</p>
            <p className="text-sm text-slate-700">{bible.tone_voice}</p>
          </div>
        )}
        {bible.style_guidelines && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Style Guidelines</p>
            <p className="text-sm text-slate-700">{bible.style_guidelines}</p>
          </div>
        )}
        {bible.characters?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Characters</p>
            <div className="space-y-2">
              {bible.characters.map((char, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-slate-800">{char.name}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", ROLE_COLORS[char.role?.toLowerCase()] || ROLE_COLORS.minor)}>
                      {char.role}
                    </span>
                  </div>
                  {char.description && <p className="text-xs text-slate-600 mb-1">{char.description}</p>}
                  {char.arc && <p className="text-xs text-slate-500 italic">{char.arc}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        {bible.rules && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Rules</p>
            <p className="text-sm text-slate-700">{bible.rules}</p>
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
}

// ── Chapter item ──────────────────────────────────────────────────────────────

function useResolvedContent(rawContent) {
  const isUrl = rawContent && (rawContent.startsWith('http://') || rawContent.startsWith('https://'));
  const { data: fetched } = useQuery({
    queryKey: ["chapter_content", rawContent],
    enabled: !!isUrl,
    queryFn: () => fetch(rawContent).then(r => r.text()),
    staleTime: Infinity,
  });
  return isUrl ? (fetched || "") : (rawContent || "");
}

function ChapterItem({ chapter, onWrite, streamingContent, isStreaming }) {
  const [expanded, setExpanded] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptValue, setPromptValue] = useState(chapter.prompt || "");
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const resolvedContent = useResolvedContent(chapter.content);
  const content = isStreaming ? streamingContent : resolvedContent;
  const status = isStreaming ? "generating" : chapter.status;
  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const savePrompt = async () => {
    await base44.entities.Chapter.update(chapter.id, { prompt: promptValue });
    queryClient.invalidateQueries({ queryKey: ["chapters", chapter.project_id] });
    setEditingPrompt(false);
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 bg-white cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <button className="text-slate-400 flex-shrink-0" onClick={e => { e.stopPropagation(); setExpanded(e2 => !e2); }}>
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <span className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
          {chapter.chapter_number}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-800 truncate">{chapter.title}</span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", sc.className)}>{sc.label}</span>
            {chapter.word_count > 0 && (
              <span className="text-xs text-slate-400">{chapter.word_count.toLocaleString()} words</span>
            )}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {content && (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-slate-600" onClick={handleCopy}>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          )}
          <Button
            size="sm"
            className={cn("h-7 text-xs px-2.5", isStreaming ? "bg-yellow-500 hover:bg-yellow-600" : "bg-indigo-600 hover:bg-indigo-700")}
            disabled={isStreaming}
            onClick={() => onWrite(chapter)}
          >
            {isStreaming ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Writing…</> : <><RefreshCw className="w-3 h-3 mr-1" />{chapter.status === "generated" ? "Regenerate" : "Write"}</>}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-3">
          {chapter.summary && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Summary</p>
              <p className="text-sm text-slate-700 leading-relaxed">{chapter.summary}</p>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Writing Prompt</p>
              <Button size="sm" variant="ghost" className="h-6 text-xs text-slate-500 px-2" onClick={() => setEditingPrompt(e => !e)}>
                <Pencil className="w-3 h-3 mr-1" />{editingPrompt ? "Cancel" : "Edit"}
              </Button>
            </div>
            {editingPrompt ? (
              <div className="space-y-2">
                <Textarea className="text-xs font-mono" rows={4} value={promptValue} onChange={e => setPromptValue(e.target.value)} />
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-7 text-xs" onClick={savePrompt}>Save Prompt</Button>
              </div>
            ) : (
              <p className="text-sm text-slate-600 leading-relaxed">{chapter.prompt}</p>
            )}
          </div>
          {(content || isStreaming) && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Content</p>
              <div className="bg-white rounded-lg border border-slate-200 p-3 max-h-80 overflow-y-auto">
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{content}{isStreaming && <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-0.5 align-text-bottom" />}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main GenerateTab ──────────────────────────────────────────────────────────

export default function GenerateTab({ projectId, onProceed }) {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [streamingChapterId, setStreamingChapterId] = useState(null);
  const [streamingContent, setStreamingContent] = useState({});

  const { data: outlines = [] } = useQuery({
    queryKey: ["outline", projectId],
    queryFn: () => base44.entities.Outline.filter({ project_id: projectId }),
  });

  const { data: chapters = [], refetch: refetchChapters } = useQuery({
    queryKey: ["chapters", projectId],
    queryFn: () => base44.entities.Chapter.filter({ project_id: projectId }, "chapter_number"),
    refetchInterval: streamingChapterId ? 2000 : false,
  });

  const outline = outlines[0];
  const hasOutline = !!(outline?.outline_data || outline?.outline_url);

  // Fetch outline/story_bible from URL if inline data is empty
  const { data: outlineData } = useQuery({
    queryKey: ["outline_data", outline?.id],
    enabled: !!outline?.outline_url && !outline?.outline_data,
    queryFn: async () => {
      const res = await fetch(outline.outline_url);
      return res.text();
    },
  });
  const { data: storyBibleData } = useQuery({
    queryKey: ["story_bible_data", outline?.id],
    enabled: !!outline?.story_bible_url && !outline?.story_bible,
    queryFn: async () => {
      const res = await fetch(outline.story_bible_url);
      return res.text();
    },
  });

  const resolvedOutlineData = outline?.outline_data || outlineData;
  const resolvedStoryBible = outline?.story_bible || storyBibleData;

  const generatedCount = chapters.filter(c => c.status === "generated").length;
  const totalCount = chapters.length;
  const allGenerated = totalCount > 0 && generatedCount === totalCount;
  const progress = totalCount > 0 ? Math.round((generatedCount / totalCount) * 100) : 0;

  const handleGenerateOutline = async () => {
    setGenerating(true);
    await fetch(`/api/functions/generateOutline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ project_id: projectId }),
    });
    await queryClient.invalidateQueries({ queryKey: ["outline", projectId] });
    await queryClient.invalidateQueries({ queryKey: ["chapters", projectId] });
    setGenerating(false);
  };

  const handleWriteChapter = async (chapter) => {
    setStreamingChapterId(chapter.id);
    setStreamingContent(prev => ({ ...prev, [chapter.id]: "" }));

    // Update status optimistically
    queryClient.setQueryData(["chapters", projectId], old =>
      (old || []).map(c => c.id === chapter.id ? { ...c, status: "generating" } : c)
    );

    let streamFinished = false;
    
    try {
      console.log('Starting write for chapter:', chapter.id);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 min timeout
      
      // Get auth token from base44 SDK
      const authToken = base44.auth?.getToken?.();
      
      const res = await fetch(`/api/functions/writeChapter`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        body: JSON.stringify({ project_id: projectId, chapter_id: chapter.id }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        console.error('writeChapter response error:', res.status, errText);
        return;
      }

      if (!res.body) {
        console.error('writeChapter: no response body');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          streamFinished = true;
          console.log('Stream finished');
          break;
        }
        
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.text) {
                  setStreamingContent(prev => ({ ...prev, [chapter.id]: (prev[chapter.id] || "") + data.text }));
                }
                if (data.done || data.error) {
                  streamFinished = true;
                  break;
                }
              } catch (e) {
                console.warn('Failed to parse SSE data:', line, e);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('writeChapter error:', err.message);
    } finally {
      if (!streamFinished) {
        console.log('Stream did not finish properly, refetching');
      }
      setStreamingChapterId(null);
      await refetchChapters();
    }
  };

  // ── Empty state ──
  if (!hasOutline && !generating) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-indigo-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Generate Your Book Outline</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Claude will analyze your specifications and create a detailed chapter-by-chapter outline, complete with a story bible containing characters, world-building, and narrative guidelines.
          </p>
          <Button onClick={handleGenerateOutline} className="bg-indigo-600 hover:bg-indigo-700 px-6">
            <Sparkles className="w-4 h-4 mr-2" /> Generate Outline & Story Bible
          </Button>
        </div>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Generating your book outline and story bible…</p>
          <p className="text-sm text-slate-400 mt-1">This may take a minute</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600 font-medium">Progress: {generatedCount} / {totalCount} chapters generated</span>
            <span className="text-slate-400">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Outline & Story Bible */}
      <OutlineCard outlineData={resolvedOutlineData} />
      <StoryBibleCard storyBible={resolvedStoryBible} />

      {/* Regenerate outline button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleGenerateOutline} className="text-slate-500">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerate Outline
        </Button>
      </div>

      {/* Chapters */}
      {chapters.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-800 text-base">Chapters</h3>
          {chapters.map(chapter => (
            <ChapterItem
              key={chapter.id}
              chapter={chapter}
              onWrite={handleWriteChapter}
              streamingContent={streamingContent[chapter.id] || ""}
              isStreaming={streamingChapterId === chapter.id}
            />
          ))}
        </div>
      )}

      {/* Proceed button */}
      {allGenerated && (
        <div className="flex justify-end pt-2">
          <Button onClick={onProceed} className="bg-indigo-600 hover:bg-indigo-700 px-6">
            Proceed to Editor <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}