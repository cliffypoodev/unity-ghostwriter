import React from "react";

const BEAT_COLORS = {
  // Fiction
  SETUP: "bg-gray-100 text-gray-600",
  DISRUPTION: "bg-orange-100 text-orange-700",
  REACTION: "bg-blue-100 text-blue-700",
  REFLECTION: "bg-blue-100 text-blue-700",
  COMMITMENT: "bg-green-100 text-green-700",
  RECOMMITMENT: "bg-green-100 text-green-700",
  PROMISE_OF_PREMISE: "bg-purple-100 text-purple-700",
  REVERSAL: "bg-red-100 text-red-700",
  ESCALATION: "bg-yellow-100 text-yellow-700",
  CRISIS: "bg-red-200 text-red-800",
  CLIMAX: "bg-amber-100 text-amber-700",
  RESOLUTION: "bg-teal-100 text-teal-700",
  CONNECTIVE_TISSUE: "bg-slate-100 text-slate-500",
  SUBPLOT: "bg-pink-100 text-pink-700",
  // Nonfiction — Argument-Driven
  PROVOCATIVE_OPENING: "bg-orange-100 text-orange-700",
  PROBLEM_STATEMENT: "bg-red-100 text-red-700",
  DEMOLITION: "bg-red-200 text-red-800",
  THESIS_INTRODUCTION: "bg-indigo-100 text-indigo-700",
  EVIDENCE_BLOCK: "bg-blue-100 text-blue-700",
  COUNTERARGUMENT: "bg-amber-100 text-amber-700",
  REFRAME: "bg-purple-100 text-purple-700",
  PRACTICAL_APPLICATION: "bg-green-100 text-green-700",
  SYNTHESIS: "bg-teal-100 text-teal-700",
  TRANSFORMATION_EVIDENCE: "bg-emerald-100 text-emerald-700",
  CALL_TO_ACTION: "bg-violet-100 text-violet-700",
  // Nonfiction — Narrative
  COLD_OPEN: "bg-orange-100 text-orange-700",
  CONTEXT_SETTING: "bg-gray-100 text-gray-600",
  CHARACTER_INTRODUCTION: "bg-sky-100 text-sky-700",
  INCITING_EVENT: "bg-red-100 text-red-700",
  EVIDENCE_TRAIL: "bg-blue-100 text-blue-700",
  COMPLICATION: "bg-amber-100 text-amber-700",
  TURNING_POINT: "bg-red-200 text-red-800",
  CONSEQUENCES: "bg-slate-200 text-slate-700",
  ESCALATION_NF: "bg-yellow-100 text-yellow-700",
  AFTERMATH: "bg-gray-200 text-gray-700",
  THEMATIC_SYNTHESIS: "bg-teal-100 text-teal-700",
  CLOSING_IMAGE: "bg-violet-100 text-violet-700",
  // Nonfiction — Reference
  MOTIVATION: "bg-orange-100 text-orange-700",
  FOUNDATION: "bg-gray-100 text-gray-600",
  CONCEPT_BLOCK: "bg-blue-100 text-blue-700",
  INTEGRATION: "bg-indigo-100 text-indigo-700",
  TROUBLESHOOTING: "bg-amber-100 text-amber-700",
  ADVANCED_BLOCK: "bg-purple-100 text-purple-700",
  CASE_STUDY_NF: "bg-sky-100 text-sky-700",
  ROADMAP: "bg-green-100 text-green-700",
  // Nonfiction — Investigative
  ANOMALY: "bg-red-100 text-red-700",
  OFFICIAL_NARRATIVE: "bg-gray-100 text-gray-600",
  FIRST_EVIDENCE: "bg-orange-100 text-orange-700",
  PATTERN_RECOGNITION: "bg-amber-100 text-amber-700",
  CAST_OF_CHARACTERS: "bg-sky-100 text-sky-700",
  MECHANISM: "bg-blue-100 text-blue-700",
  COVER_UP: "bg-red-200 text-red-800",
  IMPACT: "bg-rose-100 text-rose-700",
  CONFRONTATION_NF: "bg-red-200 text-red-800",
  AFTERMATH_NF: "bg-gray-200 text-gray-700",
  SYSTEMIC_ANALYSIS: "bg-teal-100 text-teal-700",
};

export default function BeatBadge({ beatFunction, beatName }) {
  if (!beatFunction) return null;
  const color = BEAT_COLORS[beatFunction] || "bg-slate-100 text-slate-500";
  const label = beatName || beatFunction;
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 font-medium ${color}`}
      style={{ fontSize: "0.7rem", lineHeight: "1.1" }}
      title={`${beatFunction} — ${beatName}`}
    >
      {label.length > 25 ? label.slice(0, 22) + '…' : label}
    </span>
  );
}