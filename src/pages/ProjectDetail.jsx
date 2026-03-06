import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { ArrowLeft, Save, Loader2, Pencil, Check, X, CheckCircle2 } from "lucide-react";
import SpecificationTab from "../components/project/SpecificationTab";
import GenerateTab from "../components/project/GenerateTab";
import ConversationTab from "../components/project/ConversationTab";
import SourceFilesTab from "../components/project/SourceFilesTab";
import EditExportTab from "../components/project/EditExportTab";
import DeleteProjectDialog from "../components/project/DeleteProjectDialog";
import { cn } from "@/lib/utils";

const PHASES = [
  { id: "specify", label: "1. Specify", description: "Define your book" },
  { id: "generate", label: "2. Generate", description: "Build outline & chapters" },
  { id: "export", label: "3. Edit & Export", description: "Polish & export" },
];

// Map phases to which status values count as "completed"
const PHASE_ORDER = ["specify", "generate", "export"];

function PhaseTabs({ activePhase, setActivePhase, projectStatus }) {
  const getPhaseState = (phaseId) => {
    const activeIdx = PHASE_ORDER.indexOf(activePhase);
    const phaseIdx = PHASE_ORDER.indexOf(phaseId);
    if (phaseId === activePhase) return "active";
    if (phaseIdx < activeIdx) return "completed";
    return "idle";
  };

  return (
    <div className="flex items-center gap-0 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm">
      {PHASES.map((phase, i) => {
        const state = getPhaseState(phase.id);
        return (
          <React.Fragment key={phase.id}>
            <button
              onClick={() => setActivePhase(phase.id)}
              className={cn(
                "flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                state === "active" && "bg-indigo-600 text-white shadow-md shadow-indigo-200",
                state === "completed" && "text-emerald-600 hover:bg-emerald-50",
                state === "idle" && "text-slate-500 hover:bg-slate-50"
              )}
            >
              {state === "completed" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              ) : (
                <span className={cn(
                  "w-5 h-5 rounded-full text-xs flex items-center justify-center flex-shrink-0 font-bold",
                  state === "active" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                )}>
                  {i + 1}
                </span>
              )}
              {phase.label.replace(/^\d+\.\s/, "")}
            </button>
            {i < PHASES.length - 1 && (
              <div className="w-px h-5 bg-slate-200 mx-1" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function ProjectDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get("id");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activePhase, setActivePhase] = useState("specify");

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const projects = await base44.entities.Project.filter({ id: projectId });
      return projects[0];
    },
    enabled: !!projectId,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.update(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      setEditingName(false);
    },
  });

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/functions/deleteProject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ project_id: projectId }),
    });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    navigate(createPageUrl("Home"));
  };

  const handleSave = async () => {
    setSaving(true);
    await updateMutation.mutateAsync({ updated_date: new Date().toISOString() });
    setSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-24">
        <p className="text-slate-500">Project not found</p>
        <Button variant="link" onClick={() => navigate(createPageUrl("Home"))} className="mt-2 text-indigo-600">
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 flex-shrink-0"
            onClick={() => navigate(createPageUrl("Home"))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="text-xl font-bold h-10 max-w-md"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") updateMutation.mutate({ name: newName }); if (e.key === "Escape") setEditingName(false); }}
                />
                <Button size="icon" className="h-8 w-8 bg-indigo-600 hover:bg-indigo-700" onClick={() => updateMutation.mutate({ name: newName })}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingName(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="text-2xl font-bold text-slate-900 truncate">{project.name}</h1>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => { setNewName(project.name); setEditingName(true); }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="text-slate-600 border-slate-200 hover:bg-slate-50"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-4 h-4 mr-1.5 text-emerald-500" />
            ) : (
              <Save className="w-4 h-4 mr-1.5" />
            )}
            {saveSuccess ? "Saved!" : "Save"}
          </Button>
          <DeleteProjectDialog
            projectName={project.name}
            onConfirm={handleDelete}
            deleting={deleting}
          />
        </div>
      </div>

      {/* Phase Tabs */}
      <div className="mb-6">
        <PhaseTabs activePhase={activePhase} setActivePhase={setActivePhase} projectStatus={project.status} />
      </div>

      {/* Phase Content */}
      <div className={cn("bg-white rounded-2xl border border-slate-200 shadow-sm", activePhase === "export" ? "overflow-hidden" : "p-6")}>
        {activePhase === "specify" && (
          <div className="space-y-6">
            <SpecificationTab projectId={projectId} onProceed={() => setActivePhase("generate")} />
          </div>
        )}
        {activePhase === "generate" && (
          <GenerateTab projectId={projectId} onProceed={() => setActivePhase("export")} />
        )}
        {activePhase === "export" && (
          <EditExportTab projectId={projectId} />
        )}
      </div>
    </div>
  );
}