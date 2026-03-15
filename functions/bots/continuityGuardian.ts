// ═══════════════════════════════════════════════════════════════════════════════
// BOT 3 — CONTINUITY GUARDIAN
// ═══════════════════════════════════════════════════════════════════════════════
// One job: Read raw prose against story bible, outline, and previous state docs.
// Find every continuity violation. Return a verdict with targeted fixes.
// READ-ONLY — does not modify prose. Returns fixes for Style Enforcer to apply.
//
// Replaces: consistencyCheck.ts, validatePermanentRules(), checkCompositeFigureFraming(),
// buildCharacterConsistencyBlock(), buildAllegianceShiftBlock(), buildCapabilitiesBlock(),
// validateActTransition() from modelAdapter.ts
// ═══════════════════════════════════════════════════════════════════════════════

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { callAI, isRefusal } from '../shared/aiRouter.ts';
import { resolveModel } from '../shared/resolveModel.ts';
import { loadProjectContext, getChapterContext, resolveContent } from '../shared/dataLoader.ts';

// ── REGEX-BASED CHECKS (no AI needed) ───────────────────────────────────────

/** Check pronoun consistency against story bible characters. */
function checkPronounConsistency(text, characters) {
  const violations = [];
  const genderMap = {};
  for (const char of characters) {
    if (!char.name) continue;
    const p = char.pronouns ? char.pronouns.toLowerCase() : (/\bshe\b|\bgirl\b|\bwoman\b/i.test(char.description || '') ? 'she' : 'he');
    genderMap[char.name] = p.includes('she') ? 'she' : p.includes('they') ? 'they' : 'he';
  }
  for (const [charName, expected] of Object.entries(genderMap)) {
    const rx = new RegExp(`\\b${charName}\\b[^.!?]*?(he|she|they)\\b`, 'gi');
    const mentions = [...text.matchAll(rx)];
    if (mentions.length > 2) {
      const pronounsUsed = new Set(mentions.map(m => m[1].toLowerCase()));
      if (pronounsUsed.size > 1) {
        violations.push({
          type: 'pronoun_mismatch',
          severity: 'critical',
          character: charName,
          description: `Uses ${[...pronounsUsed].join('/')} but should be ${expected}`,
          location: mentions[0][0].slice(0, 50),
        });
      }
    }
  }
  return violations;
}

/** Check for composite characters that need disclosure framing (nonfiction). */
function checkCompositeFigureFraming(text, chNum, storyBible) {
  const violations = [];
  const chars = storyBible?.characters || [];
  const triggers = [];
  for (const c of chars) {
    if (/composite|amalgam|representative|drawn from|reconstructed/i.test((c.description || '') + ' ' + (c.role || ''))) {
      triggers.push(c.name);
    }
  }
  for (const name of triggers) {
    if (!text.includes(name)) continue;
    if (!/composite|represents|drawn from|based on records|reconstructed from/i.test(text)) {
      violations.push({
        type: 'composite_unframed',
        severity: 'warning',
        character: name,
        description: `Composite character "${name}" in Ch ${chNum} — needs disclosure on first mention`,
        location: text.slice(text.indexOf(name), text.indexOf(name) + 60),
      });
    }
  }
  return violations;
}

/** Check that act bridge state is reflected in chapter opening. */
function checkActTransition(text, lastStateDoc, chapterNumber) {
  if (!lastStateDoc) return [];
  const violations = [];

  // Extract character names from state doc
  const namePattern = /\b([A-Z][a-z]{2,})\b(?=.*(?:location|state|condition|position|status))/g;
  const bridgeNames = [...lastStateDoc.matchAll(namePattern)].map(m => m[1]);
  const openingWords = text.slice(0, 3000);
  const anyNamePresent = bridgeNames.some(name => openingWords.includes(name));

  if (bridgeNames.length > 0 && !anyNamePresent) {
    violations.push({
      type: 'act_transition_break',
      severity: 'warning',
      character: bridgeNames.slice(0, 3).join(', '),
      description: `Chapter ${chapterNumber} opening doesn't reflect prior state — none of tracked characters appear in opening`,
      location: openingWords.slice(0, 80),
    });
  }
  return violations;
}

/** Check character capabilities aren't exceeded. */
function checkCapabilities(text, storyBible) {
  const violations = [];
  const chars = storyBible?.characters || [];
  for (const c of chars) {
    if (!c.capabilities_under_pressure || !c.name) continue;
    const cap = c.capabilities_under_pressure;
    if (cap.combat_training === 'None' || cap.combat_training === 'none') {
      // Check if this non-combatant is doing combat things
      const combatRx = new RegExp(`\\b${c.name}\\b[^.!?]{0,100}\\b(punched|kicked|fought|struck|slashed|blocked|dodged|parried|disarmed)\\b`, 'gi');
      const matches = [...text.matchAll(combatRx)];
      if (matches.length > 0) {
        violations.push({
          type: 'capability_exceeded',
          severity: 'warning',
          character: c.name,
          description: `${c.name} (combat: None) appears to perform combat actions`,
          location: matches[0][0].slice(0, 80),
        });
      }
    }
  }
  return violations;
}

/** Check that non-human physical traits are ACTIVELY used in intimate scenes, not just decorative. */
function checkNonHumanPhysiologyActiveUse(text, storyBible, spec) {
  const violations = [];
  const spiceLevel = parseInt(spec?.spice_level) || 0;
  if (spiceLevel < 3) return violations; // Only check in explicit content

  // Find non-human characters
  const nhKeywords = /alien|creature|dragon|vampire|werewolf|fae|demon|shifter|monster|serpent|reptil|hybrid|non.?human|xeno|orc|naga|lamia|symbiote|mer(man|maid|folk)|drakmori|scaled/i;
  const chars = storyBible?.characters || [];
  const nhChars = chars.filter(c => nhKeywords.test((c.description || '') + ' ' + (c.role || '')));
  if (nhChars.length === 0) return violations;

  // Check if there's an intimate scene (look for common intimate indicators)
  const intimateIndicators = /\b(kiss|thrust|moan|gasp|naked|undress|arousal|orgasm|climax|intimate|bed|sheets|skin to skin|straddl|penetrat|tongue|lips on|mouth on)\b/gi;
  const intimateMatches = text.match(intimateIndicators) || [];
  if (intimateMatches.length < 3) return violations; // Not an intimate scene

  // Check if species-specific traits are ACTIVE (not just visual/mentioned)
  const activeTraitPatterns = [
    /scales?\s+(against|on|pressed|dragg|slid|scraped|brushed|grazed|rubbed)/gi,
    /claws?\s+(traced|dragged|scraped|pressed|dug|raked|gripped|hooked)/gi,
    /\b(forked|split)\s+tongue/gi,
    /temperature\s+(difference|contrast|shift)/gi,
    /(cool|cold|hot|warm)\s+scales?\s+(against|on|pressed)/gi,
    /\btail\b.{0,40}(wrapped|curled|stroked|pressed|squeezed|coiled)/gi,
    /bioluminescen/gi,
    /purr(ed|ing)?\s+(through|vibrat|against|into)/gi,
  ];

  let activeTraitCount = 0;
  for (const rx of activeTraitPatterns) {
    if (rx.test(text)) activeTraitCount++;
    rx.lastIndex = 0;
  }

  if (activeTraitCount < 3) {
    violations.push({
      type: 'nh_physiology_decorative',
      severity: 'critical',
      character: nhChars.map(c => c.name).join(', '),
      description: `Intimate scene has only ${activeTraitCount}/3 required active non-human physical traits. Species-specific physiology must be FELT, not just SEEN. Scales, claws, temperature, tail, etc. must create specific tactile sensations during intimacy.`,
      location: 'Full chapter intimate scene',
    });
  }

  return violations;
}

/** Check for nonfiction subject overlap with other chapters in the outline. */
function checkSubjectDeduplication(text, chapterNumber, outlineData) {
  const violations = [];
  if (!outlineData?.chapters) return violations;

  // Find which major figures/topics this chapter covers extensively
  const MAJOR_FIGURES = ['Hughes', 'Monroe', 'Marilyn', 'Mannix', 'Hopper', 'Parsons', 'Warner', 'Mayer', 'Cohn', 'Wasserman'];
  const chapters = outlineData.chapters;
  const thisChapter = chapters.find(c => (c.number || c.chapter_number) === chapterNumber);
  if (!thisChapter) return violations;

  for (const figure of MAJOR_FIGURES) {
    const rx = new RegExp(`\\b${figure}\\b`, 'gi');
    const countInText = (text.match(rx) || []).length;
    if (countInText < 5) continue; // Not a major presence

    // Check if another chapter has this figure as its PRIMARY subject (in the title)
    for (const otherCh of chapters) {
      const otherNum = otherCh.number || otherCh.chapter_number;
      if (otherNum === chapterNumber) continue;
      if ((otherCh.title || '').includes(figure)) {
        violations.push({
          type: 'subject_overlap',
          severity: 'warning',
          character: figure,
          description: `"${figure}" appears ${countInText}x in Ch ${chapterNumber}, but Ch ${otherNum} ("${otherCh.title}") is their dedicated chapter. Limit to 1-2 paragraphs here — save detailed coverage for the dedicated chapter.`,
          location: `${figure} mentioned ${countInText} times`,
        });
      }
    }
  }

  return violations;
}

// ── AI-POWERED DEEP CHECK ───────────────────────────────────────────────────

async function runAIConsistencyCheck(text, ctx, chCtx) {
  const { storyBible, outlineData } = ctx;
  const { chapter, outlineEntry, lastStateDoc } = chCtx;
  const characters = storyBible?.characters || [];

  const charSummary = characters.map(c =>
    `- ${c.name}: ${c.role || 'unknown'}, ${c.description || 'no desc'}. Pronouns: ${c.pronouns || 'not set'}`
  ).join('\n');

  const outlineSummary = outlineEntry ?
    `Title: "${outlineEntry.title || chapter.title}"\nKey events: ${JSON.stringify(outlineEntry.key_events || outlineEntry.key_beats || [])}\nSummary: ${outlineEntry.summary || 'N/A'}` :
    'No outline entry';

  const modelKey = resolveModel('consistency_check', ctx.spec);

  const systemPrompt = `You are a manuscript continuity checker. Read the chapter and compare it against the verification document. List every contradiction, missing element, or continuity error.

Output ONLY a JSON array of violations. If no violations, return an empty array [].

Each violation object:
{
  "type": "pronoun_mismatch|character_missing|timeline_break|backstory_contradiction|allegiance_unacknowledged|dead_character_appears|plot_deviation",
  "severity": "critical|warning",
  "character": "affected character name or null",
  "description": "what's wrong",
  "location": "first ~50 chars of the offending passage",
  "suggested_fix": "how to fix it"
}`;

  const userMessage = `VERIFICATION DOCUMENT:

CHARACTERS:
${charSummary || 'No characters defined'}

OUTLINE FOR THIS CHAPTER:
${outlineSummary}

${lastStateDoc ? `PREVIOUS CHAPTER STATE:\n${lastStateDoc}\n` : ''}

CHAPTER ${chapter.chapter_number}: "${chapter.title}"
${text.slice(0, 12000)}`;

  try {
    const raw = await callAI(modelKey, systemPrompt, userMessage, { maxTokens: 2048, temperature: 0.2 });
    if (isRefusal(raw)) return [];
    try {
      const parsed = JSON.parse(raw.replace(/^```json\n?/, '').replace(/\n?```$/, ''));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  } catch (err) {
    console.warn('AI consistency check failed (non-blocking):', err.message);
    return [];
  }
}

// ── MAIN BOT ────────────────────────────────────────────────────────────────

async function runContinuityGuardian(base44, projectId, chapterId, rawProse) {
  const startMs = Date.now();
  const ctx = await loadProjectContext(base44, projectId);
  const chCtx = getChapterContext(ctx, chapterId);
  const characters = ctx.storyBible?.characters || [];

  const text = rawProse || await resolveContent(chCtx.chapter.content);
  if (!text || text.length < 100) {
    return { passed: true, violations: [], suggested_fixes: [], chapter_id: chapterId, duration_ms: Date.now() - startMs };
  }

  // Collect all violations from regex checks
  const allViolations = [
    ...checkPronounConsistency(text, characters),
    ...checkCompositeFigureFraming(text, chCtx.chapter.chapter_number, ctx.storyBible),
    ...checkActTransition(text, chCtx.lastStateDoc, chCtx.chapter.chapter_number),
    ...checkCapabilities(text, ctx.storyBible),
  ];

  // AI deep check
  const aiViolations = await runAIConsistencyCheck(text, ctx, chCtx);
  for (const v of aiViolations) {
    // Deduplicate — don't add if we already caught it
    const isDupe = allViolations.some(existing =>
      existing.type === v.type && existing.character === v.character
    );
    if (!isDupe) allViolations.push(v);
  }

  // Build suggested fixes from AI violations that include them
  const suggestedFixes = aiViolations
    .filter(v => v.suggested_fix)
    .map((v, i) => ({
      violation_index: allViolations.findIndex(av => av.description === v.description),
      original_text: v.location || '',
      replacement_text: v.suggested_fix,
      confidence: v.severity === 'critical' ? 'high' : 'medium',
    }));

  const hasCritical = allViolations.some(v => v.severity === 'critical');

  return {
    passed: !hasCritical,
    violations: allViolations,
    suggested_fixes: suggestedFixes,
    chapter_id: chapterId,
    duration_ms: Date.now() - startMs,
  };
}

// ── DENO SERVE ENDPOINT ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, chapter_id, raw_prose } = await req.json();
    if (!project_id || !chapter_id) {
      return Response.json({ error: 'project_id and chapter_id required' }, { status: 400 });
    }

    const result = await runContinuityGuardian(base44, project_id, chapter_id, raw_prose);
    return Response.json(result);

  } catch (error) {
    console.error('continuityGuardian error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
