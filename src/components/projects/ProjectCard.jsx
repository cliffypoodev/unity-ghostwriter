import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Clock } from "lucide-react";
import StatusBadge from "../StatusBadge";
import moment from "moment";

export default function ProjectCard({ project }) {
  return (
    <Link to={createPageUrl("ProjectDetail") + `?id=${project.id}`}>
      <Card className="group hover:shadow-lg hover:shadow-indigo-100/50 transition-all duration-300 border-slate-200/80 hover:border-indigo-200 cursor-pointer overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors truncate text-base">
                {project.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-400">
                <Clock className="w-3 h-3" />
                <span>{moment(project.created_date).fromNow()}</span>
              </div>
            </div>
            <StatusBadge status={project.status} />
          </div>
          <div className="flex items-center justify-end">
            <span className="text-xs text-indigo-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              Open project <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}