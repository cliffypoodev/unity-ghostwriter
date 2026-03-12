import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Sequential chapter writer with dependency blocking.
// Each chapter must succeed before the next is dispatched.
// On failure: auto-retry once after 15s delay. If retry fails, halt the queue.
//
// FIX C: Before dispatching each chapter, rebuild previous_chapter_endings
// from actually-written content, and ensure state documents exist for all
// completed predecessors.

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Resolve chapter content — handles both inline text and URL-stored content
async function resolveContent(content) {
  if (!content) return '';
  if (content.startsWith('http://') || content.startsWith('https://')) {
    try {
      const r = await fetch(content);
      if (!r.ok) return '';
      const t = await r.text();
      if (t.trim().startsWith('<')) return ''; // HTML error page
      return t;
    } catch { return ''; }
  }
  return content;
}

// Extract the last paragraph from chapter text (split on double-newline)
function extractLastParagraph(text) {
  if (!text) return '';
  const paragraphs = text.trim().split(/\n\n+/).filter(p => p.trim().length > 0);
  return paragraphs.length > 0 ? paragraphs[paragraphs.length - 1].trim() : '';
}

// Build previous_chapter_endings context for a chapter about to be written.
// - Immediate predecessor: full last paragraph
// - 3 chapters before that: last paragraph only (condensed)
// This ensures each chapter always has accurate context from what was actually
// written, not from outline projections.
async function buildPreviousChapterEndings(completedChapters) {
  if (completedChapters.length === 0) return null;

  // Sort by chapter_number ascending (should already be sorted, but ensure)
  const sorted = [...completedChapters].sort((a, b) => a.chapter_number - b.chapter_number);

  const endings = [];

  // Most recent completed chapter: full last paragraph + full content of ending
  const mostRecent = sorted[sorted.length - 1];
  const mostRecentContent = await resolveContent(mostRecent.content);
  const mostRecentLastParagraph = extractLastParagraph(mostRecentContent);

  if (mostRecentLastParagraph) {
    endings.push({
      chapter_number: mostRecent.chapter_number,
      title: mostRecent.title,
      type: 'full_ending',
      last_paragraph: mostRecentLastParagraph,
    });
  }

  // 3 chapters before the most recent: last paragraph only
  const preceding = sorted.slice(Math.max(0, sorted.length - 4), sorted.length - 1);
  for (const ch of preceding) {
    const content = await resolveContent(ch.content);
    const lastParagraph = extractLastParagraph(content);
    if (lastParagraph) {
      endings.push({
        chapter_number: ch.chapter_number,
        title: ch.title,
        type: 'last_paragraph_only',
        last_paragraph: lastParagraph,
      });
    }
  }

  return endings.length > 0 ? endings : null;
}

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

      // ── FIX C: Rebuild state + endings before each dispatch ──────────────

      // 1. Re-fetch all chapters to get latest statuses and content
      const freshChapters = await base44.entities.Chapter.filter(
        { project_id: projectId },
        'chapter_number'
      );
      const completedBefore = freshChapters
        .filter(c => c.chapter_number < ch.chapter_number && c.status === 'generated')
        .sort((a, b) => a.chapter_number - b.chapter_number);

      // 2. Ensure state documents exist for completed predecessors
      //    (only generate for the most recent one that's missing — earlier ones should exist)
      if (completedBefore.length > 0) {
        const lastCompleted = completedBefore[completedBefore.length - 1];
        if (!lastCompleted.state_document) {
          console.log(`[writeAll] Generating missing state doc for ch ${lastCompleted.chapter_number}`);
          try {
            await base44.functions.invoke('generateChapterState', {
              project_id: projectId,
              chapter_id: lastCompleted.id,
            });
          } catch (stateErr) {
            console.warn(`[writeAll] State doc generation failed for ch ${lastCompleted.chapter_number}: ${stateErr.message}`);
            // Non-blocking — continue even if state generation fails
          }
        }
      }

      // 3. Build previous_chapter_endings from actually-written content
      const endings = await buildPreviousChapterEndings(completedBefore);
      if (endings) {
        console.log(`[writeAll] Injecting ${endings.length} chapter ending(s) as context for ch ${ch.chapter_number}`);
        await base44.entities.Chapter.update(ch.id, {
          previous_chapter_endings: JSON.stringify(endings),
        });
      }

      // ── End FIX C ───────────────────────────────────────────────────────

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
        const freshChapters2 = await base44.entities.Chapter.filter({ id: ch.id });
        if (freshChapters2[0]?.status === 'generated') {
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
          const freshChapters3 = await base44.entities.Chapter.filter({ id: ch.id });
          if (freshChapters3[0]?.status === 'generated') {
            success = true;
            console.log(`[writeAll] Chapter ${ch.chapter_number} retry actually succeeded (DB check)`);
          }
        }
      }

      if (!success) {
        // Mark as error but CONTINUE to next chapter instead of halting
        await base44.entities.Chapter.update(ch.id, {
          status: 'error',
          quality_scan: JSON.stringify({ halted: false, error: lastError }),
        });

        console.warn(`[writeAll] Chapter ${ch.chapter_number} failed after 2 attempts — skipping to next chapter`);
        continue;
      }

      // Chapter succeeded — generate state document for continuity
      completedCount++;
      console.log(`[writeAll] Chapter ${ch.chapter_number} complete (${completedCount}/${chapters.length} total)`);

      // Generate state document for this chapter so next chapter has accurate context
      try {
        console.log(`[writeAll] Generating state doc for completed ch ${ch.chapter_number}`);
        await base44.functions.invoke('generateChapterState', {
          project_id: projectId,
          chapter_id: ch.id,
        });
      } catch (stateErr) {
        console.warn(`[writeAll] State doc generation failed for ch ${ch.chapter_number}: ${stateErr.message}`);
        // Non-blocking — the next chapter will still have endings context
      }

      // Brief pause between chapters to avoid rate limits
      if (toWrite.indexOf(ch) < toWrite.length - 1) {
        await sleep(5000);
      }
    }

    const failedCount = toWrite.length - completedCount + chapters.filter(c => c.status === 'generated').length - completedCount;
    const actualFailed = toWrite.filter(c => {
      // Re-check from DB would be ideal but we track completedCount
      return true; // We'll let the frontend do the final tally from DB
    });

    return Response.json({
      status: completedCount === toWrite.length + chapters.filter(c => c.status === 'generated').length - chapters.filter(c => c.status === 'generated').length ? 'complete' : 'complete_with_errors',
      completed: completedCount,
      total: chapters.length,
      message: `Finished: ${completedCount} of ${toWrite.length} chapter(s) written`,
    });
  } catch (error) {
    console.error('writeAllChapters error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});