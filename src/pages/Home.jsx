import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen, Trash2, Clock, BookOpenText, Loader2, Settings, CheckSquare, Square } from "lucide-react";
import SelectionToolbar from "../components/projects/SelectionToolbar";
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
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === projects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(projects.map(p => p.id)));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  // Scroll to top on page mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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

  const SEED_BANNED_PHRASES = `tapestry\ntapestry of\nshimmered\nshimmering\nunbeknownst\nvisceral\nviscerally\na stark reminder\nit was a reminder that\nin the grand tapestry\nweaving together\nwhispering\nthe weight of\nthe weight of it all\na mix of emotions\nflooded with emotion\nwashed over\nwashed over him\nwashed over her\na wave of\ncascade of\ncascading\nit dawned on\nrealization dawned\ndawned on him\ndawned on her\nsearing\nsearing pain\na chill ran\nshivers ran\na shiver ran down\nsent a shiver\ntapestry of emotions\neyes glistened\neyes shimmered\ncouldn't help but\ncouldn't help but feel\ncouldn't help but notice\ncouldn't help but smile\na testament to\ntestament to their\nit was clear that\nit was evident that\nneedless to say\nin the blink of an eye\nat the end of the day\nat this point in time\nlittle did he know\nlittle did she know\nlittle did they know\nfor a moment\nfor a brief moment\nin that moment\nin this moment\nthe silence was deafening\nthe air was thick\nthe room felt heavy\nheart pounded in his chest\nheart pounded in her chest\nheart hammered\npulse quickened\nbreath caught in\nbreath caught in his\nbreath caught in her\nstomach dropped\nstomach lurched\nthroat tightened\nchest tightened\ntime seemed to stop\ntime stood still\nthe world fell away\nthe world around him\nthe world around her\nall at once\nsuddenly\nsuddenly he\nsuddenly she\nsuddenly they\nas if on cue\na mix of\nswirled\nswirled within\netched in\netched on\nseared into\nburned into his\nburned into her\nthe thought nagged\nnagged at him\nnagged at her\nelectric\nelectricity between\ntension crackled\ncrackled between\na knot formed\nknot in his stomach\nknot in her stomach\ndespite himself\ndespite herself\na part of him\na part of her\nsome part of him\nsome part of her\nthe look on\nthe look in his\nthe look in her\nsomething shifted\nsomething changed\nhe wasn't sure\nshe wasn't sure\nhe couldn't be sure\nshe couldn't be sure\nin the distance\noff in the distance\nloomed in the\nloomed ahead\nacrid\nacrid smell\nacrid taste\nacrid scent\nmetallic taste\nlike a physical blow\nhit him like\nhit her like\nsucker punch\ngut punch\nlike a punch\nthe familiar\nall too familiar\npainfully familiar\npainfully aware\nhyperaware\nhyper-aware`;

  const createMutation = useMutation({
    mutationFn: async () => {
      const project = await base44.entities.Project.create({
        name: "Untitled Project",
        status: "draft",
        banned_phrases_log: JSON.stringify(SEED_BANNED_PHRASES.split('\n').filter(p => p.trim())),
      });
      return project;
    },
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

  const getProjectSpec = (projectId) =>
    allSpecs.find(s => s.project_id === projectId);

  const BEAT_STYLE_NAMES = {
    "fast-paced-thriller": "Fast-Paced Thriller", "gritty-cinematic": "Gritty Cinematic",
    "hollywood-blockbuster": "Hollywood Blockbuster", "slow-burn": "Slow Burn",
    "clean-romance": "Clean Romance", "faith-infused": "Faith-Infused",
    "investigative-nonfiction": "Investigative Nonfiction", "reference-educational": "Reference / Educational",
    "intellectual-psychological": "Intellectual Psychological", "dark-suspense": "Dark Suspense",
    "satirical": "Satirical", "epic-historical": "Epic Historical",
    "whimsical-cozy": "Whimsical Cozy", "hard-boiled-noir": "Hard-Boiled Noir",
    "grandiose-space-opera": "Space Opera", "visceral-horror": "Visceral Horror",
    "poetic-magical-realism": "Magical Realism", "clinical-procedural": "Clinical Procedural",
    "hyper-stylized-action": "Hyper-Stylized Action", "nostalgic-coming-of-age": "Coming-of-Age",
    "cerebral-sci-fi": "Cerebral Sci-Fi", "high-stakes-political": "Political",
    "surrealist-avant-garde": "Surrealist", "melancholic-literary": "Melancholic Literary",
    "urban-gritty-fantasy": "Urban Fantasy",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Your Projects</h1>
        <div className="flex items-center gap-2">
          {projects.length > 0 && (
            <Button
              variant={selectMode ? "default" : "outline"}
              size="sm"
              onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
              className={selectMode ? "bg-indigo-600 hover:bg-indigo-700 h-9" : "h-9"}
            >
              <CheckSquare className="w-4 h-4 mr-1.5" />
              {selectMode ? "Done" : "Select"}
            </Button>
          )}
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
        {selectMode && selectedIds.size > 0 && (
          <SelectionToolbar
            selectedIds={selectedIds}
            projects={projects}
            onClearSelection={exitSelectMode}
            onDeleteComplete={() => {
              exitSelectMode();
              queryClient.invalidateQueries({ queryKey: ["projects"] });
              queryClient.invalidateQueries({ queryKey: ["all-chapters"] });
            }}
          />
        )}
        {selectMode && projects.length > 1 && (
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={toggleSelectAll}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {selectedIds.size === projects.length ? "Deselect All" : "Select All"}
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const chapterCount = getChapterCount(project.id);
            const isSelected = selectedIds.has(project.id);
            return (
              <div
                 key={project.id}
                 onClick={() => {
                   if (selectMode) {
                     toggleSelect(project.id, { stopPropagation: () => {} });
                     return;
                   }
                   window.scrollTo(0, 0);
                   navigate(createPageUrl("ProjectDetail") + `?id=${project.id}`);
                 }}
                 className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer p-5 group ${
                   isSelected ? 'border-indigo-400 ring-2 ring-indigo-200 bg-indigo-50/30' : 'border-slate-200 hover:border-indigo-200'
                 }`}
               >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    {selectMode && (
                      <button
                        onClick={(e) => toggleSelect(project.id, e)}
                        className="shrink-0 text-indigo-500"
                      >
                        {isSelected
                          ? <CheckSquare className="w-5 h-5" />
                          : <Square className="w-5 h-5 text-slate-300" />
                        }
                      </button>
                    )}
                    <h3 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors text-base leading-snug flex-1 min-w-0 truncate">
                      {project.name}
                    </h3>
                  </div>
                  <StatusBadge status={project.status} />
                </div>

                <div className="flex items-center gap-3 text-sm text-slate-500 mb-4 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <BookOpenText className="w-3.5 h-3.5 text-indigo-400" />
                    {chapterCount} chapter{chapterCount !== 1 ? "s" : ""}
                  </span>
                  {(() => {
                    const sp = getProjectSpec(project.id);
                    const beatKey = sp?.beat_style || sp?.tone_style;
                    const beatName = beatKey && BEAT_STYLE_NAMES[beatKey];
                    return beatName ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                        ● {beatName}
                      </span>
                    ) : null;
                  })()}
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