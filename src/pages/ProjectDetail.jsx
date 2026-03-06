import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Trash2, Loader2, FileText, Map, BookOpenText, MessageSquare, File, Pencil, Check, X } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import SpecificationTab from "../components/project/SpecificationTab";
import OutlineTab from "../components/project/OutlineTab";
import ChaptersTab from "../components/project/ChaptersTab";
import ConversationTab from "../components/project/ConversationTab";
import SourceFilesTab from "../components/project/SourceFilesTab";

export default function ProjectDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get("id");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState(false);

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
    await base44.functions.invoke("deleteProject", { project_id: projectId });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    navigate(createPageUrl("Home"));
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
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 mt-0.5 flex-shrink-0"
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
                />
                <Button size="icon" className="h-8 w-8 bg-indigo-600 hover:bg-indigo-700" onClick={() => updateMutation.mutate({ name: newName })}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingName(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 truncate">{project.name}</h1>
                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => { setNewName(project.name); setEditingName(true); }}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            <div className="flex items-center gap-3 mt-2">
              <StatusBadge status={project.status} />
              <Select value={project.status} onValueChange={(v) => updateMutation.mutate({ status: v })}>
                <SelectTrigger className="h-7 text-xs w-auto border-dashed">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["draft", "outlining", "writing", "editing", "complete"].map((s) => (
                    <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 flex-shrink-0">
              <Trash2 className="w-4 h-4 mr-1.5" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Project</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{project.name}" and all its related data including specifications, outlines, chapters, conversations, and source files.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
                {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Delete Project
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="spec" className="space-y-6">
        <TabsList className="bg-white border border-slate-200 p-1 rounded-xl">
          <TabsTrigger value="spec" className="rounded-lg data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 gap-1.5">
            <FileText className="w-4 h-4" /> Specification
          </TabsTrigger>
          <TabsTrigger value="outline" className="rounded-lg data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 gap-1.5">
            <Map className="w-4 h-4" /> Outline
          </TabsTrigger>
          <TabsTrigger value="chapters" className="rounded-lg data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 gap-1.5">
            <BookOpenText className="w-4 h-4" /> Chapters
          </TabsTrigger>
          <TabsTrigger value="conversation" className="rounded-lg data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 gap-1.5">
            <MessageSquare className="w-4 h-4" /> Conversation
          </TabsTrigger>
          <TabsTrigger value="files" className="rounded-lg data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 gap-1.5">
            <File className="w-4 h-4" /> Source Files
          </TabsTrigger>
        </TabsList>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <TabsContent value="spec" className="mt-0">
            <SpecificationTab projectId={projectId} />
          </TabsContent>
          <TabsContent value="outline" className="mt-0">
            <OutlineTab projectId={projectId} />
          </TabsContent>
          <TabsContent value="chapters" className="mt-0">
            <ChaptersTab projectId={projectId} />
          </TabsContent>
          <TabsContent value="conversation" className="mt-0">
            <ConversationTab projectId={projectId} />
          </TabsContent>
          <TabsContent value="files" className="mt-0">
            <SourceFilesTab projectId={projectId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}