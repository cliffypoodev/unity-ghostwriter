import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId } = await req.json();
    if (!projectId) return Response.json({ error: 'projectId required' }, { status: 400 });

    const [specs, chapters] = await Promise.all([
      base44.entities.Specification.filter({ project_id: projectId }),
      base44.entities.Chapter.filter({ project_id: projectId }, "chapter_number"),
    ]);

    const spec = specs[0];
    if (spec?.book_type === 'nonfiction') {
      return Response.json({ done: true, skipped: true, reason: 'Scenes are not used for nonfiction books', total: 0 });
    }

    // Find chapters that don't have scenes yet
    const chaptersWithoutScenes = chapters.filter(c => {
      if (!c.scenes) return true;
      const s = c.scenes.trim();
      return s === '' || s === 'null' || s === '[]';
    });

    if (chaptersWithoutScenes.length === 0) {
      return Response.json({ done: true, total: 0, message: 'All chapters already have scenes' });
    }

    // Return the list — frontend will call generateScenes for each chapter directly
    console.log(`${chaptersWithoutScenes.length} chapters need scenes in project ${projectId}`);
    return Response.json({
      done: false,
      total: chaptersWithoutScenes.length,
      message: `${chaptersWithoutScenes.length} chapters need scenes`,
      chapters: chaptersWithoutScenes.map(c => ({ id: c.id, chapter_number: c.chapter_number, title: c.title })),
    });
  } catch (error) {
    console.error('generateAllScenes error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});