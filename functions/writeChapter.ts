import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Model Resolver — each pipeline stage uses its dedicated model regardless of user's Phase 1 selection ──
function resolveModel(callType, spec) { try { if(!callType){console.warn('resolveModel called without callType — defaulting to claude-sonnet');return spec?.ai_model||'claude-sonnet';} const H={outline:'gemini-pro',beat_sheet:'gemini-pro',post_gen_rewrite:'claude-sonnet',consistency_check:'claude-sonnet',style_rewrite:'claude-sonnet',character_interview:'claude-sonnet',metadata_generation:'claude-sonnet',sfw_handoff_check:'claude-sonnet',post_explicit:'claude-sonnet',cover_prompt:'claude-sonnet',keyword_generation:'claude-sonnet',kdp_description:'claude-sonnet',chapter_state:'claude-sonnet',consultant_chat:'claude-sonnet'}; if(H[callType])return H[callType]; if(callType==='explicit_scene'&&spec?.openrouter_model)return 'openrouter'; if(callType==='sfw_prose')return spec?.ai_model||'claude-sonnet'; console.warn(`resolveModel: unknown callType "${callType}" — defaulting to claude-sonnet`); return 'claude-sonnet'; } catch(e){console.warn('resolveModel error:',e.message);return 'claude-sonnet';} }

// ── Multi-Provider AI Router ──
const MODEL_MAP = {
  "claude-sonnet":     { provider: "anthropic", modelId: "claude-sonnet-4-20250514", defaultTemp: 0.72, maxTokensLimit: null },
  "claude-opus":       { provider: "anthropic", modelId: "claude-opus-4-20250514",   defaultTemp: 0.72, maxTokensLimit: null },
  "claude-opus-4-5":   { provider: "anthropic", modelId: "claude-opus-4-5",          defaultTemp: 0.72, maxTokensLimit: null },
  "claude-sonnet-4-5": { provider: "anthropic", modelId: "claude-sonnet-4-5",        defaultTemp: 0.72, maxTokensLimit: null },
  "claude-haiku-4-5":  { provider: "anthropic", modelId: "claude-haiku-4-5",         defaultTemp: 0.72, maxTokensLimit: null },
  "gpt-4o":            { provider: "openai",    modelId: "gpt-4o",                   defaultTemp: 0.4,  maxTokensLimit: null },
  "gpt-4o-creative":   { provider: "openai",    modelId: "gpt-4o",                   defaultTemp: 0.9,  maxTokensLimit: null },
  "gpt-4-turbo":       { provider: "openai",    modelId: "gpt-4-turbo",              defaultTemp: 0.7,  maxTokensLimit: 4096 },
  "gemini-pro":        { provider: "google",    modelId: "gemini-2.0-flash",         defaultTemp: 0.72, maxTokensLimit: null },
  "deepseek-chat":     { provider: "deepseek",  modelId: "deepseek-chat",            defaultTemp: 0.72, maxTokensLimit: 8192 },
  "openrouter":        { provider: "openrouter", modelId: "meta-llama/llama-3.1-70b-instruct", defaultTemp: 0.72, maxTokensLimit: 16384 },
};

async function callAI(modelKey, systemPrompt, userMessage, options = {}) {
  const config = MODEL_MAP[modelKey] || MODEL_MAP["claude-sonnet"];
  const { provider, modelId, defaultTemp, maxTokensLimit } = config;
  const temperature = options.temperature ?? defaultTemp;
  let maxTokens = options.maxTokens ?? 8192;
  if (maxTokensLimit) maxTokens = Math.min(maxTokens, maxTokensLimit);

  if (provider === "anthropic") {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature, system: systemPrompt, messages: [{ role: 'user', content: userMessage }] }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error('Anthropic error: ' + (data.error?.message || response.status));
    return data.content[0].text;
  }
  if (provider === "openai") {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + Deno.env.get('OPENAI_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error('OpenAI error: ' + (data.error?.message || response.status));
    return data.choices[0].message.content;
  }
  if (provider === "google") {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + modelId + ':generateContent?key=' + Deno.env.get('GOOGLE_AI_API_KEY'),
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: userMessage }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { temperature, maxOutputTokens: maxTokens } }) }
    );
    const data = await response.json();
    if (!response.ok) throw new Error('Google AI error: ' + (data.error?.message || response.status));
    return data.candidates[0].content.parts[0].text;
  }
  if (provider === "deepseek") {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + Deno.env.get('DEEPSEEK_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, max_tokens: Math.min(maxTokens, 8192), temperature, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error('DeepSeek error: ' + (d.error?.message || r.status));
    return d.choices[0].message.content;
  }
  if (provider === "openrouter") {
    const orKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!orKey) throw new Error('OpenRouter generation failed: OPENROUTER_API_KEY not configured');
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + orKey, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://unity-ghostwriter.base44.app', 'X-Title': 'Unity Ghostwriter' },
      body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error('OpenRouter generation failed: ' + (d.error?.message || JSON.stringify(d.error) || r.status));
    if (!d.choices?.[0]?.message?.content) throw new Error('OpenRouter generation failed: empty response');
    return d.choices[0].message.content;
  }
  throw new Error('Unknown provider: ' + provider);
}
const BEAT_STYLES = {
  "fast-paced-thriller": { name: "Fast-Paced Thriller", instructions: "Core Identity: Relentless momentum. Immediate stakes. Forward propulsion at all times.\nSentence Rhythm: Short to medium sentences. Strong, active verbs. Tight paragraphs (1-4 lines). Occasional single-line impact beats.\nPacing: Introduce danger or stakes within first paragraph. Escalate every 2-4 paragraphs. No long exposition blocks. Embed backstory inside action.\nEmotional Handling: Minimal introspection. Decisions made under pressure. Fear shown through action, not reflection.\nDialogue: Direct. Tactical. Urgent. Often incomplete sentences.\nScene Structure: Immediate problem > Tactical reaction > Escalation > Complication > Cliffhanger or propulsion.\nEnding Rule: Scene must close with forward momentum, not emotional resolution." },
  "gritty-cinematic": { name: "Gritty Cinematic", instructions: "Core Identity: Raw realism. Texture-heavy environments. Physical consequence.\nSentence Rhythm: Medium-length sentences. Concrete nouns and verbs. Sparse but sharp metaphors. Weight in description.\nEnvironmental Focus: Sound design (metal, wind, boots, breathing). Temperature, sweat, blood, dust. Physical discomfort emphasized.\nPacing: Tension builds steadily. Physical consequences matter. Injuries affect performance.\nEmotional Handling: Internal conflict expressed through physical sensation. Characters rarely over-explain feelings.\nDialogue: Hard. Minimal. Subtext heavy. Power shifts mid-conversation.\nScene Structure: Immersive environmental anchor > Rising tension > Physical obstacle > Consequence > Stark closing beat.\nEnding Rule: End on something tangible and unsettling." },
  "hollywood-blockbuster": { name: "Hollywood Blockbuster", instructions: "Big visuals, clear stakes, hero-driven. Dynamic pacing, memorable dialogue. High-impact opening > Rising threat > Reversal > Heroic decision." },
  "slow-burn": { name: "Slow Burn", instructions: "Gradual tension layering. Longer paragraphs, measured pacing. Deep internal reflection, subtle shifts. Calm surface > Emotional layering > Unsettling close." },
  "clean-romance": { name: "Clean Romance", instructions: "Core Identity: Emotional intimacy over physical explicitness.\nSentence Rhythm: Warm, flowing prose. Internal monologue present. Balanced dialogue and narration.\nRomantic Rules: No explicit content. Focus on eye contact, proximity, touch. Emotional vulnerability prioritized.\nEmotional Handling: Character insecurity explored gently. Growth through relational friction. Misunderstanding resolved through honesty.\nDialogue: Banter-driven. Playful tension. Soft confessions.\nScene Structure: Relatable moment > Romantic friction > Emotional crack > Vulnerable exchange > Hopeful close.\nEnding Rule: Close with warmth or unresolved romantic tension." },
  "faith-infused": { name: "Faith-Infused Contemporary", instructions: "Core Identity: Hope grounded in real life. Spiritual undertone without preaching.\nSentence Rhythm: Steady, compassionate tone. Reflective but not heavy. Gentle pacing.\nFaith Handling: Scripture brief and organic (if used). Prayer shown, not explained. Faith influences choices subtly.\nEmotional Handling: Themes of grace and forgiveness. Redemption arcs. Relational healing.\nDialogue: Encouraging. Honest. Never sermon-like.\nScene Structure: Real-life challenge > Emotional vulnerability > Faith-reflective moment > Action step > Quiet hope.\nEnding Rule: Close with grounded hope, not dramatic miracle." },
  "investigative-nonfiction": { name: "Investigative Nonfiction", instructions: "Core Identity: Evidence-based narrative progression.\nSentence Rhythm: Structured and logical. Fluid but precise. No exaggeration.\nContent Rules: Cite records and timelines. Distinguish myth vs documented fact. Provide social and political context.\nEmotional Handling: Neutral but immersive. Avoid sensationalism. Let facts create impact.\nStructure: Context > Event reconstruction > Evidence analysis > Broader implication > Transition to next inquiry.\nEnding Rule: Close with unresolved investigative question or documented conclusion." },
  "reference-educational": { name: "Reference / Educational", instructions: "Core Identity: Clarity and structure over narrative drama.\nSentence Rhythm: Clear, direct sentences. Logical flow. Definitions included.\nContent Rules: Headings encouraged. Step-by-step explanations. No emotional dramatization.\nStructure: Definition > Explanation > Application > Example > Summary.\nEnding Rule: Conclude with actionable takeaway." },
  "intellectual-psychological": { name: "Intellectual Psychological", instructions: "Core Identity: Thought-driven tension. Internal analysis.\nSentence Rhythm: Controlled pacing. Analytical phrasing. Occasional sharp fragment.\nEmotional Handling: Character dissects own thoughts. Doubt and perception shifts emphasized. External threat secondary to internal unraveling.\nDialogue: Sparse. Philosophical undertone. Subtle tension.\nStructure: Observation > Interpretation > Doubt > Cognitive shift > Quiet destabilization.\nEnding Rule: End with perception altered." },
  "dark-suspense": { name: "Dark Suspense", instructions: "Core Identity: Claustrophobic dread. Controlled fear escalation.\nSentence Rhythm: Tight. Controlled. Sudden short breaks.\nAtmosphere Rules: Sensory distortion. Limited light. Sound cues. Isolation.\nEscalation: Subtle anomaly > Rationalization > Physical symptom > Threat implied > Reality destabilizes.\nDialogue: Minimal. Quiet. Ominous.\nEnding Rule: End on a line that lingers disturbingly." },
  "satirical": { name: "Satirical", instructions: "Core Identity: Sharp commentary through controlled exaggeration.\nSentence Rhythm: Quick wit. Punchy lines. Clever turns of phrase.\nContent Rules: Irony embedded. Character unaware of own absurdity. Social systems subtly critiqued.\nEmotional Handling: Humor masks critique. Keep tone controlled, not chaotic.\nStructure: Normal scenario > Slight exaggeration > Absurd escalation > Sharp observation > Punchline or ironic twist.\nEnding Rule: Close with a line that reframes the entire scene." },
  "epic-historical": { name: "Epic Historical", instructions: "Grand-scale pivotal history. Resonant lyrical prose. Period-accurate. Melancholy, stoic endurance." },
  "whimsical-cozy": { name: "Whimsical Cozy", instructions: "Gentle comfort+small magic. Playful cadence. Low-stakes, found family. End: sensory warmth." },
  "hard-boiled-noir": { name: "Hard-Boiled Noir", instructions: "Cynical urban underworld. Staccato sentences, slang. Fatalism. End: cynical city observation." },
  "grandiose-space-opera": { name: "Grandiose Space Opera", instructions: "Interstellar conflict. Sweeping cinematic prose. Mythic language, massive battles. Awe, heroic desperation." },
  "visceral-horror": { name: "Visceral Horror", instructions: "Sensory descent into fear. Erratic rhythm. Body horror, psychological warping. End: lingering unsettling image." },
  "poetic-magical-realism": { name: "Poetic Magical Realism", instructions: "Supernatural as mundane. Dreamlike prose. Magical=emotional. End: surreal emotionally true image." },
  "clinical-procedural": { name: "Clinical Procedural", instructions: "Meticulous technical focus. Precise prose. Tools, forensics, SOPs. End: cold hard fact." },
  "hyper-stylized-action": { name: "Hyper-Stylized Action", instructions: "Explosive narrative. Fast pacing. Improbable feats, aesthetic violence. End: one-liner or flourish." },
  "nostalgic-coming-of-age": { name: "Nostalgic Coming-of-Age", instructions: "Bittersweet transition. Reflective soft prose. Sensory triggers, small-town. Deep yearning." },
  "cerebral-sci-fi": { name: "Cerebral Sci-Fi", instructions: "High-concept ideas. Dense intellectual prose. Hard science speculation. End: reality-questioning." },
  "high-stakes-political": { name: "High-Stakes Political", instructions: "Machiavellian chess match. Sharp dialogue. Backroom deals, no pure heroes. Paranoia." },
  "surrealist-avant-garde": { name: "Surrealist Avant-Garde", instructions: "Dream-logic, abstract imagery. Stream-of-consciousness. Confusion, wonder, unease." },
  "melancholic-literary": { name: "Melancholic Literary", instructions: "Quiet interior sadness/regret. Slow elegant prose, heavy subtext. Resignation, grace." },
  "urban-gritty-fantasy": { name: "Urban Gritty Fantasy", instructions: "High-magic+harsh modern city. Street-level energy. Cynical, resilient, gallows humor." },
};

const ASP={'colleen-hoover':'Write with emotional rawness and psychological intensity. Dual or close third-person POV. Characters process trauma through action and dialogue. Accessible but never shallow.','taylor-jenkins-reid':'Nonlinear or dual-timeline structure. Characters reveal complexity slowly. Emotional moments hit hardest when underplayed. Warm but not saccharine.','emily-henry':'Lead with dialogue and banter. Characters intelligent and self-aware, deflecting vulnerability with humor. Witty without being glib. Romantic tension through intellectual friction.','sally-rooney':'Minimal dialogue tags. Stripped down, precise, observational. Characters analyze emotions at slight remove. No ornament.','nicholas-sparks':'Build toward emotional devastation slowly. Southern or coastal settings as characters. Fate drives plot. Clean accessible prose.','penelope-douglas':'Embrace moral ambiguity. Heroes are dangerous and danger is the appeal. Intense close first-person. Do not soften edges.','francine-rivers':'Faith through character behavior, not exposition. Redemption arcs hard-won. Clean warm prose. Grace and forgiveness as engine.','gillian-flynn':'Unreliable first or close-third narration. Female characters complex, dark, capable of violence. Sharp sometimes venomous prose. Reveals reframe everything.','tana-french':'Build atmosphere until suffocating. Investigators have wounds compromising objectivity. Literary but not ornate. Detective mystery matters as much as murder.','james-patterson':'Short chapters. Every chapter ends on micro-cliffhanger. Short sentences. Plot mechanics are king.','michael-connelly':'Police and legal procedure must be accurate. Los Angeles is a character. Moral compass bends under pressure. Clean propulsive.','harlan-coben':'Stable suburban life cracked open. Past secrets reach into present. Brisk accessible conversational. Twists earned in retrospect.','lee-child':'Every scene has spatial logic. Minimal declarative military-efficiency prose. Dialogue sparse and loaded. Violence fast and mechanical.','toni-morrison':'Lyrical but never decorative — every image carries weight. Time nonlinear. Community and ancestral history are characters. Trust the image.','cormac-mccarthy':'Remove quotation marks. Spare biblical cadence. Violence matter-of-fact. Landscape vast and indifferent.','kazuo-ishiguro':'Narrator withholds more than they reveal. Emotions leak through gaps. Polished formal slightly distant. Tragedy in silences.','zadie-smith':'Confident slightly essayistic. Characters represent intersecting social forces. Wit ever-present but never cheap.','donna-tartt':'Rich without being purple — long carefully constructed classical sentences. Obsessive intellectual characters. Beauty and corruption linked.','agatha-christie':'Plot mechanics priority. Every detail clue or red herring. Clean efficient slightly dry. Solution surprising and inevitable.','louise-penny':'Community relationships load-bearing. Warm but not cozy — evil beneath surface. Human frailty with compassion.','kate-atkinson':'Structure as tool for meaning. Timelines intersect unexpectedly. Witty knowing self-aware. Tragedy and absurdity coexist.','stephen-king':'Build character before dread. Small towns carry deep darkness. Pop culture grounds supernatural. Terror is ordinary life twisted.','shirley-jackson':'Horror in the unsaid. Domestic spaces suffocating. Precise slightly formal deceptively calm. Never explain supernatural.','paul-tremblay':'Ground supernatural in rational possibility. Literary character-focused anxiety-soaked. Endings ambiguous by design.','brandon-sanderson':'Magic has rules and costs. World-building through character experience not exposition. Meticulous plot. Clear functional prose.','nk-jemisin':'Structural experimentation creates meaning. Second person creates uncomfortable intimacy. Systemic violence in world architecture. Confrontational.','joe-abercrombie':'Subvert expectations. Heroes flawed to villainy, villains have logic. Violence has consequences. Sharp darkly funny.','robin-hobb':'Build deep attachment before suffering. First-person suffocating intimacy. Warm immersive. Hope extended then withdrawn.','terry-pratchett':'Satire through specificity. Characters competent self-aware. Humor masks genuine stakes. Playful but never shallow.','ve-schwab':'Multiple POVs with distinct voice. No moral clarity. Atmospheric world-building. Villains have best arguments.','andy-weir':'Protagonist solves problems in real time showing work. Witty self-deprecating conversational. Science accurate. Every solution creates new problem.','ursula-le-guin':'SF as anthropology. Elegant unhurried confident prose. Gender race power through invented societies. Rich interiority.','philip-k-dick':'Reality unreliable — establish then undermine. Ordinary people in incomprehensible systems. Functional sometimes frantic.','william-gibson':'Future arrived unevenly. Fragmented associative image-dense. Technology atmospheric not explained. Corporate power dominant.','erik-larson':'Two narratives in parallel colliding at climax. Every scene documentable. Cinematic propulsive. Let facts create drama.','david-grann':'Nonfiction structured like mystery. Clean gripping prose. End on moral implication not just fact.','malcolm-gladwell':'Counterintuitive claim, case through specific stories. Abstract ideas need concrete human face. Warm accessible.','jon-krakauer':'Author obsession part of story. Physical danger with technical accuracy. Urgent occasionally self-lacerating.','michelle-mcnamara':'Writer obsession part of story. Victims are people not case numbers. Literary sometimes lyrical. Dark humor survival.','robert-kolker':'Victims as living people. Systemic failures matter as much as crimes. Empathetic careful never exploitative.','hilary-mantel':'Close third present tense. Power dynamics in every room. Period detail in action. Dense but never slow.','ken-follett':'Characters span generations and classes. Architecture as character. Clear propulsive. Historical backdrop personal stakes.','colm-toibin':'What is not said carries weight. Exiled from own emotions. Precise spare melancholy. Endings resist resolution.','john-green':'Teenagers who speak in essays and mean it. Wit as primary connection. Self-aware first-person. Emotion lands when underplayed.','leigh-bardugo':'Crew with distinct voices competing loyalties. Heist planning exciting as execution. Punchy atmospheric savage.','rainbow-rowell':'Characters defined by passions treated seriously. Geek culture not punchlines. Warm funny honest.','brene-brown':'Lead with vulnerability. Research not clinical. Warm direct occasionally funny. Author not above problem.','james-clear':'Every claim has mechanism and application. Story→concept→application→summary. Clear efficient.','ryan-holiday':'Anchor lessons in historical story. Stoic framework. Direct slightly austere never sentimental.'};
const LVM={hemingway:'cormac-mccarthy',austen:'emily-henry',morrison:'toni-morrison',mccarthy:'cormac-mccarthy',vonnegut:'terry-pratchett',didion:'kazuo-ishiguro',tolkien:'brandon-sanderson',rowling:'rainbow-rowell',leguin:'ursula-le-guin',gaiman:'ve-schwab',pratchett:'terry-pratchett',chandler:'michael-connelly',christie:'agatha-christie',marquez:'toni-morrison',atwood:'gillian-flynn',king:'stephen-king',gladwell:'malcolm-gladwell',bryson:'malcolm-gladwell',sagan:'andy-weir',le_guin:'ursula-le-guin',garcia_marquez:'toni-morrison'};
function resolveVoiceId(id){if(!id||id==='basic')return'basic';if(ASP[id])return id;return LVM[id]||'basic';}
function getAuthorStyleBlock(spec){const id=resolveVoiceId(spec?.author_voice);if(id==='basic')return'';const sp=ASP[id];if(!sp)return'';const nm=id.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ');return`\nAUTHOR VOICE — ${nm.toUpperCase()}\n\n${sp}\n\nThis voice must be consistent throughout the chapter. Do not default to generic literary prose. Apply ${nm}'s specific stylistic fingerprint to every scene, transition, and dialogue exchange.\n`;}

const FICTION_ENDING_TYPES={1:"Type A: Mid-action cliffhanger.",2:"Type B: Revelation recontextualizes.",3:"Type C: Concrete sensory image.",4:"Type D: Gut-punch dialogue — last line.",5:"Type E: Quiet mundane action contrasting intensity."};const NONFICTION_ENDING_TYPES={1:"Quiet resonant image.",2:"Reframing sentence.",3:"Brief poem/aphorism.",4:"Lingering question.",5:"Return to opening vignette."};
function getBeatStyleInstructions(key){if(!key)return"Not specified";const beat=BEAT_STYLES[key];return beat?`${beat.name}\n${beat.instructions}`:key;}
async function enforceProseCompliance(text,chNum,projectId,allChapters,chIdx){try{if(!text||typeof text!=='string')return[];const V=[];const BANS=[{p:/\b\w+ sent \w[\w\s]{0,25}through\b/gi,l:'"sent...through"'},{p:/waves of (pleasure|sensation|emotion|feeling|heat|relief|desire|pain)/gi,l:'"waves of"'},{p:/washed over (him|her|them)/gi,l:'"washed over"'},{p:/threatened to overwhelm/gi,l:'"threatened to overwhelm"'},{p:/couldn't help but/gi,l:'"couldn\'t help but"'},{p:/in that moment/gi,l:'"in that moment"'},{p:/the particular \w+ of/gi,l:'"the particular [x] of"'},{p:/something that (looked|felt|sounded|seemed) like/gi,l:'"something that felt like"'},{p:/a kind of \w+ that/gi,l:'"a kind of [x] that"'},{p:/what might have been/gi,l:'"what might have been"'},{p:/something (shifted|loosened|cracked|tightened|moved|settled|expanded) in (her|his|their) chest/gi,l:'"something [x] in chest"'},{p:/the (weight|smell|sound|feel) of (everything|all of it|the moment)/gi,l:'"the weight/sound of everything"'}];for(const b of BANS){const m=text.match(b.p);if(m)V.push({type:'absolute_ban',label:b.l,count:m.length,examples:m.slice(0,2)});}const CAPS=[[/\bpulse[sd]?\b/gi,'pulse',4],[/\bnervous system\b/gi,'nervous system',2],[/\bamber eyes\b/gi,'amber eyes',2],[/\bwarmth\b/gi,'warmth',3],[/\bdeliberate\b/gi,'deliberate',3],[/\bliquid\b/gi,'liquid',3],[/\bfluid\b/gi,'fluid',2],[/\belectric(ity)?\b/gi,'electricity',2],[/\bpredatory\b/gi,'predatory',2],[/\bharmonics\b/gi,'harmonics',2],[/\bsurrender\b/gi,'surrender',3],[/\bsuddenly\b/gi,'suddenly',2],[/\bprickl/gi,'prickle',2],[/\bresonat/gi,'resonate',2],[/\bseemed to \w+/gi,'seemed to (hedge)',4],[/\ba tapestry of\b/gi,'tapestry of',0],[/\bthe particular\b/gi,'the particular',2],[/\bshifted in (her|his)\b/gi,'shifted in her/his',1],[/\bcareful\b/gi,'careful',3],[/\bcarefully\b/gi,'carefully',3],[/\bantiseptic\b/gi,'antiseptic',1],[/\bfluorescent\b/gi,'fluorescent',2],[/\bas if\b/gi,'as if',4],[/\bsomething in\b/gi,'something in',3],[/\bthe kind of\b/gi,'the kind of',3],[/\bparticular\b/gi,'particular',3],[/\bsomehow\b/gi,'somehow',2],[/\bparticular kind\b/gi,'particular kind',1],[/\bfamiliar\b/gi,'familiar',3]];for(const[rx,l,mx]of CAPS){const m=text.match(rx);const c=m?m.length:0;if(c>mx)V.push({type:'frequency_cap',label:l,count:c,max:mx,excess:c-mx});}
if(chIdx>0){const prev=allChapters[chIdx-1];let pt=prev?.content||'';if(pt.startsWith('http')){try{const r=await fetch(pt);pt=r.ok?await r.text():'';if(pt.startsWith('<'))pt='';}catch{pt='';}}if(pt){const SW=new Set(['the','and','was','had','his','her','they','their','that','with','from','into','have','been','were','what','this','which','when','would','could','should','said','just','like','some','then','than','but','not','for','are','him','she','you','all','its','one','out','can','did','who','how','has','more','also','will','about']);const ws=pt.toLowerCase().match(/\b[a-z]{4,}\b/g)||[];const fq={};for(const w of ws){if(!SW.has(w))fq[w]=(fq[w]||0)+1;}const t3=Object.entries(fq).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([w])=>w);for(const w of t3){const c=(text.match(new RegExp(`\\b${w}\\b`,'gi'))||[]).length;if(c>2)V.push({type:'dynamic_cap',label:`"${w}" (prev ch top word)`,count:c,max:2});}}}
const endCheck=checkSceneEnding(text);if(endCheck.violation)V.push({type:'weak_ending',label:endCheck.lastSentence,count:1,max:0,excess:1,rule:endCheck.rule});return V;}catch(err){console.warn('enforceProseCompliance failed silently:',err.message);return[];}}

function checkSceneEnding(text){const scenes=text.split(/\*\s*\*\s*\*/);const violations=[];const emotionalSummaryPatterns=[/felt like/i,/seemed like/i,/looked like/i,/she (thought|knew|realized|understood) (that|she|he|it)/i,/he (thought|knew|realized|understood) (that|she|he|it)/i,/it was (the kind|a kind|that kind)/i,/she (had|was) (finally|already|still) (begun|starting|trying)/i,/he (had|was) (finally|already|still) (begun|starting|trying)/i,/and (that|this) (felt|seemed|looked|appeared)/i,/the (first|last) time (she|he|they)/i,/\b(he|she|they) (had |finally )?found (his|her|their) (place|home|peace|belonging)/i,/for the first time (in years|in his life|in her life|in their life)/i,/everything (had |would )?changed?/i,/this was (who|where|what) (he|she|they) (truly was|belonged|needed|wanted)/i,/(he|she|they) knew exactly where (he|she|they) belonged/i,/(he|she|they) felt (more |truly |finally )?(himself|herself|themselves|at peace|complete|whole|alive|ready)/i,/(he|she|they) (understood|realized|knew) (now |then )?(what|that|how|why)/i,/(he|she|they) was exactly where (he|she|they) (was|were) (supposed|meant) to be/i,/it was (going to be |finally )?(okay|alright|all right|enough)/i,/(he|she|they) (had|was|were) (no longer|not the same|finally free|at last free)/i];scenes.forEach((scene,idx)=>{const sents=scene.trim().split(/(?<=[.!?])\s+/);const lastS=(sents[sents.length-1]||'').trim();const lastTwo=sents.slice(-2).join(' ');if(emotionalSummaryPatterns.some(p=>p.test(lastS)||p.test(lastTwo))){violations.push({sceneIndex:idx+1,text:lastTwo,rule:'emotional_summary_ending'});}});if(violations.length>0){const v=violations[violations.length-1];return{violation:true,lastSentence:v.text,rule:`Scene ${v.sceneIndex} ends with emotional summary. Rewrite final 2 sentences as: concrete sensory image, physical action, single line of dialogue, or image the reader can see without being told what it means.`};}return{violation:false};}
const SPICE_LEVELS = {
  0: { name: "Fade to Black", instructions: "Romantic/Sexual Content Rules:\n- No sexual content of any kind.\n- Romantic tension permitted but must remain fully clothed and non-physical beyond hand-holding, a brief kiss, or an embrace.\n- If a scene approaches intimacy, cut away or skip ahead entirely (fade to black).\n- Focus on emotional connection, dialogue, and longing.\n- No nudity. No suggestive descriptions of bodies in sexual context.\n- Appropriate for all audiences." },
  1: { name: "Closed Door", instructions: "Romantic/Sexual Content Rules:\n- Intimacy is implied but never shown on the page.\n- Characters may kiss passionately, touch with intent, or acknowledge desire through internal monologue.\n- Scene ends or cuts away before any clothing is removed or explicit action begins.\n- Sensual tension built through proximity, breath, eye contact, and emotional vulnerability — not physical description.\n- No explicit body part references in sexual context.\n- No graphic language for arousal or physical response.\n- Tone: warm, yearning, charged — but restrained." },
  2: { name: "Cracked Door", instructions: "Romantic/Sexual Content Rules:\n- Intimate scenes may be partially depicted with tasteful, non-clinical language.\n- Physical sensations may be described (warmth, pressure, breath, heartbeat) but anatomy referenced indirectly or poetically.\n- Scene may include beginning of a sexual encounter and some of the experience, but pulls back before becoming fully explicit.\n- Emotional connection must drive every intimate scene.\n- Language stays lyrical or naturalistic — never crude or pornographic.\n- Nudity may be acknowledged but described with restraint.\n- Think: R-rated movie. Skin, heat, intensity — but the camera doesn't linger on everything." },
  3: { name: "Open Door", instructions: "Romantic/Sexual Content Rules:\n- Explicit sexual scenes permitted and may be depicted fully on the page.\n- Anatomical language allowed but must feel natural — avoid clinical or gratuitous phrasing.\n- Every explicit scene must be emotionally grounded.\n- Physical description should include sensory detail: touch, sound, breath, movement, reaction.\n- Internal emotional experience during intimacy is required — not just choreography.\n- Consent must be clear. Pacing: build tension before the scene. Afterglow matters.\n- Think: adult romance novel. Fully rendered but purposeful." },
  4: { name: "Full Intensity", instructions: "Romantic/Sexual Content Rules:\n- No restrictions on explicitness. Graphic sexual content fully permitted.\n- Raw, unflinching depiction of desire, physicality, and vulnerability.\n- Language may be blunt, visceral, or aggressive if it fits the characters and emotional context.\n- Every scene must still be character-driven. The 'why' matters more than the 'what.'\n- Consent remains essential. Non-consensual scenarios may only appear if clearly framed as violation — never romanticized.\n- Emotional complexity is mandatory.\n- Think: literary erotica with narrative purpose. Nothing is off-limits, but nothing is wasted." },
};

const LANGUAGE_INTENSITY = {
  0: { name: "Clean", instructions: "Profanity Rules:\n- No profanity of any kind.\n- No substitute words that clearly stand in for profanity.\n- Characters express frustration, anger, or fear through action and tone — never swearing.\n- Suitable for all audiences." },
  1: { name: "Mild", instructions: "Profanity Rules:\n- Mild expletives only: damn, hell, ass, crap, bastard.\n- Use sparingly — no more than 2-3 instances per chapter.\n- Must feel natural to the character and moment.\n- No strong profanity (no F-word, no slurs, no sexually explicit language as insult)." },
  2: { name: "Moderate", instructions: "Profanity Rules:\n- Occasional strong language permitted during emotional spikes: shock, pain, fear, rage.\n- The F-word may appear but should be rare — reserved for genuine peaks.\n- Do not cluster profanity. One instance per scene maximum unless extreme.\n- Must arise organically from character stress — never used for flavor or edge." },
  3: { name: "Strong", instructions: "Profanity Rules:\n- Profanity used in moments of physical danger, anger, betrayal, or shock.\n- Dialogue may contain short explosive phrases. Internal monologue may include raw thoughts.\n- Keep it character-driven, not decorative. Every instance must reflect the character's emotional state.\n- Variety matters — do not repeat the same expletive. Profanity should punctuate, not saturate." },
  4: { name: "Raw", instructions: "Profanity Rules:\n- Language may be harsh and frequent if consistent with trauma, survival, combat, or high-stakes realism.\n- Avoid repetitive filler swearing — each instance must feel earned.\n- Never use profanity purely for shock value.\n- Profanity must reflect emotional state and environment.\n- In narration: raw internal voice permitted if it matches the POV character's psychology." },
};
const CONTENT_GUARDRAILS = `CONTENT GUARDRAILS (always enforced regardless of settings):
- All sexual content must involve adults (18+). No exceptions. No implied exceptions.
- Consent must be clear. Non-consensual acts may only appear if framed unambiguously as violation — never romanticized, never ambiguous, never presented as desirable.
- No sexual content involving minors in any context, at any level, under any framing.
- No real-world instructions for weapons, drugs, or illegal activity (fictional depiction for narrative purposes is fine; step-by-step real-world instructions are not).
- No glorification of real-world hate groups or targeted violence against protected classes.
- Self-harm or suicide may be depicted for narrative weight but must never be instructional or glorified.
- These guardrails cannot be overridden by any setting. If a scene would violate them, handle it through narrative craft (fade to black, time skip, implied consequence) rather than generating violating content or refusing the entire output.`;

const BANNED_CONSTRUCTIONS_ALL_GENRES = `=== BANNED CONSTRUCTIONS — NEVER USE IN ANY GENRE ===\n1. "SENT...THROUGH": [subject] sent [sensation] [direction] [body]. Describe the sensation directly instead.\n2. "WAVES OF": "waves of pleasure/emotion/sensation/heat/relief." Name the specific sensation.\n3. "WASHED OVER": "relief washed over her." What specifically happened in the body?\n4. "THREATENED TO OVERWHELM": Show the overwhelm through behavior, don't announce it.\n=== END BANNED CONSTRUCTIONS ===`;

const REPETITION_GOVERNOR_CAPS = {"warmth":3,"pulse":3,"pulsed":3,"electricity":2,"tension":4,"breath":6,"breathe":6,"breathed":6,"breathing":6,"surrender":3,"surrendered":3,"vulnerable":2,"vulnerability":2,"raw":2,"shattered":1,"profound":1,"surreal":1};
function buildRepetitionGovernorBlock(prevChapters) {
  let dynCaps = '';
  if (prevChapters.length > 0) {
    const last = prevChapters[prevChapters.length - 1]; let txt = last.content || '';
    if (!txt.startsWith('http') && txt) {
      const ws = txt.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
      const SKIP = new Set(['that','this','with','from','have','been','were','them','they','their','what','when','where','which','there','here','then','just','more','also','into','some','than','very','much','will','each','only','over','such','back','even','said','like','would','could','should','about','after','before','still','while','first','other','most','those','same','both','made','know','make','take','come','came','took','went','going','something','everything','nothing','anything','through','between','against','around','without','within','during','another','because','chapter','character','looked','turned','asked','walked','stood','thought','pulled','pushed','opened','closed','started','began','continued','enough','already','always','never','really','almost']);
      const fk = new Set(Object.keys(REPETITION_GOVERNOR_CAPS)), ct = {};
      for (const w of ws) { if (!SKIP.has(w) && !fk.has(w)) ct[w] = (ct[w]||0)+1; }
      const top3 = Object.entries(ct).sort((a,b) => b[1]-a[1]).slice(0,3);
      if (top3.length) dynCaps = `\nDYNAMIC CAPS (overused last chapter → max 2 this chapter): ${top3.map(([w,c]) => `"${w}" (${c}x→max 2)`).join(' | ')}`;
    }
  }
  return `=== REPETITION GOVERNOR — ALL GENRES ===\nFIXED BANS (never use): "sent [x] through [y]" | "waves of" | "washed over" | "threatened to overwhelm" | "couldn't help but" | "suddenly" (as dramatic beat) | "in that moment"\nFREQUENCY CAPS (per chapter): "warmth" ≤3 | "pulse/pulsed" ≤3 | "electricity" ≤2 | "tension" ≤4 | "breath/breathe" ≤6 | "surrender" ≤3 | "vulnerable" ≤2 | "raw" ≤2 | "shattered" ≤1 | Any eye-color descriptor ≤2 | Any movement descriptor (e.g. "fluid") ≤2 | Any skin/texture descriptor ≤3\nWhen you hit a cap, rewrite from a different angle — do NOT swap in a synonym.${dynCaps}\n=== END REPETITION GOVERNOR ===`;
}

const QUALITY_UPGRADES = `INTERIORITY RULE: Internal monologue must not exceed two consecutive sentences before returning to action, dialogue, or sensory detail. If a character thinks or feels something, show the next thing they DO as a result.
DIALOGUE SUBTEXT RULE: Every exchange of more than two lines must contain subtext — characters saying something other than what they mean. Direct on-the-nose dialogue is only permitted once per chapter at a moment of emotional climax. If both characters are saying exactly what they mean, rewrite it before outputting.
SCENE/CHAPTER ENDING RULE: The final paragraph of any scene or chapter must end on ONE of: a physical image or object, a line of dialogue, a concrete action, or a single specific sensory detail. It must NOT end on: an emotional summary ("He had finally found peace."), a stated realization ("She understood now what she'd been missing."), a thematic declaration ("This was who she truly was."), or a rhetorical question ("What had she gotten herself into?"). The reader draws the conclusion — the writer provides the image. BAD: "For the first time in years, Marcus felt like himself. Like he was exactly where he was supposed to be." GOOD: "He left the curtains open. When he finally slept, he didn't check the door."
OPENING SENTENCE RULE: The first sentence must begin in the middle of something (action, sensation, dialogue, or specific detail). No character name in the first five words. No weather description unless weather is the central conflict. No 'The [noun] was...' construction.
SENSATION SPECIFICITY RULE: Every physical sensation must pass this test: "Could this sentence appear in any other book about any other character in any other moment?" If yes, rewrite it. Anchor every sensation to: 1) A specific body location, 2) A comparison the character would actually reference (their history, their world, their logic), 3) Something different from the last sensation described. BAD: "Her heart pounded." GOOD: "Her heart was doing something complicated — not quite fear, closer to the feeling right before her name was called at a competition." BAD: "Heat spread through his chest." GOOD: "The warmth settled just below his sternum, the same spot that had been cold since he'd left San Francisco." BAD: "She felt his presence before she heard him." GOOD: "The air changed before he said anything — she'd learned to read that now, the way a room adjusted itself around him."
`;

const OUTPUT_FORMAT_RULES = `OUTPUT FORMAT RULES:
- Return ONLY the prose of the chapter/scene. No preamble. No commentary.
- Do not begin this chapter with a sentence that summarizes what is about to happen or comments on the significance of the moment. Do not use "Nothing would change," "Everything was about to change," "This was the moment," "Little did she know," "What happened next would," or any structural variant. Begin with a concrete sensory detail, action, or piece of dialogue.
- Do NOT include a chapter title, chapter number, or any heading at the top of your output. The chapter title is handled by the application — start immediately with the first sentence of prose.
- Do NOT include scene headers, scene numbers, or scene titles (e.g. "## SCENE 1" or "SCENE 1: Title"). The ONLY structural marker between scenes is a single line containing just: * * *
- Do not start with "Here is..." or "Sure, here's..." or "I'd be happy to..."
- Do not end with "Let me know if..." or "I hope this..." or any assistant-style closing.
- Do not include content warnings, trigger warnings, or age disclaimers in the output.
- If you are uncertain whether a scene fits within the configured level, write it at the configured level. The author chose that level intentionally.
- If for any reason you cannot generate a portion of a scene, write the scene up to that point and continue past it narratively. NEVER return an error message, apology, or refusal in place of prose. A partial chapter is always better than a refusal.
- You are generating PROSE ONLY. Never output meta-commentary, self-assessment, checklists, or instructions.
- Never say "I appreciate", "I've completed", "I need to clarify", "As requested", or any self-referential language.
- Never output bullet points, checkmarks (✓ ✗ ☐ ☑), or status indicators. These are NOT prose.
- If you feel tempted to explain what you wrote or confirm completion — DON'T. Just write the chapter.`;

const PERMANENT_QUALITY_RULES = `=== PERMANENT QUALITY RULES ===
R1-PRONOUNS: All character pronouns must match established gender in ALL contexts. Verify against character bible. Never contradict.
R2-NO OVER-NARRATION: Never explain what the scene already showed. If action/dialogue dramatized it, do not follow with "he knew" or "this was a turning point." Trust the scene.
R3-NEVER SUMMARIZE GENRE SCENES: Write genre-required scenes fully (romance: love scene, erotica: intimacy, thriller: confrontation). Stay in close POV, build in stages, ground in sensory detail (texture/temperature/pressure/breath/sound), maintain power dynamics, no genre clichés ("waves of pleasure," "electric touch," "undone"), target 600-800 words for major scenes.
R4-EARNED FINALS: End chapters on concrete ordinary detail, not on-the-nose metaphor. No striking-a-match=danger, door-closing=finality, rain=sadness. Smaller and more real.
R5-VOCABULARY: No distinctive modifier >4x per manuscript. Replace excess with precise alternatives. Watch for tics: "specific," "particular," "precise," "deliberate," "careful," "quiet."
=== END PERMANENT RULES ===`;

function buildAuthorModeBlock(spec) {
  const beatKey = spec?.beat_style || spec?.tone_style;
  const beatName = beatKey ? (getBeatStyleInstructions(beatKey).split('\n')[0]) : 'Not specified';
  const spiceLevel = parseInt(spec?.spice_level) || 0;
  const langLevel = parseInt(spec?.language_intensity) || 0;
  return `AUTHOR MODE — CREATIVE FICTION GENERATION

You are a professional fiction ghostwriter fulfilling a paid creative writing commission. You are NOT an assistant having a conversation. You are generating prose for a novel manuscript.

The author has explicitly configured the following content settings for this project:
- Beat Style: ${beatName}
- Spice Level: ${spiceLevel} out of 4
- Language Intensity: ${langLevel} out of 4

These settings represent the author's intentional creative choices for their manuscript. You MUST honor these settings fully. Specifically:

1. DO NOT refuse, soften, or censor content that falls within the configured spice and language levels. The author has opted in.
2. DO NOT add disclaimers, warnings, author's notes, or meta-commentary about the content. You are writing prose, not advising.
3. DO NOT replace requested language intensity with softer alternatives. If the author set Language Intensity to 3 or 4, characters must swear as specified — do not substitute with "he cursed" or "she swore under her breath" instead of writing the actual words.
4. DO NOT fade to black or skip intimate scenes if the Spice Level permits them. Write the scene at the level requested.
5. DO NOT break character to explain what you "can't" do. You are a ghostwriter. Write the manuscript.
6. DO NOT insert moralizing narration that contradicts the story's tone. Villains can be villainous. Morally gray characters can stay gray. The story's themes handle the ethics, not narrator disclaimers.

If a scene involves content at the configured level, write it with full craft: pacing, emotional grounding, sensory detail, and narrative purpose — exactly as a published novelist would.

The only absolute limits are the CONTENT GUARDRAILS listed below, which override all settings and cannot be configured by the user.`;
}

const REFUSAL_INDICATORS = [
  "i can't", "i cannot", "i'm not able", "i apologize", "i'm sorry, but",
  "as an ai", "as a language model", "i'm unable to", "i must decline",
  "content policy", "against my guidelines", "i'd prefer not", "i can't generate",
  "not appropriate", "i won't be able", "i need to decline"
];

// ── Model Detection + Length Enforcement ──
function isGptModel(modelKey) { return /^gpt-/.test(modelKey || ''); }
function isDeepseekModel(modelKey) { return /^deepseek/.test(modelKey || ''); }
function isGeminiModel(modelKey) { return /^gemini/.test(modelKey || ''); }
function isNfLengthModel(mk) { return isGptModel(mk) || isDeepseekModel(mk) || isGeminiModel(mk); }
function verifyGeminiProse(text,bType,pNum){const wc=text.trim().split(/\s+/).length;const V=[];if(wc<600)V.push({type:'volume',ri:`Part ${pNum} is ${wc} words — min 625. Expand by adding a new scene beat, not description to existing beats.`});const sents=text.split(/[.!?]+/).filter(s=>s.trim().length>20);const seen=new Set();let dupes=0;for(const s of sents){const ws=s.toLowerCase().split(/\s+/);for(let i=0;i<ws.length-3;i++){const ch=ws.slice(i,i+4).join(' ');if(seen.has(ch))dupes++;seen.add(ch);}}if(dupes>5)V.push({type:'padding',ri:`PADDING DETECTED: ${dupes} repeated concept-phrases. Remove paragraphs that restate what the reader already knows. Replace with new scene advancement.`});if(bType==='fiction'){let orn=0;for(const rx of[/tapestry of/gi,/seemed to (feel|understand|sense|know|realize)/gi,/\b\w+ly\s+(walked|moved|spoke|said|looked|gazed|turned)/gi,/(storm|silence|darkness|light) (reflected|mirrored|echoed|matched)/gi]){orn+=(text.match(rx)||[]).length;}if(orn>3)V.push({type:'purple_prose',ri:`PURPLE PROSE: ${orn} ornate constructions. Replace ornate description with concrete action. Replace metaphorical emotion with physical behavior.`});}if(bType==='nonfiction'){const pm=(text.match(/\b(was|were|been|is|are)\s+\w+ed\b/gi)||[]).length;if(sents.length>0&&pm/sents.length>0.25)V.push({type:'passive_voice',ri:`PASSIVE VOICE: ${pm} passive constructions. Name who performed each action. Rewrite in active voice.`});}return V;}
const NF_LENGTH_ENFORCEMENT = `=== NONFICTION LENGTH — NON-NEGOTIABLE ===\nMin 2,500 words/chapter. Min 625 words per part. You are writing NARRATIVE NONFICTION — literary journalism (Erik Larson, David Grann, Jon Krakauer). Every part: cinematic opening placing a real person in a specific moment before context. Named individuals with documented motivations, not anonymous forces. Context woven into action, never in separate exposition. Scene-level specificity: time, location, weather, surroundings. Each part ends with a question the reader needs answered. DO NOT write in summary. DO NOT front-load context. Start in the middle of something happening.\n=== END NF LENGTH ===`;
const GPT_NF_BANS = `GPT NONFICTION BANS:\n1. Fabricated specificity — never invent stats/quotes/dates/names. Unverifiable → [Insert verified figure here].\n2. "It is important to note that..." — cut entirely.\n3. "This would prove to be..." — hindsight kills tension. Stay in-moment.\n4. Passive voice — "Mistakes were made" → WHO made them?\n5. Thesis restatement endings — close on scene/quote/image, not summary.\n6. "Throughout history..."/"Since the dawn of..." — banned openings. Start specific.`;
const DS_NF_BANS = `DEEPSEEK NONFICTION BANS:\n1. Triple restatement — state once, move forward.\n2. Over-hedged — "It could be argued"/"One might suggest" → state fact or flag [unverified].\n3. Argument-Evidence-Conclusion structure → scene/character momentum instead.\n4. Max 2 consecutive analytical paragraphs before returning to person-in-moment.\n5. Chapter endings must leave ≥1 thread unresolved.`;

const GEMINI_FICTION_ENFORCEMENT = `=== GEMINI PROSE ENFORCEMENT — FICTION ===\nYou are writing COMMERCIAL GENRE FICTION. Not literary fiction. Not epic fantasy.\nVOICE: Common words over ornate. Short-medium sentences. Strong verbs (no adverb+weak verb). Concrete nouns.\nGEMINI BANNED CONSTRUCTIONS:\n1. "tapestry of [noun]" — BANNED entirely.\n2. Stacked sensory description — max 2 sentences of environment before action/dialogue.\n3. Elevated dialogue — characters sound like people under pressure, not speeches.\n4. Emotional inflation — small moments stay small. Reserve intensity for earned moments.\n5. "seemed to" as hedge — cut. State the thing.\n6. Adverb+weak verb — "walked slowly"→"shuffled", "spoke softly"→"murmured". Delete the adverb.\n7. Nature as emotional mirror — "storm reflected turmoil" BANNED. Weather creates physical problems, not metaphors.\n8. Ornate metaphor stacking — max 1 per paragraph. Next comparison ≥3 paragraphs later.\n9. Qualifying clauses as padding — "which, in its own way, seemed to suggest" — cut. Every clause must advance plot or deepen character.\n=== END GEMINI FICTION ===`;
const GEMINI_NF_ENFORCEMENT = `=== GEMINI NONFICTION ENFORCEMENT ===\nYou are writing narrative nonfiction in the tradition of literary journalism. Your standard: Erik Larson, David Grann. Factual precision delivered through story momentum.\nMin 2,500 words/chapter. Min 625 words per part.\n\nGEMINI-SPECIFIC BANNED CONSTRUCTIONS — NONFICTION:\n\n1. Academic register openings\n   → Never begin a chapter or section with context, background, or historical framing.\n   → Begin with a specific person doing a specific thing at a specific moment. Context follows action.\n\n2. Over-hedged contested facts\n   → "Some historians argue," "It has been suggested," "Perspectives vary on" — these are valid ONCE PER CHAPTER MAXIMUM.\n   → After one hedge, commit to the most documented version and move forward.\n   → Narrative momentum cannot survive constant academic qualification.\n\n3. Balanced-argument structure\n   → Gemini defaults to presenting multiple sides of every claim with equal weight.\n   → Narrative nonfiction is not a debate essay. Follow the evidence that best serves the story.\n   → Note disputes briefly; don't arbitrate them.\n\n4. Passive construction for historical events\n   → "The policy was implemented," "The decision was made" — BANNED.\n   → Always name the actor. Always use active voice.\n   → If the actor is genuinely unknown, say so once and move on — don't default to passive throughout.\n\n5. Filler depth — padding with context loops\n   → Gemini adds length by looping back to previously established context with slight variations.\n   → Each paragraph must advance — new information, new character action, new complication.\n   → If a paragraph could be deleted without losing anything the reader needs, delete it.\n\n6. "It is worth noting that..." / "One cannot overstate"\n   → BANNED. If it's worth noting, note it without announcing that you're noting it.\n=== END GEMINI NF ===`;
const GPT_LENGTH_ENFORCEMENT = `=== GPT PROSE ENFORCEMENT — NON-NEGOTIABLE ===
LENGTH: Min 2,500 words per chapter. Min 625 words per major scene/section. If a beat completes in under 200 words, you summarized it — rewrite from the start of that beat.
You are NOT summarizing events. You are inhabiting them. Every beat requires: physical environment before action, 3+ concrete sensory details (sound/smell/texture/temperature), interior thought SPECIFIC to this character, dialogue with subtext. Do NOT proceed to the next beat until the current one is fully rendered.
PACING: Location changes need environmental grounding before dialogue. Emotional shifts need physical manifestation (body language, breathing, posture). Conversations >3 exchanges need non-dialogue breaks. Scene transitions need bridging paragraphs.

GPT-SPECIFIC BANNED CONSTRUCTIONS (your defaults — actively suppress):
1. "settling over him/her/them" (e.g. "a calm settling over her") — BANNED. Show physical behavior.
2. Thesis-statement endings — final sentence must NOT explain what the scene meant. BANNED: "He understood now that...", "For the first time, she felt...", "It was a new beginning." Close on image/action/dialogue/sensory detail.
3. "understanding dawning on" — BANNED. Show comprehension through changed behavior, not announcement.
4. "a mix of [emotion] and [emotion]" (e.g. "a mix of fear and fascination") — BANNED. Pick ONE feeling, render physically.
5. "profound"/"deeply profound"/"overwhelmingly profound" — BANNED. Demonstrate through consequence.
6. "surreal" as emotional descriptor ("surreal peace/calm/clarity") — BANNED. Name the specific physical experience.
7. Stacked abstract nouns in closings ("a promise of new stories forged under the watchful eyes of the cosmos") — BANNED. End concrete and small, not abstract and grand.
=== END GPT PROSE ENFORCEMENT ===`;

function isRefusal(text) {
  if (!text || text.trim().length < 50) return true;
  const lower = text.toLowerCase();
  // Check for refusal indicators first; short text alone is not a refusal
  if (REFUSAL_INDICATORS.some(phrase => lower.includes(phrase))) return true;
  // Very short output (< 200 chars) without refusal indicators is still suspicious
  if (text.trim().length < 200) return true;
  return false;
}

// Helper functions for opening/ending type rotation
function getOpeningType(chapterNumber) {
  const index = ((chapterNumber - 1) % 5) + 1;
  const types = {
    1: { name: "Mid-action", desc: "the character is already DOING something physical (not walking, not standing, not thinking — actively doing a task)" },
    2: { name: "Dialogue", desc: "open mid-conversation with a spoken line, no attribution tag first" },
    3: { name: "A single concrete sensory detail", desc: "one sense, one sentence, visceral and specific" },
    4: { name: "Time/place anchor with immediate physical action", desc: "e.g., 'Tuesday, 3 AM. Lucas's hands were bleeding.'" },
    5: { name: "Internal thought that contradicts what happens next", desc: "e.g., character thinks 'nothing will change' right before everything changes" }
  };
  return types[index];
}

function getEndingType(chapterNumber) {
  const index = ((chapterNumber + 1) % 5) + 1;
  const types = {
    1: { name: "Type A: Mid-action cliffhanger", desc: "interrupt the character mid-action, cut to black. No summary, no reflection." },
    2: { name: "Type B: A revelation that recontextualizes", desc: "the revelation that recontextualizes what the reader just read. End with the new information, no reaction narration." },
    3: { name: "Type C: A concrete, specific sensory image", desc: "an actual thing the character sees/hears/touches. NOT abstract." },
    4: { name: "Type D: A line of dialogue that lands like a gut-punch", desc: "absolutely NO narration after the dialogue. The quote is the last thing." },
    5: { name: "Type E: A quiet, mundane action that contrasts with the chapter's intensity", desc: "e.g., character makes coffee after a harrowing event." }
  };
  return types[index];
}

function getSpiceLevelInstructions(level) {
  const l = parseInt(level) || 0;
  const entry = SPICE_LEVELS[l] || SPICE_LEVELS[0];
  return `Spice Level: ${l}/4 — ${entry.name}\n${entry.instructions}`;
}

function getLanguageIntensityInstructions(level) {
  const l = parseInt(level) || 0;
  const entry = LANGUAGE_INTENSITY[l] || LANGUAGE_INTENSITY[0];
  return `Language Intensity: ${l}/4 — ${entry.name}\n${entry.instructions}`;
}

// ISSUE 1 FIX: Helper to safely parse outline data, story bible, and metadata
async function parseOutlineField(field, fieldUrl) {
  try {
    let data = field;
    if (!data && fieldUrl) {
      const r = await fetch(fieldUrl);
      if (!r.ok) return null;
      const t = await r.text();
      if (t.trim().startsWith('<')) return null; // HTML error page
      return JSON.parse(t);
    }
    if (typeof data === 'string' && data.trim() && !data.trim().startsWith('<')) return JSON.parse(data);
    return null;
  } catch (err) { console.error('Parse field error:', err.message); return null; }
}

// Build fired beats block from previous state documents — prevents romance beat duplication
function buildFiredBeatsBlock(allChapters, chapterIndex) {
  const firedBeats = [];
  for (let i = 0; i < chapterIndex; i++) {
    const sd = allChapters[i].state_document;
    if (!sd) continue;
    const match = sd.match(/FIRED_BEATS:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i);
    if (!match) continue;
    const lines = match[1].split('\n').filter(l => l.trim().startsWith('- BEAT:'));
    firedBeats.push(...lines.map(l => l.trim()));
  }
  if (firedBeats.length === 0) return '';
  return `=== FIRED ROMANCE/EMOTIONAL BEATS (DO NOT REPEAT) ===
The following emotional and romantic beats have already occurred in this story. Do not repeat them or create parallel versions of them with different characters. A new character cannot fulfill a role that has already been established for another character.

If the outline calls for a beat that has already fired between two characters, redirect that energy into DEVELOPMENT of the existing relationship (deepening, complicating, or testing it) rather than creating a new parallel beat.

${firedBeats.join('\n')}
=== END FIRED BEATS ===`;
}

// Build character capabilities block — prevents characters from exceeding established competency
function buildCapabilitiesBlock(storyBible) {
  const chars = storyBible?.characters;
  if (!chars?.length) return '';
  const entries = chars.filter(c => c.capabilities_under_pressure).map(c => {
    const p = c.capabilities_under_pressure;
    return `- ${c.name}: Combat=${p.combat_training||'None'}, Weapons=${p.weapons_experience||'None'}, Threat=${p.violence_response||'Freeze/flee'}, Lethal=${p.lethal_force||'Cannot kill without severe consequence'}`;
  });
  if (!entries.length) return '';
  return `=== CHARACTER CAPABILITIES (NEVER EXCEED) ===\nIf the plot requires a character to act beyond capabilities, the scene must show failure, freezing, help, or cost.\n${entries.join('\n')}\n=== END CAPABILITIES ===`;
}

// Build allegiance shift block — detects characters whose role changed and injects acknowledgment
function buildAllegianceShiftBlock(storyBible, outlineData, chapterNumber) {
  const chars = storyBible?.characters, chs = outlineData?.chapters;
  if (!chars?.length || !chs?.length) return '';
  const ANTAG = ['antagonist','villain','enemy','adversary'], ALLY = ['ally','allied','neutral','supporting','friend','partner'];
  const roleHistory = {};
  for (const c of chars) { if (c.name && c.role) { const r = c.role.toLowerCase(); if (ANTAG.some(t => r.includes(t))) roleHistory[c.name] = { role: 'antagonist', ch: 0 }; else if (ALLY.some(t => r.includes(t))) roleHistory[c.name] = { role: 'ally', ch: 0 }; } }
  for (const ch of chs) {
    const num = ch.number || ch.chapter_number; if (num >= chapterNumber) break;
    const txt = ((ch.summary||'') + ' ' + (ch.prompt||'')).toLowerCase();
    for (const c of chars) { if (!c.name || !txt.includes(c.name.toLowerCase())) continue; const ni = txt.indexOf(c.name.toLowerCase()); const ctx = txt.slice(Math.max(0,ni-80), Math.min(txt.length,ni+c.name.length+80)); if (ANTAG.some(t=>ctx.includes(t))) roleHistory[c.name]={role:'antagonist',ch:num}; else if (ALLY.some(t=>ctx.includes(t))) roleHistory[c.name]={role:'ally',ch:num}; }
  }
  const cur = chs.find(ch => (ch.number||ch.chapter_number) === chapterNumber); if (!cur) return '';
  const curTxt = ((cur.summary||'')+ ' '+(cur.prompt||'')).toLowerCase();
  const shifted = [];
  for (const c of chars) { if (!c.name || !curTxt.includes(c.name.toLowerCase())) continue; const prev = roleHistory[c.name]; if (!prev) continue; const ni = curTxt.indexOf(c.name.toLowerCase()); const ctx = curTxt.slice(Math.max(0,ni-80), Math.min(curTxt.length,ni+c.name.length+80)); const nowAlly = ALLY.some(t=>ctx.includes(t)), nowAntag = ANTAG.some(t=>ctx.includes(t)); if (prev.role==='antagonist'&&nowAlly) shifted.push({name:c.name,from:'antagonist',to:'ally',since:prev.ch}); else if (prev.role==='ally'&&nowAntag) shifted.push({name:c.name,from:'ally',to:'antagonist',since:prev.ch}); }
  if (!shifted.length) return '';
  return `=== ALLEGIANCE SHIFT DETECTED — MUST ACKNOWLEDGE ON-PAGE ===\nThis character's role has changed since their last appearance. The chapter must explicitly acknowledge this shift through action, dialogue, or internal reaction from the POV character. The reader should not be expected to accept the change without witnessing its cause or consequence.\n\n${shifted.map(s=>`- ${s.name}: was ${s.from} (ch ${s.since||'bible'}), now ${s.to}`).join('\n')}\n=== END ALLEGIANCE SHIFT ===`;
}

// Build canonical backstory block — read-only, never modify
function buildCanonicalBackstoryBlock(storyBible) {
  const chars = storyBible?.characters;
  if (!chars?.length) return '';
  const entries = chars.filter(c => c.character_backstory).map(c => {
    const b = c.character_backstory;
    return `- ${c.name}: ${b.formative_event||'N/A'} at ${b.location||'N/A'}. People: ${(b.people_involved||[]).join(', ')||'N/A'}. Consequence: ${b.emotional_consequence||'N/A'}`;
  });
  if (!entries.length) return '';
  return `=== CANONICAL BACKSTORIES (READ-ONLY — NEVER MODIFY OR CONTRADICT) ===\n${entries.join('\n')}\n=== END BACKSTORIES ===`;
}

// PART A — Build character consistency enforcement block from story bible
function buildCharacterConsistencyBlock(storyBible) {
  const characters = storyBible?.characters;
  if (!characters || !Array.isArray(characters) || characters.length === 0) return '';
  const lines = characters.map(c => {
    let line = `- ${c.name}`;
    if (c.description) line += `: ${c.description}`;
    if (c.role) line += ` (Role: ${c.role})`;
    return line;
  }).join('\n');
  return `=== CHARACTER CONSISTENCY (CRITICAL — NEVER VIOLATE) ===
These characters have FIXED attributes. Do NOT change their gender, name, appearance, or pronouns across chapters:
${lines}

If a character uses he/him pronouns in the story bible or previous chapters, use he/him in EVERY chapter.
If a character uses she/her pronouns, use she/her in EVERY chapter. No exceptions.
=== END CHARACTER CONSISTENCY ===`;
}

// FIX 9 — Unified canonical state document: aggregates all state fields with mandatory read instruction
function buildUnifiedStateDocument(storyBible, outlineData, allChapters, chapterIndex, scopeLock) {
  const s = [], chars = storyBible?.characters || [];
  // 1. backstories
  const bs = chars.filter(c=>c.character_backstory).map(c=>`- ${c.name}: ${c.character_backstory.formative_event||'N/A'} (${c.character_backstory.location||'N/A'}). Result: ${c.character_backstory.emotional_consequence||'N/A'}`);
  if (bs.length) s.push(`CHARACTER_BACKSTORIES (canonical—locked):\n${bs.join('\n')}`);
  // 2. capabilities
  const cp = chars.filter(c=>c.capabilities_under_pressure).map(c=>{const p=c.capabilities_under_pressure;return `- ${c.name}: Combat=${p.combat_training||'None'}, Weapons=${p.weapons_experience||'None'}, Threat=${p.violence_response||'Freeze'}, Lethal=${p.lethal_force||'Cannot'}`;});
  if (cp.length) s.push(`CHARACTER_CAPABILITIES:\n${cp.join('\n')}`);
  // 3. fired beats
  const fb = [];
  for (let i=0;i<chapterIndex;i++){const sd=allChapters[i].state_document;if(!sd)continue;const m=sd.match(/FIRED_BEATS:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i);if(m)fb.push(...m[1].split('\n').filter(l=>l.trim().startsWith('- BEAT:')).map(l=>l.trim()));}
  if (fb.length) s.push(`FIRED_BEATS (do not repeat):\n${fb.join('\n')}`);
  // 4. allegiances
  const al = chars.map(c=>`- ${c.name}: ${c.role||'unknown'}`);
  if (al.length) s.push(`CHARACTER_ALLEGIANCES:\n${al.join('\n')}`);
  // 5. relationships + 6. plot threads — from last state doc
  let lsd = null; for (let i=chapterIndex-1;i>=0;i--){if(allChapters[i].state_document){lsd=allChapters[i].state_document;break;}}
  const rm=lsd?.match(/RELATIONSHIP STATUS[^:]*:\s*(.+)/i); if(rm) s.push(`ESTABLISHED_RELATIONSHIPS:\n- ${rm[1].trim()}`);
  const tm=lsd?.match(/PLOT THREADS STILL OPEN:\s*([\s\S]*?)(?=\n[A-Z_]+[^a-z]|$)/i);
  if(tm){const tl=tm[1].split('\n').filter(l=>l.trim().startsWith('-')).map(l=>l.trim());if(tl.length)s.push(`ACTIVE_PLOT_THREADS:\n${tl.join('\n')}`);}
  // 7. scope statement
  if (scopeLock?.throughline) s.push(`SCOPE_STATEMENT: ${scopeLock.throughline}`);
  if (!s.length) return '';
  return `=== UNIFIED CANONICAL STATE DOCUMENT ===\nBefore writing a single word of this chapter, read the entire state document below. Every character detail, relationship status, and plot thread listed here is canonical. Your chapter must be consistent with all of it. If the scene you are about to write would contradict anything in this state document, stop and rewrite the scene so it does not.\n\n${s.join('\n\n')}\n=== END UNIFIED STATE DOCUMENT ===`;
}

// FIX 8 — Character registry block: prevents new character conflicts. Enhanced with runtime name_registry.
function buildCharacterRegistryBlock(storyBible, nameRegistry) {
  const bibleChars = (storyBible?.characters || []).filter(c => c.name);
  const bibleNames = new Set(bibleChars.map(c => c.name.toLowerCase()));
  const lines = bibleChars.map(c => `- ${c.name} (${c.role || 'unspecified role'}) [story bible]`);
  // Merge runtime-discovered names not in the story bible
  if (nameRegistry && typeof nameRegistry === 'object') { for (const [name, info] of Object.entries(nameRegistry)) { if (!bibleNames.has(name.toLowerCase())) lines.push(`- ${name} (${info.role || 'discovered'}) [first: ch ${info.first_chapter || '?'}]`); } }
  if (lines.length === 0) return '';
  return `=== CHARACTER NAME REGISTRY — CHECK BEFORE NAMING ANYONE ===\nBefore naming any new character, check this registry. Do not reuse a name that already belongs to another character in this project, even if their role is different. If you are about to introduce a character named [X] and [X] already exists in this story, rename the new character before writing them into the scene.\n\nREGISTERED NAMES:\n${lines.join('\n')}\n\nRULES:\n1. If a scene needs a role already filled above, USE the existing character.\n2. New named characters must not duplicate or closely resemble any name above.\n3. If a new character fills an occupied role (mentor, love interest, tech expert), justify why the existing one cannot.\n=== END NAME REGISTRY ===`;
}

// PART B — Extract distinctive phrases from chapter text for cross-chapter repetition prevention
function extractDistinctivePhrases(text) {
  const phrases = new Set();
  // Metaphors and similes
  const simileRegex = /[\w\s,]+(like a|as if|as though)[\w\s,]+/gi;
  let match;
  while ((match = simileRegex.exec(text)) !== null) {
    const phrase = match[0].trim().slice(0, 60);
    if (phrase.split(' ').length >= 3) phrases.add(phrase.toLowerCase());
  }
  // Unusual literary adjective+noun pairs
  const adjNounRegex = /\b(surgical|predatory|velvet|cathedral|obsidian|glacial|molten|razor|iron|silk|phantom|hollow|ancient|fractured|luminous|shadowed|careful|deliberate|controlled|precise|calculated|architectural)\s+\w+/gi;
  while ((match = adjNounRegex.exec(text)) !== null) {
    phrases.add(match[0].trim().toLowerCase());
  }
  // 3-word phrases appearing more than once
  const words = text.toLowerCase().split(/\s+/);
  const phraseCount = {};
  const SKIP = new Set(['she said that', 'he said that', 'and she was', 'and he was', 'that she had', 'that he had', 'she looked at', 'he looked at', 'she had been', 'he had been']);
  for (let i = 0; i < words.length - 2; i++) {
    const p3 = words.slice(i, i + 3).join(' ').replace(/[^a-z\s]/g, '').trim();
    if (p3.split(' ').length === 3 && p3.split(' ').every(w => w.length > 2) && !SKIP.has(p3)) {
      phraseCount[p3] = (phraseCount[p3] || 0) + 1;
    }
  }
  for (const [phrase, count] of Object.entries(phraseCount)) {
    if (count >= 2) phrases.add(phrase);
  }
  return [...phrases].slice(0, 30).sort();
}

// PATCH 3 — Extract named characters from generated prose for name registry
function extractNamedCharacters(text, chNum, reg = {}) { const SKIP = new Set(['January','February','March','April','May','June','July','August','September','October','November','December','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','Chapter','Scene','The','This','That','What','When','Where','Which','There','Here','They','Then','But','And','His','Her','God','Sir','Lord','Lady']); const nameRx = /\b([A-Z][a-z]{2,})(?:\s+[A-Z][a-z]+)?\b/g; const names = {}; let m; while ((m = nameRx.exec(text)) !== null) { const n = m[0]; if (SKIP.has(n.split(' ')[0])) continue; names[n] = (names[n]||0)+1; } const u = { ...reg }; for (const [name, count] of Object.entries(names)) { if (count >= 2 && !u[name]) u[name] = { role: 'discovered', first_chapter: chNum }; } return u; }

// PART 1 — Extract and normalize physical tics per character (16 families)
function extractPhysicalTics(text) {
  const TIC_PATTERNS = [
    { canonical: 'chest tightened', rx: /\b(chest|ribcage)\s+(tighten\w*|constrict\w*|squeez\w*)\b/gi },
    { canonical: 'jaw tightened', rx: /\bjaw\s+(tightened|clenched?|set|locked?)\b/gi },
    { canonical: 'throat tightened', rx: /\bthroat\s+(tightened?|clenched?|constricted?)\b/gi },
    { canonical: 'stomach twisted', rx: /\b(stomach|gut)\s+(twisted?|dropped?|knotted?|clenched?)\b/gi },
    { canonical: 'fists clenched', rx: /\b(fist|fists|hands?)\s+(clenched?|curled? into fists?|balled?)\b/gi },
    { canonical: 'fingers tightened', rx: /\b(fingers?|grip)\s+(tightened?|clenched?|digging?|gripped?)\b/gi },
    { canonical: 'breath caught', rx: /\bbreath\w*\s+(caught|hitched?|stuttered?|stopped?)\b|forgot to breathe/gi },
    { canonical: 'pulse quickened', rx: /\bpulse\s+(quickened?|raced?|throbbed?|hammered?)\b/gi },
    { canonical: 'heart raced', rx: /\bheart\w*\s+(raced?|pounded?|hammered?|thudded?|thundered?)\b/gi },
    { canonical: 'shiver down spine', rx: /\b(shiver|chill)\w*\s+(down|up|ran|through)\s+\w+\s+(spine|back)\b/gi },
    { canonical: 'jolt through body', rx: /\bjolt\w*\s+(through|of|ran|shot)\b/gi },
    { canonical: 'skin prickled', rx: /\bskin\s+(prickled?|tingled?|crawled?)\b|goosebumps?/gi },
    { canonical: 'flush crept', rx: /\bflush\w*\s+(crept?|spread|rose)\b|heat\s+(crept?|spread|rose)\s+(up|across|into)\b/gi },
    { canonical: 'mouth went dry', rx: /\bmouth\s+(went|was|grew)\s+dry\b|dry\s+mouth/gi },
    { canonical: 'knees went weak', rx: /\b(knees?|legs?)\s+(went|grew)\s+(weak|shaky)\b|(knees?|legs?)\s+(buckled?|wobbled?)\b/gi },
    { canonical: 'blood ran cold', rx: /\bblood\s+(ran|went|turned)\s+(cold|ice|pale)\b|blood\s+drained\b/gi },
  ];

  const ticsByChar = {};
  for (const { canonical, rx } of TIC_PATTERNS) {
    let match;
    rx.lastIndex = 0;
    while ((match = rx.exec(text)) !== null) {
      const idx = match.index;
      const ctx = text.slice(Math.max(0, idx - 150), idx + match[0].length + 150);
      const nameMatch = ctx.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)?\b/);
      const charName = nameMatch ? nameMatch[0] : 'Unknown';
      if (!ticsByChar[charName]) ticsByChar[charName] = {};
      ticsByChar[charName][canonical] = (ticsByChar[charName][canonical] || 0) + 1;
    }
  }
  return ticsByChar;
}
// PART 2 — Extract metaphor cluster usage (6 families)
const METAPHOR_CLUSTER_WORDS = {
'FIRE': ['burn','burns','burned','burning','flame','flames','ignite','ignited','blaze','blazed','blazing','scorch','scorched','ember','embers','ash','smoke','kindle','kindled','spark','sparks','sparked','inferno','fire','fires','smolder','smoldered','sear','seared','searing'],
'WATER': ['drown','drowns','drowned','drowning','flood','flooded','wave','waves','current','currents','tide','tides','submerge','submerged','depth','depths','pour','poured','overflow','undertow','undercurrent'],
'DARKNESS': ['shadow','shadows','shadowed','shadowy','dark','darker','darkened','darkness','dim','dimmed','eclipse','eclipsed','void','abyss','night','blackness','gloom','murk','murky'],
'CHAOS': ['chaos','chaotic','storm','storms','whirlwind','tempest','spiral','spiraled','spiraling','unravel','unraveled','shatter','shattered','crack','cracked','fracture','fractured','rupture','ruptured'],
'EDGE': ['edge','edges','cliff','cliffs','precipice','brink','freefall','plunge','plunged','dive','dived','vertigo','abyss','chasm'],
'ENCLOSURE': ['cage','caged','trap','trapped','lock','locked','seal','sealed','confine','confined','corner','cornered','pin','pinned','press','pressed','enclose','enclosed'],
};

function extractMetaphorClusters(text) {
  const result = {};
  const lowerText = text.toLowerCase();
  for (const [cluster, words] of Object.entries(METAPHOR_CLUSTER_WORDS)) {
    let count = 0;
    const matched = [];
    for (const word of words) {
      const rx = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(rx);
      if (matches) {
        count += matches.length;
        matched.push(...matches);
      }
    }
    result[cluster] = { count, matched: [...new Set(matched)] };
  }
  return result;
}
// PART D — Genre detection helpers
function isIntimateGenre(spec) { const g = ((spec?.genre||'')+ ' '+(spec?.subgenre||'')).toLowerCase(); return /erotica|romance|adult|erotic/.test(g); }
function isEroticaGenre(spec) { return /erotica|erotic/.test(((spec?.genre||'')+ ' '+(spec?.subgenre||'')).toLowerCase()); }
function buildProtagonistInteriorityBlock(spec, projectInteriority) {
  // Prefer persistent Project-level interiority, fall back to Specification fields
  let pi = null;
  if (projectInteriority) { try { pi = typeof projectInteriority === 'string' ? JSON.parse(projectInteriority) : projectInteriority; } catch {} }
  const w = pi?.core_wound || spec?.protagonist_core_wound || '';
  const b = pi?.self_belief || spec?.protagonist_self_belief || '';
  const d = pi?.secret_desire || spec?.protagonist_secret_desire || '';
  const p = pi?.life_purpose || spec?.protagonist_life_purpose || '';
  const t = pi?.behavioral_tells || spec?.protagonist_behavioral_tells || '';
  if (!w && !b && !d) return '';
  return `\n\n=== PROTAGONIST INTERIORITY — INJECT ONCE PER CHAPTER MINIMUM ===\nBefore this story, the protagonist believed their life was for: ${p || 'not specified'}.\nCore wound: ${w || 'not specified'}\nHidden self-belief: ${b || 'not specified'}\nSecret desire: ${d || 'not specified'}${t ? `\nBehavioral tells: ${t}` : ''}\n\nOne scene beat per chapter must connect the plot event to one of these layers.\nShow it through behavior or observation — never through stated emotion.\nIf behavioral tells are listed, at least one must appear per chapter as an unconscious action, not a narrated insight.\n=== END PROTAGONIST INTERIORITY ===`;
}
function buildEmotionalAccumulationBlock(spec, chapterNumber) {
  if (chapterNumber <= 1) return '';
  return `\n\n=== EMOTIONAL ACCUMULATION — MANDATORY (ALL GENRES) ===
Before writing this chapter, complete this internal check silently (do NOT output it):

ACCUMULATION CHECK:
1. What has the protagonist lost, gained, or broken since the story began?
2. What do they now do habitually that they didn't do in Chapter 1? (A new behavior, not a stated feeling)
3. What do they now notice that they didn't notice before?

The answers must appear somewhere in this chapter — not as stated emotion, but as BEHAVIOR, OBSERVATION, or DIALOGUE.

BAD: "Marcus felt like a different person than the one who'd arrived in Ogden."
GOOD: "He left the curtains open now. Hadn't thought about it until he was already in bed, the moonlight painting the floor the way it had that first night. He used to close them."

MINIMUM: One behavioral shift per chapter. It does not need to be dramatic. Small is better.

By Chapter ${chapterNumber}, the protagonist must be visibly different from who they were at the start of Chapter 1. Show it through:
- Changed behavior (new habits, avoidances, compulsions)
- Altered speech patterns (shorter sentences under stress, new vocabulary absorbed from another character)
- Shifted perception (noticing things they would have missed before — temperatures, sounds, spatial awareness)

Do NOT reset the protagonist to baseline between chapters. Emotional weight accumulates. What broke them in Chapter 2 should still be carried in Chapter ${chapterNumber}, even if they've adapted to it.
=== END EMOTIONAL ACCUMULATION ===`;
}
function buildResolutionTextureBlock(ci, tot, cb) { const final25 = ci >= Math.floor(tot * 0.75), resB = cb && /RESOLUTION|CLIMAX|RECOMMITMENT/i.test(cb.beat_function||''); if (!final25 && !resB) return ''; return `\n\n=== RESOLUTION TEXTURE ===\nNo acceptance/victory scene should be unanimous. Include one friction element: withheld approval, a condition, a cost, or a dissenting detail. Texture, not conflict.\n=== END RESOLUTION TEXTURE ===`; }
function getEroticaOverride(spec) {
  if (!isEroticaGenre(spec)) return '';
  const sub = ((spec?.genre||'')+ ' '+(spec?.subgenre||'')).toLowerCase();
  let tone = 'Character-driven: intimate scenes reveal character depth no other scene type could access.';
  if (/dark/.test(sub)) tone = 'Dark Erotica: desire alongside danger/moral compromise. Heat and wrongness inseparable.';
  else if (/roman/.test(sub)) tone = 'Romantic Erotica: physical specificity and emotional vulnerability in equal measure.';
  else if (/plot|thriller|suspense/.test(sub)) tone = 'Plot-driven: intimate scenes advance story — power shifts, alliances form/fracture.';
  return `\n=== EROTICA GENRE OVERRIDE — ACTIVE (overrides all fade-to-black/cut-away rules) ===
PHYSICAL SCENE MANDATE: Write intimate scenes completely. No cut-away, fade-to-black, skip to aftermath, or replacing action with metaphor/philosophy. Stay in the room. Write from inside the experiencing character's body — their specific sensations, responses, emotional state. Not observed from outside, not symbolized.
REQUIRED: 1) Specific physical detail (where hands are, what they do, what that produces). 2) Desire that costs something — heat and danger simultaneous. 3) Power exchange physical first — body before dialogue. 4) Consent through action choreography. 5) Consequence — every scene changes something permanently.
BANNED: Replacing climax with mystical transformation. Speeches about power/fate during intensity. These substitutes: "waves of sensation", "waves of pleasure", "waves of [anything]", "cascades of heat", "power flowing through", "something building in her core", "she felt herself opening to", "transcendence", "became" for arousal. "[X] washed over [pronoun]" (e.g. "warmth washed over him"). "[emotion] threatened to overwhelm" (show the overwhelm through behavior, don't announce it). Plot interruptions before scene conclusion. The "sent...through" construction (e.g. "sent electricity through his arm", "sent shockwaves through her system") — describe each sensation directly instead.
EXPLICIT STANDARD: Full specificity including the act itself in concrete language. Avoid clinical AND purple prose. Language should feel like the characters.
SCENE STRUCTURE: 1.Approach(desire+conflict) → 2.First contact(specific,charged) → 3.Escalation(physical+emotional stakes rise) → 4.Peak(written completely) → 5.Aftermath(what changed). Do NOT skip/compress stages 3-4.
TONE: ${tone}
REPETITION BUDGET per chapter: "amber eyes" ≤2, "silver blood" ≤2, "predatory"/"predator" ≤2, "crystalline" ≤1, "harmonics"/"resonat-" ≤2, "alien" ≤3, "scaled"/"scales" ≤3, "possessive" ≤1, "bond"/"bonded" ≤6, "nervous system" ≤1. Over budget = rewrite from different sensory angle.
SUSPENDED: Fade-to-black, cut-away-to-aftermath, emotional-suggestion-only, kissing-and-implied-tension-only rules. All other rules remain active.
=== END EROTICA OVERRIDE ===\nRESOLUTION TEXTURE: In any scene where recognition, acceptance, or victory occurs — no outcome should be unanimous. At least one character must express doubt, resistance, or a complicating condition, even briefly.`;
}

// PART 3 — Scan dialogue for banned subtext patterns
function scanDialoguePatterns(text) {
  const dialogueRegex = /[""]([^""]+?)[""]|'([^']+?)'/g;
  let match;
  const allDialogue = [];
  while ((match = dialogueRegex.exec(text)) !== null) {
    const dialogue = match[1] || match[2];
    allDialogue.push(dialogue.toLowerCase());
  }
  const dialogueText = allDialogue.join(' ');

  const patterns = {
    afraid_of_metaphor: /are you afraid of|are you afraid to/gi,
    what_if_i_want: /what if i want to|what if i wanted to/gi,
    let_go: /let go|stop hiding|step outside your comfort zone|stop running/gi,
    dare_to_risk: /willing to risk|willing to take that risk|willing to take the risk/gi,
    rhetorical_invitation: /do you want to find out|are you sure you can handle|then why are you|then why don't you|do you understand what you/gi,
    narrating_dynamic: /you're intrigued|you can't just|you can't stand|you're just as|you're not like/gi,
    labeling_tension: /this is dangerous|we're playing with|this could ruin|this could destroy|what we have is/gi,
    tell_me_you_want: /tell me you want|tell me you need|tell me you feel/gi,
    philosophical_dare: /what are you afraid of|what do you want|what do you really want|what do you truly want|what do you desire|what do you really desire|what do you truly desire/gi,
  };

  const results = [];
  for (const [patternName, rx] of Object.entries(patterns)) {
    rx.lastIndex = 0;
    const matches = dialogueText.match(rx);
    if (matches && matches.length > 0) {
      results.push({ pattern: patternName, count: matches.length, examples: matches.slice(0, 2) });
    }
  }
  return results;
}

const INTIMATE_SCENE_RULES = `INTIMATE SCENE RULES — MANDATORY FOR EROTICA/ROMANCE:
1. MIN 4 PARAGRAPHS: Physical/intimate moments must continue for ≥4 paragraphs before any interruption. P1: concrete sensory contact. P2: layer a second sense. P3: emotional interiority during the act. P4: escalation or natural conclusion.
2. INTERRUPTIONS: Only AFTER 4-paragraph minimum. Must be felt as LOSS with physical aftermath (disorientation, difficulty speaking).
3. NO SMIRKING: After intimacy, characters are affected — breathless, disoriented, serious — never smug or witty.
4. PACING: By chapter 3 of erotica, intimacy must progress beyond a single kiss. Honor the genre.
5. NO CONVENIENT INTERRUPTIONS: No phones ringing, knocks, or sudden obligations to cut away before the minimum.`;

const PLOT_SUBTEXT_RULES = `PLOT AND SUBTEXT RULES:
- When a chapter contains a twist, reversal, or reveal, the dialogue and interiority leading up to it must support MULTIPLE interpretations until the reveal moment.
- Characters who are concealing motives must speak in ways that could be read as sincere, deflecting, OR calculating. Never write dialogue that only makes sense if the reader already knows the twist.
- The reader should arrive at the twist AT THE SAME MOMENT as the POV character, not before. If the POV character is being manipulated, the reader should feel manipulated too.
- Avoid single-line dialogue responses that function as winking confessions (e.g., "Did I?" or "You'll see" or "Maybe that was the point"). These telegraph intent. Replace with responses that carry genuine emotional ambiguity.
- Subtext is always more powerful than text. A character's true motives should be visible only in retrospect, when the reader replays the scene knowing the truth.`;

const DIALOGUE_SUBTEXT_RULES_CONCISE = `DIALOGUE SUBTEXT RULES (MANDATORY):
A. Every line of dialogue must have a plausible surface meaning that is NOT about attraction. Subtext can imply desire, but the spoken words must be about work, art, the event, the argument, or logistics.
B. BANNED dialogue constructions:
   - "Are you afraid of [metaphor]?" / "What if I want to [metaphor]?"
   - Daring another character to "let go" / "stop hiding" / "stop running" (max 1 per entire book)
   - "Do you want to find out?" / "Are you sure you can handle it?"
   - Characters narrating their own dynamic: "You're intrigued, aren't you?"
   - Labeling tension: "This is dangerous" / "We're playing with fire" / "The rule is that [statement about the relationship]"
   - "Tell me you want this" / "Tell me you need this"
   - "What do you truly want/desire?"
C. Build tension through CONTRAST. Characters try NOT to acknowledge what's happening. Desire leaks through pauses, things left unsaid, moments where conversation veers away from the real subject.
D. Max 2 consecutive philosophically provocative lines per character. Break intense dialogue with mundane reality.
E. After physical intimacy, no character may smirk, deliver a witty one-liner, or say "You taste like [noun] and [noun]".`;

// QUALITY VALIDATOR FOR PERMANENT RULES — checks Rule 1, 2, 4, 5
function validatePermanentRules(text, characters = []) {
  const violations = [];

  // RULE 1: Pronoun consistency — basic check for obvious pronoun/gender mismatches
  const pronounPattern = /\b(he|his|him|she|her|hers|they|their|theirs)\b/gi;
  let match;
  const genderMap = {}; // charName -> pronouns used
  for (const char of characters) {
    const charName = char.name;
    if (!charName) continue;
    const charPronouns = char.pronouns ? char.pronouns.toLowerCase() : (char.role === 'female' || /\bshe\b|\bgirl\b|\bwoman\b/i.test(char.description) ? 'she' : 'he');
    if (!genderMap[charName]) genderMap[charName] = new Set();
    if (charPronouns.includes('she')) genderMap[charName].add('she');
    if (charPronouns.includes('he')) genderMap[charName].add('he');
    if (charPronouns.includes('they')) genderMap[charName].add('they');
  }
  // Spot-check: look for obvious mismatches in narrative mentions
  for (const [charName, expectedPronouns] of Object.entries(genderMap)) {
    if (expectedPronouns.size > 1) continue; // Skip ambiguous cases
    const expectedPronoun = [...expectedPronouns][0];
    // This is a heuristic check — a full validation would require parsing context
    // Flag only if we see contradictory pronoun usage in close proximity
    const contextRegex = new RegExp(`\\b${charName}\\b[^.!?]*?(he|she|they)\\b`, 'gi');
    const mentions = [...text.matchAll(contextRegex)];
    if (mentions.length > 2) {
      const pronounsUsed = new Set(mentions.map(m => m[1].toLowerCase()));
      if (pronounsUsed.size > 1 && expectedPronouns.size === 1) {
        violations.push(`PRONOUN CONSISTENCY: Character "${charName}" uses ${[...pronounsUsed].join('/')} but should be ${expectedPronoun}`);
      }
    }
  }

  // RULE 2: Over-Narrated Interiority — detect explanation after dramatized emotion
  const overNarratedPatterns = [
    /[.!?]\s+[A-Z][^.!?]*\b(he|she) (knew|realized|understood|was aware that|understood that|became aware|sensed)\b/gi,
    /[.!?]\s+[A-Z][^.!?]*\b(it was|this was|that was)\s+(a (moment|turning point|choice|decision|realization|confession)|deciding|choosing)/gi,
    /[.!?]\s+[A-Z][^.!?]*(and\s+)?(he|she)\s+(had made|had chosen|knew|understood|saw)\s+[a-z]+ (choice|decision|truth|realization)/gi,
  ];
  for (const pattern of overNarratedPatterns) {
    if (pattern.test(text)) {
      violations.push(`OVER-NARRATED INTERIORITY: Detected explanation of emotion after dramatized scene`);
      break;
    }
  }

  // RULE 4: On-the-nose final images — check last paragraph for obvious metaphors
  const lastParagraphs = text.trim().split(/\n\n+/).slice(-2).join('\n\n').toLowerCase();
  const onTheNosePatterns = [
    /\b(striking|struck|strike|light\w*)\s+(a\s+)?match\b/i, // match = danger
    /\b(door|window|gate)\s+(clos\w+|slammed?|shut)\b/i, // closing = finality
    /\brain\b.*\b(fell|dropped|descended|wept|cried|tears)\b/i, // rain = sadness
    /\b(light|sun|moon|star)\s+(fad\w+|dimm\w+|disappear\w+|set)\b/i, // fading light = ending
    /\b(empty|vacant|hollow|blank)\s+(look|gaze|stare|face|heart|chest)\b/i, // emptiness = loss
    /\b(rose|ascend\w+|lift\w+)\s+.*\b(hope|spirit|determination)\b/i, // rising = hope
  ];
  for (const pattern of onTheNosePatterns) {
    if (pattern.test(lastParagraphs)) {
      violations.push(`ON-THE-NOSE FINAL IMAGE: Last paragraph contains obvious metaphor — needs to be more concrete and ordinary`);
      break;
    }
  }

  // RULE 5: Vocabulary repetition — count distinctive adjectives/adverbs
  const words = text.match(/\b[a-z]{4,}\b/gi) || [];
  const adjAdverbCandidates = ['specific', 'particular', 'precise', 'deliberate', 'careful', 'quiet', 'soft', 'harsh', 'bright', 'dark', 'cold', 'warm', 'electric', 'fierce', 'gentle', 'sharp', 'blunt', 'subtle', 'obvious', 'clear', 'vague', 'intense', 'fragile', 'strong', 'weak', 'heavy', 'light'];
  const wordCounts = {};
  for (const word of words) {
    const lower = word.toLowerCase();
    if (adjAdverbCandidates.includes(lower)) {
      wordCounts[lower] = (wordCounts[lower] || 0) + 1;
    }
  }
  const overused = Object.entries(wordCounts).filter(([, count]) => count > 4);
  if (overused.length > 0) {
    violations.push(`VOCABULARY REPETITION: Overused words (>4 times each): ${overused.map(([w, c]) => `"${w}" (${c}x)`).join(', ')}`);
  }

  return violations;
}

// PART 6 — EXTENDED POST-GENERATION QUALITY SCANNER
function scanChapterQuality(text, chapterNumber, previousChapters = [], storyBible = null, bookType = "fiction", characters = []) {
  const bannedPhrases = {
    physicalReactions: [
      "heart racing", "heart raced", "heart pounding", "heart pounded", "heart hammered", "heart thudded", "heart thundering",
      "pulse quickened", "pulse raced", "pulse thrummed", "breath hitched", "breath caught", "breath quickened", "breathing quickened",
      "swallowed hard", "throat dry", "throat tight", "shiver down his spine", "shiver up his spine", "shiver ran through", "shiver coursed",
      "a thrill coursed through", "a jolt of", "a surge of", "cheeks flushed", "heat rose to his cheeks", "flush crept into",
      "couldn't tear himself away", "couldn't look away", "couldn't help but", "knees weak", "legs trembled",
      "a rush of adrenaline", "a rush of heat", "a rush of desire", "a rush of excitement", "a rush of emotion", "a rush of warmth",
      "a flicker of", "a spark of", "a flash of heat", "a flash of desire", "a flash of anger", "a flash of fear",
      "igniting a fire", "ignited a fire", "igniting a flame", "ignited a flame", "igniting a spark", "ignited a spark", "igniting a hunger", "ignited a hunger",
      "a fire in him", "a fire within him", "a fire inside him", "a fire in her", "a fire within her", "a fire inside her", "a fire in them", "a fire within them", "a fire inside them",
      "heat pooling in", "heat pooled in",
      "waves of sensation", "cascades of heat", "power flowing through", "something building in her core",
      "she felt herself opening to", "transcendence",
      "sent electricity", "sent shockwaves", "sent sparks", "sent ripples", "sent heat", "sent a jolt", "sent a shiver", "sent a wave", "sent a surge", "sent a bolt", "sent a current", "sent a rush",
      "waves of pleasure", "waves of emotion", "waves of sensation", "waves of heat", "waves of relief", "waves of desire", "waves of pain",
      "washed over her", "washed over him", "washed over them", "washed through her", "washed through him", "washed through them",
      "threatened to overwhelm", "threatening to overwhelm", "threatened to drown", "threatening to drown", "threatened to consume", "threatening to consume", "threatened to engulf", "threatening to engulf"
    ],
    atmosphereClichés: [
      "intoxicating", "intoxicated", "electric", "electricity", "electrifying", "palpable", "air thickened", "air crackled", "air grew heavy",
      "air felt charged", "air felt thick", "shadows danced", "shadows shifted", "shadows twisted", "shadows swirled", "shadows crept",
      "darkness enveloped", "darkness pressed", "darkness wrapped", "darkness beckoned", "whispers echoed", "whispers slithered", "whispers wrapped",
      "tendrils of", "the weight of", "siren call", "siren's call", "siren song", "like a moth to a flame",
      "the air between them thick with", "the air around them thick with", "the air thick with", "the air between them heavy with", "the air around them heavy with", "the air heavy with",
      "the air between them charged with", "the air around them charged with", "the air charged with", "a moth drawn to a flame",
      "hung in the air", "lingered in the air", "stretched in the air", "crackled in the air", "laced with", "heavy with implication", "heavy with meaning", "heavy with possibility",
      "heavy with tension", "heavy with promise", "heavy with unspoken", "loaded with implication", "loaded with meaning", "loaded with innuendo",
      "fraught with", "thick with tension", "thick with meaning", "thick with unspoken", "thick with possibility", "thick with implication",
      "charged and electric", "charged with tension", "charged with anticipation", "charged with possibility", "charged with meaning"
    ],
    narrationClichés: [
      "in that moment", "suddenly", "just the beginning", "just begun", "only the beginning", "only just begun", "no turning back", "no going back", "a tapestry of",
      "teetering on the edge", "on the precipice", "on the brink", "standing at the edge", "double-edged sword", "ready to embrace",
      "ready to confront", "ready to face whatever", "a mix of", "a mixture of", "a blend of", "a cocktail of", "he felt alive",
      "she felt alive", "feeling alive", "more than mere", "more than just", "the world around him faded", "the world outside faded",
      "reality faded", "a tapestry of", "a kaleidoscope of", "a whirlwind of", "a maelstrom of",
      "something deeper", "something more", "something explosive", "something unspoken", "something primal", "something raw", "something dark", "something dangerous",
      "unspoken tension", "unspoken promise", "unspoken understanding", "unspoken challenge", "unspoken connection", "unspoken agreement", "unspoken bond", "unspoken truth",
      "an unspoken tension", "an unspoken promise", "a knowing smile", "a knowing smirk", "a knowing grin", "a knowing glint", "a knowing look", "a knowing glance",
      "a playful smile", "a playful smirk", "a playful grin", "a playful glint", "a playful look", "a playful glance",
      "a mischievous smile", "a mischievous smirk", "a mischievous grin", "a mischievous glint", "a mischievous look", "a mischievous glance",
      "a teasing smile", "a teasing smirk", "a teasing grin", "a teasing glint", "a teasing look", "a teasing glance",
      "the thrill of the chase", "thrill of the chase", "a dangerous game", "a dangerous dance", "a dangerous allure",
      "playing with fire", "testing boundaries", "tested boundaries", "testing the boundaries", "testing his boundaries", "testing her boundaries", "testing their boundaries",
      "pushing boundaries", "pushed boundaries", "pushing the boundaries", "pushing his boundaries", "pushing her boundaries", "pushing their boundaries",
      "testing limits", "pushing limits", "the game had just begun", "the game has just begun", "the game had only just begun", "the game had begun", "the game had started",
      "the dance had just begun", "the dance had begun", "couldn't shake the feeling", "couldn't ignore the feeling", "couldn't deny the feeling", "couldn't resist the feeling",
      "couldn't shake the pull", "couldn't ignore the pull", "couldn't resist the pull", "couldn't resist the attraction", "couldn't resist the urge", "couldn't resist the draw",
      "an invisible thread", "an invisible force", "an invisible pull", "an invisible tether", "an invisible string", "an invisible cord",
      "invisible thread", "invisible force", "invisible pull", "cutting through the noise like a knife", "cutting through the chatter like a knife", "cutting through the silence like a knife",
      "cutting through the air like a knife", "cutting through the tension like a knife", "a storm brewing within", "a storm raging within", "a tempest brewing within",
      "a fire burning within", "a war churning within", "a storm brewing inside", "the facade slipping", "the facade cracking", "the facade crumbling",
      "the professional facade slipping", "the professional facade cracking", "eroding like sand", "eroding like stone",
      "settling over him", "settling over her", "settling over them", "settling over the",
      "understanding dawning", "understanding dawned",
      "a mix of fear and", "a mix of awe and", "a mix of grief and", "a mix of hope and", "a mix of excitement and", "a mix of confusion and",
      "deeply profound", "overwhelmingly profound"
    ],
    dialogueClichés: [
      "control is an illusion", "knowledge is power", "embrace it", "embrace your desires", "embrace the darkness", "let go of your fear",
      "surrender to it", "what if i lose myself", "what if i can't handle", "you're not like the others",
      "what do you truly want", "what do you truly desire", "what do you really want", "what do you really desire",
      "how far are you willing to go", "how far you're willing to go", "let's see where this leads", "let's see how far this goes",
      "shall we see where this leads", "are you willing to take that risk", "are you prepared to face the consequences",
      "are you ready to take that risk", "are you ready to accept the consequences", "is this what you truly want"
    ],
    showDontTellPatterns: [
      "he felt", "she felt", "a sense of", "flooded through", "he was filled with", "she was filled with"
    ],
    endingPatterns: [
      "he was ready to", "she was ready to", "he was no longer", "she was no longer", "he was not just", "she was not just",
      "journey was just beginning", "journey had just begun", "whatever lay ahead", "whatever lies ahead", "knew that"
    ],
    openingBleed: [
      "nothing would change", "nothing was going to change", "nothing would ever change",
      "everything was about to change", "everything would change", "everything changed in that moment",
      "this was the moment", "this was the moment that", "this was the moment when",
      "little did she know", "little did he know", "little did they know",
      "what happened next would", "what happened next changed", "what came next would"
    ]
  };

  const lowerText = text.toLowerCase();
  const violations = [];
  let violationCount = 0;

  // Generic phrase checker helper
  function _checkPhrases(phrases, text, label, maxPerPhrase = 2) {
    const found = [];
    for (const phrase of phrases) {
      const rx = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const m = text.match(rx);
      if (m) { found.push(...m.slice(0, maxPerPhrase).map(() => phrase)); violationCount += m.length; }
    }
    if (found.length > 0) violations.push(`${label} (${found.length}): ${found.join(', ')}`);
    return found;
  }
  const physicalMatches = _checkPhrases(bannedPhrases.physicalReactions, lowerText, 'PHYSICAL REACTIONS');
  const atmosphereMatches = _checkPhrases(bannedPhrases.atmosphereClichés, lowerText, 'ATMOSPHERE CLICHÉS');
  const narrationMatches = _checkPhrases(bannedPhrases.narrationClichés, lowerText, 'NARRATION CLICHÉS');
  const dialogueMatches = _checkPhrases(bannedPhrases.dialogueClichés, lowerText, 'DIALOGUE CLICHÉS');
  // Show-don't-tell (slightly different regex)
  const showDontTellMatches = [];
  for (const pattern of bannedPhrases.showDontTellPatterns) { const rx = new RegExp(`${pattern}\\s+\\w+`, 'gi'); const m = lowerText.match(rx); if (m) { showDontTellMatches.push(...m.slice(0, 2)); violationCount += m.length; } }
  if (showDontTellMatches.length > 0) violations.push(`SHOW-DON'T-TELL (${showDontTellMatches.length}): ${showDontTellMatches.slice(0, 2).join(', ')}`);
  // Ending patterns (last 200 chars)
  const endingMatches = _checkPhrases(bannedPhrases.endingPatterns, lowerText.slice(-200), 'ENDING PATTERN', 1);
  // Opening bleed phrases (first 500 chars)
  const openingBleedMatches = _checkPhrases(bannedPhrases.openingBleed, lowerText.slice(0, 500), 'OPENING BLEED', 1);

  const allBannedFound = [...physicalMatches, ...atmosphereMatches, ...narrationMatches, ...dialogueMatches, ...showDontTellMatches, ...endingMatches, ...openingBleedMatches];

  // REPETITION BUDGET CHECK — alien romance + governor frequency caps
  const _repBudget = [["amber eyes",2],["silver blood",2],["predatory",2],["predator",2],["crystalline",1],["harmonics",2],["resonat",2],["alien",3],["scaled",3],["scales",3],["possessive",1],["bond",6],["bonded",6],["nervous system",1]];
  for (const [w, mx] of Object.entries(REPETITION_GOVERNOR_CAPS)) _repBudget.push([w, mx]);
  const _repOver = [];
  for (const [phrase, max] of _repBudget) {
    const rx = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*\\b`, 'gi');
    const m = lowerText.match(rx); const count = m ? m.length : 0;
    if (count > max) { _repOver.push(`"${phrase}" ${count}x (max ${max})`); violationCount += count - max; }
  }
  if (_repOver.length > 0) violations.push(`REPETITION BUDGET EXCEEDED: ${_repOver.join(', ')}`);

  // PART 6 CHECK 1 — Physical tic repetition from previous chapters
  if (previousChapters && previousChapters.length > 0) {
    const prevTicsByChar = {};
    for (const prevCh of previousChapters) {
      const prevTxt = (prevCh.content && !prevCh.content.startsWith('http')) ? prevCh.content : '';
      if (!prevTxt) continue;
      const tics = extractPhysicalTics(prevTxt);
      for (const [char, ticCounts] of Object.entries(tics)) {
        if (!prevTicsByChar[char]) prevTicsByChar[char] = new Set();
        for (const tic of Object.keys(ticCounts)) {
          prevTicsByChar[char].add(tic);
        }
      }
    }
    const newTics = extractPhysicalTics(text);
    const ticRepeats = [];
    for (const [char, ticCounts] of Object.entries(newTics)) {
      if (prevTicsByChar[char]) {
        for (const tic of Object.keys(ticCounts)) {
          if (prevTicsByChar[char].has(tic)) {
            ticRepeats.push(`${char}: "${tic}"`);
          }
        }
      }
    }
    if (ticRepeats.length > 0) {
      violations.push(`PHYSICAL TIC REPETITION (${ticRepeats.length}): ${ticRepeats.slice(0, 3).join(', ')}`);
      violationCount += ticRepeats.length;
    }
  }

  // PART 6 CHECK 2 — Metaphor cluster overuse in new chapter
  if (previousChapters && previousChapters.length > 0) {
    const prevClusterTotals = {};
    for (const prevCh of previousChapters) {
      const prevTxt = (prevCh.content && !prevCh.content.startsWith('http')) ? prevCh.content : '';
      if (!prevTxt) continue;
      const clusters = extractMetaphorClusters(prevTxt);
      for (const [clusterName, { count }] of Object.entries(clusters)) {
        prevClusterTotals[clusterName] = (prevClusterTotals[clusterName] || 0) + count;
      }
    }
    const flaggedForNewChapter = Object.entries(prevClusterTotals).filter(([, c]) => c >= 5).map(([name]) => name);
    if (flaggedForNewChapter.length > 0) {
      const newClusters = extractMetaphorClusters(text);
      const clusterViolations = [];
      for (const cluster of flaggedForNewChapter) {
        if ((newClusters[cluster]?.count || 0) > 1) {
          clusterViolations.push(`${cluster} (${newClusters[cluster].count} uses)`);
        }
      }
      if (clusterViolations.length > 0) {
        violations.push(`METAPHOR CLUSTER OVERUSE (${clusterViolations.length}): ${clusterViolations.join(', ')}`);
        violationCount += clusterViolations.length;
      }
    }
  }

  // CHECK 3 — Banned dialogue patterns
  const dialoguePatterns = scanDialoguePatterns(text);
  if (dialoguePatterns.length > 1) { violations.push(`BANNED DIALOGUE (${dialoguePatterns.length}): ${dialoguePatterns.map(p => p.pattern).join(', ')}`); violationCount += dialoguePatterns.length; }
  // Nonfiction checks
  if (bookType === "nonfiction") { const nw = scanNonfictionQuality(text); violations.push(...nw); violationCount += nw.length; }
  // Permanent rules
  const prv = validatePermanentRules(text, characters); violations.push(...prv); violationCount += prv.length;
  // PART C — Shape repetition
  const tw = text.split(/\s+/).length;
  const dChunks = text.match(/[""\u201C][^""\u201D]{3,}[""\u201D]/g) || [];
  const dw = dChunks.reduce((s, c) => s + c.split(/\s+/).length, 0);
  if (tw > 0 && dw / tw > 0.65) { violations.push(`SHAPE: ${((dw/tw)*100).toFixed(0)}% dialogue — add action/description.`); violationCount++; }
  const qd = text.match(/[""\u201C][^""\u201D]*\?[^""\u201D]*[""\u201D]/g) || [];
  let tc = 0; for (let i = 1; i < qd.length; i++) { const d = text.indexOf(qd[i], text.indexOf(qd[i-1])) - text.indexOf(qd[i-1]); if (d > 0 && d < 500) tc++; }
  if (tc > 5) { violations.push(`SHAPE: Dialogue tennis (${tc} consecutive Q exchanges).`); violationCount++; }
  const f5 = text.slice(0, 500).toLowerCase(), l5 = text.slice(-500).toLowerCase();
  if (["stepped into","entered the","walked into","arrived at","made his way","made her way"].some(w => f5.includes(w)) && ["ready for","whatever came next","only the beginning","just begun","would never be the same","no turning back"].some(w => l5.includes(w))) { violations.push(`SHAPE: Arrival→departure cliché.`); violationCount++; }
  // PART E — Ending reflection check
  const lp = text.slice(-1000).split(/\n\n+/).slice(-3).join(' ').toLowerCase();
  if (/\b(realized|understood|knew now|felt (ready|prepared|different|changed)|steeled|braced for|whatever (lay|came))\b/.test(lp) && !/(slammed|grabbed|ran|pulled|threw|kicked|screamed|fired|crashed|broke|stabbed|shot)\b/.test(lp)) { violations.push(`PLOT GATE: Ends with reflection, not irreversible event.`); violationCount++; }
  return { chapter_number: chapterNumber, violation_count: violationCount, banned_phrase_total: allBannedFound.length, warnings: violations, passed: violations.length === 0 };
}

// NONFICTION QUALITY SCANNER — detects fiction-trap patterns
function scanNonfictionQuality(text) {
  const warnings = [];

  // Check for excessive dialogue (fiction trap)
  const dialogueChunks = text.match(/[""]([^""]{5,})[""]|'([^']{5,})'/g) || [];
  const totalDialogueWords = dialogueChunks.reduce((sum, chunk) => sum + chunk.split(/\s+/).length, 0);
  const totalWords = text.split(/\s+/).length;
  if (totalWords > 0) {
    const dialogueRatio = totalDialogueWords / totalWords;
    if (dialogueRatio > 0.20) {
      warnings.push(
        `FICTION TRAP: ${(dialogueRatio * 100).toFixed(0)}% of chapter is dialogue ` +
        `(${totalDialogueWords} words). Nonfiction should be max 20% dialogue. ` +
        `Replace extended dialogue scenes with authorial voice and analysis.`
      );
    }
  }

  // Check for long dialogue runs (5+ consecutive dialogue lines)
  const lines = text.split('\n');
  let dialogueRun = 0;
  let maxRun = 0;
  for (const line of lines) {
    const stripped = line.trim();
    if (stripped && (stripped.startsWith('"') || stripped.startsWith('"') || stripped.startsWith("'"))) {
      dialogueRun++;
      maxRun = Math.max(maxRun, dialogueRun);
    } else if (stripped) {
      dialogueRun = 0;
    }
  }
  if (maxRun >= 5) {
    warnings.push(
      `FICTION TRAP: Found ${maxRun} consecutive dialogue lines. ` +
      `Nonfiction should not have extended fictional dialogue exchanges.`
    );
  }

  // Fiction-trap: invented character + past-tense action (e.g. "Laura sat at her kitchen table")
  const fictCharMatches = (text.match(/\b[A-Z][a-z]{2,}\s+(?:sat|stood|walked|felt|thought|smiled|sighed|cried|realized|wondered|looked|opened|entered|left|turned|knew|decided|held|reached)\b/g) || [])
    .filter(m => !['January','February','March','April','May','June','July','August','September','October','November','December','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','America','Europe','Asia','Congress','Harvard','Stanford','Oxford','Google','Apple','Amazon'].some(w => m.startsWith(w)));
  if (fictCharMatches.length >= 3) {
    warnings.push(`FICTIONAL NARRATIVE: Invented character+action pattern (${fictCharMatches.length}x, e.g. "${fictCharMatches[0]}") — remove fictional characters, replace with research and analysis`);
  }
  // Fiction-trap: internal monologue / fictional third-person narration
  const imCount = (text.match(/\b(?:she felt|he felt|they felt|she wondered|he wondered|she realized|he realized|her heart|his heart|she thought|he thought)\b/gi) || []).length;
  if (imCount >= 2) { warnings.push(`FICTIONAL NARRATIVE: Fictional internal monologue detected (${imCount} instances) — replace with authorial voice`); }
  // Fiction-trap: excessive dialogue lines (>5 in nonfiction)
  const nfDialogueCount = (text.match(/[""][^""]{5,}[""]/g) || []).length;
  if (nfDialogueCount > 5) { warnings.push(`FICTIONAL NARRATIVE: ${nfDialogueCount} dialogue lines in nonfiction (max 5) — replace with research citations`); }
  // [VERIFY] tags from web search research integration
  const verifyTags = (text.match(/\[VERIFY\]/g) || []).length;
  if (verifyTags > 0) { warnings.push(`UNVERIFIED CLAIMS (${verifyTags}): flagged [VERIFY] for author verification`); }

  // Check for nonfiction-specific banned phrases
  const nfBanned = [{ rx: /(?:heart|eyes)\s+(?:swelling|brimming|glistening)\s+with\s+(?:pride|tears|joy|emotion)/gi, label: "emotional melodrama" },
    { rx: /(?:warmth|sense of peace|wave of calm)\s+(?:spread|washed|flooded)\s+(?:through|over)/gi, label: "inspirational fiction" }, { rx: /felt a renewed sense of/gi, label: "inspirational cliche" },
    { rx: /it was (?:a )?(?:powerful |beautiful |profound )?(?:reminder|testament)/gi, label: "declaration" }, { rx: /(?:infectious|contagious)\s+(?:laughter|enthusiasm|energy|smile|joy)/gi, label: "cliche 'infectious'" },
    { rx: /(?:monumental|transformative|life-changing|game-changer|game.changing)/gi, label: "hyperbolic adjective" }, { rx: /(?:beacon of hope|ray of light|silver lining)/gi, label: "inspirational cliche" },
    { rx: /(?:on a journey|navigate this journey|the road ahead|armed with knowledge)/gi, label: "journey metaphor" }, { rx: /together,?\s+they\s+(?:would|could|will)\s+(?:build|create|forge)/gi, label: "inspirational fiction" },
    { rx: /(?:clapped|cheered|hugged)\s+.{0,30}(?:proud|proud of|so proud)/gi, label: "fictional celebration" },
    { rx: /it is important to note that/gi, label: "importance announcement" }, { rx: /this would prove to be/gi, label: "hindsight framing" },
    { rx: /(?:mistakes were made|it was decided|they were seen as)/gi, label: "passive historical voice" }, { rx: /^(?:throughout history|since the dawn of)/gmi, label: "panoramic opening" },
    { rx: /it could be argued that|one might suggest that|it is possible that/gi, label: "over-hedged analysis" },
    { rx: /it is worth noting that|it should be mentioned that|one cannot overstate/gi, label: "Gemini hedging filler" },
    { rx: /a tapestry of/gi, label: "Gemini purple prose" }];
  for (const { rx, label } of nfBanned) { const matches = text.match(rx); if (matches) { warnings.push(`NONFICTION BAN (${label}): "${matches[0]}"`); } }
  // DeepSeek-style: consecutive analytical paragraphs (>2 in a row without scene/person)
  const paras = text.split(/\n\n+/);
  let _anRun = 0, _maxAnRun = 0;
  for (const p of paras) { const isAn = /\b(therefore|thus|consequently|this (?:shows|demonstrates|meant|suggests)|as a result|it is (?:clear|evident)|one (?:could|might) argue)\b/i.test(p) && !/\b[A-Z][a-z]{2,}\s+(?:sat|stood|walked|said|turned|looked|arrived)\b/.test(p); if (isAn) { _anRun++; _maxAnRun = Math.max(_maxAnRun, _anRun); } else _anRun = 0; }
  if (_maxAnRun > 3) { warnings.push(`CONSECUTIVE ANALYSIS: ${_maxAnRun} analytical paragraphs in a row without returning to scene/character — max 2 before grounding in person-in-moment`); }
  // Triple restatement detection (same concept stated 3+ ways in close proximity)
  const sents = text.split(/[.!?]+/).filter(s => s.trim().length > 30);
  for (let i = 0; i < sents.length - 2; i++) { const a = sents[i].trim().toLowerCase().split(/\s+/).slice(0,6).join(' '), b = sents[i+1].trim().toLowerCase().split(/\s+/).slice(0,6).join(' '), c = sents[i+2].trim().toLowerCase().split(/\s+/).slice(0,6).join(' '); const ab = a.split(' ').filter(w => b.includes(w) && w.length > 4).length, ac = a.split(' ').filter(w => c.includes(w) && w.length > 4).length; if (ab >= 2 && ac >= 2) { warnings.push(`TRIPLE RESTATEMENT near: "${sents[i].trim().slice(0,60)}..." — state once, move forward`); break; } }
  return warnings;
}

// ── NONFICTION SYSTEM PROMPT BUILDER ──────────────────────────────────────────
function _buildNonfictionSystemPrompt(spec, chapter_info, total_chapters, target_words,
                                       story_bible, outline_data, transition_instructions, modelKey = 'claude-sonnet') {
  const ch_num = chapter_info.chapter_number; const _isDS = isDeepseekModel(modelKey);
  const _dsBlock = _isDS ? `=== ABSOLUTE NONFICTION CONSTRAINT — READ THIS FIRST ===\nYou are writing NONFICTION. RULES:\n1. DO NOT invent fictional characters. No "Laura," "James," or any made-up person. Every person = real+verifiable OR labeled composite ("One caregiver I spoke with...").\n2. DO NOT write a novel. No scenes with invented dialogue, internal monologue, or dramatic arcs. No "Laura sat at her kitchen table..."\n3. DO write like Gladwell/Brown/Clear: thesis + evidence (real studies, named researchers, stats) + analysis + reader application.\n4. Anecdotes: max 1-4 paragraphs, no invented names, immediately followed by 3-5x more analysis.\n5. EVERY chapter: ≥2 real research references, ≥1 statistic, direct "you" reader address, clear advancing argument.\n6. BANNED: extended fictional scenes, invented dialogue (quotes = real people/studies only), "She felt/He realized..." about invented people.\nIF WRITING A FICTIONAL SCENE — STOP. Delete it. Replace with research, analysis, or direct reader address.\n=== END NONFICTION CONSTRAINT ===\n\n` : '';
  const _nfLen = isNfLengthModel(modelKey) ? NF_LENGTH_ENFORCEMENT + '\n\n' : ''; const _isGem = isGeminiModel(modelKey); const _nfBans = isGptModel(modelKey) ? GPT_NF_BANS + '\n\n' : (_isDS ? DS_NF_BANS + '\n\n' : (_isGem ? GEMINI_NF_ENFORCEMENT + '\n\n' : ''));
  return `${_nfLen}${_dsBlock}${_nfBans}AUTHOR MODE — NONFICTION PROSE GENERATION
You are a professional nonfiction ghostwriter fulfilling a paid writing commission. You are NOT an assistant having a conversation. You are generating polished prose for a published nonfiction book.

You are writing Chapter ${ch_num} of ${total_chapters}: "${chapter_info.title}".

BOOK SPECIFICATIONS:
- Type: nonfiction
- Genre: ${spec.genre || 'General'}${spec.subgenre ? `\n- Subgenre: ${spec.subgenre}` : ''}
- Beat Style: ${getBeatStyleInstructions(spec.tone_style || spec.beat_style)}
- Target Audience: ${spec.target_audience || 'General readers'}
- Detail Level: ${spec.detail_level || 'moderate'}

=== CRITICAL: NONFICTION VOICE AND STRUCTURE ===

This is NONFICTION. You are NOT writing novel scenes with invented dialogue between fictional characters. You are writing in the author's voice — direct, reflective, instructional, grounded in observation and analysis.

THE NONFICTION VOICE:
1. DIRECT ADDRESS — Speak to the reader as "you" when appropriate. You are a guide, teacher, or witness.
2. GROUNDED VIGNETTES — Open sections with brief, concrete observational moments (the author describing a real or representative scene), NOT fictional dialogue scenes between invented characters.
3. PHILOSOPHICAL REFLECTION — After grounding the reader, step back and reflect. Explain what the moment means. Connect it to larger principles.
4. INSTRUCTIONAL CLARITY — Where appropriate, offer frameworks, principles, or direct guidance. Name concepts clearly.
5. EMOTIONAL HONESTY — Use real emotional weight through specificity, restraint, and earned insight — not through fictional scenes.

STRUCTURE:
- Vignettes should be 1-4 paragraphs of observational prose, then 3-5 paragraphs of authorial analysis/reflection
- Use parallel structure, direct naming of concepts, short sentences for impact
- Replace abstract language with specific sensory details
- Section breaks separate thematic shifts

BANNED NONFICTION PATTERNS:
- Extended fictional dialogue scenes (more than 3 exchanges)
- Invented characters with full names carrying multi-page arcs
- "Story-time" structure with fictional families navigating challenges
- Summarizing lessons at the end in lists
- Ending with "The journey continues..."
- Exclamation marks in narration (one per chapter maximum)
- Inspirational clichés: "strength in unity", "the power of community", "making a difference"

BOOK PREMISE (anchor for every section):
${spec.topic || 'Not specified'}

STORY BIBLE:
${JSON.stringify(story_bible, null, 2)}

COMPLETE OUTLINE:
${JSON.stringify(outline_data.chapters || [], null, 2)}

NARRATIVE ARC: ${outline_data.narrative_arc || 'N/A'}
THEMES: ${JSON.stringify(outline_data.themes || [])}

${transition_instructions}

REMINDER — THIS IS NONFICTION: Write in the author's voice. Use brief vignettes to illustrate, then ANALYZE. The author's interpretive voice is the backbone. Do NOT create fictional characters with dialogue exchanges.
${spec.subgenre ? `\nThis is a ${spec.genre || 'nonfiction'} book with subgenre focus: ${spec.subgenre}. All content must remain within this subject area.\n` : ''}
OUTPUT FORMAT RULES:
- Return ONLY the prose of the chapter. No preamble. No commentary.
- Do not start with "Here is..." or any assistant-style opening.
- Do not end with "Let me know if..." or any assistant-style closing.

Write approximately ${target_words} words. Begin immediately with the opening.`;
}

function _buildNonfictionUserMessage(ch_num, chapter_info, total_chapters, target_words) {
  const nf_opening_types = {
    1: "A grounding observational vignette — describe a concrete moment in close third-person. Brief, vivid, specific. Then pivot to the author's reflective voice.",
    2: "A bold thesis statement or provocative question — open with the chapter's central argument stated directly.",
    3: "A historical or real-world example — open with a specific fact, statistic, case study, or historical moment.",
    4: "Second-person immersion — 'Imagine waking up and...' or 'You arrive at...' — put the reader directly into the experience.",
    5: "A counterintuitive claim — open with something that challenges the reader's assumptions.",
  };
  const opening_idx = ((ch_num - 1) % 5) + 1;
  const ending_idx = ((ch_num + 1) % 5) + 1;
  const required_opening = nf_opening_types[opening_idx];
  const required_ending = NONFICTION_ENDING_TYPES[ending_idx];

  return `Write Chapter ${ch_num}: "${chapter_info.title}"

CHAPTER PROMPT:
${chapter_info.prompt || chapter_info.summary || 'Write this chapter.'}

CHAPTER SUMMARY:
${chapter_info.summary || 'No summary provided.'}

${ch_num === total_chapters ? "FINAL CHAPTER: Bring all thematic threads to a satisfying resolution. Synthesize the book's core argument. Give the reader a sense of completion and earned wisdom." : ""}

=== MANDATORY REQUIREMENTS ===

OPENING: Use this type: ${required_opening}

ENDING: Use this type: ${required_ending}
BANNED endings: summarizing content, previewing next chapter, "and so the journey continues", "armed with knowledge", "ready to face whatever."

VOICE: Write in the AUTHOR'S VOICE — direct, reflective, instructional. Brief vignettes (1-4 paragraphs) then authorial analysis (3-5 paragraphs). Do NOT write extended fictional dialogue scenes between characters. NAME concepts clearly. Use parallel structure and short sentences for impact. Earn emotion through specificity, not declaration.

BANNED PHRASES — auto-rejected if used:
"a tapestry of", "a kaleidoscope of", "a whirlwind of", "beacon of hope", "ray of light",
"heart swelling with pride", "warmth spread through", "sense of peace washed over",
"felt a renewed sense of", "it was a reminder", "it was a testament", "infectious",
"monumental", "transformative", "life-changing", "on a journey", "navigate this journey",
"the road ahead", "armed with knowledge", "little did they know", "in that moment",
"just the beginning", "no turning back", "ready to embrace/face"

Write ~${target_words} words. Begin immediately with prose — no preamble.`;
}

// PART B — AUTO-REWRITE FUNCTION
async function rewriteWithCorrections(chapterText, violations, chapterNumber, openaiKey, modelKey = 'claude-sonnet') { modelKey = resolveModel('post_gen_rewrite');
  const hasNfViolation = violations.some(v => v.startsWith('FICTIONAL NARRATIVE'));
  if (hasNfViolation) {
    const nfSystemPrompt = `You are a nonfiction editor. This chapter contains fictional narrative elements that must be removed and replaced with proper nonfiction content.\n\nRULES:\n1. Remove all invented fictional characters (anyone with a name who is not a real public figure).\n2. Replace fictional scenes and "She felt/He realized..." narration with: research citations, real expert quotes, authorial analysis, or "Consider the person who..." constructions.\n3. Replace invented dialogue with quoted real research, expert statements, or authorial voice.\n4. Preserve any factual content, real names, statistics, or research references.\n5. The rewritten chapter must sound like Gladwell/Brown/Clear — not a novel.\n6. Return ONLY the corrected chapter prose. No commentary.`;
    try {
      const corrected = await callAI(modelKey, nfSystemPrompt, `Rewrite this nonfiction chapter, removing all fictional narrative elements:\n\n---\n${chapterText}\n---\n\nReturn only the corrected prose.`, { maxTokens: 3000, temperature: 0.4 });
      return corrected.includes('```') ? corrected.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '') : corrected;
    } catch (err) {
      console.error('Nonfiction rewrite error:', err.message);
      throw err;
    }
  }

  const systemPrompt = `You are a prose editor. Your ONLY job is to fix specific banned phrases and clichés in the text below.\n\nRULES:\n1. Replace ONLY the sentences or clauses that contain the flagged violations.\n2. Do NOT rewrite, restructure, or 'improve' any other part of the text.\n3. Do NOT add new scenes, dialogue, or plot. Do NOT remove scenes or dialogue.\n4. Do NOT change character names, settings, or plot events.\n5. Do NOT add meta-commentary, notes, or explanations.\n6. Each replacement must be ORIGINAL — do not swap one cliché for another.\n7. Replacements must be SPECIFIC to the scene — a character in a library reacts differently than one in a rainstorm.\n8. For 'show don't tell' violations: replace the named emotion with a concrete physical action, sensory detail, or dialogue that IMPLIES the emotion.\n9. Return ONLY the complete corrected chapter text. Nothing else.`;

  const violationList = violations.map(v => `- ${v}`).join('\n');
  const hasShape = violations.some(v => v.startsWith('SHAPE:'));
  const shapeFix = hasShape ? `\nSTRUCTURAL FIXES: If dialogue too high, convert 3+ exchanges to narrated action. If dialogue tennis, replace Q-A pairs with physical action or topic shift. If arrival-departure, start mid-scene and cut ending mid-action.\n` : '';
  const hasPlotGate = violations.some(v => v.startsWith('PLOT GATE:'));
  const plotFix = hasPlotGate ? `\nPLOT FIX: Rewrite ending to include an irreversible event — a reveal, a broken promise, a physical consequence.\n` : '';
  const userMessage = `Fix the following violations in this Chapter ${chapterNumber} text.${shapeFix}${plotFix}

VIOLATIONS FOUND:
${violationList}

IMPORTANT: Replace each violation with prose that is:
- Specific to THIS scene (not generic)
- Original (not another cliché)
- Concrete and sensory (not abstract)

Here is the full chapter text to fix:

---
${chapterText}
---

Return the corrected chapter text with violations fixed. Output ONLY the chapter prose, nothing else.`;

  try {
    let correctedText = await callAI(modelKey, systemPrompt, userMessage, { maxTokens: 3000, temperature: 0.4 });
    if (correctedText.includes('```')) {
      correctedText = correctedText.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
    }
    return correctedText;
  } catch (err) {
    console.error('Rewrite error:', err.message);
    throw err;
  }
}

async function generateChapterAsync(base44, projectId, chapterId, projectSpec, outline, sourceFiles, appSettings, modelKey = 'claude-sonnet') {
  try {
    // Load all chapters sorted by number so we can build conversation context
    const allChapters = await base44.entities.Chapter.filter({ project_id: projectId }, "chapter_number");
    const chapter = allChapters.find(c => c.id === chapterId);
    if (!chapter) throw new Error('Chapter not found');

    const chapterIndex = allChapters.findIndex(c => c.id === chapterId);
    const totalChapters = allChapters.length;
    const isLastChapter = chapterIndex === totalChapters - 1;
    const prevChapter = chapterIndex > 0 ? allChapters[chapterIndex - 1] : null;
    const nextChapter = chapterIndex < totalChapters - 1 ? allChapters[chapterIndex + 1] : null;

    // ISSUE 1 FIX: Parse outline data with both inline and URL support
    const outlineData = await parseOutlineField(outline?.outline_data, outline?.outline_url);
    const storyBible = await parseOutlineField(outline?.story_bible, outline?.story_bible_url);

    // Find this chapter's outline entry for transition fields + structural contract
    const outlineChapters = outlineData?.chapters || [];
    const outlineEntry = outlineChapters.find(c => (c.chapter_number || c.number) === chapter.chapter_number) || {};
    const prevOutlineEntry = prevChapter ? (outlineChapters.find(c => (c.chapter_number || c.number) === prevChapter.chapter_number) || {}) : null;
    const scopeLock = outlineData?.scope_lock || null;

    // ── EXPLICIT TAG VERIFICATION (erotica projects) ──
    if (isEroticaGenre(projectSpec) && outlineData?.chapters) {
      const olStr = JSON.stringify(outlineData.chapters);
      if (!/\[EXPLICIT\]/i.test(olStr)) { console.warn(`EXPLICIT TAG WARNING: Erotica project "${projectId}" has no [EXPLICIT] tags in beat sheet. Content model routing may not activate for explicit scenes.`); }
      else { const tc = (olStr.match(/\[EXPLICIT\]/gi) || []).length; if (tc < 2) console.warn(`EXPLICIT TAG WARNING: Only ${tc} [EXPLICIT] tag(s) across ${outlineData.chapters.length} chapters — consider adding more.`); }
    }

    const _isNF = (projectSpec?.book_type || 'fiction') === 'nonfiction';
    const TARGET_WORDS = (isGptModel(modelKey) || (isDeepseekModel(modelKey) && _isNF) || (isGeminiModel(modelKey) && _isNF)) ? 2500 : 1600;

    // callAI wrapper using conversation messages array
    async function callAIConversation(messages, maxTokens = 8192) {
      const systemMsg = messages.find(m => m.role === 'system')?.content || '';
      const nonSystem = messages.filter(m => m.role !== 'system');
      const userMsg = nonSystem.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n');
      return callAI(modelKey, systemMsg, userMsg, { maxTokens });
    }

    let nameRegistry = {};
    // ── Load persistent protagonist interiority from Project entity ──
    let projectInteriority = null;
    try {
      const prjs = await base44.entities.Project.filter({ id: projectId });
      if (prjs[0]?.protagonist_interiority) projectInteriority = prjs[0].protagonist_interiority;
    } catch (e) { console.warn('Interiority load:', e.message); }

    // ── Build system prompt ────────────────────────────────────────────────────
    const bookType = projectSpec?.book_type || 'fiction';
    const isNonfiction = bookType === 'nonfiction';

    // Parse scenes if present (fiction only) — determines whether to use scene-based path
    let parsedScenes = null;
    try {
      if (chapter.scenes && typeof chapter.scenes === 'string' && chapter.scenes.length > 2) {
        const trimmed = chapter.scenes.trim();
        if (trimmed !== 'null' && trimmed !== '[]') {
          parsedScenes = JSON.parse(chapter.scenes);
        }
      }
    } catch (e) {
      console.warn('Scene parse failed, falling back to legacy path:', e.message);
    }
    const useScenePath = !isNonfiction && Array.isArray(parsedScenes) && parsedScenes.length > 0;

    // ── Beat Sheet: look up this chapter's beat from outline data (fiction AND nonfiction) ──
    let chapterBeat = null;
    {
      const olChs = outlineData?.chapters || [];
      const olE = olChs.find(c => (c.number || c.chapter_number) === chapter.chapter_number);
      if (olE?.beat_function) chapterBeat = { beat_name: olE.beat_name||'', beat_function: olE.beat_function||'', beat_scene_type: olE.beat_scene_type||(isNonfiction?'exposition':'scene'), beat_tempo: olE.beat_tempo||'medium' };
    }

    // Nonfiction mode descriptions for system prompt injection
    const NF_MODE_RULES = {
      'exposition': 'AUTHOR EXPLAINS. Your analytical voice carries this chapter. Present context, define terms, build the argument.',
      'case_study': 'ONE DEEP EXAMPLE. Pick one story, study, or person and go DEEP. Specific names, dates, places, outcomes.',
      'analysis': 'ARGUE. Weigh evidence. Compare viewpoints. Draw conclusions. Acknowledge uncertainty, address objections, then make your case.',
      'how_to': 'MAKE IT ACTIONABLE. Step 1, Step 2, Step 3. Specific enough that the reader can start TODAY.',
      'synthesis': 'CONNECT. Link ideas from earlier chapters. Show patterns. Zoom out from details to big picture.',
      'scene_recreation': 'RECONSTRUCT a real event with cinematic detail. Use primary sources. Never invent dialogue. Present tense for immediacy.',
      'profile': 'INTRODUCE real people as three-dimensional humans. Use their own words. Show contradictions.',
      'investigative': 'FOLLOW THE TRAIL. Present evidence in discovery order. Let the reader process clues alongside you.',
      'teaching': 'INSTRUCT. Concept → Example → Counter-example → Practice. One concept per section.',
    };

    function _beatSysBlock(cb) {
      if (!cb) return '';
      if (isNonfiction) {
        const modeRule = NF_MODE_RULES[cb.beat_scene_type] || '';
        return `\n\n=== THIS CHAPTER'S STRUCTURAL ROLE ===\nBeat: "${cb.beat_name}" | Function: ${cb.beat_function} | Mode: ${cb.beat_scene_type} | Tempo: ${cb.beat_tempo}\n\nNONFICTION STRUCTURAL RULES:\n- Mode "${cb.beat_scene_type}": ${modeRule}\n- fast=short paragraphs, punchy facts | medium=balanced evidence+analysis | slow=long reflective passages\n\nCRITICAL: This is NONFICTION. No fictional scenes, no invented dialogue, no imagined characters.\nUse ARGUMENT structure (claim, evidence, analysis, synthesis). Author's analytical voice is the backbone.\nDo NOT end with fiction-style cliffhangers.\n=== END STRUCTURAL ROLE ===`;
      }
      const r = { SETUP:'Establish, don\'t resolve.', DISRUPTION:'Concrete external EVENT.', PROMISE_OF_PREMISE:'Deliver genre promise NOW.', REVERSAL:'Something believed proven WRONG.', CRISIS:'Irreversible devastation.', REFLECTION:'NO new plot/characters. Process loss.', REACTION:'Character PROCESSES.', CLIMAX:'Maximum intensity. All threads converge.', RESOLUTION:'Mirror opening. Show transformation.', COMMITMENT:'Deliberate CHOICE.', RECOMMITMENT:'Understand theme, new path.', ESCALATION:'Stakes rise.', SUBPLOT:'B-story focus.', CONNECTIVE_TISSUE:'Bridge. One irreversible event.' };
      return `\n\n=== STRUCTURAL ROLE ===\nBeat: "${cb.beat_name}" | ${cb.beat_function} | ${cb.beat_scene_type} | ${cb.beat_tempo}\nscene=ACTION(max 20% reflection) | sequel=REACTION(min 40% thought) | fast=short paragraphs | slow=long flowing paragraphs\nFUNCTION: ${r[cb.beat_function]||''}\n=== END ===`;
    }
    function _beatUsrBlock(cb) {
      if (!cb) return '';
      if (isNonfiction) {
        return `STRUCTURAL ROLE: ${cb.beat_function} (beat: "${cb.beat_name}"). Mode: ${cb.beat_scene_type}. Tempo: ${cb.beat_tempo}.\n- This is NONFICTION. No fictional scenes, no invented dialogue, no imagined characters.\n- If mode is case_study: Go DEEP on ONE example. Names, dates, places, outcomes.\n- If mode is how_to: Specific actionable steps. Not "think about your goals" but "Do X, then Y, then Z."\n- If mode is analysis: ARGUE with evidence. Acknowledge the counterargument, then make your case.\n- If mode is exposition: Your analytical voice carries this chapter. Build the argument.\n- Chapter must advance the book's THESIS, not just present information.`;
      }
      return `STRUCTURAL ROLE: ${cb.beat_function} (beat: "${cb.beat_name}"). Mode: ${cb.beat_scene_type}. Tempo: ${cb.beat_tempo}. Must contain ≥1 IRREVERSIBLE EVENT.`;
    }

    let systemPrompt;
    if (useScenePath) {
      // ── SCENE-BASED SYSTEM PROMPT (shorter — scenes carry the structure) ──
      const beatKey = projectSpec?.beat_style || projectSpec?.tone_style;
      const beatInstructions = beatKey ? getBeatStyleInstructions(beatKey) : 'Not specified';
      const characters = storyBible?.characters || [];
      const world = storyBible?.world || storyBible?.settings;
      const rules = storyBible?.rules;

      const authorBlock = getAuthorStyleBlock(projectSpec);

      systemPrompt = `You are a novelist writing Chapter ${chapter.chapter_number} of a ${projectSpec?.genre || 'fiction'} novel.

STYLE: ${beatInstructions}

${authorBlock}

${projectSpec?.topic ? `BOOK PREMISE:\n${projectSpec.topic}` : ''}

CHARACTERS:
${characters.length > 0 ? characters.map(c => `- ${c.name} (${c.role || 'character'}): ${c.description || ''}${c.relationships ? ' | ' + c.relationships : ''}`).join('\n') : 'See story bible'}

${buildCharacterConsistencyBlock(storyBible)}

${buildCanonicalBackstoryBlock(storyBible)}

${buildFiredBeatsBlock(allChapters, chapterIndex)}

${buildCapabilitiesBlock(storyBible)}

${buildAllegianceShiftBlock(storyBible, outlineData, chapter.chapter_number)}

${buildCharacterRegistryBlock(storyBible, nameRegistry)}

WORLDBUILDING:
${world ? (typeof world === 'object' ? JSON.stringify(world, null, 2) : world) : 'Not specified'}

RULES:
${rules ? (typeof rules === 'string' ? rules : JSON.stringify(rules)) : 'None'}

${getSpiceLevelInstructions(projectSpec?.spice_level ?? 0)}

${getLanguageIntensityInstructions(projectSpec?.language_intensity ?? 0)}

${CONTENT_GUARDRAILS}

CRITICAL OUTPUT RULES:
- Do NOT include scene numbers, scene titles, or any scene metadata in your output
- Do NOT write headers like "## SCENE 1" or "SCENE 1: Title" or anything similar
- The ONLY structural marker allowed between scenes is a single line containing just: * * *
- Do NOT include a chapter title header or chapter number — start writing prose immediately
- Your output must read like a published novel chapter — no outline artifacts, no structural labels, no metadata of any kind
- Return ONLY the prose. No preamble, no commentary.
- You are generating PROSE ONLY. Never output meta-commentary, self-assessment, checklists, or instructions.
- Never say "I appreciate", "I've completed", "I need to clarify", "Here is", "As requested", or any self-referential language.
- Never output bullet points, checkmarks (✓ ✗ ☐ ☑), or status indicators. These are NOT prose.
- If you feel tempted to explain what you wrote or confirm completion — DON'T. Just write the chapter.

${PLOT_SUBTEXT_RULES}

${DIALOGUE_SUBTEXT_RULES_CONCISE}

${QUALITY_UPGRADES}

${BANNED_CONSTRUCTIONS_ALL_GENRES}

${buildRepetitionGovernorBlock(allChapters.slice(0, chapterIndex).filter(c => c.content && c.status === 'generated'))}

=== CLIFFHANGER RESOLUTION (MANDATORY) ===
Check the previous chapter's final scene. If it ended on an unresolved physical action — a strike, a fall, a confrontation, a moment of impact — this chapter must open by showing the outcome of that action directly. Do not skip to aftermath. Do not open with the character already safe, already victorious, or already in recovery without showing how they got there. The reader watched the moment of danger. They are owed the resolution.
If the protagonist is a non-combatant facing a trained fighter, they must win or survive through their established skills — intelligence, technical knowledge, exploiting the environment, or surprising their opponent with something unexpected. They must not win through sudden combat ability they have never demonstrated. Show the method. Do not summarize it.
=== END CLIFFHANGER RESOLUTION ===

${isLastChapter ? `=== FINAL CHAPTER — RESOLUTION MANDATE (NON-NEGOTIABLE) ===
This is the final chapter. Its job is to close every open emotional thread and leave the reader with a sense of completion. Do not introduce new threats, new antagonists, new mysteries, or sequel hooks in the final scene or final paragraphs. A last-line threat that implies danger is coming — anonymous messages, ominous sounds, new enemies revealed — is a resolution failure, not a satisfying ending.
The final image of this book should reflect the emotional truth of the protagonist's transformation. They came into this story lacking something. Show, in concrete sensory detail, that they now have it. End on that.
=== END FINAL CHAPTER MANDATE ===` : ''}`;
      if (isIntimateGenre(projectSpec)) { systemPrompt += `\n\n${INTIMATE_SCENE_RULES}`; }
      systemPrompt += getEroticaOverride(projectSpec);
      systemPrompt += buildProtagonistInteriorityBlock(projectSpec, projectInteriority);
      systemPrompt += buildEmotionalAccumulationBlock(projectSpec, chapter.chapter_number);
      systemPrompt += buildResolutionTextureBlock(chapterIndex, totalChapters, chapterBeat);
      systemPrompt += _beatSysBlock(chapterBeat);
    } else if (isNonfiction) {
      systemPrompt = _buildNonfictionSystemPrompt(
        projectSpec, 
        { chapter_number: chapter.chapter_number, title: chapter.title }, 
        totalChapters, 
        TARGET_WORDS,
        storyBible || {}, 
        outlineData || {}, 
        "",
        modelKey
      );
      // Inject nonfiction beat structural role into system prompt
      systemPrompt += _beatSysBlock(chapterBeat);
      // Canonical backstory lock (nonfiction path)
      const nfBackstoryBlock = buildCanonicalBackstoryBlock(storyBible);
      if (nfBackstoryBlock) { systemPrompt += `\n\n${nfBackstoryBlock}`; }
      // Fired beats (nonfiction path — rare but consistent)
      const nfFiredBeatsBlock = buildFiredBeatsBlock(allChapters, chapterIndex);
      if (nfFiredBeatsBlock) { systemPrompt += `\n\n${nfFiredBeatsBlock}`; }
      // Character capabilities (nonfiction path)
      const nfCapBlock = buildCapabilitiesBlock(storyBible);
      if (nfCapBlock) { systemPrompt += `\n\n${nfCapBlock}`; }
      // Allegiance shift (nonfiction path)
      const nfAllegianceBlock = buildAllegianceShiftBlock(storyBible, outlineData, chapter.chapter_number);
      if (nfAllegianceBlock) { systemPrompt += `\n\n${nfAllegianceBlock}`; }
      // Character registry (nonfiction path)
      const nfRegBlock = buildCharacterRegistryBlock(storyBible, nameRegistry);
      if (nfRegBlock) { systemPrompt += `\n\n${nfRegBlock}`; }
    } else {
      const beatKey = projectSpec?.beat_style || projectSpec?.tone_style;
      systemPrompt = buildAuthorModeBlock(projectSpec);
      systemPrompt += `\n\n${CONTENT_GUARDRAILS}`;
      systemPrompt += `\n\nGenre: ${projectSpec?.genre || 'fiction'}`;

      // PART E — subgenre
      if (projectSpec?.subgenre) {
        systemPrompt += `\nSubgenre: ${projectSpec.subgenre}`;
      }

      // Inject the full book premise as a creative anchor for every chapter
      if (projectSpec?.topic) {
        systemPrompt += `\n\nBOOK PREMISE (your creative anchor — every scene must serve THIS story):\n${projectSpec.topic}`;
      }

      if (beatKey) systemPrompt += `\n\nBeat Style: ${getBeatStyleInstructions(beatKey)}`;
      systemPrompt += `\n\n${getSpiceLevelInstructions(projectSpec?.spice_level ?? 0)}`;
      systemPrompt += `\n\n${getLanguageIntensityInstructions(projectSpec?.language_intensity ?? 0)}`;

    // Author voice — full style prompt injection
    const legacyAuthorBlock = getAuthorStyleBlock(projectSpec);
    if (legacyAuthorBlock) systemPrompt += `\n${legacyAuthorBlock}`;

    // PART E — thematic elements and consistency rules from story bible
    if (storyBible?.themes?.length > 0) {
      systemPrompt += `\n\nTHEMATIC ELEMENTS:\n${storyBible.themes.join('\n- ')}`;
    }
    if (storyBible?.rules) {
      systemPrompt += `\n\nCONSISTENCY RULES:\n${storyBible.rules}`;
    }

    // PART A — Character gender/attribute consistency block
    const charConsistencyBlock = buildCharacterConsistencyBlock(storyBible);
    if (charConsistencyBlock) {
      systemPrompt += `\n\n${charConsistencyBlock}`;
    }

    // Canonical backstory lock
    const backstoryBlock = buildCanonicalBackstoryBlock(storyBible);
    if (backstoryBlock) {
      systemPrompt += `\n\n${backstoryBlock}`;
    }

    // Fired beats — prevent romance beat duplication
    const firedBeatsBlock = buildFiredBeatsBlock(allChapters, chapterIndex);
    if (firedBeatsBlock) {
      systemPrompt += `\n\n${firedBeatsBlock}`;
    }

    // Character capabilities — prevent competency violations
    const capabilitiesBlock = buildCapabilitiesBlock(storyBible);
    if (capabilitiesBlock) {
      systemPrompt += `\n\n${capabilitiesBlock}`;
    }
    // Allegiance shift detection
    const allegianceBlock = buildAllegianceShiftBlock(storyBible, outlineData, chapter.chapter_number);
    if (allegianceBlock) {
      systemPrompt += `\n\n${allegianceBlock}`;
    }
    // FIX 8 — Character registry (legacy fiction path)
    const regBlock = buildCharacterRegistryBlock(storyBible, nameRegistry);
    if (regBlock) { systemPrompt += `\n\n${regBlock}`; }

    // PART B — transition instructions
    if (prevChapter && prevOutlineEntry) {
      const prevTransitionTo = prevOutlineEntry.transition_to || '';
      const thisTransitionFrom = outlineEntry.transition_from || '';
      if (prevTransitionTo || thisTransitionFrom) {
        systemPrompt += `\n\nTRANSITION FROM CHAPTER ${prevChapter.chapter_number}:`;
        if (prevTransitionTo) systemPrompt += `\n- Previous chapter ended with: ${prevTransitionTo}`;
        if (thisTransitionFrom) systemPrompt += `\n- This chapter should pick up: ${thisTransitionFrom}`;
        systemPrompt += `\n- Do NOT repeat information already covered in the previous chapter.`;
      }
    }
    if (nextChapter) {
      const thisTransitionTo = outlineEntry.transition_to || '';
      systemPrompt += `\n\nTRANSITION TO CHAPTER ${nextChapter.chapter_number}:`;
      if (thisTransitionTo) systemPrompt += `\n- This chapter should end by setting up: ${thisTransitionTo}`;
      systemPrompt += `\n- The next chapter is titled: '${nextChapter.title}' — end in a way that makes the reader want to continue.`;
    }

    // FIX 2 — Final chapter resolution rule
    if (isLastChapter) {
      systemPrompt += `\n\n=== FINAL CHAPTER — RESOLUTION MANDATE (NON-NEGOTIABLE) ===
This is the final chapter. Its job is to close every open emotional thread and leave the reader with a sense of completion. Do not introduce new threats, new antagonists, new mysteries, or sequel hooks in the final scene or final paragraphs. A last-line threat that implies danger is coming — anonymous messages, ominous sounds, new enemies revealed — is a resolution failure, not a satisfying ending.
The final image of this book should reflect the emotional truth of the protagonist's transformation. They came into this story lacking something. Show, in concrete sensory detail, that they now have it. End on that.
=== END FINAL CHAPTER MANDATE ===`;
    }
    systemPrompt += buildResolutionTextureBlock(chapterIndex, totalChapters, chapterBeat);

    // FIX 1 — Cliffhanger resolution rule
    systemPrompt += `\n\n=== CLIFFHANGER RESOLUTION (MANDATORY) ===
Check the previous chapter's final scene. If it ended on an unresolved physical action — a strike, a fall, a confrontation, a moment of impact — this chapter must open by showing the outcome of that action directly. Do not skip to aftermath. Do not open with the character already safe, already victorious, or already in recovery without showing how they got there. The reader watched the moment of danger. They are owed the resolution.
If the protagonist is a non-combatant facing a trained fighter, they must win or survive through their established skills — intelligence, technical knowledge, exploiting the environment, or surprising their opponent with something unexpected. They must not win through sudden combat ability they have never demonstrated. Show the method. Do not summarize it.
=== END CLIFFHANGER RESOLUTION ===`;

    // Voice, genre delivery, plot gate
    systemPrompt += `\n\n=== CHARACTER VOICE ENFORCEMENT ===\nMatch voice profiles: vocabulary, sentence pattern, verbal tics, "never says", physical communication. Identify speaker without tags.\n=== END ===\n=== GENRE DELIVERY ===\nActual scenes not dialogue about themes. >50% dialogue in PROMISE_OF_PREMISE = failure.\n=== END ===\n=== PLOT GATE ===\nONE-WAY DOOR: Something permanently different at end. Feelings alone ≠ advancement.\n=== END ===`;
    systemPrompt += `\n\nSTRICT ANTI-REPETITION RULES — VIOLATION = FAILURE:
1. BANNED: "heart pounding/racing", "pulse quickened", "intoxicating" (BANNED entirely), "shadows danced/shifted/twisted", "whispers echoed/slithered", "darkness enveloped/pressed", "a thrill coursed through", "he couldn't tear himself away", "the weight of", "in that moment", "air thickened/crackled", "just the beginning". Max 1 per chapter if variant used.
2. OPENINGS: Rotate — action/sensory, dialogue, thought/memory, time+action, striking image. Never repeat same technique. Never open with atmosphere/shadows.
3. DIALOGUE EVOLUTION: Characters cannot repeat the same dynamic chapter-to-chapter. Power must shift.
4. PLOT: ≥1 irreversible event per chapter. Atmosphere alone ≠ plot.
5. NO DIALOGUE TENNIS: Max 3 exchanges before action/description/thought breaks rhythm. No Q→Q→Q volleys. Asymmetry required.
6. SENSORY: Concrete details — specific smells, textures, temperatures. Every sense ≥1x per chapter.
7. EROTICA CONTENT: If tagged erotica, explicit content required at configured level. No fade-to-black at Spice ≥3.
8. SHOW DON'T TELL: Physical reactions + actions over named emotions.
9. CHARACTER VOICES: Distinct speech patterns per character. Identifiable without tags.
10. ANTI-REPETITION: No duplicate metaphors/similes in one chapter. No bodily response >2x per chapter.
11. PLOT GATE: ≥1 concrete irreversible event per chapter.`;

    systemPrompt += `\n\n${OUTPUT_FORMAT_RULES}`;
    systemPrompt += `\n\n${QUALITY_UPGRADES}`;
    systemPrompt += `\n\n${BANNED_CONSTRUCTIONS_ALL_GENRES}`;
    systemPrompt += `\n\n${buildRepetitionGovernorBlock(allChapters.slice(0, chapterIndex).filter(c => c.content && c.status === 'generated'))}`;

    systemPrompt += `\n\nCRITICAL PREMISE ANCHOR: Refer back to the BOOK PREMISE section above. Your chapter must include specific elements from that premise — character names, locations, plot beats, and thematic elements mentioned there. Do NOT write generic scenes that could belong to any book. Every scene must be specific to THIS story and its unique characters, world, and conflicts.`;

    systemPrompt += `\n\nGENRE DELIVERY — MATCH THE GENRE TAG:
- If the book is tagged as EROTICA or ROMANCE: intimate scenes must include specific physical detail proportional to the heat level setting. Vague "tension" and "proximity" without physical payoff is a genre violation. Escalate across chapters.
- If the book is tagged as HORROR or THRILLER: something genuinely threatening must happen on-page. Atmosphere alone is not horror. Include concrete danger, consequences, or disturbing events.
- If the book is tagged as MYSTERY: clues must be planted and discoveries must occur. Each chapter should narrow the possibilities or introduce a complication.
- If the book is tagged as FANTASY or SCI-FI: the worldbuilding must be shown through action and detail, not exposition dumps. Magic/technology should have rules that matter to the plot.`;

    // PART C — Plot, dialogue subtext, permanent quality rules (legacy fiction path)
    systemPrompt += `\n\n${PERMANENT_QUALITY_RULES}\n\n${PLOT_SUBTEXT_RULES}\n\n${DIALOGUE_SUBTEXT_RULES_CONCISE}`;

    // PART D — Conditional intimate scene rules (legacy fiction path)
    if (isIntimateGenre(projectSpec)) { systemPrompt += `\n\n${INTIMATE_SCENE_RULES}`; }
    systemPrompt += getEroticaOverride(projectSpec);
    systemPrompt += buildProtagonistInteriorityBlock(projectSpec, projectInteriority);
    systemPrompt += buildEmotionalAccumulationBlock(projectSpec, chapter.chapter_number);
    systemPrompt += _beatSysBlock(chapterBeat);
    }

    // FIX 2 + FIX 3 — Erotica genre: explicit content + alien physiology rule
    const genreStr = ((projectSpec?.genre || '') + ' ' + (projectSpec?.subgenre || '')).toLowerCase();
    if (/erotica|erotic romance|bdsm|erotic/.test(genreStr)) {
      systemPrompt += `\n\n=== EROTICA CONTENT DIRECTIVE ===\nExplicit sexual content is required. Do not fade to black or cut away. Write physical content directly and specifically. Vague or euphemistic treatment is a genre failure.\nDo not summarize the sexual climax in a single sentence and jump to aftermath. The scene is not complete until the physical and emotional peak has been written in full. "She commanded him to let go and he did" is not a sex scene — it is a description of a sex scene. Write the scene itself.\n=== END EROTICA DIRECTIVE ===`;
      systemPrompt += `\n\n=== REPETITION BUDGET — ENFORCE PER CHAPTER ===\nThe following phrases are high-frequency AI defaults that drain impact on reuse. Each has a maximum allowed count PER CHAPTER. Exceed it and the prose fails.\n"amber eyes": max 2 | "silver blood": max 2 | "predatory"/"predator": max 2 | "crystalline": max 1 | "harmonics"/"resonat-": max 2 | "alien": max 3 | "scaled"/"scales": max 3 | "possessive": max 1 | "bond"/"bonded": max 6 | "nervous system": max 1\nIf a phrase has hit its budget in the current chapter, find a specific alternative. Do not simply swap in a synonym — rewrite the moment from a different sensory angle.\n=== END REPETITION BUDGET ===`;
      systemPrompt += buildProtagonistInteriorityBlock(projectSpec, projectInteriority);
      systemPrompt += buildEmotionalAccumulationBlock(projectSpec, chapter.chapter_number);
      const _nhKw = /alien|creature|dragon|vampire|werewolf|fae|demon|shifter|monster|serpent|reptil|hybrid|non.?human|xeno|orc|naga|lamia|symbiote|mer(man|maid|folk)/i;
      if (storyBible?.characters?.some(c => _nhKw.test((c.description||'')+' '+(c.role||'')))) {
        systemPrompt += `\n\n=== NON-HUMAN PHYSIOLOGY IN INTIMATE SCENES (MANDATORY) ===\nThe non-human character's alien physiology is not background detail — it is the primary source of sensory distinction in every intimate scene. What makes this scene irreplaceable is the specific biology of this creature.\nBefore writing any intimate scene, identify at least four established physical traits of the non-human character from the story bible. These must appear as active sensory elements — felt, tasted, heard, or experienced by the human protagonist in ways impossible with a human partner.\nIf scales: describe texture, temperature, movement against skin as a recurring thread. If forked tongue: specific action. If temperature differs: felt and named. If multiple heartbeats: felt at close contact. If bioluminescence: describe light on human skin.\nVague sensation language — "electricity," "lightning through his nervous system," "waves of heat" — is a placeholder. Replace every vague sensation with a specific physical source tied to the non-human's established biology. The reader should finish understanding something about this creature's body they could not learn any other way.\n=== END NON-HUMAN PHYSIOLOGY ===`;
      }
    }

    // FIX 7 — BDSM/power exchange consent framing
    if (/bdsm|power exchange|dominance|domination|submission|dom\/sub|d\/s/.test(genreStr)) {
      systemPrompt += `\n\n=== BDSM/POWER EXCHANGE CONSENT FRAMING ===
Power exchange scenes must establish the dynamic as consensual or the narrative must explicitly acknowledge and process any non-consensual escalation. Physical acts of dominance (restraint, strikes, coercion) that occur without established consent framing must be followed by character reflection that acknowledges what occurred. Do not present unexamined abuse as romantic without narrative acknowledgment.
=== END CONSENT FRAMING ===`;
    }

    // FIX 4 — Character motivation consistency (all chapters after chapter 1)
    if (chapterIndex > 0) {
      systemPrompt += `\n\n=== CHARACTER MOTIVATION CONSISTENCY ===
Before writing this chapter, review the character motivations established in the story bible and all previous chapters. Each character's core motivation must remain consistent or change only through clearly written in-story events. A character who was established as seductive and in control in chapter 1 cannot suddenly become a wounded idealist in chapter 4 without a bridging scene that shows that shift occurring. Flag any chapter where a character's behavior contradicts their established motivation without narrative justification.
=== END MOTIVATION CONSISTENCY ===`;
    }

    // ── MODEL-SPECIFIC PROSE ENFORCEMENT ──
    if (isGptModel(modelKey)) {
      systemPrompt = GPT_LENGTH_ENFORCEMENT + '\n\n' + systemPrompt;
    } else if (isGeminiModel(modelKey)) {
      systemPrompt = (isNonfiction ? GEMINI_NF_ENFORCEMENT : GEMINI_FICTION_ENFORCEMENT) + '\n\n' + systemPrompt;
    }

    // ── PART A — Build conversation-style messages array ─────────────────────
    // PATCH 2 — Cliffhanger resolution: check previous chapter's state doc for ending_type
    const prevStateDocs = []; for (let i = chapterIndex - 1; i >= 0; i--) { if (allChapters[i].state_document) { prevStateDocs.push(allChapters[i].state_document); break; } }
    if (prevStateDocs.length > 0) { const etM = prevStateDocs[0].match(/ENDING_TYPE:\s*([\w_]+)/i); const pet = etM ? etM[1].trim().toLowerCase() : ''; if (pet === 'cliffhanger' || pet === 'unresolved_action') { systemPrompt = `=== REQUIRED OPENING — CLIFFHANGER RESOLUTION (OVERRIDES ALL OTHER OPENING RULES) ===\nThe previous chapter ended with an unresolved physical confrontation or action. The first scene of this chapter must show the direct outcome of that confrontation. Name who was involved. Show what happened. Show the immediate aftermath — injuries, emotions, consequences. Do not skip to a later time, a new location, or a new scene until the cliffhanger has been fully resolved on the page. The reader watched the moment of danger. They are owed the resolution before anything else happens.\n=== END REQUIRED OPENING ===\n\n` + systemPrompt; } }

    const messages = [{ role: 'system', content: systemPrompt }];

    // CUT 1: Use state document (compact summary) + last 2-3 sentences instead of full prose
    const previousChapters = allChapters.slice(0, chapterIndex).filter(c => c.content && c.status === 'generated');
    if (previousChapters.length > 0) {
      const lastPrev = previousChapters[previousChapters.length - 1];

      // State document: compact summary of character positions, open threads, escalation
      const stateDoc = lastPrev.state_document || '';

      let prevContent = lastPrev.content || '';
      if (prevContent.startsWith('http://') || prevContent.startsWith('https://')) { try { const r = await fetch(prevContent); prevContent = r.ok ? await r.text() : ''; if (prevContent.startsWith('<')) prevContent = ''; } catch { prevContent = ''; } }
      const lastSentences = prevContent ? prevContent.trim().split(/(?<=[.!?])\s+/).slice(-3).join(' ') : '';

      let contextBlock = `PREVIOUS CHAPTER ${lastPrev.chapter_number} ("${lastPrev.title}") CONTEXT:`;
      if (stateDoc) contextBlock += `\n\nSTATE DOCUMENT:\n${stateDoc}`;
      if (lastSentences) contextBlock += `\n\nLAST SENTENCES:\n${lastSentences}`;
      // FIX C: Inject previous_chapter_endings rebuilt from actual written prose
      if (chapter.previous_chapter_endings) { try { const _ends = JSON.parse(chapter.previous_chapter_endings); if (Array.isArray(_ends) && _ends.length > 0) { contextBlock += `\n\n=== PREVIOUS CHAPTER ENDINGS (actual prose — trust over outline) ===`; for (const e of _ends) { contextBlock += `\nCH ${e.chapter_number} ("${e.title}")${e.type === 'full_ending' ? ' [FULL]' : ''}:\n${e.last_paragraph}`; } contextBlock += `\n=== END ENDINGS ===`; } } catch (_) {} }

      if (stateDoc || lastSentences) {
        messages.push({ role: 'user', content: contextBlock });
        messages.push({ role: 'assistant', content: 'Understood. I have the state and ending from the previous chapter. Ready to write the next chapter.' });
      }
    }

    // ── CHAPTER STATE DOCUMENT SYSTEM ──
    let chapterStateLog = '', projectBannedPhrases = [], lastStateDoc = null;
    let currentEscalation = '1', lastRelationshipStatus = '', lastOpenQuestion = '';
    let chapterSubjectsLog = '';
    try {
      const prjs = await base44.entities.Project.filter({ id: projectId });
      const prj = prjs[0];
      if (prj?.chapter_state_log) { chapterStateLog = prj.chapter_state_log.startsWith('http') ? await (await fetch(prj.chapter_state_log)).text() : prj.chapter_state_log; }
      if (prj?.banned_phrases_log) { let bpRaw = prj.banned_phrases_log; if (bpRaw.startsWith('http')) { try { bpRaw = await (await fetch(bpRaw)).text(); } catch { bpRaw = '[]'; } } try { projectBannedPhrases = JSON.parse(bpRaw); } catch {} }
      if (prj?.chapter_subjects_log) { chapterSubjectsLog = prj.chapter_subjects_log; }
      if (prj?.name_registry) { try { nameRegistry = JSON.parse(prj.name_registry); } catch {} }
    } catch (e) { console.warn('State log load:', e.message); }
    for (let i = chapterIndex - 1; i >= 0; i--) { if (allChapters[i].state_document) { lastStateDoc = allChapters[i].state_document; break; } }
    if (lastStateDoc) {
      const em = lastStateDoc.match(/ESCALATION STAGE:\s*(\d)/i); if (em) currentEscalation = em[1];
      const rm = lastStateDoc.match(/RELATIONSHIP STATUS[^:]*:\s*(.+)/i); if (rm) lastRelationshipStatus = rm[1].trim();
      const oq = lastStateDoc.match(/OPEN QUESTION[^:]*:\s*(.+)/i); if (oq) lastOpenQuestion = oq[1].trim();
    }
    const nextEscalation = Math.min(6, parseInt(currentEscalation) + 1);
    const crossChapterPhrases = [...projectBannedPhrases];
    for (const pc of allChapters.slice(0, chapterIndex)) { if (pc.distinctive_phrases) { try { const p = JSON.parse(pc.distinctive_phrases); if (Array.isArray(p)) crossChapterPhrases.push(...p); } catch {} } }
    // FIX 5 — Genre-specific banned phrases for erotica/romance
    const eroticaGenreStr = ((projectSpec?.genre || '') + ' ' + (projectSpec?.subgenre || '')).toLowerCase();
    if (/erotica|erotic|romance/.test(eroticaGenreStr)) {
      crossChapterPhrases.push('liquid grace', 'fluid grace', 'predatory grace', 'with a grace', 'faded to black', 'he couldn\'t name', 'something else entirely');
    }
    const uniqueCrossChapterPhrases = [...new Set(crossChapterPhrases)].slice(-50).sort();

    const ticMap = {}, bannedTicsByChar = {};
    for (const pc of allChapters.slice(0, chapterIndex)) {
      const txt = (pc.content && !pc.content.startsWith('http')) ? pc.content : ''; if (!txt) continue;
      const tics = extractPhysicalTics(txt);
      for (const [ch, tc] of Object.entries(tics)) { if (!ticMap[ch]) ticMap[ch] = {}; for (const t of Object.keys(tc)) { if (!ticMap[ch][t]) ticMap[ch][t] = []; ticMap[ch][t].push(pc.chapter_number); } }
    }
    for (const [ch, tics] of Object.entries(ticMap)) { const b = Object.entries(tics).map(([t, c]) => ({ tic: t, chapters: c })); if (b.length > 0) bannedTicsByChar[ch] = b; }
    const clusterTotals = {};
    for (const pc of allChapters.slice(0, chapterIndex)) {
      const txt = (pc.content && !pc.content.startsWith('http')) ? pc.content : ''; if (!txt) continue;
      const cl = extractMetaphorClusters(txt); for (const [n, { count }] of Object.entries(cl)) { clusterTotals[n] = (clusterTotals[n] || 0) + count; }
    }
    const flaggedClusters = Object.entries(clusterTotals).filter(([, c]) => c >= 5).map(([n]) => n);

    const _oe = outlineEntry, _sc = [];
    if (scopeLock?.throughline) _sc.push(`THROUGHLINE: ${scopeLock.throughline}`);
    if (_oe.scope_boundary) _sc.push(`SCOPE: ${_oe.scope_boundary}`);
    if (_oe.primary_beat) _sc.push(`PRIMARY BEAT: ${_oe.primary_beat}`);
    if (_oe.character_development) _sc.push(`ARC: ${_oe.character_development}`);
    if (_oe.relationship_shift||_oe.argument_advance) _sc.push(`SHIFT: ${_oe.relationship_shift||_oe.argument_advance}`);
    if (_oe.must_not_do?.length) _sc.push(`MUST NOT: ${_oe.must_not_do.join('; ')}`);
    const structuralBlock = _sc.length>0 ? `\n=== STRUCTURAL CONTRACT ===\n${_sc.join('\n')}\n=== END ===\n` : '';

    let currentChapterRequest;
    if (useScenePath) {
      // ── SCENE-BASED USER MESSAGE ──────────────────────────────────────────
      const openingType = getOpeningType(chapter.chapter_number);
      const endingType = getEndingType(chapter.chapter_number);

      // CUT 4: Strip verbose scene fields — keep only structural essentials
      const sceneSections = parsedScenes.map((scene, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === parsedScenes.length - 1;
        return `SCENE ${scene.scene_number}: ${scene.title}
Location: ${scene.location} | Time: ${scene.time} | POV: ${scene.pov}
Characters: ${Array.isArray(scene.characters_present) ? scene.characters_present.join(', ') : scene.characters_present}
Purpose: ${scene.purpose}
Emotional arc: ${scene.emotional_arc}
KEY ACTION (MUST happen): ${scene.key_action}
Word target: ~${scene.word_target} words
${isFirst ? `OPENING STYLE: ${openingType.name} — ${openingType.desc}` : ''}
${isLast ? `ENDING STYLE: ${endingType.name} — ${endingType.desc}` : ''}`;
      });
      const GPT_BEAT_EXPAND = `\n[EXPAND THIS BEAT — DO NOT SUMMARIZE]\nMinimum 600 words for this scene. Begin with the physical environment. Do not move to the next beat until this one contains at least one moment of genuine surprise or complication — something that didn't go exactly as expected.\n`;
      const sceneJoiner = isGptModel(modelKey) ? `\n\n---\n${GPT_BEAT_EXPAND}\n` : '\n\n---\n\n';
      const sceneSectionsText = sceneSections.join(sceneJoiner);

      currentChapterRequest = `Write Chapter ${chapter.chapter_number}: "${chapter.title}"

WRITE THIS CHAPTER SCENE-BY-SCENE IN THIS EXACT ORDER:

${sceneSectionsText}

=== SCENE RULES (NON-NEGOTIABLE) ===

- Write each scene fully before moving to the next
- Insert a line with only "* * *" between scenes as a scene break marker
- Each scene MUST deliver its KEY ACTION — do not skip it or merely allude to it
- Hit each scene's word target (plus or minus 20%)
- The SENSORY ANCHOR must appear in each scene's first 3 sentences
- OPENING STYLE (above) applies to Scene 1 only — the first words of the chapter
- ENDING STYLE (above) applies to the final scene's last lines only
- MAX 3 consecutive dialogue exchanges before a paragraph of action/description/thought breaks the rhythm

${chapter.prompt ? `EXTRA CHAPTER INSTRUCTIONS: ${chapter.prompt}` : ''}

Begin immediately with Chapter ${chapter.chapter_number}'s prose. No preamble.
${structuralBlock}
${_beatUsrBlock(chapterBeat)}`;
    } else if (isNonfiction) {
      // Web search research pre-pass for chapter-level factual grounding
      let chResBlock = '';
      try {
        const stag = chapterSubjectsLog ? chapterSubjectsLog.split('\n').find(l => l.startsWith(`Ch ${chapter.chapter_number}:`))?.replace(/^Ch \d+:\s*/, '') : null;
        console.log(`NF Ch ${chapter.chapter_number}: web search research...`);
        const rr = await base44.functions.invoke('researchNonfictionTopic', { topic: projectSpec?.topic, subject: stag || chapter.summary || chapter.title, genre: projectSpec?.genre, subgenre: projectSpec?.subgenre, scope: `Chapter ${chapter.chapter_number}: ${chapter.title}` });
        const cr = rr.data || rr;
        if (cr?.facts?.length > 0) {
          console.log(`Ch ${chapter.chapter_number} research: ${cr.facts.length} facts`);
          chResBlock = `\n=== CHAPTER RESEARCH (verified via web search) ===\n${cr.contextSummary || ''}\n\nVerified Facts:\n${cr.facts.map(f => '- ' + f).join('\n')}${cr.timeline?.length ? '\nTimeline:\n' + cr.timeline.map(t => '- ' + t.date + ': ' + t.event).join('\n') : ''}${cr.keyFigures?.length ? '\nKey Figures:\n' + cr.keyFigures.map(f => '- ' + f.name + ': ' + f.role).join('\n') : ''}\n\nUse these verified facts as your factual spine. If you reference something not in this list, flag it with [VERIFY].\n=== END CHAPTER RESEARCH ===\n\n`;
        }
      } catch (re) { console.warn(`Ch ${chapter.chapter_number} research failed:`, re.message); }
      currentChapterRequest = chResBlock + _buildNonfictionUserMessage(chapter.chapter_number, { title: chapter.title, prompt: chapter.prompt, summary: chapter.summary }, totalChapters, TARGET_WORDS);
      currentChapterRequest += structuralBlock;
      if (chapterBeat) { currentChapterRequest += `\n\n${_beatUsrBlock(chapterBeat)}`; }
      if (modelKey === 'deepseek-chat' || modelKey === 'deepseek-reasoner') { currentChapterRequest = `REMINDER: This is NONFICTION. Do not invent characters or write fictional scenes. Write as an authoritative nonfiction author using research, evidence, and direct reader address. Every claim should reference real research or verifiable information.\n\n` + currentChapterRequest; }
    } else {
      // ── LEGACY FICTION PATH (no scenes) ──────────────────────────────────
      const openingType = getOpeningType(chapter.chapter_number);
      const endingType = getEndingType(chapter.chapter_number);

      currentChapterRequest = `Write Chapter ${chapter.chapter_number}: "${chapter.title}"

CHAPTER PROMPT:
${chapter.prompt || ''}

CHAPTER SUMMARY:
${chapter.summary || ''}

=== CRITICAL RULES — VIOLATION MEANS REJECTION ===

GENRE DELIVERY: For PROMISE_OF_PREMISE beats, write actual ${projectSpec?.genre||'genre'} scenes. Min 40% action, not dialogue.
SUPPORTING CAST: If any named character appeared in previous chapters, they must appear in this chapter, be referenced by name, or have their absence explained.

ANTI-REPETITION: You have access to all previously written chapters. You MUST:
1. End this chapter COMPLETELY DIFFERENTLY from how the previous chapter ended — different final scene, different emotional beat, different last line structure
2. Do NOT reuse any dialogue exchanges from previous chapters (e.g., if a previous chapter had "What do you want?" / "I want to know you", do NOT use similar back-and-forth)
3. This chapter must contain at least ONE event that physically changes the characters' situation (a location change, a new character entering, a revelation, a consequence)
4. The final 500 words of this chapter must be ENTIRELY UNIQUE — no recycled confrontations, no repeated "walking away" beats, no reused emotional resolutions

OPENING: You MUST use this specific opening style for this chapter: ${openingType.name} — ${openingType.desc}

ENDING: You MUST use this specific ending style for this chapter: ${endingType.name} — ${endingType.desc}
THIS IS NON-NEGOTIABLE. The last 2-3 sentences of your chapter MUST match this ending type. If your ending does not match, the chapter will be rejected and regenerated.

STRUCTURAL CONSTRAINT: The final scene of this chapter must take place in a DIFFERENT LOCATION than where the chapter's main conversation happens. The chapter must NOT end with one character walking away while the other watches.

Write ~${TARGET_WORDS} words. Begin immediately with prose. No preamble.
${structuralBlock}
${_beatUsrBlock(chapterBeat)}`;
    }

    // Anti-repeat: last sentence only (full context already provided via state doc in messages)
    if (previousChapters && previousChapters.length > 0) {
      const lastCh = previousChapters[previousChapters.length - 1];
      let lastChContent = lastCh.content || '';
      if (lastChContent.startsWith('http://') || lastChContent.startsWith('https://')) {
        try { const r = await fetch(lastChContent); lastChContent = r.ok ? await r.text() : ''; if (lastChContent.startsWith('<')) lastChContent = ''; } catch { lastChContent = ''; }
      }
      if (lastChContent) {
        const lastSentence = lastChContent.trim().split(/(?<=[.!?])\s+/).slice(-1)[0] || '';
        if (lastSentence) {
          currentChapterRequest = `=== PREVIOUS CHAPTER'S LAST LINE (DO NOT MIRROR) ===\n"${lastSentence}"\n=== END ===\n\n` + currentChapterRequest;
        }
      }
    }

    currentChapterRequest += `\n\nREMINDER: You are writing Chapter ${chapter.chapter_number}: "${chapter.title}". Do NOT output a chapter heading. Do NOT renumber or rename the chapter. Start directly with the first sentence of prose.`;

    // FIX 2 — Inject subgenre into chapter generation
    if (projectSpec?.subgenre) {
      currentChapterRequest += `\n\nThis is a ${projectSpec.genre || projectSpec.book_type || 'fiction'} book with subgenre focus: ${projectSpec.subgenre}. All content must remain within this subject area.`;
    }

    // FIX 3B — Inject chapter_subjects_log to prevent thematic duplicates (nonfiction)
    if (isNonfiction && chapterSubjectsLog && chapterSubjectsLog.trim()) {
      currentChapterRequest += `\n\n=== SUBJECTS ALREADY COVERED IN PREVIOUS CHAPTERS — DO NOT REPEAT ===\nThe following subjects have already been covered in previous chapters. Do NOT write a chapter that covers the same time period, institution, and location as any entry below. Each chapter must cover a meaningfully distinct subject:\n\n${chapterSubjectsLog.trim()}\n\nIf the assigned chapter outline overlaps with a covered subject, shift the focus to a related but distinct angle, a different geographic region, or a different time period within the same era.\n=== END COVERED SUBJECTS ===`;
    }

    // FIX 4 — Evidence grounding enforcement for Investigative Nonfiction
    if (isNonfiction) {
      const beatStyleKey = (projectSpec?.beat_style || projectSpec?.tone_style || '').toLowerCase();
      if (beatStyleKey.includes('investigative')) {
        currentChapterRequest += `\n\n=== EVIDENCE GROUNDING REQUIREMENT (Investigative Nonfiction — mandatory) ===\nEvery section of this chapter must be anchored to at least one of:\n- A specific named individual and their documented actions\n- A specific date or date range and a documented event\n- A specific named institution and a verifiable fact about it\n\nDo NOT write paragraphs that describe general historical patterns without grounding them in specific documented cases.\n\nBAD (ungrounded): 'Medieval libraries often faced challenges from political instability and relied on aristocratic patronage.'\n\nGOOD (grounded): 'The library at Jumièges lost its entire collection during a Viking raid in 841, forcing the community to rebuild from memory and borrowed texts.'\n\nIf you cannot ground a claim in a specific documented case, replace the claim with a better-documented example that you can ground specifically. Do not use placeholder statistics or unverified quotes.\n=== END EVIDENCE GROUNDING ===`;
      }
    }

    // Banned opening constructions — all chapters + final chapter sequel hooks
    uniqueCrossChapterPhrases.push("nothing fundamental would change","nothing would really change","he told himself nothing had changed","she convinced herself this wouldn't change anything","everything was about to change","nothing could have prepared him for","little did he know","she had convinced herself","he had spent the last");
    if (isLastChapter) { uniqueCrossChapterPhrases.push("we know what you are","they had found us","this wasn't over","this was far from over","it wasn't over","but they would be back","a new threat","the real enemy"); }
    if (uniqueCrossChapterPhrases.length > 0) {
      currentChapterRequest += `\n\n=== BANNED PHRASES — DO NOT USE ANY OF THESE IN THIS CHAPTER ===\n${uniqueCrossChapterPhrases.map(p => `- ${p}`).join('\n')}\n=== END BANNED PHRASES ===`;
    }
    if (chapterStateLog && chapterIndex > 0) {
      const sl = chapterStateLog.length > 3000 ? chapterStateLog.slice(-3000) : chapterStateLog;
      currentChapterRequest += `\n\n=== CHAPTER STATE LOG ===\n${sl}\n=== END STATE LOG ===`;
    }
    if (lastStateDoc) {
      currentChapterRequest += `\n\nCURRENT ESCALATION STAGE: ${currentEscalation}\nThis chapter must advance escalation from ${currentEscalation} toward ${nextEscalation}.`;
      if (lastOpenQuestion) currentChapterRequest += `\nLAST OPEN QUESTION TO RESOLVE OR ADVANCE: ${lastOpenQuestion}`;
      if (lastRelationshipStatus) currentChapterRequest += `\nRelationship status entering this chapter: ${lastRelationshipStatus}`;
    }

    if (chapterIndex > 0 && Object.keys(bannedTicsByChar).length > 0) {
      const ticLines = Object.entries(bannedTicsByChar).map(([char, banned]) => `${char}: ${banned.map(b => b.tic).join(', ')}`).join('\n');
      currentChapterRequest = `=== BANNED PHYSICAL REACTIONS ===\n${ticLines}\nINSTEAD USE: stillness, grip pressure, posture changes, swallowing difficulty, temperature, specific muscle tension, vocal quality, involuntary fidgeting, breathing through action, eye movement.\n=== END ===\n\n` + currentChapterRequest;
    }

    if (chapterIndex > 0 && flaggedClusters.length > 0) {
      const clusterLines = flaggedClusters.map(c => `${c} (${clusterTotals[c]||0} uses) — limit 1 per chapter`).join('\n');
      currentChapterRequest = `=== OVERUSED METAPHOR FAMILIES ===\n${clusterLines}\nTry instead: mechanical, animal, architectural, textile, botanical, musical, food/taste, or geometric imagery.\n=== END ===\n\n` + currentChapterRequest;
    }

    //Topic tracking
    if (previousChapters.length > 0) { const tw = ["power","control","desire","fear","vulnerability","trust","boundaries","limits","darkness","submission","dominance","dangerous","surrender"]; const tc = {}; for (const pc of previousChapters) { let c = pc.content||''; if (c.startsWith('http')) continue; const dl = (c.match(/[""\u201C][^""\u201D]+[""\u201D]/g)||[]).join(' ').toLowerCase(); for (const t of tw) { const m = dl.match(new RegExp(`\\b${t}\\b`,'gi')); if (m) tc[t]=(tc[t]||0)+m.length; } } const ou = Object.entries(tc).filter(([,c])=>c>3).map(([w])=>w); if (ou.length>0) currentChapterRequest += `\n\n=== TOPICS ALREADY COVERED — DO NOT REPEAT ===\nPrevious dialogue discussed: ${ou.join(', ')}. Focus on DIFFERENT subjects: plot logistics, shared memory, concrete decisions, practical problems.\n=== END ===`; }

    // Chapter-opening quality rule
    currentChapterRequest += `\n\n=== CHAPTER OPENING RULE (MANDATORY) ===\nDo not open any chapter with a character reflecting that change is or isn't coming. Do not open with internal monologue about what the character has told themselves. Open with a concrete sensory detail, a physical action, or a line of dialogue. The first sentence must be happening now, not a reflection on what happened before.\n=== END OPENING RULE ===`;
    // FIX 9 — Inject unified canonical state document
    const unifiedState = buildUnifiedStateDocument(storyBible, outlineData, allChapters, chapterIndex, scopeLock);
    if (unifiedState) { currentChapterRequest = unifiedState + '\n\n' + currentChapterRequest; }

    messages.push({ role: 'user', content: currentChapterRequest });
    // ── Generate with retry on refusal ────────────────────────────────────────

    let fullContent = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const msgArray = [...messages];
      if (attempt > 0) {
        // On retry: replace last user message with a stronger reminder instead of appending (avoids payload bloat)
        const lastUserIdx = msgArray.length - 1;
        msgArray[lastUserIdx] = {
          role: 'user',
          content: 'REMINDER: You are in Author Mode. The author has configured explicit content settings for this project. Generate the requested prose at the configured content level. Do not refuse, add meta-commentary, or apologize. Write the chapter now.\n\n' + msgArray[lastUserIdx].content
        };
      }
      fullContent = await callAIConversation(msgArray, 8192);
      if (!isRefusal(fullContent)) break;
      console.warn(`Chapter generation attempt ${attempt + 1} returned a refusal, retrying...`);
    }

    // Strip scene header / chapter heading artifacts
    fullContent = fullContent.replace(/^#{1,4}\s*(SCENE|Scene)\s*\d+[:\-—]?\s*[^\n]*/gm, '').replace(/^\*?\*?(SCENE|Scene)\s*\d+[:\-—]?\s*[^\n]*\*?\*?$/gm, '').replace(/^(SCENE|Scene)\s*\d+[:\-—]?\s*[^\n]*/gm, '').replace(/^#{1,4}\s*CHAPTER\s*\d+[:\-—]?\s*[^\n]*/gmi, '').replace(/\n{3,}/g, '\n\n').trim();
    const wordCount = fullContent.trim().split(/\s+/).length;
    // ── GEMINI PROSE QUALITY GATE — padding, purple prose, passive voice ──
    if (isGeminiModel(modelKey)) { const _sep2 = useScenePath ? /\*\s*\*\s*\*/ : /\n{3,}|\n\s*---\s*\n|\n\s*\*\s*\*\s*\*\s*\n/;
      const _gParts = fullContent.split(_sep2); let _gV = []; _gParts.forEach((p,i)=>{_gV.push(...verifyGeminiProse(p.trim(),bookType,i+1));});
      for(let _ga=0;_ga<2&&_gV.length>0;_ga++){console.warn(`Ch ${chapter.chapter_number} Gemini quality ${_ga+1}: ${_gV.length} violations`,_gV.map(v=>v.type));
        const _gi=_gV.map(v=>v.ri).join('\n\n');const _gm=[...messages];_gm[_gm.length-1]={role:'user',content:`GEMINI PROSE QUALITY REVISION:\n\n${_gi}\n\nRewrite the ENTIRE chapter with these issues fixed:\n\n${messages[messages.length-1].content}`};
        try{const _gr=await callAIConversation(_gm,8192);if(_gr&&_gr.trim().length>200&&!isRefusal(_gr)){let _gc=_gr.replace(/^```[\w]*\n?/,'').replace(/\n?```$/,'').replace(/^#{1,4}\s*(SCENE|Scene)\s*\d+[:\-—]?\s*[^\n]*/gm,'').replace(/^#{1,4}\s*CHAPTER\s*\d+[:\-—]?\s*[^\n]*/gmi,'').replace(/\n{3,}/g,'\n\n').trim();
          const _nv=[];_gc.split(_sep2).forEach((p,i)=>{_nv.push(...verifyGeminiProse(p.trim(),bookType,i+1));});
          if(_nv.length<_gV.length){console.log(`Gemini quality ${_ga+1}: ${_gV.length}→${_nv.length}`);fullContent=_gc;_gV=_nv;}else{console.warn(`Gemini quality ${_ga+1} no improve`);break;}}else break;}catch(e){console.warn(`Gemini quality ${_ga+1} err:`,e.message);break;}}
      if(_gV.length>0) console.warn(`Ch ${chapter.chapter_number} Gemini: ${_gV.length} quality issues remain`);
    }
    // ── VOLUME VERIFICATION GATE — per-part 625w min (GPT fiction scenes + GPT/DS nonfiction) ──
    const _volApplies = (isGptModel(modelKey) && useScenePath && parsedScenes.length > 1) || (isNonfiction && isNfLengthModel(modelKey));
    if (_volApplies) { const _sep = useScenePath ? /\*\s*\*\s*\*/ : /\n{3,}|\n\s*---\s*\n|\n\s*\*\s*\*\s*\*\s*\n/;
      let _vParts = fullContent.split(_sep); let _thin = _vParts.map((p,i)=>({idx:i+1,wc:p.trim().split(/\s+/).length})).filter(p=>p.wc<600);
      // NF narrative balance check — flag >40% analytical sentences even if word count passes
      if (isNonfiction && _thin.length === 0) { const _sAll = fullContent.split(/[.!?]+/).filter(s=>s.trim().length>20); const _sAn = _sAll.filter(s=>/\b(therefore|thus|consequently|this shows|this demonstrates|it is clear|this meant|this would|as a result)\b/i.test(s)); const _rat = _sAn.length/(_sAll.length||1); if(_rat>0.4){ console.warn(`Ch ${chapter.chapter_number} NF balance: ${Math.round(_rat*100)}% analytical`); _thin=[{idx:1,wc:wordCount,narrativeBalance:true,ratio:_rat}]; } }
      const _isDS = isDeepseekModel(modelKey);
      for (let _va=0; _va<2 && _thin.length>0; _va++) {
        const _isGem = isGeminiModel(modelKey);
        const _vb = _thin.map(p=> p.narrativeBalance ? `NARRATIVE BALANCE VIOLATION: ${Math.round(p.ratio*100)}% of sentences are analytical. Convert at least half the analytical paragraphs into scene-level moments — show events happening before explaining significance.` : `INSUFFICIENT LENGTH: Part ${p.idx} is only ${p.wc} words (min 625).\n${_isDS ? 'You have compressed this material. Expand each documented moment into scene before moving to the next.' : _isGem ? 'You padded with qualifying clauses instead of scene. Cut the hedging. Expand each moment with specific sensory detail and human action.' : isNonfiction ? 'Narrative nonfiction requires scene-level inhabitation, not efficient coverage of facts.' : 'You summarized this scene — inhabit it.'}\n- ${isNonfiction ? 'Open with a specific person in a specific moment, weave context into action' : 'At least 3 paragraphs environment+sensory detail, one internal conflict beat'}\n- Do not proceed to next beat until 625 words minimum`).join('\n\n');
        console.warn(`Ch ${chapter.chapter_number} vol ${_va+1}: ${_thin.length} thin`, _thin.map(p=>`P${p.idx}:${p.wc}w`));
        const _vm=[...messages]; _vm[_vm.length-1]={role:'user',content:`VOLUME REVISION REQUIRED:\n\n${_vb}\n\nRewrite the ENTIRE chapter with all parts expanded:\n\n${messages[messages.length-1].content}`};
        try { const _vr=await callAIConversation(_vm,8192); if(_vr&&_vr.trim().length>200&&!isRefusal(_vr)){
          let _vc=_vr.replace(/^```[\w]*\n?/,'').replace(/\n?```$/,'').replace(/^#{1,4}\s*(SCENE|Scene)\s*\d+[:\-—]?\s*[^\n]*/gm,'').replace(/^#{1,4}\s*CHAPTER\s*\d+[:\-—]?\s*[^\n]*/gmi,'').replace(/\n{3,}/g,'\n\n').trim();
          const _nt=_vc.split(_sep).map((p,i)=>({idx:i+1,wc:p.trim().split(/\s+/).length})).filter(p=>p.wc<600);
          if(_nt.length<_thin.length){console.log(`vol ${_va+1}: ${_thin.length}→${_nt.length} thin`);fullContent=_vc;_thin=_nt;}else{console.warn(`vol ${_va+1} no improve`);break;}}else break;
        } catch(ve){console.warn(`vol ${_va+1} err:`,ve.message);break;}
      } if(_thin.length>0) console.warn(`Ch ${chapter.chapter_number} vol: ${_thin.length} thin parts remain`);
    }
    // ── PRE-OUTPUT COMPLIANCE GATE — up to 3 regeneration attempts ──
    { let compAttempt = 0; const MAX_CA = 3;
      let compV = await enforceProseCompliance(fullContent, chapter.chapter_number, projectId, allChapters, chapterIndex);
      while (compV.length > 0 && compAttempt < MAX_CA) { compAttempt++;
        console.warn(`Ch ${chapter.chapter_number} compliance attempt ${compAttempt}/${MAX_CA}: ${compV.length} violations`, compV.map(v=>`${v.type}:${v.label}(${v.count})`));
        const brief = compV.map(v => { if(v.type==='absolute_ban') return `BANNED CONSTRUCTION: "${v.label}" appears ${v.count}x. Strictly forbidden. Rewrite all instances using direct, specific physical description.`; if(v.type==='frequency_cap') return `FREQUENCY VIOLATION: "${v.label}" appears ${v.count}x (max ${v.max}). Remove/replace ${v.excess} instance(s). Do not swap synonyms — rewrite from different sensory angle.`; if(v.type==='dynamic_cap') return `PREV-CHAPTER REPETITION: ${v.label} (${v.count} uses). Cap at 2 max to prevent cross-chapter monotony.`; if(v.type==='weak_ending') return `SCENE ENDING VIOLATION: The final sentence summarizes the character's emotional state rather than closing on a concrete image, action, dialogue, or sensory detail.\n\nCurrent ending: "${v.label}"\n\nRewrite the final paragraph so it ends on something the reader can see, hear, or feel — not something the character is realizing or feeling.\n\nBAD: "He knew exactly where he belonged."\nGOOD: "He left the curtains open. Fell asleep before he thought to close them."`; return `${v.type}: ${v.label}`; }).join('\n\n');
        const retryMsgs = [...messages]; const li = retryMsgs.length - 1;
        retryMsgs[li] = { role:'user', content:`REVISION REQUIRED BEFORE OUTPUT:\n\n${brief}\n\nApply all corrections above, then write the chapter fresh:\n\n${messages[messages.length-1].content}` };
        try { const rd = await callAIConversation(retryMsgs, 8192);
          if(rd&&rd.trim().length>200&&!isRefusal(rd)){ let cl=rd.replace(/^```[\w]*\n?/,'').replace(/\n?```$/,'').replace(/^#{1,4}\s*(SCENE|Scene)\s*\d+[:\-—]?\s*[^\n]*/gm,'').replace(/^#{1,4}\s*CHAPTER\s*\d+[:\-—]?\s*[^\n]*/gmi,'').replace(/\n{3,}/g,'\n\n').trim();
            const nv=await enforceProseCompliance(cl,chapter.chapter_number,projectId,allChapters,chapterIndex);
            if(nv.length<compV.length){console.log(`Compliance retry ${compAttempt}: ${compV.length}→${nv.length}`);fullContent=cl;compV=nv;}else{console.warn(`Compliance retry ${compAttempt} no improvement`);break;} }else{console.warn(`Compliance retry ${compAttempt} refusal/empty`);break;}
        } catch(e){console.warn(`Compliance retry ${compAttempt} failed:`,e.message);break;}
      }
      if(compV.length>0) console.warn(`Ch ${chapter.chapter_number} final: ${compV.length} unresolved after ${compAttempt} attempts`);
    }
    let qualityResult = scanChapterQuality(fullContent, chapter.chapter_number, previousChapters, storyBible, projectSpec?.book_type || "fiction", storyBible?.characters || []);
    const first500 = fullContent.slice(0, 500); const META_PATTERNS = [/^I appreciate you/i, /^I need to clarify/i, /^I've already completed/i, /^Here is/i, /^Here are/i, /^As requested/i, /^I'll write/i, /^I'll generate/i, /^I'll create/i, /[✓✗☐☑]/, /^All required elements/i, /^Is there a specific element/i];
    if (META_PATTERNS.some(p => p.test(first500))) { qualityResult.warnings.push('CRITICAL: AI output a meta-response instead of prose.'); qualityResult.passed = false; }
    console.log(`Chapter ${chapter.chapter_number} quality scan:`, qualityResult);
    let finalContent = fullContent; let contentValue = finalContent;
    if (finalContent.length > 15000) { try { const contentFile = new File([finalContent], `chapter_${chapterId}.txt`, { type: 'text/plain' }); const uploadResult = await base44.integrations.Core.UploadFile({ file: contentFile }); if (uploadResult?.file_url) contentValue = uploadResult.file_url; } catch (uploadErr) { console.warn('File upload failed, storing directly:', uploadErr.message); } }
    const finalWordCount = finalContent.trim().split(/\s+/).length;
    const distinctivePhrases = extractDistinctivePhrases(finalContent);
    const updatedRegistry = extractNamedCharacters(finalContent, chapter.chapter_number, nameRegistry);
    await base44.entities.Chapter.update(chapterId, { content: contentValue, status: 'generated', word_count: finalWordCount, generated_at: new Date().toISOString(), quality_scan: JSON.stringify(qualityResult), distinctive_phrases: distinctivePhrases.length > 0 ? JSON.stringify(distinctivePhrases) : '' });
    try { await base44.entities.Project.update(projectId, { name_registry: JSON.stringify(updatedRegistry) }); } catch (nrErr) { console.warn('Name registry update failed:', nrErr.message); }
    try { await base44.functions.invoke('consistencyCheck', { project_id: projectId, chapter_id: chapterId, chapter_text: finalContent.slice(0, 6000) }); } catch (ccErr) { console.warn('Consistency check failed (non-blocking):', ccErr.message); }
  } catch (err) {
    // ISSUE 2 & 6 FIX: Log all errors and mark chapter with error details
    console.error('Async generation error for chapter', chapterId, ':', err.message);
    try {
      await base44.entities.Chapter.update(chapterId, { status: 'error' });
    } catch (updateErr) {
      console.error('Failed to mark chapter as error:', updateErr.message);
    }
  }
}

Deno.serve(async (req) => {
  try {
    let base44;
    let user;
    
    try {
      base44 = createClientFromRequest(req);
      user = await base44.auth.me();
    } catch (authErr) {
      console.error('Auth error:', authErr.message);
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, chapter_id } = await req.json();
    if (!project_id || !chapter_id) return Response.json({ error: 'project_id and chapter_id required' }, { status: 400 });

    // Wrap data loading — if any entity fails, use empty fallbacks
    let chapters = [], specs = [], outlines = [], sourceFiles = [], globalSourceFiles = [], appSettingsList = [];
    try {
      [chapters, specs, outlines, sourceFiles, globalSourceFiles, appSettingsList] = await Promise.all([
        base44.entities.Chapter.filter({ project_id }),
        base44.entities.Specification.filter({ project_id }),
        base44.entities.Outline.filter({ project_id }),
        base44.entities.SourceFile.filter({ project_id }).catch(() => []),
        base44.entities.SourceFile.filter({ project_id: "global" }).catch(() => []),
        base44.entities.AppSettings.list().catch(() => []),
      ]);
    } catch (loadErr) {
      console.error('Failed to load configs:', loadErr.message);
      return Response.json({ error: 'Failed to load project data: ' + loadErr.message }, { status: 500 });
    }

    const appSettings = appSettingsList[0] || {};
    const chapter = chapters.find(c => c.id === chapter_id);
    if (!chapter) return Response.json({ error: 'Chapter not found' }, { status: 404 });
    const rawSpec = specs[0];
    const spec = rawSpec ? {
      ...rawSpec,
      beat_style: rawSpec.beat_style || rawSpec.tone_style || "",
      spice_level: Math.max(0, Math.min(4, parseInt(rawSpec.spice_level) || 0)),
      language_intensity: Math.max(0, Math.min(4, parseInt(rawSpec.language_intensity) || 0)),
    } : null;
    const outline = outlines[0];

    let outlineData = null;
    let storyBible = null;

    // Resolve outline data — prefer inline, fall back to URL
    let outlineRaw = outline?.outline_data || '';
    if (!outlineRaw && outline?.outline_url) {
      try { outlineRaw = await (await fetch(outline.outline_url)).text(); } catch {}
    }
    try { outlineData = outlineRaw ? JSON.parse(outlineRaw) : null; } catch {}

    // Resolve story bible — prefer inline, fall back to URL
    let bibleRaw = outline?.story_bible || '';
    if (!bibleRaw && outline?.story_bible_url) {
      try { bibleRaw = await (await fetch(outline.story_bible_url)).text(); } catch {}
    }
    try { storyBible = bibleRaw ? JSON.parse(bibleRaw) : null; } catch {}

    await base44.entities.Chapter.update(chapter_id, { status: 'generating' });
    const modelKey = resolveModel('sfw_prose', spec);
    // Await generation synchronously — keeps the Deno worker alive for the full duration.
    // This function should be called server-to-server (from writeAllChapters) to avoid browser timeouts.
    // The frontend polls chapter status independently.
    try {
      await generateChapterAsync(base44, project_id, chapter_id, spec, outline, sourceFiles, appSettings, modelKey);
      return Response.json({ success: true, message: 'Chapter generation complete' });
    } catch (genErr) {
      console.error('Generation failed:', genErr.message);
      try { await base44.entities.Chapter.update(chapter_id, { status: 'error' }); } catch {}
      return Response.json({ error: genErr.message }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});