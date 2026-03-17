// generateStoryBible.ts — Generates a structured story bible from premise
// Called by StoryBibleEditor's "Generate Story Bible from Premise" button

const MODEL_MAP = {
  'claude-sonnet': { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  'gemini-pro': { provider: 'google', model: 'gemini-2.5-pro-preview-03-25' },
};

async function callAI(provider, systemPrompt, userMessage, maxTokens = 4096) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    if (provider === 'anthropic' || provider === 'claude-sonnet') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, temperature: 0.7, system: systemPrompt, messages: [{ role: 'user', content: userMessage }] }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const d = await r.json();
      if (!r.ok) throw new Error('Anthropic: ' + (d.error?.message || r.status));
      return d.content[0].text;
    }
    // Gemini
    const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: userMessage }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens } }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const d = await r.json();
    if (!r.ok) throw new Error('Gemini: ' + (d.error?.message || r.status));
    return d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

function safeParseJSON(raw) {
  let cleaned = raw.trim();
  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  // Try parsing directly
  try { return JSON.parse(cleaned); } catch {}
  // Try extracting JSON object
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }
  throw new Error('Failed to parse JSON from AI response');
}

function buildFictionPrompt(topic, genre, subgenre, audience) {
  return `Generate a comprehensive story bible for a ${genre}${subgenre ? '/' + subgenre : ''} novel.

PREMISE: ${topic}
${audience ? `TARGET AUDIENCE: ${audience}` : ''}

Return a JSON object with this EXACT structure:
{
  "characters": [
    {
      "id": "char_1",
      "name": "Character Name",
      "role": "protagonist|antagonist|love_interest|mentor|supporting|foil",
      "core_wound": "The formative trauma that shaped their worldview — specific, not vague",
      "desire": "What they want more than anything — their conscious goal",
      "fear": "What terrifies them — the thing they'd do anything to avoid",
      "misbelief": "The false belief about themselves or the world they cling to",
      "ghost": "The specific past event that haunts them — their backstory trauma",
      "arc_direction": "How they change by the end — what they learn or become",
      "voice_dna": {
        "vocabulary": "How they speak — education level, register, word choices",
        "speech_pattern": "Sentence structure, rhythm, how they talk when stressed vs calm",
        "verbal_tic": "Signature phrase, habitual expression, or verbal habit",
        "never_says": "Words or phrases this character would NEVER use — reveals suppression",
        "internal_voice": "How they think vs how they talk — inner monologue style"
      },
      "physical_tells": "Observable behaviors that reveal inner state without dialogue",
      "relationships": []
    }
  ],
  "world": {
    "time_period": "When the story takes place",
    "primary_setting": "Where most of the story happens — specific, atmospheric",
    "locations": [
      { "name": "Location Name", "significance": "Why this place matters to the story" }
    ],
    "world_rules": ["Rule 1 — a constraint that affects character choices", "Rule 2", "Rule 3"],
    "social_hierarchy": "Who holds power, what divides people, what social rules constrain characters",
    "sensory_palette": "Dominant sensory details — smells, textures, sounds, light quality"
  },
  "themes": {
    "central_theme": "The one-sentence heart of the story — what it's really about beneath the plot",
    "thematic_question": "The unanswered question the story explores",
    "motifs": ["Recurring image or idea 1", "Recurring image or idea 2", "Recurring image or idea 3"],
    "symbols": []
  }
}

RULES:
- Generate 2-4 characters depending on the premise. Always include a protagonist.
- Each character's voice_dna must be DISTINCT from every other character's.
- Core wounds, fears, and misbeliefs should create CONFLICT between characters.
- The protagonist's arc_direction should connect to the thematic_question.
- World rules should constrain character actions in ways that create dramatic tension.
- Locations should be specific and atmospheric, not generic.
- Return ONLY the JSON object. No commentary.`;
}

function buildNonfictionPrompt(topic, genre, subgenre, audience) {
  return `Generate a comprehensive nonfiction bible for a ${genre}${subgenre ? '/' + subgenre : ''} book.

TOPIC: ${topic}
${audience ? `TARGET AUDIENCE: ${audience}` : ''}

Return a JSON object with this EXACT structure:
{
  "key_figures": [
    {
      "id": "fig_1",
      "name": "Real Person's Full Name",
      "role": "subject|antagonist|victim|reformer|witness|institution",
      "era": "When they were active (e.g. '1930s-1958')",
      "significance": "Why this person/institution matters to the book's argument",
      "known_sources": "Types of documentation available — biographies, archives, court records, etc."
    }
  ],
  "settings": [
    {
      "name": "Location Name",
      "era": "Time period",
      "significance": "Why this place matters",
      "source_type": "How this location is documented — archives, photographs, maps, etc."
    }
  ],
  "timeline": [
    {
      "date": "Year or date range",
      "event": "What happened",
      "significance": "Why it matters to the book's argument"
    }
  ],
  "argument": {
    "central_thesis": "The single core argument the book makes — what you're proving",
    "supporting_arguments": ["Pillar 1 of the argument", "Pillar 2", "Pillar 3", "Pillar 4", "Pillar 5"],
    "counter_arguments": ["Argument against thesis 1 to address", "Argument against thesis 2"]
  },
  "source_strategy": {
    "primary_sources": ["Archive or primary source type 1", "Primary source type 2"],
    "secondary_sources": ["Published book or academic source 1", "Secondary source 2"],
    "source_limitations": "Known gaps in available evidence"
  }
}

RULES:
- Generate 4-8 key figures based on the topic. Use REAL, DOCUMENTED people/institutions.
- Do NOT invent fictional figures or composite characters.
- Timeline should include 8-15 key events in chronological order.
- Supporting arguments should be specific claims, not vague observations.
- Counter-arguments should be genuine challenges to the thesis that the book needs to address.
- Source strategy should reflect realistic research possibilities for this topic.
- Settings should be real places that can be documented.
- Return ONLY the JSON object. No commentary.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });

  try {
    const body = await req.json();
    const { topic, book_type, genre, subgenre, target_audience } = body;

    if (!topic) throw new Error('Topic/premise is required');

    const isNonfiction = book_type === 'nonfiction';
    const systemPrompt = isNonfiction
      ? 'You are a nonfiction research strategist and book architect. Generate structured research bibles for investigative nonfiction. Output ONLY valid JSON. No preamble, no markdown.'
      : 'You are a fiction story architect specializing in character psychology and world-building. Generate structured story bibles with deep character development. Output ONLY valid JSON. No preamble, no markdown.';

    const userMessage = isNonfiction
      ? buildNonfictionPrompt(topic, genre || 'Nonfiction', subgenre, target_audience)
      : buildFictionPrompt(topic, genre || 'Fiction', subgenre, target_audience);

    // Try Gemini first (faster), fall back to Claude
    let raw;
    try {
      raw = await callAI('gemini', systemPrompt, userMessage);
    } catch (primaryErr) {
      console.warn('Gemini failed, trying Claude:', primaryErr.message);
      raw = await callAI('claude-sonnet', systemPrompt, userMessage);
    }

    const storyBible = safeParseJSON(raw);

    return Response.json({ story_bible: storyBible });
  } catch (err) {
    console.error('generateStoryBible error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});