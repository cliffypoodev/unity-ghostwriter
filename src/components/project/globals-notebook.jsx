/* ═══════════════════════════════════════════════════════════
   NOTEBOOK SHELL — Visual wrapper for ProjectDetail phases
   ═══════════════════════════════════════════════════════════ */

/* ── Shell container ── */
.notebook-shell {
  position: relative;
  margin-top: 8px;
}

/* ── Spine — left-edge binding strip ── */
.notebook-spine {
  position: absolute;
  top: 40px; /* below tabs */
  left: 0;
  bottom: 0;
  width: 6px;
  background: linear-gradient(
    180deg,
    hsl(245 58% 51% / 0.15) 0%,
    hsl(245 58% 51% / 0.08) 100%
  );
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
  bottom: -1px; /* overlap body border */
  white-space: nowrap;
  min-height: 40px;
  background: transparent;
  color: inherit;
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
}

/* ── Tab states ── */
.notebook-tab-active {
  background: #ffffff;
  border-color: hsl(240 5.9% 90%);
  color: hsl(245 58% 51%);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
}
.notebook-tab-active .notebook-tab-num {
  background: hsl(245 58% 51%);
  color: #fff;
}

.notebook-tab-completed {
  background: hsl(245 58% 51% / 0.04);
  color: hsl(152 60% 38%);
}
.notebook-tab-completed:hover {
  background: hsl(152 60% 38% / 0.08);
}

.notebook-tab-idle {
  color: hsl(240 3.8% 46.1%);
}
.notebook-tab-idle:hover {
  background: hsl(240 4.8% 95.9%);
}
.notebook-tab-idle .notebook-tab-num {
  background: hsl(240 4.8% 95.9%);
  color: hsl(240 3.8% 46.1%);
}

/* ── Body — the page area ── */
.notebook-body {
  background: #ffffff;
  border: 1px solid hsl(240 5.9% 90%);
  border-radius: 0 12px 12px 12px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.04),
    0 4px 12px rgba(0, 0, 0, 0.02);
  position: relative;
  min-height: 400px;
  overflow: hidden;
}

/* Subtle top-left corner paper fold effect */
.notebook-body::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 24px;
  height: 24px;
  background: linear-gradient(
    135deg,
    hsl(240 4.8% 95.9%) 50%,
    transparent 50%
  );
  border-radius: 0 0 8px 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.5;
}

/* ── Phase content padding ──
   Specify tab manages its own layout (phase1-wrap).
   Other phases get standard padding from the notebook body. */
.notebook-body > .notebook-phase-padded {
  padding: 12px;
}
@media (min-width: 640px) {
  .notebook-body > .notebook-phase-padded {
    padding: 24px;
  }
}

/* ── Edit/Export tab needs no padding (full-bleed editor) ── */
.notebook-body > .notebook-phase-flush {
  padding: 0;
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