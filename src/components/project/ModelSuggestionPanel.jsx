import React, { useState } from "react";
import { ChevronDown, Settings, Star } from "lucide-react";

const AI_MODEL_PROFILES = {
  "claude-opus": {
    id: "claude-opus",
    name: "Claude Opus",
    provider: "Anthropic",
    description: "Premium literary model. Excels at sophisticated vocabulary, complex reasoning, and nuanced prose with deep thematic layering.",
    strengths: ["Literary nuance", "Complex narrative structures", "Sophisticated vocabulary", "Deep thematic exploration", "Avoiding AI-isms"],
    proseQuality: 5,
    tokenCost: 5
  },
  "claude-sonnet": {
    id: "claude-sonnet",
    name: "Claude Sonnet",
    provider: "Anthropic",
    description: "Balanced creative writing with strong reasoning. Great all-rounder for most book projects.",
    strengths: ["Versatile prose style", "Strong character development", "Good pacing control", "Balanced creativity and coherence"],
    proseQuality: 5,
    tokenCost: 3
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
  "gpt-4o-creative": {
    id: "gpt-4o-creative",
    name: "GPT-4o (Creative Mode)",
    provider: "OpenAI",
    description: "Creative writing with a focus on accessible, page-turning prose. Good for genre fiction with broad appeal.",
    strengths: ["Fast-paced prose", "Accessible language", "Genre conventions", "Dialogue-heavy scenes"],
    proseQuality: 4,
    tokenCost: 4
  },
  "gemini-pro": {
    id: "gemini-pro",
    name: "Gemini Pro",
    provider: "Google",
    description: "Strong at research-backed writing and factual accuracy. Excellent for non-fiction that requires verified information.",
    strengths: ["Factual accuracy", "Research synthesis", "Data-driven narratives", "Source verification"],
    proseQuality: 4,
    tokenCost: 3
  }
};

const MODEL_GENRE_ROUTING = {
  "Literary Fiction": { primary: "claude-opus", reason: "Literary fiction demands sophisticated vocabulary, complex narrative structures, and avoidance of AI-isms. Opus excels at nuanced, layered prose.", styleBeat: "Literary & Lyrical prose with deep thematic exploration", alts: ["claude-sonnet"] },
  "Science Fiction": { primary: "claude-opus", reason: "Hard sci-fi needs complex world-building and scientific reasoning. Opus handles technical accuracy alongside literary quality.", styleBeat: "Cerebral, world-building heavy with scientific grounding", alts: ["claude-sonnet", "gemini-pro"] },
  "Fantasy": { primary: "claude-opus", reason: "Epic fantasy requires mythic prose, deep world-building, and maintaining consistency across complex lore systems.", styleBeat: "Mythic & elevated prose with rich world-building descriptions", alts: ["claude-sonnet", "gpt-4o-creative"] },
  "Mystery/Thriller": { primary: "claude-opus", reason: "Psychological depth, misdirection, and carefully plotted reveals require Opus-level reasoning and narrative control.", styleBeat: "Suspenseful, tightly plotted with strategic misdirection", alts: ["claude-sonnet"] },
  "Romance": { primary: "gpt-4o-creative", reason: "Romance benefits from accessible, emotionally engaging prose with strong dialogue and genre convention awareness.", styleBeat: "Romantic & passionate with character-driven emotional arcs", alts: ["claude-sonnet"] },
  "Horror": { primary: "claude-opus", reason: "Horror requires cosmic dread, existential tension, and somber scholarly tones — especially Lovecraftian elements. Opus handles dark literary nuance masterfully.", styleBeat: "Cosmic dread, existential horror, scholarly and somber", alts: ["claude-sonnet"] },
  "Historical Fiction": { primary: "claude-opus", reason: "Historical fiction demands fluid, immersive, cinematic prose while maintaining strict factual accuracy. Opus separates myths from verified facts.", styleBeat: "Fluid, immersive, cinematic — dramatic consequences of real motivations", alts: ["gemini-pro", "claude-sonnet"] },
  "Adventure": { primary: "gpt-4o-creative", reason: "Adventure writing thrives on fast pacing, punchy prose, and page-turning momentum.", styleBeat: "Fast-paced, action-oriented with cinematic set pieces", alts: ["claude-sonnet"] },
  "Dystopian": { primary: "claude-opus", reason: "Dystopian fiction needs complex social commentary, world-building, and philosophical depth.", styleBeat: "Bleak & thought-provoking with layered social commentary", alts: ["claude-sonnet"] },
  "Magical Realism": { primary: "claude-opus", reason: "Magical realism requires seamless blending of the mundane and mythic with literary sophistication.", styleBeat: "Lush, mythic-mundane blend with literary elegance", alts: ["claude-sonnet"] },
  "Young Adult": { primary: "gpt-4o-creative", reason: "YA needs accessible language, relatable voice, and strong genre convention awareness for teen audiences.", styleBeat: "Accessible, emotionally resonant with coming-of-age themes", alts: ["claude-sonnet"] },
  "Children's": { primary: "gpt-4o-creative", reason: "Children's writing needs simple, engaging language with whimsical tone and age-appropriate vocabulary.", styleBeat: "Whimsical & playful with age-appropriate vocabulary", alts: ["claude-sonnet"] },
  "Self-Help": { primary: "claude-sonnet", reason: "Self-help needs clear, motivational prose with actionable insights and an engaging but authoritative tone.", styleBeat: "TED Talk engaging with actionable, motivational tone", alts: ["gpt-4o"] },
  "Business": { primary: "claude-sonnet", reason: "Business books need a balance of authority, case studies, and accessible explanations of complex concepts.", styleBeat: "Authoritative yet accessible with data-driven narratives", alts: ["gpt-4o", "gemini-pro"] },
  "Biography/Memoir": { primary: "claude-opus", reason: "Biography demands literary narrative craft, emotional depth, and meticulous factual accuracy.", styleBeat: "Immersive narrative with deep character portraiture", alts: ["claude-sonnet", "gemini-pro"] },
  "History": { primary: "claude-opus", reason: "History writing needs fluid, cinematic prose at 1500+ words per chapter while maintaining strict factual accuracy.", styleBeat: "Fluid, immersive, cinematic — strictly factual, no invented events", alts: ["gemini-pro", "claude-sonnet"] },
  "Science": { primary: "gemini-pro", reason: "Science writing requires factual precision, research synthesis, and the ability to make complex topics accessible.", styleBeat: "Academic but accessible with awe-inspiring explanations", alts: ["claude-opus", "claude-sonnet"] },
  "Technology": { primary: "gemini-pro", reason: "Technology books need up-to-date accuracy, clear technical explanations, and practical examples.", styleBeat: "Clear, technically precise with forward-looking perspective", alts: ["claude-sonnet", "gpt-4o"] },
  "Philosophy": { primary: "claude-opus", reason: "Philosophy demands sophisticated reasoning, complex argumentation, and ability to handle abstract concepts with precision.", styleBeat: "Cerebral & intellectual with rigorous logical structure", alts: ["claude-sonnet"] },
  "Psychology": { primary: "claude-opus", reason: "Psychology books need nuanced exploration of human behavior with both scientific rigor and narrative accessibility.", styleBeat: "Introspective & insightful with research-backed narratives", alts: ["claude-sonnet", "gemini-pro"] },
  "Health & Wellness": { primary: "gemini-pro", reason: "Health writing needs strict factual accuracy, evidence-based claims, and clear actionable guidance.", styleBeat: "Evidence-based, warm, and actionable", alts: ["claude-sonnet"] },
  "Travel": { primary: "claude-sonnet", reason: "Travel writing needs vivid sensory description, cultural awareness, and engaging narrative flow.", styleBeat: "Vivid, sensory-rich with cultural curiosity", alts: ["claude-opus", "gpt-4o-creative"] },
  "True Crime": { primary: "claude-opus", reason: "True crime needs investigative rigor, dark atmospheric prose, and careful ethical handling of sensitive subjects.", styleBeat: "Dark & gritty, investigative — strictly factual crime narrative", alts: ["claude-sonnet", "gemini-pro"] },
  "Education": { primary: "gemini-pro", reason: "Education books need clear instructional design, research-backed pedagogy, and accessible explanations.", styleBeat: "Clear, structured, pedagogically sound", alts: ["claude-sonnet"] }
};

const PROVIDER_COLORS = {
  Anthropic: { bg: "bg-amber-50", text: "text-amber-700", badge: "bg-amber-100 text-amber-700" },
  OpenAI: { bg: "bg-blue-50", text: "text-blue-700", badge: "bg-blue-100 text-blue-700" },
  Google: { bg: "bg-purple-50", text: "text-purple-700", badge: "bg-purple-100 text-purple-700" }
};

function ModelCard({ model, isRecommended, isSelected, onSelect }) {
  const colors = PROVIDER_COLORS[model.provider];
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
        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${isSelected ? "border-indigo-500 bg-indigo-500" : "border-slate-300 bg-white"}`} />
      </div>
      <p className="text-sm text-slate-600 mb-2">{model.description}</p>
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
    .map(id => AI_MODEL_PROFILES[id]);

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
            <div className="mt-2">
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
                        <div className="mt-2">
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
                        <div className="mt-2">
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