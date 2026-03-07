import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Loader2, Send, ArrowRight, BookOpen, MessageSquare, Wand2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import SourceFilesCard from "./SourceFilesCard";
import PromptSuggestions from "./PromptSuggestions";
import PromptCatalogBrowser from "./PromptCatalogBrowser";
import AuthorVoiceSelector from "./AuthorVoiceSelector";
import { BeatStyleSelect, SpiceLevelSelect, LanguageIntensitySelect } from "./BeatStyleSelector";
import ModelSuggestionPanel from "./ModelSuggestionPanel";

const FICTION_GENRES = ["Fantasy", "Science Fiction", "Mystery", "Thriller", "Romance", "Historical Fiction", "Horror", "Literary Fiction", "Adventure", "Dystopian", "Young Adult", "Crime", "Magical Realism", "Western", "Satire"];
const NONFICTION_GENRES = ["Self-Help", "Business", "Biography", "History", "Science", "Technology", "Philosophy", "Psychology", "Health", "Travel", "Education", "Politics", "True Crime", "Memoir", "Cooking"];

const TARGET_LENGTHS = [
  { value: "short", label: "Short (25K–50K words)" },
  { value: "medium", label: "Medium (50K–100K words)" },
  { value: "long", label: "Long (100K–150K words)" },
  { value: "epic", label: "Epic (150K–200K+ words)" },
];

const DETAIL_LEVELS = [
  { value: "minimal", label: "Minimal" },
  { value: "moderate", label: "Moderate" },
  { value: "comprehensive", label: "Comprehensive" },
];

// ─── Floating Chat Widget ────────────────────────────────────────────────────

function FloatingChat({ projectId, form }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [pulsing, setPulsing] = useState(true);
  const chatBottomRef = useRef(null);

  // Stop pulse after 4 seconds
  useEffect(() => {
    const t = setTimeout(() => setPulsing(false), 4000);
    return () => clearTimeout(t);
  }, []);

  const { data: messages = [] } = useQuery({
    queryKey: ["conversations", projectId],
    queryFn: () => base44.entities.Conversation.filter({ project_id: projectId }, "created_date"),
    refetchInterval: false,
  });

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [messages, isOpen, isChatting]);

  const sendMessage = async () => {
    if (!chatInput.trim() || isChatting) return;
    const msg = chatInput.trim();
    setChatInput("");
    setIsChatting(true);
    try {
      await base44.functions.invoke('bookConsultantChat', {
        project_id: projectId,
        message: msg,
        spec: form,
      });
      await queryClient.invalidateQueries({ queryKey: ["conversations", projectId] });
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes chat-pulse {
          0%, 100% { box-shadow: 0 4px 12px rgba(124,58,237,0.4), 0 0 0 0 rgba(124,58,237,0.4); }
          50% { box-shadow: 0 4px 12px rgba(124,58,237,0.4), 0 0 0 10px rgba(124,58,237,0); }
        }
        .chat-fab-pulse { animation: chat-pulse 1.5s ease-in-out 3; }
        .chat-popup-enter {
          animation: chat-popup-in 0.2s ease-out;
        }
        @keyframes chat-popup-in {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {/* Popup window */}
      {isOpen && (
        <div
          className="chat-popup-enter"
          style={{
            position: "fixed",
            bottom: "84px",
            right: "20px",
            width: "380px",
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "500px",
            background: "white",
            borderRadius: "16px",
            boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{ background: "#7c3aed", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-white" />
              <span className="text-white font-semibold text-sm">AI Book Consultant</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
            {messages.length === 0 && !isChatting && (
              <div className="flex items-center justify-center h-full py-8">
                <div className="text-center text-slate-400">
                  <MessageSquare className="w-7 h-7 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Ask me anything about your book concept!</p>
                  <p className="text-xs mt-1 text-slate-300">Genre suggestions, plot ideas, and more.</p>
                </div>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                  msg.role === "user" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-800"
                )}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
            {isChatting && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "12px", borderTop: "1px solid #f1f5f9", flexShrink: 0, display: "flex", gap: "8px" }}>
            <Input
              placeholder="Ask about your book idea..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              disabled={isChatting}
              className="flex-1 text-sm"
            />
            <Button
              onClick={sendMessage}
              disabled={!chatInput.trim() || isChatting}
              size="icon"
              style={{ background: "#7c3aed", border: "none", flexShrink: 0 }}
              className="hover:opacity-90"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className={cn(pulsing && !isOpen ? "chat-fab-pulse" : "")}
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "#7c3aed",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          zIndex: 999,
          transition: "transform 0.15s ease, background 0.15s ease",
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.08)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        aria-label={isOpen ? "Close chat" : "Open AI Book Consultant"}
      >
        {isOpen
          ? <X className="w-5 h-5 text-white" />
          : <MessageSquare className="w-5 h-5 text-white" />
        }
      </button>
    </>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SpecificationTab({ projectId, onProceed }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    project_id: projectId,
    book_type: "fiction",
    genre: "",
    subgenre: "",
    topic: "",
    target_length: "medium",
    chapter_count: "",
    detail_level: "moderate",
    target_audience: "",
    beat_style: "",
    tone_style: "",
    spice_level: 0,
    language_intensity: 0,
    author_voice: "basic",
    additional_requirements: "",
  });
  const [extracting, setExtracting] = useState(false);
  const [highlightedFields, setHighlightedFields] = useState({});
  const [showCatalogBrowser, setShowCatalogBrowser] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  // Load subgenres config
  const [subgenresData, setSubgenresData] = useState({});
  useEffect(() => {
    base44.functions.invoke('configSubgenres', {})
      .then(res => setSubgenresData(res.data || {}))
      .catch(err => console.error('Failed to load configs:', err));
  }, []);

  // Load existing spec
  const { data: specs = [] } = useQuery({
    queryKey: ["specification", projectId],
    queryFn: () => base44.entities.Specification.filter({ project_id: projectId }),
  });
  const spec = specs[0];

  useEffect(() => {
    if (spec) {
      setForm(prev => ({
        ...prev,
        ...spec,
        beat_style: spec.beat_style || spec.tone_style || "",
        spice_level: spec.spice_level ?? 0,
        language_intensity: spec.language_intensity ?? 0,
      }));
    }
  }, [spec]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form };
      ["id", "created_date", "updated_date", "created_by"].forEach(k => delete payload[k]);
      if (spec) return base44.entities.Specification.update(spec.id, payload);
      return base44.entities.Specification.create(payload);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["specification", projectId] }),
  });

  const handleChange = (field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === "book_type") { updated.genre = ""; updated.subgenre = ""; }
      if (field === "genre") { updated.subgenre = ""; }
      return updated;
    });
  };

  const handleAutoExtract = async () => {
    if (!form.topic.trim()) { toast.error("Please enter a topic/premise first"); return; }
    setExtracting(true);
    try {
      const response = await base44.functions.invoke('extractMetadata', {
        projectId, topic: form.topic, book_type: form.book_type, genre: form.genre,
      });
      const e = response.data;
      const filled = [];

      setForm(prev => {
        const next = { ...prev };
        const fill = (field, val) => {
          if (val && !prev[field]) { next[field] = val; filled.push(field); }
        };
        fill("genre",                  e.suggested_genre);
        fill("subgenre",               e.suggested_subgenre);
        fill("target_audience",        e.target_audience);
        fill("beat_style",             e.suggested_beat_style);
        fill("tone_style",             e.tone_style);
        fill("author_voice",           e.suggested_author_voice);
        fill("detail_level",           e.suggested_detail_level);
        fill("ai_model",               e.suggested_ai_model);
        fill("additional_requirements",e.additional_requirements);
        return next;
      });

      // Highlight filled fields briefly
      if (filled.length > 0) {
        const highlights = {};
        filled.forEach(f => { highlights[f] = true; });
        setHighlightedFields(highlights);
        setTimeout(() => setHighlightedFields({}), 1800);
      }

      const genre   = form.genre || e.suggested_genre || "";
      const subgenre = e.suggested_subgenre || "";
      const voice   = e.suggested_author_voice || "";
      toast.success(`Auto-detected: ${genre}${subgenre ? " / " + subgenre : ""}${voice ? " — " + voice + " voice" : ""}`);
    } catch (err) {
      console.error('Extract error:', err);
      toast.error("Failed to extract metadata");
    } finally {
      setExtracting(false);
    }
  };

  const handleSelectPrompt = (prompt) => {
    if (form.topic.trim()) {
      if (!window.confirm(`Replace current premise with "${prompt.title}"?`)) return;
    }
    setForm(prev => ({
      ...prev,
      topic: prompt.content,
      genre: prompt.genre || prev.genre,
      book_type: prompt.book_type || prev.book_type,
    }));
  };

  const canProceed = form.book_type && form.genre && form.topic?.trim();
  const genres = form.book_type === "fiction" ? FICTION_GENRES : NONFICTION_GENRES;
  const currentSubgenres = form.genre && subgenresData[form.book_type]?.[form.genre]
    ? subgenresData[form.book_type][form.genre] : [];

  const hl = (field) => highlightedFields[field]
    ? "ring-2 ring-violet-400 ring-offset-1 rounded-md transition-all duration-500"
    : "";

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes field-glow {
          0%   { box-shadow: 0 0 0 0 rgba(124,58,237,0.5); }
          50%  { box-shadow: 0 0 0 6px rgba(124,58,237,0.15); }
          100% { box-shadow: 0 0 0 0 rgba(124,58,237,0); }
        }
        .field-highlight { animation: field-glow 1.8s ease-out; }
      `}</style>
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-4 h-4 text-indigo-500" />
            Project Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Topic / Premise — full width */}
          <div>
            <Label className="text-sm font-medium">Topic / Premise</Label>
            <Textarea
              className="mt-1.5"
              rows={3}
              placeholder="A story about..."
              value={form.topic}
              onChange={e => handleChange("topic", e.target.value)}
            />
            <div className="flex gap-2 mt-2">
              <Button
                onClick={handleAutoExtract}
                disabled={!form.topic.trim() || extracting}
                variant="outline"
                size="sm"
              >
                {extracting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                {extracting ? "Analyzing..." : "Auto-Extract Metadata"}
              </Button>
              <Button onClick={() => setShowCatalogBrowser(true)} variant="outline" size="sm">
                <Search className="w-4 h-4 mr-2" /> Browse Catalog
              </Button>
            </div>
          </div>

          {/* Prompt Catalog Suggestions */}
          <PromptSuggestions
            bookType={form.book_type}
            genre={form.genre}
            onSelect={handleSelectPrompt}
            onBrowseAll={() => setShowCatalogBrowser(true)}
          />

          {/* 2-column grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left column */}
            <div className="space-y-4">
              {/* Book Type */}
              <div className={hl("book_type")}>
                <Label className="text-sm font-medium">Book Type</Label>
                <Select value={form.book_type} onValueChange={v => handleChange("book_type", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fiction">Fiction</SelectItem>
                    <SelectItem value="nonfiction">Nonfiction</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Genre */}
              <div className={hl("genre")}>
                <Label className="text-sm font-medium">Genre / Category</Label>
                <Select value={form.genre} onValueChange={v => handleChange("genre", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select genre..." /></SelectTrigger>
                  <SelectContent>
                    {genres.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Subgenre */}
              {currentSubgenres.length > 0 && (
                <div className={hl("subgenre")}>
                  <Label className="text-sm font-medium">Subgenre <span className="text-slate-400 font-normal">(optional)</span></Label>
                  <Select value={form.subgenre} onValueChange={v => handleChange("subgenre", v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select a subgenre..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>None</SelectItem>
                      {currentSubgenres.map(sg => <SelectItem key={sg} value={sg}>{sg}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Target Length */}
              <div className={hl("target_length")}>
                <Label className="text-sm font-medium">Target Length</Label>
                <Select value={form.target_length} onValueChange={v => handleChange("target_length", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TARGET_LENGTHS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Chapter Count */}
              <div>
                <Label className="text-sm font-medium">Chapter Count <span className="text-slate-400 font-normal">(optional)</span></Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min={1}
                  max={100}
                  placeholder="e.g. 20"
                  value={form.chapter_count || ""}
                  onChange={e => handleChange("chapter_count", e.target.value ? parseInt(e.target.value) : "")}
                />
              </div>

              {/* Detail Level */}
              <div className={hl("detail_level")}>
                <Label className="text-sm font-medium">Detail Level</Label>
                <Select value={form.detail_level} onValueChange={v => handleChange("detail_level", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DETAIL_LEVELS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {/* Target Audience */}
              <div className={hl("target_audience")}>
                <Label className="text-sm font-medium">Target Audience</Label>
                <Input
                  className="mt-1.5"
                  placeholder="e.g. Young adults aged 16–25..."
                  value={form.target_audience}
                  onChange={e => handleChange("target_audience", e.target.value)}
                />
              </div>

              {/* Beat Style */}
              <div className={hl("beat_style")}>
                <Label className="text-sm font-medium">Beat Style</Label>
                <BeatStyleSelect value={form.beat_style} onChange={v => handleChange("beat_style", v)} />
              </div>

              {/* Spice Level */}
              <div>
                <Label className="text-sm font-medium">Spice Level</Label>
                <SpiceLevelSelect value={form.spice_level} onChange={v => handleChange("spice_level", v)} />
              </div>

              {/* Language Intensity */}
              <div>
                <Label className="text-sm font-medium">Language Intensity</Label>
                <LanguageIntensitySelect value={form.language_intensity} onChange={v => handleChange("language_intensity", v)} />
              </div>

              {/* Author Voice */}
              <div className={hl("author_voice")}>
                <Label className="text-sm font-medium">Author Voice</Label>
                <AuthorVoiceSelector value={form.author_voice} onValueChange={v => handleChange("author_voice", v)} />
              </div>

              {/* AI Model */}
              <div className={hl("ai_model")}>
              <ModelSuggestionPanel
                genre={form.genre}
                selectedModel={form.ai_model}
                onSelectModel={(id) => handleChange("ai_model", id)}
              />
            </div>
          </div>

          {/* Additional Requirements — full width */}
          <div>
            <Label className="text-sm font-medium">Additional Requirements</Label>
            <Textarea
              className="mt-1.5"
              rows={2}
              placeholder="Any other requirements or notes..."
              value={form.additional_requirements}
              onChange={e => handleChange("additional_requirements", e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              variant="outline"
              className="flex-1"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Specifications
            </Button>
            <Button
              disabled={!canProceed}
              onClick={onProceed}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
              Proceed to Outline
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <SourceFilesCard projectId={projectId} />

      {/* Prompt Catalog Browser Modal */}
      <PromptCatalogBrowser
        isOpen={showCatalogBrowser}
        onClose={() => setShowCatalogBrowser(false)}
        onSelectPrompt={handleSelectPrompt}
        preselectedGenre={form.genre}
        preselectedBookType={form.book_type}
      />

      {/* Floating Chat Widget */}
      <FloatingChat projectId={projectId} form={form} />
    </div>
  );
}