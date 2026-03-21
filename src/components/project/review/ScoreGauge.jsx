import React from "react";
import { cn } from "@/lib/utils";

export default function ScoreGauge({ score }) {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  const label = score >= 80 ? "CERTIFIED FRESH" : score >= 60 ? "FRESH" : "ROTTEN";
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#e8e8ec" strokeWidth="10" />
...
        <text x="70" y="82" textAnchor="middle" fontSize="11" fill="#9997b0">/ 100</text>
      </svg>
      <div className="flex items-center gap-1.5">
        <span className="text-lg">🍅</span>
        <span className={cn("text-sm font-bold tracking-wide", score >= 80 ? "text-emerald-700" : score >= 60 ? "text-amber-700" : "text-red-600")}>{label}</span>
      </div>
    </div>
  );
}