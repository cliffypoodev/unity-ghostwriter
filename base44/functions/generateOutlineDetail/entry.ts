import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Inline AI router — same as generateOutline
const MODEL_MAP = {
  "gemini-pro": { provider: "google", modelId: "gemini-2.5-flash", defaultTemp: 0.6 },
  "claude-sonnet": { provider: "anthropic", modelId: "claude-sonnet-4-20250514", defaultTemp: 0.6 },
  "lumimaid": { provider: "openrouter", modelId: "neversleep/llama-3.1-lumimaid-70b", defaultTemp: 0.7 },
};

async function callAI(modelKey, systemPrompt, userMessage, options = {}) {
  // callType: outline → all outline detail calls resolve to Gemini
  const config = MODEL_MAP[modelKey] || MODEL_MAP["gemini-pro"];
  const temperature = options.temperature ?? config.defaultTemp;
  const maxTokens = options.maxTokens ?? 8192;

  if (config.provider === "google") {
    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + config.modelId + ':generateContent?key=' + Deno.env.get('GOOGLE_AI_API_KEY'),
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: userMessage }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: 'application/json' } }) }
    );
    const d = await r.json();
    if (!r.ok) throw new Error('Gemini error: ' + (d.error?.message || r.status));
    return d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  if (config.provider === "anthropic") {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.modelId, max_tokens: maxTokens, temperature, system: systemPrompt, messages: [{ role: 'user', content: userMessage }] }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error('Anthropic error: ' + (d.error?.message || r.status));
    return d.content[0].text;
  }
  if (config.provider === "openrouter") {
    const orKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!orKey) throw new Error('OPENROUTER_API_KEY not configured');
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + orKey, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://unity-ghostwriter.base44.app', 'X-Title': 'Unity Ghostwriter' },
      body: JSON.stringify({ model: config.modelId, max_tokens: maxTokens, temperature, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error('OpenRouter error: ' + (d.error?.message || r.status));
    if (!d.choices?.[0]?.message?.content) throw new Error('OpenRouter empty response');
    return d.choices[0].message.content;
  }
  throw new Error('Unknown provider');
}

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
  // Try extracting outermost object or array
  const objStart = cleaned.indexOf('{'), objEnd = cleaned.lastIndexOf('}');
  const arrStart = cleaned.indexOf('['), arrEnd = cleaned.lastIndexOf(']');
  const candidates = [];
  if (objStart !== -1 && objEnd > objStart) candidates.push(cleaned.slice(objStart, objEnd + 1));
  if (arrStart !== -1 && arrEnd > arrStart) candidates.push(cleaned.slice(arrStart, arrEnd + 1));
  for (const c of candidates) {
    try { return JSON.parse(c); } catch {}
    try { return JSON.parse(repairJSON(c)); } catch {}
  }
  // Truncation repair — close unterminated strings/brackets
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

function isRefusal(text) {
  if (!text || text.trim().length < 50) return true;
  const lower = text.toLowerCase();
  const indicators = ["i can't", "i cannot", "i apologize", "as an ai", "content policy"];
  return indicators.some(p => lower.includes(p)) || text.trim().length < 100;
}

// Beat template detection (simplified inline)
function autoDetectBeatTemplate(genre, bookType) {
  const g = (genre || '').toLowerCase();
  if (bookType === 'nonfiction') {
    if (/self.help|business|psychology|science|health/.test(g)) return 'argument-driven';
    if (/memoir|biography|history|true crime/.test(g)) return 'narrative-nonfiction';
    if (/reference|education|how.to|technical/.test(g)) return 'reference-structured';
    if (/investigat|journalism|expos|politic/.test(g)) return 'investigative-nonfiction';
    return 'argument-driven';
  }
  if (/romance|erotica/.test(g)) return 'romance-arc';
  if (/thriller|mystery|suspense|crime/.test(g)) return 'thriller-tension';
  if (/fantasy|science fiction|adventure|epic/.test(g)) return 'heros-journey';
  return 'save-the-cat';
}

Deno.serve(async (req) => {
  const DEADLINE = Date.now() + 110000; // 110s guard — 25-chapter books need ~5 AI calls
  let outlineId = null;

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id } = await req.json();
    if (!project_id) return Response.json({ error: 'project_id required' }, { status: 400 });

    const sr = base44.asServiceRole;

    // Load outline, spec, shell data
    const [outlines, specs] = await Promise.all([
      sr.entities.Outline.filter({ project_id }),
      sr.entities.Specification.filter({ project_id }),
    ]);

    const outline = outlines[0];
    if (!outline) return Response.json({ error: 'No outline found' }, { status: 404 });
    outlineId = outline.id;

    await sr.entities.Outline.update(outlineId, { status: 'generating', error_message: '' });

    const rawSpec = specs[0];
    if (!rawSpec) {
      await sr.entities.Outline.update(outlineId, { status: 'error', error_message: 'No spec' });
      return Response.json({ error: 'No spec' }, { status: 400 });
    }

    const spec = {
      ...rawSpec,
      beat_style: rawSpec.beat_style || rawSpec.tone_style || "",
      spice_level: Math.max(0, Math.min(4, parseInt(rawSpec.spice_level) || 0)),
      language_intensity: Math.max(0, Math.min(4, parseInt(rawSpec.language_intensity) || 0)),
    };

    // Load shell data from outline_url
    let shellData = null;
    if (outline.outline_url) {
      try {
        const resp = await fetch(outline.outline_url);
        const text = await resp.text();
        shellData = JSON.parse(text);
      } catch (e) { console.warn('Shell parse failed:', e.message); }
    }

    const shellChapters = shellData?.chapters || [];
    const shellCharacters = shellData?.character_names || [];
    const targetChapters = shellChapters.length || 20;
    const truncatedTopic = spec.topic?.length > 400 ? spec.topic.slice(0, 400) : spec.topic;
    const isNonfiction = spec.book_type === 'nonfiction';
    const isErotica = /erotica|erotic/i.test(((spec.genre || '') + ' ' + (spec.subgenre || '')));
    const modelKey = isErotica ? 'lumimaid' : 'gemini-pro';

    const shellContext = `EXISTING SHELL (titles and summaries already approved — do NOT change titles):\n${shellChapters.map(c => `Ch ${c.number}: "${c.title}" — ${c.summary}`).join('\n')}\n\nCharacter names: ${shellCharacters.join(', ')}`;

    // ── STEP 1: Story Bible ──────────────────────────────────────────────────
    console.log('Detail: Generating story bible...');
    const bibleSystem = `You are a story bible architect. Return ONLY valid JSON. No commentary.`;
    const biblePrompt = `Generate a detailed story bible for a ${spec.genre || 'General'} ${spec.book_type} book about "${truncatedTopic}"${spec.subgenre ? ` (subgenre: ${spec.subgenre})` : ''} with ${targetChapters} chapters.

${shellContext}

Return a JSON object with:
- world: Setting (1 sentence)
- tone_voice: Voice and tone (1 sentence)
- style_guidelines: Style (1-2 sentences)
- rules: Array of 5 consistency rules
- characters: Array (max 5) using the character names above. Each with: name, role, description (1-2 sentences), arc (1 sentence), first_appearance (chapter number)${isNonfiction ? '' : ', voice_profile (object: vocabulary_level, sentence_pattern, verbal_tic, never_says, physical_communication), character_backstory (object: formative_event, location, people_involved (array), emotional_consequence), capabilities_under_pressure (object: combat_training, weapons_experience, violence_response, lethal_force)'}
- world_rules: Object with setting_unique_details (array 3+), social_rules (array), economy (string)

Return ONLY JSON.`;

    if (Date.now() > DEADLINE) {
      await sr.entities.Outline.update(outlineId, { status: 'partial', error_message: 'Timed out before story bible' });
      return Response.json({ outline_id: outlineId, status: 'partial' });
    }

    const bibleText = await callAI(modelKey, bibleSystem, biblePrompt, { maxTokens: 3000 });
    let storyBible = null;
    try {
      storyBible = robustParseJSON(bibleText);
    } catch (e) { console.warn('Bible parse failed:', e.message); }

    // Save bible immediately as partial progress
    let story_bible_url = '';
    if (storyBible) {
      const bf = new File([JSON.stringify(storyBible)], `story_bible_${project_id}.json`, { type: 'application/json' });
      const ur = await sr.integrations.Core.UploadFile({ file: bf });
      story_bible_url = ur.file_url;
      await sr.entities.Outline.update(outlineId, { story_bible_url });
    }

    // ── STEP 2: Detailed chapters (prompts, beats, structural fields) in batches ──
    console.log('Detail: Generating chapter detail...');
    const templateKey = spec.beat_sheet_template && spec.beat_sheet_template !== 'auto'
      ? spec.beat_sheet_template
      : autoDetectBeatTemplate(spec.genre, spec.book_type);

    const detailSystem = `You are a book outline detailer. Given chapter titles and summaries, add structural detail. Return ONLY valid JSON arrays.`;
    const CHUNK_SIZE = 6;
    const allDetailedChapters = [];

    for (let start = 0; start < shellChapters.length; start += CHUNK_SIZE) {
      if (Date.now() > DEADLINE) {
        console.warn('Detail: Deadline approaching, saving partial...');
        break;
      }

      const chunk = shellChapters.slice(start, start + CHUNK_SIZE);
      const chunkNums = chunk.map(c => c.number || start + 1).join('-');
      console.log(`Detail batch: chapters ${chunkNums}...`);

      const prevContext = allDetailedChapters.length > 0
        ? `Previous chapter ended with: "${allDetailedChapters[allDetailedChapters.length - 1].transition_to || 'N/A'}"`
        : '';

      const detailPrompt = `Add structural detail to these ${chunk.length} chapters of a ${spec.genre} ${spec.book_type} book about "${truncatedTopic}".
Beat template: ${templateKey}

${shellContext}

CHAPTERS TO DETAIL:
${chunk.map(c => `Ch ${c.number}: "${c.title}" — ${c.summary}`).join('\n')}

${prevContext}

For each chapter, return these fields:
- number, title (keep EXACTLY as given), summary (keep as given)
- prompt: 100-150 words with HOOK, PLOT/CONTENT, ARC/STRUCTURE, EMOTION, TRANSITION_IN, TRANSITION_OUT
- scope_boundary, opens_with, primary_beat
${isNonfiction ? '- argument_advance, threads_activated (array), threads_paid_off (array), must_not_do (array 2+)' : '- character_development, relationship_shift, threads_activated (array), threads_paid_off (array), must_not_do (array 2+)'}
- transition_from (null for ch 1), transition_to
- beat_name, beat_function, beat_scene_type${isNonfiction ? ' (exposition/case_study/analysis/how_to/synthesis/scene_recreation/profile/investigative/teaching)' : ' (scene/sequel)'}, beat_tempo (fast/medium/slow)

Return a JSON array with exactly ${chunk.length} objects. No prose outside the array.`;

      let text = '';
      let parsed = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          text = await callAI(modelKey, detailSystem, detailPrompt, { maxTokens: 8000 });
          if (isRefusal(text)) { console.warn(`Detail batch ${chunkNums}: refusal on attempt ${attempt + 1}`); continue; }
          parsed = robustParseJSON(text);
          if (Array.isArray(parsed) && parsed.length > 0) break;
          parsed = null;
        } catch (e) {
          console.warn(`Detail batch ${chunkNums}: attempt ${attempt + 1} failed:`, e.message);
          if (attempt < 2) await new Promise(r => setTimeout(r, 2000)); // brief pause before retry
        }
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        allDetailedChapters.push(...parsed);
      } else {
        console.error(`Detail batch ${chunkNums}: all attempts failed, using shell fallback`);
        allDetailedChapters.push(...chunk.map(c => ({ ...c, prompt: c.summary || '' })));
      }
    }

    // ── STEP 3: Scope lock ──────────────────────────────────────────────────
    let scopeLock = null;
    if (Date.now() < DEADLINE) {
      console.log('Detail: Generating scope lock...');
      try {
        const slPrompt = `Generate a scope lock for a ${targetChapters}-chapter ${spec.genre} ${spec.book_type} book about "${truncatedTopic}". Return JSON with:
- throughline: One sentence
- escalation_map: Array of 4 objects with block (1-4), chapters, intensity (1-10 increasing), description
${isNonfiction ? '- concept_budget: Array of {concept, primary_chapter, supporting_chapters}' : '- relationship_arc: Array of 5 {checkpoint, state} — each unique'}
- thread_register: Array of {thread, introduced_chapter, payoff_chapter}
Return ONLY JSON.`;
        const slText = await callAI(modelKey, detailSystem, slPrompt, { maxTokens: 2000 });
        scopeLock = robustParseJSON(slText);
      } catch (e) { console.warn('Scope lock failed:', e.message); }
    }

    // ── STEP 4: Book metadata (generate full description if shell only had title) ──
    let bookMetadata = null;
    try { bookMetadata = JSON.parse(outline.book_metadata || '{}'); } catch { bookMetadata = {}; }
    if (!bookMetadata.description && Date.now() < DEADLINE) {
      try {
        const metaText = await callAI(modelKey, 'Return ONLY valid JSON.', `Generate publishing metadata for "${bookMetadata.title || truncatedTopic}". Return: {"title":"...","subtitle":"...","description":"2-3 paragraphs","keywords":["k1","k2",...7]}`, { maxTokens: 1500 });
        const meta = robustParseJSON(metaText);
        bookMetadata = { ...bookMetadata, ...meta };
      } catch {}
    }

    // ── Save complete outline ──────────────────────────────────────────────
    const isPartial = allDetailedChapters.length < shellChapters.length;
    // Fill in any missing chapters from shell
    if (isPartial) {
      for (let i = allDetailedChapters.length; i < shellChapters.length; i++) {
        allDetailedChapters.push({ ...shellChapters[i], prompt: shellChapters[i].summary || '' });
      }
    }

    const parsedOutline = { scope_lock: scopeLock, chapters: allDetailedChapters };
    const outlineJson = JSON.stringify(parsedOutline);
    const outlineFile = new File([outlineJson], `outline_${project_id}.json`, { type: 'application/json' });
    const outlineUpload = await sr.integrations.Core.UploadFile({ file: outlineFile });

    const finalStatus = isPartial ? 'partial' : 'complete';
    await sr.entities.Outline.update(outlineId, {
      outline_url: outlineUpload.file_url,
      outline_data: '',
      story_bible: '',
      story_bible_url,
      book_metadata: JSON.stringify(bookMetadata),
      status: finalStatus,
      error_message: isPartial ? 'Partial detail generated — some chapters have shell data only' : '',
    });

    // Update project name
    if (bookMetadata?.title) {
      try { await sr.entities.Project.update(project_id, { name: bookMetadata.title }); } catch {}
    }

    // Update chapter records with prompts
    const existingChapters = await sr.entities.Chapter.filter({ project_id }, "chapter_number");
    for (const ch of allDetailedChapters) {
      const chNum = ch.number || allDetailedChapters.indexOf(ch) + 1;
      const existing = existingChapters.find(e => e.chapter_number === chNum);
      if (existing && ch.prompt) {
        await sr.entities.Chapter.update(existing.id, {
          prompt: ch.prompt,
          summary: ch.summary || existing.summary,
        });
      }
    }

    console.log(`Detail ${finalStatus}: ${allDetailedChapters.length} chapters detailed`);
    return Response.json({ outline_id: outlineId, status: finalStatus, chapters: allDetailedChapters.length });

  } catch (error) {
    console.error('generateOutlineDetail error:', error);
    if (outlineId) {
      try {
        const fallbackBase44 = createClientFromRequest(req);
        const fallbackSr = fallbackBase44.asServiceRole;
        await fallbackSr.entities.Outline.update(outlineId, { status: 'partial', error_message: error.message });
      } catch {}
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});