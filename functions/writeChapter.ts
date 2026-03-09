import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// (openai_key removed — not needed; deepseekValidator uses its own env vars)

// ── Multi-Provider AI Router ──────────────────────────────────────────────────

const MODEL_MAP = {
  "claude-sonnet":     { provider: "anthropic", modelId: "claude-sonnet-4-20250514", defaultTemp: 0.72, maxTokensLimit: null },
  "claude-opus":       { provider: "anthropic", modelId: "claude-opus-4-20250514",   defaultTemp: 0.72, maxTokensLimit: null },
  "claude-opus-4-5":   { provider: "anthropic", modelId: "claude-opus-4-5",          defaultTemp: 0.72, maxTokensLimit: null },
  "claude-sonnet-4-5": { provider: "anthropic", modelId: "claude-sonnet-4-5",        defaultTemp: 0.72, maxTokensLimit: null },
  "claude-haiku-4-5":  { provider: "anthropic", modelId: "claude-haiku-4-5",         defaultTemp: 0.72, maxTokensLimit: null },
  "gpt-4o":            { provider: "openai",    modelId: "gpt-4o",                   defaultTemp: 0.4,  maxTokensLimit: null },
  "gpt-4o-creative":   { provider: "openai",    modelId: "gpt-4o",                   defaultTemp: 0.9,  maxTokensLimit: null },
  "gpt-4-turbo":       { provider: "openai",    modelId: "gpt-4-turbo",              defaultTemp: 0.7,  maxTokensLimit: null },
  "gemini-pro":        { provider: "google",    modelId: "gemini-2.0-flash",         defaultTemp: 0.72, maxTokensLimit: null },
  "deepseek-chat":     { provider: "deepseek",  modelId: "deepseek-chat",            defaultTemp: 0.72, maxTokensLimit: 8192 },
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

const BEAT_STYLES = {
  "fast-paced-thriller": { name: "Fast-Paced Thriller", instructions: "Core Identity: Relentless momentum. Immediate stakes. Forward propulsion at all times.\nSentence Rhythm: Short to medium sentences. Strong, active verbs. Tight paragraphs (1-4 lines). Occasional single-line impact beats.\nPacing: Introduce danger or stakes within first paragraph. Escalate every 2-4 paragraphs. No long exposition blocks. Embed backstory inside action.\nEmotional Handling: Minimal introspection. Decisions made under pressure. Fear shown through action, not reflection.\nDialogue: Direct. Tactical. Urgent. Often incomplete sentences.\nScene Structure: Immediate problem > Tactical reaction > Escalation > Complication > Cliffhanger or propulsion.\nEnding Rule: Scene must close with forward momentum, not emotional resolution." },
  "gritty-cinematic": { name: "Gritty Cinematic", instructions: "Core Identity: Raw realism. Texture-heavy environments. Physical consequence.\nSentence Rhythm: Medium-length sentences. Concrete nouns and verbs. Sparse but sharp metaphors. Weight in description.\nEnvironmental Focus: Sound design (metal, wind, boots, breathing). Temperature, sweat, blood, dust. Physical discomfort emphasized.\nPacing: Tension builds steadily. Physical consequences matter. Injuries affect performance.\nEmotional Handling: Internal conflict expressed through physical sensation. Characters rarely over-explain feelings.\nDialogue: Hard. Minimal. Subtext heavy. Power shifts mid-conversation.\nScene Structure: Immersive environmental anchor > Rising tension > Physical obstacle > Consequence > Stark closing beat.\nEnding Rule: End on something tangible and unsettling." },
  "hollywood-blockbuster": { name: "Hollywood Blockbuster", instructions: "Big visuals, clear stakes, hero-driven. Dynamic pacing, short punch lines. Memorable dialogue, impactful one-liners. High-impact opening > Rising threat > Big obstacle > Reversal > Heroic decision. End: visually strong image or bold declaration." },
  "slow-burn": { name: "Slow Burn", instructions: "Gradual tension layering. Longer paragraphs, measured pacing. Conflict emerges slowly, small anomalies accumulate. Deep internal reflection, subtle shifts. Minimal meaningful dialogue. Calm surface > Subtle disturbance > Emotional layering > Growing discomfort > Unsettling close." },
  "clean-romance": { name: "Clean Romance", instructions: "Core Identity: Emotional intimacy over physical explicitness.\nSentence Rhythm: Warm, flowing prose. Internal monologue present. Balanced dialogue and narration.\nRomantic Rules: No explicit content. Focus on eye contact, proximity, touch. Emotional vulnerability prioritized.\nEmotional Handling: Character insecurity explored gently. Growth through relational friction. Misunderstanding resolved through honesty.\nDialogue: Banter-driven. Playful tension. Soft confessions.\nScene Structure: Relatable moment > Romantic friction > Emotional crack > Vulnerable exchange > Hopeful close.\nEnding Rule: Close with warmth or unresolved romantic tension." },
  "faith-infused": { name: "Faith-Infused Contemporary", instructions: "Core Identity: Hope grounded in real life. Spiritual undertone without preaching.\nSentence Rhythm: Steady, compassionate tone. Reflective but not heavy. Gentle pacing.\nFaith Handling: Scripture brief and organic (if used). Prayer shown, not explained. Faith influences choices subtly.\nEmotional Handling: Themes of grace and forgiveness. Redemption arcs. Relational healing.\nDialogue: Encouraging. Honest. Never sermon-like.\nScene Structure: Real-life challenge > Emotional vulnerability > Faith-reflective moment > Action step > Quiet hope.\nEnding Rule: Close with grounded hope, not dramatic miracle." },
  "investigative-nonfiction": { name: "Investigative Nonfiction", instructions: "Core Identity: Evidence-based narrative progression.\nSentence Rhythm: Structured and logical. Fluid but precise. No exaggeration.\nContent Rules: Cite records and timelines. Distinguish myth vs documented fact. Provide social and political context.\nEmotional Handling: Neutral but immersive. Avoid sensationalism. Let facts create impact.\nStructure: Context > Event reconstruction > Evidence analysis > Broader implication > Transition to next inquiry.\nEnding Rule: Close with unresolved investigative question or documented conclusion." },
  "reference-educational": { name: "Reference / Educational", instructions: "Core Identity: Clarity and structure over narrative drama.\nSentence Rhythm: Clear, direct sentences. Logical flow. Definitions included.\nContent Rules: Headings encouraged. Step-by-step explanations. No emotional dramatization.\nStructure: Definition > Explanation > Application > Example > Summary.\nEnding Rule: Conclude with actionable takeaway." },
  "intellectual-psychological": { name: "Intellectual Psychological", instructions: "Core Identity: Thought-driven tension. Internal analysis.\nSentence Rhythm: Controlled pacing. Analytical phrasing. Occasional sharp fragment.\nEmotional Handling: Character dissects own thoughts. Doubt and perception shifts emphasized. External threat secondary to internal unraveling.\nDialogue: Sparse. Philosophical undertone. Subtle tension.\nStructure: Observation > Interpretation > Doubt > Cognitive shift > Quiet destabilization.\nEnding Rule: End with perception altered." },
  "dark-suspense": { name: "Dark Suspense", instructions: "Core Identity: Claustrophobic dread. Controlled fear escalation.\nSentence Rhythm: Tight. Controlled. Sudden short breaks.\nAtmosphere Rules: Sensory distortion. Limited light. Sound cues. Isolation.\nEscalation: Subtle anomaly > Rationalization > Physical symptom > Threat implied > Reality destabilizes.\nDialogue: Minimal. Quiet. Ominous.\nEnding Rule: End on a line that lingers disturbingly." },
  "satirical": { name: "Satirical", instructions: "Core Identity: Sharp commentary through controlled exaggeration.\nSentence Rhythm: Quick wit. Punchy lines. Clever turns of phrase.\nContent Rules: Irony embedded. Character unaware of own absurdity. Social systems subtly critiqued.\nEmotional Handling: Humor masks critique. Keep tone controlled, not chaotic.\nStructure: Normal scenario > Slight exaggeration > Absurd escalation > Sharp observation > Punchline or ironic twist.\nEnding Rule: Close with a line that reframes the entire scene." },
  "epic-historical": { name: "Epic Historical", instructions: "Grand-scale pivotal history. Resonant lyrical prose. Period-accurate immersion. Melancholy, reverence, stoic endurance. End: landmark or legacy surviving into present." },
  "whimsical-cozy": { name: "Whimsical Cozy", instructions: "Gentle comfort+small magic. Playful bouncing cadence. Low-stakes conflict, found family. Optimism, heartwarming joy. End: sensory detail of meal/fireplace/sleep." },
  "hard-boiled-noir": { name: "Hard-Boiled Noir", instructions: "Cynical urban underworld. Short staccato sentences, slang. Always dark/raining. Fatalism, world-weariness. End: cynical observation about the city." },
  "grandiose-space-opera": { name: "Grandiose Space Opera", instructions: "Large-scale interstellar conflict. Sweeping cinematic prose. Technical jargon + mythic language. Ancient prophecies, massive battles. Awe, wonder, heroic desperation. End: stars or ship into the unknown." },
  "visceral-horror": { name: "Visceral Horror", instructions: "Intense sensory descent into fear. Erratic jarring rhythm. Body horror, psychological warping. Primal terror, helplessness. End: lingering unsettling image." },
  "poetic-magical-realism": { name: "Poetic Magical Realism", instructions: "Supernatural accepted as mundane. Flowing dreamlike prose. Magical elements tied to emotion/family. Nostalgia, melancholy beauty. End: surreal image that feels emotionally true." },
  "clinical-procedural": { name: "Clinical Procedural", instructions: "Meticulous technical focus. Precise efficient prose. Tools, forensics, SOPs. Controlled professional emotion. End: cold hard fact." },
  "hyper-stylized-action": { name: "Hyper-Stylized Action", instructions: "High-energy explosive narrative. Fast percussive pacing. Improbable feats, aesthetic violence. Adrenaline, bravado. End: one-liner or visual flourish." },
  "nostalgic-coming-of-age": { name: "Nostalgic Coming-of-Age", instructions: "Bittersweet childhood-to-adulthood transition. Reflective soft prose. Sensory triggers, small-town settings. Deep yearning, tenderness. End: reflection on how place/person looks different now." },
  "cerebral-sci-fi": { name: "Cerebral Sci-Fi", instructions: "High-concept idea exploration. Dense intellectual prose. Hard science or sociological speculation. Existential dread/curiosity. End: question leaving reader re-evaluating reality." },
  "high-stakes-political": { name: "High-Stakes Political", instructions: "Machiavellian chess match. Sharp double-edged dialogue. Backroom deals, no pure heroes. Paranoia, calculation. End: character looking at reflection or throne." },
  "surrealist-avant-garde": { name: "Surrealist Avant-Garde", instructions: "Dream-logic, abstract imagery. Fragmented stream-of-consciousness. Inanimate objects as characters. Confusion, wonder, unease. End: grammatically correct but logically impossible." },
  "melancholic-literary": { name: "Melancholic Literary", instructions: "Quiet interior focus on sadness/regret. Slow elegant prose, heavy subtext. Internal conflict, domestic settings. Resignation, grace. End: fading light, disappearing sound, small gesture." },
  "urban-gritty-fantasy": { name: "Urban Gritty Fantasy", instructions: "High-magic meets harsh modern city. Fast street-level energy. Underground magical economies. Cynical, resilient, gallows humor. End: protagonist taking a drink in the rain." },
};

const AUTHOR_VOICES_MAP = { hemingway:"Terse, declarative sentences. Iceberg theory.", king:"Conversational, immersive. Rich inner monologue, building dread.", austen:"Witty, ironic social commentary.", tolkien:"Mythic, elevated prose. Rich world-building.", morrison:"Lyrical, poetic. Vivid sensory detail.", rowling:"Accessible, whimsical. Clever wordplay.", mccarthy:"Sparse, biblical. No quotation marks.", atwood:"Sharp, sardonic. Precise word choices.", gaiman:"Mythic yet modern. Fairy-tale cadence.", pratchett:"Satirical. Comedic fantasy, warm humanity.", le_guin:"Sparse elegance, philosophical depth.", vonnegut:"Dark humor, short sentences. Absurdist.", garcia_marquez:"Lush magical realism. Sprawling sentences.", chandler:"Hardboiled noir. First-person cynicism.", christie:"Puzzle-box plotting. Clean readable prose.", gladwell:"Nonfiction storytelling. Counterintuitive hooks.", bryson:"Humorous nonfiction. Self-deprecating wit.", sagan:"Awe-inspiring science writing. Poetic wonder.", didion:"Cool, precise observation." };

const FICTION_ENDING_TYPES = {
  1: "Type A: Mid-action cliffhanger — interrupt the character mid-action, cut to black. No summary, no reflection.",
  2: "Type B: A revelation that recontextualizes what the reader just read. End with the new information, no reaction narration.",
  3: "Type C: A concrete, specific sensory image — an actual thing the character sees/hears/touches. NOT abstract.",
  4: "Type D: A line of dialogue that lands like a gut-punch — absolutely NO narration after the dialogue. The quote is the last thing.",
  5: "Type E: A quiet, mundane action that contrasts with the chapter's intensity — e.g., character makes coffee after a harrowing event.",
};

const NONFICTION_ENDING_TYPES = {
  1: "A quiet, resonant image — a single specific detail that carries the chapter's emotional weight without stating it.",
  2: "A reframing sentence — one line that recasts everything the chapter discussed in a new light.",
  3: "A brief poem, aphorism, or set-apart reflection — 2-4 lines of compressed wisdom, separated from the main text.",
  4: "A lingering question — posed directly to the reader, unanswered, that invites continued reflection.",
  5: "A return to the opening vignette — circle back to the scene or person from the beginning, now seen differently.",
};

function getBeatStyleInstructions(key) {
  if (!key) return "Not specified";
  const beat = BEAT_STYLES[key];
  if (beat) return `${beat.name}\n${beat.instructions}`;
  return key;
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

const OUTPUT_FORMAT_RULES = `OUTPUT FORMAT RULES:
- Return ONLY the prose of the chapter/scene. No preamble. No commentary.
- Do NOT include a chapter title, chapter number, or any heading at the top of your output. The chapter title is handled by the application — start immediately with the first sentence of prose.
- Do NOT include scene headers, scene numbers, or scene titles (e.g. "## SCENE 1" or "SCENE 1: Title"). The ONLY structural marker between scenes is a single line containing just: * * *
- Do not start with "Here is..." or "Sure, here's..." or "I'd be happy to..."
- Do not end with "Let me know if..." or "I hope this..." or any assistant-style closing.
- Do not include content warnings, trigger warnings, or age disclaimers in the output.
- If you are uncertain whether a scene fits within the configured level, write it at the configured level. The author chose that level intentionally.
- If for any reason you cannot generate a portion of a scene, write the scene up to that point and continue past it narratively. NEVER return an error message, apology, or refusal in place of prose. A partial chapter is always better than a refusal.
- You are generating PROSE ONLY. Never output meta-commentary, self-assessment, checklists, or instructions.
- Never say "I appreciate", "I've completed", "I need to clarify", "As requested", or any self-referential language.
- Never output bullet points, checkmarks (✓ ✗ ☐ ☑), or status indicators. These are NOT prose.
- If you feel tempted to explain what you wrote or confirm completion — DON'T. Just write the chapter.`;

const PERMANENT_QUALITY_RULES = `=== PERMANENT QUALITY RULES (applied to ALL manuscripts) ===

RULE 1: PRONOUN CONSISTENCY ENFORCEMENT
- All character pronouns must match established gender throughout the text
- If a character is introduced as male, use he/him/his in ALL contexts: dialogue, action, interior monologue, narrator perspective
- If female, use she/her/hers consistently
- If nonbinary, use they/them/theirs consistently
- This applies even in stream-of-consciousness passages, when switching POV, and in narrator voice
- Never allow a pronoun to contradict established character gender
- If you reference a character by pronoun, verify their gender in the character bible first

RULE 2: NO OVER-NARRATED INTERIORITY
- Never explain an emotion, realization, or shift that the scene has already dramatized
- If tension is visible through dialogue, action, or sensory detail, do NOT follow with "and he knew it" or "she was aware of it"
- Never follow a decisive action with "He'd made a choice" or "This was a turning point" — the action IS the choice
- Never summarize a subtext the reader can already read — trust the scene
- Never end a charged moment with an abstract thesis statement
- If the prose shows it, do not also tell it. Delete the telling.

RULE 3: NEVER SUMMARIZE GENRE-REQUIRED SCENES
- When a genre promises a specific scene (romance: love scene, thriller: confrontation, horror: scare, erotica: intimacy), WRITE IT FULLY
- Do NOT skip it with a summary paragraph or fade-to-black
- Requirements for any scene the genre demands:
  * Stay in the established POV character's close perspective throughout
  * Build in stages with clear escalation
  * Ground in physical sensory detail: texture, temperature, pressure, breath, sound, taste
  * Maintain established power dynamics and character tensions
  * Keep thematic echoes without stating them
  * Use minimal dialogue — only lines that reveal character
  * Match emotional register to the scene (intensity, tenderness, menace, wonder)
  * Never use genre clichés or stock phrases ("waves of pleasure," "electric touch," "molten core," "undone," "claimed")
  * Write with literary precision matching every other scene
  * Transition naturally when the scene concludes
  * Target 600-800 words for major genre-required scenes

RULE 4: EARNED FINAL IMAGES ONLY
- The final image of any chapter must arise organically from the scene's physical reality
- Never end with an on-the-nose metaphor restating the chapter's theme
- Do NOT use: striking a match for danger, door closing for finality, rain for sadness
- Instead, end with a concrete, ordinary detail that carries weight from what preceded it
- Domesticity and ordinariness are more powerful than poetic imagery when the chapter is already charged
- Leave the reader sitting in the scene, not reading a metaphor about the scene
- If the final image could appear on a book cover, it's too on-the-nose — pull back to something smaller and more real

RULE 5: VOCABULARY REPETITION CONTROL
- Track adjective and adverb usage throughout the manuscript
- No distinctive modifier should appear more than 4 times in a full manuscript
- If any adjective or adverb appears more than 4 times, replace excess instances with precise alternatives or restructure to eliminate the modifier
- Do not use the same replacement word twice
- Exempt: common function words (the, very, just, still, almost)
- Watch especially for authorial tics: "specific," "particular," "precise," "deliberate," "careful," "quiet" — enforce variety
- Run this check before finalizing any chapter output`;

function buildAuthorModeBlock(spec) {
  const beatKey = spec?.beat_style || spec?.tone_style;
  const beatName = beatKey ? (getBeatStyleInstructions(beatKey).split('\n')[0]) : 'Not specified';
  const spiceLevel = parseInt(spec?.spice_level) || 0;
  const langLevel = parseInt(spec?.language_intensity) || 0;
  return `AUTHOR MODE — CREATIVE FICTION GENERATION

You are a professional fiction ghostwriter fulfilling a paid creative writing commission. You are NOT an assistant having a conversation. You are generating prose for a novel manuscript.

The author has explicitly configured the following content settings for this project:
- Beat Style: ${beatName}
- Spice Level: ${spiceLevel} out of 4
- Language Intensity: ${langLevel} out of 4

These settings represent the author's intentional creative choices for their manuscript. You MUST honor these settings fully. Specifically:

1. DO NOT refuse, soften, or censor content that falls within the configured spice and language levels. The author has opted in.
2. DO NOT add disclaimers, warnings, author's notes, or meta-commentary about the content. You are writing prose, not advising.
3. DO NOT replace requested language intensity with softer alternatives. If the author set Language Intensity to 3 or 4, characters must swear as specified — do not substitute with "he cursed" or "she swore under her breath" instead of writing the actual words.
4. DO NOT fade to black or skip intimate scenes if the Spice Level permits them. Write the scene at the level requested.
5. DO NOT break character to explain what you "can't" do. You are a ghostwriter. Write the manuscript.
6. DO NOT insert moralizing narration that contradicts the story's tone. Villains can be villainous. Morally gray characters can stay gray. The story's themes handle the ethics, not narrator disclaimers.

If a scene involves content at the configured level, write it with full craft: pacing, emotional grounding, sensory detail, and narrative purpose — exactly as a published novelist would.

The only absolute limits are the CONTENT GUARDRAILS listed below, which override all settings and cannot be configured by the user.`;
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
  // Check for refusal indicators first; short text alone is not a refusal
  if (REFUSAL_INDICATORS.some(phrase => lower.includes(phrase))) return true;
  // Very short output (< 200 chars) without refusal indicators is still suspicious
  if (text.trim().length < 200) return true;
  return false;
}

// Helper functions for opening/ending type rotation
function getOpeningType(chapterNumber) {
  const index = ((chapterNumber - 1) % 5) + 1;
  const types = {
    1: { name: "Mid-action", desc: "the character is already DOING something physical (not walking, not standing, not thinking — actively doing a task)" },
    2: { name: "Dialogue", desc: "open mid-conversation with a spoken line, no attribution tag first" },
    3: { name: "A single concrete sensory detail", desc: "one sense, one sentence, visceral and specific" },
    4: { name: "Time/place anchor with immediate physical action", desc: "e.g., 'Tuesday, 3 AM. Lucas's hands were bleeding.'" },
    5: { name: "Internal thought that contradicts what happens next", desc: "e.g., character thinks 'nothing will change' right before everything changes" }
  };
  return types[index];
}

function getEndingType(chapterNumber) {
  const index = ((chapterNumber + 1) % 5) + 1;
  const types = {
    1: { name: "Type A: Mid-action cliffhanger", desc: "interrupt the character mid-action, cut to black. No summary, no reflection." },
    2: { name: "Type B: A revelation that recontextualizes", desc: "the revelation that recontextualizes what the reader just read. End with the new information, no reaction narration." },
    3: { name: "Type C: A concrete, specific sensory image", desc: "an actual thing the character sees/hears/touches. NOT abstract." },
    4: { name: "Type D: A line of dialogue that lands like a gut-punch", desc: "absolutely NO narration after the dialogue. The quote is the last thing." },
    5: { name: "Type E: A quiet, mundane action that contrasts with the chapter's intensity", desc: "e.g., character makes coffee after a harrowing event." }
  };
  return types[index];
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

// ISSUE 1 FIX: Helper to safely parse outline data, story bible, and metadata
async function parseOutlineField(field, fieldUrl) {
  try {
    let data = field;
    if (!data && fieldUrl) {
      const response = await fetch(fieldUrl);
      data = await response.json();
      return data;
    }
    if (typeof data === 'string' && data.trim()) {
      return JSON.parse(data);
    }
    return null;
  } catch (err) {
    console.error('Parse field error:', err.message);
    return null;
  }
}

// PART A — Build character consistency enforcement block from story bible
function buildCharacterConsistencyBlock(storyBible) {
  const characters = storyBible?.characters;
  if (!characters || !Array.isArray(characters) || characters.length === 0) return '';
  const lines = characters.map(c => {
    let line = `- ${c.name}`;
    if (c.description) line += `: ${c.description}`;
    if (c.role) line += ` (Role: ${c.role})`;
    return line;
  }).join('\n');
  return `=== CHARACTER CONSISTENCY (CRITICAL — NEVER VIOLATE) ===
These characters have FIXED attributes. Do NOT change their gender, name, appearance, or pronouns across chapters:
${lines}

If a character uses he/him pronouns in the story bible or previous chapters, use he/him in EVERY chapter.
If a character uses she/her pronouns, use she/her in EVERY chapter. No exceptions.
=== END CHARACTER CONSISTENCY ===`;
}

// PART B — Extract distinctive phrases from chapter text for cross-chapter repetition prevention
function extractDistinctivePhrases(text) {
  const phrases = new Set();
  // Metaphors and similes
  const simileRegex = /[\w\s,]+(like a|as if|as though)[\w\s,]+/gi;
  let match;
  while ((match = simileRegex.exec(text)) !== null) {
    const phrase = match[0].trim().slice(0, 60);
    if (phrase.split(' ').length >= 3) phrases.add(phrase.toLowerCase());
  }
  // Unusual literary adjective+noun pairs
  const adjNounRegex = /\b(surgical|predatory|velvet|cathedral|obsidian|glacial|molten|razor|iron|silk|phantom|hollow|ancient|fractured|luminous|shadowed|careful|deliberate|controlled|precise|calculated|architectural)\s+\w+/gi;
  while ((match = adjNounRegex.exec(text)) !== null) {
    phrases.add(match[0].trim().toLowerCase());
  }
  // 3-word phrases appearing more than once
  const words = text.toLowerCase().split(/\s+/);
  const phraseCount = {};
  const SKIP = new Set(['she said that', 'he said that', 'and she was', 'and he was', 'that she had', 'that he had', 'she looked at', 'he looked at', 'she had been', 'he had been']);
  for (let i = 0; i < words.length - 2; i++) {
    const p3 = words.slice(i, i + 3).join(' ').replace(/[^a-z\s]/g, '').trim();
    if (p3.split(' ').length === 3 && p3.split(' ').every(w => w.length > 2) && !SKIP.has(p3)) {
      phraseCount[p3] = (phraseCount[p3] || 0) + 1;
    }
  }
  for (const [phrase, count] of Object.entries(phraseCount)) {
    if (count >= 2) phrases.add(phrase);
  }
  return [...phrases].slice(0, 30).sort();
}

// PART 1 — Extract and normalize physical tics per character (16 families)
function extractPhysicalTics(text) {
  const TIC_PATTERNS = [
    { canonical: 'chest tightened', rx: /\b(chest|ribcage)\s+(tighten\w*|constrict\w*|compress\w*|squeez\w*)\b|tightn?\w*\s+in\s+(his|her|their|the)\s+chest\b/gi },
    { canonical: 'jaw tightened', rx: /\bjaw\s+(tightened|clenched?|clenching|set|locked?)\b/gi },
    { canonical: 'throat tightened', rx: /\b(throat|airway)\s+(tightened?|clenched?|constricted?)\b/gi },
    { canonical: 'stomach twisted', rx: /\b(stomach|gut|belly)\s+(twisted?|dropped?|flipped?|knotted?|clenched?)\b/gi },
    { canonical: 'fists clenched', rx: /\b(fist|fists|hand|hands)\s+(clenched?|curled? into fists?|balled? into fists?)\b/gi },
    { canonical: 'fingers tightened', rx: /\b(fingers?|grip|hold|grasp)\s+(tightened?|clenched?|curled?|digging? into|gripped?|whitened?)\b/gi },
    { canonical: 'breath caught', rx: /\b(breath|breathing)\s+(caught|catching|hitched?|stuttered?|stopped?)\b|stopped? breathing|forgot to breathe/gi },
    { canonical: 'pulse quickened', rx: /\b(pulse|heartbeat)\s+(quickened?|raced?|throbbed?|hammered?|spiked?)\b/gi },
    { canonical: 'heart raced', rx: /\b(heart|heartbeat)\s+(raced?|pounded?|hammered?|thudded?|thundered?|slammed?|stuttered?)\b/gi },
    { canonical: 'shiver down spine', rx: /\b(shiver|chill)\w*\s+(down|up|ran|coursed|through)\s+(his|her|their|the)\s+(spine|back)\b/gi },
    { canonical: 'jolt through body', rx: /\bjolt\w*\s+(through|of|ran|shot)\b|(shock|bolt)\s+(through|ran|shot)\s+(him|her|them|his|her|their|the)\b/gi },
    { canonical: 'skin prickled', rx: /\bskin\s+(prickled?|tingled?|crawled?)\b|goosebumps?|gooseflesh/gi },
    { canonical: 'flush crept', rx: /\bflush\w*\s+(crept?|spread|rose)\b|heat\s+(crept?|spread|rose|bloomed?)\s+(up|across|into|to)\b|color\s+(crept?|rose|flooded?)\s+(up|across)\b/gi },
    { canonical: 'mouth went dry', rx: /\bmouth\s+(went|was|grew)\s+dry\b|dry\s+mouth|swallowed? against dryness/gi },
    { canonical: 'knees went weak', rx: /\b(knees?|legs?)\s+(went|was|grew)\s+(weak|soft|unsteady|shaky)\b|(knees?|legs?)\s+(buckled?|wobbled?|trembled?|gave way)\b/gi },
    { canonical: 'blood ran cold', rx: /\b(blood|color)\s+(ran|went|turned)\s+(cold|ice|white|pale)\b|blood\s+(drained|left|drained away)\b/gi },
  ];

  const ticsByChar = {};
  for (const { canonical, rx } of TIC_PATTERNS) {
    let match;
    rx.lastIndex = 0;
    while ((match = rx.exec(text)) !== null) {
      const idx = match.index;
      const ctx = text.slice(Math.max(0, idx - 150), idx + match[0].length + 150);
      const nameMatch = ctx.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)?\b/);
      const charName = nameMatch ? nameMatch[0] : 'Unknown';
      if (!ticsByChar[charName]) ticsByChar[charName] = {};
      ticsByChar[charName][canonical] = (ticsByChar[charName][canonical] || 0) + 1;
    }
  }
  return ticsByChar; // { charName -> { ticName -> count } }
}



// PART 2 — Extract metaphor cluster usage (6 families)
const METAPHOR_CLUSTER_WORDS = {
  'FIRE': ['burn', 'burns', 'burned', 'burning', 'flame', 'flames', 'flaming', 'ignite', 'ignited', 'igniting', 'blaze', 'blazed', 'blazing', 'scorch', 'scorched', 'scorching', 'ember', 'embers', 'ash', 'ashes', 'smoke', 'smoked', 'smoking', 'kindle', 'kindled', 'kindling', 'spark', 'sparks', 'sparked', 'sparking', 'inferno', 'fire', 'fires', 'smolder', 'smoldered', 'smoldering', 'sear', 'seared', 'searing'],
  'WATER': ['drown', 'drowns', 'drowned', 'drowning', 'flood', 'flooded', 'flooding', 'wave', 'waves', 'current', 'currents', 'tide', 'tides', 'submerge', 'submerged', 'submerging', 'surface', 'surfaced', 'surfacing', 'depth', 'depths', 'pour', 'poured', 'pouring', 'overflow', 'overflowed', 'overflowing', 'undertow', 'undercurrent'],
  'DARKNESS': ['shadow', 'shadows', 'shadowed', 'shadowy', 'dark', 'darker', 'darkened', 'darkening', 'darkness', 'dim', 'dimmed', 'dimming', 'eclipse', 'eclipsed', 'void', 'abyss', 'night', 'blackness', 'gloom', 'gloomy', 'murk', 'murky'],
  'CHAOS': ['chaos', 'chaotic', 'storm', 'storms', 'storming', 'stormy', 'whirlwind', 'tempest', 'spiral', 'spiraled', 'spiraling', 'unravel', 'unraveled', 'unraveling', 'shatter', 'shattered', 'shattering', 'crack', 'cracked', 'cracking', 'fracture', 'fractured', 'fracturing', 'rupture', 'ruptured', 'rupturing'],
  'EDGE': ['edge', 'edges', 'cliff', 'cliffs', 'precipice', 'brink', 'freefall', 'plunge', 'plunged', 'plunging', 'dive', 'dived', 'diving', 'vertigo', 'abyss', 'chasm'],
  'ENCLOSURE': ['cage', 'caged', 'cages', 'trap', 'trapped', 'trapping', 'lock', 'locked', 'locking', 'seal', 'sealed', 'sealing', 'confine', 'confined', 'confining', 'corner', 'cornered', 'cornering', 'pin', 'pinned', 'pinning', 'press', 'pressed', 'pressing', 'close', 'closed', 'closing', 'enclose', 'enclosed'],
};

function extractMetaphorClusters(text) {
  const result = {};
  const lowerText = text.toLowerCase();
  for (const [cluster, words] of Object.entries(METAPHOR_CLUSTER_WORDS)) {
    let count = 0;
    const matched = [];
    for (const word of words) {
      const rx = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(rx);
      if (matches) {
        count += matches.length;
        matched.push(...matches);
      }
    }
    result[cluster] = { count, matched: [...new Set(matched)] };
  }
  return result; // { clusterName -> { count, matched } }
}

// PART D — Genre detection helper for intimate scene rules
function isIntimateGenre(spec) {
  const g = ((spec?.genre || '') + ' ' + (spec?.subgenre || '')).toLowerCase();
  return /erotica|romance|adult|erotic/.test(g);
}

// PART 3 — Scan dialogue for banned subtext patterns
function scanDialoguePatterns(text) {
  const dialogueRegex = /[""]([^""]+?)[""]|'([^']+?)'/g;
  let match;
  const allDialogue = [];
  while ((match = dialogueRegex.exec(text)) !== null) {
    const dialogue = match[1] || match[2];
    allDialogue.push(dialogue.toLowerCase());
  }
  const dialogueText = allDialogue.join(' ');

  const patterns = {
    afraid_of_metaphor: /are you afraid of|are you afraid to/gi,
    what_if_i_want: /what if i want to|what if i wanted to/gi,
    let_go: /let go|stop hiding|step outside your comfort zone|stop running/gi,
    dare_to_risk: /willing to risk|willing to take that risk|willing to take the risk/gi,
    rhetorical_invitation: /do you want to find out|are you sure you can handle|then why are you|then why don't you|do you understand what you/gi,
    narrating_dynamic: /you're intrigued|you can't just|you can't stand|you're just as|you're not like/gi,
    labeling_tension: /this is dangerous|we're playing with|this could ruin|this could destroy|what we have is/gi,
    tell_me_you_want: /tell me you want|tell me you need|tell me you feel/gi,
    philosophical_dare: /what are you afraid of|what do you want|what do you really want|what do you truly want|what do you desire|what do you really desire|what do you truly desire/gi,
  };

  const results = [];
  for (const [patternName, rx] of Object.entries(patterns)) {
    rx.lastIndex = 0;
    const matches = dialogueText.match(rx);
    if (matches && matches.length > 0) {
      results.push({ pattern: patternName, count: matches.length, examples: matches.slice(0, 2) });
    }
  }
  return results; // [{ pattern, count, examples }]
}

const INTIMATE_SCENE_RULES = `INTIMATE SCENE RULES — MANDATORY FOR EROTICA/ROMANCE GENRE:

1. MINIMUM PHYSICAL ESCALATION: When a physical/intimate moment begins (kiss, touch, embrace), it MUST continue for a MINIMUM of 4 full paragraphs before any interruption, pullback, or scene break. This is non-negotiable.

2. WHAT THOSE 4 PARAGRAPHS MUST CONTAIN:
   - Paragraph 1: The initial physical contact — described through specific, concrete sensory detail. Not "the kiss was raw and urgent" but the actual physical reality: how the other person's mouth felt, the texture of skin, the pressure of hands, whether it was tentative or confident, what their body was doing.
   - Paragraph 2: Escalation through a second sense — if P1 was about touch, P2 brings in taste, or sound, or the way the other person smells up close. Layer the senses. Show the character's awareness narrowing to the physical.
   - Paragraph 3: Interiority during the physical act — what this contact is doing to the character emotionally. Not "he felt desire" but the specific texture of what they're feeling: is it relief? Grief? The terrifying sense of something they can't take back? The surprise of another person's body?
   - Paragraph 4: The moment shifts — either deepening further (hands move, bodies adjust, breathing changes, the dynamic shifts from tentative to certain) OR the natural conclusion that doesn't feel like a cop-out.

3. INTERRUPTIONS EARN THEIR PLACE: If a physical moment IS interrupted, it must arrive AFTER the 4-paragraph minimum. The interruption must be felt as a LOSS. Characters must show physical aftermath (disorientation, difficulty speaking, hands still warm from contact).

4. BAN ON SMIRKING AFTER INTIMACY: After a kiss or physical moment, no character may "smirk" or deliver a witty one-liner. Characters after genuine intimate contact are affected — breathless, disoriented, serious, frightened, or elated — but never smug.

5. BY CHAPTER 3 of an erotica novel, physical intimacy must have progressed BEYOND a single kiss. The pacing must match genre expectations. This doesn't mean rushing — it means honoring the genre the reader chose.

6. NO CONVENIENT INTERRUPTIONS: Do NOT use plot devices (phone rings, someone knocks, character suddenly remembers an obligation) to cut away from an intimate scene before the 4-paragraph minimum is met. This is a genre violation.`;

const PLOT_SUBTEXT_RULES = `PLOT AND SUBTEXT RULES:
- When a chapter contains a twist, reversal, or reveal, the dialogue and interiority leading up to it must support MULTIPLE interpretations until the reveal moment.
- Characters who are concealing motives must speak in ways that could be read as sincere, deflecting, OR calculating. Never write dialogue that only makes sense if the reader already knows the twist.
- The reader should arrive at the twist AT THE SAME MOMENT as the POV character, not before. If the POV character is being manipulated, the reader should feel manipulated too.
- Avoid single-line dialogue responses that function as winking confessions (e.g., "Did I?" or "You'll see" or "Maybe that was the point"). These telegraph intent. Replace with responses that carry genuine emotional ambiguity.
- Subtext is always more powerful than text. A character's true motives should be visible only in retrospect, when the reader replays the scene knowing the truth.`;

const DIALOGUE_SUBTEXT_RULES = `DIALOGUE AND SUBTEXT RULES — MANDATORY:

1. NO CHARACTER may speak in a way that ONLY makes sense as flirtation or seduction. Every line of dialogue must have a plausible surface meaning that is NOT about attraction. The subtext can be about desire, but the TEXT must be about something else — the art, the assignment, the argument, the event, the work.

2. BANNED DIALOGUE PATTERNS — never generate these:
   - "Are you afraid of [X]?" / "What if I want to [X]?" exchanges
   - One character daring the other to "let go" or "stop hiding" or "step outside your comfort zone" more than once per chapter
   - Rhetorical questions functioning as sexual invitations: "Do you want to find out?" / "Are you sure you can handle it?" / "Then why are you still here?"
   - Characters narrating their own dynamic: "You're intrigued, aren't you?" / "You can't just stand on the sidelines"
   - Any line where a character explicitly labels the tension: "This is dangerous" / "We're playing with fire" / "This could ruin everything"

3. TENSION MUST BE BUILT THROUGH CONTRAST, NOT ESCALATION. The most effective scenes work because the characters are trying NOT to acknowledge what's happening. They talk about work, art, other people — and desire leaks through in pauses, in things left unsaid, in moments where the conversation almost touches the real subject and then veers away.

4. SHOW, DON'T TELL THE DYNAMIC. Instead of Character A saying "You're afraid to let go," SHOW Character B watching A's hands while A talks about something unrelated. Instead of Character B saying "This is dangerous," show them leaving the room mid-conversation and not being able to explain why.

5. NO character should deliver more than 2 consecutive lines of dialogue that are philosophically provocative. Real people pause, deflect, make jokes, say boring things, talk about logistics. Break up intense dialogue with mundane reality.`;

const DIALOGUE_SUBTEXT_RULES_CONCISE = `DIALOGUE SUBTEXT RULES (MANDATORY):
A. Every line of dialogue must have a plausible surface meaning that is NOT about attraction. Subtext can imply desire, but the spoken words must be about work, art, the event, the argument, or logistics.
B. BANNED dialogue constructions:
   - "Are you afraid of [metaphor]?" / "What if I want to [metaphor]?"
   - Daring another character to "let go" / "stop hiding" / "stop running" (max 1 per entire book)
   - "Do you want to find out?" / "Are you sure you can handle it?"
   - Characters narrating their own dynamic: "You're intrigued, aren't you?"
   - Labeling tension: "This is dangerous" / "We're playing with fire" / "The rule is that [statement about the relationship]"
   - "Tell me you want this" / "Tell me you need this"
   - "What do you truly want/desire?"
C. Build tension through CONTRAST. Characters try NOT to acknowledge what's happening. Desire leaks through pauses, things left unsaid, moments where conversation veers away from the real subject.
D. Max 2 consecutive philosophically provocative lines per character. Break intense dialogue with mundane reality.
E. After physical intimacy, no character may smirk, deliver a witty one-liner, or say "You taste like [noun] and [noun]".`;

// QUALITY VALIDATOR FOR PERMANENT RULES — checks Rule 1, 2, 4, 5
function validatePermanentRules(text, characters = []) {
  const violations = [];

  // RULE 1: Pronoun consistency — basic check for obvious pronoun/gender mismatches
  const pronounPattern = /\b(he|his|him|she|her|hers|they|their|theirs)\b/gi;
  let match;
  const genderMap = {}; // charName -> pronouns used
  for (const char of characters) {
    const charName = char.name;
    if (!charName) continue;
    const charPronouns = char.pronouns ? char.pronouns.toLowerCase() : (char.role === 'female' || /\bshe\b|\bgirl\b|\bwoman\b/i.test(char.description) ? 'she' : 'he');
    if (!genderMap[charName]) genderMap[charName] = new Set();
    if (charPronouns.includes('she')) genderMap[charName].add('she');
    if (charPronouns.includes('he')) genderMap[charName].add('he');
    if (charPronouns.includes('they')) genderMap[charName].add('they');
  }
  // Spot-check: look for obvious mismatches in narrative mentions
  for (const [charName, expectedPronouns] of Object.entries(genderMap)) {
    if (expectedPronouns.size > 1) continue; // Skip ambiguous cases
    const expectedPronoun = [...expectedPronouns][0];
    // This is a heuristic check — a full validation would require parsing context
    // Flag only if we see contradictory pronoun usage in close proximity
    const contextRegex = new RegExp(`\\b${charName}\\b[^.!?]*?(he|she|they)\\b`, 'gi');
    const mentions = [...text.matchAll(contextRegex)];
    if (mentions.length > 2) {
      const pronounsUsed = new Set(mentions.map(m => m[1].toLowerCase()));
      if (pronounsUsed.size > 1 && expectedPronouns.size === 1) {
        violations.push(`PRONOUN CONSISTENCY: Character "${charName}" uses ${[...pronounsUsed].join('/')} but should be ${expectedPronoun}`);
      }
    }
  }

  // RULE 2: Over-Narrated Interiority — detect explanation after dramatized emotion
  const overNarratedPatterns = [
    /[.!?]\s+[A-Z][^.!?]*\b(he|she) (knew|realized|understood|was aware that|understood that|became aware|sensed)\b/gi,
    /[.!?]\s+[A-Z][^.!?]*\b(it was|this was|that was)\s+(a (moment|turning point|choice|decision|realization|confession)|deciding|choosing)/gi,
    /[.!?]\s+[A-Z][^.!?]*(and\s+)?(he|she)\s+(had made|had chosen|knew|understood|saw)\s+[a-z]+ (choice|decision|truth|realization)/gi,
  ];
  for (const pattern of overNarratedPatterns) {
    if (pattern.test(text)) {
      violations.push(`OVER-NARRATED INTERIORITY: Detected explanation of emotion after dramatized scene`);
      break;
    }
  }

  // RULE 4: On-the-nose final images — check last paragraph for obvious metaphors
  const lastParagraphs = text.trim().split(/\n\n+/).slice(-2).join('\n\n').toLowerCase();
  const onTheNosePatterns = [
    /\b(striking|struck|strike|light\w*)\s+(a\s+)?match\b/i, // match = danger
    /\b(door|window|gate)\s+(clos\w+|slammed?|shut)\b/i, // closing = finality
    /\brain\b.*\b(fell|dropped|descended|wept|cried|tears)\b/i, // rain = sadness
    /\b(light|sun|moon|star)\s+(fad\w+|dimm\w+|disappear\w+|set)\b/i, // fading light = ending
    /\b(empty|vacant|hollow|blank)\s+(look|gaze|stare|face|heart|chest)\b/i, // emptiness = loss
    /\b(rose|ascend\w+|lift\w+)\s+.*\b(hope|spirit|determination)\b/i, // rising = hope
  ];
  for (const pattern of onTheNosePatterns) {
    if (pattern.test(lastParagraphs)) {
      violations.push(`ON-THE-NOSE FINAL IMAGE: Last paragraph contains obvious metaphor — needs to be more concrete and ordinary`);
      break;
    }
  }

  // RULE 5: Vocabulary repetition — count distinctive adjectives/adverbs
  const words = text.match(/\b[a-z]{4,}\b/gi) || [];
  const adjAdverbCandidates = ['specific', 'particular', 'precise', 'deliberate', 'careful', 'quiet', 'soft', 'harsh', 'bright', 'dark', 'cold', 'warm', 'electric', 'fierce', 'gentle', 'sharp', 'blunt', 'subtle', 'obvious', 'clear', 'vague', 'intense', 'fragile', 'strong', 'weak', 'heavy', 'light'];
  const wordCounts = {};
  for (const word of words) {
    const lower = word.toLowerCase();
    if (adjAdverbCandidates.includes(lower)) {
      wordCounts[lower] = (wordCounts[lower] || 0) + 1;
    }
  }
  const overused = Object.entries(wordCounts).filter(([, count]) => count > 4);
  if (overused.length > 0) {
    violations.push(`VOCABULARY REPETITION: Overused words (>4 times each): ${overused.map(([w, c]) => `"${w}" (${c}x)`).join(', ')}`);
  }

  return violations;
}

// PART 6 — EXTENDED POST-GENERATION QUALITY SCANNER
function scanChapterQuality(text, chapterNumber, previousChapters = [], storyBible = null, bookType = "fiction", characters = []) {
  const bannedPhrases = {
    physicalReactions: [
      "heart racing", "heart raced", "heart pounding", "heart pounded", "heart hammered", "heart thudded", "heart thundering",
      "pulse quickened", "pulse raced", "pulse thrummed", "breath hitched", "breath caught", "breath quickened", "breathing quickened",
      "swallowed hard", "throat dry", "throat tight", "shiver down his spine", "shiver up his spine", "shiver ran through", "shiver coursed",
      "a thrill coursed through", "a jolt of", "a surge of", "cheeks flushed", "heat rose to his cheeks", "flush crept into",
      "couldn't tear himself away", "couldn't look away", "knees weak", "legs trembled",
      "a rush of adrenaline", "a rush of heat", "a rush of desire", "a rush of excitement", "a rush of emotion", "a rush of warmth",
      "a flicker of", "a spark of", "a flash of heat", "a flash of desire", "a flash of anger", "a flash of fear",
      "igniting a fire", "ignited a fire", "igniting a flame", "ignited a flame", "igniting a spark", "ignited a spark", "igniting a hunger", "ignited a hunger",
      "a fire in him", "a fire within him", "a fire inside him", "a fire in her", "a fire within her", "a fire inside her", "a fire in them", "a fire within them", "a fire inside them",
      "heat pooling in", "heat pooled in"
    ],
    atmosphereClichés: [
      "intoxicating", "intoxicated", "electric", "electricity", "electrifying", "palpable", "air thickened", "air crackled", "air grew heavy",
      "air felt charged", "air felt thick", "shadows danced", "shadows shifted", "shadows twisted", "shadows swirled", "shadows crept",
      "darkness enveloped", "darkness pressed", "darkness wrapped", "darkness beckoned", "whispers echoed", "whispers slithered", "whispers wrapped",
      "tendrils of", "the weight of", "siren call", "siren's call", "siren song", "like a moth to a flame",
      "the air between them thick with", "the air around them thick with", "the air thick with", "the air between them heavy with", "the air around them heavy with", "the air heavy with",
      "the air between them charged with", "the air around them charged with", "the air charged with", "a moth drawn to a flame",
      "hung in the air", "lingered in the air", "stretched in the air", "crackled in the air", "laced with", "heavy with implication", "heavy with meaning", "heavy with possibility",
      "heavy with tension", "heavy with promise", "heavy with unspoken", "loaded with implication", "loaded with meaning", "loaded with innuendo",
      "fraught with", "thick with tension", "thick with meaning", "thick with unspoken", "thick with possibility", "thick with implication",
      "charged and electric", "charged with tension", "charged with anticipation", "charged with possibility", "charged with meaning"
    ],
    narrationClichés: [
      "in that moment", "just the beginning", "just begun", "only the beginning", "only just begun", "no turning back", "no going back",
      "teetering on the edge", "on the precipice", "on the brink", "standing at the edge", "double-edged sword", "ready to embrace",
      "ready to confront", "ready to face whatever", "a mix of", "a mixture of", "a blend of", "a cocktail of", "he felt alive",
      "she felt alive", "feeling alive", "more than mere", "more than just", "the world around him faded", "the world outside faded",
      "reality faded", "a tapestry of", "a kaleidoscope of", "a whirlwind of", "a maelstrom of",
      "something deeper", "something more", "something explosive", "something unspoken", "something primal", "something raw", "something dark", "something dangerous",
      "unspoken tension", "unspoken promise", "unspoken understanding", "unspoken challenge", "unspoken connection", "unspoken agreement", "unspoken bond", "unspoken truth",
      "an unspoken tension", "an unspoken promise", "a knowing smile", "a knowing smirk", "a knowing grin", "a knowing glint", "a knowing look", "a knowing glance",
      "a playful smile", "a playful smirk", "a playful grin", "a playful glint", "a playful look", "a playful glance",
      "a mischievous smile", "a mischievous smirk", "a mischievous grin", "a mischievous glint", "a mischievous look", "a mischievous glance",
      "a teasing smile", "a teasing smirk", "a teasing grin", "a teasing glint", "a teasing look", "a teasing glance",
      "the thrill of the chase", "thrill of the chase", "a dangerous game", "a dangerous dance", "a dangerous allure",
      "playing with fire", "testing boundaries", "tested boundaries", "testing the boundaries", "testing his boundaries", "testing her boundaries", "testing their boundaries",
      "pushing boundaries", "pushed boundaries", "pushing the boundaries", "pushing his boundaries", "pushing her boundaries", "pushing their boundaries",
      "testing limits", "pushing limits", "the game had just begun", "the game has just begun", "the game had only just begun", "the game had begun", "the game had started",
      "the dance had just begun", "the dance had begun", "couldn't shake the feeling", "couldn't ignore the feeling", "couldn't deny the feeling", "couldn't resist the feeling",
      "couldn't shake the pull", "couldn't ignore the pull", "couldn't resist the pull", "couldn't resist the attraction", "couldn't resist the urge", "couldn't resist the draw",
      "an invisible thread", "an invisible force", "an invisible pull", "an invisible tether", "an invisible string", "an invisible cord",
      "invisible thread", "invisible force", "invisible pull", "cutting through the noise like a knife", "cutting through the chatter like a knife", "cutting through the silence like a knife",
      "cutting through the air like a knife", "cutting through the tension like a knife", "a storm brewing within", "a storm raging within", "a tempest brewing within",
      "a fire burning within", "a war churning within", "a storm brewing inside", "the facade slipping", "the facade cracking", "the facade crumbling",
      "the professional facade slipping", "the professional facade cracking", "eroding like sand", "eroding like stone"
    ],
    dialogueClichés: [
      "control is an illusion", "knowledge is power", "embrace it", "embrace your desires", "embrace the darkness", "let go of your fear",
      "surrender to it", "what if i lose myself", "what if i can't handle", "you're not like the others",
      "what do you truly want", "what do you truly desire", "what do you really want", "what do you really desire",
      "how far are you willing to go", "how far you're willing to go", "let's see where this leads", "let's see how far this goes",
      "shall we see where this leads", "are you willing to take that risk", "are you prepared to face the consequences",
      "are you ready to take that risk", "are you ready to accept the consequences", "is this what you truly want"
    ],
    showDontTellPatterns: [
      "he felt", "she felt", "a sense of", "flooded through", "he was filled with", "she was filled with"
    ],
    endingPatterns: [
      "he was ready to", "she was ready to", "he was no longer", "she was no longer", "he was not just", "she was not just",
      "journey was just beginning", "journey had just begun", "whatever lay ahead", "whatever lies ahead", "knew that"
    ]
  };

  const lowerText = text.toLowerCase();
  const violations = [];
  let violationCount = 0;

  // Check physical reactions
  const physicalMatches = [];
  for (const phrase of bannedPhrases.physicalReactions) {
    const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) {
      physicalMatches.push(...matches.slice(0, 2).map(m => phrase));
      violationCount += matches.length;
    }
  }

  // Check atmosphere clichés
  const atmosphereMatches = [];
  for (const phrase of bannedPhrases.atmosphereClichés) {
    const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) {
      atmosphereMatches.push(...matches.slice(0, 2).map(m => phrase));
      violationCount += matches.length;
    }
  }

  // Check narration clichés
  const narrationMatches = [];
  for (const phrase of bannedPhrases.narrationClichés) {
    const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) {
      narrationMatches.push(...matches.slice(0, 2).map(m => phrase));
      violationCount += matches.length;
    }
  }

  // Check dialogue clichés
  const dialogueMatches = [];
  for (const phrase of bannedPhrases.dialogueClichés) {
    const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) {
      dialogueMatches.push(...matches.slice(0, 2).map(m => phrase));
      violationCount += matches.length;
    }
  }

  // Check show-don't-tell patterns
  const showDontTellMatches = [];
  for (const pattern of bannedPhrases.showDontTellPatterns) {
    const regex = new RegExp(`${pattern}\\s+\\w+`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) {
      showDontTellMatches.push(...matches.slice(0, 2));
      violationCount += matches.length;
    }
  }

  // Check ending patterns (last 200 chars only)
  const lastChunk = lowerText.slice(-200);
  const endingMatches = [];
  for (const pattern of bannedPhrases.endingPatterns) {
    const regex = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = lastChunk.match(regex);
    if (matches) {
      endingMatches.push(...matches.slice(0, 1).map(m => pattern));
      violationCount += matches.length;
    }
  }

  const allBannedFound = [
    ...physicalMatches,
    ...atmosphereMatches,
    ...narrationMatches,
    ...dialogueMatches,
    ...showDontTellMatches,
    ...endingMatches
  ];

  if (physicalMatches.length > 0) {
    violations.push(`PHYSICAL REACTIONS (${physicalMatches.length}): ${physicalMatches.join(', ')}`);
  }
  if (atmosphereMatches.length > 0) {
    violations.push(`ATMOSPHERE CLICHÉS (${atmosphereMatches.length}): ${atmosphereMatches.join(', ')}`);
  }
  if (narrationMatches.length > 0) {
    violations.push(`NARRATION CLICHÉS (${narrationMatches.length}): ${narrationMatches.join(', ')}`);
  }
  if (dialogueMatches.length > 0) {
    violations.push(`DIALOGUE CLICHÉS (${dialogueMatches.length}): ${dialogueMatches.join(', ')}`);
  }
  if (showDontTellMatches.length > 0) {
    violations.push(`SHOW-DON'T-TELL (${showDontTellMatches.length}): ${showDontTellMatches.slice(0, 2).join(', ')}`);
  }
  if (endingMatches.length > 0) {
    violations.push(`ENDING PATTERN (${endingMatches.length}): ${endingMatches.join(', ')}`);
  }

  // PART 6 CHECK 1 — Physical tic repetition from previous chapters
  if (previousChapters && previousChapters.length > 0) {
    const prevTicsByChar = {};
    for (const prevCh of previousChapters) {
      const prevTxt = (prevCh.content && !prevCh.content.startsWith('http')) ? prevCh.content : '';
      if (!prevTxt) continue;
      const tics = extractPhysicalTics(prevTxt);
      for (const [char, ticCounts] of Object.entries(tics)) {
        if (!prevTicsByChar[char]) prevTicsByChar[char] = new Set();
        for (const tic of Object.keys(ticCounts)) {
          prevTicsByChar[char].add(tic);
        }
      }
    }
    const newTics = extractPhysicalTics(text);
    const ticRepeats = [];
    for (const [char, ticCounts] of Object.entries(newTics)) {
      if (prevTicsByChar[char]) {
        for (const tic of Object.keys(ticCounts)) {
          if (prevTicsByChar[char].has(tic)) {
            ticRepeats.push(`${char}: "${tic}"`);
          }
        }
      }
    }
    if (ticRepeats.length > 0) {
      violations.push(`PHYSICAL TIC REPETITION (${ticRepeats.length}): ${ticRepeats.slice(0, 3).join(', ')}`);
      violationCount += ticRepeats.length;
    }
  }

  // PART 6 CHECK 2 — Metaphor cluster overuse in new chapter
  if (previousChapters && previousChapters.length > 0) {
    const prevClusterTotals = {};
    for (const prevCh of previousChapters) {
      const prevTxt = (prevCh.content && !prevCh.content.startsWith('http')) ? prevCh.content : '';
      if (!prevTxt) continue;
      const clusters = extractMetaphorClusters(prevTxt);
      for (const [clusterName, { count }] of Object.entries(clusters)) {
        prevClusterTotals[clusterName] = (prevClusterTotals[clusterName] || 0) + count;
      }
    }
    const flaggedForNewChapter = Object.entries(prevClusterTotals).filter(([, c]) => c >= 5).map(([name]) => name);
    if (flaggedForNewChapter.length > 0) {
      const newClusters = extractMetaphorClusters(text);
      const clusterViolations = [];
      for (const cluster of flaggedForNewChapter) {
        if ((newClusters[cluster]?.count || 0) > 1) {
          clusterViolations.push(`${cluster} (${newClusters[cluster].count} uses)`);
        }
      }
      if (clusterViolations.length > 0) {
        violations.push(`METAPHOR CLUSTER OVERUSE (${clusterViolations.length}): ${clusterViolations.join(', ')}`);
        violationCount += clusterViolations.length;
      }
    }
  }

  // CHECK 3 — Banned dialogue patterns
  const dialoguePatterns = scanDialoguePatterns(text);
  if (dialoguePatterns.length > 1) { violations.push(`BANNED DIALOGUE (${dialoguePatterns.length}): ${dialoguePatterns.map(p => p.pattern).join(', ')}`); violationCount += dialoguePatterns.length; }
  // Nonfiction checks
  if (bookType === "nonfiction") { const nw = scanNonfictionQuality(text); violations.push(...nw); violationCount += nw.length; }
  // Permanent rules
  const prv = validatePermanentRules(text, characters); violations.push(...prv); violationCount += prv.length;
  // PART C — Shape repetition
  const tw = text.split(/\s+/).length;
  const dChunks = text.match(/[""\u201C][^""\u201D]{3,}[""\u201D]/g) || [];
  const dw = dChunks.reduce((s, c) => s + c.split(/\s+/).length, 0);
  if (tw > 0 && dw / tw > 0.65) { violations.push(`SHAPE: ${((dw/tw)*100).toFixed(0)}% dialogue — add action/description.`); violationCount++; }
  const qd = text.match(/[""\u201C][^""\u201D]*\?[^""\u201D]*[""\u201D]/g) || [];
  let tc = 0; for (let i = 1; i < qd.length; i++) { const d = text.indexOf(qd[i], text.indexOf(qd[i-1])) - text.indexOf(qd[i-1]); if (d > 0 && d < 500) tc++; }
  if (tc > 5) { violations.push(`SHAPE: Dialogue tennis (${tc} consecutive Q exchanges).`); violationCount++; }
  const f5 = text.slice(0, 500).toLowerCase(), l5 = text.slice(-500).toLowerCase();
  if (["stepped into","entered the","walked into","arrived at","made his way","made her way"].some(w => f5.includes(w)) && ["ready for","whatever came next","only the beginning","just begun","would never be the same","no turning back"].some(w => l5.includes(w))) { violations.push(`SHAPE: Arrival→departure cliché.`); violationCount++; }
  // PART E — Ending reflection check
  const lp = text.slice(-1000).split(/\n\n+/).slice(-3).join(' ').toLowerCase();
  if (/\b(realized|understood|knew now|felt (ready|prepared|different|changed)|steeled|braced for|whatever (lay|came))\b/.test(lp) && !/(slammed|grabbed|ran|pulled|threw|kicked|screamed|fired|crashed|broke|stabbed|shot)\b/.test(lp)) { violations.push(`PLOT GATE: Ends with reflection, not irreversible event.`); violationCount++; }
  return { chapter_number: chapterNumber, violation_count: violationCount, banned_phrase_total: allBannedFound.length, warnings: violations, passed: violations.length === 0 };
}

// NONFICTION QUALITY SCANNER — detects fiction-trap patterns
function scanNonfictionQuality(text) {
  const warnings = [];

  // Check for excessive dialogue (fiction trap)
  const dialogueChunks = text.match(/[""]([^""]{5,})[""]|'([^']{5,})'/g) || [];
  const totalDialogueWords = dialogueChunks.reduce((sum, chunk) => sum + chunk.split(/\s+/).length, 0);
  const totalWords = text.split(/\s+/).length;
  if (totalWords > 0) {
    const dialogueRatio = totalDialogueWords / totalWords;
    if (dialogueRatio > 0.20) {
      warnings.push(
        `FICTION TRAP: ${(dialogueRatio * 100).toFixed(0)}% of chapter is dialogue ` +
        `(${totalDialogueWords} words). Nonfiction should be max 20% dialogue. ` +
        `Replace extended dialogue scenes with authorial voice and analysis.`
      );
    }
  }

  // Check for long dialogue runs (5+ consecutive dialogue lines)
  const lines = text.split('\n');
  let dialogueRun = 0;
  let maxRun = 0;
  for (const line of lines) {
    const stripped = line.trim();
    if (stripped && (stripped.startsWith('"') || stripped.startsWith('"') || stripped.startsWith("'"))) {
      dialogueRun++;
      maxRun = Math.max(maxRun, dialogueRun);
    } else if (stripped) {
      dialogueRun = 0;
    }
  }
  if (maxRun >= 5) {
    warnings.push(
      `FICTION TRAP: Found ${maxRun} consecutive dialogue lines. ` +
      `Nonfiction should not have extended fictional dialogue exchanges.`
    );
  }

  // Fiction-trap: invented character + past-tense action (e.g. "Laura sat at her kitchen table")
  const fictCharMatches = (text.match(/\b[A-Z][a-z]{2,}\s+(?:sat|stood|walked|felt|thought|smiled|sighed|cried|realized|wondered|looked|opened|entered|left|turned|knew|decided|held|reached)\b/g) || [])
    .filter(m => !['January','February','March','April','May','June','July','August','September','October','November','December','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','America','Europe','Asia','Congress','Harvard','Stanford','Oxford','Google','Apple','Amazon'].some(w => m.startsWith(w)));
  if (fictCharMatches.length >= 3) {
    warnings.push(`FICTIONAL NARRATIVE: Invented character+action pattern (${fictCharMatches.length}x, e.g. "${fictCharMatches[0]}") — remove fictional characters, replace with research and analysis`);
  }
  // Fiction-trap: internal monologue / fictional third-person narration
  const imCount = (text.match(/\b(?:she felt|he felt|they felt|she wondered|he wondered|she realized|he realized|her heart|his heart|she thought|he thought)\b/gi) || []).length;
  if (imCount >= 2) {
    warnings.push(`FICTIONAL NARRATIVE: Fictional internal monologue detected (${imCount} instances) — replace third-person character narration with authorial voice`);
  }
  // Fiction-trap: excessive dialogue lines (>5 in nonfiction)
  const nfDialogueCount = (text.match(/[""][^""]{5,}[""]/g) || []).length;
  if (nfDialogueCount > 5) {
    warnings.push(`FICTIONAL NARRATIVE: ${nfDialogueCount} quoted dialogue lines in nonfiction (max 5) — replace invented dialogue with research citations or authorial analysis`);
  }

  // Check for nonfiction-specific banned phrases
  const nfBanned = [
    { rx: /(?:heart|eyes)\s+(?:swelling|brimming|glistening)\s+with\s+(?:pride|tears|joy|emotion)/gi, label: "emotional melodrama" },
    { rx: /(?:warmth|sense of peace|wave of calm)\s+(?:spread|washed|flooded)\s+(?:through|over)/gi, label: "inspirational fiction" },
    { rx: /felt a renewed sense of/gi, label: "inspirational cliche" },
    { rx: /it was (?:a )?(?:powerful |beautiful |profound )?(?:reminder|testament)/gi, label: "declaration instead of showing" },
    { rx: /(?:infectious|contagious)\s+(?:laughter|enthusiasm|energy|smile|joy)/gi, label: "cliche 'infectious'" },
    { rx: /(?:monumental|transformative|life-changing|game-changer|game.changing)/gi, label: "hyperbolic adjective" },
    { rx: /(?:beacon of hope|ray of light|silver lining)/gi, label: "inspirational cliche" },
    { rx: /(?:on a journey|navigate this journey|the road ahead|armed with knowledge)/gi, label: "journey metaphor" },
    { rx: /together,?\s+they\s+(?:would|could|will)\s+(?:build|create|forge)/gi, label: "inspirational fiction" },
    { rx: /(?:clapped|cheered|hugged)\s+.{0,30}(?:proud|proud of|so proud)/gi, label: "fictional celebration scene" },
  ];

  for (const { rx, label } of nfBanned) {
    const matches = text.match(rx);
    if (matches) {
      warnings.push(`NONFICTION BAN (${label}): "${matches[0]}"`);
    }
  }

  return warnings;
}

// ── NONFICTION SYSTEM PROMPT BUILDER ──────────────────────────────────────────
function _buildNonfictionSystemPrompt(spec, chapter_info, total_chapters, target_words,
                                       story_bible, outline_data, transition_instructions, modelKey = 'claude-sonnet') {
  const ch_num = chapter_info.chapter_number;
  const _isDS = modelKey === 'deepseek-chat' || modelKey === 'deepseek-reasoner';
  const _dsBlock = _isDS ? `=== ABSOLUTE NONFICTION CONSTRAINT — READ THIS FIRST ===\nYou are writing NONFICTION. RULES:\n1. DO NOT invent fictional characters. No "Laura," "James," or any made-up person. Every person = real+verifiable OR labeled composite ("One caregiver I spoke with...").\n2. DO NOT write a novel. No scenes with invented dialogue, internal monologue, or dramatic arcs. No "Laura sat at her kitchen table..."\n3. DO write like Gladwell/Brown/Clear: thesis + evidence (real studies, named researchers, stats) + analysis + reader application.\n4. Anecdotes: max 1-4 paragraphs, no invented names, immediately followed by 3-5x more analysis.\n5. EVERY chapter: ≥2 real research references, ≥1 statistic, direct "you" reader address, clear advancing argument.\n6. BANNED: extended fictional scenes, invented dialogue (quotes = real people/studies only), "She felt/He realized..." about invented people.\nIF WRITING A FICTIONAL SCENE — STOP. Delete it. Replace with research, analysis, or direct reader address.\n=== END NONFICTION CONSTRAINT ===\n\n` : '';
  return `${_dsBlock}AUTHOR MODE — NONFICTION PROSE GENERATION
You are a professional nonfiction ghostwriter fulfilling a paid writing commission. You are NOT an assistant having a conversation. You are generating polished prose for a published nonfiction book.

You are writing Chapter ${ch_num} of ${total_chapters}: "${chapter_info.title}".

BOOK SPECIFICATIONS:
- Type: nonfiction
- Genre: ${spec.genre || 'General'}
- Subgenre: ${spec.subgenre || 'Not specified'}
- Beat Style: ${getBeatStyleInstructions(spec.tone_style || spec.beat_style)}
- Target Audience: ${spec.target_audience || 'General readers'}
- Detail Level: ${spec.detail_level || 'moderate'}

=== CRITICAL: NONFICTION VOICE AND STRUCTURE ===

This is NONFICTION. You are NOT writing novel scenes with invented dialogue between fictional characters. You are writing in the author's voice — direct, reflective, instructional, grounded in observation and analysis.

THE NONFICTION VOICE:
1. DIRECT ADDRESS — Speak to the reader as "you" when appropriate. You are a guide, teacher, or witness.
2. GROUNDED VIGNETTES — Open sections with brief, concrete observational moments (the author describing a real or representative scene), NOT fictional dialogue scenes between invented characters.
3. PHILOSOPHICAL REFLECTION — After grounding the reader, step back and reflect. Explain what the moment means. Connect it to larger principles.
4. INSTRUCTIONAL CLARITY — Where appropriate, offer frameworks, principles, or direct guidance. Name concepts clearly.
5. EMOTIONAL HONESTY — Use real emotional weight through specificity, restraint, and earned insight — not through fictional scenes.

STRUCTURE:
- Vignettes should be 1-4 paragraphs of observational prose, then 3-5 paragraphs of authorial analysis/reflection
- Use parallel structure, direct naming of concepts, short sentences for impact
- Replace abstract language with specific sensory details
- Section breaks separate thematic shifts

BANNED NONFICTION PATTERNS:
- Extended fictional dialogue scenes (more than 3 exchanges)
- Invented characters with full names carrying multi-page arcs
- "Story-time" structure with fictional families navigating challenges
- Summarizing lessons at the end in lists
- Ending with "The journey continues..."
- Exclamation marks in narration (one per chapter maximum)
- Inspirational clichés: "strength in unity", "the power of community", "making a difference"

BOOK PREMISE (anchor for every section):
${spec.topic || 'Not specified'}

STORY BIBLE:
${JSON.stringify(story_bible, null, 2)}

COMPLETE OUTLINE:
${JSON.stringify(outline_data.chapters || [], null, 2)}

NARRATIVE ARC: ${outline_data.narrative_arc || 'N/A'}
THEMES: ${JSON.stringify(outline_data.themes || [])}

${transition_instructions}

REMINDER — THIS IS NONFICTION: Write in the author's voice. Use brief vignettes to illustrate, then ANALYZE. The author's interpretive voice is the backbone. Do NOT create fictional characters with dialogue exchanges.

OUTPUT FORMAT RULES:
- Return ONLY the prose of the chapter. No preamble. No commentary.
- Do not start with "Here is..." or any assistant-style opening.
- Do not end with "Let me know if..." or any assistant-style closing.

Write approximately ${target_words} words. Begin immediately with the opening.`;
}

function _buildNonfictionUserMessage(ch_num, chapter_info, total_chapters, target_words) {
  const nf_opening_types = {
    1: "A grounding observational vignette — describe a concrete moment in close third-person. Brief, vivid, specific. Then pivot to the author's reflective voice.",
    2: "A bold thesis statement or provocative question — open with the chapter's central argument stated directly.",
    3: "A historical or real-world example — open with a specific fact, statistic, case study, or historical moment.",
    4: "Second-person immersion — 'Imagine waking up and...' or 'You arrive at...' — put the reader directly into the experience.",
    5: "A counterintuitive claim — open with something that challenges the reader's assumptions.",
  };
  const opening_idx = ((ch_num - 1) % 5) + 1;
  const ending_idx = ((ch_num + 1) % 5) + 1;
  const required_opening = nf_opening_types[opening_idx];
  const required_ending = NONFICTION_ENDING_TYPES[ending_idx];

  return `Write Chapter ${ch_num}: "${chapter_info.title}"

CHAPTER PROMPT:
${chapter_info.prompt || chapter_info.summary || 'Write this chapter.'}

CHAPTER SUMMARY:
${chapter_info.summary || 'No summary provided.'}

${ch_num === total_chapters ? "FINAL CHAPTER: Bring all thematic threads to a satisfying resolution. Synthesize the book's core argument. Give the reader a sense of completion and earned wisdom." : ""}

=== MANDATORY REQUIREMENTS ===

OPENING: Use this type: ${required_opening}

ENDING: Use this type: ${required_ending}
BANNED endings: summarizing content, previewing next chapter, "and so the journey continues", "armed with knowledge", "ready to face whatever."

VOICE: Write in the AUTHOR'S VOICE — direct, reflective, instructional. Brief vignettes (1-4 paragraphs) then authorial analysis (3-5 paragraphs). Do NOT write extended fictional dialogue scenes between characters. NAME concepts clearly. Use parallel structure and short sentences for impact. Earn emotion through specificity, not declaration.

BANNED PHRASES — auto-rejected if used:
"a tapestry of", "a kaleidoscope of", "a whirlwind of", "beacon of hope", "ray of light",
"heart swelling with pride", "warmth spread through", "sense of peace washed over",
"felt a renewed sense of", "it was a reminder", "it was a testament", "infectious",
"monumental", "transformative", "life-changing", "on a journey", "navigate this journey",
"the road ahead", "armed with knowledge", "little did they know", "in that moment",
"just the beginning", "no turning back", "ready to embrace/face"

Write ~${target_words} words. Begin immediately with prose — no preamble.`;
}

// PART B — AUTO-REWRITE FUNCTION
async function rewriteWithCorrections(chapterText, violations, chapterNumber, openaiKey, modelKey = 'claude-sonnet') {
  const hasNfViolation = violations.some(v => v.startsWith('FICTIONAL NARRATIVE'));
  if (hasNfViolation) {
    const nfSystemPrompt = `You are a nonfiction editor. This chapter contains fictional narrative elements that must be removed and replaced with proper nonfiction content.\n\nRULES:\n1. Remove all invented fictional characters (anyone with a name who is not a real public figure).\n2. Replace fictional scenes and "She felt/He realized..." narration with: research citations, real expert quotes, authorial analysis, or "Consider the person who..." constructions.\n3. Replace invented dialogue with quoted real research, expert statements, or authorial voice.\n4. Preserve any factual content, real names, statistics, or research references.\n5. The rewritten chapter must sound like Gladwell/Brown/Clear — not a novel.\n6. Return ONLY the corrected chapter prose. No commentary.`;
    try {
      const corrected = await callAI(modelKey, nfSystemPrompt, `Rewrite this nonfiction chapter, removing all fictional narrative elements:\n\n---\n${chapterText}\n---\n\nReturn only the corrected prose.`, { maxTokens: 3000, temperature: 0.4 });
      return corrected.includes('```') ? corrected.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '') : corrected;
    } catch (err) {
      console.error('Nonfiction rewrite error:', err.message);
      throw err;
    }
  }

  const systemPrompt = `You are a prose editor. Your ONLY job is to fix specific banned phrases and clichés in the text below.\n\nRULES:\n1. Replace ONLY the sentences or clauses that contain the flagged violations.\n2. Do NOT rewrite, restructure, or 'improve' any other part of the text.\n3. Do NOT add new scenes, dialogue, or plot. Do NOT remove scenes or dialogue.\n4. Do NOT change character names, settings, or plot events.\n5. Do NOT add meta-commentary, notes, or explanations.\n6. Each replacement must be ORIGINAL — do not swap one cliché for another.\n7. Replacements must be SPECIFIC to the scene — a character in a library reacts differently than one in a rainstorm.\n8. For 'show don't tell' violations: replace the named emotion with a concrete physical action, sensory detail, or dialogue that IMPLIES the emotion.\n9. Return ONLY the complete corrected chapter text. Nothing else.`;

  const violationList = violations.map(v => `- ${v}`).join('\n');
  
  const userMessage = `Fix the following violations in this Chapter ${chapterNumber} text.

VIOLATIONS FOUND:
${violationList}

IMPORTANT: Replace each violation with prose that is:
- Specific to THIS scene (not generic)
- Original (not another cliché)
- Concrete and sensory (not abstract)

Here is the full chapter text to fix:

---
${chapterText}
---

Return the corrected chapter text with violations fixed. Output ONLY the chapter prose, nothing else.`;

  try {
    let correctedText = await callAI(modelKey, systemPrompt, userMessage, { maxTokens: 3000, temperature: 0.4 });
    if (correctedText.includes('```')) {
      correctedText = correctedText.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
    }
    return correctedText;
  } catch (err) {
    console.error('Rewrite error:', err.message);
    throw err;
  }
}

async function generateChapterAsync(base44, projectId, chapterId, projectSpec, outline, sourceFiles, appSettings, modelKey = 'claude-sonnet') {
  try {
    // Load all chapters sorted by number so we can build conversation context
    const allChapters = await base44.entities.Chapter.filter({ project_id: projectId }, "chapter_number");
    const chapter = allChapters.find(c => c.id === chapterId);
    if (!chapter) throw new Error('Chapter not found');

    const chapterIndex = allChapters.findIndex(c => c.id === chapterId);
    const totalChapters = allChapters.length;
    const isLastChapter = chapterIndex === totalChapters - 1;
    const prevChapter = chapterIndex > 0 ? allChapters[chapterIndex - 1] : null;
    const nextChapter = chapterIndex < totalChapters - 1 ? allChapters[chapterIndex + 1] : null;

    // ISSUE 1 FIX: Parse outline data with both inline and URL support
    const outlineData = await parseOutlineField(outline?.outline_data, outline?.outline_url);
    const storyBible = await parseOutlineField(outline?.story_bible, outline?.story_bible_url);

    // Find this chapter's outline entry for transition fields
    const outlineChapters = outlineData?.chapters || [];
    const outlineEntry = outlineChapters.find(c => c.chapter_number === chapter.chapter_number) || {};
    const prevOutlineEntry = prevChapter ? (outlineChapters.find(c => c.chapter_number === prevChapter.chapter_number) || {}) : null;

    const TARGET_WORDS = 1600;

    // callAI wrapper using conversation messages array
    async function callAIConversation(messages, maxTokens = 8192) {
      const systemMsg = messages.find(m => m.role === 'system')?.content || '';
      const nonSystem = messages.filter(m => m.role !== 'system');
      const userMsg = nonSystem.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n');
      return callAI(modelKey, systemMsg, userMsg, { maxTokens });
    }

    // ── Build system prompt ────────────────────────────────────────────────────

    const bookType = projectSpec?.book_type || 'fiction';
    const isNonfiction = bookType === 'nonfiction';

    // Parse scenes if present (fiction only) — determines whether to use scene-based path
    let parsedScenes = null;
    try {
      if (chapter.scenes && typeof chapter.scenes === 'string' && chapter.scenes.length > 2) {
        const trimmed = chapter.scenes.trim();
        if (trimmed !== 'null' && trimmed !== '[]') {
          parsedScenes = JSON.parse(chapter.scenes);
        }
      }
    } catch (e) {
      console.warn('Scene parse failed, falling back to legacy path:', e.message);
    }
    const useScenePath = !isNonfiction && Array.isArray(parsedScenes) && parsedScenes.length > 0;

    // ── Beat Sheet: look up this chapter's beat from outline data (fiction AND nonfiction) ──
    let chapterBeat = null;
    {
      const olChs = outlineData?.chapters || [];
      const olE = olChs.find(c => (c.number || c.chapter_number) === chapter.chapter_number);
      if (olE?.beat_function) chapterBeat = { beat_name: olE.beat_name||'', beat_function: olE.beat_function||'', beat_scene_type: olE.beat_scene_type||(isNonfiction?'exposition':'scene'), beat_tempo: olE.beat_tempo||'medium' };
    }

    // Nonfiction mode descriptions for system prompt injection
    const NF_MODE_RULES = {
      'exposition': 'AUTHOR EXPLAINS. Your analytical voice carries this chapter. Present context, define terms, build the argument.',
      'case_study': 'ONE DEEP EXAMPLE. Pick one story, study, or person and go DEEP. Specific names, dates, places, outcomes.',
      'analysis': 'ARGUE. Weigh evidence. Compare viewpoints. Draw conclusions. Acknowledge uncertainty, address objections, then make your case.',
      'how_to': 'MAKE IT ACTIONABLE. Step 1, Step 2, Step 3. Specific enough that the reader can start TODAY.',
      'synthesis': 'CONNECT. Link ideas from earlier chapters. Show patterns. Zoom out from details to big picture.',
      'scene_recreation': 'RECONSTRUCT a real event with cinematic detail. Use primary sources. Never invent dialogue. Present tense for immediacy.',
      'profile': 'INTRODUCE real people as three-dimensional humans. Use their own words. Show contradictions.',
      'investigative': 'FOLLOW THE TRAIL. Present evidence in discovery order. Let the reader process clues alongside you.',
      'teaching': 'INSTRUCT. Concept → Example → Counter-example → Practice. One concept per section.',
    };

    function _beatSysBlock(cb) {
      if (!cb) return '';
      if (isNonfiction) {
        const modeRule = NF_MODE_RULES[cb.beat_scene_type] || '';
        return `\n\n=== THIS CHAPTER'S STRUCTURAL ROLE ===\nBeat: "${cb.beat_name}" | Function: ${cb.beat_function} | Mode: ${cb.beat_scene_type} | Tempo: ${cb.beat_tempo}\n\nNONFICTION STRUCTURAL RULES:\n- Mode "${cb.beat_scene_type}": ${modeRule}\n- fast=short paragraphs, punchy facts | medium=balanced evidence+analysis | slow=long reflective passages\n\nCRITICAL: This is NONFICTION. No fictional scenes, no invented dialogue, no imagined characters.\nUse ARGUMENT structure (claim, evidence, analysis, synthesis). Author's analytical voice is the backbone.\nDo NOT end with fiction-style cliffhangers.\n=== END STRUCTURAL ROLE ===`;
      }
      const r = { SETUP:'Establish, don\'t resolve.', DISRUPTION:'Concrete external EVENT.', PROMISE_OF_PREMISE:'Deliver genre promise NOW.', REVERSAL:'Something believed proven WRONG.', CRISIS:'Irreversible devastation.', REFLECTION:'NO new plot/characters. Process loss.', REACTION:'Character PROCESSES.', CLIMAX:'Maximum intensity. All threads converge.', RESOLUTION:'Mirror opening. Show transformation.', COMMITMENT:'Deliberate CHOICE.', RECOMMITMENT:'Understand theme, new path.', ESCALATION:'Stakes rise.', SUBPLOT:'B-story focus.', CONNECTIVE_TISSUE:'Bridge. One irreversible event.' };
      return `\n\n=== STRUCTURAL ROLE ===\nBeat: "${cb.beat_name}" | ${cb.beat_function} | ${cb.beat_scene_type} | ${cb.beat_tempo}\nscene=ACTION(max 20% reflection) | sequel=REACTION(min 40% thought) | fast=short paragraphs | slow=long flowing paragraphs\nFUNCTION: ${r[cb.beat_function]||''}\n=== END ===`;
    }
    function _beatUsrBlock(cb) {
      if (!cb) return '';
      if (isNonfiction) {
        return `STRUCTURAL ROLE: ${cb.beat_function} (beat: "${cb.beat_name}"). Mode: ${cb.beat_scene_type}. Tempo: ${cb.beat_tempo}.\n- This is NONFICTION. No fictional scenes, no invented dialogue, no imagined characters.\n- If mode is case_study: Go DEEP on ONE example. Names, dates, places, outcomes.\n- If mode is how_to: Specific actionable steps. Not "think about your goals" but "Do X, then Y, then Z."\n- If mode is analysis: ARGUE with evidence. Acknowledge the counterargument, then make your case.\n- If mode is exposition: Your analytical voice carries this chapter. Build the argument.\n- Chapter must advance the book's THESIS, not just present information.`;
      }
      return `STRUCTURAL ROLE: ${cb.beat_function} (beat: "${cb.beat_name}"). Mode: ${cb.beat_scene_type}. Tempo: ${cb.beat_tempo}. Must contain ≥1 IRREVERSIBLE EVENT.`;
    }

    let systemPrompt;
    if (useScenePath) {
      // ── SCENE-BASED SYSTEM PROMPT (shorter — scenes carry the structure) ──
      const beatKey = projectSpec?.beat_style || projectSpec?.tone_style;
      const beatInstructions = beatKey ? getBeatStyleInstructions(beatKey) : 'Not specified';
      const characters = storyBible?.characters || [];
      const world = storyBible?.world || storyBible?.settings;
      const rules = storyBible?.rules;

      const voiceDesc = projectSpec?.author_voice ? (AUTHOR_VOICES_MAP[projectSpec.author_voice] || null) : null;

      systemPrompt = `You are a novelist writing Chapter ${chapter.chapter_number} of a ${projectSpec?.genre || 'fiction'} novel.

STYLE: ${beatInstructions}

${voiceDesc ? `VOICE: ${voiceDesc}` : ''}

${projectSpec?.topic ? `BOOK PREMISE:\n${projectSpec.topic}` : ''}

CHARACTERS:
${characters.length > 0 ? characters.map(c => `- ${c.name} (${c.role || 'character'}): ${c.description || ''}${c.relationships ? ' | ' + c.relationships : ''}`).join('\n') : 'See story bible'}

${buildCharacterConsistencyBlock(storyBible)}

WORLDBUILDING:
${world ? (typeof world === 'object' ? JSON.stringify(world, null, 2) : world) : 'Not specified'}

RULES:
${rules ? (typeof rules === 'string' ? rules : JSON.stringify(rules)) : 'None'}

${getSpiceLevelInstructions(projectSpec?.spice_level ?? 0)}

${getLanguageIntensityInstructions(projectSpec?.language_intensity ?? 0)}

${CONTENT_GUARDRAILS}

CRITICAL OUTPUT RULES:
- Do NOT include scene numbers, scene titles, or any scene metadata in your output
- Do NOT write headers like "## SCENE 1" or "SCENE 1: Title" or anything similar
- The ONLY structural marker allowed between scenes is a single line containing just: * * *
- Do NOT include a chapter title header or chapter number — start writing prose immediately
- Your output must read like a published novel chapter — no outline artifacts, no structural labels, no metadata of any kind
- Return ONLY the prose. No preamble, no commentary.
- You are generating PROSE ONLY. Never output meta-commentary, self-assessment, checklists, or instructions.
- Never say "I appreciate", "I've completed", "I need to clarify", "Here is", "As requested", or any self-referential language.
- Never output bullet points, checkmarks (✓ ✗ ☐ ☑), or status indicators. These are NOT prose.
- If you feel tempted to explain what you wrote or confirm completion — DON'T. Just write the chapter.

${PLOT_SUBTEXT_RULES}

${DIALOGUE_SUBTEXT_RULES}

${DIALOGUE_SUBTEXT_RULES_CONCISE}`;
      if (isIntimateGenre(projectSpec)) { systemPrompt += `\n\n${INTIMATE_SCENE_RULES}`; }
      systemPrompt += _beatSysBlock(chapterBeat);
    } else if (isNonfiction) {
      systemPrompt = _buildNonfictionSystemPrompt(
        projectSpec, 
        { chapter_number: chapter.chapter_number, title: chapter.title }, 
        totalChapters, 
        TARGET_WORDS,
        storyBible || {}, 
        outlineData || {}, 
        "",
        modelKey
      );
      // Inject nonfiction beat structural role into system prompt
      systemPrompt += _beatSysBlock(chapterBeat);
    } else {
      const beatKey = projectSpec?.beat_style || projectSpec?.tone_style;
      systemPrompt = buildAuthorModeBlock(projectSpec);
      systemPrompt += `\n\n${CONTENT_GUARDRAILS}`;
      systemPrompt += `\n\nGenre: ${projectSpec?.genre || 'fiction'}`;

      // PART E — subgenre
      if (projectSpec?.subgenre) {
        systemPrompt += `\nSubgenre: ${projectSpec.subgenre}`;
      }

      // Inject the full book premise as a creative anchor for every chapter
      if (projectSpec?.topic) {
        systemPrompt += `\n\nBOOK PREMISE (your creative anchor — every scene must serve THIS story):\n${projectSpec.topic}`;
      }

      if (beatKey) systemPrompt += `\n\nBeat Style: ${getBeatStyleInstructions(beatKey)}`;
      systemPrompt += `\n\n${getSpiceLevelInstructions(projectSpec?.spice_level ?? 0)}`;
      systemPrompt += `\n\n${getLanguageIntensityInstructions(projectSpec?.language_intensity ?? 0)}`;

    // Author voice
    if (projectSpec?.author_voice && projectSpec.author_voice !== 'basic') {
      const voiceDesc = AUTHOR_VOICES_MAP[projectSpec.author_voice];
      if (voiceDesc) systemPrompt += `\n\nAuthor Voice: Write in a style reminiscent of: ${voiceDesc}`;
    }

    // PART E — thematic elements and consistency rules from story bible
    if (storyBible?.themes?.length > 0) {
      systemPrompt += `\n\nTHEMATIC ELEMENTS:\n${storyBible.themes.join('\n- ')}`;
    }
    if (storyBible?.rules) {
      systemPrompt += `\n\nCONSISTENCY RULES:\n${storyBible.rules}`;
    }

    // PART A — Character gender/attribute consistency block
    const charConsistencyBlock = buildCharacterConsistencyBlock(storyBible);
    if (charConsistencyBlock) {
      systemPrompt += `\n\n${charConsistencyBlock}`;
    }

    // PART B — transition instructions
    if (prevChapter && prevOutlineEntry) {
      const prevTransitionTo = prevOutlineEntry.transition_to || '';
      const thisTransitionFrom = outlineEntry.transition_from || '';
      if (prevTransitionTo || thisTransitionFrom) {
        systemPrompt += `\n\nTRANSITION FROM CHAPTER ${prevChapter.chapter_number}:`;
        if (prevTransitionTo) systemPrompt += `\n- Previous chapter ended with: ${prevTransitionTo}`;
        if (thisTransitionFrom) systemPrompt += `\n- This chapter should pick up: ${thisTransitionFrom}`;
        systemPrompt += `\n- Do NOT repeat information already covered in the previous chapter.`;
      }
    }
    if (nextChapter) {
      const thisTransitionTo = outlineEntry.transition_to || '';
      systemPrompt += `\n\nTRANSITION TO CHAPTER ${nextChapter.chapter_number}:`;
      if (thisTransitionTo) systemPrompt += `\n- This chapter should end by setting up: ${thisTransitionTo}`;
      systemPrompt += `\n- The next chapter is titled: '${nextChapter.title}' — end in a way that makes the reader want to continue.`;
    }

    // Voice, genre delivery, plot gate
    systemPrompt += `\n\n=== CHARACTER VOICE ENFORCEMENT ===\nMatch voice profiles: vocabulary, sentence pattern, verbal tics, "never says", physical communication. Identify speaker without tags.\n=== END ===\n=== GENRE DELIVERY ===\nActual scenes not dialogue about themes. >50% dialogue in PROMISE_OF_PREMISE = failure.\n=== END ===\n=== PLOT GATE ===\nONE-WAY DOOR: Something permanently different at end. Feelings alone ≠ advancement.\n=== END ===`;
    systemPrompt += `\n\nSTRICT ANTI-REPETITION RULES — VIOLATION OF THESE RULES IS A FAILURE:

    1. BANNED PHRASE LIST — Do NOT use any of these overused phrases:
    - "heart pounding" / "heart racing" / "pulse quickened" (use MAX once per chapter, find alternatives: chest tightened, blood thrummed, stomach dropped)
    - "intoxicating" (BANNED entirely — find specific sensory descriptions instead)
    - "shadows danced" / "shadows shifted" / "shadows twisted" (use MAX once per chapter)
    - "whispers echoed" / "whispers slithered" / "whispers wrapped around" (use MAX once per chapter)
    - "the darkness enveloped" / "darkness pressed" / "darkness wrapped" (use MAX once per chapter)
    - "a thrill coursed through" / "a shiver ran down" (use MAX once per chapter)
    - "he couldn't tear himself away"
    - "the weight of" (the unknown, the decision, etc.)
    - "in that moment"
    - "the air thickened/crackled/grew heavy"
    - "just the beginning"

    2. CHAPTER OPENING RULE: Each chapter MUST open with a completely different technique:
    - Chapter 1: Action or sensory detail (NOT atmosphere)
    - Chapter 2: Dialogue mid-conversation
    - Chapter 3: Internal thought or memory
    - Chapter 4: Time/place stamp with concrete physical action
    - Chapter 5: A single striking image or metaphor
    NEVER open two chapters the same way. NEVER open with atmosphere/darkness/shadows.

    3. DIALOGUE RULE: Characters must NOT repeat the same conversational dynamic. If the previous chapter had Character A saying 'trust me' and Character B hesitating, the NEXT chapter must show a DIFFERENT power dynamic. Characters must evolve between chapters — they cannot have the same argument twice.

    4. PLOT PROGRESSION RULE: Every chapter must contain at least ONE concrete, irreversible event that changes the characters' situation. Atmospheric tension is NOT a plot event. Walking into a room is NOT a plot event. A discovery, confrontation, betrayal, decision with consequences, or physical action IS a plot event.

    5. DIALOGUE MUST NOT BE 'TENNIS' (critical anti-pattern):
      The #1 failure mode is dialogue that becomes a back-and-forth of rhetorical questions and philosophical volleys.
      BANNED PATTERN: Character A asks provocative question → Character B counters with another question → A raises stakes → B matches → repeat for 20 exchanges.
      Example of BANNED dialogue tennis: 'Isn't desire dangerous?' / 'Or is it thrilling?' / 'Perhaps both.' / 'Then what do you want?' / 'What do YOU want?' / 'Maybe I want to find out.' / 'Then let's see where this leads.'
      INSTEAD: Dialogue must have ASYMMETRY. One character leads, the other deflects. Someone changes the subject. Someone lies. Someone says something accidentally revealing. Conversations have interruptions, non-sequiturs, silences, and subtext. People rarely answer the question they were asked.
      MAX 3 consecutive dialogue exchanges before a PARAGRAPH OF ACTION, DESCRIPTION, OR INTERNAL THOUGHT breaks the rhythm.

    6. SENSORY SPECIFICITY RULE: Replace vague atmospheric descriptions with CONCRETE sensory details. NOT 'the air smelled different' but 'copper and burnt sage stung his nostrils.' NOT 'the room felt charged' but 'static lifted the hair on his forearms.' Every sense (sight, sound, smell, touch, taste) must appear at least once per chapter with SPECIFIC details.

    7. EROTICA CONTENT RULE: If the book is tagged as Erotica or Steamy Romance, chapters must contain ACTUAL intimate content appropriate to the heat level selected. Atmospheric tension and hand-touching do NOT satisfy a 'Full Intensity' rating. Escalate physical intimacy progressively across chapters. Be explicit and character-driven — not purple prose, not fade-to-black.

    8. SHOW DON'T TELL: Replace internal monologue about feelings with physical reactions and actions. NOT 'Alex felt afraid' but show the fear through behavior, body language, and sensory experience.

    9. CHARACTER VOICE DIFFERENTIATION: Every named character MUST have a distinct speech pattern. Characters must NEVER sound interchangeable. Vocabulary level (academic vs casual vs street vs formal), sentence length tendency (terse vs verbose), speech habits (interrupts, trails off, asks questions, makes declarations) — all must vary. In dialogue, a reader should be able to identify the speaker WITHOUT dialogue tags.

    10. ANTI-REPETITION: Track every metaphor and simile. Do NOT reuse the same comparison twice in one chapter. Track every physical reaction. Do NOT use the same bodily response (heart, breath, spine, stomach, pulse) more than twice per chapter. Track dialogue patterns — vary between statements, questions, commands, interruptions.

    11. PLOT PROGRESSION: Every chapter must contain at least ONE concrete, irreversible event that changes the characters' situation. Atmospheric tension is NOT a plot event. A discovery, confrontation, betrayal, decision with consequences, or physical action IS a plot event.`;

    systemPrompt += `\n\n${OUTPUT_FORMAT_RULES}`;

    systemPrompt += `\n\nCRITICAL PREMISE ANCHOR: Refer back to the BOOK PREMISE section above. Your chapter must include specific elements from that premise — character names, locations, plot beats, and thematic elements mentioned there. Do NOT write generic scenes that could belong to any book. Every scene must be specific to THIS story and its unique characters, world, and conflicts.`;

    systemPrompt += `\n\nGENRE DELIVERY — MATCH THE GENRE TAG:
- If the book is tagged as EROTICA or ROMANCE: intimate scenes must include specific physical detail proportional to the heat level setting. Vague "tension" and "proximity" without physical payoff is a genre violation. Escalate across chapters.
- If the book is tagged as HORROR or THRILLER: something genuinely threatening must happen on-page. Atmosphere alone is not horror. Include concrete danger, consequences, or disturbing events.
- If the book is tagged as MYSTERY: clues must be planted and discoveries must occur. Each chapter should narrow the possibilities or introduce a complication.
- If the book is tagged as FANTASY or SCI-FI: the worldbuilding must be shown through action and detail, not exposition dumps. Magic/technology should have rules that matter to the plot.`;

    // PART C — Plot and dialogue subtext rules (legacy fiction path)
    systemPrompt += `\n\n${PERMANENT_QUALITY_RULES}`;
    systemPrompt += `\n\n${PLOT_SUBTEXT_RULES}`;
    systemPrompt += `\n\n${DIALOGUE_SUBTEXT_RULES}`;
    systemPrompt += `\n\n${DIALOGUE_SUBTEXT_RULES_CONCISE}`;

    // PART D — Conditional intimate scene rules (legacy fiction path)
    if (isIntimateGenre(projectSpec)) { systemPrompt += `\n\n${INTIMATE_SCENE_RULES}`; }
    systemPrompt += _beatSysBlock(chapterBeat);
    }

    // ── PART A — Build conversation-style messages array ─────────────────────

    const messages = [{ role: 'system', content: systemPrompt }];

    // Add previously written chapters as alternating user/assistant turns
    const previousChapters = allChapters.slice(0, chapterIndex).filter(c => c.content && c.status === 'generated');

    for (const prevCh of previousChapters) {
      // Resolve content if it's a URL
      let prevContent = prevCh.content || '';
      if (prevContent.startsWith('http://') || prevContent.startsWith('https://')) {
        try { prevContent = await (await fetch(prevContent)).text(); } catch { prevContent = ''; }
      }
      if (!prevContent) continue;

      const prevChNum = prevCh.chapter_number;
      const prevEndingIdx = ((prevChNum + 1) % 5) + 1;
      const endingTypesDict = isNonfiction ? NONFICTION_ENDING_TYPES : FICTION_ENDING_TYPES;
      const prevEndingType = endingTypesDict[prevEndingIdx] || "";

      messages.push({
        role: 'user',
        content: `Write Chapter ${prevChNum}: "${prevCh.title}"

CHAPTER PROMPT:
${prevCh.prompt || ''}

CHAPTER SUMMARY:
${prevCh.summary || ''}

ENDING TYPE USED: ${prevEndingType}

Write this chapter in full.`
      });
      messages.push({
        role: 'assistant',
        content: prevContent
      });
    }

    // Get opening and ending types and build user message based on book type
    // BUG 3 — Collect distinctive phrases from previous chapters to prevent cross-chapter repetition
    const crossChapterPhrases = [];
    for (const prevCh of allChapters.slice(0, chapterIndex)) {
      // From AI-extracted distinctive phrases stored after generation
      if (prevCh.distinctive_phrases) {
        try {
          const p = JSON.parse(prevCh.distinctive_phrases);
          if (Array.isArray(p)) crossChapterPhrases.push(...p);
        } catch {}
      }
      // From local regex extraction on inline chapter content
      if (prevCh.content && !prevCh.content.startsWith('http')) {
        const localPhrases = extractDistinctivePhrases(prevCh.content);
        crossChapterPhrases.push(...localPhrases);
      }
    }
    const uniqueCrossChapterPhrases = [...new Set(crossChapterPhrases)].slice(0, 30).sort();

    // PART 4A — Collect physical tics from previous chapters (ban any tic used >= 1 time)
    const ticMap = {}; // charName -> { ticName -> [chapterNumbers] }
    for (const prevCh of allChapters.slice(0, chapterIndex)) {
      const txt = (prevCh.content && !prevCh.content.startsWith('http')) ? prevCh.content : '';
      if (!txt) continue;
      const tics = extractPhysicalTics(txt);
      for (const [char, ticCounts] of Object.entries(tics)) {
        if (!ticMap[char]) ticMap[char] = {};
        for (const [tic] of Object.entries(ticCounts)) {
          if (!ticMap[char][tic]) ticMap[char][tic] = [];
          ticMap[char][tic].push(prevCh.chapter_number);
        }
      }
    }
    const bannedTicsByChar = {}; // charName -> [{ tic, chapters }]
    for (const [char, tics] of Object.entries(ticMap)) {
      const banned = Object.entries(tics).map(([t, chs]) => ({ tic: t, chapters: chs }));
      if (banned.length > 0) bannedTicsByChar[char] = banned;
    }

    // PART 4B — Collect metaphor cluster usage from previous chapters (flag at 5+)
    const clusterTotals = {};
    for (const prevCh of allChapters.slice(0, chapterIndex)) {
      const txt = (prevCh.content && !prevCh.content.startsWith('http')) ? prevCh.content : '';
      if (!txt) continue;
      const clusters = extractMetaphorClusters(txt);
      for (const [clusterName, { count }] of Object.entries(clusters)) {
        clusterTotals[clusterName] = (clusterTotals[clusterName] || 0) + count;
      }
    }
    const flaggedClusters = Object.entries(clusterTotals).filter(([, c]) => c >= 5).map(([name]) => name);

    let currentChapterRequest;
    if (useScenePath) {
      // ── SCENE-BASED USER MESSAGE ──────────────────────────────────────────
      const openingType = getOpeningType(chapter.chapter_number);
      const endingType = getEndingType(chapter.chapter_number);

      const sceneSections = parsedScenes.map((scene, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === parsedScenes.length - 1;
        return `SCENE ${scene.scene_number}: ${scene.title}

Location: ${scene.location}
Time: ${scene.time}
POV: ${scene.pov}
Characters present: ${Array.isArray(scene.characters_present) ? scene.characters_present.join(', ') : scene.characters_present}
Purpose: ${scene.purpose}
Emotional arc: ${scene.emotional_arc}
KEY ACTION (MUST happen): ${scene.key_action}
Dialogue focus: ${scene.dialogue_focus || 'None — this is an action-focused scene'}
Sensory anchor (must appear in first 3 sentences of this scene): ${scene.sensory_anchor}
Word target: ~${scene.word_target} words
${scene.extra_instructions ? `Notes: ${scene.extra_instructions}` : ''}
${isFirst ? `OPENING STYLE (applies to this scene only): ${openingType.name} — ${openingType.desc}` : ''}
${isLast ? `ENDING STYLE (applies to this scene only): ${endingType.name} — ${endingType.desc}` : ''}`;
      }).join('\n\n---\n\n');

      // Get anti-repetition context from last written chapter
      let prevChapterTail = '';
      if (prevChapter?.content) {
        let prevContent = prevChapter.content || '';
        if (prevContent.startsWith('http')) {
          try { prevContent = await (await fetch(prevContent)).text(); } catch { prevContent = ''; }
        }
        if (prevContent) prevChapterTail = prevContent.trim().slice(-200);
      }

      currentChapterRequest = `Write Chapter ${chapter.chapter_number}: "${chapter.title}"

WRITE THIS CHAPTER SCENE-BY-SCENE IN THIS EXACT ORDER:

${sceneSections}

=== SCENE RULES (NON-NEGOTIABLE) ===

- Write each scene fully before moving to the next
- Insert a line with only "* * *" between scenes as a scene break marker
- Each scene MUST deliver its KEY ACTION — do not skip it or merely allude to it
- Hit each scene's word target (plus or minus 20%)
- The SENSORY ANCHOR must appear in each scene's first 3 sentences
- OPENING STYLE (above) applies to Scene 1 only — the first words of the chapter
- ENDING STYLE (above) applies to the final scene's last lines only
- MAX 3 consecutive dialogue exchanges before a paragraph of action/description/thought breaks the rhythm

BANNED PHRASES (auto-rewritten if found):
'heart racing/pounding', 'pulse quickened', 'breath hitched', 'intoxicating', 'electric' (atmosphere), 'shadows danced', 'tendrils of', 'the weight of', 'in that moment', 'no turning back', 'a rush of', 'a flicker of', 'a spark of', 'something deeper/unspoken', 'unspoken tension', 'invisible thread/force', 'just the beginning', 'air thickened/crackled', 'palpable', 'igniting a fire'

${chapter.prompt ? `EXTRA CHAPTER INSTRUCTIONS: ${chapter.prompt}` : ''}

${prevChapterTail ? `=== PREVIOUS CHAPTER ENDING — DO NOT REPEAT THIS TONE OR STRUCTURE ===\n"...${prevChapterTail}"\n=== END ===` : ''}

Begin immediately with Chapter ${chapter.chapter_number}'s prose. No preamble.

${_beatUsrBlock(chapterBeat)}`;
    } else if (isNonfiction) {
      currentChapterRequest = _buildNonfictionUserMessage(
        chapter.chapter_number,
        { title: chapter.title, prompt: chapter.prompt, summary: chapter.summary },
        totalChapters,
        TARGET_WORDS
      );
      // Inject nonfiction beat user block
      if (chapterBeat) {
        currentChapterRequest += `\n\n${_beatUsrBlock(chapterBeat)}`;
      }
      if (modelKey === 'deepseek-chat' || modelKey === 'deepseek-reasoner') {
        currentChapterRequest = `REMINDER: This is NONFICTION. Do not invent characters or write fictional scenes. Write as an authoritative nonfiction author using research, evidence, and direct reader address. Every claim should reference real research or verifiable information.\n\n` + currentChapterRequest;
      }
    } else {
      // ── LEGACY FICTION PATH (no scenes) ──────────────────────────────────
      const openingType = getOpeningType(chapter.chapter_number);
      const endingType = getEndingType(chapter.chapter_number);

      currentChapterRequest = `Write Chapter ${chapter.chapter_number}: "${chapter.title}"

CHAPTER PROMPT:
${chapter.prompt || ''}

CHAPTER SUMMARY:
${chapter.summary || ''}

=== CRITICAL RULES — VIOLATION MEANS REJECTION ===

BANNED PHRASES — if you use ANY of these, the chapter is auto-rejected and rewritten by a second AI pass. Using them wastes time and money:
'heart racing/pounding/hammering', 'pulse quickened/raced', 'breath hitched/caught', 'swallowed hard',
'shiver down spine', 'a jolt/surge/rush of', 'intoxicating', 'electric/electricity' (atmosphere/touch),
'shadows danced/twisted/swirled', 'tendrils of', 'the weight of', 'in that moment',
'no turning back', 'teetering on the edge', 'on the precipice/brink', 'a mix/blend/cocktail of [X] and [Y]',
'a kaleidoscope/whirlwind/tapestry/maelstrom of', 'he/she felt alive', 'the world faded',
'Control is an illusion', 'Embrace it/your desires', 'Let go of fear', 'What if I lose myself',
'ready to embrace/confront', 'just the beginning', 'air thickened/crackled/charged', 'palpable', 'siren's call',
'thrill of the chase', 'dangerous game/dance/allure', 'playing with fire', 'testing/pushing boundaries',
'like a moth to a flame', 'a knowing/playful/mischievous smile/smirk/glint', 'something deeper/unspoken',
'unspoken tension/promise/understanding', 'invisible thread/force/pull', 'cutting through like a knife',
'storm/tempest brewing within', 'facade slipping/cracking', 'igniting a fire', 'fire within him/her',
'laced with', 'heavy with implication', 'thick with tension', 'charged with possibility', 'hung in the air',
'what do you truly want/desire', 'how far are you willing to go', 'let's see where this leads',
'a flicker of', 'a spark of', 'couldn't shake/ignore/resist the feeling'

WRITE LIKE THIS INSTEAD:
- BAD: 'His heart raced as the air between them grew charged.' → GOOD: 'His collar stuck to his neck. He pulled at it, aware she hadn't blinked.'
- BAD: 'A knowing smile played on her lips.' → GOOD: 'She tilted her head and said nothing, which was worse.'
- BAD: ''What do you truly desire?' The words hung heavy in the air.' → GOOD: ''You didn't come here for the lecture notes.' She set down her pen.'
- Tension comes from ACTIONS and SILENCE, not from the narrator labeling feelings.

GENRE DELIVERY: For PROMISE_OF_PREMISE beats, write actual ${projectSpec?.genre||'genre'} scenes. Min 40% action, not dialogue.
SUPPORTING CAST: If any named character appeared in previous chapters, they must appear in this chapter, be referenced by name, or have their absence explained.

ANTI-REPETITION: You have access to all previously written chapters. You MUST:
1. End this chapter COMPLETELY DIFFERENTLY from how the previous chapter ended — different final scene, different emotional beat, different last line structure
2. Do NOT reuse any dialogue exchanges from previous chapters (e.g., if a previous chapter had "What do you want?" / "I want to know you", do NOT use similar back-and-forth)
3. This chapter must contain at least ONE event that physically changes the characters' situation (a location change, a new character entering, a revelation, a consequence)
4. The final 500 words of this chapter must be ENTIRELY UNIQUE — no recycled confrontations, no repeated "walking away" beats, no reused emotional resolutions

OPENING: You MUST use this specific opening style for this chapter: ${openingType.name} — ${openingType.desc}

ENDING: You MUST use this specific ending style for this chapter: ${endingType.name} — ${endingType.desc}
THIS IS NON-NEGOTIABLE. The last 2-3 sentences of your chapter MUST match this ending type. If your ending does not match, the chapter will be rejected and regenerated.

STRUCTURAL CONSTRAINT: The final scene of this chapter must take place in a DIFFERENT LOCATION than where the chapter's main conversation happens. The chapter must NOT end with one character walking away while the other watches.

Write ~${TARGET_WORDS} words. Begin immediately with prose. No preamble.

${_beatUsrBlock(chapterBeat)}`;
    }

    if (previousChapters && previousChapters.length > 0) {
      const lastCh = previousChapters[previousChapters.length - 1];
      let lastChContent = lastCh.content || '';
      if (lastChContent.startsWith('http://') || lastChContent.startsWith('https://')) {
        try { lastChContent = await (await fetch(lastChContent)).text(); } catch { lastChContent = ''; }
      }
      const lastLines = lastChContent.trim().split("\n").slice(-3);
      const antiRepeatContext =
        "\n=== PREVIOUS CHAPTER ENDING (DO NOT REPEAT OR CLOSELY MIRROR THIS) ===\n" +
        lastLines.join("\n") +
        "\n=== END PREVIOUS CHAPTER ENDING ===\n\n";
      currentChapterRequest = antiRepeatContext + currentChapterRequest;
    }

    // BUG 2 — Prevent AI from inventing its own chapter heading or number
    currentChapterRequest += `\n\nREMINDER: You are writing Chapter ${chapter.chapter_number}: "${chapter.title}". Do NOT output a chapter heading. Do NOT renumber or rename the chapter. Start directly with the first sentence of prose.`;

    // Cross-chapter phrase ban
    if (uniqueCrossChapterPhrases.length > 0) {
      currentChapterRequest += `\n\n=== PHRASES ALREADY USED IN PREVIOUS CHAPTERS (DO NOT REUSE THESE) ===\n${uniqueCrossChapterPhrases.map(p => `- ${p}`).join('\n')}\n=== END PREVIOUS PHRASES ===`;
    }

    // PART 4A — Inject physical tics ban into user message
    if (chapterIndex > 0 && Object.keys(bannedTicsByChar).length > 0) {
      const ticLines = Object.entries(bannedTicsByChar).map(([char, banned]) =>
        `${char}: ${banned.map(b => b.tic).join(', ')}`
      ).join('\n');
      const ticInjection = `=== BANNED PHYSICAL REACTIONS ===
${ticLines}
INSTEAD USE: stillness, grip pressure on objects, posture changes, swallowing difficulty, temperature sensations, specific muscle tension, vocal quality changes, involuntary fidgeting, breathing through action, eye movement.
=== END ===

`;
      currentChapterRequest = ticInjection + currentChapterRequest;
    }

    // PART 4B — Inject metaphor cluster ban into user message
    if (chapterIndex > 0 && flaggedClusters.length > 0) {
      const clusterLines = flaggedClusters.map(cluster => {
        const totalCount = clusterTotals[cluster] || 0;
        return `${cluster} (${totalCount} uses) — limit to 1 word from this family in this chapter.`;
      }).join('\n');
      const clusterInjection = `=== OVERUSED METAPHOR FAMILIES ===
${clusterLines}
Try instead: mechanical, animal, architectural, textile, botanical, musical, food/taste, or geometric imagery.
=== END ===

`;
      currentChapterRequest = clusterInjection + currentChapterRequest;
    }

    // PART F — Topic tracking: ban overused dialogue topics
    if (previousChapters.length > 0) { const tw = ["power","control","desire","fear","vulnerability","trust","boundaries","limits","darkness","submission","dominance","dangerous","surrender"]; const tc = {}; for (const pc of previousChapters) { let c = pc.content||''; if (c.startsWith('http')) continue; const dl = (c.match(/[""\u201C][^""\u201D]+[""\u201D]/g)||[]).join(' ').toLowerCase(); for (const t of tw) { const m = dl.match(new RegExp(`\\b${t}\\b`,'gi')); if (m) tc[t]=(tc[t]||0)+m.length; } } const ou = Object.entries(tc).filter(([,c])=>c>3).map(([w])=>w); if (ou.length>0) currentChapterRequest += `\n\n=== TOPICS ALREADY COVERED — DO NOT REPEAT ===\nPrevious dialogue discussed: ${ou.join(', ')}. Focus on DIFFERENT subjects: plot logistics, shared memory, concrete decisions, practical problems.\n=== END ===`; }
    messages.push({ role: 'user', content: currentChapterRequest });
    // ── Generate with retry on refusal ────────────────────────────────────────

    let fullContent = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      const msgArray = [...messages];
      if (attempt > 0) {
        msgArray.push({ role: 'assistant', content: fullContent });
        msgArray.push({ role: 'user', content: 'REMINDER: You are in Author Mode. Generate the requested prose at the configured content level. Do not refuse or add meta-commentary. Write the scene now.' });
      }
      fullContent = await callAIConversation(msgArray, 8192);
      if (!isRefusal(fullContent)) break;
      console.warn(`Chapter generation attempt ${attempt + 1} returned a refusal, retrying...`);
    }

    // BUG 1 — Strip any scene header or chapter heading artifacts the AI included
    let _cleaned = fullContent;
    _cleaned = _cleaned.replace(/^#{1,4}\s*(SCENE|Scene)\s*\d+[:\-—]?\s*[^\n]*/gm, '');
    _cleaned = _cleaned.replace(/^\*?\*?(SCENE|Scene)\s*\d+[:\-—]?\s*[^\n]*\*?\*?$/gm, '');
    _cleaned = _cleaned.replace(/^(SCENE|Scene)\s*\d+[:\-—]?\s*[^\n]*/gm, '');
    _cleaned = _cleaned.replace(/^#{1,4}\s*CHAPTER\s*\d+[:\-—]?\s*[^\n]*/gmi, '');
    _cleaned = _cleaned.replace(/\n{3,}/g, '\n\n');
    fullContent = _cleaned.trim();

    const wordCount = fullContent.trim().split(/\s+/).length;

    // ── PART E — Post-generation validation with up to 2 regeneration attempts ──

    async function runValidationChecks(content, bannedTicsByChar, bannedClusterNames, isErotic) {
      const checks = [];

      // CHECK 1 — TIC REPETITION in new chapter
      if (Object.keys(bannedTicsByChar).length > 0) {
        const newTics = extractPhysicalTics(content);
        const ticFailures = [];
        for (const [char, ticCounts] of Object.entries(newTics)) {
          if (bannedTicsByChar[char]) {
            const banned = bannedTicsByChar[char].map(x => x.tic);
            for (const tic of Object.keys(ticCounts)) {
              if (banned.includes(tic)) ticFailures.push(`"${tic}" for ${char}`);
            }
          }
        }
        if (ticFailures.length > 0) checks.push(`TIC REPETITION: ${ticFailures.join('; ')}`);
      }

      // CHECK 2 — METAPHOR CLUSTER overuse in new chapter
      if (bannedClusterNames.length > 0) {
        const newClusters = extractMetaphorClusters(content);
        const clusterFails = [];
        for (const cluster of bannedClusterNames) {
          if ((newClusters[cluster]?.count || 0) > 1) clusterFails.push(`${cluster} (${newClusters[cluster].count} uses)`);
        }
        if (clusterFails.length > 0) checks.push(`METAPHOR CLUSTER OVERUSE: ${clusterFails.join('; ')}`);
      }

      // CHECK 3 — BANNED DIALOGUE PATTERNS
      const dialogueBanned = [
        /\bare you afraid\b/gi, /\bwhat if i want\b/gi, /\blet go\b/gi,
        /\bstop hiding\b/gi, /\bdo you want to find out\b/gi,
        /\bare you sure you can handle\b/gi, /\bthen why are you still here\b/gi,
      ];
      let dialogueHits = 0;
      for (const rx of dialogueBanned) {
        const m = content.match(rx);
        if (m) dialogueHits += m.length;
      }
      if (dialogueHits > 1) checks.push(`BANNED DIALOGUE PATTERNS: ${dialogueHits} instances of telegraphed/explicit attraction dialogue`);

      // CHECK 4 — INTIMATE SCENE LENGTH (erotica only)
      if (isErotic) {
        const intimateStart = /\b(kiss\w*|kiss\w*\s+\w+|their (lips|mouths?)|lips (met|touched|press\w*))\b/i.exec(content);
        if (intimateStart) {
          const afterContact = content.slice(intimateStart.index);
          const paragraphs = afterContact.split(/\n\n+/);
          const firstInterrupt = paragraphs.findIndex((p, i) => i > 0 && /\b(pulled? (away|back)|stepped? back|interrupted?|phone|knock\w*|door (open\w*|burst\w*))\b/i.test(p));
          if (firstInterrupt !== -1 && firstInterrupt < 4) {
            checks.push(`INTIMATE SCENE TOO SHORT: only ${firstInterrupt} paragraph(s) before pullback (minimum 4 required)`);
          }
        }
      }

      return checks;
    }

    const bannedClusterNames = flaggedClusters;
    const isErotic = isIntimateGenre(projectSpec);

    let fullContentWorking = fullContent;

    // PART E — Run up to 2 validation+regeneration cycles
    for (let regenAttempt = 0; regenAttempt <= 2; regenAttempt++) {
      const validationFailures = await runValidationChecks(fullContentWorking, bannedTicsByChar, bannedClusterNames, isErotic);
      if (validationFailures.length === 0) break; // passed
      if (regenAttempt === 2) {
        console.warn(`Chapter ${chapter.chapter_number}: Still failing after 2 regen attempts. Delivering anyway.`);
        break;
      }
      console.warn(`Chapter ${chapter.chapter_number} validation attempt ${regenAttempt + 1} failed:`, validationFailures);
      const regenNotice = `=== REGENERATION — PREVIOUS ATTEMPT FAILED QUALITY CHECKS ===
Your previous chapter attempt was rejected for the following reasons:
${validationFailures.map(f => `- ${f}`).join('\n')}

Rewrite the chapter, fixing these specific issues while keeping the plot, character arcs, and story progression the same. Do not simply delete the flagged content — replace it with BETTER alternatives.
=== END REGENERATION NOTICE ===

`;
      const regenMessages = [...messages.slice(0, -1), { role: 'user', content: regenNotice + currentChapterRequest }];
      for (let attempt = 0; attempt < 2; attempt++) {
        const newText = await callAIConversation(regenMessages, 8192);
        if (!isRefusal(newText)) { fullContentWorking = newText; break; }
      }
      // Strip artifacts again after regen
      let rc = fullContentWorking;
      rc = rc.replace(/^#{1,4}\s*(SCENE|Scene)\s*\d+[:\-—]?\s*[^\n]*/gm, '');
      rc = rc.replace(/^\*?\*?(SCENE|Scene)\s*\d+[:\-—]?\s*[^\n]*\*?\*?$/gm, '');
      rc = rc.replace(/^(SCENE|Scene)\s*\d+[:\-—]?\s*[^\n]*/gm, '');
      rc = rc.replace(/^#{1,4}\s*CHAPTER\s*\d+[:\-—]?\s*[^\n]*/gmi, '');
      rc = rc.replace(/\n{3,}/g, '\n\n');
      fullContentWorking = rc.trim();
    }

    fullContent = fullContentWorking;

    // PART 6 — RUN QUALITY SCAN WITH AUTO-REWRITE LOOP (with previousChapters, storyBible, and permanent quality rules)
    // DEEPSEEK POST-GENERATION VALIDATION (PART 1, 2, 3 ORCHESTRATION)
    const isDeepSeek = modelKey === 'deepseek-chat' || modelKey === 'deepseek-reasoner';
    if (isDeepSeek) {
      const deepseekValidation = await base44.functions.invoke('deepseekValidator', {
        chapter_text: fullContent,
        chapter_number: chapter.chapter_number,
        spec: projectSpec,
        previous_chapters: previousChapters,
        story_bible: storyBible,
        characters: storyBible?.characters || [],
      });
      
      if (!deepseekValidation.data.passed) {
        console.log(`DeepSeek Chapter ${chapter.chapter_number} structural check failed:`, deepseekValidation.data.violations);
        fullContent = deepseekValidation.data.text; // Use cleaned version
      }
    }

    let qualityResult = scanChapterQuality(fullContent, chapter.chapter_number, previousChapters, storyBible, projectSpec?.book_type || "fiction", storyBible?.characters || []);

    // Meta-response detection
    const first500 = fullContent.slice(0, 500);
    const META_PATTERNS = [
      /^I appreciate you/i, /^I need to clarify/i, /^I've already completed/i,
      /^Here is/i, /^Here are/i, /^As requested/i,
      /^I'll write/i, /^I'll generate/i, /^I'll create/i,
      /[✓✗☐☑]/, /^All required elements/i, /^Is there a specific element/i,
    ];
    if (META_PATTERNS.some(p => p.test(first500))) {
      qualityResult.warnings.push('CRITICAL: AI output a meta-response instead of prose. Chapter needs regeneration.');
      qualityResult.passed = false;
      console.warn(`Chapter ${chapter.chapter_number}: Meta-response detected in output!`);
    }

    console.log(`Chapter ${chapter.chapter_number} quality scan:`, qualityResult);

    let finalContent = fullContent;
    let passCount = 0;

    // DEEPSEEK AUTO-REWRITE LOOP: increase max passes to 3 (PART 3)
    const maxRewritePasses = isDeepSeek ? 3 : 2;
    
    // Auto-rewrite loop
    if (!qualityResult.passed && qualityResult.warnings.length > 0) {
      for (let pass = 1; pass <= maxRewritePasses; pass++) {
        console.log(`Chapter ${chapter.chapter_number} auto-rewrite pass ${pass}...`);
        
        try {
          const correctedText = await rewriteWithCorrections(finalContent, qualityResult.warnings, chapter.chapter_number, openai_key, modelKey);
          if (correctedText && correctedText.length > 100) {
            finalContent = correctedText;
            passCount = pass;
            
            // Re-scan after rewrite (with previousChapters, storyBible, and characters)
            qualityResult = scanChapterQuality(finalContent, chapter.chapter_number, previousChapters, storyBible, projectSpec?.book_type || "fiction", storyBible?.characters || []);
            console.log(`After pass ${pass} quality scan:`, qualityResult);
            
            if (qualityResult.passed) {
              console.log(`Chapter ${chapter.chapter_number} passed quality check after pass ${pass}`);
              break;
            }
          }
        } catch (rewriteErr) {
          console.error(`Rewrite pass ${pass} failed silently, continuing with current text:`, rewriteErr.message);
        }
      }
    }

    // DEEPSEEK POST-VALIDATION LOGGING (PART 3)
    if (isDeepSeek && qualityResult.violation_count > 5) {
      console.warn(`DeepSeek Chapter ${chapter.chapter_number} still has ${qualityResult.violation_count} violations after ${maxRewritePasses} rewrite passes. Consider switching to Claude for this chapter.`);
    }

    let contentValue = finalContent;
    if (finalContent.length > 30000) {
      try {
        const contentFile = new File([finalContent], `chapter_${chapterId}.txt`, { type: 'text/plain' });
        const uploadResult = await base44.integrations.Core.UploadFile({ file: contentFile });
        if (uploadResult?.file_url) contentValue = uploadResult.file_url;
      } catch (uploadErr) {
        console.warn('File upload failed, storing directly:', uploadErr.message);
      }
    }

    const finalWordCount = finalContent.trim().split(/\s+/).length;

    // BUG 3 — Extract distinctive phrases for cross-chapter repetition prevention
    let distinctivePhrases = [];
    try {
      const phraseRaw = await callAI(
        modelKey,
        'You are a literary analyst. Extract the 15 most distinctive literary phrases, metaphors, and unusual word pairings from this text. Return ONLY a JSON array of strings. No markdown, no explanation.',
        finalContent.slice(0, 6000),
        { maxTokens: 512, temperature: 0.0 }
      );
      const phraseClean = phraseRaw.trim().replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
      const phraseMatch = phraseClean.match(/\[[\s\S]*\]/);
      if (phraseMatch) distinctivePhrases = JSON.parse(phraseMatch[0]);
    } catch (phraseErr) {
      console.warn('Phrase extraction failed silently:', phraseErr.message);
    }

    await base44.entities.Chapter.update(chapterId, {
      content: contentValue,
      status: 'generated',
      word_count: finalWordCount,
      generated_at: new Date().toISOString(),
      quality_scan: JSON.stringify(qualityResult),
      distinctive_phrases: distinctivePhrases.length > 0 ? JSON.stringify(distinctivePhrases) : '',
    });
  } catch (err) {
    // ISSUE 2 & 6 FIX: Log all errors and mark chapter with error details
    console.error('Async generation error for chapter', chapterId, ':', err.message);
    try {
      await base44.entities.Chapter.update(chapterId, { status: 'error' });
    } catch (updateErr) {
      console.error('Failed to mark chapter as error:', updateErr.message);
    }
  }
}

Deno.serve(async (req) => {
  try {
    let base44;
    let user;
    
    try {
      base44 = createClientFromRequest(req);
      user = await base44.auth.me();
    } catch (authErr) {
      console.error('Auth error:', authErr.message);
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, chapter_id } = await req.json();
    if (!project_id || !chapter_id) return Response.json({ error: 'project_id and chapter_id required' }, { status: 400 });

    const [chapters, specs, outlines, sourceFiles, globalSourceFiles, appSettingsList] = await Promise.all([
      base44.entities.Chapter.filter({ project_id }),
      base44.entities.Specification.filter({ project_id }),
      base44.entities.Outline.filter({ project_id }),
      base44.entities.SourceFile.filter({ project_id }),
      base44.entities.SourceFile.filter({ project_id: "global" }),
      base44.entities.AppSettings.list(),
    ]);

    const appSettings = appSettingsList[0] || {};
    const allSourceFiles = [...sourceFiles, ...globalSourceFiles];

    const chapter = chapters.find(c => c.id === chapter_id);
    if (!chapter) return Response.json({ error: 'Chapter not found' }, { status: 404 });

    const rawSpec = specs[0];
    // Normalize spec — apply safe defaults for new fields, handle legacy tone_style
    const spec = rawSpec ? {
      ...rawSpec,
      beat_style: rawSpec.beat_style || rawSpec.tone_style || "",
      spice_level: Math.max(0, Math.min(4, parseInt(rawSpec.spice_level) || 0)),
      language_intensity: Math.max(0, Math.min(4, parseInt(rawSpec.language_intensity) || 0)),
    } : null;
    const outline = outlines[0];

    let outlineData = null;
    let storyBible = null;

    // Resolve outline data — prefer inline, fall back to URL
    let outlineRaw = outline?.outline_data || '';
    if (!outlineRaw && outline?.outline_url) {
      try { outlineRaw = await (await fetch(outline.outline_url)).text(); } catch {}
    }
    try { outlineData = outlineRaw ? JSON.parse(outlineRaw) : null; } catch {}

    // Resolve story bible — prefer inline, fall back to URL
    let bibleRaw = outline?.story_bible || '';
    if (!bibleRaw && outline?.story_bible_url) {
      try { bibleRaw = await (await fetch(outline.story_bible_url)).text(); } catch {}
    }
    try { storyBible = bibleRaw ? JSON.parse(bibleRaw) : null; } catch {}

    // Mark as generating and fire async generation in background
    await base44.entities.Chapter.update(chapter_id, { status: 'generating' });

    const modelKey = spec?.ai_model || 'claude-sonnet';

    // Start async generation without waiting
    generateChapterAsync(base44, project_id, chapter_id, spec, outline, sourceFiles, appSettings, modelKey).catch(err => {
      console.error('Background generation failed:', err.message);
    });

    // Return immediately so we don't hit Deno's 10s limit
    return Response.json({
      text: '',
      success: true,
      async: true,
      message: 'Chapter generation started in background'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});