import React, { useState } from "react";
import { ChevronDown, Zap, Flame } from "lucide-react";

// intensity: 0-4 (narrative pacing/tension speed)
// spice: 0-4 (darkness, edge, adult themes)
const BEAT_STYLES = {
  fiction: [
    { key: "fast-paced-thriller",       label: "Fast-Paced Thriller",        desc: "Relentless momentum, immediate stakes",           intensity: 4, spice: 2 },
    { key: "gritty-cinematic",          label: "Gritty Cinematic",           desc: "Raw realism, tactile environments",               intensity: 3, spice: 3 },
    { key: "hollywood-blockbuster",     label: "Hollywood Blockbuster",      desc: "Big visuals, hero-driven spectacle",              intensity: 4, spice: 1 },
    { key: "slow-burn",                 label: "Slow Burn",                  desc: "Gradual tension, atmosphere before action",       intensity: 1, spice: 2 },
    { key: "clean-romance",             label: "Clean Romance",              desc: "Emotional intimacy, no explicit content",         intensity: 2, spice: 0 },
    { key: "faith-infused",             label: "Faith-Infused Contemporary", desc: "Hope grounded in real life",                     intensity: 1, spice: 0 },
    { key: "dark-suspense",             label: "Dark Suspense",              desc: "Claustrophobic dread, controlled fear",           intensity: 3, spice: 3 },
    { key: "hard-boiled-noir",          label: "Hard-Boiled Noir",           desc: "Cynical, gritty urban underworld",               intensity: 3, spice: 3 },
    { key: "grandiose-space-opera",     label: "Grandiose Space Opera",      desc: "Interstellar conflict, epic scale",               intensity: 4, spice: 1 },
    { key: "visceral-horror",           label: "Visceral Horror",            desc: "Sensory-driven descent into fear",                intensity: 4, spice: 4 },
    { key: "poetic-magical-realism",    label: "Poetic Magical Realism",     desc: "Supernatural as mundane truth",                  intensity: 1, spice: 1 },
    { key: "hyper-stylized-action",     label: "Hyper-Stylized Action",      desc: "High-energy choreographed spectacle",            intensity: 4, spice: 2 },
    { key: "nostalgic-coming-of-age",   label: "Nostalgic Coming-of-Age",    desc: "Bittersweet transition to adulthood",            intensity: 1, spice: 1 },
    { key: "cerebral-sci-fi",           label: "Cerebral Sci-Fi",            desc: "High-concept philosophy and ideas",              intensity: 2, spice: 1 },
    { key: "high-stakes-political",     label: "High-Stakes Political",      desc: "Machiavellian power chess",                      intensity: 3, spice: 2 },
    { key: "surrealist-avant-garde",    label: "Surrealist Avant-Garde",     desc: "Dream-logic, abstract imagery",                  intensity: 2, spice: 2 },
    { key: "melancholic-literary",      label: "Melancholic Literary",       desc: "Quiet beauty in sadness and regret",             intensity: 1, spice: 1 },
    { key: "urban-gritty-fantasy",      label: "Urban Gritty Fantasy",       desc: "High magic meets dirty city life",               intensity: 3, spice: 3 },
    { key: "epic-historical",           label: "Epic Historical",            desc: "Grand-scale pivotal moments",                    intensity: 3, spice: 2 },
    { key: "whimsical-cozy",            label: "Whimsical Cozy",             desc: "Gentle charm, small magic, community",           intensity: 0, spice: 0 },
    { key: "satirical",                 label: "Satirical",                  desc: "Sharp commentary, controlled exaggeration",      intensity: 2, spice: 1 },
    { key: "intellectual-psychological",label: "Intellectual Psychological", desc: "Thought-driven tension",                         intensity: 2, spice: 2 },
  ],
  nonfiction: [
    { key: "investigative-nonfiction",  label: "Investigative Nonfiction",   desc: "Evidence-based narrative",                       intensity: 3, spice: 2 },
    { key: "reference-educational",     label: "Reference / Educational",    desc: "Clarity and structure first",                    intensity: 0, spice: 0 },
    { key: "clinical-procedural",       label: "Clinical Procedural",        desc: "Meticulous, detail-oriented investigation",      intensity: 2, spice: 1 },
  ],
};

const INTENSITY_FILTER_OPTIONS = [
  { label: "All", value: null },
  { label: "Calm (0–1)", value: [0, 1] },
  { label: "Moderate (2)", value: [2, 2] },
  { label: "High (3–4)", value: [3, 4] },
];

const SPICE_FILTER_OPTIONS = [
  { label: "All", value: null },
  { label: "Clean (0)", value: [0, 0] },
  { label: "Mild (1–2)", value: [1, 2] },
  { label: "Dark (3–4)", value: [3, 4] },
];

function MeterDots({ count, max = 4, activeColor }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(max)].map((_, i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full ${i < count ? activeColor : "bg-slate-200"}`}
        />
      ))}
    </div>
  );
}

function BeatCard({ style, isSelected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(isSelected ? "" : style.key)}
      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
        isSelected
          ? "border-indigo-500 bg-indigo-50"
          : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900 text-sm leading-tight">{style.label}</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-snug">{style.desc}</p>
        </div>
        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${isSelected ? "border-indigo-500 bg-indigo-500" : "border-slate-300"}`} />
      </div>
      <div className="flex items-center gap-4 mt-2">
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
            <Zap className="w-2.5 h-2.5" /> Intensity
          </p>
          <MeterDots count={style.intensity} activeColor="bg-indigo-500" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
            <Flame className="w-2.5 h-2.5" /> Spice
          </p>
          <MeterDots count={style.spice} activeColor="bg-rose-500" />
        </div>
      </div>
    </button>
  );
}

export default function BeatStyleSelector({ value, onChange, bookType = "fiction" }) {
  const [expanded, setExpanded] = useState(false);
  const [intensityFilter, setIntensityFilter] = useState(null);
  const [spiceFilter, setSpiceFilter] = useState(null);

  const allStyles = BEAT_STYLES[bookType] || BEAT_STYLES.fiction;

  const filtered = allStyles.filter(s => {
    if (intensityFilter && (s.intensity < intensityFilter[0] || s.intensity > intensityFilter[1])) return false;
    if (spiceFilter && (s.spice < spiceFilter[0] || s.spice > spiceFilter[1])) return false;
    return true;
  });

  const selectedStyle = allStyles.find(s => s.key === value);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden mt-1.5">
      {/* Header / trigger */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2.5 bg-white hover:bg-slate-50 flex items-center justify-between transition-colors"
      >
        <span className="text-sm text-slate-700">
          {selectedStyle ? (
            <span className="font-medium text-slate-900">{selectedStyle.label}</span>
          ) : (
            <span className="text-slate-400">— Select a beat style —</span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
      </button>

      {/* Selected style summary (when collapsed) */}
      {!expanded && selectedStyle && (
        <div className="px-3 pb-2.5 flex items-center gap-5 bg-white border-t border-slate-100">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" /> Intensity
            </p>
            <MeterDots count={selectedStyle.intensity} activeColor="bg-indigo-500" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <Flame className="w-2.5 h-2.5" /> Spice
            </p>
            <MeterDots count={selectedStyle.spice} activeColor="bg-rose-500" />
          </div>
          <p className="text-xs text-slate-500 ml-auto italic">{selectedStyle.desc}</p>
        </div>
      )}

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-slate-200 bg-slate-50">
          {/* Filters */}
          <div className="px-3 py-2 border-b border-slate-200 bg-white space-y-2">
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 text-indigo-500" /> Intensity
              </p>
              <div className="flex flex-wrap gap-1.5">
                {INTENSITY_FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => setIntensityFilter(JSON.stringify(intensityFilter) === JSON.stringify(opt.value) ? null : opt.value)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      JSON.stringify(intensityFilter) === JSON.stringify(opt.value)
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-slate-600 border-slate-300 hover:border-indigo-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Flame className="w-2.5 h-2.5 text-rose-500" /> Spice / Darkness
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SPICE_FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => setSpiceFilter(JSON.stringify(spiceFilter) === JSON.stringify(opt.value) ? null : opt.value)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      JSON.stringify(spiceFilter) === JSON.stringify(opt.value)
                        ? "bg-rose-600 text-white border-rose-600"
                        : "bg-white text-slate-600 border-slate-300 hover:border-rose-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Style grid */}
          <div className="p-3 max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No styles match these filters.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {filtered.map(style => (
                  <BeatCard
                    key={style.key}
                    style={style}
                    isSelected={value === style.key}
                    onSelect={(key) => { onChange(key); setExpanded(false); }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Clear */}
          {value && (
            <div className="px-3 pb-3">
              <button
                onClick={() => { onChange(""); setExpanded(false); }}
                className="text-xs text-slate-400 hover:text-rose-500 transition-colors"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}