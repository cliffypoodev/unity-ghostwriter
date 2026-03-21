// PIPELINE PHASE ISOLATION — Phase 3 (Chapter Generation)
//
// Permitted AI calls: writeChapter, generateScenes, generateAllScenes,
//   writeAllChapters, generateChapterState, resumeFromChapter
// Prose quality gates run INSIDE writeChapter on the backend.
//
// Forbidden: developIdea, expandPremise, generateOutline (Phase 1/2),
//            consistencyCheck, rewriteInVoice (Phase 4).
//
// This file is the STATE PARENT — all polling, write pipeline logic, and
// data queries live here. Rendering is delegated to:
//   OutlineSection  — outline generation / display
//   WriterSection   — chapter list, act headers, action bar, write-all modal

import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { detectActBoundaries } from "./ActDetection";
import { needsInteriorityGate, hasProtagonistInteriority } from "./InteriorityGateBanner";
import { healthMonitor } from "../utils/appHealthMonitor";
import OutlineSection, { safeParse } from "./generate/OutlineSection";
import WriterSection from "./generate/WriterSection";

export default function GenerateTab({ projectId, onProceed }) {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [generationProgress, setGenerationProgress] = useState("");
  const [streamingChapterId, setStreamingChapterId] = useState(null);
  const [activeChapterIds, setActiveChapterIds] = useState(new Set());
  const [streamingContent, setStreamingContent] = useState({});
  const [chapterProgress, setChapterProgress] = useState({});
  const [generatingAllScenes, setGeneratingAllScenes] = useState(false);
  const [allScenesProgress, setAllScenesProgress] = useState("");
  const [writeAllModalOpen, setWriteAllModalOpen] = useState(false);
  const [writeAllActive, setWriteAllActive] = useState(false);
  const [writeAllProgress, setWriteAllProgress] = useState({
    current: 0, total: 0, currentTitle: "", successes: 0, failures: [],
    startTime: null, done: false, elapsed: "", wordsWritten: 0, totalWords: 0,
    chapterWords: 0, targetChapterWords: 3750,
  });
  const writeAllAbortRef = useRef(false);
  const generatingRef = useRef(false);
  const [targetLength, setTargetLength] = useState("medium");
  const [resumingFromChapter, setResumingFromChapter] = useState(null);
  const [writingActNumber, setWritingActNumber] = useState(null);
  const [customActSplits, setCustomActSplits] = useState(null);

  // Countdown timer for rate limit retry
  useEffect(() => {
    if (retryCountdown <= 0) return;
    const interval = setInterval(() => {
      setRetryCountdown(prev => { if (prev <= 1) { clearInterval(interval); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(interval);
  }, [retryCountdown]);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  // ── Queries ──
  const { data: projectData } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => { const ps = await base44.entities.Project.filter({ id: projectId }); return ps[0]; },
  });

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
    refetchInterval: (writeAllActive || resumingFromChapter || streamingChapterId) ? 3000 : false,
  });

  const outline = outlines[0];
  const hasOutline = !!(outline?.outline_data || outline?.outline_url);
  const isPartial = outline?.status === 'partial' || outline?.status === 'shell_complete';

  // Auto-stop spinner when outline completes
  useEffect(() => {
    if (generating && (outline?.status === 'complete' || outline?.status === 'shell_complete')) {
      if (outline?.status === 'complete') {
        generatingRef.current = false; setGenerating(false); setGenerationProgress("");
        queryClient.invalidateQueries({ queryKey: ["chapters", projectId] });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
      }
    } else if (generating && outline?.status === 'error') {
      generatingRef.current = false; setGenerating(false); setGenerationProgress("");
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
    queryFn: async () => { const res = await fetch(outline.outline_url); return res.text(); },
  });
  const { data: storyBibleData } = useQuery({
    queryKey: ["story_bible_data", outline?.id],
    enabled: !!outline?.story_bible_url && !outline?.story_bible,
    queryFn: async () => { const res = await fetch(outline.story_bible_url); return res.text(); },
  });

  const resolvedOutlineData = outline?.outline_data || outlineData;
  const resolvedStoryBible = outline?.story_bible || storyBibleData;
  const resolvedBookMetadata = outline?.book_metadata || null;

  // Auto-unstick stale "generating" chapters
  useEffect(() => {
    const unstickInterval = setInterval(async () => {
      if (chapters.length === 0 || activeChapterIds.size > 0) return;
      const stale = chapters.filter(c => c.status === 'generating');
      if (stale.length > 0) {
        try {
          await Promise.all(stale.map(c => base44.entities.Chapter.update(c.id, { status: 'pending' }).catch(() => {})));
          refetchChapters(); toast.info(`${stale.length} stuck chapter(s) reset to pending.`);
        } catch (e) { if (!String(e?.message).includes('429')) console.warn('Unstick failed:', e.message); }
      }
    }, 60000);
    const mountCheck = setTimeout(async () => {
      if (chapters.length === 0 || activeChapterIds.size > 0) return;
      const stale = chapters.filter(c => c.status === 'generating');
      if (stale.length > 0) {
        try {
          await Promise.all(stale.map(c => base44.entities.Chapter.update(c.id, { status: 'pending' }).catch(() => {})));
          refetchChapters(); toast.info(`${stale.length} stuck chapter(s) reset to pending.`);
        } catch (e) { if (!String(e?.message).includes('429')) console.warn('Mount unstick failed:', e.message); }
      }
    }, 5000);
    return () => { clearInterval(unstickInterval); clearTimeout(mountCheck); };
  }, [chapters.length, activeChapterIds.size]);

  const totalCount = chapters.length;
  const parsedOutline = safeParse(resolvedOutlineData);
  const autoActs = totalCount > 0 ? detectActBoundaries(chapters, parsedOutline) : null;
  const acts = (autoActs && customActSplits && totalCount > 3) ? {
    act1: { start: 1, end: customActSplits.act1End, label: 'Act 1 — Establish & Disrupt' },
    act2: { start: customActSplits.act1End + 1, end: customActSplits.act2End, label: 'Act 2 — Escalate & Break' },
    act3: { start: customActSplits.act2End + 1, end: totalCount, label: 'Act 3 — Fracture & Resolve' },
  } : autoActs;

  const interiorityMissing = needsInteriorityGate(spec) && !hasProtagonistInteriority(spec, projectData);

  // ── Outline Generation ──
  const handleGenerateOutline = async () => {
    setGenerating(true); generatingRef.current = true;
    setGenerationProgress("Step 1/2 — Building structure…"); setGenerateError("");
    try {
      const shellRes = await base44.functions.invoke('generateOutlineShell', { project_id: projectId });
      if (shellRes.status !== 200) { setGenerateError(shellRes.data?.error || 'Failed to generate shell'); setGenerating(false); setGenerationProgress(""); return; }
      if (shellRes.data?.status === 'partial') {
        await queryClient.invalidateQueries({ queryKey: ["outline", projectId] });
        await queryClient.invalidateQueries({ queryKey: ["chapters", projectId] });
        setGenerating(false); setGenerationProgress(""); setGenerateError("Structure was partially generated. Click 'Resume Detail' to continue."); return;
      }
      await queryClient.invalidateQueries({ queryKey: ["outline", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["chapters", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setGenerationProgress("Step 2/2 — Filling in detail…");
      const detailRes = await base44.functions.invoke('generateOutlineDetail', { project_id: projectId });
      await queryClient.invalidateQueries({ queryKey: ["outline", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["chapters", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      generatingRef.current = false; setGenerating(false); setGenerationProgress("");
      if (detailRes.data?.status === 'partial') setGenerateError("Outline partially detailed — some chapters may lack prompts.");
    } catch (err) {
      generatingRef.current = false;
      healthMonitor.report({ severity: err.message?.includes('rate limit') ? 'warning' : 'error', category: 'pipeline', message: `Outline generation failed: ${err.message}`, context: { projectId }, raw: err });
      if (err.message?.includes('rate limit') || err.message?.includes('Rate limit')) { setGenerateError('AI rate limit reached — please wait 60 seconds and click Retry.'); setRetryCountdown(60); }
      else { setGenerateError(err.message || 'Failed to generate outline'); }
      setGenerating(false); setGenerationProgress("");
    }
  };

  const handleResumeDetail = async () => {
    setGenerating(true); generatingRef.current = true; setGenerationProgress("Resuming — Filling in detail…"); setGenerateError("");
    try {
      await base44.functions.invoke('generateOutlineDetail', { project_id: projectId });
      await queryClient.invalidateQueries({ queryKey: ["outline", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["chapters", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      generatingRef.current = false; setGenerating(false); setGenerationProgress("");
    } catch (err) {
      generatingRef.current = false; setGenerateError(err.message || 'Failed to resume detail generation');
      setGenerating(false); setGenerationProgress("");
    }
  };

  // ── Write Pipeline ──
  const writeAndPollChapter = async (chapterId, chapterNumber, onProgress) => {
    const startedAt = Date.now();
    const elapsed = () => { const s = Math.floor((Date.now() - startedAt) / 1000); return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`; };
    try {
      await base44.entities.Chapter.update(chapterId, { status: "generating" });
      const chData = (await base44.entities.Chapter.filter({ id: chapterId }))?.[0];
      const hasScenes = chData?.scenes && chData.scenes.trim() !== 'null' && chData.scenes.trim() !== '[]' && chData.scenes.trim() !== '' && chData.scenes.trim() !== '{}';
      if (!hasScenes) { if (onProgress) onProgress(`Building scenes… (${elapsed()})`); await base44.functions.invoke('bot_sceneArchitect', { project_id: projectId, chapter_id: chapterId }); }

      if (onProgress) onProgress(`Writing prose… (${elapsed()})`);
      let proseData = null;
      try { const proseResult = await base44.functions.invoke('bot_proseWriter', { project_id: projectId, chapter_id: chapterId }); proseData = proseResult?.data || proseResult; }
      catch (proseErr) { console.warn(`Ch ${chapterNumber}: Prose writer HTTP error — polling…`); if (onProgress) onProgress(`Waiting for prose writer… (${elapsed()})`); }

      if (!proseData?.saved) {
        let pollAttempts = 0;
        while (pollAttempts < 60) {
          await new Promise(r => setTimeout(r, 5000)); pollAttempts++;
          if (onProgress) onProgress(`Waiting for prose… ${pollAttempts * 5}s (${elapsed()})`);
          try {
            const polledCh = (await base44.entities.Chapter.filter({ id: chapterId }))?.[0];
            if (!polledCh) break;
            if (polledCh.word_count > 50 || (polledCh.content && typeof polledCh.content === 'string' && polledCh.content.startsWith('http'))) {
              proseData = { saved: true, word_count: polledCh.word_count || 0 }; break;
            }
          } catch (pollErr) { await new Promise(r => setTimeout(r, 5000)); }
        }
      }

      const wordCount = proseData?.word_count || 0;
      if (!proseData?.saved || wordCount < 50) { await base44.entities.Chapter.update(chapterId, { status: 'error' }); return "error"; }

      // Code-level cleanup
      if (onProgress) onProgress(`Cleaning prose artifacts… (${elapsed()})`);
      try {
        const chBeforeClean = (await base44.entities.Chapter.filter({ id: chapterId }))?.[0];
        let rawContent = chBeforeClean?.content || "";
        if (rawContent.startsWith("http")) { try { rawContent = await (await fetch(rawContent)).text(); } catch { rawContent = ""; } }
        if (rawContent && rawContent.length > 200) {
          let cleaned = rawContent;
          cleaned = cleaned.replace(/```[\w]*\n?/g, '');
          cleaned = cleaned.replace(/^---\s*a\/.*$/gm, '');
          cleaned = cleaned.replace(/^\+\+\+\s*b\/.*$/gm, '');
          cleaned = cleaned.replace(/^@@[^@]*@@.*$/gm, '');
          let lines = cleaned.split(/\n/);
          const exactDeduped = [];
          for (let k = 0; k < lines.length; k++) { const trimmed = lines[k].trim(); if (trimmed.length > 0 && exactDeduped.length > 0 && exactDeduped[exactDeduped.length - 1].trim() === trimmed) continue; exactDeduped.push(lines[k]); }
          lines = exactDeduped;
          const deduped = [];
          for (let k = 0; k < lines.length; k++) { const line = lines[k].trim(); if (line.length < 80) { deduped.push(lines[k]); continue; } const words = new Set(line.toLowerCase().match(/\b[a-z]{4,}\b/g) || []); if (words.size < 10) { deduped.push(lines[k]); continue; } let isDupe = false; for (let p = Math.max(0, deduped.length - 3); p < deduped.length; p++) { const prevWords = new Set(deduped[p].trim().toLowerCase().match(/\b[a-z]{4,}\b/g) || []); if (prevWords.size < 10) continue; let overlap = 0; words.forEach(function(w) { if (prevWords.has(w)) overlap++; }); if (overlap / Math.min(words.size, prevWords.size) > 0.75) { isDupe = true; break; } } if (!isDupe) deduped.push(lines[k]); }
          cleaned = deduped.join('\n');
          cleaned = cleaned.replace(/\[NOTE TO (AUTHOR|EDITOR|AI|SELF)\][^\n]*/gi, '');
          cleaned = cleaned.replace(/\[TODO[:\s][^\]]*\]/gi, '');
          cleaned = cleaned.replace(/as (instructed|requested|specified) (in|by) the (prompt|system|user|outline)[^\n]*/gi, '');
          cleaned = cleaned.replace(/per the (outline|beat sheet|specification|chapter prompt)[^\n]*/gi, '');
          cleaned = cleaned.replace(/\b(Remove specific|Use general|Either provide|Either cite) \w+(\s\w+)? or (cite|provide|use|anchor|source|reference) \w[^\n]*/gi, '');
          cleaned = cleaned.replace(/\bRemove (atmospheric|invented|fictional|fabricated) (reconstruction|detail|scene|quote)[^\n]*/gi, '');
          cleaned = cleaned.replace(/\bProvide (documentary|specific|archival|real) (source|evidence|documentation)[^\n]*/gi, '');
          cleaned = cleaned.replace(/\bLabel as (representative|illustrative|composite|general|reconstructed)[^\n]*/gi, '');
          cleaned = cleaned.replace(/\bFrame as (hypothetical|composite|reconstructed|general|illustrative)[^\n]*/gi, '');
          cleaned = cleaned.replace(/\n{3,}/g, '\n\n').replace(/  +/g, ' ').trim();
          if (cleaned !== rawContent) {
            const blob = new Blob([cleaned], { type: "text/plain" });
            const file = new File([blob], "chapter_" + chapterId + "_cleaned.txt", { type: "text/plain" });
            try { const uploadResult = await base44.integrations.Core.UploadFile({ file }); if (uploadResult?.file_url) await base44.entities.Chapter.update(chapterId, { content: uploadResult.file_url }); }
            catch { try { await base44.entities.Chapter.update(chapterId, { content: cleaned }); } catch {} }
          }
        }
      } catch (cleanErr) { console.warn(`Ch ${chapterNumber}: Code cleanup failed (non-fatal):`, cleanErr.message); }

      if (onProgress) onProgress(`Fixing style issues… ${wordCount} words (${elapsed()})`);
      try { await base44.functions.invoke('bot_styleEnforcer', { project_id: projectId, chapter_id: chapterId }); } catch {}
      if (onProgress) onProgress(`Polishing prose… (${elapsed()})`);
      try { await base44.functions.invoke('bot_prosePolisher', { project_id: projectId, chapter_id: chapterId }); } catch {}

      const finalCh = (await base44.entities.Chapter.filter({ id: chapterId }))?.[0];
      const finalWords = finalCh?.word_count || wordCount;
      await base44.entities.Chapter.update(chapterId, { status: 'generated' });
      if (onProgress) onProgress(`Complete — ${finalWords} words (${elapsed()})`);
      return "generated";
    } catch (err) {
      try { await base44.entities.Chapter.update(chapterId, { status: 'error' }); } catch {}
      if (onProgress) onProgress(`Error: ${err.message}`);
      return "error";
    }
  };

  const handleWriteChapter = async (chapter) => {
    if (interiorityMissing) { toast.error("Complete Protagonist Interiority in Specifications before generating."); return; }
    setStreamingChapterId(chapter.id);
    setActiveChapterIds(prev => new Set([...prev, chapter.id]));
    setChapterProgress(prev => ({ ...prev, [chapter.id]: "Starting generation…" }));
    queryClient.setQueryData(["chapters", projectId], old => (old || []).map(c => c.id === chapter.id ? { ...c, status: "generating" } : c));
    try {
      await writeAndPollChapter(chapter.id, chapter.chapter_number, (msg) => setChapterProgress(prev => ({ ...prev, [chapter.id]: msg })));
      await refetchChapters();
    } catch (err) {
      healthMonitor.report({ severity: 'error', category: 'generation', message: `Chapter generation failed: Ch ${chapter.chapter_number}`, context: { chapterNumber: chapter.chapter_number }, raw: err });
      setChapterProgress(prev => ({ ...prev, [chapter.id]: `Error: ${err.message}` }));
      try { await base44.entities.Chapter.update(chapter.id, { status: 'error' }); } catch {}
    } finally {
      setActiveChapterIds(prev => { const s = new Set(prev); s.delete(chapter.id); return s; });
      setStreamingChapterId(null);
    }
  };

  const TARGET_WORDS_PER_CHAPTER = { short: 3750, medium: 3750, long: 4166, epic: 4375 };

  // ── Shared write-loop logic ──
  const runWriteLoop = async (toWrite, label) => {
    const tLen = spec?.target_length || "medium";
    setTargetLength(tLen);
    const targetChapterWords = TARGET_WORDS_PER_CHAPTER[tLen];
    writeAllAbortRef.current = false;
    setWriteAllActive(true); setWriteAllModalOpen(true);
    const startTime = Date.now();
    setWriteAllProgress({ current: 0, total: toWrite.length, currentTitle: toWrite[0]?.title || "", successes: 0, failures: [], startTime, done: false, elapsed: "", wordsWritten: 0, totalWords: toWrite.length * targetChapterWords, chapterWords: 0, targetChapterWords, phase: 1, phaseLabel: label });

    // Phase 1: Generate scenes for chapters that need them
    const needScenes = toWrite.filter(c => !c.scenes || c.scenes.trim() === 'null' || c.scenes.trim() === '[]' || c.scenes.trim() === '' || c.scenes.trim() === '{}');
    if (needScenes.length > 0) {
      const isNF = spec?.book_type === 'nonfiction';
      setWriteAllProgress(prev => ({ ...prev, phase: 1, phaseLabel: isNF ? "Phase 1: Generating Beat Sheets" : "Phase 1: Generating Scenes" }));
      for (let i = 0; i < needScenes.length; i++) {
        if (writeAllAbortRef.current) break;
        const ch = needScenes[i];
        setWriteAllProgress(prev => ({ ...prev, currentTitle: `Scene gen: Ch ${ch.chapter_number} — ${ch.title} (${i + 1}/${needScenes.length})` }));
        try {
          await base44.functions.invoke('generateScenes', { projectId, chapterNumber: ch.chapter_number });
          let polls = 0;
          while (polls < 45) { await new Promise(r => setTimeout(r, 2000)); polls++; const updated = await base44.entities.Chapter.filter({ project_id: projectId }); const updCh = updated.find(c => c.id === ch.id); if (updCh?.scenes && updCh.scenes.trim() !== 'null' && updCh.scenes.trim() !== '[]') break; }
        } catch {}
      }
      await refetchChapters();
    }

    // Phase 2: Write chapters
    setWriteAllProgress(prev => ({ ...prev, phase: 2, phaseLabel: label.replace('Phase 1', 'Phase 2') || "Phase 2: Writing Chapters" }));
    let successes = 0, totalWordsWritten = 0;
    const failedChapters = [];

    for (let i = 0; i < toWrite.length; i++) {
      if (writeAllAbortRef.current) break;
      const ch = toWrite[i];
      setWriteAllProgress(prev => ({ ...prev, current: successes, queueIndex: i, successes, failures: [...failedChapters], currentTitle: `Ch ${ch.chapter_number}: ${ch.title}`, chapterNumber: ch.chapter_number, chapterWords: 0, wordsWritten: totalWordsWritten }));
      let result;
      try { result = await writeAndPollChapter(ch.id, ch.chapter_number, (msg) => setWriteAllProgress(prev => ({ ...prev, currentTitle: `Ch ${ch.chapter_number}: ${msg}`, chapterNumber: ch.chapter_number }))); }
      catch (pollErr) {
        healthMonitor.report({ severity: 'error', category: 'generation', message: `${label} Ch ${ch.chapter_number} failed: ${pollErr.message}`, context: { chapterNumber: ch.chapter_number }, raw: pollErr });
        result = 'error';
        try { await base44.entities.Chapter.update(ch.id, { status: 'error' }); } catch {}
      }
      if (result === 'generated') {
        successes++;
        try { const updated = await base44.entities.Chapter.filter({ project_id: projectId }); totalWordsWritten = updated.filter(c => c.status === 'generated').reduce((sum, c) => sum + (c.word_count || 0), 0); } catch {}
        base44.functions.invoke('generateChapterState', { project_id: projectId, chapter_id: ch.id }).catch(() => {});
        if (i < toWrite.length - 1) await new Promise(r => setTimeout(r, 3000));
      } else {
        failedChapters.push({ number: ch.chapter_number, title: ch.title, error: result === 'timeout' ? 'Timed out' : 'Generation failed' });
      }
      setWriteAllProgress(prev => ({ ...prev, current: successes, queueIndex: i + 1, successes, failures: [...failedChapters], wordsWritten: totalWordsWritten }));
    }

    const elapsed = Date.now() - startTime;
    setWriteAllProgress(prev => ({ ...prev, current: successes, successes, failures: failedChapters, done: true, paused: writeAllAbortRef.current && successes < toWrite.length, elapsed: `${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`, wordsWritten: totalWordsWritten, chapterWords: 0, error: failedChapters.length > 0 ? `${failedChapters.length} chapter(s) failed.` : null }));
    setWriteAllActive(false);
    await refetchChapters();
    return { successes, failedChapters };
  };

  const handleWriteAllChapters = async () => {
    if (interiorityMissing) { toast.error("Complete Protagonist Interiority first."); return; }
    const toWrite = chapters.filter(c => c.status !== 'generated');
    if (toWrite.length === 0) { alert("All chapters are already written!"); return; }
    // Call backend prep
    try { const prepRes = await base44.functions.invoke('writeAllChapters', { projectId }); } catch {}
    await runWriteLoop(toWrite, "Phase 2: Writing Chapters");
  };

  const handleResumeFromChapter = async (chapter) => {
    setResumingFromChapter(chapter.chapter_number);
    const toWrite = chapters.filter(c => c.chapter_number >= chapter.chapter_number && c.status !== 'generated');
    await runWriteLoop(toWrite, `Resuming from Chapter ${chapter.chapter_number}`);
    setResumingFromChapter(null);
  };

  const handleWriteAct = async (actNumber) => {
    if (interiorityMissing) { toast.error("Complete Protagonist Interiority first."); return; }
    const act = acts?.[`act${actNumber}`];
    if (!act) return;
    const { getActChapters } = await import("./ActDetection");
    const actChapters = getActChapters(chapters, acts, actNumber);
    const toWrite = actChapters.filter(c => c.status !== 'generated');
    if (toWrite.length === 0) { toast.info(`Act ${actNumber} is already complete!`); return; }
    setWritingActNumber(actNumber);
    await runWriteLoop(toWrite, `Writing Act ${actNumber} (Ch ${act.start}–${act.end})`);
    setWritingActNumber(null);
    if (toWrite.length > 0) toast.success(`Act ${actNumber} complete!`);
  };

  const handleGenerateAllScenes = async () => {
    setGeneratingAllScenes(true); setAllScenesProgress("Checking chapters…");
    try {
      const needScenes = chapters.filter(c => { const s = c.scenes?.trim(); return !s || s === 'null' || s === '[]' || s === '{}'; });
      if (needScenes.length === 0) { setAllScenesProgress("All chapters already have scenes."); setTimeout(() => setAllScenesProgress(""), 3000); return; }
      for (let i = 0; i < needScenes.length; i++) {
        const ch = needScenes[i];
        setAllScenesProgress(`Generating scenes… ${i} of ${needScenes.length} done (Ch ${ch.chapter_number}: ${ch.title})`);
        try { await base44.functions.invoke('generateScenes', { projectId, chapterNumber: ch.chapter_number }); } catch {}
        if (i < needScenes.length - 1) await new Promise(r => setTimeout(r, 1000));
      }
      setAllScenesProgress("Scenes ready!"); await refetchChapters(); setTimeout(() => setAllScenesProgress(""), 3000);
    } catch (err) {
      healthMonitor.report({ severity: 'error', category: 'pipeline', message: `Scene generation failed: ${err.message}`, context: { projectId }, raw: err });
      setAllScenesProgress(`Error: ${err.message}`); setTimeout(() => setAllScenesProgress(""), 5000);
    } finally { setGeneratingAllScenes(false); }
  };

  // ── Render ──
  // If no outline yet or currently generating, show OutlineSection
  if (!hasOutline || generating) {
    return (
      <OutlineSection
        spec={spec} hasOutline={hasOutline} isPartial={isPartial}
        generating={generating} generationProgress={generationProgress}
        generateError={generateError} retryCountdown={retryCountdown}
        onGenerateOutline={handleGenerateOutline} onResumeDetail={handleResumeDetail}
        resolvedOutlineData={resolvedOutlineData} resolvedStoryBible={resolvedStoryBible}
        resolvedBookMetadata={resolvedBookMetadata}
      />
    );
  }

  // Outline exists — show outline cards + writer section
  return (
    <div className="space-y-6">
      <OutlineSection
        spec={spec} hasOutline={hasOutline} isPartial={isPartial}
        generating={generating} generationProgress={generationProgress}
        generateError={generateError} retryCountdown={retryCountdown}
        onGenerateOutline={handleGenerateOutline} onResumeDetail={handleResumeDetail}
        resolvedOutlineData={resolvedOutlineData} resolvedStoryBible={resolvedStoryBible}
        resolvedBookMetadata={resolvedBookMetadata}
      />
      <WriterSection
        projectId={projectId} spec={spec} projectData={projectData}
        chapters={chapters} acts={acts} parsedOutline={parsedOutline}
        isPartial={isPartial} generating={generating} generateError={generateError}
        onGenerateOutline={handleGenerateOutline} onResumeDetail={handleResumeDetail}
        generatingAllScenes={generatingAllScenes} allScenesProgress={allScenesProgress}
        onGenerateAllScenes={handleGenerateAllScenes}
        activeChapterIds={activeChapterIds} streamingChapterId={streamingChapterId}
        streamingContent={streamingContent} chapterProgress={chapterProgress}
        resumingFromChapter={resumingFromChapter} writeAllActive={writeAllActive}
        writeAllModalOpen={writeAllModalOpen} writeAllProgress={writeAllProgress}
        writingActNumber={writingActNumber} targetLength={targetLength}
        interiorityMissing={interiorityMissing}
        onWriteChapter={handleWriteChapter} onResumeFromChapter={handleResumeFromChapter}
        onWriteAllChapters={handleWriteAllChapters} onWriteAct={handleWriteAct}
        onStopWriteAll={() => { writeAllAbortRef.current = true; }}
        onSetWriteAllModalOpen={setWriteAllModalOpen}
        onSetCustomActSplits={setCustomActSplits}
        refetchChapters={refetchChapters} onProceed={onProceed}
        resolvedOutlineData={resolvedOutlineData} outline={outline}
        queryClient={queryClient}
      />
    </div>
  );
}