// BOT 4 — STYLE ENFORCER (v2 — optimized data loading)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ═══ INLINED: shared/aiRouter (compact) ═══
const MODEL_MAP = {
  "claude-sonnet": { provider: "anthropic", modelId: "claude-sonnet-4-20250514", defaultTemp: 0.72, maxTokensLimit: null },
  "gemini-pro": { provider: "google", modelId: "gemini-2.5-flash", defaultTemp: 0.72, maxTokensLimit: null },
  "trinity": { provider: "openrouter", modelId: "deepseek/deepseek-v3.2", defaultTemp: 0.72, maxTokensLimit: null },
};
async function callAI(modelKey, systemPrompt, userMessage, options = {}) {
  const config = MODEL_MAP[modelKey] || MODEL_MAP["trinity"];
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
  if (provider === "openrouter") {
    const orKey = Deno.env.get('OPENROUTER_API_KEY');
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + orKey, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://unity-ghostwriter.base44.app', 'X-Title': 'Unity Ghostwriter' }, body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }) });
    const d = await r.json(); if (!r.ok) throw new Error('OpenRouter: ' + (d.error?.message || r.status)); return d.choices[0].message.content;
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
function resolveModel(callType) { return 'gemini-pro'; }

// Simple retry for rate limits
async function withRetry(fn) {
  try { return await fn(); } catch (err) {
    if (err.message?.includes('429')) {
      await new Promise(r => setTimeout(r, 5000));
      return await fn();
    }
    throw err;
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
  const paras = splitIntoSegments(text);
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
  const paraTexts = splitIntoSegments(text).filter(p => p.length > 100);
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
  const paras = splitIntoSegments(text);
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

// ═══ CODE-LEVEL FIX PASS (no AI calls — executes in milliseconds) ═══

function applyCodeFixes(prose) {
  let text = prose;
  let fixCount = 0;

  // Normalize paragraph splitting — handle content with single \n breaks
  const hasDoubleBreaks = /\n\n/.test(text);
  const PARA_SEP = hasDoubleBreaks ? /\n\n+/ : /\n/;
  const PARA_JOIN = hasDoubleBreaks ? '\n\n' : '\n';

  // 1. DUPLICATE PARAGRAPH REMOVAL
  // Split on paragraph breaks, deduplicate paragraphs sharing 80%+ words
  const paras = text.split(PARA_SEP);
  const kept = [];
  const removedIndices = new Set();
  for (let i = 0; i < paras.length; i++) {
    if (removedIndices.has(i)) continue;
    const wordsA = new Set((paras[i].toLowerCase().match(/\b[a-z]{3,}\b/g) || []));
    if (wordsA.size < 40) { kept.push(paras[i]); continue; } // skip short paragraphs
    for (let j = i + 1; j < paras.length; j++) {
      if (removedIndices.has(j)) continue;
      const wordsB = new Set((paras[j].toLowerCase().match(/\b[a-z]{3,}\b/g) || []));
      if (wordsB.size < 40) continue;
      let intersection = 0;
      for (const w of wordsA) { if (wordsB.has(w)) intersection++; }
      const smaller = Math.min(wordsA.size, wordsB.size);
      if (smaller > 0 && intersection / smaller >= 0.8) {
        removedIndices.add(j);
        fixCount++;
      }
    }
    kept.push(paras[i]);
  }
  // Add any remaining short paragraphs that weren't removed
  for (let i = 0; i < paras.length; i++) {
    if (!removedIndices.has(i) && !kept.includes(paras[i])) kept.push(paras[i]);
  }
  text = kept.join(PARA_JOIN);

  // 2. BANNED PHRASE REMOVAL — delete sentences containing banned phrases
  for (const b of ABSOLUTE_BANS) {
    if (b.p.test(text)) {
      // Reset lastIndex for global regexes
      b.p.lastIndex = 0;
      // Remove entire sentences containing the banned phrase
      const sentences = text.split(/(?<=[.!?])\s+/);
      const cleaned = sentences.filter(s => { b.p.lastIndex = 0; return !b.p.test(s); });
      if (cleaned.length < sentences.length) {
        fixCount += sentences.length - cleaned.length;
        text = cleaned.join(' ');
      }
      b.p.lastIndex = 0;
    }
  }

  // 3. INSTRUCTION LEAK STRIPPING (already exists)
  const beforeLeakStrip = text.length;
  text = stripLeakedInstructions(text);
  if (text.length < beforeLeakStrip) fixCount++;

  // 4. COFFEE SCENE REMOVAL — keep only first coffee paragraph (skip large blocks)
  const coffeeRx = /\bcoffee\b/i;
  const coffeeSupportRx = /\b(mug|cup|brew|kitchen|kettle|espresso|caffeine)\b/i;
  const coffeParas = text.split(PARA_SEP);
  let coffeeCount = 0;
  const afterCoffee = coffeParas.filter(p => {
    if (p.length < 2000 && coffeeRx.test(p) && coffeeSupportRx.test(p)) {
      coffeeCount++;
      if (coffeeCount > 1) { fixCount++; return false; }
    }
    return true;
  });
  if (coffeeCount > 1) text = afterCoffee.join(PARA_JOIN);

  // SAFETY: if any removal step wiped too much content, revert
  if (text.length < prose.length * 0.5) {
    console.warn('applyCodeFixes: content too short after removals, reverting to original');
    return { text: prose, fixed: 0 };
  }

  // 5. ARCHIVE FRAMING TRIM — keep only first 2 archive paragraphs
  const archiveRx = /\b(folder|archive|brittle paper|yellowed|old paper|dust motes|manila folder|reading room)\b/i;
  const archiveParas = text.split(PARA_SEP);
  let archiveCount = 0;
  const afterArchive = archiveParas.filter(p => {
    if (archiveRx.test(p)) {
      archiveCount++;
      if (archiveCount > 2) { fixCount++; return false; }
    }
    return true;
  });
  if (archiveCount > 2) text = afterArchive.join(PARA_JOIN);

  // 6. REPEATED PARAGRAPH OPENER COMPRESSION
  // If 3+ consecutive paragraphs start with same 4-word prefix, keep only the first
  const openerParas = text.split(PARA_SEP);
  const finalParas = [];
  let streakStart = 0;
  for (let i = 0; i < openerParas.length; i++) {
    const prefix = (openerParas[i].trim().toLowerCase().match(/\b[a-z]+\b/g) || []).slice(0, 4).join(' ');
    const nextPrefix = i + 1 < openerParas.length
      ? (openerParas[i + 1].trim().toLowerCase().match(/\b[a-z]+\b/g) || []).slice(0, 4).join(' ')
      : '';
    if (prefix && prefix === nextPrefix) {
      // Continue streak — only push current if it's the start of a new streak
      if (finalParas.length === 0 || finalParas[finalParas.length - 1] !== openerParas[i]) {
        finalParas.push(openerParas[i]);
      }
      // Skip the next one (it will be checked in next iteration)
    } else {
      // Check if this is a duplicate of the previous (end of streak)
      const prevPrefix = finalParas.length > 0
        ? (finalParas[finalParas.length - 1].trim().toLowerCase().match(/\b[a-z]+\b/g) || []).slice(0, 4).join(' ')
        : '';
      if (prefix && prefix === prevPrefix) {
        fixCount++; // skip this paragraph — duplicate opener
      } else {
        finalParas.push(openerParas[i]);
      }
    }
  }
  if (finalParas.length < openerParas.length) text = finalParas.join(PARA_JOIN);

  // 7. INTERIORITY WORD CAPS — enforce per-chapter limits
  const INTERIORITY_FIXES = [
    { rx: /\bhollowness\b/gi, max: 0, alts: ['emptiness', 'barrenness', 'desolation'] },
    { rx: /\bhollow place\b/gi, max: 0, alts: ['empty space', 'void within', 'barren core'] },
    { rx: /\bhollow\b/gi, max: 1, alts: ['empty', 'barren', 'vacant', 'desolate'] },
    { rx: /\bemptiness\b/gi, max: 1, alts: ['void', 'absence', 'blankness'] },
    { rx: /\bempty\b/gi, max: 1, alts: ['vacant', 'bare', 'devoid', 'barren'] },
    { rx: /\bshattered\b/gi, max: 1, alts: ['fractured', 'splintered', 'crumbled', 'ruined'] },
    { rx: /\bbroken\b/gi, max: 1, alts: ['damaged', 'fractured', 'ruined', 'wrecked'] },
    { rx: /\bnumbness\b/gi, max: 0, alts: ['detachment', 'dissociation', 'blankness'] },
    { rx: /\bnumb\b/gi, max: 1, alts: ['insensate', 'deadened', 'detached'] },
    { rx: /\bvoid\b/gi, max: 1, alts: ['absence', 'gap', 'chasm', 'vacuum'] },
    { rx: /\baching\b/gi, max: 1, alts: ['throbbing', 'persistent', 'gnawing'] },
    { rx: /\bache\b/gi, max: 1, alts: ['pang', 'throb', 'sting'] },
    { rx: /\bfragile\b/gi, max: 1, alts: ['delicate', 'vulnerable', 'tenuous'] },
    { rx: /\bunlovable\b/gi, max: 1, alts: ['unwanted', 'rejected', 'cast aside'] },
    { rx: /\bweight (of|in) (his|her|their) chest\b/gi, max: 1, alts: ['pressure behind the ribs', 'tightness in the sternum', 'constriction across the torso'] },
    { rx: /\bscraped raw\b/gi, max: 0, alts: ['worn thin', 'rubbed bare', 'stripped down'] },
    { rx: /\blaid bare\b/gi, max: 0, alts: ['exposed', 'uncovered', 'stripped'] },
    { rx: /\bcore wound\b/gi, max: 0, alts: ['deepest injury', 'fundamental trauma', 'central damage'] },
    { rx: /\bold wound\b/gi, max: 0, alts: ['lingering injury', 'unhealed damage', 'persistent scar'] },
  ];
  for (const { rx, max, alts } of INTERIORITY_FIXES) {
    let count = 0;
    text = text.replace(rx, function(match) {
      count++;
      if (count <= max) return match;
      fixCount++;
      return alts[(count - max - 1) % alts.length];
    });
  }

  // 8. NF BANNED PHRASE REMOVAL — delete sentences with absolute bans
  const NF_BAN_PATTERNS = [
    /\bconditions\s+where\s+\w+\s+could\s+(?:flourish|thrive)\b/gi,
    /\bleaving\s+behind\s+a\s+trail\s+of\b/gi,
    /\bfor\s+(?:generations|decades)\s+to\s+come\b/gi,
  ];
  for (const rx of NF_BAN_PATTERNS) {
    if (rx.test(text)) {
      rx.lastIndex = 0;
      const sentences = text.split(/(?<=[.!?])\s+/);
      const before = sentences.length;
      const cleaned = sentences.filter(s => { rx.lastIndex = 0; return !rx.test(s); });
      if (cleaned.length < before) {
        fixCount += before - cleaned.length;
        text = cleaned.join(' ');
      }
      rx.lastIndex = 0;
    }
  }

  // 9. NF FREQUENCY CAPS — enforce per-chapter limits
  const NF_FREQ_FIXES = [
    { rx: /(?:^|\.\s+)The\s+[a-z]+\s+that\s+[a-z]+ed\b/gim, max: 2 },
    { rx: /\bwould\s+(?:prove|manifest|haunt|become)\b/gi, max: 1 },
    { rx: /\bthe human cost of\b/gi, max: 1 },
  ];
  for (const { rx, max } of NF_FREQ_FIXES) {
    let count = 0;
    text = text.replace(rx, function(match) {
      count++;
      if (count <= max) return match;
      fixCount++;
      return ''; // remove excess instances
    });
  }

  // 9.5. NF MANUSCRIPT CAPS — dream factory / nightmare machine max 1 per chapter
  let dreamFactoryCount = 0;
  text = text.replace(/\b(?:nightmare\s+machine|dream\s+factory)\b/gi, function(match) {
    dreamFactoryCount++;
    if (dreamFactoryCount <= 1) return match;
    fixCount++;
    const alts = ['studio apparatus', 'Hollywood machine', 'entertainment complex', 'cinematic engine'];
    return alts[(dreamFactoryCount - 2) % alts.length];
  });

  // 10. CAP "Consider the/a..." openers — max 1 per chapter
  let considerCount = 0;
  text = text.replace(/\bConsider (the|a|an|how|what)\b/gi, function(match) {
    considerCount++;
    if (considerCount <= 1) return match;
    fixCount++;
    const alts = ['Look at', 'Take', 'Examine', 'Note', 'Observe'];
    return alts[(considerCount - 2) % alts.length] + ' ' + match.split(' ').slice(1).join(' ');
  });

  // 8. CAP "You might assume/imagine..." — max 1 per chapter
  let youMightCount = 0;
  text = text.replace(/\bYou might (assume|imagine|picture|envision|wonder|think)\b/gi, function(match) {
    youMightCount++;
    if (youMightCount <= 1) return match;
    fixCount++;
    return '';
  });

  // 9. CAP thesis restatement phrases — max 2 each per chapter
  const thesisPhrases = {
    'gilded cage': ['luxurious prison', 'golden trap', 'opulent confinement', 'glittering enclosure'],
    'absolute control': ['total authority', 'iron grip', 'complete dominion', 'unquestioned command'],
    'systemic exploitation': ['institutional abuse', 'organized predation', 'structural coercion', 'embedded corruption'],
    'dream factory': ['studio machine', 'Hollywood apparatus', 'entertainment empire', 'cinematic engine'],
    'unchecked power': ['unaccountable authority', 'unrestrained dominance', 'unbridled influence', 'limitless command'],
    'pervasive control': ['omnipresent authority', 'all-encompassing grip', 'sweeping dominion', 'inescapable oversight'],
    'systematic abuse': ['methodical exploitation', 'organized mistreatment', 'calculated cruelty', 'institutional predation'],
  };
  for (const [phrase, alts] of Object.entries(thesisPhrases)) {
    let phCount = 0;
    const rx = new RegExp('\\b' + phrase.replace(/ /g, '\\s+') + '\\b', 'gi');
    text = text.replace(rx, function(match) {
      phCount++;
      if (phCount <= 2) return match;
      fixCount++;
      return alts[(phCount - 3) % alts.length];
    });
  }

  // 11. NF PHRASE CAPS — cap per chapter (matches frontend scanner NF_PHRASE_CAPS)
  const NF_PHRASE_FIXES = [
    { rx: /\bContemporary accounts\b/gi, max: 1, alts: ['Historical records', 'Period sources', 'Accounts from the era'] },
    { rx: /\bThe evidence suggests\b/gi, max: 1, alts: ['The record indicates', 'Documents reveal', 'Sources point to'] },
    { rx: /\bThe psychological impact\b/gi, max: 1, alts: ['The emotional toll', 'The mental consequences', 'The lasting damage'] },
    { rx: /\bThe pattern becomes clear\b/gi, max: 1, alts: ['A pattern emerges', 'The throughline reveals itself', 'The consistency is unmistakable'] },
    { rx: /\bThis represented\b/gi, max: 1, alts: ['This marked', 'This signaled', 'This constituted'] },
  ];
  for (const { rx, max, alts } of NF_PHRASE_FIXES) {
    let count = 0;
    text = text.replace(rx, function(match) {
      count++;
      if (count <= max) return match;
      fixCount++;
      return alts[(count - max - 1) % alts.length];
    });
  }

  // 12. TRANSITION CRUTCH REMOVAL
  const transitionRx = [
    /\bFurthermore,?\s/gi,
    /\bMoreover,?\s/gi,
    /\bAdditionally,?\s/gi,
    /\bIt'?s worth noting that\s/gi,
    /\bAs (mentioned|discussed|noted|stated) (earlier|above|previously|before),?\s/gi,
    /\bWith this (understanding|context|background|foundation),?\s/gi,
    /\bUltimately,?\s/gi,
  ];
  for (const rx of transitionRx) {
    const before = text;
    text = text.replace(rx, '');
    if (text !== before) fixCount++;
  }

  // 13. SCAFFOLDING SENTENCE REMOVAL
  const scaffoldRx = [
    /\bThis (chapter|section|part) (will )?(explore|examine|discuss|investigate|look at|delve into|unpack)[^.!?\n]*[.!?\n]/gi,
    /\bIn this (chapter|section|part),? we (will|shall|are going to)[^.!?\n]*[.!?\n]/gi,
    /\bBefore (we|I) (begin|dive in|proceed|explore|examine)[^.!?\n]*[.!?\n]/gi,
    /\bLet'?s (begin|start|dive in|explore|examine|unpack)[^.!?\n]*[.!?\n]/gi,
    /\bWhat (follows|comes next) is[^.!?\n]*[.!?\n]/gi,
  ];
  for (const rx of scaffoldRx) {
    const before = text;
    text = text.replace(rx, '');
    if (text !== before) fixCount++;
  }

  // 14. HEDGING PHRASE REMOVAL
  const hedgeRx = [
    /\bIt could be argued that\s/gi,
    /\bOne (might|could|may) (suggest|argue|say|think) that\s/gi,
    /\bPerhaps (it is|it's) (the case|true|fair to say) that\s/gi,
  ];
  for (const rx of hedgeRx) {
    const before = text;
    text = text.replace(rx, '');
    if (text !== before) fixCount++;
  }

  // 15. RECAP BLOAT REMOVAL
  const recapRx = [
    /\bAs (we'?ve?|I'?ve?) (discussed|seen|explored|examined|noted|mentioned|established)[^.!?\n]*[.!?\n]/gi,
    /\bTo (summarize|recap|sum up|review) (what we'?ve?|the above|our discussion)[^.!?\n]*[.!?\n]/gi,
  ];
  for (const rx of recapRx) {
    const before = text;
    text = text.replace(rx, '');
    if (text !== before) fixCount++;
  }

  // 16. GENERIC CONCLUSION REMOVAL
  const conclusionRx = [
    /\bThe (story|tale|saga|history|legacy) of .{5,60} (reminds|teaches|shows|tells|demonstrates) us that[^.!?\n]*[.!?\n]/gi,
    /\bOnly time (will|would|could) tell[^.!?\n]*[.!?\n]/gi,
    /\bThe rest,? as they say,? is history[^.!?\n]*[.!?\n]/gi,
    /\bAnd (so|thus),? the (stage was set|seeds were sown|wheels were set in motion)[^.!?\n]*[.!?\n]/gi,
  ];
  for (const rx of conclusionRx) {
    const before = text;
    text = text.replace(rx, '');
    if (text !== before) fixCount++;
  }

  // 17. FICTION CLICHE REMOVAL
  const clicheRx = [
    /\bLittle did (he|she|they) know[^.!?\n]*[.!?\n]/gi,
    /\bUnbeknownst to[^.!?\n]*[.!?\n]/gi,
    /\bTime (seemed to|appeared to) (slow|stop|stand still|freeze)[^.!?\n]*[.!?\n]/gi,
  ];
  for (const rx of clicheRx) {
    const before = text;
    text = text.replace(rx, '');
    if (text !== before) fixCount++;
  }

  // Final cleanup — collapse triple+ newlines
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return { text, fixed: fixCount };
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

// Lightweight loader: only fetch the target chapter + spec (not all 20 chapters)
async function loadLightContext(base44, projectId, chapterId) {
  // Phase 1: fetch only the essentials — chapter + spec
  const [chapters, specs] = await Promise.all([
    withRetry(() => base44.entities.Chapter.filter({ id: chapterId })),
    withRetry(() => base44.entities.Specification.filter({ project_id: projectId })),
  ]);

  const chapter = chapters[0];
  if (!chapter) throw new Error('Chapter not found: ' + chapterId);

  const rawSpec = specs[0];
  const spec = rawSpec ? { ...rawSpec, beat_style: rawSpec.beat_style || rawSpec.tone_style || "", spice_level: Math.max(0, Math.min(4, parseInt(rawSpec.spice_level) || 0)), language_intensity: Math.max(0, Math.min(4, parseInt(rawSpec.language_intensity) || 0)) } : null;
  const isNonfiction = spec?.book_type === 'nonfiction';

  // Phase 2: fetch supplementary data in parallel (project, outline, prev chapter)
  const fetchProject = withRetry(() => base44.entities.Project.filter({ id: projectId })).catch(() => []);
  const fetchOutline = withRetry(() => base44.entities.Outline.filter({ project_id: projectId })).catch(() => []);
  const fetchPrev = chapter.chapter_number > 1
    ? withRetry(() => base44.entities.Chapter.filter({ project_id: projectId, chapter_number: chapter.chapter_number - 1 })).catch(() => [])
    : Promise.resolve([]);

  const [projects, outlines, prevChapters] = await Promise.all([fetchProject, fetchOutline, fetchPrev]);

  const project = projects[0] || {};
  const outline = outlines[0];
  const previousChapter = prevChapters[0] || null;

  // Parse banned phrases (lightweight — just JSON parse)
  let bannedPhrases = [];
  if (project.banned_phrases_log) {
    let bpRaw = project.banned_phrases_log;
    if (typeof bpRaw === 'string' && bpRaw.startsWith('http')) { try { bpRaw = await (await fetch(bpRaw)).text(); } catch { bpRaw = '[]'; } }
    try { bannedPhrases = JSON.parse(bpRaw); } catch {}
  }

  // Parse story bible
  let storyBible = null;
  if (outline) {
    let bibleRaw = outline.story_bible || '';
    if (!bibleRaw && outline.story_bible_url) { try { bibleRaw = await (await fetch(outline.story_bible_url)).text(); } catch {} }
    if (bibleRaw) { try { storyBible = JSON.parse(bibleRaw); } catch {} }
  }

  // Parse name registry
  let nameRegistry = {};
  if (project.name_registry) {
    let nrRaw = project.name_registry;
    if (typeof nrRaw === 'string' && nrRaw.startsWith('http')) { try { nrRaw = await (await fetch(nrRaw)).text(); } catch { nrRaw = '{}'; } }
    try { nameRegistry = JSON.parse(nrRaw); } catch {}
  }

  return { chapter, spec, project, isNonfiction, bannedPhrases, storyBible, nameRegistry, previousChapter };
}

async function runStyleEnforcer(base44, projectId, chapterId, prose, continuityFixes, frontendFindings) {
  const startMs = Date.now();
  const ctx = await loadLightContext(base44, projectId, chapterId);
  const { chapter, spec, isNonfiction, bannedPhrases, storyBible, nameRegistry, previousChapter } = ctx;

  let text = prose || await resolveContent(chapter.content);
  if (!text || text.length < 100) throw new Error('No prose to enforce');

  // Apply high-confidence continuity fixes first
  text = applyContinuityFixes(text, continuityFixes);

  // Detect erotica for genre-specific scans
  const isErotica = /erotica|erotic|romance|bdsm/.test(((spec?.genre || '') + ' ' + (spec?.subgenre || '')).toLowerCase()) || (parseInt(spec?.spice_level) || 0) >= 3;

  // Build minimal previousChapters array for scanDynamicCaps
  const prevChaptersForScan = previousChapter && previousChapter.content && previousChapter.status === 'generated'
    ? [previousChapter] : [];

  // Collect all violations
  const allViolations = [
    ...scanInlineNotes(text),
    ...scanInstructionLeaks(text),
    ...scanMetaResponse(text),
    ...scanCharacterNames(text, storyBible, nameRegistry),
    ...scanBannedPhrases(text),
    ...scanFrequencyCaps(text),
    ...scanDynamicCaps(text, prevChaptersForScan),
    ...scanSceneEndings(text),
    ...scanInteriorityRepetition(text, bannedPhrases),
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

  // Merge frontend findings (from Phase 4 scanner) so AI knows what the UI detected
  if (frontendFindings && Array.isArray(frontendFindings)) {
    for (const ff of frontendFindings) {
      // Avoid exact duplicates — only add if no backend violation has the same label
      const isDup = allViolations.some(v => v.label === ff.label);
      if (!isDup) {
        allViolations.push({
          type: ff.category || 'frontend_finding',
          label: ff.label || 'Frontend-detected issue',
          count: ff.count || 1,
          max: 0,
          fixed: false,
          severity: 'warning',
        });
      }
    }
  }

  // Word count enforcement — flag chapters exceeding 130% of target
  const wordCount = text.trim().split(/\s+/).length;
  const TARGET_WORDS = { short: 2000, medium: 3500, long: 6000, epic: 8500 };
  const targetWords = TARGET_WORDS[spec?.target_length || 'medium'] || 2500;
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

  // Code-level fixes only — no AI calls, executes in milliseconds
  const codeFixResult = applyCodeFixes(text);
  let cleanProse = codeFixResult.text;
  let fixedCount = codeFixResult.fixed;

  // Re-scan to report remaining violations
  const remaining = [
    ...scanBannedPhrases(cleanProse),
    ...scanFrequencyCaps(cleanProse),
    ...(isNonfiction ? scanGeminiNonfictionBans(cleanProse) : []),
    ...(isNonfiction ? scanGeminiEndingEnforcement(cleanProse) : []),
  ];

  // Build quality report
  const finalWordCount = cleanProse.trim().split(/\s+/).length;
  const qualityReport = {
    total_violations_found: allViolations.length,
    violations_fixed: fixedCount,
    violations_remaining: remaining.length,
    word_count: finalWordCount,
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

    const { project_id, chapter_id, prose, continuity_fixes, frontend_findings } = await req.json();
    if (!project_id || !chapter_id) return Response.json({ error: 'project_id and chapter_id required' }, { status: 400 });

    const result = await runStyleEnforcer(base44, project_id, chapter_id, prose, continuity_fixes, frontend_findings);

    // If prose was passed in the payload, this is an in-pipeline call from the orchestrator.
    // Return the clean prose directly so the next bot can use it. Don't save yet.
    const isPipelineCall = !!prose;

    if (!isPipelineCall && result.clean_prose) {
      // SAFETY GUARD: Never save content that is less than 80% of the original length.
      // This prevents wiping a chapter if the style enforcer returns truncated/empty text.
      const originalText = prose || await resolveContent((await base44.entities.Chapter.filter({ id: chapter_id }))[0]?.content);
      const originalLen = originalText ? originalText.length : 0;
      const newLen = result.clean_prose.length;
      if (originalLen > 0 && newLen < originalLen * 0.8) {
        console.error(`STYLE ENFORCER SAFETY GUARD: Refusing to save — new content (${newLen} chars) is less than 80% of original (${originalLen} chars). This would wipe the chapter.`);
        result.saved = false;
        result.safety_blocked = true;
        result.original_length = originalLen;
        result.new_length = newLen;
      } else {
        // Manual/standalone call — save corrected prose back to chapter
        try {
          // Always upload as file URL for large chapters to avoid field size limits
          const encoder = new TextEncoder();
          const bytes = encoder.encode(result.clean_prose);
          const blob = new Blob([bytes], { type: 'text/plain' });
          const file = new File([blob], `chapter_${chapter_id}_styled.txt`, { type: 'text/plain' });
          const uploadResult = await base44.integrations.Core.UploadFile({ file });
          const fileUrl = uploadResult?.file_url;
          if (fileUrl) {
            await base44.entities.Chapter.update(chapter_id, { content: fileUrl });
            result.saved = true;
            result.saved_as_url = true;
          } else {
            console.warn('Upload returned no file_url:', JSON.stringify(uploadResult));
            result.saved = false;
          }
        } catch (saveErr) {
          console.warn('Failed to save fixed prose:', saveErr.message);
          result.saved = false;
        }
      }
      // Don't return full prose in standalone mode — it's already saved to the DB
      delete result.clean_prose;
    }
    // In pipeline mode, clean_prose stays in the response for the orchestrator to use

    return Response.json(result);
  } catch (error) {
    console.error('styleEnforcer error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});