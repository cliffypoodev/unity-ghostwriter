import React from "react";
import { BookOpenText, Clock, Folder } from "lucide-react";
import StatusBadge from "../StatusBadge";
import moment from "moment";
import ScribbleCircle from "./ScribbleCircle";

const BEAT_STYLE_NAMES = {
  "fast-paced-thriller": "Thriller", "gritty-cinematic": "Cinematic",
  "hollywood-blockbuster": "Blockbuster", "slow-burn": "Slow Burn",
  "clean-romance": "Clean Romance", "faith-infused": "Faith",
  "investigative-nonfiction": "Investigative", "reference-educational": "Educational",
  "intellectual-psychological": "Psychological", "dark-suspense": "Dark Suspense",
  "satirical": "Satirical", "epic-historical": "Epic Historical",
  "whimsical-cozy": "Cozy", "hard-boiled-noir": "Noir",
  "grandiose-space-opera": "Space Opera", "visceral-horror": "Horror",
  "poetic-magical-realism": "Magical Realism", "clinical-procedural": "Procedural",
  "hyper-stylized-action": "Action", "nostalgic-coming-of-age": "Coming-of-Age",
  "cerebral-sci-fi": "Sci-Fi", "high-stakes-political": "Political",
  "surrealist-avant-garde": "Surrealist", "melancholic-literary": "Literary",
  "urban-gritty-fantasy": "Urban Fantasy",
  "steamy-romance": "Steamy Romance", "slow-burn-romance": "Slow Burn Romance",
  "dark-erotica": "Dark Erotica",
};

export default function HomeProjectCard({ project, spec, chapterCount, isSelected, onClick }) {
  const beatKey = spec?.beat_style || spec?.tone_style;
  const beatName = beatKey && BEAT_STYLE_NAMES[beatKey];

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-3 border transition-all duration-200 hover:shadow-sm group"
      style={{
        background: isSelected ? "var(--pgAlt)" : "transparent",
        borderColor: isSelected ? "var(--accent)" : "var(--nb-border)",
        color: "var(--ink)",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <ScribbleCircle active={isSelected}>
          <span className="font-semibold text-sm leading-snug truncate block max-w-[200px]">
            {project.name}
          </span>
        </ScribbleCircle>
        <StatusBadge status={project.status} />
      </div>
      <div className="flex items-center gap-2 text-xs flex-wrap" style={{ color: "var(--ink2)" }}>
        <span className="flex items-center gap-1">
          <BookOpenText className="w-3 h-3" style={{ color: "var(--accent)" }} />
          {chapterCount} ch
        </span>
        {project.folder && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: "var(--nb-border)", color: "var(--ink2)" }}>
            <Folder className="w-2.5 h-2.5" /> {project.folder}
          </span>
        )}
        {beatName && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{ background: "var(--accent)", color: "#fff" }}>
            {beatName}
          </span>
        )}
        <span className="flex items-center gap-1 ml-auto">
          <Clock className="w-2.5 h-2.5" />
          {moment(project.updated_date).fromNow()}
        </span>
      </div>
    </button>
  );
}