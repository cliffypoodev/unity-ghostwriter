// DEEPSEEK-SPECIFIC BANNED PHRASES
// These are added to the standard banned phrase list ONLY when the selected model is a DeepSeek variant

export const DEEPSEEK_BANNED_PHRASES = {
  atmosphere: [
    "neon lights flickered", "neon glow", "neon-lit", "neon signs flickered", "cast a spectrum of colors", "cast distorted shadows",
    "rain-slicked pavement", "the hum of neon", "the buzz of neon", "casting vibrant colors", "casting an eerie glow",
    "illuminating their path", "the scent of sweat and smoke", "the metallic tang", "industrial smoke"
  ],
  narration: [
    "the stakes were higher than ever", "the stakes were rising", "steeling herself", "steeled herself",
    "determination settling", "determination igniting", "resolve hardening", "resolve solidifying", "resolve crystallized",
    "her instincts flared", "his instincts flared", "instincts kicked in", "instincts on high alert", "senses heightened",
    "senses on alert", "senses sharpened", "adrenaline coursing", "adrenaline surging", "urgency sharpening",
    "the gravity of", "the burden of her choices", "the weight of her decision", "the implications of", "the complexity of",
    "caught in the web", "stepping into the fray", "carve her own path", "forge her own path"
  ],
  dialogue: [
    "i can handle myself", "we need to act quickly", "we need to be careful", "this isn't a game", "this isn't your world",
    "what are you doing here", "i didn't expect to find you here", "stay close", "follow my lead", "trust is earned",
    "i won't let anyone", "i'm not here to play games", "where do we go", "what's the plan", "count me in", "i'm in",
    "are you in this for power"
  ],
  transition: [
    "as they moved deeper into the night", "the neon glow dimmed", "signaling a deeper immersion", "ready to tackle whatever challenges",
    "the path ahead was fraught with", "the choices she made now would shape", "in ways she couldn't yet comprehend",
    "the echoes of", "pressing down on her", "settling over her like a cloak"
  ],
  ending: [
    "her journey was only just beginning", "the final confrontation was just beginning", "the possibilities stretched out",
    "ready to confront whatever awaited", "prepared to carve her own path", "the scent of", "clung to her", "a reminder of the chaos",
    "the night was still young"
  ]
};

// Helper to merge DeepSeek bans into standard ban lists
export function mergeDeepSeekBans(bannedPhrases) {
  bannedPhrases.atmosphereClichés.push(...DEEPSEEK_BANNED_PHRASES.atmosphere);
  bannedPhrases.narrationClichés.push(...DEEPSEEK_BANNED_PHRASES.narration);
  bannedPhrases.dialogueClichés.push(...DEEPSEEK_BANNED_PHRASES.dialogue);
  bannedPhrases.narrationClichés.push(...DEEPSEEK_BANNED_PHRASES.transition);
  bannedPhrases.endingPatterns.push(...DEEPSEEK_BANNED_PHRASES.ending);
  return bannedPhrases;
}