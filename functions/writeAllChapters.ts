import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Sequential chapter writer with dependency blocking.
// Each chapter must succeed before the next is dispatched.
// On failure: auto-retry once after 15s delay. If retry fails, halt the queue.

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId } = await req.json();
    if (!projectId) return Response.json({ error: 'projectId required' }, { status: 400 });

    const chapters = await base44.entities.Chapter.filter(
      { project_id: projectId },
      'chapter_number'
    );
    if (chapters.length === 0) {
      return Response.json({ error: 'No chapters found' }, { status: 400 });
    }

    // Find chapters that need writing (pending or error), sorted by chapter_number
    const toWrite = chapters
      .filter(c => c.status === 'pending' || c.status === 'error')
      .sort((a, b) => a.chapter_number - b.chapter_number);

    if (toWrite.length === 0) {
      return Response.json({
        status: 'complete',
        completed: chapters.filter(c => c.status === 'generated').length,
        total: chapters.length,
        message: 'All chapters already written',
      });
    }

    // Reset error chapters to pending
    for (const ch of toWrite) {
      if (ch.status === 'error') {
        await base44.entities.Chapter.update(ch.id, { status: 'pending' });
      }
    }

    let completedCount = chapters.filter(c => c.status === 'generated').length;

    for (const ch of toWrite) {
      console.log(`[writeAll] Starting chapter ${ch.chapter_number}: "${ch.title}"`);

      // Attempt 1
      let success = false;
      let lastError = '';
      try {
        const res = await base44.functions.invoke('writeChapter', {
          project_id: projectId,
          chapter_id: ch.id,
        });
        // writeChapter returns { success: true } on success or throws/returns error
        if (res?.data?.error) {
          lastError = res.data.error;
          console.warn(`[writeAll] Chapter ${ch.chapter_number} attempt 1 failed: ${lastError}`);
        } else {
          success = true;
        }
      } catch (err) {
        lastError = err.message || String(err);
        console.warn(`[writeAll] Chapter ${ch.chapter_number} attempt 1 error: ${lastError}`);
      }

      // Verify actual chapter status from DB (writeChapter may have set it)
      if (!success) {
        const freshChapters = await base44.entities.Chapter.filter({ id: ch.id });
        if (freshChapters[0]?.status === 'generated') {
          success = true;
          console.log(`[writeAll] Chapter ${ch.chapter_number} actually succeeded (DB check)`);
        }
      }

      // Attempt 2 — automatic retry after 15s delay
      if (!success) {
        console.log(`[writeAll] Retrying chapter ${ch.chapter_number} in 15s...`);
        await sleep(15000);

        // Reset status to pending for retry
        await base44.entities.Chapter.update(ch.id, { status: 'pending' });

        try {
          const res = await base44.functions.invoke('writeChapter', {
            project_id: projectId,
            chapter_id: ch.id,
          });
          if (res?.data?.error) {
            lastError = res.data.error;
            console.warn(`[writeAll] Chapter ${ch.chapter_number} attempt 2 failed: ${lastError}`);
          } else {
            success = true;
          }
        } catch (err) {
          lastError = err.message || String(err);
          console.warn(`[writeAll] Chapter ${ch.chapter_number} attempt 2 error: ${lastError}`);
        }

        // DB check again
        if (!success) {
          const freshChapters2 = await base44.entities.Chapter.filter({ id: ch.id });
          if (freshChapters2[0]?.status === 'generated') {
            success = true;
            console.log(`[writeAll] Chapter ${ch.chapter_number} retry actually succeeded (DB check)`);
          }
        }
      }

      if (!success) {
        // Mark as error and halt the entire queue
        await base44.entities.Chapter.update(ch.id, {
          status: 'error',
          quality_scan: JSON.stringify({ halted: true, error: lastError }),
        });

        console.error(`[writeAll] HALTING at chapter ${ch.chapter_number} after 2 attempts`);

        return Response.json({
          status: 'paused',
          completed: completedCount,
          failed_at: ch.chapter_number,
          failed_chapter_id: ch.id,
          error: lastError,
          message: `Chapter ${ch.chapter_number} failed after retry. Resolve before continuing.`,
        });
      }

      // Chapter succeeded — increment and continue
      completedCount++;
      console.log(`[writeAll] Chapter ${ch.chapter_number} complete (${completedCount}/${chapters.length} total)`);

      // Brief pause between chapters to avoid rate limits
      if (toWrite.indexOf(ch) < toWrite.length - 1) {
        await sleep(5000);
      }
    }

    return Response.json({
      status: 'complete',
      completed: completedCount,
      total: chapters.length,
      message: `All ${toWrite.length} chapter(s) written successfully`,
    });
  } catch (error) {
    console.error('writeAllChapters error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});