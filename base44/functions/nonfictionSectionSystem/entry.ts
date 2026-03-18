// Nonfiction Section-Based Chapter Generation System
// Replaces monolithic chapter generation with structured, varied section sequences

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const NONFICTION_SECTION_TYPES = {
  'COLD_OPEN': { name: 'Cold Open', instruction: 'Write a scene. No context, no thesis. Drop the reader into a moment. Use present tense if it serves immediacy. Specific sensory details. End on a line that makes the reader want to know why this moment matters.' },
  'THESIS_ANCHOR': { name: 'Thesis Anchor', instruction: 'State the argument clearly and confidently. No hedging. No "In this chapter, we will explore...". Just say what you mean. One paragraph, maybe two.' },
  'EVIDENCE_DEEP_DIVE': { name: 'Evidence Deep Dive', instruction: 'Pick ONE piece of evidence and go deep. Who conducted the study? What did they find? Sample size? Limitations? Why this matters more than other evidence? Write it like a journalist, not a professor.' },
  'CASE_STUDY': { name: 'Case Study / Profile', instruction: 'This is a real person\'s story. Use their name. Describe what they did, not just what happened to them. Give them agency. End at a moment of change or decision.' },
  'CONTEXT_LAYER': { name: 'Context Layer', instruction: 'Zoom out. Give the reader the structural forces at play. Write with authority — prove you\'ve done the work. Keep it moving. No paragraph longer than 5 sentences.' },
  'COUNTER_NARRATIVE': { name: 'Counter-Narrative', instruction: 'Present the strongest version of the opposing argument. Use real critics, real objections, real data that cuts the other way. Then engage honestly — don\'t dismiss, address.' },
  'ANALYTICAL_BREAK': { name: 'Analytical Break', instruction: 'This is you thinking. No evidence, no stories. Just your interpretation, connections, insight. Write like explaining to a smart friend over dinner.' },
  'MICRO_VIGNETTE': { name: 'Micro-Vignette', instruction: 'Fast. Vivid. 2-3 paragraphs maximum. A single image or moment that lands then move on. Don\'t explain it.' },
  'TENSION_POINT': { name: 'Tension Point', instruction: 'Introduce a complication the chapter hasn\'t resolved. A contradiction in evidence. A moral difficulty. An unanswered question. Do NOT resolve — just put it on the table.' },
  'CHAPTER_SYNTHESIS': { name: 'Chapter Synthesis', instruction: 'Do not summarize. Reframe. The reader has been through something — show them what it means now. End on concrete language, not abstraction.' },
};

const NONFICTION_SECTION_MAP_RULES = `SECTION MAP RULES FOR NONFICTION CHAPTERS:
1. Every chapter MUST start with either COLD_OPEN or MICRO_VIGNETTE. Never thesis first.
2. Every chapter MUST include COUNTER_NARRATIVE or TENSION_POINT. No one-sided advocacy.
3. THESIS_ANCHOR must appear in first three sections.
4. EVIDENCE_DEEP_DIVE and CASE_STUDY must not appear back-to-back.
5. ANALYTICAL_BREAK should follow heavy sections (EVIDENCE_DEEP_DIVE or CONTEXT_LAYER).
6. CHAPTER_SYNTHESIS is always final. No exceptions.
7. No two consecutive sections can be the same type.
8. Vary section patterns from chapter to chapter.`;

// Stub implementations — integrate with existing callAI and safeParseJSON
export async function generateNonfictionSectionMap(chapterNumber, totalChapters, chapterPrompt, previousChapterSections, callAI, safeParseJSON, isRefusal, modelKey) {
  const systemPrompt = `You are an expert nonfiction book architect. Generate a section sequence for a single chapter.

${NONFICTION_SECTION_MAP_RULES}

Section types: ${Object.values(NONFICTION_SECTION_TYPES).map(s => s.name).join(', ')}

Return ONLY a valid JSON array of section objects with: section_number, type, title, word_target, focus.`;

  const previousInfo = previousChapterSections?.length > 0
    ? `\nPrevious chapter sections: ${previousChapterSections.map(s => s.type).join(', ')}. Ensure variety.`
    : '';

  const userMessage = `Generate section map for Chapter ${chapterNumber} of ${totalChapters}.
Chapter focus: "${chapterPrompt}"${previousInfo}

Return JSON array with 5-8 sections. Follow all rules. No markdown.`;

  let mapText = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    mapText = await callAI(modelKey, systemPrompt, userMessage, { maxTokens: 2000, temperature: 0.7 });
    if (mapText && !isRefusal(mapText)) break;
  }

  const jsonMatch = mapText.match(/\[[\s\S]*\]/);
  const sectionMap = await safeParseJSON(jsonMatch ? jsonMatch[0] : mapText, modelKey);
  if (!Array.isArray(sectionMap)) throw new Error('Section map not an array');
  return sectionMap;
}

export async function generateNonfictionSection(sectionType, sectionFocus, wordTarget, chapterContext, callAI, isRefusal, modelKey) {
  const typeConfig = NONFICTION_SECTION_TYPES[sectionType];
  if (!typeConfig) throw new Error(`Unknown section type: ${sectionType}`);

  const systemPrompt = `You are a nonfiction writer. Write a single section.

SECTION TYPE: ${typeConfig.name}
INSTRUCTION: ${typeConfig.instruction}

Write ONLY the prose. No markdown, no headers, no meta-commentary.`;

  const userMessage = `Write a ${typeConfig.name} section.
Focus: ${sectionFocus}
Word target: ~${wordTarget}
Context: ${chapterContext}

Write the section now. No preamble.`;

  let sectionText = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    sectionText = await callAI(modelKey, systemPrompt, userMessage, { maxTokens: 4000, temperature: 0.8 });
    if (sectionText && !isRefusal(sectionText)) break;
  }

  return sectionText.trim();
}

export async function generateNonfictionTransition(fromType, toType, fromSummary, toSummary, callAI, modelKey) {
  const fromName = NONFICTION_SECTION_TYPES[fromType]?.name || fromType;
  const toName = NONFICTION_SECTION_TYPES[toType]?.name || toType;

  const systemPrompt = `Write a natural 1-2 sentence transition between sections. Do NOT use "Now let's turn to...", "Another important aspect is...", or "Having established...". Write like a human author.`;

  const userMessage = `Transition from "${fromName}" to "${toName}".
From: ${fromSummary}
To: ${toSummary}

Write the transition.`;

  const transition = await callAI(modelKey, systemPrompt, userMessage, { maxTokens: 300, temperature: 0.7 });
  return transition.trim();
}

export { NONFICTION_SECTION_TYPES };