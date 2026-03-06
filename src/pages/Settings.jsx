import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft, Save, Cpu, BookOpen, FileText, Palette,
  LayoutTemplate, SlidersHorizontal, Loader2, CheckCircle2,
  Plus, Trash2, Pencil, File
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import EmptyState from "../components/EmptyState";
import AIModelComparison from "../components/AIModelComparison";

const FILE_TYPES = [
  { value: "text", label: "Text" },
  { value: "prompt", label: "Prompt" },
  { value: "genre_catalog", label: "Genre Catalog" },
  { value: "style_guide", label: "Style Guide" },
  { value: "reference", label: "Reference" },
];

const FONTS = [
  { value: "georgia", label: "Georgia" },
  { value: "times", label: "Times New Roman" },
  { value: "garamond", label: "Garamond" },
  { value: "palatino", label: "Palatino" },
  { value: "bookman", label: "Bookman" },
  { value: "arial", label: "Arial" },
  { value: "helvetica", label: "Helvetica" },
  { value: "verdana", label: "Verdana" },
  { value: "merriweather", label: "Merriweather" },
  { value: "lora", label: "Lora" },
];

const DEFAULT_SETTINGS = {
  ai_model: "claude-opus-4-5",
  default_book_type: "fiction",
  default_target_length: "medium",
  default_detail_level: "moderate",
  auto_generate_all_chapters: false,
  show_word_count: true,
  show_toc_by_default: true,
  default_body_font: "georgia",
  default_heading_font: "georgia",
  default_font_size: "14px",
  default_line_spacing: "1.5",
  default_margins: "1in",
  global_style_instructions: "",
  global_content_guidelines: "",
};

const SECTIONS = [
  { id: "ai", label: "AI & Generation", icon: Cpu },
  { id: "defaults", label: "Default Values", icon: SlidersHorizontal },
  { id: "typography", label: "Typography", icon: Palette },
  { id: "layout", label: "Layout", icon: LayoutTemplate },
  { id: "content", label: "Writing Guidelines", icon: FileText },
  { id: "sourcefiles", label: "Global Source Files", icon: BookOpen },
];

export default function Settings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState("ai");
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [editFile, setEditFile] = useState(null);
  const [showFileDialog, setShowFileDialog] = useState(false);

  // Scroll to top on page mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { data: settingsRecords = [], isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const { data: globalFiles = [], isLoading: filesLoading } = useQuery({
    queryKey: ["global-sourcefiles"],
    queryFn: () => base44.entities.SourceFile.filter({ project_id: "global" }),
  });

  useEffect(() => {
    if (settingsRecords.length > 0) {
      setSettings({ ...DEFAULT_SETTINGS, ...settingsRecords[0] });
    }
  }, [settingsRecords]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const { id, created_date, updated_date, created_by, ...payload } = data;
      if (settingsRecords.length > 0) {
        return base44.entities.AppSettings.update(settingsRecords[0].id, payload);
      } else {
        return base44.entities.AppSettings.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const saveFileMutation = useMutation({
    mutationFn: (data) => {
      const { id, created_date, updated_date, created_by, ...payload } = data;
      if (editFile?.id) return base44.entities.SourceFile.update(editFile.id, payload);
      return base44.entities.SourceFile.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["global-sourcefiles"] });
      setShowFileDialog(false);
      setEditFile(null);
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: (id) => base44.entities.SourceFile.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["global-sourcefiles"] }),
  });

  const set = (key, value) => setSettings(s => ({ ...s, [key]: value }));

  const openNewFile = () => {
    setEditFile({ project_id: "global", filename: "", file_type: "style_guide", content: "", description: "" });
    setShowFileDialog(true);
  };

  const openEditFile = (f) => {
    setEditFile({ ...f });
    setShowFileDialog(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("Home"))} className="h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
            <p className="text-sm text-slate-500 mt-0.5">Configure platform defaults and generation behavior</p>
          </div>
        </div>
        <Button
          onClick={() => saveMutation.mutate(settings)}
          disabled={saveMutation.isPending}
          className="bg-indigo-600 hover:bg-indigo-700 gap-2"
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? "Saved!" : "Save Settings"}
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Nav */}
        <div className="w-52 flex-shrink-0">
          <nav className="space-y-1 sticky top-4">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                    activeSection === s.id
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {s.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* AI & Generation */}
          {activeSection === "ai" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Cpu className="w-4 h-4 text-indigo-500" /> AI & Generation</CardTitle>
                <CardDescription>Control which AI model powers your book generation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label className="text-sm font-medium">AI Model</Label>
                  <p className="text-xs text-slate-500 mb-2">Select a model for book generation.</p>
                  <Select value={settings.ai_model} onValueChange={v => set("ai_model", v)}>
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude-opus-4-5">Claude Opus (Most Powerful)</SelectItem>
                      <SelectItem value="claude-sonnet-4-5">Claude Sonnet (Balanced)</SelectItem>
                      <SelectItem value="claude-haiku-4-5">Claude Haiku (Fastest)</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o (OpenAI - Most Capable)</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo (OpenAI - Fast)</SelectItem>
                      <SelectItem value="deepseek-chat">DeepSeek Chat (Cost-Effective)</SelectItem>
                    </SelectContent>
                  </Select>
                  <AIModelComparison selectedModel={settings.ai_model} />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Auto-Generate All Chapters</Label>
                    <p className="text-xs text-slate-500 mt-0.5">Automatically generate all chapters after outline is created.</p>
                  </div>
                  <Switch
                    checked={settings.auto_generate_all_chapters}
                    onCheckedChange={v => set("auto_generate_all_chapters", v)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Default Values */}
          {activeSection === "defaults" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><SlidersHorizontal className="w-4 h-4 text-indigo-500" /> Default Values</CardTitle>
                <CardDescription>Pre-fill new project specification fields with these defaults.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Default Book Type</Label>
                    <Select value={settings.default_book_type} onValueChange={v => set("default_book_type", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fiction">Fiction</SelectItem>
                        <SelectItem value="nonfiction">Non-Fiction</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Default Target Length</Label>
                    <Select value={settings.default_target_length} onValueChange={v => set("default_target_length", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">{"Short (8\u201312 chapters)"}</SelectItem>
                        <SelectItem value="medium">{"Medium (15\u201325 chapters)"}</SelectItem>
                        <SelectItem value="long">{"Long (25\u201340 chapters)"}</SelectItem>
                        <SelectItem value="epic">{"Epic (40\u201360 chapters)"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Default Detail Level</Label>
                    <Select value={settings.default_detail_level} onValueChange={v => set("default_detail_level", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minimal">Minimal</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="comprehensive">Comprehensive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Show Word Count</Label>
                    <p className="text-xs text-slate-500 mt-0.5">Display word count in the editor status bar.</p>
                  </div>
                  <Switch
                    checked={settings.show_word_count}
                    onCheckedChange={v => set("show_word_count", v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Show Table of Contents by Default</Label>
                    <p className="text-xs text-slate-500 mt-0.5">Include TOC when loading the editor.</p>
                  </div>
                  <Switch
                    checked={settings.show_toc_by_default}
                    onCheckedChange={v => set("show_toc_by_default", v)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Typography */}
          {activeSection === "typography" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Palette className="w-4 h-4 text-indigo-500" /> Typography</CardTitle>
                <CardDescription>Default font and size settings for exported documents.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Body Font</Label>
                    <Select value={settings.default_body_font} onValueChange={v => set("default_body_font", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FONTS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Heading Font</Label>
                    <Select value={settings.default_heading_font} onValueChange={v => set("default_heading_font", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FONTS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Font Size</Label>
                    <Select value={settings.default_font_size} onValueChange={v => set("default_font_size", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["11px","12px","13px","14px","15px","16px","18px"].map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Line Spacing</Label>
                    <Select value={settings.default_line_spacing} onValueChange={v => set("default_line_spacing", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["1.0","1.15","1.25","1.5","1.75","2.0"].map(s => (
                          <SelectItem key={s} value={s}>{s}×</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Layout */}
          {activeSection === "layout" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><LayoutTemplate className="w-4 h-4 text-indigo-500" /> Layout</CardTitle>
                <CardDescription>Default page margins for exported documents.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label className="text-sm font-medium">Default Page Margins</Label>
                  <Select value={settings.default_margins} onValueChange={v => set("default_margins", v)}>
                    <SelectTrigger className="mt-1 max-w-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.5in">Narrow (0.5 in)</SelectItem>
                      <SelectItem value="0.75in">Slightly Narrow (0.75 in)</SelectItem>
                      <SelectItem value="1in">Normal (1 in)</SelectItem>
                      <SelectItem value="1.25in">Wide (1.25 in)</SelectItem>
                      <SelectItem value="1.5in">Extra Wide (1.5 in)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Writing Guidelines */}
          {activeSection === "content" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><FileText className="w-4 h-4 text-indigo-500" /> Writing Guidelines</CardTitle>
                <CardDescription>These instructions are automatically appended to every generation prompt.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label className="text-sm font-medium">Global Style Instructions</Label>
                  <p className="text-xs text-slate-500 mb-1.5">E.g. "Always write in third-person past tense. Use vivid sensory details."</p>
                  <Textarea
                    rows={5}
                    placeholder="Enter global style instructions..."
                    value={settings.global_style_instructions || ""}
                    onChange={e => set("global_style_instructions", e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Global Content Guidelines</Label>
                  <p className="text-xs text-slate-500 mb-1.5">E.g. "Keep content family-friendly. Avoid graphic violence."</p>
                  <Textarea
                    rows={5}
                    placeholder="Enter global content guidelines..."
                    value={settings.global_content_guidelines || ""}
                    onChange={e => set("global_content_guidelines", e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Global Source Files */}
          {activeSection === "sourcefiles" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="w-4 h-4 text-indigo-500" /> Global Source Files</CardTitle>
                <CardDescription>
                  These files are included in <strong>every</strong> book generation across all projects — style guides, genre rules, author voice samples, etc.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">{globalFiles.length} file{globalFiles.length !== 1 ? "s" : ""}</span>
                    {globalFiles.length > 0 && (
                      <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300 bg-emerald-50">Active in all generations</Badge>
                    )}
                  </div>
                  <Button onClick={openNewFile} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="w-4 h-4 mr-1.5" /> Add File
                  </Button>
                </div>

                {filesLoading ? (
                  <div className="py-8 text-center text-sm text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
                ) : globalFiles.length === 0 ? (
                  <EmptyState
                    icon={File}
                    title="No global source files"
                    description="Add style guides, genre references, or author voice samples to inject into every generation."
                    action={<Button onClick={openNewFile} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4 mr-2" /> Add File</Button>}
                  />
                ) : (
                  <div className="space-y-3">
                    {globalFiles.map(f => (
                      <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <File className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <span className="font-medium text-slate-800 text-sm truncate block">{f.filename}</span>
                            {f.description && <span className="text-xs text-slate-500 truncate block">{f.description}</span>}
                          </div>
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {FILE_TYPES.find(t => t.value === f.file_type)?.label || f.file_type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 ml-3">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditFile(f)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteFileMutation.mutate(f.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      {/* File Dialog */}
      <Dialog open={showFileDialog} onOpenChange={v => { setShowFileDialog(v); if (!v) setEditFile(null); }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editFile?.id ? "Edit Global Source File" : "New Global Source File"}</DialogTitle>
          </DialogHeader>
          {editFile && (
            <form onSubmit={e => { e.preventDefault(); saveFileMutation.mutate(editFile); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Filename</Label>
                  <Input value={editFile.filename} onChange={e => setEditFile({ ...editFile, filename: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>File Type</Label>
                  <Select value={editFile.file_type} onValueChange={v => setEditFile({ ...editFile, file_type: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FILE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input value={editFile.description || ""} onChange={e => setEditFile({ ...editFile, description: e.target.value })} className="mt-1" placeholder="Brief description of this file's purpose" />
              </div>
              <div>
                <Label>Content</Label>
                <Textarea rows={10} value={editFile.content || ""} onChange={e => setEditFile({ ...editFile, content: e.target.value })} className="mt-1 font-mono text-sm" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowFileDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={saveFileMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                  {saveFileMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}