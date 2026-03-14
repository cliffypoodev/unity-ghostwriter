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
  const allViolations = [
    ...scanMetaResponse(text),
    ...scanBannedPhrases(text),
    ...scanFrequencyCaps(text),
    ...scanDynamicCaps(text, chCtx.previousChapters),
    ...scanSceneEndings(text),
    ...(ctx.isNonfiction ? scanNonfictionPatterns(text) : []),
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
