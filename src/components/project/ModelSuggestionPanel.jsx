import React, { useState } from "react";
import { ChevronDown, Settings, Star } from "lucide-react";

const AI_MODEL_PROFILES = {
  "claude-sonnet": {
    id: "claude-sonnet",
    name: "Claude Sonnet (Latest)",
    provider: "Anthropic",
    description: "Balanced creative writing with strong reasoning. Great all-rounder for most book projects.",
    strengths: ["Versatile prose", "Strong character development", "Good pacing", "Balanced creativity"],
    proseQuality: 4,
    tokenCost: 3
  },
  "claude-opus": {
    id: "claude-opus",
    name: "Claude Opus (Latest)",
    provider: "Anthropic",
    description: "Premium literary model. Sophisticated vocabulary, nuanced prose, and deep thematic layering.",
    strengths: ["Literary nuance", "Complex narratives", "Avoiding AI-isms", "Sophisticated vocabulary"],
    proseQuality: 5,
    tokenCost: 5
  },
  "claude-opus-4-5": {
    id: "claude-opus-4-5",
    name: "Claude Opus 4.5",
    provider: "Anthropic",
    description: "Premium literary model. Excels at sophisticated vocabulary, complex reasoning, and nuanced prose with deep thematic layering.",
    strengths: ["Literary nuance", "Complex narrative structures", "Sophisticated vocabulary", "Deep thematic exploration", "Avoiding AI-isms"],
    proseQuality: 5,
    tokenCost: 5
  },
  "claude-sonnet-4-5": {
    id: "claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    provider: "Anthropic",
    description: "Balanced creative writing with strong reasoning. Great all-rounder for most book projects.",
    strengths: ["Versatile prose style", "Strong character development", "Good pacing control", "Balanced creativity and coherence"],
    proseQuality: 4,
    tokenCost: 3
  },
  "claude-haiku-4-5": {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "Anthropic",
    description: "Fast and cost-effective. Best for drafts, outlines, and projects where speed matters more than literary polish.",
    strengths: ["Fast generation", "Low cost", "Good structure", "Quick iterations"],
    proseQuality: 3,
    tokenCost: 1
  },
  "gpt-4o": {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    description: "Optimized for clickability, brevity, and algorithm-friendly content. Ideal for marketing copy, titles, and SEO-driven projects.",
    strengths: ["SEO optimization", "Catchy titles", "Marketing copy", "Punchy writing", "Algorithm-friendly formatting"],
    proseQuality: 4,
    tokenCost: 4
  },
  "gpt-4-turbo": {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "OpenAI",
    description: "Powerful and fast GPT-4 variant. Good balance of quality and speed for longer-form content.",
    strengths: ["Fast inference", "Long context", "Consistent tone", "Broad genre coverage"],
    proseQuality: 4,
    tokenCost: 3
  },
  "gpt-4o-creative": {
    id: "gpt-4o-creative",
    name: "GPT-4o (Creative Mode)",
    provider: "OpenAI",
    description: "Creative writing with accessible, page-turning prose. Higher temperature for more imaginative output.",
    strengths: ["Fast-paced prose", "Genre conventions", "Dialogue-heavy scenes", "Page-turning momentum"],
    proseQuality: 4,
    tokenCost: 4
  },
  "gemini-pro": {
    id: "gemini-pro",
    name: "Gemini Pro",
    provider: "Google",
    description: "Strong at research-backed writing and factual accuracy. Ideal for nonfiction and science books.",
    strengths: ["Factual accuracy", "Research synthesis", "Data-driven narratives", "Technical precision"],
    proseQuality: 4,
    tokenCost: 3
  },
  "deepseek-chat": {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    provider: "DeepSeek",
    description: "Highly cost-effective model with surprisingly strong writing capabilities. Great for bulk generation on a budget.",
    strengths: ["Ultra low cost", "Solid structure", "Good dialogue", "High throughput"],
    proseQuality: 3,
    tokenCost: 1
  }
};

const MODEL_GENRE_ROUTING = {
  "Literary Fiction": { primary: "claude-opus-4-5", reason: "Literary fiction demands sophisticated vocabulary, complex narrative structures, and avoidance of AI-isms. Opus excels at nuanced, layered prose.", styleBeat: "Literary & Lyrical prose with deep thematic exploration", alts: ["claude-sonnet-4-5"] },
  "Science Fiction": { primary: "claude-opus-4-5", reason: "Hard sci-fi needs complex world-building and scientific reasoning. Opus handles technical accuracy alongside literary quality.", styleBeat: "Cerebral, world-building heavy with scientific grounding", alts: ["claude-sonnet-4-5", "gpt-4o"] },
  "Fantasy": { primary: "claude-opus-4-5", reason: "Epic fantasy requires mythic prose, deep world-building, and maintaining consistency across complex lore systems.", styleBeat: "Mythic & elevated prose with rich world-building descriptions", alts: ["claude-sonnet-4-5", "gpt-4o"] },
  "Mystery/Thriller": { primary: "claude-opus-4-5", reason: "Psychological depth, misdirection, and carefully plotted reveals require Opus-level reasoning and narrative control.", styleBeat: "Suspenseful, tightly plotted with strategic misdirection", alts: ["claude-sonnet-4-5"] },
  "Romance": { primary: "gpt-4o-creative", reason: "Romance benefits from accessible, emotionally engaging prose with strong dialogue and genre convention awareness.", styleBeat: "Romantic & passionate with character-driven emotional arcs", alts: ["gpt-4o", "claude-sonnet-4-5"] },
  "Horror": { primary: "claude-opus-4-5", reason: "Horror requires cosmic dread, existential tension, and somber scholarly tones — especially Lovecraftian elements. Opus handles dark literary nuance masterfully.", styleBeat: "Cosmic dread, existential horror, scholarly and somber", alts: ["claude-sonnet-4-5"] },
  "Historical Fiction": { primary: "claude-opus-4-5", reason: "Historical fiction demands fluid, immersive, cinematic prose while maintaining strict factual accuracy. Opus separates myths from verified facts.", styleBeat: "Fluid, immersive, cinematic — dramatic consequences of real motivations", alts: ["gpt-4-turbo", "claude-sonnet-4-5"] },
  "Adventure": { primary: "gpt-4o-creative", reason: "Adventure writing thrives on fast pacing, punchy prose, and page-turning momentum.", styleBeat: "Fast-paced, action-oriented with cinematic set pieces", alts: ["gpt-4o", "claude-sonnet-4-5"] },
  "Dystopian": { primary: "claude-opus-4-5", reason: "Dystopian fiction needs complex social commentary, world-building, and philosophical depth.", styleBeat: "Bleak & thought-provoking with layered social commentary", alts: ["claude-sonnet-4-5"] },
  "Magical Realism": { primary: "claude-opus-4-5", reason: "Magical realism requires seamless blending of the mundane and mythic with literary sophistication.", styleBeat: "Lush, mythic-mundane blend with literary elegance", alts: ["claude-sonnet-4-5"] },
  "Young Adult": { primary: "gpt-4o-creative", reason: "YA needs accessible language, relatable voice, and strong genre convention awareness for teen audiences.", styleBeat: "Accessible, emotionally resonant with coming-of-age themes", alts: ["gpt-4o", "claude-sonnet-4-5"] },
  "Children's": { primary: "gpt-4o-creative", reason: "Children's writing needs simple, engaging language with whimsical tone and age-appropriate vocabulary.", styleBeat: "Whimsical & playful with age-appropriate vocabulary", alts: ["gpt-4o", "claude-sonnet-4-5"] },
  "Self-Help": { primary: "claude-sonnet-4-5", reason: "Self-help needs clear, motivational prose with actionable insights and an engaging but authoritative tone.", styleBeat: "TED Talk engaging with actionable, motivational tone", alts: ["gpt-4o"] },
  "Business": { primary: "claude-sonnet-4-5", reason: "Business books need a balance of authority, case studies, and accessible explanations of complex concepts.", styleBeat: "Authoritative yet accessible with data-driven narratives", alts: ["gpt-4o", "gpt-4-turbo"] },
  "Biography/Memoir": { primary: "claude-opus-4-5", reason: "Biography demands literary narrative craft, emotional depth, and meticulous factual accuracy.", styleBeat: "Immersive narrative with deep character portraiture", alts: ["claude-sonnet-4-5"] },
  "History": { primary: "claude-opus-4-5", reason: "History writing needs fluid, cinematic prose at 1500+ words per chapter while maintaining strict factual accuracy.", styleBeat: "Fluid, immersive, cinematic — strictly factual, no invented events", alts: ["gpt-4-turbo", "claude-sonnet-4-5"] },
  "Science": { primary: "gemini-pro", reason: "Science writing requires factual precision, research synthesis, and the ability to make complex topics accessible.", styleBeat: "Academic but accessible with awe-inspiring explanations", alts: ["claude-sonnet-4-5", "gpt-4-turbo"] },
  "Technology": { primary: "gemini-pro", reason: "Technology books need up-to-date accuracy, clear technical explanations, and practical examples.", styleBeat: "Clear, technically precise with forward-looking perspective", alts: ["claude-sonnet-4-5", "gpt-4-turbo"] },
  "Philosophy": { primary: "claude-opus-4-5", reason: "Philosophy demands sophisticated reasoning, complex argumentation, and ability to handle abstract concepts with precision.", styleBeat: "Cerebral & intellectual with rigorous logical structure", alts: ["claude-sonnet-4-5"] },
  "Psychology": { primary: "claude-opus-4-5", reason: "Psychology books need nuanced exploration of human behavior with both scientific rigor and narrative accessibility.", styleBeat: "Introspective & insightful with research-backed narratives", alts: ["claude-sonnet-4-5", "gpt-4-turbo"] },
  "Health & Wellness": { primary: "gemini-pro", reason: "Health writing needs strict factual accuracy, evidence-based claims, and clear actionable guidance.", styleBeat: "Evidence-based, warm, and actionable", alts: ["claude-sonnet-4-5", "gpt-4-turbo"] },
  "Travel": { primary: "claude-sonnet-4-5", reason: "Travel writing needs vivid sensory description, cultural awareness, and engaging narrative flow.", styleBeat: "Vivid, sensory-rich with cultural curiosity", alts: ["claude-opus-4-5", "gpt-4o"] },
  "True Crime": { primary: "claude-opus-4-5", reason: "True crime needs investigative rigor, dark atmospheric prose, and careful ethical handling of sensitive subjects.", styleBeat: "Dark & gritty, investigative — strictly factual crime narrative", alts: ["claude-sonnet-4-5", "gpt-4-turbo"] },
  "Education": { primary: "claude-sonnet-4-5", reason: "Education books need clear instructional design, research-backed pedagogy, and accessible explanations.", styleBeat: "Clear, structured, pedagogically sound", alts: ["gpt-4-turbo"] },
  "Erotica": { primary: "claude-opus-4-5", reason: "Erotica requires nuanced handling of power dynamics, emotional depth beneath physical scenes, and sophisticated prose that avoids cliche.", styleBeat: "Character-driven intimacy with psychological depth", alts: ["claude-sonnet-4-5"] }
};

const PROVIDER_COLORS = {
  Anthropic: { bg: "bg-amber-50", text: "text-amber-700", badge: "bg-amber-100 text-amber-700" },
  OpenAI: { bg: "bg-blue-50", text: "text-blue-700", badge: "bg-blue-100 text-blue-700" },
  Google: { bg: "bg-purple-50", text: "text-purple-700", badge: "bg-purple-100 text-purple-700" },
  DeepSeek: { bg: "bg-teal-50", text: "text-teal-700", badge: "bg-teal-100 text-teal-700" }
};

function ModelCard({ model, isRecommended, isSelected, onSelect }) {
  const colors = PROVIDER_COLORS[model.provider] || PROVIDER_COLORS.Anthropic;
  const borderClass = isSelected ? "border-indigo-500 bg-indigo-50" : isRecommended ? "border-indigo-200" : "border-slate-200 hover:border-indigo-500 hover:shadow-md";

  return (
    <button
      onClick={() => onSelect(model.id)}
      className={`w-full text-left p-4 border-2 rounded-lg transition-all ${borderClass}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {isRecommended && <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">RECOMMENDED</span>}
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${colors.badge}`}>{model.provider}</span>
          </div>
          <h4 className="font-semibold text-slate-900">{model.name}</h4>
        </div>
        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 ${isSelected ? "border-indigo-500 bg-indigo-500" : "border-slate-300 bg-white"}`} />
      </div>
      <p className="text-sm text-slate-600 mb-3">{model.description}</p>
      <div className="flex items-center gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1">Prose Quality</p>
          <StarRating count={model.proseQuality} />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1">Token Cost</p>
          <DollarRating count={model.tokenCost} />
        </div>
      </div>
    </button>
  );
}

function StyleBeatCallout({ text }) {
  return (
    <div className="bg-indigo-50 border-l-[3px] border-indigo-500 p-3 my-2">
      <p className="text-sm text-slate-700"><span className="font-semibold">Style Beat:</span> {text}</p>
    </div>
  );
}

function ReasonText({ text }) {
  return <p className="text-sm text-slate-600 italic mb-2">{text}</p>;
}

function StrengthTags({ strengths }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {strengths.map((strength, i) => (
        <span key={i} className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">{strength}</span>
      ))}
    </div>
  );
}

function StarRating({ count, max = 5 }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(max)].map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i < count ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
        />
      ))}
    </div>
  );
}

function DollarRating({ count, max = 5 }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(max)].map((_, i) => (
        <span
          key={i}
          className={`text-sm font-semibold ${i < count ? "text-green-600" : "text-slate-300"}`}
        >
          $
        </span>
      ))}
    </div>
  );
}

function ModelRatings({ model }) {
  return (
    <div className="flex items-center justify-between gap-4 mt-2 p-2 bg-slate-50 rounded border border-slate-200">
      <div>
        <p className="text-xs font-semibold text-slate-600 mb-1">Prose Quality</p>
        <StarRating count={model.proseQuality} />
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-600 mb-1">Token Cost</p>
        <DollarRating count={model.tokenCost} />
      </div>
    </div>
  );
}

export default function ModelSuggestionPanel({ genre, selectedModel, onSelectModel }) {
  const [expanded, setExpanded] = useState(false);

  if (!genre) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-slate-500">
        <Settings className="w-4 h-4" />
        <span className="text-sm">Select a genre to get AI model recommendations</span>
      </div>
    );
  }

  const routing = MODEL_GENRE_ROUTING[genre];
  if (!routing) return null;

  const primaryModel = AI_MODEL_PROFILES[routing.primary];
  const altModels = routing.alts.map(id => AI_MODEL_PROFILES[id]).filter(Boolean);
  const allModelIds = Object.keys(AI_MODEL_PROFILES);
  const otherModels = allModelIds
    .filter(id => id !== routing.primary && !routing.alts.includes(id))
    .map(id => AI_MODEL_PROFILES[id]).filter(Boolean);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors border-b"
      >
        <div className="flex items-center gap-2 text-slate-700 font-semibold">
          <Settings className="w-4 h-4" />
          AI Model Recommendation
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      <div className="p-4 space-y-4">
        {/* Recommended Model */}
        <div>
          <ModelCard
            model={primaryModel}
            isRecommended={true}
            isSelected={selectedModel === routing.primary}
            onSelect={onSelectModel}
          />
          {selectedModel === routing.primary && (
            <div className="mt-2 space-y-2">
              <ReasonText text={routing.reason} />
              <StyleBeatCallout text={routing.styleBeat} />
              <StrengthTags strengths={primaryModel.strengths} />
            </div>
          )}
        </div>

        {/* Expanded content */}
        {expanded && (
          <>
            {/* Alternative Models */}
            {altModels.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Alternative Models</p>
                <div className="space-y-2">
                  {altModels.map(model => (
                    <div key={model.id}>
                      <ModelCard
                        model={model}
                        isRecommended={false}
                        isSelected={selectedModel === model.id}
                        onSelect={onSelectModel}
                      />
                      {selectedModel === model.id && (
                        <div className="mt-2 space-y-2">
                          <StyleBeatCallout text={routing.styleBeat} />
                          <StrengthTags strengths={model.strengths} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Available Models */}
            {otherModels.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">All Available Models</p>
                <div className="space-y-2">
                  {otherModels.map(model => (
                    <div key={model.id}>
                      <ModelCard
                        model={model}
                        isRecommended={false}
                        isSelected={selectedModel === model.id}
                        onSelect={onSelectModel}
                      />
                      {selectedModel === model.id && (
                        <div className="mt-2 space-y-2">
                          <StrengthTags strengths={model.strengths} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {selectedModel && (
        <div className="px-4 py-2.5 bg-indigo-50 border-t border-slate-200 text-sm text-slate-700">
          Selected: <span className="font-semibold">{AI_MODEL_PROFILES[selectedModel]?.name || "Unknown"}</span>
        </div>
      )}
    </div>
  );
}