import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Resume writing from a specific chapter number.
// Rebuilds state documents for all completed chapters before the target,
// writes the target chapter, then continues sequentially through remaining chapters.

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId, chapterNumber } = await req.json();
    if (!projectId || !chapterNumber) {
      return Response.json({ error: 'projectId and chapterNumber required' }, { status: 400 });
    }

    const chapters = await base44.entities.Chapter.filter(
      { project_id: projectId },
      'chapter_number'
    );
    if (chapters.length === 0) {
      return Response.json({ error: 'No chapters found' }, { status: 400 });
    }

    const targetChapter = chapters.find(c => c.chapter_number === chapterNumber);
    if (!targetChapter) {
      return Response.json({ error: `Chapter ${chapterNumber} not found` }, { status: 404 });
    }

    // Phase 1: Rebuild state documents for all completed chapters before target
    // that are missing their state_document
    const completedBefore = chapters.filter(
      c => c.chapter_number < chapterNumber && c.status === 'generated'
    );

    console.log(`[resume] Rebuilding state for ${completedBefore.length} chapters before ch ${chapterNumber}`);

    for (const ch of completedBefore) {
      if (!ch.state_document) {
        console.log(`[resume] Generating state document for ch ${ch.chapter_number}`);
        try {
          await base44.functions.invoke('generateChapterState', {
            project_id: projectId,
            chapter_id: ch.id,
          });
        } catch (err) {
          console.warn(`[resume] State rebuild failed for ch ${ch.chapter_number}: ${err.message}`);
          // Non-blocking — continue even if state generation fails for one chapter
        }
        await sleep(2000); // Brief pause between state generations
      }
    }

    // Phase 2: Reset the target chapter to pending and write it
    console.log(`[resume] Writing target chapter ${chapterNumber}`);
    await base44.entities.Chapter.update(targetChapter.id, {
      status: 'pending',
      content: '',
      word_count: 0,
      quality_scan: '',
      distinctive_phrases: '',
      state_document: '',
      generated_at: '',
    });

    let success = false;
    let lastError = '';

    // Attempt 1
    try {
      const res = await base44.functions.invoke('writeChapter', {
        project_id: projectId,
        chapter_id: targetChapter.id,
      });
      if (res?.data?.error) {
        lastError = res.data.error;
        console.warn(`[resume] Ch ${chapterNumber} attempt 1 failed: ${lastError}`);
      } else {
        success = true;
      }
    } catch (err) {
      lastError = err.message || String(err);
      console.warn(`[resume] Ch ${chapterNumber} attempt 1 error: ${lastError}`);
    }

    // DB verify
    if (!success) {
      const check = await base44.entities.Chapter.filter({ id: targetChapter.id });
      if (check[0]?.status === 'generated') success = true;
    }

    // Attempt 2 — retry after 15s
    if (!success) {
      console.log(`[resume] Retrying ch ${chapterNumber} in 15s...`);
      await sleep(15000);
      await base44.entities.Chapter.update(targetChapter.id, { status: 'pending' });

      try {
        const res = await base44.functions.invoke('writeChapter', {
          project_id: projectId,
          chapter_id: targetChapter.id,
        });
        if (res?.data?.error) {
          lastError = res.data.error;
        } else {
          success = true;
        }
      } catch (err) {
        lastError = err.message || String(err);
      }

      if (!success) {
        const check2 = await base44.entities.Chapter.filter({ id: targetChapter.id });
        if (check2[0]?.status === 'generated') success = true;
      }
    }

    if (!success) {
      await base44.entities.Chapter.update(targetChapter.id, {
        status: 'error',
        quality_scan: JSON.stringify({ halted: true, error: lastError }),
      });
      return Response.json({
        status: 'failed',
        failed_at: chapterNumber,
        error: lastError,
        message: `Chapter ${chapterNumber} failed after 2 attempts.`,
      });
    }

    // Phase 3: Generate state document for the target chapter
    console.log(`[resume] Generating state for ch ${chapterNumber}`);
    try {
      await base44.functions.invoke('generateChapterState', {
        project_id: projectId,
        chapter_id: targetChapter.id,
      });
    } catch (err) {
      console.warn(`[resume] State gen for target failed: ${err.message}`);
    }

    // Phase 4: Continue with remaining chapters sequentially
    const remaining = chapters.filter(
      c => c.chapter_number > chapterNumber && c.status !== 'generated'
    );

    if (remaining.length === 0) {
      return Response.json({
        status: 'complete',
        writing_from: chapterNumber,
        completed: 1,
        remaining: 0,
        message: `Chapter ${chapterNumber} written. No remaining chapters to write.`,
      });
    }

    console.log(`[resume] Continuing with ${remaining.length} remaining chapters`);

    let completed = 1; // target chapter already done

    for (const ch of remaining) {
      console.log(`[resume] Writing ch ${ch.chapter_number}`);
      await base44.entities.Chapter.update(ch.id, { status: 'pending' });

      let chSuccess = false;
      let chError = '';

      // Attempt 1
      try {
        const res = await base44.functions.invoke('writeChapter', {
          project_id: projectId,
          chapter_id: ch.id,
        });
        if (res?.data?.error) {
          chError = res.data.error;
        } else {
          chSuccess = true;
        }
      } catch (err) {
        chError = err.message || String(err);
      }

      if (!chSuccess) {
        const check = await base44.entities.Chapter.filter({ id: ch.id });
        if (check[0]?.status === 'generated') chSuccess = true;
      }

      // Retry
      if (!chSuccess) {
        console.log(`[resume] Retrying ch ${ch.chapter_number} in 15s...`);
        await sleep(15000);
        await base44.entities.Chapter.update(ch.id, { status: 'pending' });

        try {
          const res = await base44.functions.invoke('writeChapter', {
            project_id: projectId,
            chapter_id: ch.id,
          });
          if (res?.data?.error) chError = res.data.error;
          else chSuccess = true;
        } catch (err) {
          chError = err.message || String(err);
        }

        if (!chSuccess) {
          const check2 = await base44.entities.Chapter.filter({ id: ch.id });
          if (check2[0]?.status === 'generated') chSuccess = true;
        }
      }

      if (!chSuccess) {
        await base44.entities.Chapter.update(ch.id, {
          status: 'error',
          quality_scan: JSON.stringify({ halted: true, error: chError }),
        });

        return Response.json({
          status: 'paused',
          writing_from: chapterNumber,
          completed,
          failed_at: ch.chapter_number,
          error: chError,
          message: `Halted at chapter ${ch.chapter_number} after retry. ${completed} chapter(s) written from ch ${chapterNumber}.`,
        });
      }

      completed++;
      console.log(`[resume] Ch ${ch.chapter_number} complete (${completed} total from resume)`);

      // Generate state document
      try {
        await base44.functions.invoke('generateChapterState', {
          project_id: projectId,
          chapter_id: ch.id,
        });
      } catch (err) {
        console.warn(`[resume] State gen failed for ch ${ch.chapter_number}: ${err.message}`);
      }

      await sleep(5000);
    }

    return Response.json({
      status: 'complete',
      writing_from: chapterNumber,
      completed,
      message: `All ${completed} chapter(s) written successfully from chapter ${chapterNumber}.`,
    });
  } catch (error) {
    console.error('resumeFromChapter error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});