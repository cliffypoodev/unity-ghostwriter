// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — REVIEW & POLISH (v13 — frontend auto-fix, no backend bot needed)
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Loader2, Wand2, BookOpen, Zap, FileText, Target, BarChart3, Download, AlertTriangle
} from "lucide-react";
import ManuscriptUploader from "./ManuscriptUploader";
import DeepReviewPanel from "./DeepReviewPanel";
import ScoreGauge from "./review/ScoreGauge";
import ChapterReviewCard from "./review/ChapterReviewCard";
import {
  SCAN_CATEGORIES, PATTERNS, scanChapter, computeScore, resolveChapterContent, autoFixChapter
} from "./review/ScanPatterns";

// ── Category summary row ──
function CategoryRow({ category, findings }) {
  const cat = SCAN_CATEGORIES[category];
  if (!cat) return null;
  const totalInstances = findings.reduce((sum, f) => sum + f.count, 0);
  const colorMap = {
    red: "bg-red-100 text-red-700 border-red-200",
    amber: "bg-amber-100 text-amber-700 border-amber-200",
    blue: "bg-blue-100 text-blue-700 border-blue-200",
  };
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/60 border border-[var(--nb-border)]">
      <div className="flex items-center gap-2">
        <span className="text-base">{cat.icon}</span>
        <span className="text-sm" style={{ color: 'var(--ink)' }}>{cat.label}</span>
      </div>
      <Badge className={cn("text-xs border", findings.length === 0 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : colorMap[cat.color])}>
        {findings.length === 0 ? "✓ Clean" : `${totalInstances} instance${totalInstances !== 1 ? "s" : ""}`}
      </Badge>
    </div>
  );
}

// ═══ MAIN COMPONENT ═══

export default function ReviewPolishTab({ projectId }) {
  const [scanResults, setScanResults] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [fixingAll, setFixingAll] = useState(false);
  const [fixProgress, setFixProgress] = useState("");
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
  const targetWords = { short: 2000, medium: 3500, long: 6000, epic: 8500 }[spec?.target_length || "medium"] || 3500;
  const generatedChapters = chapters.filter(c => c.status === "generated").sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

  // ── Full manuscript scan ──
  const handleScan = useCallback(async () => {
    if (generatedChapters.length === 0) return;
    setScanning(true);
    setScanResults(null);

    const chapterData = [];
    const allFindings = [];
    const emptyChapters = [];

    for (const ch of generatedChapters) {
      const content = await resolveChapterContent(ch);
      if (!content || content.length < 50) {
        emptyChapters.push({ number: ch.chapter_number, title: ch.title || `Chapter ${ch.chapter_number}` });
        continue;
      }
      const { findings, words } = scanChapter(content, ch.chapter_number, tense, targetWords);
      allFindings.push(...findings);
      chapterData.push({
        number: ch.chapter_number,
        title: `Chapter ${ch.chapter_number}: ${ch.title || ""}`,
        words,
        chapterId: ch.id,
        findings,
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
      emptyChapters,
      scannedAt: new Date().toISOString(),
    });
    setScanning(false);
  }, [generatedChapters, tense]);

  // ── Called by ChapterReviewCard after a fix/polish completes and re-scans ──
  const handleChapterScanUpdated = useCallback((chapterNum, newFindings, newWords) => {
    setScanResults(prev => {
      if (!prev) return prev;
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
    refetchChapters();
  }, [refetchChapters]);

  // ── Fix All — 3-pass pipeline: backend bot → frontend autoFix → AI rewrite ──
  const handleFixAll = async () => {
    if (!scanResults) return;
    setFixingAll(true);
    const chaptersWithIssues = scanResults.chapterData.filter(cd => cd.findings.length > 0);
    const total = chaptersWithIssues.length;

    for (let i = 0; i < chaptersWithIssues.length; i++) {
      const cd = chaptersWithIssues[i];
      const ch = generatedChapters.find(c => c.chapter_number === cd.number);
      if (!ch) continue;

      setFixProgress(`Pass 1/3: Ch ${cd.number} (${i + 1}/${total}) — style enforcer…`);

      try {
        // ── PASS 1: Backend bot_styleEnforcer ──
        // Handles: banned phrases, interiority word caps (synonym replacement),
        // duplicate paragraphs, instruction leaks, frequency caps, etc.
        const response = await base44.functions.invoke("bot_styleEnforcer", {
          project_id: projectId,
          chapter_id: ch.id,
        });
        const result = response.data || response;
        console.log("[fixAll] Ch", cd.number, "P1 styleEnforcer:", result.violations_found, "found,", result.violations_remaining?.length || 0, "remaining");

        // Re-fetch content after bot save
        let [updatedCh] = await base44.entities.Chapter.filter({ id: ch.id });
        if (!updatedCh) continue;
        let content = await resolveChapterContent(updatedCh);
        if (!content || content.trim().length < 100) continue;

        // ── PASS 2: Frontend autoFixChapter ──
        // Handles: transition crutches, scaffolding, hedging, recap bloat,
        // generic conclusions, repeated openers, coffee scenes, archive framing
        setFixProgress(`Pass 2/3: Ch ${cd.number} (${i + 1}/${total}) — regex cleanup…`);
        const fixedContent = autoFixChapter(content);

        if (fixedContent !== content && fixedContent.length > 0 && fixedContent.length >= content.length * 0.8) {
          console.log("[fixAll] Ch", cd.number, "P2 frontend fix applied");
          const blob = new Blob([fixedContent], { type: "text/plain" });
          const file = new File([blob], `chapter_${ch.id}_fixed.txt`, { type: "text/plain" });
          try {
            const uploadResult = await base44.integrations.Core.UploadFile({ file });
            if (uploadResult?.file_url) {
              await base44.entities.Chapter.update(ch.id, { content: uploadResult.file_url });
            }
          } catch (upErr) {
            console.warn("[fixAll] Ch", cd.number, "P2 upload failed:", upErr.message);
          }
          content = fixedContent;
        }

        // ── INTERMEDIATE SCAN — check what's left ──
        const midScan = scanChapter(content, cd.number, tense, targetWords);

        // ── PASS 3: AI Targeted Rewrite ──
        // Handles: interiority repetition (contextual synonym), sensory opener
        // monotony (rewrite opening), tense drift (fix verbs in context)
        const aiFixableCategories = ['interiority_repetition', 'sensory_opener', 'tense_drift', 'the_noun_opener', 'philosophical_ending', 'fiction_cliche', 'recap_bloat'];
        const aiFindings = midScan.findings.filter(f => aiFixableCategories.includes(f.category));

        if (aiFindings.length > 0) {
          setFixProgress(`Pass 3/3: Ch ${cd.number} (${i + 1}/${total}) — AI rewrite (${aiFindings.length} issues)…`);
          try {
            const rwResponse = await base44.functions.invoke("bot_targetedRewrite", {
              project_id: projectId,
              chapter_id: ch.id,
              findings: aiFindings,
            });
            const rwResult = rwResponse.data || rwResponse;
            console.log("[fixAll] Ch", cd.number, "P3 AI rewrite:", rwResult.rewritten ? `${rwResult.tasks} tasks, ${rwResult.paragraphs_affected} paras` : rwResult.reason || "skipped");

            // Re-fetch after AI rewrite
            if (rwResult.rewritten) {
              [updatedCh] = await base44.entities.Chapter.filter({ id: ch.id });
              if (updatedCh) content = await resolveChapterContent(updatedCh);
            }
          } catch (rwErr) {
            console.warn("[fixAll] Ch", cd.number, "P3 AI rewrite error:", rwErr.message);
          }
        }

        // ── FINAL SCAN — update UI ──
        const { findings, words } = scanChapter(content, cd.number, tense, targetWords);
        handleChapterScanUpdated(cd.number, findings, words);
        console.log("[fixAll] Ch", cd.number, "final issues:", findings.length);
      } catch (err) {
        console.warn("[fixAll] Ch", cd.number, "error:", err.message);
      }
    }

    setFixProgress("");
    setFixingAll(false);
    refetchChapters();
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
    <div className="p-4 sm:p-6 space-y-6" style={{ color: 'var(--ink)' }}>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>Manuscript Scanner & Polisher</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ink2)' }}>{generatedChapters.length} chapter{generatedChapters.length !== 1 ? "s" : ""} ready for review</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={handleScan} disabled={scanning || generatedChapters.length === 0} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
            {scanning ? "Scanning…" : scanResults ? "Re-Scan" : "Scan Manuscript"}
          </Button>
          {scanResults && totalIssues > 0 && (
            <Button onClick={handleFixAll} disabled={fixingAll || scanning} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
              {fixingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {fixingAll ? fixProgress || "Fixing…" : "Fix All"}
            </Button>
          )}
          {scanResults && (
            <Button onClick={handleExport} variant="outline" className="gap-2 border-emerald-600/40 text-emerald-700 hover:bg-emerald-50">
              <Download className="w-4 h-4" /> Export
            </Button>
          )}
        </div>
      </div>

      {/* ── Upload section ── */}
      <div className="rounded-xl border border-[var(--nb-border)] bg-white/50 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>External Manuscript</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink2)' }}>Upload a .txt, .md, .docx, or .pdf to review</p>
          </div>
          <ManuscriptUploader onTextLoaded={(text, name) => { setUploadedText(text); setUploadedFileName(name); }} />
        </div>
        {uploadedText && (
          <div className="rounded-lg border border-[var(--nb-border)] bg-white/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--ink2)' }}>
                <FileText className="w-3 h-3" />
                {uploadedFileName || "Uploaded"} · {uploadedText.trim().split(/\s+/).length.toLocaleString()} words
              </span>
              <button onClick={() => { setUploadedText(""); setUploadedFileName(null); }} className="text-xs hover:underline" style={{ color: 'var(--ink2)' }}>Clear</button>
            </div>
            <div className="max-h-32 overflow-y-auto text-xs font-mono whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--ink2)' }}>
              {uploadedText.slice(0, 2000)}{uploadedText.length > 2000 ? "…" : ""}
            </div>
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {generatedChapters.length === 0 && !scanning && !uploadedText && (
        <div className="flex items-center justify-center py-20 text-center">
          <div>
            <BookOpen className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--ink2)' }} />
            <p className="font-medium" style={{ color: 'var(--ink)' }}>No generated chapters yet</p>
            <p className="text-sm mt-1" style={{ color: 'var(--ink2)' }}>Generate chapters in the Write tab first</p>
          </div>
        </div>
      )}

      {/* ── Scanning spinner ── */}
      {scanning && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-16 h-16 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
          <p className="font-medium" style={{ color: 'var(--ink)' }}>Scanning {generatedChapters.length} chapters…</p>
          <p className="text-xs" style={{ color: 'var(--ink2)' }}>Checking duplicates, leaks, tense drift, repetition, clichés…</p>
        </div>
      )}

      {/* ── Results ── */}
      {scanResults && !scanning && (
        <>
          {/* Score + category summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="rounded-xl border border-[var(--nb-border)] bg-white/50 p-6 flex flex-col items-center justify-center">
              <ScoreGauge score={scanResults.score} />
              <div className="mt-3 text-center">
                <p className="text-xs" style={{ color: 'var(--ink2)' }}>{scanResults.totalWords.toLocaleString()} words · {scanResults.totalChapters} chapter{scanResults.totalChapters !== 1 ? "s" : ""} scanned</p>
                {scanResults.emptyChapters?.length > 0 && (
                  <p className="text-xs mt-0.5 text-amber-600 font-medium">{scanResults.emptyChapters.length} chapter{scanResults.emptyChapters.length !== 1 ? "s" : ""} empty — not included</p>
                )}
                <p className="text-xs mt-0.5" style={{ color: 'var(--ink2)' }}>Scanned {new Date(scanResults.scannedAt).toLocaleTimeString()}</p>
              </div>
            </div>
            <div className="lg:col-span-2 rounded-xl border border-[var(--nb-border)] bg-white/50 p-5">
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink)' }}>Scanner Results</h3>
              <div className="space-y-1.5">
                {Object.keys(SCAN_CATEGORIES).map(key => (
                  <CategoryRow key={key} category={key} findings={scanResults.allFindings.filter(f => f.category === key)} />
                ))}
              </div>
              {leakCount > 0 && (
                <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-xs text-red-700 font-medium">🚨 {leakCount} instruction leak{leakCount !== 1 ? "s" : ""} detected — use Fix All or fix individual chapters.</p>
                </div>
              )}
              {scanResults.openerRatio > 0.5 && (
                <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-xs text-amber-700 font-medium">👁 {Math.round(scanResults.openerRatio * 100)}% of chapters open with sensory atmosphere. Vary with dialogue, action, or thought openers.</p>
                </div>
              )}
              {scanResults.emptyChapters?.length > 0 && (
                <div className="mt-2 p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-red-700 font-semibold">
                        {scanResults.emptyChapters.length} chapter{scanResults.emptyChapters.length !== 1 ? "s have" : " has"} no content (marked generated but empty):
                      </p>
                      <ul className="text-xs text-red-600 mt-1 space-y-0.5">
                        {scanResults.emptyChapters.map(ec => (
                          <li key={ec.number}>Ch {ec.number}: {ec.title} — go to Write tab to regenerate</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chapter cards */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
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