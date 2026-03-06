import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Anthropic from 'npm:@anthropic-ai/sdk';
import OpenAI from 'npm:openai';

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
const deepseek = new OpenAI({ 
  apiKey: Deno.env.get("DEEPSEEK_API_KEY"),
  baseURL: 'https://api.deepseek.com'
});

Deno.serve(async (req) => {
  try {
    let base44;
    let user;
    
    try {
      base44 = createClientFromRequest(req);
      user = await base44.auth.me();
    } catch (authErr) {
      console.error('Auth error:', authErr.message);
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, chapter_id } = await req.json();
    if (!project_id || !chapter_id) return Response.json({ error: 'project_id and chapter_id required' }, { status: 400 });

    const [chapters, specs, outlines, sourceFiles, globalSourceFiles, appSettingsList] = await Promise.all([
      base44.entities.Chapter.filter({ project_id }),
      base44.entities.Specification.filter({ project_id }),
      base44.entities.Outline.filter({ project_id }),
      base44.entities.SourceFile.filter({ project_id }),
      base44.entities.SourceFile.filter({ project_id: "global" }),
      base44.entities.AppSettings.list(),
    ]);

    const appSettings = appSettingsList[0] || {};
    const allSourceFiles = [...sourceFiles, ...globalSourceFiles];

    const chapter = chapters.find(c => c.id === chapter_id);
    if (!chapter) return Response.json({ error: 'Chapter not found' }, { status: 404 });

    const spec = specs[0];
    const outline = outlines[0];

    let outlineData = null;
    let storyBible = null;

    // Resolve outline data — prefer inline, fall back to URL
    let outlineRaw = outline?.outline_data || '';
    if (!outlineRaw && outline?.outline_url) {
      try { outlineRaw = await (await fetch(outline.outline_url)).text(); } catch {}
    }
    try { outlineData = outlineRaw ? JSON.parse(outlineRaw) : null; } catch {}

    // Resolve story bible — prefer inline, fall back to URL
    let bibleRaw = outline?.story_bible || '';
    if (!bibleRaw && outline?.story_bible_url) {
      try { bibleRaw = await (await fetch(outline.story_bible_url)).text(); } catch {}
    }
    try { storyBible = bibleRaw ? JSON.parse(bibleRaw) : null; } catch {}

    // Mark as generating
    await base44.entities.Chapter.update(chapter_id, { status: 'generating' });

    const sourceContext = allSourceFiles.length > 0
      ? `\n\nSource files:\n${allSourceFiles.map(f => `--- ${f.filename} (${f.file_type}) ---\n${f.content}`).join('\n\n')}`
      : '';

    const globalInstructions = [
      appSettings.global_style_instructions,
      appSettings.global_content_guidelines,
    ].filter(Boolean).join('\n\n');
    const globalContext = globalInstructions ? `\n\nGlobal writing guidelines:\n${globalInstructions}` : '';

    const bibleContext = storyBible
      ? `\n\nStory Bible:\n- World: ${storyBible.world || ''}\n- Tone/Voice: ${storyBible.tone_voice || ''}\n- Style Guidelines: ${storyBible.style_guidelines || ''}\n- Rules: ${storyBible.rules || ''}`
      : '';

    const LENGTH_WORDS = { short: 2000, medium: 3500, long: 5000, epic: 6500 };
    const targetWords = LENGTH_WORDS[spec?.target_length] || 3000;

    const systemPrompt = `You are a professional author writing a ${spec?.genre || ''} ${spec?.book_type || 'fiction'} book. Write immersive, engaging prose that matches the established tone and style.${bibleContext}${sourceContext}${globalContext}

Write approximately ${targetWords} words for this chapter. Write the chapter content directly without any meta-commentary, headers, or explanations. Just the story.`;

    const userPrompt = `Write Chapter ${chapter.chapter_number}: "${chapter.title}"

Chapter Summary: ${chapter.summary || ''}

Writing Prompt: ${chapter.prompt || ''}

${outlineData ? `Overall narrative arc: ${outlineData.narrative_arc || ''}` : ''}`;

    // Determine which AI client to use
    const modelName = appSettings.ai_model || 'claude-opus-4-5';
    let stream;

    if (modelName.startsWith('gpt-') || modelName === 'gpt-4o') {
      // OpenAI models
      stream = await openai.messages.create({
        model: modelName,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        stream: true,
      });
    } else if (modelName === 'deepseek-chat') {
      // DeepSeek model
      stream = await deepseek.messages.create({
        model: 'deepseek-chat',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        stream: true,
      });
    } else {
      // Claude models (default)
      stream = await anthropic.messages.create({
        model: modelName,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        stream: true,
      });
    }

    let fullContent = '';

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              const text = event.delta.text;
              fullContent += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            } else if (event.type === 'message_stop') {
              const wordCount = fullContent.trim().split(/\s+/).length;
              // Upload content as a file to avoid entity field size limits
              let contentUrl = null;
              try {
                // Convert string to Blob for UploadFile
                const blob = new Blob([fullContent], { type: 'text/plain' });
                const uploadResult = await base44.integrations.Core.UploadFile({ file: blob });
                contentUrl = uploadResult?.file_url || null;
              } catch (uploadErr) {
                console.error('Upload error:', uploadErr.message);
                // Fall back to storing directly if upload fails
                contentUrl = null;
              }
              console.log('Saving chapter, contentUrl:', contentUrl ? 'got url' : 'no url', 'wordCount:', wordCount, 'contentLength:', fullContent.length);
              await base44.entities.Chapter.update(chapter_id, {
                content: contentUrl || fullContent,
                status: 'generated',
                word_count: wordCount,
                generated_at: new Date().toISOString(),
              });
              console.log('Chapter saved successfully');
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, word_count: wordCount })}\n\n`));
              controller.close();
            }
          }
        } catch (err) {
          console.error('Stream error:', err.message);
          await base44.entities.Chapter.update(chapter_id, { status: 'error' });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});