import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const THEMES = {
  classic: {
    name: "Classic Cream",
    description: "Warm ivory pages, like a well-loved journal",
    pg: "#F5EFE4", pgAlt: "#FFFDF8", ink: "#3A3530", ink2: "#5A5348",
    border: "#D8D0C0", rule: "#C8DAE8", margin: "#E8B0B0",
    hole: "#D4CCBE", wire: "#A8A090", wireHi: "#C8C2B8",
    tabs: ["#E8DDD0","#D8E8D8","#D0D8E8","#E8D8D0","#D8D0E0","#D0E0E0","#E0E0D0","#E0D0D8","#D0D0E0","#E0E8D0"],
    tabsC: ["#5A5040","#3A5A3A","#3A4A5A","#5A4030","#4A3A5A","#3A5050","#505040","#503A48","#3A3A50","#405030"],
  },
  midnight: {
    name: "Midnight Writer",
    description: "Dark mode for late-night writing sessions",
    pg: "#1E1E2A", pgAlt: "#24243A", ink: "#D8D4E0", ink2: "#A8A4B8",
    border: "#3A3A50", rule: "#2E2E44", margin: "#5A4A6A",
    hole: "#2A2A3E", wire: "#5A586A", wireHi: "#7A789A",
    tabs: ["#2A2A40","#2A3A2A","#2A2A3A","#3A2A2A","#2A2A3A","#2A3A3A","#3A3A2A","#3A2A30","#2A2A38","#2A3A28"],
    tabsC: ["#C8C4D8","#A8C8A8","#A8B8D8","#D8B8A8","#B8A8D8","#A8C8C8","#C8C8A8","#D0A8B8","#B0B0D0","#A8D0A0"],
  },
  forest: {
    name: "Forest Study",
    description: "Earthy greens and rich browns",
    pg: "#EAE8DF", pgAlt: "#F4F2E8", ink: "#2A3828", ink2: "#4A5848",
    border: "#C4C0A8", rule: "#C8D4C0", margin: "#8A6A4A",
    hole: "#C0BCA8", wire: "#8A8870", wireHi: "#AAA890",
    tabs: ["#D8D4C0","#C8D8C0","#C4D0C8","#D8D0C0","#C8C8D0","#C0D0C8","#D0D4C0","#D4C8C0","#C0C8D0","#D0D8C0"],
    tabsC: ["#4A4830","#2A4A28","#2A3A38","#5A4830","#3A3848","#2A4040","#404830","#483830","#2A3048","#384828"],
  },
  ocean: {
    name: "Ocean Breeze",
    description: "Cool blues and crisp whites",
    pg: "#F0F4F8", pgAlt: "#FAFCFF", ink: "#1A2A3E", ink2: "#4A5A6E",
    border: "#C0D0E0", rule: "#A8C8E0", margin: "#D8A880",
    hole: "#C8D4E0", wire: "#8098B0", wireHi: "#A0B8D0",
    tabs: ["#D8E4F0","#D0E0D8","#C8D4E8","#E0D8D0","#D0D0E4","#C8E0E4","#E0E0D0","#E0D0D8","#D0D4E4","#D0E8D8"],
    tabsC: ["#2A3A5A","#2A4A38","#2A3050","#5A3A28","#3A3058","#2A4850","#484830","#503040","#2A3060","#2A5038"],
  },
  typewriter: {
    name: "Typewriter",
    description: "Stark black on white, no-nonsense clarity",
    pg: "#FAFAFA", pgAlt: "#FFFFFF", ink: "#1A1A1A", ink2: "#4A4A4A",
    border: "#D0D0D0", rule: "#E0E0E8", margin: "#D0A0A0",
    hole: "#D0D0D0", wire: "#909090", wireHi: "#B0B0B0",
    tabs: ["#E8E8E8","#E0E8E0","#E0E0E8","#E8E0E0","#E0E0E8","#E0E8E8","#E8E8E0","#E8E0E4","#E0E0E8","#E0E8E0"],
    tabsC: ["#2A2A2A","#2A3A2A","#2A2A3A","#3A2A2A","#2A2A3A","#2A3A3A","#3A3A2A","#3A2A30","#2A2A3A","#2A3A2A"],
  },
  sepia: {
    name: "Sepia Antique",
    description: "Aged parchment with warm browns",
    pg: "#F0E4CC", pgAlt: "#FBF4E4", ink: "#3A2810", ink2: "#5A4830",
    border: "#C8B898", rule: "#D8C8A0", margin: "#C09060",
    hole: "#C8B898", wire: "#988868", wireHi: "#B8A888",
    tabs: ["#E0D4B8","#D0D8C0","#D0D0D8","#D8C8B0","#C8C0D0","#C0D0C8","#D8D4B8","#D8C0B8","#C8C4D0","#D0D8C0"],
    tabsC: ["#4A3820","#2A4A28","#2A2A40","#503820","#3A2848","#2A4038","#484020","#483020","#2A2840","#384020"],
  },
};

const ACCENTS = [
  { name: "Teal",   hex: "#5DCAA5" },
  { name: "Blue",   hex: "#378ADD" },
  { name: "Purple", hex: "#7F77DD" },
  { name: "Red",    hex: "#E24B4A" },
  { name: "Amber",  hex: "#EF9F27" },
  { name: "Orange", hex: "#D85A30" },
  { name: "Pink",   hex: "#E87CA0" },
  { name: "Green",  hex: "#50B080" },
];

const FONT_SIZES = [
  { label: "Small",   value: "8px" },
  { label: "Medium",  value: "9px" },
  { label: "Large",   value: "10px" },
  { label: "X-Large", value: "11px" },
];

const DEFAULTS = {
  theme: "classic",
  accent: "#5DCAA5",
  fontSize: "9px",
  ruledLines: true,
  marginLines: true,
  coloredTabs: true,
};

const LS_KEY = "mbe-theme-settings";

const ThemeContext = createContext(null);

function applyThemeToDOM(settings) {
  const s = document.documentElement.style;
  const t = THEMES[settings.theme] || THEMES.classic;

  s.setProperty("--pg", t.pg);
  s.setProperty("--pgAlt", t.pgAlt);
  s.setProperty("--ink", t.ink);
  s.setProperty("--ink2", t.ink2);
  s.setProperty("--nb-border", t.border);
  s.setProperty("--rule", t.rule);
  s.setProperty("--margin-line", t.margin);
  s.setProperty("--hole", t.hole);
  s.setProperty("--wire", t.wire);
  s.setProperty("--wireHi", t.wireHi);
  s.setProperty("--accent", settings.accent);
  s.setProperty("--nb-font-size", settings.fontSize);

  // Tab colors
  t.tabs.forEach((c, i) => s.setProperty(`--t${i}`, c));
  t.tabsC.forEach((c, i) => s.setProperty(`--t${i}c`, c));

  // Display toggles
  s.setProperty("--ruled-opacity", settings.ruledLines ? "0.3" : "0");
  s.setProperty("--margin-opacity", settings.marginLines ? "0.5" : "0");
  s.setProperty("--tabs-colored", settings.coloredTabs ? "1" : "0");
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

export { THEMES, ACCENTS, FONT_SIZES };

export function ThemeProvider({ children }) {
  const [settings, setSettingsRaw] = useState(loadSettings);

  // Apply on mount and when settings change
  useEffect(() => {
    applyThemeToDOM(settings);
  }, [settings]);

  const setSettings = useCallback((updater) => {
    setSettingsRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ settings, setSettings }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}