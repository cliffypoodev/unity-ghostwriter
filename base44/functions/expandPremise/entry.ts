import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');

async function callGemini(prompt, maxTokens = 2500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GOOGLE_AI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!response.ok) { const err = await response.text(); throw new Error(`Gemini: ${err}`); }
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { topic, book_type, genre } = await req.json();
    if (!topic?.trim()) return Response.json({ error: 'topic required' }, { status: 400 });

    const prompt = `You are a developmental editor and publishing strategist.
A user has entered a book premise. Expand it into a detailed creative brief AND extract structured metadata.

User's Premise: "${topic}"
Book Type: ${book_type}
Genre: ${genre || 'to be determined'}

Return ONLY a valid JSON object — no markdown fences, no backticks, no explanation. Raw JSON only.

{
  "expanded_brief": "A 500-800 word creative brief with PREMISE, MAIN CHARACTERS (named, with descriptions), SETTING, CENTRAL CONFLICT, PLOT TRAJECTORY, THEMES, KEY SCENES, and TONE. Format as readable prose with clear section headers.",

  "genre": "infer the primary genre. For fiction choose from: [Fantasy, Science Fiction, Mystery, Thriller, Romance, Historical Fiction, Horror, Literary Fiction, Adventure, Dystopian, Young Adult, Crime, Magical Realism, Western, Satire, Erotica]. For nonfiction choose from: [Self-Help, Business, Biography, History, Science, Technology, Philosophy, Psychology, Health, Travel, Education, Politics, True Crime, Memoir, Cooking]. Return the exact label.",
  "subgenre": "specific subgenre or empty string",
  "beat_sheet_template": "best-fit story structure. For fiction choose from: [auto, save-the-cat, romance-arc, thriller-tension, heros-journey]. For nonfiction choose from: [auto, argument-driven, narrative-nonfiction, reference-structured, investigative-nonfiction]. Inference: Romance→romance-arc, Thriller→thriller-tension, Fantasy/Adventure→heros-journey, General→save-the-cat, Self-Help/Business→argument-driven, Memoir/True Crime→narrative-nonfiction, How-To→reference-structured. Return the slug value.",
  "beat_style": {
    "selected": "single best-fit beat style from: [Fast-Paced Thriller, Gritty Cinematic, Hollywood Blockbuster, Slow Burn, Clean Romance, Faith-Infused Contemporary, Investigative / Nonfiction, Reference / Educational, Intellectual Psychological, Dark Suspense, Satirical, Epic Historical, Whimsical Cozy, Hard-Boiled Noir, Grandiose Space Opera, Visceral Horror, Poetic Magical Realism, Clinical Procedural, Hyper-Stylized Action, Nostalgic Coming-of-Age, Cerebral Sci-Fi, High-Stakes Political, Surrealist Avant-Garde, Melancholic Literary, Urban Gritty Fantasy, Steamy Romance, Slow Burn Romance, Dark Erotica]",
    "reasoning": "one sentence explaining the match"
  },

  "spice_level": {
    "selected": "one of: [0, 1, 2, 3, 4] where 0=Fade to Black, 1=Closed Door, 2=Cracked Door, 3=Open Door, 4=Full Intensity",
    "reasoning": "one sentence explaining the inference"
  },

  "language_intensity": {
    "selected": "one of: [0, 1, 2, 3, 4] where 0=Clean, 1=Mild, 2=Moderate, 3=Strong, 4=Raw",
    "reasoning": "one sentence explaining the inference"
  },

  "detail_level": "minimal or moderate or comprehensive",
  "chapter_count": 20,

  "target_audience": {
    "selected": "single best-fit label from: [Adult General, Adult Literary, Adult Commercial, Women's Fiction, Men's Interest, Young Adult 14-18, New Adult 18-25, Middle Grade 10-13, Children 6-10, LGBTQ+, Academic, Professional, Spiritual/Religious, True Crime Enthusiasts, History Buffs, Sci-Fi & Fantasy Fans, Romance Readers, Thriller Readers, Business Professionals, Self-Improvement Seekers]",
    "secondary": "second best-fit label from the same list or empty string",
    "reasoning": "one sentence explaining why this audience fits"
  },

  "author_voice": {
    "selected": "Return one of these EXACT IDs. GENRE-FIRST: select an author whose PRIMARY genre matches the book's genre, then use tone to pick within that genre. Romance: colleen-hoover (raw/trauma), taylor-jenkins-reid (nonlinear/ensemble), emily-henry (banter/witty), sally-rooney (spare/intellectual), nicholas-sparks (sentimental/fate), penelope-douglas (dark/obsessive), francine-rivers (faith/clean). Thriller: gillian-flynn (unreliable/dark), tana-french (atmospheric/Irish), james-patterson (fast/short-chapters), michael-connelly (procedural/LA), harlan-coben (suburban/secrets), lee-child (tactical/minimal). Literary: toni-morrison (lyrical/nonlinear), cormac-mccarthy (sparse/biblical), kazuo-ishiguro (restrained/memory), zadie-smith (witty/social), donna-tartt (lush/classical). Mystery: agatha-christie (puzzle/clean), louise-penny (atmospheric/village), kate-atkinson (nonlinear/witty). Horror: stephen-king (character/dread), shirley-jackson (domestic/ambiguous), paul-tremblay (literary/anxious). Fantasy: brandon-sanderson (systems/epic), nk-jemisin (radical/Afrofuturism), joe-abercrombie (grimdark/subversive), robin-hobb (emotional/suffering), terry-pratchett (satirical/warm), ve-schwab (morally-grey/atmospheric). Sci-Fi: andy-weir (technical/humor), ursula-le-guin (anthropological/philosophical), philip-k-dick (paranoid/identity), william-gibson (cyberpunk/fragmented). Nonfiction: erik-larson (dual-narrative/archival), david-grann (investigative/mystery), malcolm-gladwell (counterintuitive/anecdotal), jon-krakauer (adventure/urgent). True Crime: michelle-mcnamara (literary/obsessive), robert-kolker (victim-centered). Historical: hilary-mantel (close-third/power), ken-follett (epic/architectural), colm-toibin (restrained/Irish). YA: john-green (philosophical/witty), leigh-bardugo (heist/dark-fantasy), rainbow-rowell (warm/fandom). Self-Help: brene-brown (vulnerable/research), james-clear (systematic/practical), ryan-holiday (Stoic/historical). Also accepted: basic (neutral). DO NOT assign a literary fiction author to a romance book. Genre match is mandatory.",
    "reasoning": "one sentence explaining why this voice fits the genre and tone"
  }
}

INFERENCE RULES:
- target_audience: infer from genre, subject matter, tone, and demographic signals.
  Example: dark fantasy with adult themes → "Adult Commercial" primary, "Sci-Fi & Fantasy Fans" secondary.
- author_voice: GENRE-FIRST inference. The author's PRIMARY body of work must match the book's genre. Then use tone to select within that genre. Never assign a literary fiction author to a romance book, even if the romance has literary aspirations. Genre match is mandatory; style match is secondary.
  ROMANCE: emotional/raw→colleen-hoover, witty/banter→emily-henry, literary/spare→sally-rooney, sweeping/fate→nicholas-sparks, steamy/dark→penelope-douglas, clean/faith→francine-rivers, nonlinear/ensemble→taylor-jenkins-reid
  THRILLER: psychological/unreliable→gillian-flynn, atmospheric/Irish→tana-french, fast/action→james-patterson, procedural/LA→michael-connelly, suburban/secrets→harlan-coben, tactical/minimal→lee-child
  LITERARY FICTION: lyrical/nonlinear→toni-morrison, sparse/biblical→cormac-mccarthy, restrained/memory→kazuo-ishiguro, witty/social→zadie-smith, lush/classical→donna-tartt
  MYSTERY: classic/puzzle→agatha-christie, atmospheric/village→louise-penny, nonlinear/witty→kate-atkinson
  HORROR: character/dread→stephen-king, domestic/ambiguous→shirley-jackson, literary/anxious→paul-tremblay
  FANTASY: systems/epic→brandon-sanderson, radical/Afrofuturism→nk-jemisin, grimdark/subversive→joe-abercrombie, emotional/suffering→robin-hobb, satirical/warm→terry-pratchett, morally-grey→ve-schwab
  SCI-FI: technical/humor→andy-weir, anthropological/philosophical→ursula-le-guin, paranoid/identity→philip-k-dick, cyberpunk/fragmented→william-gibson
  NONFICTION: dual-narrative/archival→erik-larson, investigative/mystery→david-grann, counterintuitive/anecdotal→malcolm-gladwell, adventure/urgent→jon-krakauer
  TRUE CRIME: literary/obsessive→michelle-mcnamara, victim-centered→robert-kolker
  HISTORICAL: close-third/power→hilary-mantel, epic/architectural→ken-follett, restrained/Irish→colm-toibin
  YOUNG ADULT: philosophical/witty→john-green, heist/dark-fantasy→leigh-bardugo, warm/fandom→rainbow-rowell
  SELF-HELP: vulnerable/research→brene-brown, systematic/practical→james-clear, Stoic/historical→ryan-holiday
  CRITICAL: toni-morrison, cormac-mccarthy, kazuo-ishiguro, zadie-smith, donna-tartt are ONLY for Literary Fiction. Never assign them to Romance, Thriller, Fantasy, or any other genre.
  CRITICAL: colleen-hoover, emily-henry, sally-rooney, nicholas-sparks, penelope-douglas, francine-rivers, taylor-jenkins-reid are ONLY for Romance. Never assign them to Literary Fiction or other genres.
- beat_style rules — GENRE-FIRST, TONE-SECOND. Follow this EXACT order:
  STEP 1: Identify the PRIMARY genre. This is mandatory.
  STEP 2: Map genre to default beat style using this matrix:
  ROMANCE: default→Slow Burn, dark→Gritty Cinematic, literary→Slow Burn (NOT Melancholic Literary), cozy→Whimsical Cozy, suspense→Dark Suspense, explicit→Slow Burn (spice handles explicitness)
  THRILLER: default→Fast-Paced Thriller, dark→Hard-Boiled Noir, political→High-Stakes Political, tech→Cerebral Sci-Fi, legal→Clinical Procedural, psychological→Intellectual Psychological
  MYSTERY: default→Clinical Procedural, cozy→Whimsical Cozy, noir→Hard-Boiled Noir, psychological→Dark Suspense
  LITERARY FICTION: default→Melancholic Literary, dark→Melancholic Literary, magical→Poetic Magical Realism, surreal→Surrealist Avant-Garde, satire→Satirical
  HORROR: default→Visceral Horror, psychological→Dark Suspense, quiet→Slow Burn
  FANTASY: default→Epic Historical, urban→Urban Gritty Fantasy, epic→Grandiose Space Opera, dark→Gritty Cinematic, cozy→Whimsical Cozy, literary→Poetic Magical Realism
  SCI-FI: default→Cerebral Sci-Fi, action→Fast-Paced Thriller, space→Grandiose Space Opera, dystopian→High-Stakes Political, horror→Visceral Horror
  NONFICTION: default→Investigative / Nonfiction, history→Epic Historical, education→Reference / Educational, self-help→Reference / Educational
  TRUE CRIME: default→Investigative / Nonfiction, dark→Hard-Boiled Noir
  HISTORICAL: default→Epic Historical, literary→Melancholic Literary, thriller→Fast-Paced Thriller
  YOUNG ADULT: default→Nostalgic Coming-of-Age, fantasy→Epic Historical, romance→Slow Burn, dark→Dark Suspense
  EROTICA: default→Steamy Romance, dark→Dark Erotica, slow→Slow Burn Romance
  STEP 3: Only after genre maps to a category, use tone to pick the VARIANT within that genre.
  CRITICAL OVERRIDE RULES:
  - A romance novel with literary tone is still Slow Burn, NOT Melancholic Literary
  - Melancholic Literary is ONLY for books whose PRIMARY genre is literary fiction
  - A thriller with atmospheric writing is still Fast-Paced Thriller, NOT Slow Burn
  - Never assign a beat style from a different genre category than the primary genre
- spice_level rules: infer from genre and tone.
  Romance=1-2, Erotica=3-4, Thriller=0-1, Horror=0-1, Cozy=0, Literary=0-1, Nonfiction=0
- language_intensity rules: infer from beat style defaults.
  Thriller=3, Gritty=4, Romance=0, Literary=1, Horror=4, Cozy=0, Noir=3, Nonfiction=0, Sci-Fi=1
- chapter_count: standard novel 20, short nonfiction 12, epic 30, self-help 10-15
- The expanded_brief must be rich, detailed prose — not bullet points.
- Do not invent plot details not present or strongly implied by the premise.`;

    const response = await callGemini(prompt);

    // Parse JSON, stripping accidental markdown fences
    const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('JSON parse failed, raw:', response.slice(0, 500));
      // Fallback: try to extract expanded_brief at minimum
      const briefMatch = cleaned.match(/"expanded_brief"\s*:\s*"([\s\S]*?)(?:"\s*[,}])/);
      return Response.json({
        expanded_brief: briefMatch ? briefMatch[1] : topic,
        genre: '',
        subgenre: '',
        beat_sheet_template: 'auto',
        beat_style: { selected: '', reasoning: '' },
        spice_level: { selected: 0, reasoning: '' },
        language_intensity: { selected: 0, reasoning: '' },
        detail_level: 'moderate',
        chapter_count: 20,
        target_audience: { selected: 'Adult General', secondary: '', reasoning: '' },
        author_voice: { selected: 'basic', reasoning: '' },
      });
    }

    // Normalize beat_style — might be string or object
    const rawBeat = parsed.beat_style;
    const beatData = typeof rawBeat === 'string'
      ? { selected: rawBeat, reasoning: '' }
      : (rawBeat || { selected: '', reasoning: '' });

    // Normalize spice_level — might be number or object
    const rawSpice = parsed.spice_level;
    const spiceData = typeof rawSpice === 'number'
      ? { selected: rawSpice, reasoning: '' }
      : (rawSpice || { selected: 0, reasoning: '' });

    // Normalize language_intensity — might be number or object
    const rawLang = parsed.language_intensity;
    const langData = typeof rawLang === 'number'
      ? { selected: rawLang, reasoning: '' }
      : (rawLang || { selected: 0, reasoning: '' });

    return Response.json({
      expanded_brief: parsed.expanded_brief || topic,
      genre: parsed.genre || '',
      subgenre: parsed.subgenre || '',
      beat_sheet_template: parsed.beat_sheet_template || 'auto',
      beat_style: {
        selected: String(beatData.selected || ''),
        reasoning: beatData.reasoning || '',
      },
      spice_level: {
        selected: parseInt(spiceData.selected) || 0,
        reasoning: spiceData.reasoning || '',
      },
      language_intensity: {
        selected: parseInt(langData.selected) || 0,
        reasoning: langData.reasoning || '',
      },
      detail_level: parsed.detail_level || 'moderate',
      chapter_count: parsed.chapter_count || 20,
      target_audience: {
        selected: parsed.target_audience?.selected || 'Adult General',
        secondary: parsed.target_audience?.secondary || '',
        reasoning: parsed.target_audience?.reasoning || '',
      },
      author_voice: {
        selected: parsed.author_voice?.selected || 'basic',
        reasoning: parsed.author_voice?.reasoning || '',
      },
    });
  } catch (error) {
    console.error('expandPremise error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});