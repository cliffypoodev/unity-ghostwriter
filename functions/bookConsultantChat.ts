import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const MODEL_MAP = {
  "claude-sonnet":     { provider: "anthropic", modelId: "claude-sonnet-4-20250514" },
  "claude-opus":       { provider: "anthropic", modelId: "claude-opus-4-20250514" },
  "claude-opus-4-5":   { provider: "anthropic", modelId: "claude-opus-4-5" },
  "claude-sonnet-4-5": { provider: "anthropic", modelId: "claude-sonnet-4-5" },
  "claude-haiku-4-5":  { provider: "anthropic", modelId: "claude-haiku-4-5" },
  "gpt-4o":            { provider: "openai",    modelId: "gpt-4o" },
  "gpt-4-turbo":       { provider: "openai",    modelId: "gpt-4-turbo" },
  "deepseek-chat":     { provider: "deepseek",  modelId: "deepseek-chat" },
};

async function callChat(modelKey, systemPrompt, messages) {
  // callType: consultant_chat → resolves to Claude Sonnet (uses spec's ai_model for now)
  const config = MODEL_MAP[modelKey] || MODEL_MAP["claude-sonnet"];
  const { provider, modelId } = config;

  if (provider === "anthropic") {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, max_tokens: 1024, temperature: 0.7, system: systemPrompt, messages }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error('Anthropic error: ' + (data.error?.message || response.status));
    return data.content[0].text;
  }

  if (provider === "openai") {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + Deno.env.get('OPENAI_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, max_tokens: 1024, temperature: 0.7, messages: [{ role: 'system', content: systemPrompt }, ...messages] }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error('OpenAI error: ' + (data.error?.message || response.status));
    return data.choices[0].message.content;
  }

  if (provider === "deepseek") {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + Deno.env.get('DEEPSEEK_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, max_tokens: 1024, temperature: 0.7, messages: [{ role: 'system', content: systemPrompt }, ...messages] }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error('DeepSeek error: ' + (data.error?.message || response.status));
    return data.choices[0].message.content;
  }

  throw new Error('Unknown provider: ' + provider);
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

    // callType: consultant_chat → always resolves to Claude Sonnet (never user's prose model)
    const modelKey = 'claude-sonnet';

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

    // Build messages for Claude (exclude the message we just saved, only history before)
    const priorMessages = history.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
    priorMessages.push({ role: 'user', content: message });

    const assistantContent = await callChat(modelKey, systemPrompt, priorMessages);

    // Save assistant message
    await base44.entities.Conversation.create({ project_id, role: 'assistant', content: assistantContent });

    return Response.json({ reply: assistantContent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});