// Act Detection — auto-divides chapters into 3 acts from beat sheet data
// Used by GenerateTab to group chapters and drive act-based writing

const TURNING_POINT_KEYWORDS = [
  'turning point', 'everything changes', 'point of no return',
  'inciting incident', 'all is lost', 'dark night',
  'first act break', 'second act break', 'climax begins',
  'break into two', 'break into three', 'midpoint',
];

const ACT1_BEATS = ['DISRUPTION', 'CATALYST', 'COMMITMENT', 'SETUP'];
const ACT2_BREAK_BEATS = ['CRISIS', 'REFLECTION', 'ALL_IS_LOST', 'DARK_NIGHT'];
const ACT3_BEATS = ['CLIMAX', 'RESOLUTION', 'RECOMMITMENT'];

export function detectActBoundaries(chapters, outlineData) {
  const total = chapters.length;
  if (total <= 3) {
    return {
      act1: { start: 1, end: total, label: 'Act 1 — Establish & Disrupt' },
      act2: null,
      act3: null,
    };
  }

  const defaultAct1End = Math.max(2, Math.floor(total * 0.35));
  const defaultAct2End = Math.floor(total * 0.75);

  let act1End = defaultAct1End;
  let act2End = defaultAct2End;
  let foundAct1 = false;
  let foundAct2 = false;

  // Parse outline chapters for beat data
  const olChapters = outlineData?.chapters || [];

  for (let i = 0; i < olChapters.length; i++) {
    const ch = olChapters[i];
    const num = ch.number || ch.chapter_number || (i + 1);
    const bf = (ch.beat_function || '').toUpperCase();
    const bn = (ch.beat_name || '').toLowerCase();
    const summary = ((ch.summary || '') + ' ' + (ch.prompt || '')).toLowerCase();

    // Act 1 break: COMMITMENT or first turning point in 20-45% range
    if (!foundAct1 && num > 2 && num <= Math.ceil(total * 0.45)) {
      if (bf === 'COMMITMENT' || bf === 'DISRUPTION' ||
          bn.includes('break into two') || bn.includes('catalyst') ||
          TURNING_POINT_KEYWORDS.some(kw => summary.includes(kw) || bn.includes(kw))) {
        act1End = num;
        foundAct1 = true;
        continue;
      }
    }

    // Act 2 break: CRISIS/REFLECTION/DARK_NIGHT or second turning point in 60-85% range
    if (foundAct1 && !foundAct2 && num > Math.ceil(total * 0.55) && num <= Math.ceil(total * 0.85)) {
      if (ACT2_BREAK_BEATS.includes(bf) ||
          bn.includes('break into three') || bn.includes('dark night') || bn.includes('all is lost') ||
          TURNING_POINT_KEYWORDS.some(kw => summary.includes(kw))) {
        act2End = num;
        foundAct2 = true;
        continue;
      }
    }
  }

  return {
    act1: { start: 1, end: act1End, label: 'Act 1 — Establish & Disrupt' },
    act2: { start: act1End + 1, end: act2End, label: 'Act 2 — Escalate & Break' },
    act3: { start: act2End + 1, end: total, label: 'Act 3 — Fracture & Resolve' },
  };
}

export function getActForChapter(chapterNumber, acts) {
  if (!acts) return null;
  if (acts.act1 && chapterNumber >= acts.act1.start && chapterNumber <= acts.act1.end) return 1;
  if (acts.act2 && chapterNumber >= acts.act2.start && chapterNumber <= acts.act2.end) return 2;
  if (acts.act3 && chapterNumber >= acts.act3.start && chapterNumber <= acts.act3.end) return 3;
  return null;
}

export function getActChapters(chapters, acts, actNumber) {
  const act = acts[`act${actNumber}`];
  if (!act) return [];
  return chapters.filter(c => c.chapter_number >= act.start && c.chapter_number <= act.end);
}

export function getActStatus(chapters, acts, actNumber) {
  const actChapters = getActChapters(chapters, acts, actNumber);
  if (actChapters.length === 0) return 'empty';
  const generated = actChapters.filter(c => c.status === 'generated').length;
  if (generated === actChapters.length) return 'complete';
  if (generated > 0) return 'partial';
  if (actChapters.some(c => c.status === 'generating')) return 'generating';
  return 'pending';
}