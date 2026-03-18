// DEEPSEEK POST-GENERATION QUALITY VALIDATOR
// Runs DeepSeek-specific structural, dialogue, and genre checks

Deno.serve(async (req) => {
  try {
    const { chapter_text, chapter_number, spec, previous_chapters, story_bible, characters, open_ai_key } = await req.json();
    
    // PART 1: STRUCTURAL CHECKS ──────────────────────────────────────────────────
    let text = chapter_text;
    const violations = [];
    
    // 1. Strip section dividers
    text = text.replace(/^\s*---\s*$/gm, '');
    
    // 2. Strip headers and flag
    const hasHeaders = /^#{2,3}\s/m.test(text);
    text = text.replace(/^#{2,3}\s+[^\n]*$/gm, '');
    if (hasHeaders) violations.push('STRUCTURAL: Markdown headers found and stripped');
    
    // Clean excessive newlines
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // 3. OPENING VALIDATOR
    const first100 = text.slice(0, 100).toLowerCase();
    if (/^the\s+\w+\s+\w+\s+(flicker|flash|glow|dim|brighten|shift|dance|twist|swirl|creep)\w*/.test(first100)) {
      violations.push('OPENING: "The [adjective] [noun] [verb]" atmosphere pattern');
    }
    if (/(neon|light|shadow|darkness|weather|rain|wind|storm)\s*(\.|$)/i.test(first100)) {
      violations.push('OPENING: Starts with atmosphere/weather/light');
    }
    if (/\b(walk|step|stride|move|head)\s+\w+(through|into|toward)\b/i.test(first100)) {
      violations.push('OPENING: Starts with character moving/walking');
    }
    if (/^as\s+\w+\s+\w+/i.test(first100)) {
      violations.push('OPENING: "As [character] [verb]" construction');
    }
    if (/neon/i.test(first100)) {
      violations.push('OPENING: "neon" in first 100 characters');
    }
    
    // 4. ENDING VALIDATOR
    const last300 = text.slice(-300).toLowerCase();
    if (/just\s+(beginning|begun)|only\s+just\s+begun/i.test(last300)) {
      violations.push('ENDING: "just beginning" cliché');
    }
    if (/whatever\s+(lay|lies)\s+ahead/i.test(last300)) {
      violations.push('ENDING: "whatever lay ahead" cliché');
    }
    if (/ready\s+to\s+(face|confront|tackle)/i.test(last300)) {
      violations.push('ENDING: "ready to face" cliché');
    }
    if (/neon\s+lights?.*\b(flicker|glow|flash|shine)/i.test(last300)) {
      violations.push('ENDING: "neon lights" + verb');
    }
    if (/(determination|resolve|readiness|will|strength|courage)\s*\.?\s*$/.test(last300.trim())) {
      violations.push('ENDING: Abstract statement about resolve');
    }
    
    // 5. DIALOGUE DENSITY CHECK
    const lines = text.split('\n').filter(l => l.trim());
    const dialogueLines = lines.filter(l => /^[""]|['"]/.test(l.trim()));
    const dialogueDensity = Math.round((dialogueLines.length / lines.length) * 100);
    if (dialogueDensity > 50) {
      violations.push(`DIALOGUE DENSITY: ${dialogueDensity}% (max 50%)`);
    }
    
    // 6. DIALOGUE REPETITION CHECK
    const whatYouMatches = text.match(/\bwhat\s+do\s+you\s+\w+/gi) || [];
    if (whatYouMatches.length > 2) {
      violations.push(`DIALOGUE: "What do you...?" appears ${whatYouMatches.length}x (max 2)`);
    }
    
    const whyShouldMatches = text.match(/\bwhy\s+should\s+i\s+\w+/gi) || [];
    if (whyShouldMatches.length > 2) {
      violations.push(`DIALOGUE: "Why should I...?" appears ${whyShouldMatches.length}x (max 2)`);
    }
    
    const charNamePattern = /[""]([A-Z][a-z]+),\s+(i|you|we|he|she|they)/gi;
    const addressMatches = text.match(charNamePattern) || [];
    if (addressMatches.length > 3) {
      violations.push(`DIALOGUE: Character address in dialogue ${addressMatches.length}x (max 3)`);
    }
    
    // PART 2: GENRE ENFORCEMENT ──────────────────────────────────────────────────
    const spiceLevel = parseInt(spec?.spice_level) || 0;
    const genre = (spec?.genre || '').toLowerCase();
    const isErotica = genre === 'erotica' || spiceLevel >= 3;
    const enforceGenre = spec?.enforce_genre_content !== false;
    
    if (isErotica && enforceGenre) {
      const contactWords = ['touch', 'kiss', 'lips', 'hands', 'skin', 'body', 'breath', 'closer', 'against', 'beneath', 'fingers', 'mouth', 'throat', 'chest', 'hips', 'thigh', 'pressed', 'pulled', 'arched', 'gasped', 'moaned'];
      const charNames = (story_bible?.characters || []).map(c => c.name.toLowerCase());
      
      let contentInstances = 0;
      const textLower = text.toLowerCase();
      for (const word of contactWords) {
        const matches = [...textLower.matchAll(new RegExp(word, 'g'))];
        for (const match of matches) {
          const context = textLower.slice(Math.max(0, match.index - 150), match.index + 150);
          const hasCharName = charNames.some(name => context.includes(name));
          if (hasCharName) contentInstances++;
        }
      }
      
      if (contentInstances < 3) {
        violations.push(`GENRE: Only ${contentInstances} intimate content instances (min 3 for erotica)`);
      }
    }
    
    return Response.json({
      text,
      violations,
      passed: violations.length === 0,
      violation_count: violations.length,
      is_erotica: isErotica,
      dialogue_density: dialogueDensity
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});