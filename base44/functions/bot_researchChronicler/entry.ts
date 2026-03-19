// BOT 7 — RESEARCH CHRONICLER (v2 — redeployed)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ═══ INLINED: shared/aiRouter (compact) ═══
const MODEL_MAP = {
  "gemini-pro": { provider: "google", modelId: "gemini-2.5-flash", defaultTemp: 0.72, maxTokensLimit: null },
};
async function callAI(modelKey, systemPrompt, userMessage, options = {}) {
  const config = MODEL_MAP[modelKey] || MODEL_MAP["gemini-pro"];
  const { provider, modelId, defaultTemp, maxTokensLimit } = config;
  const temperature = options.temperature ?? defaultTemp;
  let maxTokens = options.maxTokens ?? 8192;
  if (maxTokensLimit) maxTokens = Math.min(maxTokens, maxTokensLimit);
  if (provider === "google") {
    const apiKey = Deno.env.get('GOOGLE_AI_API_KEY'); if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set');
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + modelId + ':generateContent?key=' + apiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: userMessage }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { temperature, maxOutputTokens: maxTokens } }) });
    const d = await r.json(); if (!r.ok) throw new Error('Google: ' + (d.error?.message || r.status)); return d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  throw new Error('Unknown provider: ' + provider);
}
function isRefusal(text) { if (!text) return false; const f = text.slice(0, 300).toLowerCase(); return ['i cannot','i can\'t','i\'m unable','as an ai'].some(m => f.includes(m)); }

// ═══ INLINED: shared/resolveModel ═══
function resolveModel(callType) {
  if (callType === 'research') return 'gemini-pro';
  if (callType === 'verify') return 'gemini-pro';
  if (callType === 'bibliography') return 'gemini-pro';
  if (callType === 'topic_research') return 'gemini-pro';
  return 'gemini-pro';
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
    base44.entities.Chapter.filter({ project_id: projectId }),
    base44.entities.Specification.filter({ project_id: projectId }),
    base44.entities.Outline.filter({ project_id: projectId }),
    base44.entities.Project.filter({ id: projectId }).catch(() => []),
  ]);
  const project = projects[0] || {};
  const rawSpec = specs[0]; const outline = outlines[0];
  const spec = rawSpec ? { ...rawSpec, beat_style: rawSpec.beat_style || rawSpec.tone_style || "", spice_level: Math.max(0, Math.min(4, parseInt(rawSpec.spice_level) || 0)), language_intensity: Math.max(0, Math.min(4, parseInt(rawSpec.language_intensity) || 0)) } : null;
  let outlineData = null; let outlineRaw = outline?.outline_data || '';
  if (!outlineRaw && outline?.outline_url) { try { outlineRaw = await (await fetch(outline.outline_url)).text(); } catch {} }
  try { outlineData = outlineRaw ? JSON.parse(outlineRaw) : null; } catch {}
  chapters.sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
  let storyBibleRaw = outline?.story_bible || '';
  if (!storyBibleRaw && outline?.story_bible_url) { try { storyBibleRaw = await (await fetch(outline.story_bible_url)).text(); } catch {} }
  let storyBible = null;
  try { storyBible = storyBibleRaw ? JSON.parse(storyBibleRaw) : null; } catch {}
  return { project, chapters, spec, outlineData, storyBible, totalChapters: chapters.length, isNonfiction: spec?.book_type === 'nonfiction' };
}
function getChapterContext(ctx, chapterId) {
  const chapter = ctx.chapters.find(c => c.id === chapterId);
  if (!chapter) throw new Error('Chapter not found: ' + chapterId);
  const chapterIndex = ctx.chapters.findIndex(c => c.id === chapterId);
  const outlineEntry = ctx.outlineData?.chapters?.find(c =>
    c.chapter_number === chapter.chapter_number || c.number === chapter.chapter_number
  );
  let lastStateDoc = null;
  for (let i = chapterIndex - 1; i >= 0; i--) { if (ctx.chapters[i].state_document) { lastStateDoc = ctx.chapters[i].state_document; break; } }
  return { chapter, chapterIndex, outlineEntry, lastStateDoc };
}

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

async function runResearch(base44, ctx, chCtx, depth = 'standard') {
  const { spec, outlineData, isNonfiction } = ctx;
  const { chapter, outlineEntry } = chCtx;
  if (!isNonfiction) return { skipped: true, reason: 'Fiction project — research not applicable' };

  const depthConfig = RESEARCH_DEPTH[depth] || RESEARCH_DEPTH.standard;

  const chapterContext = `
BOOK: ${spec?.topic || 'Untitled nonfiction'}
GENRE: ${spec?.genre || 'General nonfiction'}${spec?.subgenre ? ' / ' + spec.subgenre : ''}
CHAPTER ${chapter.chapter_number}: "${chapter.title}"
CHAPTER SUMMARY: ${chapter.summary || outlineEntry?.summary || 'Not provided'}
CHAPTER PROMPT: ${chapter.prompt || outlineEntry?.prompt || 'Not provided'}
KEY TOPICS: ${JSON.stringify(outlineEntry?.key_events || outlineEntry?.key_beats || [])}

Find ${depthConfig.min}-${depthConfig.max} REAL, VERIFIABLE sources that directly support this chapter's content. Prioritize primary sources. Search thoroughly — use multiple query strategies.`;

  const modelKey = resolveModel('research');
  let allSources = [];
  let gaps = [];
  let recommendedQueries = [];

  // Multiple search passes for deeper research
  for (let pass = 0; pass < depthConfig.searchPasses; pass++) {
    const passPrompt = pass === 0
      ? chapterContext
      : `${chapterContext}\n\nPREVIOUS PASS found ${allSources.length} sources:\n${allSources.map(s => `- ${s.author}: "${s.title}"`).join('\n')}\n\nFind ${Math.max(3, depthConfig.min - allSources.length)} ADDITIONAL sources not already listed. Focus on: ${gaps.join(', ') || 'primary sources, court records, archival material, contemporary reporting'}.`;

    try {
      const raw = await callAI(modelKey, RESEARCH_SYSTEM, passPrompt, { maxTokens: 4096, temperature: 0.3 });
      const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (parsed.sources) {
        for (const src of parsed.sources) {
          const isDupe = allSources.some(existing =>
            existing.title.toLowerCase() === src.title.toLowerCase() &&
            existing.author.toLowerCase() === src.author.toLowerCase()
          );
          if (!isDupe) allSources.push(src);
        }
      }
      if (parsed.gaps) gaps = [...new Set([...gaps, ...parsed.gaps])];
      if (parsed.recommended_queries) recommendedQueries = [...new Set([...recommendedQueries, ...parsed.recommended_queries])];
    } catch (e) {
      console.warn(`Research pass ${pass + 1} failed:`, e.message);
    }
  }

  // Build structured source document
  const sourceDoc = buildSourceDocument(allSources, chapter, gaps);

  // Store source document on the chapter entity
  try {
    const sourceFile = new File([sourceDoc], `ch${chapter.chapter_number}_sources.txt`, { type: 'text/plain' });
    const uploaded = await base44.integrations.Core.UploadFile({ file: sourceFile });
    if (uploaded?.file_url) {
      await base44.entities.Chapter.update(chapter.id, { source_document: uploaded.file_url });
    }
  } catch (e) {
    console.warn('Source doc upload failed:', e.message);
    // Store inline as fallback
    try {
      await base44.entities.Chapter.update(chapter.id, { source_document: sourceDoc.slice(0, 50000) });
    } catch {}
  }

  return {
    success: true,
    chapter_id: chapter.id,
    chapter_number: chapter.chapter_number,
    source_count: allSources.length,
    sources: allSources,
    gaps,
    recommended_queries: recommendedQueries,
    source_document: sourceDoc,
    depth: depthConfig.label,
  };
}

function buildSourceDocument(sources, chapter, gaps) {
  let doc = `═══ VERIFIED SOURCES FOR CHAPTER ${chapter.chapter_number}: "${chapter.title}" ═══\n`;
  doc += `Total sources found: ${sources.length}\n\n`;

  const groups = {};
  for (const s of sources) {
    const type = s.type || 'other';
    if (!groups[type]) groups[type] = [];
    groups[type].push(s);
  }

  const typeLabels = {
    book: 'BOOKS', article: 'JOURNAL ARTICLES & PERIODICALS', web: 'ONLINE SOURCES',
    court_case: 'COURT CASES & LEGAL FILINGS', archive: 'ARCHIVAL MATERIALS',
    testimony: 'TESTIMONY & INTERVIEWS', government_doc: 'GOVERNMENT DOCUMENTS', other: 'OTHER SOURCES'
  };

  for (const [type, srcs] of Object.entries(groups)) {
    doc += `── ${typeLabels[type] || type.toUpperCase()} ──\n`;
    for (const s of srcs) {
      doc += `• ${s.author}. "${s.title}."`;
      if (s.publisher_or_journal) doc += ` ${s.publisher_or_journal}.`;
      if (s.year) doc += ` ${s.year}.`;
      if (s.volume) doc += ` Vol. ${s.volume}`;
      if (s.issue) doc += `, no. ${s.issue}`;
      if (s.pages) doc += `, pp. ${s.pages}`;
      doc += '.';
      if (s.url) doc += ` URL: ${s.url}`;
      if (s.archive_location) doc += ` Archive: ${s.archive_location}`;
      if (s.court) doc += ` Court: ${s.court}`;
      doc += `\n  SUMMARY: ${s.summary}\n`;
      if (s.anchors?.length) doc += `  ANCHORS: ${s.anchors.join('; ')}\n`;
      doc += '\n';
    }
  }

  if (gaps.length > 0) {
    doc += `── RESEARCH GAPS ──\n`;
    doc += `The following topics could not be fully sourced. Claims related to these should use [VERIFY] tags:\n`;
    for (const g of gaps) doc += `• ${g}\n`;
  }

  doc += `\n═══ END SOURCES ═══`;
  return doc;
}

// ═══ MODE 2: POST-PROSE VERIFICATION ═══

async function runVerification(base44, ctx, chCtx, prose) {
  const { isNonfiction } = ctx;
  const { chapter } = chCtx;
  if (!isNonfiction) return { skipped: true, reason: 'Fiction project — verification not applicable' };

  // Load source document from chapter
  let sourceDoc = '';
  if (chapter.source_document) {
    sourceDoc = await resolveContent(chapter.source_document);
  }
  if (!sourceDoc) {
    return { success: false, error: 'No source document found for this chapter. Run research mode first.' };
  }

  const modelKey = resolveModel('verify');
  const userMessage = `CHAPTER PROSE:\n${prose.slice(0, 30000)}\n\n────────────────\n\nVERIFIED SOURCE DOCUMENT:\n${sourceDoc}`;

  try {
    const raw = await callAI(modelKey, VERIFY_SYSTEM, userMessage, { maxTokens: 4096, temperature: 0.2 });
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const result = JSON.parse(cleaned);

    const verification = {
      success: true,
      chapter_id: chapter.id,
      total_claims: result.total_claims || 0,
      verified: result.verified || 0,
      unsourced: result.unsourced || [],
      contradicted: result.contradicted || [],
      fabricated_details: result.fabricated_details || [],
      verification_score: result.total_claims > 0
        ? Math.round((result.verified / result.total_claims) * 100)
        : 0,
    };

    // Store verification report on the chapter
    try {
      const reportText = `VERIFICATION REPORT — Ch ${chapter.chapter_number}\nScore: ${verification.verification_score}%\nClaims: ${verification.total_claims} total, ${verification.verified} verified\nUnsourced: ${verification.unsourced.length}\nContradicted: ${verification.contradicted.length}\nFabricated: ${verification.fabricated_details.length}`;
      await base44.entities.Chapter.update(chapter.id, {
        verification_report: reportText,
        verification_score: verification.verification_score,
      });
    } catch (e) { console.warn('Verification report save failed:', e.message); }

    return verification;
  } catch (e) {
    console.warn('Verification failed:', e.message);
    return { success: false, error: e.message };
  }
}

// ═══ MODE 3: BIBLIOGRAPHY COMPILATION ═══

async function runBibliography(base44, ctx) {
  const { chapters, isNonfiction, project } = ctx;
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
    return { success: false, error: 'No source documents found on any chapter. Run research mode on chapters first.' };
  }

  const modelKey = resolveModel('bibliography');
  const userMessage = `Compile the following chapter source documents into a single, deduplicated Chicago Manual of Style 17th Edition (Notes-Bibliography system) bibliography:\n\n${
    allChapterSources.map(cs =>
      `═══ CHAPTER ${cs.chapter_number}: "${cs.title}" ═══\n${cs.source_document}`
    ).join('\n\n')
  }\n\nTotal chapters with sources: ${allChapterSources.length} of ${chapters.length}\nBook topic: ${ctx.spec?.topic || 'Not specified'}`;

  try {
    const bibliography = await callAI(modelKey, BIBLIOGRAPHY_SYSTEM, userMessage, { maxTokens: 8192, temperature: 0.2 });

    if (isRefusal(bibliography)) {
      return { success: false, error: 'AI refused to compile bibliography' };
    }

    // Store bibliography on the project
    try {
      const bibFile = new File([bibliography], 'bibliography.txt', { type: 'text/plain' });
      const uploaded = await base44.integrations.Core.UploadFile({ file: bibFile });
      if (uploaded?.file_url) {
        await base44.entities.Project.update(project.id, { bibliography_url: uploaded.file_url });
      }
    } catch (e) {
      console.warn('Bibliography upload failed:', e.message);
      try {
        await base44.entities.Project.update(project.id, { bibliography_text: bibliography.slice(0, 50000) });
      } catch {}
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

// ═══ MODE 4: TOPIC-LEVEL RESEARCH (PRE-OUTLINE) ═══

const TOPIC_RESEARCH_SYSTEM = `You are a professional nonfiction research architect. A user wants to write a nonfiction book. Your job is to deeply research the TOPIC and produce a comprehensive knowledge base that will guide the entire book's structure.

You will receive: topic, genre, subgenre, target audience.

Return a structured JSON knowledge base with:

1. TOPIC ANALYSIS — What this topic actually covers, common misconceptions, the current state of the field
2. KEY FRAMEWORKS — The major theoretical frameworks, models, or organizing principles used by experts in this field (3-5 frameworks)
3. MAJOR THEMES — The 8-12 distinct themes or subtopics that a comprehensive book on this subject MUST cover
4. AUTHORITATIVE SOURCES — 15-20 real, verifiable books, journals, organizations, and experts that are the gold standard in this field
5. TARGET AUDIENCE NEEDS — What readers of this genre/topic specifically need, their pain points, their knowledge gaps
6. SUGGESTED CHAPTER STRUCTURE — A proposed 15-20 chapter outline with titles and 1-sentence descriptions, organized by the most logical progression for this topic
7. COMPETING BOOKS — 5-8 existing books on this topic, what they do well, and what gaps remain for a new book to fill
8. KEY TERMS — A glossary of 10-20 essential terms the author must use correctly

OUTPUT FORMAT — respond ONLY with valid JSON:
{
  "topic_analysis": {
    "core_subject": "What this book is really about",
    "scope": "What it covers and what it deliberately excludes",
    "current_state": "Where the field stands right now",
    "common_misconceptions": ["misconception 1", "misconception 2"]
  },
  "key_frameworks": [
    { "name": "Framework Name", "description": "What it is and why it matters", "source": "Who developed it" }
  ],
  "major_themes": [
    { "theme": "Theme Name", "description": "Why this must be in the book", "subtopics": ["subtopic 1", "subtopic 2"] }
  ],
  "authoritative_sources": [
    { "type": "book|journal|organization|expert|government", "name": "Full Name/Title", "author": "Author if applicable", "relevance": "Why this is authoritative", "url": "" }
  ],
  "target_audience_needs": {
    "primary_reader": "Who this book is for",
    "knowledge_level": "What they already know",
    "pain_points": ["what frustrates them"],
    "desired_outcomes": ["what they want to learn/achieve"]
  },
  "suggested_chapters": [
    { "number": 1, "title": "Chapter Title", "description": "One-sentence description", "theme": "Which major theme this serves" }
  ],
  "competing_books": [
    { "title": "Book Title", "author": "Author", "strength": "What it does well", "gap": "What it misses that your book can fill" }
  ],
  "key_terms": [
    { "term": "Term", "definition": "Plain-language definition" }
  ]
}`;

async function runTopicResearch(base44, projectId, spec) {
  const topic = spec?.topic || '';
  const genre = spec?.genre || 'General nonfiction';
  const subgenre = spec?.subgenre || '';
  const audience = spec?.target_audience || 'General readers';

  if (!topic || topic.length < 10) {
    return { success: false, error: 'Topic is too short or missing. Provide a detailed nonfiction topic/premise.' };
  }

  const userMessage = `NONFICTION BOOK RESEARCH REQUEST:
TOPIC: ${topic}
GENRE: ${genre}${subgenre ? ' / ' + subgenre : ''}
TARGET AUDIENCE: ${audience}

Research this topic thoroughly. Find real frameworks, real sources, real competing books. Do NOT fabricate any sources or experts. If you cannot find real sources for a specific subtopic, note it as a gap.

This knowledge base will be used to generate the book's outline and guide every chapter's content. Be comprehensive.`;

  try {
    const raw = await callAI(resolveModel('topic_research'), TOPIC_RESEARCH_SYSTEM, userMessage, { maxTokens: 8192, temperature: 0.3 });
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const knowledgeBase = JSON.parse(cleaned);

    // Store knowledge base on the project
    const kbText = JSON.stringify(knowledgeBase, null, 2);
    try {
      const kbFile = new File([kbText], 'knowledge_base.json', { type: 'application/json' });
      const uploaded = await base44.integrations.Core.UploadFile({ file: kbFile });
      if (uploaded?.file_url) {
        await base44.entities.Project.update(projectId, { knowledge_base_url: uploaded.file_url });
      }
    } catch (e) {
      console.warn('Knowledge base upload failed, storing inline:', e.message);
      try {
        await base44.entities.Project.update(projectId, { knowledge_base: kbText.slice(0, 50000) });
      } catch {}
    }

    return {
      success: true,
      knowledge_base: knowledgeBase,
      source_count: knowledgeBase.authoritative_sources?.length || 0,
      theme_count: knowledgeBase.major_themes?.length || 0,
      chapter_suggestions: knowledgeBase.suggested_chapters?.length || 0,
      competing_books: knowledgeBase.competing_books?.length || 0,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ═══ DENO SERVE ═══

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { project_id, chapter_id, mode, prose, depth } = body;

    if (!project_id) return Response.json({ error: 'project_id required' }, { status: 400 });
    if (!mode || !['research', 'verify', 'bibliography', 'topic_research'].includes(mode)) {
      return Response.json({ error: 'mode required: research | verify | bibliography | topic_research' }, { status: 400 });
    }

    const startMs = Date.now();

    // topic_research doesn't need full project context — just the spec
    if (mode === 'topic_research') {
      const specs = await base44.entities.Specification.filter({ project_id });
      const spec = specs?.[0];
      if (!spec || spec.book_type !== 'nonfiction') {
        return Response.json({ skipped: true, reason: 'topic_research requires a nonfiction project with a specification' });
      }
      const result = await runTopicResearch(base44, project_id, spec);
      result.duration_ms = Date.now() - startMs;
      result.mode = mode;
      return Response.json(result);
    }

    const ctx = await loadProjectContext(base44, project_id);

    if (!ctx.isNonfiction) {
      return Response.json({ skipped: true, reason: 'Fiction project — Research Chronicler only runs on nonfiction' });
    }

    let result;

    if (mode === 'research') {
      if (!chapter_id) return Response.json({ error: 'chapter_id required for research mode' }, { status: 400 });
      const chCtx = getChapterContext(ctx, chapter_id);
      result = await runResearch(base44, ctx, chCtx, depth || 'standard');
    }

    else if (mode === 'verify') {
      if (!chapter_id) return Response.json({ error: 'chapter_id required for verify mode' }, { status: 400 });
      const chCtx = getChapterContext(ctx, chapter_id);
      const chapterProse = prose || chCtx.chapter.content || '';
      if (!chapterProse) return Response.json({ error: 'No prose to verify — provide prose in body or ensure chapter has content' }, { status: 400 });
      result = await runVerification(base44, ctx, chCtx, chapterProse);
    }

    else if (mode === 'bibliography') {
      result = await runBibliography(base44, ctx);
    }

    result.duration_ms = Date.now() - startMs;
    result.mode = mode;
    return Response.json(result);

  } catch (error) {
    console.error('researchChronicler error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});