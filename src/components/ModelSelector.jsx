// components/ModelSelector.jsx
// COMPLETE REPLACEMENT — self-contained component.
// Receives project + updateProject as props.
// Reads project.genre and project.writing_model.
// Writes project.writing_model and project.budget_mode.

import { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";

// ═══════════════════════════════════════════════════════════════════════════════
// DATA — inlined because Base44 does not support a constants/ directory.
// Other files can import these exports if needed.
// ═══════════════════════════════════════════════════════════════════════════════

export const WRITING_MODELS = {
  'claude-haiku': {
    id: 'claude-haiku', label: 'Claude Haiku 3.5', platform: 'Anthropic',
    callHandler: 'anthropic', modelString: 'claude-haiku-4-5-20251001',
    description: 'Fast, lightweight · affordable',
    costLabel: '$0.25/M', costTier: 'mid', qualityScore: 3, qualityColor: '#f59e0b',
    inPer1M: 0.25, outPer1M: 1.25, contextWindow: 200000, supportsExplicit: false,
  },
  'claude-sonnet': {
    id: 'claude-sonnet', label: 'Claude Sonnet 4.5', platform: 'Anthropic',
    callHandler: 'anthropic', modelString: 'claude-sonnet-4-5',
    description: 'Best overall quality · full beat adherence',
    costLabel: '$15/M', costTier: 'high', qualityScore: 5, qualityColor: '#f59e0b',
    inPer1M: 3.00, outPer1M: 15.00, contextWindow: 200000, supportsExplicit: false,
    recommended: true,
  },
  'gpt-4o': {
    id: 'gpt-4o', label: 'GPT-4o', platform: 'OpenAI',
    callHandler: 'openai', modelString: 'gpt-4o',
    description: 'Strong instruction following · solid beats',
    costLabel: '$5/M', costTier: 'mid', qualityScore: 4, qualityColor: '#3b82f6',
    inPer1M: 2.50, outPer1M: 10.00, contextWindow: 128000, supportsExplicit: false,
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini', label: 'GPT-4o Mini', platform: 'OpenAI',
    callHandler: 'openai', modelString: 'gpt-4o-mini',
    description: 'Fast · affordable · lighter quality',
    costLabel: '$0.60/M', costTier: 'low', qualityScore: 3, qualityColor: '#3b82f6',
    inPer1M: 0.15, outPer1M: 0.60, contextWindow: 128000, supportsExplicit: false,
  },
  'deepseek': {
    id: 'deepseek', label: 'DeepSeek V3', platform: 'OpenRouter · DeepSeek',
    callHandler: 'openrouter', modelString: 'deepseek/deepseek-chat',
    description: 'Frontier quality · 163k context',
    costLabel: '$0.89/M', costTier: 'low', qualityScore: 4, qualityColor: '#3b82f6',
    inPer1M: 0.32, outPer1M: 0.89, contextWindow: 163840, supportsExplicit: true,
  },
  'trinity': {
    id: 'trinity', label: 'Trinity Large', platform: 'OpenRouter · Arcee AI',
    callHandler: 'openrouter', modelString: 'arcee-ai/trinity-large-preview:free',
    description: '400B creative writing model · storytelling',
    costLabel: 'FREE', costTier: 'free', qualityScore: 4, qualityColor: '#22c55e',
    inPer1M: 0, outPer1M: 0, contextWindow: 131000, supportsExplicit: true,
    isFree: true, note: 'May be slower during high-demand periods',
  },
  'lumimaid': {
    id: 'lumimaid', label: 'Lumimaid v0.2', platform: 'OpenRouter · Lumimaid',
    callHandler: 'openrouter', modelString: 'neversleep/lumimaid-v0.2-8b',
    description: 'Explicit content enabled · adult fiction',
    costLabel: '$0.20/M', costTier: 'low', qualityScore: 3, qualityColor: '#f43f5e',
    inPer1M: 0.20, outPer1M: 0.20, contextWindow: 32000, supportsExplicit: true,
    adultOnly: true,
  },
};

export const PLATFORM_ORDER = [
  'Anthropic',
  'OpenAI',
  'OpenRouter · DeepSeek',
  'OpenRouter · Arcee AI',
  'OpenRouter · Lumimaid',
];

export const PLATFORM_COLORS = {
  'Anthropic':               '#e879f9',
  'OpenAI':                  '#10b981',
  'OpenRouter · DeepSeek':   '#3b82f6',
  'OpenRouter · Arcee AI':   '#22c55e',
  'OpenRouter · Lumimaid':   '#f43f5e',
};

export const PROMPT_OVERHEAD_TOKENS = {
  1500: 900,
  2500: 1400,
  4000: 2000,
  6000: 2600,
};

// Legacy shim so existing pipeline imports (AI_MODEL_PROFILES, MODEL_GENRE_ROUTING) still resolve.
export const AI_MODEL_PROFILES = Object.fromEntries(
  Object.values(WRITING_MODELS).map(m => [m.id, {
    id: m.id, name: m.label, provider: m.platform.split(' · ')[0],
    description: m.description, strengths: [],
    proseQuality: m.qualityScore,
    tokenCost: m.costTier === 'free' ? 0 : m.costTier === 'low' ? 1 : m.costTier === 'mid' ? 3 : 5,
  }])
);

export const MODEL_GENRE_ROUTING = {};


// ── COST CALCULATIONS ────────────────────────────────────────

function wordsToOutputTokens(words) {
  return Math.round(words * 1.35);
}

function calcChapterCost(model, chapterWords) {
  const outTokens = wordsToOutputTokens(chapterWords);
  const inTokens  = PROMPT_OVERHEAD_TOKENS[chapterWords] || 1400;
  const inCost    = (inTokens  / 1_000_000) * model.inPer1M;
  const outCost   = (outTokens / 1_000_000) * model.outPer1M;
  return {
    inTokens,
    outTokens,
    perChapter: inCost + outCost,
    fullBook:   (inCost + outCost) * 20,
  };
}

function formatCost(n) {
  if (n === 0)    return '$0.00';
  if (n < 0.001)  return '<$0.001';
  if (n < 0.01)   return '$' + n.toFixed(4);
  if (n < 1)      return '$' + n.toFixed(3);
  return '$' + n.toFixed(2);
}


// ── STYLE HELPERS ────────────────────────────────────────────

const COST_TIER_STYLES = {
  free: { bg: '#dcfce7', color: '#15803d' },
  low:  { bg: '#dbeafe', color: '#1d4ed8' },
  mid:  { bg: '#fef3c7', color: '#92400e' },
  high: { bg: '#fce7f3', color: '#9d174d' },
};

const FIT_STYLES = {
  great: { border: '#bbf7d0', bg: '#f0fdf4', titleColor: '#15803d', icon: '✓' },
  good:  { border: '#bfdbfe', bg: '#eff6ff', titleColor: '#1d4ed8', icon: '✓' },
  ok:    { border: '#fde68a', bg: '#fffbeb', titleColor: '#92400e', icon: '⚡' },
  warn:  { border: '#fecaca', bg: '#fef2f2', titleColor: '#991b1b', icon: '⚠' },
};

const DOT_COLORS = {
  green:  '#22c55e',
  blue:   '#3b82f6',
  yellow: '#f59e0b',
  red:    '#ef4444',
};


// ── FIT MATRIX ───────────────────────────────────────────────

const FIT_MATRIX = {
  'claude-sonnet': {
    default: { fitClass:'great', title:'Excellent fit for any genre' },
    thriller:   { fitClass:'great', title:'Excellent fit — full beat enforcement active', rows:[
      ['green','Full <b>beat style enforcement</b> — Fast-Paced Thriller rules applied'],
      ['green','<b>Author voice</b> injection supported'],
      ['green','<b>Anti-pattern enforcement</b> and prose compression active'],
      ['green','Act bridge <b>continuity injection</b> supported'],
    ]},
    romance:    { fitClass:'great', title:'Excellent fit for Romance', rows:[
      ['green','Clean Romance / Slow Burn beat styles <b>fully applied</b>'],
      ['green','<b>Closed-door rule</b> strictly enforced'],
      ['green','Author voice injection supported'],
      ['green','Act bridge continuity supported'],
    ]},
    erotica:    { fitClass:'great', title:'Standard Mode — Claude + Lumimaid hybrid', rows:[
      ['green','Claude handles <b>structure, prose, and continuity</b>'],
      ['green','Lumimaid handles all <b>explicit scenes automatically</b>'],
      ['green','Full beat enforcement on all non-explicit sections'],
      ['blue', 'Enable <b>Budget Mode</b> below to reduce token cost'],
    ]},
    nonfiction: { fitClass:'great', title:'Excellent fit for Nonfiction', rows:[
      ['green','Investigative beat style <b>fully enforced</b>'],
      ['green','<b>Fabrication warning</b> detection active'],
      ['green','<b>Thesis restatement</b> ending enforcer active'],
      ['green','Composite figure framing check active'],
    ]},
    fantasy:    { fitClass:'great', title:'Excellent fit for Fantasy', rows:[
      ['green','Epic / Urban Gritty beat styles <b>fully applied</b>'],
      ['green','Author voice injection supported'],
      ['green','200k context — full act in a single call'],
      ['green','Act bridge continuity injection supported'],
    ]},
  },
  'claude-haiku': {
    default: { fitClass:'good', title:'Good fit — lighter on complex beats' },
    thriller:   { fitClass:'good', title:'Good fit — fast and affordable', rows:[
      ['blue',  'Beat style applied — <b>some nuance may reduce</b> on complex arcs'],
      ['blue',  'Author voice injection supported'],
      ['yellow','Anti-pattern enforcement — lighter prose polish'],
      ['blue',  'Act bridge continuity supported'],
    ]},
    romance:    { fitClass:'good', title:'Good fit for Romance', rows:[
      ['blue',  'Slow Burn / Clean Romance beat styles applied'],
      ['blue',  'Closed-door rule enforced'],
      ['yellow','Emotionally complex scenes may need regeneration'],
      ['blue',  'Author voice injection supported'],
    ]},
    erotica:    { fitClass:'ok', title:'Limited — explicit content not supported on Haiku', rows:[
      ['red',  '<b>Explicit content NOT supported</b> on Claude Haiku'],
      ['yellow','Use Lumimaid for explicit scenes'],
      ['blue',  'Non-explicit chapters work normally'],
      ['blue',  'Enable Budget Mode below for full Lumimaid routing'],
    ]},
    nonfiction: { fitClass:'good', title:'Good fit for Nonfiction at lower cost', rows:[
      ['blue',  'Investigative beat style applied'],
      ['blue',  'Fabrication warning detection active'],
      ['yellow','Long research chapters may need expansion pass'],
      ['blue',  'Composite figure framing check active'],
    ]},
    fantasy:    { fitClass:'good', title:'Good fit — handles world-building well', rows:[
      ['blue',  'Epic / Urban Gritty beat styles applied'],
      ['blue',  'Author voice injection supported'],
      ['yellow','Very long chapters may approach context limits'],
      ['blue',  'Act bridge continuity supported'],
    ]},
  },
  'gpt-4o': {
    default: { fitClass:'good', title:'Good fit — strong instruction following' },
    thriller:   { fitClass:'good', title:'Good fit — strong instruction following', rows:[
      ['blue',  'Beat style rules applied via context injection'],
      ['blue',  'Author voice injection supported'],
      ['yellow','Anti-pattern enforcement — may need extra passes'],
      ['blue',  'Act bridge continuity supported'],
    ]},
    romance:    { fitClass:'good', title:'Good fit for Romance', rows:[
      ['blue',  'Slow Burn / Clean Romance beat styles applied'],
      ['blue',  'Closed-door rule enforced'],
      ['blue',  'Author voice injection supported'],
      ['blue',  'Act bridge supported'],
    ]},
    erotica:    { fitClass:'ok', title:'Limited — OpenAI policy blocks explicit content', rows:[
      ['red',  '<b>Explicit content blocked</b> by OpenAI content policy'],
      ['yellow','Use Lumimaid or Budget Mode for explicit scenes'],
      ['blue',  'SFW romance and tension chapters work normally'],
      ['blue',  'Consider DeepSeek or Trinity for erotica projects'],
    ]},
    nonfiction: { fitClass:'good', title:'Good fit for Nonfiction', rows:[
      ['blue',  'Investigative beat style applied'],
      ['blue',  'Fabrication warnings active'],
      ['yellow','Verify chapter endings for thesis restatements'],
      ['blue',  'Strong analytical and structured writing output'],
    ]},
    fantasy:    { fitClass:'good', title:'Good fit for Fantasy', rows:[
      ['blue',  'Epic beat styles applied'],
      ['blue',  'Author voice injection supported'],
      ['blue',  '128k context — handles full act generation'],
      ['blue',  'Act bridge continuity supported'],
    ]},
  },
  'gpt-4o-mini': {
    default: { fitClass:'ok', title:'Acceptable — best for simple chapter structures' },
    thriller:   { fitClass:'ok', title:'Acceptable — lighter beat enforcement', rows:[
      ['blue',  'Beat style rules applied — lighter enforcement'],
      ['yellow','Complex multi-beat chapters may lose structure'],
      ['yellow','Author voice less consistent than larger models'],
      ['blue',  'Best for <b>high-volume, cost-sensitive</b> manuscripts'],
    ]},
    romance:    { fitClass:'ok', title:'Acceptable for lighter Romance', rows:[
      ['blue',  'Slow Burn / Clean Romance applied'],
      ['yellow','Emotional depth reduced vs. larger models'],
      ['blue',  'Closed-door rule enforced'],
      ['blue',  'Good cost option for short-form romance'],
    ]},
    erotica:    { fitClass:'warn', title:'Not supported — OpenAI blocks explicit content', rows:[
      ['red',  '<b>Explicit content blocked</b> by OpenAI'],
      ['red',  'Cannot be used for erotica — switch models'],
      ['yellow','Use Lumimaid, DeepSeek, or Trinity instead'],
      ['blue',  'Budget Mode routes to Lumimaid automatically'],
    ]},
    nonfiction: { fitClass:'ok', title:'Acceptable for lighter Nonfiction', rows:[
      ['blue',  'Investigative beat style applied'],
      ['yellow','Longer research chapters may underperform'],
      ['yellow','Extra ending check recommended'],
      ['blue',  'Good for Reference / Educational genre'],
    ]},
    fantasy:    { fitClass:'ok', title:'Acceptable — lighter context handling', rows:[
      ['blue',  'Beat styles applied'],
      ['yellow','Complex world-building may need extra prompting'],
      ['blue',  'Cost-effective for high chapter-count fantasy'],
      ['yellow','Watch for continuity drift on long acts'],
    ]},
  },
  'deepseek': {
    default: { fitClass:'good', title:'Strong fit — excellent instruction following' },
    thriller:   { fitClass:'good', title:'Strong fit — excellent instruction following', rows:[
      ['blue',  'Beat style rules applied — <b>strong structural compliance</b>'],
      ['blue',  'Author voice injection supported'],
      ['blue',  'Anti-pattern enforcement active'],
      ['blue',  '163k context — full act without truncation'],
    ]},
    romance:    { fitClass:'good', title:'Good fit for Romance', rows:[
      ['blue',  'Slow Burn / Clean Romance beat styles applied'],
      ['blue',  'Author voice injection supported'],
      ['blue',  'Closed-door rule enforced'],
      ['blue',  'Strong <b>cost-quality balance</b> for long manuscripts'],
    ]},
    erotica:    { fitClass:'great', title:'Strong fit — explicit content supported', rows:[
      ['green','<b>Explicit content supported</b> via DeepSeek on OpenRouter'],
      ['green','Full hybrid or single-model routing available'],
      ['blue', 'Budget Mode routes to Lumimaid if preferred'],
      ['green','<b>Best cost-quality balance</b> for erotica SFW sections'],
    ]},
    nonfiction: { fitClass:'good', title:'Strong fit for Nonfiction', rows:[
      ['blue',  'Investigative beat style fully applied'],
      ['blue',  'Fabrication warning detection active'],
      ['blue',  '163k context handles full research chapters'],
      ['yellow','Monitor thesis restatement endings — enforcer active'],
    ]},
    fantasy:    { fitClass:'good', title:'Strong fit for Fantasy', rows:[
      ['blue',  'Epic / Urban Gritty beat styles applied'],
      ['blue',  '<b>163k context</b> — largest window of all options'],
      ['blue',  'Author voice injection supported'],
      ['blue',  'Act bridge continuity supported'],
    ]},
  },
  'trinity': {
    default: { fitClass:'good', title:'Good fit — built for creative writing' },
    thriller:   { fitClass:'good', title:'Good fit — built for creative writing', rows:[
      ['green','<b>400B model</b> trained specifically for storytelling'],
      ['blue', 'Beat style rules applied via context injection'],
      ['blue', 'Author voice injection supported'],
      ['yellow','Free tier — <b>may be slower</b> during high demand'],
    ]},
    romance:    { fitClass:'good', title:'Good fit — strong emotional tone', rows:[
      ['green','Excellent at <b>emotional tone and character voice</b>'],
      ['blue', 'Slow Burn / Clean Romance beat styles applied'],
      ['blue', 'Author voice injection supported'],
      ['yellow','Free tier — response time may vary'],
    ]},
    erotica:    { fitClass:'good', title:'Good fit — explicit content supported', rows:[
      ['green','<b>Explicit content supported</b> on Trinity via OpenRouter'],
      ['green','400B creative writing focus — strong tone control'],
      ['blue', 'Budget Mode routes to Lumimaid if preferred'],
      ['yellow','Free tier — may be slower during high demand'],
    ]},
    nonfiction: { fitClass:'ok', title:'Acceptable — less specialized for nonfiction', rows:[
      ['blue',  'Investigative beat style applied'],
      ['yellow','<b>Less specialized</b> for evidence-based research writing'],
      ['yellow','Monitor fabrication more carefully than Claude/DeepSeek'],
      ['blue',  'Strong for narrative nonfiction and memoir'],
    ]},
    fantasy:    { fitClass:'great', title:'Excellent fit — storytelling is its specialty', rows:[
      ['green','<b>Exceptional</b> creative writing and worldbuilding'],
      ['green','Epic / Urban Gritty beat styles applied'],
      ['blue', 'Author voice injection supported'],
      ['yellow','Free tier — monitor rate limits on high chapter counts'],
    ]},
  },
  'lumimaid': {
    default: { fitClass:'ok', title:'Best used for explicit content only' },
    thriller:   { fitClass:'ok', title:'Limited — not recommended for SFW thriller', rows:[
      ['yellow','Beat style rules applied — lighter SFW enforcement'],
      ['red',  '<b>Not recommended</b> for SFW thriller'],
      ['blue', 'Use Lumimaid for explicit scenes only in hybrid mode'],
      ['blue', 'Author voice injection supported'],
    ]},
    romance:    { fitClass:'ok', title:'Acceptable for spicy romance', rows:[
      ['blue', 'Explicit content fully supported'],
      ['yellow','SFW romance sections <b>lighter quality</b> vs Claude'],
      ['blue', 'Standard hybrid mode recommended'],
      ['blue', 'Or enable Budget Mode for full Lumimaid routing'],
    ]},
    erotica:    { fitClass:'great', title:'Excellent — primary use case for Lumimaid', rows:[
      ['green','Explicit content <b>fully supported and optimized</b>'],
      ['green','Lowest cost per token — ideal for high-volume erotica'],
      ['blue', 'Beat style rules applied to all SFW sections'],
      ['green','Enable <b>Budget Mode</b> below to route full manuscript here'],
    ]},
    nonfiction: { fitClass:'warn', title:'Not recommended for Nonfiction', rows:[
      ['red', '<b>Not optimized</b> for research or evidence-based writing'],
      ['red', 'Fabrication risk <b>significantly higher</b> than other models'],
      ['red', 'Switch to Claude, DeepSeek, or GPT-4o for nonfiction'],
      ['red', 'Do not generate nonfiction chapters with this model'],
    ]},
    fantasy:    { fitClass:'ok', title:'Acceptable for dark/adult fantasy only', rows:[
      ['blue', 'Explicit content supported for adult fantasy'],
      ['yellow','SFW world-building lighter quality than Claude/DeepSeek'],
      ['yellow','Beat style enforcement less consistent'],
      ['blue', 'Consider hybrid: Claude for SFW, Lumimaid for explicit'],
    ]},
  },
};


// ── SUB-COMPONENTS ───────────────────────────────────────────

function QualityPips({ score, color }) {
  return (
    <div style={{ display:'flex', gap:2 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{
          width:6, height:6, borderRadius:2,
          background: i <= score ? color : '#e5e7eb',
        }} />
      ))}
    </div>
  );
}

function CostBadge({ tier, label }) {
  const s = COST_TIER_STYLES[tier] || COST_TIER_STYLES.mid;
  return (
    <span style={{
      fontSize:9, fontWeight:800, padding:'2px 7px',
      borderRadius:10, background:s.bg, color:s.color,
      flexShrink:0, whiteSpace:'nowrap',
    }}>
      {label}
    </span>
  );
}

function FitPanel({ modelId, genre }) {
  const matrix = FIT_MATRIX[modelId];
  if (!matrix) return null;
  const genreKey = genre ? genre.toLowerCase() : null;
  const data = (genreKey && matrix[genreKey]) || matrix.default;
  if (!data) return null;
  const fs = FIT_STYLES[data.fitClass] || FIT_STYLES.good;

  return (
    <div style={{
      marginTop:8, borderRadius:10, padding:'10px 12px',
      border:`1.5px solid ${fs.border}`, background:fs.bg,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:7 }}>
        <span style={{ fontSize:12 }}>{fs.icon}</span>
        <span style={{ fontSize:11, fontWeight:700, color:fs.titleColor }}>
          {data.title}
        </span>
      </div>
      {data.rows?.map(([dot, text], i) => (
        <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:6, marginBottom:4 }}>
          <div style={{
            width:5, height:5, borderRadius:'50%',
            background: DOT_COLORS[dot] || '#6b7280',
            marginTop:4, flexShrink:0,
          }} />
          <span
            style={{ fontSize:10, color:'#374151', lineHeight:1.4 }}
            dangerouslySetInnerHTML={{ __html: text }}
          />
        </div>
      ))}
    </div>
  );
}

function TokenCostEstimator({ model, chapterWords, onWordChange }) {
  const WORD_OPTIONS = [1500, 2500, 4000, 6000];
  const costs = calcChapterCost(model, chapterWords);
  const isFree = model.inPer1M === 0 && model.outPer1M === 0;

  return (
    <div style={{
      marginTop:8, borderRadius:10, padding:'10px 12px',
      border:'1.5px solid #e0e7ff', background:'#fafbff',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, flexWrap:'wrap', gap:4 }}>
        <span style={{ fontSize:9, fontWeight:800, color:'#4338ca', letterSpacing:'0.5px' }}>
          ⬡ EST. TOKEN COST PER CHAPTER
        </span>
        <div style={{ display:'flex', gap:3 }}>
          {WORD_OPTIONS.map(w => (
            <button
              key={w}
              onClick={() => onWordChange(w)}
              style={{
                padding:'2px 7px', borderRadius:8,
                fontSize:9, fontWeight:700, cursor:'pointer',
                border: w === chapterWords ? '1.5px solid #6366f1' : '1.5px solid #e0e7ff',
                background: w === chapterWords ? '#6366f1' : '#fff',
                color: w === chapterWords ? '#fff' : '#6b7280',
              }}
            >
              {w >= 1000 ? (w/1000)+'k' : w}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
        <div style={{ background:'#fff', borderRadius:8, border:'1px solid #e0e7ff', padding:'7px 8px' }}>
          <div style={{ fontSize:9, color:'#6b7280', marginBottom:2 }}>Input tokens</div>
          <div style={{ fontSize:14, fontWeight:800, color:'#111827' }}>~{costs.inTokens.toLocaleString()}</div>
          <div style={{ fontSize:9, color:'#9ca3af', marginTop:1 }}>prompt + beat sheet</div>
        </div>
        <div style={{ background:'#fff', borderRadius:8, border:'1px solid #e0e7ff', padding:'7px 8px' }}>
          <div style={{ fontSize:9, color:'#6b7280', marginBottom:2 }}>Output tokens</div>
          <div style={{ fontSize:14, fontWeight:800, color:'#111827' }}>~{costs.outTokens.toLocaleString()}</div>
          <div style={{ fontSize:9, color:'#9ca3af', marginTop:1 }}>chapter text</div>
        </div>
        <div style={{ background:'#fff', borderRadius:8, border:'1px solid #e0e7ff', padding:'7px 8px' }}>
          <div style={{ fontSize:9, color:'#6b7280', marginBottom:2 }}>Per chapter</div>
          <div style={{ fontSize:14, fontWeight:800, color: isFree ? '#15803d' : '#111827' }}>
            {isFree ? '$0.00' : formatCost(costs.perChapter)}
          </div>
          <div style={{ fontSize:9, color:'#9ca3af', marginTop:1 }}>{isFree ? 'free model ✓' : 'in + out tokens'}</div>
        </div>
        <div style={{
          background:'linear-gradient(135deg,#eef2ff,#f5f3ff)',
          borderRadius:8, border:'1.5px solid #a5b4fc', padding:'7px 8px',
        }}>
          <div style={{ fontSize:9, color:'#6b7280', marginBottom:2 }}>20-chapter book</div>
          <div style={{ fontSize:14, fontWeight:800, color: isFree ? '#15803d' : '#4338ca' }}>
            {isFree ? '$0.00' : formatCost(costs.fullBook)}
          </div>
          <div style={{ fontSize:9, color:'#9ca3af', marginTop:1 }}>{isFree ? 'no token charges' : 'full manuscript est.'}</div>
        </div>
      </div>

      <div style={{
        marginTop:7, paddingTop:6, borderTop:'1px solid #e0e7ff',
        fontSize:9, color:'#9ca3af', lineHeight:1.4,
      }}>
        {isFree
          ? `${model.label} is free via OpenRouter. No token charges apply to chapter generation. Beat sheet generation (Gemini) and act bridge calls (Claude) are billed separately.`
          : `~${costs.inTokens.toLocaleString()} input + ~${costs.outTokens.toLocaleString()} output per chapter. Excludes beat sheet (Gemini) and act bridge (Claude). Each regeneration adds ~${formatCost(costs.perChapter * 0.5)}.`
        }
      </div>
    </div>
  );
}

function BudgetToggle({ project, updateProject }) {
  const on = project.budget_mode || false;
  return (
    <div style={{
      marginTop:8, borderRadius:10, padding:'10px 12px',
      border:'1.5px solid #fde68a', background:'#fffbeb',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ fontSize:15 }}>⚡</span>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#92400e' }}>Budget Mode</div>
            <div style={{ fontSize:10, color:'#a16207', marginTop:1 }}>
              Route full manuscript to Lumimaid · Save ~90%
            </div>
          </div>
        </div>
        <label style={{ position:'relative', width:40, height:22, flexShrink:0, cursor:'pointer' }}>
          <input
            type="checkbox"
            style={{ opacity:0, position:'absolute', width:0, height:0 }}
            checked={on}
            onChange={e => updateProject({ budget_mode: e.target.checked })}
          />
          <div style={{
            position:'absolute', inset:0, borderRadius:22,
            background: on ? '#f59e0b' : '#d1d5db',
            transition:'background 0.2s',
          }} />
          <div style={{
            position:'absolute',
            width:16, height:16, borderRadius:'50%', background:'#fff',
            top:3, left: on ? 21 : 3,
            transition:'left 0.2s', pointerEvents:'none',
            boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
          }} />
        </label>
      </div>
      {on && (
        <div style={{
          marginTop:7, paddingTop:7, borderTop:'1px solid #fde68a',
          fontSize:10, color:'#92400e', lineHeight:1.4,
        }}>
          ⚠ All chapter generation routed to Lumimaid only.
          Explicit content fully supported. Prose quality and beat
          adherence may be reduced vs. Standard Mode.
        </div>
      )}
    </div>
  );
}


// ── MAIN COMPONENT ───────────────────────────────────────────

export default function ModelSelector({ project, updateProject }) {
  const [open, setOpen]           = useState(false);
  const [chapterWords, setWords]  = useState(2500);
  const [healthCheck, setHealthCheck] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const selectedId = project?.writing_model || 'claude-sonnet';
  const selected   = WRITING_MODELS[selectedId] || WRITING_MODELS['claude-sonnet'];
  const genre      = project?.genre || '';
  const showBudget = genre.toLowerCase() === 'erotica';

  // Group models by platform
  const groups = {};
  PLATFORM_ORDER.forEach(p => { groups[p] = []; });
  Object.values(WRITING_MODELS).forEach(m => {
    if (groups[m.platform]) groups[m.platform].push(m);
  });

  function handleSelect(modelId) {
    updateProject({ writing_model: modelId });
    setOpen(false);
    setHealthCheck(null);
    // Run health check for non-Claude models
    if (!['claude-sonnet', 'claude-haiku'].includes(modelId)) {
      setHealthLoading(true);
      base44.functions.invoke('modelHealthCheck', { model_id: modelId })
        .then(res => { setHealthCheck(res.data || res); })
        .catch(err => { setHealthCheck({ passed: false, note: err.message }); })
        .finally(() => setHealthLoading(false));
    }
  }

  return (
    <div>
      {/* Label */}
      <div style={{
        fontSize:9, fontWeight:800, color:'#6b7280',
        letterSpacing:'1px', marginBottom:5,
      }}>
        WRITING MODEL
      </div>

      {/* Trigger */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          width:'100%', padding:'10px 12px',
          borderRadius: open ? '10px 10px 0 0' : 10,
          border:`1.5px solid ${open ? '#6366f1' : '#e5e7eb'}`,
          background:'#fff',
          display:'flex', alignItems:'center', gap:9,
          cursor:'pointer',
        }}
      >
        <QualityPips score={selected.qualityScore} color={selected.qualityColor} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#111827' }}>{selected.label}</div>
          <div style={{ fontSize:10, color:'#6b7280' }}>{selected.platform}</div>
        </div>
        <CostBadge tier={selected.costTier} label={selected.costLabel} />
        <span style={{
          fontSize:9, color:'#9ca3af', flexShrink:0,
          transform: open ? 'rotate(180deg)' : 'none',
          transition:'transform 0.2s',
        }}>▼</span>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          border:'1.5px solid #6366f1', borderTop:'none',
          borderRadius:'0 0 12px 12px', background:'#fff',
          overflow:'hidden', boxShadow:'0 8px 20px rgba(0,0,0,0.1)',
        }}>
          {PLATFORM_ORDER.map(platform => {
            const platformModels = groups[platform];
            if (!platformModels?.length) return null;
            return (
              <div key={platform} style={{ borderBottom:'1px solid #f3f4f6' }}>
                <div style={{
                  padding:'6px 12px 4px',
                  background:'#fafafa', borderBottom:'1px solid #f0f0f0',
                  display:'flex', alignItems:'center', gap:6,
                  fontSize:9, fontWeight:900, letterSpacing:'1.2px', color:'#9ca3af',
                }}>
                  <div style={{
                    width:6, height:6, borderRadius:'50%',
                    background: PLATFORM_COLORS[platform] || '#9ca3af',
                  }} />
                  {platform.toUpperCase()}
                </div>
                {platformModels.map(m => (
                  <div
                    key={m.id}
                    onClick={() => handleSelect(m.id)}
                    style={{
                      padding:'8px 12px',
                      display:'flex', alignItems:'center', gap:8,
                      cursor:'pointer',
                      background: m.id === selectedId ? '#eef2ff' : 'transparent',
                      borderBottom:'1px solid #f9fafb',
                    }}
                  >
                    <QualityPips score={m.qualityScore} color={m.qualityColor} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{
                        fontSize:12, fontWeight:700, color:'#111827',
                        display:'flex', alignItems:'center', gap:4,
                      }}>
                        {m.label}
                        {m.recommended && (
                          <span style={{ fontSize:8, fontWeight:800, padding:'1px 4px', borderRadius:6, background:'#ede9fe', color:'#6d28d9' }}>TOP</span>
                        )}
                        {m.isFree && (
                          <span style={{ fontSize:8, fontWeight:800, padding:'1px 4px', borderRadius:6, background:'#dcfce7', color:'#15803d' }}>FREE</span>
                        )}
                        {m.adultOnly && (
                          <span style={{ fontSize:8, fontWeight:800, padding:'1px 4px', borderRadius:6, background:'#fff1f2', color:'#9f1239' }}>18+</span>
                        )}
                      </div>
                      <div style={{ fontSize:10, color:'#6b7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {m.description}
                      </div>
                    </div>
                    <CostBadge tier={m.costTier} label={m.costLabel} />
                    {m.id === selectedId && (
                      <div style={{
                        width:15, height:15, borderRadius:'50%',
                        background:'#6366f1', color:'#fff',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:8, flexShrink:0,
                      }}>✓</div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Fit panel + cost estimator + budget toggle — only when dropdown is closed */}
      {!open && (
        <>
          <FitPanel modelId={selectedId} genre={genre} />
          <TokenCostEstimator
            model={selected}
            chapterWords={chapterWords}
            onWordChange={setWords}
          />
          {showBudget && (
            <BudgetToggle project={project} updateProject={updateProject} />
          )}
        </>
      )}
    </div>
  );
}