import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Model Health Check ──
// Sends a minimal 4-part formatting test to a model and checks if it follows structure.
// Called from ModelSelector when user picks a non-Claude model.

const MODEL_MAP = {
  "claude-sonnet":     { provider: "anthropic", modelId: "claude-sonnet-4-20250514", defaultTemp: 0.72, maxTokensLimit: null },
  "claude-haiku":      { provider: "anthropic", modelId: "claude-haiku-4-5", defaultTemp: 0.72, maxTokensLimit: null },
  "gemini-flash":      { provider: "google",    modelId: "gemini-2.0-flash-001", defaultTemp: 0.72, maxTokensLimit: null },
  "gemini-pro":        { provider: "google",    modelId: "gemini-2.5-pro", defaultTemp: 0.72, maxTokensLimit: null },
  "gpt-4o":            { provider: "openai",    modelId: "gpt-4o", defaultTemp: 0.4, maxTokensLimit: null },
  "gpt-4o-mini":       { provider: "openai",    modelId: "gpt-4o-mini", defaultTemp: 0.9, maxTokensLimit: null },
  "deepseek":          { provider: "deepseek",  modelId: "deepseek-chat", defaultTemp: 0.72, maxTokensLimit: 8192 },
  "trinity":           { provider: "openrouter", modelId: "arcee-ai/trinity-large-preview:free", defaultTemp: 0.9, maxTokensLimit: null },
  "lumimaid":          { provider: "openrouter", modelId: "neversleep/llama-3-lumimaid-70b", defaultTemp: 0.92, maxTokensLimit: null },
};

async function callAIQuick(modelKey, prompt) {
  const config = MODEL_MAP[modelKey] || MODEL_MAP["claude-sonnet"];
  const { provider, modelId, defaultTemp } = config;
  const maxTokens = 512;

  if (provider === "anthropic") {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature: defaultTemp, system: 'You are a formatting test assistant.', messages: [{ role: 'user', content: prompt }] }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || r.status);
    return d.content[0].text;
  }
  if (provider === "openai") {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + Deno.env.get('OPENAI_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature: defaultTemp, messages: [{ role: 'system', content: 'You are a formatting test assistant.' }, { role: 'user', content: prompt }] }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || r.status);
    return d.choices[0].message.content;
  }
  if (provider === "google") {
    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + modelId + ':generateContent?key=' + Deno.env.get('GOOGLE_AI_API_KEY'),
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], systemInstruction: { parts: [{ text: 'You are a formatting test assistant.' }] }, generationConfig: { temperature: defaultTemp, maxOutputTokens: maxTokens } }) }
    );
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || r.status);
    return d.candidates[0].content.parts[0].text;
  }
  if (provider === "deepseek") {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + Deno.env.get('DEEPSEEK_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature: defaultTemp, messages: [{ role: 'system', content: 'You are a formatting test assistant.' }, { role: 'user', content: prompt }] }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || r.status);
    return d.choices[0].message.content;
  }
  if (provider === "openrouter") {
    const orKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!orKey) throw new Error('OPENROUTER_API_KEY not configured');
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + orKey, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://unity-ghostwriter.base44.app', 'X-Title': 'Unity Ghostwriter' },
      body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature: defaultTemp, messages: [{ role: 'system', content: 'You are a formatting test assistant.' }, { role: 'user', content: prompt }] }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || JSON.stringify(d.error) || r.status);
    return d.choices?.[0]?.message?.content || '';
  }
  throw new Error('Unknown provider');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { model_id } = await req.json().catch(() => ({}));
    if (!model_id) return Response.json({ error: 'model_id required' }, { status: 400 });

    const testPrompt = `Write exactly 4 labeled parts as shown:

1: Opening
Write 30 words of prose here.

2: Rising action
Write 30 words of prose here.

3: Climax
Write 30 words of prose here.

4: Resolution
Write 30 words of prose here.

This is a formatting test. Output only the 4 labeled parts.`;

    const startMs = Date.now();
    const result = await Promise.race([
      callAIQuick(model_id, testPrompt),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
    ]);
    const elapsedMs = Date.now() - startMs;

    const part1 = /^1\s*:/m.test(result);
    const part4 = /^4\s*:/m.test(result);
    const passed = part1 && part4;

    return Response.json({
      passed,
      modelId: model_id,
      elapsedMs,
      note: passed
        ? 'Format compliance confirmed ✓'
        : 'Model may not follow 4-part structure — retries will be more likely',
    });
  } catch (err) {
    const isTimeout = err.message === 'timeout';
    return Response.json({
      passed: false,
      modelId: '',
      note: isTimeout
        ? 'Model is slow to respond — generation may take longer than usual'
        : `Health check failed: ${err.message}`,
    });
  }
});