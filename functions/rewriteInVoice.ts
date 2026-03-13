// MODAL ISOLATION RULE:
// This function performs a single-purpose AI call for style rewriting.
// NEVER call from here: resolveModel, enforceProseCompliance, getTopRepeatedWords,
// generateChapterWithCompliance, verifyExplicitTags, prepareChapterGeneration.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const REWRITE_MODES = {
  voice:       'Rewrite in the specified author voice. Preserve all plot content.',
  tighten:     'Tighten the prose. Cut 20-30% of words without losing meaning. Eliminate weak verbs, stacked adjectives, and empty qualifiers.',
  expand:      'Expand the passage by 30-40%. Add sensory detail, interiority, and texture. Do not add new plot events.',
  tension:     'Increase tension and forward momentum. Sharpen sentence rhythm. End on a stronger beat.',
  dialogue:    'Improve the dialogue. Make it sound more natural and character-specific. Reduce on-the-nose exchanges.',
  description: 'Improve the descriptive passages. Ground them in specific sensory detail. Cut generic or vague imagery.',
  emotion:     'Deepen the emotional layer. Show feeling through behavior and physical sensation rather than stated emotion.',
  custom:      'Apply the specific rewrite instruction provided.',
};

async function callAI(systemPrompt, userMessage) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Anthropic API error:', JSON.stringify(data));
    throw new Error('Anthropic error: ' + (data?.error?.message || `HTTP ${response.status}`));
  }

  if (!data?.content?.[0]?.text) {
    throw new Error('Empty response from Anthropic');
  }

  return data.content[0].text;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const selected_text = body.selected_text || '';
    const style_sample = body.style_sample || '';
    const genre = body.genre || '';
    const beat_style = body.beat_style || '';
    const chapter_number = body.chapter_number || '';
    const project_id = body.project_id || '';
    const save_as_default = body.save_as_default || false;
    const mode = body.mode || 'voice';
    const custom_instruction = body.custom_instruction || '';

    if (!selected_text.trim() || !style_sample.trim()) {
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

    const modeInstruction = REWRITE_MODES[mode] || REWRITE_MODES.voice;
    const fullModeInstruction = mode === 'custom' && custom_instruction
      ? `${modeInstruction} Instruction: ${custom_instruction}`
      : modeInstruction;

    const systemPrompt = `You are a ghostwriter who specializes in matching an author's existing voice. Your output must sound like the style sample provided — not like generic AI prose. Return only the rewritten passage. No commentary, no explanation, no preamble.`;

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

REWRITE MODE: ${fullModeInstruction}

Now rewrite the following passage to match that style exactly.
Preserve all plot events, character actions, and information from the original. Change only how it is written — not what happens.

ORIGINAL PASSAGE:
${selected_text}

CONTEXT (do not repeat, for reference only):
Genre: ${genre || 'Not specified'}
Beat Style: ${beat_style || 'Not specified'}
Chapter: ${chapter_number || 'N/A'}

REWRITE RULES:
- Match the length of the original passage within 10% (unless mode says otherwise)
- Do not add plot events that weren't in the original
- Do not remove plot events that were in the original
- Do not add character names that weren't present
- Preserve the emotional payload — change the delivery, not the meaning
- No author notes, no explanations — return only the rewritten passage

Return the rewritten passage only.`;

    const rewritten = await callAI(systemPrompt, userMessage);

    return Response.json({ rewritten_text: rewritten.trim() });
  } catch (error) {
    console.error('Rewrite error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});