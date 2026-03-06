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

    // Find the last fully written chapter
    const lastWrittenIndex = chapters.findIndex(c => c.status === 'generated', 0);
    const startIndex = lastWrittenIndex === -1 ? 0 : lastWrittenIndex + 1;

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
      const chapterNum = i + 1;

      // Update chapter status to "generating"
      await base44.entities.Chapter.update(chapter.id, { status: 'generating' });

      // Call writeChapter function
      try {
        const writeResp = await base44.asServiceRole.functions.invoke('writeChapter', {
          projectId,
          chapterId: chapter.id,
          chapterNumber: chapter.chapter_number,
          title: chapter.title,
          prompt: chapter.prompt,
        });

        results.push({
          chapterNumber: chapterNum,
          chapterId: chapter.id,
          success: true,
          message: 'Chapter written successfully',
        });
      } catch (err) {
        await base44.entities.Chapter.update(chapter.id, { status: 'error' });
        results.push({
          chapterNumber: chapterNum,
          chapterId: chapter.id,
          success: false,
          message: err.message || 'Failed to write chapter',
        });
      }

      // Calculate elapsed time
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const avgTimePerChapter = elapsed / chapterNum;
      const remainingChapters = chapters.length - chapterNum;
      const estimatedRemaining = Math.ceil(avgTimePerChapter * remainingChapters);

      // Send progress update to client (via SSE or return intermediate)
      // For now, we'll just track and return all at end
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