import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Pencil, BookOpenText, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import StatusBadge from "../StatusBadge";
import EmptyState from "../EmptyState";

export default function ChaptersTab({ projectId }) {
  const queryClient = useQueryClient();
  const [editChapter, setEditChapter] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ["chapters", projectId],
    queryFn: () => base44.entities.Chapter.filter({ project_id: projectId }, "chapter_number"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      const payload = { ...data };
      delete payload.id;
      delete payload.created_date;
      delete payload.updated_date;
      delete payload.created_by;
      if (editChapter?.id) return base44.entities.Chapter.update(editChapter.id, payload);
      return base44.entities.Chapter.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters", projectId] });
      setShowDialog(false);
      setEditChapter(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Chapter.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chapters", projectId] }),
  });

  const openNew = () => {
    setEditChapter({
      project_id: projectId,
      chapter_number: chapters.length + 1,
      title: "",
      summary: "",
      prompt: "",
      content: "",
      word_count: 0,
      status: "pending",
    });
    setShowDialog(true);
  };

  const openEdit = (ch) => {
    setEditChapter({ ...ch });
    setShowDialog(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    createMutation.mutate(editChapter);
  };

  if (isLoading) return <div className="py-12 text-center text-sm text-slate-400">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-slate-500">{chapters.length} chapter{chapters.length !== 1 ? "s" : ""}</p>
        <Button onClick={openNew} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-1.5" /> Add Chapter
        </Button>
      </div>

      {chapters.length === 0 ? (
        <EmptyState
          icon={BookOpenText}
          title="No chapters yet"
          description="Start building your book chapter by chapter."
          action={<Button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4 mr-2" /> Add First Chapter</Button>}
        />
      ) : (
        <div className="space-y-3">
          {chapters.map((ch) => (
            <Card key={ch.id} className="border-slate-200/80">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-indigo-500 bg-indigo-50 rounded-md px-2 py-0.5">
                        Ch. {ch.chapter_number}
                      </span>
                      <h4 className="font-medium text-slate-800 truncate">{ch.title}</h4>
                      <StatusBadge status={ch.status} />
                    </div>
                    {ch.summary && (
                      <p className="text-sm text-slate-500 mt-1.5 line-clamp-2">{ch.summary}</p>
                    )}
                    {ch.word_count > 0 && (
                      <p className="text-xs text-slate-400 mt-1">{ch.word_count.toLocaleString()} words</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    {ch.content && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedId(expandedId === ch.id ? null : ch.id)}>
                        {expandedId === ch.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(ch)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteMutation.mutate(ch.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {expandedId === ch.id && ch.content && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-lg text-sm text-slate-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {ch.content}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={(v) => { setShowDialog(v); if (!v) setEditChapter(null); }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editChapter?.id ? "Edit Chapter" : "New Chapter"}</DialogTitle>
          </DialogHeader>
          {editChapter && (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Chapter Number</Label>
                  <Input type="number" min={1} value={editChapter.chapter_number} onChange={(e) => setEditChapter({ ...editChapter, chapter_number: parseInt(e.target.value) || 1 })} className="mt-1" />
                </div>
                <div>
                  <Label>Title</Label>
                  <Input value={editChapter.title} onChange={(e) => setEditChapter({ ...editChapter, title: e.target.value })} className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Summary</Label>
                <Textarea rows={2} value={editChapter.summary || ""} onChange={(e) => setEditChapter({ ...editChapter, summary: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Prompt</Label>
                <Textarea rows={3} value={editChapter.prompt || ""} onChange={(e) => setEditChapter({ ...editChapter, prompt: e.target.value })} className="mt-1" placeholder="Generation prompt..." />
              </div>
              <div>
                <Label>Content</Label>
                <Textarea rows={8} value={editChapter.content || ""} onChange={(e) => setEditChapter({ ...editChapter, content: e.target.value })} className="mt-1 font-mono text-sm" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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