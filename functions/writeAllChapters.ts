import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// This function is now a lightweight kickoff — it resets pending chapters
// and returns the list of chapters that need writing.
// The FRONTEND drives sequential writeChapter calls one at a time.

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

    // Find chapters that need writing (not yet generated)
    const toWrite = chapters.filter(c => c.status !== 'generated');

    if (toWrite.length === 0) {
      return Response.json({
        success: true,
        toWrite: [],
        message: 'All chapters already written',
      });
    }

    // Reset any stuck "generating" or "error" chapters back to pending
    for (const ch of toWrite) {
      if (ch.status === 'generating' || ch.status === 'error') {
        await base44.entities.Chapter.update(ch.id, { status: 'pending' });
      }
    }

    // Return the list — frontend will drive sequential writeChapter calls
    return Response.json({
      success: true,
      toWrite: toWrite.map(c => ({
        id: c.id,
        chapter_number: c.chapter_number,
        title: c.title,
      })),
      message: `${toWrite.length} chapters ready for writing`,
    });
  } catch (error) {
    console.error('writeAllChapters error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});