// ═══════════════════════════════════════════════════════════════════════════════
// MODEL ADAPTER — Behavioral Profiles, Prompt Adaptation & Output Validation
// ═══════════════════════════════════════════════════════════════════════════════
// Section 1: MODEL_PROFILES — behavioral tendencies per model that inform
// prompt construction (part labels, word count reminders, format examples)
// and output validation (structure compliance, beat adherence expectations).
//
// Section 2A: PROMPT ADAPTER — adjusts prompt framing per model's behavioral
// profile (header style, format example, word count reminder, part labels,
// context trimming with act bridge truncation).
// Section 3+: generateChapterWithCompliance(), callAI() enhancements
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

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2A — PROMPT ADAPTER
// Adjusts the chapter prompt based on the model's profile before sending.
// Same prompt intent, different framing per model.
// ══════════════════════════════════════════════════════════════════════════════

// ── FORMAT EXAMPLE — shown to models that need it ───────────────────────────
const FORMAT_EXAMPLE = `EXACT OUTPUT FORMAT — FOLLOW THIS PRECISELY:

1: [Your Part 1 subtitle here]
[Part 1 prose — 625+ words]

2: [Your Part 2 subtitle here]
[Part 2 prose — 625+ words]

3: [Your Part 3 subtitle here]
[Part 3 prose — 625+ words]

4: [Your Part 4 subtitle here]
[Part 4 prose — 625+ words]

RULES:
- Part labels are exactly "1:", "2:", "3:", "4:" followed by a short subtitle
- Each part is 625 words minimum — do not cut short
- Chapter heading appears only before Part 1, never repeated
- No author notes, commentary, or meta-text anywhere in output
- No "self-check completed" or similar annotations
- Write prose only — nothing but the story`;

// ── WORD COUNT REMINDER — injected for models that run short ────────────────
const WORD_COUNT_REMINDER = `WORD COUNT IS MANDATORY:
- Each of the 4 parts must be at LEAST 625 words
- Total chapter must reach 2,500 words minimum
- If you finish a part under 625 words, continue writing
- Do not summarize or compress — fully develop each scene`;

// ── HEADER BUILDERS — different framing styles per model type ────────────────

// Structured header for models that respond better to markdown (DeepSeek)
function buildStructuredHeader(chapter, project) {
  return `## TASK
Write Chapter ${chapter.number || chapter.chapter_number}: "${chapter.title}"

## BOOK CONTEXT
- Title: ${project.title || project.name || 'Untitled'}
- Genre: ${project.genre || 'Fiction'}
- Beat Style: ${project.beat_style || project.tone_style || 'Not specified'}
- Language Intensity: ${project.language_intensity || 0}/4

## BEAT SHEET`;
}

// Direct header for models that handle instructions naturally (Claude, GPT-4o)
function buildDirectHeader(chapter, project) {
  return `You are writing a chapter for a ${project.genre || 'fiction'} book.

BOOK: "${project.title || project.name || 'Untitled'}"
BEAT STYLE: ${project.beat_style || project.tone_style || 'Not specified'}
LANGUAGE INTENSITY: ${project.language_intensity || 0}/4

CHAPTER ${chapter.number || chapter.chapter_number}: ${chapter.title}
BEAT SHEET:`;
}

// Conversational header for creative models (Trinity, Lumimaid)
function buildConversationalHeader(chapter, project) {
  return `Write the next chapter of this ${project.genre || 'fiction'} book.

The book is called "${project.title || project.name || 'Untitled'}".
Beat style: ${project.beat_style || project.tone_style || 'Not specified'}.
Language intensity: ${project.language_intensity || 0} out of 4.

You're writing Chapter ${chapter.number || chapter.chapter_number}: "${chapter.title}".
Here's what needs to happen in this chapter:`;
}

// ── ACT BRIDGE TRIMMER — truncates the largest optional block first ──────────
function trimActBridgeIfNeeded(prompt, safeLimit) {
  const tokenEstimate = Math.round(prompt.length / 4);
  if (tokenEstimate <= safeLimit) return prompt;

  // Find and truncate the act bridge block (matches both naming patterns)
  const bridgePatterns = [
    { start: 'ACT CONTINUITY BRIDGE:', endMarker: '\n\nCHAPTER ' },
    { start: '═══════════════════════════════════════════════\nACT', endMarker: '═══════════════════════════════════════════════\nThe above' },
  ];

  for (const { start, endMarker } of bridgePatterns) {
    const bridgeStart = prompt.indexOf(start);
    if (bridgeStart === -1) continue;
    const bridgeEnd = prompt.indexOf(endMarker, bridgeStart + start.length);
    if (bridgeEnd === -1) continue;

    const bridge = prompt.slice(bridgeStart, bridgeEnd);
    // Keep first 800 chars of bridge
    const trimmedBridge = bridge.slice(0, 800) + '\n[Bridge truncated for context limit]';
    const result = prompt.slice(0, bridgeStart) + trimmedBridge + prompt.slice(bridgeEnd);
    console.warn(`trimActBridge: trimmed ${bridge.length - 800} chars from act bridge`);
    return result;
  }

  return prompt;
}

// ── MAIN PROMPT ADAPTER ─────────────────────────────────────────────────────
// Takes a base prompt (system or user), chapter info, project spec, and model ID.
// Returns the adapted prompt with model-specific framing adjustments.
// Never throws — returns basePrompt on any error.

function adaptPromptForModel(basePrompt, chapter, project, modelId) {
  try {
    const profile = getModelProfile(modelId);
    let adapted = basePrompt;

    // 1. Replace header style based on promptStyle
    //    Only applies if the base prompt contains a recognizable direct-style header
    if (profile.promptStyle === 'structured' && chapter && project) {
      const directHeader = buildDirectHeader(chapter, project);
      const structHeader = buildStructuredHeader(chapter, project);
      if (adapted.includes(directHeader)) {
        adapted = adapted.replace(directHeader, structHeader);
      }
    } else if (profile.promptStyle === 'conversational' && chapter && project) {
      const directHeader = buildDirectHeader(chapter, project);
      const convHeader = buildConversationalHeader(chapter, project);
      if (adapted.includes(directHeader)) {
        adapted = adapted.replace(directHeader, convHeader);
      }
    }
    // 'direct' style — no header change needed

    // 2. Inject format example if required
    if (profile.requiresFormatExample) {
      adapted = adapted + '\n\n' + FORMAT_EXAMPLE;
    }

    // 3. Inject word count reminder if required
    if (profile.requiresWordCountReminder) {
      adapted = adapted + '\n\n' + WORD_COUNT_REMINDER;
    }

    // 4. Make part labels extra explicit if required
    if (profile.requiresExplicitPartLabels) {
      adapted = adapted.replace(
        /deliver in 4 parts/gi,
        'deliver in EXACTLY 4 parts, each labeled "1:", "2:", "3:", "4:" at the start'
      );
    }

    // 5. Trim to context safe limit if needed
    const tokenEstimate = Math.round(adapted.length / 4);
    if (tokenEstimate > profile.contextSafeLimit) {
      console.warn(`adaptPromptForModel: prompt ~${tokenEstimate} tokens may exceed ${modelId} limit ${profile.contextSafeLimit}`);
      adapted = trimActBridgeIfNeeded(adapted, profile.contextSafeLimit);
    }

    return adapted;

  } catch (err) {
    console.warn('adaptPromptForModel failed:', err.message);
    return basePrompt; // Always return something — never throw
  }
}

// ── LEGACY HELPERS (kept for Section 1 API compatibility) ───────────────────

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

// Builds all model-specific prompt adaptations as a single block (Section 1 API)
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
    const { action, model_id, text, target_words, part_count, base_prompt, chapter, project } = body;

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