import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import ProjectCard from "../components/projects/ProjectCard";
import CreateProjectDialog from "../components/projects/CreateProjectDialog";
import EmptyState from "../components/EmptyState";

export default function Home() {
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (name) => base44.entities.Project.create({ name, status: "draft" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  const filtered = projects.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Projects</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your book generation projects</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200">
          <Plus className="w-4 h-4 mr-2" /> New Project
        </Button>
      </div>

      {projects.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white"
          />
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={search ? "No matching projects" : "No projects yet"}
          description={search ? "Try a different search term" : "Create your first book project to get started"}
          action={
            !search && (
              <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" /> Create First Project
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <CreateProjectDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreate={(name) => createMutation.mutateAsync(name)}
      />
    </div>
  );
}