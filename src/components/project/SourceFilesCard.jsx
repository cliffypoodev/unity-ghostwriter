import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Plus, ChevronDown, ChevronRight, Pencil, Trash2, FileText, X, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const FILE_TYPES = [
  { value: "text", label: "General Text" },
  { value: "prompt", label: "Prompt Template" },
  { value: "genre_catalog", label: "Genre Catalog" },
  { value: "style_guide", label: "Style Guide" },
  { value: "reference", label: "Reference Material" },
];

const TYPE_BADGE_COLORS = {
  text: "bg-slate-100 text-slate-700",
  prompt: "bg-violet-100 text-violet-700",
  genre_catalog: "bg-amber-100 text-amber-700",
  style_guide: "bg-emerald-100 text-emerald-700",
  reference: "bg-blue-100 text-blue-700",
};

const ACCEPTED_EXTENSIONS = ".txt,.md,.json,.csv,.yaml,.yml,.xml,.html";

function SourceFileItem({ file, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const typeLabel = FILE_TYPES.find(t => t.value === file.file_type)?.label || file.file_type;
  const content = file.content || "";
  const preview = content.slice(0, 200);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-white">
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-800 truncate">{file.filename}</span>
            <Badge className={cn("text-xs px-2 py-0.5 rounded-full border-0", TYPE_BADGE_COLORS[file.file_type] || TYPE_BADGE_COLORS.text)}>
              {typeLabel}
            </Badge>
            <span className="text-xs text-slate-400">{content.length.toLocaleString()} chars</span>
          </div>
          {file.description && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{file.description}</p>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-indigo-600" onClick={() => onEdit(file)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-red-500" onClick={() => onDelete(file.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {!expanded && content && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
          <pre className="text-xs text-slate-500 font-mono whitespace-pre-wrap break-all leading-relaxed">
            {preview}{content.length > 200 ? "…" : ""}
          </pre>
        </div>
      )}

      {expanded && content && (
        <div className="border-t border-slate-100 bg-slate-50">
          <pre
            className="text-xs text-slate-700 font-mono whitespace-pre-wrap break-all p-4 leading-relaxed overflow-y-auto"
            style={{ maxHeight: "300px" }}
          >
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}

function SourceFileForm({ initial, onSave, onCancel, isSaving }) {
  const [form, setForm] = useState(initial || { filename: "", file_type: "text", description: "", content: "" });

  return (
    <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50/30 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium">Filename</Label>
          <Input
            className="mt-1 text-sm"
            placeholder="my-style-guide.txt"
            value={form.filename}
            onChange={e => setForm(f => ({ ...f, filename: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-xs font-medium">Type</Label>
          <Select value={form.file_type} onValueChange={v => setForm(f => ({ ...f, file_type: v }))}>
            <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FILE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs font-medium">Description (optional)</Label>
        <Input
          className="mt-1 text-sm"
          placeholder="Brief description of this file..."
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div>
        <Label className="text-xs font-medium">Content</Label>
        <Textarea
          className="mt-1 text-xs font-mono leading-relaxed"
          rows={8}
          placeholder="Paste or type file content here..."
          value={form.content}
          onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel}>
          <X className="w-3.5 h-3.5 mr-1" /> Cancel
        </Button>
        <Button
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-700"
          disabled={!form.filename.trim() || !form.content.trim() || isSaving}
          onClick={() => onSave(form)}
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
          Save File
        </Button>
      </div>
    </div>
  );
}

export default function SourceFilesCard({ projectId }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [showForm, setShowForm] = useState(false);
  const [editingFile, setEditingFile] = useState(null);

  const { data: sourceFiles = [] } = useQuery({
    queryKey: ["sourceFiles", projectId],
    queryFn: () => base44.entities.SourceFile.filter({ project_id: projectId }),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = { ...data };
      ["id", "created_date", "updated_date", "created_by"].forEach(k => delete payload[k]);
      if (editingFile) return base44.entities.SourceFile.update(editingFile.id, payload);
      return base44.entities.SourceFile.create({ ...payload, project_id: projectId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sourceFiles", projectId] });
      setShowForm(false);
      setEditingFile(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SourceFile.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sourceFiles", projectId] }),
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const content = await file.text();
    const ext = file.name.split(".").pop().toLowerCase();
    const typeMap = { txt: "text", md: "text", json: "reference", csv: "reference", yaml: "reference", yml: "reference", xml: "reference", html: "reference" };
    setEditingFile(null);
    setShowForm(true);
    // Pre-fill form via editing mechanism
    setEditingFile({ filename: file.name, file_type: typeMap[ext] || "text", description: "", content, _isNew: true });
    e.target.value = "";
  };

  const handleEdit = (file) => {
    setEditingFile(file);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setEditingFile(null);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingFile(null);
  };

  const handleSave = (formData) => {
    if (editingFile && !editingFile._isNew) {
      saveMutation.mutate(formData);
    } else {
      saveMutation.mutate({ ...formData, project_id: projectId });
    }
  };

  const formInitial = editingFile
    ? { filename: editingFile.filename, file_type: editingFile.file_type, description: editingFile.description || "", content: editingFile.content || "" }
    : null;

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4 text-indigo-500" />
            Source Files
          </CardTitle>
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept={ACCEPTED_EXTENSIONS} className="hidden" onChange={handleFileUpload} />
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload File
            </Button>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={handleAddNew}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Content
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <SourceFileForm
            key={editingFile?.id || "new"}
            initial={formInitial}
            onSave={handleSave}
            onCancel={handleCancel}
            isSaving={saveMutation.isPending}
          />
        )}

        {sourceFiles.length === 0 && !showForm && (
          <div className="text-center py-8 px-4">
            <FileText className="w-8 h-8 mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              No source files yet. Upload prompts, genre catalogs, style guides, or other reference materials that will be used as context for outline and chapter generation.
            </p>
          </div>
        )}

        {sourceFiles.map(file => (
          <SourceFileItem
            key={file.id}
            file={file}
            onEdit={handleEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        ))}
      </CardContent>
    </Card>
  );
}