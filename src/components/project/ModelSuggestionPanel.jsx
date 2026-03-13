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
    description: "Strongest factual accuracy of non-Claude models. Best for nonfiction. Fiction prose trends ornate — enforcement layer compensates.",
    strengths: ["Factual accuracy", "Research synthesis", "Data-driven narratives", "Technical precision"],
    proseQuality: 3,
    tokenCost: 3
  },
  "deepseek-chat": {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    provider: "DeepSeek",
    description: "Cost-effective creative writing with strong instruction following when properly prompted.",
    strengths: ["Low cost per token", "Long context window", "Good at structured output"],
    proseQuality: 3,
    tokenCost: 1
  },
  "deepseek-reasoner": {
    id: "deepseek-reasoner",
    name: "DeepSeek Reasoner",
    provider: "DeepSeek",
    description: "Chain-of-thought reasoning model. Better at following complex multi-step instructions.",
    strengths: ["Instruction compliance", "Complex rule following", "Analytical content"],
    proseQuality: 3,
    tokenCost: 2
  }
};

const MODEL_GENRE_ROUTING = {
  "Literary Fiction": { primary: "claude-opus-4-5", reason: "Literary fiction demands sophisticated vocabulary, complex narrative structures, and avoidance of AI-isms. Opus excels at nuanced, layered prose.", styleBeat: "Literary & Lyrical prose with deep thematic exploration", alts: ["claude-sonnet-4-5"] },
  "Science Fiction": { primary: "claude-opus-4-5", reason: "Hard sci-fi needs complex world-building and scientific reasoning. Opus handles technical accuracy alongside literary quality.", styleBeat: "Cerebral, world-building heavy with scientific grounding", alts: ["claude-sonnet-4-5", "gpt-4o"] },
  "Fantasy": { primary: "claude-opus-4-5", reason: "Epic fantasy requires mythic prose, deep world-building, and maintaining consistency across complex lore systems.", styleBeat: "Mythic & elevated prose with rich world-building descriptions", alts: ["claude-sonnet-4-5", "gpt-4o"] },
  "Mystery/Thriller": { primary: "claude-opus-4-5", reason: "Psychological depth, misdirection, and carefully plotted reveals require Opus-level reasoning and narrative control.", styleBeat: "Suspenseful, tightly plotted with strategic misdirection", alts: ["claude-sonnet-4-5"] },
  "Romance": { primary: "gpt-4o-creative", reason: "Romance benefits from accessible, emotionally engaging prose with strong dialogue and genre convention awareness.", styleBeat: "Romantic & passionate with character-driven emotional arcs", alts: ["gpt-4o", "claude-sonnet-4-5", "deepseek-chat"] },
  "Horror": { primary: "claude-opus-4-5", reason: "Horror requires cosmic dread, existential tension, and somber scholarly tones — especially Lovecraftian elements. Opus handles dark literary nuance masterfully.", styleBeat: "Cosmic dread, existential horror, scholarly and somber", alts: ["claude-sonnet-4-5"] },
  "Historical Fiction": { primary: "claude-opus-4-5", reason: "Historical fiction demands fluid, immersive, cinematic prose while maintaining strict factual accuracy. Opus separates myths from verified facts.", styleBeat: "Fluid, immersive, cinematic — dramatic consequences of real motivations", alts: ["gpt-4-turbo", "claude-sonnet-4-5"] },
  "Adventure": { primary: "gpt-4o-creative", reason: "Adventure writing thrives on fast pacing, punchy prose, and page-turning momentum.", styleBeat: "Fast-paced, action-oriented with cinematic set pieces", alts: ["gpt-4o", "claude-sonnet-4-5", "deepseek-chat"] },
  "Dystopian": { primary: "claude-opus-4-5", reason: "Dystopian fiction needs complex social commentary, world-building, and philosophical depth.", styleBeat: "Bleak & thought-provoking with layered social commentary", alts: ["claude-sonnet-4-5"] },
  "Magical Realism": { primary: "claude-opus-4-5", reason: "Magical realism requires seamless blending of the mundane and mythic with literary sophistication.", styleBeat: "Lush, mythic-mundane blend with literary elegance", alts: ["claude-sonnet-4-5"] },
  "Young Adult": { primary: "gpt-4o-creative", reason: "YA needs accessible language, relatable voice, and strong genre convention awareness for teen audiences.", styleBeat: "Accessible, emotionally resonant with coming-of-age themes", alts: ["gpt-4o", "claude-sonnet-4-5", "deepseek-chat"] },
  "Children's": { primary: "gpt-4o-creative", reason: "Children's writing needs simple, engaging language with whimsical tone and age-appropriate vocabulary.", styleBeat: "Whimsical & playful with age-appropriate vocabulary", alts: ["gpt-4o", "claude-sonnet-4-5", "deepseek-chat"] },
  "Self-Help": { primary: "claude-sonnet-4-5", reason: "Self-help needs clear, motivational prose with actionable insights and an engaging but authoritative tone.", styleBeat: "TED Talk engaging with actionable, motivational tone", alts: ["gpt-4o", "deepseek-chat"] },
  "Business": { primary: "claude-sonnet-4-5", reason: "Business books need a balance of authority, case studies, and accessible explanations of complex concepts.", styleBeat: "Authoritative yet accessible with data-driven narratives", alts: ["gpt-4o", "gpt-4-turbo", "deepseek-chat"] },
  "Biography/Memoir": { primary: "claude-opus-4-5", reason: "Biography demands literary narrative craft, emotional depth, and meticulous factual accuracy.", styleBeat: "Immersive narrative with deep character portraiture", alts: ["claude-sonnet-4-5"] },
  "History": { primary: "claude-opus-4-5", reason: "History writing needs fluid, cinematic prose at 1500+ words per chapter while maintaining strict factual accuracy.", styleBeat: "Fluid, immersive, cinematic — strictly factual, no invented events", alts: ["gpt-4-turbo", "claude-sonnet-4-5"] },
  "Science": { primary: "gemini-pro", reason: "Science writing requires factual precision, research synthesis, and the ability to make complex topics accessible.", styleBeat: "Academic but accessible with awe-inspiring explanations", alts: ["claude-sonnet-4-5", "gpt-4-turbo"] },
  "Technology": { primary: "gemini-pro", reason: "Technology books need up-to-date accuracy, clear technical explanations, and practical examples.", styleBeat: "Clear, technically precise with forward-looking perspective", alts: ["claude-sonnet-4-5", "gpt-4-turbo"] },
  "Philosophy": { primary: "claude-opus-4-5", reason: "Philosophy demands sophisticated reasoning, complex argumentation, and ability to handle abstract concepts with precision.", styleBeat: "Cerebral & intellectual with rigorous logical structure", alts: ["claude-sonnet-4-5"] },
  "Psychology": { primary: "claude-opus-4-5", reason: "Psychology books need nuanced exploration of human behavior with both scientific rigor and narrative accessibility.", styleBeat: "Introspective & insightful with research-backed narratives", alts: ["claude-sonnet-4-5", "gpt-4-turbo"] },
  "Health & Wellness": { primary: "gemini-pro", reason: "Health writing needs strict factual accuracy, evidence-based claims, and clear actionable guidance.", styleBeat: "Evidence-based, warm, and actionable", alts: ["claude-sonnet-4-5", "gpt-4-turbo", "deepseek-chat"] },
  "Travel": { primary: "claude-sonnet-4-5", reason: "Travel writing needs vivid sensory description, cultural awareness, and engaging narrative flow.", styleBeat: "Vivid, sensory-rich with cultural curiosity", alts: ["claude-opus-4-5", "gpt-4o"] },
  "True Crime": { primary: "claude-opus-4-5", reason: "True crime needs investigative rigor, dark atmospheric prose, and careful ethical handling of sensitive subjects.", styleBeat: "Dark & gritty, investigative — strictly factual crime narrative", alts: ["claude-sonnet-4-5", "gpt-4-turbo"] },
  "Education": { primary: "gemini-pro", reason: "Education books need clear instructional design, research-backed pedagogy, and accessible explanations.", styleBeat: "Clear, structured, pedagogically sound", alts: ["claude-sonnet-4-5", "gpt-4-turbo", "deepseek-chat"] },
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

export default function ModelSuggestionPanel({ genre, bookType, selectedModel, onSelectModel }) {
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
          Prose Composition Model
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      <div className="p-4 space-y-4">
        <p className="text-xs text-slate-500 leading-relaxed">
          Selects the AI that writes your chapter prose. Outline generation, beat structure, and content routing always use their dedicated engines and are not affected by this setting.
        </p>
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

      {/* GPT SFW-only warning */}
      {selectedModel && (selectedModel.startsWith("gpt-")) && (
        <div className="mx-4 mb-4 mt-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-800 mb-2">⚠ GPT Note — SFW Projects Only</p>
          <p className="text-slate-700 mb-1.5 font-medium">GPT works best for:</p>
          <ul className="text-slate-600 space-y-0.5 mb-2 ml-1">
            <li>✓ SFW fiction and nonfiction</li>
            <li>✓ Clean romance, thriller, literary genres</li>
            <li>✓ Projects where content policy is a priority</li>
          </ul>
          <p className="text-slate-700 mb-1.5 font-medium">GPT is not recommended for:</p>
          <ul className="text-slate-600 space-y-0.5 mb-2 ml-1">
            <li>✗ Erotica genre (content ceiling applies)</li>
            <li>✗ Projects requiring explicit scene generation</li>
          </ul>
          <p className="text-xs text-amber-700 leading-relaxed">
            For Erotica projects, Claude + Lumimaid hybrid is required for full pipeline functionality.
          </p>
        </div>
      )}

      {/* Prose model guidance — fiction & nonfiction */}
      {bookType && (
        <div className="mx-4 mb-4 mt-2 rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-800 mb-3">
            {bookType === "nonfiction" ? "Nonfiction" : "Fiction"} Prose Model Guidance
          </p>
          <div className="space-y-2">
            {bookType === "fiction" ? (<>
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold mt-0.5 shrink-0">✓</span>
                <div><span className="font-medium text-slate-800">Claude</span><span className="text-slate-600"> — Best default. Clean, controlled, genre-aware.</span></div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-500 font-bold mt-0.5 shrink-0">⚠</span>
                <div><span className="font-medium text-slate-800">Gemini</span><span className="text-slate-600"> — Capable but prone to purple prose. Enforcement layer active.</span></div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-500 font-bold mt-0.5 shrink-0">⚠</span>
                <div><span className="font-medium text-slate-800">DeepSeek</span><span className="text-slate-600"> — Strong psychology, watch for over-analysis in quieter scenes.</span></div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-500 font-bold mt-0.5 shrink-0">⚠</span>
                <div><span className="font-medium text-slate-800">GPT</span><span className="text-slate-600"> — SFW only. Needs length enforcement.</span></div>
              </div>
            </>) : (<>
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold mt-0.5 shrink-0">✓</span>
                <div><span className="font-medium text-slate-800">Claude</span><span className="text-slate-600"> — Best default. Strong narrative voice, reliable fact-flagging.</span></div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold mt-0.5 shrink-0">✓</span>
                <div><span className="font-medium text-slate-800">DeepSeek</span><span className="text-slate-600"> — Strong research depth. Enforcement handles over-analysis.</span></div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-500 font-bold mt-0.5 shrink-0">⚠</span>
                <div><span className="font-medium text-slate-800">Gemini</span><span className="text-slate-600"> — Good factual accuracy, academic tone risk. Enforcement active.</span></div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-500 font-bold mt-0.5 shrink-0">⚠</span>
                <div><span className="font-medium text-slate-800">GPT</span><span className="text-slate-600"> — Workable for most subgenres. Not recommended for Investigative.</span></div>
              </div>
            </>)}
          </div>
        </div>
      )}

      {/* Gemini prose warning */}
      {selectedModel === "gemini-pro" && (
        <div className="mx-4 mb-4 mt-2 rounded-lg border border-purple-300 bg-purple-50 p-4 text-sm">
          <p className="font-semibold text-purple-800 mb-2">⚠ Gemini Prose Note</p>
          {bookType === "nonfiction" ? (
            <>
              <p className="text-slate-700 mb-1.5 font-medium">Gemini nonfiction strengths:</p>
              <ul className="text-slate-600 space-y-0.5 mb-2 ml-1">
                <li>✓ Strongest factual accuracy of non-Claude models</li>
                <li>✓ Excellent research depth and synthesis</li>
              </ul>
              <p className="text-slate-700 mb-1.5 font-medium">Gemini nonfiction risks (enforcement active):</p>
              <ul className="text-slate-600 space-y-0.5 mb-2 ml-1">
                <li>✗ Defaults to academic register — bloodless, measured</li>
                <li>✗ Over-hedges on contested facts, stalling momentum</li>
                <li>✗ Pads to length with qualifying clauses instead of scene</li>
              </ul>
            </>
          ) : (
            <>
              <p className="text-slate-700 mb-1.5 font-medium">Gemini fiction risks (enforcement active):</p>
              <ul className="text-slate-600 space-y-0.5 mb-2 ml-1">
                <li>✗ Purple prose — over-describes, reaches for ornate metaphors</li>
                <li>✗ Emotional inflation — small moments feel too epic</li>
                <li>✗ Elevated dialogue — characters sound like speeches</li>
                <li>✗ Pads with descriptive layers rather than advancing story</li>
              </ul>
              <p className="text-xs text-purple-700 leading-relaxed mt-2">
                Enforcement layer actively suppresses these patterns. For best results on literary or character-driven fiction, Claude is recommended.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}