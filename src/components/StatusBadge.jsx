import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700 border-slate-200" },
  outlining: { label: "Outlining", className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  writing: { label: "Writing", className: "bg-violet-100 text-violet-700 border-violet-200" },
  editing: { label: "Editing", className: "bg-amber-100 text-amber-700 border-amber-200" },
  complete: { label: "Complete", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  pending: { label: "Pending", className: "bg-slate-100 text-slate-600 border-slate-200" },
  generating: { label: "Generating", className: "bg-violet-100 text-violet-700 border-violet-200" },
  generated: { label: "Generated", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  error: { label: "Error", className: "bg-red-100 text-red-700 border-red-200" },
};

export default function StatusBadge({ status }) {
  const config = statusConfig[status] || { label: status, className: "bg-gray-100 text-gray-700" };
  return (
    <Badge variant="outline" className={cn("text-xs font-medium px-2.5 py-0.5", config.className)}>
      {config.label}
    </Badge>
  );
}