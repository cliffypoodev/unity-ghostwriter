import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, Settings } from "lucide-react";
import SettingsModal from "./SettingsModal";

const PHASES = [
  { id: "specify", label: "Specify", icon: "1" },
  { id: "generate", label: "Generate", icon: "2" },
  { id: "export", label: "Edit & Export", icon: "3" },
  { id: "review", label: "Review", icon: "4" },
  { id: "cover", label: "Cover", icon: "5" },
  { id: "preview", label: "Preview", icon: "6" },
];

const PHASE_ORDER = ["specify", "generate", "export", "review", "cover", "preview"];

function NotebookTab({ phase, index, state, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "notebook-tab",
        state === "active" && "notebook-tab-active",
        state === "completed" && "notebook-tab-completed",
        state === "idle" && "notebook-tab-idle"
      )}
    >
      {state === "completed" ? (
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
      ) : (
        <span className="notebook-tab-num">{index + 1}</span>
      )}
      <span className="hidden sm:inline">{phase.label}</span>
    </button>
  );
}

export default function NotebookShell({ activePhase, onPhaseChange, children }) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const getState = (phaseId) => {
    const activeIdx = PHASE_ORDER.indexOf(activePhase);
    const phaseIdx = PHASE_ORDER.indexOf(phaseId);
    if (phaseId === activePhase) return "active";
    if (phaseIdx < activeIdx) return "completed";
    return "idle";
  };

  const handleTabClick = (id) => {
    onPhaseChange(id);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
    }, 0);
  };

  return (
    <div className="notebook-shell">
      {/* Spine */}
      <div className="notebook-spine" />

      {/* Tab bar — sits on top of the notebook body */}
      <div className="notebook-tab-bar">
        {PHASES.map((phase, i) => (
          <NotebookTab
            key={phase.id}
            phase={phase}
            index={i}
            state={getState(phase.id)}
            onClick={() => handleTabClick(phase.id)}
          />
        ))}
        <button
          className="nb-settings-gear"
          onClick={() => setSettingsOpen(true)}
          title="Notebook Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Body — the "page" area */}
      <div className="notebook-body">
        <div className="nb-margin-line" />
        {children}
      </div>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}