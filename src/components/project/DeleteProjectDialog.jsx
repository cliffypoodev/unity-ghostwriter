import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

// 3-step confirmation dialog for project deletion
export default function DeleteProjectDialog({ projectName, onConfirm, deleting }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [typedName, setTypedName] = useState("");

  const handleOpen = () => {
    setStep(1);
    setTypedName("");
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setStep(1);
    setTypedName("");
  };

  const handleStep2 = () => setStep(2);
  const handleStep3 = () => setStep(3);

  const handleConfirm = async () => {
    await onConfirm();
    handleClose();
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 flex-shrink-0"
        onClick={handleOpen}
      >
        <Trash2 className="w-4 h-4 mr-1.5" /> Delete
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Delete Project
            </DialogTitle>
          </DialogHeader>

          {step === 1 && (
            <>
              <DialogDescription className="text-slate-600 leading-relaxed">
                You are about to permanently delete <strong>"{projectName}"</strong> and all associated data including chapters, outlines, and source files. This action <strong>cannot be undone</strong>.
              </DialogDescription>
              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                <Button variant="destructive" onClick={handleStep2}>
                  Yes, I want to delete this project
                </Button>
              </DialogFooter>
            </>
          )}

          {step === 2 && (
            <>
              <DialogDescription className="text-slate-600 leading-relaxed">
                Are you absolutely sure? All chapters, outlines, story bibles, and source files for <strong>"{projectName}"</strong> will be lost forever.
              </DialogDescription>
              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                <Button variant="destructive" onClick={handleStep3}>
                  I understand, continue
                </Button>
              </DialogFooter>
            </>
          )}

          {step === 3 && (
            <>
              <DialogDescription className="text-slate-600 leading-relaxed">
                Final confirmation: type the project name <strong>"{projectName}"</strong> below to permanently delete it.
              </DialogDescription>
              <Input
                placeholder={`Type "${projectName}" to confirm`}
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                className="mt-2"
              />
              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                <Button
                  variant="destructive"
                  disabled={typedName !== projectName || deleting}
                  onClick={handleConfirm}
                >
                  {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Delete Forever
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}