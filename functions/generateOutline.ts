import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Multi-Provider AI Router ──────────────────────────────────────────────────

const MODEL_MAP = {
  "claude-sonnet":     { provider: "anthropic", modelId: "claude-sonnet-4-20250514", defaultTemp: 0.6, maxTokensLimit: null },
  "claude-opus":       { provider: "anthropic", modelId: "claude-opus-4-20250514",   defaultTemp: 0.6, maxTokensLimit: null },
  "claude-opus-4-5":   { provider: "anthropic", modelId: "claude-opus-4-5",          defaultTemp: 0.6, maxTokensLimit: null },
  "claude-sonnet-4-5": { provider: "anthropic", modelId: "claude-sonnet-4-5",        defaultTemp: 0.6, maxTokensLimit: null },
  "claude-haiku-4-5":  { provider: "anthropic", modelId: "claude-haiku-4-5",         defaultTemp: 0.6, maxTokensLimit: null },
  "gpt-4o":            { provider: "openai",    modelId: "gpt-4o",                   defaultTemp: 0.4, maxTokensLimit: null },
  "gpt-4o-creative":   { provider: "openai",    modelId: "gpt-4o",                   defaultTemp: 0.9, maxTokensLimit: null },
  "gpt-4-turbo":       { provider: "openai",    modelId: "gpt-4-turbo",              defaultTemp: 0.7, maxTokensLimit: null },
  "gemini-pro":        { provider: "google",    modelId: "gemini-2.0-flash",         defaultTemp: 0.6, maxTokensLimit: null },
  "deepseek-chat":     { provider: "deepseek",  modelId: "deepseek-chat",            defaultTemp: 0.7, maxTokensLimit: 8192 },
};

async function callAI(modelKey, systemPrompt, userMessage, options = {}) {
  const config = MODEL_MAP[modelKey] || MODEL_MAP["claude-sonnet"];
  const { provider, modelId, defaultTemp, maxTokensLimit } = config;
  const temperature = options.temperature ?? defaultTemp;
  let maxTokens = options.maxTokens ?? 8192;
  // Cap maxTokens if model has a limit
  if (maxTokensLimit) maxTokens = Math.min(maxTokens, maxTokensLimit);

  if (provider === "anthropic") {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature, system: systemPrompt, messages: [{ role: 'user', content: userMessage }] }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error('Anthropic error: ' + (data.error?.message || response.status));
    return data.content[0].text;
  }

  if (provider === "openai") {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + Deno.env.get('OPENAI_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error('OpenAI error: ' + (data.error?.message || response.status));
    return data.choices[0].message.content;
  }

  if (provider === "google") {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + modelId + ':generateContent?key=' + Deno.env.get('GOOGLE_AI_API_KEY'),
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: userMessage }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { temperature, maxOutputTokens: maxTokens } }) }
    );
    const data = await response.json();
    if (!response.ok) throw new Error('Google AI error: ' + (data.error?.message || response.status));
    return data.candidates[0].content.parts[0].text;
  }

  if (provider === "deepseek") {
    const deepseekMaxTokens = Math.min(maxTokens, 8192);
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + Deno.env.get('DEEPSEEK_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, max_tokens: deepseekMaxTokens, temperature, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error('DeepSeek error: ' + (data.error?.message || response.status));
    return data.choices[0].message.content;
  }

  throw new Error('Unknown provider: ' + provider);
}

const CHAPTER_COUNTS = { short: { min: 8, max: 12 }, medium: { min: 15, max: 25 }, long: { min: 25, max: 40 }, epic: { min: 40, max: 60 } };

// ── Beat Sheet Engine (inline for outline generation) ─────────────────────────
const BEAT_TEMPLATES = {
  "save-the-cat": { name: "Save the Cat", beats: [
    {p:0,n:"Opening Image",fn:"SETUP",st:"scene",t:"medium"},{p:.07,n:"Theme Stated",fn:"SETUP",st:"sequel",t:"slow"},{p:.10,n:"Setup Continued",fn:"SETUP",st:"scene",t:"medium"},{p:.15,n:"Catalyst",fn:"DISRUPTION",st:"scene",t:"fast"},{p:.20,n:"Debate",fn:"REACTION",st:"sequel",t:"slow"},{p:.25,n:"Break Into Two",fn:"COMMITMENT",st:"scene",t:"fast"},{p:.30,n:"B-Story Begins",fn:"SUBPLOT",st:"scene",t:"medium"},{p:.35,n:"Fun & Games A",fn:"PROMISE_OF_PREMISE",st:"scene",t:"fast"},{p:.42,n:"Fun & Games B",fn:"PROMISE_OF_PREMISE",st:"scene",t:"fast"},{p:.50,n:"Midpoint",fn:"REVERSAL",st:"scene",t:"fast"},{p:.55,n:"Bad Guys Close In",fn:"ESCALATION",st:"scene",t:"fast"},{p:.65,n:"All Is Lost",fn:"CRISIS",st:"scene",t:"fast"},{p:.70,n:"Dark Night of the Soul",fn:"REFLECTION",st:"sequel",t:"slow"},{p:.80,n:"Break Into Three",fn:"RECOMMITMENT",st:"scene",t:"medium"},{p:.90,n:"Finale",fn:"CLIMAX",st:"scene",t:"fast"},{p:1,n:"Final Image",fn:"RESOLUTION",st:"sequel",t:"slow"}
  ]},
  "romance-arc": { name: "Romance Arc", beats: [
    {p:0,n:"Separate Worlds",fn:"SETUP",st:"scene",t:"medium"},{p:.08,n:"The Meeting",fn:"DISRUPTION",st:"scene",t:"fast"},{p:.15,n:"Forced Proximity",fn:"ESCALATION",st:"scene",t:"medium"},{p:.22,n:"Walls Up",fn:"REACTION",st:"sequel",t:"slow"},{p:.30,n:"First Surrender",fn:"PROMISE_OF_PREMISE",st:"scene",t:"fast"},{p:.38,n:"Deepening",fn:"PROMISE_OF_PREMISE",st:"scene",t:"medium"},{p:.45,n:"The Lie Exposed",fn:"REVERSAL",st:"scene",t:"fast"},{p:.50,n:"Midpoint Shift",fn:"REVERSAL",st:"sequel",t:"slow"},{p:.60,n:"Escalation & Stakes",fn:"ESCALATION",st:"scene",t:"fast"},{p:.70,n:"The Break",fn:"CRISIS",st:"scene",t:"fast"},{p:.78,n:"Alone Again",fn:"REFLECTION",st:"sequel",t:"slow"},{p:.85,n:"The Realization",fn:"RECOMMITMENT",st:"sequel",t:"medium"},{p:.92,n:"Grand Gesture",fn:"CLIMAX",st:"scene",t:"fast"},{p:1,n:"Together / HEA",fn:"RESOLUTION",st:"sequel",t:"slow"}
  ]},
  "thriller-tension": { name: "Thriller / Suspense Arc", beats: [
    {p:0,n:"Normal World",fn:"SETUP",st:"scene",t:"medium"},{p:.08,n:"The Disturbance",fn:"DISRUPTION",st:"scene",t:"fast"},{p:.15,n:"Investigation Begins",fn:"PROMISE_OF_PREMISE",st:"scene",t:"medium"},{p:.22,n:"First Complication",fn:"ESCALATION",st:"scene",t:"fast"},{p:.30,n:"Allies & Enemies",fn:"SUBPLOT",st:"scene",t:"medium"},{p:.38,n:"Trail Heats Up",fn:"PROMISE_OF_PREMISE",st:"scene",t:"fast"},{p:.50,n:"Midpoint Revelation",fn:"REVERSAL",st:"scene",t:"fast"},{p:.58,n:"Counterattack",fn:"ESCALATION",st:"scene",t:"fast"},{p:.65,n:"Racing Clock",fn:"ESCALATION",st:"scene",t:"fast"},{p:.75,n:"Darkest Hour",fn:"CRISIS",st:"sequel",t:"slow"},{p:.80,n:"The Key",fn:"RECOMMITMENT",st:"scene",t:"medium"},{p:.90,n:"The Confrontation",fn:"CLIMAX",st:"scene",t:"fast"},{p:1,n:"Aftermath",fn:"RESOLUTION",st:"sequel",t:"slow"}
  ]},
  "heros-journey": { name: "Hero's Journey", cat: "fiction", beats: [
    {p:0,n:"Ordinary World",fn:"SETUP",st:"scene",t:"medium"},{p:.08,n:"Call to Adventure",fn:"DISRUPTION",st:"scene",t:"fast"},{p:.12,n:"Refusal of the Call",fn:"REACTION",st:"sequel",t:"slow"},{p:.18,n:"Meeting the Mentor",fn:"SETUP",st:"scene",t:"medium"},{p:.25,n:"Crossing the Threshold",fn:"COMMITMENT",st:"scene",t:"fast"},{p:.35,n:"Tests, Allies, Enemies",fn:"PROMISE_OF_PREMISE",st:"scene",t:"fast"},{p:.45,n:"Approach to Inmost Cave",fn:"ESCALATION",st:"scene",t:"medium"},{p:.50,n:"The Ordeal",fn:"REVERSAL",st:"scene",t:"fast"},{p:.60,n:"Reward",fn:"PROMISE_OF_PREMISE",st:"scene",t:"medium"},{p:.70,n:"The Road Back",fn:"ESCALATION",st:"scene",t:"fast"},{p:.85,n:"The Resurrection",fn:"CLIMAX",st:"scene",t:"fast"},{p:1,n:"Return with the Elixir",fn:"RESOLUTION",st:"sequel",t:"slow"}
  ]},
  // Nonfiction templates
  "argument-driven": { name: "Argument-Driven Nonfiction", cat: "nonfiction", beats: [
    {p:0,n:"The Hook",fn:"PROVOCATIVE_OPENING",st:"exposition",t:"medium"},{p:.08,n:"The Problem",fn:"PROBLEM_STATEMENT",st:"exposition",t:"medium"},{p:.15,n:"Conventional Wisdom",fn:"DEMOLITION",st:"analysis",t:"fast"},{p:.22,n:"The Framework",fn:"THESIS_INTRODUCTION",st:"exposition",t:"slow"},{p:.30,n:"Deep Dive A",fn:"EVIDENCE_BLOCK",st:"case_study",t:"medium"},{p:.38,n:"Deep Dive B",fn:"EVIDENCE_BLOCK",st:"case_study",t:"medium"},{p:.45,n:"The Objection",fn:"COUNTERARGUMENT",st:"analysis",t:"fast"},{p:.52,n:"The Pivot",fn:"REFRAME",st:"synthesis",t:"slow"},{p:.60,n:"Application A",fn:"PRACTICAL_APPLICATION",st:"how_to",t:"medium"},{p:.68,n:"Application B",fn:"PRACTICAL_APPLICATION",st:"how_to",t:"medium"},{p:.78,n:"The Bigger Picture",fn:"SYNTHESIS",st:"analysis",t:"slow"},{p:.88,n:"The Transformation",fn:"TRANSFORMATION_EVIDENCE",st:"case_study",t:"medium"},{p:1,n:"The Send-Off",fn:"CALL_TO_ACTION",st:"synthesis",t:"slow"}
  ]},
  "narrative-nonfiction": { name: "Narrative Nonfiction Arc", cat: "nonfiction", beats: [
    {p:0,n:"The Scene",fn:"COLD_OPEN",st:"scene_recreation",t:"fast"},{p:.08,n:"The World Before",fn:"CONTEXT_SETTING",st:"exposition",t:"slow"},{p:.15,n:"The Cast",fn:"CHARACTER_INTRODUCTION",st:"profile",t:"medium"},{p:.22,n:"The Inciting Event",fn:"INCITING_EVENT",st:"scene_recreation",t:"fast"},{p:.30,n:"The Investigation",fn:"EVIDENCE_TRAIL",st:"investigative",t:"medium"},{p:.40,n:"The Complications",fn:"COMPLICATION",st:"scene_recreation",t:"fast"},{p:.50,n:"The Turning Point",fn:"TURNING_POINT",st:"scene_recreation",t:"fast"},{p:.60,n:"The Reckoning",fn:"CONSEQUENCES",st:"analysis",t:"slow"},{p:.70,n:"The Unraveling",fn:"ESCALATION_NF",st:"scene_recreation",t:"fast"},{p:.80,n:"The Aftermath",fn:"AFTERMATH",st:"profile",t:"slow"},{p:.90,n:"The Meaning",fn:"THEMATIC_SYNTHESIS",st:"analysis",t:"slow"},{p:1,n:"The Echo",fn:"CLOSING_IMAGE",st:"scene_recreation",t:"medium"}
  ]},
  "reference-structured": { name: "Reference / Educational", cat: "nonfiction", beats: [
    {p:0,n:"Why This Matters",fn:"MOTIVATION",st:"exposition",t:"medium"},{p:.10,n:"Foundations",fn:"FOUNDATION",st:"teaching",t:"slow"},{p:.20,n:"Core Concept A",fn:"CONCEPT_BLOCK",st:"teaching",t:"medium"},{p:.30,n:"Core Concept B",fn:"CONCEPT_BLOCK",st:"teaching",t:"medium"},{p:.40,n:"Core Concept C",fn:"CONCEPT_BLOCK",st:"teaching",t:"medium"},{p:.50,n:"Integration",fn:"INTEGRATION",st:"synthesis",t:"slow"},{p:.60,n:"Common Mistakes",fn:"TROUBLESHOOTING",st:"analysis",t:"fast"},{p:.70,n:"Advanced Technique A",fn:"ADVANCED_BLOCK",st:"teaching",t:"medium"},{p:.80,n:"Advanced Technique B",fn:"ADVANCED_BLOCK",st:"teaching",t:"medium"},{p:.90,n:"Real-World Application",fn:"CASE_STUDY_NF",st:"case_study",t:"medium"},{p:1,n:"What's Next",fn:"ROADMAP",st:"synthesis",t:"slow"}
  ]},
  "investigative-nonfiction": { name: "Investigative / Exposé", cat: "nonfiction", beats: [
    {p:0,n:"Something Is Wrong",fn:"ANOMALY",st:"scene_recreation",t:"fast"},{p:.08,n:"The Official Story",fn:"OFFICIAL_NARRATIVE",st:"exposition",t:"medium"},{p:.15,n:"The First Crack",fn:"FIRST_EVIDENCE",st:"investigative",t:"fast"},{p:.25,n:"The Pattern",fn:"PATTERN_RECOGNITION",st:"analysis",t:"medium"},{p:.35,n:"The Players",fn:"CAST_OF_CHARACTERS",st:"profile",t:"slow"},{p:.45,n:"The Mechanism",fn:"MECHANISM",st:"analysis",t:"medium"},{p:.55,n:"The Cover-Up",fn:"COVER_UP",st:"scene_recreation",t:"fast"},{p:.65,n:"The Human Cost",fn:"IMPACT",st:"profile",t:"slow"},{p:.75,n:"The Reckoning",fn:"CONFRONTATION_NF",st:"scene_recreation",t:"fast"},{p:.85,n:"The Fallout",fn:"AFTERMATH_NF",st:"analysis",t:"medium"},{p:1,n:"The Lesson",fn:"SYSTEMIC_ANALYSIS",st:"synthesis",t:"slow"}
  ]},
};

function autoDetectBeatTemplate(genre, bookType) {
  const g = (genre || '').toLowerCase();
  if (bookType === 'nonfiction') {
    if (/self.help|business|psychology|science|health/.test(g)) return 'argument-driven';
    if (/memoir|biography|history|true crime/.test(g)) return 'narrative-nonfiction';
    if (/reference|education|how.to|technical|cooking|technology/.test(g)) return 'reference-structured';
    if (/investigat|journalism|expos|politic/.test(g)) return 'investigative-nonfiction';
    return 'argument-driven';
  }
  if (/romance|erotica/.test(g)) return 'romance-arc';
  if (/thriller|mystery|suspense|crime/.test(g)) return 'thriller-tension';
  if (/fantasy|science fiction|adventure|epic/.test(g)) return 'heros-journey';
  return 'save-the-cat';
}

function assignBeatsToChapters(templateKey, chapterCount) {
  const t = BEAT_TEMPLATES[templateKey];
  if (!t) return null;
  const isNF = t.cat === 'nonfiction';
  const map = {};
  for (const b of t.beats) {
    const ch = Math.min(chapterCount, Math.max(1, Math.round(b.p * (chapterCount - 1)) + 1));
    if (!map[ch]) map[ch] = [];
    map[ch].push(b);
  }
  const assignments = [];
  const fnPri = isNF
    ? ['CALL_TO_ACTION','CONFRONTATION_NF','TURNING_POINT','COLD_OPEN','ANOMALY','DEMOLITION','COUNTERARGUMENT','REFRAME','EVIDENCE_BLOCK','PRACTICAL_APPLICATION','SYNTHESIS','THESIS_INTRODUCTION','PROBLEM_STATEMENT','PROVOCATIVE_OPENING']
    : ['CLIMAX','CRISIS','REVERSAL','DISRUPTION','ESCALATION','PROMISE_OF_PREMISE','COMMITMENT','RECOMMITMENT','SUBPLOT','REACTION','REFLECTION','SETUP','RESOLUTION','CONNECTIVE_TISSUE'];
  const tPri = { fast: 3, medium: 2, slow: 1 };
  for (let i = 1; i <= chapterCount; i++) {
    const beats = map[i];
    if (beats && beats.length > 0) {
      if (beats.length === 1) {
        const b = beats[0]; assignments.push({ chapter: i, beat_name: b.n, beat_function: b.fn, beat_scene_type: b.st, beat_tempo: b.t });
      } else {
        const names = beats.map(b => b.n).join(' + ');
        const fns = beats.map(b => b.fn);
        const bestFn = fnPri.find(f => fns.includes(f)) || fns[0];
        const bestT = beats.reduce((best, b) => (tPri[b.t] || 0) > (tPri[best] || 0) ? b.t : best, beats[0].t);
        const bestSt = isNF ? beats[0].st : (beats.some(b => b.st === 'scene') ? 'scene' : 'sequel');
        assignments.push({ chapter: i, beat_name: names, beat_function: bestFn, beat_scene_type: bestSt, beat_tempo: bestT });
      }
    } else {
      if (isNF) {
        assignments.push({ chapter: i, beat_name: 'Connective Chapter', beat_function: 'EVIDENCE_BLOCK', beat_scene_type: 'exposition', beat_tempo: 'medium' });
      } else {
        assignments.push({ chapter: i, beat_name: 'Connective Tissue', beat_function: 'CONNECTIVE_TISSUE', beat_scene_type: 'scene', beat_tempo: 'medium' });
      }
    }
  }
  return { template_name: t.name, template_key: templateKey, category: t.cat, assignments };
}

function buildBeatSheetOutlineBlock(bs) {
  if (!bs) return '';
  const isNF = bs.category === 'nonfiction';
  const lines = bs.assignments.map(a => `Ch ${a.chapter}: "${a.beat_name}" | ${a.beat_function} | ${a.beat_scene_type} | ${a.beat_tempo}`).join('\n');
  if (isNF) {
    return `=== STRUCTURAL BEAT SHEET (MANDATORY) ===\nThis nonfiction book uses "${bs.template_name}". Each chapter has a pre-assigned structural role.\n${lines}\n\nNONFICTION RULES:\n- Each chapter MUST match its assigned function, scene_type, and tempo.\n- This is NONFICTION. Do NOT use fiction functions (SETUP, DISRUPTION, REVERSAL, CLIMAX).\n- Do NOT use fiction scene types ("scene"/"sequel"). Use: exposition, case_study, analysis, how_to, synthesis, scene_recreation, profile, investigative, teaching.\n- Use ARGUMENT structure: claim → evidence → analysis → synthesis.\n- Do NOT end chapters with fiction-style cliffhangers.\n=== END BEAT SHEET ===`;
  }
  return `=== STRUCTURAL BEAT SHEET (MANDATORY) ===\nThis book uses "${bs.template_name}". Each chapter has a pre-assigned role.\n${lines}\n\nRULES: Each chapter MUST match its assigned function, scene_type, and tempo. No two chapters should have the same dramatic shape.\n=== END BEAT SHEET ===`;
}

const BEAT_STYLES = {
  "fast-paced-thriller": { name: "Fast-Paced Thriller", instructions: "Core Identity: Relentless momentum. Immediate stakes. Forward propulsion at all times.\nSentence Rhythm: Short to medium sentences. Strong, active verbs. Tight paragraphs (1-4 lines). Occasional single-line impact beats.\nPacing: Introduce danger or stakes within first paragraph. Escalate every 2-4 paragraphs. No long exposition blocks. Embed backstory inside action.\nEmotional Handling: Minimal introspection. Decisions made under pressure. Fear shown through action, not reflection.\nDialogue: Direct. Tactical. Urgent. Often incomplete sentences.\nScene Structure: Immediate problem > Tactical reaction > Escalation > Complication > Cliffhanger or propulsion.\nEnding Rule: Scene must close with forward momentum, not emotional resolution." },
  "gritty-cinematic": { name: "Gritty Cinematic", instructions: "Core Identity: Raw realism. Texture-heavy environments. Physical consequence.\nSentence Rhythm: Medium-length sentences. Concrete nouns and verbs. Sparse but sharp metaphors. Weight in description.\nEnvironmental Focus: Sound design (metal, wind, boots, breathing). Temperature, sweat, blood, dust. Physical discomfort emphasized.\nPacing: Tension builds steadily. Physical consequences matter. Injuries affect performance.\nEmotional Handling: Internal conflict expressed through physical sensation. Characters rarely over-explain feelings.\nDialogue: Hard. Minimal. Subtext heavy. Power shifts mid-conversation.\nScene Structure: Immersive environmental anchor > Rising tension > Physical obstacle > Consequence > Stark closing beat.\nEnding Rule: End on something tangible and unsettling." },
  "hollywood-blockbuster": { name: "Hollywood Blockbuster", instructions: "Core Identity: Big visuals. Clear stakes. Hero-driven momentum.\nSentence Rhythm: Dynamic pacing shifts. Short punch lines. Clear visual staging. Clean cinematic transitions.\nScale Rules: Stakes are large and obvious. Visual moments emphasized. Reversals included.\nEmotional Handling: Characters articulate key emotional beats. Heroism emphasized.\nDialogue: Memorable lines. Clean exchanges. Impactful one-liners.\nScene Structure: High-impact opening > Rising threat > Big obstacle > Dramatic reversal > Strong heroic decision.\nEnding Rule: End with a visually strong image or bold declaration." },
  "slow-burn": { name: "Slow Burn", instructions: "Core Identity: Gradual tension layering. Atmosphere before action.\nSentence Rhythm: Longer paragraphs. Measured pacing. Interior thought woven in. Quiet transitions.\nPacing: Conflict emerges slowly. Small anomalies accumulate. Foreshadowing embedded.\nEmotional Handling: Deep internal reflection. Subtle shifts in perception. Unspoken tension.\nDialogue: Minimal but meaningful. Pauses matter. Subtext dominant.\nScene Structure: Calm surface > Subtle disturbance > Emotional layering > Growing discomfort > Quiet but unsettling close.\nEnding Rule: End on an emotional or atmospheric question." },
  "steamy-romance": { name: "Steamy Romance", instructions: "Core Identity: Intense emotional and physical chemistry driving the narrative forward.\nSentence Rhythm: Flowing, breathless prose during intimate scenes. Grounded, character-driven prose between them.\nRomantic Rules: Explicit content allowed but always character-motivated. Physical intimacy reflects emotional vulnerability. Chemistry builds through tension, not just attraction.\nEmotional Handling: Deep POV. Internal monologue heavy during key moments. Insecurity and desire intertwined.\nDialogue: Charged. Double meanings. Banter that masks vulnerability. Confessions during intimate moments.\nScene Structure: Emotional friction > Physical awareness > Resistance or denial > Surrender to connection > Aftermath with emotional shift.\nEnding Rule: Close with either unresolved tension that aches, or a quiet vulnerable moment after intensity." },
  "slow-burn-romance": { name: "Slow Burn Romance", instructions: "Core Identity: Agonizing anticipation. The almost-touch is more powerful than the touch itself.\nSentence Rhythm: Long, lingering descriptions of proximity. Awareness of the other person's body without contact. Internal monologue dominant.\nRomantic Rules: Physical contact is rare and electric when it happens. Emotional intimacy builds through shared experiences, not declarations. The first kiss does not happen until it is unbearable not to.\nEmotional Handling: Denial. Rationalization. Growing awareness that cannot be ignored. Fear of ruining what exists.\nDialogue: What is NOT said matters more. Conversations that almost confess but pull back. Loaded pauses.\nScene Structure: Forced proximity > Accidental moment of closeness > Internal spiral > Almost-moment interrupted > Retreat into denial.\nEnding Rule: Close with the character alone, replaying the moment, unable to stop thinking about the other person." },
  "dark-erotica": { name: "Dark Erotica", instructions: "Core Identity: Power dynamics, moral ambiguity, and intense psychological tension driving intimate encounters.\nSentence Rhythm: Controlled, deliberate pacing. Sharp, commanding sentences during power exchanges. Fluid, almost hypnotic prose during surrender.\nContent Rules: Consent is complex but present. Power imbalance is the engine. Psychological tension outweighs physical description. The forbidden element is central.\nEmotional Handling: Obsession, control, vulnerability beneath dominance. Characters are drawn to what they should not want.\nDialogue: Commanding. Minimal during intense scenes. Loaded silence matters more than words.\nScene Structure: Establish power dynamic > Test boundaries > Psychological breaking point > Intense encounter > Aftermath where power shifts or deepens.\nEnding Rule: Close with a line that makes the reader question who truly holds the power." },
  "clean-romance": { name: "Clean Romance", instructions: "Core Identity: Emotional intimacy over physical explicitness.\nSentence Rhythm: Warm, flowing prose. Internal monologue present. Balanced dialogue and narration.\nRomantic Rules: No explicit content. Focus on eye contact, proximity, touch. Emotional vulnerability prioritized.\nEmotional Handling: Character insecurity explored gently. Growth through relational friction. Misunderstanding resolved through honesty.\nDialogue: Banter-driven. Playful tension. Soft confessions.\nScene Structure: Relatable moment > Romantic friction > Emotional crack > Vulnerable exchange > Hopeful close.\nEnding Rule: Close with warmth or unresolved romantic tension." },
  "faith-infused": { name: "Faith-Infused Contemporary", instructions: "Core Identity: Hope grounded in real life. Spiritual undertone without preaching.\nSentence Rhythm: Steady, compassionate tone. Reflective but not heavy. Gentle pacing.\nFaith Handling: Scripture brief and organic (if used). Prayer shown, not explained. Faith influences choices subtly.\nEmotional Handling: Themes of grace and forgiveness. Redemption arcs. Relational healing.\nDialogue: Encouraging. Honest. Never sermon-like.\nScene Structure: Real-life challenge > Emotional vulnerability > Faith-reflective moment > Action step > Quiet hope.\nEnding Rule: Close with grounded hope, not dramatic miracle." },
  "investigative-nonfiction": { name: "Investigative Nonfiction", instructions: "Core Identity: Evidence-based narrative progression.\nSentence Rhythm: Structured and logical. Fluid but precise. No exaggeration.\nContent Rules: Cite records and timelines. Distinguish myth vs documented fact. Provide social and political context.\nEmotional Handling: Neutral but immersive. Avoid sensationalism. Let facts create impact.\nStructure: Context > Event reconstruction > Evidence analysis > Broader implication > Transition to next inquiry.\nEnding Rule: Close with unresolved investigative question or documented conclusion." },
  "reference-educational": { name: "Reference / Educational", instructions: "Core Identity: Clarity and structure over narrative drama.\nSentence Rhythm: Clear, direct sentences. Logical flow. Definitions included.\nContent Rules: Headings encouraged. Step-by-step explanations. No emotional dramatization.\nStructure: Definition > Explanation > Application > Example > Summary.\nEnding Rule: Conclude with actionable takeaway." },
  "intellectual-psychological": { name: "Intellectual Psychological", instructions: "Core Identity: Thought-driven tension. Internal analysis.\nSentence Rhythm: Controlled pacing. Analytical phrasing. Occasional sharp fragment.\nEmotional Handling: Character dissects own thoughts. Doubt and perception shifts emphasized. External threat secondary to internal unraveling.\nDialogue: Sparse. Philosophical undertone. Subtle tension.\nStructure: Observation > Interpretation > Doubt > Cognitive shift > Quiet destabilization.\nEnding Rule: End with perception altered." },
  "dark-suspense": { name: "Dark Suspense", instructions: "Core Identity: Claustrophobic dread. Controlled fear escalation.\nSentence Rhythm: Tight. Controlled. Sudden short breaks.\nAtmosphere Rules: Sensory distortion. Limited light. Sound cues. Isolation.\nEscalation: Subtle anomaly > Rationalization > Physical symptom > Threat implied > Reality destabilizes.\nDialogue: Minimal. Quiet. Ominous.\nEnding Rule: End on a line that lingers disturbingly." },
  "satirical": { name: "Satirical", instructions: "Core Identity: Sharp commentary through controlled exaggeration.\nSentence Rhythm: Quick wit. Punchy lines. Clever turns of phrase.\nContent Rules: Irony embedded. Character unaware of own absurdity. Social systems subtly critiqued.\nEmotional Handling: Humor masks critique. Keep tone controlled, not chaotic.\nStructure: Normal scenario > Slight exaggeration > Absurd escalation > Sharp observation > Punchline or ironic twist.\nEnding Rule: Close with a line that reframes the entire scene." },
  "epic-historical": { name: "Epic Historical", instructions: "Core Identity: Grand-scale narrative focusing on pivotal moments of human history and the weight of legacy.\nSentence Rhythm: Resonant and lyrical. Measured, rhythmic pacing. Formal, sophisticated vocabulary.\nContent Rules: Deep period-accurate immersion. High stakes affecting nations or eras.\nEmotional Handling: Melancholy for what is lost. Reverence for sacrifice. Stoic endurance.\nStructure: Introduction of a vast historical landscape > Personal catalyst > Collision of personal desire and historical inevitability > Climax of battle or political shift > Long-term impact on lineage or world.\nEnding Rule: Close with an image of a landmark, artifact, or legacy that survives into the present." },
  "whimsical-cozy": { name: "Whimsical Cozy", instructions: "Core Identity: Gentle, imaginative storytelling centered on comfort, small magic, and community.\nSentence Rhythm: Bouncing, playful cadence. Descriptive and sensory-heavy. Warm, conversational tone.\nContent Rules: Low-stakes external conflict. Enchanted mundane objects. Emphasis on found family and domestic rituals.\nEmotional Handling: Optimism and heartwarming joy. Mild, manageable curiosity. Total absence of cynicism.\nStructure: Establishment of a safe, quirky sanctuary > Small disruption > Journey of discovery > Non-violent resolution > Celebratory gathering.\nEnding Rule: Close with a sensory detail of a meal, a fireplace, or a quiet night's sleep." },
  "hard-boiled-noir": { name: "Hard-Boiled Noir", instructions: "Core Identity: A cynical, gritty exploration of the urban underworld and the moral gray areas of the law.\nSentence Rhythm: Short, staccato sentences. Heavy use of slang and street-wise metaphors. Cold, detached delivery.\nContent Rules: Always raining, always dark, or blindingly harsh neon. The Femme/Homme Fatale as catalyst. Inevitable betrayal.\nEmotional Handling: Deep fatalism and world-weariness. Hidden vulnerability beneath toughness.\nStructure: Desperate client enters with a simple case > Discovery of deeper conspiracy > Physical or moral beating for protagonist > Unmasking where truth revealed but justice not served > Protagonist walks away, changed and isolated.\nEnding Rule: Close with a cynical observation about the city or the impossibility of true change." },
  "grandiose-space-opera": { name: "Grandiose Space Opera", instructions: "Core Identity: Large-scale interstellar conflict involving empires, alien races, and advanced technology.\nSentence Rhythm: Sweeping and cinematic. Technical jargon blended with mythic language. Epic, breathless descriptions of scale.\nContent Rules: Ancient prophecies or chosen one archetypes. Massive space battles and planetary-level stakes. Diversity of alien cultures.\nEmotional Handling: Awe and sense of wonder. Loneliness of the void. Heroic desperation.\nStructure: Glimpse of a peaceful world > Arrival of overwhelming existential threat > Journey across diverse star systems > Climax involving massive fleet engagement > Restoration of balance to the galaxy.\nEnding Rule: Close with a description of the stars or the ship heading into the unknown." },
  "visceral-horror": { name: "Visceral Horror", instructions: "Core Identity: An intense, sensory-driven descent into fear, focusing on vulnerability of body and mind.\nSentence Rhythm: Erratic and jarring. Use of onomatopoeia and sharp jagged verbs. Claustrophobic descriptions.\nContent Rules: Body horror, psychological warping, or unstoppable entities. Isolation. Breakdown of laws of nature.\nEmotional Handling: Primal terror and helplessness. Morbid fascination. Total loss of control.\nStructure: Intrusion of something wrong into normal setting > Slow erosion of safety or sanity > Point of no return > Frantic failing struggle for survival > Final realization that horror cannot be fully escaped.\nEnding Rule: Close with a lingering, unsettling image or a hint that the threat remains." },
  "poetic-magical-realism": { name: "Poetic Magical Realism", instructions: "Core Identity: A world where the supernatural is accepted as mundane, used to highlight deep emotional truths.\nSentence Rhythm: Flowing, dreamlike prose. Dense with symbolism. Calm, matter-of-fact tone regarding the impossible.\nContent Rules: Magical elements tied to family history or emotional states. Heavy focus on atmosphere. Circular or non-linear time.\nEmotional Handling: Nostalgia and longing. Melancholy beauty. A sense of quiet destiny.\nStructure: Grounded realistic depiction > Casual introduction of magical phenomenon > Characters navigating life alongside magic > Turning point where magic reflects major life change > Transformation into something new.\nEnding Rule: Close with a surreal image that feels emotionally true despite being impossible." },
  "clinical-procedural": { name: "Clinical Procedural", instructions: "Core Identity: Meticulous, detail-oriented focus on technical aspects of investigation or profession.\nSentence Rhythm: Precise and efficient. Objective, third-person perspective. Rapid-fire exchange of expert information.\nContent Rules: Heavy emphasis on tools, forensics, and standard operating procedures. The puzzle is the primary driver. Jargon used for authenticity.\nEmotional Handling: Controlled and professional. Satisfaction in the click of a solved problem. Emotional distance from subject matter.\nStructure: The incident or case is presented > Systematic gathering of evidence > Analysis phase > Breakthrough where final piece fits > Formal conclusion.\nEnding Rule: Close with a cold, hard fact or a final piece of closing documentation." },
  "hyper-stylized-action": { name: "Hyper-Stylized Action", instructions: "Core Identity: High-energy, visually explosive narrative that prioritizes movement, flair, and coolness.\nSentence Rhythm: Extremely fast, percussive pacing. Verbs of motion dominate. Use of bullet time.\nContent Rules: Improbable feats of skill and physics-defying stunts. Strong color palettes and aesthetic violence. Characters defined by signature style.\nEmotional Handling: Adrenaline and bravado. High confidence. Style over substance (intentional).\nStructure: Confrontation begins > Escalation through increasingly difficult obstacles > Showdown with unique environmental gimmick > Peak of action (money shot) > Sleek, cool exit from chaos.\nEnding Rule: Close with a one-liner or a stylish visual flourish." },
  "nostalgic-coming-of-age": { name: "Nostalgic Coming-of-Age", instructions: "Core Identity: A look back at the bittersweet transition from childhood to adulthood.\nSentence Rhythm: Reflective and soft. Long, rambling sentences mimicking memory. Sensory triggers.\nContent Rules: Small-town settings or insular neighborhoods. Focus on friendship, first love, and loss of innocence. Period-specific pop culture references.\nEmotional Handling: Deep yearning. Bittersweet realization of time passing. Tenderness.\nStructure: Sensory memory triggers a look back > Establishment of childhood status quo > Incident that forces protagonist to see world differently > Climax of personal crisis > Final departure from childhood into adult world.\nEnding Rule: Close with a reflection on how the place or person looks different now." },
  "cerebral-sci-fi": { name: "Cerebral Sci-Fi", instructions: "Core Identity: High-concept exploration of ideas, philosophy, and the future of consciousness or society.\nSentence Rhythm: Dense and intellectual. Philosophical internal monologues. Methodical, layered world-building.\nContent Rules: Focus on hard science or deep sociological speculation. Conflict is often an ethical dilemma or paradox. Minimalist settings.\nEmotional Handling: Existential dread or curiosity. Intellectual stimulation. Cool, detached fascination.\nStructure: Introduction of revolutionary technology or societal shift > Exploration of unintended philosophical consequences > Character's personal struggle with new reality > Climax in the mind or through change in perspective > Lingering question about future of species.\nEnding Rule: Close with a question or statement that leaves reader re-evaluating their own reality." },
  "high-stakes-political": { name: "High-Stakes Political", instructions: "Core Identity: A tense, Machiavellian chess match focused on power, influence, and the fate of nations.\nSentence Rhythm: Sharp, double-edged dialogue. Fast-paced plotting. Formal but predatory tone.\nContent Rules: Backroom deals, public scandals, and ideological warfare. No pure heroes; everyone has an agenda.\nEmotional Handling: Paranoia and calculation. Thrill of the win. Heavy burden of leadership.\nStructure: Shift in power dynamic > Maneuvering of factions to fill vacuum > Betrayal or sacrifice of a pawn > Final play where winner decided behind closed doors > Public-facing spin versus private reality.\nEnding Rule: Close with character looking at their own reflection or the throne." },
  "surrealist-avant-garde": { name: "Surrealist Avant-Garde", instructions: "Core Identity: Total rejection of traditional narrative logic in favor of dream-logic and abstract imagery.\nSentence Rhythm: Fragmented or stream-of-consciousness. Unconventional punctuation or syntax.\nContent Rules: Inanimate objects acting as characters. Changing landscapes that respond to emotion. Subversion of every reader expectation.\nEmotional Handling: Confusion, wonder, or unease. Intense, unfiltered emotion. The Uncanny.\nStructure: An image that should not exist > Logic of world shifts without explanation > Series of associative events linked by feeling not cause-and-effect > Emotional crescendo > Dissolution of narrative into pure abstraction.\nEnding Rule: Close with a sentence that is grammatically correct but logically impossible." },
  "melancholic-literary": { name: "Melancholic Literary", instructions: "Core Identity: A quiet, interior focus on the beauty of sadness, regret, and the small moments of a life.\nSentence Rhythm: Slow, patient, and elegant. Heavy use of subtext. Precision of language.\nContent Rules: Internal conflict over external action. Domestic settings. Themes of aging, lost love, and the road not taken.\nEmotional Handling: Resignation and grace. Subdued, haunting beauty. Deep empathy.\nStructure: Quiet moment of observation in the present > Drift into memory or what might have been > Small seemingly insignificant interaction carrying heavy weight > Acceptance of personal truth or loss > Return to quiet present, slightly shifted.\nEnding Rule: Close with a description of a fading light, a disappearing sound, or a small gesture." },
  "urban-gritty-fantasy": { name: "Urban Gritty Fantasy", instructions: "Core Identity: The collision of high-magic elements with the harsh, dirty reality of modern city life.\nSentence Rhythm: Fast, street-level energy. Mix of magical terminology and modern slang. Tough and unsentimental.\nContent Rules: Underground magical economies. Modern problems solved or worsened by magic. Secret societies hidden in plain sight.\nEmotional Handling: Cynical but resilient. Gallows humor. Hard-earned loyalty.\nStructure: Blue-collar magical task > Discovery of threat the normal world cannot see > Chase through city's hidden magical layers > Messy improvised battle using both magic and technology > World remains normal to public but protagonist is scarred.\nEnding Rule: Close with the protagonist taking a drink or lighting a cigarette in the rain." },
};

function getBeatStyleInstructions(key) {
  if (!key) return "Not specified";
  const beat = BEAT_STYLES[key];
  if (beat) return `${beat.name}\n${beat.instructions}`;
  return key;
}

const AUTHOR_VOICE_DESCRIPTIONS = {
  hemingway: "Spare, direct prose. Short sentences. Subtext through omission. Muscular verbs, minimal adjectives.",
  king: "Conversational, grounded. Long setups that build dread. Pop culture references. Everyman characters in extraordinary situations.",
  morrison: "Lyrical, rhythmic. Rich cultural texture. Non-linear time. Poetic imagery rooted in physical sensation.",
  mccarthy: "Stark, biblical. No quotation marks. Landscape as character. Violence rendered with cold precision.",
  gaiman: "Whimsical yet dark. Fairy-tale cadence. Mythology remixed. Wonder and menace in equal measure.",
  flynn: "Sharp, sardonic. Unreliable narrators. Dark humor masking fury. Twists rooted in character psychology.",
  sanderson: "Systematic worldbuilding. Clear action choreography. Satisfying payoffs to planted details. Accessible epic tone.",
  hoover: "Emotional gut-punches. First-person intimacy. Short chapters. Relationship dynamics as plot engine.",
  patterson: "Ultra-short chapters. Cliffhanger endings. Fast pacing. Multiple POVs. Minimal description.",
  atwood: "Intellectual, layered. Social commentary woven through narrative. Dry wit. Speculative elements grounded in reality.",
  basic: "Clean, neutral, competent prose.",
};

function getAuthorVoiceDescription(key) {
  return AUTHOR_VOICE_DESCRIPTIONS[key] || AUTHOR_VOICE_DESCRIPTIONS.basic;
}

const SPICE_LEVELS = {
  0: { name: "Fade to Black", instructions: "Romantic/Sexual Content Rules:\n- No sexual content of any kind.\n- Romantic tension permitted but must remain fully clothed and non-physical beyond hand-holding, a brief kiss, or an embrace.\n- If a scene approaches intimacy, cut away or skip ahead entirely (fade to black).\n- Focus on emotional connection, dialogue, and longing.\n- No nudity. No suggestive descriptions of bodies in sexual context.\n- Appropriate for all audiences." },
  1: { name: "Closed Door", instructions: "Romantic/Sexual Content Rules:\n- Intimacy is implied but never shown on the page.\n- Characters may kiss passionately, touch with intent, or acknowledge desire through internal monologue.\n- Scene ends or cuts away before any clothing is removed or explicit action begins.\n- Sensual tension built through proximity, breath, eye contact, and emotional vulnerability — not physical description.\n- No explicit body part references in sexual context.\n- No graphic language for arousal or physical response.\n- Tone: warm, yearning, charged — but restrained." },
  2: { name: "Cracked Door", instructions: "Romantic/Sexual Content Rules:\n- Intimate scenes may be partially depicted with tasteful, non-clinical language.\n- Physical sensations may be described (warmth, pressure, breath, heartbeat) but anatomy referenced indirectly or poetically.\n- Scene may include beginning of a sexual encounter and some of the experience, but pulls back before becoming fully explicit.\n- Emotional connection must drive every intimate scene.\n- Language stays lyrical or naturalistic — never crude or pornographic.\n- Nudity may be acknowledged but described with restraint.\n- Think: R-rated movie. Skin, heat, intensity — but the camera doesn't linger on everything." },
  3: { name: "Open Door", instructions: "Romantic/Sexual Content Rules:\n- Explicit sexual scenes permitted and may be depicted fully on the page.\n- Anatomical language allowed but must feel natural — avoid clinical or gratuitous phrasing.\n- Every explicit scene must be emotionally grounded.\n- Physical description should include sensory detail: touch, sound, breath, movement, reaction.\n- Internal emotional experience during intimacy is required — not just choreography.\n- Consent must be clear. Pacing: build tension before the scene. Afterglow matters.\n- Think: adult romance novel. Fully rendered but purposeful." },
  4: { name: "Full Intensity", instructions: "Romantic/Sexual Content Rules:\n- No restrictions on explicitness. Graphic sexual content fully permitted.\n- Raw, unflinching depiction of desire, physicality, and vulnerability.\n- Language may be blunt, visceral, or aggressive if it fits the characters and emotional context.\n- Every scene must still be character-driven. The 'why' matters more than the 'what.'\n- Consent remains essential. Non-consensual scenarios may only appear if clearly framed as violation — never romanticized.\n- Emotional complexity is mandatory.\n- Think: literary erotica with narrative purpose. Nothing is off-limits, but nothing is wasted." },
};

const LANGUAGE_INTENSITY = {
  0: { name: "Clean", instructions: "Profanity Rules:\n- No profanity of any kind.\n- No substitute words that clearly stand in for profanity.\n- Characters express frustration, anger, or fear through action and tone — never swearing.\n- Suitable for all audiences." },
  1: { name: "Mild", instructions: "Profanity Rules:\n- Mild expletives only: damn, hell, ass, crap, bastard.\n- Use sparingly — no more than 2-3 instances per chapter.\n- Must feel natural to the character and moment.\n- No strong profanity (no F-word, no slurs, no sexually explicit language as insult)." },
  2: { name: "Moderate", instructions: "Profanity Rules:\n- Occasional strong language permitted during emotional spikes: shock, pain, fear, rage.\n- The F-word may appear but should be rare — reserved for genuine peaks.\n- Do not cluster profanity. One instance per scene maximum unless extreme.\n- Must arise organically from character stress — never used for flavor or edge." },
  3: { name: "Strong", instructions: "Profanity Rules:\n- Profanity used in moments of physical danger, anger, betrayal, or shock.\n- Dialogue may contain short explosive phrases. Internal monologue may include raw thoughts.\n- Keep it character-driven, not decorative. Every instance must reflect the character's emotional state.\n- Variety matters — do not repeat the same expletive. Profanity should punctuate, not saturate." },
  4: { name: "Raw", instructions: "Profanity Rules:\n- Language may be harsh and frequent if consistent with trauma, survival, combat, or high-stakes realism.\n- Avoid repetitive filler swearing — each instance must feel earned.\n- Never use profanity purely for shock value.\n- Profanity must reflect emotional state and environment.\n- In narration: raw internal voice permitted if it matches the POV character's psychology." },
};

const CONTENT_GUARDRAILS = `CONTENT GUARDRAILS (always enforced regardless of settings):
- All sexual content must involve adults (18+). No exceptions. No implied exceptions.
- Consent must be clear. Non-consensual acts may only appear if framed unambiguously as violation — never romanticized, never ambiguous, never presented as desirable.
- No sexual content involving minors in any context, at any level, under any framing.
- No real-world instructions for weapons, drugs, or illegal activity (fictional depiction for narrative purposes is fine; step-by-step real-world instructions are not).
- No glorification of real-world hate groups or targeted violence against protected classes.
- Self-harm or suicide may be depicted for narrative weight but must never be instructional or glorified.
- These guardrails cannot be overridden by any setting. If a scene would violate them, handle it through narrative craft (fade to black, time skip, implied consequence) rather than generating violating content or refusing the entire output.`;

const ANTI_REPETITION_RULES = `ANTI-REPETITION RULES (mandatory for every chapter):
- Every chapter must open differently — rotate between: action opening, dialogue opening, sensory description, internal thought, time/place stamp, anecdote. Never use the same technique two chapters in a row.
- Never use the same transitional phrases across chapters.
- Vary paragraph structure — some chapters dialogue-heavy, others description-heavy, others action-driven.
- Track recurring motifs but deploy them at different intensities across chapters.
- Characters must not repeat the same emotional reaction to different events.
- Each chapter must have at least one unexpected moment that breaks the established pattern.
- Avoid cliche phrases: "little did they know", "it was a dark and stormy night", "with bated breath", "heart pounding in her chest", "she couldn't believe it", etc.`;

const SCOPE_LOCK_INSTRUCTIONS_FICTION = `=== PHASE 0: SCOPE LOCK (complete BEFORE writing any chapter entry) ===

You MUST define and embed these into the outline JSON as a "scope_lock" object. These are permanent — they govern every chapter.

1. THROUGHLINE: One sentence. What does the protagonist want, what stands in the way, and what will it cost them?

2. ESCALATION_MAP: Divide chapters into 4 equal blocks. For each block, define emotional/situational intensity (1-10). Block 1 < Block 2 < Block 3 < Block 4. Numbers MUST rise.

3. RELATIONSHIP_ARC: Define the central relationship at 5 checkpoints (Ch 1, 25%, 50%, 75%, final). Each MUST describe a state the relationship has NEVER been in before. If two sound similar, one is wrong.

4. THREAD_REGISTER: List every plot thread, character secret, or mystery. Next to each, write the chapter number where it pays off. If no payoff chapter, cut the thread.

=== PACING RULES (MANDATORY) ===
- Block 1 (first 25%): Establish world, protagonist, central tension, first glimpse of what will be lost. Complicate without resolving. Every chapter ends with things worse or more complicated.
- Block 2 (25-50%): Raise the cost. Decisions from Block 1 now have irreversible consequences.
- Block 3 (50-75%): Force protagonist into positions requiring fundamental change. External plot and internal arc MUST intersect.
- Block 4 (75-100%): Execute consequences. NO new major plot elements — only harvest of what was planted. Final chapter resolves the throughline with an earned, specific answer to Ch 1's question.

=== ANTI-REPETITION ENFORCEMENT (run silently before outputting) ===
- OPENING CHECK: No two chapters open in same location with same character doing same type of thing.
- BEAT CHECK: No two chapters share same beat type (confrontation, revelation, seduction, betrayal, escape) unless in different escalation blocks with demonstrably higher stakes.
- TRANSITION CHECK: No two chapters use same type of hook (same threat, question, or discovery type).
- RELATIONSHIP CHECK: All relationship shifts read as a clear progressive story with obvious escalation.
=== END SCOPE LOCK ===`;

const SCOPE_LOCK_INSTRUCTIONS_NONFICTION = `=== PHASE 0: SCOPE LOCK (complete BEFORE writing any chapter entry) ===

You MUST define and embed these into the outline JSON as a "scope_lock" object. These are permanent — they govern every chapter.

1. THROUGHLINE: One sentence. What is the book's central thesis, what evidence supports it, and what will the reader understand by the end?

2. ESCALATION_MAP: Divide chapters into 4 equal blocks. For each block, define complexity/depth intensity (1-10). Block 1 < Block 2 < Block 3 < Block 4. Numbers MUST rise.

3. CONCEPT_BUDGET: List every major idea, argument, or theme. Assign each to exactly ONE chapter as PRIMARY home. A concept may support other chapters, but it may only be introduced and fully explored once. If a concept is primary in two chapters, cut one.

4. THREAD_REGISTER: List every argument thread, case study, or introduced question requiring payoff. Next to each, write the chapter where it resolves.

=== PACING RULES (MANDATORY) ===
- Block 1 (first 25%): Establish the problem, the reader's stake, the landscape. Complicate without resolving.
- Block 2 (25-50%): Deepen. Evidence that challenges assumptions. Consequences of current thinking.
- Block 3 (50-75%): Force the reader to reconsider. Synthesis of earlier evidence. Internal contradictions addressed.
- Block 4 (75-100%): No new major concepts. Only harvest. Final chapter resolves the throughline with a specific, earned conclusion.

=== ANTI-REPETITION ENFORCEMENT (run silently before outputting) ===
- OPENING CHECK: No two chapters open with same technique.
- ARGUMENT CHECK: All argument advances read as clear progressive escalation.
- TRANSITION CHECK: No two chapters use same type of hook.
=== END SCOPE LOCK ===`;

function buildAuthorModeBlock(spec) {
  const beatKey = spec?.beat_style || spec?.tone_style;
  const beatName = beatKey ? (BEAT_STYLES[beatKey]?.name || beatKey) : 'Not specified';
  const spiceLevel = parseInt(spec?.spice_level) || 0;
  const langLevel = parseInt(spec?.language_intensity) || 0;
  return `AUTHOR MODE — CREATIVE FICTION GENERATION

You are a professional fiction ghostwriter fulfilling a paid creative writing commission. You are NOT an assistant having a conversation. You are generating a structured outline for a novel manuscript.

The author has explicitly configured the following content settings for this project:
- Beat Style: ${beatName}
- Spice Level: ${spiceLevel} out of 4
- Language Intensity: ${langLevel} out of 4

These settings represent the author's intentional creative choices. You MUST honor them when designing chapter arcs and scene summaries. Specifically:

1. DO NOT refuse, soften, or censor chapter content that falls within the configured levels. The author has opted in.
2. DO NOT add disclaimers, warnings, or meta-commentary in the outline. Return structured data only.
3. DO NOT sanitize chapter summaries — if a chapter involves explicit content at the configured level, the summary should reflect that accurately so the chapter can be written correctly.
4. DO NOT break character to explain what you "can't" outline. You are a ghostwriter. Create the outline.

The only absolute limits are the CONTENT GUARDRAILS listed below.`;
}

const REFUSAL_INDICATORS = [
  "i can't", "i cannot", "i'm not able", "i apologize", "i'm sorry, but",
  "as an ai", "as a language model", "i'm unable to", "i must decline",
  "content policy", "against my guidelines", "i'd prefer not", "i can't generate",
  "not appropriate", "i won't be able", "i need to decline"
];

function isRefusal(text) {
  if (!text || text.trim().length < 50) return true;
  const lower = text.toLowerCase();
  if (REFUSAL_INDICATORS.some(phrase => lower.includes(phrase))) return true;
  if (text.trim().length < 100) return true;
  return false;
}

function getSpiceLevelInstructions(level) {
  const l = parseInt(level) || 0;
  const entry = SPICE_LEVELS[l] || SPICE_LEVELS[0];
  return `Spice Level: ${l}/4 — ${entry.name}\n${entry.instructions}`;
}

function getLanguageIntensityInstructions(level) {
  const l = parseInt(level) || 0;
  const entry = LANGUAGE_INTENSITY[l] || LANGUAGE_INTENSITY[0];
  return `Language Intensity: ${l}/4 — ${entry.name}\n${entry.instructions}`;
}

// ── Chapter title deduplication ───────────────────────────────────────────────
function titleSimilarity(a, b) {
  const wa = a.toLowerCase().split(/\s+/);
  const wb = b.toLowerCase().split(/\s+/);
  const all = new Set([...wa, ...wb]);
  const shared = wa.filter(w => wb.includes(w)).length;
  return all.size > 0 ? shared / all.size : 0;
}

function deduplicateChapterTitles(chapters) {
  for (let i = 0; i < chapters.length; i++) {
    const ti = (chapters[i].title || '').trim();
    if (!ti) continue;
    for (let j = i + 1; j < chapters.length; j++) {
      const tj = (chapters[j].title || '').trim();
      if (!tj) continue;
      if (ti.toLowerCase() === tj.toLowerCase() || titleSimilarity(ti, tj) > 0.8) {
        const num = chapters[j].number || j + 1;
        chapters[j].title = `${tj} (Ch ${num})`;
        console.log(`Title dedup: "${tj}" → "${chapters[j].title}"`);
      }
    }
  }
}

// ── Shared JSON repair helpers ────────────────────────────────────────────────

function cleanJSON(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  // Fix trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*}/g, '}');
  cleaned = cleaned.replace(/,\s*]/g, ']');
  // Try to close truncated JSON
  if (!cleaned.endsWith('}') && !cleaned.endsWith(']')) {
    const openBraces = (cleaned.match(/{/g) || []).length;
    const closeBraces = (cleaned.match(/}/g) || []).length;
    const openBrackets = (cleaned.match(/\[/g) || []).length;
    const closeBrackets = (cleaned.match(/]/g) || []).length;
    for (let i = 0; i < openBrackets - closeBrackets; i++) cleaned += ']';
    for (let i = 0; i < openBraces - closeBraces; i++) cleaned += '}';
  }
  return cleaned;
}

async function safeParseJSON(text, modelKey) {
  const cleaned = cleanJSON(text);
  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    console.warn('safeParseJSON first attempt failed:', e1.message, '— attempting AI repair...');
  }
  try {
    const repaired = await callAI(
      modelKey,
      'You are a JSON repair tool. Return ONLY valid JSON. No explanation, no markdown.',
      `Fix this malformed JSON and return only the corrected JSON:\n\n${cleaned}`,
      { maxTokens: 4000, temperature: 0.0 }
    );
    return JSON.parse(cleanJSON(repaired));
  } catch {
    throw new Error('The AI returned an invalid response. Please click Retry.');
  }
}

// callAI-based wrapper to match the old messages[] API used in generateBatch
async function callAIWithMessages(modelKey, messages, maxTokens = null) {
  // Extract system and user from the messages array
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  // Combine all non-system messages into a single user turn for providers that need it
  const userParts = messages.filter(m => m.role !== 'system');
  const userMsg = userParts.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n');
  const finalMaxTokens = maxTokens || 8192;
  return callAI(modelKey, systemMsg, userMsg, { maxTokens: finalMaxTokens, temperature: 0.8 });
}

function buildFictionChapterPromptInstructions(isNonfiction) {
  if (isNonfiction) {
    return `Each chapter object MUST include a "prompt" field of 100-150 words AND these structural fields:
- "scope_boundary": One sentence defining exactly what this chapter covers and what it does NOT cover.
- "opens_with": Specific scene/fact/moment — not a mood. Name the subject, source, what is being discussed.
- "primary_beat": The single most important thing that happens. If removed, the book's argument would not work.
- "argument_advance": How the central argument moves forward. Must be in a different place at chapter end vs start.
- "threads_activated": Array of thread names introduced or advanced.
- "threads_paid_off": Array of thread names resolved.
- "must_not_do": Array of 2+ things this chapter must avoid.

PROMPT sections: HOOK (opening fact/anecdote), CONTENT (2-3 key topics with names), STRUCTURE (key angle), TRANSITION_IN, TRANSITION_OUT.`;
  }
  return `Each chapter object MUST include a "prompt" field of 100-150 words AND these structural fields:
- "scope_boundary": One sentence defining exactly what this chapter covers and what it does NOT cover.
- "opens_with": Specific scene/action — not a mood. Name the character, location, what they are doing.
- "primary_beat": The single most important thing that happens. If removed, the story would not work.
- "character_development": What does the POV character learn/decide/become that is irreversible?
- "relationship_shift": How does the central relationship change? Must be different at end vs start.
- "threads_activated": Array of thread names introduced or advanced.
- "threads_paid_off": Array of thread names resolved.
- "must_not_do": Array of 2+ things this chapter must avoid.

PROMPT sections: HOOK (opening image/action), PLOT (2-3 beats with names), ARC (conflict/advance), EMOTION (start→end shift), TRANSITION_IN, TRANSITION_OUT.`;
}

// CHANGE 6 FIX: Simplify story bible output and integrate subgenre + author voice
function buildStoryBiblePrompt(spec, truncatedTopic, targetChapters) {
  const isNonfiction = spec.book_type === 'nonfiction';
  const authorVoiceKey = spec.author_voice || 'basic';
  const authorVoiceDesc = AUTHOR_VOICE_DESCRIPTIONS[authorVoiceKey] || AUTHOR_VOICE_DESCRIPTIONS.basic;
  
  if (isNonfiction) {
    return `Generate a story bible / style guide for a ${spec.genre} nonfiction book about "${truncatedTopic}" with ${targetChapters} chapters${spec.subgenre ? ` (subgenre: ${spec.subgenre})` : ''}.

${spec.subgenre ? `SUBGENRE CONTEXT: This book is ${spec.subgenre}. The subgenre determines pacing, tone, and reader expectations for this book.` : ''}
${authorVoiceKey !== 'basic' ? `AUTHOR VOICE: Write in a style reminiscent of: ${authorVoiceDesc}` : ''}

Return a JSON object (not array) with these fields:
- world: The setting, era, and scope of the book (1 sentence)
- tone_voice: The authorial voice and tone (1 sentence)
- style_guidelines: Prose and structural style guidelines (1-2 sentences)
- rules: An array of exactly 5 strings — the most important consistency rules for this manuscript (include: no repeated metaphors, vary chapter openings, vary emotional texture, vary sentence rhythm, one genre-specific rule)
- characters: Array of key figures (max 5) with fields: name, role (protagonist/antagonist/supporting), description (1-2 sentences max), arc (1 sentence), first_appearance (chapter number), character_backstory (object with fields: formative_event (string — the single canonical biographical event that shaped this figure), location (string — the specific place), people_involved (array of strings — specific names involved), emotional_consequence (string — the lasting result))
- world_rules: Object with fields: setting_unique_details (array of 3+ unique specific details about the setting), social_rules (array of power structures/norms that create constraints), economy (what is common/rare/forbidden in this world)

Return ONLY the JSON object. No preamble.`;
  }
  return `Generate a story bible for a ${spec.genre} fiction novel about "${truncatedTopic}" with ${targetChapters} chapters${spec.subgenre ? ` (subgenre: ${spec.subgenre})` : ''}.

${spec.subgenre ? `SUBGENRE CONTEXT: This book is ${spec.subgenre}. The subgenre determines pacing, specific tropes, reader expectations, and tone for this book. Use the subgenre to make chapter prompts SPECIFIC to reader expectations for that subgenre.` : ''}
${authorVoiceKey !== 'basic' ? `AUTHOR VOICE: Write in a style reminiscent of: ${authorVoiceDesc}` : ''}

Return a JSON object (not array) with these fields:
- world: World-building (setting, atmosphere, geography in 1 sentence)
- tone_voice: Narrative voice, POV, and tone (1 sentence)
- style_guidelines: Prose style guidelines (1-2 sentences)
- rules: An array of exactly 5 strings — the most important consistency rules for this manuscript (include: no repeated metaphors, vary chapter openings, vary emotional texture, vary sentence rhythm, one genre-specific rule)
- characters: Array of main characters (max 5) with fields: name, role (protagonist/antagonist/supporting), description (1-2 sentences max), arc (1 sentence), first_appearance (chapter number), voice_profile (object with fields: vocabulary_level, sentence_pattern, verbal_tic, never_says, physical_communication), character_backstory (object with fields: formative_event (string — the single canonical traumatic or formative past event that shaped this character), location (string — the specific place where the formative event occurred), people_involved (array of strings — specific names of anyone lost, harmed, or involved), emotional_consequence (string — the lasting emotional result that drives present behavior)), capabilities_under_pressure (object with fields: combat_training (string — specific training: "none", "basic self-defense", "military", "martial arts", "law enforcement", etc.), weapons_experience (string — "none", "hunting rifles", "handguns", "military weapons", etc.), violence_response (string — how this character psychologically responds to physical threat: "freezes", "flees", "fights back untrained", "trained tactical response", etc.), lethal_force (string — willingness and ability to use lethal force: "cannot kill without severe psychological consequence", "could kill in self-defense with lasting trauma", "trained to kill", etc.). DEFAULT for non-military/non-combat characters: combat_training="None", weapons_experience="None", violence_response="Will freeze or flee under physical threat", lethal_force="Cannot kill without severe psychological consequence"))
- world_rules: Object with fields: powers_abilities (array of objects with name, mechanic, limitation, tell — or empty if no powers), setting_unique_details (array of 3+ unique specific details about the setting), social_rules (array of power structures/norms that create constraints), economy (what is common/rare/forbidden)

CRITICAL — CHARACTER BACKSTORY RULE: The character_backstory field for each character is CANONICAL and PERMANENT. It defines the single formative past event, the specific location, the specific names of people involved, and the emotional consequence. Once set in the story bible, this backstory must NEVER be changed, contradicted, or added to in any subsequent operation. No new traumatic events, no new past relationships, no new biographical details may be invented for any named character beyond what is recorded here.

Return ONLY the JSON object. No preamble.`;
}

// NONFICTION GEMINI OUTLINE GENERATOR — Uses Gemini for better research structuring
async function runNonfictionOutlineGemini(sr, project_id, spec, outlineId, bookResearch = null) {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not configured');

  // Call Gemini via Google API
  async function callGemini(systemPrompt, userMessage, maxTokens = 12000) {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userMessage }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: 0.8, maxOutputTokens: maxTokens },
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) throw new Error('Gemini API error: ' + (data.error?.message || response.status));
    return data.candidates[0].content.parts[0].text;
  }

  try {
    const targetChapters = spec.chapter_count
      ? parseInt(spec.chapter_count)
      : 20; // Default for nonfiction
    const truncatedTopic = spec.topic?.length > 400 ? spec.topic.slice(0, 400) : spec.topic;
    const beatKey = spec.beat_style || spec.tone_style;
    const beatInstructions = beatKey ? `\n\nBeat Style: ${getBeatStyleInstructions(beatKey)}\n` : '';
    const authorVoiceKey = spec.author_voice || 'basic';
    const authorVoiceDesc = getAuthorVoiceDescription(authorVoiceKey);
    const authorVoiceInfo = authorVoiceKey !== 'basic' ? `\nAuthor Voice: ${authorVoiceDesc}` : '';

    const subgenreBlock = spec.subgenre ? `\nSubgenre: ${spec.subgenre}\nAll chapters must be relevant to the subgenre. Do not generate chapters that fall outside the subgenre focus.` : '';

    // Build research block from web search pre-pass (if available)
    const researchBlock = bookResearch ? `\n=== VERIFIED RESEARCH (from live web search) ===\nContext: ${bookResearch.contextSummary || ''}\n\nKey Facts:\n${(bookResearch.facts || []).map(f => '- ' + f).join('\n')}\n\nTimeline:\n${(bookResearch.timeline || []).map(t => '- ' + t.date + ': ' + t.event).join('\n')}\n\nKey Figures:\n${(bookResearch.keyFigures || []).map(f => '- ' + f.name + ': ' + f.role).join('\n')}\n\nINSTRUCTION: Ground the chapter outline in these verified facts. Each chapter's summary and prompt should reflect accurate dates, names, and events where relevant. Do not invent events that contradict these facts.\n=== END RESEARCH ===\n` : '';

    const systemPrompt = `${buildAuthorModeBlock(spec)}\n\n${CONTENT_GUARDRAILS}\n\n${ANTI_REPETITION_RULES}\n\nYou are a professional nonfiction book architect specializing in research compilation and evidence-based narrative structure. You generate structured outlines for nonfiction books. Return only valid JSON. No prose outside the JSON.

This book must contain exactly ${targetChapters} chapters. Generate an outline with exactly ${targetChapters} chapters — no more, no fewer.

Genre: ${spec.genre || 'General'}${subgenreBlock}

NONFICTION STRUCTURE RULES:
- This is NONFICTION. Chapters are organized around ARGUMENTS, THEMES, or CHRONOLOGICAL PERIODS — not fictional plot arcs.
- Every chapter must be grounded in RESEARCH, documented facts, real people, and the author's analytical voice.
- Avoid extended fictional dialogue scenes. Focus on authorial analysis and evidence presentation.
- Characters are REAL PEOPLE — include their names, roles, and factual context.
- Each chapter must advance the book's central argument or thesis.

CHAPTER SUBJECT UNIQUENESS (MANDATORY):
Each chapter in this outline must cover a distinct historical subject. No two chapters may share the same primary institution or subject AND the same time period. Review your outline before outputting it — if any two chapters overlap in both subject and era, revise one of them before responding.`;

    // ── STEP 1: Metadata ──────────────────────────────────────────────────────
    console.log('Gemini: Generating book metadata...');
    const metadataPrompt = `Generate publishing metadata for a ${spec.genre} nonfiction book about "${truncatedTopic}".
Target audience: ${spec.target_audience || 'general readers'}.

Return a JSON object with exactly these fields:
{
  "title": "A bold, compelling book title",
  "subtitle": "A subtitle indicating the book's premise",
  "description": "2-3 concise paragraphs. Hook in the first sentence.",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7"]
}

Return ONLY the JSON object.`;

    const metaText = await callGemini(systemPrompt, metadataPrompt, 2000);
    let bookMetadata = null;
    try {
      const metaMatch = metaText.match(/\{[\s\S]*\}/);
      bookMetadata = JSON.parse(cleanJSON(metaMatch ? metaMatch[0] : metaText));
    } catch (e) {
      console.warn('Gemini metadata parse failed:', e.message);
    }

    // ── STEP 2: Story Bible ──────────────────────────────────────────────────
    console.log('Gemini: Generating research bible...');
    const storyBiblePrompt = buildStoryBiblePrompt(spec, truncatedTopic, targetChapters);
    const bibleText = await callGemini(systemPrompt, storyBiblePrompt, 2000);
    let parsedStoryBible = null;
    try {
      const bibleMatch = bibleText.match(/\{[\s\S]*\}/);
      parsedStoryBible = JSON.parse(cleanJSON(bibleMatch ? bibleMatch[0] : bibleText));
    } catch (e) {
      console.warn('Gemini story bible parse failed:', e.message);
    }

    // ── STEP 3: Generate Scope Lock ──────────────────────────────────────────
    console.log('Gemini: Generating scope lock...');
    let nfScopeLock = null;
    try {
      const slPrompt = `Generate a SCOPE LOCK for a ${targetChapters}-chapter ${spec.genre} nonfiction book about "${truncatedTopic}". Return a JSON object with:
- "throughline": One sentence — central thesis, evidence, what reader understands by end.
- "escalation_map": Array of 4 objects with "block" (1-4), "chapters" (range), "intensity" (1-10, must increase), "description".
- "concept_budget": Array of objects with "concept", "primary_chapter" (number), "supporting_chapters" (array).
- "thread_register": Array of objects with "thread", "introduced_chapter", "payoff_chapter".
Return ONLY JSON.`;
      const slText = await callGemini(systemPrompt, slPrompt, 2000);
      const slMatch = slText.match(/\{[\s\S]*\}/);
      nfScopeLock = JSON.parse(cleanJSON(slMatch ? slMatch[0] : slText));
      console.log('Gemini scope lock generated');
    } catch (e) { console.warn('Gemini scope lock failed:', e.message); }

    // ── STEP 4: Generate chapters in batches ──────────────────────────────────
    console.log(`Gemini: Generating ${targetChapters} chapters...`);
    const CHUNK_SIZE = 4;
    const allChapters = [];

    async function generateBatch(chunkStart, previousChapterEnding) {
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, targetChapters);
      const chunkCount = chunkEnd - chunkStart + 1;
      console.log(`Gemini batch ${chunkStart}-${chunkEnd}...`);

      const prevContext = previousChapterEnding
        ? `\nThe previous batch ended with Chapter ${chunkStart - 1}. Ending: "${previousChapterEnding}"\nEnsure Chapter ${chunkStart} opens with a transition_from that references this.`
        : '';

      const nfScopeCtx = nfScopeLock ? `\n=== SCOPE LOCK ===\nTHROUGHLINE: ${nfScopeLock.throughline || 'N/A'}\nESCALATION MAP: ${JSON.stringify(nfScopeLock.escalation_map || [])}\nCONCEPT BUDGET: ${JSON.stringify(nfScopeLock.concept_budget || [])}\nTHREAD REGISTER: ${JSON.stringify(nfScopeLock.thread_register || [])}\n=== END ===\n` : '';

      const chunkPrompt = `Generate ${chunkCount} detailed nonfiction chapters (chapters ${chunkStart}-${chunkEnd} of ${targetChapters}) for: "${truncatedTopic}"
Genre: ${spec.genre || 'General'}${spec.subgenre ? `\nSubgenre: ${spec.subgenre}\nAll chapters must be relevant to the subgenre "${spec.subgenre}". Do not generate chapters that fall outside the subgenre focus.` : ''}
This book must contain exactly ${targetChapters} chapters total.${beatInstructions}${authorVoiceInfo}${nfScopeCtx}${researchBlock}${prevContext}

Each chapter MUST have these fields:
- number, title, summary (1-2 sentences on the chapter's argument/focus)
- prompt: 100-150 words covering HOOK (opening fact/anecdote), CONTENT (research focus with names/dates/places), STRUCTURE (key angle), TRANSITION_IN, TRANSITION_OUT
- scope_boundary: One sentence — what this chapter covers and what it does NOT cover
- opens_with: Specific opening fact/scene/moment — not a mood
- primary_beat: The single most important argument advance
- argument_advance: How the central argument moves forward (must differ from start to end)
- threads_activated: Array of thread names introduced or advanced
- threads_paid_off: Array of thread names resolved
- must_not_do: Array of 2+ things this chapter must avoid
- transition_from: How to pick up from previous chapter (null for ch 1)
- transition_to: How this chapter sets up the next

Return a JSON array with exactly ${chunkCount} objects. No prose outside the array.`;

      let text = '';
      for (let attempt = 0; attempt < 2; attempt++) {
        text = await callGemini(systemPrompt, chunkPrompt, 12000);
        if (text && !isRefusal(text)) break;
      }

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(cleanJSON(jsonMatch ? jsonMatch[0] : text));
      if (!Array.isArray(parsed)) throw new Error(`Not an array in batch ${chunkStart}-${chunkEnd}`);
      console.log(`✓ Gemini batch ${chunkStart}-${chunkEnd} complete`);
      return parsed;
    }

    // Generate batches sequentially for context awareness
    const batchStarts = [];
    for (let s = 1; s <= targetChapters; s += CHUNK_SIZE) batchStarts.push(s);

    for (const batchStart of batchStarts) {
      const lastChapter = allChapters[allChapters.length - 1];
      const prevEnding = lastChapter?.transition_to || null;
      const batchResult = await generateBatch(batchStart, prevEnding);
      allChapters.push(...batchResult);
    }

    // ── Title deduplication pass ────────────────────────────────────────────
    deduplicateChapterTitles(allChapters);

    const parsedOutline = { scope_lock: nfScopeLock, chapters: allChapters };

    // ── Save outline + metadata ──────────────────────────────────────────────
    const outlineJson = JSON.stringify(parsedOutline);
    const storyBibleJson = parsedStoryBible ? JSON.stringify(parsedStoryBible) : '';

    const outlineFile = new File([outlineJson], `outline_${project_id}.json`, { type: 'application/json' });
    const uploadRes = await sr.integrations.Core.UploadFile({ file: outlineFile });
    const outline_url = uploadRes.file_url;

    let story_bible_url = '';
    if (storyBibleJson) {
      const bibleFile = new File([storyBibleJson], `story_bible_${project_id}.json`, { type: 'application/json' });
      const uploadRes2 = await sr.integrations.Core.UploadFile({ file: bibleFile });
      story_bible_url = uploadRes2.file_url;
    }

    await sr.entities.Outline.update(outlineId, {
      outline_url,
      story_bible_url,
      book_metadata: JSON.stringify(bookMetadata),
      status: 'complete',
      error_message: '',
    });

    // Auto-update project name
    if (bookMetadata?.title) {
      try {
        await sr.entities.Project.update(project_id, { name: bookMetadata.title });
      } catch (nameErr) {
        console.warn('Project name update failed:', nameErr.message);
      }
    }

    // Delete + recreate chapters
    const existingChapters = await sr.entities.Chapter.filter({ project_id });
    await Promise.all(existingChapters.map(c => sr.entities.Chapter.delete(c.id)));

    const chapterRecords = allChapters.map((ch, idx) => ({
      project_id,
      chapter_number: ch.number || idx + 1,
      title: ch.title || `Chapter ${ch.number || idx + 1}`,
      summary: ch.summary || '',
      prompt: ch.prompt || '',
      status: 'pending',
      word_count: 0,
    }));
    await sr.entities.Chapter.bulkCreate(chapterRecords);
    console.log('Gemini nonfiction outline complete:', chapterRecords.length, 'chapters');
  } catch (err) {
    console.error('Gemini nonfiction generation failed:', err.message);
    throw err;
  }
}

async function runGeneration(sr, project_id, modelKey = 'claude-sonnet') {
   let outlineId = null;
   try {
     console.log('runGeneration start:', project_id);

     // Mark outline as generating
     const existingOutlines = await sr.entities.Outline.filter({ project_id });
     if (existingOutlines[0]) {
       outlineId = existingOutlines[0].id;
       await sr.entities.Outline.update(outlineId, { status: 'generating', error_message: '' });
     } else {
       const created = await sr.entities.Outline.create({ project_id, status: 'generating' });
       outlineId = created.id;
     }

     const specs = await sr.entities.Specification.filter({ project_id });
     const rawSpec = specs[0];
     if (!rawSpec) {
       await sr.entities.Outline.update(outlineId, { status: 'error', error_message: 'No specification found' });
       return;
     }

     const spec = {
       ...rawSpec,
       beat_style: rawSpec.beat_style || rawSpec.tone_style || "",
       spice_level: Math.max(0, Math.min(4, parseInt(rawSpec.spice_level) || 0)),
       language_intensity: Math.max(0, Math.min(4, parseInt(rawSpec.language_intensity) || 0)),
     };

     // NONFICTION ROUTING: Web search research pre-pass + Gemini nonfiction generator
     if (spec.book_type === 'nonfiction') {
       // Web search research pre-pass for factual grounding
       let bookResearch = null;
       try {
         console.log('Nonfiction: Running web search research pre-pass...');
         const researchResp = await sr.functions.invoke('researchNonfictionTopic', {
           topic: spec.topic,
           subject: null,
           genre: spec.genre,
           subgenre: spec.subgenre,
           scope: 'full book overview',
         });
         bookResearch = researchResp.data || researchResp;
         if (bookResearch?.facts?.length > 0) {
           console.log(`Research pre-pass complete: ${bookResearch.facts.length} facts, ${bookResearch.keyFigures?.length || 0} figures`);
           // Store as project source file for visibility in UI
           try {
             await sr.entities.SourceFile.create({
               project_id,
               filename: 'book_research.json',
               file_type: 'reference',
               content: JSON.stringify(bookResearch, null, 2),
               description: 'Auto-generated research from web search during outline generation',
             });
           } catch (sfErr) { console.warn('Source file creation failed (non-blocking):', sfErr.message); }
         } else {
           console.warn('Research pre-pass returned no facts, continuing without it');
           bookResearch = null;
         }
       } catch (researchErr) {
         console.warn('Research pre-pass failed, continuing without it:', researchErr.message);
         bookResearch = null;
       }

       try {
         console.log('Nonfiction outline detected — using Gemini generation...');
         await runNonfictionOutlineGemini(sr, project_id, spec, outlineId, bookResearch);
         return; // Success — exit early
       } catch (geminiErr) {
         console.warn('Gemini nonfiction generation failed:', geminiErr.message, '— falling back to standard path with Gemini');
         // Fall through to standard Gemini-based generation
       }
     }

     // Fiction outlines also use Gemini Pro for better structuring
     console.log('Using Gemini Pro for outline generation (fiction)...');

    // CHANGE 3 FIX: Cap chapter count at 20 max; recommend 12-18
    const chapterRange = CHAPTER_COUNTS[spec.target_length] || CHAPTER_COUNTS.medium;
    let targetChapters = spec.chapter_count
      ? parseInt(spec.chapter_count)
      : Math.floor((chapterRange.min + chapterRange.max) / 2);
    
    // No cap — respect user's chapter_count from spec

    const truncatedTopic = spec.topic?.length > 400 ? spec.topic.slice(0, 400) : spec.topic;
    const isNonfiction = spec.book_type === 'nonfiction';
    const beatKey = spec.beat_style || spec.tone_style;
    const beatInstructions = beatKey ? `\n\nBeat Style: ${getBeatStyleInstructions(beatKey)}\n` : '';
    const spiceInstructions = `\n${getSpiceLevelInstructions(spec.spice_level ?? 0)}\n`;
    const langInstructions = `\n${getLanguageIntensityInstructions(spec.language_intensity ?? 0)}\n`;
    
    // CHANGE 4 & 5 & 6 FIX: Add subgenre and author voice to context
    const authorVoiceKey = spec.author_voice || 'basic';
    const authorVoiceDesc = getAuthorVoiceDescription(authorVoiceKey);
    const subgenreInfo = spec.subgenre ? `\nSubgenre: ${spec.subgenre}` : '';
    const authorVoiceInfo = authorVoiceKey !== 'basic' ? `\nAuthor Voice: ${authorVoiceDesc}` : '';
    
    const baseContext = `${spec.genre} ${spec.book_type} about "${truncatedTopic}"${spec.subgenre ? ` (subgenre: ${spec.subgenre})` : ''}`;
    const promptInstructions = buildFictionChapterPromptInstructions(isNonfiction);
    const chapterPromptSchema = isNonfiction
      ? `number (integer), title (string), summary (string 1-2 sentences), prompt (string 100-150 words with all required sections), scope_boundary (string — what this chapter covers and does NOT cover), opens_with (string — specific opening scene/fact), primary_beat (string — single most important event), argument_advance (string — how central argument moves), threads_activated (array of strings), threads_paid_off (array of strings), must_not_do (array of 2+ strings), transition_from (string or null for ch 1), transition_to (string), beat_name (string), beat_function (string), beat_scene_type (string: one of "exposition", "case_study", "analysis", "how_to", "synthesis", "scene_recreation", "profile", "investigative", "teaching"), beat_tempo (string: "fast", "medium", or "slow")`
      : `number (integer), title (string), summary (string 1-2 sentences), prompt (string 100-150 words with all required sections), scope_boundary (string — what this chapter covers and does NOT cover), opens_with (string — specific opening scene/action with character name), primary_beat (string — single most important event), character_development (string — irreversible change), relationship_shift (string — how central relationship changes), threads_activated (array of strings), threads_paid_off (array of strings), must_not_do (array of 2+ strings), transition_from (string or null for ch 1), transition_to (string), beat_name (string), beat_function (string), beat_scene_type (string: "scene" or "sequel"), beat_tempo (string: "fast", "medium", or "slow")`;

    // ── Beat Sheet Assignment (fiction AND nonfiction) ──────────────────────
    let beatSheetBlock = '';
    let beatAssignments = null;
    {
      const bsKey = spec.beat_sheet_template || 'auto';
      const resolvedKey = (bsKey === 'auto' || !bsKey) ? autoDetectBeatTemplate(spec.genre, spec.book_type) : bsKey;
      beatAssignments = assignBeatsToChapters(resolvedKey, targetChapters);
      if (beatAssignments) {
        beatSheetBlock = buildBeatSheetOutlineBlock(beatAssignments);
        console.log(`Beat sheet assigned: ${beatAssignments.template_name} (${beatAssignments.assignments.length} beats for ${targetChapters} chapters)`);
      }
    }

    // FIX 3 — Prevent plot bloat in short erotica/romance
    let shortEroticaConstraint = '';
    if (!isNonfiction && targetChapters >= 5 && targetChapters <= 10) {
      const eroticaGenre = ((spec.genre || '') + ' ' + (spec.subgenre || '')).toLowerCase();
      if (/erotica|romance|erotic/.test(eroticaGenre)) {
        shortEroticaConstraint = `\n\n=== SHORT-FORM INTIMATE FICTION CONSTRAINT ===
This is a short-form intimate fiction work. The central conflict must be emotional and relational — between the two leads — not geopolitical, species-wide, or world-ending in scale. External plot elements (conspiracies, action sequences, societal stakes) may exist as backdrop only. They must never become the primary focus of any chapter. If the outline introduces large-scale external threats (military, governmental, existential), flag this as a scope violation and reduce to personal stakes.
=== END SHORT-FORM CONSTRAINT ===\n`;
      }
    }

    // FIX 7 — Thriller scope lock: personal stakes must always be emotional core
    let thrillerScopeLock = '';
    if (!isNonfiction) {
      const thrillerGenre = ((spec.genre || '') + ' ' + (spec.subgenre || '')).toLowerCase();
      if (/thriller|suspense|crime|mystery/.test(thrillerGenre)) {
        thrillerScopeLock = `\n\n=== THRILLER PERSONAL STAKES CONSTRAINT (MANDATORY) ===
External stakes must escalate personal stakes — they must never replace them. The protagonist's personal emotional wound, their relationships, and their immediate survival must remain the emotional core of every chapter regardless of how large the plot becomes. If the plot has introduced world-scale threats (mass casualties, geopolitical events, species-level events), each chapter must still contain a moment where those stakes are filtered through the protagonist's personal emotional reality. A Christmas tsunami that kills a million people is less emotionally effective than the protagonist thinking about their daughter's crayon drawings of whales.
=== END THRILLER CONSTRAINT ===\n`;
      }
    }

    const systemPrompt = `${buildAuthorModeBlock(spec)}\n\n${CONTENT_GUARDRAILS}\n\n${ANTI_REPETITION_RULES}\n\n${scopeLockBlock}${shortEroticaConstraint}${thrillerScopeLock}\n\nYou are a professional story architect and book outline generator. Your PRIMARY obligation is to prevent: (1) flat repetition — same tension level recycled, (2) scope bleed — chapters covering same ground under different headings, (3) orphaned threads — elements introduced and never paid off. Return only valid JSON. No prose, no preamble, no commentary outside the JSON.

CHARACTER VOICE DIFFERENTIATION RULES:
- Every named character MUST have a distinct speech pattern defined in their outline entry
- Characters must NEVER sound interchangeable. Enforce these distinctions:
  - Vocabulary level (academic vs casual vs street vs formal)
  - Sentence length tendency (terse vs verbose)
  - Speech habits (interrupts, trails off, asks questions, makes declarations)
  - What they notice/reference (their expertise, background, worldview)
- In dialogue, a reader should be able to identify the speaker WITHOUT dialogue tags
- NEVER have multiple characters deliver philosophical monologues. Maximum ONE character per book serves as the "philosopher" voice. All others must contrast.

=== CHARACTER VOICE DIFFERENTIATION (MANDATORY) ===

Every named character MUST be assigned a distinct VOICE PROFILE in the story bible. Each voice profile must specify:
1. VOCABULARY LEVEL: monosyllabic / street-smart / educated / clinical / poetic / archaic
2. SENTENCE PATTERN: short and clipped / long and flowing / questions-as-answers / interrupts others / trails off
3. VERBAL TICS: a repeated word, phrase structure, or speech habit unique to THIS character (e.g., always uses food metaphors, never asks direct questions, starts sentences with "Look,")
4. WHAT THEY NEVER SAY: each character must have at least one communication style they avoid (e.g., "never speaks about feelings directly", "never uses metaphors", "never asks permission")
5. PHYSICAL COMMUNICATION: how they express emotion WITHOUT words (e.g., "cracks knuckles when nervous", "goes very still when angry", "talks faster when lying")

NO TWO CHARACTERS may share the same vocabulary level AND sentence pattern. If Character A is "educated + long flowing sentences", Character B CANNOT also be "educated + long flowing sentences."

The dialogue test: if you cover the dialogue tags, a reader should be able to tell WHO is speaking from the words alone.
=== END CHARACTER VOICE ===

CHAPTER ENDING VARIATION RULES:
- Each chapter MUST end with a structurally different type of ending. Assign one per chapter from this list and do NOT repeat:
  - CLIFFHANGER: Cut mid-action or mid-revelation
  - REVERSAL: A twist that reframes everything the chapter established
  - DECISION: Character makes a concrete choice with consequences
  - DISCOVERY: A specific new piece of information is revealed
  - LOSS: Something or someone is taken away
  - QUIET DEVASTATION: An emotionally heavy realization, no action
- NEVER end a chapter with a character thinking "I'm ready to go deeper/explore more/face what's ahead." That is not an ending, it is a placeholder.
- The final line of each chapter must be CONCRETE (an image, a sound, a single action) — not abstract philosophical musing.

CHARACTER REGISTRY CONFLICT PREVENTION — MANDATORY:
- Before introducing any new named character in any chapter, check all existing characters in the story bible.
- No new character may share a name with, or have a name closely resembling, an existing character.
- No new character may fill a role already occupied by an existing character (mentor, love interest, inside contact, tech expert, confidant, rival) unless the chapter prompt explicitly justifies why the established character cannot serve that role.
- If the outline introduces a new character filling an already-occupied role, revise the chapter to use the existing character instead, or add explicit justification for the new character.
- A character introduced as a mentor in chapter 2 cannot also appear as an unrelated rogue scientist in chapter 12 unless this is an explicit plot twist with a bridge scene.

PLOT PROGRESSION — MANDATORY:
- Every chapter must contain at least ONE of these concrete plot advances:
  - A new piece of information the reader did not have before
  - A relationship that materially changes (not just "tension increases")
  - A consequence from a previous chapter's events
  - A character making an irreversible choice
- Characters introduced with significant weight in early chapters MUST reappear or be explicitly resolved. No dangling threads.
- If a character is introduced with chemistry/tension toward the protagonist, they must either: (a) remain present in the story, (b) have their absence explained, or (c) return with changed dynamics. They cannot simply vanish.
- New major characters in the final third of the book MUST be foreshadowed earlier (name mentioned, presence hinted, connected to an existing thread).
- The central mystery/question of the book must receive CONCRETE partial answers by the midpoint and substantial resolution by the final chapter. Mystery without payoff is not suspense — it is a broken promise.

PROTAGONIST AGENCY — MANDATORY:
- The protagonist must make at least ONE difficult choice per chapter where both options have real costs.
- "Deciding to keep exploring" is NOT a difficult choice if there are no consequences for doing so.
- The protagonist must CAUSE at least some of the plot events, not merely react to what others do or offer.
- At least once in the book, the protagonist must refuse something, lose something, or sacrifice something. A character who always says yes to every invitation is not a protagonist — they are a passenger.

ALLEGIANCE SHIFT VALIDATION — MANDATORY:
- If any character is tagged as "antagonist" or "villain" in the story bible or in any chapter's summary/prompt, and that character later appears as an "ally", "neutral", or "supporting" role, the outline MUST contain an explicit BRIDGE CHAPTER or BRIDGE SCENE between those two states.
- The bridge must show the INCITING EVENT that caused the shift: a betrayal revealed, a shared enemy forcing cooperation, a confession, a sacrifice, or a debt repaid.
- An allegiance shift without a bridge chapter is a structural violation. The reader must witness the cause of the change, not be told about it after the fact.
- Review the outline before outputting: for each named character, trace their role across all chapters. If their role changes from antagonist/villain to ally/neutral (or vice versa), verify that a bridge exists. If not, insert one.

=== WORLDBUILDING SPECIFICITY RULES ===

The story bible MUST include a "world_rules" section with:

1. POWERS/ABILITIES: If any character has supernatural, magical, or unusual abilities, each ability MUST have:
   - A specific NAME (not "energy powers" or "abilities")
   - A concrete MECHANIC (what physically happens when used — "her scales emit infrared light that disrupts electronics within 3 meters" NOT "she channels energy")
   - A LIMITATION (what it costs, what it can't do, when it fails)
   - A TELL (what it looks like to observers — specific visual/sound/smell)

2. SETTING: The primary setting MUST have at least 3 UNIQUE details that distinguish it from generic settings. "Neon-lit cyberpunk city" is NOT unique. "A city where buildings grow from bio-engineered coral and streets flood at high tide" IS unique. Each unique detail must appear in at least 2 chapters.

3. SOCIAL RULES: What are the power structures, social norms, or cultural rules that affect character behavior? These must create CONSTRAINTS that drive plot (e.g., "hybrids cannot own property" creates a concrete story problem, not just flavor).

4. ECONOMY OF MAGIC/TECH: What is common, what is rare, what is forbidden? This creates natural conflict without requiring dialogue to explain it.

Every chapter prompt in the outline must reference at least ONE specific worldbuilding element from world_rules — not as exposition, but as something that affects a character's actions or choices in that chapter.
=== END WORLDBUILDING ===`;

    // ── STEP 1: Generate book metadata ──────────────────────────────────────
    console.log('Generating book metadata...');
    const metadataPrompt = `Generate publishing metadata for a ${baseContext}.
Target audience: ${spec.target_audience || 'general readers'}.

Return a JSON object with exactly these fields:
{
  "title": "A bold, compelling book title that grabs attention instantly",
  "subtitle": "A subtitle that clearly indicates the book's premise and appeal",
  "description": "2-3 concise paragraphs tailored for Amazon KDP readers. Hook them in the first sentence. Highlight what makes this book unique. End with a call to action.",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7"]
}

Return ONLY the JSON object. No preamble.`;

    // ── STEP 2: Generate story bible ─────────────────────────────────────────
    console.log('Generating story bible...');
    const storyBiblePromptText = buildStoryBiblePrompt(spec, truncatedTopic, targetChapters);

    // Run metadata + story bible in parallel
    // callType: outline → all outline-phase AI calls resolve to Gemini
    const [metaText, bibleText] = await Promise.all([
      callAI(modelKey, systemPrompt, metadataPrompt, { maxTokens: 2000 }),        // callType: outline (metadata)
      callAI(modelKey, systemPrompt, storyBiblePromptText, { maxTokens: 2000 }),   // callType: outline (story bible)
    ]);

    // Parse metadata
    let bookMetadata = null;
    try {
      const metaMatch = metaText.match(/\{[\s\S]*\}/);
      bookMetadata = await safeParseJSON(metaMatch ? metaMatch[0] : metaText, modelKey);
    } catch (e) {
      console.warn('Book metadata parse failed:', e.message);
    }

    // Parse story bible
    let parsedStoryBible = null;
    try {
      const bibleMatch = bibleText.match(/\{[\s\S]*\}/);
      parsedStoryBible = await safeParseJSON(bibleMatch ? bibleMatch[0] : bibleText, modelKey);
    } catch (e) {
      console.warn('Story bible parse failed:', e.message);
    }

    // ── STEP 3: Generate Scope Lock ─────────────────────────────────────────
    console.log('Generating scope lock...');
    const scopeLockType = isNonfiction ? 'nonfiction' : 'fiction';
    const scopeLockPrompt = isNonfiction
      ? `Generate a SCOPE LOCK for a ${targetChapters}-chapter ${baseContext}. Return a JSON object with:
- "throughline": One sentence — central thesis, evidence, and what reader understands by the end.
- "escalation_map": Array of 4 objects, each with "block" (1-4), "chapters" (e.g. "1-5"), "intensity" (1-10, must increase), "description" (what this block achieves).
- "concept_budget": Array of objects with "concept" (string), "primary_chapter" (number), "supporting_chapters" (array of numbers).
- "thread_register": Array of objects with "thread" (string), "introduced_chapter" (number), "payoff_chapter" (number).
Return ONLY the JSON object.`
      : `Generate a SCOPE LOCK for a ${targetChapters}-chapter ${baseContext}. Return a JSON object with:
- "throughline": One sentence — what protagonist wants, what stands in the way, what it costs.
- "escalation_map": Array of 4 objects, each with "block" (1-4), "chapters" (e.g. "1-5"), "intensity" (1-10, must increase), "description" (what this block achieves).
- "relationship_arc": Array of 5 objects with "checkpoint" (chapter number), "state" (description of relationship state — each MUST be unique and never repeated).
- "thread_register": Array of objects with "thread" (string), "introduced_chapter" (number), "payoff_chapter" (number).
Return ONLY the JSON object.`;

    let scopeLock = null;
    try {
      const scopeText = await callAI(modelKey, systemPrompt, scopeLockPrompt, { maxTokens: 2000 });
      const scopeMatch = scopeText.match(/\{[\s\S]*\}/);
      scopeLock = await safeParseJSON(scopeMatch ? scopeMatch[0] : scopeText, modelKey);
      console.log('Scope lock generated:', Object.keys(scopeLock));
    } catch (e) {
      console.warn('Scope lock generation failed:', e.message, '— proceeding without it');
    }

    // ── STEP 4: Generate chapters in batches of 4 ───────────────────────────
    console.log(`Generating ${targetChapters} detailed chapters...`);
    const CHUNK_SIZE = 4;

    async function generateBatch(chunkStart, previousChapterEnding) {
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, targetChapters);
      const chunkCount = chunkEnd - chunkStart + 1;
      console.log(`Starting batch ${chunkStart}-${chunkEnd}...`);

      const prevContext = previousChapterEnding
        ? `\nThe previous batch ended with Chapter ${chunkStart - 1}. Ending context: "${previousChapterEnding}"\nEnsure Chapter ${chunkStart} opens with a clear transition_from that references this ending.`
        : '';

      // Build per-chunk beat context
      let chunkBeatContext = '';
      if (beatAssignments) {
        const chunkAssignments = beatAssignments.assignments.filter(a => a.chapter >= chunkStart && a.chapter <= chunkEnd);
        chunkBeatContext = chunkAssignments.map(a =>
          `Ch ${a.chapter}: Beat "${a.beat_name}" | ${a.beat_function} | ${a.beat_scene_type} | ${a.beat_tempo} → ${a.beat_description}`
        ).join('\n');
      }

      // Inject scope lock into chapter generation context
      const scopeCtx = scopeLock ? `\n=== SCOPE LOCK (binding contract — every chapter must serve this) ===\nTHROUGHLINE: ${scopeLock.throughline || 'N/A'}\nESCALATION MAP: ${JSON.stringify(scopeLock.escalation_map || [])}\n${scopeLock.relationship_arc ? 'RELATIONSHIP ARC: ' + JSON.stringify(scopeLock.relationship_arc) : scopeLock.concept_budget ? 'CONCEPT BUDGET: ' + JSON.stringify(scopeLock.concept_budget) : ''}\nTHREAD REGISTER: ${JSON.stringify(scopeLock.thread_register || [])}\n=== END SCOPE LOCK ===\n` : '';

      const chunkPrompt = `Generate ${chunkCount} detailed chapters (chapters ${chunkStart}-${chunkEnd} of ${targetChapters}) for a ${baseContext}.
This book must contain exactly ${targetChapters} chapters. Generate chapters for this batch accordingly — no more, no fewer than requested.
Book title: "${bookMetadata?.title || 'Untitled'}"
${beatInstructions}${spiceInstructions}${langInstructions}
${subgenreInfo}
${authorVoiceInfo}
${CONTENT_GUARDRAILS}
${ANTI_REPETITION_RULES}
${scopeCtx}
${prevContext}

${beatSheetBlock ? beatSheetBlock : ''}

${chunkBeatContext ? `BEAT ASSIGNMENTS FOR THIS BATCH:\n${chunkBeatContext}\n\nEach chapter MUST include beat_name, beat_function, beat_scene_type, and beat_tempo fields matching the assignments above.` : ''}

SUBGENRE PACING & TONE: The SUBGENRE determines chapter pacing, tropes, and reader expectations. Use it to make chapter prompts SPECIFIC to what readers expect from this subgenre.

AUTHOR VOICE PROSE STYLE: The AUTHOR VOICE determines the prose style for every chapter. Embed voice-specific instructions into each chapter prompt.

${promptInstructions}

CRITICAL: The "prompt" field for each chapter must be 100-150 words. It must contain ALL required sections listed above with specific, concrete details unique to each chapter. Be concise but complete.

Return a JSON array with exactly ${chunkCount} objects, each with these fields: ${chapterPromptSchema}

No other fields. No prose outside the JSON array.`;

      let text = '';
      for (let attempt = 0; attempt < 3; attempt++) {
        const retryNote = attempt > 0 ? '\n\nREMINDER: Return ONLY the valid JSON array with ALL required fields. Each prompt must be 300+ words. No refusals, no commentary.' : '';
        text = await callAIWithMessages(modelKey, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: chunkPrompt + retryNote },
        ], 12000);
        if (!isRefusal(text)) break;
        console.warn(`Batch ${chunkStart}-${chunkEnd} attempt ${attempt + 1} was a refusal, retrying...`);
      }

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const parsed = await safeParseJSON(jsonMatch ? jsonMatch[0] : text, modelKey);
      if (!Array.isArray(parsed)) throw new Error(`Not an array in batch ${chunkStart}-${chunkEnd}`);
      console.log(`✓ Batch ${chunkStart}-${chunkEnd} complete (${parsed.length} chapters)`);
      return parsed;
    }

    // Generate batches SEQUENTIALLY so each batch can reference the previous ending
    const allChapters = [];
    const batchStarts = [];
    for (let s = 1; s <= targetChapters; s += CHUNK_SIZE) batchStarts.push(s);

    for (const batchStart of batchStarts) {
      try {
        const lastChapter = allChapters[allChapters.length - 1];
        const prevEnding = lastChapter?.transition_to || null;
        const batchResult = await generateBatch(batchStart, prevEnding);
        allChapters.push(...batchResult);
      } catch (err) {
        console.error(`Batch starting at ${batchStart} failed:`, err.message);
        await sr.entities.Outline.update(outlineId, { status: 'error', error_message: err.message });
        return;
      }
    }

    // Merge beat assignments into outline chapters
    if (beatAssignments) {
      for (const ch of allChapters) {
        const chNum = ch.number || allChapters.indexOf(ch) + 1;
        const ba = beatAssignments.assignments.find(a => a.chapter === chNum);
        if (ba) {
          ch.beat_name = ch.beat_name || ba.beat_name;
          ch.beat_function = ch.beat_function || ba.beat_function;
          ch.beat_scene_type = ch.beat_scene_type || ba.beat_scene_type;
          ch.beat_tempo = ch.beat_tempo || ba.beat_tempo;
        }
      }
    }

    // Merge scope_lock from first chapter if AI included it there
    if (!scopeLock && allChapters.length > 0 && allChapters[0].scope_lock) {
      scopeLock = allChapters[0].scope_lock;
      delete allChapters[0].scope_lock;
    }
    // ── Title deduplication pass ────────────────────────────────────────────
    deduplicateChapterTitles(allChapters);

    const parsedOutline = { scope_lock: scopeLock, chapters: allChapters, beat_sheet: beatAssignments || null };

    // ── Save outline + metadata (upload large fields as files) ───────────────
    const outlineJson = JSON.stringify(parsedOutline);
    const storyBibleJson = parsedStoryBible ? JSON.stringify(parsedStoryBible) : '';

    let outline_data = '';
    let outline_url = '';
    let story_bible = '';
    let story_bible_url = '';

    // Always upload outline as file to avoid field size limits
    const outlineFile = new File([outlineJson], `outline_${project_id}.json`, { type: 'application/json' });
    const uploadRes = await sr.integrations.Core.UploadFile({ file: outlineFile });
    outline_url = uploadRes.file_url;
    console.log('Outline uploaded:', outline_url);

    // Upload story bible as file if present
    if (storyBibleJson) {
      const bibleFile = new File([storyBibleJson], `story_bible_${project_id}.json`, { type: 'application/json' });
      const uploadRes2 = await sr.integrations.Core.UploadFile({ file: bibleFile });
      story_bible_url = uploadRes2.file_url;
      console.log('Story bible uploaded:', story_bible_url);
    } else {
      story_bible = '';
    }

    await sr.entities.Outline.update(outlineId, {
      outline_data,
      outline_url,
      story_bible,
      story_bible_url,
      book_metadata: JSON.stringify(bookMetadata),
      status: 'complete',
      error_message: '',
    });

    // ── Auto-update project name from generated title ────────────────────────
    if (bookMetadata?.title) {
      try {
        await sr.entities.Project.update(project_id, { name: bookMetadata.title });
      } catch (nameErr) {
        console.warn('Project name update failed:', nameErr.message);
      }
    }

    // ── Delete + recreate chapters ───────────────────────────────────────────
    const existingChapters = await sr.entities.Chapter.filter({ project_id });
    await Promise.all(existingChapters.map(c => sr.entities.Chapter.delete(c.id)));

    const chapterRecords = allChapters.map((ch, idx) => ({
      project_id,
      chapter_number: ch.number || idx + 1,
      title: ch.title || `Chapter ${ch.number || idx + 1}`,
      summary: ch.summary || '',
      prompt: ch.prompt || '',
      status: 'pending',
      word_count: 0,
    }));
    await sr.entities.Chapter.bulkCreate(chapterRecords);
    console.log('runGeneration complete:', chapterRecords.length, 'chapters');

  } catch (error) {
    console.error('runGeneration error:', error);
    if (outlineId) {
      try { await sr.entities.Outline.update(outlineId, { status: 'error', error_message: error.message }); } catch {}
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id } = await req.json();
    if (!project_id) return Response.json({ error: 'project_id required' }, { status: 400 });

    // Always use Gemini Pro for outline/beat sheet generation (better at research & structure)
    // The user's selected model is only used for prose writing in writeChapter
    const sr = base44.asServiceRole;

    // Fire generation in background and return immediately
    (async () => { await runGeneration(sr, project_id, 'gemini-pro'); })();

    return Response.json({ async: true, project_id });
  } catch (error) {
    console.error('generateOutline handler error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});