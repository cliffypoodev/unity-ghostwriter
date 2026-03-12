import React from "react";
import { AlertTriangle, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InteriorityGateBanner({ onGoToSpec }) {
  return (
    <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-2">
      <div className="flex items-start gap-3">
        <Heart className="w-5 h-5 text-rose-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-rose-800">
            Protagonist Interiority Required
          </p>
          <p className="text-xs text-rose-700 mt-1 leading-relaxed">
            Fiction and Erotica chapters cannot generate without protagonist interiority defined 
            (core wound, self-belief, secret desire). Go back to Specifications to complete this section — 
            it anchors every chapter's emotional through-line.
          </p>
        </div>
      </div>
      {onGoToSpec && (
        <Button
          size="sm"
          className="bg-rose-600 hover:bg-rose-700 text-white h-8 text-xs"
          onClick={onGoToSpec}
        >
          <AlertTriangle className="w-3 h-3 mr-1" />
          Go to Specifications
        </Button>
      )}
    </div>
  );
}

export function hasProtagonistInteriority(spec, project) {
  // Check project-level persistent interiority first
  if (project?.protagonist_interiority) {
    try {
      const pi = JSON.parse(project.protagonist_interiority);
      if (pi.core_wound?.trim() || pi.self_belief?.trim() || pi.secret_desire?.trim()) return true;
    } catch {}
  }
  // Fall back to spec fields
  if (spec?.protagonist_core_wound?.trim() || spec?.protagonist_self_belief?.trim() || spec?.protagonist_secret_desire?.trim()) return true;
  return false;
}

export function needsInteriorityGate(spec) {
  if (!spec) return false;
  if (spec.book_type === 'nonfiction') return false;
  // Gate for all fiction
  return true;
}