// DEEPSEEK-SPECIFIC BANNED PHRASES - Constant data only
// These are added to the standard banned phrase list ONLY when the selected model is a DeepSeek variant

const DEEPSEEK_BANNED_PHRASES_ATMOSPHERE = [
  "neon lights flickered", "neon glow", "neon-lit", "neon signs flickered", "cast a spectrum of colors", "cast distorted shadows",
  "rain-slicked pavement", "the hum of neon", "the buzz of neon", "casting vibrant colors", "casting an eerie glow",
  "illuminating their path", "the scent of sweat and smoke", "the metallic tang", "industrial smoke"
];

const DEEPSEEK_BANNED_PHRASES_NARRATION = [
  "the stakes were higher than ever", "the stakes were rising", "steeling herself", "steeled herself",
  "determination settling", "determination igniting", "resolve hardening", "resolve solidifying", "resolve crystallized",
  "her instincts flared", "his instincts flared", "instincts kicked in", "instincts on high alert", "senses heightened",
  "senses on alert", "senses sharpened", "adrenaline coursing", "adrenaline surging", "urgency sharpening",
  "the gravity of", "the burden of her choices", "the weight of her decision", "the implications of", "the complexity of",
  "caught in the web", "stepping into the fray", "carve her own path", "forge her own path"
];

const DEEPSEEK_BANNED_PHRASES_DIALOGUE = [
  "i can handle myself", "we need to act quickly", "we need to be careful", "this isn't a game", "this isn't your world",
  "what are you doing here", "i didn't expect to find you here", "stay close", "follow my lead", "trust is earned",
  "i won't let anyone", "i'm not here to play games", "where do we go", "what's the plan", "count me in", "i'm in",
  "are you in this for power"
];

const DEEPSEEK_BANNED_PHRASES_TRANSITION = [
  "as they moved deeper into the night", "the neon glow dimmed", "signaling a deeper immersion", "ready to tackle whatever challenges",
  "the path ahead was fraught with", "the choices she made now would shape", "in ways she couldn't yet comprehend",
  "the echoes of", "pressing down on her", "settling over her like a cloak"
];

const DEEPSEEK_BANNED_PHRASES_ENDING = [
  "her journey was only just beginning", "the final confrontation was just beginning", "the possibilities stretched out",
  "ready to confront whatever awaited", "prepared to carve her own path", "the scent of", "clung to her", "a reminder of the chaos",
  "the night was still young"
];

Deno.serve(async (req) => {
  return Response.json({
    atmosphere: DEEPSEEK_BANNED_PHRASES_ATMOSPHERE,
    narration: DEEPSEEK_BANNED_PHRASES_NARRATION,
    dialogue: DEEPSEEK_BANNED_PHRASES_DIALOGUE,
    transition: DEEPSEEK_BANNED_PHRASES_TRANSITION,
    ending: DEEPSEEK_BANNED_PHRASES_ENDING
  });
});