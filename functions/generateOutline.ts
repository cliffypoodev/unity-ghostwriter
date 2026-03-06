import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Anthropic from 'npm:@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

const CHAPTER_COUNTS = { short: { min: 8, max: 12 }, medium: { min: 15, max: 25 }, long: { min: 25, max: 40 }, epic: { min: 40, max: 60 } };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id } = await req.json();
    if (!project_id) return Response.json({ error: 'project_id required' }, { status: 400 });

    const [specs, sourceFiles, globalSourceFiles, appSettingsList] = await Promise.all([
      base44.entities.Specification.filter({ project_id }),
      base44.entities.SourceFile.filter({ project_id }),
      base44.entities.SourceFile.filter({ project_id: "global" }),
      base44.entities.AppSettings.list(),
    ]);

    const appSettings = appSettingsList[0] || {};
    const allSourceFiles = [...sourceFiles, ...globalSourceFiles];

    const spec = specs[0];
    if (!spec) return Response.json({ error: 'No specification found' }, { status: 400 });

    const chapterRange = CHAPTER_COUNTS[spec.target_length] || CHAPTER_COUNTS.medium;
    const targetChapters = Math.floor((chapterRange.min + chapterRange.max) / 2);

    const sourceContext = sourceFiles.length > 0
      ? `\n\nSource files for context:\n${sourceFiles.map(f => `--- ${f.filename} (${f.file_type}) ---\n${f.content}`).join('\n\n')}`
      : '';

    const systemPrompt = `You are an expert book editor and story architect. Generate a comprehensive book outline and story bible in JSON format.

Return ONLY valid JSON with this exact structure:
{
  "outline": {
    "title": "string",
    "narrative_arc": "string (describe the overall story arc)",
    "themes": ["theme1", "theme2", ...],
    "chapters": [
      {
        "number": 1,
        "title": "string",
        "summary": "string (2-3 sentences)",
        "key_events": ["event1", "event2"],
        "prompt": "string (detailed writing prompt for this chapter, 3-5 sentences describing what to write)"
      }
    ]
  },
  "story_bible": {
    "world": "string (world/setting description)",
    "characters": [
      {
        "name": "string",
        "role": "string (protagonist/antagonist/supporting/minor)",
        "description": "string",
        "arc": "string"
      }
    ],
    "settings": ["setting1", "setting2"],
    "tone_voice": "string",
    "style_guidelines": "string",
    "thematic_elements": ["element1", "element2"],
    "rules": "string (world rules, narrative rules, or writing rules)"
  }
}`;

    const userPrompt = `Generate a ${targetChapters}-chapter outline for this book:
- Type: ${spec.book_type}
- Genre: ${spec.genre}
- Topic/Premise: ${spec.topic}
- Target Length: ${spec.target_length} (${chapterRange.min}-${chapterRange.max} chapters)
- Target Audience: ${spec.target_audience || 'general'}
- Tone & Style: ${spec.tone_style || 'not specified'}
- Detail Level: ${spec.detail_level}
- Additional Requirements: ${spec.additional_requirements || 'none'}
${sourceContext}

Generate exactly ${targetChapters} chapters. Make each chapter's writing prompt detailed and actionable.`;

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return Response.json({ error: 'Failed to parse outline JSON' }, { status: 500 });

    const parsed = JSON.parse(jsonMatch[0]);

    // Save or update outline
    const existing = await base44.entities.Outline.filter({ project_id });
    const outlinePayload = {
      project_id,
      outline_data: JSON.stringify(parsed.outline),
      story_bible: JSON.stringify(parsed.story_bible),
    };
    if (existing[0]) {
      await base44.entities.Outline.update(existing[0].id, outlinePayload);
    } else {
      await base44.entities.Outline.create(outlinePayload);
    }

    // Delete existing chapters and create new ones
    const existingChapters = await base44.entities.Chapter.filter({ project_id });
    await Promise.all(existingChapters.map(c => base44.entities.Chapter.delete(c.id)));

    const chapters = parsed.outline.chapters.map(ch => ({
      project_id,
      chapter_number: ch.number,
      title: ch.title,
      summary: ch.summary,
      prompt: ch.prompt,
      status: 'pending',
      word_count: 0,
    }));
    await base44.entities.Chapter.bulkCreate(chapters);

    return Response.json({ success: true, chapter_count: chapters.length, outline: parsed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});