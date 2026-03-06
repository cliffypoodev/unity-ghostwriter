import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Trash2, MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import EmptyState from "../EmptyState";
import moment from "moment";

export default function ConversationTab({ projectId }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const bottomRef = useRef(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["conversations", projectId],
    queryFn: () => base44.entities.Conversation.filter({ project_id: projectId }, "created_date"),
  });

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.Conversation.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", projectId] });
      setMessage("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Conversation.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations", projectId] }),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (role) => {
    if (!message.trim()) return;
    addMutation.mutate({ project_id: projectId, role, content: message.trim() });
  };

  if (isLoading) return <div className="py-12 text-center text-sm text-slate-400">Loading...</div>;

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No messages yet"
            description="Record your conversation notes, ideas, and AI interactions."
          />
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-3 group", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 relative",
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-slate-200 text-slate-800"
              )}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <div className={cn("flex items-center gap-2 mt-1.5", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <span className={cn("text-xs", msg.role === "user" ? "text-indigo-200" : "text-slate-400")}>
                    {moment(msg.created_date).format("h:mm A")}
                  </span>
                  <button
                    onClick={() => deleteMutation.mutate(msg.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className={cn("w-3 h-3", msg.role === "user" ? "text-indigo-300 hover:text-white" : "text-slate-400 hover:text-red-500")} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-200 pt-4">
        <Textarea
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="mb-3"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend("user"); } }}
        />
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => handleSend("assistant")} disabled={!message.trim() || addMutation.isPending}>
            Add as Assistant
          </Button>
          <Button size="sm" onClick={() => handleSend("user")} disabled={!message.trim() || addMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
            {addMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
            Send as User
          </Button>
        </div>
      </div>
    </div>
  );
}