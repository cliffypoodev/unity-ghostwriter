// ═══════════════════════════════════════════════════════════════════════════════
// BOT 6 — ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════
// Coordinates the other 5 bots for single-chapter or full-book generation.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Inlined from shared/dataLoader ──
async function resolveContent(content) {
  if (!content) return '';
  if (typeof content === 'string' && (content.startsWith('http://') || content.startsWith('https://'))) {
    try {
      const r = await fetch(content);
      if (!r.ok) return '';
      const t = await r.text();
      if (t.trim().startsWith('<')) return '';
      return t;
    } catch { return ''; }
  }
  return content;
}

// ── BOT INVOCATIONS ─────────────────────────────────────────────────────────

async function invokeBot(base44, botName, payload, retries = 3) {
  const startMs = Date.now();
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await base44.functions.invoke(botName, payload, { timeout: 600000 });
      return { success: true, data: result.data || result, duration_ms: Date.now() - startMs };
    } catch (err) {
      const is429 = err.message?.includes('429') || err.message?.includes('Rate limit') || err.message?.includes('rate limit');
      if (is429 && attempt < retries) {
        const delay = (attempt + 1) * 15000; // 15s, 30s, 45s
        console.warn(`Bot ${botName}: rate limited (attempt ${attempt + 1}/${retries + 1}), waiting ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      console.error(`Bot ${botName} failed:`, err.message);
      return { success: false, error: err.message, duration_ms: Date.now() - startMs };
    }
  }
}

// ── SINGLE CHAPTER PIPELINE ─────────────────────────────────────────────────

async function orchestrateChapter(base44, projectId, chapterId) {
  const startMs = Date.now();
  const timings = {};

  const chapters = await base44.entities.Chapter.filter({ project_id: projectId });
  const chapter = chapters.find(c => c.id === chapterId);
  if (!chapter) throw new Error('Chapter not found: ' + chapterId);

  // Guard: if chapter is already generated (another run may have completed), skip
  if (chapter.status === 'generated' && chapter.content) {
    console.log(`Ch ${chapter.chapter_number}: Already generated — skipping duplicate orchestration`);
    return {
      success: true, chapter_id: chapterId,
      word_count: chapter.word_count || 0, quality_report: null,
      violations_remaining: 0, continuity_violations: 0,
      generation_time_ms: 0, bot_timings: {},
      skipped: true,
    };
  }

  await base44.entities.Chapter.update(chapterId, { status: 'generating' });

  const specs = await base44.entities.Specification.filter({ project_id: projectId });
  const spec = specs[0];

  try {
    await base44.entities.Project.update(projectId, {
      generation_status: JSON.stringify({
        current_chapter: chapter.chapter_number,
        current_bot: 'scene_architect',
        started_at: new Date().toISOString(),
      }),
    });
  } catch (e) { console.warn('Status update failed:', e.message); }

  // ── STEP 1: SCENE ARCHITECT ──
  const hasScenes = chapter.scenes && chapter.scenes.trim() !== 'null' && chapter.scenes.trim() !== '[]' && chapter.scenes.trim() !== '';
  if (!hasScenes) {
    console.log(`Ch ${chapter.chapter_number}: Generating scenes...`);
    const sceneResult = await invokeBot(base44, 'bot_sceneArchitect', {
      project_id: projectId,
      chapter_id: chapterId,
    });
    timings.scene_architect_ms = sceneResult.duration_ms;
    if (!sceneResult.success) {
      console.warn(`Ch ${chapter.chapter_number}: Scene generation failed — proceeding without scenes`);
    }
  } else {
    timings.scene_architect_ms = 0;
    console.log(`Ch ${chapter.chapter_number}: Scenes already exist — skipping architect`);
  }

  // ── STEP 2: PROSE WRITER ──
  try {
    await base44.entities.Project.update(projectId, {
      generation_status: JSON.stringify({
        current_chapter: chapter.chapter_number,
        current_bot: 'prose_writer',
        started_at: new Date().toISOString(),
      }),
    });
  } catch (e) {}

  console.log(`Ch ${chapter.chapter_number}: Writing prose...`);
  const proseResult = await invokeBot(base44, 'bot_proseWriter', {
    project_id: projectId,
    chapter_id: chapterId,
  });
  timings.prose_writer_ms = proseResult.duration_ms;

  if (!proseResult.success) {
    await base44.entities.Chapter.update(chapterId, { status: 'error' });
    return {
      success: false, chapter_id: chapterId,
      error: 'Prose generation failed: ' + proseResult.error,
      timings, duration_ms: Date.now() - startMs,
    };
  }

  let currentProse = proseResult.data.raw_prose;
  const refusalDetected = proseResult.data.refusal_detected;

  if (!currentProse || currentProse.length < 100) {
    await base44.entities.Chapter.update(chapterId, { status: 'error' });
    return {
      success: false, chapter_id: chapterId,
      error: refusalDetected ? 'AI refused to generate content' : 'Generated prose too short',
      timings, duration_ms: Date.now() - startMs,
    };
  }

  // ── STEP 3: CONTINUITY GUARDIAN ──
  try {
    await base44.entities.Project.update(projectId, {
      generation_status: JSON.stringify({
        current_chapter: chapter.chapter_number,
        current_bot: 'continuity_guardian',
      }),
    });
  } catch (e) {}

  console.log(`Ch ${chapter.chapter_number}: Checking continuity...`);
  const guardianResult = await invokeBot(base44, 'bot_continuityGuardian', {
    project_id: projectId,
    chapter_id: chapterId,
    raw_prose: currentProse,
  });
  timings.continuity_guardian_ms = guardianResult.duration_ms;

  let continuityFixes = [];
  if (guardianResult.success && !guardianResult.data.passed) {
    const criticalViolations = (guardianResult.data.violations || []).filter(v => v.severity === 'critical');
    continuityFixes = guardianResult.data.suggested_fixes || [];

    if (criticalViolations.length > 0 && continuityFixes.filter(f => f.confidence === 'high').length === 0) {
      console.log(`Ch ${chapter.chapter_number}: ${criticalViolations.length} critical violations — requesting rewrite...`);
      const rewriteResult = await invokeBot(base44, 'bot_proseWriter', {
        project_id: projectId,
        chapter_id: chapterId,
      });
      if (rewriteResult.success && rewriteResult.data.raw_prose?.length > 100) {
        currentProse = rewriteResult.data.raw_prose;
        timings.prose_writer_retry_ms = rewriteResult.duration_ms;
      }
    }
  }

  // ── STEP 4: STYLE ENFORCER ──
  try {
    await base44.entities.Project.update(projectId, {
      generation_status: JSON.stringify({
        current_chapter: chapter.chapter_number,
        current_bot: 'style_enforcer',
      }),
    });
  } catch (e) {}

  console.log(`Ch ${chapter.chapter_number}: Enforcing style...`);
  const styleResult = await invokeBot(base44, 'bot_styleEnforcer', {
    project_id: projectId,
    chapter_id: chapterId,
    prose: currentProse,
    continuity_fixes: continuityFixes,
  });
  timings.style_enforcer_ms = styleResult.duration_ms;

  let finalProse = currentProse;
  let qualityReport = null;
  if (styleResult.success) {
    finalProse = styleResult.data.clean_prose || currentProse;
    qualityReport = styleResult.data.quality_report;
  }

  // ── STEP 5: SAVE CHAPTER ──
  const finalWordCount = finalProse.trim().split(/\s+/).length;

  let contentValue = finalProse;
  if (finalProse.length > 15000) {
    try {
      const contentFile = new File([finalProse], `chapter_${chapterId}.txt`, { type: 'text/plain' });
      const uploadResult = await base44.integrations.Core.UploadFile({ file: contentFile });
      if (uploadResult?.file_url) contentValue = uploadResult.file_url;
    } catch (e) { console.warn('File upload failed, storing directly:', e.message); }
  }

  // Save chapter — retry once on failure since this is the critical write
  const chapterUpdate = {
    content: contentValue,
    status: 'generated',
    word_count: finalWordCount,
    generated_at: new Date().toISOString(),
    quality_scan: qualityReport ? JSON.stringify(qualityReport) : '',
  };
  try {
    await base44.entities.Chapter.update(chapterId, chapterUpdate);
  } catch (saveErr) {
    console.error(`Ch ${chapter.chapter_number}: CRITICAL — chapter save failed, retrying:`, saveErr.message);
    // If the content was too large, try without quality_scan
    try {
      await base44.entities.Chapter.update(chapterId, {
        content: contentValue,
        status: 'generated',
        word_count: finalWordCount,
        generated_at: new Date().toISOString(),
      });
    } catch (retryErr) {
      console.error(`Ch ${chapter.chapter_number}: CRITICAL — retry save also failed:`, retryErr.message);
      await base44.entities.Chapter.update(chapterId, { status: 'error' });
      throw retryErr;
    }
  }

  // ── STEP 6: STATE CHRONICLER ──
  try {
    await base44.entities.Project.update(projectId, {
      generation_status: JSON.stringify({
        current_chapter: chapter.chapter_number,
        current_bot: 'state_chronicler',
      }),
    });
  } catch (e) {}

  console.log(`Ch ${chapter.chapter_number}: Building state document...`);
  const stateResult = await invokeBot(base44, 'bot_stateChronicler', {
    project_id: projectId,
    chapter_id: chapterId,
    final_prose: finalProse,
  });
  timings.state_chronicler_ms = stateResult.duration_ms;

  if (!stateResult.success) {
    console.warn(`Ch ${chapter.chapter_number}: State chronicler failed — chapter still saved`);
  }

  const totalMs = Date.now() - startMs;
  console.log(`Ch ${chapter.chapter_number}: COMPLETE in ${Math.round(totalMs / 1000)}s — ${finalWordCount} words`);

  return {
    success: true, chapter_id: chapterId,
    word_count: finalWordCount, quality_report: qualityReport,
    violations_remaining: styleResult.success ? (styleResult.data.violations_remaining?.length || 0) : 0,
    continuity_violations: guardianResult.success ? (guardianResult.data.violations?.length || 0) : 0,
    generation_time_ms: totalMs, bot_timings: timings,
  };
}

// ── FULL BOOK PIPELINE ──────────────────────────────────────────────────────

async function orchestrateAll(base44, projectId, startFrom) {
  const startMs = Date.now();

  const chapters = await base44.entities.Chapter.filter({ project_id: projectId });
  chapters.sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

  let toWrite = chapters.filter(c => c.status !== 'generated');
  if (startFrom) {
    toWrite = toWrite.filter(c => c.chapter_number >= startFrom);
  }

  if (toWrite.length === 0) {
    return {
      success: true, chapters_written: 0, chapters_failed: 0,
      total_words: chapters.filter(c => c.status === 'generated').reduce((s, c) => s + (c.word_count || 0), 0),
      total_time_ms: 0, failed_chapters: [], message: 'All chapters already written',
    };
  }

  for (const ch of toWrite) {
    if (ch.status === 'error') {
      await base44.entities.Chapter.update(ch.id, { status: 'pending' });
    }
  }

  let successes = 0;
  let totalWords = 0;
  const failedChapters = [];

  for (const ch of toWrite) {
    try {
      const result = await orchestrateChapter(base44, projectId, ch.id);
      if (result.success) {
        successes++;
        totalWords += result.word_count || 0;
      } else {
        failedChapters.push({ chapter_number: ch.chapter_number, error: result.error });
      }
    } catch (err) {
      console.error(`Ch ${ch.chapter_number} failed:`, err.message);
      failedChapters.push({ chapter_number: ch.chapter_number, error: err.message });
      await base44.entities.Chapter.update(ch.id, { status: 'error' });
    }
  }

  try {
    await base44.entities.Project.update(projectId, { generation_status: '' });
  } catch (e) {}

  return {
    success: failedChapters.length === 0,
    chapters_written: successes,
    chapters_failed: failedChapters.length,
    total_words: totalWords,
    total_time_ms: Date.now() - startMs,
    failed_chapters: failedChapters,
  };
}

// ── DENO SERVE ENDPOINT ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body.action || 'write_chapter';

    if (action === 'write_chapter') {
      if (!body.project_id || !body.chapter_id) {
        return Response.json({ error: 'project_id and chapter_id required' }, { status: 400 });
      }
      try {
        const result = await orchestrateChapter(base44, body.project_id, body.chapter_id);
        return Response.json(result);
      } catch (orchErr) {
        // Last-resort catch: if orchestrateChapter throws unexpectedly, reset chapter status
        console.error(`orchestrateChapter crashed for ${body.chapter_id}:`, orchErr.message);
        try {
          await base44.entities.Chapter.update(body.chapter_id, { status: 'error' });
        } catch (resetErr) {
          console.error('Failed to reset chapter status after crash:', resetErr.message);
        }
        return Response.json({ error: orchErr.message, success: false }, { status: 500 });
      }
    }

    if (action === 'write_all') {
      if (!body.project_id) {
        return Response.json({ error: 'project_id required' }, { status: 400 });
      }
      const result = await orchestrateAll(base44, body.project_id, body.start_from);
      return Response.json(result);
    }

    if (action === 'status') {
      if (!body.project_id) {
        return Response.json({ error: 'project_id required' }, { status: 400 });
      }
      const projects = await base44.entities.Project.filter({ id: body.project_id });
      const project = projects[0];
      let status = null;
      if (project?.generation_status) {
        try { status = JSON.parse(project.generation_status); } catch {}
      }
      return Response.json({ status });
    }

    return Response.json({ error: 'Unknown action. Use: write_chapter, write_all, status' }, { status: 400 });
  } catch (error) {
    console.error('bot_orchestrator error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});