import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import CoverCanvas from "./cover/CoverCanvas";
import CoverProperties from "./cover/CoverProperties";

let nextId = 1;

export default function CoverDesigner({ projectId }) {
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [bgFront, setBgFront] = useState(null);
  const [bgBack, setBgBack] = useState(null);
  const [spineText, setSpineText] = useState("");
  const [spineDirection, setSpineDirection] = useState("ttb");
  const [showGuides, setShowGuides] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  const { data: specs = [] } = useQuery({
    queryKey: ["spec", projectId],
    queryFn: () => base44.entities.Specification.filter({ project_id: projectId }),
    enabled: !!projectId,
  });
  const spec = specs[0];

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const p = await base44.entities.Project.filter({ id: projectId });
      return p[0];
    },
    enabled: !!projectId,
  });

  const selectedElement = elements.find((e) => e.id === selectedId) || null;

  const addText = () => {
    const id = "el_" + nextId++;
    setElements((prev) => [
      ...prev,
      { id, type: "text", text: "Title", x: 360, y: 40, fontSize: 24, bold: true, color: "var(--ink)", font: "Georgia, serif" },
    ]);
    setSelectedId(id);
  };

  const addImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const id = "el_" + nextId++;
      setElements((prev) => [
        ...prev,
        { id, type: "image", src: file_url, x: 360, y: 60, width: 120, height: 160 },
      ]);
      setSelectedId(id);
    };
    input.click();
  };

  const handleSetBackground = async (file, side) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    if (side === "front") setBgFront(file_url);
    else setBgBack(file_url);
  };

  const updateElement = (id, data) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...data } : el)));
  };

  const moveElement = (id, x, y) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, x, y } : el)));
  };

  const deleteElement = (id) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    try {
      const res = await base44.functions.invoke("generateCoverImage", {
        prompt: aiPrompt,
        size: "1024x1792",
      });
      if (res.data?.url) {
        setBgFront(res.data.url);
        toast.success("Cover generated!");
        if (res.data.revised_prompt) {
          setAiPrompt(res.data.revised_prompt);
        }
      } else {
        toast.error(res.data?.error || "Generation failed");
      }
    } catch (err) {
      toast.error(err.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  // Auto-populate AI prompt from project data
  React.useEffect(() => {
    if (spec && project && !aiPrompt) {
      const parts = [];
      if (project.name && project.name !== "Untitled Project") parts.push(`Book cover for "${project.name}"`);
      if (spec.genre) parts.push(`Genre: ${spec.genre}`);
      if (spec.topic) parts.push(spec.topic.slice(0, 100));
      parts.push("Professional book cover design, high quality, publishing standard");
      setAiPrompt(parts.join(". "));
    }
  }, [spec, project]);

  return (
    <div className="flex h-full min-h-[500px]" style={{ background: "var(--pg)" }}>
      {/* Canvas area */}
      <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
        <CoverCanvas
          elements={elements}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={moveElement}
          onDoubleClick={(id) => setSelectedId(id)}
          bgBack={bgBack}
          bgFront={bgFront}
          spineText={spineText}
          spineDirection={spineDirection}
          showGuides={showGuides}
        />
      </div>

      {/* Properties panel */}
      <CoverProperties
        selectedElement={selectedElement}
        onUpdateElement={updateElement}
        onDeleteElement={deleteElement}
        onAddText={addText}
        onAddImage={addImage}
        onSetBackground={handleSetBackground}
        spineText={spineText}
        onSpineTextChange={setSpineText}
        spineDirection={spineDirection}
        onSpineDirectionChange={setSpineDirection}
        showGuides={showGuides}
        onToggleGuides={setShowGuides}
        onGenerateAI={handleGenerateAI}
        generating={generating}
        aiPrompt={aiPrompt}
        onAiPromptChange={setAiPrompt}
      />
    </div>
  );
}