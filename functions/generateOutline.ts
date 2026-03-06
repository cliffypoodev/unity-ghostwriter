import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Anthropic from 'npm:@anthropic-ai/sdk';
import OpenAI from 'npm:openai';

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
const deepseek = new OpenAI({ 
  apiKey: Deno.env.get("DEEPSEEK_API_KEY"),
  baseURL: 'https://api.deepseek.com'
});

const CHAPTER_COUNTS = { short: { min: 8, max: 12 }, medium: { min: 15, max: 25 }, long: { min: 25, max: 40 }, epic: { min: 40, max: 60 } };

Deno.serve(async (req) => {
  try {
    console.log('Starting generateOutline');
    const base44 = createClientFromRequest(req);
    console.log('Client created');
    const user = await base44.auth.me();
    console.log('User authenticated:', user?.email);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id } = await req.json();
    console.log('Project ID:', project_id);
    if (!project_id) return Response.json({ error: 'project_id required' }, { status: 400 });

    console.log('Loading entities for project:', project_id);
    const [specs, sourceFiles, globalSourceFiles, appSettingsList] = await Promise.all([
      base44.entities.Specification?.filter({ project_id }) || [],
      base44.entities.SourceFile?.filter({ project_id }) || [],
      base44.entities.SourceFile?.filter({ project_id: "global" }) || [],
      base44.entities.AppSettings?.list() || [],
    ]);
    console.log('Entities loaded successfully');

    const appSettings = appSettingsList[0] || {};
    const allSourceFiles = [...sourceFiles, ...globalSourceFiles];

    const spec = specs[0];
    if (!spec) return Response.json({ error: 'No specification found' }, { status: 400 });

    const chapterRange = CHAPTER_COUNTS[spec.target_length] || CHAPTER_COUNTS.medium;
    const targetChapters = spec.chapter_count
      ? parseInt(spec.chapter_count)
      : Math.floor((chapterRange.min + chapterRange.max) / 2);

    // Truncate source files context to prevent token overflow - limit to first 2 files only
    const sourceContext = allSourceFiles.length > 0
      ? `\n\nSource files for context:\n${allSourceFiles.slice(0, 2).map(f => {
          const content = f.content?.length > 500 ? f.content.slice(0, 500) + '...' : f.content;
          return `--- ${f.filename} (${f.file_type}) ---\n${content}`;
        }).join('\n\n')}`
      : '';

    const globalInstructions = [
      appSettings.global_style_instructions,
      appSettings.global_content_guidelines,
    ].filter(Boolean).join('\n\n');
    const globalContext = globalInstructions ? `\n\nGlobal writing guidelines:\n${globalInstructions}` : '';

    const systemPrompt = `Return ONLY valid JSON. No markdown or explanation. Required structure:
{"outline":{"chapters":[{"number":1,"title":"string","summary":"string","prompt":"string"}]}}`;

    // Truncate topic to avoid exceeding token limits
    const truncatedTopic = spec.topic?.length > 3000 ? spec.topic.slice(0, 3000) + '...' : spec.topic;

    const userPrompt = `Generate a ${targetChapters}-chapter outline for: ${spec.genre} ${spec.book_type} about "${truncatedTopic.slice(0, 200)}". Target audience: ${spec.target_audience || 'general'}. Tone: ${spec.tone_style || 'standard'}. Return JSON with chapter array only.`;

    // Use GPT-4o-mini for fast outline generation
    console.log('Requesting outline from OpenAI GPT-4o-mini');
    let response;
    
    try {
      response = await Promise.race([
        openai.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 4000,
          temperature: 0.7,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('AI request timeout')), 9000))
      ]);
    } catch (apiErr) {
      console.error('AI API error:', apiErr.message);
      return Response.json({ error: 'AI generation failed: ' + apiErr.message }, { status: 500 });
    }

    console.log('AI Response keys:', response ? Object.keys(response) : 'undefined');
    console.log('AI Response (first 500):', JSON.stringify(response).slice(0, 500));
    
    let text;
    if (!response) {
      return Response.json({ error: 'No response from AI', model: modelName }, { status: 500 });
    }
    
    if (response.choices) {
      // OpenAI format
      text = response.choices[0]?.message?.content;
    } else if (response.content) {
      // Anthropic format
      text = response.content[0]?.text;
    } else {
      return Response.json({ error: 'Unexpected AI response format', keys: Object.keys(response) }, { status: 500 });
    }
    
    if (!text) {
      return Response.json({ error: 'No text in AI response', response }, { status: 500 });
    }

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

    // Save or update outline — store data inline
    console.log('Available entities:', Object.keys(base44.entities || {}));
    try {
      if (base44.entities?.Outline) {
        const existing = await base44.entities.Outline.filter({ project_id });
        const outlinePayload = {
          project_id,
          outline_data: JSON.stringify(parsed.outline),
          outline_url: '',
          story_bible: JSON.stringify(parsed.story_bible),
          story_bible_url: '',
        };
        
        if (existing && existing[0]) {
          await base44.entities.Outline.update(existing[0].id, outlinePayload);
        } else if (base44.entities.Outline.create) {
          await base44.entities.Outline.create(outlinePayload);
        }
      }
    } catch (outlineErr) {
      console.warn('Outline save failed (non-critical):', outlineErr.message);
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
    console.error('generateOutline error:', error);
    console.error('Stack:', error.stack);
    return Response.json({ error: error.message, stack: error.stack?.split('\n').slice(0, 5) }, { status: 500 });
  }
});