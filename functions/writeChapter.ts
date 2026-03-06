import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const openai_key = Deno.env.get("OPENAI_API_KEY");

async function generateChapterAsync(base44, projectId, chapterId, projectSpec, outline, sourceFiles, appSettings) {
  try {
    const chapters = await base44.entities.Chapter.filter({ project_id: projectId });
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter) return;

    const sections = [
      { num: 1, title: 'Opening', words: 500 },
      { num: 2, title: 'Middle', words: 600 },
      { num: 3, title: 'Closing', words: 500 }
    ];

    const sectionContents = [];

    async function callOpenAI(messages, maxTokens = 1500) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openai_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(`OpenAI error: ${errData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    }

    let shortSystemPrompt = `You are a professional author. Write ${projectSpec?.genre || 'fiction'} with an immersive, engaging style.`;
    
    // Add author voice style if not basic
    if (projectSpec?.author_voice && projectSpec.author_voice !== 'basic') {
      const authorVoices = {
        hemingway: "Terse, declarative sentences. Iceberg theory.",
        king: "Conversational, immersive. Rich inner monologue, building dread.",
        austen: "Witty, ironic social commentary.",
        tolkien: "Mythic, elevated prose. Rich world-building.",
        morrison: "Lyrical, poetic. Vivid sensory detail.",
        rowling: "Accessible, whimsical. Clever wordplay.",
        mccarthy: "Sparse, biblical. No quotation marks.",
        atwood: "Sharp, sardonic. Precise word choices.",
        gaiman: "Mythic yet modern. Fairy-tale cadence.",
        pratchett: "Satirical. Comedic fantasy, warm humanity.",
        le_guin: "Sparse elegance, philosophical depth.",
        vonnegut: "Dark humor, short sentences. Absurdist.",
        garcia_marquez: "Lush magical realism. Sprawling sentences.",
        chandler: "Hardboiled noir. First-person cynicism.",
        christie: "Puzzle-box plotting. Clean readable prose.",
        gladwell: "Nonfiction storytelling. Counterintuitive hooks.",
        bryson: "Humorous nonfiction. Self-deprecating wit.",
        sagan: "Awe-inspiring science writing. Poetic wonder.",
        didion: "Cool, precise observation.",
      };
      const voiceDesc = authorVoices[projectSpec.author_voice];
      if (voiceDesc) {
        shortSystemPrompt += ` Write in a style reminiscent of the specified author: ${voiceDesc}`;
      }
    }

    for (const section of sections) {
      const previousContext = sectionContents.length > 0
        ? `\n\nPrevious sections: ${sectionContents.map((c, i) => `Section ${i + 1}: ${c.slice(0, 150)}...`).join('\n')}`
        : '';

      const sectionPrompt = `Write Section ${section.num} (${section.title}) of Chapter ${chapter.chapter_number}: "${chapter.title}"

Summary: ${chapter.summary || ''}
Prompt: ${chapter.prompt || ''}${previousContext}

Write ~${section.words} words. Content only, no meta-commentary.`;

      try {
        const content = await callOpenAI([
          { role: 'system', content: shortSystemPrompt },
          { role: 'user', content: sectionPrompt }
        ]);
        sectionContents.push(content);
      } catch (err) {
        console.error(`Section ${section.num} failed:`, err.message);
        if (sectionContents.length > 0) {
          const partialContent = sectionContents.join('\n\n');
          const wordCount = partialContent.trim().split(/\s+/).length;
          await base44.entities.Chapter.update(chapterId, {
            content: partialContent,
            status: 'generated',
            word_count: wordCount,
            generated_at: new Date().toISOString(),
          });
          return;
        }
        throw err;
      }
    }

    const fullContent = sectionContents.join('\n\n');
    const wordCount = fullContent.trim().split(/\s+/).length;

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
        console.warn('File upload failed, storing directly');
      }
    }

    await base44.entities.Chapter.update(chapterId, {
      content: contentValue,
      status: 'generated',
      word_count: wordCount,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Async generation error:', err.message);
  }
}

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

    // Mark as generating and fire async generation in background
    await base44.entities.Chapter.update(chapter_id, { status: 'generating' });

    // Start async generation without waiting
    generateChapterAsync(base44, project_id, chapter_id, spec, outline, sourceFiles, appSettings).catch(err => {
      console.error('Background generation failed:', err.message);
    });

    // Return immediately so we don't hit Deno's 10s limit
    return Response.json({
      text: '',
      success: true,
      async: true,
      message: 'Chapter generation started in background'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});