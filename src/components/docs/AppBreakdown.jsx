================================================================================
UNITY GHOSTWRITER — FULL APPLICATION BREAKDOWN
================================================================================

OVERVIEW
--------
Unity Ghostwriter is an AI-powered book generation platform that automates the
entire process of writing a full-length book — from concept to polished manuscript.
It supports both fiction and nonfiction, with specialized pipelines for each.
The app uses multiple AI providers (Anthropic Claude, OpenAI GPT-4o, Google Gemini,
DeepSeek, and OpenRouter/Llama) and includes extensive quality enforcement systems
to prevent repetitive, clichéd, or structurally weak prose.


================================================================================
1. DATA MODEL (ENTITIES)
================================================================================

PROJECT
  - name, status (draft → outlining → writing → editing → complete)
  - chapter_state_log: URL to cumulative state log file (character positions,
    plot threads, escalation stage across all chapters)
  - banned_phrases_log: JSON array of all distinctive phrases used across chapters
    (grows with every chapter, never reset)
  - chapter_subjects_log: Newline-delimited log of nonfiction chapter subjects
    (format: [TIME PERIOD] | [PRIMARY SUBJECT] | [LOCATION])

SPECIFICATION (1:1 with Project)
  - book_type: fiction or nonfiction
  - genre, subgenre (e.g., "True Crime", "Investigative Nonfiction")
  - topic: Full book premise / description
  - target_length: short (8-12ch), medium (15-25ch), long (25-40ch), epic (40-60ch)
  - chapter_count: Exact number override
  - detail_level: minimal, moderate, comprehensive
  - beat_style: Writing style key (e.g., "fast-paced-thriller", "slow-burn",
    "investigative-nonfiction", "clean-romance", etc.) — 25+ styles available
  - beat_sheet_template: Story structure (auto, save-the-cat, romance-arc,
    thriller-tension, heros-journey, argument-driven, narrative-nonfiction,
    reference-structured, investigative-nonfiction)
  - spice_level: 0-4 (Fade to Black → Full Intensity)
  - language_intensity: 0-4 (Clean → Raw)
  - author_voice: hemingway, king, morrison, mccarthy, gaiman, gladwell, etc.
  - ai_model: Which AI model to use for generation
  - openrouter_model: Optional OpenRouter model override for erotica routing
  - enforce_genre_content: Boolean for DeepSeek content gate enforcement
  - additional_requirements: Free-text extra instructions

OUTLINE (1:1 with Project)
  - outline_data / outline_url: JSON structure containing scope_lock + chapters array
  - story_bible / story_bible_url: JSON with characters, world rules, themes
  - book_metadata: JSON with title, subtitle, description, keywords
  - status: pending → generating → complete → error

CHAPTER (many per Project)
  - chapter_number, title, summary, prompt
  - scenes: JSON array of scene objects (fiction scene-based path only)
  - content: Chapter prose text (or URL to uploaded file if >30KB)
  - state_document: Post-chapter continuity tracker
  - distinctive_phrases: JSON array of unique literary phrases extracted after generation
  - word_count, quality_scan: JSON with violation counts and warnings
  - status: pending → generating → generated → error

CONVERSATION (many per Project)
  - role: user or assistant
  - content: Message content for the AI book consultant chat

SOURCE FILE (many per Project, or project_id="global")
  - filename, file_type (text, prompt, genre_catalog, style_guide, reference)
  - content, description
  - Global source files are injected into every generation across all projects

PROMPT CATALOG
  - title, content, book_type, genre, category, tags, word_count
  - Browsable library of pre-written book premises/prompts

APP SETTINGS (singleton)
  - ai_model default, typography defaults, layout defaults
  - global_style_instructions, global_content_guidelines
  - auto_generate_all_chapters toggle

USER (built-in)
  - Standard Base44 user entity with role-based access


================================================================================
2. PAGES & UI WORKFLOW
================================================================================

HOME PAGE (pages/Home)
  - Project list with status badges, chapter counts, last-updated timestamps
  - Create new project → navigates to ProjectDetail
  - Delete project (cascading delete via deleteProject backend function)
  - Link to global Settings

PROJECT DETAIL PAGE (pages/ProjectDetail)
  - 4-phase tabbed workflow:

    PHASE 1: SPECIFY (SpecificationTab)
      - Book type (fiction/nonfiction), genre, subgenre selection
      - Topic/premise input with AI idea development (expandPremise function)
      - Target length, chapter count, detail level
      - Beat style selector (25+ writing styles with descriptions)
      - Beat sheet template selector (auto-detect or manual)
      - Spice level (0-4) and language intensity (0-4) sliders
      - Author voice selector (19 voice profiles)
      - AI model selection per project
      - Source files management (per-project)
      - Floating AI chat widget for book concept consultation
      - Prompt catalog browser for browsing pre-written premises
      - "Extract from prompt" feature to auto-populate fields from pasted text

    PHASE 2: GENERATE (GenerateTab)
      - "Generate Outline" button → calls generateOutline backend function
      - Displays: book metadata (title/subtitle/description/keywords),
        full chapter outline with beat assignments, story bible
      - Per-chapter controls: edit prompt, generate scenes, write chapter,
        regenerate, rewrite
      - "Generate All Scenes" for fiction (batch scene generation)
      - "Write All Chapters" for bulk sequential generation
      - Progress tracking with polling for async operations
      - Chapter status indicators (pending/generating/generated/error)

    PHASE 3: EDIT & EXPORT (EditExportTab)
      - Full Quill rich-text editor with all chapters loaded
      - Typography controls (font, size, spacing, margins)
      - Find/Replace functionality with real-time highlighting
      - Status bar (word count, page estimate, reading time)
      - Export formats: HTML, TXT, MD, DOCX
      - Print/PDF preview with paginated layout

    PHASE 4: REVIEW & POLISH (ReviewPolishTab)
      - AI-powered manuscript analysis (quality scoring)
      - Issue tracking with category breakdowns
      - Floating toolbar for text selection → AI rewrite
      - Style-based rewriting (tone/voice adjustments)
      - Bulk fix application

SETTINGS PAGE (pages/Settings)
  - AI model selection (default for new projects)
  - Default values (book type, length, detail level)
  - Typography defaults (body/heading fonts, size, spacing)
  - Layout defaults (margins)
  - Global writing guidelines (injected into every generation)
  - Global source files management

IMPORT PROMPTS PAGE (pages/ImportPrompts)
  - Batch import prompts into PromptCatalog from JSON/URL/file


================================================================================
3. BACKEND FUNCTIONS (GENERATION PIPELINE)
================================================================================

─── OUTLINE GENERATION (generateOutline) ───

1. Receives project_id, loads Specification
2. ROUTING DECISION:
   - Nonfiction → Dedicated Gemini nonfiction generator
   - Fiction → Gemini Pro for outline structure (regardless of user's model choice)
3. STEP-BY-STEP PROCESS:
   a. Generate book metadata (title, subtitle, description, keywords)
   b. Generate story bible (characters with voice profiles, world rules, themes)
   c. Generate scope lock:
      - Fiction: throughline, escalation map, relationship arc, thread register
      - Nonfiction: throughline, escalation map, concept budget, thread register
   d. Auto-detect beat sheet template (or use user's choice):
      Fiction: save-the-cat, romance-arc, thriller-tension, heros-journey
      Nonfiction: argument-driven, narrative-nonfiction, reference-structured,
                  investigative-nonfiction
   e. Assign structural beats to each chapter (function, scene type, tempo)
   f. Generate chapters in batches of 4 (sequential for context awareness)
      - Each chapter gets: title, summary, 100-150 word prompt, scope boundary,
        opens_with, primary_beat, character_development/argument_advance,
        threads_activated, threads_paid_off, must_not_do, transitions
4. Creates Chapter entities in database
5. Uploads outline + story bible as JSON files

─── SCENE GENERATION (generateScenes) ───

Fiction only. Called per-chapter before writing.
1. Loads project spec, story bible, previous chapter content
2. Calculates scene count based on word target
3. Generates structured scene outlines:
   - scene_number, title, location, time, POV, characters_present
   - purpose, emotional_arc, key_action, dialogue_focus
   - sensory_anchor, word_target, extra_instructions
4. Saves scenes JSON to chapter entity

─── CHAPTER WRITING (writeChapter) ───

The core generation function (~2000 lines). Three writing paths:

PATH A: SCENE-BASED FICTION (when scenes are pre-generated)
  - Builds system prompt with: beat style, author voice, character consistency,
    worldbuilding, spice/language levels, content guardrails
  - User message contains each scene's full spec in order
  - Enforces opening/ending type rotation (5 types each, cycling per chapter)

PATH B: NONFICTION
  - Dedicated nonfiction system prompt with:
    - Author's voice (direct address, grounded vignettes, philosophical reflection)
    - Banned fiction patterns (no invented characters, no dialogue scenes)
    - Evidence grounding for investigative nonfiction
    - DeepSeek special constraint block (extra fiction-trap prevention)
  - Opening/ending type rotation (5 types each for nonfiction)
  - Subject deduplication via chapter_subjects_log injection

PATH C: LEGACY FICTION (no scenes)
  - Full system prompt with all quality rules inlined
  - Genre-specific delivery requirements
  - Comprehensive banned phrase list

SHARED FEATURES ACROSS ALL PATHS:
  - Conversation context: Last 3 written chapters included as assistant messages
  - Chapter State Document injection (escalation stage, relationship status,
    open questions from prior chapters)
  - Cross-chapter banned phrases (distinctive phrases from all prior chapters)
  - Physical tic tracking (per-character, 16 tic families)
  - Metaphor cluster tracking (6 families: FIRE, WATER, DARKNESS, CHAOS, EDGE,
    ENCLOSURE — flagged when ≥5 total uses)
  - Structural contract injection (scope boundary, primary beat, must-not-do)
  - Topic tracking (dialogue topic deduplication)
  - Subgenre enforcement in user message
  - Evidence grounding for investigative nonfiction

POST-GENERATION PIPELINE:
  1. Strip scene headers / chapter headings from AI output
  2. Validation checks:
     - Physical tic repetition
     - Metaphor cluster overuse
     - Banned dialogue patterns
     - Intimate scene minimum length (erotica only)
  3. Critical failure → full regeneration with violation notice
  4. Quality scan (scanChapterQuality):
     - ~200 banned phrases across 6 categories
     - Nonfiction fiction-trap detection (invented characters, dialogue runs)
     - Permanent quality rules (pronoun consistency, over-narrated interiority,
       on-the-nose final images, vocabulary repetition)
     - Shape analysis (dialogue percentage, dialogue tennis, arrival-departure)
     - Plot gate check (ending with reflection vs irreversible event)
  5. Auto-rewrite loop (1 pass standard, 2 passes DeepSeek):
     - Only rewrites actionable violations (banned phrases, clichés, fiction traps)
     - Skips non-actionable (metaphor clusters, shape issues, pronoun consistency)
  6. DeepSeek-specific validation (calls deepseekValidator function)
  7. Meta-response detection (AI outputting instructions instead of prose)
  8. Extract distinctive phrases locally (similes, adj+noun pairs, repeated 3-grams)
  9. Upload content as file if >30KB
  10. Save chapter with quality scan results
  11. Auto-trigger generateChapterState for continuity tracking

─── CHAPTER STATE GENERATION (generateChapterState) ───

Called automatically after each chapter is written.
1. Loads chapter content, previous state document, project state log
2. Generates structured state document via Claude (or OpenRouter for erotica):
   - Character locations and emotional states
   - New information established
   - Active/open plot threads
   - Distinctive phrases (permanently banned from reuse)
   - Relationship status
   - Escalation stage (1-6, with target ranges per book position)
   - Final line of chapter
   - Open question for next chapter
3. For nonfiction: extracts subject tag ([TIME PERIOD] | [SUBJECT] | [LOCATION])
4. Appends to cumulative state log (uploads as file if >25KB)
5. Updates project's banned_phrases_log and chapter_subjects_log

─── WRITE ALL CHAPTERS (writeAllChapters) ───

Orchestrator for sequential bulk generation.
1. Finds first non-generated chapter
2. For each pending chapter:
   a. Invokes writeChapter (fires async generation)
   b. Polls chapter status every 5 seconds (max 10 minutes per chapter)
   c. Records success/failure
   d. 10-second pause between chapters for rate limiting
3. Returns aggregate results (completed/failed counts, total time)

─── OTHER BACKEND FUNCTIONS ───

developIdea: AI-powered book concept development chat
expandPremise: Expands a brief idea into a full book premise
extractMetadata: Auto-populates spec fields from pasted prompt text
bookConsultantChat: AI consultant for book concept discussions
generateAllScenes: Batch scene generation for all chapters
deleteProject: Cascading delete (chapters, outline, spec, conversations, source files)
exportProject: Export project data
importPromptsFromFile: Batch import prompts into catalog
seedPromptCatalog: Seed initial prompt library
autoTagCatalog: Auto-tag existing prompts with metadata
getPromptSuggestions: AI-powered prompt suggestions
deepseekValidator: DeepSeek-specific post-generation validation
deepseekBannedPhrases: DeepSeek phrase enforcement
deepseekPromptBuilder: DeepSeek prompt construction
nonfictionSectionSystem: Nonfiction section structure helper
configAuthors: Author voice configuration
configSubgenres: Subgenre configuration
beatSheetEngine: Beat sheet template management and assignment


================================================================================
4. AI PROVIDER ROUTING
================================================================================

OUTLINE GENERATION:
  - Always uses Gemini Pro (best for research structuring and batch JSON)

CHAPTER WRITING:
  - Uses user's selected model from project spec
  - Supported: Claude Opus/Sonnet/Haiku, GPT-4o/4-Turbo, DeepSeek Chat,
    Gemini Pro, OpenRouter (Llama 3.1 70B for erotica)
  - OpenRouter specifically used for erotica genre routing

STATE DOCUMENT GENERATION:
  - Claude Sonnet (default)
  - OpenRouter for erotica genre

IDEA DEVELOPMENT / CHAT:
  - Uses Base44's built-in InvokeLLM integration


================================================================================
5. QUALITY ENFORCEMENT SYSTEMS
================================================================================

A. BANNED PHRASE SYSTEM
   - ~200 banned phrases across 6 categories:
     1. Physical reactions (heart racing, pulse quickened, etc.)
     2. Atmosphere clichés (intoxicating, shadows danced, etc.)
     3. Narration clichés (in that moment, just the beginning, etc.)
     4. Dialogue clichés (what do you truly want, etc.)
     5. Show-don't-tell patterns (he felt, she felt, etc.)
     6. Ending patterns (ready to embrace, whatever lay ahead, etc.)

B. CROSS-CHAPTER REPETITION PREVENTION
   - Distinctive phrase extraction after each chapter
   - All phrases permanently banned from reuse
   - Physical tic tracking per character (16 tic families)
   - Metaphor cluster tracking (6 families, flagged at ≥5 total uses)
   - Dialogue topic tracking (overused themes banned from reuse)

C. STRUCTURAL ENFORCEMENT
   - Beat sheet assignment (function, scene type, tempo per chapter)
   - Scope lock (throughline, escalation map, thread register)
   - Opening/ending type rotation (5 types, cycling per chapter)
   - Plot gate check (must end with irreversible event, not reflection)
   - Shape analysis (dialogue percentage, tennis pattern, arrival-departure)

D. NONFICTION-SPECIFIC
   - Fiction-trap detection (invented characters, dialogue runs, internal monologue)
   - Subject deduplication via chapter_subjects_log
   - Evidence grounding enforcement for investigative nonfiction
   - DeepSeek absolute nonfiction constraint block

E. CONTENT GUARDRAILS
   - All sexual content must involve adults (18+)
   - Consent must be clear
   - No content involving minors
   - No real-world harmful instructions
   - No hate group glorification
   - These cannot be overridden by any setting

F. AUTO-REWRITE SYSTEM
   - Post-generation quality scan
   - Actionable violations → automatic AI rewrite pass
   - Non-actionable violations → logged but not rewritten
   - DeepSeek gets 2 rewrite passes, other models get 1
   - Nonfiction fiction-trap violations → specialized nonfiction editor rewrite


================================================================================
6. CHAPTER STATE DOCUMENT SYSTEM (CONTINUITY TRACKER)
================================================================================

After each chapter is written and accepted:
1. Claude/OpenRouter generates a structured state document tracking:
   - Final location of each character
   - Physical and emotional state of each character
   - New information established (what the reader now knows)
   - Plot threads activated and still open
   - Distinctive phrases used (banned from reuse)
   - Relationship status between central characters
   - Escalation stage (1-6)
   - Exact final line of chapter
   - Open question carried into next chapter

2. State documents are concatenated into a cumulative log
3. The log is injected into subsequent chapter generation prompts
4. For nonfiction: subject tags are extracted and logged to prevent duplicates

ESCALATION STAGE GUIDE:
  - Ch 1-25%:  Stage 1-2 (establish world, introduce tension)
  - Ch 25-50%: Stage 3-4 (cost of choices, first breach)
  - Ch 50-75%: Stage 4-5 (consequences, no retreat)
  - Ch 75-95%: Stage 5-6 (execution, no new plot)
  - Final ch:  Stage 6 (resolution)


================================================================================
7. BEAT SHEET SYSTEM
================================================================================

FICTION TEMPLATES:
  - Save the Cat (16 beats)
  - Romance Arc (14 beats)
  - Thriller/Suspense Arc (13 beats)
  - Hero's Journey (12 beats)

NONFICTION TEMPLATES:
  - Argument-Driven (13 beats)
  - Narrative Nonfiction (12 beats)
  - Reference/Educational (11 beats)
  - Investigative/Exposé (11 beats)

AUTO-DETECTION:
  - Genre string is analyzed to select the best template
  - Each beat has: position (0-1), name, function, scene_type, tempo
  - Beats are mapped to chapter numbers proportionally
  - Conflicts (multiple beats per chapter) resolved by priority

BEAT FUNCTIONS (Fiction):
  SETUP, DISRUPTION, COMMITMENT, REACTION, PROMISE_OF_PREMISE, REVERSAL,
  ESCALATION, CRISIS, REFLECTION, RECOMMITMENT, SUBPLOT, CLIMAX, RESOLUTION,
  CONNECTIVE_TISSUE

BEAT FUNCTIONS (Nonfiction):
  PROVOCATIVE_OPENING, PROBLEM_STATEMENT, DEMOLITION, THESIS_INTRODUCTION,
  EVIDENCE_BLOCK, COUNTERARGUMENT, REFRAME, PRACTICAL_APPLICATION, SYNTHESIS,
  TRANSFORMATION_EVIDENCE, CALL_TO_ACTION, COLD_OPEN, CONTEXT_SETTING,
  CHARACTER_INTRODUCTION, INCITING_EVENT, EVIDENCE_TRAIL, COMPLICATION,
  TURNING_POINT, CONSEQUENCES, ESCALATION_NF, AFTERMATH, THEMATIC_SYNTHESIS,
  CLOSING_IMAGE, MOTIVATION, FOUNDATION, CONCEPT_BLOCK, INTEGRATION,
  TROUBLESHOOTING, ADVANCED_BLOCK, CASE_STUDY_NF, ROADMAP, ANOMALY,
  OFFICIAL_NARRATIVE, FIRST_EVIDENCE, PATTERN_RECOGNITION, CAST_OF_CHARACTERS,
  MECHANISM, COVER_UP, IMPACT, CONFRONTATION_NF, AFTERMATH_NF, SYSTEMIC_ANALYSIS


================================================================================
8. WRITING STYLE SYSTEM
================================================================================

25+ BEAT STYLES available, each with detailed instructions for:
  - Core identity / prose feel
  - Sentence rhythm and paragraph structure
  - Pacing rules
  - Emotional handling
  - Dialogue style
  - Scene structure
  - Ending rules

STYLES INCLUDE:
  Fast-Paced Thriller, Gritty Cinematic, Hollywood Blockbuster, Slow Burn,
  Steamy Romance, Slow Burn Romance, Dark Erotica, Clean Romance,
  Faith-Infused Contemporary, Investigative Nonfiction, Reference/Educational,
  Intellectual Psychological, Dark Suspense, Satirical, Epic Historical,
  Whimsical Cozy, Hard-Boiled Noir, Grandiose Space Opera, Visceral Horror,
  Poetic Magical Realism, Clinical Procedural, Hyper-Stylized Action,
  Nostalgic Coming-of-Age, Cerebral Sci-Fi, High-Stakes Political,
  Surrealist Avant-Garde, Melancholic Literary, Urban Gritty Fantasy

19 AUTHOR VOICE PROFILES:
  Hemingway, King, Austen, Tolkien, Morrison, Rowling, McCarthy, Atwood,
  Gaiman, Pratchett, Le Guin, Vonnegut, García Márquez, Chandler, Christie,
  Gladwell, Bryson, Sagan, Didion


================================================================================
9. CONTENT LEVEL SYSTEM
================================================================================

SPICE LEVELS (Romantic/Sexual Content):
  0: Fade to Black (no sexual content)
  1: Closed Door (implied, never shown)
  2: Cracked Door (partial, tasteful, R-rated)
  3: Open Door (explicit, emotionally grounded)
  4: Full Intensity (no restrictions, literary erotica)

LANGUAGE INTENSITY (Profanity):
  0: Clean (no profanity)
  1: Mild (damn, hell, ass — max 2-3 per chapter)
  2: Moderate (occasional F-word at emotional peaks)
  3: Strong (during danger/anger/betrayal)
  4: Raw (harsh and frequent, trauma/survival contexts)


================================================================================
10. COMPONENT ARCHITECTURE
================================================================================

PAGES:
  - Home (project list)
  - ProjectDetail (4-phase workflow hub)
  - Settings (global configuration)
  - ImportPrompts (prompt catalog management)

PROJECT COMPONENTS:
  - SpecificationTab (book configuration, AI chat, prompt browser)
  - GenerateTab (outline + chapter generation orchestration)
  - EditExportTab (Quill editor, typography, find/replace, export)
  - ReviewPolishTab (AI manuscript analysis, rewriting tools)
  - ConversationTab (AI book consultant chat)
  - SourceFilesTab (per-project source file management)
  - DeleteProjectDialog
  - WriteAllChaptersModal (bulk generation progress UI)
  - BeatStyleSelector, AuthorVoiceSelector, BeatBadge
  - PromptCatalogBrowser, PromptSuggestions
  - ModelSuggestionPanel, SceneSection, SpecSettingsSummary
  - ChaptersTab, OutlineTab, SourceFilesCard

SHARED COMPONENTS:
  - StatusBadge, EmptyState, AIModelComparison, UserNotRegisteredError

LAYOUT:
  - Sticky header with logo, mobile/desktop toggle, hamburger menu
  - Save/Settings/Delete actions in dropdown
  - Mobile-responsive with comprehensive CSS overrides


================================================================================
END OF BREAKDOWN
================================================================================