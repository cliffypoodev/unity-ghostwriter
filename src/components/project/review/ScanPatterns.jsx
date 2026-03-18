// ═══════════════════════════════════════════════════════════════════════════════
// SCAN PATTERNS + ENGINE — shared between ReviewPolishTab and sub-components
// ═══════════════════════════════════════════════════════════════════════════════

export const SCAN_CATEGORIES = {
  instruction_leak: { label: "Instruction Leaks", icon: "🚨", weight: 25, color: "red" },
  tense_drift: { label: "Tense Drift", icon: "⏱", weight: 15, color: "red" },
  interiority_repetition: { label: "Interiority Repetition", icon: "🔁", weight: 10, color: "amber" },
  transition_crutch: { label: "Transition Crutches", icon: "🔗", weight: 8, color: "amber" },
  sensory_opener: { label: "Sensory Opener Monotony", icon: "👁", weight: 8, color: "amber" },
  scaffolding: { label: "Placeholder Scaffolding", icon: "🏗", weight: 10, color: "amber" },
  fiction_cliche: { label: "Fiction Clichés", icon: "📝", weight: 5, color: "blue" },
  hedging: { label: "Hedging Fog", icon: "🌫", weight: 5, color: "blue" },
  recap_bloat: { label: "Recap Bloat", icon: "♻️", weight: 5, color: "blue" },
  generic_conclusion: { label: "Generic Conclusions", icon: "🔚", weight: 5, color: "blue" },
  word_count: { label: "Word Count Issues", icon: "📏", weight: 4, color: "blue" },
  nf_fiction_trap: { label: "NF Crutch / Fiction Trap", icon: "📖", weight: 10, color: "amber" },
  nf_thesis_ending: { label: "NF Thesis Restatement", icon: "🔄", weight: 5, color: "amber" },
  nf_padding: { label: "NF Repetitive Padding", icon: "📋", weight: 8, color: "amber" },
  nf_unlabeled_reconstruction: { label: "NF Unlabeled Reconstruction", icon: "🎭", weight: 12, color: "red" },
  nf_polish: { label: "NF Polish Target", icon: "✨", weight: 5, color: "blue" },
  gemini_nf_cap: { label: "NF Frequency Cap", icon: "🔢", weight: 5, color: "amber" },
  gemini_nf_ban: { label: "NF Banned Phrase", icon: "🚫", weight: 10, color: "red" },
  gemini_nf_manuscript_cap: { label: "NF Manuscript Cap", icon: "📊", weight: 5, color: "amber" },
  duplicate_paragraph: { label: "Duplicate Paragraphs", icon: "🔂", weight: 30, color: "red" },
  nf_banned_phrase: { label: "NF Banned Phrase Caps", icon: "⛔", weight: 10, color: "red" },
  nf_manuscript_cap: { label: "NF Manuscript-Wide Caps", icon: "📊", weight: 8, color: "amber" },
  repetitive_padding: { label: "Repetitive Padding", icon: "🔄", weight: 12, color: "amber" },
};

export const PATTERNS = {
  instruction_leak: [
    [/\bAdjust the (year|name|time|date|setting|location|chapter) to (be |match |reflect )/gi, "Adjust the [X] to..."],
    [/\bRewrite to (focus|include|show|address|reflect|incorporate|emphasize)/gi, "Rewrite to..."],
    [/\bAddress the .{1,40}(incident|event|scene|cliffhanger|plot point) from the previous/gi, "Address the [X] from previous"],
    [/\b(consistent|inconsistent) with the (established |)?(timeline|outline|beat sheet|story bible)/gi, "consistent with the timeline"],
    [/\blike an anchor to this moment/gi, "like an anchor to this moment"],
    [/\badd a clear time transition/gi, "add a clear time transition"],
    [/\bchapter break indicator/gi, "chapter break indicator"],
    [/complete the (chapter|scene|story|section) or indicate/gi, "complete the chapter or indicate"],
    [/indicate if this is intentional/gi, "indicate if this is intentional"],
    [/should (I|we) (continue|complete|finish|expand)/gi, "should I continue/complete"],
    [/\[NOTE TO (AUTHOR|EDITOR|AI|SELF)\b/gi, "[NOTE TO AUTHOR/AI]"],
    [/\[TODO[:\s]/gi, "[TODO]"],
    [/as (instructed|requested|specified) (in|by) the (prompt|system|user)/gi, "as instructed by the prompt"],
    [/per the (outline|beat sheet|specification)/gi, "per the outline/beat sheet"],
    [/\bRemove specific \w+ or (cite|provide|anchor|source|use)/gi, "NF leak: Remove specific X or cite/provide..."],
    [/\bRemove (atmospheric|invented|fictional|fabricated) (reconstruction|detail|scene|quote)/gi, "NF leak: Remove atmospheric/invented..."],
    [/\bEither (identify|cite|name|source|provide|use) (the |a )?(specific|actual|real|documentary|documented)/gi, "NF leak: Either cite/provide specific..."],
    [/\bProvide (documentary|specific|archival|real) (source|evidence|documentation)/gi, "NF leak: Provide documentary source..."],
    [/\bReplace with documented (examples?|case stud|evidence|facts)/gi, "NF leak: Replace with documented..."],
    [/\bUse general (timeframe|terms?|reference|description|language)/gi, "NF leak: Use general timeframe..."],
    [/\bUse documented (examples?|case stud|evidence|sources)/gi, "NF leak: Use documented examples..."],
    [/\bLabel as (representative|illustrative|composite|general|reconstructed)/gi, "NF leak: Label as composite..."],
    [/\bFrame as (hypothetical|composite|reconstructed|general|illustrative)/gi, "NF leak: Frame as hypothetical..."],
    [/\bAnchor (to|these|this) (documented|real|specific|actual|verifiable)/gi, "NF leak: Anchor to documented..."],
    [/\bSource (to|this to) (actual|specific|documented|real)/gi, "NF leak: Source to actual..."],
    [/\bCite (specific|actual) (memoir|interview|archive|document|source|published)/gi, "NF leak: Cite specific source..."],
    [/\bVerify and cite\b/gi, "NF leak: Verify and cite..."],
    [/\bInsert documented\b/gi, "NF leak: Insert documented..."],
    [/\bor (clearly |)label as (representative|composite|illustrative|reconstructed|atmospheric|hypothetical)/gi, "NF leak: or label as composite..."],
    [/\bor (remove|begin with|provide|cite|frame|preface).{1,40}(fictional|documented|general|representative|composite|atmospheric|reconstructed|hypothetical)/gi, "NF leak: or remove/cite fictional..."],
    [/\bContemporary accounts (describe|suggest) similar [^.!?\n]{5,}/gi, "NF leak: meta-framing instruction"],
    [/\bUse '([^']+)' or [^.!?\n]{5,}/gi, "NF leak: Use quoted example or..."],
    [/\b(Remove specific|Use general|Either provide|Either cite|Either use) \w+(\s\w+)? or (cite|provide|use|anchor|source|reference) \w/gi, "NF leak: fused instruction-prose"],
  ],
  tense_past_drift: [
    [/\b(he|she|they|it|I|we)\s+(walks|runs|says|thinks|feels|knows|sees|hears|stands|sits|looks|moves|turns|opens|closes|steps|reaches|pulls|pushes|watches|presses|asks|cuts|fills|takes|sets|picks|drops|begins|starts|stops|grabs|holds|catches|lifts|places)\b/gi, "present-tense verb in past-tense narrative"],
  ],
  tense_present_drift: [
    [/\b(he|she|they|it|I|we)\s+(walked|ran|said|thought|felt|knew|saw|heard|stood|sat|looked|moved|turned|opened|closed|stepped|reached|pulled|pushed|watched|pressed|asked|cut|filled|took|set|picked|dropped|began|started|stopped|grabbed|held|caught|lifted|placed)\b/gi, "past-tense verb in present-tense narrative"],
  ],
  interiority_repetition: [
    [/\bhollow\b/gi, "hollow", 2], [/\bhollowness\b/gi, "hollowness", 1],
    [/\bempty\b/gi, "empty", 3], [/\bemptiness\b/gi, "emptiness", 2],
    [/\bshattered\b/gi, "shattered", 2], [/\bbroken\b/gi, "broken", 3],
    [/\bnumb(ness)?\b/gi, "numb/numbness", 2], [/\bvoid\b/gi, "void", 2],
    [/\baching?\b/gi, "ache/aching", 4], [/\bfragile\b/gi, "fragile", 3],
  ],
  transition_crutch: [
    [/\bFurthermore\b/g, "Furthermore"], [/\bMoreover\b/g, "Moreover"],
    [/\bIn addition\b/gi, "In addition"], [/\bAdditionally\b/g, "Additionally"],
    [/\bIt'?s worth noting that\b/gi, "It's worth noting that"],
    [/\bAs (mentioned|discussed|noted|stated) (earlier|above|previously|before)\b/gi, "As mentioned earlier"],
    [/\bThis (brings|leads|takes) us to\b/gi, "This brings/leads us to"],
    [/\bLet us (now )?turn (our attention )?to\b/gi, "Let us turn to"],
    [/\bWith this (understanding|context|background|foundation)\b/gi, "With this understanding"],
    [/\bUltimately\b/g, "Ultimately"],
  ],
  scaffolding: [
    [/\bThis (chapter|section|part) (will )?(explore|examine|discuss|investigate|look at|delve into|unpack)\b/gi, "This chapter explores..."],
    [/\bIn this (chapter|section|part),? we (will|shall|are going to)\b/gi, "In this chapter, we will..."],
    [/\bBefore (we|I) (begin|dive in|proceed|explore|examine)\b/gi, "Before we begin..."],
    [/\bLet'?s (begin|start|dive in|explore|examine|unpack)\b/gi, "Let's begin/explore..."],
    [/\bWhat (follows|comes next) is\b/gi, "What follows is..."],
  ],
  fiction_cliche: [
    [/\bLittle did (he|she|they) know\b/gi, "Little did they know"],
    [/\bUnbeknownst to\b/gi, "Unbeknownst to"],
    [/\bA (chill|shiver) (ran|crept|went|traveled) (down|up) (his|her|their) spine\b/gi, "A chill ran down their spine"],
    [/\b(He|She|They) let out a breath (he|she|they) didn'?t (know|realize)/gi, "breath they didn't know they were holding"],
    [/\bTime (seemed to|appeared to) (slow|stop|stand still|freeze)\b/gi, "Time seemed to slow"],
    [/\bA (single|lone) tear (rolled|slid|traced|tracked) down\b/gi, "A single tear rolled down"],
    [/\bDarkness (claimed|consumed|swallowed|took) (him|her|them)\b/gi, "Darkness claimed them"],
  ],
  hedging: [
    [/\bIt could be argued that\b/gi, "It could be argued that"],
    [/\bOne (might|could|may) (suggest|argue|say|think) that\b/gi, "One might suggest that"],
    [/\bPerhaps (it is|it's) (the case|true|fair to say) that\b/gi, "Perhaps it is the case that"],
    [/\bTo be (sure|fair|certain)\b/gi, "To be sure/fair"],
  ],
  recap_bloat: [
    [/\bAs (we'?ve?|I'?ve?) (discussed|seen|explored|examined|noted|mentioned|established)\b/gi, "As we've discussed"],
    [/\bTo (summarize|recap|sum up|review) (what we'?ve?|the above|our discussion)\b/gi, "To summarize..."],
    [/\bIn (summary|conclusion|closing|short)\b/gi, "In summary/conclusion"],
    [/\bThe (bottom line|key takeaway|main point) (is|here is)\b/gi, "The bottom line is"],
  ],
  generic_conclusion: [
    [/\bThe (story|tale|saga|history|legacy) of .{5,60} (reminds|teaches|shows|tells|demonstrates) us that\b/gi, "The story of X reminds us"],
    [/\bOnly time (will|would|could) tell\b/gi, "Only time will tell"],
    [/\bThe rest,? as they say,? is history\b/gi, "The rest is history"],
    [/\bAnd (so|thus),? the (stage was set|seeds were sown|wheels were set in motion)\b/gi, "And so the stage was set"],
  ],
};

function stripDialogue(text) {
  return text.replace(/["\u201C][^"\u201D]*["\u201D]/g, "").replace(/'[^']*'/g, "");
}

// ── Duplicate paragraph detection ──
function scanDuplicateParagraphs(text, chapterNum) {
  const findings = [];
  const paras = text.split(/\n\n+/).filter(p => p.trim().split(/\s+/).length > 50);
  for (let i = 0; i < paras.length; i++) {
    const wordsA = new Set(paras[i].toLowerCase().match(/\b[a-z]{3,}\b/g) || []);
    if (wordsA.size === 0) continue;
    for (let j = i + 1; j < paras.length; j++) {
      const wordsB = new Set(paras[j].toLowerCase().match(/\b[a-z]{3,}\b/g) || []);
      if (wordsB.size === 0) continue;
      let intersection = 0;
      for (const w of wordsA) { if (wordsB.has(w)) intersection++; }
      const smaller = Math.min(wordsA.size, wordsB.size);
      if (smaller > 0 && intersection / smaller >= 0.8) {
        findings.push({
          category: "duplicate_paragraph",
          label: `Duplicate paragraph: "${paras[i].trim().slice(0, 80)}…"`,
          count: 1,
          chapter: chapterNum,
          samples: [paras[i].trim().slice(0, 120), paras[j].trim().slice(0, 120)],
        });
      }
    }
  }
  return findings;
}

// ── NF banned phrase per-chapter caps ──
const NF_PHRASE_CAPS = [
  [/\bContemporary accounts\b/gi, "Contemporary accounts", 1],
  [/\bThe evidence suggests\b/gi, "The evidence suggests", 1],
  [/\bThe psychological impact\b/gi, "The psychological impact", 1],
  [/\bThe pattern becomes clear\b/gi, "The pattern becomes clear", 1],
  [/\bThis represented\b/gi, "This represented", 1],
];

function scanNfBannedPhraseCaps(text, chapterNum) {
  const findings = [];
  for (const [rx, label, cap] of NF_PHRASE_CAPS) {
    const m = text.match(rx);
    if (m && m.length > cap) {
      findings.push({
        category: "nf_banned_phrase",
        label: `"${label}" x${m.length} (cap: ${cap}/chapter)`,
        count: m.length - cap,
        chapter: chapterNum,
      });
    }
  }
  return findings;
}

// ── NF manuscript-wide caps (called once on full text) ──
const NF_MANUSCRIPT_CAPS = [
  [/\bYou might assume\b/gi, "You might assume", 1],
  [/\bConsider the case of\b/gi, "Consider the case of", 1],
  [/\b(I |)(make|makes|made|making) (myself |me |)(a |)(cup of |)coffee\b/gi, "coffee-making scene", 0],
  [/\b(I close the folder|I open the box|the scent of old paper|brittle pages)\b/gi, "archive narrator framing", 2],
];

export function scanManuscriptWideCaps(fullText) {
  const findings = [];
  for (const [rx, label, cap] of NF_MANUSCRIPT_CAPS) {
    const m = fullText.match(rx);
    if (m && m.length > cap) {
      findings.push({
        category: "nf_manuscript_cap",
        label: `MANUSCRIPT-WIDE: "${label}" x${m.length} (max ${cap}/book)`,
        count: m.length - cap,
        chapter: 0,
      });
    }
  }
  return findings;
}

// ── Repetitive padding detection ──
function scanRepetitivePadding(text, chapterNum) {
  const findings = [];
  const paras = text.split(/\n\n+/).filter(p => p.trim().length > 30);
  const openers = paras.map(p => {
    const first = p.trim().split(/[.!?]/)[0] || "";
    // Extract first 3-4 significant words as key phrase
    const words = first.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    return words.slice(0, 4).join(" ");
  }).filter(Boolean);
  const counts = {};
  for (const opener of openers) {
    counts[opener] = (counts[opener] || 0) + 1;
  }
  for (const [phrase, count] of Object.entries(counts)) {
    if (count >= 3) {
      findings.push({
        category: "repetitive_padding",
        label: `${count} paragraphs open with similar pattern: "${phrase}…"`,
        count,
        chapter: chapterNum,
      });
    }
  }
  return findings;
}

export function scanChapter(chapterText, chapterNum, tense, targetWords) {
  const findings = [];
  const clean = stripDialogue(chapterText);
  const words = chapterText.trim().split(/\s+/).length;

  for (const [rx, label] of PATTERNS.instruction_leak) {
    const m = chapterText.match(rx);
    if (m) findings.push({ category: "instruction_leak", label, count: m.length, chapter: chapterNum, samples: m.slice(0, 2).map(s => s.slice(0, 100)) });
  }

  if (tense === "past") {
    for (const [rx] of PATTERNS.tense_past_drift) {
      const m = clean.match(rx);
      if (m && m.length > 3) findings.push({ category: "tense_drift", label: `${m.length} present-tense verbs in past-tense narrative`, count: m.length, chapter: chapterNum, samples: m.slice(0, 5).map(s => s.slice(0, 60)) });
    }
  } else if (tense === "present") {
    for (const [rx] of PATTERNS.tense_present_drift) {
      const m = clean.match(rx);
      if (m && m.length > 3) findings.push({ category: "tense_drift", label: `${m.length} past-tense verbs in present-tense narrative`, count: m.length, chapter: chapterNum, samples: m.slice(0, 5).map(s => s.slice(0, 60)) });
    }
  }

  for (const [rx, label, cap] of PATTERNS.interiority_repetition) {
    const m = chapterText.match(rx);
    if (m && m.length > cap) findings.push({ category: "interiority_repetition", label: `"${label}" x${m.length} (cap: ${cap})`, count: m.length, chapter: chapterNum });
  }

  const scanSimple = (patternKey, category) => {
    for (const [rx, label] of PATTERNS[patternKey]) {
      const m = chapterText.match(rx);
      if (m) findings.push({ category, label, count: m.length, chapter: chapterNum });
    }
  };
  scanSimple("transition_crutch", "transition_crutch");
  scanSimple("scaffolding", "scaffolding");
  scanSimple("fiction_cliche", "fiction_cliche");
  scanSimple("hedging", "hedging");
  scanSimple("recap_bloat", "recap_bloat");
  scanSimple("generic_conclusion", "generic_conclusion");

  const firstSentence = chapterText.trim().split(/[.!?]/)[0] || "";
  if (/^The\s+\w+[\s,]+\w*\s*(scent|smell|aroma|tang|taste|hum|buzz|drone|clinking|drumming|squeak|screech|creak|glow|glare|flicker|shimmer|warmth|chill|cold|cool|heat|damp|sharp|bitter|sweet|acrid|musty|stale|lingering)\b/i.test(firstSentence)) {
    findings.push({ category: "sensory_opener", label: "Sensory atmosphere formula", count: 1, chapter: chapterNum });
  } else if (/\b(scent|smell|aroma|odor|fragrance|stench|whiff)\b/i.test(firstSentence)) {
    findings.push({ category: "sensory_opener", label: "Scent description opener", count: 1, chapter: chapterNum });
  }

  // Duplicate paragraph detection
  findings.push(...scanDuplicateParagraphs(chapterText, chapterNum));

  // NF banned phrase per-chapter caps
  findings.push(...scanNfBannedPhraseCaps(chapterText, chapterNum));

  // Repetitive padding detection
  findings.push(...scanRepetitivePadding(chapterText, chapterNum));

  // Word count check
  if (targetWords && targetWords > 0) {
    const overPercent = Math.round(((words - targetWords) / targetWords) * 100);
    if (overPercent > 50) {
      findings.push({
        category: "word_count",
        label: `Chapter is ${overPercent}% over target word count (${words} vs ${targetWords})`,
        count: 1,
        chapter: chapterNum,
      });
    }
  }

  return { findings, words };
}

export function computeScore(allFindings) {
  let deductions = 0;
  for (const f of allFindings) {
    if (f.category === "duplicate_paragraph") deductions += f.count * 15;
    else if (f.category === "instruction_leak") deductions += f.count * 8;
    else if (f.category === "nf_banned_phrase") deductions += f.count * 3;
    else if (f.category === "tense_drift") deductions += Math.min(f.count * 0.5, 15);
    else if (f.category === "interiority_repetition") deductions += f.count * 1;
    else if (f.category === "sensory_opener") deductions += f.count * 1.5;
    else if (f.category === "repetitive_padding") deductions += f.count * 2;
    else if (f.category === "nf_manuscript_cap") deductions += f.count * 2;
    else if (f.category === "word_count") deductions += f.count * 2;
    else deductions += f.count * 0.5;
  }
  return Math.max(0, Math.min(100, Math.round(100 - deductions)));
}

export async function resolveChapterContent(chapter) {
  let content = chapter.content || "";
  if (content.startsWith("http")) {
    try { content = await (await fetch(content)).text(); } catch { content = ""; }
  }
  return content;
}