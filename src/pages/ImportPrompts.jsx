import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload, Check, AlertCircle } from "lucide-react";

const FILE_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69aadec3c961db7ad00f82dc/62f05c36b_prompts-2026-03-09.json";
const BATCH_SIZE = 20;

export default function ImportPrompts() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, inserted: 0, errors: 0 });
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(false);
  const abortRef = useRef(false);

  const addLog = (msg) => setLog(prev => [...prev.slice(-100), `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const handleImport = async () => {
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
          file_url: FILE_URL,
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
        Imports 1,934 prompts from the uploaded JSON file, using AI to categorize each as fiction/nonfiction with genre, title, description, and tags.
      </p>

      <div className="flex gap-3">
        {!running ? (
          <Button onClick={handleImport} className="bg-indigo-600 hover:bg-indigo-700 gap-2" disabled={done}>
            <Upload className="w-4 h-4" /> {done ? "Import Complete" : "Start Import"}
          </Button>
        ) : (
          <Button onClick={handleStop} variant="destructive" className="gap-2">
            <AlertCircle className="w-4 h-4" /> Stop
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