import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MapPin, Users, RefreshCw, ChevronDown, ChevronRight, Pencil, X, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

function safeParse(str) {
  try {
    if (!str || str.trim() === 'null' || str.trim() === '[]' || str.trim() === '') return null;
    return JSON.parse(str);
  } catch { return null; }
}

function SceneCard({ scene, onEdit, onDelete }) {
  return (
    <div className="bg-white border border-indigo-100 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
            {scene.scene_number}
          </span>
          <span className="font-semibold text-sm text-slate-800 truncate">{scene.title}</span>
        </div>
        <div className="flex gap-0.5 flex-shrink-0">
          <button onClick={onEdit} className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="flex items-start gap-1.5">
          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
          <span className="text-slate-600 leading-snug">{scene.location}</span>
        </div>
        <div className="flex items-start gap-1.5">
          <Users className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
          <span className="text-slate-600 leading-snug">
            {Array.isArray(scene.characters_present) ? scene.characters_present.join(', ') : scene.characters_present}
          </span>
        </div>
      </div>

      <div className="bg-indigo-50 rounded p-2 text-xs">
        <span className="font-semibold text-indigo-700">Key Action: </span>
        <span className="text-indigo-800">{scene.key_action}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
        <div>
          <span className="font-medium text-slate-400 block text-[10px] uppercase tracking-wide">Emotional Arc</span>
          {scene.emotional_arc}
        </div>
        <div>
          <span className="font-medium text-slate-400 block text-[10px] uppercase tracking-wide">Sensory Anchor</span>
          {scene.sensory_anchor}
        </div>
        <div>
          <span className="font-medium text-slate-400 block text-[10px] uppercase tracking-wide">Word Target</span>
          ~{scene.word_target} words
        </div>
      </div>

      {scene.extra_instructions && (
        <p className="text-xs text-slate-400 italic">{scene.extra_instructions}</p>
      )}
    </div>
  );
}

function SceneEditor({ scene, onSave, onCancel }) {
  const [form, setForm] = useState({
    ...scene,
    characters_present: Array.isArray(scene.characters_present)
      ? scene.characters_present.join(', ')
      : (scene.characters_present || ''),
    dialogue_focus: scene.dialogue_focus || '',
    extra_instructions: scene.extra_instructions || '',
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = () => {
    onSave({
      ...form,
      characters_present: form.characters_present
        ? form.characters_present.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      dialogue_focus: form.dialogue_focus || null,
      word_target: parseInt(form.word_target) || scene.word_target,
    });
  };

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
          {scene.scene_number}
        </span>
        <span className="text-xs font-semibold text-indigo-700">Editing Scene {scene.scene_number}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { key: 'title', label: 'Title', span: 1 },
          { key: 'pov', label: 'POV', span: 1 },
          { key: 'location', label: 'Location', span: 2 },
          { key: 'time', label: 'Time', span: 1 },
          { key: 'characters_present', label: 'Characters (comma-separated)', span: 1 },
          { key: 'purpose', label: 'Purpose', span: 2 },
          { key: 'emotional_arc', label: 'Emotional Arc', span: 1 },
          { key: 'sensory_anchor', label: 'Sensory Anchor', span: 1 },
          { key: 'dialogue_focus', label: 'Dialogue Focus (empty = action)', span: 1 },
          { key: 'word_target', label: 'Word Target', span: 1, type: 'number' },
        ].map(({ key, label, span, type }) => (
          <div key={key} className={span === 2 ? 'col-span-2' : ''}>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5 block">{label}</label>
            <Input
              className="h-7 text-xs"
              type={type || 'text'}
              value={form[key] ?? ''}
              onChange={e => set(key, e.target.value)}
            />
          </div>
        ))}
        <div className="col-span-2">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5 block">Key Action (must happen)</label>
          <Textarea className="text-xs" rows={2} value={form.key_action || ''} onChange={e => set('key_action', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5 block">Extra Instructions</label>
          <Textarea className="text-xs" rows={2} value={form.extra_instructions} onChange={e => set('extra_instructions', e.target.value)} />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700" onClick={handleSave}>Save</Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export default function SceneSection({ chapter, onScenesUpdated }) {
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [editingIdx, setEditingIdx] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const scenes = safeParse(chapter.scenes);
  const hasScenes = Array.isArray(scenes) && scenes.length > 0;

  const saveScenes = async (newScenes) => {
    await base44.entities.Chapter.update(chapter.id, { scenes: JSON.stringify(newScenes) });
    if (onScenesUpdated) onScenesUpdated();
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await base44.functions.invoke('generateScenes', {
        projectId: chapter.project_id,
        chapterNumber: chapter.chapter_number,
      });
      // Poll until scenes appear
      let polls = 0;
      while (polls < 45) {
        await new Promise(r => setTimeout(r, 2000));
        polls++;
        const updated = await base44.entities.Chapter.filter({ project_id: chapter.project_id });
        const updCh = updated.find(c => c.id === chapter.id);
        if (updCh?.scenes && updCh.scenes.trim() !== 'null' && updCh.scenes.trim() !== '[]') break;
      }
      if (onScenesUpdated) onScenesUpdated();
    } catch (err) {
      console.error('generateScenes error:', err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    setGenerating(true);
    try {
      await base44.entities.Chapter.update(chapter.id, { scenes: null });
      await base44.functions.invoke('generateScenes', {
        projectId: chapter.project_id,
        chapterNumber: chapter.chapter_number,
      });
      let polls = 0;
      while (polls < 45) {
        await new Promise(r => setTimeout(r, 2000));
        polls++;
        const updated = await base44.entities.Chapter.filter({ project_id: chapter.project_id });
        const updCh = updated.find(c => c.id === chapter.id);
        if (updCh?.scenes && updCh.scenes.trim() !== 'null' && updCh.scenes.trim() !== '[]') break;
      }
      if (onScenesUpdated) onScenesUpdated();
    } catch (err) {
      console.error('regenerateScenes error:', err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleClear = async () => {
    await base44.entities.Chapter.update(chapter.id, { scenes: null });
    setConfirmClear(false);
    if (onScenesUpdated) onScenesUpdated();
  };

  const handleEditSave = async (idx, updatedScene) => {
    const newScenes = scenes.map((s, i) => i === idx ? updatedScene : s);
    await saveScenes(newScenes);
    setEditingIdx(null);
  };

  const handleDeleteScene = async (idx) => {
    if (!confirm(`Remove Scene ${scenes[idx].scene_number}: "${scenes[idx].title}"?`)) return;
    const newScenes = scenes.filter((_, i) => i !== idx).map((s, i) => ({ ...s, scene_number: i + 1 }));
    await saveScenes(newScenes);
  };

  if (!hasScenes) {
    return (
      <div className="border-t border-dashed border-slate-200 pt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400 italic">No scenes yet. Generate scenes to give the AI structured guardrails.</p>
        <Button
          size="sm"
          className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 flex-shrink-0"
          disabled={generating}
          onClick={handleGenerate}
        >
          {generating
            ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Generating…</>
            : <><LayoutGrid className="w-3 h-3 mr-1" />Generate Scenes</>}
        </Button>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-100 pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Scenes</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">{scenes.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[11px] px-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            disabled={generating}
            onClick={handleRegenerate}
          >
            {generating
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <><RefreshCw className="w-3 h-3 mr-1" />Regenerate</>}
          </Button>
          {confirmClear ? (
            <span className="text-[11px] flex items-center gap-1">
              <button className="text-red-600 font-semibold" onClick={handleClear}>Confirm</button>
              <button className="text-slate-400" onClick={() => setConfirmClear(false)}>Cancel</button>
            </span>
          ) : (
            <button className="text-[11px] text-red-400 hover:text-red-600" onClick={() => setConfirmClear(true)}>Clear</button>
          )}
          <button
            className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? <><ChevronDown className="w-3 h-3" />Collapse</> : <><ChevronRight className="w-3 h-3" />Expand</>}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-2">
          {scenes.map((scene, idx) =>
            editingIdx === idx ? (
              <SceneEditor
                key={idx}
                scene={scene}
                onSave={(updated) => handleEditSave(idx, updated)}
                onCancel={() => setEditingIdx(null)}
              />
            ) : (
              <SceneCard
                key={idx}
                scene={scene}
                onEdit={() => setEditingIdx(idx)}
                onDelete={() => handleDeleteScene(idx)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}