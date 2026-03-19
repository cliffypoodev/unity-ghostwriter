import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Gemini Pro with grounding (web search) for nonfiction research.
// Input: { topic, subject, genre, subgenre, scope }
// Output: { facts, timeline, keyFigures, sources, contextSummary }

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

async function doResearch(topic, subject, genre, subgenre, scope) {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not configured');

  const researchPrompt = `You are a research assistant preparing factual grounding for a nonfiction book.

BOOK CONTEXT:
Genre: ${genre || 'General'} / ${subgenre || 'General'}
Topic: ${topic || 'Not specified'}
${subject ? `Chapter Focus: ${subject}` : ''}
${scope ? `Scope: ${scope}` : ''}

Use your knowledge and grounding to gather accurate, current facts. Then return ONLY a JSON object with no preamble, no markdown fences, in this exact structure:

{
  "facts": [
    "Specific verifiable fact 1",
    "Specific verifiable fact 2"
  ],
  "timeline": [
    { "date": "YYYY or Month YYYY", "event": "What happened" }
  ],
  "keyFigures": [
    { "name": "Full Name", "role": "Their relevance to the topic" }
  ],
  "sources": [
    { "title": "Source name", "url": "URL if available", "relevance": "Why it matters" }
  ],
  "contextSummary": "2-3 sentence factual summary of the topic/subject suitable for injection into a writing prompt"
}

Return 8-12 facts, 4-8 timeline entries, 3-6 key figures, and 3-5 sources. Return ONLY the JSON object.`;

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: researchPrompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error('Gemini Pro error: ' + (data.error?.message || response.status));
  }

  // Extract text from response
  const textBlock = data?.candidates?.[0]?.content?.parts
    ?.filter(p => p.text)
    ?.map(p => p.text)
    ?.join('') || '';

  if (!textBlock) {
    throw new Error('No text response from Gemini Pro');
  }

  // Strip any accidental markdown fences
  const clean = textBlock.replace(/```json|```/g, '').trim();

  // Extract JSON object
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn('Research JSON extraction failed, returning contextSummary only');
    return {
      facts: [],
      timeline: [],
      keyFigures: [],
      sources: [],
      contextSummary: clean.slice(0, 500),
    };
  }

  try {
    return robustParseJSON(jsonMatch[0]);
  } catch {
    console.warn('Research JSON all parse attempts failed, returning contextSummary only');
    return {
      facts: [],
      timeline: [],
      keyFigures: [],
      sources: [],
      contextSummary: clean.slice(0, 500),
    };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { topic, subject, genre, subgenre, scope } = await req.json();
    if (!topic) return Response.json({ error: 'topic is required' }, { status: 400 });

    console.log(`Research request: scope="${scope || 'book-level'}", subject="${subject || 'N/A'}"`);
    const result = await doResearch(topic, subject, genre, subgenre, scope);
    console.log(`Research complete: ${result.facts?.length || 0} facts, ${result.timeline?.length || 0} timeline, ${result.keyFigures?.length || 0} figures`);

    return Response.json(result);
  } catch (error) {
    console.error('researchNonfictionTopic error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});