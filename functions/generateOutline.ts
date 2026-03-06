import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import OpenAI from 'npm:openai';

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

const CHAPTER_COUNTS = { short: { min: 8, max: 12 }, medium: { min: 15, max: 25 }, long: { min: 25, max: 40 }, epic: { min: 40, max: 60 } };
const CHUNK_SIZE = 5; // Generate 5 chapters at a time
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff

async function retryWithBackoff(fn, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, RETRY_DELAYS[i]));
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

    const truncatedTopic = spec.topic?.length > 500 ? spec.topic.slice(0, 500) : spec.topic;
    const systemPrompt = `Return ONLY valid JSON: {"chapters":[{"number":int,"title":"str","summary":"str","prompt":"str"}]}`;

    // Generate outline in chunks
    console.log(`Generating outline in chunks of ${CHUNK_SIZE} chapters (total: ${targetChapters})`);
    const allChapters = [];

    for (let chunkStart = 1; chunkStart <= targetChapters; chunkStart += CHUNK_SIZE) {
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, targetChapters);
      const chunkCount = chunkEnd - chunkStart + 1;

      console.log(`Generating chapters ${chunkStart}-${chunkEnd}...`);

      const chunkPrompt = `Generate chapters ${chunkStart}-${chunkEnd} (${chunkCount} chapters) for a ${targetChapters}-chapter ${spec.genre} ${spec.book_type} about "${truncatedTopic}". Audience: ${spec.target_audience || 'general'}. Tone: ${spec.tone_style || 'standard'}. Return ONLY JSON array.`;

      try {
        const response = await retryWithBackoff(async () => {
          return await Promise.race([
            openai.chat.completions.create({
              model: 'gpt-4o-mini',
              max_tokens: 2000,
              temperature: 0.7,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: chunkPrompt }
              ],
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('chunk timeout')), 6000))
          ]);
        });

        if (!response?.choices?.[0]?.message?.content) {
          throw new Error('No content in response');
        }

        const text = response.choices[0].message.content;
        const cleanText = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '');
        
        // Parse JSON array
        const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error('No JSON array found');
        
        const chapters = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(chapters)) throw new Error('Not an array');
        
        allChapters.push(...chapters);
        console.log(`✓ Chunk ${chunkStart}-${chunkEnd} complete (${chapters.length} chapters)`);
      } catch (err) {
        console.error(`✗ Chunk ${chunkStart}-${chunkEnd} failed:`, err.message);
        return Response.json({ error: `Chunk generation failed (chapters ${chunkStart}-${chunkEnd}): ${err.message}` }, { status: 500 });
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