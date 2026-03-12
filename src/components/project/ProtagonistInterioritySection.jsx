import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Wand2, Heart } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function ProtagonistInterioritySection({ form, onChange }) {
  const [inferring, setInferring] = useState(false);

  const handleInferFromPremise = async () => {
    if (!form.topic?.trim()) {
      toast.error("Enter a premise first so the AI can infer interiority");
      return;
    }
    setInferring(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a fiction developmental editor specializing in erotica and romance. Given the following book premise, infer the human protagonist's deep interior psychology.

PREMISE:
${form.topic}

GENRE: ${form.genre || 'Erotica'}
SUBGENRE: ${form.subgenre || ''}

Answer these four questions about the HUMAN protagonist (not the love interest):

1. LIFE PURPOSE: What did the protagonist believe their life was FOR before this story started? (Their identity, their role, what gave them meaning)

2. CORE WOUND: What is one specific failure or loss from their past that still defines how they see themselves? (Not vague — a specific event or pattern)

3. SELF-BELIEF: What do they privately believe is WRONG with them — the thing they've never said aloud? (Their deepest shame or inadequacy)

4. SECRET DESIRE: What does the supernatural/alien/fantasy element (or the love interest) offer them that the human world never could? (The forbidden need)

Be specific, psychologically grounded, and character-driven. Each answer should be 1-3 sentences.`,
        response_json_schema: {
          type: "object",
          properties: {
            life_purpose: { type: "string" },
            core_wound: { type: "string" },
            self_belief: { type: "string" },
            secret_desire: { type: "string" }
          }
        }
      });

      if (result.life_purpose) onChange("protagonist_life_purpose", result.life_purpose);
      if (result.core_wound) onChange("protagonist_core_wound", result.core_wound);
      if (result.self_belief) onChange("protagonist_self_belief", result.self_belief);
      if (result.secret_desire) onChange("protagonist_secret_desire", result.secret_desire);
      toast.success("Protagonist interiority inferred from premise");
    } catch (err) {
      console.error("Infer interiority error:", err);
      toast.error("Failed to infer interiority");
    } finally {
      setInferring(false);
    }
  };

  const hasAny = form.protagonist_life_purpose || form.protagonist_core_wound || 
                 form.protagonist_self_belief || form.protagonist_secret_desire;

  return (
    <Card className="border-rose-200 bg-rose-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Heart className="w-4 h-4 text-rose-500" />
          Protagonist Interiority
          <span className="text-xs font-normal text-slate-500 ml-1">
            (injected into every chapter prompt)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-slate-600 leading-relaxed">
          Define your protagonist's deep interior psychology. These answers anchor every chapter — 
          at least one scene beat per chapter will connect to one of these three layers.
        </p>

        <Button
          onClick={handleInferFromPremise}
          disabled={inferring || !form.topic?.trim()}
          variant="outline"
          size="sm"
          className="border-rose-300 text-rose-700 hover:bg-rose-50"
        >
          {inferring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
          {inferring ? "Inferring..." : "Auto-Infer from Premise"}
        </Button>

        <div>
          <Label className="text-xs font-medium text-slate-700">
            1. What did the protagonist believe their life was FOR before this story?
          </Label>
          <Textarea
            className="mt-1 text-sm"
            rows={2}
            placeholder="Their identity, role, what gave them meaning before the story upended everything..."
            value={form.protagonist_life_purpose || ""}
            onChange={e => onChange("protagonist_life_purpose", e.target.value)}
          />
        </div>

        <div>
          <Label className="text-xs font-medium text-slate-700">
            2. Core Wound — what failure or loss still defines how they see themselves?
          </Label>
          <Textarea
            className="mt-1 text-sm"
            rows={2}
            placeholder="A specific event or pattern, not vague — the wound that shaped their worldview..."
            value={form.protagonist_core_wound || ""}
            onChange={e => onChange("protagonist_core_wound", e.target.value)}
          />
        </div>

        <div>
          <Label className="text-xs font-medium text-slate-700">
            3. Hidden Self-Belief — what do they privately believe is WRONG with them?
          </Label>
          <Textarea
            className="mt-1 text-sm"
            rows={2}
            placeholder="The thing they've never said aloud — their deepest shame or inadequacy..."
            value={form.protagonist_self_belief || ""}
            onChange={e => onChange("protagonist_self_belief", e.target.value)}
          />
        </div>

        <div>
          <Label className="text-xs font-medium text-slate-700">
            4. Secret Desire — what does the supernatural/alien/fantasy element offer them?
          </Label>
          <Textarea
            className="mt-1 text-sm"
            rows={2}
            placeholder="What the bond/relationship offers that the human world never could..."
            value={form.protagonist_secret_desire || ""}
            onChange={e => onChange("protagonist_secret_desire", e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}