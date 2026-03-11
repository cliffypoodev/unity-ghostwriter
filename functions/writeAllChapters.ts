import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Fire-and-forget dispatcher: identifies chapters needing writing,
// dispatches writeChapter for each one via non-awaited async calls,
// and returns immediately. The frontend polls chapter status individually.

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

    // Find chapters that need writing (pending or error)
    const toWrite = chapters.filter(c => c.status === 'pending' || c.status === 'error');

    if (toWrite.length === 0) {
      return Response.json({
        success: true,
        dispatched: 0,
        message: 'All chapters already written or in progress',
      });
    }

    // Reset any error chapters back to pending before dispatching
    for (const ch of toWrite) {
      if (ch.status === 'error') {
        await base44.entities.Chapter.update(ch.id, { status: 'pending' });
      }
    }

    // Fire-and-forget: dispatch writeChapter for each chapter with staggered timing.
    // These calls are NOT awaited — the function returns immediately after dispatching.
    let dispatchCount = 0;
    for (const ch of toWrite) {
      const delay = dispatchCount * 10000; // 10-second stagger between dispatches
      
      // Use setTimeout for non-blocking staggered dispatch
      setTimeout(() => {
        base44.functions.invoke('writeChapter', {
          project_id: projectId,
          chapter_id: ch.id,
        }).catch(err => {
          console.error(`Dispatch error for chapter ${ch.chapter_number}:`, err.message);
        });
      }, delay);

      dispatchCount++;
    }

    // Return immediately — all dispatches are fire-and-forget
    return Response.json({
      success: true,
      dispatched: dispatchCount,
      chapters: toWrite.map(c => ({
        id: c.id,
        chapter_number: c.chapter_number,
        title: c.title,
      })),
      message: `${dispatchCount} chapter(s) dispatched for writing with 10s stagger`,
    });
  } catch (error) {
    console.error('writeAllChapters error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});