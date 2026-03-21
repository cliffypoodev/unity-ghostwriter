// OutlineSection — Extracted from GenerateTab (Phase 6 split)
// Outline generation empty state, generating spinner, outline/bible/metadata display,
// partial outline banner, regenerate/resume buttons, spec summary

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, ChevronDown, ChevronRight, BookOpen, Globe, RefreshCw, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import SpecSettingsSummary from "../SpecSettingsSummary";
import BeatBadge from "../BeatBadge";

function safeParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function toStr(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.map(toStr).join(', ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function CollapsibleCard({ title, icon, emoji, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const handleToggle = () => {
    const scrollPos = window.scrollY;
    setOpen(o => !o);
    setTimeout(() => window.scrollTo(0, scrollPos), 0);
  };
  const Icon = icon;
  return (
    <div className="p1-card">
      <div className="p1-card-header cursor-pointer" onClick={handleToggle}>
        <div className="p1-card-icon" style={{ background: '#ede9fe', color: '#7c3aed' }}>
          {emoji || (Icon && <Icon className="w-3.5 h-3.5" />)}
        </div>
        <div className="p1-card-title">{title}</div>
        <div className="ml-auto">
          {open ? <ChevronDown className="w-4 h-4" style={{ color: '#9997b0' }} /> : <ChevronRight className="w-4 h-4" style={{ color: '#9997b0' }} />}
        </div>
      </div>
      {open && <div className="p1-card-body">{children}</div>}
    </div>
  );
}

const KEYWORD_COLORS = ["bg-violet-100 text-violet-700","bg-sky-100 text-sky-700","bg-emerald-100 text-emerald-700","bg-amber-100 text-amber-700","bg-pink-100 text-pink-700","bg-indigo-100 text-indigo-700","bg-rose-100 text-rose-700"];
const THEME_COLORS = ["bg-violet-100 text-violet-700","bg-sky-100 text-sky-700","bg-emerald-100 text-emerald-700","bg-amber-100 text-amber-700","bg-pink-100 text-pink-700","bg-indigo-100 text-indigo-700"];
const ROLE_COLORS = { protagonist: "bg-indigo-100 text-indigo-700", antagonist: "bg-red-100 text-red-700", supporting: "bg-amber-100 text-amber-700", minor: "bg-slate-100 text-slate-600" };

function BookMetadataCard({ metadataRaw }) {
  const meta = safeParse(metadataRaw);
  if (!meta) return null;
  return (
    <CollapsibleCard title="Book Metadata — Publishing Details" emoji="📖" defaultOpen={false}>
      <div className="space-y-4">
        {meta.title && <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Title</p><p className="font-bold text-slate-900 leading-tight" style={{ fontSize: "18px" }}>{meta.title}</p></div>}
        {meta.subtitle && <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Subtitle</p><p className="text-sm text-slate-700 italic">{meta.subtitle}</p></div>}
        {meta.description && <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Book Description</p><p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{meta.description}</p></div>}
        {meta.keywords?.length > 0 && <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Keywords</p><div className="flex flex-wrap gap-1.5">{meta.keywords.map((kw, i) => <span key={i} className={cn("text-xs px-2.5 py-1 rounded-full font-medium", KEYWORD_COLORS[i % KEYWORD_COLORS.length])}>{kw}</span>)}</div></div>}
      </div>
    </CollapsibleCard>
  );
}

function OutlineCard({ outlineData }) {
  const outline = safeParse(outlineData);
  if (!outline) return null;
  return (
    <CollapsibleCard title={`Book Outline — ${outline.title || "Untitled"}`} icon={BookOpen} defaultOpen={false}>
      <div className="space-y-4">
        {outline.narrative_arc && <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Narrative Arc</p><p className="text-sm text-slate-700 leading-relaxed">{outline.narrative_arc}</p></div>}
        {outline.themes?.length > 0 && <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Themes</p><div className="flex gap-2 flex-wrap">{outline.themes.map((t, i) => <span key={i} className={cn("text-xs px-2.5 py-1 rounded-full font-medium", THEME_COLORS[i % THEME_COLORS.length])}>{t}</span>)}</div></div>}
        {outline.chapters?.length > 0 && <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Chapter Overview</p><div className="space-y-2">{outline.chapters.map((ch, i) => <div key={i} className="text-sm p-2 bg-slate-50 rounded-lg"><div className="flex items-center gap-2 flex-wrap"><p className="font-semibold text-slate-800">Ch {ch.number}: {ch.title}</p>{ch.beat_function && <BeatBadge beatFunction={ch.beat_function} beatName={ch.beat_name} />}</div>{ch.summary && <p className="text-xs text-slate-600 mt-1 opacity-80">{ch.summary}</p>}</div>)}</div></div>}
        {!outline.narrative_arc && (!outline.themes || outline.themes.length === 0) && (!outline.chapters || outline.chapters.length === 0) && <p className="text-sm text-slate-500">Outline data is available but contains no displayable summary fields.</p>}
      </div>
    </CollapsibleCard>
  );
}

function StoryBibleCard({ storyBible }) {
  const bible = safeParse(storyBible);
  if (!bible) return null;
  const fields = [
    { key: 'world', label: 'World & Setting' },{ key: 'setting', label: 'Setting' },{ key: 'tone_voice', label: 'Tone & Voice' },
    { key: 'tone', label: 'Tone' },{ key: 'style_guidelines', label: 'Style Guidelines' },{ key: 'atmosphere', label: 'Atmosphere' },
    { key: 'geography', label: 'Geography' },{ key: 'magic_system', label: 'Magic System' },{ key: 'technology', label: 'Technology' },
    { key: 'society', label: 'Society' },{ key: 'history', label: 'History' },
  ];
  return (
    <CollapsibleCard title="Story Bible" icon={Globe} defaultOpen={false}>
      <div className="space-y-4">
        {fields.map(({ key, label }) => { const val = bible[key]; if (!val) return null; const text = toStr(val); if (!text) return null; return <div key={key}><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p><p className="text-sm text-slate-700 leading-relaxed">{text}</p></div>; })}
        {bible.characters?.length > 0 && <div><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Characters</p><div className="space-y-2">{bible.characters.map((char, i) => <div key={i} className="bg-slate-50 rounded-lg p-3"><div className="flex items-center gap-2 mb-1"><span className="font-semibold text-sm text-slate-800">{toStr(char.name)}</span>{char.role && <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", ROLE_COLORS[toStr(char.role).toLowerCase()] || ROLE_COLORS.minor)}>{toStr(char.role)}</span>}</div>{char.description && <p className="text-xs text-slate-600 mb-1">{toStr(char.description)}</p>}{char.arc && <p className="text-xs text-slate-500 italic">{toStr(char.arc)}</p>}</div>)}</div></div>}
        {bible.rules && <div><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Consistency Rules</p>{Array.isArray(bible.rules) ? <ul className="list-disc list-inside space-y-1">{bible.rules.map((r, i) => <li key={i} className="text-sm text-slate-700">{toStr(r)}</li>)}</ul> : <p className="text-sm text-slate-700">{toStr(bible.rules)}</p>}</div>}
      </div>
    </CollapsibleCard>
  );
}

export default function OutlineSection({
  spec, hasOutline, isPartial, generating, generationProgress,
  generateError, retryCountdown,
  onGenerateOutline, onResumeDetail,
  resolvedOutlineData, resolvedStoryBible, resolvedBookMetadata,
}) {
  // Empty state
  if (!hasOutline && !generating) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-indigo-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Your book starts here</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Generate your outline to begin. The AI will build your chapter structure based on your premise.
          </p>
          {generateError && (
            <div className="mb-4 space-y-3">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 text-left">{generateError}</div>
              {retryCountdown > 0 && <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 text-center font-medium">Ready to retry in: {retryCountdown}s...</div>}
            </div>
          )}
          <Button onClick={onGenerateOutline} disabled={retryCountdown > 0} className="bg-indigo-600 hover:bg-indigo-700 px-6 disabled:opacity-50 disabled:cursor-not-allowed">
            <Sparkles className="w-4 h-4 mr-2" /> {generateError ? 'Retry Generation' : 'Generate Outline & Story Bible'}
          </Button>
          {spec && <div className="mt-4 text-left"><SpecSettingsSummary spec={spec} /></div>}
        </div>
      </div>
    );
  }

  // Generating spinner
  if (generating) {
    const isStep2 = generationProgress.includes('2/2') || generationProgress.includes('Resuming');
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center max-w-sm">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Generating your book outline…</p>
          {generationProgress && <p className="text-sm text-indigo-600 mt-2 font-medium">{generationProgress}</p>}
          <div className="flex items-center gap-2 mt-4 justify-center">
            <div className={cn("h-2 flex-1 rounded-full", isStep2 ? "bg-indigo-500" : "bg-indigo-400 animate-pulse")} />
            <div className={cn("h-2 flex-1 rounded-full", isStep2 ? "bg-indigo-400 animate-pulse" : "bg-slate-200")} />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-1">
            <span className={isStep2 ? "text-indigo-600 font-medium" : ""}>Structure</span>
            <span className={isStep2 ? "text-indigo-600 font-medium" : ""}>Detail</span>
          </div>
          <p className="text-xs text-slate-400 mt-3">Usually completes in under 2 minutes</p>
        </div>
      </div>
    );
  }

  // Outline display cards (rendered inline alongside other sections)
  return (
    <div className="space-y-6">
      <SpecSettingsSummary spec={spec} />
      <BookMetadataCard metadataRaw={resolvedBookMetadata} />
      <OutlineCard outlineData={resolvedOutlineData} />
      <StoryBibleCard storyBible={resolvedStoryBible} />

      {isPartial && !generateError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center justify-between">
          <span>Outline structure is ready but detail is incomplete. Resume to add prompts and story bible.</span>
          <Button size="sm" onClick={onResumeDetail} className="bg-amber-600 hover:bg-amber-700 text-white ml-3 shrink-0">
            <Sparkles className="w-3 h-3 mr-1" /> Resume
          </Button>
        </div>
      )}

      {generateError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{generateError}</div>
      )}
    </div>
  );
}

export { CollapsibleCard, safeParse };