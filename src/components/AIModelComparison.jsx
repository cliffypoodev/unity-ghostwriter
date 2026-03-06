import React from "react";
import { Star } from "lucide-react";

const AI_MODELS = {
  "claude-opus-4-5": {
    label: "Claude Opus (Most Powerful)",
    proseQuality: 5,
    tokenCost: 1,
    verdict: "Elite prose quality but expensive. Best for premium output.",
  },
  "claude-sonnet-4-5": {
    label: "Claude Sonnet (Balanced)",
    proseQuality: 5,
    tokenCost: 3,
    verdict: "Gold standard for creative writing. Distinct literary flair.",
  },
  "claude-haiku-4-5": {
    label: "Claude Haiku (Fastest)",
    proseQuality: 3,
    tokenCost: 5,
    verdict: "Functional and clear, but lacks emotional nuance.",
  },
  "gpt-4o": {
    label: "GPT-4o (OpenAI - Most Capable)",
    proseQuality: 4,
    tokenCost: 4,
    verdict: "High-quality prose. Can be chatty/formulaic. Excellent all-rounder.",
  },
  "gpt-4-turbo": {
    label: "GPT-4 Turbo (OpenAI - Fast)",
    proseQuality: 4,
    tokenCost: 4,
    verdict: "Similar to GPT-4o with faster inference.",
  },
  "deepseek-chat": {
    label: "DeepSeek Chat (Cost-Effective)",
    proseQuality: 3,
    tokenCost: 5,
    verdict: "Incredible value. Prose is efficient but often clinical.",
  },
};

const StarRating = ({ count, max = 5 }) => (
  <div className="flex gap-0.5">
    {[...Array(max)].map((_, i) => (
      <Star
        key={i}
        className={`w-3.5 h-3.5 ${i < count ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
      />
    ))}
  </div>
);

export default function AIModelComparison({ selectedModel }) {
  const model = AI_MODELS[selectedModel];
  if (!model) return null;

  return (
    <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1">Prose Quality</p>
            <StarRating count={model.proseQuality} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1">Token Cost</p>
            <StarRating count={model.tokenCost} />
          </div>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">{model.verdict}</p>
      </div>
    </div>
  );
}