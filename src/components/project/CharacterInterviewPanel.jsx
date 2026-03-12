import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Send, UserCircle, X, BookOpen, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const STARTER_QUESTIONS = [
  "What's the best thing that ever happened to you?",
  "What's the worst thing you've ever done?",
  "What keeps you up at night?",
  "What are you afraid people will find out?",
  "What do you want more than anything?",
  "Who do you blame for how your life turned out?",
  "When did you last cry?",
  "What would you sacrifice everything for?",
  "What do you pretend not to care about?",
  "Who in your life do you not trust?",
];

export default function CharacterInterviewPanel({ projectId, premise, genre, onBack }) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState("setup"); // setup | interview | summary
  const [characterName, setCharacterName] = useState("");
  const [characterDescription, setCharacterDescription] = useState("");
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [addingToBible, setAddingToBible] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, loading]);

  const sendQuestion = async (q) => {
    const msg = q || question;
    if (!msg.trim() || loading) return;
    setQuestion("");
    const newConv = [...conversation, { role: "user", content: msg }];
    setConversation(newConv);
    setLoading(true);
    try {
      const res = await base44.functions.invoke('characterInterview', {
        action: 'interview',
        project_id: projectId,
        character_name: characterName,
        character_description: characterDescription,
        question: msg,
        conversation_history: newConv,
        premise,
        genre,
      });
      setConversation([...newConv, { role: "assistant", content: res.data.response }]);
    } catch (err) {
      console.error('Interview error:', err);
      setConversation([...newConv, { role: "assistant", content: "I... I don't know how to answer that right now." }]);
    } finally {
      setLoading(false);
    }
  };

  const endInterview = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('characterInterview', {
        action: 'summarize',
        project_id: projectId,
        character_name: characterName,
        character_description: characterDescription,
        conversation_history: conversation,
        premise,
        genre,
      });
      setSummary(res.data.summary);
      setPhase("summary");
    } catch (err) {
      console.error('Summary error:', err);
    } finally {
      setLoading(false);
    }
  };

  const addToStoryBible = async () => {
    setAddingToBible(true);
    try {
      const projects = await base44.entities.Project.filter({ id: projectId });
      const project = projects[0];
      let stateLog = '';
      if (project?.chapter_state_log) {
        if (project.chapter_state_log.startsWith('http')) {
          const r = await fetch(project.chapter_state_log);
          stateLog = r.ok ? await r.text() : '';
        } else {
          stateLog = project.chapter_state_log;
        }
      }
      const entry = `\n\n=== CHARACTER INTERVIEW: ${characterName} ===\n${summary}\n=== END CHARACTER INTERVIEW ===`;
      const newLog = stateLog + entry;

      if (newLog.length > 15000) {
        const f = new File([newLog], 'chapter_state_log.txt', { type: 'text/plain' });
        const up = await base44.integrations.Core.UploadFile({ file: f });
        await base44.entities.Project.update(projectId, { chapter_state_log: up.file_url });
      } else {
        await base44.entities.Project.update(projectId, { chapter_state_log: newLog });
      }
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    } catch (err) {
      console.error('Add to bible error:', err);
    } finally {
      setAddingToBible(false);
    }
  };

  if (phase === "setup") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={onBack} className="text-slate-400 hover:text-slate-600">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <UserCircle className="w-5 h-5 text-violet-500" />
          <span className="font-semibold text-sm text-slate-800">Character Interview</span>
        </div>
        <div>
          <Label className="text-xs">Character Name</Label>
          <Input className="mt-1 text-sm" placeholder="e.g. Marcus" value={characterName} onChange={e => setCharacterName(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Who are they? (2-3 sentences)</Label>
          <Textarea className="mt-1 text-sm" rows={2} placeholder="e.g. A former detective haunted by a case he couldn't solve..." value={characterDescription} onChange={e => setCharacterDescription(e.target.value)} />
        </div>
        <Button
          className="w-full bg-violet-600 hover:bg-violet-700 text-sm"
          disabled={!characterName.trim() || !characterDescription.trim()}
          onClick={() => setPhase("interview")}
        >
          Begin Interview
        </Button>
      </div>
    );
  }

  if (phase === "summary") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <UserCircle className="w-5 h-5 text-violet-500" />
          <span className="font-semibold text-sm text-slate-800">Interview Complete: {characterName}</span>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
          {summary}
        </div>
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-sm"
          disabled={addingToBible}
          onClick={addToStoryBible}
        >
          {addingToBible ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpen className="w-4 h-4 mr-2" />}
          Add to Story Bible
        </Button>
        <Button variant="outline" className="w-full text-sm" onClick={() => { setPhase("setup"); setConversation([]); setSummary(""); }}>
          Interview Another Character
        </Button>
      </div>
    );
  }

  // Interview phase
  return (
    <div className="flex flex-col" style={{ height: "100%" }}>
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <UserCircle className="w-4 h-4 text-violet-500" />
          <span className="font-semibold text-xs text-slate-800">Speaking with {characterName}</span>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-700" onClick={endInterview} disabled={loading || conversation.length < 2}>
          End Interview
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-3" style={{ minHeight: 0, maxHeight: "280px" }}>
        {conversation.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-xs", msg.role === "user" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-800")}>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl px-3 py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Starter questions */}
      {conversation.length < 2 && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-hide flex-shrink-0">
          {STARTER_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => sendQuestion(q)}
              disabled={loading}
              className="flex-shrink-0 text-[10px] px-2.5 py-1.5 rounded-full bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 transition-colors whitespace-nowrap"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 flex-shrink-0">
        <Input
          className="flex-1 text-xs"
          placeholder="Ask a question..."
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendQuestion(); } }}
          disabled={loading}
        />
        <Button size="icon" className="h-9 w-9 bg-violet-600 hover:bg-violet-700 flex-shrink-0" onClick={() => sendQuestion()} disabled={!question.trim() || loading}>
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}