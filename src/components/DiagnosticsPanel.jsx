import { useState, useEffect } from 'react';
import { healthMonitor } from './utils/appHealthMonitor';
import { base44 } from "@/api/base44Client";

const SEVERITY_STYLES = {
  info:    { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', dot: '#22c55e' },
  warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', dot: '#f59e0b' },
  error:   { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', dot: '#ef4444' },
  fatal:   { bg: '#fdf2f8', border: '#f9a8d4', color: '#9d174d', dot: '#ec4899' },
};

export default function DiagnosticsPanel() {
  const [errors, setErrors] = useState([]);
  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    const unsub = healthMonitor.subscribe(entry => {
      if (entry.type) return;
      setErrors(healthMonitor.getRecentErrors(10));
      if (['error', 'fatal'].includes(entry.severity)) setOpen(true);
    });
    return unsub;
  }, []);

  const activeErrors = errors.filter(e => !e.resolved);
  const stats = healthMonitor.getStats();

  if (activeErrors.length === 0 && !open) return null;

  async function analyzeWithClaude() {
    setAnalyzing(true);
    try {
      const errorSummary = activeErrors.slice(0, 5).map(e =>
        `[${e.severity.toUpperCase()}] ${e.category}: ${e.message} | Context: ${JSON.stringify(e.context)}`
      ).join('\n');

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a senior engineer reviewing error logs from a React/Node book-writing app. 
Analyze these errors and provide:
1. Root cause (1-2 sentences)
2. Which file/function to look at
3. Specific fix (code or config change)

Be concrete and brief. No generic advice.

ERRORS:
${errorSummary}

App context: Multi-genre AI book writing app. Pipeline: Gemini (outline/beats) → user-selected model (chapters) → Claude (consistency). OpenRouter used for DeepSeek, Trinity, Lumimaid.`,
      });
      setAnalysis(result || 'Analysis unavailable');
    } catch (err) {
      setAnalysis('Could not analyze errors — check network connection.');
    }
    setAnalyzing(false);
  }

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16,
      width: open ? 320 : 'auto',
      zIndex: 9999,
      fontFamily: '-apple-system, sans-serif',
    }}>
      {/* Collapsed pill */}
      {!open && activeErrors.length > 0 && (
        <button
          onClick={() => setOpen(true)}
          style={{
            padding: '6px 14px', borderRadius: 20,
            background: activeErrors.some(e => e.severity === 'fatal') ? '#991b1b'
                      : activeErrors.some(e => e.severity === 'error') ? '#dc2626'
                      : '#f59e0b',
            color: '#fff', border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 700,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          ⚠ {activeErrors.length} issue{activeErrors.length !== 1 ? 's' : ''}
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div style={{
          background: '#fff', borderRadius: 12,
          border: '1.5px solid #e5e7eb',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '10px 14px',
            background: '#111827',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>
              ⬡ App Diagnostics
              <span style={{
                marginLeft: 8, fontSize: 9, padding: '1px 6px',
                borderRadius: 8, background: '#374151', color: '#9ca3af',
              }}>
                {stats.totalErrors} total · {stats.retrySuccesses} auto-fixed
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 14 }}
            >✕</button>
          </div>

          {/* Error list */}
          <div style={{ maxHeight: 220, overflowY: 'auto', padding: '8px 10px' }}>
            {activeErrors.length === 0 ? (
              <div style={{ fontSize: 11, color: '#6b7280', padding: '8px 4px' }}>
                No active issues ✓
              </div>
            ) : activeErrors.map(err => {
              const s = SEVERITY_STYLES[err.severity] || SEVERITY_STYLES.error;
              return (
                <div key={err.id} style={{
                  marginBottom: 6, padding: '7px 10px',
                  borderRadius: 8, background: s.bg, border: `1px solid ${s.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: s.color }}>
                      {err.category.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 9, color: '#9ca3af', marginLeft: 'auto' }}>
                      {new Date(err.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#374151', marginTop: 4, lineHeight: 1.4 }}>
                    {err.message}
                  </div>
                  {err.context?.chapterNumber && (
                    <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>
                      Chapter {err.context.chapterNumber}
                      {err.context.modelId ? ` · ${err.context.modelId}` : ''}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      healthMonitor.markResolved(err.id);
                      setErrors(healthMonitor.getRecentErrors(10));
                    }}
                    style={{
                      marginTop: 5, fontSize: 9, padding: '1px 8px',
                      borderRadius: 6, border: '1px solid #d1d5db',
                      background: '#fff', cursor: 'pointer', color: '#6b7280',
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              );
            })}
          </div>

          {/* Claude analysis */}
          {analysis && (
            <div style={{
              margin: '0 10px 8px', padding: '9px 10px',
              borderRadius: 8, background: '#f0fdf4',
              border: '1px solid #bbf7d0', fontSize: 10, color: '#374151', lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}>
              <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 5 }}>
                ✓ AI Analysis
              </div>
              {analysis}
            </div>
          )}

          {/* Footer */}
          <div style={{
            padding: '8px 10px', borderTop: '1px solid #f3f4f6',
            display: 'flex', gap: 6,
          }}>
            <button
              onClick={analyzeWithClaude}
              disabled={analyzing || activeErrors.length === 0}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 7,
                background: analyzing ? '#f3f4f6' : '#4338ca',
                color: analyzing ? '#9ca3af' : '#fff',
                border: 'none', fontSize: 10, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {analyzing ? 'Analyzing...' : '✦ Analyze with AI'}
            </button>
            <button
              onClick={() => {
                errors.forEach(e => healthMonitor.markResolved(e.id));
                setErrors([]);
                setAnalysis(null);
              }}
              style={{
                padding: '6px 10px', borderRadius: 7,
                background: '#f3f4f6', color: '#6b7280',
                border: 'none', fontSize: 10, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Clear All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}