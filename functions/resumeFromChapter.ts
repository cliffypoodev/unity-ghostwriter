import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Resume writing from a specific chapter number.
// Rebuilds state documents for all completed chapters before the target,
// builds previous_chapter_endings from actual written content,
// writes the target chapter, then continues sequentially through remaining chapters.

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function resolveContent(content) {
  if (!content) return '';
  if (content.startsWith('http://') || content.startsWith('https://')) {
    try { const r = await fetch(content); if (!r.ok) return ''; const t = await r.text(); if (t.trim().startsWith('<')) return ''; return t; } catch { return ''; }
  }
  return content;
}

function extractLastParagraph(text) {
  if (!text) return '';
  const paragraphs = text.trim().split(/\n\n+/).filter(p => p.trim().length > 0);
  return paragraphs.length > 0 ? paragraphs[paragraphs.length - 1].trim() : '';
}

async function buildPreviousChapterEndings(completedChapters) {
  if (completedChapters.length === 0) return null;
  const sorted = [...completedChapters].sort((a, b) => a.chapter_number - b.chapter_number);
  const endings = [];
  const mostRecent = sorted[sorted.length - 1];
  const mostRecentContent = await resolveContent(mostRecent.content);
  const lp = extractLastParagraph(mostRecentContent);
  if (lp) endings.push({ chapter_number: mostRecent.chapter_number, title: mostRecent.title, type: 'full_ending', last_paragraph: lp });
  const preceding = sorted.slice(Math.max(0, sorted.length - 4), sorted.length - 1);
  for (const ch of preceding) {
    const content = await resolveContent(ch.content);
    const p = extractLastParagraph(content);
    if (p) endings.push({ chapter_number: ch.chapter_number, title: ch.title, type: 'last_paragraph_only', last_paragraph: p });
  }
  return endings.length > 0 ? endings : null;
}

// Helper: write a single chapter with retry, state doc generation, and endings injection
async function writeChapterWithContext(base44, projectId, chapterId, chapterNumber, completedBefore) {
  // Build and inject previous_chapter_endings
  const endings = await buildPreviousChapterEndings(completedBefore);
  if (endings) {
    console.log(`[resume] Injecting ${endings.length} ending(s) as context for ch ${chapterNumber}`);
    await base44.entities.Chapter.update(chapterId, { previous_chapter_endings: JSON.stringify(endings) });
  }

  let success = false;
  let lastError = '';

  // Attempt 1
  try {
    const res = await base44.functions.invoke('writeChapter', { project_id: projectId, chapter_id: chapterId });
    if (res?.data?.error) { lastError = res.data.error; } else { success = true; }
  } catch (err) { lastError = err.message || String(err); }
  if (!success) { const check = await base44.entities.Chapter.filter({ id: chapterId }); if (check[0]?.status === 'generated') success = true; }

  // Attempt 2
  if (!success) {
    console.log(`[resume] Retrying ch ${chapterNumber} in 15s...`);
    await sleep(15000);
    await base44.entities.Chapter.update(chapterId, { status: 'pending' });
    try {
      const res = await base44.functions.invoke('writeChapter', { project_id: projectId, chapter_id: chapterId });
      if (res?.data?.error) lastError = res.data.error; else success = true;
    } catch (err) { lastError = err.message || String(err); }
    if (!success) { const check2 = await base44.entities.Chapter.filter({ id: chapterId }); if (check2[0]?.status === 'generated') success = true; }
  }

  if (success) {
    // Generate state document for continuity
    try { await base44.functions.invoke('generateChapterState', { project_id: projectId, chapter_id: chapterId }); } catch (err) { console.warn(`[resume] State gen failed for ch ${chapterNumber}: ${err.message}`); }
  }

  return { success, lastError };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId, chapterNumber } = await req.json();
    if (!projectId || !chapterNumber) {
      return Response.json({ error: 'projectId and chapterNumber required' }, { status: 400 });
    }

    const chapters = await base44.entities.Chapter.filter({ project_id: projectId }, 'chapter_number');
    if (chapters.length === 0) return Response.json({ error: 'No chapters found' }, { status: 400 });

    const targetChapter = chapters.find(c => c.chapter_number === chapterNumber);
    if (!targetChapter) return Response.json({ error: `Chapter ${chapterNumber} not found` }, { status: 404 });

    // Phase 1: Rebuild state documents for completed chapters before target that are missing them
    const completedBefore = chapters.filter(c => c.chapter_number < chapterNumber && c.status === 'generated');
    console.log(`[resume] Rebuilding state for ${completedBefore.length} chapters before ch ${chapterNumber}`);
    for (const ch of completedBefore) {
      if (!ch.state_document) {
        console.log(`[resume] Generating state document for ch ${ch.chapter_number}`);
        try { await base44.functions.invoke('generateChapterState', { project_id: projectId, chapter_id: ch.id }); } catch (err) { console.warn(`[resume] State rebuild failed for ch ${ch.chapter_number}: ${err.message}`); }
        await sleep(2000);
      }
    }

    // Phase 2: Reset the target chapter and write it
    console.log(`[resume] Writing target chapter ${chapterNumber}`);
    await base44.entities.Chapter.update(targetChapter.id, {
      status: 'pending', content: '', word_count: 0, quality_scan: '',
      distinctive_phrases: '', state_document: '', generated_at: '', previous_chapter_endings: '',
    });

    const targetResult = await writeChapterWithContext(base44, projectId, targetChapter.id, chapterNumber, completedBefore);
    if (!targetResult.success) {
      await base44.entities.Chapter.update(targetChapter.id, { status: 'error', quality_scan: JSON.stringify({ halted: true, error: targetResult.lastError }) });
      return Response.json({ status: 'failed', failed_at: chapterNumber, error: targetResult.lastError, message: `Chapter ${chapterNumber} failed after 2 attempts.` });
    }

    // Phase 3: Continue with remaining chapters sequentially
    const remaining = chapters.filter(c => c.chapter_number > chapterNumber && c.status !== 'generated');
    if (remaining.length === 0) {
      return Response.json({ status: 'complete', writing_from: chapterNumber, completed: 1, remaining: 0, message: `Chapter ${chapterNumber} written. No remaining chapters.` });
    }

    console.log(`[resume] Continuing with ${remaining.length} remaining chapters`);
    let completed = 1;

    for (const ch of remaining) {
      console.log(`[resume] Writing ch ${ch.chapter_number}`);
      await base44.entities.Chapter.update(ch.id, { status: 'pending' });

      // Re-fetch completed chapters for accurate endings context
      const freshChapters = await base44.entities.Chapter.filter({ project_id: projectId }, 'chapter_number');
      const freshCompleted = freshChapters.filter(c => c.chapter_number < ch.chapter_number && c.status === 'generated');

      const result = await writeChapterWithContext(base44, projectId, ch.id, ch.chapter_number, freshCompleted);
      if (!result.success) {
        await base44.entities.Chapter.update(ch.id, { status: 'error', quality_scan: JSON.stringify({ halted: true, error: result.lastError }) });
        return Response.json({
          status: 'paused', writing_from: chapterNumber, completed, failed_at: ch.chapter_number, error: result.lastError,
          message: `Halted at chapter ${ch.chapter_number} after retry. ${completed} chapter(s) written from ch ${chapterNumber}.`,
        });
      }

      completed++;
      console.log(`[resume] Ch ${ch.chapter_number} complete (${completed} total from resume)`);
      await sleep(5000);
    }

    return Response.json({ status: 'complete', writing_from: chapterNumber, completed, message: `All ${completed} chapter(s) written successfully from chapter ${chapterNumber}.` });
  } catch (error) {
    console.error('resumeFromChapter error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});