import React from "react";
import { cn } from "@/lib/utils";

const BEAT_STYLE_LABELS = {
  "fast-paced-thriller": "Fast-Paced Thriller",
  "gritty-cinematic": "Gritty Cinematic",
  "hollywood-blockbuster": "Hollywood Blockbuster",
  "slow-burn": "Slow Burn",
  "clean-romance": "Clean Romance",
  "faith-infused": "Faith-Infused Contemporary",
  "investigative-nonfiction": "Investigative Nonfiction",
  "reference-educational": "Reference / Educational",
  "intellectual-psychological": "Intellectual Psychological",
  "dark-suspense": "Dark Suspense",
  "satirical": "Satirical",
  "epic-historical": "Epic Historical",
  "whimsical-cozy": "Whimsical Cozy",
  "hard-boiled-noir": "Hard-Boiled Noir",
  "grandiose-space-opera": "Grandiose Space Opera",
  "visceral-horror": "Visceral Horror",
  "poetic-magical-realism": "Poetic Magical Realism",
  "clinical-procedural": "Clinical Procedural",
  "hyper-stylized-action": "Hyper-Stylized Action",
  "nostalgic-coming-of-age": "Nostalgic Coming-of-Age",
  "cerebral-sci-fi": "Cerebral Sci-Fi",
  "high-stakes-political": "High-Stakes Political",
  "surrealist-avant-garde": "Surrealist Avant-Garde",
  "melancholic-literary": "Melancholic Literary",
  "urban-gritty-fantasy": "Urban Gritty Fantasy",
};

const SPICE_LABELS = { 0: "Fade to Black", 1: "Closed Door", 2: "Cracked Door", 3: "Open Door", 4: "Full Intensity" };
const LANGUAGE_LABELS = { 0: "Clean", 1: "Mild", 2: "Moderate", 3: "Strong", 4: "Raw" };

function MeterDots({ value, max = 4, filledClass, emptyClass }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max + 1 }, (_, i) => (
        <span key={i} className={cn("text-[9px]", i <= value ? filledClass : emptyClass)}>●</span>
      ))}
    </span>
  );
}

export default function SpecSettingsSummary({ spec }) {
  if (!spec) return null;

  const beatKey = spec.beat_style || spec.tone_style;
  const beatLabel = BEAT_STYLE_LABELS[beatKey] || beatKey || "Not selected";
  const spice = spec.spice_level ?? 0;
  const lang = spec.language_intensity ?? 0;

  // Only show if at least one setting is configured
  const hasAny = beatKey || spice > 0 || lang > 0;
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
      {beatKey && (
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-medium">Beat Style</span>
          <span className="text-slate-700 font-semibold">{beatLabel}</span>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <span className="text-slate-400 font-medium">Spice</span>
        <MeterDots value={spice} filledClass="text-rose-500" emptyClass="text-slate-300" />
        <span className="text-slate-600">{SPICE_LABELS[spice]}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-slate-400 font-medium">Language</span>
        <MeterDots value={lang} filledClass="text-amber-500" emptyClass="text-slate-300" />
        <span className="text-slate-600">{LANGUAGE_LABELS[lang]}</span>
      </div>
    </div>
  );
}