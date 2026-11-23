'use strict';

/* Planner X — Points, ranks and levels. */

/* ---------------- levels & points ---------------- */

// after Legend: Legend II, Legend III… every 3000 points
function levelInfo(n) {
  if (n <= LEVELS.length) return LEVELS[n - 1];
  const extra = n - LEVELS.length;
  const last = LEVELS[LEVELS.length - 1];
  return { ...last, name: `Legend ${ROMAN[extra + 1] || extra + 1}`, need: last.need + extra * 3000 };
}

const rankBadge = (n, big = false) => {
  const l = levelInfo(n);
  return `<span class="rank ${big ? 'rank-big' : ''}" style="--r1:${l.r1};--r2:${l.r2}">${l.icon} ${esc(l.name)}</span>`;
};

// gives points for adding something; returns how many were given (0 once the daily cap is hit)
function awardAdd(kind) {
  const k = todayKey();
  state.stats.added[kind] = (state.stats.added[kind] || 0) + 1; // counted even past the cap (achievements)
  const a = (state.activity[k] ||= { pts: 0 });
  const gain = Math.min(ADD_PTS[kind] || 0, ADD_CAP - a.pts);
  if (gain <= 0) {
    if (!a.capNoted) { a.capNoted = true; toast(`You've reached today's ${ADD_CAP} pts for planning — finish tasks to earn more`); }
    return 0;
  }
  a.pts += gain;
  return gain;
}
const activityPoints = () => Object.values(state.activity).reduce((s, a) => s + (a.pts || 0), 0);

function dayStats(k) {
  const d = state.days[k];
  const empty = { total: 0, done: 0, skipped: 0, pct: 0, points: 0, possible: 0, bonus: 0 };
  if (!d || !d.plan) return empty;
  const bl = d.plan.blocks.filter(b => b.type !== 'free');
  if (!bl.length) return empty;
  let done = 0, skipped = 0, points = 0, possible = 0;
  for (const b of bl) {
    possible += b.points;
    if (b.status === 'done') { done++; points += b.points; }
    else if (b.status === 'skipped') skipped++;
  }
  // weighted by points, so a long priority counts for more than a 15-minute routine.
  // Rounded down: 100% always means everything is done.
  const pct = possible ? Math.floor(points / possible * 100) : Math.floor(done / bl.length * 100);
  let bonus = 0;
  if (bl.length >= 5) bonus = pct === 100 ? 50 : pct >= 80 ? 20 : 0;
  return { total: bl.length, done, skipped, pct, points: points + bonus, possible, bonus };
}

function goalPoints() {
  let p = 0;
  for (const [gk, list] of Object.entries(state.goals)) {
    const pts = GOAL_PTS[gk[0]] || 0;
    p += list.filter(g => g.done).length * pts;
  }
  return p;
}

function totalPoints() {
  let p = goalPoints() + activityPoints() + Object.keys(state.achievements).length * ACH_PTS;
  for (const k in state.days) p += dayStats(k).points;
  return p;
}

const canLevelUp = () => totalPoints() >= levelInfo(state.level + 1).need;

function streak(fromKey) {
  // consecutive days (ending yesterday, or today if already ≥70%) with ≥70% completion
  let n = 0, k = fromKey;
  if (dayStats(k).pct >= 70) n++;
  k = addDays(k, -1);
  while (dayStats(k).pct >= 70) { n++; k = addDays(k, -1); }
  return n;
}

// reward adding something, with the usual "+N points" toast and level-up check
function pointsForAdding(kind) {
  const before = totalPoints();
  if (awardAdd(kind)) afterPointsChange(before);
}

function afterPointsChange(before) {
  const after = totalPoints();
  if (after > before) toast(`+${after - before} points`);
  else if (after < before) toast(`${after - before} points`);
  if (canLevelUp() && !ui.levelPrompted) { ui.levelPrompted = true; setTimeout(showLevelUp, 400); }
}
