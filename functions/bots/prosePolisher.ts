// ═══════════════════════════════════════════════════════════════════════════════
// BOT 8 — PROSE POLISHER
// ═══════════════════════════════════════════════════════════════════════════════
// Runs AFTER styleEnforcer, BEFORE stateChronicler.
// Detects and rewrites AI-generated prose tells: mechanical transitions,
// placeholder scaffolding, hedging fog, recap bloat, list-as-prose, and
// generic conclusions. Applies to ALL genres.
// ═══════════════════════════════════════════════════════════════════════════════

import { callAI, isRefusal } from '../shared/aiRouter.ts';
import { resolveModel } from '../shared/resolveModel.ts';

// ═══ PHASE 1: REGEX SCAN — flag AI tells without AI cost ═══

// Transition crutches — mechanical connectors that signal "AI wrote this"
const TRANSITION_CRUTCHES = [
  [/\bFurthermore\b/g, '"Furthermore"'],
  [/\bMoreover\b/g, '"Moreover"'],
  [/\bIn addition\b/gi, '"In addition"'],
  [/\bAdditionally\b/g, '"Additionally"'],
  [/\bIt'?s worth noting that\b/gi, '"It\'s worth noting that"'],
  [/\bIt is worth noting that\b/gi, '"It is worth noting that"'],
  [/\bIt is important to (note|remember|understand|recognize) that\b/gi, '"It is important to [verb] that"'],
  [/\bAs (we will|we shall|we have) see(n)?\b/gi, '"As we will/have seen"'],
  [/\bAs (mentioned|discussed|noted|stated) (earlier|above|previously|before)\b/gi, '"As mentioned earlier"'],
  [/\bWith that (said|in mind)\b/gi, '"With that said/in mind"'],
  [/\bHaving (said|established|explored) (that|this)\b/gi, '"Having said/established that"'],
  [/\bThis (brings|leads|takes) us to\b/gi, '"This brings/leads us to"'],
  [/\bLet us (now )?turn (our attention )?to\b/gi, '"Let us turn to"'],
  [/\bNow,? let'?s (turn|shift|move) (our (attention|focus) )?(to|toward)\b/gi, '"Now let\'s turn to"'],
  [/\bWith this (understanding|context|background|foundation),?\b/gi, '"With this understanding/context"'],
];

// Placeholder scaffolding — the writer announcing what they're about to write
const SCAFFOLDING = [
  [/\bThis (chapter|section|part) (will )?(explore|examine|discuss|investigate|look at|delve into|unpack)\b/gi, 'Chapter/section self-reference'],
  [/\bIn this (chapter|section|part),? we (will|shall|are going to)\b/gi, '"In this chapter, we will..."'],
  [/\bThe (purpose|goal|aim) of this (chapter|section) is to\b/gi, '"The purpose of this chapter is..."'],
  [/\bBefore (we|I) (begin|dive in|proceed|explore|examine)\b/gi, '"Before we begin..."'],
  [/\bLet'?s (begin|start|dive in|explore|examine|unpack|take a (look|closer look))\b/gi, '"Let\'s begin/explore..."'],
  [/\bTo (understand|appreciate|grasp) (this|the|why),? (we )?(must|need to|should) (first )?\b/gi, '"To understand this, we must..."'],
  [/\bWhat (follows|comes next) is\b/gi, '"What follows is..."'],
];

// Hedging fog — AI refusing to commit to a claim
const HEDGING = [
  [/\bIt could be argued that\b/gi, '"It could be argued that"'],
  [/\bOne (might|could|may) (suggest|argue|say|think|wonder|contend) that\b/gi, '"One might suggest that"'],
  [/\bPerhaps (it is|it's) (the case|true|fair to say) that\b/gi, '"Perhaps it is the case that"'],
  [/\bIt (is|would be) (difficult|hard|impossible) to (overstate|overestimate|ignore|deny)\b/gi, '"It is difficult to overstate"'],
  [/\bWhile (it is|it's) (true|certainly true|undeniable) that\b/gi, '"While it is true that"'],
  [/\bTo be (sure|fair|certain)\b/gi, '"To be sure/fair"'],
  [/\bIt (remains|is) (to be seen|an open question|unclear|debatable)\b/gi, '"It remains to be seen"'],
  [/\bThere (is|are) (no doubt|little doubt|some who argue|those who believe)\b/gi, '"There is no doubt"'],
];

// Recap/summary bloat — restating what was just said
const RECAP_BLOAT = [
  [/\bAs (we'?ve?|I'?ve?) (discussed|seen|explored|examined|noted|mentioned|established)\b/gi, '"As we\'ve discussed"'],
  [/\bTo (summarize|recap|sum up|review) (what we'?ve?|the above|our discussion)\b/gi, '"To summarize what we\'ve..."'],
  [/\bIn (summary|conclusion|closing|short)\b/gi, '"In summary/conclusion"'],
  [/\bAll (of this|in all)\b/gi, '"All of this/All in all"'],
  [/\bThe (bottom line|key takeaway|main point|central argument) (is|here is) (that|this)\b/gi, '"The bottom line is"'],
  [/\bUltimately\b/g, '"Ultimately"'],
];

// List-as-prose — numbered sequences disguised as paragraphs
const LIST_AS_PROSE = [
  [/\bFirst(ly)?,?\s.{20,120}\bSecond(ly)?,?\s.{20,120}\bThird(ly)?,?\b/gs, 'First/Second/Third sequence'],
  [/\bOn (the )?one hand\b.{10,200}\bOn the other hand\b/gs, '"On one hand... on the other hand"'],
];

// Generic conclusions — every chapter ending sounds the same
const GENERIC_CONCLUSIONS = [
  [/\bThe (story|tale|saga|history|legacy) of .{5,60} (reminds|teaches|shows|tells|demonstrates) us that\b/gi, '"The story of X reminds us that"'],
  [/\b(This|These) (event|moment|episode|incident|development)s? (would|will|shall) (prove|turn out) to be\b/gi, '"This would prove to be"'],
  [/\bThe (lessons|implications|consequences|ramifications|reverberations) (of this|would|continue to|still)\b/gi, '"The lessons of this..."'],
  [/\bOnly time (will|would|could) tell\b/gi, '"Only time will tell"'],
  [/\bThe rest,? as they say,? is history\b/gi, '"The rest is history"'],
  [/\bAnd (so|thus),? the (stage was set|seeds were sown|wheels were set in motion|die was cast)\b/gi, '"And so the stage was set"'],
];

// Fiction-specific tells
const FICTION_TELLS = [
  [/\bLittle did (he|she|they) know\b/gi, '"Little did he/she know"'],
  [/\bIf only (he|she|they) had known\b/gi, '"If only they had known"'],
  [/\bUnbeknownst to\b/gi, '"Unbeknownst to"'],
  [/\b(He|She|They) couldn'?t (help but|possibly have) (know|imagine|realize|fathom)\b/gi, '"He/she couldn\'t help but"'],
  [/\bA (chill|shiver) (ran|crept|went|traveled) (down|up) (his|her|their) spine\b/gi, '"A chill ran down their spine"'],
  [/\b(He|She|They) let out a breath (he|she|they) didn'?t (know|realize) (he|she|they) (had been |was |were )?holding\b/gi, '"breath they didn\'t know they were holding"'],
  [/\bTime (seemed to|appeared to) (slow|stop|stand still|freeze)\b/gi, '"Time seemed to slow"'],
  [/\bThe (room|world|air) (seemed to|appeared to) (shift|tilt|spin|contract|close in)\b/gi, '"The room seemed to shift"'],
  [/\bA (single|lone) tear (rolled|slid|traced|tracked) down\b/gi, '"A single tear rolled down"'],
  [/\bDarkness (claimed|consumed|swallowed|took) (him|her|them)\b/gi, '"Darkness claimed him/her"'],
];

function runRegexScan(text, isNonfiction) {
  const violations = [];

  const scanGroup = (patterns, category) => {
    for (const [rx, label] of patterns) {
      const matches = text.match(rx);
      if (matches && matches.length > 0) {
        violations.push({
          category,
          label,
          count: matches.length,
          samples: matches.slice(0, 3).map(m => m.slice(0, 80)),
        });
      }
    }
  };

  // Universal scans (all genres)
  scanGroup(TRANSITION_CRUTCHES, 'transition_crutch');
  scanGroup(SCAFFOLDING, 'scaffolding');
  scanGroup(HEDGING, 'hedging');
  scanGroup(RECAP_BLOAT, 'recap_bloat');
  scanGroup(LIST_AS_PROSE, 'list_as_prose');
  scanGroup(GENERIC_CONCLUSIONS, 'generic_conclusion');

  // Fiction-specific
  if (!isNonfiction) {
    scanGroup(FICTION_TELLS, 'fiction_cliche');
  }

  return violations;
}

// ═══ PHASE 2: AI REWRITE — targeted fixes for flagged sections ═══

const POLISH_SYSTEM = `You are a professional prose editor specializing in making AI-generated text sound authentically human. You will receive chapter text with flagged problem areas. Your job is to REWRITE the flagged sections while preserving all factual content, narrative structure, and voice.

RULES:
1. ONLY rewrite the specific sentences or paragraphs that contain the flagged patterns. Do NOT rewrite clean prose.
2. Preserve the author's intended voice, tone, and register. If the prose is formal, stay formal. If casual, stay casual.
3. Preserve ALL factual claims, character actions, plot events, and dialogue. Change HOW it's said, not WHAT is said.
4. Your fixes should be invisible — a reader should not be able to tell which parts you touched.

SPECIFIC FIXES:
- TRANSITION CRUTCHES: Replace mechanical connectors ("Furthermore," "Moreover," "In addition") with organic transitions that arise from the content itself. Sometimes the best fix is simply deleting the transition and letting the paragraph flow naturally from the previous one. Vary your approach: use a callback to the previous idea, a contrasting observation, a question, or just cut the connector entirely.

- SCAFFOLDING: Delete any sentence where the writer announces what they're about to write. "This chapter explores..." → just start exploring. "Let us now turn to..." → just turn to it. The content speaks for itself.

- HEDGING: Commit to the claim or cut it. "It could be argued that X" → "X." If genuine uncertainty exists, express it specifically: "The evidence for X is contested" not "One might suggest that X."

- RECAP BLOAT: Delete any paragraph that merely restates what was said in the previous 2-3 paragraphs. If a brief recap is needed for structural reasons, compress it to a single clause within a forward-moving sentence.

- LIST-AS-PROSE: Restructure First/Second/Third sequences into flowing paragraphs with varied sentence structure. The points should feel like a natural argument building, not a numbered checklist.

- GENERIC CONCLUSIONS: Replace formulaic endings ("The story of X reminds us that...") with specific, surprising final images or observations that arise organically from the chapter's content. The last paragraph should feel earned, not templated.

- FICTION CLICHES: Replace stock phrases ("a chill ran down his spine," "breath they didn't know they were holding," "darkness claimed them") with specific, character-grounded sensory details unique to this scene.

OUTPUT: Return the COMPLETE chapter text with your fixes applied. Do NOT add any commentary, notes, or markup. Just the clean, polished prose.`;

async function runAIPolish(text, violations, isNonfiction) {
  if (violations.length === 0) return { polished: text, changed: false };

  const violationBrief = violations.map(v =>
    `[${v.category}] "${v.label}" — found ${v.count}x. Samples: ${v.samples.join(' | ')}`
  ).join('\n');

  const userMessage = `FLAGGED VIOLATIONS:\n${violationBrief}\n\n────────────────────\n\nCHAPTER TEXT TO POLISH:\n${text}`;

  const modelKey = 'claude-sonnet';
  const result = await callAI(modelKey, POLISH_SYSTEM, userMessage, {
    maxTokens: 8192,
    temperature: 0.5,
  });

  if (isRefusal(result)) {
    console.warn('Polish AI refused — returning original text');
    return { polished: text, changed: false };
  }

  // Basic validation: polished text should be within 15% of original length
  const originalLen = text.length;
  const polishedLen = result.length;
  if (polishedLen < originalLen * 0.7 || polishedLen > originalLen * 1.15) {
    console.warn(`Polish output length suspicious: ${polishedLen} vs original ${originalLen} — returning original`);
    return { polished: text, changed: false, rejected: 'length_mismatch' };
  }

  return { polished: result, changed: true };
}

// ═══ MAIN EXPORT ═══

export async function runProsePolisher(text, isNonfiction) {
  const startMs = Date.now();

  // Phase 1: regex scan
  const violations = runRegexScan(text, isNonfiction);

  if (violations.length === 0) {
    return {
      success: true,
      polished: text,
      changed: false,
      violations_found: 0,
      duration_ms: Date.now() - startMs,
    };
  }

  // Phase 2: AI rewrite
  const { polished, changed, rejected } = await runAIPolish(text, violations, isNonfiction);

  return {
    success: true,
    polished,
    changed,
    rejected: rejected || null,
    violations_found: violations.length,
    violations,
    total_instances: violations.reduce((sum, v) => sum + v.count, 0),
    duration_ms: Date.now() - startMs,
  };
}
