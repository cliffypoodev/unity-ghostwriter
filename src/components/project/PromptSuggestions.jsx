import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, ChevronDown, ChevronUp } from "lucide-react";

export default function PromptSuggestions({ bookType, genre, onSelect }) {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["prompt-suggestions", bookType, genre],
    queryFn: async () => {
      const res = await base44.functions.invoke("getPromptSuggestions", { book_type: bookType, genre });
      return res.data?.suggestions || [];
    },
    enabled: !!bookType,
  });

  if (!data?.length && !isLoading) return null;

  const visible = expanded ? data : data?.slice(0, 4);

  return (
    <div className="border border-indigo-100 rounded-xl bg-indigo-50/50 p-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Lightbulb className="w-3.5 h-3.5 text-indigo-500" />
        <span className="text-xs font-semibold text-indigo-700">
          Prompt Catalog Suggestions
          {genre ? ` for ${genre}` : ""}
        </span>
        {isLoading && <span className="text-xs text-slate-400 ml-1">Loading...</span>}
      </div>

      {isLoading ? (
        <div className="space-y-1.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-9 bg-indigo-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            {visible?.map((entry) => (
              <button
                key={entry.id}
                onClick={() => onSelect(entry)}
                className="w-full text-left px-3 py-2 rounded-lg bg-white border border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 group-hover:text-indigo-700 truncate">
                      {entry.series_title}
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{entry.subcategory}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
                    {entry.genre_tags?.slice(0, 2).map(tag => (
                      <Badge key={tag} variant="outline" className="text-[10px] py-0 px-1.5 border-indigo-200 text-indigo-600">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {data?.length > 4 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-xs text-indigo-600 hover:text-indigo-700 h-7"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <><ChevronUp className="w-3 h-3 mr-1" /> Show less</>
              ) : (
                <><ChevronDown className="w-3 h-3 mr-1" /> Show {data.length - 4} more</>
              )}
            </Button>
          )}
        </>
      )}
    </div>
  );
}