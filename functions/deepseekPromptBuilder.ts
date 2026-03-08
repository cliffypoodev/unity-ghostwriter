// MODEL-SPECIFIC PROMPT OVERRIDE SYSTEM ════════════════════════════════════════
export function getModelPromptOverrides(modelKey) {
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

// DEEPSEEK-SPECIFIC BANNED PHRASES ═════════════════════════════════════════════
export const DEEPSEEK_BANNED_PHRASES = `Physical: "heart racing/pounding/hammering", "pulse quickened/raced", "breath hitched/caught", "swallowed hard", "shiver down spine", "a jolt/surge/rush of", "knees weak", "legs trembled", "a flicker/spark of", "igniting a fire", "fire within", "heat pooling"

Atmosphere: "intoxicating", "electric/electricity" (for mood), "palpable", "air thickened/crackled/charged/grew heavy", "shadows danced/twisted/swirled/crept", "darkness enveloped/pressed/wrapped", "tendrils of", "the weight of", "siren's call", "like a moth to a flame", "hung/lingered in the air", "thick with tension", "heavy with implication", "charged with possibility", "fraught with", "neon lights flickered", "neon glow", "neon-lit", "cast a spectrum of colors", "rain-slicked pavement", "the scent of sweat and smoke", "the metallic tang"

Narration: "in that moment", "just the beginning", "no turning back", "on the precipice/brink", "teetering on the edge", "double-edged sword", "ready to embrace/confront", "a mix/blend/cocktail of", "a kaleidoscope/whirlwind/tapestry of", "felt alive", "the world faded", "something deeper/unspoken/primal", "unspoken tension/promise", "invisible thread/force/pull", "couldn't shake/ignore the feeling", "the facade slipping/cracking", "storm brewing within", "dangerous game/dance", "thrill of the chase", "testing/pushing boundaries", "playing with fire"

Dialogue: "what do you truly want/desire", "how far are you willing to go", "let's see where this leads", "embrace your desires", "let go of your fear", "you're not like the others", "control is an illusion"

Smiles: "a knowing/playful/mischievous/teasing smile/smirk/grin/glint"`;

// DEEPSEEK SYSTEM PROMPT BUILDER ═══════════════════════════════════════════════
export function buildDeepSeekSystemPrompt(chapter, spec, beatStyle, openingType, endingType, TARGET_WORDS) {
  const beatCore = beatStyle?.name || 'Engaging and clear';
  const beatRhythm = beatStyle?.instructions ? beatStyle.instructions.split('\n')[1] : 'Well-paced prose';
  const spiceLevel = spec?.spice_level ? parseInt(spec.spice_level) : 0;
  const isErotica = spec?.genre?.toLowerCase() === 'erotica' || spiceLevel >= 3;
  
  const minWords = Math.floor(TARGET_WORDS * 0.8);
  const maxWords = Math.ceil(TARGET_WORDS * 1.2);
  
  let prompt = `You are writing Chapter ${chapter.chapter_number} of a ${spec?.genre || 'Fiction'} ${spec?.book_type || 'novel'}.

YOUR ROLE: You are the author. Write immersive prose. No commentary. No meta-text. No markdown headers. Just the chapter text.

VOICE: ${beatCore}. ${beatRhythm}.

10 HARD RULES — VIOLATION OF ANY RULE = AUTOMATIC REJECTION:

1. NO ### HEADERS. No subheadings. No bullet points. Pure prose only.

2. OPENING TYPE: ${openingType.name}. ${openingType.desc}. BANNED: atmosphere, walking, "The [noun] [verbed]...", "Imagine...".

3. ENDING TYPE: ${endingType.name}. ${endingType.desc}. BANNED: "ready to face...", "just the beginning", abstract declarations.

4. DIALOGUE LIMIT: Max 3 consecutive exchanges before a paragraph of action/description/thought.

5. NO RECYCLED STRUCTURE: Not [goes to location > encounters figure > cryptic talk > reluctant agreement > exit].

6. SHOW DON'T TELL: Not "felt [emotion]", not "a sense of", not "[emotion] flooded through". Use actions, sensory details, silence.

7. SENSORY GROUNDING: At least 2 specific sensory details per scene, unique to that location.

8. CHARACTERS ACT DIFFERENTLY: Each character has distinct speech patterns. No generic cryptic dialogue for all.

9. PLOT ADVANCEMENT: Something must change irreversibly — a decision, revelation, altered relationship, or crossed line.

10. WORD COUNT: Approximately ${TARGET_WORDS} words (${minWords}-${maxWords}).`;

  if (isErotica) {
    prompt += `\n\nGENRE REQUIREMENT: Spice level ${spiceLevel}. This chapter MUST contain intimate content. No fade-to-black. Character-driven and emotionally grounded.`;
  }

  return prompt;
}

// DEEPSEEK USER MESSAGE BUILDER ═════════════════════════════════════════════════
export function buildDeepSeekUserMessage(chapter, spec, templateNum, previousChapters, storyBible, TARGET_WORDS, transition_from, transition_to, nextChapter) {
  const spiceLevel = spec?.spice_level ? parseInt(spec.spice_level) : 0;
  const isErotica = spec?.genre?.toLowerCase() === 'erotica' || spiceLevel >= 3;
  
  const templates = [
    { name: 'CONVERGENCE', desc: 'Open in media res. Two threads alternate. Collide at midpoint. Deal with consequences. End on irreversible decision.' },
    { name: 'PRESSURE COOKER', desc: 'Open with dialogue. Single location 70%+. Tension escalates through revelation. Secret exposed. End with someone leaving.' },
    { name: 'BEFORE AND AFTER', desc: 'Open with sensory detail. First third: normalcy. Event shatters at one-third. Aftermath and adaptation. Contrast opening.' },
    { name: 'DUAL PERSPECTIVE', desc: 'Time/place + action. Alternate perspectives. Reader knows more than either character. End with dialogue (no narration after).' },
    { name: 'THE DESCENT', desc: 'Open with internal thought contradicting next action. Choice made. Each scene reveals true cost. Cannot undo.' }
  ];
  const template = templates[templateNum % templates.length];
  
  const minWords = Math.floor(TARGET_WORDS * 0.8);
  const maxWords = Math.ceil(TARGET_WORDS * 1.2);
  
  let msg = `CRITICAL: This chapter will be auto-scanned. Any banned phrase = automatic rejection. Follow every instruction exactly.`;
  
  if (isErotica) {
    msg += `\n\nGENRE: Spice level ${spiceLevel}. This chapter MUST include intimate content. Fade-to-black is NOT acceptable. Write with literary quality.`;
  }
  
  msg += `\n\n=== CHAPTER ASSIGNMENT ===\n\nWrite Chapter ${chapter.chapter_number}: "${chapter.title}"\n\nPROMPT:\n${chapter.prompt || chapter.summary || ''}\n\nSUMMARY:\n${chapter.summary || ''}`;
  
  if (transition_from) {
    msg += `\n\nPREVIOUS CHAPTER ENDED WITH:\n${transition_from}\n\nPick up from here. Do NOT repeat.`;
  }
  
  if (transition_to) {
    msg += `\n\nTHIS CHAPTER MUST END BY SETTING UP:\n${transition_to}`;
    if (nextChapter) msg += `\n\nNext chapter: "${nextChapter.title}". End to pull reader forward.`;
  }
  
  msg += `\n\n=== STRUCTURAL TEMPLATE ===\n\n${template.name}: ${template.desc}`;
  
  if (isErotica && storyBible?.characters?.length >= 2) {
    const char1 = storyBible.characters[0];
    const char2 = storyBible.characters[1];
    msg += `\n\nREQUIRED INTIMATE SCENE: ${char1.name} and ${char2.name}. At least 3 paragraphs. Place where it fits naturally.`;
  }
  
  msg += `\n\n=== STORY CONTEXT ===\n\nCHARACTERS:\n${(storyBible?.characters || []).map(c => `${c.name}: ${c.description || c.role}`).join('\n')}`;
  
  if (previousChapters && previousChapters.length > 0) {
    const prev1 = previousChapters[previousChapters.length - 1];
    const lastLines = prev1.content && !prev1.content.startsWith('http') ? prev1.content.trim().split('\n').slice(-3).join('\n') : '';
    
    msg += `\n\n=== ANTI-REPETITION ===\n\nLAST 3 PARAGRAPHS OF PREVIOUS CHAPTER:\n"${lastLines}"\n\nDo NOT echo this tone or vocabulary. Open completely differently.`;
  }
  
  msg += `\n\n=== BANNED PHRASES — USING ANY = AUTO-REJECTION ===\n\n${DEEPSEEK_BANNED_PHRASES}`;
  
  msg += `\n\n=== NOW WRITE THE CHAPTER ===\n\nBegin immediately with prose. No preamble. No headers. No "---" dividers. Just the story.`;
  
  msg += `\n\n=== SELF-CHECK ===\n\n[ ] Opens with assigned opening type\n[ ] Ends with assigned ending type\n[ ] Zero banned phrases\n[ ] Max 3 dialogue exchanges before action\n[ ] Follows structural template\n[ ] Sensory details are location-specific\n[ ] No "---" dividers\n[ ] Each character sounds different\n[ ] Word count: ${TARGET_WORDS} words (${minWords}-${maxWords})`;
  
  return msg;
}