// ═══════════════════════════════════════════════════════════════════════════════
// SCAN PATTERNS + ENGINE — shared between ReviewPolishTab and sub-components
// ═══════════════════════════════════════════════════════════════════════════════

export const SCAN_CATEGORIES = {
  instruction_leak: { label: "Instruction Leaks", icon: "🚨", weight: 25, color: "red" },
  duplicate_paragraph: { label: "Duplicate Paragraphs", icon: "🔂", weight: 30, color: "red" },
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
  nf_banned_phrase: { label: "NF Banned Phrase Caps", icon: "⛔", weight: 10, color: "red" },
  nf_manuscript_cap: { label: "NF Manuscript-Wide Caps", icon: "📊", weight: 8, color: "amber" },
  repetitive_padding: { label: "Repetitive Padding", icon: "🔄", weight: 12, color: "amber" },
  coffee_scene: { label: "Coffee Scene", icon: "☕", weight: 8, color: "amber" },
  archive_framing: { label: "Archive Framing", icon: "📁", weight: 8, color: "amber" },
  ai_adjective: { label: "AI-Preferred Adjective Overuse", icon: "🤖", weight: 8, color: "amber" },
  philosophical_ending: { label: "Philosophical Platitude Ending", icon: "🎓", weight: 10, color: "red" },
  the_noun_opener: { label: "\"The [Noun] [Verb]\" Monotony", icon: "📄", weight: 8, color: "amber" },
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

// ═══ Universal paragraph splitter — handles \n\n, \n, or no breaks ═══
function splitParas(text) {
  if (/\n\n/.test(text)) return text.split(/\n\n+/);
  if (/\n/.test(text)) return text.split(/\n/);
  // No line breaks — split on sentence boundaries into ~1500 char chunks
  var sentences = text.split(/(?<=[.!?])\s+/);
  var chunks = [];
  var current = '';
  for (var i = 0; i < sentences.length; i++) {
    if (current.length + sentences[i].length > 1500 && current.length > 0) {
      chunks.push(current.trim());
      current = sentences[i];
    } else {
      current += (current ? ' ' : '') + sentences[i];
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function scanDuplicateParagraphs(text, chapterNum) {
  var findings = [];
  var paras = splitParas(text).filter(function(p) { return p.trim().split(/\s+/).length > 40; });
  for (var i = 0; i < paras.length; i++) {
    var wordsA = new Set((paras[i].toLowerCase().match(/\b[a-z]{3,}\b/g) || []));
    if (wordsA.size === 0) continue;
    for (var j = i + 1; j < paras.length; j++) {
      var wordsB = new Set((paras[j].toLowerCase().match(/\b[a-z]{3,}\b/g) || []));
      if (wordsB.size === 0) continue;
      var intersection = 0;
      wordsA.forEach(function(w) { if (wordsB.has(w)) intersection++; });
      var smaller = Math.min(wordsA.size, wordsB.size);
      if (smaller > 0 && intersection / smaller >= 0.8) {
        findings.push({
          category: "duplicate_paragraph",
          label: "Duplicate: \"" + paras[i].trim().slice(0, 80) + "...\"",
          count: 1,
          chapter: chapterNum,
          samples: [paras[i].trim().slice(0, 120), paras[j].trim().slice(0, 120)],
        });
      }
    }
  }
  return findings;
}

var NF_PHRASE_CAPS = [
  [/\bContemporary accounts\b/gi, "Contemporary accounts", 1],
  [/\bThe evidence suggests\b/gi, "The evidence suggests", 1],
  [/\bThe psychological impact\b/gi, "The psychological impact", 1],
  [/\bThe pattern becomes clear\b/gi, "The pattern becomes clear", 1],
  [/\bThis represented\b/gi, "This represented", 1],
];

function scanNfBannedPhraseCaps(text, chapterNum) {
  var findings = [];
  for (var k = 0; k < NF_PHRASE_CAPS.length; k++) {
    var rx = NF_PHRASE_CAPS[k][0];
    var label = NF_PHRASE_CAPS[k][1];
    var cap = NF_PHRASE_CAPS[k][2];
    var m = text.match(rx);
    if (m && m.length > cap) {
      findings.push({
        category: "nf_banned_phrase",
        label: "\"" + label + "\" x" + m.length + " (cap: " + cap + "/chapter)",
        count: m.length - cap,
        chapter: chapterNum,
      });
    }
  }
  return findings;
}

function scanCoffeeScenes(text, chapterNum) {
  var findings = [];
  var paras = splitParas(text);
  var count = 0;
  for (var i = 0; i < paras.length; i++) {
    if (/\bcoffee\b/i.test(paras[i]) && /\b(mug|cup|brew|kitchen|kettle|espresso|caffeine)\b/i.test(paras[i])) {
      count++;
    }
  }
  if (count > 0) {
    findings.push({
      category: "coffee_scene",
      label: count + " coffee scene paragraph(s) — banned in nonfiction",
      count: count,
      chapter: chapterNum,
    });
  }
  return findings;
}

function scanArchiveFraming(text, chapterNum) {
  var findings = [];
  var paras = splitParas(text);
  var count = 0;
  for (var i = 0; i < paras.length; i++) {
    if (/\b(brittle paper|yellowed|old paper|dust motes|close the folder|close the file|faded ink|manila folder|reading room)\b/i.test(paras[i])) {
      count++;
    }
  }
  if (count > 1) {
    findings.push({
      category: "archive_framing",
      label: count + " archive-framing paragraphs (max 1/chapter)",
      count: count - 1,
      chapter: chapterNum,
    });
  }
  return findings;
}

var NF_MANUSCRIPT_CAPS = [
  [/\bYou might assume\b/gi, "You might assume", 1],
  [/\bConsider the case of\b/gi, "Consider the case of", 1],
  [/\b(I |)(make|makes|made|making) (myself |me |)(a |)(cup of |)coffee\b/gi, "coffee-making scene", 0],
  [/\b(I close the folder|I open the box|the scent of old paper|brittle pages)\b/gi, "archive narrator framing", 2],
];

export function scanManuscriptWideCaps(fullText) {
  var findings = [];
  for (var k = 0; k < NF_MANUSCRIPT_CAPS.length; k++) {
    var rx = NF_MANUSCRIPT_CAPS[k][0];
    var label = NF_MANUSCRIPT_CAPS[k][1];
    var cap = NF_MANUSCRIPT_CAPS[k][2];
    var m = fullText.match(rx);
    if (m && m.length > cap) {
      findings.push({
        category: "nf_manuscript_cap",
        label: "MANUSCRIPT-WIDE: \"" + label + "\" x" + m.length + " (max " + cap + "/book)",
        count: m.length - cap,
        chapter: 0,
      });
    }
  }
  return findings;
}

function scanRepetitivePadding(text, chapterNum) {
  var findings = [];
  var paras = splitParas(text).filter(function(p) { return p.trim().length > 30; });
  var openers = [];
  for (var i = 0; i < paras.length; i++) {
    var first = (paras[i].trim().split(/[.!?]/)[0] || "");
    var words = (first.toLowerCase().match(/\b[a-z]{3,}\b/g) || []);
    var key = words.slice(0, 4).join(" ");
    if (key) openers.push(key);
  }
  var counts = {};
  for (var j = 0; j < openers.length; j++) {
    counts[openers[j]] = (counts[openers[j]] || 0) + 1;
  }
  var entries = Object.keys(counts);
  for (var m = 0; m < entries.length; m++) {
    var phrase = entries[m];
    if (counts[phrase] >= 3) {
      findings.push({
        category: "repetitive_padding",
        label: counts[phrase] + " paragraphs open with similar pattern: \"" + phrase + "...\"",
        count: counts[phrase],
        chapter: chapterNum,
      });
    }
  }
  return findings;
}

// ═══ AI DNA SCANNERS ═══

var AI_ADJECTIVES = [
  'shimmering', 'luminous', 'tapestry', 'intricate', 'meticulously',
  'insatiable', 'palpable', 'unmistakable', 'undeniable', 'relentless',
  'sprawling', 'labyrinthine', 'opulent', 'resplendent', 'ethereal',
  'visceral', 'cacophony', 'crescendo', 'juxtaposition', 'myriad',
  'plethora', 'testament', 'harbinger', 'paradigm', 'dichotomy'
];

function scanAiAdjectives(text, chapterNum) {
  var findings = [];
  for (var i = 0; i < AI_ADJECTIVES.length; i++) {
    var rx = new RegExp('\\b' + AI_ADJECTIVES[i] + '\\b', 'gi');
    var m = text.match(rx);
    if (m && m.length > 1) {
      findings.push({
        category: "ai_adjective",
        label: "\"" + AI_ADJECTIVES[i] + "\" x" + m.length + " (max 1/chapter)",
        count: m.length - 1,
        chapter: chapterNum,
      });
    }
  }
  return findings;
}

function scanPhilosophicalEndings(text, chapterNum) {
  var findings = [];
  var paras = splitParas(text);
  if (paras.length < 2) return findings;
  var last = paras[paras.length - 1];
  var platitudes = [
    /\bThe final,?\s*(unsettling\s*)?truth\s+(is|was)\s+that\b/i,
    /\bIn the end,?\s+what\s+(mattered|remained)\s+was\b/i,
    /\bPerhaps\s+the\s+real\s+(lesson|truth|story)\s+was\b/i,
    /\bThe\s+past\s+is\s+never\s+truly\s+past\b/i,
    /\bWhat\s+remains\s+is\s+the\s+(inescapable|uncomfortable|unsettling)\s+truth\b/i,
    /\bThe\s+legacy\s+of\s+[^.]+\s+endures\b/i,
    /\bHistory\s+would\s+(ultimately\s+)?judge\b/i,
    /\bThe\s+echoes\s+of\s+[^.]+\s+continue\s+to\s+reverberate\b/i,
    /\bAnd\s+so\s+the\s+(cycle|story|pattern)\s+continues\b/i,
  ];
  for (var i = 0; i < platitudes.length; i++) {
    if (platitudes[i].test(last)) {
      findings.push({
        category: "philosophical_ending",
        label: "Chapter ends with philosophical platitude: \"" + last.trim().slice(0, 80) + "...\"",
        count: 1,
        chapter: chapterNum,
      });
      break;
    }
  }
  return findings;
}

function scanTheNounOpener(text, chapterNum) {
  var findings = [];
  var paras = splitParas(text);
  for (var i = 0; i < paras.length; i++) {
    var sents = paras[i].split(/(?<=[.!?])\s+/);
    var theCount = 0;
    for (var j = 0; j < sents.length; j++) {
      if (/^The\s+[A-Z][a-z]+\s+(was|were|had|could|would|seemed|appeared|began|continued|remained|stood|sat|lay|hung|felt|looked|moved|turned|came|went|made|took|gave|got|ran|saw|knew|found|thought)\b/.test(sents[j].trim())) {
        theCount++;
      }
    }
    if (theCount >= 4) {
      findings.push({
        category: "the_noun_opener",
        label: theCount + " sentences start with \"The [Noun] [Verb]\" in paragraph " + (i + 1),
        count: theCount - 2,
        chapter: chapterNum,
      });
    }
  }
  return findings;
}

export function scanChapter(chapterText, chapterNum, tense, targetWords) {
  var findings = [];
  var clean = stripDialogue(chapterText);
  var words = chapterText.trim().split(/\s+/).length;

  for (var i = 0; i < PATTERNS.instruction_leak.length; i++) {
    var rx = PATTERNS.instruction_leak[i][0];
    var label = PATTERNS.instruction_leak[i][1];
    var m = chapterText.match(rx);
    if (m) findings.push({ category: "instruction_leak", label: label, count: m.length, chapter: chapterNum, samples: m.slice(0, 2).map(function(s) { return s.slice(0, 100); }) });
  }

  if (tense === "past") {
    for (var t = 0; t < PATTERNS.tense_past_drift.length; t++) {
      var m2 = clean.match(PATTERNS.tense_past_drift[t][0]);
      if (m2 && m2.length > 3) findings.push({ category: "tense_drift", label: m2.length + " present-tense verbs in past-tense narrative", count: m2.length, chapter: chapterNum, samples: m2.slice(0, 5).map(function(s) { return s.slice(0, 60); }) });
    }
  } else if (tense === "present") {
    for (var t2 = 0; t2 < PATTERNS.tense_present_drift.length; t2++) {
      var m3 = clean.match(PATTERNS.tense_present_drift[t2][0]);
      if (m3 && m3.length > 3) findings.push({ category: "tense_drift", label: m3.length + " past-tense verbs in present-tense narrative", count: m3.length, chapter: chapterNum, samples: m3.slice(0, 5).map(function(s) { return s.slice(0, 60); }) });
    }
  }

  for (var ir = 0; ir < PATTERNS.interiority_repetition.length; ir++) {
    var irx = PATTERNS.interiority_repetition[ir][0];
    var ilabel = PATTERNS.interiority_repetition[ir][1];
    var icap = PATTERNS.interiority_repetition[ir][2];
    var im = chapterText.match(irx);
    if (im && im.length > icap) findings.push({ category: "interiority_repetition", label: "\"" + ilabel + "\" x" + im.length + " (cap: " + icap + ")", count: im.length, chapter: chapterNum });
  }

  var simpleScans = [
    ["transition_crutch", "transition_crutch"],
    ["scaffolding", "scaffolding"],
    ["fiction_cliche", "fiction_cliche"],
    ["hedging", "hedging"],
    ["recap_bloat", "recap_bloat"],
    ["generic_conclusion", "generic_conclusion"],
  ];
  for (var s = 0; s < simpleScans.length; s++) {
    var patternKey = simpleScans[s][0];
    var category = simpleScans[s][1];
    var patterns = PATTERNS[patternKey];
    for (var p = 0; p < patterns.length; p++) {
      var sm = chapterText.match(patterns[p][0]);
      if (sm) findings.push({ category: category, label: patterns[p][1], count: sm.length, chapter: chapterNum });
    }
  }

  var firstSentence = (chapterText.trim().split(/[.!?]/)[0] || "");
  if (/^The\s+\w+[\s,]+\w*\s*(scent|smell|aroma|tang|taste|hum|buzz|drone|clinking|drumming|squeak|screech|creak|glow|glare|flicker|shimmer|warmth|chill|cold|cool|heat|damp|sharp|bitter|sweet|acrid|musty|stale|lingering)\b/i.test(firstSentence)) {
    findings.push({ category: "sensory_opener", label: "Sensory atmosphere formula", count: 1, chapter: chapterNum });
  } else if (/\b(scent|smell|aroma|odor|fragrance|stench|whiff)\b/i.test(firstSentence)) {
    findings.push({ category: "sensory_opener", label: "Scent description opener", count: 1, chapter: chapterNum });
  }

  findings.push.apply(findings, scanDuplicateParagraphs(chapterText, chapterNum));
  findings.push.apply(findings, scanNfBannedPhraseCaps(chapterText, chapterNum));
  findings.push.apply(findings, scanRepetitivePadding(chapterText, chapterNum));
  findings.push.apply(findings, scanCoffeeScenes(chapterText, chapterNum));
  findings.push.apply(findings, scanArchiveFraming(chapterText, chapterNum));
  findings.push.apply(findings, scanAiAdjectives(chapterText, chapterNum));
  findings.push.apply(findings, scanPhilosophicalEndings(chapterText, chapterNum));
  findings.push.apply(findings, scanTheNounOpener(chapterText, chapterNum));

  if (targetWords && targetWords > 0) {
    var overPercent = Math.round(((words - targetWords) / targetWords) * 100);
    if (overPercent > 50) {
      findings.push({
        category: "word_count",
        label: "Chapter is " + overPercent + "% over target (" + words + " vs " + targetWords + ")",
        count: 1,
        chapter: chapterNum,
      });
    }
  }

  return { findings: findings, words: words };
}

export function computeScore(allFindings) {
  var deductions = 0;
  for (var i = 0; i < allFindings.length; i++) {
    var f = allFindings[i];
    if (f.category === "duplicate_paragraph") deductions += f.count * 15;
    else if (f.category === "instruction_leak") deductions += f.count * 8;
    else if (f.category === "nf_banned_phrase") deductions += f.count * 3;
    else if (f.category === "coffee_scene") deductions += f.count * 5;
    else if (f.category === "archive_framing") deductions += f.count * 3;
    else if (f.category === "tense_drift") deductions += Math.min(f.count * 0.5, 15);
    else if (f.category === "interiority_repetition") deductions += f.count * 1;
    else if (f.category === "sensory_opener") deductions += f.count * 1.5;
    else if (f.category === "repetitive_padding") deductions += f.count * 2;
    else if (f.category === "nf_manuscript_cap") deductions += f.count * 2;
    else if (f.category === "word_count") deductions += f.count * 2;
    else if (f.category === "ai_adjective") deductions += f.count * 2;
    else if (f.category === "philosophical_ending") deductions += f.count * 5;
    else if (f.category === "the_noun_opener") deductions += f.count * 1.5;
    else deductions += f.count * 0.5;
  }
  return Math.max(0, Math.min(100, Math.round(100 - deductions)));
}

export async function resolveChapterContent(chapter) {
  var content = chapter.content || "";
  if (content.startsWith("http")) {
    try { content = await (await fetch(content)).text(); } catch (e) { content = ""; }
  }
  return content;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FRONTEND AUTO-FIX — pure JS, no backend calls, no AI, runs in <1 second
// ═══════════════════════════════════════════════════════════════════════════════

// Determine the joiner string for the paragraph splitter
function getParaJoin(text) {
  if (/\n\n/.test(text)) return "\n\n";
  if (/\n/.test(text)) return "\n";
  return " ";
}

export function autoFixChapter(text) {
  if (!text || text.length < 100) return text;

  console.log("[autoFix] Starting. Input length:", text.length);
  var changeLog = [];

  var PARA_JOIN = getParaJoin(text);

  // 1. REMOVE DUPLICATE PARAGRAPHS
  var paras = splitParas(text);
  var seen = [];
  var deduped = [];
  for (var i = 0; i < paras.length; i++) {
    var p = paras[i];
    var pWords = (p.toLowerCase().match(/\b[a-z]{4,}\b/g) || []);
    if (pWords.length < 15) { deduped.push(p); continue; }
    var wordSet = new Set(pWords);
    var isDupe = false;
    for (var j = 0; j < seen.length; j++) {
      var overlap = 0;
      wordSet.forEach(function(w) { if (seen[j].has(w)) overlap++; });
      var smaller = Math.min(wordSet.size, seen[j].size);
      if (smaller > 0 && overlap / smaller >= 0.75) { isDupe = true; break; }
    }
    if (isDupe) {
      changeLog.push("Removed duplicate paragraph: \"" + p.trim().slice(0, 60) + "...\"");
    } else {
      deduped.push(p);
      seen.push(wordSet);
    }
  }
  var fixed = deduped.join(PARA_JOIN);

  // SAFETY: if dedup removed too much, bail early
  if (fixed.length < text.length * 0.5) {
    console.warn("[autoFix] Dedup removed >50% of content, reverting");
    fixed = text;
    changeLog = [];
  }

  // 2. STRIP INSTRUCTION LEAKS
  var leakPatterns = [
    /\[NOTE TO (AUTHOR|EDITOR|AI|SELF)\][^\n]*/gi,
    /\[TODO[:\s][^\]]*\]/gi,
    /as (instructed|requested|specified) (in|by) the (prompt|system|user|outline)[^.!?\n]*/gi,
    /per the (outline|beat sheet|specification|chapter prompt)[^.!?\n]*/gi,
    /\b(Remove specific|Use general|Either provide|Either cite|Either use) \w+(\s\w+)? or (cite|provide|use|anchor|source|reference) \w[^.!?\n]*/gi,
    /\bRemove (atmospheric|invented|fictional|fabricated) (reconstruction|detail|scene|quote)[^.!?\n]*/gi,
    /\bProvide (documentary|specific|archival|real) (source|evidence|documentation)[^.!?\n]*/gi,
    /\bLabel as (representative|illustrative|composite|general|reconstructed)[^.!?\n]*/gi,
    /\bFrame as (hypothetical|composite|reconstructed|general|illustrative)[^.!?\n]*/gi,
    /\bAnchor (to|these|this) (documented|real|specific|actual|verifiable)[^.!?\n]*/gi,
    /\bCite (specific|actual) (memoir|interview|archive|document|source|published)[^.!?\n]*/gi,
    /\bVerify and cite\b[^.!?\n]*/gi,
    /\bInsert documented\b[^.!?\n]*/gi,
  ];
  for (var lk = 0; lk < leakPatterns.length; lk++) {
    var before = fixed;
    fixed = fixed.replace(leakPatterns[lk], "");
    if (fixed !== before) changeLog.push("Stripped instruction leak pattern");
  }

  // 3. REMOVE COFFEE SCENE PARAGRAPHS (only remove short paragraphs, not entire chapters)
  var coffeeParas = fixed.split(PARA_SEP);
  var afterCoffee = [];
  for (var c = 0; c < coffeeParas.length; c++) {
    var cp = coffeeParas[c];
    if (cp.length < 2000 && /\bcoffee\b/i.test(cp) && /\b(mug|cup|brew|kitchen|kettle|espresso|caffeine)\b/i.test(cp)) {
      changeLog.push("Removed coffee scene paragraph");
    } else {
      afterCoffee.push(cp);
    }
  }
  fixed = afterCoffee.join(PARA_JOIN);

  // 4. CAP ARCHIVE FRAMING (keep first, remove rest)
  var archiveParas2 = fixed.split(PARA_SEP);
  var archiveFound = 0;
  var afterArchive2 = [];
  for (var a = 0; a < archiveParas2.length; a++) {
    var ap = archiveParas2[a];
    if (/\b(brittle paper|yellowed|old paper|dust motes|close the folder|close the file|faded ink|manila folder|reading room)\b/i.test(ap)) {
      archiveFound++;
      if (archiveFound > 1) {
        changeLog.push("Removed excess archive-framing paragraph");
        continue;
      }
    }
    afterArchive2.push(ap);
  }
  fixed = afterArchive2.join(PARA_JOIN);

  // 5. REMOVE TRANSITION CRUTCH PHRASES
  var transitionRx = [
    /\bFurthermore,?\s/gi,
    /\bMoreover,?\s/gi,
    /\bAdditionally,?\s/gi,
    /\bIt'?s worth noting that\s/gi,
    /\bAs (mentioned|discussed|noted|stated) (earlier|above|previously|before),?\s/gi,
    /\bWith this (understanding|context|background|foundation),?\s/gi,
  ];
  for (var tr = 0; tr < transitionRx.length; tr++) {
    var beforeTr = fixed;
    fixed = fixed.replace(transitionRx[tr], "");
    if (fixed !== beforeTr) changeLog.push("Removed transition crutch");
  }

  // 6. REMOVE SCAFFOLDING SENTENCES
  var scaffoldRx = [
    /\bThis (chapter|section|part) (will )?(explore|examine|discuss|investigate|look at|delve into|unpack)[^.!?\n]*[.!?\n]/gi,
    /\bIn this (chapter|section|part),? we (will|shall|are going to)[^.!?\n]*[.!?\n]/gi,
    /\bBefore (we|I) (begin|dive in|proceed|explore|examine)[^.!?\n]*[.!?\n]/gi,
    /\bLet'?s (begin|start|dive in|explore|examine|unpack)[^.!?\n]*[.!?\n]/gi,
    /\bWhat (follows|comes next) is[^.!?\n]*[.!?\n]/gi,
  ];
  for (var sc = 0; sc < scaffoldRx.length; sc++) {
    var beforeSc = fixed;
    fixed = fixed.replace(scaffoldRx[sc], "");
    if (fixed !== beforeSc) changeLog.push("Removed scaffolding sentence");
  }

  // 7. REMOVE RECAP BLOAT
  var recapRx = [
    /\bAs (we'?ve?|I'?ve?) (discussed|seen|explored|examined|noted|mentioned|established)[^.!?\n]*[.!?\n]/gi,
    /\bTo (summarize|recap|sum up|review) (what we'?ve?|the above|our discussion)[^.!?\n]*[.!?\n]/gi,
  ];
  for (var rc = 0; rc < recapRx.length; rc++) {
    var beforeRc = fixed;
    fixed = fixed.replace(recapRx[rc], "");
    if (fixed !== beforeRc) changeLog.push("Removed recap bloat");
  }

  // 8. REMOVE GENERIC CONCLUSIONS
  var conclusionRx = [
    /\bThe (story|tale|saga|history|legacy) of .{5,60} (reminds|teaches|shows|tells|demonstrates) us that[^.!?\n]*[.!?\n]/gi,
    /\bOnly time (will|would|could) tell[^.!?\n]*[.!?\n]/gi,
    /\bThe rest,? as they say,? is history[^.!?\n]*[.!?\n]/gi,
    /\bAnd (so|thus),? the (stage was set|seeds were sown|wheels were set in motion)[^.!?\n]*[.!?\n]/gi,
  ];
  for (var gc = 0; gc < conclusionRx.length; gc++) {
    var beforeGc = fixed;
    fixed = fixed.replace(conclusionRx[gc], "");
    if (fixed !== beforeGc) changeLog.push("Removed generic conclusion");
  }

  // 9. REMOVE HEDGING PHRASES
  var hedgeRx = [
    /\bIt could be argued that\s/gi,
    /\bOne (might|could|may) (suggest|argue|say|think) that\s/gi,
    /\bPerhaps (it is|it's) (the case|true|fair to say) that\s/gi,
  ];
  for (var hd = 0; hd < hedgeRx.length; hd++) {
    var beforeHd = fixed;
    fixed = fixed.replace(hedgeRx[hd], "");
    if (fixed !== beforeHd) changeLog.push("Removed hedging phrase");
  }

  // 10. CAP AI-PREFERRED ADJECTIVES (max 1 per chapter)
  var aiAdjs = [
    'shimmering', 'luminous', 'tapestry', 'intricate', 'meticulously',
    'insatiable', 'palpable', 'unmistakable', 'undeniable', 'relentless',
    'sprawling', 'labyrinthine', 'opulent', 'resplendent', 'ethereal',
    'visceral', 'cacophony', 'crescendo', 'juxtaposition', 'myriad',
    'plethora', 'testament', 'harbinger', 'paradigm', 'dichotomy'
  ];
  for (var ai = 0; ai < aiAdjs.length; ai++) {
    var aiCount = 0;
    var aiRx = new RegExp('\\b' + aiAdjs[ai] + '\\b', 'gi');
    fixed = fixed.replace(aiRx, function(match) {
      aiCount++;
      if (aiCount <= 1) return match;
      changeLog.push("Removed excess AI adjective: " + match);
      return "";
    });
  }

  // 11. STRIP PHILOSOPHICAL PLATITUDE ENDINGS
  var platParas = fixed.split(PARA_SEP);
  if (platParas.length > 2) {
    var lastP = platParas[platParas.length - 1];
    var platBefore = lastP;
    lastP = lastP.replace(/\b(The final,?\s*(unsettling\s*)?truth\s+(is|was)\s+that|In the end,?\s+what\s+(mattered|remained)\s+was|Perhaps\s+the\s+real\s+(lesson|truth|story)\s+was|The\s+past\s+is\s+never\s+truly\s+past|What\s+remains\s+is\s+the\s+(inescapable|uncomfortable|unsettling)\s+truth|The\s+legacy\s+of\s+[^.]+\s+endures|History\s+would\s+(ultimately\s+)?judge|The\s+echoes\s+of\s+[^.]+\s+continue\s+to\s+reverberate|And\s+so\s+the\s+(cycle|story|pattern)\s+continues)[^.!?]*[.!?]/gi, "");
    lastP = lastP.trim();
    if (lastP !== platBefore.trim() && lastP.length > 20) {
      platParas[platParas.length - 1] = lastP;
      fixed = platParas.join(PARA_JOIN);
      changeLog.push("Stripped philosophical platitude ending");
    }
  }

  // 12. REPEATED PARAGRAPH OPENER COMPRESSION
  var openerParas = fixed.split(PARA_SEP);
  var finalParas = [];
  for (var op = 0; op < openerParas.length; op++) {
    var prefix = ((openerParas[op].trim().toLowerCase().match(/\b[a-z]+\b/g) || []).slice(0, 4).join(" "));
    if (finalParas.length > 0 && prefix) {
      var prevPrefix = ((finalParas[finalParas.length - 1].trim().toLowerCase().match(/\b[a-z]+\b/g) || []).slice(0, 4).join(" "));
      if (prefix === prevPrefix) {
        changeLog.push("Removed repeated opener: \"" + prefix + "...\"");
        continue;
      }
    }
    finalParas.push(openerParas[op]);
  }
  fixed = finalParas.join(PARA_JOIN);

  // 13. CLEAN UP WHITESPACE
  fixed = fixed.replace(/\n{3,}/g, "\n\n").replace(/  +/g, " ").trim();

  // FINAL SAFETY: never return content that lost >30% of original
  if (fixed.length < text.length * 0.7) {
    console.warn("[autoFix] Output too short (" + fixed.length + " vs " + text.length + "), returning original");
    return text;
  }

  console.log("[autoFix] Done. Changes:", changeLog.length, "Output length:", fixed.length);
  if (changeLog.length > 0) {
    console.log("[autoFix] Change log:");
    for (var cl = 0; cl < changeLog.length; cl++) {
      console.log("  -", changeLog[cl]);
    }
  }

  return fixed;
}