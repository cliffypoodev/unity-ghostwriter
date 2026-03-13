// ═══════════════════════════════════════════════════════════════════════════════
// APP HEALTH MONITOR — Central error bus + auto-recovery
// Singleton: import { healthMonitor } from '../utils/appHealthMonitor'
// Does NOT modify any other code — only observes and responds
// ═══════════════════════════════════════════════════════════════════════════════

class AppHealthMonitor {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.listeners = [];
    this.stats = {
      totalErrors: 0,
      apiFailures: 0,
      retrySuccesses: 0,
      fatalErrors: 0,
    };
  }

  report(event) {
    const entry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      severity: event.severity || 'error',
      category: event.category || 'unknown',
      message: event.message || 'Unknown error',
      context: event.context || {},
      raw: event.raw || null,
      resolved: false,
    };

    this.errors.unshift(entry);
    if (this.errors.length > 100) this.errors.pop();

    this.stats.totalErrors++;
    if (event.category === 'api') this.stats.apiFailures++;
    if (entry.severity === 'fatal') this.stats.fatalErrors++;

    this.notify(entry);
    this.attemptRecovery(entry);

    return entry.id;
  }

  async attemptRecovery(entry) {
    const { category, context, raw } = entry;

    // 1. OpenRouter timeout → mark chapter for retry
    if (
      category === 'api' &&
      context.modelId &&
      ['trinity', 'lumimaid', 'deepseek'].includes(context.modelId) &&
      raw?.message?.includes('timeout')
    ) {
      this.report({
        severity: 'info',
        category: 'pipeline',
        message: `Auto-recovery: marking chapter ${context.chapterNumber} for retry after timeout on ${context.modelId}`,
        context,
      });
      this.emit('chapter_needs_retry', {
        chapterNumber: context.chapterNumber,
        reason: 'timeout',
        suggestedModel: 'claude-sonnet',
      });
      return;
    }

    // 2. Malformed JSON from model → strip and re-parse
    if (category === 'generation' && raw?.message?.includes('JSON')) {
      this.report({
        severity: 'info',
        category: 'generation',
        message: 'Auto-recovery: attempting JSON strip on malformed model output',
        context,
      });
      this.emit('strip_json_retry', context);
      return;
    }

    // 3. Act bridge missing → warn but don't block
    if (category === 'pipeline' && context.issue === 'missing_act_bridge') {
      this.report({
        severity: 'warning',
        category: 'pipeline',
        message: `Act bridge missing for Act ${context.act} — generation will proceed without continuity injection`,
        context,
      });
      return;
    }

    // 4. Beat sheet empty/malformed → flag chapter, don't throw
    if (category === 'generation' && context.issue === 'malformed_beat_sheet') {
      this.emit('beat_sheet_fallback', {
        chapterNumber: context.chapterNumber,
        message: 'Beat sheet could not be parsed — chapter will generate from outline only',
      });
      return;
    }

    // 5. Model rate limit → suggest fallback model
    if (category === 'api' && raw?.message?.toLowerCase().includes('rate limit')) {
      const fallback = context.modelId === 'trinity' ? 'deepseek' : 'claude-sonnet';
      this.emit('rate_limit_detected', {
        affectedModel: context.modelId,
        suggestedFallback: fallback,
        chapterNumber: context.chapterNumber,
      });
      return;
    }
  }

  subscribe(fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  notify(entry) {
    this.listeners.forEach(fn => {
      try { fn(entry); } catch (e) { /* never let a listener crash the monitor */ }
    });
  }

  emit(eventType, payload) {
    this.listeners.forEach(fn => {
      try { fn({ type: eventType, payload }); } catch (e) {}
    });
  }

  getRecentErrors(count = 20) {
    return this.errors.slice(0, count);
  }

  getStats() {
    return { ...this.stats };
  }

  markResolved(id) {
    const entry = this.errors.find(e => e.id === id);
    if (entry) entry.resolved = true;
  }
}

export const healthMonitor = new AppHealthMonitor();