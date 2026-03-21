// BibleTab — Extracted from SpecificationTab (Phase 5 split)
// Contains: Story Bible editor + Protagonist Interiority section
//
// Reads the Specification entity to determine book_type, genre, etc.
// Saves story_bible_data + protagonist interiority fields back to both
// the Specification and Project entities.

import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Save, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import StoryBibleEditor from "./StoryBibleEditor";
import ProtagonistInterioritySection from "./ProtagonistInterioritySection";
import ProtagonistInteriorityInferButton from "./ProtagonistInteriorityInferButton";

export default function BibleTab({ projectId, onProceed }) {
  const queryClient = useQueryClient();

  const { data: specs = [] } = useQuery({
    queryKey: ["specification", projectId],
    queryFn: () => base44.entities.Specification.filter({ project_id: projectId }),
  });
  const spec = specs[0];

  const [form, setForm] = useState({
    story_bible_data: "",
    protagonist_core_wound: "",
    protagonist_self_belief: "",
    protagonist_secret_desire: "",
    protagonist_behavioral_tells: "",
    protagonist_life_purpose: "",
  });

  useEffect(() => {
    if (spec) {
      setForm(prev => ({
        ...prev,
        story_bible_data: spec.story_bible_data || "",
        protagonist_core_wound: spec.protagonist_core_wound || "",
        protagonist_self_belief: spec.protagonist_self_belief || "",
        protagonist_secret_desire: spec.protagonist_secret_desire || "",
        protagonist_behavioral_tells: spec.protagonist_behavioral_tells || "",
        protagonist_life_purpose: spec.protagonist_life_purpose || "",
      }));
    }
  }, [spec]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!spec) { toast.error("Save specs in the Setup tab first"); return; }

      const payload = {};
      ["story_bible_data", "protagonist_core_wound", "protagonist_self_belief", "protagonist_secret_desire", "protagonist_behavioral_tells", "protagonist_life_purpose"].forEach(k => {
        payload[k] = form[k];
      });

      // Build protagonist interiority for project entity
      const interiority = {
        core_wound: form.protagonist_core_wound || "",
        self_belief: form.protagonist_self_belief || "",
        secret_desire: form.protagonist_secret_desire || "",
        behavioral_tells: form.protagonist_behavioral_tells || "",
        life_purpose: form.protagonist_life_purpose || "",
      };
      // Auto-fill from story bible protagonist if explicit fields are empty
      if (form.story_bible_data) {
        try {
          const bible = JSON.parse(form.story_bible_data);
          const protag = (bible.characters || []).find(c => c.role === 'protagonist');
          if (protag) {
            if (!interiority.core_wound && protag.core_wound) interiority.core_wound = protag.core_wound;
            if (!interiority.self_belief && protag.misbelief) interiority.self_belief = protag.misbelief;
            if (!interiority.secret_desire && protag.desire) interiority.secret_desire = protag.desire;
            if (!interiority.behavioral_tells && protag.physical_tells) interiority.behavioral_tells = protag.physical_tells;
          }
        } catch {}
      }
      const hasInteriority = Object.values(interiority).some(v => v.trim());
      if (hasInteriority) {
        base44.entities.Project.update(projectId, {
          protagonist_interiority: JSON.stringify(interiority),
        }).catch(err => console.warn("Failed to persist interiority:", err.message));
      }

      return base44.entities.Specification.update(spec.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["specification", projectId] });
      toast.success("Story Bible saved");
    },
  });

  const bookType = spec?.book_type || "fiction";
  const isFiction = bookType === "fiction";

  const [psychOpen, setPsychOpen] = useState(true);

  // Build a merged form object that includes spec fields (topic, genre, subgenre) 
  // needed by ProtagonistInterioritySection and InferButton
  const mergedForm = { ...spec, ...form };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px 100px" }}>
      {/* Story Bible Card */}
      <div className="p1-card" style={{ marginBottom: 18 }}>
        <div className="p1-card-header">
          <div className="p1-card-icon" style={{ background: isFiction ? '#fce7f3' : '#fef3c7', color: isFiction ? '#9d174d' : '#92400e' }}>
            {isFiction ? '🧠' : '📋'}
          </div>
          <div>
            <div className="p1-card-title">{isFiction ? 'Story Bible' : 'Nonfiction Bible'}</div>
            <div className="p1-card-subtitle">
              {isFiction
                ? "Characters, world, themes — enforced in every chapter's voice and structure"
                : "Key figures, settings, timeline, argument structure — feeds into every chapter"
              }
            </div>
          </div>
          <span className="p1-card-badge">Recommended</span>
        </div>
        <div className="p1-card-body">
          <StoryBibleEditor
            form={mergedForm}
            onChange={handleChange}
            projectId={projectId}
          />
        </div>
      </div>

      {/* Protagonist Interiority Card (fiction only) */}
      {isFiction && (
        <div className="p1-card" style={{ marginBottom: 18 }}>
          <div className="p1-card-header">
            <div className="p1-card-icon" style={{ background: '#ede9fe', color: '#7c3aed' }}>💭</div>
            <div>
              <div className="p1-card-title">Protagonist Interiority</div>
              <div className="p1-card-subtitle">Deep psychology that gets injected into every chapter prompt</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPsychOpen(o => !o)}
                className="text-xs font-semibold"
                style={{ color: '#5b50f0', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {psychOpen ? 'Collapse ▲' : 'Expand ▼'}
              </button>
            </div>
          </div>
          {psychOpen && (
            <div className="p1-card-body space-y-4">
              <ProtagonistInteriorityInferButton
                form={mergedForm}
                onChange={handleChange}
              />
              <ProtagonistInterioritySection
                form={mergedForm}
                onChange={handleChange}
              />
            </div>
          )}
        </div>
      )}

      {/* Footer Buttons */}
      <div className="flex justify-end gap-3 py-6 mt-4 border-t border-slate-200 bg-white rounded-xl px-4">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} variant="outline">
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Bible
        </Button>
        <Button onClick={onProceed} className="bg-indigo-600 hover:bg-indigo-700">
          Proceed to Outline <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}