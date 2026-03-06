import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import OpenAI from 'npm:openai';

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

const CHAPTER_COUNTS = { short: { min: 8, max: 12 }, medium: { min: 15, max: 25 }, long: { min: 25, max: 40 }, epic: { min: 40, max: 60 } };
const CHUNK_SIZE = 10; // Generate 10 chapters at a time (max batch size)
const OPENAI_TIMEOUT = 12000; // 12 seconds (Deno Deploy has ~15s limit, leave buffer)

async function callOpenAIWithTimeout(messages, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT);
    
    try {
      console.log(`OpenAI call attempt ${attempt + 1}/${retries + 1}...`);
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 1500,
          temperature: 0.7,
          messages,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      console.log('OpenAI response status:', response.status);
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(`OpenAI error: ${errData.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      console.log('OpenAI response received successfully');
      return data;
    } catch (e) {
      clearTimeout(timeout);
      console.error(`Attempt ${attempt + 1} failed:`, e.name, e.message);
      
      if (attempt < retries) {
        const waitMs = 1000 * Math.pow(2, attempt);
        console.log(`Waiting ${waitMs}ms before retry...`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      
      if (e.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw e;
    }
  }
}

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

    const truncatedTopic = spec.topic?.length > 200 ? spec.topic.slice(0, 200) : spec.topic;
    const systemPrompt = `You are a book outline generator. Return only valid JSON.`;

    // Generate outline in batches of max 10 chapters
    console.log(`Generating outline in batches of ${CHUNK_SIZE} chapters (total: ${targetChapters})`);
    const allChapters = [];

    for (let chunkStart = 1; chunkStart <= targetChapters; chunkStart += CHUNK_SIZE) {
     const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, targetChapters);
     const chunkCount = chunkEnd - chunkStart + 1;

     console.log(`Generating chapters ${chunkStart}-${chunkEnd}...`);

     const chunkPrompt = `Generate ${chunkCount} chapters (${chunkStart}-${chunkEnd} of ${targetChapters}) for a ${spec.genre} ${spec.book_type} about "${truncatedTopic}". Return JSON array with {number, title, summary} fields only.`;

     try {
       const response = await callOpenAIWithTimeout([
         { role: 'system', content: systemPrompt },
         { role: 'user', content: chunkPrompt }
       ]);

       if (!response?.choices?.[0]?.message?.content) {
         throw new Error('No content in response');
       }

       const text = response.choices[0].message.content;
       const cleanText = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '');

       // Parse JSON array
       const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
       if (!jsonMatch) throw new Error('No JSON array found');

       const chapters = JSON.parse(jsonMatch[0]);
       if (!Array.isArray(chapters)) throw new Error('Response is not a JSON array');

       allChapters.push(...chapters);
       console.log(`✓ Batch ${chunkStart}-${chunkEnd} complete (${chapters.length} chapters)`);
     } catch (err) {
       console.error(`✗ Batch ${chunkStart}-${chunkEnd} failed:`, err.message);
       return Response.json({ error: `Generation failed: ${err.message}` }, { status: 500 });
     }
    }

    const parsed = { outline: { chapters: allChapters } };

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

    const chapters = parsed.outline.chapters.map((ch, idx) => ({
      project_id,
      chapter_number: ch.number || idx + 1,
      title: ch.title || `Chapter ${ch.number || idx + 1}`,
      summary: ch.summary || '',
      prompt: ch.prompt || '',
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