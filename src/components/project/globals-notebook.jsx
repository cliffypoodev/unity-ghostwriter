/* ═══════════════════════════════════════════════════════════
   NOTEBOOK SHELL — Visual wrapper for ProjectDetail phases
   Theme-driven via CSS custom properties
   ═══════════════════════════════════════════════════════════ */

/* ── Theme defaults (Classic Cream) — set by ThemeProvider JS ── */
:root {
  --pg: #F5EFE4;
  --pgAlt: #FFFDF8;
  --ink: #3A3530;
  --ink2: #5A5348;
  --nb-border: #D8D0C0;
  --rule: #C8DAE8;
  --margin-line: #E8B0B0;
  --hole: #D4CCBE;
  --wire: #A8A090;
  --wireHi: #C8C2B8;
  --accent: #5DCAA5;
  --nb-font-size: 9px;
  --ruled-opacity: 0.3;
  --margin-opacity: 0.5;
  --tabs-colored: 1;
  --t0: #E8DDD0; --t1: #D8E8D8; --t2: #D0D8E8; --t3: #E8D8D0;
  --t4: #D8D0E0; --t5: #D0E0E0; --t6: #E0E0D0; --t7: #E0D0D8;
  --t8: #D0D0E0; --t9: #E0E8D0;
  --t0c: #5A5040; --t1c: #3A5A3A; --t2c: #3A4A5A; --t3c: #5A4030;
  --t4c: #4A3A5A; --t5c: #3A5050; --t6c: #505040; --t7c: #503A48;
  --t8c: #3A3A50; --t9c: #405030;
}

/* ── Themed transitions ── */
.notebook-shell,
.notebook-shell *,
.notebook-body,
.notebook-tab {
  transition: background-color 0.4s, color 0.4s, border-color 0.4s;
}

/* ── Shell container ── */
.notebook-shell {
  position: relative;
  margin-top: 8px;
}

/* ── Spine — left-edge binding strip ── */
.notebook-spine {
  position: absolute;
  top: 40px;
  left: 0;
  bottom: 0;
  width: 6px;
  background: linear-gradient(180deg, var(--wire) 0%, var(--hole) 100%);
  border-radius: 3px 0 0 3px;
  z-index: 1;
  pointer-events: none;
}

/* ── Tab bar ── */
.notebook-tab-bar {
  display: flex;
  gap: 2px;
  padding: 0 0 0 12px;
  position: relative;
  z-index: 2;
}

/* ── Settings gear button ── */
.nb-settings-gear {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1px solid var(--nb-border);
  background: var(--pgAlt);
  color: var(--ink2);
  flex-shrink: 0;
  margin-left: auto;
  align-self: center;
  transition: transform 0.3s, background 0.2s;
}
.nb-settings-gear:hover {
  transform: rotate(30deg);
  background: var(--pg);
}

/* ── Individual tab ── */
.notebook-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 10px 10px 0 0;
  border: 1px solid transparent;
  border-bottom: none;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  bottom: -1px;
  white-space: nowrap;
  min-height: 40px;
  background: transparent;
  color: var(--ink2);
  font-family: inherit;
}

.notebook-tab-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  background: var(--nb-border);
  color: var(--ink2);
}

/* ── Tab states ── */
.notebook-tab-active {
  background: var(--pg);
  border-color: var(--nb-border);
  color: var(--ink);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
}
.notebook-tab-active .notebook-tab-num {
  background: var(--accent);
  color: #fff;
}

.notebook-tab-completed {
  color: var(--accent);
}
.notebook-tab-completed:hover {
  background: var(--pg);
}

.notebook-tab-idle {
  color: var(--ink2);
}
.notebook-tab-idle:hover {
  background: var(--pg);
}

/* ── Body — the page area ── */
.notebook-body {
  background: var(--pg);
  border: 1px solid var(--nb-border);
  border-radius: 0 12px 12px 12px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.04),
    0 4px 12px rgba(0, 0, 0, 0.02);
  position: relative;
  min-height: 400px;
  overflow: hidden;
  color: var(--ink);
}

/* Ruled lines overlay */
.notebook-body::after {
  content: "";
  position: absolute;
  inset: 0;
  top: 8px;
  background: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent 31px,
    var(--rule) 31px,
    var(--rule) 32px
  );
  opacity: var(--ruled-opacity, 0.3);
  pointer-events: none;
  z-index: 0;
}

/* Paper fold — subtle top-left corner */
.notebook-body::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, var(--nb-border) 50%, transparent 50%);
  border-radius: 0 0 8px 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.3;
}

/* Margin line (left red margin) */
.notebook-body .nb-margin-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 48px;
  width: 1px;
  background: var(--margin-line);
  opacity: var(--margin-opacity, 0.5);
  pointer-events: none;
  z-index: 0;
}

/* ── Phase content padding ── */
.notebook-body > .notebook-phase-padded {
  padding: 12px;
  position: relative;
  z-index: 1;
}
@media (min-width: 640px) {
  .notebook-body > .notebook-phase-padded {
    padding: 24px;
  }
}

.notebook-body > .notebook-phase-flush {
  padding: 0;
  position: relative;
  z-index: 1;
}

/* Specify tab has its own layout — just ensure z-index */
.notebook-body > div:first-child {
  position: relative;
  z-index: 1;
}

/* ── Mobile adjustments ── */
@media (max-width: 640px) {
  .notebook-spine {
    width: 4px;
  }
  .notebook-tab-bar {
    padding-left: 8px;
    gap: 1px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .notebook-tab {
    padding: 6px 10px;
    font-size: 12px;
    min-height: 36px;
  }
  .notebook-tab-num {
    width: 18px;
    height: 18px;
    font-size: 10px;
  }
  .notebook-body {
    border-radius: 0 8px 8px 8px;
  }
}

/* ── Mobile mode overrides ── */
.mobile .notebook-tab {
  min-height: 40px;
  width: auto !important;
}
.mobile .notebook-body {
  border-radius: 0 8px 8px 8px;
}