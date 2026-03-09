import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { file_url, clear_existing, batch_start, batch_size } = await req.json();
    const start = batch_start || 0;
    const size = batch_size || 50;

    // Step 1: Optionally clear existing catalog
    if (clear_existing) {
      console.log('Clearing existing PromptCatalog...');
      const existing = await base44.asServiceRole.entities.PromptCatalog.filter({});
      for (let i = 0; i < existing.length; i += 20) {
        const batch = existing.slice(i, i + 20);
        await Promise.all(batch.map(p => base44.asServiceRole.entities.PromptCatalog.delete(p.id)));
      }
      console.log(`Cleared ${existing.length} existing prompts`);
    }

    // Step 2: Fetch the file
    if (!file_url) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    console.log('Fetching prompt file...');
    const fileRes = await fetch(file_url);
    const allPrompts = await fileRes.json();
    console.log(`File has ${allPrompts.length} prompts total`);

    // Step 3: Get the batch to process
    const batch = allPrompts.slice(start, start + size);
    if (batch.length === 0) {
      return Response.json({ 
        message: 'No more prompts to process', 
        done: true,
        total: allPrompts.length,
        processed_up_to: start 
      });
    }

    console.log(`Processing batch: ${start} to ${start + batch.length} of ${allPrompts.length}`);

    // Step 4: Use AI to categorize each batch of prompts
    // Process in sub-batches of 10 for AI categorization
    const categorized = [];
    
    for (let i = 0; i < batch.length; i += 10) {
      const subBatch = batch.slice(i, i + 10);
      
      const promptTexts = subBatch.map((p, idx) => {
        // Take first 800 chars to keep prompt manageable
        const text = (p.text || '').slice(0, 800);
        return `[${idx}] ${text}`;
      }).join('\n\n---\n\n');

      const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a book prompt cataloger. Analyze each prompt below and return a JSON array with one object per prompt.

For each prompt, determine:
- "title": A short descriptive title (max 80 chars). If the prompt text starts with a repeated title/series name, use it as the category and create a unique title.
- "description": A 1-2 sentence summary (max 200 chars)
- "book_type": "fiction" or "nonfiction" — if it's about writing a novel/story/gamebook = fiction. If it's about writing a guide/manual/self-help/business/how-to/educational book = nonfiction.
- "genre": The primary genre (e.g. Horror, Romance, Fantasy, Thriller, Science Fiction, Literary Fiction, Self-Help, Business, History, Science, Biography, True Crime, Health, Technology, Education, etc.)
- "category": A grouping label for similar prompts (e.g. "Arkham Academic Investigations", "Romance Billionaire", "Self-Help Mindset", "Business Strategy", etc.)
- "tags": Array of 3-5 relevant tags

PROMPTS:
${promptTexts}

Return ONLY a JSON array of objects. No markdown, no explanation.`,
        response_json_schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  book_type: { type: "string" },
                  genre: { type: "string" },
                  category: { type: "string" },
                  tags: { type: "array", items: { type: "string" } }
                }
              }
            }
          }
        }
      });

      const items = aiResult.items || [];
      
      for (let j = 0; j < subBatch.length; j++) {
        const orig = subBatch[j];
        const cat = items[j] || {};
        const fullText = orig.text || '';
        const wordCount = fullText.split(/\s+/).filter(Boolean).length;
        
        categorized.push({
          title: (cat.title || `Prompt ${start + i + j + 1}`).slice(0, 200),
          description: (cat.description || '').slice(0, 500),
          content: fullText,
          book_type: cat.book_type === 'nonfiction' ? 'nonfiction' : 'fiction',
          genre: cat.genre || 'General',
          category: cat.category || 'Uncategorized',
          tags: Array.isArray(cat.tags) ? cat.tags.slice(0, 5) : [],
          word_count: wordCount
        });
      }
      
      console.log(`AI categorized sub-batch ${i}-${i + subBatch.length}`);
    }

    // Step 5: Bulk insert
    let inserted = 0;
    for (let i = 0; i < categorized.length; i += 20) {
      const insertBatch = categorized.slice(i, i + 20);
      try {
        await base44.asServiceRole.entities.PromptCatalog.bulkCreate(insertBatch);
        inserted += insertBatch.length;
      } catch (err) {
        console.warn(`Insert batch error:`, err.message);
        // Try one by one
        for (const item of insertBatch) {
          try {
            await base44.asServiceRole.entities.PromptCatalog.create(item);
            inserted++;
          } catch (e2) {
            console.warn(`Single insert error for "${item.title}":`, e2.message);
          }
        }
      }
    }

    const nextStart = start + batch.length;
    const done = nextStart >= allPrompts.length;

    console.log(`Batch complete: inserted ${inserted}, next_start=${nextStart}, done=${done}`);

    return Response.json({
      message: `Processed ${batch.length} prompts, inserted ${inserted}`,
      inserted,
      next_start: nextStart,
      done,
      total: allPrompts.length,
      processed_up_to: nextStart
    });
  } catch (error) {
    console.error('Import error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});