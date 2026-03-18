// ═══════════════════════════════════════════════════════════════════════════════
// SHARED AI ROUTER — Single source of truth for all AI provider calls
// ═══════════════════════════════════════════════════════════════════════════════
// Standalone Deno.serve endpoint. Also inlined into each bot for direct use.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const MODEL_MAP = {
  "claude-sonnet":     { provider: "anthropic", modelId: "claude-sonnet-4-20250514", defaultTemp: 0.72, maxTokensLimit: null },
  "claude-opus":       { provider: "anthropic", modelId: "claude-opus-4-20250514",   defaultTemp: 0.72, maxTokensLimit: null },
  "claude-opus-4-5":   { provider: "anthropic", modelId: "claude-opus-4-5",          defaultTemp: 0.72, maxTokensLimit: null },
  "claude-sonnet-4-5": { provider: "anthropic", modelId: "claude-sonnet-4-5",        defaultTemp: 0.72, maxTokensLimit: null },
  "claude-haiku-4-5":  { provider: "anthropic", modelId: "claude-haiku-4-5",         defaultTemp: 0.72, maxTokensLimit: null },
  "gpt-4o":            { provider: "openai",    modelId: "gpt-4o",                   defaultTemp: 0.4,  maxTokensLimit: null },
  "gpt-4o-creative":   { provider: "openai",    modelId: "gpt-4o",                   defaultTemp: 0.9,  maxTokensLimit: null },
  "gpt-4-turbo":       { provider: "openai",    modelId: "gpt-4-turbo",              defaultTemp: 0.7,  maxTokensLimit: 4096 },
  "gemini-pro":        { provider: "google",    modelId: "gemini-2.0-flash", defaultTemp: 0.72, maxTokensLimit: null },
  "gemini-flash":      { provider: "google",    modelId: "gemini-2.0-flash-001",     defaultTemp: 0.72, maxTokensLimit: null },
  "deepseek-chat":     { provider: "deepseek",  modelId: "deepseek-chat",            defaultTemp: 0.72, maxTokensLimit: 8192 },
  "openrouter":        { provider: "openrouter", modelId: "deepseek/deepseek-chat",  defaultTemp: 0.72, maxTokensLimit: 16384 },
};

async function callAI(modelKey, systemPrompt, userMessage, options = {}) {
  const config = MODEL_MAP[modelKey] || MODEL_MAP["claude-sonnet"];
  const { provider, modelId, defaultTemp, maxTokensLimit } = config;
  const temperature = options.temperature ?? defaultTemp;
  let maxTokens = options.maxTokens ?? 8192;
  if (maxTokensLimit) maxTokens = Math.min(maxTokens, maxTokensLimit);

  if (provider === "anthropic") {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'),
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId, max_tokens: maxTokens, temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error('Anthropic error: ' + (data.error?.message || response.status));
    return data.content[0].text;
  }

  if (provider === "openai") {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + Deno.env.get('OPENAI_API_KEY'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId, max_tokens: maxTokens, temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error('OpenAI error: ' + (data.error?.message || response.status));
    return data.choices[0].message.content;
  }

  if (provider === "google") {
    const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not configured');
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + modelId + ':generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userMessage }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature, maxOutputTokens: maxTokens },
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      console.error('Google AI error response:', JSON.stringify(data));
      throw new Error('Google AI error: ' + (data.error?.message || `HTTP ${response.status}`));
    }
    if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('Google AI empty response:', JSON.stringify(data));
      throw new Error('Google AI returned empty response — possible safety filter or quota issue');
    }
    return data.candidates[0].content.parts[0].text;
  }

  if (provider === "deepseek") {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + Deno.env.get('DEEPSEEK_API_KEY'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId, max_tokens: Math.min(maxTokens, 8192), temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error('DeepSeek error: ' + (d.error?.message || r.status));
    return d.choices[0].message.content;
  }

  if (provider === "openrouter") {
    const orKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!orKey) throw new Error('OpenRouter generation failed: OPENROUTER_API_KEY not configured');
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + orKey,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://unity-ghostwriter.base44.app',
        'X-Title': 'Unity Ghostwriter',
      },
      body: JSON.stringify({
        model: modelId, max_tokens: maxTokens, temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error('OpenRouter generation failed: ' + (d.error?.message || JSON.stringify(d.error) || r.status));
    if (!d.choices?.[0]?.message?.content) throw new Error('OpenRouter generation failed: empty response');
    return d.choices[0].message.content;
  }

  throw new Error('Unknown provider: ' + provider);
}

async function callAIConversation(modelKey, messages, maxTokens = 8192, options = {}) {
  const config = MODEL_MAP[modelKey] || MODEL_MAP["claude-sonnet"];
  const { provider, modelId, defaultTemp } = config;
  const temperature = options.temperature ?? defaultTemp;

  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystemMsgs = messages.filter(m => m.role !== 'system');

  if (provider === "anthropic") {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'),
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId, max_tokens: maxTokens, temperature,
        system: systemMsg?.content || '',
        messages: nonSystemMsgs,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error('Anthropic error: ' + (data.error?.message || response.status));
    return data.content[0].text;
  }

  if (provider === "openai" || provider === "deepseek" || provider === "openrouter") {
    let url, headers;
    if (provider === "openai") {
      url = 'https://api.openai.com/v1/chat/completions';
      headers = { 'Authorization': 'Bearer ' + Deno.env.get('OPENAI_API_KEY'), 'Content-Type': 'application/json' };
    } else if (provider === "deepseek") {
      url = 'https://api.deepseek.com/v1/chat/completions';
      headers = { 'Authorization': 'Bearer ' + Deno.env.get('DEEPSEEK_API_KEY'), 'Content-Type': 'application/json' };
    } else {
      const orKey = Deno.env.get('OPENROUTER_API_KEY');
      if (!orKey) throw new Error('OPENROUTER_API_KEY not configured');
      url = 'https://openrouter.ai/api/v1/chat/completions';
      headers = { 'Authorization': 'Bearer ' + orKey, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://unity-ghostwriter.base44.app', 'X-Title': 'Unity Ghostwriter' };
    }
    const r = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature, messages }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(`${provider} error: ` + (d.error?.message || r.status));
    return d.choices?.[0]?.message?.content || '';
  }

  if (provider === "google") {
    const contents = nonSystemMsgs.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + modelId + ':generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
          generationConfig: { temperature, maxOutputTokens: maxTokens },
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) throw new Error('Google AI error: ' + (data.error?.message || response.status));
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  throw new Error('Unknown provider: ' + provider);
}

function isRefusal(text) {
  if (!text || typeof text !== 'string') return false;
  const first300 = text.slice(0, 300).toLowerCase();
  const REFUSAL_MARKERS = [
    'i cannot', 'i can\'t', 'i\'m unable', 'i am unable',
    'i must decline', 'i\'m not able', 'against my guidelines',
    'i apologize, but i', 'i\'m sorry, but i cannot',
    'as an ai', 'as a language model', 'i don\'t generate',
    'content policy', 'i\'m designed to',
  ];
  return REFUSAL_MARKERS.some(m => first300.includes(m));
}

async function safeParseJSON(raw, modelKey) {
  if (!raw) throw new Error('Empty AI response');
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  const jsonStart = cleaned.indexOf('[') !== -1 && (cleaned.indexOf('{') === -1 || cleaned.indexOf('[') < cleaned.indexOf('{'))
    ? cleaned.indexOf('[') : cleaned.indexOf('{');
  if (jsonStart > 0) cleaned = cleaned.slice(jsonStart);
  const jsonEnd = cleaned.lastIndexOf(']') !== -1 && cleaned.lastIndexOf(']') > cleaned.lastIndexOf('}')
    ? cleaned.lastIndexOf(']') + 1 : cleaned.lastIndexOf('}') + 1;
  if (jsonEnd > 0) cleaned = cleaned.slice(0, jsonEnd);
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error(`safeParseJSON failed for ${modelKey}:`, e.message, 'Raw:', raw.slice(0, 200));
    throw new Error('Failed to parse AI JSON response');
  }
}

// Expose as endpoint for diagnostics
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, model_key, system_prompt, user_message, options } = await req.json();

    if (action === 'list_models') {
      return Response.json({ models: Object.keys(MODEL_MAP) });
    }

    if (action === 'call') {
      const result = await callAI(model_key || 'claude-sonnet', system_prompt || '', user_message || '', options || {});
      return Response.json({ result });
    }

    return Response.json({ error: 'Unknown action. Use: list_models, call' }, { status: 400 });
  } catch (error) {
    console.error('shared_aiRouter error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});