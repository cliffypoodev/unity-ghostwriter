// ═══════════════════════════════════════════════════════════════════════════════
// BOT 2 — PROSE WRITER
// ═══════════════════════════════════════════════════════════════════════════════
// One job: Given project context, build the prompt and write raw chapter prose.
// No validation. No compliance. No retries (except one refusal retry).
// Downstream bots (Continuity Guardian, Style Enforcer) handle quality.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ═══ INLINED: shared/aiRouter ═══
const MODEL_MAP = {
  "claude-sonnet":     { provider: "anthropic", modelId: "claude-sonnet-4-20250514", defaultTemp: 0.72, maxTokensLimit: null },
  "claude-opus":       { provider: "anthropic", modelId: "claude-opus-4-20250514",   defaultTemp: 0.72, maxTokensLimit: null },
  "claude-opus-4-5":   { provider: "anthropic", modelId: "claude-opus-4-5",          defaultTemp: 0.72, maxTokensLimit: null },
  "claude-sonnet-4-5": { provider: "anthropic", modelId: "claude-sonnet-4-5",        defaultTemp: 0.72, maxTokensLimit: null },
  "claude-haiku-4-5":  { provider: "anthropic", modelId: "claude-haiku-4-5",         defaultTemp: 0.72, maxTokensLimit: null },
  "gpt-4o":            { provider: "openai",    modelId: "gpt-4o",                   defaultTemp: 0.4,  maxTokensLimit: null },
  "gpt-4o-creative":   { provider: "openai",    modelId: "gpt-4o",                   defaultTemp: 0.9,  maxTokensLimit: null },
  "gpt-4-turbo":       { provider: "openai",    modelId: "gpt-4-turbo",              defaultTemp: 0.7,  maxTokensLimit: 4096 },
  "gemini-pro":        { provider: "google",    modelId: "gemini-2.5-pro-preview-03-25", defaultTemp: 0.72, maxTokensLimit: null },
  "gemini-flash":      { provider: "google",    modelId: "gemini-2.0-flash-001",     defaultTemp: 0.72, maxTokensLimit: null },
  "deepseek-chat":     { provider: "deepseek",  modelId: "deepseek-chat",            defaultTemp: 0.72, maxTokensLimit: 8192 },
  "openrouter":        { provider: "openrouter", modelId: "deepseek/deepseek-chat",  defaultTemp: 0.72, maxTokensLimit: 16384 },
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
  if (provider === "openai") {
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + Deno.env.get('OPENAI_API_KEY'), 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }) });
    const d = await r.json(); if (!r.ok) throw new Error('OpenAI: ' + (d.error?.message || r.status)); return d.choices[0].message.content;
  }
  if (provider === "google") {
    const apiKey = Deno.env.get('GOOGLE_AI_API_KEY'); if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set');
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + modelId + ':generateContent?key=' + apiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: userMessage }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { temperature, maxOutputTokens: maxTokens } }) });
    const d = await r.json(); if (!r.ok) throw new Error('Google: ' + (d.error?.message || r.status));
    if (!d?.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error('Google AI empty response');
    return d.candidates[0].content.parts[0].text;
  }
  if (provider === "deepseek") {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + Deno.env.get('DEEPSEEK_API_KEY'), 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelId, max_tokens: Math.min(maxTokens, 8192), temperature, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }) });
    const d = await r.json(); if (!r.ok) throw new Error('DeepSeek: ' + (d.error?.message || r.status)); return d.choices[0].message.content;
  }
  if (provider === "openrouter") {
    const orKey = Deno.env.get('OPENROUTER_API_KEY'); if (!orKey) throw new Error('OPENROUTER_API_KEY not configured');
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + orKey, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://unity-ghostwriter.base44.app', 'X-Title': 'Unity Ghostwriter' }, body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }) });
    const d = await r.json(); if (!r.ok) throw new Error('OpenRouter: ' + (d.error?.message || r.status));
    if (!d.choices?.[0]?.message?.content) throw new Error('OpenRouter empty response');
    return d.choices[0].message.content;
  }
  throw new Error('Unknown provider: ' + provider);
}

function isRefusal(text) {
  if (!text || typeof text !== 'string') return false;
  const f = text.slice(0, 300).toLowerCase();
  return ['i cannot','i can\'t','i\'m unable','i am unable','against my guidelines','as an ai','content policy','i\'m designed to'].some(m => f.includes(m));
}

// ═══ INLINED: shared/resolveModel ═══
const HARDCODED_ROUTES = { outline:'gemini-pro', beat_sheet:'gemini-pro', post_gen_rewrite:'claude-sonnet', consistency_check:'claude-sonnet', style_rewrite:'claude-sonnet', chapter_state:'claude-sonnet', sfw_handoff_check:'claude-sonnet' };
function resolveModel(callType, spec) {
  if (HARDCODED_ROUTES[callType]) return HARDCODED_ROUTES[callType];
  if (callType === 'explicit_scene') return 'deepseek-chat';
  if (callType === 'sfw_prose') return spec?.writing_model || spec?.ai_model || 'claude-sonnet';
  return spec?.writing_model || spec?.ai_model || 'claude-sonnet';
}

// ═══ INLINED: shared/dataLoader ═══
async function resolveContent(content) {
  if (!content) return '';
  if (typeof content === 'string' && (content.startsWith('http://') || content.startsWith('https://'))) {
    try { const r = await fetch(content); if (!r.ok) return ''; const t = await r.text(); if (t.trim().startsWith('<')) return ''; return t; } catch { return ''; }
  }
  return content;
}

async function loadProjectContext(base44, projectId) {
  let chapters = [], specs = [], outlines = [], sourceFiles = [], globalSourceFiles = [], projects = [];
  [chapters, specs, outlines, sourceFiles, globalSourceFiles, projects] = await Promise.all([
    base44.entities.Chapter.filter({ project_id: projectId }),
    base44.entities.Specification.filter({ project_id: projectId }),
    base44.entities.Outline.filter({ project_id: projectId }),
    base44.entities.SourceFile.filter({ project_id: projectId }).catch(() => []),
    base44.entities.SourceFile.filter({ project_id: "global" }).catch(() => []),
    base44.entities.Project.filter({ id: projectId }).catch(() => []),
  ]);
  const project = projects[0] || {};
  const rawSpec = specs[0]; const outline = outlines[0];
  const spec = rawSpec ? { ...rawSpec, beat_style: rawSpec.beat_style || rawSpec.tone_style || "", spice_level: Math.max(0, Math.min(4, parseInt(rawSpec.spice_level) || 0)), language_intensity: Math.max(0, Math.min(4, parseInt(rawSpec.language_intensity) || 0)) } : null;
  let outlineData = null; let outlineRaw = outline?.outline_data || '';
  if (!outlineRaw && outline?.outline_url) { try { outlineRaw = await (await fetch(outline.outline_url)).text(); } catch {} }
  try { outlineData = outlineRaw ? JSON.parse(outlineRaw) : null; } catch {}
  let storyBible = null; let bibleRaw = outline?.story_bible || '';
  if (!bibleRaw && outline?.story_bible_url) { try { bibleRaw = await (await fetch(outline.story_bible_url)).text(); } catch {} }
  try { storyBible = bibleRaw ? JSON.parse(bibleRaw) : null; } catch {}
  chapters.sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
  let nameRegistry = {}; if (project.name_registry) { try { nameRegistry = JSON.parse(project.name_registry); } catch {} }
  let bannedPhrases = []; if (project.banned_phrases_log) { let bpRaw = project.banned_phrases_log; if (typeof bpRaw === 'string' && bpRaw.startsWith('http')) { try { bpRaw = await (await fetch(bpRaw)).text(); } catch { bpRaw = '[]'; } } try { bannedPhrases = JSON.parse(bpRaw); } catch {} }
  let chapterStateLog = ''; if (project.chapter_state_log) { chapterStateLog = await resolveContent(project.chapter_state_log); }
  return { project, chapters, spec, outline, outlineData, storyBible, sourceFiles, globalSourceFiles, nameRegistry, bannedPhrases, chapterStateLog, totalChapters: chapters.length, isNonfiction: spec?.book_type === 'nonfiction', isFiction: spec?.book_type !== 'nonfiction', isErotica: /erotica|erotic/.test(((spec?.genre || '') + ' ' + (spec?.subgenre || '')).toLowerCase()) };
}

function getChapterContext(ctx, chapterId) {
  const chapter = ctx.chapters.find(c => c.id === chapterId);
  if (!chapter) throw new Error('Chapter not found: ' + chapterId);
  const chapterIndex = ctx.chapters.findIndex(c => c.id === chapterId);
  const prevChapter = chapterIndex > 0 ? ctx.chapters[chapterIndex - 1] : null;
  const nextChapter = chapterIndex < ctx.chapters.length - 1 ? ctx.chapters[chapterIndex + 1] : null;
  const isLastChapter = chapterIndex === ctx.chapters.length - 1;
  const isFirstChapter = chapterIndex === 0;
  const outlineChapters = ctx.outlineData?.chapters || [];
  const outlineEntry = outlineChapters.find(c => (c.number || c.chapter_number) === chapter.chapter_number) || {};
  const previousChapters = ctx.chapters.slice(0, chapterIndex).filter(c => c.content && c.status === 'generated');
  let lastStateDoc = null;
  for (let i = chapterIndex - 1; i >= 0; i--) { if (ctx.chapters[i].state_document) { lastStateDoc = ctx.chapters[i].state_document; break; } }
  let scenes = null;
  if (chapter.scenes) { try { const parsed = typeof chapter.scenes === 'string' ? JSON.parse(chapter.scenes) : chapter.scenes; if (Array.isArray(parsed) && parsed.length > 0) scenes = parsed; } catch {} }
  let chapterBeat = null;
  if (ctx.outlineData?.beat_sheet) { const bs = ctx.outlineData.beat_sheet; const beats = Array.isArray(bs) ? bs : bs?.beats || []; chapterBeat = beats.find(b => (b.chapter_number || b.chapter) === chapter.chapter_number) || null; }
  return { chapter, chapterIndex, prevChapter, nextChapter, isLastChapter, isFirstChapter, outlineEntry, previousChapters, lastStateDoc, scenes, chapterBeat };
}

async function loadActBridges(base44, projectId) {
  try {
    const sourceFiles = await base44.entities.SourceFile.filter({ project_id: projectId });
    const bridges = [];
    for (const bf of sourceFiles.filter(f => /^act_\d+_bridge\.txt$/.test(f.filename)).sort((a, b) => a.filename.localeCompare(b.filename))) {
      if (bf.content?.length > 50) { const actNum = bf.filename.match(/act_(\d+)/)[1]; bridges.push({ actNumber: parseInt(actNum), content: bf.content.slice(0, 2000) }); }
    }
    return bridges;
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENRE/STYLE DATA
// ═══════════════════════════════════════════════════════════════════════════════

const BEAT_STYLES = {
  "fast-paced-thriller": { name: "Fast-Paced Thriller", instructions: "Core Identity: Relentless momentum. Immediate stakes. Forward propulsion at all times.\nSentence Rhythm: Short to medium sentences. Strong, active verbs. Tight paragraphs (1-4 lines).\nPacing: Introduce danger within first paragraph. Escalate every 2-4 paragraphs.\nDialogue: Direct. Tactical. Urgent.\nEnding Rule: Scene must close with forward momentum, not emotional resolution." },
  "gritty-cinematic": { name: "Gritty Cinematic", instructions: "Core Identity: Raw realism. Texture-heavy environments. Physical consequence.\nSentence Rhythm: Medium-length. Concrete nouns and verbs. Sparse but sharp metaphors.\nPacing: Tension builds steadily. Physical consequences matter.\nDialogue: Hard. Minimal. Subtext heavy.\nEnding Rule: End on something tangible and unsettling." },
  "hollywood-blockbuster": { name: "Hollywood Blockbuster", instructions: "Big visuals, clear stakes, hero-driven. Dynamic pacing, memorable dialogue." },
  "slow-burn": { name: "Slow Burn", instructions: "Gradual tension layering. Longer paragraphs, measured pacing. Deep internal reflection." },
  "clean-romance": { name: "Clean Romance", instructions: "Emotional intimacy over physical explicitness. Warm flowing prose. Banter-driven dialogue." },
  "faith-infused": { name: "Faith-Infused Contemporary", instructions: "Hope grounded in real life. Spiritual undertone without preaching." },
  "investigative-nonfiction": { name: "Investigative Nonfiction", instructions: "Evidence-based narrative. Structured, logical, precise. Context > Event reconstruction > Evidence analysis > Implication." },
  "reference-educational": { name: "Reference / Educational", instructions: "Clarity and structure over drama. Clear direct sentences. Definition > Explanation > Application > Example." },
  "intellectual-psychological": { name: "Intellectual Psychological", instructions: "Thought-driven tension. Controlled pacing. Analytical phrasing." },
  "dark-suspense": { name: "Dark Suspense", instructions: "Claustrophobic dread. Controlled fear escalation. Tight controlled prose." },
  "satirical": { name: "Satirical", instructions: "Sharp commentary through controlled exaggeration. Quick wit." },
  "epic-historical": { name: "Epic Historical", instructions: "Grand-scale pivotal history. Resonant lyrical prose. Period-accurate." },
  "whimsical-cozy": { name: "Whimsical Cozy", instructions: "Gentle comfort, small magic. Playful cadence. Low-stakes, found family." },
  "hard-boiled-noir": { name: "Hard-Boiled Noir", instructions: "Cynical urban underworld. Staccato sentences, slang. Fatalism." },
  "grandiose-space-opera": { name: "Grandiose Space Opera", instructions: "Interstellar conflict. Sweeping cinematic prose. Mythic language." },
  "visceral-horror": { name: "Visceral Horror", instructions: "Sensory descent into fear. Erratic rhythm. Body horror, psychological warping." },
  "poetic-magical-realism": { name: "Poetic Magical Realism", instructions: "Supernatural as mundane. Dreamlike prose." },
  "clinical-procedural": { name: "Clinical Procedural", instructions: "Meticulous technical focus. Precise prose. Tools, forensics, SOPs." },
  "hyper-stylized-action": { name: "Hyper-Stylized Action", instructions: "Explosive narrative. Fast pacing. Aesthetic violence." },
  "nostalgic-coming-of-age": { name: "Nostalgic Coming-of-Age", instructions: "Bittersweet transition. Reflective soft prose. Sensory triggers." },
  "cerebral-sci-fi": { name: "Cerebral Sci-Fi", instructions: "High-concept ideas. Dense intellectual prose. Hard science speculation." },
  "high-stakes-political": { name: "High-Stakes Political", instructions: "Machiavellian chess match. Sharp dialogue. Backroom deals." },
  "surrealist-avant-garde": { name: "Surrealist Avant-Garde", instructions: "Dream-logic, abstract imagery. Stream-of-consciousness." },
  "melancholic-literary": { name: "Melancholic Literary", instructions: "Quiet interior sadness/regret. Slow elegant prose, heavy subtext." },
  "urban-gritty-fantasy": { name: "Urban Gritty Fantasy", instructions: "High-magic + harsh modern city. Street-level energy." },
  "steamy-romance": { name: "Steamy Romance", instructions: "Breathless chemistry. Emotional vulnerability. Explicit scenes emotionally grounded." },
  "slow-burn-romance": { name: "Slow Burn Romance", instructions: "Agonizing anticipation. Almost-touch tension. Emotional buildup before physical." },
  "dark-erotica": { name: "Dark Erotica", instructions: "Power dynamics, psychological tension. Explicit content with narrative purpose." },
  "journal-personal": { name: "Journal / Personal Essay", instructions: "First-person reflective. Conversational, honest. Vulnerable but structured." },
  "longform-article": { name: "Longform Article", instructions: "Magazine-quality narrative journalism. Scenes, interviews, analysis woven." },
  "deep-investigative": { name: "Deep Investigative", instructions: "Documents and evidence forward. Systematic revelation. Forensic detail." },
  "historical-account": { name: "Historical Account", instructions: "Period-accurate detail. Parallel narrative threads across time." },
  "true-crime-account": { name: "True Crime Account", instructions: "Evidence-led narrative. Tension without sensationalism. Timeline precision." },
  "memoir-narrative": { name: "Memoir / Narrative Nonfiction", instructions: "Personal experience as universal. Scene-based, not summary-based." },
  "academic-accessible": { name: "Academic but Accessible", instructions: "Research-grounded but readable. Evidence first, opinion second." },
};

function getBeatStyleInstructions(key) {
  if (!key) return "Not specified";
  const beat = BEAT_STYLES[key];
  return beat ? `${beat.name}\n${beat.instructions}` : key;
}

const ASP = {
  'colleen-hoover':'Write with emotional rawness and psychological intensity. First-person or close third. Present tense if it serves immediacy.',
  'taylor-jenkins-reid':'Nonlinear or dual-timeline structure. Characters reveal complexity slowly.',
  'emily-henry':'Lead with dialogue and banter. Witty without being glib. Chemistry through verbal sparring.',
  'sally-rooney':'Minimal dialogue tags. Stripped down, precise. Intellectual characters navigating class and intimacy.',
  'stephen-king':'Build character before dread. Small towns carry deep darkness. Conversational narration.',
  'brandon-sanderson':'Magic has rules and costs. World-building through character experience, not exposition.',
  'cormac-mccarthy':'Remove quotation marks. Spare biblical cadence. Violence as weather.',
  'agatha-christie':'Plot mechanics priority. Every detail a clue or red herring. Fair-play mystery.',
  'james-patterson':'Ultra-short chapters. Rapid scene cuts. Hooks every chapter ending.',
  'lee-child':'Procedural detail as tension. Methodical protagonist. Clipped sentences under pressure.',
  'joe-abercrombie':'Grimdark morality. Dark humor. Violence has physical consequences.',
  'robin-hobb':'Deep POV, slow-building emotional devastation. Loyalty as theme.',
  'terry-pratchett':'Footnotes and asides. Absurdist logic. Satire with genuine heart.',
  'nk-jemisin':'Second-person when appropriate. Systemic oppression as world-building foundation.',
  'penelope-douglas':'Push-pull tension. Forbidden dynamics. Emotional wounds driving behavior.',
  'shirley-jackson':'Domestic horror. Mundane becomes menacing. Unreliable normalcy.',
  'toni-morrison':'Lyrical, mythic prose. Intergenerational trauma. Community as character.',
  'kazuo-ishiguro':'Restrained narrator. What\'s unsaid matters most. Memory as unreliable.',
  'zadie-smith':'Multicultural London. Humor and pathos. Sprawling interconnected lives.',
  'donna-tartt':'Dense literary prose. Obsession and aestheticism. Slow moral decay.',
  'colm-toibin':'Spare emotional precision. Exile and belonging. Understated devastation.',
  'hilary-mantel':'Historical immersion. Present-tense intimacy with past. Power as theme.',
  'erik-larson':'Two narratives in parallel. Cinematic and propulsive. Let facts create drama.',
  'david-grann':'Obsessive investigation as narrative engine. Layer mystery onto history.',
  'malcolm-gladwell':'Counterintuitive claim, proven through specific stories. Accessible social science.',
  'jon-krakauer':'First-person witness. Moral complexity in extreme situations.',
  'michelle-mcnamara':'True crime as literary art. Empathy for victims. Obsessive detail.',
  'robert-kolker':'Family systems and institutional failure. Individual stories illuminate systemic issues.',
  'james-clear':'Every claim has mechanism and application. Clear, efficient, actionable.',
  'brene-brown':'Lead with vulnerability. Research not clinical. Warm and direct.',
  'ryan-holiday':'Stoic principles through historical narrative. Practical philosophy.',
};

const SPICE_LEVELS = {
  0: { name: "Fade to Black", instructions: "No sexual content. Romantic tension permitted. Focus on emotional connection." },
  1: { name: "Closed Door", instructions: "Intimacy implied but never shown. Scene ends before clothing removed." },
  2: { name: "Cracked Door", instructions: "Intimate scenes partially depicted with tasteful language. Pulls back before fully explicit." },
  3: { name: "Open Door", instructions: "Explicit sexual scenes permitted and depicted fully. Anatomical language allowed but natural." },
  4: { name: "Full Intensity", instructions: "No restrictions on explicitness. Raw, unflinching. Character-driven. Consent essential." },
};

const LANGUAGE_INTENSITY = {
  0: { name: "Clean", instructions: "No profanity, no slurs, no crude language." },
  1: { name: "Mild", instructions: "Occasional damn, hell. No F-bombs or slurs." },
  2: { name: "Moderate", instructions: "Occasional F-word in character. No slurs unless period-critical and acknowledged." },
  3: { name: "Strong", instructions: "Unrestricted profanity. Raw authentic dialogue. No gratuitous slurs." },
  4: { name: "Raw", instructions: "No language restrictions. Period-accurate, character-authentic. All profanity permitted." },
};

// ═══════════════════════════════════════════════════════════════════════════════
// QUALITY & GUARDRAIL CONSTANTS (from v2)
// ═══════════════════════════════════════════════════════════════════════════════

const CONTENT_GUARDRAILS = `CONTENT GUARDRAILS (always enforced):
- All sexual content must involve adults (18+). No exceptions.
- Consent must be clear. Non-consensual acts only if unambiguously framed as violation.
- No sexual content involving minors.
- No real-world instructions for weapons, drugs, or illegal activity.
- No glorification of hate groups or targeted violence.
- These cannot be overridden by any setting.`;

const OUTPUT_FORMAT_RULES = `OUTPUT FORMAT RULES:
- Return ONLY prose. No preamble. No commentary.
- Do NOT include chapter title, number, or heading.
- Do NOT include scene headers or numbers. Only "* * *" between scenes.
- Do not start with "Here is..." or any assistant-style opening.
- Do not end with "Let me know if..." or any assistant-style closing.
- No content warnings or disclaimers in output.
- Never output meta-commentary, checklists, or instructions.
- If uncertain about a scene's level, write at the configured level.`;

const QUALITY_UPGRADES = `INTERIORITY: Internal monologue max 2 consecutive sentences before action/dialogue/sensory.
DIALOGUE SUBTEXT: Every exchange >2 lines must contain subtext. Direct on-the-nose max 1x/chapter.
SCENE ENDING: Final paragraph ends on: physical image, dialogue, concrete action, or sensory detail. NOT: emotional summary, stated realization, thematic declaration.
OPENING: First sentence mid-action/sensation/dialogue. No character name in first 5 words.
CHARACTER ARC DIVERSITY: Each chapter must reveal a NEW dimension of the protagonist — a new fear, desire, memory, or contradiction. Do NOT restate the same emotional wound using the same vocabulary across multiple chapters.
DIALOGUE MODE DIVERSITY: Each major character must demonstrate at least 3 distinct conversational modes across the manuscript. If a character only psychoanalyzes the protagonist, they are not a character — they are a device. Give them mundane moments, uncertainty, humor, or genuine questions.`;

const EROTICA_SCENE_ENFORCEMENT = `=== EXPLICIT SCENE ENFORCEMENT (EROTICA — NON-NEGOTIABLE) ===
When the scene reaches physical intimacy beyond kissing:
1. MINIMUM 600 WORDS of on-page physical action before any interruption or scene break.
2. You MUST describe specific body-to-body contact: which body part touches which, the texture, temperature, pressure, and physical response.
3. You MUST NOT summarize the sex scene in a single paragraph. "What followed was..." or "They came together in..." followed by abstract description is a GENRE FAILURE. SHOW the scene beat by beat.
4. Every intimate scene must include at least 3 SPECIFIC physical details unique to this species pairing.
5. The protagonist's arousal must be described through PHYSICAL SIGNS — NOT emotional labels.
6. After climax: minimum 2 paragraphs of physical aftermath.
7. DO NOT write "it was not gentle" and then skip to aftermath. SHOW the not-gentle part.
8. Sensation must name SPECIFIC BODY LOCATIONS. "Electricity shot through him" = BANNED.
9. The non-human partner's alien physiology is NOT decorative. Their unique physical traits MUST be active erotic elements.
=== END EXPLICIT SCENE ENFORCEMENT ===`;

const NONFICTION_CHAPTER_PROGRESSION = `=== CHAPTER ARGUMENT PROGRESSION ===
This chapter must advance a SPECIFIC NEW claim or body of evidence that no prior chapter has covered. If a person, institution, or event has a DEDICATED chapter elsewhere in the outline, this chapter may mention them in passing only (1-2 paragraphs max) and must NOT cover the same biographical ground.

Do NOT write a standalone essay. This chapter must:
1. Build on what the previous chapter established
2. Add NEW evidence, cases, or analysis not seen before
3. Set up what the next chapter will address
=== END CHAPTER PROGRESSION ===`;

function getOpeningType(chNum) {
  const idx = ((chNum - 1) % 5) + 1;
  const types = {
    1: { name: "Mid-action", desc: "character already DOING something physical" },
    2: { name: "Dialogue", desc: "open mid-conversation, no attribution tag first" },
    3: { name: "Sensory detail", desc: "one sense, one sentence, visceral and specific" },
    4: { name: "Time/place anchor", desc: "e.g. 'Tuesday, 3 AM. Lucas's hands were bleeding.'" },
    5: { name: "Contradicting thought", desc: "character thinks X right before opposite happens" },
  };
  return types[idx];
}

function getEndingType(chNum) {
  const idx = ((chNum + 1) % 5) + 1;
  const types = {
    1: { name: "Mid-action cliffhanger", desc: "interrupt mid-action, cut to black" },
    2: { name: "Revelation recontextualizes", desc: "new info, no reaction narration" },
    3: { name: "Concrete sensory image", desc: "actual thing character sees/hears/touches" },
    4: { name: "Gut-punch dialogue", desc: "quote is the last thing. No narration after." },
    5: { name: "Quiet mundane contrast", desc: "character makes coffee after harrowing event" },
  };
  return types[idx];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

const WORDS_PER_CHAPTER = { short: 1200, medium: 1600, long: 2200, epic: 3000 };

function buildContextHeader(spec) {
  const bs = spec?.beat_style || spec?.tone_style || '';
  const bn = BEAT_STYLES[bs]?.name || bs || 'Not specified';
  const sp = parseInt(spec?.spice_level) || 0;
  const li = parseInt(spec?.language_intensity) || 0;
  return `TYPE: ${(spec?.book_type || 'fiction').toUpperCase()} | GENRE: ${spec?.genre || 'Fiction'}${spec?.subgenre ? ' / ' + spec.subgenre : ''} | BEAT: ${bn} | LANG: ${li}/4 ${LANGUAGE_INTENSITY[li]?.name || 'Clean'}${sp > 0 ? ' | SPICE: ' + sp + '/4 ' + SPICE_LEVELS[sp]?.name : ''}`;
}

function buildCharacterContext(storyBible) {
  const chars = storyBible?.characters || [];
  if (chars.length === 0) return '';
  return 'CHARACTERS:\n' + chars.map(c => {
    let line = `- ${c.name} (${c.role || 'character'}): ${c.description || ''}`;
    if (c.relationships) line += ' | Relationships: ' + c.relationships;
    if (c.pronouns) line += ' | Pronouns: ' + c.pronouns;
    return line;
  }).join('\n');
}

function buildSceneContext(scenes) {
  if (!scenes || !Array.isArray(scenes) || scenes.length === 0) return '';
  return 'SCENE BREAKDOWN:\n' + scenes.map((s, i) => {
    let line = `Scene ${i + 1}: "${s.title || 'Untitled'}"`;
    if (s.location) line += ` — ${s.location}`;
    if (s.pov) line += ` [POV: ${s.pov}]`;
    if (s.purpose) line += `\n  Purpose: ${s.purpose}`;
    if (s.key_action) line += `\n  Key action: ${s.key_action}`;
    if (s.emotional_arc) line += `\n  Arc: ${s.emotional_arc}`;
    if (s.sensory_anchor) line += `\n  Open with: ${s.sensory_anchor}`;
    if (s.dialogue_focus) line += `\n  Dialogue: ${s.dialogue_focus}`;
    if (s.extra_instructions) line += `\n  Notes: ${s.extra_instructions}`;
    if (s.word_target) line += `\n  Word target: ~${s.word_target}`;
    return line;
  }).join('\n\n');
}

function buildCharacterNameLock(storyBible, nameRegistry, outlineData) {
  const chars = [];

  // Pull from story bible characters
  if (storyBible?.characters?.length > 0) {
    for (const c of storyBible.characters) {
      if (c.name) {
        chars.push({ name: c.name, role: c.role || 'character', firstAppearance: null });
      }
    }
  }

  // Augment with name registry (has first_chapter info)
  if (nameRegistry && typeof nameRegistry === 'object') {
    for (const [name, info] of Object.entries(nameRegistry)) {
      if (!chars.find(c => c.name === name)) {
        chars.push({ name, role: info.role || 'character', firstAppearance: info.first_chapter || null });
      } else {
        const existing = chars.find(c => c.name === name);
        if (info.first_chapter && !existing.firstAppearance) existing.firstAppearance = info.first_chapter;
      }
    }
  }

  // Pull from outline chapters' character lists
  if (outlineData?.chapters) {
    for (const ch of outlineData.chapters) {
      for (const cName of (ch.characters || ch.key_characters || [])) {
        const nameStr = typeof cName === 'string' ? cName : cName?.name;
        if (nameStr && !chars.find(c => c.name === nameStr)) {
          chars.push({ name: nameStr, role: 'character', firstAppearance: ch.number || ch.chapter_number || null });
        }
      }
    }
  }

  if (chars.length === 0) return '';

  const lines = chars.map(c => {
    let line = `  ${c.role}: ${c.name}`;
    if (c.firstAppearance) line += ` (first appears Ch ${c.firstAppearance})`;
    return line;
  });

  return `\nCHARACTER NAME LOCK — NON-NEGOTIABLE:
The following character names are fixed for this manuscript. Use ONLY these
names. Do not introduce new names for established roles. Do not use
placeholder names if the character already exists in this registry.

${lines.join('\n')}

If a scene requires a character whose name is not in this registry, use a
generic descriptor (e.g., "the defense attorney") rather than inventing a name.`;
}

function buildBannedPhrasesContext(bannedPhrases) {
  if (!bannedPhrases || bannedPhrases.length === 0) return '';
  const recent = bannedPhrases.slice(-60);
  return 'BANNED PHRASES (used in prior chapters — do NOT reuse):\n' + recent.map(p => `- ${p}`).join('\n');
}

function buildPreviousChapterContext(previousChapters) {
  if (!previousChapters || previousChapters.length === 0) return '';
  const last3 = previousChapters.slice(-3);
  return 'PREVIOUS CHAPTERS (most recent last):\n' + last3.map(ch => {
    const summary = ch.summary || '';
    const ending = ch.content ? '...' + ch.content.slice(-200) : '';
    return `Ch ${ch.chapter_number}: "${ch.title}" — ${summary}\n  Ending: ${ending}`;
  }).join('\n\n');
}

function buildProsePrompt(ctx, chCtx) {
  const { spec, storyBible, bannedPhrases, totalChapters, isNonfiction, isErotica } = ctx;
  const { chapter, outlineEntry, previousChapters, lastStateDoc, scenes, isLastChapter, isFirstChapter } = chCtx;

  const targetLength = spec?.target_length || 'medium';
  const wordTarget = WORDS_PER_CHAPTER[targetLength] || 1600;
  const beatInstructions = getBeatStyleInstructions(spec?.beat_style || spec?.tone_style || '');

  const spiceLevel = parseInt(spec?.spice_level) || 0;
  const langLevel = parseInt(spec?.language_intensity) || 0;
  const spiceInstructions = SPICE_LEVELS[spiceLevel]?.instructions || '';
  const langInstructions = LANGUAGE_INTENSITY[langLevel]?.instructions || '';

  const authorVoice = spec?.author_voice || 'basic';
  const authorInstructions = ASP[authorVoice] || '';

  // Protagonist interiority
  let interiorityBlock = '';
  if (ctx.project?.protagonist_interiority) {
    try {
      const pi = JSON.parse(ctx.project.protagonist_interiority);
      const lines = [];
      if (pi.life_purpose) lines.push(`Before-belief: ${pi.life_purpose}`);
      if (pi.core_wound) lines.push(`Core wound: ${pi.core_wound}`);
      if (pi.self_belief) lines.push(`Hidden self-belief: ${pi.self_belief}`);
      if (pi.secret_desire) lines.push(`Secret desire: ${pi.secret_desire}`);
      if (pi.behavioral_tells) lines.push(`Behavioral tells: ${pi.behavioral_tells}`);
      if (lines.length > 0) interiorityBlock = '\nPROTAGONIST INTERIORITY (weave at least one layer into a scene beat):\n' + lines.join('\n');
    } catch {}
  }

  // Build system prompt
  const systemParts = [
    `You are a ${isNonfiction ? 'nonfiction' : 'fiction'} author writing Chapter ${chapter.chapter_number} of ${totalChapters}: "${chapter.title}".`,
    `\nWRITING RULES:`,
    `- Write ONLY prose. No meta-commentary, headers, or author notes.`,
    `- Target: ~${wordTarget} words. MINIMUM ${Math.round(wordTarget * 0.8)} words.`,
    `- ${isNonfiction ? `DOCUMENTARY NONFICTION SOURCE REQUIREMENTS:
  Every factual claim must be anchored to at least ONE of:
  • A specific document with date and archive location
  • A named person's testimony with context  
  • A court case with docket number or ruling name
  • A published book/article with author and year
  • A specific dated event with verifiable details
  If you cannot anchor a claim, insert [VERIFY: source needed].
  DO NOT invent specific times ("3:47 AM"), specific dollar amounts,
  specific dialogue, or specific scenes unless sourced from documented record.
  Atmospheric reconstruction is permitted ONLY when labeled:
  "Contemporary accounts describe..." or "Records from the period suggest..."
  DO NOT use unnamed composites as documented individuals. "A young actress"
  doing specific things in a specific office is FICTION, not nonfiction.
  Use real names with sources, or use clearly labeled reconstruction.` : 'Show, don\'t tell. Concrete sensory detail. Dialogue advances plot.'}`,
    `- Vary sentence length. No repetitive structure.`,
    `- Scene breaks: use "* * *" on its own line.`,
    isLastChapter ? '\n- THIS IS THE FINAL CHAPTER. Resolve all open threads. Deliver emotional payoff.' : '',
    isFirstChapter ? '\n- THIS IS THE OPENING CHAPTER. Hook the reader immediately. Establish world and tone.' : '',
  ];

  if (beatInstructions && beatInstructions !== 'Not specified') {
    systemParts.push(`\nBEAT STYLE:\n${beatInstructions}`);
  }
  if (authorInstructions) {
    systemParts.push(`\nAUTHOR VOICE:\n${authorInstructions}`);
  }
  if (spiceInstructions) {
    systemParts.push(`\nSPICE (${SPICE_LEVELS[spiceLevel]?.name || 'N/A'}):\n${spiceInstructions}`);
  }
  if (langInstructions) {
    systemParts.push(`\nLANGUAGE (${LANGUAGE_INTENSITY[langLevel]?.name || 'Clean'}):\n${langInstructions}`);
  }
  if (interiorityBlock) {
    systemParts.push(interiorityBlock);
  }

  // Character name lock — prevents AI from inventing wrong names
  const nameLock = buildCharacterNameLock(storyBible, ctx.nameRegistry, ctx.outlineData);
  if (nameLock) {
    systemParts.push(nameLock);
  }

  // Absolute prohibition on inline editorial notes
  systemParts.push(`\nABSOLUTE PROHIBITION — INLINE EDITORIAL NOTES:
Never insert editorial notes, structural suggestions, continuity flags, or
revision reminders inside narrative output. Examples of BANNED patterns:
- "Add [scene/transition] here"
- "Change [name] to [other name] throughout"
- "Either revise this or update the outline"
- "Show [event] before this scene"
If you identify a continuity problem WHILE WRITING, fix it silently within
the narrative. If you cannot fix it, STOP and do not write that section.
Under no circumstances is an editorial note permitted inside prose.`);

  const systemPrompt = systemParts.filter(Boolean).join('\n');

  // Build user message
  // Extract argument progression from nonfiction beat sheet (stored in scenes field)
  let argumentProgression = '';
  if (isNonfiction && scenes && !Array.isArray(scenes) && scenes.argument_progression) {
    const ap = scenes.argument_progression;
    const apLines = [];
    if (ap.prior_chapter_endpoint) apLines.push(`PRIOR ENDPOINT: ${ap.prior_chapter_endpoint}`);
    if (ap.this_chapter_advances) apLines.push(`THIS CHAPTER ADVANCES: ${ap.this_chapter_advances}`);
    if (ap.new_ground) apLines.push(`NEW GROUND (cover this — it appears NOWHERE else): ${ap.new_ground}`);
    if (ap.handoff) apLines.push(`HANDOFF TO NEXT: ${ap.handoff}`);
    if (apLines.length > 0) argumentProgression = '\nARGUMENT PROGRESSION:\n' + apLines.join('\n');
  }

  const userParts = [
    buildContextHeader(spec),
    '',
    buildCharacterContext(storyBible),
    '',
    `CHAPTER ${chapter.chapter_number} of ${totalChapters}: "${chapter.title}"`,
    `Summary: ${chapter.summary || outlineEntry?.summary || 'No summary'}`,
    `Key events: ${JSON.stringify(outlineEntry?.key_events || outlineEntry?.key_beats || [])}`,
    chapter.prompt ? `Prompt: ${chapter.prompt}` : '',
    argumentProgression,
    '',
    buildSceneContext(scenes),
    '',
    lastStateDoc ? `PREVIOUS STATE DOCUMENT:\n${lastStateDoc.slice(0, 3000)}` : '',
    '',
    buildPreviousChapterContext(previousChapters),
    '',
    buildBannedPhrasesContext(bannedPhrases),
    '',
    `Write Chapter ${chapter.chapter_number} now. ~${wordTarget} words. Prose only.`,
  ];

  const userMessage = userParts.filter(Boolean).join('\n');

  return { systemPrompt, userMessage, wordTarget };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN BOT
// ═══════════════════════════════════════════════════════════════════════════════

async function runProseWriter(base44, projectId, chapterId) {
  const startMs = Date.now();
  const ctx = await loadProjectContext(base44, projectId);
  const chCtx = getChapterContext(ctx, chapterId);

  // Determine model
  const isExplicit = chCtx.scenes?.some(s => s.extra_instructions?.includes('[EXPLICIT]'));
  const callType = isExplicit ? 'explicit_scene' : 'sfw_prose';
  const modelKey = resolveModel(callType, ctx.spec);

  console.log(`ProseWriter: Ch ${chCtx.chapter.chapter_number} using ${modelKey} (${callType})`);

  // Build prompt
  const { systemPrompt, userMessage, wordTarget } = buildProsePrompt(ctx, chCtx);

  // Generate prose
  let rawProse;
  let refusalDetected = false;
  try {
    rawProse = await callAI(modelKey, systemPrompt, userMessage, {
      maxTokens: 16384,
      temperature: 0.72,
    });
  } catch (err) {
    console.error(`ProseWriter primary call failed: ${err.message}`);
    throw err;
  }

  // Check for refusal — retry once with fallback model
  if (isRefusal(rawProse)) {
    console.warn(`ProseWriter: Refusal detected from ${modelKey} — retrying with claude-sonnet`);
    refusalDetected = true;
    try {
      rawProse = await callAI('claude-sonnet', systemPrompt, userMessage, {
        maxTokens: 16384,
        temperature: 0.72,
      });
      if (isRefusal(rawProse)) {
        console.error('ProseWriter: Second refusal detected');
      }
    } catch (retryErr) {
      console.error('ProseWriter retry failed:', retryErr.message);
      throw retryErr;
    }
  }

  // Strip meta-response artifacts
  if (rawProse) {
    rawProse = rawProse.replace(/^(Here is|Here's|I've written|Below is)[^\n]*\n+/i, '');
    rawProse = rawProse.replace(/^(Chapter \d+[:\s])/i, '');
    rawProse = rawProse.trim();
  }

  const wordCount = rawProse ? rawProse.trim().split(/\s+/).length : 0;
  console.log(`ProseWriter: Ch ${chCtx.chapter.chapter_number} — ${wordCount} words in ${Math.round((Date.now() - startMs) / 1000)}s`);

  return {
    raw_prose: rawProse,
    word_count: wordCount,
    word_target: wordTarget,
    model_used: modelKey,
    call_type: callType,
    refusal_detected: refusalDetected,
    duration_ms: Date.now() - startMs,
  };
}

// ═══ DENO SERVE ═══

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, chapter_id } = await req.json();
    if (!project_id || !chapter_id) return Response.json({ error: 'project_id and chapter_id required' }, { status: 400 });

    const result = await runProseWriter(base44, project_id, chapter_id);
    return Response.json(result);
  } catch (error) {
    console.error('proseWriter error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});