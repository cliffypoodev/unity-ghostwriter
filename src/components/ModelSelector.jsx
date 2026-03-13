import React, { useState } from "react";
import { ChevronDown, Star, Settings, AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AI_MODEL_PROFILES,
  MODEL_GENRE_ROUTING,
  PROVIDER_COLORS,
} from "@/constants/models";

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