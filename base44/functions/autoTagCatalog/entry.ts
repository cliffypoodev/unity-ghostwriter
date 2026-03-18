import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all prompts without enrichment
    const allPrompts = await base44.asServiceRole.entities.PromptCatalog.list();
    
    if (allPrompts.length === 0) {
      return Response.json({ message: 'No prompts to tag' });
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return Response.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 });
    }

    const updates = [];
    const batchSize = 10; // Process 10 at a time to avoid rate limits

    for (let i = 0; i < allPrompts.length; i += batchSize) {
      const batch = allPrompts.slice(i, i + batchSize);
      
      for (const prompt of batch) {
        // Skip if already enriched
        if (prompt.category && prompt.tags?.length > 0 && prompt.book_type && prompt.description) {
          continue;
        }

        try {
          const promptText = (prompt.content || prompt.title || '').substring(0, 500);
          if (!promptText) continue;

          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{
                role: 'user',
                content: `Analyze this book prompt and extract structured metadata. Return ONLY valid JSON (no markdown, no extra text):

PROMPT: "${promptText}"

Return JSON with these fields (all required):
{
  "book_type": "fiction" or "nonfiction",
  "category": "broad category like 'Crime & Law', 'Science & Technology', 'History', 'Psychology', etc.",
  "description": "1-2 sentence summary of what this prompt is about",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "word_count": estimated number (as number, not string)
}

Focus tags on themes, genres, styles, or elements (e.g., "Dark", "Historical", "Mystery", "Series", "Psychology").`
              }],
              temperature: 0.3,
            }),
          });

          if (!response.ok) {
            console.warn(`OpenAI error for prompt ${prompt.id}`);
            continue;
          }

          const data = await response.json();
          const extracted = JSON.parse(data.choices[0].message.content);

          updates.push({
            id: prompt.id,
            data: {
              book_type: extracted.book_type || prompt.book_type,
              category: extracted.category || prompt.category,
              description: extracted.description || prompt.description,
              tags: extracted.tags || prompt.tags || [],
              word_count: extracted.word_count || prompt.word_count || 2000,
            }
          });
        } catch (err) {
          console.warn(`Failed to tag prompt ${prompt.id}:`, err.message);
        }
      }

      // Small delay between batches
      if (i + batchSize < allPrompts.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Batch update all prompts
    for (const { id, data } of updates) {
      try {
        await base44.asServiceRole.entities.PromptCatalog.update(id, data);
      } catch (err) {
        console.warn(`Failed to update prompt ${id}:`, err.message);
      }
    }

    return Response.json({
      message: `Tagged ${updates.length} prompts`,
      updated: updates.length
    });
  } catch (error) {
    console.error('autoTagCatalog error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});