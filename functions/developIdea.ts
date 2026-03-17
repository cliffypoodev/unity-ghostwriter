import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');

async function callGemini(systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=' + GOOGLE_AI_API_KEY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: userPrompt }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { temperature: 0.7, maxOutputTokens: 1024 } }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!r.ok) throw new Error('Gemini: ' + await r.text());
    const d = await r.json();
    return d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (e) { clearTimeout(timeout); throw e; }
}

async function callClaude(systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1024, messages: [{ role: "user", content: userPrompt }], system: systemPrompt }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const d = await r.json();
    if (!r.ok) throw new Error('Claude: ' + (d.error?.message || r.status));
    return d.content[0].text;
  } catch (e) { clearTimeout(timeout); throw e; }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { premise, genre, book_type } = await req.json();
    if (!premise) return Response.json({ error: 'Premise is required' }, { status: 400 });

    const systemPrompt = `You are a book development consultant. Given a premise, generate creative development ideas that expand and deepen the concept. Return a JSON object with these fields:
- "expanded_premise": A richer, more detailed version of the premise (2-3 paragraphs)
- "themes": Array of 3-5 major themes to explore
- "unique_angles": Array of 3-4 unique angles or perspectives that make this story stand out
- "potential_conflicts": Array of 3-4 central conflicts
- "target_audience": Description of the ideal reader
- "comparable_titles": Array of 2-3 published books with similar appeal
- "development_notes": Brief notes on what makes this concept commercially viable

Return ONLY valid JSON. No markdown, no backticks, no explanation.`;

    const userPrompt = `Develop this ${book_type || 'fiction'} book concept:

PREMISE: ${premise}
${genre ? `GENRE: ${genre}` : ''}

Generate detailed development ideas as JSON.`;

    let text;
    try {
      text = await callGemini(systemPrompt, userPrompt);
    } catch (geminiErr) {
      console.warn('Gemini failed, trying Claude:', geminiErr.message);
      text = await callClaude(systemPrompt, userPrompt);
    }

    // Clean and parse JSON
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch (parseErr) {
      // Try to extract JSON from the response
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        return Response.json({ error: 'Failed to parse AI response', raw: cleaned.slice(0, 500) }, { status: 500 });
      }
    }

    return Response.json({ success: true, data: result });
  } catch (error) {
    console.error('developIdea error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});