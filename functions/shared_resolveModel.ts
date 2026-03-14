// ═══════════════════════════════════════════════════════════════════════════════
// SHARED MODEL RESOLVER — Maps pipeline callTypes to specific AI models
// ═══════════════════════════════════════════════════════════════════════════════

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const HARDCODED_ROUTES = {
  outline: 'gemini-pro',
  beat_sheet: 'gemini-pro',
  post_gen_rewrite: 'claude-sonnet',
  consistency_check: 'claude-sonnet',
  style_rewrite: 'claude-sonnet',
  sfw_handoff_check: 'claude-sonnet',
  post_explicit: 'claude-sonnet',
  chapter_state: 'claude-sonnet',
  character_interview: 'claude-sonnet',
  metadata_generation: 'claude-sonnet',
  cover_prompt: 'claude-sonnet',
  keyword_generation: 'claude-sonnet',
  kdp_description: 'claude-sonnet',
  consultant_chat: 'claude-sonnet',
};

function resolveModel(callType, spec) {
  try {
    if (!callType) {
      console.warn('resolveModel called without callType — defaulting to claude-sonnet');
      return spec?.writing_model || spec?.ai_model || 'claude-sonnet';
    }
    if (HARDCODED_ROUTES[callType]) return HARDCODED_ROUTES[callType];
    if (callType === 'explicit_scene') return 'deepseek-chat';
    if (callType === 'sfw_prose') return spec?.writing_model || spec?.ai_model || 'claude-sonnet';
    console.warn(`resolveModel: unknown callType "${callType}" — defaulting to claude-sonnet`);
    return 'claude-sonnet';
  } catch (e) {
    console.warn('resolveModel error:', e.message);
    return 'claude-sonnet';
  }
}

function getModelRoutingTable(spec) {
  const table = {};
  for (const [callType, model] of Object.entries(HARDCODED_ROUTES)) {
    table[callType] = { model, source: 'hardcoded' };
  }
  table['explicit_scene'] = { model: 'deepseek-chat', source: 'hardcoded' };
  table['sfw_prose'] = {
    model: spec?.writing_model || spec?.ai_model || 'claude-sonnet',
    source: 'spec.writing_model',
  };
  return table;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, call_type, spec } = await req.json();

    if (action === 'resolve') {
      return Response.json({ model: resolveModel(call_type, spec) });
    }
    if (action === 'routing_table') {
      return Response.json({ table: getModelRoutingTable(spec || {}) });
    }

    return Response.json({ error: 'Unknown action. Use: resolve, routing_table' }, { status: 400 });
  } catch (error) {
    console.error('shared_resolveModel error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});