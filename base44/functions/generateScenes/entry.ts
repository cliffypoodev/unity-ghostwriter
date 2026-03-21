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
  "gemini-pro":        { provider: "google",    modelId: "gemini-2.5-flash", defaultTemp: 0.6 },
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
    const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not configured');
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + modelId + ':generateContent?key=' + apiKey,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: userMessage }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { temperature, maxOutputTokens: maxTokens } }) }
    );
    const data = await response.json();
    if (!response.ok) {
      console.error('Google AI error response:', JSON.stringify(data));
      throw new Error('Google AI error: ' + (data.error?.message || `HTTP ${response.status}`));
    }
    if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('Google AI empty response:', JSON.stringify(data));
      throw new Error('Google AI returned empty response — possible safety filter or quota issue');
    }
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

function repairJSON(str) {
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escaped) { result += ch; escaped = false; continue; }
    if (ch === '\\') { escaped = true; result += ch; continue; }
    if (ch === '"') {
      if (!inString) { inString = true; result += ch; continue; }
      let j = i + 1;
      while (j < str.length && (str[j] === ' ' || str[j] === '\t' || str[j] === '\r' || str[j] === '\n')) j++;
      const next = str[j] || '';
      if (next === ':' || next === ',' || next === '}' || next === ']' || next === '') {
        inString = false; result += ch;
      } else { result += '\\"'; }
      continue;
    }
    if (inString) {
      if (ch === '\n') { result += '\\n'; continue; }
      if (ch === '\r') { result += '\\r'; continue; }
      if (ch === '\t') { result += '\\t'; continue; }
      const code = ch.charCodeAt(0);
      if (code < 32) { result += '\\u' + code.toString(16).padStart(4, '0'); continue; }
    }
    result += ch;
  }
  result = result.replace(/,\s*([}\]])/g, '$1');
  return result;
}

function robustParseJSON(raw) {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```[\w]*\n?/, '').replace(/\n?```\s*$/, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  try { return JSON.parse(repairJSON(cleaned)); } catch {}
  const objStart = cleaned.indexOf('{'), objEnd = cleaned.lastIndexOf('}');
  const arrStart = cleaned.indexOf('['), arrEnd = cleaned.lastIndexOf(']');
  const candidates = [];
  if (objStart !== -1 && objEnd > objStart) candidates.push(cleaned.slice(objStart, objEnd + 1));
  if (arrStart !== -1 && arrEnd > arrStart) candidates.push(cleaned.slice(arrStart, arrEnd + 1));
  for (const c of candidates) {
    try { return JSON.parse(c); } catch {}
    try { return JSON.parse(repairJSON(c)); } catch {}
  }
  let truncated = cleaned;
  const quoteCount = (truncated.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) truncated += '"';
  truncated = truncated.replace(/,\s*$/, '');
  const openBrackets = (truncated.match(/\[/g) || []).length - (truncated.match(/]/g) || []).length;
  const openBraces = (truncated.match(/{/g) || []).length - (truncated.match(/}/g) || []).length;
  for (let i = 0; i < openBrackets; i++) truncated += ']';
  for (let i = 0; i < openBraces; i++) truncated += '}';
  try { return JSON.parse(truncated); } catch {}
  try { return JSON.parse(repairJSON(truncated)); } catch {}
  throw new Error('Failed to parse JSON from AI response');
}

async function safeParseJSON(text, modelKey) {
  try {
    return robustParseJSON(text);
  } catch (e1) {
    console.warn('safeParseJSON robustParse failed:', e1.message, '— attempting AI repair...');
  }
  try {
    const repaired = await callAI(
      modelKey,
      'You are a JSON repair tool. Return ONLY valid JSON. No explanation, no markdown.',
      `Fix this malformed JSON and return only the corrected JSON:\n\n${text}`,
      { maxTokens: 4000, temperature: 0.0 }
    );
    return robustParseJSON(repaired);
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

const WORDS_PER_CHAPTER = { short: 2000, medium: 3500, long: 6000, epic: 8500 };

function getSceneCount(targetLength) {
  const base = (targetLength === 'long' || targetLength === 'epic') ? 4 : 3;
  return base + Math.round(Math.random()); // 3-4 for short/medium, 4-5 for long/epic
}

// ── Phase Continuity: Settings Propagation ──
const BEAT_STYLES = {
  "fast-paced-thriller":"Fast-Paced Thriller","gritty-cinematic":"Gritty Cinematic","hollywood-blockbuster":"Hollywood Blockbuster","slow-burn":"Slow Burn","steamy-romance":"Steamy Romance","slow-burn-romance":"Slow Burn Romance","dark-erotica":"Dark Erotica","clean-romance":"Clean Romance","faith-infused":"Faith-Infused Contemporary","investigative-nonfiction":"Investigative Nonfiction","reference-educational":"Reference / Educational","intellectual-psychological":"Intellectual Psychological","dark-suspense":"Dark Suspense","satirical":"Satirical","epic-historical":"Epic Historical","whimsical-cozy":"Whimsical Cozy","hard-boiled-noir":"Hard-Boiled Noir","grandiose-space-opera":"Grandiose Space Opera","visceral-horror":"Visceral Horror","poetic-magical-realism":"Poetic Magical Realism","clinical-procedural":"Clinical Procedural","hyper-stylized-action":"Hyper-Stylized Action","nostalgic-coming-of-age":"Nostalgic Coming-of-Age","cerebral-sci-fi":"Cerebral Sci-Fi","high-stakes-political":"High-Stakes Political","surrealist-avant-garde":"Surrealist Avant-Garde","melancholic-literary":"Melancholic Literary","urban-gritty-fantasy":"Urban Gritty Fantasy",
};
const ASP_NAMES={'colleen-hoover':'Colleen Hoover','taylor-jenkins-reid':'Taylor Jenkins Reid','emily-henry':'Emily Henry','sally-rooney':'Sally Rooney','nicholas-sparks':'Nicholas Sparks','penelope-douglas':'Penelope Douglas','francine-rivers':'Francine Rivers','gillian-flynn':'Gillian Flynn','tana-french':'Tana French','james-patterson':'James Patterson','michael-connelly':'Michael Connelly','harlan-coben':'Harlan Coben','lee-child':'Lee Child','toni-morrison':'Toni Morrison','cormac-mccarthy':'Cormac McCarthy','kazuo-ishiguro':'Kazuo Ishiguro','zadie-smith':'Zadie Smith','donna-tartt':'Donna Tartt','agatha-christie':'Agatha Christie','stephen-king':'Stephen King','brandon-sanderson':'Brandon Sanderson','andy-weir':'Andy Weir','ursula-le-guin':'Ursula K. Le Guin','erik-larson':'Erik Larson','david-grann':'David Grann','malcolm-gladwell':'Malcolm Gladwell','jon-krakauer':'Jon Krakauer'};
const SPICE_NAMES={0:'Fade to Black',1:'Closed Door',2:'Cracked Door',3:'Open Door',4:'Full Intensity'};
const LANG_NAMES={0:'Clean',1:'Mild',2:'Moderate',3:'Strong',4:'Raw'};

function buildContextHeader(spec) {
  const beatKey = spec?.beat_style || spec?.tone_style || '';
  const beatName = BEAT_STYLES[beatKey] || beatKey || 'Not specified';
  const spice = parseInt(spec?.spice_level) || 0;
  const lang = parseInt(spec?.language_intensity) || 0;
  const voiceId = spec?.author_voice || 'basic';
  const voiceName = ASP_NAMES[voiceId] || (voiceId === 'basic' ? '' : voiceId);
  return `═══════════════════════════════════════════════
PROJECT CONTEXT — READ BEFORE GENERATING
═══════════════════════════════════════════════
BOOK TYPE:        ${(spec?.book_type || 'fiction').toUpperCase()}
GENRE:            ${spec?.genre || 'Fiction'}${spec?.subgenre ? ' / ' + spec.subgenre : ''}
BEAT STYLE:       ${beatName}
LANGUAGE LEVEL:   ${lang}/4 — ${LANG_NAMES[lang] || 'Clean'}
${spice > 0 ? `SPICE LEVEL:      ${spice}/4 — ${SPICE_NAMES[spice] || 'Fade to Black'}` : ''}
${spec?.target_audience ? `AUDIENCE:         ${spec.target_audience}` : ''}
${voiceName ? `AUTHOR VOICE:     ${voiceName}` : ''}

These settings were configured in Phase 1 and are MANDATORY.
Every word of output must reflect this genre, beat style,
and author voice. Do not default to generic prose.
═══════════════════════════════════════════════`;
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
      // ═══ NONFICTION BEAT SHEET — Scene-level beats using beat engine templates ═══
      const chapter = chapters.find(c => c.chapter_number === Number(chapterNumber));
      if (!chapter) return Response.json({ error: `Chapter ${chapterNumber} not found` }, { status: 404 });

      const outline = outlines[0];
      const [outlineData, storyBible] = await Promise.all([
        parseField(outline?.outline_data, outline?.outline_url),
        parseField(outline?.story_bible, outline?.story_bible_url),
      ]);
      const outlineChapters = outlineData?.chapters || [];
      const outlineEntry = outlineChapters.find(c => (c.number || c.chapter_number) === Number(chapterNumber)) || {};
      const totalChapters = chapters.length;
      const thesis = spec?.topic || '';
      const genre = spec?.subgenre || spec?.genre || 'nonfiction';
      const beatStyle = spec?.beat_style || spec?.tone_style || 'Investigative / Nonfiction';
      const targetLength = spec?.target_length || 'medium';
      const wordsPerChapter = WORDS_PER_CHAPTER[targetLength] || 1600;

      // ── Resolve the chapter's structural beat from the beat engine ──
      const NF_BEAT_TEMPLATES = {
        "argument-driven": {
          beats: [
            { position: 0,    name: "The Hook",           fn: "PROVOCATIVE_OPENING",    mode: "exposition",        tempo: "medium" },
            { position: 0.08, name: "The Problem",         fn: "PROBLEM_STATEMENT",      mode: "exposition",        tempo: "medium" },
            { position: 0.15, name: "Conventional Wisdom",fn: "DEMOLITION",             mode: "analysis",          tempo: "fast" },
            { position: 0.22, name: "The Framework",       fn: "THESIS_INTRODUCTION",    mode: "exposition",        tempo: "slow" },
            { position: 0.30, name: "Deep Dive A",         fn: "EVIDENCE_BLOCK",         mode: "case_study",        tempo: "medium" },
            { position: 0.38, name: "Deep Dive B",         fn: "EVIDENCE_BLOCK",         mode: "case_study",        tempo: "medium" },
            { position: 0.45, name: "The Objection",       fn: "COUNTERARGUMENT",        mode: "analysis",          tempo: "fast" },
            { position: 0.52, name: "The Pivot",           fn: "REFRAME",                mode: "synthesis",         tempo: "slow" },
            { position: 0.60, name: "Application A",       fn: "PRACTICAL_APPLICATION",  mode: "how_to",            tempo: "medium" },
            { position: 0.68, name: "Application B",       fn: "PRACTICAL_APPLICATION",  mode: "how_to",            tempo: "medium" },
            { position: 0.78, name: "The Bigger Picture",  fn: "SYNTHESIS",              mode: "analysis",          tempo: "slow" },
            { position: 0.88, name: "The Transformation",  fn: "TRANSFORMATION_EVIDENCE",mode: "case_study",        tempo: "medium" },
            { position: 1.00, name: "The Send-Off",        fn: "CALL_TO_ACTION",         mode: "synthesis",         tempo: "slow" },
          ]
        },
        "narrative-nonfiction": {
          beats: [
            { position: 0,    name: "The Scene",          fn: "COLD_OPEN",              mode: "scene_recreation",  tempo: "fast" },
            { position: 0.08, name: "The World Before",    fn: "CONTEXT_SETTING",        mode: "exposition",        tempo: "slow" },
            { position: 0.15, name: "The Cast",            fn: "CHARACTER_INTRODUCTION", mode: "profile",           tempo: "medium" },
            { position: 0.22, name: "The Inciting Event",  fn: "INCITING_EVENT",         mode: "scene_recreation",  tempo: "fast" },
            { position: 0.30, name: "The Investigation",   fn: "EVIDENCE_TRAIL",         mode: "investigative",     tempo: "medium" },
            { position: 0.40, name: "The Complications",   fn: "COMPLICATION",           mode: "scene_recreation",  tempo: "fast" },
            { position: 0.50, name: "The Turning Point",   fn: "TURNING_POINT",          mode: "scene_recreation",  tempo: "fast" },
            { position: 0.60, name: "The Reckoning",       fn: "CONSEQUENCES",           mode: "analysis",          tempo: "slow" },
            { position: 0.70, name: "The Unraveling",      fn: "ESCALATION_NF",          mode: "scene_recreation",  tempo: "fast" },
            { position: 0.80, name: "The Aftermath",       fn: "AFTERMATH",              mode: "profile",           tempo: "slow" },
            { position: 0.90, name: "The Meaning",         fn: "THEMATIC_SYNTHESIS",     mode: "analysis",          tempo: "slow" },
            { position: 1.00, name: "The Echo",            fn: "CLOSING_IMAGE",          mode: "scene_recreation",  tempo: "medium" },
          ]
        },
        "investigative-nonfiction": {
          beats: [
            { position: 0,    name: "Something Is Wrong", fn: "ANOMALY",                mode: "scene_recreation",  tempo: "fast" },
            { position: 0.08, name: "The Official Story",  fn: "OFFICIAL_NARRATIVE",     mode: "exposition",        tempo: "medium" },
            { position: 0.15, name: "The First Crack",     fn: "FIRST_EVIDENCE",         mode: "investigative",     tempo: "fast" },
            { position: 0.25, name: "The Pattern",         fn: "PATTERN_RECOGNITION",    mode: "analysis",          tempo: "medium" },
            { position: 0.35, name: "The Players",         fn: "CAST_OF_CHARACTERS",     mode: "profile",           tempo: "slow" },
            { position: 0.45, name: "The Mechanism",       fn: "MECHANISM",              mode: "analysis",          tempo: "medium" },
            { position: 0.55, name: "The Cover-Up",        fn: "COVER_UP",               mode: "scene_recreation",  tempo: "fast" },
            { position: 0.65, name: "The Human Cost",      fn: "IMPACT",                 mode: "profile",           tempo: "slow" },
            { position: 0.75, name: "The Reckoning",       fn: "CONFRONTATION_NF",       mode: "scene_recreation",  tempo: "fast" },
            { position: 0.85, name: "The Fallout",         fn: "AFTERMATH_NF",           mode: "analysis",          tempo: "medium" },
            { position: 1.00, name: "The Lesson",          fn: "SYSTEMIC_ANALYSIS",      mode: "synthesis",         tempo: "slow" },
          ]
        },
        "reference-structured": {
          beats: [
            { position: 0,    name: "Why This Matters",   fn: "MOTIVATION",             mode: "exposition",        tempo: "medium" },
            { position: 0.10, name: "Foundations",          fn: "FOUNDATION",             mode: "teaching",          tempo: "slow" },
            { position: 0.20, name: "Core Concept A",      fn: "CONCEPT_BLOCK",          mode: "teaching",          tempo: "medium" },
            { position: 0.30, name: "Core Concept B",      fn: "CONCEPT_BLOCK",          mode: "teaching",          tempo: "medium" },
            { position: 0.40, name: "Core Concept C",      fn: "CONCEPT_BLOCK",          mode: "teaching",          tempo: "medium" },
            { position: 0.50, name: "Integration",          fn: "INTEGRATION",            mode: "synthesis",         tempo: "slow" },
            { position: 0.60, name: "Common Mistakes",      fn: "TROUBLESHOOTING",        mode: "analysis",          tempo: "fast" },
            { position: 0.70, name: "Advanced Technique A", fn: "ADVANCED_BLOCK",         mode: "teaching",          tempo: "medium" },
            { position: 0.80, name: "Advanced Technique B", fn: "ADVANCED_BLOCK",         mode: "teaching",          tempo: "medium" },
            { position: 0.90, name: "Real-World Application",fn: "CASE_STUDY_NF",        mode: "case_study",        tempo: "medium" },
            { position: 1.00, name: "What's Next",          fn: "ROADMAP",                mode: "synthesis",         tempo: "slow" },
          ]
        },
      };

      // Auto-detect template from genre
      function detectNFTemplate(g) {
        const gl = (g || '').toLowerCase();
        if (/self.help|business|psychology|science|health/.test(gl)) return 'argument-driven';
        if (/memoir|biography|history|true crime/.test(gl)) return 'narrative-nonfiction';
        if (/reference|education|how.to|technical|cooking|technology/.test(gl)) return 'reference-structured';
        if (/investigat|journalism|expos|politic/.test(gl)) return 'investigative-nonfiction';
        return 'narrative-nonfiction';
      }

      // Resolve the template and find this chapter's structural beat
      const templateKey = spec?.beat_sheet_template && spec.beat_sheet_template !== 'auto'
        ? spec.beat_sheet_template
        : detectNFTemplate(genre);
      const nfTemplate = NF_BEAT_TEMPLATES[templateKey] || NF_BEAT_TEMPLATES['narrative-nonfiction'];
      const chapterPosition = totalChapters > 1 ? (chapterNumber - 1) / (totalChapters - 1) : 0;

      // Find closest beat for this chapter position
      let closestBeat = nfTemplate.beats[0];
      let minDist = 999;
      for (const b of nfTemplate.beats) {
        const dist = Math.abs(b.position - chapterPosition);
        if (dist < minDist) { minDist = dist; closestBeat = b; }
      }

      // ── NF SECTION MODE DESCRIPTIONS ──
      const NF_MODE_DESC = {
        'exposition': 'Author explains. Analytical voice carries this section. Context, definitions, argument building.',
        'case_study': 'One deep example. A specific person, event, or study examined in detail. Names, dates, outcomes.',
        'analysis': 'Author argues. Weigh evidence, compare viewpoints, draw conclusions.',
        'how_to': 'Actionable steps. Specific enough the reader can start today.',
        'synthesis': 'Connect ideas from earlier sections. Zoom out. Find patterns.',
        'scene_recreation': 'Reconstruct a real event with cinematic detail. Primary sources only. Label as reconstruction.',
        'profile': 'Introduce real people as three-dimensional humans. Use their own words.',
        'investigative': 'Follow the trail. Documents, interviews, evidence in discovery order.',
        'teaching': 'Instruct. Concept → Example → Counter-example → Practice.',
      };

      // Determine section count based on target length
      const sectionCounts = { short: 4, medium: 5, long: 6, epic: 8 };
      const sectionCount = sectionCounts[targetLength] || 5;
      const wordPerSection = Math.round(wordsPerChapter / sectionCount);

      // Build full outline summary for cross-reference
      const outlineSummaryLines = outlineChapters.map(oc => {
        const num = oc.number || oc.chapter_number;
        return `Ch ${num}: "${oc.title || 'Untitled'}" — ${(oc.summary || '').slice(0, 150)}`;
      }).join('\n');

      const prevChapterRef = chapterNumber > 1 ? chapters.find(c => c.chapter_number === chapterNumber - 1) : null;
      const nextChapterRef = chapters.find(c => c.chapter_number === chapterNumber + 1);

      const nfContextHeader = buildContextHeader(spec);

      const nfSystemPrompt = `You are a narrative nonfiction editor creating a section-by-section beat sheet for a single chapter. You MUST return ONLY a valid JSON object. No markdown, no backticks, no explanation.

${nfContextHeader}

STRUCTURAL TEMPLATE: "${templateKey}"
THIS CHAPTER'S STRUCTURAL ROLE: Beat "${closestBeat.name}" | Function: ${closestBeat.fn} | Mode: ${closestBeat.mode} | Tempo: ${closestBeat.tempo}

MODE "${closestBeat.mode}": ${NF_MODE_DESC[closestBeat.mode] || 'Follow the chapter description.'}

NONFICTION SECTION RULES:
1. Each section is a self-contained unit of argument/evidence that the prose writer will generate independently.
2. Sections must FLOW — each one picks up where the previous left off.
3. Every section needs a clear PURPOSE (what it adds to the chapter's argument).
4. NEVER invent specific quotes, dates, case numbers, or named individuals not in the source material.
5. Vary section modes — do NOT make every section the same type.
6. The first section must HOOK the reader. The last section must BRIDGE to the next chapter.`;

      const nfUserMessage = `BOOK THESIS / THROUGHLINE:
${thesis}

FULL OUTLINE (for cross-reference — identify what is covered ELSEWHERE):
${outlineSummaryLines}

CHAPTER ${chapterNumber} of ${totalChapters}: "${chapter.title}"
DESCRIPTION: ${chapter.summary || outlineEntry.summary || 'No description provided'}
CHAPTER PROMPT: ${chapter.prompt || outlineEntry.prompt || ''}
GENRE: ${genre}
BEAT STYLE: ${beatStyle}
${outlineEntry.beat_function ? `STRUCTURAL ROLE: ${outlineEntry.beat_function} (${outlineEntry.beat_name || ''})` : `STRUCTURAL ROLE: ${closestBeat.fn} (${closestBeat.name})`}
${outlineEntry.beat_scene_type ? `MODE: ${outlineEntry.beat_scene_type}` : `MODE: ${closestBeat.mode}`}
${prevChapterRef ? `PREVIOUS CHAPTER: Ch ${prevChapterRef.chapter_number}: "${prevChapterRef.title}" — ${(prevChapterRef.summary || '').slice(0, 200)}` : 'THIS IS THE FIRST CHAPTER.'}
${nextChapterRef ? `NEXT CHAPTER: Ch ${nextChapterRef.chapter_number}: "${nextChapterRef.title}" — ${(nextChapterRef.summary || '').slice(0, 200)}` : 'THIS IS THE FINAL CHAPTER.'}

Generate a structured beat sheet with exactly ${sectionCount} sections AND an argument_progression object.

Return ONLY a JSON object with this EXACT structure:
{
  "chapter_number": ${chapterNumber},
  "chapter_title": "${chapter.title}",
  "template_key": "${templateKey}",
  "structural_beat": "${closestBeat.name}",
  "structural_function": "${closestBeat.fn}",
  "argument_progression": {
    "prior_chapter_endpoint": "What the previous chapter concluded. For Ch 1, state the book's starting premise.",
    "this_chapter_advances": "The specific NEW claim or evidence this chapter adds.",
    "new_ground": "Material covered here that appears NOWHERE else in the outline. Name specific people, events, documents.",
    "handoff": "What this chapter sets up for the next chapter."
  },
  "sections": [
    {
      "section_number": 1,
      "title": "3-6 word title",
      "mode": "one of: exposition | case_study | analysis | scene_recreation | profile | investigative | synthesis | teaching | how_to",
      "tempo": "fast | medium | slow",
      "purpose": "What this section accomplishes for the chapter's argument",
      "content_direction": "Specific guidance on WHAT to write — which evidence, which person, which event, which argument",
      "evidence_needed": "What documented sources, facts, or data this section should draw on",
      "key_claim": "The ONE specific factual claim or argument this section makes",
      "opens_with": "How to open this section — a fact, a scene, a question, a quote",
      "closes_with": "How to close — a bridge to the next section, an unresolved question, a reframed understanding",
      "word_target": ${wordPerSection},
      "fabrication_warnings": ["Any claims that need verification"]
    }
  ]
}

RULES:
- Section 1 must HOOK the reader with something concrete and immediate (not a thesis statement).
- The last section must BRIDGE to the next chapter (or close the book's argument for the final chapter).
- Vary the modes — do NOT give every section the same mode. Mix exposition, case_study, analysis, scene_recreation.
- Each section must advance a DIFFERENT aspect of the chapter's argument. No repeated points.
- "new_ground" must identify material NOT covered in other chapters. If it overlaps, write "[RESTRUCTURE NEEDED: overlaps with Ch X]".`;

      const nfModelKey = 'gemini-pro';
      let nfRaw;
      try {
        nfRaw = await callAI(nfModelKey, nfSystemPrompt, nfUserMessage, { maxTokens: 4096, temperature: 0.6 });
      } catch (primaryErr) {
        console.warn(`NF beat primary model failed: ${primaryErr.message} — retrying with claude-sonnet`);
        nfRaw = await callAI('claude-sonnet', nfSystemPrompt, nfUserMessage, { maxTokens: 4096, temperature: 0.6 });
      }
      const nfBeatSheet = await safeParseJSON(nfRaw, nfModelKey);

      // Store in the scenes field (reused for nonfiction beat sheet)
      await base44.entities.Chapter.update(chapter.id, { scenes: JSON.stringify(nfBeatSheet) });

      console.log(`Generated NF beat sheet for Ch ${chapterNumber}: template=${templateKey}, beat=${closestBeat.name}, sections=${nfBeatSheet.sections?.length || 0}`);
      return Response.json({ beatSheet: nfBeatSheet, chapterNumber: Number(chapterNumber), chapterId: chapter.id, nonfiction: true });
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

    // callType: beat_sheet → scene generation is structural, always uses Gemini (never user's prose model)
    const modelKey = 'gemini-pro';
    const characters = storyBible?.characters || [];
    const world = storyBible?.world || storyBible?.settings;
    const rules = storyBible?.rules;

    const isErotica = /erotica|erotic/.test(((spec?.genre||'')+ ' '+(spec?.subgenre||'')).toLowerCase());

    const explicitTaggingInstruction = isErotica ? `\n\nMANDATORY — EXPLICIT SCENE TAGGING (EROTICA PROJECT):
This is an EROTICA project. Most scenes MUST contain on-page explicit sexual content.
For EVERY scene that contains sexual activity, desire, physical intimacy, or erotic tension,
you MUST set the extra_instructions field to begin with "[EXPLICIT]" and end with "[/EXPLICIT]".

RULES:
- At MINIMUM, ${sceneCount > 2 ? sceneCount - 1 : sceneCount} of ${sceneCount} scenes MUST have [EXPLICIT] tags.
- Only pure setup/transition scenes (arriving at location, initial dialogue before intimacy) may omit the tag.
- When in doubt, TAG IT. This is erotica — explicit content is the genre's core purpose.

Example for an explicit scene:
"extra_instructions": "[EXPLICIT] Full explicit scene — describe specific physical action, desire, sensation, and consequence. Do not fade to black. Do not cut away. Stay in the moment. [/EXPLICIT]"
Example for a setup scene:
"extra_instructions": "Establish location and initial tension before the encounter."` : '';

    const contextHeader = buildContextHeader(spec);
    const systemPrompt = `Generate scenes for a fiction chapter. Output ONLY valid JSON array. No explanation.

${contextHeader}${explicitTaggingInstruction}`;

    const userMessage = `Genre: ${spec?.genre || 'Fiction'}
Subgenre: ${spec?.subgenre || 'Not specified'}
Beat Style: ${spec?.beat_style || spec?.tone_style || 'Not specified'}
Author Voice: ${spec?.author_voice && spec.author_voice !== 'basic' ? (ASP_NAMES[spec.author_voice] || spec.author_voice) : 'Standard'}
Spice Level: ${parseInt(spec?.spice_level) || 0}/4 — ${SPICE_NAMES[parseInt(spec?.spice_level) || 0] || 'Fade to Black'}
Language Intensity: ${parseInt(spec?.language_intensity) || 0}/4 — ${LANG_NAMES[parseInt(spec?.language_intensity) || 0] || 'Clean'}

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

    const maxTokens = 8192;
    // callType: beat_sheet → scene beat generation (structural, not prose)
    // Retry with fallback model if primary fails
    let raw;
    try {
      raw = await callAI(modelKey, systemPrompt, userMessage, { maxTokens, temperature: 0.6 });
    } catch (primaryErr) {
      console.warn(`Primary model (${modelKey}) failed: ${primaryErr.message} — retrying with claude-sonnet`);
      raw = await callAI('claude-sonnet', systemPrompt, userMessage, { maxTokens, temperature: 0.6 });
    }
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