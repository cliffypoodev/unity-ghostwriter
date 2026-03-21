// ═══════════════════════════════════════════════════════════════════════════════
// BOT — TARGETED REWRITE (v3 — handles content with no paragraph breaks)
// ═══════════════════════════════════════════════════════════════════════════════

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ═══ AI ROUTER ═══

async function callAI(systemPrompt, userMessage) {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set');
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: userMessage }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.3, maxOutputTokens: 16384 }
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error('Gemini: ' + (d.error?.message || r.status));
  if (!d?.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error('Gemini empty response');
  return d.candidates[0].content.parts[0].text;
}

// ═══ TEXT SEGMENTATION ═══
// Split prose into workable segments. Handles: \n\n paragraphs, \n lines, or
// no-break continuous text (splits on sentence boundaries in ~500-word chunks).

function segmentProse(prose) {
  // Try double newlines first
  if (/\n\n/.test(prose)) {
    const segs = prose.split(/\n\n+/);
    if (segs.length > 1 && segs.every(s => s.length < 15000)) {
      return { segments: segs, joiner: '\n\n' };
    }
  }
  // Try single newlines
  if (/\n/.test(prose)) {
    const segs = prose.split(/\n/);
    if (segs.length > 1 && segs.every(s => s.length < 15000)) {
      return { segments: segs, joiner: '\n' };
    }
  }
  // No usable breaks — split on sentence boundaries into ~2000 char chunks
  // This preserves sentence integrity while creating manageable segments
  const sentences = prose.split(/(?<=[.!?])\s+/);
  const segments = [];
  let current = '';
  for (const sent of sentences) {
    if (current.length + sent.length > 2000 && current.length > 0) {
      segments.push(current.trim());
      current = sent;
    } else {
      current += (current ? ' ' : '') + sent;
    }
  }
  if (current.trim()) segments.push(current.trim());
  return { segments, joiner: ' ' };
}

// ═══ ISSUE EXTRACTION ═══

function extractIssueContext(prose, findings) {
  const tasks = [];
  const { segments } = segmentProse(prose);

  for (const f of findings) {
    if (f.category === 'interiority_repetition') {
      const wordMatch = f.label.match(/"([^"]+)"/);
      if (!wordMatch) continue;
      const word = wordMatch[1].toLowerCase();
      const capMatch = f.label.match(/cap:\s*(\d+)/);
      const cap = capMatch ? parseInt(capMatch[1]) : 1;
      const countMatch = f.label.match(/x(\d+)/);
      const total = countMatch ? parseInt(countMatch[1]) : 0;
      const excess = Math.max(0, total - cap);
      if (excess <= 0) continue;

      const rx = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      let seen = 0;
      for (let i = 0; i < segments.length; i++) {
        const matches = segments[i].match(rx);
        if (matches) {
          for (const m of matches) {
            seen++;
            if (seen > cap) {
              tasks.push({
                type: 'interiority',
                segIndex: i,
                word: word,
                instruction: `Replace "${word}" with a contextually appropriate synonym. Do NOT use: ${word}. Keep the sentence meaning identical.`,
              });
              break;
            }
          }
        }
      }
    }

    if (f.category === 'sensory_opener') {
      tasks.push({
        type: 'sensory_opener',
        segIndex: 0,
        instruction: 'Rewrite this opening to start with dialogue, action, or a thought — NOT a sensory/atmospheric description. Keep the same content and meaning, just change the opening approach.',
      });
    }

    if (f.category === 'tense_drift') {
      const isPastNarrative = f.label.includes('present-tense verbs in past');
      const driftRx = isPastNarrative
        ? /\b(he|she|they|it|I|we)\s+(walks|runs|says|thinks|feels|knows|sees|hears|stands|sits|looks|moves|turns|opens|closes|steps|reaches|pulls|pushes|watches|presses|asks)\b/gi
        : /\b(he|she|they|it|I|we)\s+(walked|ran|said|thought|felt|knew|saw|heard|stood|sat|looked|moved|turned|opened|closed|stepped|reached|pulled|pushed|watched|pressed|asked)\b/gi;

      for (let i = 0; i < segments.length; i++) {
        if (driftRx.test(segments[i])) {
          driftRx.lastIndex = 0;
          tasks.push({
            type: 'tense_fix',
            segIndex: i,
            instruction: isPastNarrative
              ? 'Fix tense: convert present-tense verbs to past tense. This is a past-tense narrative.'
              : 'Fix tense: convert past-tense verbs to present tense. This is a present-tense narrative.',
          });
        }
      }
    }

    if (f.category === 'philosophical_ending') {
      tasks.push({
        type: 'philosophical_ending',
        segIndex: segments.length - 1,
        instruction: 'Rewrite this final segment. Remove any philosophical platitude, moralizing summary, or "the lesson is..." statement. End with concrete action, image, or dialogue instead.',
      });
    }

    if (f.category === 'the_noun_opener') {
      // Find segments with 4+ "The [Noun] [verb]" sentences
      for (let i = 0; i < segments.length; i++) {
        const sents = segments[i].split(/(?<=[.!?])\s+/);
        let theCount = 0;
        for (const s of sents) {
          if (/^The\s+[A-Z][a-z]+\s+(was|were|had|could|would|seemed|appeared|began|continued|remained|stood|sat|lay|hung|felt|looked|moved|turned|came|went|made|took|gave|got|ran|saw|knew|found|thought)\b/.test(s.trim())) {
            theCount++;
          }
        }
        if (theCount >= 4) {
          tasks.push({
            type: 'the_noun_opener',
            segIndex: i,
            instruction: `This segment has ${theCount} sentences starting with "The [Noun] [verb]" pattern. Vary at least half of them: use a character name, pronoun, action, dialogue, or subordinate clause as the opener instead. Keep the same meaning.`,
          });
        }
      }
    }

    if (f.category === 'fiction_cliche') {
      const clicheRxList = [
        /\bLittle did (he|she|they) know\b/gi,
        /\bUnbeknownst to\b/gi,
        /\bA (chill|shiver) (ran|crept|went|traveled) (down|up) (his|her|their) spine\b/gi,
        /\b(He|She|They) let out a breath (he|she|they) didn'?t (know|realize)/gi,
        /\bTime (seemed to|appeared to) (slow|stop|stand still|freeze)\b/gi,
        /\bA (single|lone) tear (rolled|slid|traced|tracked) down\b/gi,
        /\bDarkness (claimed|consumed|swallowed|took) (him|her|them)\b/gi,
      ];
      for (let i = 0; i < segments.length; i++) {
        for (const crx of clicheRxList) {
          crx.lastIndex = 0;
          if (crx.test(segments[i])) {
            tasks.push({
              type: 'fiction_cliche',
              segIndex: i,
              instruction: 'Rewrite the clichéd sentence(s) with original, specific prose. Keep surrounding text unchanged.',
            });
            break;
          }
        }
      }
    }

    if (f.category === 'recap_bloat') {
      const recapRxList = [
        /\bAs (we'?ve?|I'?ve?) (discussed|seen|explored|examined|noted|mentioned|established)\b/gi,
        /\bTo (summarize|recap|sum up|review) (what we'?ve?|the above|our discussion)\b/gi,
        /\bIn (summary|conclusion|closing|short)\b/gi,
      ];
      for (let i = 0; i < segments.length; i++) {
        for (const rrx of recapRxList) {
          rrx.lastIndex = 0;
          if (rrx.test(segments[i])) {
            tasks.push({
              type: 'recap_bloat',
              segIndex: i,
              instruction: 'Remove recap/summary phrases or rewrite without backward-looking framing.',
            });
            break;
          }
        }
      }
    }

    // v14: Formulaic character intros
    if (f.category === 'formulaic_intro') {
      const introRx = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s+a\s+(?:man|woman|figure|person)\s+(?:of|with|whose)\s+\w+\s+\w+/g;
      for (let i = 0; i < segments.length; i++) {
        introRx.lastIndex = 0;
        if (introRx.test(segments[i])) {
          tasks.push({
            type: 'formulaic_intro',
            segIndex: i,
            instruction: 'Rewrite the character introduction. Instead of "[Name], a man/woman of [adj] presence...", introduce them through action, dialogue, or a distinctive detail. Show, don\'t label.',
          });
        }
      }
    }

    // v14: Car opening cliche
    if (f.category === 'car_opening_cliche') {
      tasks.push({
        type: 'car_opening_cliche',
        segIndex: 0,
        instruction: 'Rewrite this opening. Do NOT start with a vehicle arriving/purring/gliding. Start with dialogue, interior thought, a sensory detail from inside the location, or an action already in progress.',
      });
    }

    // v14: Simile/metaphor overload
    if (f.category === 'simile_overload') {
      for (let i = 0; i < segments.length; i++) {
        const likes = (segments[i].match(/\blike\s+(?:a|an|the)\s+\w+/gi) || []).length;
        const asAs = (segments[i].match(/\bas\s+\w+\s+as\b/gi) || []).length;
        if (likes + asAs >= 3) {
          tasks.push({
            type: 'simile_overload',
            segIndex: i,
            instruction: 'This paragraph has too many similes/metaphors. Keep the strongest one. Replace the others with direct, concrete description.',
          });
        }
      }
    }

    // v14: Narrator transition repetition
    if (f.category === 'narrator_repetition') {
      const narrRx = /\bI\s+(investigated|examined|explored|discovered|uncovered|researched|studied|analyzed|delved into|looked into|dug into|pored over|sifted through)\b/gi;
      let narrSeen = 0;
      for (let i = 0; i < segments.length; i++) {
        narrRx.lastIndex = 0;
        if (narrRx.test(segments[i])) {
          narrSeen++;
          if (narrSeen > 2) {
            tasks.push({
              type: 'narrator_repetition',
              segIndex: i,
              instruction: 'Rewrite the "I investigated/examined/explored" transition. Use a different approach: start with the evidence itself, a quote, a date, or a specific detail. Remove the narrator self-reference.',
            });
          }
        }
      }
    }

    // v14: Participle chains
    if (f.category === 'participle_chain') {
      for (let i = 0; i < segments.length; i++) {
        const sents = segments[i].split(/(?<=[.!?])\s+/);
        for (const s of sents) {
          const ings = (s.match(/\b\w+ing\b/g) || []).length;
          if (ings >= 4) {
            tasks.push({
              type: 'participle_chain',
              segIndex: i,
              instruction: 'Break up the -ing participle chain. Use finite verbs instead of participial phrases. E.g. "revealing X, catching Y" → "It revealed X. Y caught..."',
            });
            break;
          }
        }
      }
    }

    // v14: AI sensory defaults
    if (f.category === 'ai_sensory_default') {
      const aiDefRx = [
        /\bdust motes\s+(?:dancing|floating|swirling|drifting|spinning|suspended)\b/gi,
        /\bscent of\s+(?:polished wood|old leather|expensive cigar|cigar smoke|aged paper)\b/gi,
        /\b(?:mahogany|oak|walnut)\s+desk\s+(?:that |which )?(?:dominated|commanded|anchored)\b/gi,
        /\bwindowless\s+cathedral/gi,
        /\b(?:amber|golden|warm)\s+(?:light|glow)\s+(?:spilled|pooled|washed|bathed|filtered)\b/gi,
      ];
      for (let i = 0; i < segments.length; i++) {
        for (const arx of aiDefRx) {
          arx.lastIndex = 0;
          if (arx.test(segments[i])) {
            tasks.push({
              type: 'ai_sensory_default',
              segIndex: i,
              instruction: 'Replace the generic AI sensory description with something specific to THIS scene. What does this particular room/place actually smell/look/sound like? Use a unique, unexpected detail.',
            });
            break;
          }
        }
      }
    }
  }

  return tasks;
}

// ═══ BATCH REWRITE ═══

async function batchRewrite(prose, tasks) {
  if (tasks.length === 0) return prose;

  const { segments, joiner } = segmentProse(prose);

  // Group tasks by segment index
  const tasksBySeg = {};
  for (const t of tasks) {
    if (!tasksBySeg[t.segIndex]) tasksBySeg[t.segIndex] = [];
    tasksBySeg[t.segIndex].push(t);
  }

  const segIndices = Object.keys(tasksBySeg).map(Number).sort((a, b) => a - b);
  if (segIndices.length === 0) return prose;

  // Cap at 8 segments per AI call to avoid token overflow
  const toFix = segIndices.slice(0, 8);

  const systemPrompt = `You are a prose editor. You will receive numbered text segments with specific fix instructions.
For each segment, apply ONLY the requested fix. Do NOT change anything else.
Return the fixed segments in the EXACT format:

[SEG_INDEX]
fixed text here

[SEG_INDEX]
fixed text here

Rules:
- Keep segment length within 15% of original
- Maintain the same voice, tone, and style
- Do NOT add commentary or explanations
- Do NOT change content beyond the specific fix requested
- Return ONLY the fixed segments, nothing else`;

  const parts = [];
  for (const idx of toFix) {
    const seg = segments[idx];
    if (!seg || seg.trim().length < 20) continue;
    // For very large segments, only send the relevant portion with context
    let textToSend = seg;
    if (seg.length > 4000) {
      // Truncate for the AI but we'll do find-replace on the original
      textToSend = seg.slice(0, 4000) + '\n[... remainder of segment ...]';
    }
    const instructions = tasksBySeg[idx].map(t => t.instruction).join('; ');
    parts.push(`[${idx}]\nINSTRUCTION: ${instructions}\nORIGINAL (${seg.length} chars):\n${textToSend}`);
  }

  if (parts.length === 0) return prose;

  let aiResponse;
  try {
    aiResponse = await callAI(systemPrompt, parts.join('\n\n---\n\n'));
  } catch (err) {
    console.warn('AI rewrite failed:', err.message);
    return prose;
  }

  // Parse the AI response — extract [INDEX]\ntext blocks
  const fixedSegs = {};
  const blocks = aiResponse.split(/\[(\d+)\]\s*\n/);
  for (let i = 1; i < blocks.length; i += 2) {
    const idx = parseInt(blocks[i]);
    let text = (blocks[i + 1] || '').trim();
    // Strip markdown code fences if AI added them
    text = text.replace(/^```[\s\S]*?\n/, '').replace(/\n```\s*$/, '').trim();
    if (isNaN(idx) || text.length < 20) continue;
    
    const origLen = (segments[idx] || '').length;
    if (origLen === 0) continue;

    // For segments we truncated, do find-replace instead of full replacement
    if (origLen > 4000 && text.length < origLen * 0.5) {
      // The AI only rewrote the truncated portion — apply as find-replace
      console.log(`Seg ${idx}: AI returned ${text.length} chars for ${origLen} char segment — applying as targeted replacement`);
      const original = segments[idx];
      // Try to match and replace just the beginning portion that was sent
      const originalStart = original.slice(0, 4000);
      if (text.length > 100) {
        // Apply word-level replacements from AI output to original
        segments[idx] = applyTargetedFixes(original, originalStart, text, tasksBySeg[idx]);
        fixedSegs[idx] = true;
      }
    } else if (text.length >= origLen * 0.5 && text.length <= origLen * 2.0) {
      fixedSegs[idx] = text;
    } else {
      console.warn(`Rejected rewrite for seg ${idx}: ${text.length} chars vs original ${origLen} chars`);
    }
  }

  // Apply fixes
  let fixCount = 0;
  for (const [idx, newText] of Object.entries(fixedSegs)) {
    const i = parseInt(idx);
    if (i >= 0 && i < segments.length && typeof newText === 'string') {
      segments[i] = newText;
      fixCount++;
    } else if (newText === true) {
      fixCount++; // already applied in-place above
    }
  }

  console.log(`Targeted rewrite: ${fixCount}/${toFix.length} segments rewritten`);
  return segments.join(joiner);
}

// Apply targeted word-level fixes when the full segment is too large for replacement
function applyTargetedFixes(original, sentSlice, aiRewrite, tasks) {
  let result = original;
  for (const task of tasks) {
    if (task.type === 'interiority' && task.word) {
      // Find what the AI replaced the word with by comparing
      const rx = new RegExp('\\b' + task.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      if (!rx.test(aiRewrite) && rx.test(result)) {
        // AI removed the word — find a synonym from the AI text context
        // Simple approach: replace excess occurrences with common synonyms
        const SYNONYMS = {
          'hollow': ['empty', 'vacant', 'barren', 'desolate'],
          'hollowness': ['emptiness', 'void', 'barrenness'],
          'empty': ['vacant', 'bare', 'devoid', 'barren'],
          'emptiness': ['void', 'absence', 'blankness'],
          'shattered': ['fractured', 'splintered', 'crumbled'],
          'broken': ['damaged', 'fractured', 'ruined'],
          'numb': ['insensate', 'deadened', 'detached'],
          'numbness': ['detachment', 'dissociation', 'blankness'],
          'void': ['absence', 'gap', 'chasm'],
          'ache': ['pang', 'throb', 'sting'],
          'aching': ['throbbing', 'persistent', 'gnawing'],
          'fragile': ['delicate', 'vulnerable', 'tenuous'],
        };
        const alts = SYNONYMS[task.word.toLowerCase()] || ['the feeling', 'the sensation'];
        let replaceCount = 0;
        result = result.replace(rx, (match) => {
          replaceCount++;
          if (replaceCount <= 1) return match; // keep first occurrence
          return alts[(replaceCount - 2) % alts.length];
        });
      }
    }
  }
  return result;
}

// ═══ CONTENT RESOLVER ═══

async function resolveContent(content) {
  if (!content) return '';
  if (typeof content === 'string' && (content.startsWith('http://') || content.startsWith('https://'))) {
    try { const r = await fetch(content); if (!r.ok) return ''; const t = await r.text(); if (t.trim().startsWith('<')) return ''; return t; } catch { return ''; }
  }
  return content;
}

// ═══ MAIN ═══

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, chapter_id, findings } = await req.json();
    if (!project_id || !chapter_id || !findings) {
      return Response.json({ error: 'project_id, chapter_id, and findings required' }, { status: 400 });
    }

    const [chapter] = await base44.entities.Chapter.filter({ id: chapter_id });
    if (!chapter) return Response.json({ error: 'Chapter not found' }, { status: 404 });

    const prose = await resolveContent(chapter.content);
    if (!prose || prose.length < 100) {
      return Response.json({ error: 'No content to rewrite' }, { status: 400 });
    }

    const tasks = extractIssueContext(prose, findings);
    if (tasks.length === 0) {
      return Response.json({ rewritten: false, reason: 'No rewritable issues found', tasks: 0 });
    }

    console.log(`targetedRewrite: Ch ${chapter.chapter_number} — ${tasks.length} tasks from ${findings.length} findings`);

    const rewritten = await batchRewrite(prose, tasks);

    // Safety check
    if (rewritten.length < prose.length * 0.8) {
      console.error(`SAFETY: Rewrite too short (${rewritten.length} vs ${prose.length})`);
      return Response.json({ rewritten: false, reason: 'Safety guard: rewrite too short', tasks: tasks.length });
    }

    // Save
    const encoder = new TextEncoder();
    const bytes = encoder.encode(rewritten);
    const blob = new Blob([bytes], { type: 'text/plain' });
    const file = new File([blob], `chapter_${chapter_id}_rewritten.txt`, { type: 'text/plain' });
    const uploadResult = await base44.integrations.Core.UploadFile({ file });
    if (uploadResult?.file_url) {
      await base44.entities.Chapter.update(chapter_id, {
        content: uploadResult.file_url,
        word_count: rewritten.trim().split(/\s+/).length,
      });
    }

    return Response.json({
      rewritten: true,
      tasks: tasks.length,
      paragraphs_affected: [...new Set(tasks.map(t => t.segIndex))].length,
      word_count: rewritten.trim().split(/\s+/).length,
    });
  } catch (error) {
    console.error('targetedRewrite error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});