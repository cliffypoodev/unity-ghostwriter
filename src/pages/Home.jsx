import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen, Trash2, Clock, BookOpenText, Loader2, Settings } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import StatusBadge from "../components/StatusBadge";
import moment from "moment";

export default function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState(null);

  // Scroll to top on page mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-updated_date"),
  });

  const { data: allChapters = [] } = useQuery({
    queryKey: ["all-chapters"],
    queryFn: () => base44.entities.Chapter.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.Project.create({ name: "Untitled Project", status: "draft" }),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      window.scrollTo(0, 0);
      navigate(createPageUrl("ProjectDetail") + `?id=${project.id}`);
    },
  });

  const handleDelete = async (projectId, e) => {
    e.stopPropagation();
    setDeletingId(projectId);
    try {
      await base44.functions.invoke('deleteProject', { project_id: projectId });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["all-chapters"] });
    } finally {
      setDeletingId(null);
    }
  };

  const getChapterCount = (projectId) =>
    allChapters.filter((c) => c.project_id === projectId && c.status === "generated").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Your Projects</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              window.scrollTo(0, 0);
              navigate(createPageUrl("Settings"));
            }}
            className="h-9 w-9"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => {
              window.scrollTo(0, 0);
              createMutation.mutate();
            }}
            disabled={createMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 shadow-sm"
          >
          {createMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
            + New Project
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-5">
            <BookOpen className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No projects yet</h2>
          <p className="text-slate-500 mb-6 max-w-sm">Start your first book project and bring your ideas to life with AI-powered generation.</p>
          <Button
            onClick={() => {
              window.scrollTo(0, 0);
              createMutation.mutate();
            }}
            disabled={createMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Create Your First Book
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const chapterCount = getChapterCount(project.id);
            return (
              <div
                 key={project.id}
                 onClick={() => {
                   window.scrollTo(0, 0);
                   navigate(createPageUrl("ProjectDetail") + `?id=${project.id}`);
                 }}
                 className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-200 cursor-pointer p-5 group"
               >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors text-base leading-snug flex-1 min-w-0 pr-2 truncate">
                    {project.name}
                  </h3>
                  <StatusBadge status={project.status} />
                </div>

                <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                  <span className="flex items-center gap-1.5">
                    <BookOpenText className="w-3.5 h-3.5 text-indigo-400" />
                    {chapterCount} chapter{chapterCount !== 1 ? "s" : ""} generated
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    Updated {moment(project.updated_date).fromNow()}
                  </span>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        {deletingId === project.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Project</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{project.name}" and all its data.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) => handleDelete(project.id, e)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}