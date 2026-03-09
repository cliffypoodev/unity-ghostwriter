import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

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

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        { role: "user", content: userPrompt }
      ],
      system: systemPrompt,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    return Response.json({ error: `Anthropic API error: ${errText}` }, { status: 500 });
  }

  const result = await response.json();
  const text = result.content?.[0]?.text || "";

  // Parse JSON from response, stripping any accidental markdown fences
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const parsed = JSON.parse(cleaned);

  return Response.json({
    developed_premise: parsed.developed_premise,
    book_type: parsed.book_type || book_type,
    market_notes: parsed.market_notes,
  });
});