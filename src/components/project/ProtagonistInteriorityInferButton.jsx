import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Wand2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function ProtagonistInteriorityInferButton({ form, onChange }) {
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

Answer these five questions about the HUMAN protagonist (not the love interest):

1. LIFE PURPOSE: What did the protagonist believe their life was FOR before this story started?
2. CORE WOUND: What is one specific failure or loss from their past that still defines how they see themselves?
3. SELF-BELIEF: What do they privately believe is WRONG with them?
4. SECRET DESIRE: What does the supernatural/alien/fantasy element (or the love interest) offer them that the human world never could?
5. BEHAVIORAL TELLS: What observable behaviors reveal this interiority without stating it?

Be specific, psychologically grounded, and character-driven. Each answer should be 1-3 sentences.`,
        response_json_schema: {
          type: "object",
          properties: {
            life_purpose: { type: "string" },
            core_wound: { type: "string" },
            self_belief: { type: "string" },
            secret_desire: { type: "string" },
            behavioral_tells: { type: "string" }
          }
        }
      });

      if (result.life_purpose) onChange("protagonist_life_purpose", result.life_purpose);
      if (result.core_wound) onChange("protagonist_core_wound", result.core_wound);
      if (result.self_belief) onChange("protagonist_self_belief", result.self_belief);
      if (result.secret_desire) onChange("protagonist_secret_desire", result.secret_desire);
      if (result.behavioral_tells) onChange("protagonist_behavioral_tells", result.behavioral_tells);
      toast.success("Protagonist interiority inferred from premise");
    } catch (err) {
      console.error("Infer interiority error:", err);
      toast.error("Failed to infer interiority");
    } finally {
      setInferring(false);
    }
  };

  return (
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
  );
}