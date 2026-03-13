import React, { useState, useMemo } from "react";
import { ChevronDown, Check, Settings, Star, AlertTriangle, Zap, CircleDollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// WRITING_MODELS — canonical registry for the prose-composition model selector.
// The `id` values here are what get stored in spec.ai_model and sent to writeChapter.
// ═══════════════════════════════════════════════════════════════════════════════

export const WRITING_MODELS = {
  'claude-haiku': {
    id: 'claude-haiku', label: 'Claude Haiku 3.5', platform: 'Anthropic',
    callHandler: 'anthropic', modelString: 'claude-haiku-4-5-20251001',
    description: 'Fast, lightweight · affordable',
    costLabel: '$0.25/M', costTier: 'mid', qualityScore: 3, qualityColor: '#f59e0b',
    inPer1M: 0.25, outPer1M: 1.25, contextWindow: 200000, supportsExplicit: false,
  },
  'claude-sonnet': {
    id: 'claude-sonnet', label: 'Claude Sonnet 4.5', platform: 'Anthropic',
    callHandler: 'anthropic', modelString: 'claude-sonnet-4-5',
    description: 'Best overall quality · full beat adherence',
    costLabel: '$15/M', costTier: 'high', qualityScore: 5, qualityColor: '#f59e0b',
    inPer1M: 3.00, outPer1M: 15.00, contextWindow: 200000, supportsExplicit: false,
    recommended: true,
  },
  'gpt-4o': {
    id: 'gpt-4o', label: 'GPT-4o', platform: 'OpenAI',
    callHandler: 'openai', modelString: 'gpt-4o',
    description: 'Strong instruction following · solid beats',
    costLabel: '$5/M', costTier: 'mid', qualityScore: 4, qualityColor: '#3b82f6',
    inPer1M: 2.50, outPer1M: 10.00, contextWindow: 128000, supportsExplicit: false,
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini', label: 'GPT-4o Mini', platform: 'OpenAI',
    callHandler: 'openai', modelString: 'gpt-4o-mini',
    description: 'Fast · affordable · lighter quality',
    costLabel: '$0.60/M', costTier: 'low', qualityScore: 3, qualityColor: '#3b82f6',
    inPer1M: 0.15, outPer1M: 0.60, contextWindow: 128000, supportsExplicit: false,
  },
  'deepseek': {
    id: 'deepseek', label: 'DeepSeek V3', platform: 'OpenRouter · DeepSeek',
    callHandler: 'openrouter', modelString: 'deepseek/deepseek-chat',
    description: 'Frontier quality · 163k context',
    costLabel: '$0.89/M', costTier: 'low', qualityScore: 4, qualityColor: '#3b82f6',
    inPer1M: 0.32, outPer1M: 0.89, contextWindow: 163840, supportsExplicit: true,
  },
  'trinity': {
    id: 'trinity', label: 'Trinity Large', platform: 'OpenRouter · Arcee AI',
    callHandler: 'openrouter', modelString: 'arcee-ai/trinity-large-preview:free',
    description: '400B creative writing model · storytelling',
    costLabel: 'FREE', costTier: 'free', qualityScore: 4, qualityColor: '#22c55e',
    inPer1M: 0, outPer1M: 0, contextWindow: 131000, supportsExplicit: true,
    isFree: true, note: 'May be slower during high-demand periods',
  },
  'lumimaid': {
    id: 'lumimaid', label: 'Lumimaid v0.2', platform: 'OpenRouter · Lumimaid',
    callHandler: 'openrouter', modelString: 'neversleep/lumimaid-v0.2-8b',
    description: 'Explicit content enabled · adult fiction',
    costLabel: '$0.20/M', costTier: 'low', qualityScore: 3, qualityColor: '#f43f5e',
    inPer1M: 0.20, outPer1M: 0.20, contextWindow: 32000, supportsExplicit: true,
    adultOnly: true,
  },
};

export const PLATFORM_ORDER = [
  'Anthropic',
  'OpenAI',
  'OpenRouter · DeepSeek',
  'OpenRouter · Arcee AI',
  'OpenRouter · Lumimaid',
];

export const PLATFORM_COLORS = {
  'Anthropic':               '#e879f9',
  'OpenAI':                  '#10b981',
  'OpenRouter · DeepSeek':   '#3b82f6',
  'OpenRouter · Arcee AI':   '#22c55e',
  'OpenRouter · Lumimaid':   '#f43f5e',
};

export const PROMPT_OVERHEAD_TOKENS = {
  1500: 900,
  2500: 1400,
  4000: 2000,
  6000: 2600,
};

// Legacy export so existing pipeline imports still resolve
export const AI_MODEL_PROFILES = Object.fromEntries(
  Object.values(WRITING_MODELS).map(m => [m.id, {
    id: m.id, name: m.label, provider: m.platform.split(' · ')[0],
    description: m.description, strengths: [],
    proseQuality: m.qualityScore, tokenCost: m.costTier === 'free' ? 0 : m.costTier === 'low' ? 1 : m.costTier === 'mid' ? 3 : 5,
  }])
);

export const MODEL_GENRE_ROUTING = {
  "Literary Fiction":  { primary:"claude-sonnet", alts:["deepseek"],                   reason:"Literary fiction demands sophisticated vocabulary and avoidance of AI-isms.",  styleBeat:"Literary & Lyrical prose with deep thematic exploration" },
  "Science Fiction":   { primary:"claude-sonnet", alts:["deepseek","gpt-4o"],           reason:"Hard sci-fi needs complex world-building and scientific reasoning.",            styleBeat:"Cerebral, world-building heavy with scientific grounding" },
  "Fantasy":           { primary:"claude-sonnet", alts:["deepseek","trinity"],          reason:"Epic fantasy requires mythic prose and consistency across complex lore.",        styleBeat:"Mythic & elevated prose with rich world-building" },
  "Mystery":           { primary:"claude-sonnet", alts:["gpt-4o"],                     reason:"Psychological depth and carefully plotted reveals need strong reasoning.",       styleBeat:"Suspenseful, tightly plotted with strategic misdirection" },
  "Thriller":          { primary:"claude-sonnet", alts:["gpt-4o","deepseek"],           reason:"Misdirection and carefully plotted reveals need strong reasoning.",              styleBeat:"Suspenseful, tightly plotted with strategic misdirection" },
  "Romance":           { primary:"claude-sonnet", alts:["gpt-4o","deepseek","trinity"], reason:"Romance benefits from accessible, emotionally engaging prose.",                  styleBeat:"Romantic & passionate with character-driven emotional arcs" },
  "Horror":            { primary:"claude-sonnet", alts:["deepseek"],                   reason:"Horror requires cosmic dread, existential tension, and dark literary nuance.",   styleBeat:"Cosmic dread, existential horror, scholarly and somber" },
  "Historical Fiction":{ primary:"claude-sonnet", alts:["deepseek","gpt-4o"],           reason:"Historical fiction demands immersive cinematic prose with factual accuracy.",     styleBeat:"Fluid, immersive, cinematic" },
  "Adventure":         { primary:"gpt-4o",        alts:["claude-sonnet","deepseek","trinity"], reason:"Adventure thrives on fast pacing and page-turning momentum.",             styleBeat:"Fast-paced, action-oriented with cinematic set pieces" },
  "Dystopian":         { primary:"claude-sonnet", alts:["deepseek"],                   reason:"Dystopian fiction needs complex social commentary and philosophical depth.",      styleBeat:"Bleak & thought-provoking with layered social commentary" },
  "Magical Realism":   { primary:"claude-sonnet", alts:["deepseek"],                   reason:"Seamless blending of the mundane and mythic with literary sophistication.",       styleBeat:"Lush, mythic-mundane blend with literary elegance" },
  "Young Adult":       { primary:"gpt-4o",        alts:["claude-sonnet","trinity"],    reason:"YA needs accessible language and strong genre convention awareness.",             styleBeat:"Accessible, emotionally resonant with coming-of-age themes" },
  "Crime":             { primary:"claude-sonnet", alts:["gpt-4o","deepseek"],           reason:"Crime fiction needs investigative rigor and atmospheric prose.",                  styleBeat:"Gritty, procedural with atmospheric tension" },
  "Western":           { primary:"claude-sonnet", alts:["deepseek"],                   reason:"Western fiction needs sparse, evocative prose with moral ambiguity.",             styleBeat:"Spare, evocative, landscape-driven with moral weight" },
  "Satire":            { primary:"claude-sonnet", alts:["gpt-4o"],                     reason:"Satire demands wit, irony, and sophisticated social commentary.",                 styleBeat:"Sharp, witty with controlled exaggeration" },
  "Erotica":           { primary:"lumimaid",      alts:["deepseek","trinity"],          reason:"Erotica requires explicit content support and nuanced power dynamics.",           styleBeat:"Character-driven intimacy with psychological depth" },
  "Self-Help":         { primary:"claude-sonnet", alts:["gpt-4o","deepseek"],           reason:"Self-help needs clear, motivational prose with actionable insights.",             styleBeat:"TED Talk engaging with actionable, motivational tone" },
  "Business":          { primary:"claude-sonnet", alts:["gpt-4o","deepseek"],           reason:"Business books need authority, case studies, and accessible explanations.",        styleBeat:"Authoritative yet accessible with data-driven narratives" },
  "Biography":         { primary:"claude-sonnet", alts:["deepseek"],                   reason:"Biography demands literary narrative craft and meticulous factual accuracy.",      styleBeat:"Immersive narrative with deep character portraiture" },
  "History":           { primary:"claude-sonnet", alts:["deepseek","gpt-4o"],           reason:"History writing needs fluid cinematic prose with strict factual accuracy.",        styleBeat:"Fluid, immersive, cinematic — strictly factual" },
  "Science":           { primary:"deepseek",      alts:["claude-sonnet","gpt-4o"],      reason:"Science writing requires factual precision and research synthesis.",               styleBeat:"Academic but accessible with awe-inspiring explanations" },
  "Technology":        { primary:"deepseek",      alts:["claude-sonnet","gpt-4o"],      reason:"Technology books need up-to-date accuracy and clear technical explanations.",      styleBeat:"Clear, technically precise with forward-looking perspective" },
  "Philosophy":        { primary:"claude-sonnet", alts:["deepseek"],                   reason:"Philosophy demands sophisticated reasoning and abstract concept precision.",       styleBeat:"Cerebral & intellectual with rigorous logical structure" },
  "Psychology":        { primary:"claude-sonnet", alts:["deepseek","gpt-4o"],           reason:"Psychology needs nuanced human behavior with scientific rigor.",                   styleBeat:"Introspective & insightful with research-backed narratives" },
  "Health":            { primary:"deepseek",      alts:["claude-sonnet","gpt-4o"],      reason:"Health writing needs strict factual accuracy and evidence-based claims.",          styleBeat:"Evidence-based, warm, and actionable" },
  "Travel":            { primary:"claude-sonnet", alts:["gpt-4o"],                     reason:"Travel writing needs vivid sensory description and engaging narrative flow.",       styleBeat:"Vivid, sensory-rich with cultural curiosity" },
  "True Crime":        { primary:"claude-sonnet", alts:["deepseek","gpt-4o"],           reason:"True crime needs investigative rigor and dark atmospheric prose.",                 styleBeat:"Dark & gritty, investigative — strictly factual" },
  "Memoir":            { primary:"claude-sonnet", alts:["deepseek"],                   reason:"Memoir demands literary craft, emotional vulnerability, and honest self-reflection.", styleBeat:"Intimate, reflective with raw emotional honesty" },
  "Cooking":           { primary:"claude-sonnet", alts:["gpt-4o"],                     reason:"Cookbook writing needs clear, inviting language.",                                   styleBeat:"Warm, precise, appetite-inducing" },
  "Education":         { primary:"deepseek",      alts:["claude-sonnet","gpt-4o"],      reason:"Education books need clear instructional design and accessible explanations.",      styleBeat:"Clear, structured, pedagogically sound" },
  "Politics":          { primary:"claude-sonnet", alts:["deepseek"],                   reason:"Political writing needs balanced analysis and rhetorical precision.",                styleBeat:"Analytical, persuasive with balanced argumentation" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const COST_TIER_STYLES = {
  free:  { bg: "bg-green-100", text: "text-green-700" },
  low:   { bg: "bg-blue-100",  text: "text-blue-700"  },
  mid:   { bg: "bg-amber-100", text: "text-amber-700" },
  high:  { bg: "bg-red-100",   text: "text-red-700"   },
};

function QualityDots({ score, color }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: i < score ? color : '#e2e8f0' }}
        />
      ))}
    </div>
  );
}

function ModelRow({ model, selected, onSelect, isRecommended, routing }) {
  const costStyle = COST_TIER_STYLES[model.costTier] || COST_TIER_STYLES.mid;
  const platformColor = PLATFORM_COLORS[model.platform] || '#94a3b8';

  return (
    <button
      onClick={() => onSelect(model.id)}
      className={cn(
        "w-full text-left px-3.5 py-3 rounded-lg border-2 transition-all",
        selected
          ? "border-indigo-500 bg-indigo-50/70"
          : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Radio circle */}
        <div className={cn(
          "w-[18px] h-[18px] rounded-full border-2 shrink-0 flex items-center justify-center",
          selected ? "border-indigo-500 bg-indigo-500" : "border-slate-300 bg-white"
        )}>
          {selected && <Check className="w-2.5 h-2.5 text-white" />}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-900">{model.label}</span>
            {isRecommended && (
              <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded leading-none">
                REC
              </span>
            )}
            {model.isFree && (
              <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded leading-none">
                FREE
              </span>
            )}
            {model.adultOnly && (
              <span className="text-[9px] font-bold bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded leading-none">
                18+
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{model.description}</p>
        </div>

        {/* Right: quality + cost */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <QualityDots score={model.qualityScore} color={model.qualityColor} />
          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", costStyle.bg, costStyle.text)}>
            {model.costLabel}
          </span>
        </div>
      </div>

      {/* Expanded detail when selected */}
      {selected && (
        <div className="mt-2.5 pt-2.5 border-t border-indigo-200/60 space-y-1.5">
          {routing?.styleBeat && (
            <div className="bg-indigo-100/50 border-l-[3px] border-indigo-400 px-2.5 py-1.5 rounded-r">
              <p className="text-[11px] text-slate-700">
                <span className="font-semibold">Style:</span> {routing.styleBeat}
              </p>
            </div>
          )}
          {isRecommended && routing?.reason && (
            <p className="text-[11px] text-slate-500 italic">{routing.reason}</p>
          )}
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span>{(model.contextWindow / 1000).toFixed(0)}k ctx</span>
            <span className="flex items-center gap-0.5" style={{ color: platformColor }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: platformColor }} />
              {model.platform}
            </span>
            {model.supportsExplicit && <span className="text-rose-400">explicit ok</span>}
          </div>
          {model.note && (
            <p className="text-[10px] text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {model.note}
            </p>
          )}
        </div>
      )}
    </button>
  );
}

function SectionHeader({ platform }) {
  const color = PLATFORM_COLORS[platform] || '#94a3b8';
  return (
    <div className="flex items-center gap-2 mt-3 mb-1.5">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{platform}</span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

// ── Warnings ─────────────────────────────────────────────────────────────────

function ModelWarnings({ model, bookType }) {
  if (!model) return null;
  const warnings = [];

  if (model.id === 'gpt-4o' || model.id === 'gpt-4o-mini') {
    warnings.push({ key: 'gpt', color: 'border-amber-200 bg-amber-50', text: 'GPT models are SFW only. Not recommended for erotica or explicit content.' });
  }
  if (model.adultOnly) {
    warnings.push({ key: 'adult', color: 'border-rose-200 bg-rose-50', text: 'Adult-only model. Content may not be suitable for all genres.' });
  }
  if (model.isFree) {
    warnings.push({ key: 'free', color: 'border-green-200 bg-green-50', text: 'Free tier — may experience slower speeds during peak hours.' });
  }

  if (!warnings.length) return null;
  return (
    <div className="space-y-1.5 mt-2">
      {warnings.map(w => (
        <div key={w.key} className={cn("flex items-start gap-2 rounded-md border px-3 py-2", w.color)}>
          <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-700">{w.text}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function ModelSelector({ genre, bookType, selectedModel, onSelectModel }) {
  const [expanded, setExpanded] = useState(false);

  const routing = genre ? (MODEL_GENRE_ROUTING[genre] || null) : null;
  const recommendedId = routing?.primary || 'claude-sonnet';
  const altIds = new Set(routing?.alts || []);

  // Group models by platform in PLATFORM_ORDER
  const sections = useMemo(() => {
    const groups = {};
    for (const m of Object.values(WRITING_MODELS)) {
      (groups[m.platform] ||= []).push(m);
    }
    return PLATFORM_ORDER.filter(p => groups[p]).map(p => ({ platform: p, models: groups[p] }));
  }, []);

  // Recommended + alts shown always; rest shown when expanded
  const topIds = new Set([recommendedId, ...(routing?.alts || [])]);

  const selectedWritingModel = WRITING_MODELS[selectedModel] || null;

  if (!genre) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-slate-500">
        <Settings className="w-4 h-4" />
        <span className="text-sm">Select a genre to get AI model recommendations</span>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors border-b"
      >
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
          <Settings className="w-4 h-4" />
          Prose Composition Model
        </div>
        <div className="flex items-center gap-2">
          {selectedWritingModel && (
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">{selectedWritingModel.label}</span>
          )}
          <ChevronDown className={cn("w-4 h-4 text-slate-500 transition-transform", expanded && "rotate-180")} />
        </div>
      </button>

      {/* Body */}
      <div className="p-3 space-y-1">
        <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
          Selects the AI that writes your chapter prose. Outline, beat structure, and content routing use their own engines.
        </p>

        {/* Recommended + alternates (always visible) */}
        {WRITING_MODELS[recommendedId] && (
          <ModelRow
            model={WRITING_MODELS[recommendedId]}
            selected={selectedModel === recommendedId}
            onSelect={onSelectModel}
            isRecommended
            routing={routing}
          />
        )}
        {routing?.alts?.map(altId => {
          const m = WRITING_MODELS[altId];
          if (!m || altId === recommendedId) return null;
          return (
            <ModelRow
              key={altId}
              model={m}
              selected={selectedModel === altId}
              onSelect={onSelectModel}
              routing={routing}
            />
          );
        })}

        {/* All models (expanded) */}
        {expanded && (
          <div className="mt-2">
            {sections.map(({ platform, models }) => {
              const remaining = models.filter(m => !topIds.has(m.id));
              if (!remaining.length) return null;
              return (
                <div key={platform}>
                  <SectionHeader platform={platform} />
                  <div className="space-y-1">
                    {remaining.map(m => (
                      <ModelRow
                        key={m.id}
                        model={m}
                        selected={selectedModel === m.id}
                        onSelect={onSelectModel}
                        routing={routing}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {selectedWritingModel && (
        <div className="px-4 py-2 bg-indigo-50 border-t border-slate-200 text-xs text-slate-700">
          Selected: <span className="font-semibold">{selectedWritingModel.label}</span>
          <span className="text-slate-400 ml-2">· {selectedWritingModel.costLabel}</span>
        </div>
      )}

      {/* Warnings */}
      <div className="px-3 pb-3">
        <ModelWarnings model={selectedWritingModel} bookType={bookType} />
      </div>
    </div>
  );
}