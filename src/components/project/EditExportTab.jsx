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

const FONT_FAMILIES = {
  "georgia": "Georgia, serif",
  "times-new-roman": '"Times New Roman", Times, serif',
  "garamond": 'Garamond, "EB Garamond", serif',
  "palatino": 'Palatino, "Palatino Linotype", serif',
  "baskerville": 'Baskerville, "Baskerville Old Face", serif',
  "arial": "Arial, sans-serif",
  "helvetica": "Helvetica, Arial, sans-serif",
  "verdana": "Verdana, Geneva, sans-serif",
  "trebuchet-ms": '"Trebuchet MS", Helvetica, sans-serif',
  "calibri": "Calibri, Candara, sans-serif",
  "courier-new": '"Courier New", Courier, monospace',
  "consolas": 'Consolas, "Courier New", monospace',
};

const MARGIN_OPTIONS = [
  { label: 'Narrow (0.5")', value: "0.5in" },
  { label: 'Moderate (0.75")', value: "0.75in" },
  { label: 'Normal (1.0")', value: "1in" },
  { label: 'Wide (1.25")', value: "1.25in" },
  { label: 'Extra Wide (1.5")', value: "1.5in" },
];

const LINE_SPACING_OPTIONS = [
  { label: "Single (1.0)", value: "1" },
  { label: "Tight (1.15)", value: "1.15" },
  { label: "1.5", value: "1.5" },
  { label: "Comfortable (1.8)", value: "1.8" },
  { label: "Double (2.0)", value: "2" },
  { label: "Extra (2.5)", value: "2.5" },
];

const PAGE_NUMBER_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Bottom Center", value: "bottom-center" },
  { label: "Bottom Right", value: "bottom-right" },
  { label: "Top Right", value: "top-right" },
];

function SField({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function SInput({ value, onChange, placeholder }) {
  return (
    <input
      className="w-full text-sm border border-slate-200 rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function SSelect({ value, onChange, options }) {
  return (
    <select
      className="w-full text-sm border border-slate-200 rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function DocSettingsSidebar({ settings, onChange }) {
  const set = (key, val) => onChange({ ...settings, [key]: val });

  return (
    <aside className="flex-shrink-0 bg-slate-50 border-r border-slate-200 overflow-y-auto p-4 space-y-4" style={{ width: 280 }}>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest pb-1 border-b border-slate-200">Document Settings</h3>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Book Info</p>
        <SField label="Book Title">
          <SInput value={settings.bookTitle} onChange={v => set("bookTitle", v)} placeholder="Book title" />
        </SField>
        <SField label="Author Name">
          <SInput value={settings.authorName} onChange={v => set("authorName", v)} placeholder="Author name" />
        </SField>
        <SField label="Subtitle">
          <SInput value={settings.subtitle} onChange={v => set("subtitle", v)} placeholder="Subtitle (optional)" />
        </SField>
      </div>

      <div className="space-y-3 pt-1">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Typography</p>
        <SField label="Body Font">
          <SSelect value={settings.bodyFont} onChange={v => set("bodyFont", v)} options={FONTS.map(f => ({ label: f.label, value: f.value }))} />
        </SField>
        <SField label="Heading Font">
          <SSelect value={settings.headingFont} onChange={v => set("headingFont", v)} options={FONTS.map(f => ({ label: f.label, value: f.value }))} />
        </SField>
        <SField label="Body Font Size">
          <SSelect value={settings.bodyFontSize} onChange={v => set("bodyFontSize", v)} options={SIZES.map(s => ({ label: s, value: s }))} />
        </SField>
        <SField label="Line Spacing">
          <SSelect value={settings.lineSpacing} onChange={v => set("lineSpacing", v)} options={LINE_SPACING_OPTIONS} />
        </SField>
      </div>

      <div className="space-y-3 pt-1">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Layout</p>
        <SField label="Page Margins">
          <SSelect value={settings.margins} onChange={v => set("margins", v)} options={MARGIN_OPTIONS} />
        </SField>
        <SField label="Page Numbers">
          <SSelect value={settings.pageNumbers} onChange={v => set("pageNumbers", v)} options={PAGE_NUMBER_OPTIONS} />
        </SField>
      </div>

      <div className="space-y-3 pt-1">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Header & Footer</p>
        <SField label="Header Text">
          <SInput value={settings.headerText} onChange={v => set("headerText", v)} placeholder="Text shown at top of pages" />
        </SField>
        <SField label="Footer Text">
          <SInput value={settings.footerText} onChange={v => set("footerText", v)} placeholder="Text shown at bottom of pages" />
        </SField>
      </div>

      <div className="space-y-3 pt-1">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Editor</p>
        <SField label="Background">
          <div className="flex gap-2 pt-0.5">
            {["#ffffff","#faf7f2","#f0ede8","#1e1e1e"].map(c => (
              <button key={c} onClick={() => set("pageBg", c)}
                className="w-7 h-7 rounded border-2 transition-all"
                style={{ background: c, borderColor: settings.pageBg === c ? "#6366f1" : "#e2e8f0" }} />
            ))}
          </div>
        </SField>
        <SField label="Table of Contents">
          <label className="flex items-center gap-2 cursor-pointer mt-0.5">
            <input type="checkbox" checked={settings.showToc} onChange={e => set("showToc", e.target.checked)}
              className="rounded border-slate-300 text-indigo-600" />
            <span className="text-sm text-slate-600">Include TOC</span>
          </label>
        </SField>
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
    const q = quillRef.current;
    q.off('text-change');
    q.formatText(0, q.getLength(), { background: false });
    q.on('text-change', () => setPlainText(q.getText()));
  }, [quillRef]);

  const runFind = useCallback((searchTerm, cs) => {
    if (!quillRef.current || !searchTerm) {
      clearHighlights();
      setMatches([]);
      setCurrentIdx(-1);
      return [];
    }
    const q = quillRef.current;
    q.off('text-change');
    const text = q.getText();
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
    q.formatText(0, text.length, { background: false });
    found.forEach(m => q.formatText(m.index, m.length, { background: "#fef08a" }));
    q.on('text-change', () => setPlainText(q.getText()));
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
    if (matches.length === 0 || !quillRef.current) return;
    const q = quillRef.current;
    const next = (currentIdx + dir + matches.length) % matches.length;
    q.off('text-change');
    if (currentIdx >= 0) {
      q.formatText(matches[currentIdx].index, matches[currentIdx].length, { background: "#fef08a" });
    }
    setCurrentIdx(next);
    q.setSelection(matches[next].index, matches[next].length);
    q.formatText(matches[next].index, matches[next].length, { background: "#fb923c" });
    q.on('text-change', () => setPlainText(q.getText()));
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

  // Re-run find when term or case changes — debounced to avoid freezing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!quillRef.current) return;
      if (term) {
        // Temporarily disable text-change listener to avoid cascading renders
        const q = quillRef.current;
        q.off('text-change');
        
        const text = q.getText();
        const needle = caseSensitive ? term : term.toLowerCase();
        const haystack = caseSensitive ? text : text.toLowerCase();
        const found = [];
        let start = 0;
        while (true) {
          const idx = haystack.indexOf(needle, start);
          if (idx === -1) break;
          found.push({ index: idx, length: term.length });
          start = idx + 1;
        }
        // Clear old highlights then apply new
        q.formatText(0, text.length, { background: false });
        found.forEach(m => q.formatText(m.index, m.length, { background: "#fef08a" }));
        
        setMatches(found);
        if (found.length > 0) {
          setCurrentIdx(0);
          q.setSelection(found[0].index, found[0].length);
          q.formatText(found[0].index, found[0].length, { background: "#fb923c" });
        } else {
          setCurrentIdx(-1);
        }
        
        // Re-enable text-change listener
        q.on('text-change', () => setPlainText(q.getText()));
      } else {
        const q = quillRef.current;
        q.off('text-change');
        q.formatText(0, q.getLength(), { background: false });
        q.on('text-change', () => setPlainText(q.getText()));
        setMatches([]);
        setCurrentIdx(-1);
      }
    }, 300);
    return () => clearTimeout(timer);
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
    <div className="flex items-center gap-5 px-5 py-2 border-t text-xs flex-wrap editor-status-bar" style={{ background: 'var(--pgAlt, #FFFDF8)', borderColor: 'var(--nb-border, #D8D0C0)', color: 'var(--ink2, #5A5348)' }}>
      <span><b style={{ color: 'var(--ink, #3A3530)' }}>{words.toLocaleString()}</b> words</span>
      <span><b style={{ color: 'var(--ink, #3A3530)' }}>{chars.toLocaleString()}</b> characters</span>
      <span><b style={{ color: 'var(--ink, #3A3530)' }}>{paragraphs.toLocaleString()}</b> paragraphs</span>
      <span>~<b style={{ color: 'var(--ink, #3A3530)' }}>{readMins}</b> min read</span>
      <span>~<b style={{ color: 'var(--ink, #3A3530)' }}>{pages}</b> {pages === 1 ? "page" : "pages"}</span>
    </div>
  );
}

// ── Build HTML from project data ──────────────────────────────────────────────

async function buildHtml(project, spec, chapters, showToc) {
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

  for (let idx = 0; idx < sortedChapters.length; idx++) {
    const ch = sortedChapters[idx];
    if (idx > 0) html += `<hr/>\n`;
    html += `<h2>Chapter ${ch.chapter_number}: ${ch.title}</h2>\n`;
    if (ch.content) {
      let contentText = ch.content;
      // If content is a URL, fetch it
      if (ch.content.startsWith('http')) {
        try {
          const resp = await fetch(ch.content);
          contentText = await resp.text();
        } catch (err) {
          console.error('Error fetching chapter content:', err);
          contentText = '';
        }
      }
      const paragraphs = contentText.split(/\n\n+/).filter(p => p.trim());
      paragraphs.forEach(p => { html += `<p>${p.replace(/\n/g, " ").trim()}</p>\n`; });
    } else {
      html += `<p><em>[Chapter not yet written]</em></p>\n`;
    }
  }

  return html;
}

// ── Export helpers ────────────────────────────────────────────────────────────

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildFullHtml(bodyHtml, ds, forPrint = false) {
  const bodyFamily = FONT_FAMILIES[ds.bodyFont] || "Georgia, serif";
  const headingFamily = FONT_FAMILIES[ds.headingFont] || "Georgia, serif";
  const margin = ds.margins || "1in";
  const lineH = ds.lineSpacing || "1.5";
  const fontSize = ds.bodyFontSize || "14px";

  let pageNumCSS = "";
  if (ds.pageNumbers === "bottom-center") pageNumCSS = `@page { @bottom-center { content: counter(page); } }`;
  else if (ds.pageNumbers === "bottom-right") pageNumCSS = `@page { @bottom-right { content: counter(page); } }`;
  else if (ds.pageNumbers === "top-right") pageNumCSS = `@page { @top-right { content: counter(page); } }`;

  const printPageCSS = forPrint ? `
    @page { margin: ${margin}; ${pageNumCSS ? pageNumCSS.replace(/@page\s*\{([^}]+)\}/g, "$1") : ""} }
    @media print {
      .no-print { display: none !important; }
      body { margin: 0; }
    }
  ` : "";

  const style = `
    body { font-family: ${bodyFamily}; font-size: ${fontSize}; line-height: ${lineH}; color: #1e293b;
           ${forPrint ? "" : `margin: ${margin};`} max-width: 800px; margin-left: auto; margin-right: auto; padding: 2em; }
    h1, h2, h3, h4 { font-family: ${headingFamily}; }
    h1 { font-size: 2.2em; font-weight: 700; margin-bottom: 0.4em; }
    h2 { font-size: 1.5em; font-weight: 600; margin-top: 2em; margin-bottom: 0.4em; }
    h3 { font-size: 1.2em; font-weight: 600; margin-top: 1.5em; }
    p { margin-bottom: 0.8em; }
    hr { page-break-before: always; border: none; height: 0; margin: 0; }
    .page-header { color: #64748b; font-size: 0.8em; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.4em; margin-bottom: 1.5em; }
    .page-footer { color: #64748b; font-size: 0.8em; border-top: 1px solid #e2e8f0; padding-top: 0.4em; margin-top: 2em; }
    .title-block { margin-bottom: 3em; }
    ${forPrint ? printPageCSS : ""}
    ${forPrint ? "" : pageNumCSS}
  `;

  const titleBlock = (ds.bookTitle || ds.authorName || ds.subtitle) ? `
    <div class="title-block">
      ${ds.bookTitle ? `<h1>${ds.bookTitle}${ds.subtitle ? `<br/><small style="font-size:0.5em;font-weight:400;color:#64748b">${ds.subtitle}</small>` : ""}</h1>` : ""}
      ${ds.authorName ? `<p style="font-style:italic;font-size:1.1em;margin-bottom:0">${ds.authorName}</p>` : ""}
    </div>` : "";

  const headerHtml = ds.headerText ? `<div class="page-header">${ds.headerText}</div>` : "";
  const footerHtml = ds.footerText ? `<div class="page-footer">${ds.footerText}</div>` : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${ds.bookTitle || "Book"}</title><style>${style}</style></head><body>${headerHtml}${titleBlock}${bodyHtml}${footerHtml}</body></html>`;
}

// Client-side HTML export
function exportHtml(quill, ds) {
  const full = buildFullHtml(quill.root.innerHTML, ds);
  const blob = new Blob([full], { type: "text/html" });
  download(blob, `${ds.bookTitle || "book"}.html`);
}

// Server-side TXT export — downloads via file URL
async function exportTxt(projectId, ds) {
  const { base44: sdk } = await import("@/api/base44Client");
  const resp = await sdk.functions.invoke("exportProject", { projectId, format: "txt" });
  const { file_url, filename } = resp.data || {};
  if (file_url) {
    const a = document.createElement("a");
    a.href = file_url;
    a.download = filename || "book.txt";
    a.target = "_blank";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
}

// Server-side Markdown export — downloads via file URL
async function exportMd(projectId, ds) {
  const { base44: sdk } = await import("@/api/base44Client");
  const resp = await sdk.functions.invoke("exportProject", { projectId, format: "md" });
  const { file_url, filename } = resp.data || {};
  if (file_url) {
    const a = document.createElement("a");
    a.href = file_url;
    a.download = filename || "book.md";
    a.target = "_blank";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
}

// Server-side DOCX export — downloads via file URL
async function exportDocx(projectId, quill, ds) {
  const { base44: sdk } = await import("@/api/base44Client");
  const resp = await sdk.functions.invoke("exportProject", {
    projectId,
    format: "docx",
    settings: ds,
  });
  if (resp.data?.error) throw new Error(resp.data.error);
  const { file_url, filename } = resp.data || {};
  if (!file_url) throw new Error("No DOCX file returned from server");
  const a = document.createElement("a");
  a.href = file_url;
  a.download = filename || `${ds.bookTitle || "book"}.docx`;
  a.target = "_blank";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// Print/PDF — opens styled window and triggers print dialog
function exportPrint(quill, ds) {
  const full = buildFullHtml(quill.root.innerHTML, ds, true);
  const w = window.open("", "_blank");
  w.document.write(full);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 500);
}

// ── Main EditExportTab ────────────────────────────────────────────────────────

export default function EditExportTab({ projectId }) {
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const [quillReady, setQuillReady] = useState(false);

  // Scroll to top on component mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const [plainText, setPlainText] = useState("");
  const [zoom, setZoom] = useState(window.innerWidth < 768 ? 80 : 100);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [docSettings, setDocSettings] = useState({
    bookTitle: "",
    authorName: "",
    subtitle: "",
    bodyFont: "georgia",
    headingFont: "georgia",
    bodyFontSize: "14px",
    lineSpacing: "1.5",
    margins: "1in",
    pageNumbers: "none",
    headerText: "",
    footerText: "",
    pageBg: "#ffffff",
    showToc: true,
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
    refetchOnMount: "always",
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

      // Mobile style overrides
      if (window.innerWidth < 768) {
        const editorEl = editorRef.current?.querySelector('.ql-editor');
        if (editorEl) {
          editorEl.style.padding = '20px 16px';
          editorEl.style.fontSize = '0.92rem';
          editorEl.style.overflowWrap = 'break-word';
          editorEl.style.wordBreak = 'break-word';
        }
        if (!document.getElementById('quill-mobile-styles')) {
          const mobileStyle = document.createElement('style');
          mobileStyle.id = 'quill-mobile-styles';
          mobileStyle.textContent = `
            .quill-page-wrapper .ql-editor h1 { font-size: 1.4rem !important; line-height: 1.25 !important; margin: 0.3em 0 !important; }
            .quill-page-wrapper .ql-editor h2 { font-size: 1.15rem !important; line-height: 1.3 !important; margin: 0.6em 0 0.3em !important; }
            .quill-page-wrapper .ql-editor h3 { font-size: 1rem !important; }
            .quill-page-wrapper .ql-editor h4 { font-size: 0.9rem !important; }
            .quill-page-wrapper .ql-editor { max-width: 100% !important; box-shadow: none !important; }
          `;
          document.head.appendChild(mobileStyle);
        }
      }

      setQuillReady(true);
    });
  }, []);

  // Auto-populate bookTitle from project name on first load
  useEffect(() => {
    if (project?.name) {
      setDocSettings(s => s.bookTitle ? s : { ...s, bookTitle: project.name });
    }
  }, [project]);

  // Add page-break labels to <hr> elements in the editor
  const addPageBreakLabels = useCallback(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current.querySelector('.ql-editor');
    if (!editor) return;
    // Remove any existing labels
    editor.querySelectorAll('.page-break-label').forEach(el => el.remove());
    // Add labels to each <hr>
    editor.querySelectorAll('hr').forEach(hr => {
      const label = document.createElement('div');
      label.className = 'page-break-label';
      label.contentEditable = 'false';
      label.textContent = 'PAGE BREAK';
      label.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);font-size:9px;letter-spacing:0.12em;color:#94a3b8;background:' + (docSettings.pageBg === '#1e1e1e' ? '#111' : '#e2e8f0') + ';padding:1px 10px;border-radius:3px;pointer-events:none;margin-top:-24px;z-index:1;';
      hr.style.position = 'relative';
      hr.parentNode.insertBefore(label, hr.nextSibling);
    });
  }, [docSettings.pageBg]);

  // Load content into Quill when data + Quill are both ready
  useEffect(() => {
    if (!quillReady || !quillRef.current || !project) return;
    if (chapters.length === 0) return;
    buildHtml(project, spec, chapters, docSettings.showToc).then(html => {
      if (quillRef.current) {
        quillRef.current.clipboard.dangerouslyPasteHTML(html);
        setPlainText(quillRef.current.getText());
        setTimeout(addPageBreakLabels, 100);
      }
    });
  }, [quillReady, project, spec, chapters]);

  // Re-build when showToc toggles
  useEffect(() => {
    if (!quillReady || !quillRef.current || !project || chapters.length === 0) return;
    buildHtml(project, spec, chapters, docSettings.showToc).then(html => {
      if (quillRef.current) {
        quillRef.current.clipboard.dangerouslyPasteHTML(html);
        setPlainText(quillRef.current.getText());
        setTimeout(addPageBreakLabels, 100);
      }
    });
  }, [docSettings.showToc]);

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
        if (quillRef.current) exportPrint(quillRef.current, docSettings);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const title = project?.name || "Untitled";

  const wrapperClass = fullscreen
    ? "fixed inset-0 z-50 flex flex-col"
    : "flex flex-col";
  const wrapperStyle = fullscreen ? { background: 'var(--pg, #F5EFE4)' } : {};

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      {/* Top Bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b flex-wrap" style={{ background: 'var(--pgAlt, #FFFDF8)', borderColor: 'var(--nb-border, #D8D0C0)' }}>
        <h2 className="text-sm font-semibold mr-2 whitespace-nowrap" style={{ color: 'var(--ink, #3A3530)' }}>Edit & Export</h2>

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

        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => exportTxt(projectId, docSettings)}>TXT</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => exportMd(projectId, docSettings)}>MD</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => quillRef.current && exportHtml(quillRef.current, docSettings)}>HTML</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => {
          if (!quillRef.current) return;
          try {
            await exportDocx(projectId, quillRef.current, docSettings);
          } catch (err) {
            console.error("DOCX export failed:", err);
            alert("DOCX export failed: " + (err.message || "Unknown error. Check that all chapters have generated content."));
          }
        }}>DOCX</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => quillRef.current && exportPrint(quillRef.current, docSettings)}>
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

        {autoSaved && (
          <span className="ml-2 text-xs text-emerald-600 flex items-center gap-1 animate-pulse">
            <Check className="w-3.5 h-3.5" /> Auto-saved
          </span>
        )}
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
              padding: ${docSettings.margins || "1in"};
              transform-origin: top center;
              transform: scale(${zoom / 100});
              line-height: ${docSettings.lineSpacing};
              font-size: ${docSettings.bodyFontSize};
              font-family: ${FONT_FAMILIES[docSettings.bodyFont] || "Georgia, serif"};
              color: ${docSettings.pageBg === "#1e1e1e" ? "#f1f5f9" : "#1e293b"};
            }
            .quill-page-wrapper .ql-editor h1,
            .quill-page-wrapper .ql-editor h2,
            .quill-page-wrapper .ql-editor h3,
            .quill-page-wrapper .ql-editor h4 {
              font-family: ${FONT_FAMILIES[docSettings.headingFont] || "Georgia, serif"};
            }
            .quill-page-wrapper .ql-editor h1 { font-size: 2em; font-weight: 700; margin-bottom: 0.4em; }
            .quill-page-wrapper .ql-editor h2 { font-size: 1.4em; font-weight: 600; margin-top: 1.8em; margin-bottom: 0.4em; }
            .quill-page-wrapper .ql-editor h3 { font-size: 1.15em; font-weight: 600; margin-top: 1.4em; }
            .quill-page-wrapper .ql-editor p { margin-bottom: 0.8em; }
            .quill-page-wrapper .ql-editor ol, .quill-page-wrapper .ql-editor ul { margin-bottom: 1em; padding-left: 1.5em; }
            /* Visual page break separators between chapters */
            .quill-page-wrapper .ql-editor hr {
              border: none !important;
              height: 40px !important;
              margin: 0 calc(-1 * ${docSettings.margins || "1in"}) !important;
              padding: 0 !important;
              background: ${docSettings.pageBg === "#1e1e1e" ? "#111" : "#e2e8f0"} !important;
              border-top: 1px solid ${docSettings.pageBg === "#1e1e1e" ? "#444" : "#cbd5e1"} !important;
              border-bottom: 1px solid ${docSettings.pageBg === "#1e1e1e" ? "#444" : "#cbd5e1"} !important;
              box-shadow: 
                inset 0 6px 8px -4px rgba(0,0,0,0.12),
                inset 0 -6px 8px -4px rgba(0,0,0,0.12) !important;
              position: relative !important;
            }
            .quill-page-wrapper .ql-editor .page-break-label {
              user-select: none;
            }
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