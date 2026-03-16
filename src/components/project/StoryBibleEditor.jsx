import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import {
  Loader2, Plus, Trash2, Sparkles, Users, Globe, BookOpen,
  UserCircle, MapPin, Clock, Target, FileText, ChevronDown, ChevronUp,
  Zap, MessageSquare, Heart, Shield, Eye
} from "lucide-react";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════
// DATA TEMPLATES
// ═══════════════════════════════════════════════════

const EMPTY_CHARACTER = {
  id: "", name: "", role: "protagonist",
  core_wound: "", desire: "", fear: "", ghost: "", misbelief: "", arc_direction: "",
  voice_dna: { vocabulary: "", speech_pattern: "", verbal_tic: "", never_says: "", internal_voice: "" },
  physical_tells: "", relationships: [],
};

const EMPTY_NF_FIGURE = {
  id: "", name: "", role: "", era: "", significance: "", known_sources: "",
};

const CHARACTER_ROLES = [
  { value: "protagonist", label: "Protagonist", color: "#818cf8" },
  { value: "antagonist", label: "Antagonist", color: "#f87171" },
  { value: "love_interest", label: "Love Interest", color: "#fb7185" },
  { value: "mentor", label: "Mentor", color: "#34d399" },
  { value: "supporting", label: "Supporting", color: "#94a3b8" },
  { value: "foil", label: "Foil", color: "#fbbf24" },
];

const NF_FIGURE_ROLES = [
  { value: "subject", label: "Subject" },
  { value: "antagonist", label: "Antagonist/Perpetrator" },
  { value: "victim", label: "Victim" },
  { value: "reformer", label: "Reformer" },
  { value: "witness", label: "Witness/Source" },
  { value: "institution", label: "Institution" },
];

// ═══════════════════════════════════════════════════
// FICTION: CHARACTER CARD
// ═══════════════════════════════════════════════════

function CharacterCard({ char, index, allChars, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(index === 0);
  const [voiceOpen, setVoiceOpen] = useState(false);

  const update = (field, value) => {
    const updated = { ...char, [field]: value };
    onChange(index, updated);
  };
  const updateVoice = (field, value) => {
    const updated = { ...char, voice_dna: { ...char.voice_dna, [field]: value } };
    onChange(index, updated);
  };

  const roleInfo = CHARACTER_ROLES.find(r => r.value === char.role) || CHARACTER_ROLES[4];

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: roleInfo.color }}>
          {char.name ? char.name[0].toUpperCase() : (index + 1)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-800 truncate">{char.name || `Character ${index + 1}`}</div>
          <div className="text-xs text-slate-500">{roleInfo.label}</div>
        </div>
        <Badge className="text-[10px] border" style={{ borderColor: roleInfo.color + '40', color: roleInfo.color, background: roleInfo.color + '10' }}>
          {roleInfo.label}
        </Badge>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
          {/* Name + Role row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Name</label>
              <Input value={char.name} onChange={e => update("name", e.target.value)} placeholder="Character name" className="mt-1 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Role</label>
              <select value={char.role} onChange={e => update("role", e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 text-sm px-3 py-2 bg-white">
                {CHARACTER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>

          {/* Psychology Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <Heart className="w-3 h-3" /> Core Wound
              </label>
              <Textarea rows={2} value={char.core_wound} onChange={e => update("core_wound", e.target.value)}
                placeholder="The formative trauma that shaped their worldview..." className="mt-1 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <Target className="w-3 h-3" /> Desire / Goal
              </label>
              <Textarea rows={2} value={char.desire} onChange={e => update("desire", e.target.value)}
                placeholder="What they want more than anything..." className="mt-1 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <Shield className="w-3 h-3" /> Deepest Fear
              </label>
              <Textarea rows={2} value={char.fear} onChange={e => update("fear", e.target.value)}
                placeholder="What terrifies them — the thing they'd do anything to avoid..." className="mt-1 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <Eye className="w-3 h-3" /> Misbelief / Lie
              </label>
              <Textarea rows={2} value={char.misbelief} onChange={e => update("misbelief", e.target.value)}
                placeholder="The false belief about themselves or the world they cling to..." className="mt-1 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Ghost (Backstory Event)</label>
              <Textarea rows={2} value={char.ghost} onChange={e => update("ghost", e.target.value)}
                placeholder="The specific past event that haunts them..." className="mt-1 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Arc Direction</label>
              <Textarea rows={2} value={char.arc_direction} onChange={e => update("arc_direction", e.target.value)}
                placeholder="How they change by the end — what they learn or become..." className="mt-1 text-sm" />
            </div>
          </div>

          {/* Voice DNA */}
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-3">
            <button onClick={() => setVoiceOpen(!voiceOpen)} className="flex items-center gap-2 w-full text-left">
              <MessageSquare className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-semibold text-indigo-700">Voice DNA</span>
              <span className="text-[10px] text-indigo-400 ml-auto">How this character speaks and thinks</span>
              {voiceOpen ? <ChevronUp className="w-3 h-3 text-indigo-400" /> : <ChevronDown className="w-3 h-3 text-indigo-400" />}
            </button>
            {voiceOpen && (
              <div className="mt-3 space-y-2">
                <div>
                  <label className="text-[10px] font-medium text-indigo-600">Vocabulary Level</label>
                  <Input value={char.voice_dna?.vocabulary || ""} onChange={e => updateVoice("vocabulary", e.target.value)}
                    placeholder="e.g. Street-smart, avoids big words / Academic, precise / Working-class blunt" className="mt-0.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-indigo-600">Speech Pattern</label>
                  <Input value={char.voice_dna?.speech_pattern || ""} onChange={e => updateVoice("speech_pattern", e.target.value)}
                    placeholder="e.g. Short bursts when angry, rambles when nervous / Always complete sentences" className="mt-0.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-indigo-600">Verbal Tic / Signature Phrase</label>
                  <Input value={char.voice_dna?.verbal_tic || ""} onChange={e => updateVoice("verbal_tic", e.target.value)}
                    placeholder="e.g. 'Listen...' before arguments / Clears throat before lying / Deflects with humor" className="mt-0.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-indigo-600">Never Says</label>
                  <Input value={char.voice_dna?.never_says || ""} onChange={e => updateVoice("never_says", e.target.value)}
                    placeholder="Words/phrases this character would NEVER use — reveals what they suppress" className="mt-0.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-indigo-600">Internal Voice</label>
                  <Input value={char.voice_dna?.internal_voice || ""} onChange={e => updateVoice("internal_voice", e.target.value)}
                    placeholder="How they think differently from how they talk — inner monologue style" className="mt-0.5 text-sm" />
                </div>
              </div>
            )}
          </div>

          {/* Physical Tells + Relationships */}
          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Physical / Behavioral Tells</label>
            <Textarea rows={2} value={char.physical_tells} onChange={e => update("physical_tells", e.target.value)}
              placeholder="Observable habits that reveal inner state without dialogue — fidgets, posture shifts, eye contact patterns..." className="mt-1 text-sm" />
          </div>

          {/* Relationships */}
          {allChars.length > 1 && (
            <div>
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Key Relationships</label>
              <Textarea rows={2} value={(char.relationships || []).map(r => `${r.to}: ${r.dynamic}`).join("\n") || ""}
                onChange={e => {
                  const lines = e.target.value.split("\n").filter(l => l.trim());
                  const rels = lines.map(l => {
                    const [to, ...rest] = l.split(":");
                    return { to: to.trim(), type: "dynamic", dynamic: rest.join(":").trim() };
                  });
                  update("relationships", rels);
                }}
                placeholder={`Format: Name: relationship dynamic\ne.g. ${allChars.filter((_, i) => i !== index)[0]?.name || 'Sarah'}: Rivals who secretly respect each other`}
                className="mt-1 text-sm font-mono" />
            </div>
          )}

          {/* Delete */}
          <div className="flex justify-end">
            <button onClick={() => onDelete(index)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Remove Character
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// NONFICTION: KEY FIGURE CARD
// ═══════════════════════════════════════════════════

function FigureCard({ figure, index, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(index === 0);

  const update = (field, value) => onChange(index, { ...figure, [field]: value });

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50" onClick={() => setExpanded(!expanded)}>
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-bold">
          {figure.name ? figure.name[0].toUpperCase() : (index + 1)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-800 truncate">{figure.name || `Figure ${index + 1}`}</div>
          <div className="text-xs text-slate-500">{figure.role || "Role not set"} {figure.era ? `· ${figure.era}` : ""}</div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Name</label>
              <Input value={figure.name} onChange={e => update("name", e.target.value)} placeholder="Full name" className="mt-1 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Role</label>
              <select value={figure.role} onChange={e => update("role", e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 text-sm px-3 py-2 bg-white">
                <option value="">Select role...</option>
                {NF_FIGURE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Era Active</label>
              <Input value={figure.era} onChange={e => update("era", e.target.value)} placeholder="e.g. 1920s-1958" className="mt-1 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Significance to Narrative</label>
            <Textarea rows={2} value={figure.significance} onChange={e => update("significance", e.target.value)}
              placeholder="Why this person matters to the book's argument..." className="mt-1 text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Known Sources</label>
            <Textarea rows={2} value={figure.known_sources} onChange={e => update("known_sources", e.target.value)}
              placeholder="Biographies, archives, court records, interviews..." className="mt-1 text-sm" />
          </div>
          <div className="flex justify-end">
            <button onClick={() => onDelete(index)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Remove Figure
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export default function StoryBibleEditor({ form, onChange, projectId }) {
  const isNonfiction = form.book_type === "nonfiction";
  const [activeTab, setActiveTab] = useState(isNonfiction ? "figures" : "characters");
  const [generating, setGenerating] = useState(false);

  // Parse story bible from form field (stored as JSON string)
  const parseBible = useCallback(() => {
    try {
      return form.story_bible_data ? JSON.parse(form.story_bible_data) : null;
    } catch { return null; }
  }, [form.story_bible_data]);

  const bible = parseBible() || (isNonfiction ? {
    key_figures: [],
    settings: [],
    timeline: [],
    argument: { central_thesis: "", supporting_arguments: [], counter_arguments: [] },
    source_strategy: { primary_sources: [], secondary_sources: [], source_limitations: "" },
  } : {
    characters: [],
    world: { time_period: "", primary_setting: "", locations: [], world_rules: [], social_hierarchy: "", sensory_palette: "" },
    themes: { central_theme: "", thematic_question: "", motifs: [], symbols: [] },
  });

  const saveBible = (updated) => {
    onChange("story_bible_data", JSON.stringify(updated));
  };

  // ── AI GENERATE ──
  const handleGenerate = async () => {
    if (!form.topic?.trim()) { toast.error("Enter a premise/topic first"); return; }
    setGenerating(true);
    try {
      const result = await base44.functions.invoke("generateStoryBible", {
        project_id: projectId,
        topic: form.topic,
        book_type: form.book_type,
        genre: form.genre,
        subgenre: form.subgenre,
        target_audience: form.target_audience,
      }, { timeout: 120000 });

      const data = result?.data || result;
      if (data?.story_bible) {
        saveBible(data.story_bible);
        toast.success("Story Bible generated! Review and edit below.");
      } else {
        toast.error("Generation returned no data");
      }
    } catch (err) {
      console.error("Story Bible generation error:", err);
      toast.error("Failed to generate Story Bible");
    } finally {
      setGenerating(false);
    }
  };

  // ── FICTION TABS ──
  const FICTION_TABS = [
    { id: "characters", label: "Characters", icon: Users },
    { id: "world", label: "World & Setting", icon: Globe },
    { id: "themes", label: "Themes", icon: BookOpen },
  ];

  const NF_TABS = [
    { id: "figures", label: "Key Figures", icon: UserCircle },
    { id: "settings", label: "Settings & Timeline", icon: MapPin },
    { id: "argument", label: "Argument & Sources", icon: Target },
  ];

  const tabs = isNonfiction ? NF_TABS : FICTION_TABS;

  // ── CHARACTER HANDLERS ──
  const addCharacter = () => {
    const chars = [...(bible.characters || [])];
    if (chars.length >= 6) { toast.error("Maximum 6 characters"); return; }
    chars.push({ ...EMPTY_CHARACTER, id: `char_${Date.now()}`, role: chars.length === 0 ? "protagonist" : "supporting" });
    saveBible({ ...bible, characters: chars });
  };

  const updateCharacter = (idx, updated) => {
    const chars = [...(bible.characters || [])];
    chars[idx] = updated;
    saveBible({ ...bible, characters: chars });
  };

  const deleteCharacter = (idx) => {
    const chars = (bible.characters || []).filter((_, i) => i !== idx);
    saveBible({ ...bible, characters: chars });
  };

  // ── NF FIGURE HANDLERS ──
  const addFigure = () => {
    const figs = [...(bible.key_figures || [])];
    if (figs.length >= 8) { toast.error("Maximum 8 figures"); return; }
    figs.push({ ...EMPTY_NF_FIGURE, id: `fig_${Date.now()}` });
    saveBible({ ...bible, key_figures: figs });
  };

  const updateFigure = (idx, updated) => {
    const figs = [...(bible.key_figures || [])];
    figs[idx] = updated;
    saveBible({ ...bible, key_figures: figs });
  };

  const deleteFigure = (idx) => {
    const figs = (bible.key_figures || []).filter((_, i) => i !== idx);
    saveBible({ ...bible, key_figures: figs });
  };

  // ── WORLD HANDLERS ──
  const updateWorld = (field, value) => {
    saveBible({ ...bible, world: { ...bible.world, [field]: value } });
  };

  const addLocation = () => {
    const locs = [...(bible.world?.locations || [])];
    if (locs.length >= 5) { toast.error("Maximum 5 locations"); return; }
    locs.push({ name: "", significance: "" });
    saveBible({ ...bible, world: { ...bible.world, locations: locs } });
  };

  // ── THEME HANDLERS ──
  const updateThemes = (field, value) => {
    saveBible({ ...bible, themes: { ...bible.themes, [field]: value } });
  };

  // ── NF ARGUMENT HANDLERS ──
  const updateArgument = (field, value) => {
    saveBible({ ...bible, argument: { ...bible.argument, [field]: value } });
  };

  // ── NF TIMELINE HANDLERS ──
  const addTimelineEvent = () => {
    const tl = [...(bible.timeline || [])];
    if (tl.length >= 15) { toast.error("Maximum 15 timeline events"); return; }
    tl.push({ date: "", event: "", significance: "" });
    saveBible({ ...bible, timeline: tl });
  };

  const updateTimelineEvent = (idx, field, value) => {
    const tl = [...(bible.timeline || [])];
    tl[idx] = { ...tl[idx], [field]: value };
    saveBible({ ...bible, timeline: tl });
  };

  const deleteTimelineEvent = (idx) => {
    const tl = (bible.timeline || []).filter((_, i) => i !== idx);
    saveBible({ ...bible, timeline: tl });
  };

  // ── NF SETTINGS HANDLERS ──
  const addSetting = () => {
    const s = [...(bible.settings || [])];
    if (s.length >= 6) { toast.error("Maximum 6 settings"); return; }
    s.push({ name: "", era: "", significance: "", source_type: "" });
    saveBible({ ...bible, settings: s });
  };

  const updateSetting = (idx, field, value) => {
    const s = [...(bible.settings || [])];
    s[idx] = { ...s[idx], [field]: value };
    saveBible({ ...bible, settings: s });
  };

  const deleteSetting = (idx) => {
    const s = (bible.settings || []).filter((_, i) => i !== idx);
    saveBible({ ...bible, settings: s });
  };

  // ── NF SOURCE STRATEGY ──
  const updateSourceStrategy = (field, value) => {
    saveBible({ ...bible, source_strategy: { ...bible.source_strategy, [field]: value } });
  };

  // ═══ RENDER ═══
  return (
    <div className="space-y-4">
      {/* Header + Generate */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p style={{ fontSize: 12, color: '#52516a', lineHeight: 1.5, maxWidth: 500 }}>
          {isNonfiction
            ? "Define key figures, locations, timeline, thesis, and source strategy. This data feeds directly into chapter generation."
            : "Define your characters' psychology, voice DNA, world rules, and themes. Each chapter will enforce character voice consistency and connect to these layers."
          }
        </p>
        <Button
          onClick={handleGenerate}
          disabled={generating || !form.topic?.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 gap-2 text-xs h-9 shrink-0"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? "Generating..." : bible.characters?.length || bible.key_figures?.length ? "Regenerate Story Bible" : "Generate Story Bible from Premise"}
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-lg bg-slate-100">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-all",
                activeTab === tab.id
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══ FICTION: Characters Tab ═══ */}
      {!isNonfiction && activeTab === "characters" && (
        <div className="space-y-3">
          {(bible.characters || []).map((char, i) => (
            <CharacterCard key={char.id || i} char={char} index={i} allChars={bible.characters || []}
              onChange={updateCharacter} onDelete={deleteCharacter} />
          ))}
          {(bible.characters || []).length < 6 && (
            <button onClick={addCharacter} className="w-full rounded-xl border-2 border-dashed border-slate-200 py-4 text-sm text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Add Character {(bible.characters || []).length === 0 ? "(Start with your protagonist)" : ""}
            </button>
          )}
        </div>
      )}

      {/* ═══ FICTION: World & Setting Tab ═══ */}
      {!isNonfiction && activeTab === "world" && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Time Period</label>
              <Input value={bible.world?.time_period || ""} onChange={e => updateWorld("time_period", e.target.value)}
                placeholder="e.g. Present day, 1920s Chicago, Near future 2045" className="mt-1 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Primary Setting</label>
              <Input value={bible.world?.primary_setting || ""} onChange={e => updateWorld("primary_setting", e.target.value)}
                placeholder="e.g. Small coastal town in Oregon, Manhattan's Upper East Side" className="mt-1 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Social Hierarchy / Power Structure</label>
            <Textarea rows={2} value={bible.world?.social_hierarchy || ""} onChange={e => updateWorld("social_hierarchy", e.target.value)}
              placeholder="Who holds power? What are the social rules? What divides people?" className="mt-1 text-sm" />
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Sensory Palette</label>
            <Textarea rows={2} value={bible.world?.sensory_palette || ""} onChange={e => updateWorld("sensory_palette", e.target.value)}
              placeholder="Dominant sensory details that define this world — smells, textures, sounds, light quality..." className="mt-1 text-sm" />
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">World Rules / Constraints</label>
            <Textarea rows={3} value={(bible.world?.world_rules || []).join("\n")} onChange={e => updateWorld("world_rules", e.target.value.split("\n").filter(l => l.trim()))}
              placeholder="One rule per line — things that are true in this world that constrain character actions&#10;e.g. Everyone knows everyone's business&#10;The sea is both livelihood and danger&#10;Old money distrusts newcomers" className="mt-1 text-sm font-mono" />
          </div>

          {/* Locations */}
          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-2 block">Key Locations (up to 5)</label>
            <div className="space-y-2">
              {(bible.world?.locations || []).map((loc, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Input value={loc.name} onChange={e => {
                    const locs = [...(bible.world?.locations || [])];
                    locs[i] = { ...locs[i], name: e.target.value };
                    updateWorld("locations", locs);
                  }} placeholder="Location name" className="text-sm flex-1" />
                  <Input value={loc.significance} onChange={e => {
                    const locs = [...(bible.world?.locations || [])];
                    locs[i] = { ...locs[i], significance: e.target.value };
                    updateWorld("locations", locs);
                  }} placeholder="Why it matters" className="text-sm flex-1" />
                  <button onClick={() => {
                    const locs = (bible.world?.locations || []).filter((_, idx) => idx !== i);
                    updateWorld("locations", locs);
                  }} className="text-red-400 hover:text-red-600 mt-2"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
              {(bible.world?.locations || []).length < 5 && (
                <button onClick={addLocation} className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Location
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ FICTION: Themes Tab ═══ */}
      {!isNonfiction && activeTab === "themes" && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Central Theme</label>
            <Input value={bible.themes?.central_theme || ""} onChange={e => updateThemes("central_theme", e.target.value)}
              placeholder="The one-sentence heart of your story — what it's really about beneath the plot" className="mt-1 text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Thematic Question</label>
            <Input value={bible.themes?.thematic_question || ""} onChange={e => updateThemes("thematic_question", e.target.value)}
              placeholder="The unanswered question your story explores — e.g. 'Can you heal without being vulnerable?'" className="mt-1 text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Recurring Motifs & Symbols</label>
            <Textarea rows={3} value={(bible.themes?.motifs || []).join("\n")} onChange={e => updateThemes("motifs", e.target.value.split("\n").filter(l => l.trim()))}
              placeholder="One per line — images, objects, or ideas that recur throughout&#10;e.g. Water/drowning imagery&#10;Locked doors and keys&#10;Old photographs" className="mt-1 text-sm font-mono" />
          </div>
        </div>
      )}

      {/* ═══ NONFICTION: Key Figures Tab ═══ */}
      {isNonfiction && activeTab === "figures" && (
        <div className="space-y-3">
          {(bible.key_figures || []).map((fig, i) => (
            <FigureCard key={fig.id || i} figure={fig} index={i} onChange={updateFigure} onDelete={deleteFigure} />
          ))}
          {(bible.key_figures || []).length < 8 && (
            <button onClick={addFigure} className="w-full rounded-xl border-2 border-dashed border-slate-200 py-4 text-sm text-slate-400 hover:border-amber-300 hover:text-amber-600 transition-colors flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Add Key Figure
            </button>
          )}
        </div>
      )}

      {/* ═══ NONFICTION: Settings & Timeline Tab ═══ */}
      {isNonfiction && activeTab === "settings" && (
        <div className="space-y-6">
          {/* Settings */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Key Settings & Locations (up to 6)
            </label>
            {(bible.settings || []).map((s, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 items-start">
                <Input value={s.name} onChange={e => updateSetting(i, "name", e.target.value)} placeholder="Location name" className="text-sm" />
                <Input value={s.era} onChange={e => updateSetting(i, "era", e.target.value)} placeholder="Era" className="text-sm" />
                <Input value={s.significance} onChange={e => updateSetting(i, "significance", e.target.value)} placeholder="Significance" className="text-sm" />
                <div className="flex gap-1">
                  <Input value={s.source_type} onChange={e => updateSetting(i, "source_type", e.target.value)} placeholder="Source type" className="text-sm flex-1" />
                  <button onClick={() => deleteSetting(i)} className="text-red-400 hover:text-red-600 mt-2"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
            {(bible.settings || []).length < 6 && (
              <button onClick={addSetting} className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Setting
              </button>
            )}
          </div>

          {/* Timeline */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <Clock className="w-3 h-3" /> Key Timeline Events (up to 15)
            </label>
            {(bible.timeline || []).map((evt, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 items-start">
                <Input value={evt.date} onChange={e => updateTimelineEvent(i, "date", e.target.value)} placeholder="Date/Year" className="text-sm" />
                <Input value={evt.event} onChange={e => updateTimelineEvent(i, "event", e.target.value)} placeholder="Event" className="text-sm" />
                <div className="flex gap-1">
                  <Input value={evt.significance} onChange={e => updateTimelineEvent(i, "significance", e.target.value)} placeholder="Significance" className="text-sm flex-1" />
                  <button onClick={() => deleteTimelineEvent(i)} className="text-red-400 hover:text-red-600 mt-2"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
            {(bible.timeline || []).length < 15 && (
              <button onClick={addTimelineEvent} className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Timeline Event
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══ NONFICTION: Argument & Sources Tab ═══ */}
      {isNonfiction && activeTab === "argument" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <Target className="w-3 h-3" /> Argument Structure
            </label>
            <div>
              <label className="text-[10px] font-medium text-slate-500">Central Thesis</label>
              <Textarea rows={2} value={bible.argument?.central_thesis || ""} onChange={e => updateArgument("central_thesis", e.target.value)}
                placeholder="The single core argument your book makes — what you're proving..." className="mt-1 text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-slate-500">Supporting Arguments (one per line)</label>
              <Textarea rows={4} value={(bible.argument?.supporting_arguments || []).join("\n")}
                onChange={e => updateArgument("supporting_arguments", e.target.value.split("\n").filter(l => l.trim()))}
                placeholder="Each line is a pillar of your argument&#10;e.g. Contract structure created legal ownership of human beings&#10;Medical departments weaponized pharmaceutical dependency&#10;Publicity machines manufactured consent" className="mt-1 text-sm font-mono" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-slate-500">Counter-Arguments to Address</label>
              <Textarea rows={3} value={(bible.argument?.counter_arguments || []).join("\n")}
                onChange={e => updateArgument("counter_arguments", e.target.value.split("\n").filter(l => l.trim()))}
                placeholder="Arguments against your thesis that you need to address&#10;e.g. Studios provided stability and career development&#10;Many performers thrived under the system" className="mt-1 text-sm font-mono" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <FileText className="w-3 h-3" /> Source Strategy
            </label>
            <div>
              <label className="text-[10px] font-medium text-slate-500">Primary Sources (one per line)</label>
              <Textarea rows={3} value={(bible.source_strategy?.primary_sources || []).join("\n")}
                onChange={e => updateSourceStrategy("primary_sources", e.target.value.split("\n").filter(l => l.trim()))}
                placeholder="e.g. Studio archives (Margaret Herrick Library)&#10;Court records (LA Superior Court)&#10;Medical records (Cedars-Sinai archives)" className="mt-1 text-sm font-mono" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-slate-500">Secondary Sources (one per line)</label>
              <Textarea rows={3} value={(bible.source_strategy?.secondary_sources || []).join("\n")}
                onChange={e => updateSourceStrategy("secondary_sources", e.target.value.split("\n").filter(l => l.trim()))}
                placeholder="e.g. Biographies of studio heads&#10;Academic studies of the studio system&#10;Oral histories from performers" className="mt-1 text-sm font-mono" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-slate-500">Source Limitations</label>
              <Textarea rows={2} value={bible.source_strategy?.source_limitations || ""}
                onChange={e => updateSourceStrategy("source_limitations", e.target.value)}
                placeholder="Known gaps in available evidence — what can't be verified..." className="mt-1 text-sm" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
