// ═══════════════════════════════════════════════════════════════════════════════
// BOT 5 — STATE CHRONICLER
// ═══════════════════════════════════════════════════════════════════════════════
// After a chapter is finalized, generate state document and update project tracking.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ═══ INLINED: shared/aiRouter (compact) ═══
const MODEL_MAP = {
  "claude-sonnet": { provider: "anthropic", modelId: "claude-sonnet-4-20250514", defaultTemp: 0.72, maxTokensLimit: null },
  "gemini-pro": { provider: "google", modelId: "gemini-2.5-pro-preview-03-25", defaultTemp: 0.72, maxTokensLimit: null },
};
async function callAI(modelKey, systemPrompt, userMessage, options = {}) {
  const config = MODEL_MAP[modelKey] || MODEL_MAP["claude-sonnet"];
  const { provider, modelId, defaultTemp, maxTokensLimit } = config;
  const temperature = options.temperature ?? defaultTemp;
  let maxTokens = options.maxTokens ?? 8192;
  if (maxTokensLimit) maxTokens = Math.min(maxTokens, maxTokensLimit);
  if (provider === "anthropic") {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature, system: systemPrompt, messages: [{ role: 'user', content: userMessage }] }) });
    const d = await r.json(); if (!r.ok) throw new Error('Anthropic: ' + (d.error?.message || r.status)); return d.content[0].text;
  }
  if (provider === "google") {
    const apiKey = Deno.env.get('GOOGLE_AI_API_KEY'); if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set');
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + modelId + ':generateContent?key=' + apiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: userMessage }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { temperature, maxOutputTokens: maxTokens } }) });
    const d = await r.json(); if (!r.ok) throw new Error('Google: ' + (d.error?.message || r.status)); return d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  throw new Error('Unknown provider: ' + provider);
}
function isRefusal(text) { if (!text) return false; const f = text.slice(0, 300).toLowerCase(); return ['i cannot','i can\'t','i\'m unable','as an ai'].some(m => f.includes(m)); }

// ═══ INLINED: shared/resolveModel ═══
function resolveModel(callType) {
  if (callType === 'chapter_state') return 'claude-sonnet';
  return 'claude-sonnet';
}

// ═══ RETRY HELPER for SDK rate limits ═══
async function withRetry(fn, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); } catch (err) {
      const is429 = err.message?.includes('429') || err.message?.includes('Rate limit') || err.message?.includes('rate limit');
      if (is429 && i < retries) {
        const delay = (i + 1) * 10000;
        console.warn(`SDK rate limited, retry ${i + 1}/${retries} in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

// ═══ INLINED: shared/dataLoader ═══
async function resolveContent(content) {
  if (!content) return '';
  if (typeof content === 'string' && (content.startsWith('http://') || content.startsWith('https://'))) {
    try { const r = await fetch(content); if (!r.ok) return ''; const t = await r.text(); if (t.trim().startsWith('<')) return ''; return t; } catch { return ''; }
  }
  return content;
}
async function loadProjectContext(base44, projectId) {
  let chapters = [], specs = [], outlines = [], projects = [];
  [chapters, specs, outlines, projects] = await Promise.all([
    withRetry(() => base44.entities.Chapter.filter({ project_id: projectId })),
    withRetry(() => base44.entities.Specification.filter({ project_id: projectId })),
    withRetry(() => base44.entities.Outline.filter({ project_id: projectId })),
    withRetry(() => base44.entities.Project.filter({ id: projectId })).catch(() => []),
  ]);
  const project = projects[0] || {};
  const rawSpec = specs[0]; const outline = outlines[0];
  const spec = rawSpec ? { ...rawSpec, beat_style: rawSpec.beat_style || rawSpec.tone_style || "", spice_level: Math.max(0, Math.min(4, parseInt(rawSpec.spice_level) || 0)), language_intensity: Math.max(0, Math.min(4, parseInt(rawSpec.language_intensity) || 0)) } : null;
  let outlineData = null; let outlineRaw = outline?.outline_data || '';
  if (!outlineRaw && outline?.outline_url) { try { outlineRaw = await (await fetch(outline.outline_url)).text(); } catch {} }
  try { outlineData = outlineRaw ? JSON.parse(outlineRaw) : null; } catch {}
  chapters.sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
  let nameRegistry = {};
  if (project.name_registry) {
    let nrRaw = project.name_registry;
    if (typeof nrRaw === 'string' && nrRaw.startsWith('http')) { try { nrRaw = await (await fetch(nrRaw)).text(); } catch { nrRaw = '{}'; } }
    try { nameRegistry = JSON.parse(nrRaw); } catch {}
  }
  let bannedPhrases = [];
  if (project.banned_phrases_log) { let bpRaw = project.banned_phrases_log; if (typeof bpRaw === 'string' && bpRaw.startsWith('http')) { try { bpRaw = await (await fetch(bpRaw)).text(); } catch { bpRaw = '[]'; } } try { bannedPhrases = JSON.parse(bpRaw); } catch {} }
  return { project, chapters, spec, outlineData, nameRegistry, bannedPhrases, totalChapters: chapters.length, isNonfiction: spec?.book_type === 'nonfiction' };
}
function getChapterContext(ctx, chapterId) {
  const chapter = ctx.chapters.find(c => c.id === chapterId);
  if (!chapter) throw new Error('Chapter not found: ' + chapterId);
  const chapterIndex = ctx.chapters.findIndex(c => c.id === chapterId);
  let lastStateDoc = null;
  for (let i = chapterIndex - 1; i >= 0; i--) { if (ctx.chapters[i].state_document) { lastStateDoc = ctx.chapters[i].state_document; break; } }
  return { chapter, chapterIndex, lastStateDoc };
}

// ═══ EXTRACTION FUNCTIONS ═══

function extractDistinctivePhrases(text) {
  const phrases = new Set();
  const simileRegex = /[\w\s,]+(like a|as if|as though)[\w\s,]+/gi;
  let match;
  while ((match = simileRegex.exec(text)) !== null) {
    const phrase = match[0].trim().slice(0, 60);
    if (phrase.split(' ').length >= 3) phrases.add(phrase.toLowerCase());
  }
  const adjNounRegex = /\b(surgical|predatory|velvet|cathedral|obsidian|glacial|molten|razor|iron|silk|phantom|hollow|ancient|fractured|luminous|shadowed|careful|deliberate|controlled|precise|calculated|architectural)\s+\w+/gi;
  while ((match = adjNounRegex.exec(text)) !== null) { phrases.add(match[0].trim().toLowerCase()); }
  const words = text.toLowerCase().split(/\s+/);
  const phraseCount = {};
  const SKIP = new Set(['she said that','he said that','and she was','and he was','that she had','that he had','she looked at','he looked at']);
  for (let i = 0; i < words.length - 2; i++) {
    const p3 = words.slice(i, i + 3).join(' ').replace(/[^a-z\s]/g, '').trim();
    if (p3.split(' ').length === 3 && p3.split(' ').every(w => w.length > 2) && !SKIP.has(p3)) { phraseCount[p3] = (phraseCount[p3] || 0) + 1; }
  }
  for (const [phrase, count] of Object.entries(phraseCount)) { if (count >= 2) phrases.add(phrase); }
  return [...phrases].slice(0, 30).sort();
}

function extractNamedCharacters(text, chNum, reg = {}) {
  const SKIP = new Set(['January','February','March','April','May','June','July','August','September','October','November','December','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','Chapter','Scene','The','This','That','What','When','Where','Which','There','Here','They','Then','But','And','His','Her','God','Sir','Lord','Lady']);
  const nameRx = /\b([A-Z][a-z]{2,})(?:\s+[A-Z][a-z]+)?\b/g;
  const names = {};
  let m;
  while ((m = nameRx.exec(text)) !== null) { const n = m[0]; if (SKIP.has(n.split(' ')[0])) continue; names[n] = (names[n] || 0) + 1; }
  const u = { ...reg };
  for (const [name, count] of Object.entries(names)) { if (count >= 2 && !u[name]) u[name] = { role: 'discovered', first_chapter: chNum }; }
  return u;
}

function extractPhysicalTics(text) {
  const TIC_PATTERNS = [
    { canonical: 'chest tightened', rx: /\b(chest|ribcage)\s+(tighten\w*|constrict\w*|squeez\w*)\b/gi },
    { canonical: 'jaw tightened', rx: /\bjaw\s+(tightened|clenched?|set|locked?)\b/gi },
    { canonical: 'throat tightened', rx: /\bthroat\s+(tightened?|clenched?|constricted?)\b/gi },
    { canonical: 'stomach twisted', rx: /\b(stomach|gut)\s+(twisted?|dropped?|knotted?|clenched?)\b/gi },
    { canonical: 'fists clenched', rx: /\b(fist|fists|hands?)\s+(clenched?|curled? into fists?|balled?)\b/gi },
    { canonical: 'fingers tightened', rx: /\b(fingers?|grip)\s+(tightened?|clenched?|digging?|gripped?)\b/gi },
    { canonical: 'breath caught', rx: /\bbreath\w*\s+(caught|hitched?|stuttered?|stopped?)\b|forgot to breathe/gi },
    { canonical: 'pulse quickened', rx: /\bpulse\s+(quickened?|raced?|throbbed?|hammered?)\b/gi },
    { canonical: 'heart raced', rx: /\bheart\w*\s+(raced?|pounded?|hammered?|thudded?|thundered?)\b/gi },
    { canonical: 'shiver down spine', rx: /\b(shiver|chill)\w*\s+(down|up|ran|through)\s+\w+\s+(spine|back)\b/gi },
    { canonical: 'jolt through body', rx: /\bjolt\w*\s+(through|of|ran|shot)\b/gi },
    { canonical: 'skin prickled', rx: /\bskin\s+(prickled?|tingled?|crawled?)\b|goosebumps?/gi },
    { canonical: 'flush crept', rx: /\bflush\w*\s+(crept?|spread|rose)\b|heat\s+(crept?|spread|rose)\s+(up|across|into)\b/gi },
    { canonical: 'mouth went dry', rx: /\bmouth\s+(went|was|grew)\s+dry\b|dry\s+mouth/gi },
    { canonical: 'knees went weak', rx: /\b(knees?|legs?)\s+(went|grew)\s+(weak|shaky)\b|(knees?|legs?)\s+(buckled?|wobbled?)\b/gi },
    { canonical: 'blood ran cold', rx: /\bblood\s+(ran|went|turned)\s+(cold|ice|pale)\b|blood\s+drained\b/gi },
  ];
  const ticsByChar = {};
  for (const { canonical, rx } of TIC_PATTERNS) {
    let match; rx.lastIndex = 0;
    while ((match = rx.exec(text)) !== null) {
      const ctx = text.slice(Math.max(0, match.index - 150), match.index + match[0].length + 150);
      const nameMatch = ctx.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)?\b/);
      const charName = nameMatch ? nameMatch[0] : 'Unknown';
      if (!ticsByChar[charName]) ticsByChar[charName] = {};
      ticsByChar[charName][canonical] = (ticsByChar[charName][canonical] || 0) + 1;
    }
  }
  return ticsByChar;
}

function getEscalationTarget(chapterNumber, totalChapters) {
  const ratio = chapterNumber / totalChapters;
  if (ratio <= 0.25) return { min: 1, max: 2, label: 'Stage 1-2 (establish world, introduce tension)' };
  if (ratio <= 0.50) return { min: 3, max: 4, label: 'Stage 3-4 (cost of choices, first breach)' };
  if (ratio <= 0.75) return { min: 4, max: 5, label: 'Stage 4-5 (consequences, no retreat)' };
  if (ratio < 0.95) return { min: 5, max: 6, label: 'Stage 5-6 (execution, no new plot)' };
  return { min: 6, max: 6, label: 'Stage 6 (resolution)' };
}

function autoClassifyEnding(text) {
  const last500 = text.slice(-500).toLowerCase();
  if (/\b(lunged|swung|fired|grabbed|shoved|knife|blade|gun|punch|struck|slammed|fell|explosion|scream|crash|charging)\b/.test(last500)) return 'cliffhanger';
  if (/\b(hours later|days later|weeks later|the next morning|by the time|when .+ woke)\b/.test(last500)) return 'time_skip';
  if (/\b(walked away|turned .+ back|closed .+ eyes|didn't answer|silence|stared|watched .+ go|left standing)\b/.test(last500)) return 'emotional_open';
  return 'resolved';
}

// ═══ MAIN BOT ═══

async function runStateChronicler(base44, projectId, chapterId, finalProse) {
  const startMs = Date.now();
  const ctx = await loadProjectContext(base44, projectId);
  const chCtx = getChapterContext(ctx, chapterId);
  const { chapter } = chCtx;

  const chapterContent = finalProse || await resolveContent(chapter.content);
  if (!chapterContent || chapterContent.length < 100) {
    throw new Error('Chapter content too short or unavailable for state generation');
  }

  // Phase A: Extraction (no AI)
  const distinctivePhrases = extractDistinctivePhrases(chapterContent);
  const updatedNameRegistry = extractNamedCharacters(chapterContent, chapter.chapter_number, ctx.nameRegistry);
  const physicalTics = extractPhysicalTics(chapterContent);
  const escalationTarget = getEscalationTarget(chapter.chapter_number, ctx.totalChapters);
  const endingType = autoClassifyEnding(chapterContent);

  // Phase B: AI state generation
  const modelKey = resolveModel('chapter_state');
  const prevStateDoc = chCtx.lastStateDoc || '';

  const systemPrompt = `You are a manuscript continuity tracker. Analyze the chapter and generate a precise Chapter State Document. Output EXACTLY the format specified — no commentary, no preamble.

ESCALATION STAGE GUIDE (for a ${ctx.totalChapters}-chapter book):
- Chapters 1-${Math.floor(ctx.totalChapters * 0.25)}: Stage 1-2 (establish world, introduce tension)
- Chapters ${Math.floor(ctx.totalChapters * 0.25) + 1}-${Math.floor(ctx.totalChapters * 0.50)}: Stage 3-4 (cost of choices, first breach)
- Chapters ${Math.floor(ctx.totalChapters * 0.50) + 1}-${Math.floor(ctx.totalChapters * 0.75)}: Stage 4-5 (consequences, no retreat)
- Chapters ${Math.floor(ctx.totalChapters * 0.75) + 1}-${ctx.totalChapters - 1}: Stage 5-6 (execution, no new plot)
- Chapter ${ctx.totalChapters}: Stage 6 resolution

Current chapter is ${chapter.chapter_number} of ${ctx.totalChapters}. Expected escalation range: ${escalationTarget.label}.`;

  const userMessage = `${prevStateDoc ? `PREVIOUS CHAPTER STATE DOCUMENT (carry forward open threads):\n${prevStateDoc}\n\n---\n\n` : ''}Generate a Chapter State Document for the chapter below. Use exactly this format:

LAST CHAPTER WRITTEN: ${chapter.chapter_number}
CHAPTER TITLE: ${chapter.title}
FINAL LOCATION OF EACH CHARACTER: [name — location]
PHYSICAL AND EMOTIONAL STATE OF EACH CHARACTER: [name — state]
NEW INFORMATION ESTABLISHED: [bullet list]
PLOT THREADS ACTIVATED THIS CHAPTER: [bullet list]
PLOT THREADS STILL OPEN: [bullet list — carry forward + new, remove resolved]
PHRASES AND METAPHORS USED THIS CHAPTER: [bullet list of distinctive phrases — permanently banned from reuse]
RELATIONSHIP STATUS BETWEEN CENTRAL CHARACTERS: [one sentence]
FIRED_BEATS: [bullet list using format: - BEAT: [type] | CHARACTERS: [A, B] | CHAPTER: ${chapter.chapter_number} | DETAIL: [description]. Types: first_kiss, first_intimate_scene, first_declaration_of_feelings, emotional_vulnerability_confession, first_physical_contact, jealousy_confrontation, breakup, reconciliation, sacrifice_for_other. If none: - none]
ENDING_TYPE: ${endingType}
ESCALATION_STAGE: [1-6 based on guide above]

CHAPTER TEXT:
${chapterContent.slice(0, 12000)}`;

  let stateDoc = '';
  try {
    stateDoc = await callAI(modelKey, systemPrompt, userMessage, { maxTokens: 4096, temperature: 0.3 });
    if (isRefusal(stateDoc)) { stateDoc = `LAST CHAPTER WRITTEN: ${chapter.chapter_number}\nCHAPTER TITLE: ${chapter.title}\nENDING_TYPE: ${endingType}\n[State generation refused by AI]`; }
  } catch (err) {
    console.warn('State generation AI failed:', err.message);
    stateDoc = `LAST CHAPTER WRITTEN: ${chapter.chapter_number}\nCHAPTER TITLE: ${chapter.title}\nENDING_TYPE: ${endingType}\n[State generation failed: ${err.message}]`;
  }

  // Phase C: Persist everything
  await withRetry(() => base44.entities.Chapter.update(chapterId, {
    state_document: stateDoc,
    distinctive_phrases: JSON.stringify(distinctivePhrases),
  }));

  // Update project-level tracking
  const updatedBanned = [...(ctx.bannedPhrases || []), ...distinctivePhrases];
  const nameRegJson = JSON.stringify(updatedNameRegistry);
  const projectUpdates = {};

  // Upload name_registry as file if too large
  if (nameRegJson.length > 10000) {
    try {
      const nrFile = new File([nameRegJson], 'name_registry.json', { type: 'application/json' });
      const nrUpload = await base44.integrations.Core.UploadFile({ file: nrFile });
      if (nrUpload?.file_url) projectUpdates.name_registry = nrUpload.file_url;
    } catch (e) { projectUpdates.name_registry = nameRegJson; }
  } else {
    projectUpdates.name_registry = nameRegJson;
  }

  // Upload banned_phrases_log as file to avoid field size limit
  try {
    const bannedJson = JSON.stringify(updatedBanned.slice(-500));
    const bannedFile = new File([bannedJson], 'banned_phrases_log.json', { type: 'application/json' });
    const bannedUpload = await base44.integrations.Core.UploadFile({ file: bannedFile });
    if (bannedUpload?.file_url) projectUpdates.banned_phrases_log = bannedUpload.file_url;
  } catch (e) {
    console.warn('Banned phrases upload failed, trying inline:', e.message);
    // Fallback: trim more aggressively to fit inline
    const trimmed = JSON.stringify(updatedBanned.slice(-100));
    projectUpdates.banned_phrases_log = trimmed;
  }

  // Append to chapter state log
  const newLogEntry = `\n\n══════ CHAPTER ${chapter.chapter_number}: ${chapter.title} ══════\n${stateDoc}`;
  if (ctx.project.chapter_state_log) {
    try {
      const existingLog = await resolveContent(ctx.project.chapter_state_log);
      const fullLog = existingLog + newLogEntry;
      const logFile = new File([fullLog], 'chapter_state_log.txt', { type: 'text/plain' });
      const uploaded = await base44.integrations.Core.UploadFile({ file: logFile });
      if (uploaded?.file_url) projectUpdates.chapter_state_log = uploaded.file_url;
    } catch (e) { console.warn('State log upload failed:', e.message); }
  } else {
    try {
      const logFile = new File([newLogEntry], 'chapter_state_log.txt', { type: 'text/plain' });
      const uploaded = await base44.integrations.Core.UploadFile({ file: logFile });
      if (uploaded?.file_url) projectUpdates.chapter_state_log = uploaded.file_url;
    } catch (e) { console.warn('State log upload failed:', e.message); }
  }

  // Update nonfiction chapter subjects
  if (ctx.isNonfiction) {
    const subjectLine = `Ch ${chapter.chapter_number} | ${chapter.title}`;
    const existingSubjects = ctx.project.chapter_subjects_log || '';
    projectUpdates.chapter_subjects_log = existingSubjects + (existingSubjects ? '\n' : '') + subjectLine;
  }

  await withRetry(() => base44.entities.Project.update(projectId, projectUpdates));

  return {
    success: true, chapter_id: chapterId,
    state_doc_length: stateDoc.length,
    phrases_extracted: distinctivePhrases.length,
    names_discovered: Object.keys(updatedNameRegistry).length - Object.keys(ctx.nameRegistry).length,
    physical_tics: physicalTics,
    ending_type: endingType,
    duration_ms: Date.now() - startMs,
  };
}

// ═══ DENO SERVE ═══

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, chapter_id, final_prose } = await req.json();
    if (!project_id || !chapter_id) return Response.json({ error: 'project_id and chapter_id required' }, { status: 400 });

    const result = await runStateChronicler(base44, project_id, chapter_id, final_prose);
    return Response.json(result);
  } catch (error) {
    console.error('stateChronicler error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});