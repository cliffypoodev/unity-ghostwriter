import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Type, Image, Trash2, Loader2, Sparkles } from "lucide-react";

export default function CoverProperties({
  selectedElement,
  onUpdateElement,
  onDeleteElement,
  onAddText,
  onAddImage,
  onSetBackground,
  spineText,
  onSpineTextChange,
  spineDirection,
  onSpineDirectionChange,
  showGuides,
  onToggleGuides,
  onGenerateAI,
  generating,
  aiPrompt,
  onAiPromptChange,
}) {
  return (
    <div
      className="w-[200px] shrink-0 overflow-y-auto p-3 space-y-4 border-l"
      style={{ borderColor: "var(--nb-border)", color: "var(--ink)", background: "var(--pgAlt)" }}
    >
      <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--ink2)" }}>
        Properties
      </h3>

      {/* Add elements */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-semibold uppercase" style={{ color: "var(--ink2)" }}>Add</label>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={onAddText}
            style={{ borderColor: "var(--nb-border)", color: "var(--ink)" }}>
            <Type className="w-3 h-3 mr-1" /> Text
          </Button>
          <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={onAddImage}
            style={{ borderColor: "var(--nb-border)", color: "var(--ink)" }}>
            <Image className="w-3 h-3 mr-1" /> Image
          </Button>
        </div>
      </div>

      {/* Background */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-semibold uppercase" style={{ color: "var(--ink2)" }}>Front Background</label>
        <input
          type="file"
          accept="image/*"
          className="text-xs w-full"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSetBackground(file, "front");
          }}
        />
      </div>

      {/* Spine */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-semibold uppercase" style={{ color: "var(--ink2)" }}>Spine Text</label>
        <Input
          value={spineText}
          onChange={(e) => onSpineTextChange(e.target.value)}
          placeholder="Book title…"
          className="h-7 text-xs"
          style={{ background: "var(--pg)", borderColor: "var(--nb-border)", color: "var(--ink)" }}
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: "var(--ink2)" }}>Bottom→Top</span>
          <Switch
            checked={spineDirection === "btt"}
            onCheckedChange={(v) => onSpineDirectionChange(v ? "btt" : "ttb")}
          />
        </div>
      </div>

      {/* Guides toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase" style={{ color: "var(--ink2)" }}>Show Guides</span>
        <Switch checked={showGuides} onCheckedChange={onToggleGuides} />
      </div>

      {/* AI Generation */}
      <div className="space-y-1.5 pt-2" style={{ borderTop: "1px solid var(--nb-border)" }}>
        <label className="text-[10px] font-semibold uppercase flex items-center gap-1" style={{ color: "var(--ink2)" }}>
          <Sparkles className="w-3 h-3" /> Generate with AI
        </label>
        <Textarea
          value={aiPrompt}
          onChange={(e) => onAiPromptChange(e.target.value)}
          placeholder="Describe your cover…"
          className="text-xs min-h-[60px]"
          style={{ background: "var(--pg)", borderColor: "var(--nb-border)", color: "var(--ink)" }}
        />
        <Button
          size="sm"
          className="w-full h-7 text-xs"
          style={{ background: "var(--accent)", color: "#fff" }}
          onClick={onGenerateAI}
          disabled={generating || !aiPrompt.trim()}
        >
          {generating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
          {generating ? "Generating…" : "Generate (~$0.04)"}
        </Button>
      </div>

      {/* Selected element props */}
      {selectedElement && (
        <div className="space-y-1.5 pt-2" style={{ borderTop: "1px solid var(--nb-border)" }}>
          <label className="text-[10px] font-semibold uppercase" style={{ color: "var(--ink2)" }}>Selected</label>
          {selectedElement.type === "text" && (
            <>
              <Textarea
                value={selectedElement.text || ""}
                onChange={(e) => onUpdateElement(selectedElement.id, { text: e.target.value })}
                className="text-xs min-h-[40px]"
                style={{ background: "var(--pg)", borderColor: "var(--nb-border)", color: "var(--ink)" }}
              />
              <Input
                type="number"
                value={selectedElement.fontSize || 16}
                onChange={(e) => onUpdateElement(selectedElement.id, { fontSize: parseInt(e.target.value) || 16 })}
                className="h-7 text-xs"
                style={{ background: "var(--pg)", borderColor: "var(--nb-border)", color: "var(--ink)" }}
                min={8}
                max={72}
              />
              <Input
                type="color"
                value={selectedElement.color || "#3A3530"}
                onChange={(e) => onUpdateElement(selectedElement.id, { color: e.target.value })}
                className="h-7 w-full"
              />
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-xs text-red-500 border-red-200 hover:bg-red-50"
            onClick={() => onDeleteElement(selectedElement.id)}
          >
            <Trash2 className="w-3 h-3 mr-1" /> Delete
          </Button>
        </div>
      )}
    </div>
  );
}