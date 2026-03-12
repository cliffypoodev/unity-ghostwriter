import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function callAI(systemPrompt, messages) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      temperature: 0.8,
      system: systemPrompt,
      messages,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error('Anthropic error: ' + (data.error?.message || response.status));
  return data.content[0].text;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, project_id, character_name, character_description, question, conversation_history, premise, genre } = await req.json();

    if (action === 'interview') {
      // Regular interview response
      const systemPrompt = `You are now embodying a fictional character for a creative interview. Stay in character completely for all responses. Answer every question as this character would answer it — from inside their psychology, using their voice, from their perspective.

Character: ${character_name}
Description: ${character_description}
Story context: ${premise || 'Not specified'}
Genre: ${genre || 'Not specified'}

Rules:
- Never break character to explain yourself
- If a question doesn't fit the character's worldview, answer it anyway — resistance reveals character
- Speak in first person always
- Your answers should reveal psychology, not just plot facts
- Contradict yourself when the character would
- Show what the character is afraid to admit

The user will ask you questions. Answer as ${character_name}.`;

      // Build messages from conversation history
      const messages = (conversation_history || []).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
      messages.push({ role: 'user', content: question });

      const response = await callAI(systemPrompt, messages);
      return Response.json({ response: response.trim() });
    }

    if (action === 'summarize') {
      // End interview — generate character summary
      const systemPrompt = "You are a writing assistant. Extract a character summary from an interview transcript.";

      const transcript = (conversation_history || []).map(msg => 
        `${msg.role === 'user' ? 'INTERVIEWER' : character_name.toUpperCase()}: ${msg.content}`
      ).join('\n\n');

      const userMessage = `Based on this character interview, extract the following and return as structured text:

CHARACTER SUMMARY FOR STORY BIBLE:
- Name:
- Core fear:
- Core desire:
- Fatal flaw:
- Speech pattern:
- One secret:
- How they'd surprise the reader:

Interview transcript:
${transcript}`;

      const messages = [{ role: 'user', content: userMessage }];
      const summary = await callAI(systemPrompt, messages);
      return Response.json({ summary: summary.trim() });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Character interview error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});