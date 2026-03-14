// ═══════════════════════════════════════════════════════════════════════════════
// BOT 6 — ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════
// One job: Coordinate the other 5 bots for single-chapter or full-book generation.
// Replaces: writeChapter.ts endpoint, writeAllChapters.ts, frontend polling loop.
//
// Actions:
//   write_chapter  — Generate one chapter through the full bot pipeline
//   write_all      — Generate all pending chapters sequentially
//   status         — Check current generation progress
// ═══════════════════════════════════════════════════════════════════════════════

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { resolveContent } from '../shared/dataLoader.ts';

// ── BOT INVOCATIONS ─────────────────────────────────────────────────────────
// Each bot is its own Deno.serve endpoint. The orchestrator calls them via
// base44.functions.invoke() which routes through Base44's function infrastructure.

async function invokeBot(base44, botName, payload) {
  const startMs = Date.now();
  try {
    const result = await base44.functions.invoke(botName, payload, { timeout: 600000 });
    return { success: true, data: result.data || result, duration_ms: Date.now() - startMs };
  } catch (err) {
    console.error(`Bot ${botName} failed:`, err.message);
    return { success: false, error: err.message, duration_ms: Date.now() - startMs };
  }
}

// ── SINGLE CHAPTER PIPELINE ─────────────────────────────────────────────────

async function orchestrateChapter(base44, projectId, chapterId) {
  const startMs = Date.now();
  const timings = {};

  // Mark chapter as generating
  await base44.entities.Chapter.update(chapterId, { status: 'generating' });

  // Load chapter to check if scenes exist
  const chapters = await base44.entities.Chapter.filter({ project_id: projectId });
  const chapter = chapters.find(c => c.id === chapterId);
  if (!chapter) throw new Error('Chapter not found: ' + chapterId);

  const specs = await base44.entities.Specification.filter({ project_id: projectId });
  const spec = specs[0];
  const isNonfiction = spec?.book_type === 'nonfiction';

  // Update project status for progress tracking
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
    const sceneResult = await invokeBot(base44, 'sceneArchitect', {
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
  const proseResult = await invokeBot(base44, 'proseWriter', {
    project_id: projectId,
    chapter_id: chapterId,
  });
  timings.prose_writer_ms = proseResult.duration_ms;

  if (!proseResult.success) {
    await base44.entities.Chapter.update(chapterId, { status: 'error' });
    return {
      success: false,
      chapter_id: chapterId,
      error: 'Prose generation failed: ' + proseResult.error,
      timings,
      duration_ms: Date.now() - startMs,
    };
  }

  let currentProse = proseResult.data.raw_prose;
  const refusalDetected = proseResult.data.refusal_detected;

  if (!currentProse || currentProse.length < 100) {
    await base44.entities.Chapter.update(chapterId, { status: 'error' });
    return {
      success: false,
      chapter_id: chapterId,
      error: refusalDetected ? 'AI refused to generate content' : 'Generated prose too short',
      timings,
      duration_ms: Date.now() - startMs,
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
  const guardianResult = await invokeBot(base44, 'continuityGuardian', {
    project_id: projectId,
    chapter_id: chapterId,
    raw_prose: currentProse,
  });
  timings.continuity_guardian_ms = guardianResult.duration_ms;

  let continuityFixes = [];
  if (guardianResult.success && !guardianResult.data.passed) {
    const criticalViolations = (guardianResult.data.violations || []).filter(v => v.severity === 'critical');
    continuityFixes = guardianResult.data.suggested_fixes || [];

    // If critical violations with high-confidence fixes, apply them
    // If critical violations WITHOUT fixes, do ONE prose rewrite with violation context
    if (criticalViolations.length > 0 && continuityFixes.filter(f => f.confidence === 'high').length === 0) {
      console.log(`Ch ${chapter.chapter_number}: ${criticalViolations.length} critical violations — requesting rewrite...`);
      const violationContext = criticalViolations.map(v => `- ${v.type}: ${v.description}`).join('\n');

      // One targeted rewrite attempt
      const rewriteResult = await invokeBot(base44, 'proseWriter', {
        project_id: projectId,
        chapter_id: chapterId,
        // TODO: Pass violation context into prompt via model_override or additional field
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
  const styleResult = await invokeBot(base44, 'styleEnforcer', {
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

  // Handle large content — upload as file
  let contentValue = finalProse;
  if (finalProse.length > 15000) {
    try {
      const contentFile = new File([finalProse], `chapter_${chapterId}.txt`, { type: 'text/plain' });
      const uploadResult = await base44.integrations.Core.UploadFile({ file: contentFile });
      if (uploadResult?.file_url) contentValue = uploadResult.file_url;
    } catch (e) { console.warn('File upload failed, storing directly:', e.message); }
  }

  await base44.entities.Chapter.update(chapterId, {
    content: contentValue,
    status: 'generated',
    word_count: finalWordCount,
    generated_at: new Date().toISOString(),
    quality_scan: qualityReport ? JSON.stringify(qualityReport) : '',
  });

  // ── STEP 6: STATE CHRONICLER (MUST complete before next chapter) ──
  try {
    await base44.entities.Project.update(projectId, {
      generation_status: JSON.stringify({
        current_chapter: chapter.chapter_number,
        current_bot: 'state_chronicler',
      }),
    });
  } catch (e) {}

  console.log(`Ch ${chapter.chapter_number}: Building state document...`);
  const stateResult = await invokeBot(base44, 'stateChronicler', {
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
    success: true,
    chapter_id: chapterId,
    word_count: finalWordCount,
    quality_report: qualityReport,
    violations_remaining: styleResult.success ? (styleResult.data.violations_remaining?.length || 0) : 0,
    continuity_violations: guardianResult.success ? (guardianResult.data.violations?.length || 0) : 0,
    generation_time_ms: totalMs,
    bot_timings: timings,
  };
}

// ── FULL BOOK PIPELINE ──────────────────────────────────────────────────────

async function orchestrateAll(base44, projectId, startFrom) {
  const startMs = Date.now();

  const chapters = await base44.entities.Chapter.filter({ project_id: projectId });
  chapters.sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

  // Filter to chapters that need writing
  let toWrite = chapters.filter(c => c.status !== 'generated');
  if (startFrom) {
    toWrite = toWrite.filter(c => c.chapter_number >= startFrom);
  }

  if (toWrite.length === 0) {
    return {
      success: true,
      chapters_written: 0,
      chapters_failed: 0,
      total_words: chapters.filter(c => c.status === 'generated').reduce((s, c) => s + (c.word_count || 0), 0),
      total_time_ms: 0,
      failed_chapters: [],
      message: 'All chapters already written',
    };
  }

  // Reset error chapters to pending
  for (const ch of toWrite) {
    if (ch.status === 'error') {
      await base44.entities.Chapter.update(ch.id, { status: 'pending' });
    }
  }

  let successes = 0;
  let totalWords = 0;
  const failedChapters = [];

  for (let i = 0; i < toWrite.length; i++) {
    const ch = toWrite[i];

    // Update progress
    try {
      await base44.entities.Project.update(projectId, {
        generation_status: JSON.stringify({
          action: 'write_all',
          current_chapter: ch.chapter_number,
          current_index: i,
          total: toWrite.length,
          successes,
          failures: failedChapters.length,
          started_at: new Date().toISOString(),
        }),
      });
    } catch (e) {}

    console.log(`\n=== WRITE ALL: Chapter ${ch.chapter_number} (${i + 1}/${toWrite.length}) ===`);

    try {
      const result = await orchestrateChapter(base44, projectId, ch.id);

      if (result.success) {
        successes++;
        totalWords += result.word_count;

        // Brief pause for rate limiting
        if (i < toWrite.length - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      } else {
        failedChapters.push({
          chapter_number: ch.chapter_number,
          title: ch.title,
          error: result.error || 'Unknown error',
        });
      }
    } catch (err) {
      console.error(`Ch ${ch.chapter_number} orchestration error:`, err.message);
      failedChapters.push({
        chapter_number: ch.chapter_number,
        title: ch.title,
        error: err.message,
      });
      // Mark as error and continue
      try { await base44.entities.Chapter.update(ch.id, { status: 'error' }); } catch (e) {}
    }
  }

  // Final status
  try {
    await base44.entities.Project.update(projectId, {
      generation_status: JSON.stringify({
        action: 'write_all',
        status: 'complete',
        successes,
        failures: failedChapters.length,
        total_words: totalWords,
        duration_ms: Date.now() - startMs,
        completed_at: new Date().toISOString(),
      }),
    });
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

// ── STATUS CHECK ────────────────────────────────────────────────────────────

async function getStatus(base44, projectId) {
  const projects = await base44.entities.Project.filter({ id: projectId });
  const project = projects[0];
  if (!project) return { error: 'Project not found' };

  let status = {};
  if (project.generation_status) {
    try { status = JSON.parse(project.generation_status); } catch {}
  }

  const chapters = await base44.entities.Chapter.filter({ project_id: projectId });
  const complete = chapters.filter(c => c.status === 'generated');
  const pending = chapters.filter(c => c.status === 'pending' || c.status === 'generating');
  const errors = chapters.filter(c => c.status === 'error');

  return {
    ...status,
    chapters_complete: complete.length,
    chapters_pending: pending.length,
    chapters_error: errors.length,
    chapters_total: chapters.length,
    total_words: complete.reduce((s, c) => s + (c.word_count || 0), 0),
  };
}

// ── DENO SERVE ENDPOINT ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, project_id, chapter_id, start_from } = body;

    if (!project_id) return Response.json({ error: 'project_id required' }, { status: 400 });

    if (action === 'write_chapter') {
      if (!chapter_id) return Response.json({ error: 'chapter_id required for write_chapter' }, { status: 400 });
      const result = await orchestrateChapter(base44, project_id, chapter_id);
      return Response.json(result);
    }

    if (action === 'write_all') {
      const result = await orchestrateAll(base44, project_id, start_from);
      return Response.json(result);
    }

    if (action === 'status') {
      const result = await getStatus(base44, project_id);
      return Response.json(result);
    }

    return Response.json({
      error: 'Unknown action. Use: write_chapter, write_all, status',
    }, { status: 400 });

  } catch (error) {
    console.error('orchestrator error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
