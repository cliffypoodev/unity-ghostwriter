import React from "react";
import { cn } from "@/lib/utils";

const DOT_CONFIG = {
  pending:    { color: "bg-slate-300",   ring: "",                           label: "Pending" },
  generating: { color: "bg-blue-500",    ring: "ring-2 ring-blue-300",      label: "Writing", animate: true },
  generated:  { color: "bg-emerald-500", ring: "",                           label: "Complete" },
  error:      { color: "bg-red-500",     ring: "ring-2 ring-red-200",       label: "Failed" },
};

export default function ChapterStatusDot({ status, isWriting }) {
  const effectiveStatus = isWriting ? "generating" : status;
  const cfg = DOT_CONFIG[effectiveStatus] || DOT_CONFIG.pending;

  return (
    <div className="flex items-center gap-1.5" title={cfg.label}>
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {cfg.animate && (
          <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping", cfg.color)} />
        )}
        <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", cfg.color, cfg.ring)} />
      </span>
      <span className={cn(
        "text-[10px] font-semibold uppercase tracking-wider",
        effectiveStatus === "pending" && "text-slate-400",
        effectiveStatus === "generating" && "text-blue-600",
        effectiveStatus === "generated" && "text-emerald-600",
        effectiveStatus === "error" && "text-red-600",
      )}>
        {cfg.label}
      </span>
    </div>
  );
}