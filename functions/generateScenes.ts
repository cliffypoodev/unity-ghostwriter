import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const MODEL_MAP = {
  "claude-sonnet":     { provider: "anthropic", modelId: "claude-sonnet-4-20250514", defaultTemp: 0.6 },
  "claude-opus":       { provider: "anthropic", modelId: "claude-opus-4-20250514",   defaultTemp: 0.6 },
  "claude-opus-4-5":   { provider: "anthropic", modelId: "claude-opus-4-5",          defaultTemp: 0.6 },
  "claude-sonnet-4-5": { provider: "anthropic", modelId: "claude-sonnet-4-5",        defaultTemp: 0.6 },
  "claude-haiku-4-5":  { provider: "anthropic", modelId: "claude-haiku-4-5",         defaultTemp: 0.6 },
  "gpt-4o":            { provider: "openai",    modelId: "gpt-4o",                   defaultTemp: 0.6 },
  "gpt-4o-creative":   { provider: "openai",    modelId: "gpt-4o",                   defaultTemp: 0.9 },
  "gpt-4-turbo":       { provider: "openai",    modelId: "gpt-4-turbo",              defaultTemp: 0.6 },
  "gemini-pro":        { provider: "google",    modelId: "gemini-2.0-flash",         defaultTemp: 0.6 },
  "deepseek-chat":     { provider: "deepseek",  modelId: "deepseek-chat",            defaultTemp: 0.6 },
};

async function callAI(modelKey, systemPrompt, userMessage, options = {}) {
  // callType: beat_sheet → scene generation uses spec's model (structural, not prose)
  const config = MODEL_MAP[modelKey] || MODEL_MAP["claude-sonnet"];
  const { provider, modelId, defaultTemp } = config;
  const temperature = options.temperature ?? defaultTemp;
  const maxTokens = options.maxTokens ?? 4096;

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
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + Deno.env.get('DEEPSEEK_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error('DeepSeek error: ' + (data.error?.message || response.status));
    return data.choices[0].message.content;
  }

  throw new Error('Unknown provider: ' + provider);
}

function cleanJSON(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  cleaned = cleaned.replace(/,\s*}/g, '}');
  cleaned = cleaned.replace(/,\s*]/g, ']');
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
    // callType: beat_sheet (JSON repair — uses same model as parent call)
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

async function parseField(field, fieldUrl) {
  try {
    if (!field && fieldUrl) {
      const r = await fetch(fieldUrl);
      return await r.json();
    }
    if (typeof field === 'string' && field.trim()) return JSON.parse(field);
    return null;
  } catch {
    return null;
  }
}

const WORDS_PER_CHAPTER = { short: 1200, medium: 1600, long: 2200, epic: 3000 };

function getSceneCount(targetLength) {
  const base = (targetLength === 'long' || targetLength === 'epic') ? 4 : 3;
  return base + Math.round(Math.random()); // 3-4 for short/medium, 4-5 for long/epic
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId, chapterNumber } = await req.json();
    if (!projectId || chapterNumber == null) {
      return Response.json({ error: 'projectId and chapterNumber required' }, { status: 400 });
    }

    const [chapters, specs, outlines] = await Promise.all([
      base44.entities.Chapter.filter({ project_id: projectId }, "chapter_number"),
      base44.entities.Specification.filter({ project_id: projectId }),
      base44.entities.Outline.filter({ project_id: projectId }),
    ]);

    const spec = specs[0];
    if (spec?.book_type === 'nonfiction') {
      return Response.json({ scenes: null, skipped: true, reason: 'Scenes not used for nonfiction' });
    }

    const chapter = chapters.find(c => c.chapter_number === Number(chapterNumber));
    if (!chapter) return Response.json({ error: `Chapter ${chapterNumber} not found` }, { status: 404 });

    const outline = outlines[0];
    const chapterIndex = chapters.findIndex(c => c.chapter_number === Number(chapterNumber));
    const totalChapters = chapters.length;
    const prevChapter = chapterIndex > 0 ? chapters[chapterIndex - 1] : null;
    const nextChapter = chapterIndex < totalChapters - 1 ? chapters[chapterIndex + 1] : null;

    const [outlineData, storyBible] = await Promise.all([
      parseField(outline?.outline_data, outline?.outline_url),
      parseField(outline?.story_bible, outline?.story_bible_url),
    ]);

    const outlineChapters = outlineData?.chapters || [];
    const outlineEntry = outlineChapters.find(c => (c.number || c.chapter_number) === Number(chapterNumber)) || {};

    const targetLength = spec?.target_length || 'medium';
    const sceneCount = getSceneCount(targetLength);
    const wordsPerChapter = WORDS_PER_CHAPTER[targetLength] || 1600;
    const wordTarget = Math.round(wordsPerChapter / sceneCount);

    // Get previous chapter's last 200 chars for anti-repetition context
    let prevChapterTail = '';
    if (prevChapter?.content) {
      let content = prevChapter.content;
      if (content.startsWith('http')) {
        try { content = await (await fetch(content)).text(); } catch { content = ''; }
      }
      prevChapterTail = content.trim().slice(-200);
    }

    const modelKey = spec?.ai_model || 'claude-sonnet';
    const characters = storyBible?.characters || [];
    const world = storyBible?.world || storyBible?.settings;
    const rules = storyBible?.rules;

    const isErotica = /erotica|erotic/.test(((spec?.genre||'')+ ' '+(spec?.subgenre||'')).toLowerCase());

    const explicitTaggingInstruction = isErotica ? `\n\nIMPORTANT — EXPLICIT SCENE TAGGING:
When a scene requires explicit sexual content, you MUST set the extra_instructions field to begin with "[EXPLICIT]" and end with "[/EXPLICIT]", wrapping the scene's description. All other scenes leave extra_instructions as a normal string or empty.
Example for an explicit scene: "extra_instructions": "[EXPLICIT] The submission scene — Zephyr dominates Marcus physically and sexually. Write this scene completely without cutting away. Stay in the room. Describe specific physical action, desire, and consequence. [/EXPLICIT]"
Example for a standard scene: "extra_instructions": ""
Only tag scenes that require on-page explicit sexual content. Tension, kissing, emotional aftermath = no tag needed.` : '';

    const systemPrompt = `Generate scenes for a fiction chapter. Output ONLY valid JSON array. No explanation.${explicitTaggingInstruction}`;

    const userMessage = `Genre: ${spec?.genre || 'Fiction'}
Subgenre: ${spec?.subgenre || 'Not specified'}
Beat Style: ${spec?.beat_style || spec?.tone_style || 'Not specified'}

STORY BIBLE — Characters:
${characters.length > 0 ? characters.map(c => `- ${c.name} (${c.role || 'character'}): ${c.description || ''}${c.relationships ? ' | Relationships: ' + c.relationships : ''}`).join('\n') : 'Not specified'}

STORY BIBLE — World/Settings:
${world ? (typeof world === 'object' ? JSON.stringify(world, null, 2) : world) : 'Not specified'}

STORY BIBLE — Rules:
${rules ? (typeof rules === 'string' ? rules : JSON.stringify(rules)) : 'Not specified'}

Chapter ${chapterNumber} of ${totalChapters}: "${chapter.title}"
Summary: ${chapter.summary || outlineEntry.summary || 'No summary provided'}
Key Events: ${JSON.stringify(outlineEntry.key_events || outlineEntry.key_beats || [])}
Chapter Prompt: ${chapter.prompt || outlineEntry.scene_prompt || 'No additional prompt'}

${outlineEntry.transition_from ? `Transition FROM previous chapter: ${outlineEntry.transition_from}` : ''}
${nextChapter ? `Next chapter: "${nextChapter.title}"` : 'This is the final chapter — end with resolution'}
${outlineEntry.transition_to ? `Transition TO next chapter: ${outlineEntry.transition_to}` : ''}

${prevChapterTail ? `Previous chapter ended with:\n"...${prevChapterTail}"\n(Start this chapter somewhere different — different location, different emotional beat)` : ''}

Generate exactly ${sceneCount} scenes. Word target per scene: ~${wordTarget} words.

Return ONLY a JSON array of ${sceneCount} scene objects. Each object must have exactly these fields:
{
  "scene_number": number,
  "title": "3-5 word title",
  "location": "Specific location with 1-2 sensory details",
  "time": "Time relative to previous scene (e.g. 'immediately after', 'two hours later', 'next morning')",
  "pov": "Character name whose POV dominates",
  "characters_present": ["Name1", "Name2"],
  "purpose": "What this scene accomplishes for the plot",
  "emotional_arc": "Starting emotion → ending emotion",
  "key_action": "ONE concrete irreversible event that MUST happen in this scene",
  "dialogue_focus": "What the conversation reveals (string), or null if action-focused",
  "sensory_anchor": "One dominant sensory detail to open the scene",
  "extra_instructions": "Optional tone/pacing note, or empty string",
  "word_target": ${wordTarget}
}`;

    const maxTokens = (modelKey === 'deepseek-chat' || modelKey === 'deepseek-reasoner') ? 4000 : 8192;
    // callType: beat_sheet → scene beat generation (structural, not prose)
    const raw = await callAI(modelKey, systemPrompt, userMessage, { maxTokens, temperature: 0.6 });
    const scenes = await safeParseJSON(raw, modelKey);
    if (!Array.isArray(scenes)) throw new Error('AI returned invalid scene structure — expected array');

    // Save to chapter entity
    await base44.entities.Chapter.update(chapter.id, { scenes: JSON.stringify(scenes) });

    console.log(`Generated ${scenes.length} scenes for Chapter ${chapterNumber} (model: ${modelKey})`);
    return Response.json({ scenes, chapterNumber: Number(chapterNumber), chapterId: chapter.id });
  } catch (error) {
    console.error('generateScenes error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});