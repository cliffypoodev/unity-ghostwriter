import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

export default function PromptSuggestions({ bookType, genre, onSelect, onBrowseAll }) {
  const { data: allPrompts = [] } = useQuery({
    queryKey: ["promptCatalog"],
    queryFn: () => base44.entities.PromptCatalog.list(),
  });

  // Get 3-5 random suggestions for the current genre/book_type
  const suggestions = useMemo(() => {
    let filtered = allPrompts;

    if (bookType && bookType !== "all") {
      filtered = filtered.filter(p => p.book_type === bookType);
    }

    if (genre) {
      filtered = filtered.filter(p => p.genre === genre);
    }

    // Shuffle and pick 3-5
    if (filtered.length === 0) return [];

    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(5, filtered.length));
  }, [allPrompts, bookType, genre]);

  if (suggestions.length === 0) return null;

  return (
    <Card className="border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-slate-700">💡 Quick Suggestions</span>
        <span className="text-xs text-slate-500">({suggestions.length})</span>
      </div>

      <div className="space-y-2">
        {suggestions.map(prompt => (
          <div
            key={prompt.id}
            className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all cursor-pointer group"
            onClick={() => onSelect(prompt)}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate group-hover:text-indigo-700">
                {prompt.title}
              </p>
              {prompt.category && (
                <p className="text-xs text-slate-500">{prompt.category}</p>
              )}
              {prompt.tags && prompt.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {prompt.tags.slice(0, 2).map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 flex-shrink-0 mt-0.5" />
          </div>
        ))}
      </div>

      <Button
        onClick={onBrowseAll}
        variant="ghost"
        size="sm"
        className="w-full mt-3 text-xs text-indigo-600 hover:text-indigo-700"
      >
        Browse Full Catalog ({allPrompts.length} prompts) →
      </Button>
    </Card>
  );
}