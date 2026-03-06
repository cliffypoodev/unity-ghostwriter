import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Loader2, Send, ArrowRight, BookOpen, MessageSquare, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import SourceFilesCard from "./SourceFilesCard";
import PromptSuggestions from "./PromptSuggestions";

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
    tone_style: "",
    author_voice: "basic",
    additional_requirements: "",
  });
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [subgenresData, setSubgenresData] = useState({});
  const [authorsData, setAuthorsData] = useState([]);
  const chatBottomRef = useRef(null);

  // Load config data on mount
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const [subRes, authRes] = await Promise.all([
          base44.functions.invoke('configSubgenres', {}),
          base44.functions.invoke('configAuthors', {}),
        ]);
        setSubgenresData(subRes.data || {});
        setAuthorsData(authRes.data || []);
      } catch (err) {
        console.error('Failed to load configs:', err);
      }
    };
    loadConfigs();
  }, []);

  // Load existing spec
  const { data: specs = [] } = useQuery({
    queryKey: ["specification", projectId],
    queryFn: () => base44.entities.Specification.filter({ project_id: projectId }),
  });
  const spec = specs[0];

  useEffect(() => {
    if (spec) {
      setForm(prev => ({ ...prev, ...spec }));
    }
  }, [spec]);

  // Load conversation
  const { data: messages = [] } = useQuery({
    queryKey: ["conversations", projectId],
    queryFn: () => base44.entities.Conversation.filter({ project_id: projectId }, "created_date"),
    refetchInterval: false,
  });

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form };
      ["id", "created_date", "updated_date", "created_by"].forEach(k => delete payload[k]);
      if (spec) return base44.entities.Specification.update(spec.id, payload);
      return base44.entities.Specification.create(payload);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["specification", projectId] }),
  });

  const sendMessage = async () => {
    if (!chatInput.trim() || isChatting) return;
    const msg = chatInput.trim();
    setChatInput("");
    setIsChatting(true);
    try {
      await base44.functions.invoke('bookConsultantChat', { 
        project_id: projectId, 
        message: msg, 
        spec: form 
      });
      await queryClient.invalidateQueries({ queryKey: ["conversations", projectId] });
    } finally {
      setIsChatting(false);
    }
  };

  const handleChange = (field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === "book_type") {
        updated.genre = "";
        updated.subgenre = "";
      }
      if (field === "genre") {
        updated.subgenre = "";
      }
      return updated;
    });
  };

  const handleAutoExtract = async () => {
    if (!form.topic.trim()) {
      toast.error("Please enter a topic/premise first");
      return;
    }
    setExtracting(true);
    try {
      const response = await base44.functions.invoke('extractMetadata', {
        projectId,
        topic: form.topic,
        book_type: form.book_type,
        genre: form.genre,
      });
      
      const extracted = response.data;
      setForm(prev => ({
        ...prev,
        tone_style: prev.tone_style || extracted.tone_style || "",
        target_audience: prev.target_audience || extracted.target_audience || "",
        additional_requirements: prev.additional_requirements || extracted.additional_requirements || "",
        genre: prev.genre || extracted.suggested_genre || prev.genre,
        subgenre: prev.subgenre || extracted.suggested_subgenre || "",
        author_voice: prev.author_voice || extracted.suggested_author_voice || "basic",
        detail_level: prev.detail_level || extracted.suggested_detail_level || prev.detail_level,
      }));
      toast.success("Extracted metadata from premise");
    } catch (err) {
      console.error('Extract error:', err);
      toast.error("Failed to extract metadata");
    } finally {
      setExtracting(false);
    }
  };

  const canProceed = form.book_type && form.genre && form.topic?.trim();
  const genres = form.book_type === "fiction" ? FICTION_GENRES : NONFICTION_GENRES;
  const currentSubgenres = form.genre && subgenresData[form.book_type]?.[form.genre] ? subgenresData[form.book_type][form.genre] : [];
  const selectedAuthor = authorsData.find(a => a.id === form.author_voice);

  return (
    <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT: Project Settings */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-4 h-4 text-indigo-500" />
            Project Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Book Type */}
          <div>
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
          <div>
            <Label className="text-sm font-medium">Genre / Category</Label>
            <Select value={form.genre} onValueChange={v => handleChange("genre", v)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select genre..." /></SelectTrigger>
              <SelectContent>
                {genres.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Topic */}
           <div>
             <Label className="text-sm font-medium">Topic / Premise</Label>
             <Textarea
               className="mt-1.5"
               rows={3}
               placeholder="A story about..."
               value={form.topic}
               onChange={e => handleChange("topic", e.target.value)}
             />
             <Button
               onClick={handleAutoExtract}
               disabled={!form.topic.trim() || extracting}
               variant="outline"
               size="sm"
               className="mt-2 w-full"
             >
               {extracting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
               Auto-Extract Details from Premise
             </Button>
           </div>

           {/* Prompt Catalog Suggestions */}
           <PromptSuggestions
             bookType={form.book_type}
             genre={form.genre}
             onSelect={(entry) => {
               handleChange("topic", entry.series_title + (entry.description ? ` — ${entry.description}` : ""));
             }}
           />

          {/* Target Length */}
          <div>
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
            <Label className="text-sm font-medium">Chapter Count <span className="text-slate-400 font-normal">(optional — overrides target length)</span></Label>
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
          <div>
            <Label className="text-sm font-medium">Detail Level</Label>
            <Select value={form.detail_level} onValueChange={v => handleChange("detail_level", v)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DETAIL_LEVELS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Target Audience */}
          <div>
            <Label className="text-sm font-medium">Target Audience</Label>
            <Input
              className="mt-1.5"
              placeholder="e.g. Young adults aged 16–25..."
              value={form.target_audience}
              onChange={e => handleChange("target_audience", e.target.value)}
            />
          </div>

          {/* Tone & Style */}
          <div>
            <Label className="text-sm font-medium">Tone & Style</Label>
            <Input
              className="mt-1.5"
              placeholder="e.g. Dark, gritty, with dry humor..."
              value={form.tone_style}
              onChange={e => handleChange("tone_style", e.target.value)}
            />
          </div>

          {/* Additional Requirements */}
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

      {/* RIGHT: AI Book Consultant */}
      <Card className="border-slate-200 shadow-sm flex flex-col">
        <CardHeader className="pb-4 flex-shrink-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4 text-indigo-500" />
            AI Book Consultant
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 p-4 pt-0">
          {/* Messages */}
          <div className="flex-1 h-[400px] overflow-y-auto space-y-3 pr-1 mb-4">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-slate-400">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Ask me anything about your book concept!</p>
                  <p className="text-xs mt-1 text-slate-300">I'll help refine your idea, suggest genres, and more.</p>
                </div>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                  msg.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-800"
                )}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
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
          <div className="flex gap-2 flex-shrink-0">
            <Input
              placeholder="Ask about genres, plot ideas, audience..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              disabled={isChatting}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!chatInput.trim() || isChatting}
              className="bg-indigo-600 hover:bg-indigo-700 px-3"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
    <SourceFilesCard projectId={projectId} />
  </div>
  );
}