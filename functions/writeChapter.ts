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

    // Break chapter into 3 sections for faster generation
    const sections = [
      { num: 1, title: 'Opening', words: 500 },
      { num: 2, title: 'Middle', words: 600 },
      { num: 3, title: 'Closing', words: 500 }
    ];

    const sectionContents = [];
    const shortSystemPrompt = `You are a professional author. Write in the style of ${spec?.genre || 'fiction'}, matching the established tone: ${appSettings.global_style_instructions ? appSettings.global_style_instructions.slice(0, 100) : 'immersive and engaging'}.`;

    // Helper: call OpenAI with timeout and retry
    async function callOpenAI(messages, maxTokens = 1500, retryCount = 0) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages,
            max_tokens: maxTokens,
            temperature: 0.7,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(`OpenAI API error: ${errData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || '';
      } catch (err) {
        if (retryCount < 1 && err.name !== 'AbortError') {
          console.warn(`Retry ${retryCount + 1}: ${err.message}`);
          return callOpenAI(messages, 1000, retryCount + 1);
        }
        throw err;
      }
    }

    // Generate each section
    for (const section of sections) {
      const previousContext = sectionContents.length > 0
        ? `\n\nPrevious sections summary:\n${sectionContents.map((c, i) => `Section ${i + 1}: ${c.slice(0, 200)}...`).join('\n')}`
        : '';

      const sectionPrompt = `Write Section ${section.num} (${section.title}) of Chapter ${chapter.chapter_number}: "${chapter.title}"

Summary: ${chapter.summary || ''}
Prompt: ${chapter.prompt || ''}${previousContext}

Write approximately ${section.words} words. Content only, no meta-commentary.`;

      console.log(`Generating section ${section.num}/${sections.length}...`);

      try {
        const content = await callOpenAI([
          { role: 'system', content: shortSystemPrompt },
          { role: 'user', content: sectionPrompt }
        ]);
        sectionContents.push(content);
      } catch (err) {
        console.error(`Section ${section.num} failed: ${err.message}`);
        // Return partial results
        if (sectionContents.length > 0) {
          const partialContent = sectionContents.join('\n\n');
          const wordCount = partialContent.trim().split(/\s+/).length;
          await base44.entities.Chapter.update(chapter_id, {
            content: partialContent,
            status: 'generated',
            word_count: wordCount,
            generated_at: new Date().toISOString(),
          });
          return Response.json({
            text: partialContent,
            success: true,
            partial: true,
            completedSections: sectionContents.length,
            totalSections: sections.length,
          });
        }
        throw err;
      }
    }

    const fullContent = sectionContents.join('\n\n');
    const wordCount = fullContent.trim().split(/\s+/).length;

    // Store content
    let contentValue = fullContent;
    if (fullContent.length > 50000) {
      try {
        const uploadResult = await base44.integrations.Core.UploadFile({
          file: fullContent
        });
        if (uploadResult?.file_url) {
          contentValue = uploadResult.file_url;
        }
      } catch (uploadErr) {
        console.warn('File upload failed, storing content directly:', uploadErr.message);
      }
    }

    await base44.entities.Chapter.update(chapter_id, {
      content: contentValue,
      status: 'generated',
      word_count: wordCount,
      generated_at: new Date().toISOString(),
    });

    console.log(`Chapter ${chapter.chapter_number} generated (${wordCount} words)`)

    return Response.json({ text: fullContent, success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});