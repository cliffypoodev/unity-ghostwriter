// ═══════════════════════════════════════════════════════════════════════════════
// MODEL ADAPTER — Behavioral Profiles, Prompt Adaptation & Output Validation
// ═══════════════════════════════════════════════════════════════════════════════
// Section 1: MODEL_PROFILES — behavioral tendencies per model that inform
// prompt construction (part labels, word count reminders, format examples)
// and output validation (structure compliance, beat adherence expectations).
//
// Section 2+: generateChapterWithCompliance(), callAI() enhancements
// will be added in subsequent sections.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── MODEL BEHAVIOR PROFILES ─────────────────────────────────────────────────
// Each model has known behavioral tendencies. These profiles tell the adapter
// what to watch for and how to adjust prompt construction and output validation.

const MODEL_PROFILES = {

  'claude-sonnet': {
    promptStyle:       'direct',      // follows instructions as written
    structureCompliance: 'high',      // reliably outputs 4-part structure
    beatAdherence:     'high',        // follows beat sheet closely
    avgWordsPerChapter: 2600,
    temperatureDefault: 0.85,
    maxTokens:         4096,
    requiresExplicitPartLabels: false, // understands "4 parts" naturally
    requiresWordCountReminder:  false,
    requiresFormatExample:      false,
    contextSafeLimit:  180000,        // leave buffer under 200k
    timeoutMs:         90000,
  },

  'claude-haiku': {
    promptStyle:       'direct',
    structureCompliance: 'medium',    // may compress parts
    beatAdherence:     'medium',
    avgWordsPerChapter: 2000,         // tends to run short
    temperatureDefault: 0.85,
    maxTokens:         4096,
    requiresExplicitPartLabels: false,
    requiresWordCountReminder:  true, // remind it to hit 625+ per part
    requiresFormatExample:      false,
    contextSafeLimit:  180000,
    timeoutMs:         60000,
  },

  'gpt-4o': {
    promptStyle:       'direct',
    structureCompliance: 'high',
    beatAdherence:     'high',
    avgWordsPerChapter: 2500,
    temperatureDefault: 0.85,
    maxTokens:         4096,
    requiresExplicitPartLabels: true, // label the parts explicitly in prompt
    requiresWordCountReminder:  false,
    requiresFormatExample:      false,
    contextSafeLimit:  120000,
    timeoutMs:         90000,
  },

  'gpt-4o-mini': {
    promptStyle:       'direct',
    structureCompliance: 'medium',
    beatAdherence:     'medium',
    avgWordsPerChapter: 1800,         // runs noticeably short
    temperatureDefault: 0.9,
    maxTokens:         4096,
    requiresExplicitPartLabels: true,
    requiresWordCountReminder:  true,
    requiresFormatExample:      true, // show it the exact format once
    contextSafeLimit:  120000,
    timeoutMs:         60000,
  },

  'deepseek': {
    promptStyle:       'structured',  // responds better to markdown headers
    structureCompliance: 'high',      // strong instruction follower
    beatAdherence:     'high',
    avgWordsPerChapter: 2500,
    temperatureDefault: 0.85,
    maxTokens:         4096,
    requiresExplicitPartLabels: true,
    requiresWordCountReminder:  false,
    requiresFormatExample:      true, // benefits from seeing exact format
    contextSafeLimit:  155000,        // buffer under 163k
    timeoutMs:         90000,
  },

  'trinity': {
    promptStyle:       'conversational', // creative model — looser formatting
    structureCompliance: 'medium',       // may use its own structure
    beatAdherence:     'medium',
    avgWordsPerChapter: 2300,
    temperatureDefault: 0.9,
    maxTokens:         4096,
    requiresExplicitPartLabels: true,
    requiresWordCountReminder:  true,
    requiresFormatExample:      true,
    contextSafeLimit:  120000,          // buffer under 131k
    timeoutMs:         120000,          // free tier can be slow
    isFreeTier:        true,
  },

  'lumimaid': {
    promptStyle:       'conversational',
    structureCompliance: 'low',          // least reliable structure
    beatAdherence:     'low',
    avgWordsPerChapter: 2000,
    temperatureDefault: 0.92,
    maxTokens:         4096,
    requiresExplicitPartLabels: true,
    requiresWordCountReminder:  true,
    requiresFormatExample:      true,
    contextSafeLimit:  28000,            // hard buffer under 32k
    timeoutMs:         90000,
  },

};

// ── PROFILE LOOKUP ──────────────────────────────────────────────────────────
// Returns the profile for a given model ID.
// Falls back to claude-sonnet (the default/recommended model) if unknown.

function getModelProfile(modelId) {
  return MODEL_PROFILES[modelId] || MODEL_PROFILES['claude-sonnet'];
}

// ── PROMPT ADAPTATION HELPERS ───────────────────────────────────────────────
// These functions generate prompt fragments based on model behavioral profiles.
// They will be consumed by generateChapterWithCompliance() in Section 2.

function buildPartLabelBlock(profile, partCount) {
  if (!profile.requiresExplicitPartLabels) return '';
  const labels = [];
  for (let i = 1; i <= partCount; i++) {
    labels.push(`Part ${i} of ${partCount}`);
  }
  return `\n=== STRUCTURE REQUIREMENT ===\nYour chapter MUST contain exactly ${partCount} distinct parts/sections separated by scene breaks (* * *).\nLabel them internally as: ${labels.join(', ')}.\nEach part must be a complete scene — not a continuation of the previous part's mid-sentence.\n=== END STRUCTURE ===\n`;
}

function buildWordCountReminderBlock(profile, targetWords) {
  if (!profile.requiresWordCountReminder) return '';
  const perPart = Math.round(targetWords / 4);
  return `\n=== WORD COUNT REMINDER (CRITICAL) ===\nTarget: ~${targetWords} words total. Each of the 4 parts must be at least ${perPart} words.\nDo NOT compress or summarize. Inhabit each scene fully with environment, sensory detail, and interiority.\nIf a part is under ${perPart} words, you are summarizing — expand it before moving to the next part.\n=== END WORD COUNT ===\n`;
}

function buildFormatExampleBlock(profile) {
  if (!profile.requiresFormatExample) return '';
  return `\n=== OUTPUT FORMAT EXAMPLE ===\nYour output must follow this exact structure (content is illustrative only):

[First paragraph of Part 1 — mid-action opening, sensory detail...]
[... scene continues for 600+ words ...]

* * *

[First paragraph of Part 2 — new location or time shift...]
[... scene continues for 600+ words ...]

* * *

[First paragraph of Part 3 — escalation...]
[... scene continues for 600+ words ...]

* * *

[First paragraph of Part 4 — climax and ending...]
[... scene continues for 600+ words, ending on concrete image/action/dialogue ...]

No chapter titles, no scene numbers, no headers. Just prose separated by * * * markers.
=== END FORMAT EXAMPLE ===\n`;
}

// Builds all model-specific prompt adaptations as a single block
function buildModelAdaptationBlock(modelId, targetWords, partCount) {
  const profile = getModelProfile(modelId);
  let block = '';
  block += buildPartLabelBlock(profile, partCount || 4);
  block += buildWordCountReminderBlock(profile, targetWords || 2500);
  block += buildFormatExampleBlock(profile);
  return block;
}

// ── CONTEXT TRIMMING ────────────────────────────────────────────────────────
// Estimates token count and trims context to fit within model's safe limit.

function estimateTokens(text) {
  if (!text) return 0;
  // Rough estimate: 1 token ≈ 4 characters for English prose
  return Math.ceil(text.length / 4);
}

function trimToContextLimit(systemPrompt, userMessage, modelId) {
  const profile = getModelProfile(modelId);
  const limit = profile.contextSafeLimit;
  const totalTokens = estimateTokens(systemPrompt) + estimateTokens(userMessage);
  
  if (totalTokens <= limit) {
    return { systemPrompt, userMessage, trimmed: false };
  }

  // Calculate how much to trim from the user message (preserve system prompt)
  const systemTokens = estimateTokens(systemPrompt);
  const availableForUser = limit - systemTokens - 2000; // 2k safety buffer
  
  if (availableForUser < 4000) {
    // System prompt alone is too large — trim it too
    const halfLimit = Math.floor(limit / 2);
    const trimmedSystem = systemPrompt.slice(0, halfLimit * 4);
    const trimmedUser = userMessage.slice(0, halfLimit * 4);
    console.warn(`Context limit: both prompts trimmed for ${modelId} (limit: ${limit})`);
    return { systemPrompt: trimmedSystem, userMessage: trimmedUser, trimmed: true };
  }

  const maxUserChars = availableForUser * 4;
  const trimmedUser = userMessage.slice(0, maxUserChars);
  console.warn(`Context limit: user message trimmed for ${modelId} (${totalTokens} → ~${limit} tokens)`);
  return { systemPrompt, userMessage: trimmedUser, trimmed: true };
}

// ── STRUCTURE VALIDATION ────────────────────────────────────────────────────
// Post-generation: checks whether the output meets the model's expected
// structure compliance level.

function validateOutputStructure(text, modelId, expectedParts) {
  const profile = getModelProfile(modelId);
  const parts = text.split(/\*\s*\*\s*\*/);
  const issues = [];
  const partCount = parts.length;

  // Check part count
  if (expectedParts && partCount !== expectedParts) {
    if (profile.structureCompliance === 'low') {
      // Expected for low-compliance models — note but don't flag as critical
      issues.push({ type: 'structure_info', message: `${partCount} parts (expected ${expectedParts}) — typical for ${modelId}` });
    } else {
      issues.push({ type: 'structure_violation', message: `${partCount} parts instead of expected ${expectedParts}` });
    }
  }

  // Check per-part word counts
  const minPerPart = profile.structureCompliance === 'high' ? 500 : 
                     profile.structureCompliance === 'medium' ? 400 : 300;
  
  parts.forEach((part, idx) => {
    const wc = part.trim().split(/\s+/).length;
    if (wc < minPerPart) {
      issues.push({
        type: 'thin_part',
        message: `Part ${idx + 1}: ${wc} words (min ${minPerPart} for ${modelId})`,
        partIndex: idx,
        wordCount: wc,
        minimum: minPerPart,
      });
    }
  });

  // Total word count
  const totalWords = text.trim().split(/\s+/).length;
  if (totalWords < profile.avgWordsPerChapter * 0.6) {
    issues.push({
      type: 'short_output',
      message: `Total ${totalWords} words — significantly below ${modelId}'s typical ${profile.avgWordsPerChapter}`,
    });
  }

  return {
    modelId,
    partCount,
    totalWords,
    expectedCompliance: profile.structureCompliance,
    issues,
    passed: issues.filter(i => i.type !== 'structure_info').length === 0,
  };
}

// ── API ENDPOINT ────────────────────────────────────────────────────────────
// Exposes profiles and adaptation helpers for testing and introspection.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, model_id, text, target_words, part_count } = body;

    // Default: return all profiles
    if (!action || action === 'profiles') {
      return Response.json({
        profiles: MODEL_PROFILES,
        platform_order: ['Anthropic', 'OpenAI', 'OpenRouter · DeepSeek', 'OpenRouter · Arcee AI', 'OpenRouter · Lumimaid'],
      });
    }

    // Get single profile
    if (action === 'profile') {
      return Response.json({ profile: getModelProfile(model_id || 'claude-sonnet') });
    }

    // Build adaptation block for a model
    if (action === 'adaptation') {
      const block = buildModelAdaptationBlock(model_id || 'claude-sonnet', target_words || 2500, part_count || 4);
      return Response.json({ model_id: model_id || 'claude-sonnet', adaptation_block: block });
    }

    // Validate output structure
    if (action === 'validate') {
      if (!text) return Response.json({ error: 'text required for validation' }, { status: 400 });
      const result = validateOutputStructure(text, model_id || 'claude-sonnet', part_count);
      return Response.json(result);
    }

    // Context trim check
    if (action === 'trim_check') {
      const { system_prompt, user_message } = body;
      const result = trimToContextLimit(system_prompt || '', user_message || '', model_id || 'claude-sonnet');
      return Response.json({
        model_id: model_id || 'claude-sonnet',
        trimmed: result.trimmed,
        system_length: result.systemPrompt.length,
        user_length: result.userMessage.length,
      });
    }

    return Response.json({ error: 'Unknown action. Use: profiles, profile, adaptation, validate, trim_check' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});