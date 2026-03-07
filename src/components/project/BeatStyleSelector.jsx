import React from "react";
import { Zap, Flame, BookOpen } from "lucide-react";

const BEAT_STYLE_GROUPS = [
  {
    label: "⚡ High Intensity / Fast Pacing",
    styles: [
      { key: "fast-paced-thriller",    label: "Fast-Paced Thriller",    desc: "Relentless momentum, immediate stakes",          intensity: 4, spice: 2 },
      { key: "hyper-stylized-action",  label: "Hyper-Stylized Action",  desc: "Choreographed spectacle, peak energy",           intensity: 4, spice: 2 },
      { key: "hollywood-blockbuster",  label: "Hollywood Blockbuster",  desc: "Big visuals, hero-driven momentum",              intensity: 4, spice: 1 },
      { key: "visceral-horror",        label: "Visceral Horror",        desc: "Sensory-driven descent into fear",               intensity: 4, spice: 4 },
      { key: "grandiose-space-opera",  label: "Grandiose Space Opera",  desc: "Interstellar conflict, epic scale",              intensity: 4, spice: 1 },
    ],
  },
  {
    label: "🔥 Medium-High Intensity / Driven Pacing",
    styles: [
      { key: "gritty-cinematic",       label: "Gritty Cinematic",       desc: "Raw realism, tactile environments",              intensity: 3, spice: 3 },
      { key: "dark-suspense",          label: "Dark Suspense",          desc: "Claustrophobic dread, controlled fear",          intensity: 3, spice: 3 },
      { key: "hard-boiled-noir",       label: "Hard-Boiled Noir",       desc: "Cynical grit, urban underworld",                 intensity: 3, spice: 3 },
      { key: "urban-gritty-fantasy",   label: "Urban Gritty Fantasy",   desc: "High magic meets dirty city life",              intensity: 3, spice: 3 },
      { key: "high-stakes-political",  label: "High-Stakes Political",  desc: "Machiavellian power chess",                     intensity: 3, spice: 2 },
      { key: "epic-historical",        label: "Epic Historical",        desc: "Grand-scale pivotal moments",                   intensity: 3, spice: 2 },
      { key: "investigative-nonfiction",label:"Investigative Nonfiction",desc:"Evidence-based narrative",                      intensity: 3, spice: 2 },
    ],
  },
  {
    label: "🧠 Medium Intensity / Measured Pacing",
    styles: [
      { key: "intellectual-psychological", label: "Intellectual Psychological", desc: "Thought-driven tension",                 intensity: 2, spice: 2 },
      { key: "cerebral-sci-fi",        label: "Cerebral Sci-Fi",        desc: "High-concept philosophy and ideas",             intensity: 2, spice: 1 },
      { key: "clinical-procedural",    label: "Clinical Procedural",    desc: "Meticulous investigation",                     intensity: 2, spice: 1 },
      { key: "satirical",              label: "Satirical",              desc: "Sharp commentary, controlled exaggeration",     intensity: 2, spice: 1 },
      { key: "surrealist-avant-garde", label: "Surrealist Avant-Garde", desc: "Dream-logic, abstract imagery",                intensity: 2, spice: 2 },
      { key: "clean-romance",          label: "Clean Romance",          desc: "Emotional intimacy, no explicit content",       intensity: 2, spice: 0 },
    ],
  },
  {
    label: "🌊 Low-Medium Intensity / Slow Pacing",
    styles: [
      { key: "slow-burn",              label: "Slow Burn",              desc: "Gradual tension, atmosphere before action",     intensity: 1, spice: 2 },
      { key: "nostalgic-coming-of-age",label: "Nostalgic Coming-of-Age",desc: "Bittersweet transition",                       intensity: 1, spice: 1 },
      { key: "melancholic-literary",   label: "Melancholic Literary",   desc: "Quiet beauty in sadness",                      intensity: 1, spice: 1 },
      { key: "poetic-magical-realism", label: "Poetic Magical Realism", desc: "Supernatural as mundane truth",                intensity: 1, spice: 1 },
      { key: "faith-infused",          label: "Faith-Infused Contemporary", desc: "Hope grounded in real life",               intensity: 1, spice: 0 },
    ],
  },
  {
    label: "✨ Low Intensity / Gentle Pacing",
    styles: [
      { key: "whimsical-cozy",         label: "Whimsical Cozy",         desc: "Gentle charm, small magic, community",         intensity: 0, spice: 0 },
      { key: "reference-educational",  label: "Reference / Educational", desc: "Clarity and structure",                       intensity: 0, spice: 0 },
    ],
  },
  {
    label: "🎭 Experimental / Variable Pacing",
    styles: [
      { key: "surrealist-avant-garde", label: "Surrealist Avant-Garde", desc: "Dream-logic, abstract imagery",                intensity: 2, spice: 2 },
    ],
  },
  {
    label: "💋 Romance & Erotica",
    styles: [
      { key: "steamy-romance",         label: "Steamy Romance",         desc: "Breathless chemistry, emotional vulnerability",  intensity: 3, spice: 4 },
      { key: "slow-burn-romance",      label: "Slow Burn Romance",      desc: "Agonizing anticipation, almost-touch tension",   intensity: 2, spice: 2 },
      { key: "dark-erotica",           label: "Dark Erotica",           desc: "Power dynamics, psychological tension",          intensity: 4, spice: 4 },
    ],
  },
];

// Flat map for lookup
const ALL_STYLES = BEAT_STYLE_GROUPS.flatMap(g => g.styles).reduce((acc, s) => {
  acc[s.key] = s;
  return acc;
}, {});

function MeterDots({ count, max = 4, activeColor }) {
  return (
    <div className="flex gap-0.5 items-center">
      {[...Array(max)].map((_, i) => (
        <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < count ? activeColor : "bg-slate-200"}`} />
      ))}
    </div>
  );
}

export function BeatStyleSelect({ value, onChange }) {
  const selected = value ? ALL_STYLES[value] : null;

  return (
    <div className="space-y-1.5">
      <select
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        className="w-full mt-1.5 px-3 py-2 text-sm border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">— Select a beat style —</option>
        {BEAT_STYLE_GROUPS.map(group => (
          <optgroup key={group.label} label={group.label}>
            {group.styles.map(s => (
              <option key={s.key} value={s.key}>{s.label} — {s.desc}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {selected && (
        <div className="flex items-center gap-5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 text-indigo-500" /> Intensity
            </p>
            <MeterDots count={selected.intensity} activeColor="bg-indigo-500" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <Flame className="w-2.5 h-2.5 text-rose-500" /> Spice
            </p>
            <MeterDots count={selected.spice} activeColor="bg-rose-500" />
          </div>
          <p className="text-xs text-slate-500 italic ml-auto">{selected.desc}</p>
        </div>
      )}
    </div>
  );
}

const SPICE_OPTIONS = [
  { value: 0, label: "🧊 Level 0 — Fade to Black", sub: "No sexual content" },
  { value: 1, label: "🌸 Level 1 — Closed Door",   sub: "Implied intimacy, sensual tension" },
  { value: 2, label: "🔥 Level 2 — Cracked Door",  sub: "Partial scenes, tasteful description" },
  { value: 3, label: "🌶️ Level 3 — Open Door",     sub: "Explicit scenes, emotionally grounded" },
  { value: 4, label: "💥 Level 4 — Full Intensity", sub: "Graphic, unflinching, character-driven" },
];

const LANGUAGE_OPTIONS = [
  { value: 0, label: "Level 0 — Clean",    sub: "No profanity" },
  { value: 1, label: "Level 1 — Mild",     sub: "Sparse mild expletives" },
  { value: 2, label: "Level 2 — Moderate", sub: "Occasional strong language at peaks" },
  { value: 3, label: "Level 3 — Strong",   sub: "Profanity in danger, anger, shock — character-driven" },
  { value: 4, label: "Level 4 — Raw",      sub: "Harsh, frequent — trauma/survival realism" },
];

function RatingSelect({ value, onChange, options, activeColor, icon: Icon, iconColor }) {
  return (
    <div className="space-y-1.5">
      <select
        value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        className="w-full mt-1.5 px-3 py-2 text-sm border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md">
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
            <Icon className={`w-2.5 h-2.5 ${iconColor}`} /> Level
          </p>
          <MeterDots count={value} max={4} activeColor={activeColor} />
        </div>
        <p className="text-xs text-slate-500 italic ml-2">{options[value]?.sub}</p>
      </div>
    </div>
  );
}

export function SpiceLevelSelect({ value, onChange }) {
  return <RatingSelect value={value} onChange={onChange} options={SPICE_OPTIONS} activeColor="bg-rose-500" icon={Flame} iconColor="text-rose-500" />;
}

export function LanguageIntensitySelect({ value, onChange }) {
  return <RatingSelect value={value} onChange={onChange} options={LANGUAGE_OPTIONS} activeColor="bg-amber-500" icon={BookOpen} iconColor="text-amber-500" />;
}

// Default export for legacy compatibility
export default BeatStyleSelect;