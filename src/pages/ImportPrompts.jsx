import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, Check, AlertCircle, FileUp, Type } from "lucide-react";

const DEFAULT_FILE_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69aadec3c961db7ad00f82dc/62f05c36b_prompts-2026-03-09.json";
const BATCH_SIZE = 20;

export default function ImportPrompts() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, inserted: 0, errors: 0 });
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(false);
  const abortRef = useRef(false);
  const [sourceMode, setSourceMode] = useState("default"); // "default" | "upload" | "paste"
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const addLog = (msg) => setLog(prev => [...prev.slice(-100), `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const getFileUrl = () => {
    if (sourceMode === "upload" && uploadedUrl) return uploadedUrl;
    if (sourceMode === "default") return DEFAULT_FILE_URL;
    return null;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setUploadedUrl(file_url);
      addLog(`File uploaded: ${file.name}`);
    } catch (err) {
      addLog(`Upload failed: ${err.message}`);
    }
    setUploading(false);
  };

  const handlePasteImport = async () => {
    // Parse pasted text as JSON, upload it, then import
    try {
      const parsed = JSON.parse(pasteText);
      const blob = new Blob([JSON.stringify(parsed)], { type: "application/json" });
      const file = new File([blob], "pasted-prompts.json", { type: "application/json" });
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setUploadedUrl(file_url);
      setSourceMode("upload");
      addLog(`Pasted JSON uploaded (${Array.isArray(parsed) ? parsed.length : 'object'} items)`);
      setUploading(false);
      return file_url;
    } catch (err) {
      addLog(`Invalid JSON: ${err.message}`);
      setUploading(false);
      return null;
    }
  };

  const handleImport = async () => {
    let fileUrl = getFileUrl();
    
    if (sourceMode === "paste") {
      fileUrl = await handlePasteImport();
      if (!fileUrl) return;
    }
    
    if (!fileUrl) {
      addLog("No file source selected.");
      return;
    }
    setRunning(true);
    setDone(false);
    abortRef.current = false;
    setLog([]);
    setProgress({ current: 0, total: 0, inserted: 0, errors: 0 });

    let batchStart = 0;
    let totalInserted = 0;
    let totalErrors = 0;
    let total = 0;

    while (!abortRef.current) {
      addLog(`Processing batch starting at ${batchStart}...`);
      
      try {
        const res = await base44.functions.invoke('importPromptsFromFile', {
          file_url: fileUrl,
          batch_start: batchStart,
          batch_size: BATCH_SIZE
        });

        const data = res.data;
        total = data.total || total;
        totalInserted += data.inserted || 0;

        setProgress({ current: data.next_start || batchStart, total, inserted: totalInserted, errors: totalErrors });
        addLog(`Inserted ${data.inserted} prompts (${data.next_start}/${total})`);

        if (data.done) {
          addLog(`Import complete! Total inserted: ${totalInserted}`);
          setDone(true);
          break;
        }

        batchStart = data.next_start;
        
        // Brief pause between batches
        await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        totalErrors++;
        addLog(`Error at batch ${batchStart}: ${err.message}. Retrying in 10s...`);
        setProgress(p => ({ ...p, errors: totalErrors }));
        await new Promise(r => setTimeout(r, 10000));
      }
    }

    setRunning(false);
  };

  const handleStop = () => {
    abortRef.current = true;
    addLog("Stopping after current batch completes...");
  };

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto py-10 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Import Prompt Catalog</h1>
      <p className="text-sm text-slate-500">
        Import prompts from a JSON file. AI will categorize each with genre, title, description, and tags. New prompts are added without erasing existing ones.
      </p>

      {/* Source selection */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <p className="text-sm font-medium text-slate-700">Prompt Source</p>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={sourceMode === "default" ? "default" : "outline"}
            size="sm"
            onClick={() => setSourceMode("default")}
            disabled={running}
          >
            Default File
          </Button>
          <Button
            variant={sourceMode === "upload" ? "default" : "outline"}
            size="sm"
            onClick={() => setSourceMode("upload")}
            disabled={running}
            className="gap-1.5"
          >
            <FileUp className="w-3.5 h-3.5" /> Upload JSON
          </Button>
          <Button
            variant={sourceMode === "paste" ? "default" : "outline"}
            size="sm"
            onClick={() => setSourceMode("paste")}
            disabled={running}
            className="gap-1.5"
          >
            <Type className="w-3.5 h-3.5" /> Paste JSON
          </Button>
        </div>

        {sourceMode === "upload" && (
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || running}
              className="gap-2"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
              {uploadedUrl ? "Change File" : "Choose File"}
            </Button>
            {uploadedUrl && (
              <p className="text-xs text-emerald-600">File ready for import</p>
            )}
          </div>
        )}

        {sourceMode === "paste" && (
          <Textarea
            placeholder='Paste JSON array here, e.g. [{"prompt": "Write a story about..."}, ...]'
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            disabled={running}
            className="h-40 font-mono text-xs"
          />
        )}
      </div>

      <div className="flex gap-3">
        {!running ? (
          <Button
            onClick={handleImport}
            className="bg-indigo-600 hover:bg-indigo-700 gap-2"
            disabled={done || (sourceMode === "upload" && !uploadedUrl) || (sourceMode === "paste" && !pasteText.trim())}
          >
            <Upload className="w-4 h-4" /> {done ? "Import Complete" : "Start Import"}
          </Button>
        ) : (
          <Button onClick={handleStop} variant="destructive" className="gap-2">
            <AlertCircle className="w-4 h-4" /> Stop
          </Button>
        )}
        {done && (
          <Button variant="outline" onClick={() => { setDone(false); setProgress({ current: 0, total: 0, inserted: 0, errors: 0 }); setLog([]); }}>
            Import Another
          </Button>
        )}
      </div>

      {progress.total > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-slate-600">
            <span>{progress.current} / {progress.total} processed</span>
            <span>{progress.inserted} inserted · {progress.errors} errors</span>
          </div>
          <Progress value={pct} className="h-3" />
          <p className="text-xs text-slate-400">{pct}% complete</p>
        </div>
      )}

      {done && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">
            Successfully imported {progress.inserted} prompts into the catalog!
          </span>
        </div>
      )}

      {log.length > 0 && (
        <div className="bg-slate-900 rounded-xl p-4 max-h-64 overflow-y-auto">
          {log.map((line, i) => (
            <p key={i} className="text-xs text-slate-300 font-mono leading-relaxed">{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}