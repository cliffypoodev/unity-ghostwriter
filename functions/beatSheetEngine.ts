import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── BEAT SHEET TEMPLATES ──────────────────────────────────────────────────────
const BEAT_SHEET_TEMPLATES = {
  "save-the-cat": {
    name: "Save the Cat — Hollywood Structure",
    category: "fiction",
    beats: [
      { position: 0,    name: "Opening Image",       fn: "SETUP",              scene_type: "scene",  tempo: "medium", desc: "Establish the protagonist's world BEFORE the story changes it. Show their flaw, their normal life, what they stand to lose." },
      { position: 0.07, name: "Theme Stated",         fn: "SETUP",              scene_type: "sequel", tempo: "slow",   desc: "Someone (not the protagonist) hints at the book's deeper theme. The protagonist doesn't understand it yet." },
      { position: 0.10, name: "Setup Continued",      fn: "SETUP",              scene_type: "scene",  tempo: "medium", desc: "Introduce supporting cast, world rules, protagonist's desire vs need." },
      { position: 0.15, name: "Catalyst",             fn: "DISRUPTION",         scene_type: "scene",  tempo: "fast",   desc: "The inciting incident. Something the protagonist CANNOT ignore. Not a choice — an event." },
      { position: 0.20, name: "Debate",               fn: "REACTION",           scene_type: "sequel", tempo: "slow",   desc: "Protagonist resists the call. Internal conflict. Process, dilemma, decision." },
      { position: 0.25, name: "Break Into Two",       fn: "COMMITMENT",         scene_type: "scene",  tempo: "fast",   desc: "Protagonist makes an ACTIVE CHOICE to enter the new world. Must be a decision, not something that happens TO them." },
      { position: 0.30, name: "B-Story Begins",       fn: "SUBPLOT",            scene_type: "scene",  tempo: "medium", desc: "Introduce or deepen the B-story. Different tone from A-story." },
      { position: 0.35, name: "Fun & Games A",        fn: "PROMISE_OF_PREMISE", scene_type: "scene",  tempo: "fast",   desc: "Deliver what the genre PROMISES. Erotica = intimacy. Thriller = danger. Romance = chemistry." },
      { position: 0.42, name: "Fun & Games B",        fn: "PROMISE_OF_PREMISE", scene_type: "scene",  tempo: "fast",   desc: "Escalate from Fun & Games A. Stakes rising but haven't crashed yet." },
      { position: 0.50, name: "Midpoint",             fn: "REVERSAL",           scene_type: "scene",  tempo: "fast",   desc: "Major turning point. False victory or false defeat. New information changes everything." },
      { position: 0.55, name: "Bad Guys Close In",    fn: "ESCALATION",         scene_type: "scene",  tempo: "fast",   desc: "External pressure intensifies. Allies waver. Protagonist's flaws cause real problems." },
      { position: 0.65, name: "All Is Lost",          fn: "CRISIS",             scene_type: "scene",  tempo: "fast",   desc: "The lowest point. Something irreversible — death, betrayal, loss. Protagonist worse off than at the start." },
      { position: 0.70, name: "Dark Night of the Soul",fn: "REFLECTION",        scene_type: "sequel", tempo: "slow",   desc: "REACTION chapter. Grief, anger, denial. NO new characters, NO new plot. Must be SLOW." },
      { position: 0.80, name: "Break Into Three",     fn: "RECOMMITMENT",       scene_type: "scene",  tempo: "medium", desc: "Protagonist understands the theme. Chooses a new approach requiring growth." },
      { position: 0.90, name: "Finale",               fn: "CLIMAX",             scene_type: "scene",  tempo: "fast",   desc: "All threads converge. Protagonist proves they've changed by acting differently than Chapter 1." },
      { position: 1.00, name: "Final Image",          fn: "RESOLUTION",         scene_type: "sequel", tempo: "slow",   desc: "Mirror of Opening Image showing transformation. Single resonant image or moment." },
    ]
  },
  "romance-arc": {
    name: "Romance Arc — Relationship-Driven",
    category: "fiction",
    beats: [
      { position: 0,    name: "Separate Worlds",      fn: "SETUP",              scene_type: "scene",  tempo: "medium", desc: "Establish both leads separately. Show what each is missing. Introduce emotional wounds." },
      { position: 0.08, name: "The Meeting",           fn: "DISRUPTION",         scene_type: "scene",  tempo: "fast",   desc: "Leads meet. FRICTION, not instant love. Physical awareness noted but not acted on." },
      { position: 0.15, name: "Forced Proximity",      fn: "ESCALATION",         scene_type: "scene",  tempo: "medium", desc: "Circumstance throws them together. Chemistry builds through friction." },
      { position: 0.22, name: "Walls Up",              fn: "REACTION",           scene_type: "sequel", tempo: "slow",   desc: "One or both pull back. Past wounds surface. Reader sees WHY they resist." },
      { position: 0.30, name: "First Surrender",       fn: "PROMISE_OF_PREMISE", scene_type: "scene",  tempo: "fast",   desc: "Genuine vulnerability or physical intimacy breaks through walls. For erotica: first real intimate scene." },
      { position: 0.38, name: "Deepening",             fn: "PROMISE_OF_PREMISE", scene_type: "scene",  tempo: "medium", desc: "Relationship deepens. Shared experiences bond them. Intimacy escalates." },
      { position: 0.45, name: "The Lie Exposed",       fn: "REVERSAL",           scene_type: "scene",  tempo: "fast",   desc: "Secret or external force threatens the relationship. Trust tested." },
      { position: 0.50, name: "Midpoint Shift",        fn: "REVERSAL",           scene_type: "sequel", tempo: "slow",   desc: "Relationship nature fundamentally changes. Both acknowledge this is no longer casual." },
      { position: 0.60, name: "Escalation & Stakes",   fn: "ESCALATION",         scene_type: "scene",  tempo: "fast",   desc: "External pressures compound. Intimacy more intense but emotionally complicated." },
      { position: 0.70, name: "The Break",             fn: "CRISIS",             scene_type: "scene",  tempo: "fast",   desc: "Relationship shatters. Must feel EARNED. Both devastated differently." },
      { position: 0.78, name: "Alone Again",           fn: "REFLECTION",         scene_type: "sequel", tempo: "slow",   desc: "Both process loss separately. Mirror opening — alone again but WORSE." },
      { position: 0.85, name: "The Realization",       fn: "RECOMMITMENT",       scene_type: "sequel", tempo: "medium", desc: "One or both realize what they must change. Emotional wound confronted directly." },
      { position: 0.92, name: "Grand Gesture / Reunion",fn: "CLIMAX",           scene_type: "scene",  tempo: "fast",   desc: "Reunion. Vulnerable gesture proves change. For erotica: reunion intimacy carries full emotional weight." },
      { position: 1.00, name: "Together / HEA",        fn: "RESOLUTION",         scene_type: "sequel", tempo: "slow",   desc: "Happily Ever After. New normal. Emotional wound healed. Final image is warmth." },
    ]
  },
  "thriller-tension": {
    name: "Thriller / Suspense Arc",
    category: "fiction",
    beats: [
      { position: 0,    name: "Normal World",         fn: "SETUP",              scene_type: "scene",  tempo: "medium", desc: "Establish competence and routine. Plant details that become significant later." },
      { position: 0.08, name: "The Disturbance",      fn: "DISRUPTION",         scene_type: "scene",  tempo: "fast",   desc: "Something is wrong. A body, message, disappearance. Clock starts ticking." },
      { position: 0.15, name: "Investigation Begins",  fn: "PROMISE_OF_PREMISE", scene_type: "scene",  tempo: "medium", desc: "Early clues and red herrings. Reader starts forming theories." },
      { position: 0.22, name: "First Complication",    fn: "ESCALATION",         scene_type: "scene",  tempo: "fast",   desc: "Initial approach fails. Problem bigger than expected." },
      { position: 0.30, name: "Allies & Enemies",      fn: "SUBPLOT",            scene_type: "scene",  tempo: "medium", desc: "Trust tested. Key B-story relationship develops." },
      { position: 0.38, name: "The Trail Heats Up",    fn: "PROMISE_OF_PREMISE", scene_type: "scene",  tempo: "fast",   desc: "Breakthrough at a cost — protagonist now visible to antagonist." },
      { position: 0.50, name: "Midpoint Revelation",   fn: "REVERSAL",           scene_type: "scene",  tempo: "fast",   desc: "Everything believed is wrong. Major twist reframes everything." },
      { position: 0.58, name: "Counterattack",         fn: "ESCALATION",         scene_type: "scene",  tempo: "fast",   desc: "Antagonist strikes back. Someone close is threatened. Stakes personal." },
      { position: 0.65, name: "Racing Clock",          fn: "ESCALATION",         scene_type: "scene",  tempo: "fast",   desc: "Deadline emerges. Time running out. Desperate moves." },
      { position: 0.75, name: "Darkest Hour",          fn: "CRISIS",             scene_type: "sequel", tempo: "slow",   desc: "Rock bottom. Betrayed or outmaneuvered. Brief but human cost registers." },
      { position: 0.80, name: "The Key",               fn: "RECOMMITMENT",       scene_type: "scene",  tempo: "medium", desc: "Small detail clicks into place. Desperate plan using info reader already has." },
      { position: 0.90, name: "The Confrontation",     fn: "CLIMAX",             scene_type: "scene",  tempo: "fast",   desc: "Final confrontation. Plan goes sideways. Victory requires sacrifice or cleverness." },
      { position: 1.00, name: "Aftermath",             fn: "RESOLUTION",         scene_type: "sequel", tempo: "slow",   desc: "Cost of victory. Bittersweet: something saved, something lost." },
    ]
  },
  "heros-journey": {
    name: "Hero's Journey — Campbell/Vogler",
    category: "fiction",
    beats: [
      { position: 0,    name: "Ordinary World",        fn: "SETUP",              scene_type: "scene",  tempo: "medium", desc: "Hero in mundane environment. Longing for something more." },
      { position: 0.08, name: "Call to Adventure",      fn: "DISRUPTION",         scene_type: "scene",  tempo: "fast",   desc: "Challenge or quest presented. Ordinary world can't contain them." },
      { position: 0.12, name: "Refusal of the Call",    fn: "REACTION",           scene_type: "sequel", tempo: "slow",   desc: "Fear, doubt, obligation. Hero resists. Sympathetic, not cowardly." },
      { position: 0.18, name: "Meeting the Mentor",     fn: "SETUP",              scene_type: "scene",  tempo: "medium", desc: "Guide appears with wisdom or tools. Relationship has texture." },
      { position: 0.25, name: "Crossing the Threshold", fn: "COMMITMENT",         scene_type: "scene",  tempo: "fast",   desc: "Hero leaves ordinary world. Point of no return. Deliberate choice." },
      { position: 0.35, name: "Tests, Allies, Enemies", fn: "PROMISE_OF_PREMISE", scene_type: "scene",  tempo: "fast",   desc: "Challenges in new world. Deliver genre promise." },
      { position: 0.45, name: "Approach to Inmost Cave",fn: "ESCALATION",         scene_type: "scene",  tempo: "medium", desc: "Approach central danger. Tension builds. Stakes crystallize." },
      { position: 0.50, name: "The Ordeal",             fn: "REVERSAL",           scene_type: "scene",  tempo: "fast",   desc: "Greatest challenge. Death and rebirth. Deepest fear confronted." },
      { position: 0.60, name: "Reward",                 fn: "PROMISE_OF_PREMISE", scene_type: "scene",  tempo: "medium", desc: "Hero gains the prize. Celebration premature. Show cost." },
      { position: 0.70, name: "The Road Back",          fn: "ESCALATION",         scene_type: "scene",  tempo: "fast",   desc: "Journey home is fraught. Antagonist pursues. New complications." },
      { position: 0.85, name: "The Resurrection",       fn: "CLIMAX",             scene_type: "scene",  tempo: "fast",   desc: "Final highest-stakes test. Old self dies so new self can live." },
      { position: 1.00, name: "Return with the Elixir", fn: "RESOLUTION",         scene_type: "sequel", tempo: "slow",   desc: "Hero returns transformed. Mirror opening. Gift for community." },
    ]
  },
};

function autoDetectTemplate(genre) {
  const g = (genre || '').toLowerCase();
  if (/romance|erotica/.test(g)) return 'romance-arc';
  if (/thriller|mystery|suspense|crime|true crime/.test(g)) return 'thriller-tension';
  if (/fantasy|science fiction|adventure|epic/.test(g)) return 'heros-journey';
  return 'save-the-cat';
}

function assignBeatsToChapters(templateKey, chapterCount) {
  const template = BEAT_SHEET_TEMPLATES[templateKey];
  if (!template) return null;

  // Map beats to chapter numbers
  const chapterBeats = {}; // chapterNum -> [beat, beat, ...]
  for (const beat of template.beats) {
    const chNum = Math.min(chapterCount, Math.max(1, Math.round(beat.position * (chapterCount - 1)) + 1));
    if (!chapterBeats[chNum]) chapterBeats[chNum] = [];
    chapterBeats[chNum].push(beat);
  }

  // Build final assignment for every chapter
  const assignments = [];
  for (let i = 1; i <= chapterCount; i++) {
    const beats = chapterBeats[i];
    if (beats && beats.length > 0) {
      if (beats.length === 1) {
        const b = beats[0];
        assignments.push({ chapter: i, beat_name: b.name, beat_function: b.fn, beat_scene_type: b.scene_type, beat_tempo: b.tempo, beat_description: b.desc });
      } else {
        // Combine multiple beats hitting the same chapter
        const names = beats.map(b => b.name).join(' + ');
        // Use the most dramatic function and fastest tempo
        const fnPriority = ['CLIMAX','CRISIS','REVERSAL','DISRUPTION','ESCALATION','PROMISE_OF_PREMISE','COMMITMENT','RECOMMITMENT','SUBPLOT','REACTION','REFLECTION','SETUP','RESOLUTION','CONNECTIVE_TISSUE'];
        const fns = beats.map(b => b.fn);
        const bestFn = fnPriority.find(f => fns.includes(f)) || fns[0];
        const tempoPriority = { fast: 3, medium: 2, slow: 1 };
        const bestTempo = beats.reduce((best, b) => (tempoPriority[b.tempo] || 0) > (tempoPriority[best] || 0) ? b.tempo : best, beats[0].tempo);
        const bestSceneType = beats.some(b => b.scene_type === 'scene') ? 'scene' : 'sequel';
        const desc = beats.map(b => b.desc).join(' ALSO: ');
        assignments.push({ chapter: i, beat_name: names, beat_function: bestFn, beat_scene_type: bestSceneType, beat_tempo: bestTempo, beat_description: desc });
      }
    } else {
      assignments.push({ chapter: i, beat_name: 'Connective Tissue', beat_function: 'CONNECTIVE_TISSUE', beat_scene_type: 'scene', beat_tempo: 'medium', beat_description: 'Bridge chapter — advance subplots, deepen relationships, maintain momentum. Must contain at least one irreversible event.' });
    }
  }
  return { template_name: template.name, template_key: templateKey, assignments };
}

function buildBeatSheetPromptBlock(beatSheet) {
  if (!beatSheet || !beatSheet.assignments) return '';
  const lines = beatSheet.assignments.map(a =>
    `CHAPTER ${a.chapter} — Beat: "${a.beat_name}" | Function: ${a.beat_function} | Type: ${a.beat_scene_type} | Tempo: ${a.beat_tempo}\n  → ${a.beat_description}`
  ).join('\n\n');

  return `=== STRUCTURAL BEAT SHEET (MANDATORY — EACH CHAPTER MUST FOLLOW ITS ASSIGNED ROLE) ===

This book uses the "${beatSheet.template_name}" structure. Each chapter has a pre-assigned STRUCTURAL ROLE. You MUST follow these. Do NOT give two chapters the same dramatic shape.

${lines}

BEAT ENFORCEMENT RULES:
1. FUNCTION determines the chapter's JOB:
   - SETUP: Establish character, world, stakes. No major conflict yet.
   - DISRUPTION: Something external forces change. An EVENT, not a conversation.
   - REACTION (sequel): Character PROCESSES what happened. Internal. Slow. No new characters.
   - COMMITMENT: Character makes an ACTIVE CHOICE. Not passive. A decision.
   - SUBPLOT: Focus shifts to B-story. Different tone.
   - PROMISE_OF_PREMISE: Deliver what the genre PROMISES. This is why the reader bought the book.
   - REVERSAL: Everything changes. New information. The ground shifts.
   - ESCALATION: Stakes rise. Pressure mounts.
   - CRISIS: The lowest point. Something irreversible and devastating.
   - REFLECTION (sequel): Process the crisis. Grief. No plot advancement.
   - RECOMMITMENT: Character understands the theme and chooses a new path.
   - CLIMAX: All threads converge. Maximum intensity.
   - RESOLUTION: Aftermath. Mirror the opening. Show transformation.
   - CONNECTIVE_TISSUE: Bridge chapter. Must still contain one irreversible event.

2. SCENE_TYPE determines MODE:
   - "scene" = ACTION: Goal → Conflict → Outcome. Things HAPPEN.
   - "sequel" = REACTION: Process → Dilemma → Decision. Slower pace.
   - NEVER two "sequel" chapters in a row.
   - NEVER more than two "scene" chapters in a row without a "sequel."

3. TEMPO determines PACING:
   - "fast" = Short paragraphs, rapid dialogue, physical action, urgency
   - "medium" = Balanced mix
   - "slow" = Long paragraphs, internal monologue, sensory detail, no urgency
   - NEVER same tempo for more than 2 consecutive chapters.

4. ESCALATION RATCHET: Each chapter must have a ONE-WAY DOOR — an irreversible event, revelation, or choice.

5. NO REPEATED CHAPTER SHAPES: Every chapter must have a DIFFERENT central activity.

=== END BEAT SHEET ===`;
}

function buildChapterBeatBlock(assignment) {
  if (!assignment) return '';
  const fnRules = {
    'SETUP': 'Establish, don\'t resolve. Plant questions. Reader finishes CURIOUS, not satisfied.',
    'DISRUPTION': 'A concrete external EVENT. Not a conversation. Not a feeling. Something that changes the protagonist\'s situation.',
    'PROMISE_OF_PREMISE': 'MUST deliver what the genre promises. Erotica = actual intimate scenes. Thriller = actual danger. Do NOT defer to a later chapter.',
    'REVERSAL': 'Something believed must be proven WRONG. New information reframes everything.',
    'CRISIS': 'Something irreversible and devastating. Protagonist WORSE OFF than at start.',
    'REFLECTION': 'NO new plot. NO new characters. Protagonist sits with failure/loss. Must be genuinely sad/angry/lost.',
    'REACTION': 'Character PROCESSES what happened. Internal monologue, dilemma, decision. No new plot events.',
    'CLIMAX': 'Maximum intensity. All threads converge. Protagonist acts differently than Chapter 1. Every named character accounted for.',
    'RESOLUTION': 'Mirror opening. Show transformation. End on resonant image, not summary.',
    'COMMITMENT': 'Character makes a DELIBERATE CHOICE. Not something happening TO them.',
    'RECOMMITMENT': 'Character understands the theme and chooses a new approach requiring growth.',
    'ESCALATION': 'Stakes rise. Pressure mounts. Consequences from earlier chapters compound.',
    'SUBPLOT': 'Focus shifts to B-story. Different tone from main plot. Still advances overall narrative.',
    'CONNECTIVE_TISSUE': 'Bridge chapter. Advance subplots, deepen relationships. Must contain one irreversible event.',
  };
  const fnRule = fnRules[assignment.beat_function] || '';

  return `=== THIS CHAPTER'S STRUCTURAL ROLE ===
Beat: "${assignment.beat_name}" | Function: ${assignment.beat_function} | Mode: ${assignment.beat_scene_type} | Tempo: ${assignment.beat_tempo}

What this means for your writing:
- If scene: ACTION chapter. Things must HAPPEN. Goal → Conflict → Outcome. Max 20% internal reflection.
- If sequel: REACTION chapter. Character PROCESSES. Internal monologue, dilemma, decision. No new plot or characters. Min 40% internal thought.
- If fast tempo: Short paragraphs (2-4 sentences max). Rapid dialogue. Physical movement. Urgency.
- If medium tempo: Balanced. Equal action, dialogue, description.
- If slow tempo: Long flowing paragraphs. Rich sensory detail. Internal monologue. No urgency. Let moments breathe.

FUNCTION-SPECIFIC: ${fnRule}
=== END STRUCTURAL ROLE ===`;
}

function buildChapterBeatUserBlock(assignment) {
  if (!assignment) return '';
  return `STRUCTURAL ROLE: This is a ${assignment.beat_function} chapter (beat: "${assignment.beat_name}"). Mode: ${assignment.beat_scene_type}. Tempo: ${assignment.beat_tempo}.
- If scene: ACTION chapter — things must HAPPEN. Don't write people talking about doing things. Write them DOING things.
- If sequel: REACTION chapter — character must PROCESS. Internal monologue. No new plot. No new characters.
- This chapter must contain at least one IRREVERSIBLE EVENT (one-way door). If nothing changes permanently, the chapter has failed.`;
}

// Endpoint: returns templates list, or computes beat assignments for a project
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, genre, template_key, chapter_count } = body;

    if (action === 'list_templates') {
      const list = Object.entries(BEAT_SHEET_TEMPLATES).map(([key, t]) => ({
        key, name: t.name, category: t.category, beat_count: t.beats.length
      }));
      return Response.json({ templates: list });
    }

    if (action === 'assign') {
      const resolvedKey = (template_key === 'auto' || !template_key) ? autoDetectTemplate(genre) : template_key;
      const result = assignBeatsToChapters(resolvedKey, chapter_count || 15);
      return Response.json(result);
    }

    if (action === 'get_prompt_blocks') {
      const resolvedKey = (template_key === 'auto' || !template_key) ? autoDetectTemplate(genre) : template_key;
      const beatSheet = assignBeatsToChapters(resolvedKey, chapter_count || 15);
      return Response.json({
        outline_block: buildBeatSheetPromptBlock(beatSheet),
        chapter_blocks: beatSheet.assignments.map(a => ({
          chapter: a.chapter,
          system_block: buildChapterBeatBlock(a),
          user_block: buildChapterBeatUserBlock(a),
        })),
      });
    }

    return Response.json({ error: 'Unknown action. Use: list_templates, assign, get_prompt_blocks' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});