import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function callAI(prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`OpenAI error: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { topic, book_type, genre } = await req.json();
    if (!topic?.trim()) return Response.json({ error: 'topic required' }, { status: 400 });

    const prompt = `You are a creative writing expert. Expand the following ${book_type} book premise into a detailed creative brief.

User's Premise: "${topic}"
Book Type: ${book_type}
Genre: ${genre || 'to be determined'}

Generate a DETAILED CREATIVE BRIEF (500-800 words) with these sections:

1. PREMISE: 3-4 vivid sentences expanding the core idea with specific details
2. MAIN CHARACTERS: 2-4 named characters with physical descriptions, roles, internal conflicts, defining quirks
3. SETTING: Time period, locations (name at least 3 distinct places), sensory details
4. CENTRAL CONFLICT: External plot conflict AND internal emotional conflict with specific stakes
5. PLOT TRAJECTORY: Inciting incident → 3-4 escalation points → climax → resolution (be specific)
6. THEMES: 2-3 thematic threads and how they manifest in the plot
7. KEY SCENES: 4-6 pivotal scenes described cinematically (who, what, where, stakes)
8. TONE & MOOD: Emotional experience for the reader, how tone shifts across the book

Format the brief as readable prose with clear section headers. Write it as a detailed creative roadmap.

AFTER the brief, on a new line, add:
---METADATA---
subgenre: [specific subgenre if applicable]
target_audience: [who should read this book - age group, interests, etc]
beat_style: [suggested beat style from: fast-paced-thriller, gritty-cinematic, hollywood-blockbuster, slow-burn, etc]
author_voice: [suggested author voice from: hemingway, king, morrison, mccarthy, gaiman, flynn, sanderson, hoover, patterson, atwood, basic]
detail_level: [minimal, moderate, or comprehensive]`;

    const response = await callAI(prompt);
    
    // Split the response into brief and metadata
    const parts = response.split('---METADATA---');
    const expandedBrief = parts[0].trim();
    const metadataRaw = parts[1]?.trim() || '';

    // Parse metadata
    const metadata = {
      expanded_brief: expandedBrief,
      subgenre: '',
      target_audience: '',
      beat_style: '',
      author_voice: 'basic',
      detail_level: 'moderate',
    };

    if (metadataRaw) {
      const lines = metadataRaw.split('\n');
      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim().toLowerCase();
        
        if (key.toLowerCase().includes('subgenre')) metadata.subgenre = value;
        else if (key.toLowerCase().includes('audience')) metadata.target_audience = value;
        else if (key.toLowerCase().includes('beat')) metadata.beat_style = value;
        else if (key.toLowerCase().includes('voice')) metadata.author_voice = value;
        else if (key.toLowerCase().includes('detail')) metadata.detail_level = value;
      }
    }

    return Response.json(metadata);
  } catch (error) {
    console.error('expandPremise error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});