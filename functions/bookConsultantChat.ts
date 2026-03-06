import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Anthropic from 'npm:@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, message, spec } = await req.json();
    if (!project_id || !message) return Response.json({ error: 'project_id and message required' }, { status: 400 });

    // Save user message
    await base44.entities.Conversation.create({ project_id, role: 'user', content: message });

    // Fetch existing conversation history
    const history = await base44.entities.Conversation.filter({ project_id }, 'created_date');

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

Keep responses concise and conversational. Focus on one or two key suggestions or questions at a time.`;

    // Build messages for Claude (exclude the message we just saved, only history before)
    const priorMessages = history.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
    priorMessages.push({ role: 'user', content: message });

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: priorMessages,
    });

    const assistantContent = response.content[0].text;

    // Save assistant message
    await base44.entities.Conversation.create({ project_id, role: 'assistant', content: assistantContent });

    return Response.json({ reply: assistantContent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});