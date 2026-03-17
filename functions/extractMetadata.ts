import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const BEAT_STYLE_KEYS = [
  "fast-paced-thriller", "hyper-stylized-action", "hollywood-blockbuster", "visceral-horror", "grandiose-space-opera",
  "gritty-cinematic", "dark-suspense", "hard-boiled-noir", "urban-gritty-fantasy", "high-stakes-political",
  "epic-historical", "investigative-nonfiction", "intellectual-psychological", "cerebral-sci-fi",
  "clinical-procedural", "satirical", "surrealist-avant-garde", "clean-romance",
  "slow-burn", "nostalgic-coming-of-age", "melancholic-literary", "poetic-magical-realism",
  "faith-infused", "whimsical-cozy", "reference-educational"
];

const AI_MODEL_KEYS = [
  "claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5",
  "gpt-4o", "gpt-4-turbo", "deepseek-chat"
];

const AUTHOR_VOICE_KEYS = [
  "basic", "hemingway", "king", "austen", "tolkien", "morrison", "rowling",
  "mccarthy", "atwood", "gaiman", "pratchett", "le_guin", "vonnegut",
  "garcia_marquez", "chandler", "christie", "gladwell", "bryson", "sagan", "didion"
];

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, topic, book_type, genre } = await req.json();

    if (!projectId || !topic || !book_type) {
      return Response.json(
        { error: 'Missing required fields: projectId, topic, book_type' },
        { status: 400 }
      );
    }

    // callType: metadata_generation → resolves to Gemini Pro
    const response = await base44.integrations.Core.InvokeLLM({
      model: "gemini_3_pro",
      prompt: `Analyze the following book premise/topic and extract comprehensive structured metadata.

Topic/Premise: ${topic}
Book Type: ${book_type}
${genre ? `Genre (already set): ${genre}` : ''}

Return a JSON object with ALL of these fields:

- tone_style (string, 1-2 sentences describing the tone)
- target_audience (string, specific description of who should read this book)
- additional_requirements (string, key themes, constraints, or special considerations the author should know)
- suggested_genre (string, best matching genre if not already provided; for fiction: Fantasy, Science Fiction, Mystery, Thriller, Romance, Historical Fiction, Horror, Literary Fiction, Adventure, Dystopian, Young Adult, Crime, Magical Realism, Western, Satire; for nonfiction: Self-Help, Business, Biography, History, Science, Technology, Philosophy, Psychology, Health, Travel, Education, Politics, True Crime, Memoir, Cooking)
- suggested_subgenre (string, a specific subgenre within the genre)
- suggested_author_voice (string, pick ONE from this exact list: ${AUTHOR_VOICE_KEYS.join(", ")})
- suggested_detail_level (string, one of: minimal, moderate, comprehensive — use comprehensive for complex literary works, minimal for simple stories)
- suggested_beat_style (string, pick ONE key from this exact list that best matches the story's pacing and tone: ${BEAT_STYLE_KEYS.join(", ")})
- suggested_ai_model (string, pick ONE from: ${AI_MODEL_KEYS.join(", ")} — use claude-opus-4-5 for literary/complex fiction, claude-sonnet-4-5 for most fiction, gpt-4o for creative general fiction, deepseek-chat for fast/simple content)
- key_themes (array of strings, 3-5 main themes)

Return ONLY valid JSON, no markdown or extra text.`,
      response_json_schema: {
        type: "object",
        properties: {
          tone_style: { type: "string" },
          target_audience: { type: "string" },
          additional_requirements: { type: "string" },
          suggested_genre: { type: "string" },
          suggested_subgenre: { type: "string" },
          suggested_author_voice: { type: "string" },
          suggested_detail_level: { type: "string" },
          suggested_beat_style: { type: "string" },
          suggested_ai_model: { type: "string" },
          key_themes: { type: "array", items: { type: "string" } }
        }
      }
    });

    return Response.json(response);
  } catch (error) {
    console.error('extractMetadata error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});