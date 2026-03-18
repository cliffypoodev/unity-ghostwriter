import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const MODEL_MAP = {
  "claude-sonnet": { provider: "anthropic", modelId: "claude-sonnet-4-20250514" },
  "claude-haiku-4-5": { provider: "anthropic", modelId: "claude-haiku-4-5" },
  "gpt-4o": { provider: "openai", modelId: "gpt-4o" },
};

async function callAI(systemPrompt, userMessage) {
  // callType: consistency_check → resolves to Claude (Haiku for speed)
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 2000,
      temperature: 0.1,
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

    const { project_id, chapter_id, chapter_text } = await req.json();
    if (!project_id || !chapter_id || !chapter_text) {
      return Response.json({ error: 'project_id, chapter_id, and chapter_text required' }, { status: 400 });
    }

    // Load project state log and name registry
    const projects = await base44.entities.Project.filter({ id: project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    let stateLog = '';
    if (project.chapter_state_log) {
      try {
        if (project.chapter_state_log.startsWith('http')) {
          const r = await fetch(project.chapter_state_log);
          stateLog = r.ok ? await r.text() : '';
        } else {
          stateLog = project.chapter_state_log;
        }
      } catch (e) {
        console.warn('Failed to load state log:', e.message);
      }
    }

    const nameRegistry = project.name_registry || '';

    // If no state log, nothing to check against
    if (!stateLog.trim()) {
      return Response.json({ result: 'CLEAR', flags: [] });
    }

    const systemPrompt = "You are a manuscript continuity editor. Your only job is to find factual contradictions between a new chapter and the established Story Bible. Be specific and precise. Do not comment on style, quality, or subjective elements.";

    const userMessage = `Review the following new chapter against the Story Bible below.

STORY BIBLE (established facts):
${stateLog.length > 8000 ? stateLog.slice(-8000) : stateLog}

CHARACTER NAMES LOG:
${nameRegistry}

NEW CHAPTER:
${chapter_text.length > 6000 ? chapter_text.slice(0, 6000) : chapter_text}

Find any contradictions including:
- Character attributes that changed without explanation (eye color, injuries, items held, location, alive/dead)
- Timeline violations (events out of order, impossible timing)
- Location errors (character teleporting, impossible travel)
- Object continuity (item used that was lost or given away)
- Name inconsistencies (same character referred to by different names in a way that creates confusion)

For each contradiction found, return:
CONTRADICTION: [one sentence describing the conflict]
CHAPTER SENTENCE: [the exact sentence in the new chapter]
BIBLE REFERENCE: [which chapter/entry it conflicts with]

If no contradictions are found, return exactly: CLEAR

Do not return anything else.`;

    const result = await callAI(systemPrompt, userMessage);
    const trimmed = result.trim();

    if (trimmed === 'CLEAR' || trimmed.toUpperCase() === 'CLEAR') {
      return Response.json({ result: 'CLEAR', flags: [] });
    }

    // Parse contradiction entries
    const flags = [];
    const blocks = trimmed.split(/\n\n+/);
    for (const block of blocks) {
      const contradictionMatch = block.match(/CONTRADICTION:\s*(.+)/i);
      const sentenceMatch = block.match(/CHAPTER SENTENCE:\s*(.+)/i);
      const referenceMatch = block.match(/BIBLE REFERENCE:\s*(.+)/i);
      if (contradictionMatch) {
        flags.push({
          contradiction: contradictionMatch[1].trim(),
          chapter_sentence: sentenceMatch ? sentenceMatch[1].trim() : '',
          bible_reference: referenceMatch ? referenceMatch[1].trim() : '',
          dismissed: false,
        });
      }
    }

    // Save flags to chapter
    if (flags.length > 0) {
      await base44.entities.Chapter.update(chapter_id, {
        consistency_flags: JSON.stringify(flags),
      });
    }

    return Response.json({ result: flags.length > 0 ? 'FLAGS_FOUND' : 'CLEAR', flags });
  } catch (error) {
    console.error('Consistency check error:', error.message);
    return Response.json({ result: 'CLEAR', flags: [], error: error.message });
  }
});