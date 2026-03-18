// ═══════════════════════════════════════════════════════════════════════════════
// SHARED MODEL RESOLVER — Maps pipeline callTypes to specific AI models
// ═══════════════════════════════════════════════════════════════════════════════

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const HARDCODED_ROUTES = {
  'outline': 'gemini-pro',
  'beat_sheet': 'gemini-pro',
  'post_gen_rewrite': 'claude-sonnet',
  'consistency_check': 'claude-sonnet',
  'style_rewrite': 'claude-sonnet',
  'sfw_handoff_check': 'claude-sonnet',
  'post_explicit': 'claude-sonnet',
  'chapter_state': 'claude-sonnet',
  'character_interview': 'claude-sonnet',
  'metadata_generation': 'claude-sonnet',
  'cover_prompt': 'claude-sonnet',
  'keyword_generation': 'claude-sonnet',
  'kdp_description': 'claude-sonnet',
  'consultant_chat': 'claude-sonnet',
};

function resolveModelFn(callType, spec) {
  if (!callType) {
    console.warn('resolveModel called without callType');
    return spec?.writing_model || spec?.ai_model || 'claude-sonnet';
  }
  if (HARDCODED_ROUTES[callType]) return HARDCODED_ROUTES[callType];
  if (callType === 'explicit_scene') return 'deepseek-chat';
  if (callType === 'sfw_prose') return spec?.writing_model || spec?.ai_model || 'claude-sonnet';
  console.warn('resolveModel: unknown callType "' + callType + '"');
  return 'claude-sonnet';
}

function getModelRoutingTable(spec) {
  const table = {};
  for (const ct of Object.keys(HARDCODED_ROUTES)) {
    table[ct] = { model: HARDCODED_ROUTES[ct], source: 'hardcoded' };
  }
  table['explicit_scene'] = { model: 'deepseek-chat', source: 'hardcoded' };
  table['sfw_prose'] = {
    model: spec?.writing_model || spec?.ai_model || 'claude-sonnet',
    source: 'spec.writing_model',
  };
  return table;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const action = body.action;

  if (action === 'resolve') {
    return Response.json({ model: resolveModelFn(body.call_type, body.spec) });
  }
  if (action === 'routing_table') {
    return Response.json({ table: getModelRoutingTable(body.spec || {}) });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
});