import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, Loader2, Check } from "lucide-react";

export default function ManuscriptUploader({ onTextLoaded }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFileName(file.name);

    try {
      // For .txt and .md files, read directly
      if (file.name.endsWith(".txt") || file.name.endsWith(".md")) {
        const text = await file.text();
        onTextLoaded(text, file.name);
      } else {
        // Upload to Base44 and extract text
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: {
            type: "object",
            properties: {
              full_text: { type: "string", description: "The complete text content of the file" }
            }
          }
        });
        if (result?.output?.full_text) {
          onTextLoaded(result.output.full_text, file.name);
        } else {
          // Fallback: try fetching the URL directly
          const resp = await fetch(file_url);
          const text = await resp.text();
          onTextLoaded(text, file.name);
        }
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="gap-2 hover:bg-white/60" style={{ borderColor: 'var(--nb-border)', color: 'var(--ink)' }}
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Upload className="w-4 h-4" />
        )}
        {uploading ? "Processing…" : "Upload Manuscript"}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.md,.docx,.pdf"
        className="hidden"
        onChange={handleFile}
      />
      {fileName && !uploading && (
        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--ink2)' }}>
          <FileText className="w-3 h-3" />
          {fileName}
          <button onClick={() => { setFileName(null); onTextLoaded("", null); }} className="hover:opacity-70" style={{ color: 'var(--ink2)' }}>
            <X className="w-3 h-3" />
          </button>
        </span>
      )}
    </div>
  );
}