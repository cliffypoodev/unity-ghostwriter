// ═══════════════════════════════════════════════════════════════════════════════
// SHARED DATA LOADER — Single function to load all project context
// ═══════════════════════════════════════════════════════════════════════════════
// Extracted from: writeChapter.ts (lines 1928–1971), generateScenes.ts (143–168),
// generateChapterState.ts (80–108)
//
// RULE: Every bot calls loadProjectContext() instead of loading entities directly.
// This eliminates the 6 different entity-loading patterns across the codebase.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolve content that may be inline text or a URL to fetch.
 * Handles the pattern where Base44 stores large content as uploaded file URLs.
 */
export async function resolveContent(content) {
  if (!content) return '';
  if (typeof content === 'string' && (content.startsWith('http://') || content.startsWith('https://'))) {
    try {
      const r = await fetch(content);
      if (!r.ok) return '';
      const t = await r.text();
      if (t.trim().startsWith('<')) return ''; // HTML error page, not content
      return t;
    } catch {
      return '';
    }
  }
  return content;
}

/**
 * Safely parse a JSON field that may be inline JSON string or a URL to fetch.
 */
export async function parseJSONField(field, fieldUrl) {
  try {
    let data = field;
    if (!data && fieldUrl) {
      const r = await fetch(fieldUrl);
      if (!r.ok) return null;
      const t = await r.text();
      if (t.trim().startsWith('<')) return null; // HTML error page
      return JSON.parse(t);
    }
    if (typeof data === 'string' && data.trim() && !data.trim().startsWith('<')) {
      return JSON.parse(data);
    }
    return null;
  } catch (err) {
    console.error('parseJSONField error:', err.message);
    return null;
  }
}

/**
 * Load complete project context — everything a bot needs to do its job.
 * 
 * @param {object} base44 - Authenticated Base44 client
 * @param {string} projectId - Project ID
 * @returns {Promise<ProjectContext>}
 */
export async function loadProjectContext(base44, projectId) {
  // Load all entities in parallel
  let chapters = [], specs = [], outlines = [], sourceFiles = [],
      globalSourceFiles = [], appSettingsList = [], projects = [];

  try {
    [chapters, specs, outlines, sourceFiles, globalSourceFiles, appSettingsList, projects] = await Promise.all([
      base44.entities.Chapter.filter({ project_id: projectId }),
      base44.entities.Specification.filter({ project_id: projectId }),
      base44.entities.Outline.filter({ project_id: projectId }),
      base44.entities.SourceFile.filter({ project_id: projectId }).catch(() => []),
      base44.entities.SourceFile.filter({ project_id: "global" }).catch(() => []),
      base44.entities.AppSettings.list().catch(() => []),
      base44.entities.Project.filter({ id: projectId }).catch(() => []),
    ]);
  } catch (loadErr) {
    console.error('Failed to load project context:', loadErr.message);
    throw new Error('Failed to load project data: ' + loadErr.message);
  }

  const project = projects[0] || {};
  const appSettings = appSettingsList[0] || {};
  const rawSpec = specs[0];
  const outline = outlines[0];

  // Normalize spec with safe defaults
  const spec = rawSpec ? {
    ...rawSpec,
    beat_style: rawSpec.beat_style || rawSpec.tone_style || "",
    spice_level: Math.max(0, Math.min(4, parseInt(rawSpec.spice_level) || 0)),
    language_intensity: Math.max(0, Math.min(4, parseInt(rawSpec.language_intensity) || 0)),
  } : null;

  // Parse outline data — prefer inline, fall back to URL
  let outlineData = null;
  let outlineRaw = outline?.outline_data || '';
  if (!outlineRaw && outline?.outline_url) {
    try { outlineRaw = await (await fetch(outline.outline_url)).text(); } catch {}
  }
  try { outlineData = outlineRaw ? JSON.parse(outlineRaw) : null; } catch {}

  // Parse story bible — prefer inline, fall back to URL
  let storyBible = null;
  let bibleRaw = outline?.story_bible || '';
  if (!bibleRaw && outline?.story_bible_url) {
    try { bibleRaw = await (await fetch(outline.story_bible_url)).text(); } catch {}
  }
  try { storyBible = bibleRaw ? JSON.parse(bibleRaw) : null; } catch {}

  // Sort chapters by chapter_number
  chapters.sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

  // Load project-level state
  let nameRegistry = {};
  if (project.name_registry) {
    try { nameRegistry = JSON.parse(project.name_registry); } catch {}
  }

  let bannedPhrases = [];
  if (project.banned_phrases_log) {
    let bpRaw = project.banned_phrases_log;
    if (typeof bpRaw === 'string' && bpRaw.startsWith('http')) {
      try { bpRaw = await (await fetch(bpRaw)).text(); } catch { bpRaw = '[]'; }
    }
    try { bannedPhrases = JSON.parse(bpRaw); } catch {}
  }

  let chapterStateLog = '';
  if (project.chapter_state_log) {
    chapterStateLog = await resolveContent(project.chapter_state_log);
  }

  return {
    project,
    chapters,
    spec,
    outline,
    outlineData,
    storyBible,
    sourceFiles,
    globalSourceFiles,
    appSettings,
    nameRegistry,
    bannedPhrases,
    chapterStateLog,
    // Convenience lookups
    totalChapters: chapters.length,
    isNonfiction: spec?.book_type === 'nonfiction',
    isFiction: spec?.book_type !== 'nonfiction',
    isErotica: /erotica|erotic/.test(((spec?.genre || '') + ' ' + (spec?.subgenre || '')).toLowerCase()),
  };
}

/**
 * Load a specific chapter's context within an already-loaded project.
 * 
 * @param {ProjectContext} ctx - From loadProjectContext
 * @param {string} chapterId - Chapter ID to focus on
 * @returns {ChapterContext}
 */
export function getChapterContext(ctx, chapterId) {
  const chapter = ctx.chapters.find(c => c.id === chapterId);
  if (!chapter) throw new Error('Chapter not found: ' + chapterId);

  const chapterIndex = ctx.chapters.findIndex(c => c.id === chapterId);
  const prevChapter = chapterIndex > 0 ? ctx.chapters[chapterIndex - 1] : null;
  const nextChapter = chapterIndex < ctx.chapters.length - 1 ? ctx.chapters[chapterIndex + 1] : null;
  const isLastChapter = chapterIndex === ctx.chapters.length - 1;
  const isFirstChapter = chapterIndex === 0;

  // Find outline entry for this chapter
  const outlineChapters = ctx.outlineData?.chapters || [];
  const outlineEntry = outlineChapters.find(
    c => (c.number || c.chapter_number) === chapter.chapter_number
  ) || {};
  const prevOutlineEntry = prevChapter
    ? outlineChapters.find(c => (c.number || c.chapter_number) === prevChapter.chapter_number) || {}
    : {};

  // Get all previous chapters with content (for context injection)
  const previousChapters = ctx.chapters
    .slice(0, chapterIndex)
    .filter(c => c.content && c.status === 'generated');

  // Get the most recent state document
  let lastStateDoc = null;
  for (let i = chapterIndex - 1; i >= 0; i--) {
    if (ctx.chapters[i].state_document) {
      lastStateDoc = ctx.chapters[i].state_document;
      break;
    }
  }

  // Parse chapter's scenes if present
  let scenes = null;
  if (chapter.scenes) {
    try {
      const parsed = typeof chapter.scenes === 'string' ? JSON.parse(chapter.scenes) : chapter.scenes;
      if (Array.isArray(parsed) && parsed.length > 0) scenes = parsed;
    } catch {}
  }

  // Get beat sheet entry for this chapter
  let chapterBeat = null;
  if (ctx.outlineData?.beat_sheet) {
    const bs = ctx.outlineData.beat_sheet;
    const beats = Array.isArray(bs) ? bs : bs?.beats || [];
    chapterBeat = beats.find(b =>
      (b.chapter_number || b.chapter) === chapter.chapter_number
    ) || null;
  }

  return {
    chapter,
    chapterIndex,
    prevChapter,
    nextChapter,
    isLastChapter,
    isFirstChapter,
    outlineEntry,
    prevOutlineEntry,
    previousChapters,
    lastStateDoc,
    scenes,
    chapterBeat,
  };
}

/**
 * Load act bridge documents for a project.
 * Used by Prose Writer for cross-act context injection.
 */
export async function loadActBridges(base44, projectId) {
  try {
    const sourceFiles = await base44.entities.SourceFile.filter({ project_id: projectId });
    const bridges = [];
    for (const bf of sourceFiles.filter(f => /^act_\d+_bridge\.txt$/.test(f.filename)).sort((a, b) => a.filename.localeCompare(b.filename))) {
      if (bf.content?.length > 50) {
        const actNum = bf.filename.match(/act_(\d+)/)[1];
        bridges.push({ actNumber: parseInt(actNum), content: bf.content.slice(0, 2000) });
      }
    }
    return bridges;
  } catch (e) {
    console.warn('loadActBridges:', e.message);
    return [];
  }
}
