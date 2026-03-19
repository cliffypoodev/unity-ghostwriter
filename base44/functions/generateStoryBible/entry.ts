// generateStoryBible — Generates a structured story bible from premise using Gemini 2.5 Flash
// No auth required — just calls Gemini and returns the result
// v2 — uses responseMimeType to force JSON output

async function callGemini(systemPrompt, userMessage) {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey;
    
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userMessage }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const d = await r.json();

    if (!r.ok) {
      console.error('Gemini API error:', r.status, JSON.stringify(d?.error || {}).slice(0, 500));
      throw new Error('Gemini API error: ' + (d.error?.message || r.status));
    }

    const text = d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const finishReason = d?.candidates?.[0]?.finishReason;
    console.log('Gemini response: ' + text.length + ' chars, finishReason=' + finishReason);

    if (!text) {
      console.error('Empty response from Gemini:', JSON.stringify(d).slice(0, 500));
      throw new Error('Empty response from Gemini');
    }

    return text;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

function parseJSON(raw) {
  // With responseMimeType=application/json, Gemini should return clean JSON
  // But just in case, handle edge cases
  let cleaned = raw.trim();

  // Try direct parse first
  try { return JSON.parse(cleaned); } catch (e1) {
    console.log('Direct parse failed:', e1.message);
  }

  // Strip markdown fences if present
  cleaned = cleaned.replace(/^```[\w]*\n?/, '').replace(/\n?```\s*$/, '').trim();
  try { return JSON.parse(cleaned); } catch (e2) {
    console.log('Fence-stripped parse failed:', e2.message);
  }

  // Extract outermost { ... }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch (e3) {
      console.log('Extracted object parse failed:', e3.message);
    }
  }

  console.error('All parse attempts failed. First 500 chars:', raw.slice(0, 500));
  console.error('Last 200 chars:', raw.slice(-200));
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
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const body = await req.json();
    const { topic, book_type, genre, subgenre, target_audience } = body;

    if (!topic) throw new Error('Topic/premise is required');

    const isNonfiction = book_type === 'nonfiction';

    const systemPrompt = isNonfiction
      ? 'You are a nonfiction research strategist and book architect. Generate structured research bibles for investigative nonfiction. Output ONLY valid JSON.'
      : 'You are a fiction story architect specializing in character psychology and world-building. Generate structured story bibles with deep character development. Output ONLY valid JSON.';

    const userMessage = isNonfiction
      ? buildNonfictionPrompt(topic, genre || 'Nonfiction', subgenre, target_audience)
      : buildFictionPrompt(topic, genre || 'Fiction', subgenre, target_audience);

    console.log('v2: generateStoryBible calling Gemini 2.5 Flash, type=' + book_type);
    const raw = await callGemini(systemPrompt, userMessage);
    console.log('v2: got response, ' + raw.length + ' chars');

    const storyBible = parseJSON(raw);
    console.log('v2: parsed successfully');

    return Response.json({ story_bible: storyBible });
  } catch (err) {
    console.error('generateStoryBible error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});