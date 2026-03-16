import React, { useState, useEffect, useRef, useCallback } from "react";
import { AlertTriangle, Download, X, ChevronUp, ChevronDown, Trash2, Bug } from "lucide-react";

// ═══════════════════════════════════════════════════
// GLOBAL ERROR LOG STORE
// Captures console.error, unhandled promise rejections,
// and manual pushes from toast.error calls
// ═══════════════════════════════════════════════════

const MAX_LOG_ENTRIES = 200;

// Shared mutable log array — components subscribe via listeners
let _errorLog = [];
let _listeners = new Set();

function notifyListeners() {
  _listeners.forEach(fn => fn([..._errorLog]));
}

export function pushError(source, message, details = null) {
  const entry = {
    id: Date.now() + Math.random(),
    timestamp: new Date().toISOString(),
    source, // "console", "promise", "toast", "api", "bot"
    message: typeof message === 'string' ? message : String(message),
    details: details ? (typeof details === 'string' ? details : JSON.stringify(details, null, 2)) : null,
  };
  _errorLog.unshift(entry);
  if (_errorLog.length > MAX_LOG_ENTRIES) _errorLog = _errorLog.slice(0, MAX_LOG_ENTRIES);
  notifyListeners();
}

export function clearErrorLog() {
  _errorLog = [];
  notifyListeners();
}

function useErrorLog() {
  const [log, setLog] = useState([..._errorLog]);
  useEffect(() => {
    const listener = (newLog) => setLog(newLog);
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  }, []);
  return log;
}

// ═══════════════════════════════════════════════════
// GLOBAL INTERCEPTORS — install once on mount
// ═══════════════════════════════════════════════════

let _interceptorsInstalled = false;

function installInterceptors() {
  if (_interceptorsInstalled) return;
  _interceptorsInstalled = true;

  // Intercept console.error
  const origError = console.error;
  console.error = (...args) => {
    origError.apply(console, args);
    const msg = args.map(a => {
      if (a instanceof Error) return `${a.message}\n${a.stack || ''}`;
      if (typeof a === 'object') { try { return JSON.stringify(a); } catch { return String(a); } }
      return String(a);
    }).join(' ');
    pushError("console", msg.slice(0, 500));
  };

  // Intercept unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : null;
    pushError("promise", msg.slice(0, 500), stack);
  });

  // Intercept window.onerror
  window.addEventListener('error', (event) => {
    pushError("window", `${event.message} at ${event.filename}:${event.lineno}`, event.error?.stack);
  });
}

// ═══════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════

export default function ErrorLogPanel() {
  const log = useErrorLog();
  const [expanded, setExpanded] = useState(false);
  const [seen, setSeen] = useState(0); // track how many the user has seen
  const scrollRef = useRef(null);

  // Install interceptors on first mount
  useEffect(() => {
    installInterceptors();
  }, []);

  const newCount = log.length - seen;

  const handleExport = useCallback(() => {
    if (log.length === 0) return;
    const lines = [];
    lines.push(`═══ UNITY GHOSTWRITER ERROR LOG ═══`);
    lines.push(`Exported: ${new Date().toLocaleString()}`);
    lines.push(`Total entries: ${log.length}`);
    lines.push(`User Agent: ${navigator.userAgent}`);
    lines.push(`URL: ${window.location.href}`);
    lines.push(`\n${'─'.repeat(60)}\n`);

    for (const entry of log) {
      lines.push(`[${entry.timestamp}] [${entry.source.toUpperCase()}]`);
      lines.push(`  ${entry.message}`);
      if (entry.details) {
        lines.push(`  Details: ${entry.details.slice(0, 1000)}`);
      }
      lines.push('');
    }

    lines.push(`═══ END ERROR LOG ═══`);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-log-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [log]);

  const handleClear = () => {
    clearErrorLog();
    setSeen(0);
  };

  const handleToggle = () => {
    if (!expanded) {
      setSeen(log.length); // mark all as seen when opening
    }
    setExpanded(!expanded);
  };

  // Don't show anything if no errors
  if (log.length === 0 && !expanded) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        maxWidth: expanded ? 480 : 'auto',
        width: expanded ? 480 : 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
      }}
    >
      {/* Expanded panel */}
      {expanded && (
        <div style={{
          background: '#1e1b2e',
          border: '1px solid #3b3556',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          marginBottom: 8,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderBottom: '1px solid #3b3556',
            background: '#252038',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bug style={{ width: 14, height: 14, color: '#f87171' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e0ea' }}>Error Log ({log.length})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={handleExport}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 6,
                  background: '#34d399', color: '#064e3b',
                  fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                }}
                title="Export error log as .txt file"
              >
                <Download style={{ width: 12, height: 12 }} />
                Export
              </button>
              <button
                onClick={handleClear}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 8px', borderRadius: 6,
                  background: 'transparent', color: '#94a3b8',
                  fontSize: 11, border: '1px solid #3b3556', cursor: 'pointer',
                }}
                title="Clear all errors"
              >
                <Trash2 style={{ width: 11, height: 11 }} />
              </button>
              <button
                onClick={() => setExpanded(false)}
                style={{
                  padding: '4px', borderRadius: 6,
                  background: 'transparent', color: '#94a3b8',
                  border: 'none', cursor: 'pointer',
                }}
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>

          {/* Error list */}
          <div
            ref={scrollRef}
            style={{
              maxHeight: 320, overflowY: 'auto', padding: '8px 10px',
            }}
          >
            {log.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                No errors logged yet.
              </div>
            ) : (
              log.map(entry => (
                <div key={entry.id} style={{
                  padding: '8px 10px', marginBottom: 6, borderRadius: 8,
                  background: entry.source === 'promise' || entry.source === 'window'
                    ? '#3b1a1a' : '#1a1a2e',
                  border: `1px solid ${entry.source === 'promise' || entry.source === 'window' ? '#5c2020' : '#2a2545'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                      padding: '1px 5px', borderRadius: 4,
                      background: entry.source === 'console' ? '#3b3556' :
                                 entry.source === 'promise' ? '#5c2020' :
                                 entry.source === 'toast' ? '#92400e' :
                                 entry.source === 'api' ? '#1e3a5f' : '#3b3556',
                      color: entry.source === 'console' ? '#a5a3b5' :
                             entry.source === 'promise' ? '#fca5a5' :
                             entry.source === 'toast' ? '#fcd34d' :
                             entry.source === 'api' ? '#93c5fd' : '#a5a3b5',
                    }}>
                      {entry.source}
                    </span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#e2e0ea', lineHeight: 1.4, wordBreak: 'break-word' }}>
                    {entry.message.slice(0, 300)}{entry.message.length > 300 ? '...' : ''}
                  </div>
                  {entry.details && (
                    <details style={{ marginTop: 4 }}>
                      <summary style={{ fontSize: 10, color: '#64748b', cursor: 'pointer' }}>Stack trace</summary>
                      <pre style={{ fontSize: 9, color: '#94a3b8', whiteSpace: 'pre-wrap', marginTop: 4, maxHeight: 120, overflow: 'auto' }}>
                        {entry.details.slice(0, 2000)}
                      </pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Floating badge button */}
      <button
        onClick={handleToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 10,
          background: newCount > 0 ? '#dc2626' : '#1e1b2e',
          color: newCount > 0 ? '#fff' : '#a5a3b5',
          border: `1px solid ${newCount > 0 ? '#ef4444' : '#3b3556'}`,
          boxShadow: newCount > 0 ? '0 4px 20px rgba(220,38,38,0.4)' : '0 4px 12px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          fontSize: 12, fontWeight: 600,
          transition: 'all 0.2s ease',
          marginLeft: 'auto',
          float: 'right',
        }}
      >
        <Bug style={{ width: 14, height: 14 }} />
        {newCount > 0 ? `${newCount} error${newCount !== 1 ? 's' : ''}` : expanded ? 'Close' : `${log.length} logged`}
        {expanded
          ? <ChevronDown style={{ width: 12, height: 12 }} />
          : <ChevronUp style={{ width: 12, height: 12 }} />
        }
      </button>
    </div>
  );
}
