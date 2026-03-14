# MASTER BOOK ENGINE — Bot Architecture Specification
## Version 1.0 — March 2026

---

# EXECUTIVE SUMMARY

Replace the current monolithic `writeChapter.ts` (1,989 lines) and frontend-driven daisy chain with **6 focused bots**, each owning one complete workflow step. The orchestrator calls them in sequence. Each bot receives a clean input and returns a clean output. No polling. No multi-step retry loops spanning frontend and backend. No fire-and-forget side effects.

**Current architecture:** Frontend loop → `writeChapter.ts` (does everything) → polls → `generateChapterState` (fire-and-forget)

**Target architecture:** Frontend → Orchestrator Bot → Scene Architect → Prose Writer → Continuity Guardian → Style Enforcer → State Chronicler → done

---

# CURRENT DAISY CHAIN MAP

These are the exact breakpoints in the current code where failures cascade.

## Frontend Loop (GenerateTab.jsx, lines 1035–1212)

```
handleWriteAllChapters()
├── Phase 1: for each chapter needing scenes:
│   ├── invoke('generateScenes')          ← can fail: 500, timeout
│   └── poll chapter.scenes 45x @ 2s      ← can stall: never arrives
├── invoke('writeAllChapters')             ← can fail: 500, auth
├── Phase 2: for each chapter to write:
│   ├── writeAndPollChapter()
│   │   ├── invoke('writeChapter')         ← fires async, 504 common
│   │   └── poll chapter.status @ 3s       ← 12-min max, stale detection
│   ├── on success:
│   │   ├── fetch updated word counts      ← can fail silently
│   │   ├── invoke('generateChapterState') ← FIRE AND FORGET, often fails
│   │   └── sleep 3 seconds
│   └── on failure: push to failedChapters, continue
└── set done state
```

**Problem:** 7 potential failure points PER CHAPTER. A 20-chapter book has 140+ potential break points.

## Backend Monolith (writeChapter.ts, lines 1160–1897)

```
generateChapterAsync()
├── Load 6 entity types (chapters, specs, outlines, sourceFiles, globalSourceFiles, appSettings)
├── Parse outline data (with URL fallback)
├── Parse story bible (with URL fallback)
├── Determine fiction/nonfiction/scene/legacy path
├── Build system prompt (40+ conditional blocks concatenated)
├── Build user message
├── Call AI → get raw prose                      ← BREAK POINT 1: API timeout/refusal
├── If refusal → rebuild & retry                 ← BREAK POINT 2: retry may also refuse
├── If Gemini → quality verify loop (2x)         ← BREAK POINT 3: each is another API call
├── If GPT/DS/Gemini → volume verify loop (2x)   ← BREAK POINT 4: another API call per retry
├── Prose compliance gate → retry loop (3x)      ← BREAK POINT 5: up to 3 MORE API calls
├── If nonfiction → ending enforcement           ← BREAK POINT 6: another API call
├── Composite figure check
├── Full quality scan (50+ regex patterns)
├── invoke('modelAdapter') for structural check   ← BREAK POINT 7: cross-function call
├── Extract distinctive phrases
├── Extract named characters
├── Save to DB                                    ← BREAK POINT 8: entity update can fail
├── invoke('consistencyCheck')                    ← BREAK POINT 9: fire-and-forget
└── catch → mark chapter error
```

**Problem:** A single chapter generation can make 4–8 sequential AI calls inside the same function. If call #6 fails, calls 1–5 are wasted. The function has no checkpointing — it's all or nothing.

---

# BOT ARCHITECTURE

## Shared Infrastructure

### Unified AI Router (extracted from writeChapter.ts lines 7–83)

Every bot uses the same router. Currently, `callAI` is copy-pasted into `writeChapter.ts`, `generateScenes.ts`, `generateChapterState.ts`, and `modelAdapter.ts` with slightly different MODEL_MAP values. This must become ONE shared module.

**File:** `functions/shared/aiRouter.ts`

```
callAI(modelKey, systemPrompt, userMessage, options) → string
```

**Migrates from:**
- `writeChapter.ts` lines 22–83 (MODEL_MAP + callAI)
- `generateScenes.ts` lines 4–77 (duplicate MODEL_MAP + callAI)
- `generateChapterState.ts` lines 16–52 (callClaude + callOpenRouter)
- `modelAdapter.ts` — removes the need for cross-function callAI

### Unified Model Resolver (extracted from writeChapter.ts line 4)

**File:** `functions/shared/resolveModel.ts`

```
resolveModel(callType, spec) → modelKey string
```

Current callType map (preserved exactly):

| callType | Default Model | Notes |
|---|---|---|
| `outline` | gemini-pro | Phase 2 structural |
| `beat_sheet` | gemini-pro | Phase 2 structural |
| `sfw_prose` | spec.writing_model or claude-sonnet | User's chosen model |
| `explicit_scene` | deepseek-chat | Lumimaid via OpenRouter |
| `post_gen_rewrite` | claude-sonnet | Style Enforcer will own this |
| `consistency_check` | claude-sonnet | Continuity Guardian will own this |
| `chapter_state` | claude-sonnet | State Chronicler will own this |
| `style_rewrite` | claude-sonnet | Style Enforcer will own this |
| `cover_prompt` | claude-sonnet | Future bot |
| `keyword_generation` | claude-sonnet | Future bot |
| `kdp_description` | claude-sonnet | Future bot |

### Data Loader (extracted from writeChapter.ts lines 1928–1971)

Every bot needs project data. Currently each function loads its own. This becomes one shared loader.

**File:** `functions/shared/dataLoader.ts`

```
loadProjectContext(base44, projectId) → {
  chapters: Chapter[],
  spec: Specification,
  outline: Outline,
  outlineData: parsed JSON,
  storyBible: parsed JSON,
  sourceFiles: SourceFile[],
  appSettings: AppSettings,
  project: Project,
}
```

**Migrates from:**
- `writeChapter.ts` lines 1928–1971 (entity loading)
- `writeChapter.ts` lines 1955–1970 (outline/bible URL fallback parsing)
- `generateScenes.ts` lines 143–168 (duplicate entity loading)
- `generateChapterState.ts` lines 80–108 (duplicate entity loading)

---

## BOT 1 — Scene Architect

**One job:** Produce a scene-by-scene structural breakdown for a single chapter.

### Current Code This Replaces

| File | Lines | What |
|---|---|---|
| `generateScenes.ts` | 1–375 (entire file) | Fiction scene generation |
| `generateScenes.ts` | 143–253 | Nonfiction beat sheet generation |
| `writeChapter.ts` | 1629–1666 | Scene parsing + scene section assembly |
| `beatSheetEngine.ts` | 1–645 (entire file) | Beat sheet generation (if used) |
| Frontend: `GenerateTab.jsx` | 1077–1103 | Phase 1 scene generation loop with polling |

### Function Signature

```
File: functions/bots/sceneArchitect.ts

Input: {
  project_id: string,
  chapter_id: string,
}

Output: {
  scenes: Scene[],              // structured scene objects (same schema as current)
  nonfiction_beat_sheet?: object, // if nonfiction path
  chapter_id: string,
}

Scene schema (unchanged from current):
{
  scene_number: number,
  title: string,
  location: string,
  time: string,
  pov: string,
  characters_present: string[],
  purpose: string,
  emotional_arc: string,
  key_action: string,
  dialogue_focus: string | null,
  sensory_anchor: string,
  extra_instructions: string,
  word_target: number,
}
```

### Internal Flow

1. Load project context via shared dataLoader
2. Determine fiction vs nonfiction from `spec.book_type`
3. Build scene generation prompt (currently in `generateScenes.ts` lines 303–351)
4. Call AI via shared router (callType: `beat_sheet`, model: gemini-pro)
5. Parse JSON response (with AI-assisted repair fallback — currently lines 98–117)
6. Save scenes to Chapter entity
7. Return structured result

### Key Principle

Scene Architect NEVER writes prose. It produces structure only. The Prose Writer receives this structure as input.

### Anti-Regression Rule

Currently `generateScenes.ts` has its own copy of MODEL_MAP (line 4) that drifts from `writeChapter.ts`. The Scene Architect must import from `shared/aiRouter.ts` — no local MODEL_MAP copies.

---

## BOT 2 — Prose Writer

**One job:** Given a fully assembled prompt, write raw chapter prose. No validation. No compliance. No retries.

### Current Code This Replaces

| File | Lines | What |
|---|---|---|
| `writeChapter.ts` | 1160–1509 | System prompt assembly (fiction, nonfiction, erotica paths) |
| `writeChapter.ts` | 1545–1575 | Message array construction (prev chapter context, act bridges) |
| `writeChapter.ts` | 1628–1700 | User message assembly (scene-based + legacy) |
| `writeChapter.ts` | 1700–1810 | The actual AI call + refusal detection + first-pass cleanup |
| `writeChapter.ts` | 84–150 | BEAT_STYLES, ASP, SPICE_LEVELS, LANGUAGE_INTENSITY definitions |
| `writeChapter.ts` | 150–220 | All prompt block builders (prose rules, author mode, quality upgrades, etc.) |
| `modelAdapter.ts` | 166–323 | Prompt adaptation per model (header style, format injection, context trimming) |

### Function Signature

```
File: functions/bots/proseWriter.ts

Input: {
  project_id: string,
  chapter_id: string,
  model_override?: string,   // optional: force a specific model
}

Output: {
  raw_prose: string,          // the chapter text, no validation applied
  word_count: number,
  model_used: string,
  generation_time_ms: number,
  refusal_detected: boolean,  // if true, raw_prose is the best attempt after 1 retry
  chapter_id: string,
}
```

### Internal Flow

1. Load project context via shared dataLoader
2. Load chapter's scenes (produced by Scene Architect)
3. Build system prompt by path:
   - Fiction + scenes → scene-based system prompt (current lines 1260–1340)
   - Fiction + no scenes → legacy system prompt (current lines 1373–1509)
   - Nonfiction → nonfiction system prompt (current `_buildNonfictionSystemPrompt`)
   - Erotica → fiction + erotica directives (current lines 1511–1530)
4. Build user message by path:
   - Scene-based → scene sections with opening/ending types (current lines 1629–1700)
   - Nonfiction → `_buildNonfictionUserMessage`
   - Legacy → outline-based user message (current lines 1700–1810)
5. Apply model-specific adaptation via `adaptPromptForModel` from modelAdapter
6. Single AI call via shared router (callType: `sfw_prose`)
7. If refusal detected → one retry with refusal-busting prompt prefix
8. Strip markdown fences, scene headers, chapter headers (current cleanup regexes)
9. Return raw prose — DO NOT validate, DO NOT compliance-check

### Key Principle

The Prose Writer is **write-only**. It doesn't know about banned phrases, frequency caps, or continuity rules. Those are downstream bots' jobs. This keeps the writer's context window clean — no 2,000 characters of repetition governor rules competing with the actual story.

### Prompt Block Migration Map

These blocks move FROM `writeChapter.ts` INTO `proseWriter.ts`:

| Block | Current Location | Purpose |
|---|---|---|
| `buildCtxHeader()` | line 119 | Project context header |
| `buildAuthorModeBlock()` | lines 193–219 | Author mode directive |
| `CONTENT_GUARDRAILS` | lines 140–147 | Safety rails |
| `getBeatStyleInstructions()` | line 117 | Beat style injection |
| `getSpiceLevelInstructions()` | lines 286–290 | Spice level rules |
| `getLanguageIntensityInstructions()` | lines 292–296 | Language intensity rules |
| `getAuthorStyleBlock()` | line 115 | Author voice injection |
| `OUTPUT_FORMAT_RULES` | lines 170–183 | Output formatting |
| `QUALITY_UPGRADES` | line 168 | Interiority, subtext, endings |
| `PLOT_SUBTEXT_RULES` | lines 630–635 | Subtext enforcement |
| `DIALOGUE_SUBTEXT_RULES_CONCISE` | lines 637–649 | Dialogue rules |
| `INTIMATE_SCENE_RULES` | line 628 | Erotica scene structure |
| `buildFictionProseRules()` | line 118 | Fiction prose bans+caps |
| `buildProtagonistInteriorityBlock()` | referenced at line 1506 | POV interiority |
| `buildEmotionalAccumulationBlock()` | referenced at line 1507 | Emotional pacing |
| `buildResolutionTextureBlock()` | referenced at line 1343 | Resolution chapter rules |

These blocks move FROM `writeChapter.ts` INTO `proseWriter.ts` as CONTEXT INJECTION (not rules):

| Block | Current Location | Purpose |
|---|---|---|
| `buildCharacterConsistencyBlock()` | lines 380–396 | Character attribute lock |
| `buildCanonicalBackstoryBlock()` | lines 368–377 | Backstory lock |
| `buildFiredBeatsBlock()` | lines 315–332 | Prevent beat duplication |
| `buildCapabilitiesBlock()` | lines 336–345 | Character capability limits |
| `buildAllegianceShiftBlock()` | lines 348–365 | Allegiance shift detection |
| `buildCharacterRegistryBlock()` | lines 426–434 | Name collision prevention |
| `buildUnifiedStateDocument()` | lines 399–423 | Previous chapter state |

---

## BOT 3 — Continuity Guardian

**One job:** Read the raw prose against the story bible, outline, and previous state documents. Find every continuity violation. Return a verdict.

### Current Code This Replaces

| File | Lines | What |
|---|---|---|
| `writeChapter.ts` | 380–396 | `buildCharacterConsistencyBlock` (pre-gen) |
| `writeChapter.ts` | 348–365 | `buildAllegianceShiftBlock` (pre-gen) |
| `writeChapter.ts` | 336–345 | `buildCapabilitiesBlock` (pre-gen) |
| `writeChapter.ts` | 652–730 | `validatePermanentRules` (post-gen) |
| `writeChapter.ts` | 955–963 | `checkCompositeFigureFraming` (post-gen) |
| `writeChapter.ts` | 1886–1887 | Structural validation via modelAdapter call |
| `writeChapter.ts` | 1897 | `consistencyCheck` fire-and-forget call |
| `consistencyCheck.ts` | 1–129 (entire file) | Separate consistency check function |
| `modelAdapter.ts` | 560–607 | `validateActTransition` |

### Function Signature

```
File: functions/bots/continuityGuardian.ts

Input: {
  project_id: string,
  chapter_id: string,
  raw_prose: string,           // from Prose Writer
}

Output: {
  passed: boolean,
  violations: Violation[],
  suggested_fixes: Fix[],      // targeted text replacements, not full regens
  chapter_id: string,
}

Violation schema:
{
  type: 'pronoun_mismatch' | 'character_missing' | 'timeline_break' |
        'capability_exceeded' | 'allegiance_unacknowledged' |
        'name_collision' | 'backstory_contradiction' |
        'composite_unframed' | 'act_transition_break' | 'dead_character_appears',
  severity: 'critical' | 'warning',
  character: string,          // which character is affected
  location: string,           // approximate position in prose (first 50 chars of context)
  description: string,        // human-readable explanation
}

Fix schema:
{
  violation_index: number,     // which violation this fixes
  original_text: string,       // the offending text
  replacement_text: string,    // the corrected text
  confidence: 'high' | 'medium',
}
```

### Internal Flow

1. Load project context via shared dataLoader
2. Load all previous state documents from chapters
3. Build a VERIFICATION DOCUMENT containing:
   - Character registry (names, genders, pronouns, roles, capabilities)
   - Previous chapter's state document (locations, emotional states, open threads)
   - Outline entry for THIS chapter (what should happen)
   - Act bridge documents (if crossing an act boundary)
4. Call AI with the verification document + raw prose (callType: `consistency_check`, model: claude-sonnet, temp: 0.2)
   - Prompt instructs: "Read this chapter. Compare against the verification document. List every contradiction."
5. Parse AI response into structured violations
6. For each critical violation: generate a targeted fix (specific text replacement)
7. Run regex-based checks that don't need AI:
   - Pronoun consistency check (from `validatePermanentRules` lines 656–682)
   - Composite figure framing check (from `checkCompositeFigureFraming` lines 955–963)
   - Act transition validation (from `modelAdapter.ts` lines 560–607)
8. Return verdict

### Key Principle

The Continuity Guardian is READ-ONLY against the prose. It doesn't rewrite the chapter — it returns a verdict with targeted fixes. The **Orchestrator** decides whether to send fixes to the Style Enforcer for application or to send the prose back to the Prose Writer with violation context.

### When Continuity Guardian Triggers a Rewrite

If `passed: false` AND any violation has `severity: 'critical'`:
- Orchestrator sends the prose back to Prose Writer with violation list injected into prompt
- Prose Writer regenerates with: "CONTINUITY VIOLATIONS FOUND IN PRIOR DRAFT: [list]. Fix these while writing."
- Maximum 1 rewrite cycle (current system allows 3, causing timeouts)

---

## BOT 4 — Style Enforcer

**One job:** Take prose that passed continuity check. Fix every style violation in-place. Return clean prose.

### Current Code This Replaces

| File | Lines | What |
|---|---|---|
| `writeChapter.ts` | 120–122 | `enforceProseCompliance()` (banned phrases, freq caps, dynamic caps, scene endings) |
| `writeChapter.ts` | 124 | `checkSceneEnding()` |
| `writeChapter.ts` | 151–166 | `buildRepetitionGovernorBlock()` + REPETITION_GOVERNOR_CAPS |
| `writeChapter.ts` | 233–262 | `verifyGeminiProse()` (volume, padding, purple prose, passive voice) |
| `writeChapter.ts` | 732–983 | `scanChapterQuality()` + `scanNonfictionQuality()` (50+ pattern checks) |
| `writeChapter.ts` | 940–953 | `enforceNonfictionEnding()` (AI-powered ending rewrite) |
| `writeChapter.ts` | 1104–1140 | `rewriteWithCorrections()` (AI-powered rewrite on violation) |
| `writeChapter.ts` | 1835–1860 | Gemini quality verification loop |
| `writeChapter.ts` | 1841–1860 | Volume verification gate (GPT/DS/Gemini) |
| `writeChapter.ts` | 1861–1876 | Pre-output compliance gate retry loop |
| `writeChapter.ts` | 1877–1883 | Post-gen nonfiction ending enforcement + quality scan |
| `writeChapter.ts` | 149 | BANNED_CONSTRUCTIONS_ALL_GENRES |
| `writeChapter.ts` | 168 | QUALITY_UPGRADES (post-gen enforcement) |
| `writeChapter.ts` | 185–191 | PERMANENT_QUALITY_RULES |
| `deepseekBannedPhrases.ts` | entire file | DeepSeek-specific banned phrases |
| `deepseekValidator.ts` | entire file | DeepSeek output validation |

### Function Signature

```
File: functions/bots/styleEnforcer.ts

Input: {
  project_id: string,
  chapter_id: string,
  prose: string,              // from Continuity Guardian (post-check)
  continuity_fixes?: Fix[],   // optional fixes from Guardian to apply first
}

Output: {
  clean_prose: string,         // violations fixed in-place
  word_count: number,
  violations_found: number,
  violations_fixed: number,
  violations_remaining: StyleViolation[],  // unfixable without full regen
  quality_report: QualityReport,
  chapter_id: string,
}

StyleViolation schema:
{
  type: 'banned_phrase' | 'frequency_cap' | 'dynamic_cap' | 'weak_ending' |
        'purple_prose' | 'passive_voice' | 'padding' | 'volume_short' |
        'nf_fiction_trap' | 'nf_thesis_ending' | 'meta_response' |
        'over_narrated' | 'on_the_nose_ending' | 'vocabulary_repetition' |
        'dialogue_cliche' | 'physical_tic_overuse',
  label: string,
  count: number,
  max: number,
  fixed: boolean,
}

QualityReport schema:
{
  passed: boolean,
  total_violations: number,
  fixed_violations: number,
  remaining_violations: number,
  word_count: number,
  scene_count: number,
  banned_phrase_count: number,
  nonfiction_warnings: string[],
}
```

### Internal Flow

1. Load project context (spec for beat style, language intensity, spice level, author voice)
2. Load previous chapters' content for dynamic cap calculation
3. **Phase A — Regex-based fixes (no AI needed):**
   - Apply continuity fixes from Guardian (simple text replacements)
   - Scan for banned constructions (from BANNED_CONSTRUCTIONS_ALL_GENRES)
   - Scan for frequency cap violations (REPETITION_GOVERNOR_CAPS)
   - Scan for dynamic caps (top words from previous chapter)
   - Scan for physical tic overuse (from `extractPhysicalTics`)
   - Scan for dialogue clichés (from `extractDialogueClichés`)
   - Scan for metaphor cluster overuse (from `extractMetaphorClusters`)
   - Check scene endings (from `checkSceneEnding`)
   - Check nonfiction patterns (from `scanNonfictionQuality`)
   - Log all violations found
4. **Phase B — AI-powered targeted fixes (ONE call, not a retry loop):**
   - Collect all violations into a single fix instruction
   - Call AI (callType: `style_rewrite`, model: claude-sonnet, temp: 0.3)
   - Prompt: "Here is a chapter with specific violations marked. Rewrite ONLY the violated passages. Preserve everything else exactly."
   - This replaces the current 3-attempt compliance loop + 2-attempt volume loop + 2-attempt Gemini quality loop (up to 7 AI calls → now 1)
5. **Phase C — Nonfiction ending enforcement (if applicable):**
   - Check if final paragraph contains thesis restatement or poetry
   - If so: single AI call to rewrite final 2–3 sentences (callType: `consistency_check`)
6. Run final quality scan (all 50+ patterns) as READ-ONLY report
7. Return clean prose + report

### Key Principle

The Style Enforcer FIXES violations rather than asking the Prose Writer to regenerate. This is the critical architectural change — instead of "write the whole chapter again but without these problems" (which introduces NEW problems every time), it's "here are 6 specific passages that violate rules, rewrite just those."

---

## BOT 5 — State Chronicler

**One job:** After a chapter is finalized, generate the state document and update all project-level tracking.

### Current Code This Replaces

| File | Lines | What |
|---|---|---|
| `generateChapterState.ts` | 1–281 (entire file) | State document generation |
| `writeChapter.ts` | 436–465 | `extractDistinctivePhrases()` |
| `writeChapter.ts` | 467–468 | `extractNamedCharacters()` |
| `writeChapter.ts` | 470–530 | `extractPhysicalTics()` |
| `writeChapter.ts` | 536–626 | `extractMetaphorClusters()` + `extractDialogueClichés()` |
| `writeChapter.ts` | 1891–1896 | Post-save: distinctive phrases, name registry, quality scan |
| Frontend: `GenerateTab.jsx` | 1168–1171 | Fire-and-forget `generateChapterState` call |

### Function Signature

```
File: functions/bots/stateChronicler.ts

Input: {
  project_id: string,
  chapter_id: string,
  final_prose: string,         // from Style Enforcer (clean)
  quality_report: QualityReport, // from Style Enforcer
}

Output: {
  state_document: string,      // structured state doc (same format as current)
  distinctive_phrases: string[],
  updated_name_registry: object,
  physical_tics: object,
  banned_phrases_added: string[],
  subject_line?: string,       // nonfiction only
  ending_type: string,
  escalation_stage: number,
  chapter_id: string,
}
```

### Internal Flow

1. Load project context via shared dataLoader
2. Load previous state documents and existing banned phrases
3. **Phase A — Extraction (no AI needed):**
   - Extract distinctive phrases (from `extractDistinctivePhrases`)
   - Extract named characters (from `extractNamedCharacters`)
   - Extract physical tics (from `extractPhysicalTics`)
   - Extract metaphor clusters (from `extractMetaphorClusters`)
4. **Phase B — AI state generation (ONE call):**
   - Call AI (callType: `chapter_state`, model: claude-sonnet, temp: 0.3)
   - Same prompt structure as current `generateChapterState.ts` lines 118–152
   - Includes: character locations, emotional states, plot threads, fired beats, relationship status, ending type, escalation stage
5. **Phase C — Auto-classify ending type if AI omitted it** (regex fallback, current lines 168–178)
6. **Phase D — Persistence:**
   - Save state document to Chapter entity
   - Append to project's cumulative state log (upload as file if large)
   - Update project's banned_phrases_log
   - Update project's name_registry
   - Update project's chapter_subjects_log (nonfiction)
7. Return all extracted data

### Key Principle

The State Chronicler is the ONLY bot that writes to project-level state. No other bot modifies `banned_phrases_log`, `name_registry`, `chapter_state_log`, or `chapter_subjects_log`. This eliminates the current race condition where `generateChapterState` runs fire-and-forget and may not complete before the next chapter starts reading state.

---

## BOT 6 — Orchestrator

**One job:** Coordinate the other 5 bots for single-chapter or full-book generation.

### Current Code This Replaces

| File | Lines | What |
|---|---|---|
| `writeChapter.ts` | 1909–1989 | Deno.serve endpoint (entity loading, chapter dispatch) |
| `writeChapter.ts` | 1160–1897 | `generateChapterAsync` (the entire monolith) |
| `writeAllChapters.ts` | 1–56 (entire file) | Prep function for write-all |
| Frontend: `GenerateTab.jsx` | 878–985 | `writeAndPollChapter` (polling loop) |
| Frontend: `GenerateTab.jsx` | 1035–1212 | `handleWriteAllChapters` (outer loop) |
| Frontend: `GenerateTab.jsx` | 1218–1320 | `handleResumeFromChapter` (resume loop) |

### Function Signature

```
File: functions/bots/orchestrator.ts

// Single chapter endpoint
Input (single): {
  action: 'write_chapter',
  project_id: string,
  chapter_id: string,
}

// Full book endpoint
Input (all): {
  action: 'write_all',
  project_id: string,
  start_from?: number,  // resume from chapter N
}

// Status check endpoint
Input (status): {
  action: 'status',
  project_id: string,
}

Output (single): {
  success: boolean,
  chapter_id: string,
  word_count: number,
  quality_report: QualityReport,
  violations_remaining: number,
  generation_time_ms: number,
  bot_timings: {
    scene_architect_ms: number,
    prose_writer_ms: number,
    continuity_guardian_ms: number,
    style_enforcer_ms: number,
    state_chronicler_ms: number,
  },
}

Output (all): {
  success: boolean,
  chapters_written: number,
  chapters_failed: number,
  total_words: number,
  total_time_ms: number,
  failed_chapters: { chapter_number: number, error: string }[],
}

Output (status): {
  current_chapter: number,
  current_bot: string,       // which bot is active
  chapters_complete: number,
  chapters_remaining: number,
  total_words: number,
}
```

### Internal Flow — Single Chapter

```
orchestrate_chapter(project_id, chapter_id):
  
  1. Update chapter status → 'generating'
  
  2. SCENE ARCHITECT
     └── If chapter has no scenes: call sceneArchitect
     └── If chapter has scenes: skip (already generated)
  
  3. PROSE WRITER
     └── Call proseWriter → get raw_prose
     └── If refusal_detected AND no usable prose: mark error, return
  
  4. CONTINUITY GUARDIAN
     └── Call continuityGuardian(raw_prose)
     └── If critical violations AND confidence=high on fixes:
     │   └── Apply fixes, proceed to Style Enforcer
     └── If critical violations AND fixes uncertain:
     │   └── Call proseWriter ONCE MORE with violations in prompt
     │   └── Call continuityGuardian again on new prose
     │   └── If still failing: proceed anyway, log warnings
     └── If passed: proceed
  
  5. STYLE ENFORCER
     └── Call styleEnforcer(prose, continuity_fixes)
     └── Always proceeds — unfixable violations logged but don't block
  
  6. STATE CHRONICLER
     └── Call stateChronicler(clean_prose, quality_report)
     └── MUST complete before next chapter starts (not fire-and-forget)
  
  7. SAVE
     └── Update chapter: content, status='generated', word_count, quality_scan
     └── Return result
```

### Internal Flow — Full Book

```
orchestrate_all(project_id, start_from?):

  1. Load all chapters, sort by chapter_number
  2. Filter to pending/error chapters (or from start_from onward)
  3. Update project status → 'writing'
  
  4. FOR EACH chapter (sequential):
     └── Update project: current_chapter = N, current_bot = 'starting'
     └── result = orchestrate_chapter(project_id, chapter_id)
     └── If result.success:
     │   └── Increment success count, accumulate word count
     │   └── WAIT for State Chronicler to fully complete
     │   └── Brief pause (1s) for rate limiting
     └── If result.error:
     │   └── Log failure
     │   └── Continue to next chapter (don't stop the whole book)
  
  5. Update project status → 'complete'
  6. Return summary
```

### Key Architectural Change — No More Frontend Polling

Currently: Frontend fires `writeChapter`, then polls every 3 seconds for up to 12 minutes per chapter. Gateway 504s are common. The frontend has elaborate stale-detection logic (lines 938–970).

New: Frontend calls `orchestrator` with `action: 'write_all'`. The orchestrator runs the entire book server-side. Frontend polls `action: 'status'` for progress updates. If the HTTP connection drops (504), the orchestrator keeps running — it's writing to the DB on each chapter completion, so the frontend can always pick up where it left off by reading chapter statuses.

---

# MIGRATION SEQUENCE

Do NOT attempt to build all 6 bots at once. Here's the safe order:

### Phase 1: Extract shared infrastructure
1. Create `functions/shared/aiRouter.ts` — extract `callAI` + `MODEL_MAP`
2. Create `functions/shared/resolveModel.ts` — extract `resolveModel`
3. Create `functions/shared/dataLoader.ts` — extract entity loading
4. Update existing functions to import from shared (don't break anything yet)

### Phase 2: Build State Chronicler first
- Lowest risk — currently fire-and-forget, so replacing it doesn't affect generation
- Replace `generateChapterState.ts` with `bots/stateChronicler.ts`
- Add extraction functions (`extractDistinctivePhrases`, `extractNamedCharacters`, etc.)
- Test: generates same state document format, updates same project fields

### Phase 3: Build Style Enforcer
- Replace the compliance loop, quality scan, and volume verification
- Move all regex patterns and banned phrase lists from `writeChapter.ts`
- Test: feed it known-bad prose, verify it fixes violations

### Phase 4: Build Continuity Guardian
- Replace `consistencyCheck.ts` and the pre-gen validation blocks
- Move character consistency, allegiance shift, capabilities checking
- Test: feed it prose with deliberate continuity errors, verify it catches them

### Phase 5: Build Scene Architect
- Replace `generateScenes.ts` entirely
- Test: same scene output format, same nonfiction beat sheet format

### Phase 6: Build Prose Writer
- The big one — extract prompt assembly from `writeChapter.ts`
- Move all prompt block builders, beat style definitions, author voice definitions
- Test: generates equivalent prose given same inputs

### Phase 7: Build Orchestrator
- Wire all 5 bots together
- Replace `writeChapter.ts` endpoint with orchestrator endpoint
- Simplify frontend to single call + status polling
- Test: full book generation end-to-end

### Phase 8: Decommission
- Delete `writeChapter.ts` (1,989 lines → 0)
- Delete `generateScenes.ts` (375 lines → 0)
- Delete `generateChapterState.ts` (281 lines → 0)
- Delete `consistencyCheck.ts` (129 lines → 0)
- Delete `writeAllChapters.ts` (56 lines → 0)
- Simplify `GenerateTab.jsx` (remove ~400 lines of polling/loop logic)
- Simplify `modelAdapter.ts` (remove validation sections, keep only prompt adaptation)

**Total lines removed:** ~3,230
**Total lines added:** ~1,800 (estimated across 6 bot files + 3 shared files)
**Net reduction:** ~1,400 lines, but more importantly: each file does ONE thing.

---

# APPENDIX A: CURRENT FUNCTION → BOT MAPPING

| Current Function | Current File | Lines | Destination Bot |
|---|---|---|---|
| `callAI()` | writeChapter.ts | 22–83 | shared/aiRouter |
| `callAI()` (duplicate) | generateScenes.ts | 16–77 | shared/aiRouter |
| `callClaude()` + `callOpenRouter()` | generateChapterState.ts | 16–52 | shared/aiRouter |
| `resolveModel()` | writeChapter.ts | 4 | shared/resolveModel |
| `BEAT_STYLES` | writeChapter.ts | 84–110 | Prose Writer |
| `ASP` (author style profiles) | writeChapter.ts | 112 | Prose Writer |
| `LVM` (legacy voice mapper) | writeChapter.ts | 113 | Prose Writer |
| `SPICE_LEVELS` | writeChapter.ts | 125–131 | Prose Writer |
| `LANGUAGE_INTENSITY` | writeChapter.ts | 133–139 | Prose Writer |
| `CONTENT_GUARDRAILS` | writeChapter.ts | 140–147 | Prose Writer |
| `BANNED_CONSTRUCTIONS_ALL_GENRES` | writeChapter.ts | 149 | Style Enforcer |
| `REPETITION_GOVERNOR_CAPS` | writeChapter.ts | 151 | Style Enforcer |
| `buildRepetitionGovernorBlock()` | writeChapter.ts | 152–166 | Style Enforcer |
| `QUALITY_UPGRADES` | writeChapter.ts | 168 | Prose Writer (prompt) |
| `OUTPUT_FORMAT_RULES` | writeChapter.ts | 170–183 | Prose Writer |
| `PERMANENT_QUALITY_RULES` | writeChapter.ts | 185–191 | Style Enforcer |
| `buildAuthorModeBlock()` | writeChapter.ts | 193–219 | Prose Writer |
| `buildCtxHeader()` | writeChapter.ts | 119 | Prose Writer |
| `buildFictionProseRules()` | writeChapter.ts | 118 | Prose Writer (prompt) + Style Enforcer (enforcement) |
| `enforceProseCompliance()` | writeChapter.ts | 120–122 | Style Enforcer |
| `checkSceneEnding()` | writeChapter.ts | 124 | Style Enforcer |
| `verifyGeminiProse()` | writeChapter.ts | 233 | Style Enforcer |
| `buildCharacterConsistencyBlock()` | writeChapter.ts | 380–396 | Continuity Guardian |
| `buildCanonicalBackstoryBlock()` | writeChapter.ts | 368–377 | Continuity Guardian |
| `buildFiredBeatsBlock()` | writeChapter.ts | 315–332 | Continuity Guardian |
| `buildCapabilitiesBlock()` | writeChapter.ts | 336–345 | Continuity Guardian |
| `buildAllegianceShiftBlock()` | writeChapter.ts | 348–365 | Continuity Guardian |
| `buildCharacterRegistryBlock()` | writeChapter.ts | 426–434 | Continuity Guardian |
| `buildUnifiedStateDocument()` | writeChapter.ts | 399–423 | Continuity Guardian |
| `extractDistinctivePhrases()` | writeChapter.ts | 436–465 | State Chronicler |
| `extractNamedCharacters()` | writeChapter.ts | 467–468 | State Chronicler |
| `extractPhysicalTics()` | writeChapter.ts | 470–530 | State Chronicler |
| `extractMetaphorClusters()` | writeChapter.ts | 536–595 | State Chronicler |
| `extractDialogueClichés()` | writeChapter.ts | 596–626 | State Chronicler |
| `validatePermanentRules()` | writeChapter.ts | 652–730 | Continuity Guardian |
| `scanChapterQuality()` | writeChapter.ts | 732–939 | Style Enforcer |
| `enforceNonfictionEnding()` | writeChapter.ts | 940–953 | Style Enforcer |
| `checkCompositeFigureFraming()` | writeChapter.ts | 955–963 | Continuity Guardian |
| `scanNonfictionQuality()` | writeChapter.ts | 964–983 | Style Enforcer |
| `_buildNonfictionSystemPrompt()` | writeChapter.ts | 986–1057 | Prose Writer |
| `_buildNonfictionUserMessage()` | writeChapter.ts | 1059–1102 | Prose Writer |
| `rewriteWithCorrections()` | writeChapter.ts | 1104–1140 | Style Enforcer |
| `generateChapterAsync()` | writeChapter.ts | 1160–1897 | Orchestrator (flow) + all bots |
| `Deno.serve()` endpoint | writeChapter.ts | 1909–1989 | Orchestrator |
| Scene generation | generateScenes.ts | 1–375 | Scene Architect |
| State document gen | generateChapterState.ts | 1–281 | State Chronicler |
| Consistency check | consistencyCheck.ts | 1–129 | Continuity Guardian |
| Write-all prep | writeAllChapters.ts | 1–56 | Orchestrator |
| Prompt adaptation | modelAdapter.ts | 166–323 | Prose Writer (imports) |
| Output validation | modelAdapter.ts | 400–607 | Style Enforcer + Continuity Guardian |
| Retry engine | modelAdapter.ts | 614–652 | Orchestrator (retry logic) |

---

# APPENDIX B: AI CALLS PER CHAPTER — BEFORE vs AFTER

## Current (worst case for a nonfiction chapter on Gemini)

| Step | AI Calls | Can Fail |
|---|---|---|
| Scene/beat generation | 1 (+1 retry) | Yes |
| JSON repair (if malformed) | 1 | Yes |
| Chapter prose generation | 1 | Yes |
| Refusal retry | 1 | Yes |
| Gemini quality loop (2x) | 2 | Yes |
| Volume verification loop (2x) | 2 | Yes |
| Compliance gate retry loop (3x) | 3 | Yes |
| Nonfiction ending enforcement | 1 | Yes |
| Consistency check | 1 | Yes |
| State document generation | 1 | Yes |
| Subject extraction (nonfiction) | 1 | Yes |
| **TOTAL** | **15** | |

## New (same chapter)

| Bot | AI Calls | Can Fail |
|---|---|---|
| Scene Architect | 1 | Yes → retry once |
| Prose Writer | 1 | Yes → retry once with violation context |
| Continuity Guardian | 1 | Yes → degrade gracefully (skip) |
| Style Enforcer | 1 | Yes → degrade gracefully (return unfixed) |
| State Chronicler | 1 (+1 nonfiction subject) | Yes → retry once |
| **TOTAL** | **5–6** | |

**Reduction: 15 → 6 AI calls per chapter. 60% fewer failure points.**

The key insight: the current system makes 7+ AI calls trying to FIX problems after generation. The new system makes those problems less likely upfront (clean writer prompt without competing rules) and fixes them more efficiently (one targeted rewrite vs full regeneration).
