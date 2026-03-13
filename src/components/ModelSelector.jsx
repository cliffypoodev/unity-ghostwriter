import React, { useState } from "react";
import { ChevronDown, Star, Settings, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Canonical model registry (single source of truth) ────────────────────────

export const AI_MODEL_PROFILES = {
  "claude-sonnet":     { id:"claude-sonnet",     name:"Claude Sonnet (Latest)",  provider:"Anthropic", description:"Balanced creative writing with strong reasoning. Great all-rounder.",                                    strengths:["Versatile prose","Strong character development","Good pacing","Balanced creativity"],                                                              proseQuality:4, tokenCost:3 },
  "claude-opus":       { id:"claude-opus",        name:"Claude Opus (Latest)",    provider:"Anthropic", description:"Premium literary model. Sophisticated vocabulary, nuanced prose, deep thematic layering.",                 strengths:["Literary nuance","Complex narratives","Avoiding AI-isms","Sophisticated vocabulary"],                                                                proseQuality:5, tokenCost:5 },
  "claude-opus-4-5":   { id:"claude-opus-4-5",    name:"Claude Opus 4.5",         provider:"Anthropic", description:"Premium literary model. Excels at sophisticated vocabulary, complex reasoning, and nuanced prose.",        strengths:["Literary nuance","Complex narrative structures","Sophisticated vocabulary","Deep thematic exploration","Avoiding AI-isms"],                        proseQuality:5, tokenCost:5 },
  "claude-sonnet-4-5": { id:"claude-sonnet-4-5",  name:"Claude Sonnet 4.5",       provider:"Anthropic", description:"Balanced creative writing with strong reasoning. Great all-rounder for most book projects.",              strengths:["Versatile prose style","Strong character development","Good pacing control","Balanced creativity and coherence"],                                   proseQuality:4, tokenCost:3 },
  "claude-haiku-4-5":  { id:"claude-haiku-4-5",   name:"Claude Haiku 4.5",        provider:"Anthropic", description:"Fast and cost-effective. Best for drafts where speed matters more than literary polish.",                 strengths:["Fast generation","Low cost","Good structure","Quick iterations"],                                                                                    proseQuality:3, tokenCost:1 },
  "gpt-4o":            { id:"gpt-4o",             name:"GPT-4o",                  provider:"OpenAI",    description:"Optimized for brevity and algorithm-friendly content. Ideal for marketing copy and SEO.",                 strengths:["SEO optimization","Catchy titles","Marketing copy","Punchy writing"],                                                                                proseQuality:4, tokenCost:4 },
  "gpt-4-turbo":       { id:"gpt-4-turbo",        name:"GPT-4 Turbo",             provider:"OpenAI",    description:"Powerful and fast GPT-4 variant. Good balance of quality and speed for longer-form content.",             strengths:["Fast inference","Long context","Consistent tone","Broad genre coverage"],                                                                            proseQuality:4, tokenCost:3 },
  "gpt-4o-creative":   { id:"gpt-4o-creative",    name:"GPT-4o (Creative Mode)",  provider:"OpenAI",    description:"Creative writing with accessible, page-turning prose. Higher temperature for imaginative output.",        strengths:["Fast-paced prose","Genre conventions","Dialogue-heavy scenes","Page-turning momentum"],                                                              proseQuality:4, tokenCost:4 },
  "gemini-pro":        { id:"gemini-pro",          name:"Gemini Pro",              provider:"Google",    description:"Strongest factual accuracy of non-Claude models. Best for nonfiction. Fiction prose trends ornate.",       strengths:["Factual accuracy","Research synthesis","Data-driven narratives","Technical precision"],                                                              proseQuality:3, tokenCost:3 },
  "deepseek-chat":     { id:"deepseek-chat",       name:"DeepSeek Chat",           provider:"DeepSeek",  description:"Cost-effective creative writing with strong instruction following when properly prompted.",                strengths:["Low cost per token","Long context window","Good at structured output"],                                                                              proseQuality:3, tokenCost:1 },
  "deepseek-reasoner": { id:"deepseek-reasoner",   name:"DeepSeek Reasoner",       provider:"DeepSeek",  description:"Chain-of-thought reasoning model. Better at following complex multi-step instructions.",                  strengths:["Instruction compliance","Complex rule following","Analytical content"],                                                                              proseQuality:3, tokenCost:2 },
};

export const MODEL_GENRE_ROUTING = {
  "Literary Fiction":  { primary:"claude-opus-4-5",   alts:["claude-sonnet-4-5"],                          reason:"Literary fiction demands sophisticated vocabulary and avoidance of AI-isms.",                        styleBeat:"Literary & Lyrical prose with deep thematic exploration" },
  "Science Fiction":   { primary:"claude-opus-4-5",   alts:["claude-sonnet-4-5","gpt-4o"],                 reason:"Hard sci-fi needs complex world-building and scientific reasoning.",                                  styleBeat:"Cerebral, world-building heavy with scientific grounding" },
  "Fantasy":           { primary:"claude-opus-4-5",   alts:["claude-sonnet-4-5","gpt-4o"],                 reason:"Epic fantasy requires mythic prose and consistency across complex lore systems.",                      styleBeat:"Mythic & elevated prose with rich world-building" },
  "Mystery":           { primary:"claude-opus-4-5",   alts:["claude-sonnet-4-5"],                          reason:"Psychological depth and carefully plotted reveals require Opus-level reasoning.",                      styleBeat:"Suspenseful, tightly plotted with strategic misdirection" },
  "Thriller":          { primary:"claude-opus-4-5",   alts:["claude-sonnet-4-5"],                          reason:"Misdirection and carefully plotted reveals require Opus-level reasoning.",                             styleBeat:"Suspenseful, tightly plotted with strategic misdirection" },
  "Romance":           { primary:"gpt-4o-creative",   alts:["gpt-4o","claude-sonnet-4-5","deepseek-chat"], reason:"Romance benefits from accessible, emotionally engaging prose with strong dialogue.",                   styleBeat:"Romantic & passionate with character-driven emotional arcs" },
  "Horror":            { primary:"claude-opus-4-5",   alts:["claude-sonnet-4-5"],                          reason:"Horror requires cosmic dread, existential tension, and dark literary nuance.",                        styleBeat:"Cosmic dread, existential horror, scholarly and somber" },
  "Historical Fiction":{ primary:"claude-opus-4-5",   alts:["gpt-4-turbo","claude-sonnet-4-5"],            reason:"Historical fiction demands immersive cinematic prose with factual accuracy.",                          styleBeat:"Fluid, immersive, cinematic" },
  "Adventure":         { primary:"gpt-4o-creative",   alts:["gpt-4o","claude-sonnet-4-5","deepseek-chat"], reason:"Adventure thrives on fast pacing, punchy prose, and page-turning momentum.",                           styleBeat:"Fast-paced, action-oriented with cinematic set pieces" },
  "Dystopian":         { primary:"claude-opus-4-5",   alts:["claude-sonnet-4-5"],                          reason:"Dystopian fiction needs complex social commentary and philosophical depth.",                           styleBeat:"Bleak & thought-provoking with layered social commentary" },
  "Magical Realism":   { primary:"claude-opus-4-5",   alts:["claude-sonnet-4-5"],                          reason:"Seamless blending of the mundane and mythic with literary sophistication.",                            styleBeat:"Lush, mythic-mundane blend with literary elegance" },
  "Young Adult":       { primary:"gpt-4o-creative",   alts:["gpt-4o","claude-sonnet-4-5","deepseek-chat"], reason:"YA needs accessible language and strong genre convention awareness.",                                  styleBeat:"Accessible, emotionally resonant with coming-of-age themes" },
  "Crime":             { primary:"claude-opus-4-5",   alts:["claude-sonnet-4-5"],                          reason:"Crime fiction needs investigative rigor and atmospheric prose.",                                       styleBeat:"Gritty, procedural with atmospheric tension" },
  "Western":           { primary:"claude-sonnet-4-5", alts:["claude-opus-4-5"],                            reason:"Western fiction needs sparse, evocative prose with moral ambiguity.",                                  styleBeat:"Spare, evocative, landscape-driven with moral weight" },
  "Satire":            { primary:"claude-opus-4-5",   alts:["claude-sonnet-4-5"],                          reason:"Satire demands wit, irony, and sophisticated social commentary.",                                      styleBeat:"Sharp, witty with controlled exaggeration" },
  "Erotica":           { primary:"claude-opus-4-5",   alts:["claude-sonnet-4-5"],                          reason:"Erotica requires nuanced power dynamics and sophisticated prose that avoids cliche.",                  styleBeat:"Character-driven intimacy with psychological depth" },
  "Self-Help":         { primary:"claude-sonnet-4-5", alts:["gpt-4o","deepseek-chat"],                     reason:"Self-help needs clear, motivational prose with actionable insights.",                                  styleBeat:"TED Talk engaging with actionable, motivational tone" },
  "Business":          { primary:"claude-sonnet-4-5", alts:["gpt-4o","gpt-4-turbo","deepseek-chat"],       reason:"Business books need authority, case studies, and accessible explanations.",                             styleBeat:"Authoritative yet accessible with data-driven narratives" },
  "Biography":         { primary:"claude-opus-4-5",   alts:["claude-sonnet-4-5"],                          reason:"Biography demands literary narrative craft and meticulous factual accuracy.",                           styleBeat:"Immersive narrative with deep character portraiture" },
  "History":           { primary:"claude-opus-4-5",   alts:["gpt-4-turbo","claude-sonnet-4-5"],            reason:"History writing needs fluid cinematic prose with strict factual accuracy.",                             styleBeat:"Fluid, immersive, cinematic — strictly factual" },
  "Science":           { primary:"gemini-pro",        alts:["claude-sonnet-4-5","gpt-4-turbo"],            reason:"Science writing requires factual precision and research synthesis.",                                    styleBeat:"Academic but accessible with awe-inspiring explanations" },
  "Technology":        { primary:"gemini-pro",        alts:["claude-sonnet-4-5","gpt-4-turbo"],            reason:"Technology books need up-to-date accuracy and clear technical explanations.",                           styleBeat:"Clear, technically precise with forward-looking perspective" },
  "Philosophy":        { primary:"claude-opus-4-5",   alts:["claude-sonnet-4-5"],                          reason:"Philosophy demands sophisticated reasoning and abstract concept precision.",                            styleBeat:"Cerebral & intellectual with rigorous logical structure" },
  "Psychology":        { primary:"claude-opus-4-5",   alts:["claude-sonnet-4-5","gpt-4-turbo"],            reason:"Psychology needs nuanced human behavior with scientific rigor.",                                        styleBeat:"Introspective & insightful with research-backed narratives" },
  "Health":            { primary:"gemini-pro",        alts:["claude-sonnet-4-5","gpt-4-turbo"],            reason:"Health writing needs strict factual accuracy and evidence-based claims.",                               styleBeat:"Evidence-based, warm, and actionable" },
  "Travel":            { primary:"claude-sonnet-4-5", alts:["claude-opus-4-5","gpt-4o"],                   reason:"Travel writing needs vivid sensory description and engaging narrative flow.",                           styleBeat:"Vivid, sensory-rich with cultural curiosity" },
  "True Crime":        { primary:"claude-opus-4-5",   alts:["claude-sonnet-4-5","gpt-4-turbo"],            reason:"True crime needs investigative rigor and dark atmospheric prose.",                                      styleBeat:"Dark & gritty, investigative — strictly factual" },
  "Memoir":            { primary:"claude-opus-4-5",   alts:["claude-sonnet-4-5"],                          reason:"Memoir demands literary craft, emotional vulnerability, and honest self-reflection.",                   styleBeat:"Intimate, reflective with raw emotional honesty" },
  "Cooking":           { primary:"claude-sonnet-4-5", alts:["gpt-4o","gemini-pro"],                        reason:"Cookbook writing needs clear, inviting language that makes techniques accessible.",                      styleBeat:"Warm, precise, appetite-inducing" },
  "Education":         { primary:"gemini-pro",        alts:["claude-sonnet-4-5","gpt-4-turbo"],            reason:"Education books need clear instructional design and accessible explanations.",                           styleBeat:"Clear, structured, pedagogically sound" },
  "Politics":          { primary:"claude-opus-4-5",   alts:["claude-sonnet-4-5"],                          reason:"Political writing needs balanced analysis and rhetorical precision.",                                   styleBeat:"Analytical, persuasive with balanced argumentation" },
};

const PROVIDER_COLORS = {
  Anthropic: { badge: "bg-amber-100 text-amber-700" },
  OpenAI:    { badge: "bg-blue-100 text-blue-700" },
  Google:    { badge: "bg-purple-100 text-purple-700" },
  DeepSeek:  { badge: "bg-teal-100 text-teal-700" },
};

// ── Tiny helpers ─────────────────────────────────────────────────────────────

function Stars({ count, max = 5 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} className={cn("w-3.5 h-3.5", i < count ? "fill-amber-400 text-amber-400" : "text-slate-300")} />
      ))}
    </div>
  );
}

function Dollars({ count, max = 5 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={cn("text-sm font-semibold", i < count ? "text-green-600" : "text-slate-300")}>$</span>
      ))}
    </div>
  );
}

// ── Model card ───────────────────────────────────────────────────────────────

function ModelCard({ model, recommended, selected, onSelect, routing }) {
  const colors = PROVIDER_COLORS[model.provider] || PROVIDER_COLORS.Anthropic;

  return (
    <button
      onClick={() => onSelect(model.id)}
      className={cn(
        "w-full text-left p-4 border-2 rounded-lg transition-all",
        selected
          ? "border-indigo-500 bg-indigo-50"
          : recommended
            ? "border-indigo-200 hover:border-indigo-400"
            : "border-slate-200 hover:border-indigo-500 hover:shadow-md"
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {recommended && (
              <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">
                RECOMMENDED
              </span>
            )}
            <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded", colors.badge)}>
              {model.provider}
            </span>
          </div>
          <h4 className="font-semibold text-slate-900 text-sm">{model.name}</h4>
        </div>
        <div
          className={cn(
            "w-5 h-5 rounded-full border-2 shrink-0 mt-1 flex items-center justify-center",
            selected ? "border-indigo-500 bg-indigo-500" : "border-slate-300 bg-white"
          )}
        >
          {selected && <Check className="w-3 h-3 text-white" />}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-600 mb-3 leading-relaxed">{model.description}</p>

      {/* Ratings */}
      <div className="flex items-center gap-6">
        <div>
          <p className="text-[10px] font-semibold text-slate-500 mb-0.5">Prose Quality</p>
          <Stars count={model.proseQuality} />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-500 mb-0.5">Token Cost</p>
          <Dollars count={model.tokenCost} />
        </div>
      </div>

      {/* Expanded detail when selected */}
      {selected && routing && (
        <div className="mt-3 pt-3 border-t border-indigo-200 space-y-2">
          {recommended && routing.reason && (
            <p className="text-xs text-slate-600 italic">{routing.reason}</p>
          )}
          {routing.styleBeat && (
            <div className="bg-indigo-100/60 border-l-[3px] border-indigo-500 p-2 rounded-r">
              <p className="text-xs text-slate-700">
                <span className="font-semibold">Style Beat:</span> {routing.styleBeat}
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {model.strengths.map((s, i) => (
              <span key={i} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </button>
  );
}

// ── Context-sensitive warnings ───────────────────────────────────────────────

function ModelWarnings({ selectedModel, bookType }) {
  const warnings = [];

  // GPT SFW warning
  if (selectedModel?.startsWith("gpt-")) {
    warnings.push({
      key: "gpt-sfw",
      color: "border-amber-300 bg-amber-50",
      title: "⚠ GPT Note — SFW Projects Only",
      body: (
        <>
          <p className="text-xs text-slate-700 mb-1 font-medium">Works best for:</p>
          <ul className="text-xs text-slate-600 space-y-0.5 ml-1 mb-1.5">
            <li>✓ SFW fiction and nonfiction</li>
            <li>✓ Clean romance, thriller, literary genres</li>
          </ul>
          <p className="text-xs text-slate-700 mb-1 font-medium">Not recommended for:</p>
          <ul className="text-xs text-slate-600 space-y-0.5 ml-1">
            <li>✗ Erotica genre (content ceiling applies)</li>
            <li>✗ Projects requiring explicit scene generation</li>
          </ul>
        </>
      ),
    });
  }

  // Gemini prose warning
  if (selectedModel === "gemini-pro") {
    const isNF = bookType === "nonfiction";
    warnings.push({
      key: "gemini-prose",
      color: "border-purple-300 bg-purple-50",
      title: "⚠ Gemini Prose Note",
      body: isNF ? (
        <ul className="text-xs text-slate-600 space-y-0.5 ml-1">
          <li>✓ Strongest factual accuracy of non-Claude models</li>
          <li>✗ Defaults to academic register — enforcement active</li>
          <li>✗ Over-hedges on contested facts, stalling momentum</li>
        </ul>
      ) : (
        <ul className="text-xs text-slate-600 space-y-0.5 ml-1">
          <li>✗ Purple prose — over-describes, reaches for ornate metaphors</li>
          <li>✗ Emotional inflation — small moments feel too epic</li>
          <li>✗ Enforcement layer actively compensates</li>
        </ul>
      ),
    });
  }

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2 mt-3">
      {warnings.map((w) => (
        <div key={w.key} className={cn("rounded-lg border p-3 text-sm", w.color)}>
          <p className="font-semibold text-slate-800 text-xs mb-1.5">{w.title}</p>
          {w.body}
        </div>
      ))}
    </div>
  );
}

// ── Prose guidance footer ────────────────────────────────────────────────────

function ProseGuidance({ bookType }) {
  if (!bookType) return null;
  const isFiction = bookType === "fiction";

  const rows = isFiction
    ? [
        { icon: "✓", color: "text-green-600", label: "Claude", desc: "Best default. Clean, controlled, genre-aware." },
        { icon: "⚠", color: "text-amber-500", label: "Gemini", desc: "Capable but prone to purple prose. Enforcement active." },
        { icon: "⚠", color: "text-amber-500", label: "DeepSeek", desc: "Strong psychology, watch for over-analysis." },
        { icon: "⚠", color: "text-amber-500", label: "GPT", desc: "SFW only. Needs length enforcement." },
      ]
    : [
        { icon: "✓", color: "text-green-600", label: "Claude", desc: "Best default. Strong narrative voice, reliable fact-flagging." },
        { icon: "✓", color: "text-green-600", label: "DeepSeek", desc: "Strong research depth. Enforcement handles over-analysis." },
        { icon: "⚠", color: "text-amber-500", label: "Gemini", desc: "Good factual accuracy, academic tone risk." },
        { icon: "⚠", color: "text-amber-500", label: "GPT", desc: "Workable for most subgenres. Not for Investigative." },
      ];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mt-3">
      <p className="font-semibold text-slate-800 text-xs mb-2">
        {isFiction ? "Fiction" : "Nonfiction"} Prose Model Guidance
      </p>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start gap-2">
            <span className={cn("font-bold mt-0.5 shrink-0 text-xs", r.color)}>{r.icon}</span>
            <p className="text-xs text-slate-700">
              <span className="font-medium">{r.label}</span> — {r.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ModelSelector({ genre, bookType, selectedModel, onSelectModel }) {
  const [expanded, setExpanded] = useState(false);

  // No genre yet → placeholder
  if (!genre) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-slate-500">
        <Settings className="w-4 h-4" />
        <span className="text-sm">Select a genre to get AI model recommendations</span>
      </div>
    );
  }

  const routing = MODEL_GENRE_ROUTING[genre] || null;
  const primaryId = routing?.primary || "claude-sonnet-4-5";
  const primaryModel = AI_MODEL_PROFILES[primaryId];
  const altIds = routing?.alts || [];
  const altModels = altIds.map((id) => AI_MODEL_PROFILES[id]).filter(Boolean);
  const otherModels = Object.values(AI_MODEL_PROFILES).filter(
    (m) => m.id !== primaryId && !altIds.includes(m.id)
  );

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors border-b"
      >
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
          <Settings className="w-4 h-4" />
          Prose Composition Model
        </div>
        <ChevronDown className={cn("w-4 h-4 text-slate-500 transition-transform", expanded && "rotate-180")} />
      </button>

      {/* Body */}
      <div className="p-4 space-y-3">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Selects the AI that writes your chapter prose. Outline generation, beat structure, and content routing always use their dedicated engines.
        </p>

        {/* Recommended */}
        {primaryModel && (
          <ModelCard
            model={primaryModel}
            recommended
            selected={selectedModel === primaryId}
            onSelect={onSelectModel}
            routing={routing}
          />
        )}

        {/* Alternatives + others (expanded) */}
        {expanded && (
          <>
            {altModels.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  Alternatives
                </p>
                <div className="space-y-2">
                  {altModels.map((m) => (
                    <ModelCard
                      key={m.id}
                      model={m}
                      selected={selectedModel === m.id}
                      onSelect={onSelectModel}
                      routing={routing}
                    />
                  ))}
                </div>
              </div>
            )}

            {otherModels.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  All Models
                </p>
                <div className="space-y-2">
                  {otherModels.map((m) => (
                    <ModelCard
                      key={m.id}
                      model={m}
                      selected={selectedModel === m.id}
                      onSelect={onSelectModel}
                      routing={routing}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Selected footer */}
      {selectedModel && (
        <div className="px-4 py-2 bg-indigo-50 border-t border-slate-200 text-xs text-slate-700">
          Selected: <span className="font-semibold">{AI_MODEL_PROFILES[selectedModel]?.name || selectedModel}</span>
        </div>
      )}

      {/* Context-sensitive warnings */}
      <div className="px-4 pb-3">
        <ModelWarnings selectedModel={selectedModel} bookType={bookType} />
        <ProseGuidance bookType={bookType} />
      </div>
    </div>
  );
}