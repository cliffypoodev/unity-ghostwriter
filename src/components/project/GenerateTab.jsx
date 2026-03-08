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
                  <p className="font-semibold text-slate-800">Ch {ch.number}: {ch.title}</p>
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

function ChapterItem({ chapter, spec, onWrite, streamingContent, isStreaming, chapterProgress, onScenesUpdated }) {
  const [expanded, setExpanded] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptValue, setPromptValue] = useState(chapter.prompt || "");
  const [copied, setCopied] = useState(false);
  const [writeConfirm, setWriteConfirm] = useState(false);
  const [generatingScenesThenWrite, setGeneratingScenesThenWrite] = useState(false);
  const queryClient = useQueryClient();

  const isFiction = spec?.book_type !== 'nonfiction';
  function safeParseCh(str) {
    try { if (!str || str.trim() === 'null' || str.trim() === '[]') return null; return JSON.parse(str); } catch { return null; }
  }
  const parsedScenes = safeParseCh(chapter.scenes);
  const hasScenes = isFiction && Array.isArray(parsedScenes) && parsedScenes.length > 0;

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

  const handleWriteClick = () => {
    if (isFiction && !hasScenes) {
      setWriteConfirm(true);
    } else {
      onWrite(chapter);
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
          <Button
            size="sm"
            className={cn("h-7 text-xs px-2.5", (isStreaming || generatingScenesThenWrite) ? "bg-yellow-500 hover:bg-yellow-600" : "bg-indigo-600 hover:bg-indigo-700")}
            disabled={isStreaming || generatingScenesThenWrite}
            onClick={handleWriteClick}
          >
            {generatingScenesThenWrite
              ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Scenes…</>
              : isStreaming
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
    if (generating && outline?.status === 'complete') {
      generatingRef.current = false;
      setGenerating(false);
      setGenerationProgress("");
      queryClient.invalidateQueries({ queryKey: ["chapters", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
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
    setGenerationProgress("Starting generation…");
    setGenerateError("");

    try {
      // Kick off async generation — returns immediately
      const response = await base44.functions.invoke('generateOutline', { project_id: projectId }, { timeout: 30000 });
      if (response.status !== 200) {
        setGenerateError(response.data?.error || 'Failed to start generation');
        setGenerating(false);
        setGenerationProgress("");
        return;
      }

      // Poll the Outline entity status until complete or error
      let pollCount = 0;
      const startedAt = Date.now();
      const messages = [
        "Generating story bible & metadata…",
        "Building chapter outlines…",
        "Writing chapter prompts…",
        "Finalizing outline…",
        "Almost there…",
      ];

      const pollInterval = setInterval(async () => {
        pollCount++;
        try {
          const outlineList = await base44.entities.Outline.filter({ project_id: projectId });
          const latestOutline = outlineList[0];

          if (!latestOutline) return;

          if (latestOutline.status === 'complete') {
            clearInterval(pollInterval);
            generatingRef.current = false;
            await queryClient.invalidateQueries({ queryKey: ["outline", projectId] });
            await queryClient.invalidateQueries({ queryKey: ["chapters", projectId] });
            await queryClient.invalidateQueries({ queryKey: ["projects"] });
            setGenerating(false);
            setGenerationProgress("");
          } else if (latestOutline.status === 'error') {
            clearInterval(pollInterval);
            generatingRef.current = false;
            setGenerateError(latestOutline.error_message || 'Generation failed');
            setGenerating(false);
            setGenerationProgress("");
          } else {
            // Still generating — show elapsed time + rotating message
            const elapsed = Math.floor((Date.now() - startedAt) / 1000);
            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
            setGenerationProgress(`${messages[pollCount % messages.length]} (${timeStr})`);
          }
        } catch (e) {
          console.warn('Poll error:', e.message);
        }
      }, 3000);

      // Safety timeout after 12 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (generatingRef.current) {
          generatingRef.current = false;
          setGenerateError('Generation is taking too long. Please check back or retry.');
          setGenerating(false);
          setGenerationProgress("");
        }
      }, 12 * 60 * 1000);

    } catch (err) {
      console.error('generateOutline error:', err);
      generatingRef.current = false;
      
      // CHANGE 5 FIX: User-friendly rate limit error with countdown
      if (err.message?.includes('rate limit') || err.message?.includes('Rate limit')) {
        setGenerateError('AI rate limit reached. Your outline is large — please wait 60 seconds and click Retry Generation.');
        setRetryCountdown(60);
      } else {
        setGenerateError(err.message || 'Failed to generate outline');
      }
      
      setGenerating(false);
      setGenerationProgress("");
    }
  };

  const handleWriteChapter = async (chapter) => {
   setStreamingChapterId(chapter.id);
   setChapterProgress(prev => ({ ...prev, [chapter.id]: "Writing section 1 of 3..." }));

   // Update status optimistically
   queryClient.setQueryData(["chapters", projectId], old =>
     (old || []).map(c => c.id === chapter.id ? { ...c, status: "generating" } : c)
   );

   try {
     console.log('Starting write for chapter:', chapter.id);

     const response = await base44.functions.invoke('writeChapter', { 
       project_id: projectId, 
       chapter_id: chapter.id 
     });

     if (response.status !== 200) {
       console.error('writeChapter error:', response.data);
       return;
     }

     // If async, poll for updates every 2 seconds
     if (response.data?.async) {
       setChapterProgress(prev => ({ ...prev, [chapter.id]: "Writing section 1 of 3..." }));
       let pollCount = 0;
       const pollInterval = setInterval(async () => {
         pollCount++;
         try {
           const updatedChapters = await base44.entities.Chapter.filter({ project_id: projectId });
           const updatedChapter = updatedChapters.find(c => c.id === chapter.id);

           if (updatedChapter?.status === 'generated') {
             clearInterval(pollInterval);
             setStreamingContent(prev => ({ ...prev, [chapter.id]: updatedChapter.content || "" }));

             // Handle quality scan results
             let qualityMsg = "Complete";
             if (updatedChapter.quality_scan) {
               try {
                 const quality = JSON.parse(updatedChapter.quality_scan);
                 if (quality.passed) {
                   qualityMsg = `Complete — Quality check passed (${updatedChapter.word_count || 0} words)`;
                 } else {
                   qualityMsg = `Complete — WARNING: ${quality.banned_phrase_total} banned phrases remain`;
                   console.warn(`Chapter ${chapter.chapter_number} quality warnings:`, quality.warnings);
                 }
               } catch (e) { /* ignore parse errors */ }
             }
             setChapterProgress(prev => ({ ...prev, [chapter.id]: qualityMsg }));

             await refetchChapters();
           } else if (updatedChapter?.status === 'error') {
             clearInterval(pollInterval);
             setChapterProgress(prev => ({ ...prev, [chapter.id]: "Error during generation" }));
           } else {
             // Show rotating progress message
             const messages = ["Writing section 1 of 3...", "Writing section 2 of 3...", "Writing section 3 of 3..."];
             const msgIndex = pollCount % messages.length;
             setChapterProgress(prev => ({ ...prev, [chapter.id]: messages[msgIndex] }));
           }
         } catch (err) {
           console.warn('Poll error:', err.message);
         }
       }, 2000);

       // Stop polling after 5 minutes
       setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
     }
   } catch (err) {
     console.error('writeChapter error:', err.message);
     setChapterProgress(prev => ({ ...prev, [chapter.id]: `Error: ${err.message}` }));
   } finally {
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
    // DO NOT set generating=true here — that triggers the outline spinner
    
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

    let successes = 0;
    let totalWordsWritten = 0;
    const failures = [];
    let isWriting = true;

    // ISSUE 5 FIX: Validate that chapters exist before starting
    if (toWrite.length === 0) {
      currentError = "No chapters found to write. Please regenerate your outline first.";
      setWriteAllProgress(prev => ({ ...prev, done: true, error: currentError }));
      setWriteAllActive(false);
      return;
    }

    // SEQUENTIAL: Each chapter must finish before next one starts
    for (let i = 0; i < toWrite.length; i++) {
      // ISSUE 4 FIX: Check if still writing before state updates
      if (writeAllAbortRef.current || !isWriting) break;

      const chapter = toWrite[i];
      let chapterWordsCount = 0;

      setWriteAllProgress(prev => ({
        ...prev,
        current: i,
        currentTitle: chapter.title,
        successes,
        failures: [...failures],
        wordsWritten: totalWordsWritten,
        chapterWords: 0,
        error: null,
      }));

      let chapterSuccess = false;

      try {
        // Invoke writeChapter — returns immediately with async:true
        const response = await base44.functions.invoke('writeChapter', {
          project_id: projectId,
          chapter_id: chapter.id,
        }, { timeout: 60000 });

        if (response.status !== 200) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        // CRITICAL: Block here until this chapter is fully saved before moving on.
        // The backend writes asynchronously, so we poll until status === 'generated'.
        let pollCount = 0;
        const maxPolls = 150; // 5 minutes at 2s intervals
        let done = false;

        while (!done && pollCount < maxPolls) {
          if (writeAllAbortRef.current) { isWriting = false; break; }

          await new Promise(resolve => setTimeout(resolve, 2000));
          pollCount++;

          const updated = await base44.entities.Chapter.filter({ project_id: projectId });
          const updatedChapter = updated.find(c => c.id === chapter.id);

          if (updatedChapter?.status === 'generated') {
            let finalContent = updatedChapter.content || '';
            if (finalContent.startsWith('http://') || finalContent.startsWith('https://')) {
              try { finalContent = await (await fetch(finalContent)).text(); } catch {}
            }
            const finalWords = finalContent ? finalContent.split(/\s+/).filter(Boolean).length : 0;
            chapterWordsCount = finalWords;
            totalWordsWritten += finalWords;
            successes++;
            done = true;
            setWriteAllProgress(prev => ({
              ...prev,
              chapterWords: chapterWordsCount,
              wordsWritten: totalWordsWritten,
              successes,
            }));
          } else if (updatedChapter?.status === 'error') {
            throw new Error('Chapter generation failed on server');
          }
          // else still generating — keep polling
        }

        if (!done && isWriting) {
          throw new Error('Generation timeout after 5 minutes');
        }
      } catch (err) {
        const errorMsg = err.message || 'Unknown error';
        console.error(`Chapter ${chapter.chapter_number} error:`, errorMsg);
        failures.push({ number: chapter.chapter_number, title: chapter.title, error: errorMsg });
        setWriteAllProgress(prev => ({ ...prev, error: errorMsg }));
      }
    }

    const elapsed = Date.now() - startTime;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);

    setWriteAllProgress(prev => ({
      ...prev,
      current: toWrite.length,
      successes,
      failures,
      done: true,
      elapsed: `${mins}m ${secs}s`,
      wordsWritten: totalWordsWritten,
      chapterWords: 0,
      error: failures.length > 0 ? `${failures.length} chapter(s) failed. See details below.` : null,
    }));

    setWriteAllActive(false);
    isWriting = false;
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
          {chapters.map(chapter => (
            <ChapterItem
              key={chapter.id}
              chapter={chapter}
              onWrite={handleWriteChapter}
              streamingContent={streamingContent[chapter.id] || ""}
              isStreaming={streamingChapterId === chapter.id}
              chapterProgress={chapterProgress[chapter.id] || null}
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