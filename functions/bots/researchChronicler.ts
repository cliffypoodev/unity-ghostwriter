// ═══════════════════════════════════════════════════════════════════════════════
// BOT 7 — RESEARCH CHRONICLER
// ═══════════════════════════════════════════════════════════════════════════════
// Pre-chapter: finds real sources via web search, compiles structured source docs.
// Post-prose: verifies factual claims against gathered sources.
// End-of-book: compiles Chicago 17th ed. bibliography from all chapter sources.
// ═══════════════════════════════════════════════════════════════════════════════

import { callAI, callAIConversation, isRefusal } from '../shared/aiRouter.ts';
import { resolveModel } from '../shared/resolveModel.ts';
import { loadProjectContext, getChapterContext, resolveContent } from '../shared/dataLoader.ts';

// ═══ CITATION STYLE TEMPLATES ═══

const CHICAGO_BOOK = (author: string, title: string, publisher: string, year: string) =>
  `${author}. *${title}*. ${publisher}, ${year}.`;
const CHICAGO_ARTICLE = (author: string, title: string, journal: string, vol: string, no: string, year: string, pages: string) =>
  `${author}. "${title}." *${journal}* ${vol}, no. ${no} (${year}): ${pages}.`;
const CHICAGO_WEB = (author: string, title: string, site: string, date: string, url: string) =>
  `${author}. "${title}." ${site}. ${date}. ${url}.`;
const CHICAGO_COURT = (caseName: string, volume: string, reporter: string, page: string, court: string, year: string) =>
  `*${caseName}*, ${volume} ${reporter} ${page} (${court} ${year}).`;
const CHICAGO_ARCHIVE = (author: string, title: string, collection: string, box: string, archive: string, location: string) =>
  `${author}. "${title}." ${collection}, Box ${box}. ${archive}, ${location}.`;

// ═══ RESEARCH SYSTEM PROMPTS ═══

const RESEARCH_SYSTEM = `You are a professional nonfiction research assistant. Your job is to find REAL, VERIFIABLE sources for a specific chapter of a nonfiction book.

RULES:
1. Every source you cite MUST be real — a real book, a real article, a real court case, a real archive, a real website with a real URL.
2. DO NOT fabricate sources. If you cannot find enough real sources, say so explicitly rather than inventing plausible-sounding ones.
3. For each source, provide: type (book/article/web/court_case/archive/testimony), full citation details, and a 1-2 sentence summary of what it contributes to the chapter's argument.
4. Prioritize PRIMARY sources (original documents, court records, firsthand testimony, contemporary reporting) over secondary sources (later histories, Wikipedia summaries).
5. Include a mix of source types — not all books, not all websites.
6. For each source, note the specific claims or facts it can anchor in the chapter.

OUTPUT FORMAT — respond ONLY with valid JSON, no preamble:
{
  "sources": [
    {
      "type": "book|article|web|court_case|archive|testimony|government_doc",
      "author": "Full Name",
      "title": "Full Title",
      "publisher_or_journal": "Publisher or Journal Name",
      "year": "YYYY",
      "volume": "",
      "issue": "",
      "pages": "",
      "url": "",
      "archive_location": "",
      "court": "",
      "summary": "What this source provides for the chapter",
      "anchors": ["specific fact 1", "specific fact 2"]
    }
  ],
  "gaps": ["topics where real sources could not be found"],
  "recommended_queries": ["suggested follow-up searches for gaps"]
}`;

const VERIFY_SYSTEM = `You are a nonfiction fact-checker. You will receive:
1. Chapter prose text
2. A source document with verified references

Your job is to:
1. Extract every specific factual claim from the prose (names, dates, places, events, statistics, quotes)
2. Check each claim against the provided source document
3. Flag claims that are NOT supported by any provided source
4. Flag claims that CONTRADICT a provided source
5. Flag specific details (exact times, dollar amounts, dialogue) that appear fabricated

OUTPUT FORMAT — respond ONLY with valid JSON:
{
  "total_claims": 0,
  "verified": 0,
  "unsourced": [
    { "claim": "the specific text", "location": "paragraph/sentence reference", "severity": "warning|critical", "suggestion": "how to fix or source it" }
  ],
  "contradicted": [
    { "claim": "the specific text", "source_says": "what the source actually says", "severity": "critical" }
  ],
  "fabricated_details": [
    { "detail": "the specific text", "reason": "why it appears fabricated", "severity": "critical" }
  ]
}`;

const BIBLIOGRAPHY_SYSTEM = `You are a professional bibliography compiler. You will receive a collection of source documents from multiple chapters. Your job is to:

1. Deduplicate sources (same work cited in multiple chapters = one bibliography entry)
2. Format every source in Chicago Manual of Style 17th Edition (Notes-Bibliography system)
3. Sort alphabetically by author last name
4. Group into sections: Primary Sources, Secondary Sources, Government Documents, Court Cases, Archival Materials, Online Resources
5. Include a "Sources by Chapter" appendix that lists which sources were used in each chapter

OUTPUT FORMAT: Return the formatted bibliography as plain text with clear section headers. Use proper Chicago formatting including italics markers (*title*) and quotation marks for article titles.`;

// ═══ RESEARCH DEPTH CONFIGS ═══

const RESEARCH_DEPTH = {
  light: { min: 3, max: 5, searchPasses: 1, label: 'Light (3-5 sources)' },
  standard: { min: 8, max: 12, searchPasses: 2, label: 'Standard (8-12 sources)' },
  deep: { min: 15, max: 20, searchPasses: 3, label: 'Deep (15-20 sources)' },
};

// ═══ MODE 1: PRE-CHAPTER RESEARCH ═══

async function runResearch(ctx, chCtx, depth = 'standard') {
  const { spec, outlineData, isNonfiction } = ctx;
  const { chapter } = chCtx;
  if (!isNonfiction) return { skipped: true, reason: 'Fiction project — research not applicable' };

  const depthConfig = RESEARCH_DEPTH[depth] || RESEARCH_DEPTH.standard;
  const outlineEntry = outlineData?.chapters?.find(c =>
    c.chapter_number === chapter.chapter_number || c.number === chapter.chapter_number
  );

  const chapterContext = `
BOOK: ${spec?.topic || 'Untitled nonfiction'}
GENRE: ${spec?.genre || 'General nonfiction'}${spec?.subgenre ? ' / ' + spec.subgenre : ''}
CHAPTER ${chapter.chapter_number}: "${chapter.title}"
CHAPTER SUMMARY: ${chapter.summary || outlineEntry?.summary || 'Not provided'}
CHAPTER PROMPT: ${chapter.prompt || outlineEntry?.prompt || 'Not provided'}
KEY TOPICS: ${JSON.stringify(outlineEntry?.key_events || outlineEntry?.key_beats || [])}

Find ${depthConfig.min}-${depthConfig.max} REAL, VERIFIABLE sources that directly support this chapter's content. Prioritize primary sources. Search thoroughly — use multiple query strategies.`;

  const modelKey = 'claude-sonnet'; // Claude has web search capability
  let allSources = [];
  let gaps = [];

  // Multiple search passes for deeper research
  for (let pass = 0; pass < depthConfig.searchPasses; pass++) {
    const passPrompt = pass === 0
      ? chapterContext
      : `${chapterContext}\n\nPREVIOUS PASS found these sources:\n${allSources.map(s => `- ${s.author}: ${s.title}`).join('\n')}\n\nFind ${depthConfig.min - allSources.length} ADDITIONAL sources not already listed. Focus on: ${gaps.join(', ') || 'primary sources, court records, archival material'}.`;

    try {
      const raw = await callAI(modelKey, RESEARCH_SYSTEM, passPrompt, { maxTokens: 4096, temperature: 0.3 });
      const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (parsed.sources) {
        // Deduplicate against existing sources
        for (const src of parsed.sources) {
          const isDupe = allSources.some(existing =>
            existing.title.toLowerCase() === src.title.toLowerCase() &&
            existing.author.toLowerCase() === src.author.toLowerCase()
          );
          if (!isDupe) allSources.push(src);
        }
      }
      if (parsed.gaps) gaps = [...gaps, ...parsed.gaps];
    } catch (e) {
      console.warn(`Research pass ${pass + 1} failed:`, e.message);
    }
  }

  // Build structured source document for proseWriter injection
  const sourceDoc = buildSourceDocument(allSources, chapter, gaps);

  return {
    success: true,
    chapter_id: chCtx.chapter.id,
    chapter_number: chapter.chapter_number,
    source_count: allSources.length,
    sources: allSources,
    gaps,
    source_document: sourceDoc,
    depth: depthConfig.label,
  };
}

function buildSourceDocument(sources, chapter, gaps) {
  let doc = `═══ VERIFIED SOURCES FOR CHAPTER ${chapter.chapter_number}: "${chapter.title}" ═══\n`;
  doc += `Total sources found: ${sources.length}\n\n`;

  // Group by type
  const groups = {};
  for (const s of sources) {
    const type = s.type || 'other';
    if (!groups[type]) groups[type] = [];
    groups[type].push(s);
  }

  for (const [type, srcs] of Object.entries(groups)) {
    doc += `── ${type.toUpperCase().replace('_', ' ')} ──\n`;
    for (const s of srcs) {
      doc += `• ${s.author}. "${s.title}."`;
      if (s.publisher_or_journal) doc += ` ${s.publisher_or_journal}.`;
      if (s.year) doc += ` ${s.year}.`;
      if (s.url) doc += ` URL: ${s.url}`;
      doc += `\n  Summary: ${s.summary}\n`;
      if (s.anchors?.length) doc += `  Anchors: ${s.anchors.join('; ')}\n`;
      doc += '\n';
    }
  }

  if (gaps.length > 0) {
    doc += `── RESEARCH GAPS (claims that may need [VERIFY] tags) ──\n`;
    for (const g of gaps) doc += `• ${g}\n`;
  }

  doc += `\n═══ END SOURCES ═══`;
  return doc;
}

// ═══ MODE 2: POST-PROSE VERIFICATION ═══

async function runVerification(ctx, chCtx, prose, sourceDoc) {
  const { isNonfiction } = ctx;
  if (!isNonfiction) return { skipped: true, reason: 'Fiction project — verification not applicable' };

  const modelKey = 'claude-sonnet';
  const userMessage = `CHAPTER PROSE:\n${prose}\n\n────────────\n\nVERIFIED SOURCE DOCUMENT:\n${sourceDoc}`;

  try {
    const raw = await callAI(modelKey, VERIFY_SYSTEM, userMessage, { maxTokens: 4096, temperature: 0.2 });
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const result = JSON.parse(cleaned);

    return {
      success: true,
      total_claims: result.total_claims || 0,
      verified: result.verified || 0,
      unsourced: result.unsourced || [],
      contradicted: result.contradicted || [],
      fabricated_details: result.fabricated_details || [],
      verification_score: result.total_claims > 0
        ? Math.round((result.verified / result.total_claims) * 100)
        : 0,
    };
  } catch (e) {
    console.warn('Verification failed:', e.message);
    return { success: false, error: e.message };
  }
}

// ═══ MODE 3: BIBLIOGRAPHY COMPILATION ═══

async function runBibliography(ctx) {
  const { chapters, isNonfiction } = ctx;
  if (!isNonfiction) return { skipped: true, reason: 'Fiction project — bibliography not applicable' };

  // Gather all source documents from chapters
  const allChapterSources = [];
  for (const ch of chapters) {
    if (ch.source_document) {
      const content = await resolveContent(ch.source_document);
      if (content) {
        allChapterSources.push({
          chapter_number: ch.chapter_number,
          title: ch.title,
          source_document: content,
        });
      }
    }
  }

  if (allChapterSources.length === 0) {
    return { success: false, error: 'No source documents found on any chapter. Run research mode first.' };
  }

  const modelKey = 'claude-sonnet';
  const userMessage = `Compile the following chapter source documents into a single, deduplicated Chicago 17th Edition bibliography:\n\n${
    allChapterSources.map(cs =>
      `═══ CHAPTER ${cs.chapter_number}: "${cs.title}" ═══\n${cs.source_document}`
    ).join('\n\n')
  }`;

  try {
    const bibliography = await callAI(modelKey, BIBLIOGRAPHY_SYSTEM, userMessage, { maxTokens: 8192, temperature: 0.2 });

    if (isRefusal(bibliography)) {
      return { success: false, error: 'AI refused to compile bibliography' };
    }

    return {
      success: true,
      bibliography,
      chapters_included: allChapterSources.length,
      total_chapters: chapters.length,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ═══ EXPORTS ═══

export { runResearch, runVerification, runBibliography, RESEARCH_DEPTH };
