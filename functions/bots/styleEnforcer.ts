// ═══════════════════════════════════════════════════════════════════════════════
// BOT 4 — STYLE ENFORCER
// ═══════════════════════════════════════════════════════════════════════════════
// One job: Take prose that passed continuity. Fix every style violation in-place.
// Return clean prose. ONE AI call for fixes, not a multi-attempt retry loop.
//
// Replaces: enforceProseCompliance(), scanChapterQuality(), scanNonfictionQuality(),
// enforceNonfictionEnding(), verifyGeminiProse(), the compliance retry loop,
// the volume verification loop, and all model-specific enforcement blocks.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { callAI, isRefusal } from '../shared/aiRouter.ts';
import { resolveModel } from '../shared/resolveModel.ts';
import { loadProjectContext, getChapterContext, resolveContent } from '../shared/dataLoader.ts';

// ── BANNED CONSTRUCTIONS ────────────────────────────────────────────────────

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

// ── NONFICTION-SPECIFIC BANS ────────────────────────────────────────────────

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

// ── SCAN FUNCTIONS ──────────────────────────────────────────────────────────

function scanBannedPhrases(text) {
  const violations = [];
  for (const b of ABSOLUTE_BANS) {
    const m = text.match(b.p);
    if (m) violations.push({ type: 'banned_phrase', label: b.l, count: m.length, max: 0, fixed: false });
  }
  return violations;
}

function scanFrequencyCaps(text) {
  const violations = [];
  for (const [rx, label, max] of FREQUENCY_CAPS) {
    const m = text.match(rx);
    const count = m ? m.length : 0;
    if (count > max) violations.push({ type: 'frequency_cap', label, count, max, fixed: false });
  }
  return violations;
}

function scanDynamicCaps(text, previousChapters) {
  const violations = [];
  if (previousChapters.length === 0) return violations;

  const last = previousChapters[previousChapters.length - 1];
  let prevText = last.content || '';
  if (prevText.startsWith('http')) return violations; // Can't analyze URL content synchronously

  const SW = new Set(['the','and','was','had','his','her','they','their','that','with','from','into','have','been','were','what','this','which','when','would','could','should','said','just','like','some','then','than','but','not','for','are','him','she','you','all','its','one','out','can','did','who','how','has','more','also','will','about']);
  const ws = prevText.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const fq = {};
  for (const w of ws) { if (!SW.has(w)) fq[w] = (fq[w] || 0) + 1; }
  const top3 = Object.entries(fq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w);

  for (const w of top3) {
    const count = (text.match(new RegExp(`\\b${w}\\b`, 'gi')) || []).length;
    if (count > 2) violations.push({ type: 'dynamic_cap', label: `"${w}" (prev ch top word)`, count, max: 2, fixed: false });
  }
  return violations;
}

function scanSceneEndings(text) {
  const violations = [];
  const scenes = text.split(/\*\s*\*\s*\*/);
  for (let idx = 0; idx < scenes.length; idx++) {
    const sents = scenes[idx].trim().split(/(?<=[.!?])\s+/);
    const lastTwo = sents.slice(-2).join(' ');
    if (EMOTIONAL_ENDING_PATTERNS.some(p => p.test(lastTwo))) {
      violations.push({ type: 'weak_ending', label: lastTwo.slice(0, 80), count: 1, max: 0, fixed: false });
    }
  }
  return violations;
}

function scanNonfictionPatterns(text) {
  const warnings = [];
  for (const { rx, label } of NF_BANS) {
    const m = text.match(rx);
    if (m) warnings.push({ type: 'nf_fiction_trap', label: `${label}: "${m[0]}"`, count: m.length, max: 0, fixed: false });
  }

  // Check dialogue ratio
  const dialogueChunks = text.match(/[""\u201C]([^""\u201D]{5,})[""\u201D]|'([^']{5,})'/g) || [];
  const totalDialogueWords = dialogueChunks.reduce((s, c) => s + c.split(/\s+/).length, 0);
  const totalWords = text.split(/\s+/).length;
  if (totalWords > 0 && totalDialogueWords / totalWords > 0.20) {
    warnings.push({ type: 'nf_fiction_trap', label: `${Math.round(totalDialogueWords / totalWords * 100)}% dialogue (max 20%)`, count: 1, max: 0, fixed: false });
  }

  // Check nonfiction ending
  const paras = text.trim().split(/\n\n+/);
  const lastPara = paras[paras.length - 1] || '';
  if (NF_ENDING_BANS.some(p => p.test(lastPara))) {
    warnings.push({ type: 'nf_thesis_ending', label: 'Final paragraph restates thesis', count: 1, max: 0, fixed: false });
  }

  return warnings;
}

function scanMetaResponse(text) {
  const first500 = text.slice(0, 500);
  const META = [/^I appreciate you/i, /^I need to clarify/i, /^Here is/i, /^Here are/i, /^As requested/i, /^I'll write/i, /[✓✗☐☑]/];
  if (META.some(p => p.test(first500))) {
    return [{ type: 'meta_response', label: 'AI meta-response instead of prose', count: 1, max: 0, fixed: false }];
  }
  return [];
}

// ── EROTICA SENSATION SPECIFICITY SCANNER ───────────────────────────────────

function scanEroticaSensations(text) {
  const violations = [];
  const VAGUE_SENSATIONS = [
    [/\belectricity\b/gi, '"electricity" for touch', 1],
    [/\belectric\b/gi, '"electric" for touch', 1],
    [/\bjolt of \w+/gi, '"jolt of [noun]"', 2],
    [/\bsurge of \w+/gi, '"surge of [noun]"', 2],
    [/\bspike of \w+/gi, '"spike of [noun]"', 2],
    [/\bwave of (pleasure|sensation|desire|heat|arousal)/gi, '"wave of [sensation]"', 0],
    [/\bpure,?\s*undiluted\b/gi, '"pure undiluted"', 0],
    [/that stole (his|her|their) breath/gi, '"stole breath"', 1],
    [/\bprofound\b.{0,15}\b(sensation|pleasure|coolness|warmth|ache|desire)/gi, '"profound [sensation]"', 0],
    [/\bdevastating\b.{0,15}\b(sensation|pleasure|spike|arousal|desire)/gi, '"devastating [sensation]"', 1],
    [/\bcoolness that burn/gi, '"coolness that burned" paradox', 1],
    [/\bcircuit complet/gi, '"circuit completing" metaphor', 1],
    [/\blive wire\b/gi, '"live wire" metaphor', 1],
  ];
  for (const [rx, label, max] of VAGUE_SENSATIONS) {
    const m = text.match(rx);
    if (m && m.length > max) {
      violations.push({ type: 'vague_sensation', label, count: m.length, max, fixed: false });
    }
  }
  return violations;
}

// ── INTERIORITY REPETITION SCANNER (cross-chapter) ──────────────────────────

function scanInteriorityRepetition(text) {
  const violations = [];
  const INTERIORITY_CAPS = [
    [/\bhollow\b/gi, '"hollow"', 2],
    [/\bhollow place\b/gi, '"hollow place"', 1],
    [/\bunlovable\b/gi, '"unlovable"', 1],
    [/\bcore wound\b/gi, '"core wound"', 1],
    [/\bold wound\b/gi, '"old wound"', 1],
    [/\binsufficient\b/gi, '"insufficient"', 1],
    [/\bincapable\b/gi, '"incapable"', 1],
    [/\bscraped raw\b/gi, '"scraped raw"', 1],
    [/\blaid bare\b/gi, '"laid bare"', 1],
    [/smelled? like failure/gi, '"smelled like failure"', 0],
    [/\bhollowness\b/gi, '"hollowness"', 1],
  ];
  for (const [rx, label, max] of INTERIORITY_CAPS) {
    const m = text.match(rx);
    if (m && m.length > max) {
      violations.push({ type: 'interiority_repetition', label, count: m.length, max, fixed: false });
    }
  }
  return violations;
}

// ── DIALOGUE PATTERN DETECTOR ───────────────────────────────────────────────

function scanDialoguePatterns(text) {
  const violations = [];
  // Detect psychoanalytic monologue pattern: naming shame + binary choice
  const shameNaming = (text.match(/you (carry|are broken|are tired|feel the weight|build walls|are so very|crave|are empty|are hollow)/gi) || []).length;
  const binaryChoice = (text.match(/you can (run|return|go back|leave|walk away).{0,80}or.{0,80}you can (walk deeper|stay|learn|accept|yield|submit)/gi) || []).length;
  if (shameNaming > 3) {
    violations.push({ type: 'dialogue_pattern', label: 'Character psychoanalyzes protagonist >3 times', count: shameNaming, max: 3, fixed: false });
  }
  if (binaryChoice > 1) {
    violations.push({ type: 'dialogue_pattern', label: 'Binary choice speech pattern repeated', count: binaryChoice, max: 1, fixed: false });
  }
  return violations;
}

// ── INSTRUCTION LEAK DETECTOR ───────────────────────────────────────────────

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
  ];
  for (const rx of LEAK_PATTERNS) {
    const m = text.match(rx);
    if (m) {
      violations.push({ type: 'instruction_leak', label: `Bot instruction in prose: "${m[0].slice(0, 60)}"`, count: m.length, max: 0, fixed: false });
    }
  }
  return violations;
}

// ── POV DISTANCE CHECK ──────────────────────────────────────────────────────

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

// ── SCENT OPENER CHECK ──────────────────────────────────────────────────────

function scanScentOpener(text) {
  const violations = [];
  const firstSentence = text.trim().split(/[.!?]/)[0] || '';
  if (/\b(scent|smell|aroma|odor|fragrance|stench|whiff)\b/i.test(firstSentence)) {
    violations.push({ type: 'scent_opener', label: 'Chapter opens with scent description (overused pattern)', count: 1, max: 0, fixed: false });
  }
  return violations;
}

// ── GEMINI NONFICTION BAN SCANNER ───────────────────────────────────────────

function scanGeminiNonfictionPatterns(text) {
  const violations = [];
  const GEMINI_NF_CAPS = [
    [/\bwould prove\b/gi, '"would prove"', 1],
    [/\bwould manifest\b/gi, '"would manifest"', 1],
    [/\bwould haunt\b/gi, '"would haunt"', 1],
    [/\bwould become\b/gi, '"would become"', 1],
    [/\brepresented\b/gi, '"represented" as main verb', 4],
    [/\bdemonstrated\b/gi, '"demonstrated" as main verb', 4],
    [/\billustrated\b/gi, '"illustrated" as main verb', 2],
    [/\bexemplified\b/gi, '"exemplified" as main verb', 2],
    [/conditions where .{1,30} could (flourish|thrive)/gi, '"conditions where X could flourish"', 0],
    [/leaving behind a trail of/gi, '"leaving behind a trail of"', 0],
    [/the human cost of/gi, '"the human cost of"', 1],
    [/for (generations|decades) to come/gi, '"for generations/decades to come"', 0],
    [/nightmare machine/gi, '"nightmare machine"', 0],
    [/dream factory/gi, '"dream factory"', 1],
    [/\bThis (dynamic|atmosphere|system|arrangement|exploitation) (created|produced|generated)/gi, '"This [noun] created..."', 2],
  ];
  for (const [rx, label, max] of GEMINI_NF_CAPS) {
    const m = text.match(rx);
    if (m && m.length > max) {
      violations.push({ type: 'gemini_nf_ban', label, count: m.length, max, fixed: false });
    }
  }

  // Check for Gemini's thesis-restatement ending patterns
  const lastParas = text.trim().split(/\n\n+/).slice(-2).join('\n\n');
  const ENDING_BANS = [/\blegacy\b/i, /\bgenerations\b/i, /\breverberate\b/i, /\billuminate\b/i, /\bdark reality\b/i, /\bglamorous facade\b/i, /the system that had been designed to/i, /\bhaunt\b/i];
  const endingHits = ENDING_BANS.filter(p => p.test(lastParas)).length;
  if (endingHits >= 2) {
    violations.push({ type: 'gemini_nf_ending', label: `Final paragraphs contain ${endingHits} thesis-restatement markers`, count: endingHits, max: 1, fixed: false });
  }

  // Check for invented specific details (fiction trap)
  const inventedDetails = (text.match(/\bat \d{1,2}:\d{2}\s*(AM|PM|am|pm)\b/g) || []).length;
  if (inventedDetails > 0) {
    violations.push({ type: 'nf_fiction_trap_critical', label: `Specific invented time(s) in nonfiction (${inventedDetails}x)`, count: inventedDetails, max: 0, fixed: false });
  }
  const inventedDialogue = (text.match(/"[^"]{20,}"/g) || []).length;
  if (inventedDialogue > 5) {
    violations.push({ type: 'nf_fiction_trap_critical', label: `${inventedDialogue} dialogue lines in nonfiction (max 5)`, count: inventedDialogue, max: 5, fixed: false });
  }

  return violations;
}

// ── AI-POWERED FIX PASS ─────────────────────────────────────────────────────

async function applyAIFixes(prose, violations, spec, isNonfiction) {
  if (violations.length === 0) return { text: prose, fixed: 0 };

  const modelKey = resolveModel('style_rewrite', spec);
  const violationBrief = violations.map(v => {
    if (v.type === 'banned_phrase') return `BANNED: "${v.label}" appears ${v.count}x. Rewrite using direct physical description.`;
    if (v.type === 'frequency_cap') return `OVERUSED: "${v.label}" appears ${v.count}x (max ${v.max}). Replace excess with different sensory angles.`;
    if (v.type === 'dynamic_cap') return `PREV-CHAPTER REPEAT: ${v.label} (${v.count}x, max 2).`;
    if (v.type === 'weak_ending') return `SCENE ENDING: "${v.label}" — rewrite final 2 sentences as concrete image, action, or dialogue.`;
    if (v.type === 'nf_thesis_ending') return `NF ENDING: Final paragraph restates thesis. Replace with specific documented detail or unresolved question.`;
    if (v.type === 'nf_fiction_trap') return `NF PATTERN: ${v.label}. Replace with author analysis or research citation.`;
    if (v.type === 'meta_response') return `META: Output starts with AI assistant language. Remove all meta-commentary.`;
    if (v.type === 'vague_sensation') return `VAGUE SENSATION: ${v.label} appears ${v.count}x (max ${v.max}). Replace with specific body location + physical descriptor. BAD: "electricity shot through him." GOOD: "the drag of cool scales across his inner thigh made his hips jerk."`;
    if (v.type === 'interiority_repetition') return `INTERIORITY REPETITION: ${v.label} appears ${v.count}x (max ${v.max}). Replace repeated emotional vocabulary with NEW dimensions of the character's psychology — a different fear, desire, memory, or contradiction.`;
    if (v.type === 'dialogue_pattern') return `DIALOGUE PATTERN: ${v.label}. This character needs different conversational modes — mundane exchanges, genuine questions, uncertainty, humor — not just psychoanalytic monologues.`;
    if (v.type === 'gemini_nf_ban') return `GEMINI NF BAN: ${v.label} appears ${v.count}x (max ${v.max}). Rewrite using direct, specific language. Replace hedging ("would prove") with declarative statements. Replace abstract verbs ("represented") with concrete action.`;
    if (v.type === 'gemini_nf_ending') return `GEMINI NF ENDING: ${v.label}. Final paragraph must end on a specific documented detail, concrete image, or unresolved question — NOT a thesis restatement about legacy, generations, or dark reality behind facades.`;
    if (v.type === 'nf_fiction_trap_critical') return `FICTION TRAP CRITICAL: ${v.label}. This is nonfiction. Remove invented specific times, invented dialogue, and unnamed composite characters acting in specific scenes. Replace with sourced material or flag with [VERIFY].`;
    return `${v.type}: ${v.label}`;
  }).join('\n\n');

  const systemPrompt = `You are a prose editor. Fix the specific violations listed below. Do NOT rewrite the entire chapter — only fix the violated passages. Preserve everything else exactly as written. Return the complete corrected chapter.

${isNonfiction ? 'This is NONFICTION. No fictional scenes or invented dialogue.' : ''}`;

  const userMessage = `VIOLATIONS TO FIX:\n\n${violationBrief}\n\nCHAPTER TO CORRECT:\n\n${prose}`;

  try {
    const fixed = await callAI(modelKey, systemPrompt, userMessage, { maxTokens: 8192, temperature: 0.3 });
    if (fixed && fixed.trim().length > prose.length * 0.5 && !isRefusal(fixed)) {
      // Clean up common AI artifacts
      let cleaned = fixed
        .replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '')
        .replace(/^#{1,4}\s*(SCENE|Scene)\s*\d+[:\-—]?\s*[^\n]*/gm, '')
        .replace(/^#{1,4}\s*CHAPTER\s*\d+[:\-—]?\s*[^\n]*/gmi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return { text: cleaned, fixed: violations.length };
    }
  } catch (err) {
    console.warn('AI fix pass failed:', err.message);
  }
  return { text: prose, fixed: 0 };
}

/** Fix nonfiction ending specifically if it has thesis restatement. */
async function fixNonfictionEnding(text, spec) {
  const paras = text.trim().split(/\n\n+/);
  if (paras.length < 2) return text;
  const lastPara = paras[paras.length - 1] || '';
  if (!NF_ENDING_BANS.some(p => p.test(lastPara))) return text;

  const modelKey = resolveModel('consistency_check', spec);
  try {
    const fix = await callAI(modelKey,
      'You are a nonfiction editor. Rewrite the final 2-3 sentences ONLY. End on specific documented detail, concrete image, or unresolved question. No thesis, no morals, no verse.',
      `CURRENT ENDING (VIOLATING):\n${lastPara}\n\nReturn only replacement sentences.`,
      { maxTokens: 512, temperature: 0.4 }
    );
    if (fix?.trim().length > 20 && !isRefusal(fix)) {
      paras[paras.length - 1] = fix.trim();
      return paras.join('\n\n');
    }
  } catch (e) { console.warn('NF ending fix failed:', e.message); }
  return text;
}

// ── MAIN BOT ────────────────────────────────────────────────────────────────

async function runStyleEnforcer(base44, projectId, chapterId, prose, continuityFixes) {
  const startMs = Date.now();
  const ctx = await loadProjectContext(base44, projectId);
  const chCtx = getChapterContext(ctx, chapterId);
  let text = prose || await resolveContent(chCtx.chapter.content);

  // Apply continuity fixes first (simple text replacements)
  if (continuityFixes && continuityFixes.length > 0) {
    for (const fix of continuityFixes) {
      if (fix.original_text && fix.replacement_text && fix.confidence === 'high') {
        text = text.replace(fix.original_text, fix.replacement_text);
      }
    }
  }

  // ── Phase A: Scan for all violations ──
  const isErotica = /erotica|erotic|romance|bdsm/.test(((ctx.spec?.genre || '') + ' ' + (ctx.spec?.subgenre || '')).toLowerCase()) || (parseInt(ctx.spec?.spice_level) || 0) >= 3;

  const allViolations = [
    ...scanMetaResponse(text),
    ...scanInstructionLeaks(text),
    ...scanBannedPhrases(text),
    ...scanFrequencyCaps(text),
    ...scanDynamicCaps(text, chCtx.previousChapters),
    ...scanSceneEndings(text),
    ...scanInteriorityRepetition(text),
    ...scanDialoguePatterns(text),
    ...scanPovDistance(text),
    ...scanScentOpener(text),
    ...(isErotica ? scanEroticaSensations(text) : []),
    ...(ctx.isNonfiction ? scanNonfictionPatterns(text) : []),
    ...(ctx.isNonfiction ? scanGeminiNonfictionPatterns(text) : []),
  ];

  // ── Phase B: AI-powered targeted fixes (ONE call) ──
  const fixableViolations = allViolations.filter(v =>
    v.type !== 'meta_response' || allViolations.length > 1 // Don't fix meta-only — that needs full regen
  );

  let fixedCount = 0;
  if (fixableViolations.length > 0) {
    const result = await applyAIFixes(text, fixableViolations, ctx.spec, ctx.isNonfiction);
    text = result.text;
    fixedCount = result.fixed;
  }

  // ── Phase C: Nonfiction ending fix ──
  if (ctx.isNonfiction) {
    text = await fixNonfictionEnding(text, ctx.spec);
  }

  // ── Phase D: Final scan (read-only report) ──
  const remainingViolations = [
    ...scanBannedPhrases(text),
    ...scanFrequencyCaps(text),
    ...scanSceneEndings(text),
    ...(ctx.isNonfiction ? scanNonfictionPatterns(text) : []),
  ];
  remainingViolations.forEach(v => v.fixed = false);

  const wordCount = text.trim().split(/\s+/).length;

  return {
    clean_prose: text,
    word_count: wordCount,
    violations_found: allViolations.length,
    violations_fixed: fixedCount,
    violations_remaining: remainingViolations,
    quality_report: {
      passed: remainingViolations.filter(v => v.type === 'banned_phrase' || v.type === 'meta_response').length === 0,
      total_violations: allViolations.length,
      fixed_violations: fixedCount,
      remaining_violations: remainingViolations.length,
      word_count: wordCount,
    },
    chapter_id: chapterId,
    duration_ms: Date.now() - startMs,
  };
}

// ── DENO SERVE ENDPOINT ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, chapter_id, prose, continuity_fixes } = await req.json();
    if (!project_id || !chapter_id) {
      return Response.json({ error: 'project_id and chapter_id required' }, { status: 400 });
    }

    const result = await runStyleEnforcer(base44, project_id, chapter_id, prose, continuity_fixes);
    return Response.json(result);

  } catch (error) {
    console.error('styleEnforcer error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
