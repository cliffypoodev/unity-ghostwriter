import React from "react";
import { ArrowRight, Copy, Trash2, BookOpen, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "../StatusBadge";
import moment from "moment";

export default function HomeProjectPreview({ project, spec, chapterCount, onOpen, onDelete, deleting }) {
  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-center" style={{ color: "var(--ink2)" }}>
        <ArrowRight className="w-8 h-8 mb-3 opacity-30" />
        <p className="text-sm">Select a project to preview</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-1">
      <div className="mb-3">
        <h2 className="text-lg font-bold mb-1" style={{ color: "var(--ink)", fontFamily: "'Caveat', cursive" }}>
          {project.name}
        </h2>
        <StatusBadge status={project.status} />
      </div>

      <div className="space-y-2 text-xs mb-6" style={{ color: "var(--ink2)" }}>
        {spec?.genre && (
          <div><span className="font-medium" style={{ color: "var(--ink)" }}>Genre:</span> {spec.genre}{spec.subgenre ? ` / ${spec.subgenre}` : ''}</div>
        )}
        {spec?.target_audience && (
          <div><span className="font-medium" style={{ color: "var(--ink)" }}>Audience:</span> {spec.target_audience}</div>
        )}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3 h-3" style={{ color: "var(--accent)" }} />
            {chapterCount} chapters generated
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {moment(project.updated_date).fromNow()}
          </span>
        </div>
        {spec?.topic && (
          <div className="mt-2 p-2 rounded-lg text-xs leading-relaxed" style={{ background: "var(--pg)", border: "1px solid var(--nb-border)" }}>
            {spec.topic.length > 200 ? spec.topic.slice(0, 200) + '…' : spec.topic}
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-auto">
        <Button
          onClick={onOpen}
          className="flex-1 text-xs h-8"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          <ArrowRight className="w-3.5 h-3.5 mr-1" /> Open
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          style={{ borderColor: "var(--nb-border)", color: "var(--ink2)" }}
          onClick={onDelete}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}