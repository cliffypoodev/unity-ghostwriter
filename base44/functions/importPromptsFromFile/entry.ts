import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const delay = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { action, file_url, batch_start, batch_size } = body;

    // ACTION: clear — just delete existing records
    if (action === 'clear') {
      console.log('Clearing existing PromptCatalog...');
      let deleted = 0;
      let hasMore = true;
      while (hasMore) {
        const existing = await base44.asServiceRole.entities.PromptCatalog.filter({}, '-created_date', 50);
        if (existing.length === 0) { hasMore = false; break; }
        for (const p of existing) {
          await base44.asServiceRole.entities.PromptCatalog.delete(p.id);
          deleted++;
          if (deleted % 10 === 0) await delay(500);
        }
        console.log(`Deleted ${deleted} so far...`);
      }
      return Response.json({ message: `Cleared ${deleted} prompts`, deleted });
    }

    // ACTION: import (default) — fetch file, categorize with AI, insert
    const start = batch_start || 0;
    const size = batch_size || 30;

    if (!file_url) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    console.log('Fetching prompt file...');
    const fileRes = await fetch(file_url);
    const allPrompts = await fileRes.json();
    console.log(`File has ${allPrompts.length} prompts, processing batch ${start}-${start + size}`);

    const batch = allPrompts.slice(start, start + size);
    if (batch.length === 0) {
      return Response.json({ done: true, total: allPrompts.length, processed_up_to: start });
    }

    // Categorize with AI in sub-batches of 10
    const categorized = [];
    
    for (let i = 0; i < batch.length; i += 10) {
      const subBatch = batch.slice(i, i + 10);
      
      const promptTexts = subBatch.map((p, idx) => {
        const text = (p.text || '').slice(0, 600);
        return `[${idx}] ${text}`;
      }).join('\n\n---\n\n');

      try {
        const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Categorize each prompt below. Return a JSON object with an "items" array.

For each:
- "title": Short unique title (max 80 chars)
- "description": 1-2 sentence summary (max 200 chars)  
- "book_type": "fiction" or "nonfiction" (story/novel/gamebook=fiction, guide/manual/self-help/business/how-to/educational=nonfiction)
- "genre": Primary genre (Horror, Romance, Fantasy, Thriller, Science Fiction, Literary Fiction, Self-Help, Business, History, Science, Biography, True Crime, Health, Technology, Education, etc.)
- "category": Group label for similar prompts
- "tags": 3-5 tags

PROMPTS:
${promptTexts}`,
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
        console.log(`Categorized sub-batch ${i}-${i + subBatch.length}`);
      } catch (aiErr) {
        console.warn(`AI categorization failed for sub-batch ${i}:`, aiErr.message);
        // Fallback: insert without AI categorization
        for (const orig of subBatch) {
          const fullText = orig.text || '';
          categorized.push({
            title: `Prompt ${start + categorized.length + 1}`,
            description: fullText.slice(0, 200),
            content: fullText,
            book_type: 'fiction',
            genre: 'General',
            category: 'Uncategorized',
            tags: [],
            word_count: fullText.split(/\s+/).filter(Boolean).length
          });
        }
      }
      
      // Small delay between AI calls to avoid rate limits
      if (i + 10 < batch.length) await delay(1000);
    }

    // Bulk insert with rate limit protection
    let inserted = 0;
    for (let i = 0; i < categorized.length; i += 10) {
      const insertBatch = categorized.slice(i, i + 10);
      try {
        await base44.asServiceRole.entities.PromptCatalog.bulkCreate(insertBatch);
        inserted += insertBatch.length;
      } catch (err) {
        console.warn(`Bulk insert error, trying individually:`, err.message);
        await delay(2000);
        for (const item of insertBatch) {
          try {
            await base44.asServiceRole.entities.PromptCatalog.create(item);
            inserted++;
            await delay(200);
          } catch (e2) {
            console.warn(`Single insert failed:`, e2.message);
          }
        }
      }
      if (i + 10 < categorized.length) await delay(500);
    }

    const nextStart = start + batch.length;
    const done = nextStart >= allPrompts.length;

    console.log(`Batch done: inserted ${inserted}, next=${nextStart}, done=${done}`);

    return Response.json({
      inserted,
      next_start: nextStart,
      done,
      total: allPrompts.length
    });
  } catch (error) {
    console.error('Import error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});