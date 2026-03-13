import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Phase 1 metadata_generation — hardcoded to Claude Sonnet. Never changes.
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

async function callAI(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic error: ${err}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { topic, book_type, genre } = await req.json();
    if (!topic?.trim()) return Response.json({ error: 'topic required' }, { status: 400 });

    const prompt = `You are a developmental editor and publishing strategist.
A user has entered a book premise. Expand it into a detailed creative brief AND extract structured metadata.

User's Premise: "${topic}"
Book Type: ${book_type}
Genre: ${genre || 'to be determined'}

Return ONLY a valid JSON object — no markdown fences, no backticks, no explanation. Raw JSON only.

{
  "expanded_brief": "A 500-800 word creative brief with PREMISE, MAIN CHARACTERS (named, with descriptions), SETTING, CENTRAL CONFLICT, PLOT TRAJECTORY, THEMES, KEY SCENES, and TONE. Format as readable prose with clear section headers.",

  "subgenre": "specific subgenre or empty string",
  "beat_style": "one of: fast-paced-thriller, gritty-cinematic, hollywood-blockbuster, slow-burn, literary-drama, cozy-warmth, epic-sweep, dark-atmospheric, satirical-sharp, romantic-tension",
  "detail_level": "minimal or moderate or comprehensive",
  "chapter_count": 20,

  "target_audience": {
    "selected": "single best-fit label from: [Adult General, Adult Literary, Adult Commercial, Women's Fiction, Men's Interest, Young Adult 14-18, New Adult 18-25, Middle Grade 10-13, Children 6-10, LGBTQ+, Academic, Professional, Spiritual/Religious, True Crime Enthusiasts, History Buffs, Sci-Fi & Fantasy Fans, Romance Readers, Thriller Readers, Business Professionals, Self-Improvement Seekers]",
    "secondary": "second best-fit label from the same list or empty string",
    "reasoning": "one sentence explaining why this audience fits"
  },

  "author_voice": {
    "selected": "single best-fit ID from: [basic, hemingway, austen, morrison, mccarthy, vonnegut, didion, tolkien, rowling, leguin, gaiman, pratchett, chandler, christie, marquez, atwood, king, gladwell, bryson, sagan]. Map: basic=neutral, hemingway=terse/understated, austen=witty/ironic, morrison=lyrical/poetic, mccarthy=sparse/biblical, vonnegut=absurdist/darkly-humorous, didion=cool/precise, tolkien=mythic/elevated, rowling=accessible/whimsical, leguin=sparse/philosophical, gaiman=mythic/modern, pratchett=satirical/comedic, chandler=hardboiled/cynical, christie=puzzle-box/clean, marquez=lush/sprawling, atwood=sharp/sardonic, king=conversational/dread-building, gladwell=narrative-driven/counterintuitive, bryson=humorous/curious, sagan=awe-inspiring/poetic",
    "reasoning": "one sentence explaining why this voice fits the genre and tone"
  }
}

INFERENCE RULES:
- target_audience: infer from genre, subject matter, tone, and demographic signals.
  Example: dark fantasy with adult themes → "Adult Commercial" primary, "Sci-Fi & Fantasy Fans" secondary.
- author_voice: infer from genre + tone. Return an ID, not a label.
  Example: investigative nonfiction → "gladwell" or "didion"
  Example: cozy romance → "rowling" or "austen"
  Example: hard sci-fi thriller → "leguin" or "mccarthy"
  Example: horror → "king"
  Example: literary fiction → "morrison" or "didion"
  Example: fantasy → "tolkien" or "gaiman"
  Example: mystery → "chandler" or "christie"
- chapter_count: standard novel 20, short nonfiction 12, epic 30, self-help 10-15
- The expanded_brief must be rich, detailed prose — not bullet points.
- Do not invent plot details not present or strongly implied by the premise.`;

    const response = await callAI(prompt);

    // Parse JSON, stripping accidental markdown fences
    const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('JSON parse failed, raw:', response.slice(0, 500));
      // Fallback: try to extract expanded_brief at minimum
      const briefMatch = cleaned.match(/"expanded_brief"\s*:\s*"([\s\S]*?)(?:"\s*[,}])/);
      return Response.json({
        expanded_brief: briefMatch ? briefMatch[1] : topic,
        subgenre: '',
        beat_style: '',
        detail_level: 'moderate',
        chapter_count: 20,
        target_audience: { selected: 'Adult General', secondary: '', reasoning: '' },
        author_voice: { selected: 'basic', reasoning: '' },
      });
    }

    return Response.json({
      expanded_brief: parsed.expanded_brief || topic,
      subgenre: parsed.subgenre || '',
      beat_style: parsed.beat_style || '',
      detail_level: parsed.detail_level || 'moderate',
      chapter_count: parsed.chapter_count || 20,
      target_audience: {
        selected: parsed.target_audience?.selected || 'Adult General',
        secondary: parsed.target_audience?.secondary || '',
        reasoning: parsed.target_audience?.reasoning || '',
      },
      author_voice: {
        selected: parsed.author_voice?.selected || 'Cinematic & Propulsive',
        reasoning: parsed.author_voice?.reasoning || '',
      },
    });
  } catch (error) {
    console.error('expandPremise error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});