import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await req.json();

    if (!projectId) {
      return Response.json({ error: 'projectId required' }, { status: 400 });
    }

    // Fetch all chapters for this project
    const chapters = await base44.entities.Chapter.filter(
      { project_id: projectId },
      'chapter_number'
    );

    if (chapters.length === 0) {
      return Response.json({ error: 'No chapters found' }, { status: 400 });
    }

    // Find the first chapter that is NOT generated (to start writing from there)
    const firstPendingIndex = chapters.findIndex(c => c.status !== 'generated');
    const startIndex = firstPendingIndex === -1 ? chapters.length : firstPendingIndex;

    // If all chapters already written, return early
    if (startIndex >= chapters.length) {
      return Response.json({
        success: true,
        totalChapters: chapters.length,
        completedChapters: chapters.length,
        failedChapters: 0,
        totalTimeSeconds: 0,
        results: [],
        message: 'All chapters already written',
      });
    }

    const results = [];
    const startTime = Date.now();

    for (let i = startIndex; i < chapters.length; i++) {
      const chapter = chapters[i];
      const chapterNum = chapter.chapter_number;

      console.log(`Writing chapter ${chapterNum} of ${chapters.length}...`);

      // Call writeChapter function (it fires async generation and returns immediately)
      try {
        const writeResp = await base44.asServiceRole.functions.invoke('writeChapter', {
          project_id: projectId,
          chapter_id: chapter.id,
        });

        // Wait for the async generation to complete by polling chapter status
        // writeChapter returns immediately but generation runs in background
        let pollAttempts = 0;
        const maxPollAttempts = 120; // 10 minutes max per chapter (120 * 5s)
        let chapterDone = false;

        while (pollAttempts < maxPollAttempts) {
          await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds between polls
          pollAttempts++;

          const updatedChapters = await base44.entities.Chapter.filter({ project_id: projectId });
          const updatedChapter = updatedChapters.find(c => c.id === chapter.id);

          if (updatedChapter?.status === 'generated') {
            chapterDone = true;
            console.log(`✓ Chapter ${chapterNum} complete (${updatedChapter.word_count || 0} words)`);
            results.push({
              chapterNumber: chapterNum,
              chapterId: chapter.id,
              success: true,
              message: `Chapter written (${updatedChapter.word_count || 0} words)`,
            });
            break;
          } else if (updatedChapter?.status === 'error') {
            console.warn(`✗ Chapter ${chapterNum} failed`);
            results.push({
              chapterNumber: chapterNum,
              chapterId: chapter.id,
              success: false,
              message: 'Chapter generation failed',
            });
            chapterDone = true;
            break;
          }
          // Still generating, keep polling...
        }

        if (!chapterDone) {
          console.warn(`Chapter ${chapterNum} timed out after ${maxPollAttempts * 5}s`);
          results.push({
            chapterNumber: chapterNum,
            chapterId: chapter.id,
            success: false,
            message: 'Chapter generation timed out',
          });
        }
      } catch (err) {
        await base44.entities.Chapter.update(chapter.id, { status: 'error' });
        results.push({
          chapterNumber: chapterNum,
          chapterId: chapter.id,
          success: false,
          message: err.message || 'Failed to write chapter',
        });
      }

      // Brief pause between chapter launches to avoid rate limits
      if (i < chapters.length - 1) {
        console.log(`Pausing 10s before next chapter to avoid rate limits...`);
        await new Promise(r => setTimeout(r, 10000));
      }
    }

    const totalTime = Math.floor((Date.now() - startTime) / 1000);

    return Response.json({
      success: true,
      totalChapters: chapters.length,
      completedChapters: results.filter(r => r.success).length,
      failedChapters: results.filter(r => !r.success).length,
      totalTimeSeconds: totalTime,
      results,
    });
  } catch (error) {
    console.error('writeAllChapters error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});