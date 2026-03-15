// ═══════════════════════════════════════════════════════════════════════════════
// BOT 5 — STATE CHRONICLER
// ═══════════════════════════════════════════════════════════════════════════════
// One job: After a chapter is finalized, generate the state document and update
// all project-level tracking (banned phrases, name registry, subjects).
// MUST complete before next chapter starts — never fire-and-forget.
//
// Replaces: generateChapterState.ts (entire file)
// Migrates: extractDistinctivePhrases, extractNamedCharacters, extractPhysicalTics
//           from writeChapter.ts (lines 436–530)
// ═══════════════════════════════════════════════════════════════════════════════

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
// NOTE: If Base44 does not support relative imports, inline these functions from shared/
import { callAI, isRefusal } from '../shared/aiRouter.ts';
import { resolveModel } from '../shared/resolveModel.ts';
import { loadProjectContext, getChapterContext, resolveContent } from '../shared/dataLoader.ts';

// ── EXTRACTION FUNCTIONS (no AI, pure regex) ────────────────────────────────

function extractDistinctivePhrases(text) {
  const phrases = new Set();
  const simileRegex = /[\w\s,]+(like a|as if|as though)[\w\s,]+/gi;
  let match;
  while ((match = simileRegex.exec(text)) !== null) {
    const phrase = match[0].trim().slice(0, 60);
    if (phrase.split(' ').length >= 3) phrases.add(phrase.toLowerCase());
  }
  const adjNounRegex = /\b(surgical|predatory|velvet|cathedral|obsidian|glacial|molten|razor|iron|silk|phantom|hollow|ancient|fractured|luminous|shadowed|careful|deliberate|controlled|precise|calculated|architectural)\s+\w+/gi;
  while ((match = adjNounRegex.exec(text)) !== null) {
    phrases.add(match[0].trim().toLowerCase());
  }
  const words = text.toLowerCase().split(/\s+/);
  const phraseCount = {};
  const SKIP = new Set(['she said that','he said that','and she was','and he was','that she had','that he had','she looked at','he looked at']);
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

function extractNamedCharacters(text, chNum, reg = {}) {
  const SKIP = new Set(['January','February','March','April','May','June','July','August','September','October','November','December','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','Chapter','Scene','The','This','That','What','When','Where','Which','There','Here','They','Then','But','And','His','Her','God','Sir','Lord','Lady']);
  const nameRx = /\b([A-Z][a-z]{2,})(?:\s+[A-Z][a-z]+)?\b/g;
  const names = {};
  let m;
  while ((m = nameRx.exec(text)) !== null) {
    const n = m[0];
    if (SKIP.has(n.split(' ')[0])) continue;
    names[n] = (names[n] || 0) + 1;
  }
  const u = { ...reg };
  for (const [name, count] of Object.entries(names)) {
    if (count >= 2 && !u[name]) u[name] = { role: 'discovered', first_chapter: chNum };
  }
  return u;
}

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
    let match; rx.lastIndex = 0;
    while ((match = rx.exec(text)) !== null) {
      const ctx = text.slice(Math.max(0, match.index - 150), match.index + match[0].length + 150);
      const nameMatch = ctx.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)?\b/);
      const charName = nameMatch ? nameMatch[0] : 'Unknown';
      if (!ticsByChar[charName]) ticsByChar[charName] = {};
      ticsByChar[charName][canonical] = (ticsByChar[charName][canonical] || 0) + 1;
    }
  }
  return ticsByChar;
}

function getEscalationTarget(chapterNumber, totalChapters) {
  const ratio = chapterNumber / totalChapters;
  if (ratio <= 0.25) return { min: 1, max: 2, label: 'Stage 1-2 (establish world, introduce tension)' };
  if (ratio <= 0.50) return { min: 3, max: 4, label: 'Stage 3-4 (cost of choices, first breach)' };
  if (ratio <= 0.75) return { min: 4, max: 5, label: 'Stage 4-5 (consequences, no retreat)' };
  if (ratio < 0.95) return { min: 5, max: 6, label: 'Stage 5-6 (execution, no new plot)' };
  return { min: 6, max: 6, label: 'Stage 6 (resolution)' };
}

function autoClassifyEnding(text) {
  const last500 = text.slice(-500).toLowerCase();
  if (/\b(lunged|swung|fired|grabbed|shoved|knife|blade|gun|punch|struck|slammed|fell|explosion|scream|crash|charging)\b/.test(last500)) return 'cliffhanger';
  if (/\b(hours later|days later|weeks later|the next morning|by the time|when .+ woke)\b/.test(last500)) return 'time_skip';
  if (/\b(walked away|turned .+ back|closed .+ eyes|didn't answer|silence|stared|watched .+ go|left standing)\b/.test(last500)) return 'emotional_open';
  return 'resolved';
}

// ── MAIN BOT ────────────────────────────────────────────────────────────────

async function runStateChronicler(base44, projectId, chapterId, finalProse) {
  const startMs = Date.now();
  const ctx = await loadProjectContext(base44, projectId);
  const chCtx = getChapterContext(ctx, chapterId);
  const { chapter } = chCtx;

  const chapterContent = finalProse || await resolveContent(chapter.content);
  if (!chapterContent || chapterContent.length < 100) {
    throw new Error('Chapter content too short or unavailable for state generation');
  }

  // ── Phase A: Extraction (no AI) ──
  const distinctivePhrases = extractDistinctivePhrases(chapterContent);
  const updatedNameRegistry = extractNamedCharacters(chapterContent, chapter.chapter_number, ctx.nameRegistry);
  const physicalTics = extractPhysicalTics(chapterContent);
  const escalationTarget = getEscalationTarget(chapter.chapter_number, ctx.totalChapters);

  // ── Phase B: AI state generation (ONE call) ──
  const modelKey = resolveModel('chapter_state', ctx.spec);
  const prevStateDoc = chCtx.lastStateDoc || '';

  const systemPrompt = `You are a manuscript continuity tracker. Analyze the chapter and generate a precise Chapter State Document. Output EXACTLY the format specified — no commentary, no preamble.

ESCALATION STAGE GUIDE (for a ${ctx.totalChapters}-chapter book):
- Chapters 1-${Math.floor(ctx.totalChapters * 0.25)}: Stage 1-2 (establish world, introduce tension)
- Chapters ${Math.floor(ctx.totalChapters * 0.25) + 1}-${Math.floor(ctx.totalChapters * 0.50)}: Stage 3-4 (cost of choices, first breach)
- Chapters ${Math.floor(ctx.totalChapters * 0.50) + 1}-${Math.floor(ctx.totalChapters * 0.75)}: Stage 4-5 (consequences, no retreat)
- Chapters ${Math.floor(ctx.totalChapters * 0.75) + 1}-${ctx.totalChapters - 1}: Stage 5-6 (execution, no new plot)
- Chapter ${ctx.totalChapters}: Stage 6 resolution

Current chapter is ${chapter.chapter_number} of ${ctx.totalChapters}. Expected escalation range: ${escalationTarget.label}.`;

  const userMessage = `${prevStateDoc ? `PREVIOUS CHAPTER STATE DOCUMENT (carry forward open threads):\n${prevStateDoc}\n\n---\n\n` : ''}Generate a Chapter State Document for the chapter below. Use exactly this format:

LAST CHAPTER WRITTEN: ${chapter.chapter_number}
CHAPTER TITLE: ${chapter.title}
FINAL LOCATION OF EACH CHARACTER: [name — location]
PHYSICAL AND EMOTIONAL STATE OF EACH CHARACTER: [name — state]
NEW INFORMATION ESTABLISHED: [bullet list]
PLOT THREADS ACTIVATED THIS CHAPTER: [bullet list]
PLOT THREADS STILL OPEN: [bullet list — carry forward + new, remove resolved]
PHRASES AND METAPHORS USED THIS CHAPTER: [bullet list of distinctive phrases — permanently banned from reuse]
RELATIONSHIP STATUS BETWEEN CENTRAL CHARACTERS: [one sentence]
FIRED_BEATS: [bullet list using format: - BEAT: [type] | CHARACTERS: [A, B] | CHAPTER: ${chapter.chapter_number} | DETAIL: [description]. Types: first_kiss, first_intimate_scene, first_declaration_of_feelings, emotional_vulnerability_confession, first_physical_contact, jealousy_confrontation, breakup, reconciliation, sacrifice_for_other. If none: - none]
ENDING_TYPE: [resolved | cliffhanger | emotional_open | time_skip]
ESCALATION STAGE: [1-6, target: ${escalationTarget.label}]
FINAL LINE OF CHAPTER: [exact last sentence]
OPEN QUESTION CARRIED INTO NEXT CHAPTER: [specific unresolved threat/question]

CHAPTER TEXT:
${chapterContent}`;

  let stateDocument;
  try {
    stateDocument = await callAI(modelKey, systemPrompt, userMessage, { maxTokens: 2048, temperature: 0.3 });
  } catch (err) {
    console.error('State generation AI call failed:', err.message);
    // Fallback: generate minimal state document from extraction
    stateDocument = `LAST CHAPTER WRITTEN: ${chapter.chapter_number}\nCHAPTER TITLE: ${chapter.title}\nENDING_TYPE: ${autoClassifyEnding(chapterContent)}\nESCALATION STAGE: ${escalationTarget.min}\nFINAL LINE OF CHAPTER: ${chapterContent.trim().split(/[.!?]/).filter(s => s.trim()).pop()?.trim() || 'N/A'}\n[State generation failed — minimal fallback]`;
  }

  // Auto-classify ending if AI omitted it
  if (!/ENDING_TYPE:/i.test(stateDocument)) {
    stateDocument += `\nENDING_TYPE: ${autoClassifyEnding(chapterContent)}`;
  }

  // ── Phase C: Nonfiction subject extraction (ONE call, nonfiction only) ──
  let subjectLine = '';
  if (ctx.isNonfiction) {
    try {
      subjectLine = await callAI(modelKey,
        'You are a subject tagger for a nonfiction book generation system.',
        `Read this chapter and return one line: [TIME PERIOD] | [PRIMARY SUBJECT] | [LOCATION]\nExample: 9th century CE | Benedictine monastic scriptoriums | Western Europe\n\nChapter text:\n${chapterContent.slice(0, 6000)}`,
        { maxTokens: 256, temperature: 0.2 }
      );
      subjectLine = subjectLine.trim().split('\n')[0].trim();
    } catch (e) {
      console.warn('Subject extraction failed (non-blocking):', e.message);
    }
  }

  // ── Phase D: Parse banned phrases from state doc + auto-ban overused patterns ──
  const phrasesMatch = stateDocument.match(/PHRASES AND METAPHORS USED THIS CHAPTER:\s*([\s\S]*?)(?=\nRELATIONSHIP STATUS|$)/i);
  const newBannedPhrases = [];
  if (phrasesMatch) {
    const lines = phrasesMatch[1].split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('•'));
    for (const line of lines) {
      const phrase = line.replace(/^[\s\-•*]+/, '').trim().toLowerCase();
      if (phrase.length > 3 && phrase.length < 80) newBannedPhrases.push(phrase);
    }
  }

  // Auto-ban scent formulas and sensation phrases that hit their manuscript cap
  const AUTO_BAN_PATTERNS = [
    { rx: /ozone and star anise/gi, phrase: 'ozone and star anise', maxPerManuscript: 2 },
    { rx: /ozone and spice/gi, phrase: 'ozone and spice', maxPerManuscript: 2 },
    { rx: /live wire/gi, phrase: 'live wire', maxPerManuscript: 1 },
    { rx: /circuit complet/gi, phrase: 'circuit completing', maxPerManuscript: 1 },
  ];
  for (const { rx, phrase, maxPerManuscript } of AUTO_BAN_PATTERNS) {
    const countInChapter = (chapterContent.match(rx) || []).length;
    const alreadyBanned = ctx.bannedPhrases.includes(phrase);
    if (countInChapter > 0 && !alreadyBanned) {
      // Check how many times it appeared in previous chapters
      let totalPrior = 0;
      for (const pc of ctx.chapters.filter(c => c.chapter_number < chapter.chapter_number && c.content && !c.content.startsWith('http'))) {
        totalPrior += (pc.content.match(rx) || []).length;
      }
      if (totalPrior + countInChapter >= maxPerManuscript) {
        newBannedPhrases.push(phrase);
        console.log(`Auto-banned "${phrase}" after Ch ${chapter.chapter_number} (${totalPrior + countInChapter}x total, max ${maxPerManuscript})`);
      }
    }
  }

  const allBannedPhrases = [...new Set([...ctx.bannedPhrases, ...newBannedPhrases])];

  // ── Phase E: Persistence ──
  // Append state document to cumulative log
  const separator = `\n\n${'='.repeat(60)}\n\n`;
  const updatedLog = ctx.chapterStateLog
    ? ctx.chapterStateLog + separator + stateDocument
    : stateDocument;

  // Upload state log as file if large
  let stateLogValue = updatedLog;
  if (updatedLog.length > 15000) {
    try {
      const logFile = new File([updatedLog], `state_log_${projectId}.txt`, { type: 'text/plain' });
      const uploadResult = await base44.integrations.Core.UploadFile({ file: logFile });
      if (uploadResult?.file_url) stateLogValue = uploadResult.file_url;
    } catch (e) { console.warn('State log upload failed, storing inline:', e.message); }
  }

  // Upload banned phrases as file if large
  const bannedPhrasesJson = JSON.stringify(allBannedPhrases);
  let bannedPhrasesValue = bannedPhrasesJson;
  if (bannedPhrasesJson.length > 20000) {
    try {
      const phrasesFile = new File([bannedPhrasesJson], `banned_phrases_${projectId}.json`, { type: 'application/json' });
      const phrasesUpload = await base44.integrations.Core.UploadFile({ file: phrasesFile });
      if (phrasesUpload?.file_url) bannedPhrasesValue = phrasesUpload.file_url;
    } catch (e) { console.warn('Banned phrases upload failed:', e.message); }
  }

  // Build subject log
  let updatedSubjectsLog = ctx.project.chapter_subjects_log || '';
  if (subjectLine) {
    const newEntry = `Ch ${chapter.chapter_number}: ${subjectLine}`;
    updatedSubjectsLog = updatedSubjectsLog ? updatedSubjectsLog + '\n' + newEntry : newEntry;
  }

  // Save everything
  const projectUpdate = {
    chapter_state_log: stateLogValue,
    banned_phrases_log: bannedPhrasesValue,
    name_registry: JSON.stringify(updatedNameRegistry),
  };
  if (subjectLine) projectUpdate.chapter_subjects_log = updatedSubjectsLog;

  await Promise.all([
    base44.entities.Chapter.update(chapterId, {
      state_document: stateDocument,
      distinctive_phrases: distinctivePhrases.length > 0 ? JSON.stringify(distinctivePhrases) : '',
    }),
    base44.entities.Project.update(projectId, projectUpdate),
  ]);

  return {
    success: true,
    state_document: stateDocument,
    distinctive_phrases: distinctivePhrases,
    updated_name_registry: updatedNameRegistry,
    physical_tics: physicalTics,
    banned_phrases_added: newBannedPhrases,
    total_banned_phrases: allBannedPhrases.length,
    subject_line: subjectLine || null,
    ending_type: (stateDocument.match(/ENDING_TYPE:\s*(\w+)/i) || [])[1] || autoClassifyEnding(chapterContent),
    escalation_stage: parseInt((stateDocument.match(/ESCALATION STAGE:\s*(\d)/i) || [])[1]) || escalationTarget.min,
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

    const { project_id, chapter_id, final_prose } = await req.json();
    if (!project_id || !chapter_id) {
      return Response.json({ error: 'project_id and chapter_id required' }, { status: 400 });
    }

    const result = await runStateChronicler(base44, project_id, chapter_id, final_prose);
    return Response.json(result);

  } catch (error) {
    console.error('stateChronicler error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
