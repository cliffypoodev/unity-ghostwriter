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
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#1e293b" strokeWidth="10" />
        <circle cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round"
          transform="rotate(-90 70 70)" style={{ transition: "stroke-dasharray 1s ease" }} />
        <text x="70" y="62" textAnchor="middle" fontSize="32" fontWeight="bold" fill={color}>{score}</text>
        <text x="70" y="82" textAnchor="middle" fontSize="11" fill="#94a3b8">/ 100</text>
      </svg>
      <div className="flex items-center gap-1.5">
        <span className="text-lg">🍅</span>
        <span className={cn("text-sm font-bold tracking-wide", score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400")}>{label}</span>
      </div>
    </div>
  );
}