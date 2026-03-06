import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, Eye, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FICTION_GENRES = ["Fantasy", "Science Fiction", "Mystery", "Thriller", "Romance", "Horror", "Historical Fiction", "Literary Fiction"];
const NONFICTION_GENRES = ["Biography", "True Crime", "History", "Science", "Self-Help", "Business", "Memoir", "Essay"];

export default function PromptCatalogBrowser({ isOpen, onClose, onSelectPrompt, preselectedGenre, preselectedBookType }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [bookTypeFilter, setBookTypeFilter] = useState("all");
  const [genreFilter, setGenreFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [tagsFilter, setTagsFilter] = useState([]);
  const [sortBy, setSortBy] = useState("relevance");
  const [page, setPage] = useState(1);
  const [previewId, setPreviewId] = useState(null);

  // Load filters from localStorage
  useEffect(() => {
    if (!isOpen) return;
    const saved = localStorage.getItem("promptFilters");
    if (saved) {
      try {
        const filters = JSON.parse(saved);
        if (filters.bookTypeFilter) setBookTypeFilter(filters.bookTypeFilter);
        if (filters.categoryFilter) setCategoryFilter(filters.categoryFilter);
        if (filters.tagsFilter) setTagsFilter(filters.tagsFilter);
        if (filters.sortBy) setSortBy(filters.sortBy);
      } catch (e) {
        console.warn("Failed to load filters from localStorage");
      }
    }
  }, [isOpen]);

  // Pre-select genre if provided
  useEffect(() => {
    if (preselectedGenre && isOpen) {
      setGenreFilter(preselectedGenre);
    }
    if (preselectedBookType && isOpen) {
      setBookTypeFilter(preselectedBookType);
    }
  }, [isOpen, preselectedGenre, preselectedBookType]);

  // Fetch all prompts
  const { data: allPrompts = [] } = useQuery({
    queryKey: ["promptCatalog"],
    queryFn: () => base44.entities.PromptCatalog.list(),
  });

  // Extract unique categories and tags
  const categories = useMemo(() => {
    const map = {};
    allPrompts.forEach(p => {
      if (p.category) {
        map[p.category] = (map[p.category] || 0) + 1;
      }
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [allPrompts]);

  const allTags = useMemo(() => {
    const tagCounts = {};
    allPrompts.forEach(p => {
      if (p.tags && Array.isArray(p.tags)) {
        p.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });
    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [allPrompts]);

  // Filter and search
  const filteredPrompts = useMemo(() => {
    let results = allPrompts;

    // Book type filter
    if (bookTypeFilter !== "all") {
      results = results.filter(p => p.book_type === bookTypeFilter);
    }

    // Genre filter
    if (genreFilter) {
      results = results.filter(p => p.genre === genreFilter);
    }

    // Category filter
    if (categoryFilter !== "all") {
      results = results.filter(p => p.category === categoryFilter);
    }

    // Tags filter (AND logic)
    if (tagsFilter.length > 0) {
      results = results.filter(p => 
        tagsFilter.every(tag => p.tags && p.tags.includes(tag))
      );
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.content?.toLowerCase().includes(q) ||
        (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    // Sort
    if (searchQuery.trim() && sortBy === "relevance") {
      const q = searchQuery.toLowerCase();
      results.sort((a, b) => {
        const aScore = (a.title?.toLowerCase().includes(q) ? 2 : 0) +
                      (a.description?.toLowerCase().includes(q) ? 1 : 0);
        const bScore = (b.title?.toLowerCase().includes(q) ? 2 : 0) +
                      (b.description?.toLowerCase().includes(q) ? 1 : 0);
        return bScore - aScore;
      });
    } else if (sortBy === "a-z") {
      results.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else if (sortBy === "newest") {
      results.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    } else if (sortBy === "longest") {
      results.sort((a, b) => (b.word_count || 0) - (a.word_count || 0));
    } else if (sortBy === "shortest") {
      results.sort((a, b) => (a.word_count || 0) - (b.word_count || 0));
    }

    return results;
  }, [allPrompts, bookTypeFilter, genreFilter, categoryFilter, tagsFilter, searchQuery, sortBy]);

  // Pagination
  const itemsPerPage = 20;
  const totalPages = Math.ceil(filteredPrompts.length / itemsPerPage);
  const paginatedPrompts = filteredPrompts.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleUsePrompt = useCallback((prompt) => {
    // Save filters
    localStorage.setItem("promptFilters", JSON.stringify({
      bookTypeFilter,
      categoryFilter,
      tagsFilter,
      sortBy,
    }));

    onSelectPrompt(prompt);
    onClose();
    toast.success(`Loaded: ${prompt.title}`);
  }, [bookTypeFilter, categoryFilter, tagsFilter, sortBy, onSelectPrompt, onClose]);

  const toggleTag = (tag) => {
    setTagsFilter(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
    setPage(1);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setBookTypeFilter("all");
    setGenreFilter("");
    setCategoryFilter("all");
    setTagsFilter([]);
    setSortBy("relevance");
    setPage(1);
  };

  const getAvailableGenres = () => {
    if (bookTypeFilter === "all") {
      return [...new Set(allPrompts.map(p => p.genre).filter(Boolean))];
    }
    return allPrompts
      .filter(p => p.book_type === bookTypeFilter)
      .map(p => p.genre)
      .filter(Boolean);
  };

  const availableGenres = getAvailableGenres();
  const isFiltered = bookTypeFilter !== "all" || genreFilter || categoryFilter !== "all" || tagsFilter.length > 0 || searchQuery;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Prompt Catalog Browser</DialogTitle>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search prompts by title, keyword, topic..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9 pr-8"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setPage(1);
              }}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={bookTypeFilter} onValueChange={(v) => { setBookTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Book Types</SelectItem>
              <SelectItem value="fiction">Fiction</SelectItem>
              <SelectItem value="nonfiction">Nonfiction</SelectItem>
            </SelectContent>
          </Select>

          {availableGenres.length > 0 && (
            <Select value={genreFilter} onValueChange={(v) => { setGenreFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Genres" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All Genres</SelectItem>
                {availableGenres.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.name} value={c.name}>
                  {c.name} ({c.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="a-z">A-Z</SelectItem>
              <SelectItem value="longest">Longest</SelectItem>
              <SelectItem value="shortest">Shortest</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-sm text-slate-500 ml-auto">
            {filteredPrompts.length} of {allPrompts.length} prompts
          </span>

          {isFiltered && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="text-xs">
              Clear Filters
            </Button>
          )}
        </div>

        {/* Tags Cloud */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                  tagsFilter.includes(tag)
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                )}
              >
                {tag} <span className="text-xs opacity-70">({count})</span>
              </button>
            ))}
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex gap-4 min-h-0">
          {/* Sidebar */}
          <div className="w-48 overflow-y-auto border-r border-slate-200 pr-3 hidden md:block">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-2 text-slate-700">Categories</h4>
                <div className="space-y-1">
                  <button
                    onClick={() => { setCategoryFilter("all"); setPage(1); }}
                    className={cn(
                      "block text-sm w-full text-left px-2 py-1 rounded transition-colors",
                      categoryFilter === "all"
                        ? "bg-indigo-100 text-indigo-900 font-medium"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    All ({allPrompts.length})
                  </button>
                  {categories.map(c => (
                    <button
                      key={c.name}
                      onClick={() => { setCategoryFilter(c.name); setPage(1); }}
                      className={cn(
                        "block text-sm w-full text-left px-2 py-1 rounded transition-colors",
                        categoryFilter === c.name
                          ? "bg-indigo-100 text-indigo-900 font-medium"
                          : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      {c.name} ({c.count})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="flex-1 overflow-y-auto min-w-0">
            {paginatedPrompts.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-center">
                <div>
                  <p className="text-slate-500 font-medium">No prompts found</p>
                  <p className="text-sm text-slate-400 mt-1">Try adjusting your filters or search</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-4">
                {paginatedPrompts.map(prompt => (
                  <div
                    key={prompt.id}
                    className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-all"
                  >
                    <h3 className="font-semibold text-sm text-slate-800 mb-1 line-clamp-2">
                      {prompt.title}
                    </h3>
                    {prompt.category && (
                      <p className="text-xs text-slate-500 mb-2">{prompt.category}</p>
                    )}
                    <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                      {prompt.description}
                    </p>
                    {prompt.tags && prompt.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {prompt.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {prompt.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{prompt.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                    {prompt.word_count && (
                      <p className="text-xs text-slate-400 mb-3">~{prompt.word_count} words</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-8"
                        onClick={() => setPreviewId(previewId === prompt.id ? null : prompt.id)}
                      >
                        <Eye className="w-3 h-3 mr-1" /> Preview
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 text-xs h-8 bg-indigo-600 hover:bg-indigo-700"
                        onClick={() => handleUsePrompt(prompt)}
                      >
                        <Check className="w-3 h-3 mr-1" /> Use
                      </Button>
                    </div>

                    {/* Inline Preview */}
                    {previewId === prompt.id && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-xs text-slate-600 max-h-32 overflow-y-auto whitespace-pre-wrap">
                          {prompt.content}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 pt-2 border-t border-slate-200">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <Button
                key={p}
                variant={page === p ? "default" : "outline"}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  setPage(p);
                  document.querySelector("[role=dialog]")?.querySelector(".flex-1.overflow-y-auto")?.scrollTo(0, 0);
                }}
              >
                {p}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}