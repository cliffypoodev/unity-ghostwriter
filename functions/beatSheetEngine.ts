import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── BEAT SHEET TEMPLATES ──────────────────────────────────────────────────────
const BEAT_SHEET_TEMPLATES = {
  "save-the-cat": {
    name: "Save the Cat — Hollywood Structure",
    category: "fiction",
    beats: [
      { position: 0,    name: "Opening Image",       fn: "SETUP",              scene_type: "scene",  tempo: "medium", desc: "Establish the protagonist's world BEFORE the story changes it. Show their flaw, their normal life, what they stand to lose." },
      { position: 0.07, name: "Theme Stated",         fn: "SETUP",              scene_type: "sequel", tempo: "slow",   desc: "Someone (not the protagonist) hints at the book's deeper theme. The protagonist doesn't understand it yet." },
      { position: 0.10, name: "Setup Continued",      fn: "SETUP",              scene_type: "scene",  tempo: "medium", desc: "Introduce supporting cast, world rules, protagonist's desire vs need." },
      { position: 0.15, name: "Catalyst",             fn: "DISRUPTION",         scene_type: "scene",  tempo: "fast",   desc: "The inciting incident. Something the protagonist CANNOT ignore. Not a choice — an event." },
      { position: 0.20, name: "Debate",               fn: "REACTION",           scene_type: "sequel", tempo: "slow",   desc: "Protagonist resists the call. Internal conflict. Process, dilemma, decision." },
      { position: 0.25, name: "Break Into Two",       fn: "COMMITMENT",         scene_type: "scene",  tempo: "fast",   desc: "Protagonist makes an ACTIVE CHOICE to enter the new world. Must be a decision, not something that happens TO them." },
      { position: 0.30, name: "B-Story Begins",       fn: "SUBPLOT",            scene_type: "scene",  tempo: "medium", desc: "Introduce or deepen the B-story. Different tone from A-story." },
      { position: 0.35, name: "Fun & Games A",        fn: "PROMISE_OF_PREMISE", scene_type: "scene",  tempo: "fast",   desc: "Deliver what the genre PROMISES. Erotica = intimacy. Thriller = danger. Romance = chemistry." },
      { position: 0.42, name: "Fun & Games B",        fn: "PROMISE_OF_PREMISE", scene_type: "scene",  tempo: "fast",   desc: "Escalate from Fun & Games A. Stakes rising but haven't crashed yet." },
      { position: 0.50, name: "Midpoint",             fn: "REVERSAL",           scene_type: "scene",  tempo: "fast",   desc: "Major turning point. False victory or false defeat. New information changes everything." },
      { position: 0.55, name: "Bad Guys Close In",    fn: "ESCALATION",         scene_type: "scene",  tempo: "fast",   desc: "External pressure intensifies. Allies waver. Protagonist's flaws cause real problems." },
      { position: 0.65, name: "All Is Lost",          fn: "CRISIS",             scene_type: "scene",  tempo: "fast",   desc: "The lowest point. Something irreversible — death, betrayal, loss. Protagonist worse off than at the start." },
      { position: 0.70, name: "Dark Night of the Soul",fn: "REFLECTION",        scene_type: "sequel", tempo: "slow",   desc: "REACTION chapter. Grief, anger, denial. NO new characters, NO new plot. Must be SLOW." },
      { position: 0.80, name: "Break Into Three",     fn: "RECOMMITMENT",       scene_type: "scene",  tempo: "medium", desc: "Protagonist understands the theme. Chooses a new approach requiring growth." },
      { position: 0.90, name: "Finale",               fn: "CLIMAX",             scene_type: "scene",  tempo: "fast",   desc: "All threads converge. Protagonist proves they've changed by acting differently than Chapter 1." },
      { position: 1.00, name: "Final Image",          fn: "RESOLUTION",         scene_type: "sequel", tempo: "slow",   desc: "Mirror of Opening Image showing transformation. Single resonant image or moment." },
    ]
  },
  "romance-arc": {
    name: "Romance Arc — Relationship-Driven",
    category: "fiction",
    beats: [
      { position: 0,    name: "Separate Worlds",      fn: "SETUP",              scene_type: "scene",  tempo: "medium", desc: "Establish both leads separately. Show what each is missing. Introduce emotional wounds." },
      { position: 0.08, name: "The Meeting",           fn: "DISRUPTION",         scene_type: "scene",  tempo: "fast",   desc: "Leads meet. FRICTION, not instant love. Physical awareness noted but not acted on." },
      { position: 0.15, name: "Forced Proximity",      fn: "ESCALATION",         scene_type: "scene",  tempo: "medium", desc: "Circumstance throws them together. Chemistry builds through friction." },
      { position: 0.22, name: "Walls Up",              fn: "REACTION",           scene_type: "sequel", tempo: "slow",   desc: "One or both pull back. Past wounds surface. Reader sees WHY they resist." },
      { position: 0.30, name: "First Surrender",       fn: "PROMISE_OF_PREMISE", scene_type: "scene",  tempo: "fast",   desc: "Genuine vulnerability or physical intimacy breaks through walls. For erotica: first real intimate scene." },
      { position: 0.38, name: "Deepening",             fn: "PROMISE_OF_PREMISE", scene_type: "scene",  tempo: "medium", desc: "Relationship deepens. Shared experiences bond them. Intimacy escalates." },
      { position: 0.45, name: "The Lie Exposed",       fn: "REVERSAL",           scene_type: "scene",  tempo: "fast",   desc: "Secret or external force threatens the relationship. Trust tested." },
      { position: 0.50, name: "Midpoint Shift",        fn: "REVERSAL",           scene_type: "sequel", tempo: "slow",   desc: "Relationship nature fundamentally changes. Both acknowledge this is no longer casual." },
      { position: 0.60, name: "Escalation & Stakes",   fn: "ESCALATION",         scene_type: "scene",  tempo: "fast",   desc: "External pressures compound. Intimacy more intense but emotionally complicated." },
      { position: 0.70, name: "The Break",             fn: "CRISIS",             scene_type: "scene",  tempo: "fast",   desc: "Relationship shatters. Must feel EARNED. Both devastated differently." },
      { position: 0.78, name: "Alone Again",           fn: "REFLECTION",         scene_type: "sequel", tempo: "slow",   desc: "Both process loss separately. Mirror opening — alone again but WORSE." },
      { position: 0.85, name: "The Realization",       fn: "RECOMMITMENT",       scene_type: "sequel", tempo: "medium", desc: "One or both realize what they must change. Emotional wound confronted directly." },
      { position: 0.92, name: "Grand Gesture / Reunion",fn: "CLIMAX",           scene_type: "scene",  tempo: "fast",   desc: "Reunion. Vulnerable gesture proves change. For erotica: reunion intimacy carries full emotional weight." },
      { position: 1.00, name: "Together / HEA",        fn: "RESOLUTION",         scene_type: "sequel", tempo: "slow",   desc: "Happily Ever After. New normal. Emotional wound healed. Final image is warmth." },
    ]
  },
  "thriller-tension": {
    name: "Thriller / Suspense Arc",
    category: "fiction",
    beats: [
      { position: 0,    name: "Normal World",         fn: "SETUP",              scene_type: "scene",  tempo: "medium", desc: "Establish competence and routine. Plant details that become significant later." },
      { position: 0.08, name: "The Disturbance",      fn: "DISRUPTION",         scene_type: "scene",  tempo: "fast",   desc: "Something is wrong. A body, message, disappearance. Clock starts ticking." },
      { position: 0.15, name: "Investigation Begins",  fn: "PROMISE_OF_PREMISE", scene_type: "scene",  tempo: "medium", desc: "Early clues and red herrings. Reader starts forming theories." },
      { position: 0.22, name: "First Complication",    fn: "ESCALATION",         scene_type: "scene",  tempo: "fast",   desc: "Initial approach fails. Problem bigger than expected." },
      { position: 0.30, name: "Allies & Enemies",      fn: "SUBPLOT",            scene_type: "scene",  tempo: "medium", desc: "Trust tested. Key B-story relationship develops." },
      { position: 0.38, name: "The Trail Heats Up",    fn: "PROMISE_OF_PREMISE", scene_type: "scene",  tempo: "fast",   desc: "Breakthrough at a cost — protagonist now visible to antagonist." },
      { position: 0.50, name: "Midpoint Revelation",   fn: "REVERSAL",           scene_type: "scene",  tempo: "fast",   desc: "Everything believed is wrong. Major twist reframes everything." },
      { position: 0.58, name: "Counterattack",         fn: "ESCALATION",         scene_type: "scene",  tempo: "fast",   desc: "Antagonist strikes back. Someone close is threatened. Stakes personal." },
      { position: 0.65, name: "Racing Clock",          fn: "ESCALATION",         scene_type: "scene",  tempo: "fast",   desc: "Deadline emerges. Time running out. Desperate moves." },
      { position: 0.75, name: "Darkest Hour",          fn: "CRISIS",             scene_type: "sequel", tempo: "slow",   desc: "Rock bottom. Betrayed or outmaneuvered. Brief but human cost registers." },
      { position: 0.80, name: "The Key",               fn: "RECOMMITMENT",       scene_type: "scene",  tempo: "medium", desc: "Small detail clicks into place. Desperate plan using info reader already has." },
      { position: 0.90, name: "The Confrontation",     fn: "CLIMAX",             scene_type: "scene",  tempo: "fast",   desc: "Final confrontation. Plan goes sideways. Victory requires sacrifice or cleverness." },
      { position: 1.00, name: "Aftermath",             fn: "RESOLUTION",         scene_type: "sequel", tempo: "slow",   desc: "Cost of victory. Bittersweet: something saved, something lost." },
    ]
  },
  "heros-journey": {
    name: "Hero's Journey — Campbell/Vogler",
    category: "fiction",
    beats: [
      { position: 0,    name: "Ordinary World",        fn: "SETUP",              scene_type: "scene",  tempo: "medium", desc: "Hero in mundane environment. Longing for something more." },
      { position: 0.08, name: "Call to Adventure",      fn: "DISRUPTION",         scene_type: "scene",  tempo: "fast",   desc: "Challenge or quest presented. Ordinary world can't contain them." },
      { position: 0.12, name: "Refusal of the Call",    fn: "REACTION",           scene_type: "sequel", tempo: "slow",   desc: "Fear, doubt, obligation. Hero resists. Sympathetic, not cowardly." },
      { position: 0.18, name: "Meeting the Mentor",     fn: "SETUP",              scene_type: "scene",  tempo: "medium", desc: "Guide appears with wisdom or tools. Relationship has texture." },
      { position: 0.25, name: "Crossing the Threshold", fn: "COMMITMENT",         scene_type: "scene",  tempo: "fast",   desc: "Hero leaves ordinary world. Point of no return. Deliberate choice." },
      { position: 0.35, name: "Tests, Allies, Enemies", fn: "PROMISE_OF_PREMISE", scene_type: "scene",  tempo: "fast",   desc: "Challenges in new world. Deliver genre promise." },
      { position: 0.45, name: "Approach to Inmost Cave",fn: "ESCALATION",         scene_type: "scene",  tempo: "medium", desc: "Approach central danger. Tension builds. Stakes crystallize." },
      { position: 0.50, name: "The Ordeal",             fn: "REVERSAL",           scene_type: "scene",  tempo: "fast",   desc: "Greatest challenge. Death and rebirth. Deepest fear confronted." },
      { position: 0.60, name: "Reward",                 fn: "PROMISE_OF_PREMISE", scene_type: "scene",  tempo: "medium", desc: "Hero gains the prize. Celebration premature. Show cost." },
      { position: 0.70, name: "The Road Back",          fn: "ESCALATION",         scene_type: "scene",  tempo: "fast",   desc: "Journey home is fraught. Antagonist pursues. New complications." },
      { position: 0.85, name: "The Resurrection",       fn: "CLIMAX",             scene_type: "scene",  tempo: "fast",   desc: "Final highest-stakes test. Old self dies so new self can live." },
      { position: 1.00, name: "Return with the Elixir", fn: "RESOLUTION",         scene_type: "sequel", tempo: "slow",   desc: "Hero returns transformed. Mirror opening. Gift for community." },
    ]
  },
  // ── NONFICTION TEMPLATES ────────────────────────────────────────────────────
  "argument-driven": {
    name: "Argument-Driven Nonfiction",
    category: "nonfiction",
    beats: [
      { position: 0,    name: "The Hook",              fn: "PROVOCATIVE_OPENING",    scene_type: "exposition",   tempo: "medium", desc: "Open with a startling fact, dramatic anecdote, or counterintuitive claim that makes the reader think 'Wait, really?' Establish why this topic matters RIGHT NOW. Create urgency." },
      { position: 0.08, name: "The Problem",            fn: "PROBLEM_STATEMENT",      scene_type: "exposition",   tempo: "medium", desc: "Define the problem the book solves. Make the reader feel the pain. Use data, statistics, or a vivid case study. The reader should think 'Yes, that's exactly my problem.'" },
      { position: 0.15, name: "Conventional Wisdom",    fn: "DEMOLITION",             scene_type: "analysis",     tempo: "fast",   desc: "Present what most people believe about this topic — then systematically demolish it. Show why the common approach fails. Use evidence, not opinion." },
      { position: 0.22, name: "The Framework",          fn: "THESIS_INTRODUCTION",    scene_type: "exposition",   tempo: "slow",   desc: "Introduce the book's core framework, model, or argument. This is the 'big idea.' Explain it clearly with an analogy or diagram. Don't prove it yet — just make it understandable and compelling." },
      { position: 0.30, name: "Deep Dive A",            fn: "EVIDENCE_BLOCK",         scene_type: "case_study",   tempo: "medium", desc: "First major evidence chapter. One detailed case study, research study, or historical example that proves the framework works. Go DEEP on one example rather than shallow on five." },
      { position: 0.38, name: "Deep Dive B",            fn: "EVIDENCE_BLOCK",         scene_type: "case_study",   tempo: "medium", desc: "Second evidence chapter. DIFFERENT type of evidence from Deep Dive A. If A was a personal story, B is research data. If A was historical, B is contemporary." },
      { position: 0.45, name: "The Objection",          fn: "COUNTERARGUMENT",        scene_type: "analysis",     tempo: "fast",   desc: "Steelman the best objection to the book's thesis. Present it honestly. Then address it with evidence and reasoning. Intellectual honesty." },
      { position: 0.52, name: "The Pivot",              fn: "REFRAME",                scene_type: "synthesis",    tempo: "slow",   desc: "Deepen the framework. Show a dimension the reader didn't expect. Connect two ideas that seemed unrelated. This is the 'aha moment' chapter." },
      { position: 0.60, name: "Application A",          fn: "PRACTICAL_APPLICATION",  scene_type: "how_to",       tempo: "medium", desc: "Make it actionable. Step-by-step implementation. Checklists, exercises, or protocols the reader can use TODAY. Specific, not vague." },
      { position: 0.68, name: "Application B",          fn: "PRACTICAL_APPLICATION",  scene_type: "how_to",       tempo: "medium", desc: "Advanced application or second domain. If Application A was for individuals, B is for teams/organizations. If A was basics, B is edge cases." },
      { position: 0.78, name: "The Bigger Picture",     fn: "SYNTHESIS",              scene_type: "analysis",     tempo: "slow",   desc: "Zoom out. Connect the book's thesis to broader trends, societal shifts, or philosophical questions. Show why this matters beyond the reader's immediate problem." },
      { position: 0.88, name: "The Transformation",     fn: "TRANSFORMATION_EVIDENCE",scene_type: "case_study",   tempo: "medium", desc: "A compelling before-and-after story. Someone (or an organization) that fully applied the framework and was transformed. Emotional payoff." },
      { position: 1.00, name: "The Send-Off",           fn: "CALL_TO_ACTION",         scene_type: "synthesis",    tempo: "slow",   desc: "Final chapter. Summarize the core message in one powerful paragraph. Issue a direct, personal call to action. End with an image or story that embodies the book's theme." },
    ]
  },
  "narrative-nonfiction": {
    name: "Narrative Nonfiction Arc",
    category: "nonfiction",
    beats: [
      { position: 0,    name: "The Scene",             fn: "COLD_OPEN",              scene_type: "scene_recreation", tempo: "fast",   desc: "Drop the reader into a vivid, specific moment. No context yet. Sensory details, real dialogue (from the record), urgency." },
      { position: 0.08, name: "The World Before",       fn: "CONTEXT_SETTING",        scene_type: "exposition",       tempo: "slow",   desc: "Pull back. Explain the world, the era, the community. Ground the reader in time and place." },
      { position: 0.15, name: "The Cast",               fn: "CHARACTER_INTRODUCTION", scene_type: "profile",          tempo: "medium", desc: "Introduce key real people. Not just names — motivations, contradictions, defining moments. Use primary sources." },
      { position: 0.22, name: "The Inciting Event",     fn: "INCITING_EVENT",         scene_type: "scene_recreation", tempo: "fast",   desc: "The event that sets everything in motion. Reconstruct from evidence. Cite sources, use documented facts." },
      { position: 0.30, name: "The Investigation",      fn: "EVIDENCE_TRAIL",         scene_type: "investigative",    tempo: "medium", desc: "Follow the trail. Documents, interviews, discoveries. The reader becomes a co-investigator." },
      { position: 0.40, name: "The Complications",      fn: "COMPLICATION",           scene_type: "scene_recreation", tempo: "fast",   desc: "Things get harder. New information contradicts earlier assumptions. A source recants. A new character enters." },
      { position: 0.50, name: "The Turning Point",      fn: "TURNING_POINT",          scene_type: "scene_recreation", tempo: "fast",   desc: "A moment that changes the trajectory. A discovery, a confession, a document." },
      { position: 0.60, name: "The Reckoning",          fn: "CONSEQUENCES",           scene_type: "analysis",         tempo: "slow",   desc: "What the turning point means. Connect to broader themes. Author's voice strongest here." },
      { position: 0.70, name: "The Unraveling",         fn: "ESCALATION_NF",          scene_type: "scene_recreation", tempo: "fast",   desc: "Events accelerate toward conclusion. Multiple threads converge." },
      { position: 0.80, name: "The Aftermath",          fn: "AFTERMATH",              scene_type: "profile",          tempo: "slow",   desc: "What happened to everyone after. Follow-up interviews, court records, obituaries." },
      { position: 0.90, name: "The Meaning",            fn: "THEMATIC_SYNTHESIS",     scene_type: "analysis",         tempo: "slow",   desc: "The author's final argument. What universal truth does this story illuminate?" },
      { position: 1.00, name: "The Echo",               fn: "CLOSING_IMAGE",          scene_type: "scene_recreation", tempo: "medium", desc: "Return to the opening scene or location. Show what has changed and what hasn't." },
    ]
  },
  "reference-structured": {
    name: "Reference / Educational Structure",
    category: "nonfiction",
    beats: [
      { position: 0,    name: "Why This Matters",      fn: "MOTIVATION",             scene_type: "exposition",  tempo: "medium", desc: "Establish why the reader should care. What will they be able to DO after reading this? Specific outcomes." },
      { position: 0.10, name: "Foundations",             fn: "FOUNDATION",             scene_type: "teaching",    tempo: "slow",   desc: "Essential building blocks. Define terms. Establish mental model. Accessible to complete beginners." },
      { position: 0.20, name: "Core Concept A",         fn: "CONCEPT_BLOCK",          scene_type: "teaching",    tempo: "medium", desc: "First major concept. Explain, demonstrate, practice. One concept per chapter." },
      { position: 0.30, name: "Core Concept B",         fn: "CONCEPT_BLOCK",          scene_type: "teaching",    tempo: "medium", desc: "Second concept. Build on Concept A. Show how they connect." },
      { position: 0.40, name: "Core Concept C",         fn: "CONCEPT_BLOCK",          scene_type: "teaching",    tempo: "medium", desc: "Third concept. Reader has a working toolkit. Introduce edge cases." },
      { position: 0.50, name: "Integration",             fn: "INTEGRATION",            scene_type: "synthesis",   tempo: "slow",   desc: "Bring all concepts together. Comprehensive example requiring A + B + C." },
      { position: 0.60, name: "Common Mistakes",         fn: "TROUBLESHOOTING",        scene_type: "analysis",    tempo: "fast",   desc: "What goes wrong. Anti-patterns. FAQ. 'If you see X, try Y.'" },
      { position: 0.70, name: "Advanced Technique A",    fn: "ADVANCED_BLOCK",         scene_type: "teaching",    tempo: "medium", desc: "Expert-level approach. Show expert's way vs beginner's way." },
      { position: 0.80, name: "Advanced Technique B",    fn: "ADVANCED_BLOCK",         scene_type: "teaching",    tempo: "medium", desc: "Second advanced technique. Can be independent." },
      { position: 0.90, name: "Real-World Application",  fn: "CASE_STUDY_NF",          scene_type: "case_study",  tempo: "medium", desc: "Complete real-world walkthrough. Show the decision-making process." },
      { position: 1.00, name: "What's Next",             fn: "ROADMAP",                scene_type: "synthesis",   tempo: "slow",   desc: "Where to go from here. Resources, communities, next-level topics." },
    ]
  },
  "investigative-nonfiction": {
    name: "Investigative / Exposé",
    category: "nonfiction",
    beats: [
      { position: 0,    name: "Something Is Wrong",    fn: "ANOMALY",                scene_type: "scene_recreation", tempo: "fast",   desc: "A detail that doesn't add up. A complaint, a death, a financial discrepancy." },
      { position: 0.08, name: "The Official Story",     fn: "OFFICIAL_NARRATIVE",     scene_type: "exposition",       tempo: "medium", desc: "What the institution says happened. Present their version fairly and completely." },
      { position: 0.15, name: "The First Crack",        fn: "FIRST_EVIDENCE",         scene_type: "investigative",    tempo: "fast",   desc: "First evidence contradicting the official story. A document, a whistleblower, a data anomaly." },
      { position: 0.25, name: "The Pattern",            fn: "PATTERN_RECOGNITION",    scene_type: "analysis",         tempo: "medium", desc: "One crack becomes many. Show it's systemic, not isolated." },
      { position: 0.35, name: "The Players",            fn: "CAST_OF_CHARACTERS",     scene_type: "profile",          tempo: "slow",   desc: "Who is responsible and who is affected. Profile key figures using their own words." },
      { position: 0.45, name: "The Mechanism",          fn: "MECHANISM",              scene_type: "analysis",         tempo: "medium", desc: "HOW it works. The specific system, loophole, or process. Clear enough for non-experts." },
      { position: 0.55, name: "The Cover-Up",           fn: "COVER_UP",               scene_type: "scene_recreation", tempo: "fast",   desc: "How they tried to hide it. Destroyed documents, silenced whistleblowers." },
      { position: 0.65, name: "The Human Cost",         fn: "IMPACT",                 scene_type: "profile",          tempo: "slow",   desc: "The victims. Real people, real consequences. No sensationalism." },
      { position: 0.75, name: "The Reckoning",          fn: "CONFRONTATION_NF",       scene_type: "scene_recreation", tempo: "fast",   desc: "The moment of exposure. The article, the lawsuit, the hearing, the arrest." },
      { position: 0.85, name: "The Fallout",            fn: "AFTERMATH_NF",           scene_type: "analysis",         tempo: "medium", desc: "What changed and what didn't. Be honest about incomplete justice." },
      { position: 1.00, name: "The Lesson",             fn: "SYSTEMIC_ANALYSIS",      scene_type: "synthesis",        tempo: "slow",   desc: "What does this case reveal about broader failures? What remains unresolved?" },
    ]
  },
};

function autoDetectTemplate(genre, bookType) {
  const g = (genre || '').toLowerCase();
  if (bookType === 'nonfiction') {
    if (/self.help|business|psychology|science|health/.test(g)) return 'argument-driven';
    if (/memoir|biography|history|true crime/.test(g)) return 'narrative-nonfiction';
    if (/reference|education|how.to|technical|cooking|technology/.test(g)) return 'reference-structured';
    if (/investigat|journalism|expos|politic/.test(g)) return 'investigative-nonfiction';
    return 'argument-driven';
  }
  if (/romance|erotica/.test(g)) return 'romance-arc';
  if (/thriller|mystery|suspense|crime|true crime/.test(g)) return 'thriller-tension';
  if (/fantasy|science fiction|adventure|epic/.test(g)) return 'heros-journey';
  return 'save-the-cat';
}

function assignBeatsToChapters(templateKey, chapterCount) {
  const template = BEAT_SHEET_TEMPLATES[templateKey];
  if (!template) return null;
  const isNF = template.category === 'nonfiction';

  // Map beats to chapter numbers
  const chapterBeats = {};
  for (const beat of template.beats) {
    const chNum = Math.min(chapterCount, Math.max(1, Math.round(beat.position * (chapterCount - 1)) + 1));
    if (!chapterBeats[chNum]) chapterBeats[chNum] = [];
    chapterBeats[chNum].push(beat);
  }

  const assignments = [];
  // Fiction fn priority
  const fictionFnPri = ['CLIMAX','CRISIS','REVERSAL','DISRUPTION','ESCALATION','PROMISE_OF_PREMISE','COMMITMENT','RECOMMITMENT','SUBPLOT','REACTION','REFLECTION','SETUP','RESOLUTION','CONNECTIVE_TISSUE'];
  // Nonfiction fn priority (most important first)
  const nfFnPri = ['CALL_TO_ACTION','CONFRONTATION_NF','TURNING_POINT','COLD_OPEN','ANOMALY','DEMOLITION','COUNTERARGUMENT','REFRAME','EVIDENCE_BLOCK','PRACTICAL_APPLICATION','SYNTHESIS','THESIS_INTRODUCTION','PROBLEM_STATEMENT','PROVOCATIVE_OPENING','CLOSING_IMAGE','THEMATIC_SYNTHESIS'];
  const fnPriority = isNF ? nfFnPri : fictionFnPri;
  const tempoPriority = { fast: 3, medium: 2, slow: 1 };

  for (let i = 1; i <= chapterCount; i++) {
    const beats = chapterBeats[i];
    if (beats && beats.length > 0) {
      if (beats.length === 1) {
        const b = beats[0];
        assignments.push({ chapter: i, beat_name: b.name, beat_function: b.fn, beat_scene_type: b.scene_type, beat_tempo: b.tempo, beat_description: b.desc });
      } else {
        const names = beats.map(b => b.name).join(' + ');
        const fns = beats.map(b => b.fn);
        const bestFn = fnPriority.find(f => fns.includes(f)) || fns[0];
        const bestTempo = beats.reduce((best, b) => (tempoPriority[b.tempo] || 0) > (tempoPriority[best] || 0) ? b.tempo : best, beats[0].tempo);
        // For nonfiction: pick first beat's scene_type (they're specific like "case_study"). For fiction: scene over sequel.
        const bestSceneType = isNF ? beats[0].scene_type : (beats.some(b => b.scene_type === 'scene') ? 'scene' : 'sequel');
        const desc = beats.map(b => b.desc).join(' ALSO: ');
        assignments.push({ chapter: i, beat_name: names, beat_function: bestFn, beat_scene_type: bestSceneType, beat_tempo: bestTempo, beat_description: desc });
      }
    } else {
      if (isNF) {
        assignments.push({ chapter: i, beat_name: 'Connective Chapter', beat_function: 'EVIDENCE_BLOCK', beat_scene_type: 'exposition', beat_tempo: 'medium', beat_description: 'Bridge chapter — deepen a thread from a previous chapter with additional evidence, examples, or analysis. Advance the book\'s central argument.' });
      } else {
        assignments.push({ chapter: i, beat_name: 'Connective Tissue', beat_function: 'CONNECTIVE_TISSUE', beat_scene_type: 'scene', beat_tempo: 'medium', beat_description: 'Bridge chapter — advance subplots, deepen relationships, maintain momentum. Must contain at least one irreversible event.' });
      }
    }
  }
  return { template_name: template.name, template_key: templateKey, category: template.category, assignments };
}

function buildBeatSheetPromptBlock(beatSheet) {
  if (!beatSheet || !beatSheet.assignments) return '';
  const isNF = beatSheet.category === 'nonfiction';
  const lines = beatSheet.assignments.map(a =>
    `CHAPTER ${a.chapter} — Beat: "${a.beat_name}" | Function: ${a.beat_function} | Mode: ${a.beat_scene_type} | Tempo: ${a.beat_tempo}\n  → ${a.beat_description}`
  ).join('\n\n');

  if (isNF) {
    return `=== STRUCTURAL BEAT SHEET (MANDATORY — EACH CHAPTER MUST FOLLOW ITS ASSIGNED ROLE) ===

This nonfiction book uses the "${beatSheet.template_name}" structure. Each chapter has a pre-assigned STRUCTURAL ROLE that dictates what kind of chapter it is. You MUST follow these assignments.

${lines}

NONFICTION BEAT ENFORCEMENT RULES:

1. FUNCTION determines the chapter's JOB — see the beat descriptions above for specific requirements.

2. SCENE_TYPE determines the chapter's MODE:
   - "exposition" = AUTHOR EXPLAINS. Thesis, context, analysis. Author's voice carries the chapter.
   - "case_study" = SPECIFIC EXAMPLE carries the chapter. One story, one study, one person in depth.
   - "analysis" = AUTHOR ARGUES. Weighing evidence, comparing viewpoints, drawing conclusions.
   - "how_to" = READER DOES. Step-by-step, actionable, practical. Checklists and exercises.
   - "synthesis" = CONNECTING ideas. Zooming out. Finding patterns across earlier chapters.
   - "scene_recreation" = RECONSTRUCTING a real event. Primary sources. Never invent dialogue.
   - "profile" = INTRODUCING real people. Primary sources, contradictions, motivations.
   - "investigative" = FOLLOWING a trail. Documents, interviews, evidence.
   - "teaching" = INSTRUCTING. Concept → Example → Counter-example → Practice.

3. TEMPO determines PACING:
   - "fast" = Short paragraphs. Punchy facts. Urgency. No meandering.
   - "medium" = Balanced. Evidence and analysis interwoven.
   - "slow" = Long reflective passages. Deep analysis. Rich context.
   - NEVER same tempo for more than 2 consecutive chapters.

4. NO REPEATED CHAPTER SHAPES: Rotate between establishing the problem, demolishing myths, presenting evidence, telling a case study, making it actionable, addressing objections, zooming out, profiling a key figure, reconstructing an event, synthesizing themes.

5. CRITICAL NONFICTION RULES:
   - This is NONFICTION. Do NOT describe fictional scenes, invented dialogue, or imagined characters.
   - Do NOT use fiction pacing structures (rising action, climax, denouement).
   - Use ARGUMENT structure: claim → evidence → analysis → synthesis.
   - Vignettes and anecdotes are ILLUSTRATIONS — ratio of 1 part anecdote to 4 parts analysis.
   - Do NOT end chapters with fiction-style cliffhangers. End with: a provocative question, a bridge to the next topic, or a reframed understanding.

=== END BEAT SHEET ===`;
  }

  // Fiction version
  return `=== STRUCTURAL BEAT SHEET (MANDATORY — EACH CHAPTER MUST FOLLOW ITS ASSIGNED ROLE) ===

This book uses the "${beatSheet.template_name}" structure. Each chapter has a pre-assigned STRUCTURAL ROLE. You MUST follow these. Do NOT give two chapters the same dramatic shape.

${lines}

BEAT ENFORCEMENT RULES:
1. FUNCTION determines the chapter's JOB:
   - SETUP: Establish character, world, stakes. No major conflict yet.
   - DISRUPTION: Something external forces change. An EVENT, not a conversation.
   - REACTION (sequel): Character PROCESSES what happened. Internal. Slow. No new characters.
   - COMMITMENT: Character makes an ACTIVE CHOICE. Not passive. A decision.
   - SUBPLOT: Focus shifts to B-story. Different tone.
   - PROMISE_OF_PREMISE: Deliver what the genre PROMISES. This is why the reader bought the book.
   - REVERSAL: Everything changes. New information. The ground shifts.
   - ESCALATION: Stakes rise. Pressure mounts.
   - CRISIS: The lowest point. Something irreversible and devastating.
   - REFLECTION (sequel): Process the crisis. Grief. No plot advancement.
   - RECOMMITMENT: Character understands the theme and chooses a new path.
   - CLIMAX: All threads converge. Maximum intensity.
   - RESOLUTION: Aftermath. Mirror the opening. Show transformation.
   - CONNECTIVE_TISSUE: Bridge chapter. Must still contain one irreversible event.

2. SCENE_TYPE determines MODE:
   - "scene" = ACTION: Goal → Conflict → Outcome. Things HAPPEN.
   - "sequel" = REACTION: Process → Dilemma → Decision. Slower pace.
   - NEVER two "sequel" chapters in a row.
   - NEVER more than two "scene" chapters in a row without a "sequel."

3. TEMPO determines PACING:
   - "fast" = Short paragraphs, rapid dialogue, physical action, urgency
   - "medium" = Balanced mix
   - "slow" = Long paragraphs, internal monologue, sensory detail, no urgency
   - NEVER same tempo for more than 2 consecutive chapters.

4. ESCALATION RATCHET: Each chapter must have a ONE-WAY DOOR — an irreversible event, revelation, or choice.

5. NO REPEATED CHAPTER SHAPES: Every chapter must have a DIFFERENT central activity.

=== END BEAT SHEET ===`;
}

function buildChapterBeatBlock(assignment, isNonfiction) {
  if (!assignment) return '';

  if (isNonfiction) {
    const nfModeRules = {
      'exposition': 'AUTHOR EXPLAINS. Your analytical voice carries this chapter. Present context, define terms, build the argument.',
      'case_study': 'ONE DEEP EXAMPLE. Pick one story, study, or person and go DEEP. Do not skim five examples — drill into one. Specific names, dates, places, outcomes.',
      'analysis': 'ARGUE. Weigh evidence. Compare viewpoints. Draw conclusions. Acknowledge uncertainty, address objections, then make your case.',
      'how_to': 'MAKE IT ACTIONABLE. Step 1, Step 2, Step 3. Specific enough that the reader can start TODAY. Checklists, exercises, templates.',
      'synthesis': 'CONNECT. Link ideas from earlier chapters. Show patterns. Zoom out from details to big picture.',
      'scene_recreation': 'RECONSTRUCT a real event with cinematic detail. Use primary sources. Never invent dialogue. Present tense for immediacy.',
      'profile': 'INTRODUCE real people as three-dimensional humans. Use their own words. Show contradictions.',
      'investigative': 'FOLLOW THE TRAIL. Present evidence in discovery order. Let the reader process clues alongside you.',
      'teaching': 'INSTRUCT. Concept → Example → Counter-example → Practice. One concept per section.',
    };
    const modeRule = nfModeRules[assignment.beat_scene_type] || '';
    return `=== THIS CHAPTER'S STRUCTURAL ROLE ===
Beat: "${assignment.beat_name}" | Function: ${assignment.beat_function} | Mode: ${assignment.beat_scene_type} | Tempo: ${assignment.beat_tempo}

NONFICTION STRUCTURAL RULES:
- Mode "${assignment.beat_scene_type}": ${modeRule}
- If fast tempo: Short paragraphs. Punchy facts. Urgency. No meandering.
- If medium tempo: Balanced. Evidence and analysis interwoven.
- If slow tempo: Long reflective passages. Deep analysis. Rich context.

CRITICAL NONFICTION RULES:
- This is NONFICTION. Do NOT write fictional scenes, invented dialogue, or imagined characters.
- Do NOT use fiction pacing (rising action, climax, denouement). Use ARGUMENT structure (claim, evidence, analysis, synthesis).
- Author's analytical voice is the backbone. Vignettes = illustrations — ratio 1:4 anecdote to analysis.
- Every claim must be grounded in evidence, research, or documented experience.
- Do NOT end with fiction-style cliffhangers. End with: a provocative question, a bridge to the next topic, or a reframed understanding.
=== END STRUCTURAL ROLE ===`;
  }

  // Fiction version
  const fnRules = {
    'SETUP': 'Establish, don\'t resolve. Plant questions. Reader finishes CURIOUS, not satisfied.',
    'DISRUPTION': 'A concrete external EVENT. Not a conversation. Not a feeling. Something that changes the protagonist\'s situation.',
    'PROMISE_OF_PREMISE': 'MUST deliver what the genre promises. Erotica = actual intimate scenes. Thriller = actual danger. Do NOT defer to a later chapter.',
    'REVERSAL': 'Something believed must be proven WRONG. New information reframes everything.',
    'CRISIS': 'Something irreversible and devastating. Protagonist WORSE OFF than at start.',
    'REFLECTION': 'NO new plot. NO new characters. Protagonist sits with failure/loss. Must be genuinely sad/angry/lost.',
    'REACTION': 'Character PROCESSES what happened. Internal monologue, dilemma, decision. No new plot events.',
    'CLIMAX': 'Maximum intensity. All threads converge. Protagonist acts differently than Chapter 1. Every named character accounted for.',
    'RESOLUTION': 'Mirror opening. Show transformation. End on resonant image, not summary.',
    'COMMITMENT': 'Character makes a DELIBERATE CHOICE. Not something happening TO them.',
    'RECOMMITMENT': 'Character understands the theme and chooses a new approach requiring growth.',
    'ESCALATION': 'Stakes rise. Pressure mounts. Consequences from earlier chapters compound.',
    'SUBPLOT': 'Focus shifts to B-story. Different tone from main plot. Still advances overall narrative.',
    'CONNECTIVE_TISSUE': 'Bridge chapter. Advance subplots, deepen relationships. Must contain one irreversible event.',
  };
  const fnRule = fnRules[assignment.beat_function] || '';

  return `=== THIS CHAPTER'S STRUCTURAL ROLE ===
Beat: "${assignment.beat_name}" | Function: ${assignment.beat_function} | Mode: ${assignment.beat_scene_type} | Tempo: ${assignment.beat_tempo}

What this means for your writing:
- If scene: ACTION chapter. Things must HAPPEN. Goal → Conflict → Outcome. Max 20% internal reflection.
- If sequel: REACTION chapter. Character PROCESSES. Internal monologue, dilemma, decision. No new plot or characters. Min 40% internal thought.
- If fast tempo: Short paragraphs (2-4 sentences max). Rapid dialogue. Physical movement. Urgency.
- If medium tempo: Balanced. Equal action, dialogue, description.
- If slow tempo: Long flowing paragraphs. Rich sensory detail. Internal monologue. No urgency. Let moments breathe.

FUNCTION-SPECIFIC: ${fnRule}
=== END STRUCTURAL ROLE ===`;
}

function buildChapterBeatUserBlock(assignment, isNonfiction) {
  if (!assignment) return '';

  if (isNonfiction) {
    return `STRUCTURAL ROLE: This is a ${assignment.beat_function} chapter (beat: "${assignment.beat_name}"). Mode: ${assignment.beat_scene_type}. Tempo: ${assignment.beat_tempo}.
- This is NONFICTION. No fictional scenes, no invented dialogue, no imagined characters.
- If mode is case_study: Go DEEP on ONE example. Do not skim five. Names, dates, places, outcomes.
- If mode is how_to: Specific actionable steps. Not "think about your goals" but "Do X, then Y, then Z."
- If mode is analysis: ARGUE with evidence. Acknowledge the counterargument, then make your case.
- If mode is exposition: Your analytical voice carries this chapter. Build the argument.
- Chapter must advance the book's THESIS, not just present information.`;
  }

  return `STRUCTURAL ROLE: This is a ${assignment.beat_function} chapter (beat: "${assignment.beat_name}"). Mode: ${assignment.beat_scene_type}. Tempo: ${assignment.beat_tempo}.
- If scene: ACTION chapter — things must HAPPEN. Don't write people talking about doing things. Write them DOING things.
- If sequel: REACTION chapter — character must PROCESS. Internal monologue. No new plot. No new characters.
- This chapter must contain at least one IRREVERSIBLE EVENT (one-way door). If nothing changes permanently, the chapter has failed.`;
}

// Endpoint: returns templates list, or computes beat assignments for a project
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, genre, template_key, chapter_count } = body;

    if (action === 'list_templates') {
      const { book_type } = body;
      let list = Object.entries(BEAT_SHEET_TEMPLATES).map(([key, t]) => ({
        key, name: t.name, category: t.category, beat_count: t.beats.length
      }));
      // Filter by book_type if provided (hard wall)
      if (book_type) list = list.filter(t => t.category === book_type);
      return Response.json({ templates: list });
    }

    if (action === 'assign') {
      const { book_type } = body;
      const resolvedKey = (template_key === 'auto' || !template_key) ? autoDetectTemplate(genre, book_type) : template_key;
      // Hard wall: verify template category matches book_type
      const tmpl = BEAT_SHEET_TEMPLATES[resolvedKey];
      if (book_type && tmpl && tmpl.category !== book_type) {
        return Response.json({ error: `Template "${resolvedKey}" is ${tmpl.category}, but book_type is ${book_type}. Use a ${book_type} template.` }, { status: 400 });
      }
      const result = assignBeatsToChapters(resolvedKey, chapter_count || 15);
      return Response.json(result);
    }

    if (action === 'get_prompt_blocks') {
      const { book_type } = body;
      const resolvedKey = (template_key === 'auto' || !template_key) ? autoDetectTemplate(genre, book_type) : template_key;
      const beatSheet = assignBeatsToChapters(resolvedKey, chapter_count || 15);
      const isNF = beatSheet.category === 'nonfiction';
      return Response.json({
        outline_block: buildBeatSheetPromptBlock(beatSheet),
        chapter_blocks: beatSheet.assignments.map(a => ({
          chapter: a.chapter,
          system_block: buildChapterBeatBlock(a, isNF),
          user_block: buildChapterBeatUserBlock(a, isNF),
        })),
      });
    }

    return Response.json({ error: 'Unknown action. Use: list_templates, assign, get_prompt_blocks' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});