import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Loader2, Settings } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ScribbleCircle from "./ScribbleCircle";
import HomeProjectCard from "./HomeProjectCard";
import HomeProjectPreview from "./HomeProjectPreview";
import SettingsModal from "./SettingsModal";

const SEED_BANNED_PHRASES = `tapestry\ntapestry of\nshimmered\nshimmering\nunbeknownst\nvisceral\nviscerally\na stark reminder\nit was a reminder that\nin the grand tapestry\nweaving together\nwhispering\nthe weight of\nthe weight of it all\na mix of emotions\nflooded with emotion\nwashed over\nwashed over him\nwashed over her\na wave of\ncascade of\ncascading\nit dawned on\nrealization dawned\ndawned on him\ndawned on her\nsearing\nsearing pain\na chill ran\nshivers ran\na shiver ran down\nsent a shiver\ntapestry of emotions\neyes glistened\neyes shimmered\ncouldn't help but\ncouldn't help but feel\ncouldn't help but notice\ncouldn't help but smile\na testament to\ntestament to their\nit was clear that\nit was evident that\nneedless to say\nin the blink of an eye\nat the end of the day\nat this point in time\nlittle did he know\nlittle did she know\nlittle did they know`;

export default function HomeTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState(null); // null | "new" | "open"
  const [selectedProject, setSelectedProject] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-updated_date"),
  });

  const { data: allSpecs = [] } = useQuery({
    queryKey: ["all-specs"],
    queryFn: () => base44.entities.Specification.list(),
  });

  const { data: allChapters = [] } = useQuery({
    queryKey: ["all-chapters"],
    queryFn: () => base44.entities.Chapter.list(),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return await base44.entities.Project.create({
        name: "Untitled Project",
        status: "draft",
        banned_phrases_log: JSON.stringify(SEED_BANNED_PHRASES.split('\n').filter(p => p.trim())),
      });
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate(createPageUrl("ProjectDetail") + `?id=${project.id}`);
    },
  });

  const getChapterCount = (projectId) =>
    allChapters.filter((c) => c.project_id === projectId && c.status === "generated").length;

  const getProjectSpec = (projectId) =>
    allSpecs.find(s => s.project_id === projectId);

  const handleDelete = async () => {
    if (!selectedProject) return;
    setDeletingId(selectedProject.id);
    setDeleteConfirmOpen(false);
    await base44.functions.invoke('deleteProject', { project_id: selectedProject.id });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["all-chapters"] });
    setSelectedProject(null);
    setDeletingId(null);
  };

  const handleOpenProject = () => {
    if (!selectedProject) return;
    navigate(createPageUrl("ProjectDetail") + `?id=${selectedProject.id}`);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-[480px]" style={{ color: "var(--ink)" }}>
      {/* LEFT PAGE */}
      <div className="flex-1 p-5 md:p-8 md:border-r" style={{ borderColor: "var(--nb-border)" }}>
        {/* Settings gear — top right */}
        <div className="flex justify-end mb-2">
          <button
            className="nb-settings-gear"
            onClick={() => setSettingsOpen(true)}
            title="Notebook Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Title */}
        <h1
          className="text-center mb-8"
          style={{ fontFamily: "'Caveat', cursive", fontSize: "22px", color: "var(--ink)" }}
        >
          Master Book Engine
        </h1>

        {/* Mode selection */}
        {mode === null && (
          <div className="flex flex-col items-center gap-5">
            <button
              onClick={() => {
                setMode("new");
                createMutation.mutate();
              }}
              disabled={createMutation.isPending}
              className="text-lg font-medium cursor-pointer bg-transparent border-none"
              style={{ fontFamily: "'Caveat', cursive", color: "var(--ink)" }}
            >
              <ScribbleCircle active={createMutation.isPending}>
                {createMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Creating…
                  </span>
                ) : (
                  "New project"
                )}
              </ScribbleCircle>
            </button>

            <button
              onClick={() => setMode("open")}
              className="text-lg font-medium cursor-pointer bg-transparent border-none"
              style={{ fontFamily: "'Caveat', cursive", color: "var(--ink)" }}
            >
              <ScribbleCircle active={mode === "open"}>
                Open project
              </ScribbleCircle>
            </button>
          </div>
        )}

        {/* Project browser */}
        {mode === "open" && (
          <div>
            <button
              onClick={() => { setMode(null); setSelectedProject(null); }}
              className="text-xs mb-3 px-2 py-1 rounded-lg hover:opacity-80"
              style={{ color: "var(--accent)", background: "transparent" }}
            >
              ← Back
            </button>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--accent)" }} />
              </div>
            ) : projects.length === 0 ? (
              <p className="text-center text-sm py-8" style={{ color: "var(--ink2)" }}>
                No projects yet. Create your first!
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                {projects.map((p) => (
                  <HomeProjectCard
                    key={p.id}
                    project={p}
                    spec={getProjectSpec(p.id)}
                    chapterCount={getChapterCount(p.id)}
                    isSelected={selectedProject?.id === p.id}
                    onClick={() => setSelectedProject(p)}
                  />
                ))}
              </div>
            )}

            {/* Quick new project at bottom */}
            <div className="mt-4 pt-3 text-center" style={{ borderTop: "1px solid var(--nb-border)" }}>
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="text-sm font-medium"
                style={{ fontFamily: "'Caveat', cursive", color: "var(--accent)" }}
              >
                <ScribbleCircle active={createMutation.isPending}>
                  {createMutation.isPending ? "Creating…" : "+ New project"}
                </ScribbleCircle>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PAGE */}
      <div className="flex-1 p-5 md:p-8">
        <HomeProjectPreview
          project={selectedProject}
          spec={selectedProject ? getProjectSpec(selectedProject.id) : null}
          chapterCount={selectedProject ? getChapterCount(selectedProject.id) : 0}
          onOpen={handleOpenProject}
          onDelete={() => setDeleteConfirmOpen(true)}
          deleting={deletingId === selectedProject?.id}
        />
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{selectedProject?.name}" and all its data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}