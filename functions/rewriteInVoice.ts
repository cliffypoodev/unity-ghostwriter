import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function callAI(systemPrompt, userMessage) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error('Anthropic error: ' + (data.error?.message || response.status));
  return data.content[0].text;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { selected_text, style_sample, genre, beat_style, chapter_number, project_id, save_as_default } = await req.json();
    
    if (!selected_text || !style_sample) {
      return Response.json({ error: 'selected_text and style_sample are required' }, { status: 400 });
    }

    // Save style sample to project if requested
    if (save_as_default && project_id) {
      try {
        await base44.entities.Project.update(project_id, { style_sample });
      } catch (e) {
        console.warn('Failed to save style sample:', e.message);
      }
    }

    const systemPrompt = "You are a ghostwriter who specializes in matching an author's existing voice. Your output must sound like the style sample provided — not like generic AI prose.";

    const userMessage = `Here is a writing style sample from the author:

STYLE SAMPLE:
${style_sample}

Analyze this sample for:
- Sentence length patterns (short/long/mixed)
- Vocabulary level (simple/elevated/mixed)
- Use of interiority vs. action
- Dialogue style
- Descriptive density
- Emotional tone

Now rewrite the following passage to match that style exactly.
Preserve all plot events, character actions, and information from the original. Change only how it is written — not what happens.

ORIGINAL PASSAGE:
${selected_text}

CONTEXT (do not repeat, for reference only):
Genre: ${genre || 'Not specified'}
Beat Style: ${beat_style || 'Not specified'}
Chapter: ${chapter_number || 'N/A'}

Return only the rewritten passage. No commentary, no explanation, no preamble.`;

    const rewritten = await callAI(systemPrompt, userMessage);

    return Response.json({ rewritten_text: rewritten.trim() });
  } catch (error) {
    console.error('Rewrite error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});