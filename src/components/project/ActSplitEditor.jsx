import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ActSplitEditor({ acts, totalChapters, onSave }) {
  const [editing, setEditing] = useState(false);
  const [act1End, setAct1End] = useState(acts?.act1?.end || 0);
  const [act2End, setAct2End] = useState(acts?.act2?.end || 0);

  if (!acts?.act2 || totalChapters <= 3) return null;

  const handleOpen = () => {
    setAct1End(acts.act1.end);
    setAct2End(acts.act2.end);
    setEditing(true);
  };

  const handleSave = () => {
    const a1 = Math.max(1, Math.min(parseInt(act1End) || 1, totalChapters - 2));
    const a2 = Math.max(a1 + 1, Math.min(parseInt(act2End) || a1 + 1, totalChapters - 1));
    onSave({ act1End: a1, act2End: a2 });
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        <Settings2 className="w-3.5 h-3.5" />
        Adjust act splits
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap bg-white border border-slate-200 rounded-lg px-3 py-2">
      <span className="text-xs text-slate-500 font-medium">Act splits:</span>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-blue-600">Act 1: 1–</span>
        <Input
          type="number"
          min={1}
          max={totalChapters - 2}
          value={act1End}
          onChange={e => setAct1End(e.target.value)}
          className="w-14 h-7 text-xs text-center px-1"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-amber-600">Act 2: {(parseInt(act1End) || 1) + 1}–</span>
        <Input
          type="number"
          min={(parseInt(act1End) || 1) + 1}
          max={totalChapters - 1}
          value={act2End}
          onChange={e => setAct2End(e.target.value)}
          className="w-14 h-7 text-xs text-center px-1"
        />
      </div>
      <span className="text-xs text-rose-600">Act 3: {(parseInt(act2End) || 2) + 1}–{totalChapters}</span>
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600" onClick={handleSave}>
        <Check className="w-3.5 h-3.5" />
      </Button>
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400" onClick={() => setEditing(false)}>
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}