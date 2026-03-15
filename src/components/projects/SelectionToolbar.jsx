import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Download, X, Loader2, CheckSquare } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function SelectionToolbar({ selectedIds, projects, onClearSelection, onDeleteComplete }) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const count = selectedIds.size;
  const selectedProjects = projects.filter(p => selectedIds.has(p.id));

  const handleBulkDelete = async () => {
    setDeleting(true);
    try {
      for (const id of selectedIds) {
        await base44.functions.invoke('deleteProject', { project_id: id });
      }
      toast.success(`${count} project${count > 1 ? 's' : ''} deleted`);
      onDeleteComplete();
    } catch (err) {
      toast.error('Delete failed: ' + err.message);
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      for (const proj of selectedProjects) {
        const res = await base44.functions.invoke('exportProject', {
          project_id: proj.id,
          format,
        });

        const safeName = (proj.name || 'Untitled').replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'book';

        if (format === 'docx') {
          const { base64, filename } = res.data;
          const byteChars = atob(base64);
          const byteArray = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
          const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
          downloadBlob(blob, filename || `${safeName}.docx`);
        } else {
          const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
          const ext = format === 'md' || format === 'markdown' ? 'md' : 'txt';
          const blob = new Blob([text], { type: 'text/plain' });
          downloadBlob(blob, `${safeName}.${ext}`);
        }
      }
      toast.success(`${count} project${count > 1 ? 's' : ''} exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="sticky top-16 z-40 bg-indigo-600 text-white rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg mb-4 animate-in slide-in-from-top-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CheckSquare className="w-4 h-4" />
          {count} selected
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="secondary"
                disabled={exporting}
                className="h-8 bg-white/20 hover:bg-white/30 text-white border-0"
              >
                {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('txt')}>Plain Text (.txt)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('md')}>Markdown (.md)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('docx')}>Word (.docx)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={deleting}
            className="h-8 bg-red-500/80 hover:bg-red-500 text-white border-0"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
            Delete
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
            className="h-8 text-white/80 hover:text-white hover:bg-white/10"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {count} Project{count > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the following project{count > 1 ? 's' : ''} and all their data (chapters, outlines, conversations):
              <ul className="mt-2 space-y-1 text-slate-700 font-medium">
                {selectedProjects.map(p => (
                  <li key={p.id} className="text-sm">• {p.name}</li>
                ))}
              </ul>
              <span className="block mt-2 text-red-600 font-medium">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting…</> : `Delete ${count} Project${count > 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}