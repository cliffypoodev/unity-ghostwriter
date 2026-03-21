import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Loader2, Pencil, Check, X, CheckCircle2 } from "lucide-react";
import SetupTab from "../components/project/SetupTab";
import BibleTab from "../components/project/BibleTab";
import GenerateTab from "../components/project/GenerateTab";
import ConversationTab from "../components/project/ConversationTab";
import SourceFilesTab from "../components/project/SourceFilesTab";
import EditExportTab from "../components/project/EditExportTab";
import ReviewPolishTab from "../components/project/ReviewPolishTab";
import CoverDesigner from "../components/project/CoverDesigner";
import BookPreview from "../components/project/BookPreview";
import DeleteProjectDialog from "../components/project/DeleteProjectDialog";
import AppErrorBoundary from "../components/AppErrorBoundary";
import DiagnosticsPanel from "../components/DiagnosticsPanel";
import NotebookShell from "../components/project/NotebookShell";
import { cn } from "@/lib/utils";

const PHASE_ORDER = ["setup", "bible", "generate", "export", "review", "cover", "preview"];

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
  const [activePhase, setActivePhase] = useState("setup");

  // Scroll to top on phase change and on initial mount
  useEffect(() => { 
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }, [activePhase]);

  useEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }, [projectId]);

  // Listen for navigateToPhase events from child components
  useEffect(() => {
    const handler = (e) => { if (e.detail && PHASE_ORDER.includes(e.detail)) setActivePhase(e.detail); };
    window.addEventListener('navigateToPhase', handler);
    return () => window.removeEventListener('navigateToPhase', handler);
  }, []);

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
    await base44.functions.invoke('deleteProject', { project_id: projectId });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    window.scrollTo(0, 0);
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
         <Button variant="link" onClick={() => {
           window.scrollTo(0, 0);
           navigate(createPageUrl("Home"));
         }} className="mt-2 text-indigo-600">
           Go back
         </Button>
       </div>
    );
  }

  return (
     <div className="overflow-x-hidden">
       {/* Header */}
       <div className="flex items-center justify-between mb-4 sm:mb-6 gap-4">
         <div className="flex items-center gap-3 flex-1 min-w-0">
           <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              onClick={() => {
                window.scrollTo(0, 0);
                navigate(createPageUrl("Home"));
              }}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
           <div className="flex-1 min-w-0">
             {editingName ? (
               <div className="flex items-center gap-2">
                 <Input
                   value={newName}
                   onChange={(e) => setNewName(e.target.value)}
                   className="text-lg sm:text-xl font-bold h-10 flex-1 min-w-0"
                   ref={(el) => el?.focus({ preventScroll: true })}
                   onKeyDown={(e) => { if (e.key === "Enter") updateMutation.mutate({ name: newName }); if (e.key === "Escape") setEditingName(false); }}
                 />
                 <Button size="icon" className="h-8 w-8 bg-indigo-600 hover:bg-indigo-700 flex-shrink-0" onClick={() => updateMutation.mutate({ name: newName })}>
                   <Check className="w-4 h-4" />
                 </Button>
                 <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0" onClick={() => setEditingName(false)}>
                   <X className="w-4 h-4" />
                 </Button>
               </div>
             ) : (
               <div className="flex items-center gap-2 group min-w-0">
                 <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{project.name}</h1>
                 <Button
                   variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                   onClick={() => { setNewName(project.name); setEditingName(true); }}
                 >
                   <Pencil className="w-3.5 h-3.5" />
                 </Button>
               </div>
             )}
           </div>
         </div>


       </div>

       {/* Notebook Shell — tabs + body */}
       <NotebookShell activePhase={activePhase} onPhaseChange={setActivePhase}>
         {activePhase === "setup" && (
           <AppErrorBoundary>
             <SetupTab projectId={projectId} onProceed={() => setActivePhase("bible")} />
           </AppErrorBoundary>
         )}
         {activePhase === "bible" && (
           <AppErrorBoundary>
             <BibleTab projectId={projectId} onProceed={() => setActivePhase("generate")} />
           </AppErrorBoundary>
         )}
         {activePhase === "generate" && (
           <AppErrorBoundary>
             <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 24px 100px' }}>
               <GenerateTab projectId={projectId} onProceed={() => setActivePhase("export")} />
             </div>
           </AppErrorBoundary>
         )}
         {activePhase === "export" && (
           <AppErrorBoundary>
             <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px 100px' }}>
               <div className="p1-card" style={{ overflow: 'hidden' }}>
                 <EditExportTab projectId={projectId} />
               </div>
             </div>
           </AppErrorBoundary>
         )}
         {activePhase === "review" && (
           <AppErrorBoundary>
             <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 24px 100px' }}>
               <ReviewPolishTab projectId={projectId} />
             </div>
           </AppErrorBoundary>
         )}
         {activePhase === "cover" && (
           <AppErrorBoundary>
             <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 24px 100px' }}>
               <CoverDesigner projectId={projectId} />
             </div>
           </AppErrorBoundary>
         )}
         {activePhase === "preview" && (
           <AppErrorBoundary>
             <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px 100px' }}>
               <BookPreview projectId={projectId} />
             </div>
           </AppErrorBoundary>
         )}
         </NotebookShell>

      <DiagnosticsPanel />
    </div>
  );
}