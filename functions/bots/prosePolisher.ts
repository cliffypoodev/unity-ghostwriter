// ═══════════════════════════════════════════════════════════════════════════════
// BOT 8 — PROSE POLISHER (ACTIVE DEPLOYED)
// ═══════════════════════════════════════════════════════════════════════════════
// Runs AFTER styleEnforcer, BEFORE stateChronicler.
// Detects and rewrites AI-generated prose tells: mechanical transitions,
// placeholder scaffolding, hedging fog, recap bloat, list-as-prose, generic
// conclusions, and fiction clichés. Applies to ALL genres.
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

// ═══ PHASE 1: REGEX SCAN — flag AI tells without AI cost ═══

// Transition crutches
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

// Placeholder scaffolding
const SCAFFOLDING = [
  [/\bThis (chapter|section|part) (will )?(explore|examine|discuss|investigate|look at|delve into|unpack)\b/gi, 'Chapter/section self-reference'],
  [/\bIn this (chapter|section|part),? we (will|shall|are going to)\b/gi, '"In this chapter, we will..."'],
  [/\bThe (purpose|goal|aim) of this (chapter|section) is to\b/gi, '"The purpose of this chapter is..."'],
  [/\bBefore (we|I) (begin|dive in|proceed|explore|examine)\b/gi, '"Before we begin..."'],
  [/\bLet'?s (begin|start|dive in|explore|examine|unpack|take a (look|closer look))\b/gi, '"Let\'s begin/explore..."'],
  [/\bTo (understand|appreciate|grasp) (this|the|why),? (we )?(must|need to|should) (first )?\b/gi, '"To understand this, we must..."'],
  [/\bWhat (follows|comes next) is\b/gi, '"What follows is..."'],
];

// Hedging fog
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

// Recap/summary bloat
const RECAP_BLOAT = [
  [/\bAs (we'?ve?|I'?ve?) (discussed|seen|explored|examined|noted|mentioned|established)\b/gi, '"As we\'ve discussed"'],
  [/\bTo (summarize|recap|sum up|review) (what we'?ve?|the above|our discussion)\b/gi, '"To summarize what we\'ve..."'],
  [/\bIn (summary|conclusion|closing|short)\b/gi, '"In summary/conclusion"'],
  [/\bAll (of this|in all)\b/gi, '"All of this/All in all"'],
  [/\bThe (bottom line|key takeaway|main point|central argument) (is|here is) (that|this)\b/gi, '"The bottom line is"'],
  [/\bUltimately\b/g, '"Ultimately"'],
];

// List-as-prose
const LIST_AS_PROSE = [
  [/\bFirst(ly)?,?\s.{20,120}\bSecond(ly)?,?\s.{20,120}\bThird(ly)?,?\b/gs, 'First/Second/Third sequence'],
  [/\bOn (the )?one hand\b.{10,200}\bOn the other hand\b/gs, '"On one hand... on the other hand"'],
];

// Generic conclusions
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

// Nonfiction-specific polish targets
const NF_POLISH_TARGETS = [
  // Instruction leaks — prose-safe patterns requiring editorial context (v12.9b)
  [/\bRemove specific \w+ or (cite|provide|anchor|source|use)/gi, 'INSTRUCTION LEAK: Remove specific X or cite...'],
  [/\bRemove (atmospheric|invented|fictional|fabricated) (reconstruction|detail|scene|quote)/gi, 'INSTRUCTION LEAK: Remove atmospheric/invented...'],
  [/\bEither (identify|cite|name|source|provide|use) (the |a )?(specific|actual|real|documentary|documented)/gi, 'INSTRUCTION LEAK: Either cite/provide specific...'],
  [/\bProvide (documentary|specific|archival|real) (source|evidence|documentation)/gi, 'INSTRUCTION LEAK: Provide documentary source...'],
  [/\bReplace with documented (examples?|case stud|evidence|facts)/gi, 'INSTRUCTION LEAK: Replace with documented...'],
  [/\bUse general (timeframe|terms?|reference|description|language)/gi, 'INSTRUCTION LEAK: Use general timeframe...'],
  [/\bUse documented (examples?|case stud|evidence|sources)/gi, 'INSTRUCTION LEAK: Use documented examples...'],
  [/\bLabel as (representative|illustrative|composite|general|reconstructed)/gi, 'INSTRUCTION LEAK: Label as composite...'],
  [/\bFrame as (hypothetical|composite|reconstructed|general|illustrative)/gi, 'INSTRUCTION LEAK: Frame as hypothetical...'],
  [/\bAnchor (to|these|this) (documented|real|specific|actual|verifiable)/gi, 'INSTRUCTION LEAK: Anchor to documented...'],
  [/\bSource (to|this to) (actual|specific|documented|real)/gi, 'INSTRUCTION LEAK: Source to actual...'],
  [/\bCite (specific|actual) (memoir|interview|archive|document|source|published)/gi, 'INSTRUCTION LEAK: Cite specific source...'],
  [/\bVerify and cite\b/gi, 'INSTRUCTION LEAK: Verify and cite...'],
  [/\bInsert documented\b/gi, 'INSTRUCTION LEAK: Insert documented...'],
  [/\bor (clearly |)label as[^.!?\n]*(representative|composite|illustrative|reconstructed|atmospheric|hypothetical)/gi, 'INSTRUCTION LEAK: or label as composite...'],
  [/\bor (remove|begin with|provide|cite|frame|preface).{1,40}(fictional|documented|general|representative|composite|atmospheric|reconstructed|hypothetical)/gi, 'INSTRUCTION LEAK: or remove/cite...'],
  [/\bContemporary accounts (describe|suggest) similar [^.!?\n]{5,}/gi, 'INSTRUCTION LEAK: meta-framing instruction'],
  [/\bUse '([^']+)' or [^.!?\n]{5,}/gi, 'INSTRUCTION LEAK: Use quoted example or...'],
  // No-comma fusion: instruction flows directly into prose
  [/\b(Remove specific|Use general|Either provide|Either cite|Either use) \w+(\s\w+)? or (cite|provide|use|anchor|source|reference) \w/gi, 'INSTRUCTION LEAK: fused instruction-prose'],
  // Padding phrases
  [/\bThe (impact|toll|cost|damage|consequences?) (was|were|proved|remained) (devastating|severe|profound|enormous|staggering|immeasurable)/gi, '"The impact was devastating" padding phrase'],
  [/\bThe (true|full|real|actual) (extent|scope|scale|magnitude|nature) of/gi, '"The true extent of..." padding opener'],
  [/\bThe (human|personal|psychological|emotional) (cost|toll|price|burden) (of this|cannot|should not|extends)/gi, '"The human cost of..." repetitive framing'],
  // Filler transitions
  [/\bThis (development|transformation|shift|change|evolution|arrangement|dynamic) (represented|constituted|marked|signaled|reflected)/gi, '"This development represented..." filler transition'],
];

function runRegexScan(text, isNonfiction) {
  const violations = [];
  const scanGroup = (patterns, category) => {
    for (const [rx, label] of patterns) {
      const matches = text.match(rx);
      if (matches && matches.length > 0) {
        violations.push({ category, label, count: matches.length, samples: matches.slice(0, 3).map(m => m.slice(0, 80)) });
      }
    }
  };
  scanGroup(TRANSITION_CRUTCHES, 'transition_crutch');
  scanGroup(SCAFFOLDING, 'scaffolding');
  scanGroup(HEDGING, 'hedging');
  scanGroup(RECAP_BLOAT, 'recap_bloat');
  scanGroup(LIST_AS_PROSE, 'list_as_prose');
  scanGroup(GENERIC_CONCLUSIONS, 'generic_conclusion');
  if (!isNonfiction) { scanGroup(FICTION_TELLS, 'fiction_cliche'); }
  if (isNonfiction) { scanGroup(NF_POLISH_TARGETS, 'nf_polish'); }
  return violations;
}

// ═══ PHASE 2: AI REWRITE ═══

const POLISH_SYSTEM = `You are a professional prose editor specializing in making AI-generated text sound authentically human. You will receive chapter text with flagged problem areas. Your job is to REWRITE the flagged sections while preserving all factual content, narrative structure, and voice.

RULES:
1. ONLY rewrite the specific sentences or paragraphs that contain the flagged patterns. Do NOT rewrite clean prose.
2. Preserve the author's intended voice, tone, and register. If the prose is formal, stay formal. If casual, stay casual.
3. Preserve ALL factual claims, character actions, plot events, and dialogue. Change HOW it's said, not WHAT is said.
4. Your fixes should be invisible — a reader should not be able to tell which parts you touched.

SPECIFIC FIXES:
- TRANSITION CRUTCHES: Replace mechanical connectors ("Furthermore," "Moreover," "In addition") with organic transitions that arise from the content itself. Sometimes the best fix is simply deleting the transition and letting the paragraph flow naturally. Vary your approach: callback to previous idea, contrasting observation, question, or just cut the connector entirely.
- SCAFFOLDING: Delete any sentence where the writer announces what they're about to write. "This chapter explores..." → just start exploring. The content speaks for itself.
- HEDGING: Commit to the claim or cut it. "It could be argued that X" → "X." If genuine uncertainty exists, express it specifically.
- RECAP BLOAT: Delete any paragraph that merely restates what was said in the previous 2-3 paragraphs. If a brief recap is needed, compress it to a single clause within a forward-moving sentence.
- LIST-AS-PROSE: Restructure First/Second/Third sequences into flowing paragraphs with varied sentence structure.
- GENERIC CONCLUSIONS: Replace formulaic endings with specific, surprising final images or observations that arise organically from the chapter's content.
- FICTION CLICHES: Replace stock phrases ("a chill ran down his spine," "breath they didn't know they were holding") with specific, character-grounded sensory details unique to this scene.
- NF INSTRUCTION LEAKS: If you find sentences containing ANY of these editorial trigger phrases, they are instructions that leaked into prose. DELETE the instruction text entirely and rewrite as actual prose:
  Triggers: "Remove specific," "Remove atmospheric," "Remove invented," "Remove fictional," "Replace with documented," "Either identify," "Either cite," "Either provide," "Either name," "Either source," "Either use," "Frame as," "Use general," "Use documented," "Provide documentary," "Provide specific," "Provide real," "Label as," "Anchor to," "Source to," "Cite specific," "Cite actual," "Verify and cite," "Insert documented."
  ALSO catch FUSED instructions where the editorial text flows directly into narrative via comma (e.g., "Remove specific age or cite the documented photograph with date hair catching studio lights" — the instruction runs into prose without punctuation). DELETE everything from the trigger word through the instruction, keeping only the valid prose that follows.
  When you delete an instruction, write actual prose that FOLLOWS what the instruction was asking for. If it says "Remove specific age or cite..." then write the scene WITHOUT the specific age.
- NF PADDING: If you find 2-3 consecutive paragraphs that make the same "impact/toll/cost" point with synonym substitution, MERGE them into one tighter paragraph. Cut the redundancy ruthlessly.
- NF FILLER TRANSITIONS: Replace "This represented..." / "This development constituted..." / "This transformation marked..." with specific content-driven transitions.

OUTPUT: Return the COMPLETE chapter text with your fixes applied. Do NOT add any commentary, notes, or markup. Just the clean, polished prose.`;

async function runAIPolish(text, violations, isNonfiction) {
  if (violations.length === 0) return { polished: text, changed: false };

  const violationBrief = violations.map(v =>
    `[${v.category}] "${v.label}" — found ${v.count}x. Samples: ${v.samples.join(' | ')}`
  ).join('\n');

  const userMessage = `FLAGGED VIOLATIONS:\n${violationBrief}\n\n────────────────────\n\nCHAPTER TEXT TO POLISH:\n${text}`;

  const result = await callAI('claude-sonnet', POLISH_SYSTEM, userMessage, {
    maxTokens: 8192,
    temperature: 0.5,
  });

  if (isRefusal(result)) {
    console.warn('Polish AI refused — returning original text');
    return { polished: text, changed: false };
  }

  // Validation: polished text should be within 15% of original length
  const originalLen = text.length;
  const polishedLen = result.length;
  if (polishedLen < originalLen * 0.7 || polishedLen > originalLen * 1.15) {
    console.warn(`Polish output length suspicious: ${polishedLen} vs original ${originalLen} — returning original`);
    return { polished: text, changed: false, rejected: 'length_mismatch' };
  }

  return { polished: result, changed: true };
}

// ═══ DENO SERVE ═══

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { project_id, chapter_id, prose } = body;

    if (!project_id || !chapter_id) {
      return Response.json({ error: 'project_id and chapter_id required' }, { status: 400 });
    }

    const startMs = Date.now();

    // Load project context to determine genre
    const specs = await base44.entities.Specification.filter({ project_id });
    const spec = specs?.[0];
    const isNonfiction = spec?.book_type === 'nonfiction';

    // Get chapter prose — from body or from DB
    let chapterProse = prose;
    if (!chapterProse) {
      const chapters = await base44.entities.Chapter.filter({ id: chapter_id });
      chapterProse = chapters?.[0]?.content || '';
    }
    if (!chapterProse) {
      return Response.json({ error: 'No prose to polish — provide prose in body or ensure chapter has content' }, { status: 400 });
    }

    // Phase 1: Regex scan
    const violations = runRegexScan(chapterProse, isNonfiction);

    if (violations.length === 0) {
      return Response.json({
        success: true,
        changed: false,
        violations_found: 0,
        message: 'No AI tells detected — prose is clean',
        duration_ms: Date.now() - startMs,
      });
    }

    // Phase 2: AI polish
    const { polished, changed, rejected } = await runAIPolish(chapterProse, violations, isNonfiction);

    // Save polished prose back to chapter if changed
    if (changed) {
      try {
        await base44.entities.Chapter.update(chapter_id, { content: polished });
      } catch (e) {
        console.warn('Failed to save polished prose:', e.message);
      }
    }

    return Response.json({
      success: true,
      changed,
      rejected: rejected || null,
      violations_found: violations.length,
      total_instances: violations.reduce((sum, v) => sum + v.count, 0),
      violations: violations.map(v => ({ category: v.category, label: v.label, count: v.count })),
      duration_ms: Date.now() - startMs,
    });

  } catch (error) {
    console.error('prosePolisher error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
