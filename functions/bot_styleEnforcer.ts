// ═══════════════════════════════════════════════════════════════════════════════
// BOT 4 — STYLE ENFORCER
// ═══════════════════════════════════════════════════════════════════════════════
// Fix every style violation in-place. Return clean prose. ONE AI call for fixes.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ═══ INLINED: shared/aiRouter (compact) ═══
const MODEL_MAP = {
  "claude-sonnet": { provider: "anthropic", modelId: "claude-sonnet-4-20250514", defaultTemp: 0.72, maxTokensLimit: null },
  "gemini-pro": { provider: "google", modelId: "gemini-2.0-flash", defaultTemp: 0.72, maxTokensLimit: null },
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

// CODE-LEVEL: Strip any editorial instructions that survived AI generation/rewrite (runs for ALL genres)
const STRIP_LEAK_RX = [
  // General patterns (fiction + NF)
  /^(Begin with|Show the|Continue from|Start with|Open with|Transition to|Transition from|Describe how|Establish the|Adjust the|Rewrite to|Address the|Include a|Ensure that|Note that|End with) [^.!?\n]*([.!?\n]|$)/gim,
  /\b(I'll|I will) (now |)(write|continue|complete|finish) (this |the |)(chapter|scene|section)[^.!?\n]*([.!?\n]|$)/gi,
  /\[NOTE TO (AUTHOR|EDITOR|AI|SELF)\][^.!?\n]*([.!?\n]|$)/gi,
  /\[TODO[:\s][^\]]*\]/gi,
  /\bas (instructed|requested|specified) (in|by) the (prompt|system|user|outline|beat)[^.!?\n]*([.!?\n]|$)/gi,
  /\bper the (outline|beat sheet|specification|chapter prompt)[^.!?\n]*([.!?\n]|$)/gi,
  /\b(Adjust|Rewrite|Address|Revise) the (year|name|time|date|setting|location|chapter|scene|timeline) to (be |match |reflect |align )[^.!?\n]*([.!?\n]|$)/gi,
  /\bEnsure (this|the|that) (aligns|matches|is consistent) with[^.!?\n]*([.!?\n]|$)/gi,
  // NF-specific patterns
  /\b(Remove|Replace|Either identify|Either cite|Either name|Either source|Either provide|Either use|Frame as|Use general|Provide documentary|Provide specific|Provide real|Label as|Anchor to|Anchor these|Source to|Source this|Cite specific|Cite actual|Use documented|Remove invented|Remove fictional|Remove specific|Remove atmospheric|Verify and cite|Insert documented)\b[^.!?\n]*([.!?\n]|$)/gi,
  /\bUse '([^']+)' or [^.!?\n]*([.!?\n]|$)/gi,
  /\bor (clearly |)label as[^.!?\n]*(representative|composite|illustrative|reconstructed|atmospheric|hypothetical)[^.!?\n]*([.!?\n]|$)/gi,
  /\bor (remove|begin with|provide|cite|frame|preface)[^.!?\n]*(fictional|specific|actual|documented|general|representative|composite|atmospheric|reconstructed|hypothetical)[^.!?\n]*([.!?\n]|$)/gi,
  /^(Remove|Replace|Provide|Either|Verify|Insert|Label|Anchor|Source|Frame|Cite)\b[^.!?\n]*(documentary|documented|specific|source|archive|reconstruct|composite|fictional|atmospheric|hypothetical)[^.!?\n]*([.!?\n]|$)/gim,
  /\bContemporary accounts (describe|suggest) similar [^.!?\n]*([.!?\n]|$)/gi,
  /\b(Use general|Remove specific|Either provide|Either cite|Either identify|Either name|Either source|Either use|Frame as|Provide documentary|Provide specific|Provide real|Label as|Anchor to|Source to|Cite specific|Cite actual|Use documented|Remove atmospheric|Remove fictional|Remove invented|Verify and cite|Insert documented)\b[^.!?\n]*?,\s*(?=[a-z])/gi,
  /\b(Remove specific|Use general|Either provide|Either cite|Either use) \w+(\s\w+)? or (cite|provide|use|anchor|source|reference) \w/gi,
];
function stripLeakedInstructions(text) {
  if (!text) return text;
  let c = text;
  for (const rx of STRIP_LEAK_RX) c = c.replace(rx, '');
  return c.replace(/\n{3,}/g, '\n\n').trim();
}

// ═══ INLINED: shared/resolveModel ═══
function resolveModel(callType) { return 'claude-sonnet'; }

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
    withRetry(() => base44.entities.Chapter.filter({ project_id: projectId })),
    withRetry(() => base44.entities.Specification.filter({ project_id: projectId })),
    withRetry(() => base44.entities.Outline.filter({ project_id: projectId })),
    withRetry(() => base44.entities.Project.filter({ id: projectId })).catch(() => []),
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
  [/\bsomething in\b/gi, 'something in', 3], [/\bsomething about\b/gi, 'something about', 2], [/\bthe kind of\b/gi, 'the kind of', 3],
  [/\bparticular\b/gi, 'particular', 3], [/\bsomehow\b/gi, 'somehow', 2],
  [/\bfamiliar\b/gi, 'familiar', 3],
  [/\bozone\b/gi, 'ozone', 1], [/\btraitorous\b/gi, 'traitorous', 1],
  [/\bcurdl/gi, 'curdle/curdled', 1], [/\blive wire\b/gi, 'live wire', 1],
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

// ═══ GEMINI NONFICTION BANS ═══

const GEMINI_NF_FREQUENCY_CAPS = [
  // "The [noun] that [past tense verb]..." as sentence opener — max 2/chapter
  { rx: /(?:^|\.\s+)The\s+[a-z]+\s+that\s+[a-z]+ed\b/gim, label: '"The [noun] that [verb]ed..." opener', max: 2 },
  // "[Person] understood that..." — max 1/chapter
  { rx: /\b[A-Z][a-z]+\s+understood\s+that\b/g, label: '"[Person] understood that..."', max: 1 },
  // "This [abstract noun] created/produced/generated..." — max 2/chapter
  { rx: /\bThis\s+[a-z]+\s+(?:created|produced|generated)\b/gi, label: '"This [noun] created/produced/generated..."', max: 2 },
  // "would prove/manifest/haunt/become" — max 1/chapter total
  { rx: /\bwould\s+(?:prove|manifest|haunt|become)\b/gi, label: '"would prove/manifest/haunt/become"', max: 1 },
  // "represented/demonstrated/illustrated/exemplified" as main verb — max 2/chapter
  { rx: /\b(?:represented|demonstrated|illustrated|exemplified)\b/gi, label: '"represented/demonstrated/illustrated/exemplified"', max: 2 },
  // "the human cost of..." — max 1/chapter
  { rx: /\bthe human cost of\b/gi, label: '"the human cost of..."', max: 1 },
  // Triple abstract noun endings — max 1/chapter
  { rx: /[a-z]+(?:tion|ment|ness|ity|ence|ance),\s+[a-z]+(?:tion|ment|ness|ity|ence|ance),\s+and\s+[a-z]+(?:tion|ment|ness|ity|ence|ance)\s*[.!?]/gi, label: 'triple abstract noun ending clause', max: 1 },
];

const GEMINI_NF_ABSOLUTE_BANS = [
  { rx: /\bconditions\s+where\s+\w+\s+could\s+(?:flourish|thrive)\b/gi, label: '"conditions where [x] could flourish/thrive"' },
  { rx: /\bleaving\s+behind\s+a\s+trail\s+of\b/gi, label: '"leaving behind a trail of..."' },
  { rx: /\bfor\s+(?:generations|decades)\s+to\s+come\b/gi, label: '"for generations/decades to come"' },
];

// "nightmare machine" / "dream factory" — max 1 per manuscript (checked at chapter level as max 0)
const GEMINI_NF_MANUSCRIPT_CAPS = [
  { rx: /\b(?:nightmare\s+machine|dream\s+factory)\b/gi, label: '"nightmare machine" / "dream factory" (max 1/manuscript)', max: 0 },
];

const GEMINI_NF_ENDING_BANS = [
  /\blegacy\b/i, /\bgenerations\b/i, /\bhaunt\b/i, /\breverberat/i,
  /\billuminat/i, /\breveal/i, /\bdark\s+reality\b/i, /\bglamorous\s+facade\b/i,
  /the\s+system\s+that\s+had\s+been\s+designed\s+to\b/i,
];

// ═══ VAGUE SENSATION SCANNER (ALL GENRES — v6 universal) ═══

function scanVagueSensations(text) {
  const violations = [];
  const VAGUE_SENSATIONS = [
    [/\belectricity\b/gi, '"electricity" for physical sensation', 1],
    [/\belectric\b/gi, '"electric" for physical sensation', 2],
    [/\bjolt of \w+/gi, '"jolt of [noun]"', 2],
    [/\bsurge of \w+/gi, '"surge of [noun]"', 2],
    [/\bspike of \w+/gi, '"spike of [noun]"', 2],
    [/\bwave of (pleasure|sensation|desire|heat|arousal|fear|panic|relief|emotion|dread|nausea)/gi, '"wave of [abstract noun]"', 0],
    [/\bpure,?\s*undiluted\b/gi, '"pure undiluted"', 0],
    [/that stole (his|her|their) breath/gi, '"stole breath"', 1],
    [/\bprofound\b.{0,15}\b(sensation|pleasure|coolness|warmth|ache|desire|sadness|silence|dread|loss)/gi, '"profound [sensation]"', 0],
    [/\bdevastating\b.{0,15}\b(sensation|pleasure|spike|arousal|desire|blow|loss|silence|beauty)/gi, '"devastating [noun]"', 1],
    [/\bcoolness that burn/gi, '"coolness that burned" paradox', 1],
    [/\bcircuit complet/gi, '"circuit completing" metaphor', 1],
    [/\blive wire\b/gi, '"live wire" metaphor', 1],
    [/\bsomething (metallic|deeper|else|warm|dark|ancient|spicy|sharp|clean|alien|new|familiar|cold|heavy|wrong|different)\b/gi, '"something [adj]" vague placeholder', 3],
    [/\bozone and star anise\b/gi, 'repeated scent formula (ozone+star anise)', 2],
    [/\b(hum|thrum|vibrat\w+)\b/gi, '"hum/thrum/vibration"', 5],
    [/\bpooled? (in |low )/gi, '"pooled in/low"', 2],
    [/\bsent (a |)(jolt|shiver|chill|wave|surge|bolt|current|shock|rush|spark) (through|down|up|along|across)/gi, '"sent [x] through [y]"', 0],
    [/\bthreatened to (overwhelm|consume|drown|engulf|swallow)/gi, '"threatened to overwhelm"', 0],
    [/\bcouldn't help but\b/gi, '"couldn\'t help but"', 0],
    [/\bin that moment\b/gi, '"in that moment"', 1],
  ];
  for (const [rx, label, max] of VAGUE_SENSATIONS) {
    const m = text.match(rx);
    if (m && m.length > max) violations.push({ type: 'vague_sensation', label, count: m.length, max, fixed: false });
  }
  return violations;
}

// ═══ INTERIORITY REPETITION SCANNER (v10 — tightened caps) ═══

function scanInteriorityRepetition(text, bannedPhrases = []) {
  const violations = [];
  // Per-chapter caps — these are TIGHT because a 25-chapter book multiplies them
  const INTERIORITY_CAPS = [
    [/\bhollow\b/gi, '"hollow"', 1],
    [/\bhollow place\b/gi, '"hollow place"', 0],
    [/\bhollowness\b/gi, '"hollowness"', 0],
    [/\bempty\b/gi, '"empty"', 1],
    [/\bemptiness\b/gi, '"emptiness"', 1],
    [/\bunlovable\b/gi, '"unlovable"', 1],
    [/\bcore wound\b/gi, '"core wound"', 0],
    [/\bold wound\b/gi, '"old wound"', 0],
    [/\binsufficient\b/gi, '"insufficient"', 1],
    [/\bincapable\b/gi, '"incapable"', 1],
    [/\bscraped raw\b/gi, '"scraped raw"', 0],
    [/\blaid bare\b/gi, '"laid bare"', 0],
    [/smelled? like failure/gi, '"smelled like failure"', 0],
    [/\bshattered\b/gi, '"shattered"', 1],
    [/\bbroken\b/gi, '"broken" (emotional)', 1],
    [/\bnumb(ness)?\b/gi, '"numb/numbness"', 1],
    [/\bvoid\b/gi, '"void"', 1],
    [/\baching?\b/gi, '"ache/aching"', 2],
    [/\bfragile\b/gi, '"fragile"', 1],
    [/\bweight (of|in) (his|her|their) chest\b/gi, '"weight in chest"', 1],
    [/\bclench(ed|ing)? (in |)(his|her|their) (chest|gut|stomach)\b/gi, '"clench in chest/gut"', 1],
  ];
  for (const [rx, label, max] of INTERIORITY_CAPS) {
    const m = text.match(rx);
    if (m && m.length > max) violations.push({ type: 'interiority_repetition', label, count: m.length, max, fixed: false });
  }
  // Check banned phrases from previous chapters (manuscript-wide enforcement)
  if (bannedPhrases && bannedPhrases.length > 0) {
    for (const phrase of bannedPhrases) {
      if (typeof phrase === 'string' && phrase.length > 2) {
        try {
          const rx = new RegExp('\\b' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
          const m = text.match(rx);
          if (m && m.length > 0) {
            violations.push({ type: 'interiority_repetition', label: `BANNED from previous chapters: "${phrase}"`, count: m.length, max: 0, fixed: false, severity: 'critical' });
          }
        } catch {}
      }
    }
  }
  return violations;
}

// ═══ POV DISTANCE CHECK (v6) ═══

function scanPovDistance(text) {
  const violations = [];
  const CLINICAL_REFS = [
    [/\bthe human\b/gi, '"the human"'],
    [/\bthe programmer\b/gi, '"the programmer"'],
    [/\bthe subject\b/gi, '"the subject"'],
    [/\bthe candidate\b/gi, '"the candidate"'],
    [/\bthe creature\b/gi, '"the creature"'],
    [/\bthe being\b/gi, '"the being"'],
    [/\bthe entity\b/gi, '"the entity"'],
    [/\bthe alien\b/gi, '"the alien"'],
  ];
  for (const [rx, label] of CLINICAL_REFS) {
    const count = (text.match(rx) || []).length;
    if (count > 3) {
      violations.push({ type: 'pov_distance', label: `${label} used ${count}x — use character names`, count, max: 3, fixed: false });
    }
  }
  return violations;
}

// ═══ SCENT OPENER CHECK (v6) ═══

function scanScentOpener(text) {
  const violations = [];
  const firstSentence = text.trim().split(/[.!?]/)[0] || '';
  
  // Scent-specific opener
  if (/\b(scent|smell|aroma|odor|fragrance|stench|whiff)\b/i.test(firstSentence)) {
    violations.push({ type: 'scent_opener', label: 'Chapter opens with scent description (overused pattern)', count: 1, max: 0, fixed: false });
  }
  
  // Broader sensory formula: "The [adjective] [sensory noun] of/from..." 
  // This catches: "The rhythmic clinking of...", "The bitter aroma of...", "The metallic tang of...",
  // "The flickering fluorescent lights...", "The sharp glare of...", "The relentless drumming of..."
  if (/^The\s+\w+[\s,]+\w*\s*(scent|smell|aroma|tang|taste|hum|buzz|drone|whir|clinking|clink|drumming|patter|squeak|screech|creak|gurgle|hiss|rumble|thrum|pulse|rhythm|glow|glare|flicker|shimmer|gleam|glint|warmth|chill|cold|cool|heat|damp|rough|smooth|sharp|bitter|sweet|acrid|musty|stale|lingering)\b/i.test(firstSentence)) {
    violations.push({ type: 'sensory_opener', label: 'Chapter opens with "The [adj] [sensory noun]..." formula (rotate opening types)', count: 1, max: 0, fixed: false });
  }
  
  // Even broader: "The [adjective] [noun] of [possessive]..." pattern at chapter start
  // Catches: "The rhythmic clinking of Lucia's spoon", "The ghost of Lucia's perfume"
  if (/^The\s+\w+[\s,]+\w+\s+of\s+(the|his|her|their|\w+'s)\s/i.test(firstSentence)) {
    // Only flag if the noun cluster is sensory — check for auditory/visual/tactile words
    if (/\b(light|lights|sound|noise|air|wind|rain|sun|shadow|silence|hum|buzz|clinking|smell|scent|aroma|taste|feel|touch|warmth|cold|heat|glass|metal|wood|fabric|leather)\b/i.test(firstSentence)) {
      violations.push({ type: 'sensory_opener', label: 'Chapter opens with sensory atmosphere description (vary: try dialogue, action, or thought)', count: 1, max: 0, fixed: false });
    }
  }
  
  return violations;
}

// ═══ DIALOGUE PATTERN DETECTOR ═══

function scanDialoguePatterns(text) {
  const violations = [];
  const shameNaming = (text.match(/you (carry|are broken|are tired|feel the weight|build walls|are so very|crave|are empty|are hollow)/gi) || []).length;
  const binaryChoice = (text.match(/you can (run|return|go back|leave|walk away).{0,80}or.{0,80}you can (walk deeper|stay|learn|accept|yield|submit)/gi) || []).length;
  if (shameNaming > 3) violations.push({ type: 'dialogue_pattern', label: 'Character psychoanalyzes protagonist >3 times', count: shameNaming, max: 3, fixed: false });
  if (binaryChoice > 1) violations.push({ type: 'dialogue_pattern', label: 'Binary choice speech pattern repeated', count: binaryChoice, max: 1, fixed: false });
  return violations;
}

// ═══ INSTRUCTION LEAK DETECTOR (v7) ═══

function scanInstructionLeaks(text) {
  const violations = [];
  const LEAK_PATTERNS = [
    /either establish .{1,40} in the verification document/gi,
    /use consistent neutral language/gi,
    /\[NOTE TO (AUTHOR|EDITOR|AI|SELF)\b/gi,
    /\[TODO[:\s]/gi,
    /as (instructed|requested|specified) (in|by) the (prompt|system|user)/gi,
    /per the (outline|beat sheet|specification)/gi,
    /I('ll| will) (now |)write (this |the )(chapter|scene|section)/gi,
    /\[VERIFY[:\s]/gi,
    // Line-start scene directions (expanded: Adjust, Rewrite, Address, Include, Ensure, Note)
    /^(Begin|Show|Either establish|Continue from|Start with|Open with|Transition from|Describe how|Establish|Adjust the|Rewrite to|Address the|Include a|Ensure that|Note that) /gm,
    /^(Begin|Show|Start|Continue|Open|Transition|Describe|Establish|Adjust|Rewrite|Address|Include|Ensure) (the |this |him |her |from |with |in |a |to )\w+.{0,80}(chapter|scene|kitchen|conversation|computer|leaving|moving|timeline|earlier|intentional|outline|consistent|previous|incident|emphasis)/gmi,
    /^(Begin|Show|Start|Continue|Complete|Adjust|Rewrite|Address) .{0,30}(or |, or |then )(show|continue|open|describe|transition|establish|indicate|focus|rewrite)/gmi,
    // NON-ANCHORED versions — catch leaks embedded mid-paragraph
    /\bAdjust the (year|name|time|date|setting|location|chapter) to (be |match |reflect )/gi,
    /\bRewrite (to |the |this |chapter )(focus|include|show|address|reflect|incorporate|emphasize)/gi,
    /\bAddress the .{1,40}(incident|event|scene|cliffhanger|plot point) from the previous/gi,
    /\b(consistent|inconsistent) with the (established |)?(timeline|outline|beat sheet|story bible|specification)/gi,
    /\blike an anchor to this moment/gi,
    /\badd a clear time transition/gi,
    /\bchapter break indicator/gi,
    // v10.2 — patterns from Witch's Intimate Arts leaks
    /\bRemove references to .{1,40}, or (establish|update|add)/gi,
    /\bReplace .{1,40} with .{1,40} throughout/gi,
    /\bInclude .{1,40}(presence|status|treatment|recovery) (at|in|into) the/gi,
    /\bIncorporate the .{1,40}(ritual|healing|subplot|storyline)/gi,
    /\b(Either |)(change|update|revise|modify) the (chapter |)(outline|content|storyline|plot) to (match|reflect|align|incorporate)/gi,
    /\bor (update|ensure|revise) (this |the |)(outline|chapter|content) to (match|align)/gi,
    /\bRevise to (leave|make|ensure|show|have|keep) .{1,40}(alive|dead|defeated|present|consistent)/gi,
    /\bor (ensure|verify) this aligns with (overall |)(plot|story|outline|chapter)/gi,
    /\bEnsure (this|the|that) (aligns|matches|is consistent) with/gi,
    // GENERIC: any directive verb + meta-reference in same sentence (broad catch-all)
    /\b(Remove|Include|Incorporate|Establish|Ensure|Update|Revise|Clarify) .{1,60}(backstory|storyline|plot structure|character arc|earlier chapters|overall plot|chapter outline)/gi,
    /\b(as specified|as outlined|per the outline|as noted|as described) (in |)(the |)(previous|earlier|chapter|outline|spec)/gi,
    // AI meta-comments about completing/continuing the text
    /complete the (chapter|scene|story|section) or indicate/gi,
    /indicate if this is intentional/gi,
    /should (I|we) (continue|complete|finish|expand)/gi,
    /this (section|chapter|scene) (is |appears |seems )?(incomplete|unfinished|truncated)/gi,
    // Nonfiction editorial instructions — prose-safe patterns requiring editorial context (v12.9b)
    /\bRemove specific \w+ or (cite|provide|anchor|source|use)/gi,
    /\bRemove (atmospheric|invented|fictional|fabricated) (reconstruction|detail|scene|quote)/gi,
    /\bEither (identify|cite|name|source|provide|use) (the |a )?(specific|actual|real|documentary|documented)/gi,
    /\bProvide (documentary|specific|archival|real) (source|evidence|documentation)/gi,
    /\bReplace with documented (examples?|case stud|evidence|facts)/gi,
    /\bUse general (timeframe|terms?|reference|description|language)/gi,
    /\bUse documented (examples?|case stud|evidence|sources)/gi,
    /\bLabel as (representative|illustrative|composite|general|reconstructed)/gi,
    /\bFrame as (hypothetical|composite|reconstructed|general|illustrative)/gi,
    /\bAnchor (to|these|this) (documented|real|specific|actual|verifiable)/gi,
    /\bSource (to|this to) (actual|specific|documented|real)/gi,
    /\bCite (specific|actual) (memoir|interview|archive|document|source|published)/gi,
    /\bVerify and cite\b/gi,
    /\bInsert documented\b/gi,
    /\bor (clearly |)label as[^.!?\n]*(representative|composite|illustrative|reconstructed|atmospheric|hypothetical)/gi,
    /\bor (remove|begin with|provide|cite|frame|preface).{1,40}(fictional|documented|general|representative|composite|atmospheric|reconstructed|hypothetical)/gi,
    /\bContemporary accounts (describe|suggest) similar [^.!?\n]{5,}/gi,
    /\bUse '([^']+)' or [^.!?\n]{5,}/gi,
  ];
  for (const rx of LEAK_PATTERNS) {
    const m = text.match(rx);
    if (m) {
      violations.push({ type: 'instruction_leak', label: `Bot instruction in prose: "${m[0].slice(0, 80)}"`, count: m.length, max: 0, fixed: false, severity: 'critical' });
    }
  }
  return violations;
}

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

  // NF transition crutch caps (per chapter)
  const NF_CRUTCH_CAPS = [
    [/\bContemporary accounts (describe|from the period|suggest|indicate)/gi, '"Contemporary accounts describe..."', 1],
    [/\bThe (evidence|documents?|records?|files?) (suggest|reveal|show|indicate|demonstrate)/gi, '"The evidence suggests/reveals..."', 2],
    [/\bThe psychological (impact|toll|damage|cost|effect)/gi, '"The psychological impact/toll..."', 1],
    [/\bThe (pattern|dynamic) (becomes? clear|extend|persist|repeat|continu)/gi, '"The pattern becomes clear..."', 1],
    [/\bThe financial (implication|cost|impact|consequence)/gi, '"The financial implications..."', 1],
    [/\bThe (most )?(disturbing|troubling|sinister|insidious|devastating|tragic) (aspect|part|element|dimension)/gi, '"The most disturbing aspect..."', 1],
    [/\b(I|I've|I'd) (discovered?|found|encountered|spent|examined|sat|sit|stand|stood) .{0,30}(archive|library|folder|document|file|box|basement|reading room)/gi, '"I discovered in the archives..."', 2],
    [/\bThe manila folder/gi, '"The manila folder..."', 1],
    [/\b(dawn|morning|afternoon) (breaks?|light|sun) .{0,20}(through|across|filter|stream)/gi, 'Dawn/morning light scene ending', 1],
    [/\bmake (myself|me) (a |)(cup of |)coffee/gi, '"I make myself coffee..." archive scene', 0],
    // v11.4 additions
    [/\bYou might assume/gi, '"You might assume..." rhetorical opener', 1],
    [/\bConsider the case of/gi, '"Consider the case of..." transition', 1],
    [/\bThis (wasn't|isn't|weren't) .{3,30}(—|–) it was/gi, '"This wasn\'t X — it was Y" rhetorical inversion', 1],
    [/\bWhat they (hadn't|didn't|failed to|never) (anticipat|realiz|understand|grasp|recogniz)/gi, '"What they hadn\'t anticipated..." hindsight framing', 1],
    [/\bThe (irony|paradox) (was|is|wasn't|proved)/gi, '"The irony was..." editorial commentary', 1],
    // v11.6 additions
    [/\bThis represented /gi, '"This represented..." transition filler', 2],
    [/\bThe \w+ proved (particularly|especially|remarkably|devastatingly|extraordinarily)/gi, '"The [noun] proved [adverb]..." filler', 1],
    [/\bThe (system|machine|machinery|apparatus|infrastructure) (that |which |)(had |)(created|built|designed|constructed|produced)/gi, '"The system that had created..." repetitive framing', 2],
  ];
  for (const [rx, label, max] of NF_CRUTCH_CAPS) {
    const m = text.match(rx);
    if (m && m.length > max) {
      warnings.push({ type: 'nf_fiction_trap', label: `NF CRUTCH: ${label} appears ${m.length}x (max ${max})`, count: m.length, max, fixed: false });
    }
  }

  // NF PADDING DETECTION: flag chapters where consecutive paragraphs make the same point
  const paraTexts = text.trim().split(/\n\n+/).filter(p => p.length > 100);
  const impactSynonyms = /\b(impact|toll|cost|consequences?|effect|damage|destruction|devastation|implications?)\b/gi;
  let consecutiveImpactParas = 0;
  for (const p of paraTexts) {
    const hits = (p.match(impactSynonyms) || []).length;
    if (hits >= 3) { consecutiveImpactParas++; } else { consecutiveImpactParas = 0; }
    if (consecutiveImpactParas >= 3) {
      warnings.push({ type: 'nf_padding', label: 'PADDING: 3+ consecutive paragraphs making the same "impact/toll/cost" point — trim or diversify', count: 1, max: 0, fixed: false });
      break;
    }
  }

  // NF RECONSTRUCTION LABELING: flag scene openings that present reconstructions as documented fact
  const firstPara = paraTexts[0] || '';
  const hasSceneReconstruction = /\b(The |A |His |Her |She |He )(limousine|telephone|needle|silk|burgundy|mahogany|fluorescent|morning|afternoon|evening)\b/.test(firstPara) && firstPara.length > 200;
  const hasReconstructionLabel = /\b(contemporary accounts|reconstructed from|testimony from the period|witnesses (later )?described|based on (court |legal )?records|accounts from the era)\b/i.test(firstPara);
  if (hasSceneReconstruction && !hasReconstructionLabel) {
    warnings.push({ type: 'nf_unlabeled_reconstruction', label: 'UNLABELED RECONSTRUCTION: Opening scene reads as fiction. Add "Contemporary accounts describe..." or "Based on testimony from the period..." label', count: 1, max: 0, fixed: false });
  }

  return warnings;
}

function scanGeminiNonfictionBans(text) {
  const violations = [];

  // Frequency caps
  for (const { rx, label, max } of GEMINI_NF_FREQUENCY_CAPS) {
    const m = text.match(rx);
    const count = m ? m.length : 0;
    if (count > max) violations.push({ type: 'gemini_nf_cap', label: `${label} (${count}x, max ${max})`, count, max, fixed: false });
  }

  // Absolute bans
  for (const { rx, label } of GEMINI_NF_ABSOLUTE_BANS) {
    const m = text.match(rx);
    if (m) violations.push({ type: 'gemini_nf_ban', label, count: m.length, max: 0, fixed: false });
  }

  // Manuscript-level caps (flag at chapter level — orchestrator tracks manuscript total)
  for (const { rx, label, max } of GEMINI_NF_MANUSCRIPT_CAPS) {
    const m = text.match(rx);
    if (m && m.length > max) violations.push({ type: 'gemini_nf_manuscript_cap', label, count: m.length, max, fixed: false });
  }

  return violations;
}

function scanGeminiEndingEnforcement(text) {
  const violations = [];
  const paras = text.trim().split(/\n\n+/);
  const lastPara = paras[paras.length - 1] || '';

  for (const rx of GEMINI_NF_ENDING_BANS) {
    const m = lastPara.match(rx);
    if (m) {
      violations.push({
        type: 'gemini_nf_ending',
        label: `Final paragraph contains banned word/phrase: "${m[0]}"`,
        count: 1,
        max: 0,
        fixed: false,
      });
    }
  }

  return violations;
}
function scanMetaResponse(text) {
  const first500 = text.slice(0, 500);
  const META = [/^I appreciate you/i, /^I need to clarify/i, /^Here is/i, /^Here are/i, /^As requested/i, /^I'll write/i, /[✓✗☐☑]/];
  if (META.some(p => p.test(first500))) { return [{ type: 'meta_response', label: 'AI meta-response instead of prose', count: 1, max: 0, fixed: false }]; }
  return [];
}

// ═══ NF FABRICATED CITATION SCANNER ═══
function scanFabricatedCitations(text) {
  const violations = [];
  const FABRICATED_PATTERNS = [
    [/\bcase (?:number|no\.?|#)\s*\d{2,}[-–]\d+/gi, 'Fabricated case number'],
    [/\bpublished in (?:the )?(?:Journal|Bulletin|Review|Quarterly|Annals) of [A-Z][a-z]+ [A-Z][a-z]+(?:\s+in \d{4})/gi, 'Fabricated journal citation'],
    [/\bFBI (?:memo|file|report|document) (?:dated|from|of) (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2},?\s*\d{4}/gi, 'Fabricated FBI document with specific date'],
    [/\b(?:FOIA|Freedom of Information) (?:request|release)s? (?:in|from|of) (?:the )?\d{4}s?\b/gi, 'Potentially fabricated FOIA reference'],
    [/\barchive (?:box|folder|file) (?:number|no\.?|#)\s*\d+/gi, 'Fabricated archive reference number'],
    [/\b\d+ interconnected operations?\b.*\b(?:FBI|federal|LAPD)\b/gi, 'Fabricated law enforcement statistic'],
  ];
  for (const [rx, label] of FABRICATED_PATTERNS) {
    const m = text.match(rx);
    if (m) violations.push({ type: 'nf_fabricated_citation', label: `FABRICATED CITATION: ${label}: "${m[0].slice(0, 80)}"`, count: m.length, max: 0, fixed: false, severity: 'critical' });
  }
  return violations;
}

// ═══ NF COMPOSITE CHARACTER SCANNER ═══
// Detects full names (First Last) that appear multiple times but are NOT in the story bible
function scanCompositeCharacters(text, storyBible) {
  const violations = [];
  // Build list of known real names from story bible
  const knownNames = new Set();
  if (storyBible) {
    const chars = storyBible.characters || storyBible.key_figures || [];
    for (const c of chars) {
      if (c.name) knownNames.add(c.name.toLowerCase().trim());
    }
  }
  // Also add well-known historical figures that appear frequently in NF
  const KNOWN_FIGURES = ['harry cohn','louis b. mayer','louis mayer','jack warner','irving thalberg','rita hayworth','marilyn monroe','norma jeane','joan crawford','hedda hopper','louella parsons','clark gable','loretta young','judy garland','rock hudson','henry willson','kim novak','frank orsatti','eddie mannix','howard strickling','dalton trumbo','ring lardner','elia kazan','otto preminger','bette davis','frank capra','orson welles','joseph breen','will hays','charlie chaplin','montgomery clift','elizabeth taylor','sammy davis','dorothy dandridge','lana turner','errol flynn','gale sondergaard','john garfield','clifford odets','larry parks','harvey weinstein','rose mcgowan','ashley judd','judy lewis','phyllis gates','jack navaar','joe brandt','willie bioff','george browne','frank nitti','johnny roselli','robert harrison','david thomson','neal gabler','mark griffin','christina crawford','cheryl crane','david bret','roy newquist','james stewart','burt lancaster','doris day','jane wyman','arthur miller','joe dimaggio','roberto rossellini','ingrid bergman','ben lyon','tom lewis','william desmond taylor','wallace reid','fatty arbuckle','alyssa milano','tarana burke','jodi kantor','megan twohey','bill cosby','billy wilder','howard hawks'];
  for (const name of KNOWN_FIGURES) knownNames.add(name);

  // Find all "First Last" patterns (capitalized first + capitalized last) appearing 2+ times
  const fullNameRx = /\b([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})\b/g;
  const nameCounts = {};
  let match;
  while ((match = fullNameRx.exec(text)) !== null) {
    const name = `${match[1]} ${match[2]}`;
    const lower = name.toLowerCase();
    if (!knownNames.has(lower)) {
      nameCounts[name] = (nameCounts[name] || 0) + 1;
    }
  }
  // Flag names appearing 3+ times that aren't in the known list
  for (const [name, count] of Object.entries(nameCounts)) {
    if (count >= 3) {
      violations.push({ type: 'nf_composite_character', label: `POSSIBLE COMPOSITE: "${name}" appears ${count}x but is not in the story bible. If composite, label as such. If real, verify.`, count, max: 0, fixed: false, severity: 'warning' });
    }
  }
  return violations;
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
    if (v.type === 'instruction_leak') return `INSTRUCTION LEAK: ${v.label}. This is a bot directive that leaked into prose output. Remove it entirely — it is not narrative content.`;
    if (v.type === 'character_name_inconsistency') return `CHARACTER NAME ERROR: ${v.label}. Replace this name with the correct character from the registry, or use a generic descriptor (e.g., "the doctor", "the detective") if no match exists.`;
    if (v.type === 'gemini_nf_cap') return `GEMINI NF CAP: ${v.label}. Rewrite excess occurrences using different phrasing. Vary sentence structure.`;
    if (v.type === 'gemini_nf_ban') return `GEMINI NF BAN: "${v.label}" is banned entirely. Rewrite using concrete specific detail instead of this cliché.`;
    if (v.type === 'gemini_nf_manuscript_cap') return `GEMINI NF MANUSCRIPT BAN: ${v.label}. Remove or replace — this phrase is near its manuscript-wide limit.`;
    if (v.type === 'gemini_nf_ending') return `GEMINI NF ENDING: ${v.label}. Rewrite the final paragraph to end on a concrete image, specific documented detail, or an unresolved question — NOT a sweeping thematic statement.`;
    if (v.type === 'vague_sensation') return `VAGUE SENSATION: ${v.label} appears ${v.count}x (max ${v.max}). Replace with specific body location + physical descriptor. BAD: "electricity shot through him." GOOD: "the drag of cool scales across his inner thigh made his hips jerk." For "something inside broke/shattered": replace with what SPECIFICALLY the character felt — name the muscle group, the body part, the physical reflex. For scent formulas: replace with ONE dominant scent tied to a specific memory or physical reaction.`;
    if (v.type === 'interiority_repetition') return `INTERIORITY REPETITION: ${v.label} appears ${v.count}x (max ${v.max}). Replace repeated emotional vocabulary with NEW dimensions of the character's psychology.`;
    if (v.type === 'dialogue_pattern') return `DIALOGUE PATTERN: ${v.label}. This character needs different conversational modes — mundane exchanges, genuine questions, uncertainty, humor.`;
    if (v.type === 'sensory_opener') return `SENSORY OPENER: ${v.label}. Rewrite the opening sentence to use a DIFFERENT approach: dialogue, action, internal thought, a question, or a time/place stamp. Do NOT open with "The [adjective] [sensory detail]..."`;
    if (v.type === 'word_count_excess') return `WORD COUNT: Chapter is ${v.count} words, target is ${v.max} max. Trim redundant paragraphs, compress recap sections, and cut any passages that don't advance plot or character. Do NOT cut dialogue or climactic scenes.`;
    if (v.type === 'nf_fabricated_citation') return `FABRICATED CITATION: ${v.label}. Replace with general sourcing language. WRONG: "case number 56-4429" → RIGHT: "court records from the period." WRONG: "published in the Journal of Clinical Psychology in 1958" → RIGHT: "a psychiatrist's clinical notes from the era." WRONG: "FBI memo dated March 15, 1951" → RIGHT: "FBI surveillance files from the period." Do NOT invent verifiable reference numbers.`;
    if (v.type === 'nf_composite_character') return `COMPOSITE CHARACTER: ${v.label}. Either (a) replace this named character with a role description ("a studio publicist," "a Beverly Hills psychiatrist"), OR (b) if the character serves a narrative purpose, add an explicit label: "The following account is a composite drawn from multiple documented cases." Do NOT present composite figures as real documented individuals.`;
    if (v.type === 'nf_padding') return `NF PADDING: ${v.label}. Merge the redundant paragraphs into one tighter paragraph.`;
    return `${v.type}: ${v.label}`;
  }).join('\n');

  const systemPrompt = `You are a prose editor. Fix ONLY the violations listed below. Do NOT rewrite prose that isn't flagged. Preserve the author's voice, sentence structure, and word count. Output ONLY the corrected chapter text — no commentary.\n\n${isNonfiction ? 'NONFICTION RULES:\n- No melodrama, no journey metaphors, no thesis restatements in endings. Replace with documented evidence or specific detail.\n- INSTRUCTION LEAKS: If any sentence contains these trigger phrases, DELETE the instruction and replace with actual prose: "Remove specific," "Remove atmospheric," "Remove invented," "Remove fictional," "Replace with documented," "Either identify," "Either cite," "Either provide," "Either name," "Either source," "Either use," "Frame as," "Use general," "Use documented," "Provide documentary," "Provide specific," "Provide real," "Label as," "Anchor to," "Source to," "Cite specific," "Cite actual," "Verify and cite," "Insert documented." Also catch fused instructions where editorial text flows into prose without punctuation.\n- UNLABELED RECONSTRUCTIONS: If a scene presents a historical reconstruction as if it were documented fact, add framing like "Contemporary accounts describe..." or "Based on testimony from the period..."\n- PADDING: If consecutive paragraphs repeat the same point with synonym substitution, merge them into a single tighter paragraph.\n- REAL PERSON FACTS: Do NOT fabricate deaths, suicides, medical records, or legal events for named real people. If unsure, use general language.' : ''}`;

  const userMessage = `VIOLATIONS TO FIX:\n${violationBrief}\n\nCHAPTER TEXT:\n${prose}`;

  try {
    const fixed = await callAI(modelKey, systemPrompt, userMessage, { maxTokens: 16384, temperature: 0.3 });
    if (isRefusal(fixed)) return { text: prose, fixed: 0 };
    if (fixed.length < prose.length * 0.5) return { text: prose, fixed: 0 };
    // CODE-LEVEL: Strip any instruction leaks that survived the AI rewrite (runs for ALL genres)
    const finalText = stripLeakedInstructions(fixed);
    return { text: finalText, fixed: violations.length };
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
    const outlines = await withRetry(() => base44.entities.Outline.filter({ project_id: projectId }));
    const outline = outlines[0];
    if (outline) {
      let bibleRaw = outline.story_bible || '';
      if (!bibleRaw && outline.story_bible_url) { try { bibleRaw = await (await fetch(outline.story_bible_url)).text(); } catch {} }
      if (bibleRaw) { try { storyBible = JSON.parse(bibleRaw); } catch {} }
    }
    const projects = await withRetry(() => base44.entities.Project.filter({ id: projectId }));
    if (projects[0]?.name_registry) { let nrRaw = projects[0].name_registry; if (typeof nrRaw === 'string' && nrRaw.startsWith('http')) { try { nrRaw = await (await fetch(nrRaw)).text(); } catch { nrRaw = '{}'; } } try { nameRegistry = JSON.parse(nrRaw); } catch {} }
  } catch {}

  let text = prose || await resolveContent(chCtx.chapter.content);
  if (!text || text.length < 100) throw new Error('No prose to enforce');

  // Apply high-confidence continuity fixes first
  text = applyContinuityFixes(text, continuityFixes);

  // Detect erotica for genre-specific scans
  const isErotica = /erotica|erotic|romance|bdsm/.test(((ctx.spec?.genre || '') + ' ' + (ctx.spec?.subgenre || '')).toLowerCase()) || (parseInt(ctx.spec?.spice_level) || 0) >= 3;

  // Collect all violations
  const allViolations = [
    ...scanInlineNotes(text),
    ...scanInstructionLeaks(text),
    ...scanMetaResponse(text),
    ...scanCharacterNames(text, storyBible, nameRegistry),
    ...scanBannedPhrases(text),
    ...scanFrequencyCaps(text),
    ...scanDynamicCaps(text, chCtx.previousChapters),
    ...scanSceneEndings(text),
    ...scanInteriorityRepetition(text, ctx.bannedPhrases),
    ...scanDialoguePatterns(text),
    ...scanPovDistance(text),
    ...scanScentOpener(text),
    ...scanVagueSensations(text),
    ...(isNonfiction ? scanNonfictionPatterns(text) : []),
    ...(isNonfiction ? scanGeminiNonfictionBans(text) : []),
    ...(isNonfiction ? scanGeminiEndingEnforcement(text) : []),
    ...(isNonfiction ? scanFabricatedCitations(text) : []),
    ...(isNonfiction ? scanCompositeCharacters(text, storyBible) : []),
  ];

  // Word count enforcement — flag chapters exceeding 130% of target
  const wordCount = text.trim().split(/\s+/).length;
  const TARGET_WORDS = { short: 2500, medium: 2500, long: 2800, epic: 3000 };
  const targetWords = TARGET_WORDS[ctx.spec?.target_length || 'medium'] || 2500;
  const maxWords = Math.round(targetWords * 1.3);
  if (wordCount > maxWords) {
    allViolations.push({
      type: 'word_count_excess',
      label: `Chapter is ${wordCount} words — exceeds ${maxWords} word maximum (target: ${targetWords}). AI must trim to target length.`,
      count: wordCount,
      max: maxWords,
      fixed: false,
      severity: 'warning',
    });
  }

  // If violations found, do ONE AI fix pass
  let cleanProse = text;
  let fixedCount = 0;
  if (allViolations.length > 0) {
    const result = await applyAIFixes(text, allViolations, ctx.spec, isNonfiction);
    cleanProse = result.text;
    fixedCount = result.fixed;
  }

  // Nonfiction ending fix (dedicated AI pass)
  if (isNonfiction) {
    const paras = cleanProse.trim().split(/\n\n+/);
    const lastPara = paras[paras.length - 1] || '';
    if (NF_ENDING_BANS.some(p => p.test(lastPara))) {
      try {
        const endingFix = await callAI(resolveModel('style_rewrite'),
          'You are a nonfiction editor. Rewrite the final 2-3 sentences ONLY. End on specific documented detail, concrete image, or unresolved question. No thesis, no morals, no verse.',
          `CURRENT ENDING (VIOLATING):\n${lastPara}\n\nReturn only replacement sentences.`,
          { maxTokens: 512, temperature: 0.4 }
        );
        if (endingFix?.trim().length > 20 && !isRefusal(endingFix)) {
          paras[paras.length - 1] = endingFix.trim();
          cleanProse = paras.join('\n\n');
        }
      } catch (e) { console.warn('NF ending fix failed:', e.message); }
    }
  }

  // Re-scan to report remaining violations
  const remaining = [
    ...scanBannedPhrases(cleanProse),
    ...scanFrequencyCaps(cleanProse),
    ...(isNonfiction ? scanGeminiNonfictionBans(cleanProse) : []),
    ...(isNonfiction ? scanGeminiEndingEnforcement(cleanProse) : []),
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

  // FINAL CODE-LEVEL STRIP: Catch any instruction leaks that survived all AI passes (runs for ALL genres)
  const finalProse = stripLeakedInstructions(cleanProse);

  return {
    clean_prose: finalProse,
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

    // Save corrected prose back to chapter if violations were fixed
    if (result.clean_prose && result.violations_found > 0) {
      try {
        await base44.entities.Chapter.update(chapter_id, { content: result.clean_prose });
        result.saved = true;
      } catch (saveErr) {
        console.warn('Failed to save fixed prose:', saveErr.message);
        result.saved = false;
      }
    }

    return Response.json(result);
  } catch (error) {
    console.error('styleEnforcer error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});