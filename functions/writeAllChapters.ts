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

    // Find chapters that need writing
    const toWrite = chapters.filter(c => c.status !== 'generated');

    if (toWrite.length === 0) {
      return Response.json({
        success: true,
        totalChapters: chapters.length,
        completedChapters: chapters.length,
        failedChapters: 0,
        totalTimeSeconds: 0,
        message: 'All chapters already written',
      });
    }

    const results = [];
    const startTime = Date.now();

    // Write chapters sequentially — each writeChapter call awaits full generation
    for (let i = 0; i < toWrite.length; i++) {
      const chapter = toWrite[i];
      const chapterNum = chapter.chapter_number;

      console.log(`[${i + 1}/${toWrite.length}] Writing chapter ${chapterNum}: "${chapter.title}"...`);

      try {
        // writeChapter runs synchronously — it awaits the full AI generation
        // Using asServiceRole so it stays within the same server context
        const writeResp = await base44.asServiceRole.functions.invoke('writeChapter', {
          project_id: projectId,
          chapter_id: chapter.id,
        });

        if (writeResp.data?.success) {
          console.log(`✓ Chapter ${chapterNum} complete`);
          results.push({ chapterNumber: chapterNum, success: true });
        } else {
          console.warn(`✗ Chapter ${chapterNum} returned error:`, writeResp.data?.error);
          results.push({ chapterNumber: chapterNum, success: false, message: writeResp.data?.error || 'Unknown error' });
        }
      } catch (err) {
        console.error(`✗ Chapter ${chapterNum} exception:`, err.message);
        // Mark as error if not already
        try { await base44.entities.Chapter.update(chapter.id, { status: 'error' }); } catch {}
        results.push({ chapterNumber: chapterNum, success: false, message: err.message });
      }

      // Brief pause between chapters to avoid rate limits
      if (i < toWrite.length - 1) {
        console.log('Pausing 5s before next chapter...');
        await new Promise(r => setTimeout(r, 5000));
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