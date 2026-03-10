import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Generate a Chapter State Document after a chapter is written and accepted.
// This tracks character positions, plot threads, banned phrases, escalation stage,
// and relationship status — forming a persistent state log injected into all subsequent chapters.

function getEscalationTarget(chapterNumber, totalChapters) {
  const ratio = chapterNumber / totalChapters;
  if (ratio <= 0.25) return { min: 1, max: 2, label: 'Stage 1-2 (establish world, introduce tension)' };
  if (ratio <= 0.50) return { min: 3, max: 4, label: 'Stage 3-4 (cost of choices, first breach)' };
  if (ratio <= 0.75) return { min: 4, max: 5, label: 'Stage 4-5 (consequences, no retreat)' };
  if (ratio < 0.95) return { min: 5, max: 6, label: 'Stage 5-6 (execution, no new plot)' };
  return { min: 6, max: 6, label: 'Stage 6 (resolution)' };
}

async function callClaude(systemPrompt, userMessage, maxTokens = 4096) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'),
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error('Anthropic error: ' + (data.error?.message || response.status));
  return data.content[0].text;
}

async function callOpenRouter(systemPrompt, userMessage, openrouterModel, maxTokens = 4096) {
  const orKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!orKey) throw new Error('OpenRouter generation failed: OPENROUTER_API_KEY not configured');
  const model = openrouterModel || 'meta-llama/llama-3.1-70b-instruct';
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + orKey, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://unity-ghostwriter.base44.app', 'X-Title': 'Unity Ghostwriter' },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.3, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error('OpenRouter generation failed: ' + (data.error?.message || JSON.stringify(data.error) || response.status));
  if (!data.choices?.[0]?.message?.content) throw new Error('OpenRouter generation failed: empty response');
  return data.choices[0].message.content;
}

function isEroticaGenre(spec) {
  return /erotica|erotic/.test(((spec?.genre || '') + ' ' + (spec?.subgenre || '')).toLowerCase());
}

async function resolveContent(content) {
  if (!content) return '';
  if (content.startsWith('http://') || content.startsWith('https://')) {
    const r = await fetch(content);
    if (!r.ok) return '';
    const t = await r.text();
    if (t.trim().startsWith('<')) return '';
    return t;
  }
  return content;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { project_id, chapter_id } = await req.json();
  if (!project_id || !chapter_id) {
    return Response.json({ error: 'project_id and chapter_id required' }, { status: 400 });
  }

  // Load chapter, project, and all previous state documents
  const [allChapters, projects] = await Promise.all([
    base44.entities.Chapter.filter({ project_id }, 'chapter_number'),
    base44.entities.Project.filter({ id: project_id }),
  ]);

  const project = projects[0];
  if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

  const chapter = allChapters.find(c => c.id === chapter_id);
  if (!chapter) return Response.json({ error: 'Chapter not found' }, { status: 404 });
  if (chapter.status !== 'generated') {
    return Response.json({ error: 'Chapter must be generated before creating state document' }, { status: 400 });
  }

  // Resolve chapter content
  const chapterContent = await resolveContent(chapter.content);
  if (!chapterContent || chapterContent.length < 100) {
    return Response.json({ error: 'Chapter content too short or unavailable' }, { status: 400 });
  }

  const totalChapters = allChapters.length;
  const escalationTarget = getEscalationTarget(chapter.chapter_number, totalChapters);

  // Load existing state log from project
  let existingStateLog = '';
  if (project.chapter_state_log) {
    existingStateLog = await resolveContent(project.chapter_state_log);
  }

  // Load previous chapter's state document for carry-forward context
  const prevChapter = allChapters.find(c => c.chapter_number === chapter.chapter_number - 1);
  let prevStateDoc = '';
  if (prevChapter?.state_document) {
    prevStateDoc = prevChapter.state_document;
  }

  // Build the state generation prompt
  const systemPrompt = `You are a manuscript continuity tracker. Your job is to analyze a chapter that was just written and generate a precise Chapter State Document. This document will be used to maintain continuity across all subsequent chapters.

You must output EXACTLY the format specified — no additional commentary, no preamble, no explanation. Just the structured output.

ESCALATION STAGE GUIDE (for a ${totalChapters}-chapter book):
- Chapters 1-${Math.floor(totalChapters * 0.25)}: Stage 1-2 (establish world, introduce tension, no resolution)
- Chapters ${Math.floor(totalChapters * 0.25) + 1}-${Math.floor(totalChapters * 0.50)}: Stage 3-4 (cost of choices, first breach of professional/personal line)
- Chapters ${Math.floor(totalChapters * 0.50) + 1}-${Math.floor(totalChapters * 0.75)}: Stage 4-5 (consequences, characters cannot retreat to prior state)
- Chapters ${Math.floor(totalChapters * 0.75) + 1}-${totalChapters - 1}: Stage 5-6 (execution of all prior choices, no new plot introduced)
- Chapter ${totalChapters}: Stage 6 resolution (answers the question posed in Chapter 1)

Current chapter is ${chapter.chapter_number} of ${totalChapters}. Expected escalation range: ${escalationTarget.label}.`;

  const userMessage = `${prevStateDoc ? `PREVIOUS CHAPTER STATE DOCUMENT (carry forward open threads):\n${prevStateDoc}\n\n---\n\n` : ''}The following chapter was just written and accepted. Generate a Chapter State Document update in exactly this format — no additional commentary, no preamble, just the structured output:

LAST CHAPTER WRITTEN: ${chapter.chapter_number}
CHAPTER TITLE: ${chapter.title}
FINAL LOCATION OF EACH CHARACTER: [name — location]
PHYSICAL AND EMOTIONAL STATE OF EACH CHARACTER: [name — state]
NEW INFORMATION ESTABLISHED: [bullet list of what the reader now knows that they did not before this chapter]
PLOT THREADS ACTIVATED THIS CHAPTER: [bullet list]
PLOT THREADS STILL OPEN: [bullet list — carry forward from previous state document plus any new ones, remove any that were resolved]
PHRASES AND METAPHORS USED THIS CHAPTER: [bullet list of distinctive phrases, metaphors, similes, and literary images — these are permanently banned from reuse in any subsequent chapter]
RELATIONSHIP STATUS BETWEEN CENTRAL CHARACTERS: [one sentence describing where the central relationship stands at chapter end]
ESCALATION STAGE: [1 through 6 — where 1 is lowest tension and 6 is highest. Target range for this chapter: ${escalationTarget.label}]
FINAL LINE OF CHAPTER: [exact text of the last sentence written]
OPEN QUESTION CARRIED INTO NEXT CHAPTER: [the specific unresolved threat, question, or discovery the reader is left with]

CHAPTER TEXT:
${chapterContent}`;

  // Load spec to check genre for routing
  const specs = await base44.entities.Specification.filter({ project_id });
  const spec = specs[0] || {};

  // Generate state document — route erotica to OpenRouter
  let stateDocument;
  if (isEroticaGenre(spec)) {
    console.log(`Erotica genre detected — routing state generation to OpenRouter`);
    stateDocument = await callOpenRouter(systemPrompt, userMessage, spec.openrouter_model, 2048);
  } else {
    stateDocument = await callClaude(systemPrompt, userMessage, 2048);
  }

  // Parse banned phrases from state document
  const phrasesMatch = stateDocument.match(/PHRASES AND METAPHORS USED THIS CHAPTER:\s*([\s\S]*?)(?=\nRELATIONSHIP STATUS|$)/i);
  const newPhrases = [];
  if (phrasesMatch) {
    const lines = phrasesMatch[1].split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('•'));
    for (const line of lines) {
      const phrase = line.replace(/^[\s\-•*]+/, '').trim().toLowerCase();
      if (phrase.length > 3 && phrase.length < 80) {
        newPhrases.push(phrase);
      }
    }
  }

  // Load existing banned phrases from project
  let existingBannedPhrases = [];
  if (project.banned_phrases_log) {
    try { existingBannedPhrases = JSON.parse(project.banned_phrases_log); } catch {}
  }
  const allBannedPhrases = [...new Set([...existingBannedPhrases, ...newPhrases])];

  // Append new state document to the full log
  const separator = `\n\n${'='.repeat(60)}\n\n`;
  const updatedLog = existingStateLog
    ? existingStateLog + separator + stateDocument
    : stateDocument;

  // Upload state log as file if it's large, otherwise store inline
  let stateLogValue = updatedLog;
  if (updatedLog.length > 25000) {
    const logFile = new File([updatedLog], `state_log_${project_id}.txt`, { type: 'text/plain' });
    const uploadResult = await base44.integrations.Core.UploadFile({ file: logFile });
    if (uploadResult?.file_url) stateLogValue = uploadResult.file_url;
  }

  // Update chapter with its state document, and project with cumulative log + banned phrases
  await Promise.all([
    base44.entities.Chapter.update(chapter_id, { state_document: stateDocument }),
    base44.entities.Project.update(project_id, {
      chapter_state_log: stateLogValue,
      banned_phrases_log: JSON.stringify(allBannedPhrases),
    }),
  ]);

  return Response.json({
    success: true,
    state_document: stateDocument,
    new_phrases_count: newPhrases.length,
    total_banned_phrases: allBannedPhrases.length,
    escalation_target: escalationTarget.label,
  });
});