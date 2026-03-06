import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze the following book premise/topic and extract structured metadata.

Topic/Premise: ${topic}
Book Type: ${book_type}
${genre ? `Genre: ${genre}` : ''}

Return a JSON object with these fields:
- tone_style (string, 1-2 sentences describing the tone)
- target_audience (string, who should read this)
- additional_requirements (string, any special considerations)
- suggested_genre (string, if not already provided or if you have a better suggestion)
- suggested_subgenre (string, a specific subgenre)
- suggested_author_voice (string, one of these voice ids: basic, hemingway, king, austen, tolkien, morrison, rowling, mccarthy, atwood, gaiman, pratchett, le_guin, vonnegut, garcia_marquez, chandler, christie, gladwell, bryson, sagan, didion)
- suggested_detail_level (string, one of: minimal, moderate, comprehensive)
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