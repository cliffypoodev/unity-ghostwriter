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
    p += `\n\nBANNED CONSTRUCTION — NEVER USE:\nThe phrase pattern "[verb] sent [noun/sensation] [direction] [body part or system]" is strictly forbidden.\nExamples of what NOT to write:\n- "sent electricity crackling through his arm"\n- "sent shockwaves through his nervous system"\n- "sent sparks racing up his spine"\n- "sent ripples through his consciousness"\n- "sent heat flooding through her"\nInstead, describe the sensation directly and specifically. Make it concrete and unique to this moment.\nBAD: "The touch sent electricity crackling up Marcus's arm."\nGOOD: "His arm tingled where Zephyr's finger had been — not like static shock, more like the moment before a storm breaks."\nEvery sensation must be earned individually. Do not use templates.`;
    p += `\n\nREPETITION BUDGET — ENFORCE PER CHAPTER:\n"amber eyes": max 2 | "silver blood": max 2 | "predatory"/"predator": max 2 | "crystalline": max 1 | "harmonics"/"resonat-": max 2 | "alien": max 3 | "scaled"/"scales": max 3 | "possessive": max 1 | "bond"/"bonded": max 6 | "nervous system": max 1\nIf a phrase hits its budget, rewrite the moment from a different sensory angle — do not swap in a synonym.`;
    if (spec?.protagonist_core_wound || spec?.protagonist_self_belief || spec?.protagonist_secret_desire) {
      const w = spec.protagonist_core_wound || 'not specified', b = spec.protagonist_self_belief || 'not specified', d = spec.protagonist_secret_desire || 'not specified', pp = spec.protagonist_life_purpose || 'not specified';
      p += `\n\nPROTAGONIST INTERIOR CONTEXT:\nBefore this story, the protagonist believed their life was for: ${pp}.\nCore wound: ${w}\nHidden self-belief: ${b}\nWhat the bond offers that they could never ask for: ${d}\n>=1 scene beat per chapter must connect plot to wound, belief, or desire through action/subtext — never stated outright.`;
    }
    p += `\n\nEMOTIONAL ACCUMULATION — MANDATORY:\nThe protagonist cannot process every escalation with the same emotional response. Each major event must leave a visible mark on the protagonist's psychology.\nBefore writing: "What is the protagonist carrying INTO Chapter ${chapter.chapter_number} that they weren't carrying before?"\nShow as concrete BEHAVIOR SHIFT, not stated feeling.\nBAD: "Marcus felt overwhelmed by everything that had happened."\nGOOD: "He caught himself checking the door twice before sitting down — a new habit he hadn't had yesterday."\nChanged behavior, altered speech patterns, shifted perception. Do NOT reset protagonist to baseline between chapters.`;
    p += `\n\nSTYLE-REGISTER BRIDGE:\nPRE-EXPLICIT: In last ~100 words before intimate scene, increase physical specificity, reduce atmospheric abstraction, shorten sentences, compress interiority to sensation. Final pre-explicit sentence must be physical and immediate.\nDURING EXPLICIT: Maintain the established beat style. Short-medium sentences, strong active verbs, no ornate metaphors. Do NOT reset tone.\nPOST-EXPLICIT: Do NOT recap/summarize. Begin in physical aftermath (breath, temperature, weight). Let emotion emerge through behavior. Body stays present 2-3 paragraphs before abstraction returns.`;
    p += `\n\nRESOLUTION TEXTURE: In any scene where recognition, acceptance, or victory occurs — no outcome should be unanimous. At least one character must express doubt, resistance, or a complicating condition, even briefly. This is texture, not antagonism. A single dissenting voice makes consensus feel earned.`;
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