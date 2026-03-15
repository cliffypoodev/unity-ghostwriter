// ═══════════════════════════════════════════════════════════════════════════════
// BOT 1 — SCENE ARCHITECT
// ═══════════════════════════════════════════════════════════════════════════════
// One job: Produce a scene-by-scene structural breakdown for ONE chapter.
// Fiction → scene list. Nonfiction → beat sheet.
// NEVER writes prose. Structure only.
//
// Replaces: generateScenes.ts (entire file), beatSheetEngine.ts (partial)
// ═══════════════════════════════════════════════════════════════════════════════

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { callAI, safeParseJSON } from '../shared/aiRouter.ts';
import { resolveModel } from '../shared/resolveModel.ts';
import { loadProjectContext, getChapterContext, resolveContent } from '../shared/dataLoader.ts';

// ── CONSTANTS ───────────────────────────────────────────────────────────────

const WORDS_PER_CHAPTER = { short: 1200, medium: 1600, long: 2200, epic: 3000 };

function getSceneCount(targetLength) {
  const base = (targetLength === 'long' || targetLength === 'epic') ? 4 : 3;
  return base + Math.round(Math.random());
}

const BEAT_NAMES = {
  "fast-paced-thriller":"Fast-Paced Thriller","gritty-cinematic":"Gritty Cinematic","hollywood-blockbuster":"Hollywood Blockbuster","slow-burn":"Slow Burn","steamy-romance":"Steamy Romance","slow-burn-romance":"Slow Burn Romance","dark-erotica":"Dark Erotica","clean-romance":"Clean Romance","faith-infused":"Faith-Infused Contemporary","investigative-nonfiction":"Investigative Nonfiction","reference-educational":"Reference / Educational","intellectual-psychological":"Intellectual Psychological","dark-suspense":"Dark Suspense","satirical":"Satirical","epic-historical":"Epic Historical","whimsical-cozy":"Whimsical Cozy","hard-boiled-noir":"Hard-Boiled Noir","grandiose-space-opera":"Grandiose Space Opera","visceral-horror":"Visceral Horror","poetic-magical-realism":"Poetic Magical Realism","clinical-procedural":"Clinical Procedural","hyper-stylized-action":"Hyper-Stylized Action","nostalgic-coming-of-age":"Nostalgic Coming-of-Age","cerebral-sci-fi":"Cerebral Sci-Fi","high-stakes-political":"High-Stakes Political","surrealist-avant-garde":"Surrealist Avant-Garde","melancholic-literary":"Melancholic Literary","urban-gritty-fantasy":"Urban Gritty Fantasy",
};

const SPICE_NAMES = { 0:'Fade to Black', 1:'Closed Door', 2:'Cracked Door', 3:'Open Door', 4:'Full Intensity' };
const LANG_NAMES = { 0:'Clean', 1:'Mild', 2:'Moderate', 3:'Strong', 4:'Raw' };

function buildContextHeader(spec) {
  const bs = spec?.beat_style || spec?.tone_style || '';
  const bn = BEAT_NAMES[bs] || bs || 'Not specified';
  const sp = parseInt(spec?.spice_level) || 0;
  const li = parseInt(spec?.language_intensity) || 0;
  return `═══ PROJECT CONTEXT ═══\nTYPE: ${(spec?.book_type || 'fiction').toUpperCase()} | GENRE: ${spec?.genre || 'Fiction'}${spec?.subgenre ? ' / ' + spec.subgenre : ''} | BEAT: ${bn} | LANG: ${li}/4 ${LANG_NAMES[li] || 'Clean'}${sp > 0 ? ' | SPICE: ' + sp + '/4 ' + SPICE_NAMES[sp] : ''}\n═══════════════════════`;
}

// ── FICTION SCENE GENERATION ────────────────────────────────────────────────

async function generateFictionScenes(ctx, chCtx) {
  const { spec, storyBible } = ctx;
  const { chapter, chapterIndex, prevChapter, nextChapter, outlineEntry } = chCtx;
  const totalChapters = ctx.totalChapters;

  const targetLength = spec?.target_length || 'medium';
  const sceneCount = getSceneCount(targetLength);
  const wordsPerChapter = WORDS_PER_CHAPTER[targetLength] || 1600;
  const wordTarget = Math.round(wordsPerChapter / sceneCount);

  // Previous chapter tail for anti-repetition
  let prevChapterTail = '';
  if (prevChapter?.content) {
    let content = await resolveContent(prevChapter.content);
    prevChapterTail = content.trim().slice(-200);
  }

  const characters = storyBible?.characters || [];
  const world = storyBible?.world || storyBible?.settings;
  const rules = storyBible?.rules;
  const isErotica = ctx.isErotica;

  const explicitTagging = isErotica ? `\n\nIMPORTANT — EXPLICIT SCENE TAGGING:\nWhen a scene requires explicit sexual content, set extra_instructions to begin with "[EXPLICIT]" and end with "[/EXPLICIT]".\nExample: "extra_instructions": "[EXPLICIT] The submission scene — write completely without cutting away. [/EXPLICIT]"\nOnly tag scenes needing on-page explicit content.` : '';

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
    console.warn(`Primary model (${modelKey}) failed: ${primaryErr.message} — retrying with claude-sonnet`);
    raw = await callAI('claude-sonnet', systemPrompt, userMessage, { maxTokens: 8192, temperature: 0.6 });
  }

  const scenes = await safeParseJSON(raw, modelKey);
  if (!Array.isArray(scenes)) throw new Error('AI returned invalid scene structure — expected array');

  return { scenes, type: 'fiction' };
}

// ── NONFICTION BEAT SHEET GENERATION ────────────────────────────────────────

async function generateNonfictionBeatSheet(ctx, chCtx) {
  const { spec, storyBible, outlineData } = ctx;
  const { chapter, outlineEntry, prevChapter, nextChapter } = chCtx;
  const totalChapters = ctx.totalChapters;

  const targetWords = spec?.target_length === 'epic' ? 4500 : spec?.target_length === 'long' ? 3500 : 2500;
  const modelKey = resolveModel('beat_sheet', spec);

  const contextHeader = buildContextHeader(spec);
  const systemPrompt = `You are a nonfiction book architect. Generate a structural beat sheet for one chapter. Output ONLY valid JSON. No explanation.\n\n${contextHeader}\n\nThis is NONFICTION. No fictional scenes or invented characters. Structure around evidence, argument, and analysis.`;

  const userMessage = `Book: "${ctx.project.name || 'Untitled'}"
Genre: ${spec?.genre || 'Nonfiction'} / ${spec?.subgenre || ''}
Chapter ${chapter.chapter_number} of ${totalChapters}: "${chapter.title}"
Summary: ${chapter.summary || outlineEntry.summary || 'No summary'}
Prompt: ${chapter.prompt || outlineEntry.scene_prompt || ''}
${prevChapter ? `Previous chapter: "${prevChapter.title}"` : ''}
${nextChapter ? `Next chapter: "${nextChapter.title}"` : 'This is the final chapter.'}

Target: ~${targetWords} words

Return JSON with this structure:
{
  "beat_name": "Chapter structural beat name",
  "beat_function": "SETUP|DISRUPTION|ESCALATION|CLIMAX|RESOLUTION|CONNECTIVE_TISSUE",
  "beat_scene_type": "exposition|case_study|analysis|how_to|mixed",
  "beat_tempo": "fast|medium|slow",
  "sections": [
    {
      "section_number": 1,
      "title": "Section title",
      "mode": "vignette|analysis|case_study|how_to|exposition",
      "content_focus": "What this section covers",
      "key_evidence": "Real research, stats, or examples to include",
      "word_target": ${Math.round(targetWords / 4)},
      "fabrication_warnings": ["Any claims needing verification"]
    }
  ],
  "word_target": ${targetWords}
}`;

  let raw;
  try {
    raw = await callAI(modelKey, systemPrompt, userMessage, { maxTokens: 4096, temperature: 0.6 });
  } catch (primaryErr) {
    console.warn(`NF beat primary failed: ${primaryErr.message} — retrying with claude-sonnet`);
    raw = await callAI('claude-sonnet', systemPrompt, userMessage, { maxTokens: 4096, temperature: 0.6 });
  }

  const beatSheet = await safeParseJSON(raw, modelKey);
  return { scenes: beatSheet, type: 'nonfiction' };
}

// ── DENO SERVE ENDPOINT ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, chapter_id } = await req.json();
    if (!project_id || !chapter_id) {
      return Response.json({ error: 'project_id and chapter_id required' }, { status: 400 });
    }

    const ctx = await loadProjectContext(base44, project_id);
    const chCtx = getChapterContext(ctx, chapter_id);

    let result;
    if (ctx.isNonfiction) {
      result = await generateNonfictionBeatSheet(ctx, chCtx);
    } else {
      result = await generateFictionScenes(ctx, chCtx);
    }

    // Save to chapter
    await base44.entities.Chapter.update(chapter_id, {
      scenes: JSON.stringify(result.scenes),
    });

    return Response.json({
      success: true,
      scenes: result.scenes,
      type: result.type,
      chapter_number: chCtx.chapter.chapter_number,
      chapter_id: chapter_id,
    });

  } catch (error) {
    console.error('sceneArchitect error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
