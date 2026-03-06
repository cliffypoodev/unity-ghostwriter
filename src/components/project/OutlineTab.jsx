import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, Loader2, Map } from "lucide-react";
import EmptyState from "../EmptyState";

export default function OutlineTab({ projectId }) {
  const queryClient = useQueryClient();
  const [outlineData, setOutlineData] = useState("");
  const [storyBible, setStoryBible] = useState("");

  // Scroll to top on component mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { data: outlines = [], isLoading } = useQuery({
    queryKey: ["outline", projectId],
    queryFn: () => base44.entities.Outline.filter({ project_id: projectId }),
  });

  const outline = outlines[0];

  useEffect(() => {
    if (outline) {
      setOutlineData(outline.outline_data || "");
      setStoryBible(outline.story_bible || "");
    }
  }, [outline]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { outline_data: outlineData, story_bible: storyBible, project_id: projectId };
      if (outline) return base44.entities.Outline.update(outline.id, payload);
      return base44.entities.Outline.create(payload);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["outline", projectId] }),
  });

  const handleCreate = () => {
    setOutlineData("{\n  \"chapters\": []\n}");
    setStoryBible("{\n  \"characters\": [],\n  \"settings\": [],\n  \"themes\": []\n}");
  };

  if (isLoading) return <div className="py-12 text-center text-sm text-slate-400">Loading...</div>;

  if (!outline && !outlineData) {
    return (
      <EmptyState
        icon={Map}
        title="No outline yet"
        description="Create an outline and story bible for your book."
        action={<Button onClick={handleCreate} className="bg-indigo-600 hover:bg-indigo-700">Create Outline</Button>}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Label className="text-sm font-medium">Outline Data (JSON)</Label>
        <Textarea
          className="mt-1.5 font-mono text-sm"
          rows={12}
          placeholder='{"chapters": [...]}'
          value={outlineData}
          onChange={(e) => setOutlineData(e.target.value)}
        />
      </div>
      <div>
        <Label className="text-sm font-medium">Story Bible (JSON)</Label>
        <Textarea
          className="mt-1.5 font-mono text-sm"
          rows={12}
          placeholder='{"characters": [], "settings": []}'
          value={storyBible}
          onChange={(e) => setStoryBible(e.target.value)}
        />
      </div>
      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Save Outline
      </Button>
    </div>
  );
}