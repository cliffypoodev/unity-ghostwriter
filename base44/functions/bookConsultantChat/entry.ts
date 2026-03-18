import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function callChat(systemPrompt, messages) {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set');

  // Gemini expects a single user turn or alternating roles — flatten history into one user message
  const historyText = messages.map(m => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`).join('\n\n');

  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: historyText }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error('Google: ' + (data.error?.message || r.status));
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, message, spec } = await req.json();
    if (!project_id || !message) return Response.json({ error: 'project_id and message required' }, { status: 400 });

    // Save user message
    await base44.entities.Conversation.create({ project_id, role: 'user', content: message });

    // Fetch conversation history and source files in parallel
    const [history, sourceFiles, specRecords] = await Promise.all([
      base44.entities.Conversation.filter({ project_id }, 'created_date'),
      base44.entities.SourceFile.filter({ project_id }),
      base44.entities.Specification.filter({ project_id }),
    ]);

    // Build source files context
    const sourceFilesContext = sourceFiles.length > 0
      ? `\n\nSource files provided by the author:\n${sourceFiles.map(f =>
          `--- ${f.filename} (${f.file_type})${f.description ? ': ' + f.description : ''} ---\n${f.content}`
        ).join('\n\n')}`
      : '';

    // Build system prompt with current spec context
    const specContext = spec ? `
Current book specification:
- Book Type: ${spec.book_type || 'not set'}
- Genre: ${spec.genre || 'not set'}
- Topic/Premise: ${spec.topic || 'not set'}
- Target Length: ${spec.target_length || 'not set'}
- Detail Level: ${spec.detail_level || 'not set'}
- Target Audience: ${spec.target_audience || 'not set'}
- Tone & Style: ${spec.tone_style || 'not set'}
- Additional Requirements: ${spec.additional_requirements || 'none'}
` : 'No specification has been filled in yet.';

    const systemPrompt = `You are an expert book development consultant with deep knowledge of publishing, storytelling, and the writing craft. Your role is to help authors refine their book concepts and specifications.

You should:
- Ask thoughtful clarifying questions to help define the book's direction
- Suggest appropriate genres, subgenres, and comparable titles
- Recommend suitable target lengths based on the genre and story complexity
- Help identify the target audience and appropriate tone
- Provide specific, actionable suggestions to improve the concept
- Be encouraging and enthusiastic about the author's ideas

${specContext}

Keep responses concise and conversational. Focus on one or two key suggestions or questions at a time.${sourceFilesContext}`;

    // Build messages for Gemini
    const priorMessages = history.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
    priorMessages.push({ role: 'user', content: message });

    const assistantContent = await callChat(systemPrompt, priorMessages);

    // Save assistant message
    await base44.entities.Conversation.create({ project_id, role: 'assistant', content: assistantContent });

    return Response.json({ reply: assistantContent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});