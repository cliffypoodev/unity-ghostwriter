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
          maxOutputTokens: 4096,
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

    // Check for content blocking
    const blockReason = d?.promptFeedback?.blockReason;
    if (blockReason) {
      console.warn('Gemini blocked content: ' + blockReason);
      throw new Error('CONTENT_BLOCKED:' + blockReason);
    }

    const text = d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const finishReason = d?.candidates?.[0]?.finishReason;
    console.log('Gemini response: ' + text.length + ' chars, finishReason=' + finishReason);

    if (!text) {
      console.error('Empty response from Gemini:', JSON.stringify(d).slice(0, 500));
      throw new Error('CONTENT_BLOCKED:EMPTY');
    }

    return text;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

async function callClaude(systemPrompt, userMessage) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  const d = await r.json();
  if (!r.ok) throw new Error('Claude API error: ' + (d.error?.message || r.status));
  return d.content[0].text;
}

function repairJSON(str) {
  // Fix common Gemini JSON issues:
  // 1. Unescaped control characters inside string values
  // 2. Trailing commas
  // 3. Unescaped double quotes inside string values
  
  let result = '';
  let inString = false;
  let escaped = false;
  
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    
    if (ch === '\\') {
      escaped = true;
      result += ch;
      continue;
    }
    
    if (ch === '"') {
      if (!inString) {
        // Opening a string
        inString = true;
        result += ch;
        continue;
      }
      // We're inside a string and hit an unescaped quote.
      // Determine if this is the real closing quote or an inner quote.
      // Look ahead: if next non-whitespace char is : , } ] or end-of-string,
      // this is a structural closing quote. Otherwise it's an inner quote to escape.
      let j = i + 1;
      while (j < str.length && (str[j] === ' ' || str[j] === '\t' || str[j] === '\r' || str[j] === '\n')) j++;
      const next = str[j] || '';
      if (next === ':' || next === ',' || next === '}' || next === ']' || next === '') {
        // Structural closing quote
        inString = false;
        result += ch;
      } else {
        // Inner quote — escape it
        result += '\\"';
      }
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
  
  // Fix trailing commas before } or ]
  result = result.replace(/,\s*([}\]])/g, '$1');
  
  return result;
}

function parseJSON(raw) {
  let cleaned = raw.trim();
  
  // Strip markdown fences if present
  cleaned = cleaned.replace(/^```[\w]*\n?/, '').replace(/\n?```\s*$/, '').trim();

  // Try direct parse first
  try { return JSON.parse(cleaned); } catch (e1) {
    console.log('Direct parse failed:', e1.message);
  }

  // Try with JSON repair (handles unescaped chars in strings)
  try { return JSON.parse(repairJSON(cleaned)); } catch (e2) {
    console.log('Repair parse failed:', e2.message);
  }

  // Extract outermost { ... } and try again
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    const extracted = cleaned.slice(start, end + 1);
    try { return JSON.parse(extracted); } catch {}
    try { return JSON.parse(repairJSON(extracted)); } catch (e3) {
      console.log('Extracted+repair parse failed:', e3.message);
    }
  }

  // Last resort: try to close unterminated strings/objects/arrays
  try {
    let truncated = cleaned;
    // Close any unterminated string
    const quoteCount = (truncated.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) truncated += '"';
    // Close open brackets/braces
    const openBraces = (truncated.match(/{/g) || []).length - (truncated.match(/}/g) || []).length;
    const openBrackets = (truncated.match(/\[/g) || []).length - (truncated.match(/]/g) || []).length;
    // Remove trailing comma before closing
    truncated = truncated.replace(/,\s*$/, '');
    for (let i = 0; i < openBrackets; i++) truncated += ']';
    for (let i = 0; i < openBraces; i++) truncated += '}';
    return JSON.parse(truncated);
  } catch (e4) {
    console.log('Truncation repair failed:', e4.message);
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
      "core_wound": "Brief formative trauma (1 sentence)",
      "desire": "Conscious goal (1 sentence)",
      "fear": "Core fear (1 sentence)",
      "misbelief": "False belief (1 sentence)",
      "ghost": "Past event that haunts them (1 sentence)",
      "arc_direction": "How they change (1 sentence)",
      "voice_dna": {
        "vocabulary": "Speech register in a few words",
        "speech_pattern": "How they talk (brief)",
        "verbal_tic": "Signature phrase",
        "never_says": "Words they avoid",
        "internal_voice": "Inner monologue style (brief)"
      },
      "physical_tells": "Key behavioral tell (1 sentence)",
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
- Generate 2-3 characters. Always include a protagonist.
- KEEP ALL DESCRIPTIONS SHORT — 1 sentence max per field. No long paragraphs.
- Each character's voice_dna must be DISTINCT.
- 2-3 locations max. 2-3 world rules max.
- Return ONLY the JSON object. No commentary.
- Total response must be under 3000 tokens.`;
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
- Generate 3-5 key figures. Use REAL, DOCUMENTED people/institutions.
- Timeline: 5-8 key events in chronological order.
- KEEP ALL DESCRIPTIONS SHORT — 1 sentence max per field.
- 2-3 settings max. 3 supporting arguments, 2 counter-arguments.
- Return ONLY the JSON object. No commentary.
- Total response must be under 3000 tokens.`;
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
    let raw;
    let usedFallback = false;

    try {
      raw = await callGemini(systemPrompt, userMessage);
    } catch (geminiErr) {
      if (geminiErr.message?.startsWith('CONTENT_BLOCKED')) {
        console.warn('v2: Gemini blocked content, falling back to Claude');
        raw = await callClaude(systemPrompt, userMessage);
        usedFallback = true;
      } else {
        throw geminiErr;
      }
    }
    console.log('v2: got response, ' + raw.length + ' chars' + (usedFallback ? ' (via Claude fallback)' : ''));

    let storyBible;
    try {
      storyBible = parseJSON(raw);
      console.log('v2: parsed successfully');
    } catch (parseErr) {
      console.warn('v2: first attempt parse failed, retrying with strict prompt');
      const retryPrompt = 'You are a JSON generator. Output ONLY valid, parseable JSON. Escape all double quotes inside string values with backslash. No markdown, no commentary, no code fences.';
      const retryMessage = 'Take this broken JSON and return it as valid JSON. Fix any unescaped quotes, trailing commas, or malformed strings. Return the corrected JSON object only:\n\n' + raw;
      let retryRaw;
      try {
        retryRaw = usedFallback ? await callClaude(retryPrompt, retryMessage) : await callGemini(retryPrompt, retryMessage);
      } catch (retryGeminiErr) {
        if (retryGeminiErr.message?.startsWith('CONTENT_BLOCKED')) {
          retryRaw = await callClaude(retryPrompt, retryMessage);
        } else {
          throw retryGeminiErr;
        }
      }
      console.log('v2: retry response, ' + retryRaw.length + ' chars');
      storyBible = parseJSON(retryRaw);
      console.log('v2: retry parsed successfully');
    }

    return Response.json({ story_bible: storyBible });
  } catch (err) {
    console.error('generateStoryBible error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});