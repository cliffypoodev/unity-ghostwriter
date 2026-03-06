import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2, FileText } from "lucide-react";
import EmptyState from "../EmptyState";

const GENRES = ["Fantasy", "Sci-Fi", "Romance", "Mystery", "Thriller", "Horror", "Literary Fiction", "Historical", "Self-Help", "Business", "Science", "Biography", "Philosophy", "Technology", "Education", "Other"];

export default function SpecificationTab({ projectId }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);

  const { data: specs = [], isLoading } = useQuery({
    queryKey: ["specification", projectId],
    queryFn: () => base44.entities.Specification.filter({ project_id: projectId }),
  });

  const spec = specs[0];

  useEffect(() => {
    if (spec) {
      setForm({ ...spec });
    }
  }, [spec]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const payload = { ...data };
      delete payload.id;
      delete payload.created_date;
      delete payload.updated_date;
      delete payload.created_by;
      if (spec) return base44.entities.Specification.update(spec.id, payload);
      return base44.entities.Specification.create({ ...payload, project_id: projectId });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["specification", projectId] }),
  });

  const handleCreate = () => {
    setForm({ project_id: projectId, book_type: "fiction", genre: "", topic: "", target_length: "medium", detail_level: "moderate", target_audience: "", tone_style: "", additional_requirements: "" });
  };

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  if (isLoading) return <div className="py-12 text-center text-sm text-slate-400">Loading...</div>;

  if (!form && !spec) {
    return (
      <EmptyState
        icon={FileText}
        title="No specification yet"
        description="Define your book's parameters — genre, audience, tone, and more."
        action={<Button onClick={handleCreate} className="bg-indigo-600 hover:bg-indigo-700">Create Specification</Button>}
      />
    );
  }

  if (!form) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <Label className="text-sm font-medium">Book Type</Label>
          <Select value={form.book_type || ""} onValueChange={(v) => handleChange("book_type", v)}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fiction">Fiction</SelectItem>
              <SelectItem value="nonfiction">Nonfiction</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium">Genre</Label>
          <Select value={form.genre || ""} onValueChange={(v) => handleChange("genre", v)}>
            <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select genre" /></SelectTrigger>
            <SelectContent>
              {GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium">Target Length</Label>
          <Select value={form.target_length || ""} onValueChange={(v) => handleChange("target_length", v)}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="short">Short (~20K words)</SelectItem>
              <SelectItem value="medium">Medium (~50K words)</SelectItem>
              <SelectItem value="long">Long (~80K words)</SelectItem>
              <SelectItem value="epic">Epic (~120K+ words)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium">Detail Level</Label>
          <Select value={form.detail_level || ""} onValueChange={(v) => handleChange("detail_level", v)}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="minimal">Minimal</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="comprehensive">Comprehensive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Topic / Premise</Label>
        <Textarea className="mt-1.5" rows={3} placeholder="Describe the main topic or premise of your book..." value={form.topic || ""} onChange={(e) => handleChange("topic", e.target.value)} />
      </div>
      <div>
        <Label className="text-sm font-medium">Target Audience</Label>
        <Input className="mt-1.5" placeholder="e.g. Young adults, professionals..." value={form.target_audience || ""} onChange={(e) => handleChange("target_audience", e.target.value)} />
      </div>
      <div>
        <Label className="text-sm font-medium">Tone & Style</Label>
        <Input className="mt-1.5" placeholder="e.g. Witty and conversational, formal..." value={form.tone_style || ""} onChange={(e) => handleChange("tone_style", e.target.value)} />
      </div>
      <div>
        <Label className="text-sm font-medium">Additional Requirements</Label>
        <Textarea className="mt-1.5" rows={3} placeholder="Any other requirements..." value={form.additional_requirements || ""} onChange={(e) => handleChange("additional_requirements", e.target.value)} />
      </div>

      <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Save Specification
      </Button>
    </div>
  );
}