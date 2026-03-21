import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const CHAPTER_COUNTS = { short: { min: 8, max: 12 }, medium: { min: 15, max: 25 }, long: { min: 25, max: 40 }, epic: { min: 40, max: 60 } };

function repairJSON(str) {
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escaped) { result += ch; escaped = false; continue; }
    if (ch === '\\') { escaped = true; result += ch; continue; }
    if (ch === '"') {
      if (!inString) { inString = true; result += ch; continue; }
      let j = i + 1;
      while (j < str.length && (str[j] === ' ' || str[j] === '\t' || str[j] === '\r' || str[j] === '\n')) j++;
      const next = str[j] || '';
      if (next === ':' || next === ',' || next === '}' || next === ']' || next === '') {
        inString = false; result += ch;
      } else { result += '\\"'; }
      continue;
    }
    if (inString) {
      if (ch === '\n') { result += '\\n'; continue; }
      if (ch === '\r') { result += '\\r'; continue; }
      if (ch === '\t') { result += '\\t'; continue; }
      const code = ch.charCodeAt(0);
      if (code < 32) { result += '\\u' + code.toString(16).padStart(4, '0'); continue; }
    }
    result += ch;
  }
  result = result.replace(/,\s*([}\]])/g, '$1');
  return result;
}

function robustParseJSON(raw) {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```[\w]*\n?/, '').replace(/\n?```\s*$/, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  try { return JSON.parse(repairJSON(cleaned)); } catch {}
  const objStart = cleaned.indexOf('{'), objEnd = cleaned.lastIndexOf('}');
  const arrStart = cleaned.indexOf('['), arrEnd = cleaned.lastIndexOf(']');
  const candidates = [];
  if (objStart !== -1 && objEnd > objStart) candidates.push(cleaned.slice(objStart, objEnd + 1));
  if (arrStart !== -1 && arrEnd > arrStart) candidates.push(cleaned.slice(arrStart, arrEnd + 1));
  for (const c of candidates) {
    try { return JSON.parse(c); } catch {}
    try { return JSON.parse(repairJSON(c)); } catch {}
  }
  let truncated = cleaned;
  const quoteCount = (truncated.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) truncated += '"';
  truncated = truncated.replace(/,\s*$/, '');
  const openBrackets = (truncated.match(/\[/g) || []).length - (truncated.match(/]/g) || []).length;
  const openBraces = (truncated.match(/{/g) || []).length - (truncated.match(/}/g) || []).length;
  for (let i = 0; i < openBrackets; i++) truncated += ']';
  for (let i = 0; i < openBraces; i++) truncated += '}';
  try { return JSON.parse(truncated); } catch {}
  try { return JSON.parse(repairJSON(truncated)); } catch {}
  throw new Error('Failed to parse JSON from AI response');
}

async function callGemini(systemPrompt, userMessage, maxTokens = 4000) {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userMessage }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
      })
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error('Gemini error: ' + (data.error?.message || response.status));
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callLumimaid(systemPrompt, userMessage, maxTokens = 4000) {
  const orKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!orKey) throw new Error('OPENROUTER_API_KEY not configured');
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + orKey, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://unity-ghostwriter.base44.app', 'X-Title': 'Unity Ghostwriter' },
    body: JSON.stringify({ model: 'neversleep/llama-3.1-lumimaid-70b', max_tokens: maxTokens, temperature: 0.7, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error('Lumimaid error: ' + (d.error?.message || r.status));
  if (!d.choices?.[0]?.message?.content) throw new Error('Lumimaid empty response');
  return d.choices[0].message.content;
}

function isEroticaGenre(genre, subgenre) {
  return /erotica|erotic/i.test(((genre || '') + ' ' + (subgenre || '')));
}

Deno.serve(async (req) => {
  const DEADLINE = Date.now() + 120000; // 55-second timeout guard
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id } = await req.json();
    if (!project_id) return Response.json({ error: 'project_id required' }, { status: 400 });

    const sr = base44.asServiceRole;

    // Get or create outline record
    const existingOutlines = await sr.entities.Outline.filter({ project_id });
    let outlineId;
    if (existingOutlines[0]) {
      outlineId = existingOutlines[0].id;
      await sr.entities.Outline.update(outlineId, { status: 'generating', error_message: '' });
    } else {
      const created = await sr.entities.Outline.create({ project_id, status: 'generating' });
      outlineId = created.id;
    }

    // Load spec
    const specs = await sr.entities.Specification.filter({ project_id });
    const rawSpec = specs[0];
    if (!rawSpec) {
      await sr.entities.Outline.update(outlineId, { status: 'error', error_message: 'No specification found' });
      return Response.json({ error: 'No specification found' }, { status: 400 });
    }

    const spec = {
      ...rawSpec,
      beat_style: rawSpec.beat_style || rawSpec.tone_style || "",
      spice_level: Math.max(0, Math.min(4, parseInt(rawSpec.spice_level) || 0)),
      language_intensity: Math.max(0, Math.min(4, parseInt(rawSpec.language_intensity) || 0)),
    };

    const chapterRange = CHAPTER_COUNTS[spec.target_length] || CHAPTER_COUNTS.medium;
    const targetChapters = spec.chapter_count
      ? parseInt(spec.chapter_count)
      : Math.floor((chapterRange.min + chapterRange.max) / 2);

    const truncatedTopic = spec.topic?.length > 400 ? spec.topic.slice(0, 400) : spec.topic;
    const isNonfiction = spec.book_type === 'nonfiction';

    // Single fast AI call: titles + summaries + character names only
    const systemPrompt = `You are a book outline architect. Return ONLY valid JSON. No prose, no preamble, no commentary.`;

    const userPrompt = `Generate a lightweight outline shell for a ${spec.genre || 'General'} ${spec.book_type || 'fiction'} book about "${truncatedTopic}"${spec.subgenre ? ` (subgenre: ${spec.subgenre})` : ''}.

The book has exactly ${targetChapters} chapters.
Target audience: ${spec.target_audience || 'general readers'}.

Return a JSON object with these fields:
{
  "title": "Book title",
  "subtitle": "Book subtitle",
  "character_names": ["Name1", "Name2", ...up to 5 main characters],
  "chapters": [
    { "number": 1, "title": "Chapter title", "summary": "One sentence summary" },
    ...exactly ${targetChapters} chapters
  ]
}

RULES:
- Exactly ${targetChapters} chapter objects in the array.
- Each summary must be ONE specific sentence — not vague.
- Character names must be distinct and genre-appropriate.
- ${isNonfiction ? 'This is NONFICTION. Chapters organized around arguments/themes, not fictional plot arcs. Characters are real people or composites.' : 'This is FICTION. Chapters should follow a compelling narrative arc.'}
- Return ONLY the JSON. Nothing else.`;

    // Timeout check before AI call
    if (Date.now() > DEADLINE) {
      await sr.entities.Outline.update(outlineId, { status: 'partial', error_message: 'Timed out before AI call' });
      return Response.json({ outline_id: outlineId, status: 'partial' });
    }

    console.log('Shell: Calling Gemini for titles+summaries...');
    const rawText = await callGemini(systemPrompt, userPrompt, 4000);

    // Timeout check after AI call
    if (Date.now() > DEADLINE) {
      // Save what we have as partial
      const shellFile = new File([rawText], `shell_${project_id}.json`, { type: 'application/json' });
      const uploadRes = await sr.integrations.Core.UploadFile({ file: shellFile });
      await sr.entities.Outline.update(outlineId, { outline_url: uploadRes.file_url, status: 'partial', error_message: 'Timed out after AI call' });
      return Response.json({ outline_id: outlineId, status: 'partial' });
    }

    const shell = robustParseJSON(rawText);

    // Save shell outline as file
    const shellOutline = { shell: true, chapters: shell.chapters || [], character_names: shell.character_names || [] };
    const shellJson = JSON.stringify(shellOutline);
    const shellFile = new File([shellJson], `outline_shell_${project_id}.json`, { type: 'application/json' });
    const uploadRes = await sr.integrations.Core.UploadFile({ file: shellFile });

    // Save book metadata
    const bookMetadata = { title: shell.title || 'Untitled', subtitle: shell.subtitle || '', description: '', keywords: [] };

    await sr.entities.Outline.update(outlineId, {
      outline_url: uploadRes.file_url,
      book_metadata: JSON.stringify(bookMetadata),
      status: 'shell_complete',
      error_message: '',
    });

    // Update project name
    if (shell.title) {
      try { await sr.entities.Project.update(project_id, { name: shell.title }); } catch {}
    }

    // Create chapter records from shell
    const existingChapters = await sr.entities.Chapter.filter({ project_id });
    if (existingChapters.length > 0) {
      await Promise.all(existingChapters.map(c => sr.entities.Chapter.delete(c.id)));
    }

    const chapterRecords = (shell.chapters || []).map((ch, idx) => ({
      project_id,
      chapter_number: ch.number || idx + 1,
      title: ch.title || `Chapter ${idx + 1}`,
      summary: ch.summary || '',
      prompt: '',
      status: 'pending',
      word_count: 0,
    }));
    if (chapterRecords.length > 0) {
      await sr.entities.Chapter.bulkCreate(chapterRecords);
    }

    console.log(`Shell complete: ${chapterRecords.length} chapters, ${(shell.character_names||[]).length} characters`);
    return Response.json({ outline_id: outlineId, status: 'shell_complete', chapters: chapterRecords.length });

  } catch (error) {
    console.error('generateOutlineShell error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});