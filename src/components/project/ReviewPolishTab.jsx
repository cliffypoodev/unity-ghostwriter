// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — REVIEW & POLISH (v12 — cohesive inline fix/rescan flow)
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Loader2, Wand2, BookOpen, Zap, FileText, Target, BarChart3, Download
} from "lucide-react";
import ManuscriptUploader from "./ManuscriptUploader";
import DeepReviewPanel from "./DeepReviewPanel";
import ScoreGauge from "./review/ScoreGauge";
import ChapterReviewCard from "./review/ChapterReviewCard";
import {
  SCAN_CATEGORIES, PATTERNS, scanChapter, computeScore, resolveChapterContent
} from "./review/ScanPatterns";

// ── Category summary row ──
function CategoryRow({ category, findings }) {
  const cat = SCAN_CATEGORIES[category];
  if (!cat) return null;
  const totalInstances = findings.reduce((sum, f) => sum + f.count, 0);
  const colorMap = {
    red: "bg-red-500/20 text-red-400 border-red-500/30",
    amber: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/50">
      <div className="flex items-center gap-2">
        <span className="text-base">{cat.icon}</span>
        <span className="text-sm text-slate-200">{cat.label}</span>
      </div>
      <Badge className={cn("text-xs border", findings.length === 0 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : colorMap[cat.color])}>
        {findings.length === 0 ? "✓ Clean" : `${totalInstances} instance${totalInstances !== 1 ? "s" : ""}`}
      </Badge>
    </div>
  );
}

// ═══ MAIN COMPONENT ═══

export default function ReviewPolishTab({ projectId }) {
  // scanResults shape: { score, allFindings, chapterData: [{number, title, words, chapterId, findings}], ... }
  const [scanResults, setScanResults] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [fixingAll, setFixingAll] = useState(false);
  const [uploadedText, setUploadedText] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState(null);

  const { data: chapters = [], refetch: refetchChapters } = useQuery({
    queryKey: ["chapters", projectId],
    queryFn: () => base44.entities.Chapter.filter({ project_id: projectId }),
    enabled: !!projectId,
  });
  const { data: specs = [] } = useQuery({
    queryKey: ["specifications", projectId],
    queryFn: () => base44.entities.Specification.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const spec = specs[0];
  const tense = spec?.tense || "";
  const targetWords = { short: 2500, medium: 2500, long: 2800, epic: 3000 }[spec?.target_length || "medium"] || 2500;
  const generatedChapters = chapters.filter(c => c.status === "generated").sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

  // ── Full manuscript scan ──
  const handleScan = useCallback(async () => {
    if (generatedChapters.length === 0) return;
    setScanning(true);
    setScanResults(null);

    const chapterData = [];
    const allFindings = [];

    for (const ch of generatedChapters) {
      const content = await resolveChapterContent(ch);
      if (!content || content.length < 50) continue;
      const { findings, words } = scanChapter(content, ch.chapter_number, tense);
      allFindings.push(...findings);
      chapterData.push({
        number: ch.chapter_number,
        title: `Chapter ${ch.chapter_number}: ${ch.title || ""}`,
        words,
        chapterId: ch.id,
        findings, // per-chapter findings stored here
      });
    }

    // Manuscript-wide interiority checks
    const fullText = await Promise.all(
      generatedChapters.map(ch => resolveChapterContent(ch))
    ).then(texts => texts.join("\n\n"));

    for (const [rx, label, manuscriptCap] of PATTERNS.interiority_repetition) {
      const m = fullText.match(rx);
      const manuscriptMax = manuscriptCap * Math.max(1, Math.floor(chapterData.length / 5));
      if (m && m.length > manuscriptMax) {
        allFindings.push({ category: "interiority_repetition", label: `MANUSCRIPT-WIDE: "${label}" x${m.length} (max ~${manuscriptMax})`, count: m.length - manuscriptMax, chapter: 0 });
      }
    }

    const sensoryOpeners = allFindings.filter(f => f.category === "sensory_opener").length;
    const openerRatio = chapterData.length > 0 ? sensoryOpeners / chapterData.length : 0;
    const score = computeScore(allFindings);

    setScanResults({
      score, allFindings, chapterData,
      totalWords: chapterData.reduce((sum, c) => sum + c.words, 0),
      totalChapters: chapterData.length, openerRatio,
      scannedAt: new Date().toISOString(),
    });
    setScanning(false);
  }, [generatedChapters, tense]);

  // ── Called by ChapterReviewCard after a fix/polish completes and re-scans ──
  const handleChapterScanUpdated = useCallback((chapterNum, newFindings, newWords) => {
    setScanResults(prev => {
      if (!prev) return prev;
      // Replace findings for this chapter and recompute
      const otherFindings = prev.allFindings.filter(f => f.chapter !== chapterNum);
      const updatedAllFindings = [...otherFindings, ...newFindings];
      const updatedChapterData = prev.chapterData.map(cd =>
        cd.number === chapterNum ? { ...cd, findings: newFindings, words: newWords } : cd
      );
      const score = computeScore(updatedAllFindings);
      return {
        ...prev,
        score,
        allFindings: updatedAllFindings,
        chapterData: updatedChapterData,
        totalWords: updatedChapterData.reduce((sum, c) => sum + c.words, 0),
        scannedAt: new Date().toISOString(),
      };
    });
    // Also refresh the React Query cache so future scans have fresh data
    refetchChapters();
  }, [refetchChapters]);

  // ── Fix All — sequential style enforcer on all chapters with issues ──
  const handleFixAll = async () => {
    if (!scanResults) return;
    setFixingAll(true);
    const chaptersWithIssues = scanResults.chapterData.filter(cd => cd.findings.length > 0);

    for (const cd of chaptersWithIssues) {
      const ch = generatedChapters.find(c => c.chapter_number === cd.number);
      if (!ch) continue;
      try {
        await base44.functions.invoke("bot_styleEnforcer", {
          project_id: projectId,
          chapter_id: ch.id,
        });
        // Re-fetch and re-scan this chapter
        const [refreshed] = await base44.entities.Chapter.filter({ id: ch.id });
        if (refreshed) {
          const content = await resolveChapterContent(refreshed);
          if (content && content.length >= 50) {
            const { findings, words } = scanChapter(content, cd.number, tense);
            handleChapterScanUpdated(cd.number, findings, words);
          }
        }
      } catch (err) {
        console.warn(`Fix all: Ch ${cd.number} error:`, err.message);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    setFixingAll(false);
  };

  // ── Export scan results ──
  const handleExport = () => {
    if (!scanResults) return;
    const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const lines = [`═══ MANUSCRIPT SCAN REPORT ═══`, `Generated: ${new Date().toLocaleString()}`, `Score: ${scanResults.score}/100`, `Chapters: ${scanResults.totalChapters}`, `Total issues: ${scanResults.allFindings.reduce((s, f) => s + f.count, 0)}`, ""];
    const catCounts = {};
    for (const f of scanResults.allFindings) {
      const k = f.category || "unknown";
      if (!catCounts[k]) catCounts[k] = 0;
      catCounts[k] += f.count;
    }
    for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
      const info = SCAN_CATEGORIES[cat];
      lines.push(`  ${info?.icon || "•"} ${info?.label || cat}: ${count}`);
    }
    lines.push("");
    for (const cd of scanResults.chapterData) {
      lines.push(`── Ch ${cd.number}: ${cd.title} (${cd.words} words) ──`);
      if (cd.findings.length === 0) { lines.push("   ✓ Clean"); } 
      else {
        for (const f of cd.findings) {
          const info = SCAN_CATEGORIES[f.category];
          lines.push(`   ${info?.icon || "•"} ${info?.label || f.category}: ${f.label} (${f.count}×)`);
          if (f.samples) f.samples.forEach(s => lines.push(`      → "${s.slice(0, 120)}"`));
        }
      }
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `scan-report-${now}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const leakCount = scanResults ? scanResults.allFindings.filter(f => f.category === "instruction_leak").reduce((s, f) => s + f.count, 0) : 0;
  const totalIssues = scanResults ? scanResults.allFindings.reduce((s, f) => s + f.count, 0) : 0;

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Manuscript Scanner & Polisher</h2>
          <p className="text-sm text-slate-400 mt-0.5">{generatedChapters.length} chapter{generatedChapters.length !== 1 ? "s" : ""} ready for review</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={handleScan} disabled={scanning || generatedChapters.length === 0} className="bg-violet-600 hover:bg-violet-700 gap-2">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
            {scanning ? "Scanning…" : scanResults ? "Re-Scan" : "Scan Manuscript"}
          </Button>
          {scanResults && totalIssues > 0 && (
            <Button onClick={handleFixAll} disabled={fixingAll || scanning} className="bg-amber-600 hover:bg-amber-700 gap-2">
              {fixingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {fixingAll ? "Fixing…" : "Fix All"}
            </Button>
          )}
          {scanResults && (
            <Button onClick={handleExport} variant="outline" className="gap-2 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10">
              <Download className="w-4 h-4" /> Export
            </Button>
          )}
        </div>
      </div>

      {/* ── Upload section ── */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium text-slate-300">External Manuscript</p>
            <p className="text-xs text-slate-500 mt-0.5">Upload a .txt, .md, .docx, or .pdf to review</p>
          </div>
          <ManuscriptUploader onTextLoaded={(text, name) => { setUploadedText(text); setUploadedFileName(name); }} />
        </div>
        {uploadedText && (
          <div className="rounded-lg border border-slate-600 bg-slate-900/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3 h-3" />
                {uploadedFileName || "Uploaded"} · {uploadedText.trim().split(/\s+/).length.toLocaleString()} words
              </span>
              <button onClick={() => { setUploadedText(""); setUploadedFileName(null); }} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
            </div>
            <div className="max-h-32 overflow-y-auto text-xs text-slate-500 font-mono whitespace-pre-wrap leading-relaxed">
              {uploadedText.slice(0, 2000)}{uploadedText.length > 2000 ? "…" : ""}
            </div>
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {generatedChapters.length === 0 && !scanning && !uploadedText && (
        <div className="flex items-center justify-center py-20 text-center">
          <div>
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No generated chapters yet</p>
            <p className="text-sm text-slate-500 mt-1">Generate chapters in the Write tab first</p>
          </div>
        </div>
      )}

      {/* ── Scanning spinner ── */}
      {scanning && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-16 h-16 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
          <p className="text-slate-300 font-medium">Scanning {generatedChapters.length} chapters…</p>
          <p className="text-xs text-slate-500">Checking instruction leaks, tense drift, repetition, clichés…</p>
        </div>
      )}

      {/* ── Results ── */}
      {scanResults && !scanning && (
        <>
          {/* Score + category summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-6 flex flex-col items-center justify-center">
              <ScoreGauge score={scanResults.score} />
              <div className="mt-3 text-center">
                <p className="text-xs text-slate-500">{scanResults.totalWords.toLocaleString()} words · {scanResults.totalChapters} chapters</p>
                <p className="text-xs text-slate-500 mt-0.5">Scanned {new Date(scanResults.scannedAt).toLocaleTimeString()}</p>
              </div>
            </div>
            <div className="lg:col-span-2 rounded-xl border border-slate-700 bg-slate-800/60 p-5">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">Scanner Results</h3>
              <div className="space-y-1.5">
                {Object.keys(SCAN_CATEGORIES).map(key => (
                  <CategoryRow key={key} category={key} findings={scanResults.allFindings.filter(f => f.category === key)} />
                ))}
              </div>
              {leakCount > 0 && (
                <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-xs text-red-400 font-medium">🚨 {leakCount} instruction leak{leakCount !== 1 ? "s" : ""} detected — regenerate affected chapters or use Fix Issues.</p>
                </div>
              )}
              {scanResults.openerRatio > 0.5 && (
                <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-xs text-amber-400 font-medium">👁 {Math.round(scanResults.openerRatio * 100)}% of chapters open with sensory atmosphere. Vary with dialogue, action, or thought openers.</p>
                </div>
              )}
            </div>
          </div>

          {/* Chapter cards — each is self-contained with fix/polish/rescan */}
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Chapter Breakdown
            </h3>
            <div className="space-y-2">
              {scanResults.chapterData.map(cd => {
                const chapterEntity = generatedChapters.find(c => c.chapter_number === cd.number);
                if (!chapterEntity) return null;
                return (
                  <ChapterReviewCard
                    key={cd.number}
                    chapterEntity={chapterEntity}
                    findings={cd.findings}
                    words={cd.words}
                    targetWords={targetWords}
                    tense={tense}
                    onScanUpdated={handleChapterScanUpdated}
                    projectId={projectId}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Deep Continuity Review */}
      {generatedChapters.length > 0 && (
        <DeepReviewPanel projectId={projectId} chapters={chapters} specs={specs} />
      )}
    </div>
  );
}