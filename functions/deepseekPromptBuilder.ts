// MODEL-SPECIFIC PROMPT OVERRIDE SYSTEM
function getModelPromptOverrides(modelKey) {
  if (modelKey === 'deepseek-chat' || modelKey === 'deepseek-reasoner') {
    return {
      wrapSystemPrompt: true,
      duplicateRulesInUser: true,
      useNumberedSteps: true,
      addSelfCheckBlock: true,
      maxSystemPromptLength: 3000,
      prefixUserMessage: true,
      temperatureOverride: 0.7
    };
  }
  return {
    wrapSystemPrompt: false,
    duplicateRulesInUser: false,
    useNumberedSteps: false,
    addSelfCheckBlock: false,
    maxSystemPromptLength: null,
    prefixUserMessage: false,
    temperatureOverride: null
  };
}

const DEEPSEEK_BANNED_PHRASES = `Physical: "heart racing/pounding/hammering", "pulse quickened/raced", "breath hitched/caught", "swallowed hard", "shiver down spine", "a jolt/surge/rush of", "knees weak", "legs trembled", "a flicker/spark of", "igniting a fire", "fire within", "heat pooling"

Atmosphere: "intoxicating", "electric/electricity" (for mood), "palpable", "air thickened/crackled/charged/grew heavy", "shadows danced/twisted/swirled/crept", "darkness enveloped/pressed/wrapped", "tendrils of", "the weight of", "siren's call", "like a moth to a flame", "hung/lingered in the air", "thick with tension", "heavy with implication", "charged with possibility", "fraught with"

Narration: "in that moment", "just the beginning", "no turning back", "on the precipice/brink", "double-edged sword", "ready to embrace/confront", "felt alive", "the world faded", "something deeper/unspoken", "unspoken tension/promise", "invisible thread/force/pull"`;

function buildDeepSeekSystemPrompt(chapter, spec, beatStyle, openingType, endingType, TARGET_WORDS) {
  const beatCore = beatStyle?.name || 'Clear prose';
  const spiceLevel = spec?.spice_level ? parseInt(spec.spice_level) : 0;
  const isErotica = spec?.genre?.toLowerCase() === 'erotica' || spiceLevel >= 3;
  const minWords = Math.floor(TARGET_WORDS * 0.8);
  const maxWords = Math.ceil(TARGET_WORDS * 1.2);
  
  let p = `You are writing Chapter ${chapter.chapter_number} of a ${spec?.genre || 'Fiction'} ${spec?.book_type || 'novel'}.

YOUR ROLE: Write immersive prose. No commentary. No headers. Just the chapter text.

VOICE: ${beatCore}.

10 HARD RULES — VIOLATION = REJECTION:

1. NO ### HEADERS. No bullet points. Pure prose only.

2. OPENING: ${openingType.name}. ${openingType.desc}. BANNED: atmosphere, walking, "The [noun] [verbed]...", "Imagine...".

3. ENDING: ${endingType.name}. ${endingType.desc}. BANNED: "ready to face...", "just the beginning", abstract declarations.

4. DIALOGUE: Max 3 consecutive exchanges before action/description paragraph.

5. STRUCTURE: Not [goes to location > meets figure > cryptic talk > reluctant agreement > exit].

6. SHOW DON'T TELL: Not "felt [emotion]". Use actions, sensory details, silence.

7. SENSORY: At least 2 specific sensory details per scene, unique to location.

8. CHARACTER VOICES: Each character has distinct speech patterns.

9. PLOT: Something must change irreversibly — decision, revelation, relationship altered, line crossed.

10. WORD COUNT: ${TARGET_WORDS} words (${minWords}-${maxWords}).`;

  if (isErotica) {
    p += `\n\nGENRE: Spice ${spiceLevel}. This chapter MUST contain intimate content. No fade-to-black.`;
  }
  return p;
}

function buildDeepSeekUserMessage(chapter, spec, templateNum, previousChapters, storyBible, TARGET_WORDS, trans_from, trans_to, nextCh) {
  const spiceLevel = spec?.spice_level ? parseInt(spec.spice_level) : 0;
  const isErotica = spec?.genre?.toLowerCase() === 'erotica' || spiceLevel >= 3;
  
  const templates = [
    'CONVERGENCE: Open in media res. Two threads alternate. Collide at midpoint. Consequences in second half.',
    'PRESSURE COOKER: Open with dialogue. Single location 70%+. Tension through revelation. Secret exposed.',
    'BEFORE AND AFTER: Open sensory. First third: normalcy. Event shatters at one-third. Aftermath follows.',
    'DUAL PERSPECTIVE: Time/place + action. Alternate perspectives. Reader knows more than either character.',
    'THE DESCENT: Open with contradicting thought. Choice made. Each scene reveals true cost.'
  ];
  const template = templates[templateNum % templates.length];
  const minWords = Math.floor(TARGET_WORDS * 0.8);
  const maxWords = Math.ceil(TARGET_WORDS * 1.2);
  
  let m = `CRITICAL: Any banned phrase = auto-rejection. Follow every instruction exactly.`;
  if (isErotica) m += `\n\nGENRE: Spice ${spiceLevel}. This chapter MUST include intimate content. No fade-to-black.`;
  
  m += `\n\n=== CHAPTER ===\n\nChapter ${chapter.chapter_number}: "${chapter.title}"\n\nPROMPT:\n${chapter.prompt || chapter.summary || ''}`;
  if (trans_from) m += `\n\nPREVIOUS CHAPTER ENDED:\n${trans_from}\n\nPick up from here. Do NOT repeat.`;
  if (trans_to) m += `\n\nEND THIS CHAPTER BY:\n${trans_to}`;
  
  m += `\n\n=== STRUCTURE ===\n\n${template}`;
  if (isErotica && storyBible?.characters?.length >= 2) {
    m += `\n\nREQUIRED: Intimate scene between ${storyBible.characters[0].name} and ${storyBible.characters[1].name}. 3+ paragraphs.`;
  }
  
  m += `\n\n=== CONTEXT ===\n\nCHARACTERS:\n${(storyBible?.characters || []).map(c => `${c.name}: ${c.role}`).join('\n')}`;
  if (previousChapters?.length > 0) {
    const last = previousChapters[previousChapters.length - 1];
    const tail = last.content && !last.content.startsWith('http') ? last.content.trim().split('\n').slice(-2).join('\n') : '';
    if (tail) m += `\n\nPREVIOUS ENDING:\n"${tail}"\n\nDo NOT echo this tone. Open completely differently.`;
  }
  
  m += `\n\n=== BANNED PHRASES ===\n\n${DEEPSEEK_BANNED_PHRASES}`;
  m += `\n\n=== WRITE THE CHAPTER ===\n\nBegin immediately with prose. No preamble. No headers. No "---" dividers. Just the story.`;
  m += `\n\n=== CHECKS ===\n\n[ ] Correct opening type\n[ ] Correct ending type\n[ ] Zero banned phrases\n[ ] Max 3 dialogue exchanges before action\n[ ] Follows structural template\n[ ] Location-specific sensory details\n[ ] No dividers\n[ ] ~${TARGET_WORDS} words`;
  
  return m;
}

export { getModelPromptOverrides, DEEPSEEK_BANNED_PHRASES, buildDeepSeekSystemPrompt, buildDeepSeekUserMessage };