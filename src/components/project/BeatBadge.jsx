import React from "react";

const BEAT_COLORS = {
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