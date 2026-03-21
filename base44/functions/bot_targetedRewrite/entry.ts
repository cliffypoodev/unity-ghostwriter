// ═══════════════════════════════════════════════════════════════════════════════
// BOT — TARGETED REWRITE
// ═══════════════════════════════════════════════════════════════════════════════
// Takes a chapter + list of specific issues, rewrites ONLY the affected
// sentences/paragraphs using AI. Does NOT touch prose that has no issues.
// Designed to fix residual issues that regex-based fixers can't handle:
//   - interiority word over-use (synonyms in context)
//   - sensory opener monotony (rewrite opening paragraph)
//   - tense drift (fix verb tenses in context)
// ═══════════════════════════════════════════════════════════════════════════════

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ═══ AI ROUTER (minimal — only needs one model) ═══

async function callAI(systemPrompt, userMessage) {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set');
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: userMessage }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.3, maxOutputTokens: 16384 }
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error('Gemini: ' + (d.error?.message || r.status));
  if (!d?.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error('Gemini empty response');
  return d.candidates[0].content.parts[0].text;
}

// ═══ ISSUE EXTRACTION ═══

function extractIssueContext(prose, findings) {
  const tasks = [];
  const hasDoubleBreaks = /\n\n/.test(prose);
  const paras = hasDoubleBreaks ? prose.split(/\n\n+/) : prose.split(/\n/);

  for (const f of findings) {
    if (f.category === 'interiority_repetition') {
      // Extract the word from the label, e.g. '"hollow" x5 (cap: 2)' → "hollow"
      const wordMatch = f.label.match(/"([^"]+)"/);
      if (!wordMatch) continue;
      const word = wordMatch[1].toLowerCase();
      const capMatch = f.label.match(/cap:\s*(\d+)/);
      const cap = capMatch ? parseInt(capMatch[1]) : 1;
      const countMatch = f.label.match(/x(\d+)/);
      const total = countMatch ? parseInt(countMatch[1]) : 0;
      const excess = Math.max(0, total - cap);
      if (excess <= 0) continue;

      // Find paragraphs containing this word (skip first `cap` occurrences)
      const rx = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      let seen = 0;
      for (let i = 0; i < paras.length; i++) {
        const matches = paras[i].match(rx);
        if (matches) {
          for (const m of matches) {
            seen++;
            if (seen > cap) {
              tasks.push({
                type: 'interiority',
                paraIndex: i,
                word: word,
                instruction: `Replace "${word}" with a contextually appropriate synonym. Do NOT use: ${word}. Keep the sentence meaning identical.`,
              });
              break; // one task per paragraph
            }
          }
        }
      }
    }

    if (f.category === 'sensory_opener') {
      // The opener is always paragraph 0
      tasks.push({
        type: 'sensory_opener',
        paraIndex: 0,
        instruction: 'Rewrite this opening paragraph to start with dialogue, action, or a thought — NOT a sensory/atmospheric description. Keep the same content and meaning, just change the opening approach.',
      });
    }

    if (f.category === 'tense_drift') {
      // Find paragraphs with tense issues
      const isPastNarrative = f.label.includes('present-tense verbs in past');
      const driftRx = isPastNarrative
        ? /\b(he|she|they|it|I|we)\s+(walks|runs|says|thinks|feels|knows|sees|hears|stands|sits|looks|moves|turns|opens|closes|steps|reaches|pulls|pushes|watches|presses|asks)\b/gi
        : /\b(he|she|they|it|I|we)\s+(walked|ran|said|thought|felt|knew|saw|heard|stood|sat|looked|moved|turned|opened|closed|stepped|reached|pulled|pushed|watched|pressed|asked)\b/gi;

      for (let i = 0; i < paras.length; i++) {
        if (driftRx.test(paras[i])) {
          driftRx.lastIndex = 0;
          tasks.push({
            type: 'tense_fix',
            paraIndex: i,
            instruction: isPastNarrative
              ? 'Fix tense: convert present-tense verbs to past tense. This is a past-tense narrative.'
              : 'Fix tense: convert past-tense verbs to present tense. This is a present-tense narrative.',
          });
        }
      }
    }
  }

  return tasks;
}

// ═══ BATCH REWRITE ═══

async function batchRewrite(prose, tasks) {
  if (tasks.length === 0) return prose;

  const hasDoubleBreaks = /\n\n/.test(prose);
  const paras = hasDoubleBreaks ? prose.split(/\n\n+/) : prose.split(/\n/);
  const PARA_JOIN = hasDoubleBreaks ? '\n\n' : '\n';

  // Group tasks by paragraph index
  const tasksByPara = {};
  for (const t of tasks) {
    if (!tasksByPara[t.paraIndex]) tasksByPara[t.paraIndex] = [];
    tasksByPara[t.paraIndex].push(t);
  }

  const paraIndices = Object.keys(tasksByPara).map(Number).sort((a, b) => a - b);
  if (paraIndices.length === 0) return prose;

  // Build a single AI prompt with all paragraphs that need fixing
  const systemPrompt = `You are a prose editor. You will receive numbered paragraphs with specific fix instructions.
For each paragraph, apply ONLY the requested fix. Do NOT change anything else.
Return the fixed paragraphs in the EXACT format:

[PARA_INDEX]
fixed paragraph text here

[PARA_INDEX]
fixed paragraph text here

Rules:
- Keep paragraph length within 10% of original
- Maintain the same voice, tone, and style
- Do NOT add commentary or explanations
- Do NOT change content beyond the specific fix requested
- Return ONLY the fixed paragraphs, nothing else`;

  const parts = [];
  for (const idx of paraIndices) {
    const para = paras[idx];
    if (!para || para.trim().length < 20) continue;
    const instructions = tasksByPara[idx].map(t => t.instruction).join('; ');
    parts.push(`[${idx}]\nINSTRUCTION: ${instructions}\nORIGINAL:\n${para}`);
  }

  if (parts.length === 0) return prose;

  const userMessage = parts.join('\n\n---\n\n');

  let aiResponse;
  try {
    aiResponse = await callAI(systemPrompt, userMessage);
  } catch (err) {
    console.warn('AI rewrite failed:', err.message);
    return prose; // return unchanged on AI failure
  }

  // Parse the AI response — extract [INDEX]\ntext blocks
  const fixedParas = {};
  const blocks = aiResponse.split(/\[(\d+)\]\s*\n/);
  // blocks = ['', '0', 'text...', '3', 'text...', ...]
  for (let i = 1; i < blocks.length; i += 2) {
    const idx = parseInt(blocks[i]);
    const text = (blocks[i + 1] || '').trim();
    if (!isNaN(idx) && text.length > 20) {
      // Safety: don't accept rewrites that are <50% or >200% of original
      const origLen = (paras[idx] || '').length;
      if (origLen > 0 && text.length >= origLen * 0.5 && text.length <= origLen * 2.0) {
        fixedParas[idx] = text;
      } else {
        console.warn(`Rejected rewrite for para ${idx}: ${text.length} chars vs original ${origLen} chars`);
      }
    }
  }

  // Apply fixes
  let fixCount = 0;
  for (const [idx, newText] of Object.entries(fixedParas)) {
    const i = parseInt(idx);
    if (i >= 0 && i < paras.length) {
      paras[i] = newText;
      fixCount++;
    }
  }

  console.log(`Targeted rewrite: ${fixCount}/${paraIndices.length} paragraphs rewritten`);
  return paras.join(PARA_JOIN);
}

// ═══ MAIN ═══

async function resolveContent(content) {
  if (!content) return '';
  if (typeof content === 'string' && (content.startsWith('http://') || content.startsWith('https://'))) {
    try { const r = await fetch(content); if (!r.ok) return ''; const t = await r.text(); if (t.trim().startsWith('<')) return ''; return t; } catch { return ''; }
  }
  return content;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, chapter_id, findings } = await req.json();
    if (!project_id || !chapter_id || !findings) {
      return Response.json({ error: 'project_id, chapter_id, and findings required' }, { status: 400 });
    }

    // Load chapter content
    const [chapter] = await base44.entities.Chapter.filter({ id: chapter_id });
    if (!chapter) return Response.json({ error: 'Chapter not found' }, { status: 404 });

    const prose = await resolveContent(chapter.content);
    if (!prose || prose.length < 100) {
      return Response.json({ error: 'No content to rewrite' }, { status: 400 });
    }

    // Extract rewrite tasks from findings
    const tasks = extractIssueContext(prose, findings);
    if (tasks.length === 0) {
      return Response.json({ rewritten: false, reason: 'No rewritable issues found', tasks: 0 });
    }

    console.log(`targetedRewrite: Ch ${chapter.chapter_number} — ${tasks.length} tasks from ${findings.length} findings`);

    // Batch rewrite
    const rewritten = await batchRewrite(prose, tasks);

    // Safety check
    if (rewritten.length < prose.length * 0.8) {
      console.error(`SAFETY: Rewrite too short (${rewritten.length} vs ${prose.length})`);
      return Response.json({ rewritten: false, reason: 'Safety guard: rewrite too short', tasks: tasks.length });
    }

    // Save
    const encoder = new TextEncoder();
    const bytes = encoder.encode(rewritten);
    const blob = new Blob([bytes], { type: 'text/plain' });
    const file = new File([blob], `chapter_${chapter_id}_rewritten.txt`, { type: 'text/plain' });
    const uploadResult = await base44.integrations.Core.UploadFile({ file });
    if (uploadResult?.file_url) {
      await base44.entities.Chapter.update(chapter_id, {
        content: uploadResult.file_url,
        word_count: rewritten.trim().split(/\s+/).length,
      });
    }

    return Response.json({
      rewritten: true,
      tasks: tasks.length,
      paragraphs_affected: [...new Set(tasks.map(t => t.paraIndex))].length,
      word_count: rewritten.trim().split(/\s+/).length,
    });
  } catch (error) {
    console.error('targetedRewrite error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});