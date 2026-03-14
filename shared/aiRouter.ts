// ═══════════════════════════════════════════════════════════════════════════════
// SHARED AI ROUTER — Single source of truth for all AI provider calls
// ═══════════════════════════════════════════════════════════════════════════════
// Extracted from: writeChapter.ts (lines 7–83), generateScenes.ts (lines 4–77),
// generateChapterState.ts (lines 16–52)
//
// RULE: No other file in this project may contain a MODEL_MAP or direct
// provider fetch call. Every AI call routes through callAI() from this module.
// ═══════════════════════════════════════════════════════════════════════════════

export const MODEL_MAP = {
  "claude-sonnet":     { provider: "anthropic", modelId: "claude-sonnet-4-20250514", defaultTemp: 0.72, maxTokensLimit: null },
  "claude-opus":       { provider: "anthropic", modelId: "claude-opus-4-20250514",   defaultTemp: 0.72, maxTokensLimit: null },
  "claude-opus-4-5":   { provider: "anthropic", modelId: "claude-opus-4-5",          defaultTemp: 0.72, maxTokensLimit: null },
  "claude-sonnet-4-5": { provider: "anthropic", modelId: "claude-sonnet-4-5",        defaultTemp: 0.72, maxTokensLimit: null },
  "claude-haiku-4-5":  { provider: "anthropic", modelId: "claude-haiku-4-5",         defaultTemp: 0.72, maxTokensLimit: null },
  "gpt-4o":            { provider: "openai",    modelId: "gpt-4o",                   defaultTemp: 0.4,  maxTokensLimit: null },
  "gpt-4o-creative":   { provider: "openai",    modelId: "gpt-4o",                   defaultTemp: 0.9,  maxTokensLimit: null },
  "gpt-4-turbo":       { provider: "openai",    modelId: "gpt-4-turbo",              defaultTemp: 0.7,  maxTokensLimit: 4096 },
  "gemini-pro":        { provider: "google",    modelId: "gemini-2.5-pro-preview-03-25", defaultTemp: 0.72, maxTokensLimit: null },
  "gemini-flash":      { provider: "google",    modelId: "gemini-2.0-flash-001",     defaultTemp: 0.72, maxTokensLimit: null },
  "deepseek-chat":     { provider: "deepseek",  modelId: "deepseek-chat",            defaultTemp: 0.72, maxTokensLimit: 8192 },
  "openrouter":        { provider: "openrouter", modelId: "deepseek/deepseek-chat",  defaultTemp: 0.72, maxTokensLimit: 16384 },
};

/**
 * Unified AI call — routes to the correct provider based on modelKey.
 * @param {string} modelKey - Key from MODEL_MAP (e.g. 'claude-sonnet', 'gemini-pro')
 * @param {string} systemPrompt - System/instruction prompt
 * @param {string} userMessage - User message / chapter request
 * @param {object} options - { temperature?, maxTokens?, timeout? }
 * @returns {Promise<string>} Raw text response from the AI
 */
export async function callAI(modelKey, systemPrompt, userMessage, options = {}) {
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

/**
 * Multi-turn conversation call — for retry loops that need prior context.
 * Uses the same routing as callAI but accepts a full messages array.
 * @param {string} modelKey
 * @param {{ role: string, content: string }[]} messages - Full conversation
 * @param {number} maxTokens
 * @param {object} options
 * @returns {Promise<string>}
 */
export async function callAIConversation(modelKey, messages, maxTokens = 8192, options = {}) {
  const config = MODEL_MAP[modelKey] || MODEL_MAP["claude-sonnet"];
  const { provider, modelId, defaultTemp } = config;
  const temperature = options.temperature ?? defaultTemp;

  // Extract system message if present
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

  // OpenAI, DeepSeek, OpenRouter all use the same messages format
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
    // Google uses contents format — convert messages
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
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  throw new Error('Unknown provider for conversation: ' + provider);
}

/**
 * Detect AI refusal patterns in generated text.
 * @param {string} text
 * @returns {boolean}
 */
export function isRefusal(text) {
  if (!text || text.trim().length < 50) return true;
  const REFUSAL_INDICATORS = [
    "i can't", "i cannot", "i'm not able", "i apologize", "i'm sorry, but",
    "as an ai", "as a language model", "i'm unable to", "i must decline",
    "content policy", "against my guidelines", "i'd prefer not", "i can't generate",
    "not appropriate", "i won't be able", "i need to decline",
  ];
  const lower = text.slice(0, 500).toLowerCase();
  return REFUSAL_INDICATORS.some(r => lower.includes(r));
}

/**
 * Clean JSON from AI response — strips markdown fences, trailing commas, auto-closes brackets.
 * @param {string} text
 * @returns {string}
 */
export function cleanJSON(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  cleaned = cleaned.replace(/,\s*}/g, '}');
  cleaned = cleaned.replace(/,\s*]/g, ']');
  if (!cleaned.endsWith('}') && !cleaned.endsWith(']')) {
    const openBraces = (cleaned.match(/{/g) || []).length;
    const closeBraces = (cleaned.match(/}/g) || []).length;
    const openBrackets = (cleaned.match(/\[/g) || []).length;
    const closeBrackets = (cleaned.match(/]/g) || []).length;
    for (let i = 0; i < openBrackets - closeBrackets; i++) cleaned += ']';
    for (let i = 0; i < openBraces - closeBraces; i++) cleaned += '}';
  }
  return cleaned;
}

/**
 * Parse JSON with AI-assisted repair fallback.
 * @param {string} text - Raw AI response that should be JSON
 * @param {string} modelKey - Model to use for repair if needed
 * @returns {Promise<any>}
 */
export async function safeParseJSON(text, modelKey) {
  const cleaned = cleanJSON(text);
  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    console.warn('safeParseJSON first attempt failed:', e1.message, '— attempting AI repair...');
  }
  try {
    const repaired = await callAI(
      modelKey,
      'You are a JSON repair tool. Return ONLY valid JSON. No explanation, no markdown.',
      `Fix this malformed JSON and return only the corrected JSON:\n\n${cleaned}`,
      { maxTokens: 4000, temperature: 0.0 }
    );
    return JSON.parse(cleanJSON(repaired));
  } catch {
    throw new Error('The AI returned an invalid response. Please click Retry.');
  }
}

/**
 * Model detection helpers — used by bots to apply model-specific behavior.
 */
export function isGptModel(mk) { return /^gpt-/.test(mk || ''); }
export function isDeepseekModel(mk) { return /^deepseek/.test(mk || ''); }
export function isGeminiModel(mk) { return /^gemini/.test(mk || '') || (MODEL_MAP[mk]?.provider === 'google'); }
export function isOpenRouterModel(mk) { return mk === 'openrouter' || (MODEL_MAP[mk]?.provider === 'openrouter'); }
