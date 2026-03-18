// ═══════════════════════════════════════════════════════════════════════════════
// BOT 1 — SCENE ARCHITECT
// ═══════════════════════════════════════════════════════════════════════════════
// Produce a scene-by-scene structural breakdown for ONE chapter.
// Fiction → scene list. Nonfiction → beat sheet. NEVER writes prose.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ═══ INLINED: shared/aiRouter (compact) ═══
const MODEL_MAP = {
  "claude-sonnet": { provider: "anthropic", modelId: "claude-sonnet-4-20250514", defaultTemp: 0.72, maxTokensLimit: null },
  "gpt-4o": { provider: "openai", modelId: "gpt-4o", defaultTemp: 0.4, maxTokensLimit: null },
  "gemini-pro": { provider: "google", modelId: "gemini-2.0-flash", defaultTemp: 0.72, maxTokensLimit: null },
  "deepseek-chat": { provider: "deepseek", modelId: "deepseek-chat", defaultTemp: 0.72, maxTokensLimit: 8192 },
  "trinity": { provider: "openrouter", modelId: "arcee-ai/trinity-large-preview:free", defaultTemp: 0.72, maxTokensLimit: 16384 },
};

async function callAI(modelKey, systemPrompt, userMessage, options = {}) {
  const config = MODEL_MAP[modelKey] || MODEL_MAP["trinity"];
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
    const d = await r.json(); if (!r.ok) throw new Error('Google: ' + (d.error?.message || r.status)); return d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  if (provider === "deepseek") {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + Deno.env.get('DEEPSEEK_API_KEY'), 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelId, max_tokens: Math.min(maxTokens, 8192), temperature, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }) });
    const d = await r.json(); if (!r.ok) throw new Error('DeepSeek: ' + (d.error?.message || r.status)); return d.choices[0].message.content;
  }
  if (provider === "openrouter") {
    const orKey = Deno.env.get('OPENROUTER_API_KEY');
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + orKey, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://unity-ghostwriter.base44.app', 'X-Title': 'Unity Ghostwriter' }, body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }) });
    const d = await r.json(); if (!r.ok) throw new Error('OpenRouter: ' + (d.error?.message || r.status)); return d.choices[0].message.content;
  }
  throw new Error('Unknown provider: ' + provider);
}

async function safeParseJSON(raw) {
  if (!raw) throw new Error('Empty AI response');
  let cleaned = raw.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
  const jsonStart = cleaned.indexOf('[') !== -1 && (cleaned.indexOf('{') === -1 || cleaned.indexOf('[') < cleaned.indexOf('{')) ? cleaned.indexOf('[') : cleaned.indexOf('{');
  if (jsonStart > 0) cleaned = cleaned.slice(jsonStart);
  const jsonEnd = cleaned.lastIndexOf(']') !== -1 && cleaned.lastIndexOf(']') > cleaned.lastIndexOf('}') ? cleaned.lastIndexOf(']') + 1 : cleaned.lastIndexOf('}') + 1;
  if (jsonEnd > 0) cleaned = cleaned.slice(0, jsonEnd);
  return JSON.parse(cleaned);
}

// ═══ INLINED: shared/resolveModel ═══
const HARDCODED_ROUTES = { outline:'gemini-pro', beat_sheet:'gemini-pro', consistency_check:'trinity', style_rewrite:'trinity', chapter_state:'trinity' };
function resolveModel(callType, spec) {
  if (HARDCODED_ROUTES[callType]) return HARDCODED_ROUTES[callType];
  if (callType === 'sfw_prose') return spec?.writing_model || spec?.ai_model || 'trinity';
  return 'trinity';
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
  let chapters = [], specs = [], outlines = [], projects = [];
  [chapters, specs, outlines, projects] = await Promise.all([
    base44.entities.Chapter.filter({ project_id: projectId }),
    base44.entities.Specification.filter({ project_id: projectId }),
    base44.entities.Outline.filter({ project_id: projectId }),
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
  return { project, chapters, spec, outline, outlineData, storyBible, totalChapters: chapters.length, isNonfiction: spec?.book_type === 'nonfiction', isErotica: /erotica|erotic/.test(((spec?.genre || '') + ' ' + (spec?.subgenre || '')).toLowerCase()) };
}

// ═══ GENERAL INSTRUCTION SANITIZER (FICTION + NF) ═══
const GENERAL_SANITIZE_RX = [
  /^(Begin with|Show the|Continue from|Start with|Open with|Transition to|Transition from|Describe how|Establish the|Adjust the|Rewrite to|Address the|Include a|Ensure that|Note that|End with) [^.!?\n]*([.!?\n]|$)/gim,
  /\b(I'll|I will) (now |)(write|continue|complete|finish) (this |the |)(chapter|scene|section)[^.!?\n]*([.!?\n]|$)/gi,
  /\[NOTE TO (AUTHOR|EDITOR|AI|SELF)\][^.!?\n]*([.!?\n]|$)/gi,
  /\[TODO[:\s][^\]]*\]/gi,
  /\bas (instructed|requested|specified) (in|by) the (prompt|system|user|outline|beat)[^.!?\n]*([.!?\n]|$)/gi,
  /\bper the (outline|beat sheet|specification|chapter prompt)[^.!?\n]*([.!?\n]|$)/gi,
  /\b(Adjust|Rewrite|Address|Revise) the (year|name|time|date|setting|location|chapter|scene|timeline) to (be |match |reflect |align )[^.!?\n]*([.!?\n]|$)/gi,
  /\bEnsure (this|the|that) (aligns|matches|is consistent) with[^.!?\n]*([.!?\n]|$)/gi,
];

// ═══ NF EDITORIAL INSTRUCTION SANITIZER (NF-SPECIFIC PATTERNS) ═══
const NF_SANITIZE_RX = [
  /\b(Remove|Replace|Either identify|Either cite|Either name|Either source|Either provide|Either use|Frame as|Use general|Provide documentary|Provide specific|Provide real|Label as|Anchor to|Anchor these|Source to|Source this|Cite specific|Cite actual|Use documented|Remove invented|Remove fictional|Remove specific|Remove atmospheric|Verify and cite|Insert documented)\b[^.!?\n]*([.!?\n]|$)/gi,
  /\bUse '([^']+)' or [^.!?\n]*([.!?\n]|$)/gi,
  /\bor (clearly |)label as[^.!?\n]*([.!?\n]|$)/gi,
  /\bor (remove|begin with|provide|cite|frame|preface)[^.!?\n]*(fictional|specific|actual|documented|general|representative|composite|atmospheric|reconstructed|hypothetical)[^.!?\n]*([.!?\n]|$)/gi,
  /^(Remove|Replace|Provide|Either|Verify|Insert|Label|Anchor|Source|Frame|Cite)\b[^.!?\n]*(documentary|documented|specific|source|archive|reconstruct|composite|fictional|atmospheric|hypothetical)[^.!?\n]*([.!?\n]|$)/gim,
  /\bContemporary accounts (describe|suggest) similar [^.!?\n]*([.!?\n]|$)/gi,
  /\b(Use general|Remove specific|Either provide|Either cite|Either identify|Either name|Either source|Either use|Frame as|Provide documentary|Provide specific|Provide real|Label as|Anchor to|Source to|Cite specific|Cite actual|Use documented|Remove atmospheric|Remove fictional|Remove invented|Verify and cite|Insert documented)\b[^.!?\n]*?,\s*(?=[a-z])/gi,
  /\b(Remove specific|Use general|Either provide|Either cite|Either use) \w+(\s\w+)? or (cite|provide|use|anchor|source|reference) \w/gi,
];
function sanitizeNFPrompt(text) {
  if (!text) return text;
  if (typeof text !== 'string') { try { return JSON.stringify(text); } catch { return String(text); } }
  let c = text;
  for (const rx of GENERAL_SANITIZE_RX) c = c.replace(rx, '');
  for (const rx of NF_SANITIZE_RX) c = c.replace(rx, '');
  return c.replace(/\n{3,}/g, '\n\n').replace(/\s{2,}/g, ' ').trim();
}

// Recursively sanitize all string values in any data structure (runs BOTH general + NF patterns)
function sanitizeNFData(data) {
  if (!data) return data;
  if (typeof data === 'string') return sanitizeNFPrompt(data);
  if (Array.isArray(data)) return data.map(item => sanitizeNFData(item));
  if (typeof data === 'object') {
    const cleaned = {};
    for (const [k, v] of Object.entries(data)) cleaned[k] = sanitizeNFData(v);
    return cleaned;
  }
  return data;
}

function getChapterContext(ctx, chapterId) {
  const chapter = ctx.chapters.find(c => c.id === chapterId);
  if (!chapter) throw new Error('Chapter not found: ' + chapterId);
  const chapterIndex = ctx.chapters.findIndex(c => c.id === chapterId);
  const prevChapter = chapterIndex > 0 ? ctx.chapters[chapterIndex - 1] : null;
  const nextChapter = chapterIndex < ctx.chapters.length - 1 ? ctx.chapters[chapterIndex + 1] : null;
  const outlineChapters = ctx.outlineData?.chapters || [];
  const outlineEntry = outlineChapters.find(c => (c.number || c.chapter_number) === chapter.chapter_number) || {};
  return { chapter, chapterIndex, prevChapter, nextChapter, outlineEntry };
}

// ═══ CONSTANTS ═══

const WORDS_PER_CHAPTER = { short: 1200, medium: 1600, long: 2200, epic: 3000 };
function getSceneCount(targetLength) { return ((targetLength === 'long' || targetLength === 'epic') ? 4 : 3) + Math.round(Math.random()); }

const BEAT_NAMES = {"fast-paced-thriller":"Fast-Paced Thriller","gritty-cinematic":"Gritty Cinematic","hollywood-blockbuster":"Hollywood Blockbuster","slow-burn":"Slow Burn","steamy-romance":"Steamy Romance","slow-burn-romance":"Slow Burn Romance","dark-erotica":"Dark Erotica","clean-romance":"Clean Romance","faith-infused":"Faith-Infused Contemporary","investigative-nonfiction":"Investigative Nonfiction","reference-educational":"Reference / Educational","intellectual-psychological":"Intellectual Psychological","dark-suspense":"Dark Suspense","satirical":"Satirical","epic-historical":"Epic Historical","whimsical-cozy":"Whimsical Cozy","hard-boiled-noir":"Hard-Boiled Noir","grandiose-space-opera":"Grandiose Space Opera","visceral-horror":"Visceral Horror","poetic-magical-realism":"Poetic Magical Realism","clinical-procedural":"Clinical Procedural","hyper-stylized-action":"Hyper-Stylized Action","nostalgic-coming-of-age":"Nostalgic Coming-of-Age","cerebral-sci-fi":"Cerebral Sci-Fi","high-stakes-political":"High-Stakes Political","surrealist-avant-garde":"Surrealist Avant-Garde","melancholic-literary":"Melancholic Literary","urban-gritty-fantasy":"Urban Gritty Fantasy"};
const SPICE_NAMES = { 0:'Fade to Black', 1:'Closed Door', 2:'Cracked Door', 3:'Open Door', 4:'Full Intensity' };
const LANG_NAMES = { 0:'Clean', 1:'Mild', 2:'Moderate', 3:'Strong', 4:'Raw' };

function buildContextHeader(spec) {
  const bs = spec?.beat_style || spec?.tone_style || '';
  const bn = BEAT_NAMES[bs] || bs || 'Not specified';
  const sp = parseInt(spec?.spice_level) || 0;
  const li = parseInt(spec?.language_intensity) || 0;
  return `═══ PROJECT CONTEXT ═══\nTYPE: ${(spec?.book_type || 'fiction').toUpperCase()} | GENRE: ${spec?.genre || 'Fiction'}${spec?.subgenre ? ' / ' + spec.subgenre : ''} | BEAT: ${bn} | LANG: ${li}/4 ${LANG_NAMES[li] || 'Clean'}${sp > 0 ? ' | SPICE: ' + sp + '/4 ' + SPICE_NAMES[sp] : ''}\n═══════════════════════`;
}

// ═══ FICTION SCENE GENERATION ═══

async function generateFictionScenes(ctx, chCtx) {
  const { spec, storyBible } = ctx;
  const { chapter, prevChapter, nextChapter, outlineEntry } = chCtx;
  const totalChapters = ctx.totalChapters;
  const targetLength = spec?.target_length || 'medium';
  const sceneCount = getSceneCount(targetLength);
  const wordsPerChapter = WORDS_PER_CHAPTER[targetLength] || 1600;
  const wordTarget = Math.round(wordsPerChapter / sceneCount);

  let prevChapterTail = '';
  if (prevChapter?.content) {
    const content = await resolveContent(prevChapter.content);
    prevChapterTail = content.trim().slice(-200);
  }

  const characters = storyBible?.characters || [];
  const world = storyBible?.world || storyBible?.settings;
  const rules = storyBible?.rules;
  const isErotica = ctx.isErotica;

  const explicitTagging = isErotica ? `\n\nIMPORTANT — EXPLICIT SCENE TAGGING:\nWhen a scene requires explicit sexual content, set extra_instructions to begin with "[EXPLICIT]" and end with "[/EXPLICIT]".\nOnly tag scenes needing on-page explicit content.` : '';

  const contextHeader = buildContextHeader(spec);
  const modelKey = resolveModel('beat_sheet', spec);

  const systemPrompt = `Generate scenes for a fiction chapter. Output ONLY valid JSON array. No explanation.\n\n${contextHeader}${explicitTagging}`;

  const userMessage = `Genre: ${spec?.genre || 'Fiction'}
Subgenre: ${spec?.subgenre || 'Not specified'}
Beat Style: ${spec?.beat_style || spec?.tone_style || 'Not specified'}
Spice Level: ${parseInt(spec?.spice_level) || 0}/4 — ${SPICE_NAMES[parseInt(spec?.spice_level) || 0] || 'Fade to Black'}
Language Intensity: ${parseInt(spec?.language_intensity) || 0}/4 — ${LANG_NAMES[parseInt(spec?.language_intensity) || 0] || 'Clean'}

STORY BIBLE — Characters:
${characters.length > 0 ? characters.map(c => `- ${c.name} (${c.role || 'character'}): ${c.description || ''}${c.relationships ? ' | Relationships: ' + c.relationships : ''}`).join('\n') : 'Not specified'}

STORY BIBLE — World/Settings:
${world ? (typeof world === 'object' ? JSON.stringify(world, null, 2) : world) : 'Not specified'}

STORY BIBLE — Rules:
${rules ? (typeof rules === 'string' ? rules : JSON.stringify(rules)) : 'Not specified'}

Chapter ${chapter.chapter_number} of ${totalChapters}: "${chapter.title}"
Summary: ${chapter.summary || outlineEntry.summary || 'No summary provided'}
Key Events: ${JSON.stringify(outlineEntry.key_events || outlineEntry.key_beats || [])}
Chapter Prompt: ${chapter.prompt || outlineEntry.scene_prompt || 'No additional prompt'}

${outlineEntry.transition_from ? `Transition FROM previous chapter: ${outlineEntry.transition_from}` : ''}
${nextChapter ? `Next chapter: "${nextChapter.title}"` : 'This is the final chapter — end with resolution'}
${outlineEntry.transition_to ? `Transition TO next chapter: ${outlineEntry.transition_to}` : ''}

${prevChapterTail ? `Previous chapter ended with:\n"...${prevChapterTail}"\n(Start somewhere different — different location, different emotional beat)` : ''}

Generate exactly ${sceneCount} scenes. Word target per scene: ~${wordTarget} words.

SCENE STRUCTURE RULES:
- FROZEN PROTAGONIST BAN: No more than ONE chapter per manuscript may end with the protagonist unable to speak, respond, or decide. If the previous chapter ended with the protagonist frozen in silence or paralyzed by indecision, this chapter's final scene MUST show an active choice — a spoken word, a physical action, a decisive movement.
- OPENING DIVERSITY: If the previous chapter opened with a scent/smell/aroma description, this chapter MUST open with a different sense or with action/dialogue. No two consecutive chapters may open the same way.
- SCENE TYPE DIVERSITY: The climactic scene of this chapter should differ structurally from the previous chapter's climax. Vary between: protagonist yields, protagonist initiates, power dynamic reverses, external interruption, genuine conflict between characters, or mundane shared activity.
${totalChapters <= 2 ? `
- SHORT-FORM COMPLETE ARC (MANDATORY — ${totalChapters} chapter project):
  This is a SHORT-FORM story with only ${totalChapters} chapter(s). The story MUST be COMPLETE within this chapter count.
  * This chapter MUST contain the FULL ARC: setup, escalation, climax, resolution/aftermath.
  * Do NOT end on a cliffhanger, unresolved tension, or "to be continued" beat.
  * Do NOT spend the entire chapter on buildup/foreplay without delivering the climactic scene.
  * The CLIMACTIC ACTION (the main event the premise promises) MUST happen ON-PAGE within this chapter.
  * Minimum 40% of the word count should be dedicated to the climactic scene and its immediate aftermath.
  * If Spice Level >= 3 and the premise involves intimacy: the explicit scene MUST occur within this chapter — not as a future promise, not as a cliffhanger, not summarized. ON THE PAGE.
  * Structure: First 25% = setup/tension. Middle 50% = escalation + climactic scene. Final 25% = aftermath/resolution.` : ''}

Return ONLY a JSON array of ${sceneCount} scene objects:
{
  "scene_number": number,
  "title": "3-5 word title",
  "location": "Specific location with 1-2 sensory details",
  "time": "Time relative to previous scene",
  "pov": "Character name whose POV dominates",
  "characters_present": ["Name1", "Name2"],
  "purpose": "What this scene accomplishes for the plot",
  "emotional_arc": "Starting emotion → ending emotion",
  "key_action": "ONE concrete irreversible event",
  "dialogue_focus": "What conversation reveals, or null",
  "sensory_anchor": "One dominant sensory detail to open the scene",
  "extra_instructions": "Optional tone/pacing note, or empty string",
  "word_target": ${wordTarget}
}`;

  let raw;
  try {
    raw = await callAI(modelKey, systemPrompt, userMessage, { maxTokens: 8192, temperature: 0.6 });
  } catch (primaryErr) {
    console.warn(`Primary model (${modelKey}) failed: ${primaryErr.message} — retrying with trinity`);
    raw = await callAI('trinity', systemPrompt, userMessage, { maxTokens: 8192, temperature: 0.6 });
  }

  const scenes = await safeParseJSON(raw);
  if (!Array.isArray(scenes)) throw new Error('AI returned invalid scene structure — expected array');
  return { scenes, type: 'fiction' };
}

// ═══ NONFICTION BEAT SHEET ═══

async function generateNonfictionBeatSheet(ctx, chCtx) {
  const { spec } = ctx;
  const { chapter, outlineEntry, prevChapter, nextChapter } = chCtx;
  const totalChapters = ctx.totalChapters;
  const targetWords = spec?.target_length === 'epic' ? 4500 : spec?.target_length === 'long' ? 3500 : 2500;
  const modelKey = resolveModel('beat_sheet', spec);
  const contextHeader = buildContextHeader(spec);

  // Build full outline summary for NEW_GROUND cross-reference
  const outlineChapters = ctx.outlineData?.chapters || [];
  const outlineSummaryLines = outlineChapters.map(oc => {
    const num = oc.number || oc.chapter_number;
    return `Ch ${num}: "${oc.title || 'Untitled'}" — ${(oc.summary || '').slice(0, 150)}`;
  }).join('\n');

  const systemPrompt = `You are a nonfiction book architect. Generate a structural beat sheet for one chapter. Output ONLY valid JSON. No explanation.\n\n${contextHeader}\n\nThis is NONFICTION. No fictional scenes or invented characters.\n\nCRITICAL NF RULES:\n- Do NOT set every chapter's opening_framing to "archive_narrator" (author examining documents). This framing may be used AT MOST 3 times in a 20-chapter book.\n- ROTATE opening framings: reconstructed_scene, key_quote, startling_fact, present_day_consequence, in_media_res, rhetorical_question.\n- Do NOT set every chapter's closing to "archive_reflection" (author closing folder, making coffee). ROTATE endings: unresolved_question, resonant_detail, source_quote, next_chapter_bridge.\n- Do NOT include editorial instructions in any field. No "Remove specific time" or "Anchor to source" — those are instructions for the OUTLINE, not the beat sheet.\n- The section mode "vignette" means a documented scene reconstruction, NOT a fictional scene. It must be labeled as reconstruction.`;

  const userMessage = `Book: "${ctx.project.name || 'Untitled'}"
Genre: ${spec?.genre || 'Nonfiction'} / ${spec?.subgenre || ''}

FULL OUTLINE (for cross-reference — identify what is covered ELSEWHERE):
${outlineSummaryLines}

Chapter ${chapter.chapter_number} of ${totalChapters}: "${chapter.title}"
Summary: ${sanitizeNFPrompt(chapter.summary || outlineEntry.summary || 'No summary')}
Prompt: ${sanitizeNFPrompt(chapter.prompt || outlineEntry.scene_prompt || '')}
${prevChapter ? `Previous chapter: Ch ${prevChapter.chapter_number}: "${prevChapter.title}" — ${(prevChapter.summary || '').slice(0, 200)}` : 'THIS IS THE FIRST CHAPTER.'}
${nextChapter ? `Next chapter: Ch ${nextChapter.chapter_number}: "${nextChapter.title}" — ${(nextChapter.summary || '').slice(0, 200)}` : 'THIS IS THE FINAL CHAPTER.'}
${prevChapter?.beat_data?.opening_framing ? `PREVIOUS CHAPTER OPENED WITH: ${prevChapter.beat_data.opening_framing} — THIS chapter MUST use a DIFFERENT opening framing.` : ''}
${prevChapter?.beat_data?.closing_type ? `PREVIOUS CHAPTER CLOSED WITH: ${prevChapter.beat_data.closing_type} — THIS chapter MUST use a DIFFERENT closing type.` : ''}

Target: ~${targetWords} words

Return JSON with this structure:
{
  "beat_name": "Chapter structural beat name",
  "beat_function": "SETUP|DISRUPTION|ESCALATION|CLIMAX|RESOLUTION|CONNECTIVE_TISSUE",
  "beat_scene_type": "exposition|case_study|analysis|how_to|mixed",
  "beat_tempo": "fast|medium|slow",
  "opening_framing": "reconstructed_scene|key_quote|startling_fact|present_day_consequence|in_media_res|rhetorical_question|archive_narrator",
  "closing_type": "unresolved_question|resonant_detail|source_quote|next_chapter_bridge|archive_reflection",
  "chapter_structure": "chronological|thematic|case_study_deep_dive|comparative|investigation_trail",
  "argument_progression": {
    "prior_chapter_endpoint": "What the previous chapter established. For Ch 1, state the book's starting premise.",
    "this_chapter_advances": "The specific NEW claim or evidence this chapter adds.",
    "new_ground": "Material covered here that appears NOWHERE else in the outline. Name specific people, events, documents, or analysis unique to this chapter.",
    "handoff": "What this chapter sets up for the next chapter."
  },
  "sections": [
    {
      "section_number": 1,
      "title": "Section title",
      "mode": "vignette|analysis|case_study|how_to|exposition",
      "content_focus": "What this section covers",
      "key_evidence": "Real research, stats, or examples to include — DO NOT fabricate specific file names, dates, or quotes",
      "word_target": ${Math.round(targetWords / 4)},
      "fabrication_warnings": ["Any claims needing verification"]
    }
  ],
  "word_target": ${targetWords}
}

CRITICAL VALIDATION: 
1. The "new_ground" field must identify material NOT covered in any other chapter listed in the outline above. If you cannot identify distinct new ground, set "new_ground" to "[RESTRUCTURE NEEDED: overlaps with Ch X]".
2. The "opening_framing" MUST differ from the previous chapter's opening_framing.
3. The "closing_type" MUST differ from the previous chapter's closing_type.
4. Do NOT include editorial instructions like "Remove specific..." or "Anchor to..." in any field.`;

  let raw;
  try {
    raw = await callAI(modelKey, systemPrompt, userMessage, { maxTokens: 4096, temperature: 0.6 });
  } catch (primaryErr) {
    console.warn(`NF beat primary failed: ${primaryErr.message} — retrying with trinity`);
    raw = await callAI('trinity', systemPrompt, userMessage, { maxTokens: 4096, temperature: 0.6 });
  }

  const beatSheet = await safeParseJSON(raw);
  return { scenes: beatSheet, type: 'nonfiction' };
}

// ═══ MAIN BOT ═══

async function runSceneArchitect(base44, projectId, chapterId) {
  const ctx = await loadProjectContext(base44, projectId);

  // Ensure the target chapter is in the loaded context — bulk loads can drop chapters
  // with large content fields, so fetch it individually and merge if missing
  if (!ctx.chapters.find(c => c.id === chapterId)) {
    const [targetChapter] = await base44.entities.Chapter.filter({ id: chapterId });
    if (!targetChapter) throw new Error('Chapter not found: ' + chapterId);
    ctx.chapters.push(targetChapter);
    ctx.chapters.sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
  }

  const chCtx = getChapterContext(ctx, chapterId);

  let result;
  if (ctx.isNonfiction) {
    result = await generateNonfictionBeatSheet(ctx, chCtx);
  } else {
    result = await generateFictionScenes(ctx, chCtx);
  }

  // Save scenes to chapter — sanitize output for BOTH genres to kill instructions at the source
  const scenesToSave = sanitizeNFData(result.scenes);
  await base44.entities.Chapter.update(chapterId, {
    scenes: JSON.stringify(scenesToSave),
  });

  return { success: true, chapter_id: chapterId, scene_count: Array.isArray(result.scenes) ? result.scenes.length : 1, type: result.type };
}

// ═══ DENO SERVE ═══

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, chapter_id } = await req.json();
    if (!project_id || !chapter_id) return Response.json({ error: 'project_id and chapter_id required' }, { status: 400 });

    const result = await runSceneArchitect(base44, project_id, chapter_id);
    return Response.json(result);
  } catch (error) {
    console.error('sceneArchitect error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});