// ═══════════════════════════════════════════════════════════════════════════════
// BOT 3 — CONTINUITY GUARDIAN
// ═══════════════════════════════════════════════════════════════════════════════
// Read-only. Finds continuity violations. Returns fixes for Style Enforcer.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ═══ INLINED: shared/aiRouter ═══
const MODEL_MAP = {
  "claude-sonnet":     { provider: "anthropic", modelId: "claude-sonnet-4-20250514", defaultTemp: 0.72, maxTokensLimit: null },
  "claude-opus":       { provider: "anthropic", modelId: "claude-opus-4-20250514",   defaultTemp: 0.72, maxTokensLimit: null },
  "gpt-4o":            { provider: "openai",    modelId: "gpt-4o",                   defaultTemp: 0.4,  maxTokensLimit: null },
  "gemini-pro":        { provider: "google",    modelId: "gemini-2.5-pro", defaultTemp: 0.72, maxTokensLimit: null },
  "deepseek-chat":     { provider: "deepseek",  modelId: "deepseek-chat",            defaultTemp: 0.72, maxTokensLimit: 8192 },
};

async function callAI(modelKey, systemPrompt, userMessage, options = {}) {
  const config = MODEL_MAP[modelKey] || MODEL_MAP["claude-sonnet"];
  const { provider, modelId, defaultTemp, maxTokensLimit } = config;
  const temperature = options.temperature ?? defaultTemp;
  let maxTokens = options.maxTokens ?? 8192;
  if (maxTokensLimit) maxTokens = Math.min(maxTokens, maxTokensLimit);

  if (provider === "anthropic") {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature, system: systemPrompt, messages: [{ role: 'user', content: userMessage }] }) });
    const d = await r.json(); if (!r.ok) throw new Error('Anthropic: ' + (d.error?.message || r.status)); return d.content[0].text;
  }
  if (provider === "openai") {
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + Deno.env.get('OPENAI_API_KEY'), 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelId, max_tokens: maxTokens, temperature, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }) });
    const d = await r.json(); if (!r.ok) throw new Error('OpenAI: ' + (d.error?.message || r.status)); return d.choices[0].message.content;
  }
  if (provider === "google") {
    const apiKey = Deno.env.get('GOOGLE_AI_API_KEY'); if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set');
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + modelId + ':generateContent?key=' + apiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: userMessage }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { temperature, maxOutputTokens: maxTokens } }) });
    const d = await r.json(); if (!r.ok) throw new Error('Google: ' + (d.error?.message || r.status)); return d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  if (provider === "deepseek") {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + Deno.env.get('DEEPSEEK_API_KEY'), 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelId, max_tokens: Math.min(maxTokens, 8192), temperature, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }) });
    const d = await r.json(); if (!r.ok) throw new Error('DeepSeek: ' + (d.error?.message || r.status)); return d.choices[0].message.content;
  }
  throw new Error('Unknown provider: ' + provider);
}

function isRefusal(text) {
  if (!text || typeof text !== 'string') return false;
  const f = text.slice(0, 300).toLowerCase();
  return ['i cannot','i can\'t','i\'m unable','i am unable','against my guidelines','as an ai','content policy'].some(m => f.includes(m));
}

// ═══ INLINED: shared/resolveModel ═══
const HARDCODED_ROUTES = { outline:'gemini-pro', beat_sheet:'gemini-pro', post_gen_rewrite:'claude-sonnet', consistency_check:'claude-sonnet', style_rewrite:'claude-sonnet', chapter_state:'claude-sonnet' };
function resolveModel(callType, spec) {
  if (HARDCODED_ROUTES[callType]) return HARDCODED_ROUTES[callType];
  if (callType === 'explicit_scene') return 'deepseek-chat';
  if (callType === 'sfw_prose') return spec?.writing_model || spec?.ai_model || 'claude-sonnet';
  return 'claude-sonnet';
}

// ═══ RETRY HELPER for SDK rate limits ═══
async function withRetry(fn, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); } catch (err) {
      const is429 = err.message?.includes('429') || err.message?.includes('Rate limit') || err.message?.includes('rate limit');
      if (is429 && i < retries) {
        const delay = (i + 1) * 10000;
        console.warn(`SDK rate limited, retry ${i + 1}/${retries} in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

// ═══ INLINED: shared/dataLoader ═══
async function resolveContent(content) {
  if (!content) return '';
  if (typeof content === 'string' && (content.startsWith('http://') || content.startsWith('https://'))) {
    try { const r = await fetch(content); if (!r.ok) return ''; const t = await r.text(); if (t.trim().startsWith('<')) return ''; return t; } catch { return ''; }
  }
  return content;
}

async function loadProjectContext(base44, projectId) {
  let chapters = [], specs = [], outlines = [], projects = [];
  [chapters, specs, outlines, projects] = await Promise.all([
    withRetry(() => base44.entities.Chapter.filter({ project_id: projectId })),
    withRetry(() => base44.entities.Specification.filter({ project_id: projectId })),
    withRetry(() => base44.entities.Outline.filter({ project_id: projectId })),
    withRetry(() => base44.entities.Project.filter({ id: projectId })).catch(() => []),
  ]);
  const project = projects[0] || {};
  const rawSpec = specs[0];
  const outline = outlines[0];
  const spec = rawSpec ? { ...rawSpec, beat_style: rawSpec.beat_style || rawSpec.tone_style || "", spice_level: Math.max(0, Math.min(4, parseInt(rawSpec.spice_level) || 0)), language_intensity: Math.max(0, Math.min(4, parseInt(rawSpec.language_intensity) || 0)) } : null;
  let outlineData = null;
  let outlineRaw = outline?.outline_data || '';
  if (!outlineRaw && outline?.outline_url) { try { outlineRaw = await (await fetch(outline.outline_url)).text(); } catch {} }
  try { outlineData = outlineRaw ? JSON.parse(outlineRaw) : null; } catch {}
  let storyBible = null;
  let bibleRaw = outline?.story_bible || '';
  if (!bibleRaw && outline?.story_bible_url) { try { bibleRaw = await (await fetch(outline.story_bible_url)).text(); } catch {} }
  try { storyBible = bibleRaw ? JSON.parse(bibleRaw) : null; } catch {}
  chapters.sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
  let nameRegistry = {};
  if (project.name_registry) { let nrRaw = project.name_registry; if (typeof nrRaw === 'string' && nrRaw.startsWith('http')) { try { nrRaw = await (await fetch(nrRaw)).text(); } catch { nrRaw = '{}'; } } try { nameRegistry = JSON.parse(nrRaw); } catch {} }
  return { project, chapters, spec, outline, outlineData, storyBible, nameRegistry, totalChapters: chapters.length, isNonfiction: spec?.book_type === 'nonfiction', isFiction: spec?.book_type !== 'nonfiction', isErotica: /erotica|erotic/.test(((spec?.genre || '') + ' ' + (spec?.subgenre || '')).toLowerCase()) };
}

function getChapterContext(ctx, chapterId) {
  const chapter = ctx.chapters.find(c => c.id === chapterId);
  if (!chapter) throw new Error('Chapter not found: ' + chapterId);
  const chapterIndex = ctx.chapters.findIndex(c => c.id === chapterId);
  const prevChapter = chapterIndex > 0 ? ctx.chapters[chapterIndex - 1] : null;
  const nextChapter = chapterIndex < ctx.chapters.length - 1 ? ctx.chapters[chapterIndex + 1] : null;
  const outlineChapters = ctx.outlineData?.chapters || [];
  const outlineEntry = outlineChapters.find(c => (c.number || c.chapter_number) === chapter.chapter_number) || {};
  const previousChapters = ctx.chapters.slice(0, chapterIndex).filter(c => c.content && c.status === 'generated');
  let lastStateDoc = null;
  for (let i = chapterIndex - 1; i >= 0; i--) { if (ctx.chapters[i].state_document) { lastStateDoc = ctx.chapters[i].state_document; break; } }
  return { chapter, chapterIndex, prevChapter, nextChapter, outlineEntry, previousChapters, lastStateDoc };
}

// ═══ REGEX-BASED CHECKS ═══

function checkPronounConsistency(text, characters) {
  const violations = [];
  const genderMap = {};
  for (const char of characters) {
    if (!char.name) continue;
    const p = char.pronouns ? char.pronouns.toLowerCase() : (/\bshe\b|\bgirl\b|\bwoman\b/i.test(char.description || '') ? 'she' : 'he');
    genderMap[char.name] = p.includes('she') ? 'she' : p.includes('they') ? 'they' : 'he';
  }
  for (const [charName, expected] of Object.entries(genderMap)) {
    const rx = new RegExp(`\\b${charName}\\b[^.!?]*?(he|she|they)\\b`, 'gi');
    const mentions = [...text.matchAll(rx)];
    if (mentions.length > 2) {
      const pronounsUsed = new Set(mentions.map(m => m[1].toLowerCase()));
      if (pronounsUsed.size > 1) {
        violations.push({ type: 'pronoun_mismatch', severity: 'critical', character: charName, description: `Uses ${[...pronounsUsed].join('/')} but should be ${expected}`, location: mentions[0][0].slice(0, 50) });
      }
    }
  }
  return violations;
}

function checkCompositeFigureFraming(text, chNum, storyBible) {
  const violations = [];
  const chars = storyBible?.characters || [];
  const triggers = [];
  for (const c of chars) {
    if (/composite|amalgam|representative|drawn from|reconstructed/i.test((c.description || '') + ' ' + (c.role || ''))) triggers.push(c.name);
  }
  for (const name of triggers) {
    if (!text.includes(name)) continue;
    if (!/composite|represents|drawn from|based on records|reconstructed from/i.test(text)) {
      violations.push({ type: 'composite_unframed', severity: 'warning', character: name, description: `Composite character "${name}" in Ch ${chNum} — needs disclosure`, location: text.slice(text.indexOf(name), text.indexOf(name) + 60) });
    }
  }
  return violations;
}

function checkActTransition(text, lastStateDoc, chapterNumber) {
  if (!lastStateDoc) return [];
  const violations = [];
  const namePattern = /\b([A-Z][a-z]{2,})\b(?=.*(?:location|state|condition|position|status))/g;
  const bridgeNames = [...lastStateDoc.matchAll(namePattern)].map(m => m[1]);
  const openingWords = text.slice(0, 3000);
  const anyNamePresent = bridgeNames.some(name => openingWords.includes(name));
  if (bridgeNames.length > 0 && !anyNamePresent) {
    violations.push({ type: 'act_transition_break', severity: 'warning', character: bridgeNames.slice(0, 3).join(', '), description: `Chapter ${chapterNumber} opening doesn't reflect prior state`, location: openingWords.slice(0, 80) });
  }
  return violations;
}

function checkCapabilities(text, storyBible) {
  const violations = [];
  const chars = storyBible?.characters || [];
  for (const c of chars) {
    if (!c.capabilities_under_pressure || !c.name) continue;
    const cap = c.capabilities_under_pressure;
    if (cap.combat_training === 'None' || cap.combat_training === 'none') {
      const combatRx = new RegExp(`\\b${c.name}\\b[^.!?]{0,100}\\b(punched|kicked|fought|struck|slashed|blocked|dodged|parried|disarmed)\\b`, 'gi');
      const matches = [...text.matchAll(combatRx)];
      if (matches.length > 0) {
        violations.push({ type: 'capability_exceeded', severity: 'warning', character: c.name, description: `${c.name} (combat: None) appears to perform combat`, location: matches[0][0].slice(0, 80) });
      }
    }
  }
  return violations;
}

// ═══ NON-HUMAN PHYSIOLOGY CHECK ═══

function checkNonHumanPhysiologyActiveUse(text, storyBible, spec) {
  const violations = [];
  const spiceLevel = parseInt(spec?.spice_level) || 0;
  if (spiceLevel < 3) return violations;

  const nhKeywords = /alien|creature|dragon|vampire|werewolf|fae|demon|shifter|monster|serpent|reptil|hybrid|non.?human|xeno|orc|naga|lamia|symbiote|mer(man|maid|folk)|drakmori|scaled/i;
  const chars = storyBible?.characters || [];
  const nhChars = chars.filter(c => nhKeywords.test((c.description || '') + ' ' + (c.role || '')));
  if (nhChars.length === 0) return violations;

  const intimateIndicators = /\b(kiss|thrust|moan|gasp|naked|undress|arousal|orgasm|climax|intimate|bed|sheets|skin to skin|straddl|penetrat|tongue|lips on|mouth on)\b/gi;
  const intimateMatches = text.match(intimateIndicators) || [];
  if (intimateMatches.length < 3) return violations;

  const activeTraitPatterns = [
    /scales?\s+(against|on|pressed|dragg|slid|scraped|brushed|grazed|rubbed)/gi,
    /claws?\s+(traced|dragged|scraped|pressed|dug|raked|gripped|hooked)/gi,
    /\b(forked|split)\s+tongue/gi,
    /temperature\s+(difference|contrast|shift)/gi,
    /(cool|cold|hot|warm)\s+scales?\s+(against|on|pressed)/gi,
    /\btail\b.{0,40}(wrapped|curled|stroked|pressed|squeezed|coiled)/gi,
    /bioluminescen/gi,
    /purr(ed|ing)?\s+(through|vibrat|against|into)/gi,
  ];

  let activeTraitCount = 0;
  for (const rx of activeTraitPatterns) {
    if (rx.test(text)) activeTraitCount++;
    rx.lastIndex = 0;
  }

  if (activeTraitCount < 3) {
    violations.push({
      type: 'nh_physiology_decorative',
      severity: 'critical',
      character: nhChars.map(c => c.name).join(', '),
      description: `Intimate scene has only ${activeTraitCount}/3 required active non-human physical traits. Species-specific physiology must be FELT, not just SEEN.`,
      location: 'Full chapter intimate scene',
    });
  }

  return violations;
}

// ═══ NONFICTION SOURCE INTEGRITY ═══

function checkNonfictionSourceIntegrity(text, ctx) {
  if (!ctx.isNonfiction) return [];
  const violations = [];

  // 1. Detect invented specifics: hyper-precise times without sourcing
  const preciseTimeRx = /\b(\d{1,2}:\d{2}\s*(?:AM|PM|a\.m\.|p\.m\.))\b/gi;
  const timeMatches = [...text.matchAll(preciseTimeRx)];
  for (const m of timeMatches) {
    // Check if nearby text has a source anchor
    const start = Math.max(0, m.index - 200);
    const end = Math.min(text.length, m.index + 200);
    const nearby = text.slice(start, end);
    const hasSource = /(?:according to|records show|testimony|court|document|report|log|dispatch|noted|stated|wrote|published)/i.test(nearby);
    if (!hasSource) {
      violations.push({
        type: 'unsourced_specific',
        severity: 'warning',
        character: null,
        description: `Precise time "${m[0]}" appears without source attribution. In documentary nonfiction, specific times must be anchored to records, testimony, or published accounts. Use [VERIFY: source needed] if unsourced.`,
        location: text.slice(m.index, m.index + 80),
        suggested_fix: `Add source: "According to [source], it was ${m[0]}..." or replace with approximate: "in the early hours" / "that afternoon"`,
      });
    }
  }

  // 2. Detect invented dollar amounts with suspicious precision
  const dollarRx = /\$[\d,]+(?:\.\d{2})?|\b(?:forty-seven|sixty-three|twenty-eight|thirty-four|eighty-nine|ninety-one)\s+(?:dollars|cents|thousand|million)\b/gi;
  const dollarMatches = [...text.matchAll(dollarRx)];
  for (const m of dollarMatches) {
    const start = Math.max(0, m.index - 200);
    const end = Math.min(text.length, m.index + 200);
    const nearby = text.slice(start, end);
    const hasSource = /(?:according to|records|contract|ledger|invoice|receipt|budget|financial|audit|court|filing|reported|valued|assessed|appraised)/i.test(nearby);
    if (!hasSource) {
      violations.push({
        type: 'unsourced_specific',
        severity: 'warning',
        character: null,
        description: `Specific dollar amount "${m[0]}" appears without source attribution. Anchor to financial records, contracts, or published accounts.`,
        location: text.slice(m.index, m.index + 80),
        suggested_fix: `Add source: "According to [financial record/contract], the amount was ${m[0]}..." or use [VERIFY: source needed]`,
      });
    }
  }

  // 3. Detect invented dialogue (quoted speech without attribution context)
  const dialogueRx = /"([^"]{15,120})"/g;
  const dialogueMatches = [...text.matchAll(dialogueRx)];
  let unanchoredDialogueCount = 0;
  for (const m of dialogueMatches) {
    const start = Math.max(0, m.index - 300);
    const end = Math.min(text.length, m.index + m[0].length + 200);
    const nearby = text.slice(start, end);
    // Check for source anchoring near the quote
    const hasSource = /(?:wrote|testified|told|said in|recalled|remembered|stated|according to|interview|deposition|memoir|autobiography|biography|letter|diary|journal|transcript|recording|published|article|reported|book)/i.test(nearby);
    if (!hasSource) unanchoredDialogueCount++;
  }
  if (unanchoredDialogueCount > 3) {
    violations.push({
      type: 'unsourced_dialogue',
      severity: 'critical',
      character: null,
      description: `${unanchoredDialogueCount} quoted dialogue passages without source attribution. In documentary nonfiction, dialogue must come from documented records: interviews, depositions, memoirs, letters, or published accounts. Do NOT invent dialogue.`,
      location: dialogueMatches[0] ? text.slice(dialogueMatches[0].index, dialogueMatches[0].index + 80) : '',
      suggested_fix: `Anchor each quote to a source: "...he told [publication]" / "...she wrote in her memoir" / "...according to court testimony". If no source exists, convert to indirect speech or paraphrase.`,
    });
  }

  // 4. Detect unnamed composites presented as real individuals
  const compositeRx = /\b(?:a young (?:actress|woman|man|girl|boy|worker|employee|secretary|dancer|singer)|an unnamed (?:source|witness|actress|woman)|a studio (?:girl|secretary|worker))\b[^.!?]{10,150}(?:walked|entered|sat|stood|said|whispered|looked|felt|thought|wondered|remembered)/gi;
  const compositeMatches = [...text.matchAll(compositeRx)];
  for (const m of compositeMatches) {
    const nearby = text.slice(Math.max(0, m.index - 100), Math.min(text.length, m.index + m[0].length + 100));
    const hasFraming = /(?:composite|representative|typical|contemporary accounts|records suggest|common pattern|historians note|based on)/i.test(nearby);
    if (!hasFraming) {
      violations.push({
        type: 'unnamed_composite',
        severity: 'critical',
        character: null,
        description: `Unnamed composite character doing specific actions: "${m[0].slice(0, 80)}..." — this is fiction, not nonfiction. Either name a documented individual with source, label as atmospheric reconstruction ("Contemporary accounts describe..."), or remove.`,
        location: text.slice(m.index, m.index + 100),
        suggested_fix: `Replace with a named, documented individual OR frame as reconstruction: "Contemporary accounts describe a pattern where..." / "Records from the period suggest..."`,
      });
    }
  }

  // 5. Detect atmospheric reconstruction without proper framing
  const atmosphericRx = /\b(?:the (?:sun|moonlight|shadows|smoke|dust|rain|fog|mist|wind)\s+(?:fell|drifted|crept|hung|filtered|played|danced|settled)(?:[^.!?]{5,80}))|(?:(?:somewhere|outside|above|below|across the street)\s+[^.!?]{5,60}(?:hummed|buzzed|rattled|rumbled|echoed|whispered))/gi;
  // Only flag if there's a LOT of it (some is fine)
  const atmosphericMatches = [...text.matchAll(atmosphericRx)];
  if (atmosphericMatches.length > 8) {
    violations.push({
      type: 'excessive_atmosphere',
      severity: 'warning',
      character: null,
      description: `${atmosphericMatches.length} atmospheric/sensory reconstruction passages detected. Some is permitted but excessive atmospheric detail without sourcing risks crossing into fiction. Frame reconstructions: "Contemporary accounts describe..." or "According to period sources..."`,
      location: atmosphericMatches[0] ? text.slice(atmosphericMatches[0].index, atmosphericMatches[0].index + 80) : '',
      suggested_fix: `Reduce atmospheric passages by ~50% or anchor them to period sources. Prioritize documented events over sensory invention.`,
    });
  }

  return violations;
}

// ═══ NONFICTION SUBJECT DEDUPLICATION ═══

function checkNonfictionSubjectOverlap(text, ctx, chCtx) {
  if (!ctx.isNonfiction) return [];
  const violations = [];
  const { chapter } = chCtx;
  const chNum = chapter.chapter_number;
  const outlineChapters = ctx.outlineData?.chapters || [];

  // Build a map of each chapter's primary subject from outline
  const chapterSubjects = {};
  for (const oc of outlineChapters) {
    const num = oc.number || oc.chapter_number;
    if (!num) continue;
    // Extract primary subject from title + summary
    const subjectText = ((oc.title || '') + ' ' + (oc.summary || '')).toLowerCase();
    chapterSubjects[num] = { title: oc.title || '', summary: oc.summary || '', subjectText };
  }

  // Also check the project's chapter_subjects_log if available
  const subjectsLog = ctx.project?.chapter_subjects_log || '';
  const logEntries = subjectsLog.split('\n').filter(l => l.trim());

  // Extract prominent proper nouns from the current chapter's prose (first 8000 chars)
  const proseSlice = text.slice(0, 8000);
  const properNounRx = /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2})\b/g;
  const nounCounts = {};
  let match;
  while ((match = properNounRx.exec(proseSlice)) !== null) {
    const name = match[1];
    // Skip common sentence-start words
    if (/^(The|This|That|These|Those|When|Where|What|While|After|Before|During|Between|Through|Their|There|Here|Most|Some|Many|Each|Every|However|Although|Because|Since|Until|About|According)$/.test(name)) continue;
    nounCounts[name] = (nounCounts[name] || 0) + 1;
  }

  // Find the top mentioned proper nouns (likely primary subjects)
  const topNouns = Object.entries(nounCounts)
    .filter(([, count]) => count >= 5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  // Cross-reference: check if any top noun is the primary subject of a DIFFERENT chapter
  for (const noun of topNouns) {
    const nounLower = noun.toLowerCase();
    for (const [numStr, data] of Object.entries(chapterSubjects)) {
      const otherNum = parseInt(numStr);
      if (otherNum === chNum) continue;

      // Check if this noun appears prominently in another chapter's title/summary
      const inTitle = data.title.toLowerCase().includes(nounLower);
      const inSummary = data.subjectText.includes(nounLower);

      if (inTitle) {
        // This person/subject has a DEDICATED chapter (appears in title)
        const mentionCount = nounCounts[noun] || 0;
        if (mentionCount > 15) {
          violations.push({
            type: 'subject_overlap',
            severity: 'critical',
            character: noun,
            description: `SUBJECT OVERLAP: "${noun}" is the primary subject of Ch ${otherNum} ("${data.title}") but appears ${mentionCount} times in Ch ${chNum}. This chapter must cover NEW ground not addressed in Ch ${otherNum}. Mention "${noun}" only in passing (1-2 paragraphs max).`,
            location: proseSlice.slice(proseSlice.indexOf(noun), proseSlice.indexOf(noun) + 80),
            suggested_fix: `Reduce "${noun}" coverage to 1-2 brief paragraphs. Their dedicated chapter is Ch ${otherNum}. Focus this chapter on its own primary subject instead.`,
          });
        } else if (mentionCount > 8) {
          violations.push({
            type: 'subject_cross_ref',
            severity: 'warning',
            character: noun,
            description: `"${noun}" has a dedicated chapter (Ch ${otherNum}: "${data.title}") but appears ${mentionCount} times here. Keep to 1-2 paragraphs max to avoid covering the same biographical ground.`,
            location: proseSlice.slice(proseSlice.indexOf(noun), proseSlice.indexOf(noun) + 80),
            suggested_fix: `Trim "${noun}" references to brief contextual mentions only. Save detailed coverage for Ch ${otherNum}.`,
          });
        }
      }
    }
  }

  // Also check subjects_log for overlap detection
  for (const logLine of logEntries) {
    // Format: [TIME PERIOD] | [PRIMARY SUBJECT] | [LOCATION]
    const parts = logLine.split('|').map(s => s.trim());
    if (parts.length < 2) continue;
    const logSubject = parts[1].toLowerCase();
    const logChNumMatch = logLine.match(/^Ch\s*(\d+)/i);
    if (!logChNumMatch) continue;
    const logChNum = parseInt(logChNumMatch[1]);
    if (logChNum === chNum) continue;

    // Check if current chapter's title/summary overlaps with a logged subject
    const currentSubject = chapterSubjects[chNum];
    if (currentSubject) {
      const currentText = currentSubject.subjectText;
      // Check for significant word overlap (not just single common words)
      const logWords = logSubject.split(/\s+/).filter(w => w.length > 3);
      const matchingWords = logWords.filter(w => currentText.includes(w));
      if (matchingWords.length >= 2) {
        violations.push({
          type: 'subject_overlap',
          severity: 'warning',
          character: parts[1],
          description: `Potential thematic overlap: Ch ${chNum} and Ch ${logChNum} may cover similar ground ("${parts[1]}"). Verify chapters address distinct aspects.`,
          location: chapter.title,
          suggested_fix: `Ensure this chapter focuses on a different angle or time period than Ch ${logChNum}.`,
        });
      }
    }
  }

  return violations;
}

// ═══ POV CONSISTENCY CHECK (v6) ═══

function checkPovConsistency(text, spec) {
  const violations = [];
  const povMode = spec?.pov_mode;
  if (!povMode) return violations;
  const sample = text.slice(0, 3000);
  const fullSample = text;
  if (povMode === 'first-person') {
    const firstPersonCount = (sample.match(/\b(I|me|my|myself|I'm|I'd|I've|I'll)\b/g) || []).length;
    const thirdNarration = (sample.match(/\b(he thought|she thought|he felt|she felt|he knew|she knew|he wondered|she wondered)\b/gi) || []).length;
    if (firstPersonCount < 3 && thirdNarration > 2) {
      violations.push({ type: 'pov_drift', severity: 'critical', character: null, description: `POV set to first-person but chapter uses third-person narration (${thirdNarration} instances of "he/she thought/felt/knew"). Rewrite in first person.`, location: sample.slice(0, 80) });
    }
  } else if (povMode === 'third-close' || povMode === 'third-multi') {
    const withoutDialogue = fullSample.replace(/[""\u201C][^""\u201D]*[""\u201D]/g, '').replace(/'[^']*'/g, '');
    const firstPersonNarration = (withoutDialogue.match(/\bI\s+(was|am|had|have|went|thought|felt|knew|saw|heard|could|would|should|walked|stood|sat|ran|looked)\b/g) || []).length;
    if (firstPersonNarration > 3) {
      violations.push({ type: 'pov_drift', severity: 'critical', character: null, description: `POV set to third-person but chapter contains ${firstPersonNarration} first-person narration instances outside dialogue.`, location: 'Multiple locations' });
    }
  } else if (povMode === 'second-person') {
    const secondPersonCount = (sample.match(/\b(you|your|yourself|you're|you've|you'll)\b/g) || []).length;
    if (secondPersonCount < 5) {
      violations.push({ type: 'pov_drift', severity: 'critical', character: null, description: `POV set to second-person but chapter doesn't use "you/your" address (only ${secondPersonCount} instances).`, location: sample.slice(0, 80) });
    }
  }
  return violations;
}

// ═══ TENSE CONSISTENCY CHECK (v10 — tightened) ═══

function checkTenseConsistency(text, spec) {
  const violations = [];
  const tense = spec?.tense;
  if (!tense || tense === 'mixed') return violations;
  // Strip dialogue — tense inside quotes is character voice, not narration
  const withoutDialogue = text.replace(/[""\u201C][^""\u201D]*[""\u201D]/g, '').replace(/'[^']*'/g, '');
  // Scan ALL sentences, not just first 50
  const sentences = withoutDialogue.split(/[.!?]+/).filter(s => s.trim().length > 20);
  if (tense === 'past') {
    let presentCount = 0;
    // Include character names + pronouns — "Lucia stands" is just as wrong as "she stands"
    const presentPatterns = /\b(\w+)\s+(walks|runs|says|thinks|feels|knows|sees|hears|stands|sits|looks|moves|turns|opens|closes|steps|reaches|pulls|pushes|watches|presses|asks|cuts|fills|takes|sets|picks|drops|begins|starts|stops|grabs|holds|catches|lifts|places)\b/gi;
    for (const s of sentences) {
      const matches = s.match(presentPatterns) || [];
      // Filter: only count if the subject is a pronoun or capitalized name (not "the door opens")
      for (const m of matches) {
        const subj = m.split(/\s+/)[0];
        if (/^(he|she|they|it|I|we)$/i.test(subj) || /^[A-Z]/.test(subj)) presentCount++;
      }
    }
    if (presentCount > 3) {
      violations.push({ type: 'tense_drift', severity: 'critical', character: null, description: `TENSE DRIFT: Project tense is PAST but chapter has ${presentCount} present-tense narrative verbs. The proseWriter MUST rewrite all narration in past tense. Present tense is ONLY acceptable inside direct dialogue quotes.`, location: 'Multiple locations' });
    }
  } else if (tense === 'present') {
    let pastCount = 0;
    const pastPatterns = /\b(\w+)\s+(walked|ran|said|thought|felt|knew|saw|heard|stood|sat|looked|moved|turned|opened|closed|stepped|reached|pulled|pushed|watched|pressed|asked|cut|filled|took|set|picked|dropped|began|started|stopped|grabbed|held|caught|lifted|placed)\b/gi;
    for (const s of sentences) {
      const matches = s.match(pastPatterns) || [];
      for (const m of matches) {
        const subj = m.split(/\s+/)[0];
        if (/^(he|she|they|it|I|we)$/i.test(subj) || /^[A-Z]/.test(subj)) pastCount++;
      }
    }
    if (pastCount > 3) {
      violations.push({ type: 'tense_drift', severity: 'critical', character: null, description: `TENSE DRIFT: Project tense is PRESENT but chapter has ${pastCount} past-tense narrative verbs. The proseWriter MUST rewrite all narration in present tense. Past tense is ONLY acceptable in flashback passages.`, location: 'Multiple locations' });
    }
  }
  return violations;
}

// ═══ CHARACTER NAME USAGE CHECK (v6) ═══

function checkCharacterNameUsage(text, characters) {
  const violations = [];
  if (!characters || characters.length === 0) return violations;
  const CLINICAL_DESCRIPTORS = ['the human', 'the programmer', 'the man', 'the woman', 'the subject', 'the candidate', 'the creature', 'the being', 'the entity', 'the alien', 'the stranger', 'the figure'];
  for (const descriptor of CLINICAL_DESCRIPTORS) {
    const rx = new RegExp(descriptor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const count = (text.match(rx) || []).length;
    if (count > 3) {
      violations.push({ type: 'name_avoidance', severity: 'warning', character: null, description: `"${descriptor}" used ${count}x — use character names for reader intimacy.`, location: descriptor });
    }
  }
  return violations;
}

// ═══ MULTI-CHARACTER NAME CLARITY CHECK (v6) ═══

function checkMultiCharacterNameClarity(text, characters) {
  const violations = [];
  if (!characters || characters.length < 2) return violations;

  // Determine if any characters share pronouns (same-gender scene)
  const genderMap = {};
  for (const c of characters) {
    const g = (c.gender || c.pronouns || '').toLowerCase();
    const key = /\b(he|him|his|male|man|boy)\b/.test(g) ? 'male' :
                /\b(she|her|hers|female|woman|girl)\b/.test(g) ? 'female' :
                /\b(they|them|theirs|nonbinary|nb|enby)\b/.test(g) ? 'nb' : 'unknown';
    if (!genderMap[key]) genderMap[key] = [];
    genderMap[key].push(c.name);
  }
  const hasSameGenderPair = Object.values(genderMap).some(arr => arr.length >= 2);
  const namelessThreshold = hasSameGenderPair ? 2 : 3;

  // Detect intimate scene sections (rough heuristic)
  const intimateMarkers = /\b(cock|cunt|nipple|thrust|moan|orgasm|climax|naked|erect|penetrat|straddl|undress|kiss(?:ed|ing)?.*(?:deep|hard|fierce)|fuck|suck|lick|grind)\b/i;

  const scenes = text.split(/\*\s*\*\s*\*/);
  for (let si = 0; si < scenes.length; si++) {
    const scene = scenes[si];
    const isIntimate = intimateMarkers.test(scene);
    const presentChars = characters.filter(c => c.name && scene.includes(c.name));
    if (presentChars.length < 2) continue;

    // Check if present characters share pronouns
    const presentGenders = presentChars.map(c => {
      const g = (c.gender || c.pronouns || '').toLowerCase();
      return /\b(he|him|his|male|man|boy)\b/.test(g) ? 'male' :
             /\b(she|her|hers|female|woman|girl)\b/.test(g) ? 'female' : 'other';
    });
    const sceneHasSameGender = presentGenders.filter(g => g !== 'other').some((g, i, arr) => arr.indexOf(g) !== i);
    const threshold = sceneHasSameGender ? 2 : namelessThreshold;

    const paras = scene.split(/\n\n+/).filter(p => p.trim().length > 30);
    let namelessStreak = 0;
    for (const para of paras) {
      const hasAnyName = presentChars.some(c => para.includes(c.name));
      if (hasAnyName) { namelessStreak = 0; } else {
        namelessStreak++;
        if (namelessStreak >= threshold) {
          const pronounCount = (para.match(/\b(he|she|they|him|her|them|his|their)\b/gi) || []).length;
          if (pronounCount >= 2) {
            const severity = (sceneHasSameGender && isIntimate) ? 'critical' : 'warning';
            violations.push({ type: 'name_ambiguity', severity, character: presentChars.map(c => c.name).join(' & '), description: `Scene ${si + 1}: ${namelessStreak} consecutive paragraphs without character names while ${presentChars.length} characters are present${sceneHasSameGender ? ' (SAME-GENDER SCENE — pronouns are ambiguous)' : ''}${isIntimate ? ' during an intimate scene' : ''}. Use character NAMES to clarify who is acting, touching, and speaking.`, location: para.slice(0, 60) });
            break;
          }
        }
      }
    }
  }
  return violations;
}

// ═══ AI-POWERED DEEP CHECK ═══

async function runAIConsistencyCheck(text, ctx, chCtx) {
  const { storyBible } = ctx;
  const { chapter, outlineEntry, lastStateDoc } = chCtx;
  const characters = storyBible?.characters || [];
  const charSummary = characters.map(c => `- ${c.name}: ${c.role || 'unknown'}, ${c.description || 'no desc'}. Pronouns: ${c.pronouns || 'not set'}`).join('\n');
  const outlineSummary = outlineEntry ? `Title: "${outlineEntry.title || chapter.title}"\nKey events: ${JSON.stringify(outlineEntry.key_events || outlineEntry.key_beats || [])}\nSummary: ${outlineEntry.summary || 'N/A'}` : 'No outline entry';
  const modelKey = resolveModel('consistency_check', ctx.spec);

  const nonfictionSourceRules = ctx.isNonfiction ? `

DOCUMENTARY NONFICTION SOURCE REQUIREMENTS (apply these STRICTLY):
- Every factual claim must be anchored to at least ONE of: a specific document with date, a named person's testimony, a court case with ruling name, a published work with author/year, or a specific dated event
- Flag any unanchored claims as: "unsourced_claim" severity "warning"
- Flag invented specifics (precise times like "3:47 AM", exact dollar amounts, specific dialogue) without documented sources as: "fabricated_detail" severity "critical"
- Flag unnamed composite characters doing specific things ("A young actress walked into...") as: "unnamed_composite" severity "critical" — this is fiction, not nonfiction
- Atmospheric reconstruction is ONLY permitted when labeled: "Contemporary accounts describe..." or "Records from the period suggest..."
- If a person mentioned has a dedicated chapter later in the outline, flag extensive coverage (more than 1-2 paragraphs) as: "subject_encroachment" severity "warning"` : '';

  const systemPrompt = `You are a manuscript continuity checker. Read the chapter and compare it against the verification document. List every contradiction, missing element, or continuity error.${nonfictionSourceRules}\n\nOutput ONLY a JSON array of violations. If no violations, return an empty array [].\n\nEach violation object:\n{\n  "type": "pronoun_mismatch|character_missing|timeline_break|backstory_contradiction|allegiance_unacknowledged|dead_character_appears|plot_deviation|unsourced_claim|fabricated_detail|unnamed_composite|subject_encroachment",\n  "severity": "critical|warning",\n  "character": "affected character name or null",\n  "description": "what's wrong",\n  "location": "first ~50 chars of the offending passage",\n  "suggested_fix": "how to fix it"\n}`;

  const userMessage = `VERIFICATION DOCUMENT:\n\nCHARACTERS:\n${charSummary || 'No characters defined'}\n\nOUTLINE FOR THIS CHAPTER:\n${outlineSummary}\n\n${lastStateDoc ? `PREVIOUS CHAPTER STATE:\n${lastStateDoc}\n` : ''}\n\nCHAPTER ${chapter.chapter_number}: "${chapter.title}"\n${text.slice(0, 12000)}`;

  try {
    const raw = await callAI(modelKey, systemPrompt, userMessage, { maxTokens: 2048, temperature: 0.2 });
    if (isRefusal(raw)) return [];
    try {
      const parsed = JSON.parse(raw.replace(/^```json\n?/, '').replace(/\n?```$/, ''));
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  } catch (err) {
    console.warn('AI consistency check failed (non-blocking):', err.message);
    return [];
  }
}

// ═══ MAIN BOT ═══

async function runContinuityGuardian(base44, projectId, chapterId, rawProse) {
  const startMs = Date.now();
  const ctx = await loadProjectContext(base44, projectId);
  const chCtx = getChapterContext(ctx, chapterId);
  const characters = ctx.storyBible?.characters || [];
  const text = rawProse || await resolveContent(chCtx.chapter.content);
  if (!text || text.length < 100) {
    return { passed: true, violations: [], suggested_fixes: [], chapter_id: chapterId, duration_ms: Date.now() - startMs };
  }

  const allViolations = [
    ...checkPronounConsistency(text, characters),
    ...checkCompositeFigureFraming(text, chCtx.chapter.chapter_number, ctx.storyBible),
    ...checkActTransition(text, chCtx.lastStateDoc, chCtx.chapter.chapter_number),
    ...checkCapabilities(text, ctx.storyBible),
    ...checkNonHumanPhysiologyActiveUse(text, ctx.storyBible, ctx.spec),
    ...checkNonfictionSubjectOverlap(text, ctx, chCtx),
    ...checkNonfictionSourceIntegrity(text, ctx),
    ...checkPovConsistency(text, ctx.spec),
    ...checkTenseConsistency(text, ctx.spec),
    ...checkCharacterNameUsage(text, characters),
    ...checkMultiCharacterNameClarity(text, characters),
  ];

  const aiViolations = await runAIConsistencyCheck(text, ctx, chCtx);
  for (const v of aiViolations) {
    const isDupe = allViolations.some(existing => existing.type === v.type && existing.character === v.character);
    if (!isDupe) allViolations.push(v);
  }

  const suggestedFixes = aiViolations
    .filter(v => v.suggested_fix)
    .map((v) => ({
      violation_index: allViolations.findIndex(av => av.description === v.description),
      original_text: v.location || '',
      replacement_text: v.suggested_fix,
      confidence: v.severity === 'critical' ? 'high' : 'medium',
    }));

  const hasCritical = allViolations.some(v => v.severity === 'critical');
  return { passed: !hasCritical, violations: allViolations, suggested_fixes: suggestedFixes, chapter_id: chapterId, duration_ms: Date.now() - startMs };
}

// ═══ DENO SERVE ═══

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, chapter_id, raw_prose } = await req.json();
    if (!project_id || !chapter_id) return Response.json({ error: 'project_id and chapter_id required' }, { status: 400 });

    const result = await runContinuityGuardian(base44, project_id, chapter_id, raw_prose);
    return Response.json(result);
  } catch (error) {
    console.error('continuityGuardian error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});