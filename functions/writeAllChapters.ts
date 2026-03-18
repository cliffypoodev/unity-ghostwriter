import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Lightweight dispatcher: validates project, resets error chapters, and returns the list
// of chapters to write. The frontend drives the sequential writing loop.

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

    // Find chapters that need writing (pending or error)
    const toWrite = chapters
      .filter(c => c.status === 'pending' || c.status === 'error')
      .sort((a, b) => a.chapter_number - b.chapter_number);

    if (toWrite.length === 0) {
      return Response.json({
        status: 'complete',
        completed: chapters.filter(c => c.status === 'generated').length,
        total: chapters.length,
        toWrite: [],
        message: 'All chapters already written',
      });
    }

    // Reset error chapters to pending
    for (const ch of toWrite) {
      if (ch.status === 'error') {
        await base44.entities.Chapter.update(ch.id, { status: 'pending' });
      }
    }

    return Response.json({
      status: 'ready',
      completed: chapters.filter(c => c.status === 'generated').length,
      total: chapters.length,
      toWrite: toWrite.map(c => ({ id: c.id, chapter_number: c.chapter_number, title: c.title })),
      message: `${toWrite.length} chapter(s) ready to write`,
    });
  } catch (error) {
    console.error('writeAllChapters error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});