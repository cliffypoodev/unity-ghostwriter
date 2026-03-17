import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");

async function callGemini(systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-03-25:generateContent?key=' + GOOGLE_AI_API_KEY, {
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

async function callClaude(systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1024, messages: [{ role: "user", content: userPrompt }], system: systemPrompt }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!r.ok) throw new Error('Claude: ' + await r.text());
    const d = await r.json();
    return d.content?.[0]?.text || '';
  } catch (e) { clearTimeout(timeout); throw e; }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { idea = "", book_type = "fiction", genre = "" } = await req.json();

  const hasIdea = idea.trim().length > 0;

  const systemPrompt = `You are a top literary agent and book development expert. You create compelling, marketable book premises.

RULES:
- Output ONLY valid JSON. No markdown fences, no commentary.
- The developed_premise must be 200-400 words, pitch-style: tight, vivid, compelling.
- For fiction: include named characters, specific settings, concrete conflicts, stakes.
- For nonfiction: include a sharp thesis, target reader, unique angle, concrete takeaways.
- market_notes should be 2-3 sentences with comp titles and market positioning.
- Return JSON with exactly these keys: developed_premise, book_type, market_notes`;

  let userPrompt;
  if (!hasIdea) {
    userPrompt = `Generate a fresh, highly marketable book concept from scratch.
Book type: ${book_type}
${genre ? `Genre: ${genre}` : "Pick a genre with strong current market potential."}

Create something original, specific, and immediately compelling. Not generic — give it a hook that would make an agent request the full manuscript.`;
  } else {
    userPrompt = `Develop this rough idea into a compelling, specific book premise. Find the strongest marketable angle. Sharpen with specifics.

Raw idea: "${idea}"
Book type: ${book_type}
${genre ? `Genre: ${genre}` : "Determine the best genre fit."}

Transform this into a tight, pitch-ready premise. Named characters, vivid settings, concrete conflicts.`;
  }

  // Gemini primary (faster), Claude fallback
  let text;
  try {
    text = await callGemini(systemPrompt, userPrompt);
  } catch (geminiErr) {
    console.warn('Gemini failed, trying Claude:', geminiErr.message);
    text = await callClaude(systemPrompt, userPrompt);
  }

  // Parse JSON from response, stripping any accidental markdown fences
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    console.error("JSON parse failed. Raw text:", text);
    // Attempt to extract fields from malformed output
    const premiseMatch = cleaned.match(/"developed_premise"\s*:\s*"([\s\S]*?)(?:"\s*[,}])/);
    const marketMatch = cleaned.match(/"market_notes"\s*:\s*"([\s\S]*?)(?:"\s*[,}])/);
    const typeMatch = cleaned.match(/"book_type"\s*:\s*"(\w+)"/);
    if (premiseMatch) {
      parsed = {
        developed_premise: premiseMatch[1],
        book_type: typeMatch ? typeMatch[1] : book_type,
        market_notes: marketMatch ? marketMatch[1] : "",
      };
    } else {
      return Response.json({ error: "Failed to parse AI response" }, { status: 500 });
    }
  }

  return Response.json({
    developed_premise: parsed.developed_premise,
    book_type: parsed.book_type || book_type,
    market_notes: parsed.market_notes,
  });
});