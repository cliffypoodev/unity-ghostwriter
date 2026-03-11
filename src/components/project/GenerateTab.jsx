import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, Sparkles, ChevronDown, ChevronRight, Copy, RefreshCw,
  Pencil, BookOpen, Users, Globe, ArrowRight, Check, Zap, LayoutGrid
} from "lucide-react";
import { cn } from "@/lib/utils";
import WriteAllChaptersModal from "./WriteAllChaptersModal";
import SpecSettingsSummary from "./SpecSettingsSummary";
import SceneSection from "./SceneSection";
import BeatBadge from "./BeatBadge";

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
  
  // Prevent scroll when expanding
  const handleToggle = () => {
    const scrollPos = window.scrollY;
    setOpen(o => !o);
    setTimeout(() => window.scrollTo(0, scrollPos), 0);
  };
  
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="py-3 px-4 cursor-pointer" onClick={handleToggle}>
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

// ── Book Metadata card ────────────────────────────────────────────────────────

const KEYWORD_COLORS = [
  "bg-violet-100 text-violet-700", "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700",
  "bg-pink-100 text-pink-700", "bg-indigo-100 text-indigo-700",
  "bg-rose-100 text-rose-700",
];

function BookMetadataCard({ metadataRaw }) {
  const meta = safeParse(metadataRaw);
  if (!meta) return null;
  return (
    <CollapsibleCard title="Book Metadata — Publishing Details" icon={BookOpen} defaultOpen={false}>
      <div className="space-y-4">
        {meta.title && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Title</p>
            <p className="font-bold text-slate-900 leading-tight" style={{ fontSize: "18px" }}>{meta.title}</p>
          </div>
        )}
        {meta.subtitle && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Subtitle</p>
            <p className="text-sm text-slate-700 italic">{meta.subtitle}</p>
          </div>
        )}
        {meta.description && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Book Description</p>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{meta.description}</p>
          </div>
        )}
        {meta.keywords?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Keywords</p>
            <div className="flex flex-wrap gap-1.5">
              {meta.keywords.map((kw, i) => (
                <span key={i} className={cn("text-xs px-2.5 py-1 rounded-full font-medium", KEYWORD_COLORS[i % KEYWORD_COLORS.length])}>
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
}

// ── Outline display ───────────────────────────────────────────────────────────

function OutlineCard({ outlineData }) {
  const outline = safeParse(outlineData);
  if (!outline) return null;
  return (
    <CollapsibleCard title={`Book Outline — ${outline.title || "Untitled"}`} icon={BookOpen} defaultOpen={false}>
      <div className="space-y-4">
        {outline.narrative_arc && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Narrative Arc</p>
            <p className="text-sm text-slate-700 leading-relaxed">{outline.narrative_arc}</p>
          </div>
        )}
        {outline.themes && outline.themes.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Themes</p>
            <div className="flex gap-2 flex-wrap">
              {outline.themes.map((t, i) => (
                <span key={i} className={cn("text-xs px-2.5 py-1 rounded-full font-medium", THEME_COLORS[i % THEME_COLORS.length])}>{t}</span>
              ))}
            </div>
          </div>
        )}
        {outline.chapters && outline.chapters.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Chapter Overview</p>
            <div className="space-y-2">
              {outline.chapters.map((ch, i) => (
                <div key={i} className="text-sm p-2 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-800">Ch {ch.number}: {ch.title}</p>
                    {ch.beat_function && <BeatBadge beatFunction={ch.beat_function} beatName={ch.beat_name} />}
                  </div>
                  {ch.summary && <p className="text-xs text-slate-600 mt-1 opacity-80">{ch.summary}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        {!outline.narrative_arc && (!outline.themes || outline.themes.length === 0) && (!outline.chapters || outline.chapters.length === 0) && (
          <p className="text-sm text-slate-500">Outline data is available but contains no displayable summary fields.</p>
        )}
      </div>
    </CollapsibleCard>
  );
}

// ── Story Bible display ───────────────────────────────────────────────────────

function toStr(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.map(toStr).join(', ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function StoryBibleCard({ storyBible }) {
  const bible = safeParse(storyBible);
  if (!bible) return null;

  const fields = [
    { key: 'world', label: 'World & Setting' },
    { key: 'setting', label: 'Setting' },
    { key: 'tone_voice', label: 'Tone & Voice' },
    { key: 'tone', label: 'Tone' },
    { key: 'style_guidelines', label: 'Style Guidelines' },
    { key: 'atmosphere', label: 'Atmosphere' },
    { key: 'geography', label: 'Geography' },
    { key: 'magic_system', label: 'Magic System' },
    { key: 'technology', label: 'Technology' },
    { key: 'society', label: 'Society' },
    { key: 'history', label: 'History' },
  ];

  return (
    <CollapsibleCard title="Story Bible" icon={Globe} defaultOpen={false}>
      <div className="space-y-4">
        {fields.map(({ key, label }) => {
          const val = bible[key];
          if (!val) return null;
          const text = toStr(val);
          if (!text) return null;
          return (
            <div key={key}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
              <p className="text-sm text-slate-700 leading-relaxed">{text}</p>
            </div>
          );
        })}

        {bible.characters?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Characters</p>
            <div className="space-y-2">
              {bible.characters.map((char, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-slate-800">{toStr(char.name)}</span>
                    {char.role && (
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", ROLE_COLORS[toStr(char.role).toLowerCase()] || ROLE_COLORS.minor)}>
                        {toStr(char.role)}
                      </span>
                    )}
                  </div>
                  {char.description && <p className="text-xs text-slate-600 mb-1">{toStr(char.description)}</p>}
                  {char.arc && <p className="text-xs text-slate-500 italic">{toStr(char.arc)}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {bible.rules && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Consistency Rules</p>
            {Array.isArray(bible.rules)
              ? <ul className="list-disc list-inside space-y-1">{bible.rules.map((r, i) => <li key={i} className="text-sm text-slate-700">{toStr(r)}</li>)}</ul>
              : <p className="text-sm text-slate-700">{toStr(bible.rules)}</p>
            }
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

function ChapterItem({ chapter, spec, onWrite, onRewrite, streamingContent, isStreaming, isWriting, chapterProgress, onScenesUpdated, beatData }) {
  const [expanded, setExpanded] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptValue, setPromptValue] = useState(chapter.prompt || "");
  const [copied, setCopied] = useState(false);
  const [writeConfirm, setWriteConfirm] = useState(false);
  const [generatingScenesThenWrite, setGeneratingScenesThenWrite] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const queryClient = useQueryClient();

  const isFiction = spec?.book_type !== 'nonfiction';
  function safeParseCh(str) {
    try { if (!str || str.trim() === 'null' || str.trim() === '[]') return null; return JSON.parse(str); } catch { return null; }
  }
  const parsedScenes = safeParseCh(chapter.scenes);
  const hasScenes = isFiction && Array.isArray(parsedScenes) && parsedScenes.length > 0;

  const resolvedContent = useResolvedContent(chapter.content);
  const content = isStreaming ? streamingContent : resolvedContent;
  const status = isWriting ? "generating" : chapter.status;
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

  const handleWriteClick = () => {
    if (isFiction && !hasScenes) {
      setWriteConfirm(true);
    } else {
      onWrite(chapter);
    }
  };

  const handleRewrite = async () => {
    setRewriting(true);
    try {
      await base44.entities.Chapter.update(chapter.id, {
        content: "",
        status: "pending",
        word_count: 0,
        quality_scan: "",
        distinctive_phrases: "",
        state_document: "",
        generated_at: "",
      });
      queryClient.invalidateQueries({ queryKey: ["chapters", chapter.project_id] });
      onRewrite(chapter);
    } catch (err) {
      console.error('Rewrite clear error:', err.message);
    } finally {
      setRewriting(false);
    }
  };

  const handleGenerateScenesThenWrite = async () => {
    setWriteConfirm(false);
    setGeneratingScenesThenWrite(true);
    try {
      await base44.functions.invoke('generateScenes', {
        projectId: chapter.project_id,
        chapterNumber: chapter.chapter_number,
      });
      let polls = 0;
      while (polls < 45) {
        await new Promise(r => setTimeout(r, 2000));
        polls++;
        const updated = await base44.entities.Chapter.filter({ project_id: chapter.project_id });
        const updCh = updated.find(c => c.id === chapter.id);
        if (updCh?.scenes && updCh.scenes.trim() !== 'null' && updCh.scenes.trim() !== '[]') {
          if (onScenesUpdated) onScenesUpdated();
          break;
        }
      }
    } catch (err) {
      console.error('generateScenesThenWrite error:', err.message);
    } finally {
      setGeneratingScenesThenWrite(false);
      onWrite(chapter);
    }
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
            {beatData?.beat_function && <BeatBadge beatFunction={beatData.beat_function} beatName={beatData.beat_name} />}
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", sc.className)}>{sc.label}</span>
            {hasScenes && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-semibold">{parsedScenes.length} scenes</span>
            )}
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
          {chapter.status === "generated" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2.5 border-amber-300 text-amber-700 hover:bg-amber-50"
              disabled={isWriting || generatingScenesThenWrite || rewriting}
              onClick={(e) => { e.stopPropagation(); handleRewrite(); }}
            >
              {rewriting ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Clearing…</> : <><RefreshCw className="w-3 h-3 mr-1" />Rewrite</>}
            </Button>
          )}
          <Button
            size="sm"
            className={cn("h-7 text-xs px-2.5", (isWriting || generatingScenesThenWrite) ? "bg-yellow-500 hover:bg-yellow-600" : "bg-indigo-600 hover:bg-indigo-700")}
            disabled={isWriting || generatingScenesThenWrite || rewriting}
            onClick={handleWriteClick}
          >
            {generatingScenesThenWrite
              ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Scenes…</>
              : isWriting
                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Writing…</>
                : <><RefreshCw className="w-3 h-3 mr-1" />{chapter.status === "generated" ? "Regenerate" : "Write"}</>}
          </Button>
        </div>
      </div>

      {/* Write-without-scenes confirmation */}
      {writeConfirm && (
        <div className="border-t border-slate-100 bg-amber-50 px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-amber-800 font-medium flex-1">This chapter has no scenes. Generate scenes first for better results?</span>
          <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700" onClick={handleGenerateScenesThenWrite}>
            <LayoutGrid className="w-3 h-3 mr-1" />Generate Scenes First
          </Button>
          <button
            className="text-xs text-slate-400 hover:text-slate-600 underline"
            onClick={() => { setWriteConfirm(false); onWrite(chapter); }}
          >Write Without Scenes</button>
          <button className="text-xs text-slate-400 hover:text-slate-600" onClick={() => setWriteConfirm(false)}>Cancel</button>
        </div>
      )}

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-3">
          {chapterProgress && (
            <div className="text-xs text-indigo-600 font-medium">{chapterProgress}</div>
          )}
          {chapter.summary && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Summary</p>
              <p className="text-sm text-slate-700 leading-relaxed">{chapter.summary}</p>
            </div>
          )}

          {/* Scene section */}
          {isFiction && (
            <SceneSection chapter={chapter} onScenesUpdated={onScenesUpdated} />
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                {hasScenes ? "Extra Instructions" : "Writing Prompt"}
              </p>
              <Button size="sm" variant="ghost" className="h-6 text-xs text-slate-500 px-2" onClick={() => setEditingPrompt(e => !e)}>
                <Pencil className="w-3 h-3 mr-1" />{editingPrompt ? "Cancel" : "Edit"}
              </Button>
            </div>
            {editingPrompt ? (
              <div className="space-y-2">
                <Textarea className="text-xs font-mono" rows={4} value={promptValue} onChange={e => setPromptValue(e.target.value)} />
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-7 text-xs" onClick={savePrompt}>Save</Button>
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
  const [generateError, setGenerateError] = useState("");
  const [retryCountdown, setRetryCountdown] = useState(0);

  // CHANGE 5 FIX: Countdown timer for rate limit retry
  useEffect(() => {
    if (retryCountdown <= 0) return;
    const interval = setInterval(() => {
      setRetryCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [retryCountdown]);

  // Scroll to top on component mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const [generationProgress, setGenerationProgress] = useState("");
  const [streamingChapterId, setStreamingChapterId] = useState(null);
  const [activeChapterIds, setActiveChapterIds] = useState(new Set()); // tracks chapters being written (polling)
  const [streamingContent, setStreamingContent] = useState({});
  const [chapterProgress, setChapterProgress] = useState({});
  const [generatingAllScenes, setGeneratingAllScenes] = useState(false);
  const [allScenesProgress, setAllScenesProgress] = useState("");
  const [writeAllModalOpen, setWriteAllModalOpen] = useState(false);
  const [writeAllActive, setWriteAllActive] = useState(false);
  const [writeAllProgress, setWriteAllProgress] = useState({
    current: 0,
    total: 0,
    currentTitle: "",
    successes: 0,
    failures: [],
    startTime: null,
    done: false,
    elapsed: "",
    wordsWritten: 0,
    totalWords: 0,
    chapterWords: 0,
    targetChapterWords: 3750,
  });
  const writeAllAbortRef = useRef(false);
  const generatingRef = useRef(false);
  const [targetLength, setTargetLength] = useState("medium");

  const { data: specifications = [] } = useQuery({
    queryKey: ["specification", projectId],
    queryFn: () => base44.entities.Specification.filter({ project_id: projectId }),
  });

  const { data: outlines = [] } = useQuery({
    queryKey: ["outline", projectId],
    queryFn: () => base44.entities.Outline.filter({ project_id: projectId }),
    refetchInterval: generating ? 4000 : false,
  });

  const { data: chapters = [], refetch: refetchChapters } = useQuery({
    queryKey: ["chapters", projectId],
    queryFn: () => base44.entities.Chapter.filter({ project_id: projectId }, "chapter_number"),
    refetchInterval: streamingChapterId ? 2000 : false,
  });

  const outline = outlines[0];
  const hasOutline = !!(outline?.outline_data || outline?.outline_url);

  // If the outline query picks up completion via auto-refetch, stop the spinner
  useEffect(() => {
    if (generating && (outline?.status === 'complete' || outline?.status === 'shell_complete')) {
      // Don't stop spinner for shell_complete — detail phase follows
      if (outline?.status === 'complete') {
        generatingRef.current = false;
        setGenerating(false);
        setGenerationProgress("");
        queryClient.invalidateQueries({ queryKey: ["chapters", projectId] });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
      }
    } else if (generating && outline?.status === 'error') {
      generatingRef.current = false;
      setGenerating(false);
      setGenerationProgress("");
      setGenerateError(outline.error_message || 'Generation failed');
    }
  }, [outline?.status]);
  const spec = specifications[0] ? {
    ...specifications[0],
    beat_style: specifications[0].beat_style || specifications[0].tone_style || "",
    spice_level: specifications[0].spice_level ?? 0,
    language_intensity: specifications[0].language_intensity ?? 0,
  } : null;

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
  const resolvedBookMetadata = outline?.book_metadata || null;

  const generatedCount = chapters.filter(c => c.status === "generated").length;
  const totalCount = chapters.length;
  const allGenerated = totalCount > 0 && generatedCount === totalCount;
  const progress = totalCount > 0 ? Math.round((generatedCount / totalCount) * 100) : 0;

  const handleGenerateOutline = async () => {
    setGenerating(true);
    generatingRef.current = true;
    setGenerationProgress("Step 1/2 — Building structure…");
    setGenerateError("");

    try {
      // ── STEP 1: Shell (fast — titles + summaries) ──
      const shellRes = await base44.functions.invoke('generateOutlineShell', { project_id: projectId }, { timeout: 60000 });
      if (shellRes.status !== 200) {
        setGenerateError(shellRes.data?.error || 'Failed to generate shell');
        setGenerating(false);
        setGenerationProgress("");
        return;
      }

      const shellStatus = shellRes.data?.status;
      if (shellStatus === 'partial') {
        // Shell timed out — save what we have, let user resume
        await queryClient.invalidateQueries({ queryKey: ["outline", projectId] });
        await queryClient.invalidateQueries({ queryKey: ["chapters", projectId] });
        setGenerating(false);
        setGenerationProgress("");
        setGenerateError("Structure was partially generated. Click 'Resume Detail' to continue.");
        return;
      }

      // Shell complete — refresh chapters list, then start detail
      await queryClient.invalidateQueries({ queryKey: ["outline", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["chapters", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });

      setGenerationProgress("Step 2/2 — Filling in detail…");

      // ── STEP 2: Detail (story bible, prompts, beats) ──
      const detailRes = await base44.functions.invoke('generateOutlineDetail', { project_id: projectId }, { timeout: 60000 });

      const detailStatus = detailRes.data?.status;
      
      await queryClient.invalidateQueries({ queryKey: ["outline", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["chapters", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });

      generatingRef.current = false;
      setGenerating(false);
      setGenerationProgress("");

      if (detailStatus === 'partial') {
        setGenerateError("Outline partially detailed — some chapters may lack prompts. Click 'Resume Detail' to complete.");
      }

    } catch (err) {
      console.error('generateOutline error:', err);
      generatingRef.current = false;
      
      if (err.message?.includes('rate limit') || err.message?.includes('Rate limit')) {
        setGenerateError('AI rate limit reached — please wait 60 seconds and click Retry.');
        setRetryCountdown(60);
      } else {
        setGenerateError(err.message || 'Failed to generate outline');
      }
      
      setGenerating(false);
      setGenerationProgress("");
    }
  };

  const handleResumeDetail = async () => {
    setGenerating(true);
    generatingRef.current = true;
    setGenerationProgress("Resuming — Filling in detail…");
    setGenerateError("");

    try {
      const detailRes = await base44.functions.invoke('generateOutlineDetail', { project_id: projectId }, { timeout: 60000 });
      
      await queryClient.invalidateQueries({ queryKey: ["outline", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["chapters", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });

      generatingRef.current = false;
      setGenerating(false);
      setGenerationProgress("");

      if (detailRes.data?.status === 'partial') {
        setGenerateError("Still partially detailed. You can retry or proceed with what's available.");
      }
    } catch (err) {
      console.error('resumeDetail error:', err);
      generatingRef.current = false;
      setGenerateError(err.message || 'Failed to resume detail generation');
      setGenerating(false);
      setGenerationProgress("");
    }
  };

  // Shared helper: fire writeChapter and poll until chapter reaches generated/error status.
  // Returns "generated" | "error" | "timeout"
  const writeAndPollChapter = async (chapterId, chapterNumber, onProgress) => {
    let httpDone = false;
    let httpError = null;

    // Fire the writeChapter request — track when it completes/fails
    base44.functions.invoke('writeChapter', {
      project_id: projectId,
      chapter_id: chapterId,
    }, { timeout: 600000 }).then(() => {
      httpDone = true;
    }).catch(err => {
      httpDone = true;
      httpError = err?.message || 'HTTP error';
      console.log(`writeChapter HTTP returned/errored for ch ${chapterNumber}:`, httpError);
    });

    // Poll chapter status until done
    const startedAt = Date.now();
    const maxWaitMs = 7 * 60 * 1000; // 7 min max per chapter (Deno CPU limit is ~5 min)
    const progressMessages = ["Generating prose…", "Writing chapter content…", "Building narrative…", "Crafting scenes…", "Finalizing chapter…"];
    let lastUpdatedAt = null; // Track when the chapter record was last modified

    while (Date.now() - startedAt < maxWaitMs) {
      await new Promise(r => setTimeout(r, 3000));
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      const msgIdx = Math.floor(elapsed / 20) % progressMessages.length;

      const updatedChapters = await base44.entities.Chapter.filter({ project_id: projectId });
      const ch = updatedChapters.find(c => c.id === chapterId);

      if (ch?.status === 'generated') {
        if (onProgress) onProgress(`Complete — ${ch.word_count || 0} words (${timeStr})`);
        return "generated";
      }
      if (ch?.status === 'error') {
        if (onProgress) onProgress(`Error during generation`);
        return "error";
      }

      // Detect Deno crash: if HTTP request completed (with error) but chapter is still "generating",
      // the backend died without updating status. Mark it as error and move on.
      if (httpDone && httpError && ch?.status === 'generating' && elapsed > 30) {
        console.warn(`Ch ${chapterNumber}: Backend crashed (${httpError}) — marking as error`);
        if (onProgress) onProgress(`Backend crashed — skipping to next chapter`);
        try {
          await base44.entities.Chapter.update(chapterId, { status: 'error' });
        } catch (e) { console.warn('Failed to mark crashed chapter:', e.message); }
        return "error";
      }

      // Detect stale "generating": if 4+ minutes have passed and the chapter updated_date
      // hasn't changed in 2+ minutes, the worker likely died silently
      if (ch?.updated_date) {
        const updMs = new Date(ch.updated_date).getTime();
        if (lastUpdatedAt && updMs === lastUpdatedAt && elapsed > 240) {
          const staleSecs = Math.floor((Date.now() - updMs) / 1000);
          if (staleSecs > 120) {
            console.warn(`Ch ${chapterNumber}: Stale "generating" for ${staleSecs}s — marking as error`);
            if (onProgress) onProgress(`Worker timed out — skipping to next chapter`);
            try {
              await base44.entities.Chapter.update(chapterId, { status: 'error' });
            } catch (e) { console.warn('Failed to mark stale chapter:', e.message); }
            return "error";
          }
        }
        lastUpdatedAt = updMs;
      }

      if (onProgress) onProgress(`${progressMessages[msgIdx]} (${timeStr})`);
    }

    // Timeout — check one last time, then mark as error so pipeline continues
    const finalCheck = await base44.entities.Chapter.filter({ project_id: projectId });
    const finalCh = finalCheck.find(c => c.id === chapterId);
    if (finalCh?.status === 'generated') return "generated";
    if (finalCh?.status === 'error') return "error";
    // Force-mark as error so Write All pipeline doesn't get stuck
    try {
      await base44.entities.Chapter.update(chapterId, { status: 'error' });
    } catch (e) { console.warn('Failed to mark timed-out chapter:', e.message); }
    return "timeout";
  };

  const handleWriteChapter = async (chapter) => {
    setStreamingChapterId(chapter.id);
    setActiveChapterIds(prev => new Set([...prev, chapter.id]));
    setChapterProgress(prev => ({ ...prev, [chapter.id]: "Starting generation…" }));

    // Update status optimistically
    queryClient.setQueryData(["chapters", projectId], old =>
      (old || []).map(c => c.id === chapter.id ? { ...c, status: "generating" } : c)
    );

    try {
      const result = await writeAndPollChapter(chapter.id, chapter.chapter_number, (msg) => {
        setChapterProgress(prev => ({ ...prev, [chapter.id]: msg }));
      });

      if (result === "timeout") {
        setChapterProgress(prev => ({ ...prev, [chapter.id]: "Generation timeout — refresh to check status." }));
      }
      await refetchChapters();
    } catch (err) {
      console.error('writeChapter error:', err.message);
      setChapterProgress(prev => ({ ...prev, [chapter.id]: `Error: ${err.message}` }));
    } finally {
      setActiveChapterIds(prev => { const s = new Set(prev); s.delete(chapter.id); return s; });
      setStreamingChapterId(null);
    }
  };

  const TARGET_WORDS_PER_CHAPTER = {
    short: 3750,
    medium: 3750,
    long: 4166,
    epic: 4375,
  };

  const handleWriteAllChapters = async () => {
    // Filter chapters that don't have content yet (not generated)
    const toWrite = chapters.filter(c => c.status !== 'generated');
    
    if (toWrite.length === 0) {
      alert("All chapters are already written!");
      return;
    }

    // Get target length from spec
    const spec = specifications?.[0];
    const tLen = spec?.target_length || "medium";
    setTargetLength(tLen);

    const targetChapterWords = TARGET_WORDS_PER_CHAPTER[tLen];
    const targetTotalWords = toWrite.length * targetChapterWords;

    writeAllAbortRef.current = false;
    setWriteAllActive(true);
    setWriteAllModalOpen(true);

    const startTime = Date.now();
    setWriteAllProgress({
      current: 0,
      total: toWrite.length,
      currentTitle: toWrite[0]?.title || "",
      successes: 0,
      failures: [],
      startTime,
      done: false,
      elapsed: "",
      wordsWritten: 0,
      totalWords: targetTotalWords,
      chapterWords: 0,
      targetChapterWords,
      error: null,
    });

    // ── PHASE 1: Generate scenes for fiction chapters that don't have them ──
    if (spec?.book_type !== 'nonfiction') {
      const needScenes = toWrite.filter(c => !c.scenes || c.scenes.trim() === 'null' || c.scenes.trim() === '[]' || c.scenes.trim() === '');
      if (needScenes.length > 0) {
        setWriteAllProgress(prev => ({ ...prev, phase: 1, phaseLabel: "Phase 1: Generating Scenes", currentTitle: needScenes[0].title }));
        for (let i = 0; i < needScenes.length; i++) {
          if (writeAllAbortRef.current) break;
          const ch = needScenes[i];
          setWriteAllProgress(prev => ({ ...prev, currentTitle: `Scene gen: ${ch.title} (${i + 1}/${needScenes.length})` }));
          try {
            await base44.functions.invoke('generateScenes', { projectId, chapterNumber: ch.chapter_number });
            let polls = 0;
            while (polls < 45) {
              await new Promise(r => setTimeout(r, 2000));
              polls++;
              const updated = await base44.entities.Chapter.filter({ project_id: projectId });
              const updCh = updated.find(c => c.id === ch.id);
              if (updCh?.scenes && updCh.scenes.trim() !== 'null' && updCh.scenes.trim() !== '[]') break;
            }
          } catch (err) {
            console.warn(`Scene gen failed for ch ${ch.chapter_number}:`, err.message);
          }
        }
        await refetchChapters();
      }
    }

    // ── PHASE 2: Dispatch all chapters via fire-and-forget backend, then poll ──
    setWriteAllProgress(prev => ({ ...prev, phase: 2, phaseLabel: "Phase 2: Writing Chapters" }));

    let successes = 0;
    let totalWordsWritten = 0;
    const failedChapters = [];

    // Fire-and-forget: dispatch all chapters at once with backend stagger
    try {
      const dispatchRes = await base44.functions.invoke('writeAllChapters', { projectId }, { timeout: 15000 });
      console.log('Dispatched:', dispatchRes.data);
    } catch (err) {
      console.log('writeAllChapters dispatch:', err?.message || 'ok');
    }

    // Poll all chapters until all are generated/error/timeout
    const chapterIds = toWrite.map(c => c.id);
    const chapterMap = Object.fromEntries(toWrite.map(c => [c.id, c]));
    const completedSet = new Set();
    const startPollTime = Date.now();
    const maxPollMs = 10 * 60 * 1000; // 10 min total max
    const progressMessages = ["Generating prose…", "Writing chapter content…", "Building narrative…", "Crafting scenes…", "Finalizing chapter…"];

    while (completedSet.size < chapterIds.length && Date.now() - startPollTime < maxPollMs) {
      if (writeAllAbortRef.current) break;

      await new Promise(r => setTimeout(r, 4000));

      const updatedChapters = await base44.entities.Chapter.filter({ project_id: projectId });
      totalWordsWritten = updatedChapters.filter(c => c.status === 'generated').reduce((sum, c) => sum + (c.word_count || 0), 0);

      for (const chId of chapterIds) {
        if (completedSet.has(chId)) continue;
        const ch = updatedChapters.find(c => c.id === chId);
        const info = chapterMap[chId];

        if (ch?.status === 'generated') {
          completedSet.add(chId);
          successes++;
        } else if (ch?.status === 'error') {
          completedSet.add(chId);
          failedChapters.push({ number: info.chapter_number, title: info.title, error: 'Generation failed' });
        }
      }

      // Find first in-progress chapter for display
      const activeChapter = chapterIds.find(id => !completedSet.has(id));
      const activeInfo = activeChapter ? chapterMap[activeChapter] : null;
      const elapsed = Math.floor((Date.now() - startPollTime) / 1000);
      const msgIdx = Math.floor(elapsed / 20) % progressMessages.length;

      setWriteAllProgress(prev => ({
        ...prev,
        current: completedSet.size,
        successes,
        failures: [...failedChapters],
        wordsWritten: totalWordsWritten,
        currentTitle: activeInfo ? `Ch ${activeInfo.chapter_number}: ${progressMessages[msgIdx]}` : 'Finishing up…',
        chapterWords: 0,
      }));
    }

    // Mark any remaining chapters as timed out
    for (const chId of chapterIds) {
      if (!completedSet.has(chId)) {
        const info = chapterMap[chId];
        failedChapters.push({ number: info.chapter_number, title: info.title, error: 'Timed out' });
        try { await base44.entities.Chapter.update(chId, { status: 'error' }); } catch {}
      }
    }

    const elapsed = Date.now() - startTime;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);

    setWriteAllProgress(prev => ({
      ...prev,
      current: toWrite.length,
      successes,
      failures: failedChapters,
      done: true,
      elapsed: `${mins}m ${secs}s`,
      wordsWritten: totalWordsWritten,
      chapterWords: 0,
      error: failedChapters.length > 0 ? `${failedChapters.length} chapter(s) failed. See details below.` : null,
    }));

    setWriteAllActive(false);
    await refetchChapters();
  };

  const stopWriteAll = () => {
    writeAllAbortRef.current = true;
  };

  const handleGenerateAllScenes = async () => {
    setGeneratingAllScenes(true);
    setAllScenesProgress("Starting scene generation…");
    try {
      const response = await base44.functions.invoke('generateAllScenes', { projectId });
      const total = response.data?.total || 0;
      if (total === 0) {
        setAllScenesProgress("All chapters already have scenes.");
        setTimeout(() => setAllScenesProgress(""), 3000);
        return;
      }
      // Poll until all chapters have scenes
      let done = 0;
      let polls = 0;
      while (done < total && polls < 90) {
        await new Promise(r => setTimeout(r, 3000));
        polls++;
        const updated = await base44.entities.Chapter.filter({ project_id: projectId });
        done = updated.filter(c => {
          const s = c.scenes?.trim();
          return s && s !== 'null' && s !== '[]';
        }).length;
        setAllScenesProgress(`Generating scenes… ${done} of ${total} chapters done`);
      }
      setAllScenesProgress("Scenes ready!");
      await refetchChapters();
      setTimeout(() => setAllScenesProgress(""), 3000);
    } catch (err) {
      setAllScenesProgress(`Error: ${err.message}`);
      setTimeout(() => setAllScenesProgress(""), 5000);
    } finally {
      setGeneratingAllScenes(false);
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
            Your specifications will be analyzed to create a detailed chapter-by-chapter outline.
          </p>
          {generateError && (
            <div className="mb-4 space-y-3">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 text-left">
                {generateError}
              </div>
              {retryCountdown > 0 && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 text-center font-medium">
                  Ready to retry in: {retryCountdown}s...
                </div>
              )}
            </div>
          )}
          <Button 
            onClick={handleGenerateOutline} 
            disabled={retryCountdown > 0}
            className="bg-indigo-600 hover:bg-indigo-700 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4 mr-2" /> {generateError ? 'Retry Generation' : 'Generate Outline & Story Bible'}
          </Button>
          {spec && <div className="mt-4 text-left"><SpecSettingsSummary spec={spec} /></div>}
        </div>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Generating your book outline…</p>
          {generationProgress && (
            <p className="text-sm text-indigo-600 mt-2 font-medium">{generationProgress}</p>
          )}
          <p className="text-sm text-slate-400 mt-1">This may take a few minutes for longer books</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Settings summary */}
      <SpecSettingsSummary spec={spec} />

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

      {/* Book Metadata */}
      <BookMetadataCard metadataRaw={resolvedBookMetadata} />

      {/* Outline & Story Bible */}
      <OutlineCard outlineData={resolvedOutlineData} />
      <StoryBibleCard storyBible={resolvedStoryBible} />

      {/* Error banner */}
      {generateError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {generateError}
        </div>
      )}

      {/* Regenerate outline + One-click write buttons */}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleGenerateOutline} className="text-slate-500">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> {generateError ? 'Retry' : 'Regenerate Outline'}
        </Button>
        {spec?.book_type !== 'nonfiction' && totalCount > 0 && chapters.some(c => !c.scenes || c.scenes.trim() === 'null' || c.scenes.trim() === '[]' || c.scenes.trim() === '') && (
          <Button
            onClick={handleGenerateAllScenes}
            disabled={generatingAllScenes || writeAllActive}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {generatingAllScenes
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating Scenes…</>
              : <><LayoutGrid className="w-4 h-4 mr-2" />Generate All Scenes</>}
          </Button>
        )}
        {totalCount > 0 && generatedCount < totalCount && (
          <Button 
            onClick={handleWriteAllChapters} 
            disabled={generating || writeAllActive}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Zap className="w-4 h-4 mr-2" /> 
            {writeAllActive ? "Writing..." : `Write All Chapters (${totalCount - generatedCount} remaining)`}
          </Button>
        )}
      </div>
      {allScenesProgress && (
        <div className="text-sm text-indigo-600 font-medium text-right">{allScenesProgress}</div>
      )}

      {/* Chapters */}
      {chapters.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-800 text-base">Chapters</h3>
          {chapters.map(chapter => {
            // Look up beat data from outline
            const parsedOl = safeParse(resolvedOutlineData);
            const olCh = parsedOl?.chapters?.find(c => (c.number || c.chapter_number) === chapter.chapter_number);
            const beatData = olCh?.beat_function ? { beat_name: olCh.beat_name, beat_function: olCh.beat_function } : null;
            return (
              <ChapterItem
                key={chapter.id}
                chapter={chapter}
                spec={spec}
                onWrite={handleWriteChapter}
                onRewrite={handleWriteChapter}
                streamingContent={streamingContent[chapter.id] || ""}
                isStreaming={streamingChapterId === chapter.id}
                isWriting={activeChapterIds.has(chapter.id)}
                chapterProgress={chapterProgress[chapter.id] || null}
                onScenesUpdated={refetchChapters}
                beatData={beatData}
              />
            );
          })}
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

      {/* Write All Chapters Modal */}
      <WriteAllChaptersModal
        isOpen={writeAllModalOpen}
        onClose={() => setWriteAllModalOpen(false)}
        onProceed={onProceed}
        progress={writeAllProgress}
        onStop={stopWriteAll}
        targetLength={targetLength}
      />
    </div>
  );
}