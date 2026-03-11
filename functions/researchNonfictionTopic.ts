import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Anthropic web_search native tool for nonfiction research grounding.
// Input: { topic, subject, genre, subgenre, scope }
// Output: { facts, timeline, keyFigures, sources, contextSummary }

async function doResearch(topic, subject, genre, subgenre, scope) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const researchPrompt = `You are a research assistant preparing factual grounding for a nonfiction book.

BOOK CONTEXT:
Genre: ${genre || 'General'} / ${subgenre || 'General'}
Topic: ${topic || 'Not specified'}
${subject ? `Chapter Focus: ${subject}` : ''}
${scope ? `Scope: ${scope}` : ''}

Use web search to gather accurate, current facts. Then return ONLY a JSON object with no preamble, no markdown fences, in this exact structure:

{
  "facts": [
    "Specific verifiable fact 1",
    "Specific verifiable fact 2"
  ],
  "timeline": [
    { "date": "YYYY or Month YYYY", "event": "What happened" }
  ],
  "keyFigures": [
    { "name": "Full Name", "role": "Their relevance to the topic" }
  ],
  "sources": [
    { "title": "Source name", "url": "URL if available", "relevance": "Why it matters" }
  ],
  "contextSummary": "2-3 sentence factual summary of the topic/subject suitable for injection into a writing prompt"
}

Return 8-12 facts, 4-8 timeline entries, 3-6 key figures, and 3-5 sources. Return ONLY the JSON object.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
        }
      ],
      messages: [{ role: 'user', content: researchPrompt }],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error('Anthropic web search error: ' + (data.error?.message || response.status));
  }

  // Extract the final text block (Claude returns tool_use blocks + final text)
  const textBlock = (data.content || [])
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  if (!textBlock) {
    throw new Error('No text response from web search');
  }

  // Strip any accidental markdown fences
  const clean = textBlock.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    // Fallback: return partial data rather than crash
    console.warn('Research JSON parse failed, returning contextSummary only');
    return {
      facts: [],
      timeline: [],
      keyFigures: [],
      sources: [],
      contextSummary: textBlock.slice(0, 500),
    };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { topic, subject, genre, subgenre, scope } = await req.json();
    if (!topic) return Response.json({ error: 'topic is required' }, { status: 400 });

    console.log(`Research request: scope="${scope || 'book-level'}", subject="${subject || 'N/A'}"`);
    const result = await doResearch(topic, subject, genre, subgenre, scope);
    console.log(`Research complete: ${result.facts?.length || 0} facts, ${result.timeline?.length || 0} timeline, ${result.keyFigures?.length || 0} figures`);

    return Response.json(result);
  } catch (error) {
    console.error('researchNonfictionTopic error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});