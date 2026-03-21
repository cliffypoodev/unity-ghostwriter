import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Check } from "lucide-react";
import { useTheme, THEMES, ACCENTS, FONT_SIZES } from "./ThemeProvider";

function ThemeCard({ id, theme, isActive, onClick }) {
  const swatches = [theme.pg, theme.ink, theme.border, theme.wire, theme.rule];
  return (
    <button
      onClick={onClick}
      className="relative text-left rounded-xl p-3 border-2 transition-all duration-200 hover:shadow-md"
      style={{
        borderColor: isActive ? "var(--accent)" : theme.border,
        background: theme.pgAlt,
      }}
    >
      {isActive && (
        <div
          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: "var(--accent)" }}
        >
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
      <div className="font-semibold text-xs mb-0.5" style={{ color: theme.ink }}>
        {theme.name}
      </div>
      <div className="text-[10px] mb-2" style={{ color: theme.ink2 }}>
        {theme.description}
      </div>
      <div className="flex gap-1">
        {swatches.map((c, i) => (
          <div
            key={i}
            className="w-4 h-4 rounded-full border"
            style={{ background: c, borderColor: theme.border }}
          />
        ))}
      </div>
    </button>
  );
}

function AccentDot({ hex, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className="relative w-8 h-8 rounded-full transition-transform hover:scale-110"
      style={{
        background: hex,
        boxShadow: isActive ? `0 0 0 2px #fff, 0 0 0 4px ${hex}` : "none",
      }}
    >
      {isActive && <Check className="w-3.5 h-3.5 text-white absolute inset-0 m-auto" />}
    </button>
  );
}

function FontSizeBtn({ item, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all border"
      style={{
        background: isActive ? "var(--accent)" : "transparent",
        color: isActive ? "#fff" : "var(--ink)",
        borderColor: isActive ? "var(--accent)" : "var(--nb-border, #D8D0C0)",
      }}
    >
      {item.label}
    </button>
  );
}

export default function SettingsModal({ open, onOpenChange }) {
  const { settings, setSettings } = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" style={{ background: "var(--pgAlt, #FFFDF8)", color: "var(--ink, #3A3530)" }}>
        <DialogHeader>
          <DialogTitle className="text-base font-bold" style={{ color: "var(--ink)" }}>
            Notebook Settings
          </DialogTitle>
        </DialogHeader>

        {/* Theme picker */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ink2, #5A5348)" }}>
            Theme
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(THEMES).map(([id, theme]) => (
              <ThemeCard
                key={id}
                id={id}
                theme={theme}
                isActive={settings.theme === id}
                onClick={() => setSettings({ ...settings, theme: id })}
              />
            ))}
          </div>
        </div>

        {/* Accent color */}
        <div className="space-y-2 mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ink2)" }}>
            Accent Color
          </h3>
          <div className="flex gap-2 flex-wrap">
            {ACCENTS.map((a) => (
              <AccentDot
                key={a.hex}
                hex={a.hex}
                isActive={settings.accent === a.hex}
                onClick={() => setSettings({ ...settings, accent: a.hex })}
              />
            ))}
          </div>
        </div>

        {/* Font size */}
        <div className="space-y-2 mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ink2)" }}>
            Content Font Size
          </h3>
          <div className="flex gap-2">
            {FONT_SIZES.map((f) => (
              <FontSizeBtn
                key={f.value}
                item={f}
                isActive={settings.fontSize === f.value}
                onClick={() => setSettings({ ...settings, fontSize: f.value })}
              />
            ))}
          </div>
        </div>

        {/* Display toggles */}
        <div className="space-y-3 mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ink2)" }}>
            Display
          </h3>
          <ToggleRow
            label="Ruled lines"
            checked={settings.ruledLines}
            onChange={(v) => setSettings({ ...settings, ruledLines: v })}
          />
          <ToggleRow
            label="Margin lines"
            checked={settings.marginLines}
            onChange={(v) => setSettings({ ...settings, marginLines: v })}
          />
          <ToggleRow
            label="Colored tabs"
            checked={settings.coloredTabs}
            onChange={(v) => setSettings({ ...settings, coloredTabs: v })}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: "var(--ink)" }}>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}