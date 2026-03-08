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

    // Fire off scene generation in parallel for all chapters — returns immediately
    chaptersWithoutScenes.forEach(chapter => {
      base44.functions.invoke('generateScenes', {
        projectId,
        chapterNumber: chapter.chapter_number,
      }).catch(err => console.error(`Scene gen failed for chapter ${chapter.chapter_number}:`, err.message));
    });

    console.log(`Kicked off scene generation for ${chaptersWithoutScenes.length} chapters in project ${projectId}`);
    return Response.json({
      async: true,
      total: chaptersWithoutScenes.length,
      message: `Scene generation started for ${chaptersWithoutScenes.length} chapters`,
      chapters: chaptersWithoutScenes.map(c => ({ id: c.id, chapter_number: c.chapter_number, title: c.title })),
    });
  } catch (error) {
    console.error('generateAllScenes error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});