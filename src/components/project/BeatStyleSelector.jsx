import React from "react";
import { Zap, Flame, BookOpen } from "lucide-react";

// All beat styles with category field for filtering
const ALL_BEAT_STYLES = {
  // UNIVERSAL
  "basic": { label: "Basic (No specific style)", category: "universal", desc: "Clean, competent prose without imposing a particular stylistic framework", intensity: 0, spice: 0 },
  
  // FICTION STYLES
  "fast-paced-thriller": { label: "Fast-Paced Thriller", category: "fiction", desc: "Relentless momentum, immediate stakes", intensity: 4, spice: 2 },
  "hyper-stylized-action": { label: "Hyper-Stylized Action", category: "fiction", desc: "Choreographed spectacle, peak energy", intensity: 4, spice: 2 },
  "hollywood-blockbuster": { label: "Hollywood Blockbuster", category: "fiction", desc: "Big visuals, hero-driven momentum", intensity: 4, spice: 1 },
  "visceral-horror": { label: "Visceral Horror", category: "fiction", desc: "Sensory-driven descent into fear", intensity: 4, spice: 4 },
  "grandiose-space-opera": { label: "Grandiose Space Opera", category: "fiction", desc: "Interstellar conflict, epic scale", intensity: 4, spice: 1 },
  "gritty-cinematic": { label: "Gritty Cinematic", category: "fiction", desc: "Raw realism, tactile environments", intensity: 3, spice: 3 },
  "dark-suspense": { label: "Dark Suspense", category: "fiction", desc: "Claustrophobic dread, controlled fear", intensity: 3, spice: 3 },
  "hard-boiled-noir": { label: "Hard-Boiled Noir", category: "fiction", desc: "Cynical grit, urban underworld", intensity: 3, spice: 3 },
  "urban-gritty-fantasy": { label: "Urban Gritty Fantasy", category: "fiction", desc: "High magic meets dirty city life", intensity: 3, spice: 3 },
  "high-stakes-political": { label: "High-Stakes Political", category: "fiction", desc: "Machiavellian power chess", intensity: 3, spice: 2 },
  "epic-historical": { label: "Epic Historical", category: "fiction", desc: "Grand-scale pivotal moments", intensity: 3, spice: 2 },
  "intellectual-psychological": { label: "Intellectual Psychological", category: "fiction", desc: "Thought-driven tension", intensity: 2, spice: 2 },
  "cerebral-sci-fi": { label: "Cerebral Sci-Fi", category: "fiction", desc: "High-concept philosophy and ideas", intensity: 2, spice: 1 },
  "clinical-procedural": { label: "Clinical Procedural", category: "fiction", desc: "Meticulous investigation", intensity: 2, spice: 1 },
  "satirical": { label: "Satirical", category: "fiction", desc: "Sharp commentary, controlled exaggeration", intensity: 2, spice: 1 },
  "surrealist-avant-garde": { label: "Surrealist Avant-Garde", category: "fiction", desc: "Dream-logic, abstract imagery", intensity: 2, spice: 2 },
  "clean-romance": { label: "Clean Romance", category: "fiction", desc: "Emotional intimacy, no explicit content", intensity: 2, spice: 0 },
  "slow-burn": { label: "Slow Burn", category: "fiction", desc: "Gradual tension, atmosphere before action", intensity: 1, spice: 2 },
  "nostalgic-coming-of-age": { label: "Nostalgic Coming-of-Age", category: "fiction", desc: "Bittersweet transition", intensity: 1, spice: 1 },
  "melancholic-literary": { label: "Melancholic Literary", category: "fiction", desc: "Quiet beauty in sadness", intensity: 1, spice: 1 },
  "poetic-magical-realism": { label: "Poetic Magical Realism", category: "fiction", desc: "Supernatural as mundane truth", intensity: 1, spice: 1 },
  "faith-infused": { label: "Faith-Infused Contemporary", category: "fiction", desc: "Hope grounded in real life", intensity: 1, spice: 0 },
  "whimsical-cozy": { label: "Whimsical Cozy", category: "fiction", desc: "Gentle charm, small magic, community", intensity: 0, spice: 0 },
  "steamy-romance": { label: "Steamy Romance", category: "fiction", desc: "Breathless chemistry, emotional vulnerability", intensity: 3, spice: 4 },
  "slow-burn-romance": { label: "Slow Burn Romance", category: "fiction", desc: "Agonizing anticipation, almost-touch tension", intensity: 2, spice: 2 },
  "dark-erotica": { label: "Dark Erotica", category: "fiction", desc: "Power dynamics, psychological tension", intensity: 4, spice: 4 },
  
  // NONFICTION STYLES
  "journal-personal": { label: "Journal / Personal Essay", category: "nonfiction", desc: "Intimate, reflective first-person voice", intensity: 1, spice: 0 },
  "longform-article": { label: "Longform Article / Feature", category: "nonfiction", desc: "Magazine-quality narrative journalism", intensity: 2, spice: 0 },
  "formal-report": { label: "Formal Report / White Paper", category: "nonfiction", desc: "Authority and precision", intensity: 1, spice: 0 },
  "deep-investigative": { label: "Deep Investigative", category: "nonfiction", desc: "Relentless pursuit of truth", intensity: 3, spice: 0 },
  "historical-account": { label: "Historical Account", category: "nonfiction", desc: "Bringing the past to life with cinematic immediacy", intensity: 2, spice: 0 },
  "true-crime-account": { label: "True Crime Account", category: "nonfiction", desc: "Meticulous reconstruction of criminal events", intensity: 3, spice: 1 },
  "memoir-narrative": { label: "Memoir / Narrative Nonfiction", category: "nonfiction", desc: "True stories told with the craft of fiction", intensity: 2, spice: 1 },
  "academic-accessible": { label: "Academic but Accessible", category: "nonfiction", desc: "Scholarly rigor translated into engaging prose", intensity: 1, spice: 0 },
  "investigative-nonfiction": { label: "Investigative Nonfiction", category: "nonfiction", desc: "Evidence-based narrative", intensity: 3, spice: 0 },
  "reference-educational": { label: "Reference / Educational", category: "nonfiction", desc: "Clarity and structure", intensity: 0, spice: 0 },
};

// Legacy structure for backward compatibility (now built dynamically from ALL_BEAT_STYLES)
const BEAT_STYLE_GROUPS = [
  {
    label: "⚡ High Intensity / Fast Pacing",
    styles: Object.entries(ALL_BEAT_STYLES).filter(([k, s]) => s.category === "fiction" && s.intensity === 4).map(([k, s]) => ({ key: k, ...s })),
  },
  {
    label: "🔥 Medium-High Intensity / Driven Pacing",
    styles: Object.entries(ALL_BEAT_STYLES).filter(([k, s]) => s.category === "fiction" && s.intensity === 3).map(([k, s]) => ({ key: k, ...s })),
  },
  {
    label: "🧠 Medium Intensity / Measured Pacing",
    styles: Object.entries(ALL_BEAT_STYLES).filter(([k, s]) => s.category === "fiction" && s.intensity === 2).map(([k, s]) => ({ key: k, ...s })),
  },
  {
    label: "🌊 Low-Medium Intensity / Slow Pacing",
    styles: Object.entries(ALL_BEAT_STYLES).filter(([k, s]) => s.category === "fiction" && s.intensity === 1).map(([k, s]) => ({ key: k, ...s })),
  },
  {
    label: "✨ Low Intensity / Gentle Pacing",
    styles: Object.entries(ALL_BEAT_STYLES).filter(([k, s]) => s.category === "fiction" && s.intensity === 0).map(([k, s]) => ({ key: k, ...s })),
  },
  {
    label: "💋 Romance & Erotica",
    styles: Object.entries(ALL_BEAT_STYLES).filter(([k, s]) => s.category === "fiction" && s.label.includes("Romance") || s.label.includes("Erotica")).map(([k, s]) => ({ key: k, ...s })),
  },
];

function MeterDots({ count, max = 4, activeColor }) {
  return (
    <div className="flex gap-0.5 items-center">
      {[...Array(max)].map((_, i) => (
        <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < count ? activeColor : "bg-slate-200"}`} />
      ))}
    </div>
  );
}

export function BeatStyleSelect({ value, onChange, bookType = "fiction" }) {
  const selected = value ? ALL_BEAT_STYLES[value] : null;
  
  // Filter styles: universal + matching category
  const filteredStyles = Object.entries(ALL_BEAT_STYLES)
    .filter(([k, s]) => s.category === "universal" || s.category === bookType)
    .map(([k, s]) => ({ key: k, ...s }));

  return (
    <div className="space-y-1.5">
      <select
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        className="w-full mt-1.5 px-3 py-2 text-sm border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">— Select a beat style —</option>
        {filteredStyles.map(s => (
          <option key={s.key} value={s.key}>{s.label} — {s.desc}</option>
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
      
      <div className="text-xs text-slate-500 italic mt-2 px-2">
        {bookType === "nonfiction"
          ? "Nonfiction styles control voice, structure, and rhetorical approach"
          : "Fiction styles control pacing, atmosphere, and scene structure"}
      </div>
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