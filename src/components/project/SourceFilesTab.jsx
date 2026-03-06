import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Pencil, File, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import EmptyState from "../EmptyState";

const FILE_TYPES = [
  { value: "text", label: "Text" },
  { value: "prompt", label: "Prompt" },
  { value: "genre_catalog", label: "Genre Catalog" },
  { value: "style_guide", label: "Style Guide" },
  { value: "reference", label: "Reference" },
];

export default function SourceFilesTab({ projectId }) {
  const queryClient = useQueryClient();
  const [editFile, setEditFile] = useState(null);
  const [showDialog, setShowDialog] = useState(false);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["sourcefiles", projectId],
    queryFn: () => base44.entities.SourceFile.filter({ project_id: projectId }, "-created_date"),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const payload = { ...data };
      delete payload.id;
      delete payload.created_date;
      delete payload.updated_date;
      delete payload.created_by;
      if (editFile?.id) return base44.entities.SourceFile.update(editFile.id, payload);
      return base44.entities.SourceFile.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sourcefiles", projectId] });
      setShowDialog(false);
      setEditFile(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SourceFile.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sourcefiles", projectId] }),
  });

  const openNew = () => {
    setEditFile({ project_id: projectId, filename: "", file_type: "text", content: "", description: "" });
    setShowDialog(true);
  };

  const openEdit = (f) => {
    setEditFile({ ...f });
    setShowDialog(true);
  };

  if (isLoading) return <div className="py-12 text-center text-sm text-slate-400">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-slate-500">{files.length} file{files.length !== 1 ? "s" : ""}</p>
        <Button onClick={openNew} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-1.5" /> Add File
        </Button>
      </div>

      {files.length === 0 ? (
        <EmptyState
          icon={File}
          title="No source files"
          description="Upload prompts, style guides, references, and more."
          action={<Button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4 mr-2" /> Add File</Button>}
        />
      ) : (
        <div className="space-y-3">
          {files.map((f) => (
            <Card key={f.id} className="border-slate-200/80">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <File className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <h4 className="font-medium text-slate-800 truncate">{f.filename}</h4>
                    <Badge variant="outline" className="text-xs">{FILE_TYPES.find((t) => t.value === f.file_type)?.label || f.file_type}</Badge>
                  </div>
                  {f.description && <p className="text-sm text-slate-500 mt-1 ml-6.5 line-clamp-1">{f.description}</p>}
                </div>
                <div className="flex items-center gap-1 ml-3">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(f)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteMutation.mutate(f.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={(v) => { setShowDialog(v); if (!v) setEditFile(null); }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editFile?.id ? "Edit File" : "New Source File"}</DialogTitle>
          </DialogHeader>
          {editFile && (
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(editFile); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Filename</Label>
                  <Input value={editFile.filename} onChange={(e) => setEditFile({ ...editFile, filename: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>File Type</Label>
                  <Select value={editFile.file_type} onValueChange={(v) => setEditFile({ ...editFile, file_type: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FILE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input value={editFile.description || ""} onChange={(e) => setEditFile({ ...editFile, description: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Content</Label>
                <Textarea rows={10} value={editFile.content || ""} onChange={(e) => setEditFile({ ...editFile, content: e.target.value })} className="mt-1 font-mono text-sm" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={saveMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                  {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}