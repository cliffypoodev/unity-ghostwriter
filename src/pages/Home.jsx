import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, BookOpen, Trash2, Clock, BookOpenText, Loader2, Settings, CheckSquare, Square, FolderOpen, Folder, FolderPlus, X, Pencil, ChevronRight } from "lucide-react";
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
  const [activeFolder, setActiveFolder] = useState(null); // null = all, "" = unfiled, string = folder name
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [movingProjectId, setMovingProjectId] = useState(null);

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

  // ── FOLDER MANAGEMENT ──
  // Derive folder list from project.folder fields
  const folders = [...new Set(projects.filter(p => p.folder).map(p => p.folder))].sort();
  const unfiledCount = projects.filter(p => !p.folder).length;

  // Filter projects by active folder
  const filteredProjects = activeFolder === null
    ? projects // "All" — show everything
    : activeFolder === ""
      ? projects.filter(p => !p.folder) // "Unfiled"
      : projects.filter(p => p.folder === activeFolder); // Specific folder

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    if (folders.includes(name)) { setNewFolderName(""); setCreatingFolder(false); return; }
    // Create folder by assigning it — pick an unfiled project or just set state
    setCreatingFolder(false);
    setNewFolderName("");
    setActiveFolder(name);
    // The folder exists once a project is moved to it
  };

  const handleMoveToFolder = async (projectId, folderName) => {
    try {
      await base44.entities.Project.update(projectId, { folder: folderName || "" });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setMovingProjectId(null);
    } catch (err) {
      console.error("Failed to move project:", err);
    }
  };

  const handleMoveSelectedToFolder = async (folderName) => {
    for (const id of selectedIds) {
      await base44.entities.Project.update(id, { folder: folderName || "" });
    }
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    exitSelectMode();
  };

  const handleRenameFolder = async (oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) { setRenamingFolder(null); return; }
    const projectsInFolder = projects.filter(p => p.folder === oldName);
    for (const p of projectsInFolder) {
      await base44.entities.Project.update(p.id, { folder: trimmed });
    }
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    if (activeFolder === oldName) setActiveFolder(trimmed);
    setRenamingFolder(null);
  };

  const handleDeleteFolder = async (folderName) => {
    const projectsInFolder = projects.filter(p => p.folder === folderName);
    for (const p of projectsInFolder) {
      await base44.entities.Project.update(p.id, { folder: "" });
    }
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    if (activeFolder === folderName) setActiveFolder(null);
  };

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

      {/* ── FOLDER TABS ── */}
      {(folders.length > 0 || projects.length > 3) && (
        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveFolder(null)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeFolder === null
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> All ({projects.length})
          </button>

          {folders.map(f => {
            const count = projects.filter(p => p.folder === f).length;
            return (
              <div key={f} className="shrink-0 flex items-center group">
                {renamingFolder === f ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(f, renameValue); if (e.key === 'Escape') setRenamingFolder(null); }}
                      className="h-8 w-32 text-sm"
                      autoFocus
                    />
                    <button onClick={() => handleRenameFolder(f, renameValue)} className="text-emerald-600 text-xs">✓</button>
                    <button onClick={() => setRenamingFolder(null)} className="text-slate-400 text-xs">✗</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveFolder(activeFolder === f ? null : f)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      activeFolder === f
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5" /> {f} ({count})
                  </button>
                )}
                {/* Rename / Delete on hover */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center ml-1 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); setRenamingFolder(f); setRenameValue(f); }}
                    className="text-slate-400 hover:text-indigo-600 p-0.5" title="Rename">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Remove folder "${f}"? Projects will be moved to Unfiled.`)) handleDeleteFolder(f); }}
                    className="text-slate-400 hover:text-red-500 p-0.5" title="Delete folder">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {unfiledCount > 0 && folders.length > 0 && (
            <button
              onClick={() => setActiveFolder(activeFolder === "" ? null : "")}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeFolder === ""
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" /> Unfiled ({unfiledCount})
            </button>
          )}

          {/* Create folder */}
          {creatingFolder ? (
            <div className="shrink-0 flex items-center gap-1">
              <Input
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(""); } }}
                placeholder="Folder name..."
                className="h-8 w-32 text-sm"
                autoFocus
              />
              <button onClick={handleCreateFolder} className="text-emerald-600 text-xs font-medium">Create</button>
              <button onClick={() => { setCreatingFolder(false); setNewFolderName(""); }} className="text-slate-400 text-xs">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setCreatingFolder(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-dashed border-slate-300 hover:border-indigo-300"
            >
              <FolderPlus className="w-3.5 h-3.5" /> New Folder
            </button>
          )}

          {/* Move selected to folder */}
          {selectMode && selectedIds.size > 0 && (
            <div className="shrink-0 flex items-center gap-1 ml-2 pl-2 border-l border-slate-300">
              <span className="text-xs text-slate-500">Move to:</span>
              {folders.map(f => (
                <button key={f} onClick={() => handleMoveSelectedToFolder(f)}
                  className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700">
                  {f}
                </button>
              ))}
              <button onClick={() => handleMoveSelectedToFolder("")}
                className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-700">
                Unfiled
              </button>
            </div>
          )}
        </div>
      )}

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
        <>
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
          {filteredProjects.map((project) => {
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
                  {project.folder && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium flex items-center gap-1">
                      <Folder className="w-3 h-3" /> {project.folder}
                    </span>
                  )}
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

                  <div className="flex items-center gap-1">
                    {/* Move to folder */}
                    {!selectMode && folders.length > 0 && (
                      <div className="relative">
                        {movingProjectId === project.id ? (
                          <div className="absolute right-0 bottom-8 z-10 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[140px]" onClick={e => e.stopPropagation()}>
                            {folders.map(f => (
                              <button key={f} onClick={() => handleMoveToFolder(project.id, f)}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50 flex items-center gap-1.5 ${project.folder === f ? 'text-indigo-600 font-medium' : 'text-slate-600'}`}>
                                <Folder className="w-3 h-3" /> {f} {project.folder === f ? '✓' : ''}
                              </button>
                            ))}
                            <div className="border-t border-slate-100 my-0.5" />
                            <button onClick={() => handleMoveToFolder(project.id, "")}
                              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-amber-50 flex items-center gap-1.5 ${!project.folder ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>
                              <FolderOpen className="w-3 h-3" /> Unfiled {!project.folder ? '✓' : ''}
                            </button>
                          </div>
                        ) : null}
                        <button
                          onClick={(e) => { e.stopPropagation(); setMovingProjectId(movingProjectId === project.id ? null : project.id); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors opacity-0 group-hover:opacity-100"
                          title="Move to folder"
                        >
                          <Folder className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {!selectMode && (
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
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}