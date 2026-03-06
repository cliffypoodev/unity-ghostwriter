import React, { useEffect, useRef, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Settings, Search, Copy, FileText, Code, Printer, Maximize2, Minimize2,
  ZoomIn, ZoomOut, Loader2, Check, ChevronDown
} from "lucide-react";

// ── Quill loader ──────────────────────────────────────────────────────────────

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}
function loadStyle(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const l = document.createElement("link");
  l.rel = "stylesheet"; l.href = href;
  document.head.appendChild(l);
}

const FONTS = [
  { label: "Georgia", value: "georgia" },
  { label: "Times New Roman", value: "times-new-roman" },
  { label: "Garamond", value: "garamond" },
  { label: "Palatino", value: "palatino" },
  { label: "Baskerville", value: "baskerville" },
  { label: "Arial", value: "arial" },
  { label: "Helvetica", value: "helvetica" },
  { label: "Verdana", value: "verdana" },
  { label: "Trebuchet MS", value: "trebuchet-ms" },
  { label: "Calibri", value: "calibri" },
  { label: "Courier New", value: "courier-new" },
  { label: "Consolas", value: "consolas" },
];

const FONT_CSS = `
.ql-font-georgia { font-family: Georgia, serif; }
.ql-font-times-new-roman { font-family: "Times New Roman", Times, serif; }
.ql-font-garamond { font-family: Garamond, "EB Garamond", serif; }
.ql-font-palatino { font-family: Palatino, "Palatino Linotype", serif; }
.ql-font-baskerville { font-family: Baskerville, "Baskerville Old Face", serif; }
.ql-font-arial { font-family: Arial, sans-serif; }
.ql-font-helvetica { font-family: Helvetica, Arial, sans-serif; }
.ql-font-verdana { font-family: Verdana, Geneva, sans-serif; }
.ql-font-trebuchet-ms { font-family: "Trebuchet MS", Helvetica, sans-serif; }
.ql-font-calibri { font-family: Calibri, Candara, sans-serif; }
.ql-font-courier-new { font-family: "Courier New", Courier, monospace; }
.ql-font-consolas { font-family: Consolas, "Courier New", monospace; }
`;

const SIZES = ["8px","9px","10px","11px","12px","14px","16px","18px","20px","22px","24px","28px","32px","36px","42px","48px","56px","64px","72px"];

// ── Document Settings Sidebar ─────────────────────────────────────────────────

function DocSettingsSidebar({ settings, onChange }) {
  return (
    <aside className="w-64 flex-shrink-0 bg-slate-50 border-r border-slate-200 overflow-y-auto p-4 space-y-5">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Document Settings</h3>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-600">Page Size</label>
        <select className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
          value={settings.pageSize} onChange={e => onChange({ ...settings, pageSize: e.target.value })}>
          <option value="letter">Letter (8.5×11)</option>
          <option value="a4">A4</option>
          <option value="legal">Legal (8.5×14)</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-600">Margins</label>
        <select className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
          value={settings.margins} onChange={e => onChange({ ...settings, margins: e.target.value })}>
          <option value="normal">Normal (1 in)</option>
          <option value="narrow">Narrow (0.5 in)</option>
          <option value="wide">Wide (1.5 in)</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-600">Line Spacing</label>
        <select className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
          value={settings.lineSpacing} onChange={e => onChange({ ...settings, lineSpacing: e.target.value })}>
          <option value="1">Single</option>
          <option value="1.5">1.5x</option>
          <option value="2">Double</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-600">Editor Background</label>
        <div className="flex gap-2">
          {["#ffffff","#faf7f2","#f0ede8","#1e1e1e"].map(c => (
            <button key={c} onClick={() => onChange({ ...settings, pageBg: c })}
              className="w-7 h-7 rounded border-2 transition-all"
              style={{ background: c, borderColor: settings.pageBg === c ? "#6366f1" : "#e2e8f0" }} />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-600">Show TOC</label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={settings.showToc} onChange={e => onChange({ ...settings, showToc: e.target.checked })}
            className="rounded border-slate-300 text-indigo-600" />
          <span className="text-sm text-slate-600">Include table of contents</span>
        </label>
      </div>
    </aside>
  );
}

// ── Find Bar ──────────────────────────────────────────────────────────────────

function FindBar({ quillRef, onClose }) {
  const [term, setTerm] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matches, setMatches] = useState([]); // array of {index, length}
  const [currentIdx, setCurrentIdx] = useState(-1);
  const findInputRef = useRef(null);

  // Focus find input on mount
  useEffect(() => { findInputRef.current?.focus(); }, []);

  const clearHighlights = useCallback(() => {
    if (!quillRef.current) return;
    const len = quillRef.current.getLength();
    quillRef.current.formatText(0, len, { background: false });
  }, [quillRef]);

  const runFind = useCallback((searchTerm, cs) => {
    if (!quillRef.current || !searchTerm) {
      clearHighlights();
      setMatches([]);
      setCurrentIdx(-1);
      return [];
    }
    const text = quillRef.current.getText();
    const needle = cs ? searchTerm : searchTerm.toLowerCase();
    const haystack = cs ? text : text.toLowerCase();
    const found = [];
    let start = 0;
    while (true) {
      const idx = haystack.indexOf(needle, start);
      if (idx === -1) break;
      found.push({ index: idx, length: searchTerm.length });
      start = idx + 1;
    }
    // Clear all highlights first
    quillRef.current.formatText(0, text.length, { background: false });
    // Highlight all matches
    found.forEach(m => quillRef.current.formatText(m.index, m.length, { background: "#fef08a" }));
    setMatches(found);
    return found;
  }, [quillRef, clearHighlights]);

  const doFind = useCallback(() => {
    const found = runFind(term, caseSensitive);
    if (found.length > 0) {
      const next = 0;
      setCurrentIdx(next);
      quillRef.current.setSelection(found[next].index, found[next].length);
      // Highlight current match brighter
      quillRef.current.formatText(found[next].index, found[next].length, { background: "#fb923c" });
    }
  }, [term, caseSensitive, runFind, quillRef]);

  const navigate = useCallback((dir) => {
    if (matches.length === 0) return;
    const next = (currentIdx + dir + matches.length) % matches.length;
    // Restore previous highlight
    if (currentIdx >= 0) {
      quillRef.current.formatText(matches[currentIdx].index, matches[currentIdx].length, { background: "#fef08a" });
    }
    setCurrentIdx(next);
    quillRef.current.setSelection(matches[next].index, matches[next].length);
    quillRef.current.formatText(matches[next].index, matches[next].length, { background: "#fb923c" });
  }, [matches, currentIdx, quillRef]);

  const doReplace = useCallback(() => {
    if (!term || !quillRef.current || currentIdx < 0 || matches.length === 0) return;
    const m = matches[currentIdx];
    quillRef.current.deleteText(m.index, m.length);
    quillRef.current.insertText(m.index, replaceText);
    // Re-run find after replacement
    const found = runFind(term, caseSensitive);
    if (found.length > 0) {
      const next = Math.min(currentIdx, found.length - 1);
      setCurrentIdx(next);
      quillRef.current.setSelection(found[next].index, found[next].length);
      quillRef.current.formatText(found[next].index, found[next].length, { background: "#fb923c" });
    }
  }, [term, replaceText, caseSensitive, currentIdx, matches, quillRef, runFind]);

  const doReplaceAll = useCallback(() => {
    if (!term || !quillRef.current) return;
    const found = runFind(term, caseSensitive);
    // Replace from end to start to preserve indices
    for (let i = found.length - 1; i >= 0; i--) {
      quillRef.current.deleteText(found[i].index, found[i].length);
      quillRef.current.insertText(found[i].index, replaceText);
    }
    clearHighlights();
    setMatches([]);
    setCurrentIdx(-1);
  }, [term, replaceText, caseSensitive, quillRef, runFind, clearHighlights]);

  const handleClose = useCallback(() => {
    clearHighlights();
    onClose();
  }, [clearHighlights, onClose]);

  // Re-run find when term or case changes
  useEffect(() => {
    if (term) {
      const found = runFind(term, caseSensitive);
      if (found.length > 0) {
        setCurrentIdx(0);
        quillRef.current.setSelection(found[0].index, found[0].length);
        quillRef.current.formatText(found[0].index, found[0].length, { background: "#fb923c" });
      } else {
        setCurrentIdx(-1);
      }
    } else {
      clearHighlights();
      setMatches([]);
      setCurrentIdx(-1);
    }
  }, [term, caseSensitive]);

  const matchLabel = matches.length === 0
    ? (term ? "0/0" : "")
    : `${currentIdx + 1}/${matches.length}`;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 space-y-1.5">
      {/* Row 1: Find */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={findInputRef}
          className="border border-slate-200 rounded-md px-2.5 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
          style={{ width: 220 }}
          placeholder="Find…"
          value={term}
          onChange={e => setTerm(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.shiftKey ? navigate(-1) : navigate(1); } if (e.key === "Escape") handleClose(); }}
        />
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={doFind}>Find</Button>
        <Button size="sm" variant="outline" className="h-7 w-7 px-0 text-xs" title="Previous (▲)" onClick={() => navigate(-1)}>▲</Button>
        <Button size="sm" variant="outline" className="h-7 w-7 px-0 text-xs" title="Next (▼)" onClick={() => navigate(1)}>▼</Button>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)} className="rounded border-slate-300" />
          <span className="font-mono font-bold">Aa</span>
        </label>
        {matchLabel && (
          <span className="text-xs text-slate-500 font-mono min-w-[40px]">{matchLabel}</span>
        )}
      </div>
      {/* Row 2: Replace */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          className="border border-slate-200 rounded-md px-2.5 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
          style={{ width: 220 }}
          placeholder="Replace…"
          value={replaceText}
          onChange={e => setReplaceText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") doReplace(); if (e.key === "Escape") handleClose(); }}
        />
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={doReplace}>Replace</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={doReplaceAll}>Replace All</Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 px-0 text-slate-500 hover:text-red-500" onClick={handleClose}>✕</Button>
      </div>
    </div>
  );
}

// ── Status Bar ────────────────────────────────────────────────────────────────

function StatusBar({ text }) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.replace(/\n/g, "").length;
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim()).length;
  const readMins = Math.ceil(words / 250);
  const pages = Math.ceil(words / 275);

  return (
    <div className="flex items-center gap-5 px-5 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex-wrap">
      <span><b className="text-slate-700">{words.toLocaleString()}</b> words</span>
      <span><b className="text-slate-700">{chars.toLocaleString()}</b> characters</span>
      <span><b className="text-slate-700">{paragraphs.toLocaleString()}</b> paragraphs</span>
      <span>~<b className="text-slate-700">{readMins}</b> min read</span>
      <span>~<b className="text-slate-700">{pages}</b> {pages === 1 ? "page" : "pages"}</span>
    </div>
  );
}

// ── Build HTML from project data ──────────────────────────────────────────────

function buildHtml(project, spec, chapters, showToc) {
  const title = project?.name || "Untitled";
  const sortedChapters = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);

  let html = `<h1>${title}</h1>\n`;

  if (spec?.genre || spec?.target_audience) {
    html += `<p><em>${[spec.genre, spec.target_audience].filter(Boolean).join(" · ")}</em></p>\n`;
  }

  if (showToc && sortedChapters.length > 0) {
    html += `<h2>Table of Contents</h2>\n<ol>\n`;
    sortedChapters.forEach(ch => {
      html += `  <li>${ch.title}</li>\n`;
    });
    html += `</ol>\n<hr/>\n`;
  }

  sortedChapters.forEach(ch => {
    html += `<h2>Chapter ${ch.chapter_number}: ${ch.title}</h2>\n`;
    if (ch.content) {
      const paragraphs = ch.content.split(/\n\n+/).filter(p => p.trim());
      paragraphs.forEach(p => { html += `<p>${p.replace(/\n/g, " ").trim()}</p>\n`; });
    } else {
      html += `<p><em>[Chapter not yet written]</em></p>\n`;
    }
  });

  return html;
}

// ── Export helpers ────────────────────────────────────────────────────────────

function exportTxt(quill, title) {
  const text = quill.getText();
  const blob = new Blob([text], { type: "text/plain" });
  download(blob, `${title}.txt`);
}

function exportMd(quill, title) {
  const html = quill.root.innerHTML;
  // Basic HTML → Markdown
  let md = html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n")
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n")
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gi, "_$1_")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n");
  const blob = new Blob([md], { type: "text/markdown" });
  download(blob, `${title}.md`);
}

function exportHtml(quill, title) {
  const body = quill.root.innerHTML;
  const full = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 24px;line-height:1.7;color:#1e293b;}h1{font-size:2.2em;}h2{font-size:1.5em;margin-top:2em;}</style></head><body>${body}</body></html>`;
  const blob = new Blob([full], { type: "text/html" });
  download(blob, `${title}.html`);
}

function exportDocx(quill, title) {
  const body = quill.root.innerHTML;
  const mhtml = `MIME-Version: 1.0\nContent-Type: multipart/related; boundary="boundary"\n\n--boundary\nContent-Type: text/html; charset="utf-8"\n\n<html><head><title>${title}</title></head><body>${body}</body></html>\n\n--boundary--`;
  const blob = new Blob([mhtml], { type: "application/msword" });
  download(blob, `${title}.doc`);
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Main EditExportTab ────────────────────────────────────────────────────────

export default function EditExportTab({ projectId }) {
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const [quillReady, setQuillReady] = useState(false);
  const [plainText, setPlainText] = useState("");
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [docSettings, setDocSettings] = useState({
    pageSize: "letter", margins: "normal", lineSpacing: "1.5", pageBg: "#ffffff", showToc: true
  });

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => { const r = await base44.entities.Project.filter({ id: projectId }); return r[0]; },
    enabled: !!projectId,
  });
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", projectId],
    queryFn: () => base44.entities.Chapter.filter({ project_id: projectId }, "chapter_number"),
    enabled: !!projectId,
  });
  const { data: specs = [] } = useQuery({
    queryKey: ["spec", projectId],
    queryFn: () => base44.entities.Specification.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const spec = specs[0];

  // Load Quill
  useEffect(() => {
    loadStyle("https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css");

    // Inject font CSS
    if (!document.getElementById("quill-custom-fonts")) {
      const style = document.createElement("style");
      style.id = "quill-custom-fonts";
      style.textContent = FONT_CSS;
      document.head.appendChild(style);
    }

    loadScript("https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js").then(() => {
      if (!editorRef.current || quillRef.current) return;

      const Quill = window.Quill;

      // Register fonts
      const QuillFont = Quill.import("attributors/class/font");
      QuillFont.whitelist = FONTS.map(f => f.value);
      Quill.register(QuillFont, true);

      // Register sizes
      const QuillSize = Quill.import("attributors/style/size");
      QuillSize.whitelist = SIZES;
      Quill.register(QuillSize, true);

      const toolbarOptions = [
        [{ header: [1, 2, 3, 4, false] }],
        [{ font: FONTS.map(f => f.value) }],
        [{ size: SIZES }],
        ["bold", "italic", "underline", "strike"],
        [{ script: "sub" }, { script: "super" }],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
        ["blockquote", "code-block"],
        ["link", "image"],
        ["clean"],
      ];

      const quill = new Quill(editorRef.current, {
        theme: "snow",
        modules: { toolbar: toolbarOptions },
        placeholder: "Your book content will load here…",
      });

      quill.on("text-change", () => {
        setPlainText(quill.getText());
      });

      quillRef.current = quill;
      setQuillReady(true);
    });
  }, []);

  // Load content into Quill when data + Quill are both ready
  useEffect(() => {
    if (!quillReady || !quillRef.current || !project) return;
    if (chapters.length === 0) return;
    const html = buildHtml(project, spec, chapters, docSettings.showToc);
    quillRef.current.clipboard.dangerouslyPasteHTML(html);
    setPlainText(quillRef.current.getText());
  }, [quillReady, project, spec, chapters]);

  // Re-build when showToc toggles
  useEffect(() => {
    if (!quillReady || !quillRef.current || !project || chapters.length === 0) return;
    const html = buildHtml(project, spec, chapters, docSettings.showToc);
    quillRef.current.clipboard.dangerouslyPasteHTML(html);
    setPlainText(quillRef.current.getText());
  }, [docSettings.showToc]);

  const MARGIN_MAP = { normal: "48px 60px", narrow: "28px 32px", wide: "72px 96px" };

  const handleCopyAll = () => {
    if (!quillRef.current) return;
    navigator.clipboard.writeText(quillRef.current.getText());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowFind(s => !s);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "h") {
        e.preventDefault();
        setShowFind(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        setAutoSaved(true);
        setTimeout(() => setAutoSaved(false), 2000);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const title = project?.name || "Untitled";

  const wrapperClass = fullscreen
    ? "fixed inset-0 z-50 bg-slate-100 flex flex-col"
    : "flex flex-col";

  return (
    <div className={wrapperClass}>
      {/* Top Bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-slate-200 flex-wrap">
        <h2 className="text-sm font-semibold text-slate-700 mr-2 whitespace-nowrap">Phase 3: Edit & Export</h2>

        <Button size="sm" variant={showSettings ? "secondary" : "outline"} className="h-7 text-xs gap-1.5" onClick={() => setShowSettings(s => !s)}>
          <Settings className="w-3.5 h-3.5" /> Settings
        </Button>
        <Button size="sm" variant={showFind ? "secondary" : "outline"} className="h-7 text-xs gap-1.5" onClick={() => setShowFind(s => !s)}>
          <Search className="w-3.5 h-3.5" /> Find
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={handleCopyAll}>
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy All"}
        </Button>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => quillRef.current && exportTxt(quillRef.current, title)}>TXT</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => quillRef.current && exportMd(quillRef.current, title)}>MD</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => quillRef.current && exportHtml(quillRef.current, title)}>HTML</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => quillRef.current && exportDocx(quillRef.current, title)}>DOCX</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => window.print()}>
          <Printer className="w-3.5 h-3.5" /> Print/PDF
        </Button>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.max(50, z - 10))}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs text-slate-600 w-10 text-center font-mono">{zoom}%</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.min(200, z + 10))}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
        </div>

        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setFullscreen(f => !f)}>
          {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {/* Find Bar */}
      {showFind && <FindBar quillRef={quillRef} onClose={() => setShowFind(false)} />}

      {/* Body */}
      <div className="flex flex-1 overflow-hidden min-h-0" style={{ height: fullscreen ? "calc(100vh - 100px)" : "700px" }}>
        {showSettings && (
          <DocSettingsSidebar settings={docSettings} onChange={setDocSettings} />
        )}

        {/* Editor Area */}
        <div className="flex-1 overflow-auto bg-slate-100 relative" style={{
          lineHeight: docSettings.lineSpacing,
        }}>
          {!quillReady && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-100">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Loading editor…</p>
              </div>
            </div>
          )}

          <style>{`
            .quill-page-wrapper .ql-container {
              font-size: 14px;
              border: none !important;
              background: transparent;
            }
            .quill-page-wrapper .ql-toolbar {
              border: none !important;
              background: #fff;
              border-bottom: 1px solid #e2e8f0 !important;
              position: sticky;
              top: 0;
              z-index: 10;
            }
            .quill-page-wrapper .ql-editor {
              min-height: 900px;
              max-width: 800px;
              margin: 24px auto;
              background: ${docSettings.pageBg};
              box-shadow: 0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06);
              border-radius: 4px;
              padding: ${MARGIN_MAP[docSettings.margins]};
              transform-origin: top center;
              transform: scale(${zoom / 100});
              line-height: ${docSettings.lineSpacing};
              color: ${docSettings.pageBg === "#1e1e1e" ? "#f1f5f9" : "#1e293b"};
            }
            .quill-page-wrapper .ql-editor h1 { font-size: 2em; font-weight: 700; margin-bottom: 0.4em; }
            .quill-page-wrapper .ql-editor h2 { font-size: 1.4em; font-weight: 600; margin-top: 1.8em; margin-bottom: 0.4em; }
            .quill-page-wrapper .ql-editor h3 { font-size: 1.15em; font-weight: 600; margin-top: 1.4em; }
            .quill-page-wrapper .ql-editor p { margin-bottom: 0.8em; }
            .quill-page-wrapper .ql-editor ol, .quill-page-wrapper .ql-editor ul { margin-bottom: 1em; padding-left: 1.5em; }
          `}</style>

          <div className="quill-page-wrapper h-full">
            <div ref={editorRef} />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar text={plainText} />
    </div>
  );
}