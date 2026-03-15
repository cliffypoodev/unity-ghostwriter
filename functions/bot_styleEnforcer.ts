// ═══════════════════════════════════════════════════════════════════════════════
// BOT 4 — STYLE ENFORCER
// ═══════════════════════════════════════════════════════════════════════════════
// Fix every style violation in-place. Return clean prose. ONE AI call for fixes.
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
function resolveModel(callType) { return 'claude-sonnet'; }

// ═══ INLINED: shared/dataLoader (minimal) ═══
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
  const rawSpec = specs[0]; const outline = outlines[0];
  const spec = rawSpec ? { ...rawSpec, beat_style: rawSpec.beat_style || rawSpec.tone_style || "", spice_level: Math.max(0, Math.min(4, parseInt(rawSpec.spice_level) || 0)), language_intensity: Math.max(0, Math.min(4, parseInt(rawSpec.language_intensity) || 0)) } : null;
  chapters.sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
  let bannedPhrases = [];
  if (project.banned_phrases_log) { let bpRaw = project.banned_phrases_log; if (typeof bpRaw === 'string' && bpRaw.startsWith('http')) { try { bpRaw = await (await fetch(bpRaw)).text(); } catch { bpRaw = '[]'; } } try { bannedPhrases = JSON.parse(bpRaw); } catch {} }
  return { project, chapters, spec, bannedPhrases, isNonfiction: spec?.book_type === 'nonfiction' };
}
function getChapterContext(ctx, chapterId) {
  const chapter = ctx.chapters.find(c => c.id === chapterId);
  if (!chapter) throw new Error('Chapter not found: ' + chapterId);
  const chapterIndex = ctx.chapters.findIndex(c => c.id === chapterId);
  const previousChapters = ctx.chapters.slice(0, chapterIndex).filter(c => c.content && c.status === 'generated');
  return { chapter, chapterIndex, previousChapters };
}

// ═══ BANNED CONSTRUCTIONS ═══

const ABSOLUTE_BANS = [
  { p: /\b\w+ sent \w[\w\s]{0,25}through\b/gi, l: '"sent...through"' },
  { p: /waves of (pleasure|sensation|emotion|feeling|heat|relief|desire|pain)/gi, l: '"waves of"' },
  { p: /washed over (him|her|them)/gi, l: '"washed over"' },
  { p: /threatened to overwhelm/gi, l: '"threatened to overwhelm"' },
  { p: /couldn't help but/gi, l: '"couldn\'t help but"' },
  { p: /in that moment/gi, l: '"in that moment"' },
  { p: /the particular \w+ of/gi, l: '"the particular [x] of"' },
  { p: /something that (looked|felt|sounded|seemed) like/gi, l: '"something that felt like"' },
  { p: /a kind of \w+ that/gi, l: '"a kind of [x] that"' },
  { p: /what might have been/gi, l: '"what might have been"' },
  { p: /something (shifted|loosened|cracked|tightened|moved|settled|expanded) in (her|his|their) chest/gi, l: '"something [x] in chest"' },
  { p: /the (weight|smell|sound|feel) of (everything|all of it|the moment)/gi, l: '"the weight/sound of everything"' },
];

const FREQUENCY_CAPS = [
  [/\bpulse[sd]?\b/gi, 'pulse', 4], [/\bnervous system\b/gi, 'nervous system', 2],
  [/\bamber eyes\b/gi, 'amber eyes', 2], [/\bwarmth\b/gi, 'warmth', 3],
  [/\bdeliberate\b/gi, 'deliberate', 3], [/\bliquid\b/gi, 'liquid', 3],
  [/\belectric(ity)?\b/gi, 'electricity', 2], [/\bpredatory\b/gi, 'predatory', 2],
  [/\bsurrender\b/gi, 'surrender', 3], [/\bsuddenly\b/gi, 'suddenly', 2],
  [/\bresonat/gi, 'resonate', 2], [/\ba tapestry of\b/gi, 'tapestry of', 0],
  [/\bcareful(ly)?\b/gi, 'careful(ly)', 3], [/\bantiseptic\b/gi, 'antiseptic', 1],
  [/\bfluorescent\b/gi, 'fluorescent', 2], [/\bas if\b/gi, 'as if', 4],
  [/\bsomething in\b/gi, 'something in', 3], [/\bthe kind of\b/gi, 'the kind of', 3],
  [/\bparticular\b/gi, 'particular', 3], [/\bsomehow\b/gi, 'somehow', 2],
  [/\bfamiliar\b/gi, 'familiar', 3],
];

const EMOTIONAL_ENDING_PATTERNS = [
  /felt like/i, /seemed like/i, /she (thought|knew|realized|understood)/i,
  /he (thought|knew|realized|understood)/i, /it was (the kind|a kind)/i,
  /and (that|this) (felt|seemed)/i, /everything (had |would )?changed?/i,
  /(he|she|they) knew exactly where (he|she|they) belonged/i,
  /(he|she|they) felt (more |truly |finally )?(himself|herself|themselves|at peace|complete|whole|alive|ready)/i,
  /(he|she|they) (understood|realized|knew) (now |then )?(what|that|how|why)/i,
  /it was (going to be |finally )?(okay|alright|all right|enough)/i,
];

const NF_BANS = [
  { rx: /(?:heart|eyes)\s+(?:swelling|brimming|glistening)\s+with\s+(?:pride|tears|joy|emotion)/gi, label: 'melodrama' },
  { rx: /(?:warmth|sense of peace|wave of calm)\s+(?:spread|washed|flooded)\s+(?:through|over)/gi, label: 'inspirational' },
  { rx: /felt a renewed sense of/gi, label: 'cliche' },
  { rx: /it was (?:a )?(?:powerful |beautiful |profound )?(?:reminder|testament)/gi, label: 'declaration' },
  { rx: /(?:monumental|transformative|life-changing|game.changing)/gi, label: 'hyperbolic' },
  { rx: /(?:beacon of hope|ray of light|silver lining)/gi, label: 'cliche' },
  { rx: /(?:on a journey|navigate this journey|the road ahead|armed with knowledge)/gi, label: 'journey' },
  { rx: /represents more than .{1,30} — it embodies/gi, label: 'thesis' },
  { rx: /would prove essential/gi, label: 'hindsight' },
  { rx: /the lesson emerging from/gi, label: 'thesis' },
  { rx: /the broader implications of/gi, label: 'thesis' },
  { rx: /what we can learn from .{1,30} is/gi, label: 'thesis' },
];

const NF_ENDING_BANS = [
  /represents more than/i, /demonstrates that/i, /remind us that/i,
  /the lesson (emerging|here|from)/i, /perhaps most (importantly|significantly)/i,
  /the broader implications/i, /had global implications/i, /would prove essential/i,
  /this (transformation|shift|change) (would|has|had)/i, /what (we can learn|emerges|this shows)/i,
];

// ═══ INLINE EDITORIAL NOTE DETECTION ═══
// ABSOLUTE PROHIBITION: Never allow editorial notes, structural suggestions,
// continuity flags, or revision reminders inside narrative output.

const INLINE_NOTE_PATTERNS = [
  /add (a |an )?(brief |short )?(scene|transition|section|explanation|opening)/i,
  /change (all references|dr\.|character) (from|to)/i,
  /either (revise|remove|include|adjust|update)/i,
  /show (the |this )?(scene|revelation|moment|reaction)/i,
  /clarify the (timeline|date|relationship|sequence)/i,
  /add .{3,40} to the (character list|outline|chapter)/i,
  /or (replace with|adjust to match|update the outline)/i,
  /throughout the chapter/i,
  /flash.?forward|flash.?back.{0,20}(with clear|establish)/i,
];

function scanInlineNotes(text) {
  const violations = [];
  for (const pattern of INLINE_NOTE_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      violations.push({
        type: 'inline_editorial_note',
        label: `Editorial note: "${m[0]}"`,
        count: 1,
        max: 0,
        fixed: false,
        severity: 'critical',
        autoRegenerate: true,
      });
    }
  }
  return violations;
}

// ═══ CHARACTER NAME VALIDATION ═══

function scanCharacterNames(text, storyBible, nameRegistry) {
  const violations = [];
  const knownChars = [];

  // Build known character list from story bible
  if (storyBible?.characters?.length > 0) {
    for (const c of storyBible.characters) {
      if (c.name) {
        const parts = c.name.trim().split(/\s+/);
        const lastName = parts.length > 1 ? parts[parts.length - 1] : null;
        knownChars.push({ name: c.name, lastName, role: (c.role || '').toLowerCase(), description: c.description || '' });
      }
    }
  }

  // Augment from name registry
  if (nameRegistry && typeof nameRegistry === 'object') {
    for (const [name, info] of Object.entries(nameRegistry)) {
      if (!knownChars.find(c => c.name === name)) {
        const parts = name.trim().split(/\s+/);
        const lastName = parts.length > 1 ? parts[parts.length - 1] : null;
        knownChars.push({ name, lastName, role: (info.role || '').toLowerCase(), description: '' });
      }
    }
  }

  if (knownChars.length === 0) return violations;

  // Collect all "Dr. LastName" patterns in the text
  const drPattern = /Dr\.?\s+([A-Z][a-z]+)/g;
  let match;
  const foundDrNames = new Set();
  while ((match = drPattern.exec(text)) !== null) {
    foundDrNames.add(match[1]);
  }

  // Check if any Dr. names don't match known characters
  const knownLastNames = new Set(knownChars.filter(c => c.lastName).map(c => c.lastName));
  for (const drName of foundDrNames) {
    if (!knownLastNames.has(drName)) {
      // Check if it's close to a known name (potential substitution)
      const closest = [...knownLastNames].find(kn =>
        kn.toLowerCase().startsWith(drName.toLowerCase().slice(0, 3)) ||
        drName.toLowerCase().startsWith(kn.toLowerCase().slice(0, 3))
      );
      violations.push({
        type: 'character_name_inconsistency',
        label: `Unknown "Dr. ${drName}" not in character registry${closest ? ` (did you mean Dr. ${closest}?)` : ''}`,
        count: 1,
        max: 0,
        fixed: false,
        severity: 'high',
      });
    }
  }

  return violations;
}

// ═══ SCAN FUNCTIONS ═══

function scanBannedPhrases(text) {
  const violations = [];
  for (const b of ABSOLUTE_BANS) { const m = text.match(b.p); if (m) violations.push({ type: 'banned_phrase', label: b.l, count: m.length, max: 0, fixed: false }); }
  return violations;
}
function scanFrequencyCaps(text) {
  const violations = [];
  for (const [rx, label, max] of FREQUENCY_CAPS) { const m = text.match(rx); const count = m ? m.length : 0; if (count > max) violations.push({ type: 'frequency_cap', label, count, max, fixed: false }); }
  return violations;
}
function scanDynamicCaps(text, previousChapters) {
  const violations = [];
  if (previousChapters.length === 0) return violations;
  const last = previousChapters[previousChapters.length - 1];
  let prevText = last.content || '';
  if (prevText.startsWith('http')) return violations;
  const SW = new Set(['the','and','was','had','his','her','they','their','that','with','from','into','have','been','were','what','this','which','when','would','could','should','said','just','like','some','then','than','but','not','for','are','him','she','you','all','its','one','out','can','did','who','how','has','more','also','will','about']);
  const ws = prevText.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const fq = {};
  for (const w of ws) { if (!SW.has(w)) fq[w] = (fq[w] || 0) + 1; }
  const top3 = Object.entries(fq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w);
  for (const w of top3) { const count = (text.match(new RegExp(`\\b${w}\\b`, 'gi')) || []).length; if (count > 2) violations.push({ type: 'dynamic_cap', label: `"${w}" (prev ch top word)`, count, max: 2, fixed: false }); }
  return violations;
}
function scanSceneEndings(text) {
  const violations = [];
  const scenes = text.split(/\*\s*\*\s*\*/);
  for (let idx = 0; idx < scenes.length; idx++) {
    const sents = scenes[idx].trim().split(/(?<=[.!?])\s+/);
    const lastTwo = sents.slice(-2).join(' ');
    if (EMOTIONAL_ENDING_PATTERNS.some(p => p.test(lastTwo))) { violations.push({ type: 'weak_ending', label: lastTwo.slice(0, 80), count: 1, max: 0, fixed: false }); }
  }
  return violations;
}
function scanNonfictionPatterns(text) {
  const warnings = [];
  for (const { rx, label } of NF_BANS) { const m = text.match(rx); if (m) warnings.push({ type: 'nf_fiction_trap', label: `${label}: "${m[0]}"`, count: m.length, max: 0, fixed: false }); }
  const dialogueChunks = text.match(/[""\u201C]([^""\u201D]{5,})[""\u201D]|'([^']{5,})'/g) || [];
  const totalDialogueWords = dialogueChunks.reduce((s, c) => s + c.split(/\s+/).length, 0);
  const totalWords = text.split(/\s+/).length;
  if (totalWords > 0 && totalDialogueWords / totalWords > 0.20) { warnings.push({ type: 'nf_fiction_trap', label: `${Math.round(totalDialogueWords / totalWords * 100)}% dialogue (max 20%)`, count: 1, max: 0, fixed: false }); }
  const paras = text.trim().split(/\n\n+/);
  const lastPara = paras[paras.length - 1] || '';
  if (NF_ENDING_BANS.some(p => p.test(lastPara))) { warnings.push({ type: 'nf_thesis_ending', label: 'Final paragraph restates thesis', count: 1, max: 0, fixed: false }); }
  return warnings;
}
function scanMetaResponse(text) {
  const first500 = text.slice(0, 500);
  const META = [/^I appreciate you/i, /^I need to clarify/i, /^Here is/i, /^Here are/i, /^As requested/i, /^I'll write/i, /[✓✗☐☑]/];
  if (META.some(p => p.test(first500))) { return [{ type: 'meta_response', label: 'AI meta-response instead of prose', count: 1, max: 0, fixed: false }]; }
  return [];
}

// ═══ AI-POWERED FIX PASS ═══

async function applyAIFixes(prose, violations, spec, isNonfiction) {
  if (violations.length === 0) return { text: prose, fixed: 0 };
  const modelKey = resolveModel('style_rewrite');
  const violationBrief = violations.map(v => {
    if (v.type === 'banned_phrase') return `BANNED: "${v.label}" appears ${v.count}x. Rewrite using direct physical description.`;
    if (v.type === 'frequency_cap') return `OVERUSED: "${v.label}" appears ${v.count}x (max ${v.max}). Replace excess with different sensory angles.`;
    if (v.type === 'dynamic_cap') return `PREV-CHAPTER REPEAT: ${v.label} (${v.count}x, max 2).`;
    if (v.type === 'weak_ending') return `SCENE ENDING: "${v.label}" — rewrite final 2 sentences as concrete image, action, or dialogue.`;
    if (v.type === 'nf_thesis_ending') return `NF ENDING: Final paragraph restates thesis. Replace with specific documented detail or unresolved question.`;
    if (v.type === 'nf_fiction_trap') return `NF PATTERN: ${v.label}. Replace with author analysis or research citation.`;
    if (v.type === 'meta_response') return `META: Output starts with AI assistant language. Remove all meta-commentary.`;
    if (v.type === 'inline_editorial_note') return `CRITICAL — INLINE NOTE: ${v.label}. This is an editorial instruction embedded in prose. OPTION A: Silently fix it by writing the actual scene/transition/content it describes. OPTION B: Remove it entirely if you lack context. NEVER leave editorial notes in narrative text.`;
    if (v.type === 'character_name_inconsistency') return `CHARACTER NAME ERROR: ${v.label}. Replace this name with the correct character from the registry, or use a generic descriptor (e.g., "the doctor", "the detective") if no match exists.`;
    return `${v.type}: ${v.label}`;
  }).join('\n');

  const systemPrompt = `You are a prose editor. Fix ONLY the violations listed below. Do NOT rewrite prose that isn't flagged. Preserve the author's voice, sentence structure, and word count. Output ONLY the corrected chapter text — no commentary.\n\n${isNonfiction ? 'NONFICTION RULES: No melodrama, no journey metaphors, no thesis restatements in endings. Replace with documented evidence or specific detail.' : ''}`;

  const userMessage = `VIOLATIONS TO FIX:\n${violationBrief}\n\nCHAPTER TEXT:\n${prose}`;

  try {
    const fixed = await callAI(modelKey, systemPrompt, userMessage, { maxTokens: 16384, temperature: 0.3 });
    if (isRefusal(fixed)) return { text: prose, fixed: 0 };
    if (fixed.length < prose.length * 0.5) return { text: prose, fixed: 0 };
    return { text: fixed, fixed: violations.length };
  } catch (err) {
    console.warn('AI fix pass failed:', err.message);
    return { text: prose, fixed: 0 };
  }
}

// ═══ APPLY CONTINUITY FIXES ═══

function applyContinuityFixes(prose, fixes) {
  if (!fixes || fixes.length === 0) return prose;
  let result = prose;
  for (const fix of fixes) {
    if (fix.confidence !== 'high' || !fix.original_text || !fix.replacement_text) continue;
    if (result.includes(fix.original_text)) {
      result = result.replace(fix.original_text, fix.replacement_text);
    }
  }
  return result;
}

// ═══ MAIN BOT ═══

async function runStyleEnforcer(base44, projectId, chapterId, prose, continuityFixes) {
  const startMs = Date.now();
  const ctx = await loadProjectContext(base44, projectId);
  const chCtx = getChapterContext(ctx, chapterId);
  const isNonfiction = ctx.isNonfiction;

  // Load story bible + name registry for character validation
  let storyBible = null;
  let nameRegistry = {};
  try {
    const outlines = await base44.entities.Outline.filter({ project_id: projectId });
    const outline = outlines[0];
    if (outline) {
      let bibleRaw = outline.story_bible || '';
      if (!bibleRaw && outline.story_bible_url) { try { bibleRaw = await (await fetch(outline.story_bible_url)).text(); } catch {} }
      if (bibleRaw) { try { storyBible = JSON.parse(bibleRaw); } catch {} }
    }
    const projects = await base44.entities.Project.filter({ id: projectId });
    if (projects[0]?.name_registry) { try { nameRegistry = JSON.parse(projects[0].name_registry); } catch {} }
  } catch {}

  let text = prose || await resolveContent(chCtx.chapter.content);
  if (!text || text.length < 100) throw new Error('No prose to enforce');

  // Apply high-confidence continuity fixes first
  text = applyContinuityFixes(text, continuityFixes);

  // Collect all violations
  const allViolations = [
    ...scanInlineNotes(text),
    ...scanMetaResponse(text),
    ...scanCharacterNames(text, storyBible, nameRegistry),
    ...scanBannedPhrases(text),
    ...scanFrequencyCaps(text),
    ...scanDynamicCaps(text, chCtx.previousChapters),
    ...scanSceneEndings(text),
    ...(isNonfiction ? scanNonfictionPatterns(text) : []),
  ];

  // If violations found, do ONE AI fix pass
  let cleanProse = text;
  let fixedCount = 0;
  if (allViolations.length > 0) {
    const result = await applyAIFixes(text, allViolations, ctx.spec, isNonfiction);
    cleanProse = result.text;
    fixedCount = result.fixed;
  }

  // Re-scan to report remaining violations
  const remaining = [
    ...scanBannedPhrases(cleanProse),
    ...scanFrequencyCaps(cleanProse),
  ];

  // Build quality report
  const wordCount = cleanProse.trim().split(/\s+/).length;
  const qualityReport = {
    total_violations_found: allViolations.length,
    violations_fixed: fixedCount,
    violations_remaining: remaining.length,
    word_count: wordCount,
    scan_details: allViolations.slice(0, 20),
  };

  return {
    clean_prose: cleanProse,
    quality_report: qualityReport,
    violations_found: allViolations.length,
    violations_remaining: remaining,
    duration_ms: Date.now() - startMs,
  };
}

// ═══ DENO SERVE ═══

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, chapter_id, prose, continuity_fixes } = await req.json();
    if (!project_id || !chapter_id) return Response.json({ error: 'project_id and chapter_id required' }, { status: 400 });

    const result = await runStyleEnforcer(base44, project_id, chapter_id, prose, continuity_fixes);
    return Response.json(result);
  } catch (error) {
    console.error('styleEnforcer error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});