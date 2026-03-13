import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

async function callAI(systemPrompt, userMessage) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error('Anthropic error: ' + (data.error?.message || response.status));
  return data.content[0].text;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { project_id, act_number, act_start, act_end } = await req.json();
  if (!project_id || !act_number || !act_start || !act_end) {
    return Response.json({ error: 'project_id, act_number, act_start, act_end required' }, { status: 400 });
  }

  // Load all chapters, spec, outline
  const [chapters, specs, outlines] = await Promise.all([
    base44.entities.Chapter.filter({ project_id }, 'chapter_number'),
    base44.entities.Specification.filter({ project_id }),
    base44.entities.Outline.filter({ project_id }),
  ]);

  const spec = specs[0];
  const outline = outlines[0];

  // Get the act's chapters (generated ones only)
  const actChapters = chapters.filter(c =>
    c.chapter_number >= act_start && c.chapter_number <= act_end && c.status === 'generated'
  );

  if (actChapters.length === 0) {
    return Response.json({ error: 'No generated chapters in this act' }, { status: 400 });
  }

  // Gather content summaries: state documents + last paragraphs
  const chapterSummaries = [];
  for (const ch of actChapters) {
    let lastParagraph = '';
    let content = ch.content || '';
    if (content.startsWith('http')) {
      try { content = await (await fetch(content)).text(); } catch { content = ''; }
    }
    if (content && !content.startsWith('<')) {
      const paragraphs = content.trim().split(/\n\n+/).filter(p => p.trim().length > 50);
      lastParagraph = paragraphs.slice(-1)[0]?.trim().slice(0, 500) || '';
    }

    chapterSummaries.push({
      number: ch.chapter_number,
      title: ch.title,
      summary: ch.summary || '',
      state_document: ch.state_document || '',
      word_count: ch.word_count || 0,
      last_paragraph: lastParagraph,
    });
  }

  // Load story bible for character reference
  let storyBible = null;
  if (outline) {
    let bibleRaw = outline.story_bible || '';
    if (!bibleRaw && outline.story_bible_url) {
      try { bibleRaw = await (await fetch(outline.story_bible_url)).text(); } catch {}
    }
    try { storyBible = bibleRaw ? JSON.parse(bibleRaw) : null; } catch {}
  }

  const characterNames = (storyBible?.characters || []).map(c => c.name).filter(Boolean).join(', ');

  const systemPrompt = `You are a story continuity editor creating a bridge document between acts of a novel. Your bridge document will be injected into the AI's context when generating the next act, so it must be precise, concrete, and structured.

Return ONLY the bridge document text — no preamble, no commentary.`;

  const userMessage = `Generate an Act ${act_number} Bridge Document for a ${spec?.genre || 'fiction'} novel.

CHARACTERS: ${characterNames || 'See state documents'}

GENRE: ${spec?.genre || 'Fiction'}
SUBGENRE: ${spec?.subgenre || 'N/A'}

ACT ${act_number} CHAPTERS (${actChapters.length} chapters, Ch ${act_start}–${act_end}):

${chapterSummaries.map(ch => `--- Chapter ${ch.number}: "${ch.title}" (${ch.word_count} words) ---
Summary: ${ch.summary}
${ch.state_document ? `State: ${ch.state_document.slice(0, 800)}` : ''}
Ending: ${ch.last_paragraph}
`).join('\n')}

Generate a structured bridge document with these EXACT sections:

NARRATIVE POSITION:
- Where each named character physically is at the end of Act ${act_number}
- What each character knows and doesn't know
- Any injuries, emotional states, or altered conditions

RELATIONSHIP MAP:
- Status of every significant relationship (allies, enemies, romantic, familial)
- What has changed since the start of Act ${act_number}
- Unresolved tension between specific characters

OPEN PLOT THREADS:
- Every unanswered question or unresolved plot element
- Mark each as: MUST_RESOLVE (critical) or SHOULD_ADDRESS (important but flexible)

ESCALATION STATUS:
- Current threat level and what specifically is at stake
- What has been permanently lost or changed (cannot be undone)
- What the protagonist believes vs what is actually true

BANNED CONTENT (for next act):
- Emotional beats that have already been used (don't repeat)
- Scene types that have already appeared (vary the approach)
- Any clichéd phrases or constructions that appeared in this act

TONE TRAJECTORY:
- What emotional register the next act should open with
- How intensity should shift from here

Keep the bridge document under 1500 words. Be specific — use character names, locations, and concrete plot details. No vague generalizations.`;

  const bridge = await callAI(systemPrompt, userMessage);

  // Store the bridge on the Project entity as a field, keyed by act number
  const project = (await base44.entities.Project.filter({ id: project_id }))[0];
  let bridges = {};
  if (project?.chapter_state_log) {
    // We'll store act bridges in a separate approach — append to state log
    // Actually, let's use a cleaner approach: store as a structured object
  }

  // Store bridge as a source file for persistence and visibility
  const existingBridges = await base44.entities.SourceFile.filter({ project_id });
  const bridgeFilename = `act_${act_number}_bridge.txt`;
  const existing = existingBridges.find(f => f.filename === bridgeFilename);
  
  if (existing) {
    await base44.entities.SourceFile.update(existing.id, {
      content: bridge,
      description: `Auto-generated bridge document for Act ${act_number} (Ch ${act_start}–${act_end})`,
    });
  } else {
    await base44.entities.SourceFile.create({
      project_id,
      filename: bridgeFilename,
      file_type: 'reference',
      content: bridge,
      description: `Auto-generated bridge document for Act ${act_number} (Ch ${act_start}–${act_end})`,
    });
  }

  return Response.json({ success: true, act_number, bridge_length: bridge.length });
});