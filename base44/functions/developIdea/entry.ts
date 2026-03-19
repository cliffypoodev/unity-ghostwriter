import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');

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

async function callGemini(systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GOOGLE_AI_API_KEY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: userPrompt }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { temperature: 0.7, maxOutputTokens: 1024 } }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!r.ok) throw new Error('Gemini: ' + await r.text());
    const d = await r.json();
    return d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (e) { clearTimeout(timeout); throw e; }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { premise, genre, book_type } = await req.json();
    if (!premise) return Response.json({ error: 'Premise is required' }, { status: 400 });

    const systemPrompt = `You are a book development consultant. Given a premise, generate creative development ideas that expand and deepen the concept. Return a JSON object with these fields:
- "expanded_premise": A richer, more detailed version of the premise (2-3 paragraphs)
- "themes": Array of 3-5 major themes to explore
- "unique_angles": Array of 3-4 unique angles or perspectives that make this story stand out
- "potential_conflicts": Array of 3-4 central conflicts
- "target_audience": Description of the ideal reader
- "comparable_titles": Array of 2-3 published books with similar appeal
- "development_notes": Brief notes on what makes this concept commercially viable

Return ONLY valid JSON. No markdown, no backticks, no explanation.`;

    const userPrompt = `Develop this ${book_type || 'fiction'} book concept:

PREMISE: ${premise}
${genre ? `GENRE: ${genre}` : ''}

Generate detailed development ideas as JSON.`;

    const text = await callGemini(systemPrompt, userPrompt);

    // Parse JSON with robust repair
    let result;
    try {
      result = robustParseJSON(text);
    } catch (parseErr) {
      return Response.json({ error: 'Failed to parse AI response', raw: text.slice(0, 500) }, { status: 500 });
    }

    return Response.json({ success: true, data: result });
  } catch (error) {
    console.error('developIdea error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});