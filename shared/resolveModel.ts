// ═══════════════════════════════════════════════════════════════════════════════
// SHARED MODEL RESOLVER — Maps pipeline callTypes to specific AI models
// ═══════════════════════════════════════════════════════════════════════════════
// Extracted from: writeChapter.ts line 4
//
// RULE: Every AI call in the pipeline must declare a callType. The resolver
// maps that callType to a specific model. The user's Phase 1 model selection
// (spec.writing_model) ONLY affects callType 'sfw_prose'. All other callTypes
// are hardcoded to prevent cross-phase contamination.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Phase Isolation Map — which model handles which pipeline stage.
 * 
 * PHASE 1 (Specification): developIdea, expandPremise, bookConsultantChat
 *   → Uses spec.writing_model (user's choice) — NOT managed here
 * 
 * PHASE 2 (Outline/Structure): outline, beat_sheet, scene generation
 *   → Always gemini-pro (structural, not prose)
 * 
 * PHASE 3 (Generation): sfw_prose, explicit_scene
 *   → sfw_prose uses spec.writing_model; explicit_scene uses deepseek-chat
 * 
 * PHASE 4 (Quality): post_gen_rewrite, consistency_check, style_rewrite
 *   → Always claude-sonnet (best at following complex correction instructions)
 * 
 * PHASE 5 (State): chapter_state, metadata_generation
 *   → Always claude-sonnet
 */

const HARDCODED_ROUTES = {
  // Phase 2 — Structural
  outline:              'gemini-pro',
  beat_sheet:           'gemini-pro',

  // Phase 4 — Quality / Post-generation
  post_gen_rewrite:     'claude-sonnet',
  consistency_check:    'claude-sonnet',
  style_rewrite:        'claude-sonnet',
  sfw_handoff_check:    'claude-sonnet',
  post_explicit:        'claude-sonnet',

  // Phase 5 — State & Metadata
  chapter_state:        'claude-sonnet',
  character_interview:  'claude-sonnet',
  metadata_generation:  'claude-sonnet',
  cover_prompt:         'claude-sonnet',
  keyword_generation:   'claude-sonnet',
  kdp_description:      'claude-sonnet',
  consultant_chat:      'claude-sonnet',
};

/**
 * Resolve the model to use for a given pipeline callType.
 * 
 * @param {string} callType - Pipeline stage identifier
 * @param {object} spec - Project specification (for writing_model lookup)
 * @returns {string} Model key from MODEL_MAP in aiRouter.ts
 */
export function resolveModel(callType, spec) {
  try {
    if (!callType) {
      console.warn('resolveModel called without callType — defaulting to claude-sonnet');
      return spec?.writing_model || spec?.ai_model || 'claude-sonnet';
    }

    // Check hardcoded routes first (phases 2, 4, 5)
    if (HARDCODED_ROUTES[callType]) {
      return HARDCODED_ROUTES[callType];
    }

    // Phase 3 — explicit scene routing
    if (callType === 'explicit_scene') {
      return 'deepseek-chat';
    }

    // Phase 3 — standard prose uses the user's selected model
    if (callType === 'sfw_prose') {
      return spec?.writing_model || spec?.ai_model || 'claude-sonnet';
    }

    console.warn(`resolveModel: unknown callType "${callType}" — defaulting to claude-sonnet`);
    return 'claude-sonnet';

  } catch (e) {
    console.warn('resolveModel error:', e.message);
    return 'claude-sonnet';
  }
}

/**
 * Get all registered callTypes and their current model assignments.
 * Useful for diagnostics and the admin panel.
 */
export function getModelRoutingTable(spec) {
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
