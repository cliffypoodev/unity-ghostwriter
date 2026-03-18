import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { project_id } = await req.json();
    if (!project_id) {
      return Response.json({ error: 'project_id required' }, { status: 400 });
    }

    // Delete all related records in parallel
    const [specs, outlines, chapters, conversations, sourceFiles] = await Promise.all([
      base44.entities.Specification.filter({ project_id }),
      base44.entities.Outline.filter({ project_id }),
      base44.entities.Chapter.filter({ project_id }),
      base44.entities.Conversation.filter({ project_id }),
      base44.entities.SourceFile.filter({ project_id }),
    ]);

    const deletePromises = [];
    for (const s of specs) deletePromises.push(base44.entities.Specification.delete(s.id));
    for (const o of outlines) deletePromises.push(base44.entities.Outline.delete(o.id));
    for (const c of chapters) deletePromises.push(base44.entities.Chapter.delete(c.id));
    for (const c of conversations) deletePromises.push(base44.entities.Conversation.delete(c.id));
    for (const f of sourceFiles) deletePromises.push(base44.entities.SourceFile.delete(f.id));

    await Promise.all(deletePromises);

    // Delete the project itself
    await base44.entities.Project.delete(project_id);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});