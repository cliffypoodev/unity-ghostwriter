import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BookPreview({ projectId }) {
  const [currentPage, setCurrentPage] = useState(0);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => { const p = await base44.entities.Project.filter({ id: projectId }); return p[0]; },
    enabled: !!projectId,
  });

  const { data: specs = [] } = useQuery({
    queryKey: ["spec", projectId],
    queryFn: () => base44.entities.Specification.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", projectId],
    queryFn: () => base44.entities.Chapter.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const spec = specs[0];
  const sortedChapters = [...chapters]
    .filter(c => c.content && c.status === "generated")
    .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

  // Build pages array
  const pages = useMemo(() => {
    const p = [];
    const totalWords = sortedChapters.reduce((sum, c) => sum + (c.word_count || 0), 0);

    // Front cover
    p.push({ type: "cover-front", title: project?.name || "Untitled", genre: spec?.genre });

    // Title page
    p.push({ type: "title", title: project?.name || "Untitled", bookType: spec?.book_type });

    // TOC
    if (sortedChapters.length > 0) {
      p.push({
        type: "toc",
        chapters: sortedChapters.map((c, i) => ({ number: c.chapter_number, title: c.title })),
      });
    }

    // Chapter pages — split long content into ~300-word pages
    for (const ch of sortedChapters) {
      const content = ch.content || "";
      const words = content.split(/\s+/);
      const WORDS_PER_PAGE = 300;
      const numPages = Math.max(1, Math.ceil(words.length / WORDS_PER_PAGE));

      for (let i = 0; i < numPages; i++) {
        const pageWords = words.slice(i * WORDS_PER_PAGE, (i + 1) * WORDS_PER_PAGE);
        p.push({
          type: "chapter",
          chapterNumber: ch.chapter_number,
          chapterTitle: ch.title,
          text: pageWords.join(" "),
          isFirstPage: i === 0,
        });
      }
    }

    // End page
    p.push({ type: "end", totalWords, chapterCount: sortedChapters.length });

    // Back cover
    p.push({ type: "cover-back", description: spec?.topic });

    return p;
  }, [project, spec, sortedChapters]);

  // Chapter boundary indices for "prev ch" / "next ch" navigation
  const chapterStarts = useMemo(() => {
    const starts = [];
    pages.forEach((pg, i) => {
      if (pg.type === "chapter" && pg.isFirstPage) starts.push(i);
    });
    return starts;
  }, [pages]);

  const totalPages = pages.length;
  const page = pages[currentPage] || {};

  const goTo = (n) => setCurrentPage(Math.max(0, Math.min(totalPages - 1, n)));
  const prevChapter = () => {
    const prev = chapterStarts.filter(i => i < currentPage);
    if (prev.length > 0) goTo(prev[prev.length - 1]);
  };
  const nextChapter = () => {
    const next = chapterStarts.find(i => i > currentPage);
    if (next !== undefined) goTo(next);
  };

  return (
    <div className="flex flex-col items-center h-full min-h-[500px] py-4" style={{ background: "var(--pg)" }}>
      {/* Book page */}
      <div
        className="relative mx-auto shadow-xl rounded-sm overflow-hidden"
        style={{
          width: 380,
          height: 520,
          background: "var(--pgAlt)",
          border: "1px solid var(--nb-border)",
        }}
      >
        <div className="p-8 h-full overflow-y-auto" style={{ fontFamily: "Georgia, serif", color: "var(--ink)" }}>
          {page.type === "cover-front" && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <h1 className="text-2xl font-bold mb-3">{page.title}</h1>
              {page.genre && <p className="text-sm italic" style={{ color: "var(--ink2)" }}>{page.genre}</p>}
              <div className="mt-8 w-16 h-0.5 rounded" style={{ background: "var(--accent)" }} />
            </div>
          )}

          {page.type === "title" && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <h1 className="text-xl font-bold mb-2">{page.title}</h1>
              <p className="text-xs italic mb-6" style={{ color: "var(--ink2)" }}>
                {page.bookType === "nonfiction" ? "A Nonfiction Work" : "A Novel"}
              </p>
              <div className="w-12 h-px mt-4" style={{ background: "var(--nb-border)" }} />
            </div>
          )}

          {page.type === "toc" && (
            <div>
              <h2 className="text-lg font-bold mb-4 text-center">Table of Contents</h2>
              <div className="space-y-2">
                {page.chapters.map((ch) => (
                  <div key={ch.number} className="flex items-baseline gap-2 text-sm">
                    <span className="font-semibold" style={{ color: "var(--accent)" }}>{ch.number}.</span>
                    <span>{ch.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {page.type === "chapter" && (
            <div>
              {page.isFirstPage && (
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--accent)" }}>
                    Chapter {page.chapterNumber}
                  </p>
                  <h2 className="text-base font-bold">{page.chapterTitle}</h2>
                  <div className="w-8 h-px mt-2 mb-3" style={{ background: "var(--nb-border)" }} />
                </div>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-line">{page.text}</p>
            </div>
          )}

          {page.type === "end" && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-2xl italic mb-4" style={{ fontFamily: "'Caveat', cursive", color: "var(--ink2)" }}>fin</p>
              <div className="w-12 h-px mb-4" style={{ background: "var(--nb-border)" }} />
              <p className="text-xs" style={{ color: "var(--ink2)" }}>
                {page.chapterCount} chapters · {(page.totalWords || 0).toLocaleString()} words
              </p>
            </div>
          )}

          {page.type === "cover-back" && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              {page.description ? (
                <p className="text-sm leading-relaxed italic" style={{ color: "var(--ink2)" }}>
                  {page.description.length > 400 ? page.description.slice(0, 400) + "…" : page.description}
                </p>
              ) : (
                <p className="text-sm italic" style={{ color: "var(--ink2)" }}>Back Cover</p>
              )}
            </div>
          )}
        </div>

        {/* Page number */}
        <div
          className="absolute bottom-2 left-0 right-0 text-center text-[10px]"
          style={{ color: "var(--ink2)" }}
        >
          {currentPage + 1} / {totalPages}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2 mt-4">
        <Button size="sm" variant="outline" onClick={() => goTo(0)} disabled={currentPage === 0}
          style={{ borderColor: "var(--nb-border)", color: "var(--ink)" }} className="h-7 text-xs">
          <ChevronsLeft className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="outline" onClick={prevChapter}
          style={{ borderColor: "var(--nb-border)", color: "var(--ink)" }} className="h-7 text-xs">
          Prev ch.
        </Button>
        <Button size="sm" variant="outline" onClick={() => goTo(currentPage - 1)} disabled={currentPage === 0}
          style={{ borderColor: "var(--nb-border)", color: "var(--ink)" }} className="h-7 text-xs">
          <ChevronLeft className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => goTo(currentPage + 1)} disabled={currentPage >= totalPages - 1}
          style={{ borderColor: "var(--nb-border)", color: "var(--ink)" }} className="h-7 text-xs">
          <ChevronRight className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="outline" onClick={nextChapter}
          style={{ borderColor: "var(--nb-border)", color: "var(--ink)" }} className="h-7 text-xs">
          Next ch.
        </Button>
        <Button size="sm" variant="outline" onClick={() => goTo(totalPages - 1)} disabled={currentPage >= totalPages - 1}
          style={{ borderColor: "var(--nb-border)", color: "var(--ink)" }} className="h-7 text-xs">
          <ChevronsRight className="w-3 h-3" />
        </Button>
      </div>

      {/* Jump dots */}
      <div className="flex items-center gap-0.5 mt-3 flex-wrap justify-center max-w-[380px]">
        {pages.map((pg, i) => {
          const isChapterStart = pg.type === "chapter" && pg.isFirstPage;
          return (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="transition-all"
              style={{
                width: isChapterStart ? 10 : 5,
                height: 5,
                borderRadius: 2,
                background: i === currentPage ? "var(--accent)" : "var(--nb-border)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}