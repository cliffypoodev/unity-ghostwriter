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
    // Cap chapters based on topic length to avoid token overflow
    const topicLen = (spec.topic || '').length;
    const rawTarget = Math.floor((chapterRange.min + chapterRange.max) / 2);
    // Cap chapters to prevent output token overflow (each chapter ~400 tokens)
    const maxChapters = topicLen > 2000 ? 10 : topicLen > 500 ? 15 : rawTarget;
    const targetChapters = Math.min(rawTarget, maxChapters);

    // Truncate source files context to prevent token overflow
    const sourceContext = allSourceFiles.length > 0
      ? `\n\nSource files for context:\n${allSourceFiles.map(f => {
          const content = f.content?.length > 1000 ? f.content.slice(0, 1000) + '...' : f.content;
          return `--- ${f.filename} (${f.file_type}) ---\n${content}`;
        }).join('\n\n')}`
      : '';

    const globalInstructions = [
      appSettings.global_style_instructions,
      appSettings.global_content_guidelines,
    ].filter(Boolean).join('\n\n');
    const globalContext = globalInstructions ? `\n\nGlobal writing guidelines:\n${globalInstructions}` : '';

    const systemPrompt = `You are an expert book editor. Generate a book outline in JSON format.

CRITICAL: Return ONLY raw valid JSON. No markdown, no code fences, no explanation. Start with { and end with }.

Required structure:
{"outline":{"title":"string","narrative_arc":"string","themes":["t1"],"chapters":[{"number":1,"title":"string","summary":"string","key_events":["e1"],"prompt":"string"}]},"story_bible":{"world":"string","characters":[{"name":"string","role":"protagonist","description":"string","arc":"string"}],"settings":["s1"],"tone_voice":"string","style_guidelines":"string","thematic_elements":["e1"],"rules":"string"}}

Keep each field concise. Summary = 1 sentence. Prompt = 2 sentences. narrative_arc = 1 sentence.`;

    // Truncate topic to avoid exceeding token limits
    const truncatedTopic = spec.topic?.length > 3000 ? spec.topic.slice(0, 3000) + '...' : spec.topic;

    const userPrompt = `Generate a ${targetChapters}-chapter outline for this book:
- Type: ${spec.book_type}
- Genre: ${spec.genre}
- Topic/Premise: ${truncatedTopic}
- Target Length: ${spec.target_length} (${chapterRange.min}-${chapterRange.max} chapters)
- Target Audience: ${spec.target_audience || 'general'}
- Tone & Style: ${spec.tone_style || 'not specified'}
- Detail Level: ${spec.detail_level}
- Additional Requirements: ${spec.additional_requirements || 'none'}
${sourceContext}${globalContext}

Generate exactly ${targetChapters} chapters. Make each chapter's writing prompt detailed and actionable.`;

    const response = await anthropic.messages.create({
      model: appSettings.ai_model || 'claude-haiku-4-5',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0].text;

    // Strip markdown code fences if present
    const cleanText = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '');

    // Return raw AI text for debugging if parse fails
    let parsed = null;
    const start = cleanText.indexOf('{');
    if (start === -1) return Response.json({ error: 'No JSON found in response', raw: cleanText.slice(0, 500) }, { status: 500 });

    let depth = 0;
    let end = -1;
    for (let i = start; i < cleanText.length; i++) {
      if (cleanText[i] === '{') depth++;
      else if (cleanText[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) return Response.json({ error: 'Malformed JSON in response', raw: cleanText.slice(0, 500) }, { status: 500 });

    try {
      parsed = JSON.parse(cleanText.slice(start, end + 1));
    } catch (parseErr) {
      // Try to fix common issues: trailing commas before ] or }
      const cleaned = cleanText.slice(start, end + 1)
        .replace(/,\s*\]/g, ']')
        .replace(/,\s*\}/g, '}');
      try {
        parsed = JSON.parse(cleaned);
      } catch (e2) {
        return Response.json({ error: 'JSON parse failed: ' + e2.message, raw: cleanText.slice(0, 1000) }, { status: 500 });
      }
    }

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