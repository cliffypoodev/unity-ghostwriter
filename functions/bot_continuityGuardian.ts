// ═══════════════════════════════════════════════════════════════════════════════
// BOT 3 — CONTINUITY GUARDIAN
// ═══════════════════════════════════════════════════════════════════════════════
// Read-only. Finds continuity violations. Returns fixes for Style Enforcer.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ═══ INLINED: shared/aiRouter ═══
const MODEL_MAP = {
  "claude-sonnet":     { provider: "anthropic", modelId: "claude-sonnet-4-20250514", defaultTemp: 0.72, maxTokensLimit: null },
  "claude-opus":       { provider: "anthropic", modelId: "claude-opus-4-20250514",   defaultTemp: 0.72, maxTokensLimit: null },
  "gpt-4o":            { provider: "openai",    modelId: "gpt-4o",                   defaultTemp: 0.4,  maxTokensLimit: null },
  "gemini-pro":        { provider: "google",    modelId: "gemini-2.5-pro-preview-03-25", defaultTemp: 0.72, maxTokensLimit: null },
  "deepseek-chat":     { provider: "deepseek",  modelId: "deepseek-chat",            defaultTemp: 0.72, maxTokensLimit: 8192 },
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
  if (provider === "openai") {
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + Deno.env.get('OPENAI_API_KEY'), 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }) });
    const d = await r.json(); if (!r.ok) throw new Error('OpenAI: ' + (d.error?.message || r.status)); return d.choices[0].message.content;
  }
  if (provider === "google") {
    const apiKey = Deno.env.get('GOOGLE_AI_API_KEY'); if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set');
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + modelId + ':generateContent?key=' + apiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: userMessage }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { temperature, maxOutputTokens: maxTokens } }) });
    const d = await r.json(); if (!r.ok) throw new Error('Google: ' + (d.error?.message || r.status)); return d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  if (provider === "deepseek") {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + Deno.env.get('DEEPSEEK_API_KEY'), 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelId, max_tokens: Math.min(maxTokens, 8192), temperature, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }) });
    const d = await r.json(); if (!r.ok) throw new Error('DeepSeek: ' + (d.error?.message || r.status)); return d.choices[0].message.content;
  }
  throw new Error('Unknown provider: ' + provider);
}

function isRefusal(text) {
  if (!text || typeof text !== 'string') return false;
  const f = text.slice(0, 300).toLowerCase();
  return ['i cannot','i can\'t','i\'m unable','i am unable','against my guidelines','as an ai','content policy'].some(m => f.includes(m));
}

// ═══ INLINED: shared/resolveModel ═══
const HARDCODED_ROUTES = { outline:'gemini-pro', beat_sheet:'gemini-pro', post_gen_rewrite:'claude-sonnet', consistency_check:'claude-sonnet', style_rewrite:'claude-sonnet', chapter_state:'claude-sonnet' };
function resolveModel(callType, spec) {
  if (HARDCODED_ROUTES[callType]) return HARDCODED_ROUTES[callType];
  if (callType === 'explicit_scene') return 'deepseek-chat';
  if (callType === 'sfw_prose') return spec?.writing_model || spec?.ai_model || 'claude-sonnet';
  return 'claude-sonnet';
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
    base44.entities.Chapter.filter({ project_id: projectId }),
    base44.entities.Specification.filter({ project_id: projectId }),
    base44.entities.Outline.filter({ project_id: projectId }),
    base44.entities.Project.filter({ id: projectId }).catch(() => []),
  ]);
  const project = projects[0] || {};
  const rawSpec = specs[0];
  const outline = outlines[0];
  const spec = rawSpec ? { ...rawSpec, beat_style: rawSpec.beat_style || rawSpec.tone_style || "", spice_level: Math.max(0, Math.min(4, parseInt(rawSpec.spice_level) || 0)), language_intensity: Math.max(0, Math.min(4, parseInt(rawSpec.language_intensity) || 0)) } : null;
  let outlineData = null;
  let outlineRaw = outline?.outline_data || '';
  if (!outlineRaw && outline?.outline_url) { try { outlineRaw = await (await fetch(outline.outline_url)).text(); } catch {} }
  try { outlineData = outlineRaw ? JSON.parse(outlineRaw) : null; } catch {}
  let storyBible = null;
  let bibleRaw = outline?.story_bible || '';
  if (!bibleRaw && outline?.story_bible_url) { try { bibleRaw = await (await fetch(outline.story_bible_url)).text(); } catch {} }
  try { storyBible = bibleRaw ? JSON.parse(bibleRaw) : null; } catch {}
  chapters.sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
  let nameRegistry = {};
  if (project.name_registry) { try { nameRegistry = JSON.parse(project.name_registry); } catch {} }
  return { project, chapters, spec, outline, outlineData, storyBible, nameRegistry, totalChapters: chapters.length, isNonfiction: spec?.book_type === 'nonfiction', isFiction: spec?.book_type !== 'nonfiction', isErotica: /erotica|erotic/.test(((spec?.genre || '') + ' ' + (spec?.subgenre || '')).toLowerCase()) };
}

function getChapterContext(ctx, chapterId) {
  const chapter = ctx.chapters.find(c => c.id === chapterId);
  if (!chapter) throw new Error('Chapter not found: ' + chapterId);
  const chapterIndex = ctx.chapters.findIndex(c => c.id === chapterId);
  const prevChapter = chapterIndex > 0 ? ctx.chapters[chapterIndex - 1] : null;
  const nextChapter = chapterIndex < ctx.chapters.length - 1 ? ctx.chapters[chapterIndex + 1] : null;
  const outlineChapters = ctx.outlineData?.chapters || [];
  const outlineEntry = outlineChapters.find(c => (c.number || c.chapter_number) === chapter.chapter_number) || {};
  const previousChapters = ctx.chapters.slice(0, chapterIndex).filter(c => c.content && c.status === 'generated');
  let lastStateDoc = null;
  for (let i = chapterIndex - 1; i >= 0; i--) { if (ctx.chapters[i].state_document) { lastStateDoc = ctx.chapters[i].state_document; break; } }
  return { chapter, chapterIndex, prevChapter, nextChapter, outlineEntry, previousChapters, lastStateDoc };
}

// ═══ REGEX-BASED CHECKS ═══

function checkPronounConsistency(text, characters) {
  const violations = [];
  const genderMap = {};
  for (const char of characters) {
    if (!char.name) continue;
    const p = char.pronouns ? char.pronouns.toLowerCase() : (/\bshe\b|\bgirl\b|\bwoman\b/i.test(char.description || '') ? 'she' : 'he');
    genderMap[char.name] = p.includes('she') ? 'she' : p.includes('they') ? 'they' : 'he';
  }
  for (const [charName, expected] of Object.entries(genderMap)) {
    const rx = new RegExp(`\\b${charName}\\b[^.!?]*?(he|she|they)\\b`, 'gi');
    const mentions = [...text.matchAll(rx)];
    if (mentions.length > 2) {
      const pronounsUsed = new Set(mentions.map(m => m[1].toLowerCase()));
      if (pronounsUsed.size > 1) {
        violations.push({ type: 'pronoun_mismatch', severity: 'critical', character: charName, description: `Uses ${[...pronounsUsed].join('/')} but should be ${expected}`, location: mentions[0][0].slice(0, 50) });
      }
    }
  }
  return violations;
}

function checkCompositeFigureFraming(text, chNum, storyBible) {
  const violations = [];
  const chars = storyBible?.characters || [];
  const triggers = [];
  for (const c of chars) {
    if (/composite|amalgam|representative|drawn from|reconstructed/i.test((c.description || '') + ' ' + (c.role || ''))) triggers.push(c.name);
  }
  for (const name of triggers) {
    if (!text.includes(name)) continue;
    if (!/composite|represents|drawn from|based on records|reconstructed from/i.test(text)) {
      violations.push({ type: 'composite_unframed', severity: 'warning', character: name, description: `Composite character "${name}" in Ch ${chNum} — needs disclosure`, location: text.slice(text.indexOf(name), text.indexOf(name) + 60) });
    }
  }
  return violations;
}

function checkActTransition(text, lastStateDoc, chapterNumber) {
  if (!lastStateDoc) return [];
  const violations = [];
  const namePattern = /\b([A-Z][a-z]{2,})\b(?=.*(?:location|state|condition|position|status))/g;
  const bridgeNames = [...lastStateDoc.matchAll(namePattern)].map(m => m[1]);
  const openingWords = text.slice(0, 3000);
  const anyNamePresent = bridgeNames.some(name => openingWords.includes(name));
  if (bridgeNames.length > 0 && !anyNamePresent) {
    violations.push({ type: 'act_transition_break', severity: 'warning', character: bridgeNames.slice(0, 3).join(', '), description: `Chapter ${chapterNumber} opening doesn't reflect prior state`, location: openingWords.slice(0, 80) });
  }
  return violations;
}

function checkCapabilities(text, storyBible) {
  const violations = [];
  const chars = storyBible?.characters || [];
  for (const c of chars) {
    if (!c.capabilities_under_pressure || !c.name) continue;
    const cap = c.capabilities_under_pressure;
    if (cap.combat_training === 'None' || cap.combat_training === 'none') {
      const combatRx = new RegExp(`\\b${c.name}\\b[^.!?]{0,100}\\b(punched|kicked|fought|struck|slashed|blocked|dodged|parried|disarmed)\\b`, 'gi');
      const matches = [...text.matchAll(combatRx)];
      if (matches.length > 0) {
        violations.push({ type: 'capability_exceeded', severity: 'warning', character: c.name, description: `${c.name} (combat: None) appears to perform combat`, location: matches[0][0].slice(0, 80) });
      }
    }
  }
  return violations;
}

// ═══ AI-POWERED DEEP CHECK ═══

async function runAIConsistencyCheck(text, ctx, chCtx) {
  const { storyBible } = ctx;
  const { chapter, outlineEntry, lastStateDoc } = chCtx;
  const characters = storyBible?.characters || [];
  const charSummary = characters.map(c => `- ${c.name}: ${c.role || 'unknown'}, ${c.description || 'no desc'}. Pronouns: ${c.pronouns || 'not set'}`).join('\n');
  const outlineSummary = outlineEntry ? `Title: "${outlineEntry.title || chapter.title}"\nKey events: ${JSON.stringify(outlineEntry.key_events || outlineEntry.key_beats || [])}\nSummary: ${outlineEntry.summary || 'N/A'}` : 'No outline entry';
  const modelKey = resolveModel('consistency_check', ctx.spec);

  const systemPrompt = `You are a manuscript continuity checker. Read the chapter and compare it against the verification document. List every contradiction, missing element, or continuity error.\n\nOutput ONLY a JSON array of violations. If no violations, return an empty array [].\n\nEach violation object:\n{\n  "type": "pronoun_mismatch|character_missing|timeline_break|backstory_contradiction|allegiance_unacknowledged|dead_character_appears|plot_deviation",\n  "severity": "critical|warning",\n  "character": "affected character name or null",\n  "description": "what's wrong",\n  "location": "first ~50 chars of the offending passage",\n  "suggested_fix": "how to fix it"\n}`;

  const userMessage = `VERIFICATION DOCUMENT:\n\nCHARACTERS:\n${charSummary || 'No characters defined'}\n\nOUTLINE FOR THIS CHAPTER:\n${outlineSummary}\n\n${lastStateDoc ? `PREVIOUS CHAPTER STATE:\n${lastStateDoc}\n` : ''}\n\nCHAPTER ${chapter.chapter_number}: "${chapter.title}"\n${text.slice(0, 12000)}`;

  try {
    const raw = await callAI(modelKey, systemPrompt, userMessage, { maxTokens: 2048, temperature: 0.2 });
    if (isRefusal(raw)) return [];
    try {
      const parsed = JSON.parse(raw.replace(/^```json\n?/, '').replace(/\n?```$/, ''));
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  } catch (err) {
    console.warn('AI consistency check failed (non-blocking):', err.message);
    return [];
  }
}

// ═══ MAIN BOT ═══

async function runContinuityGuardian(base44, projectId, chapterId, rawProse) {
  const startMs = Date.now();
  const ctx = await loadProjectContext(base44, projectId);
  const chCtx = getChapterContext(ctx, chapterId);
  const characters = ctx.storyBible?.characters || [];
  const text = rawProse || await resolveContent(chCtx.chapter.content);
  if (!text || text.length < 100) {
    return { passed: true, violations: [], suggested_fixes: [], chapter_id: chapterId, duration_ms: Date.now() - startMs };
  }

  const allViolations = [
    ...checkPronounConsistency(text, characters),
    ...checkCompositeFigureFraming(text, chCtx.chapter.chapter_number, ctx.storyBible),
    ...checkActTransition(text, chCtx.lastStateDoc, chCtx.chapter.chapter_number),
    ...checkCapabilities(text, ctx.storyBible),
  ];

  const aiViolations = await runAIConsistencyCheck(text, ctx, chCtx);
  for (const v of aiViolations) {
    const isDupe = allViolations.some(existing => existing.type === v.type && existing.character === v.character);
    if (!isDupe) allViolations.push(v);
  }

  const suggestedFixes = aiViolations
    .filter(v => v.suggested_fix)
    .map((v) => ({
      violation_index: allViolations.findIndex(av => av.description === v.description),
      original_text: v.location || '',
      replacement_text: v.suggested_fix,
      confidence: v.severity === 'critical' ? 'high' : 'medium',
    }));

  const hasCritical = allViolations.some(v => v.severity === 'critical');
  return { passed: !hasCritical, violations: allViolations, suggested_fixes: suggestedFixes, chapter_id: chapterId, duration_ms: Date.now() - startMs };
}

// ═══ DENO SERVE ═══

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, chapter_id, raw_prose } = await req.json();
    if (!project_id || !chapter_id) return Response.json({ error: 'project_id and chapter_id required' }, { status: 400 });

    const result = await runContinuityGuardian(base44, project_id, chapter_id, raw_prose);
    return Response.json(result);
  } catch (error) {
    console.error('continuityGuardian error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});