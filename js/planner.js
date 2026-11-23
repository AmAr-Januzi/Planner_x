'use strict';

/* Planner X — Planning engine: builds the day plan, daily goals, carry-over, editing rules. */

/* ---------------- planning engine ---------------- */

const isWeekend = k => [0, 6].includes(dateOf(k).getDay());

// the saved routine on top of the defaults, so older saves and new options keep working;
// anything outside ROUTINE_KEYS is always off, even if an older save turned it on
const routineOf = p => Object.fromEntries(Object.keys(DEFAULT_ROUTINE).map(key => [key, {
  ...DEFAULT_ROUTINE[key], ...p?.routine?.[key], ...(ROUTINE_KEYS.includes(key) ? {} : { on: false }),
}]));

function dayBounds(k = todayKey()) {
  const p = state.profile;
  const we = p.weekend?.enabled && isWeekend(k);
  const W = toMin(we ? p.weekend.wake : p.wake);
  let S = toMin(we ? p.weekend.sleep : p.sleep);
  if (S <= W) S += 1440;
  return { W, S };
}

function freeIntervals(blocks, from, to) {
  const busy = blocks.map(b => [b.start, b.end]).sort((a, b) => a[0] - b[0]);
  const out = [];
  let cur = from;
  for (const [s, e] of busy) {
    if (s > cur) out.push([cur, Math.min(s, to)]);
    cur = Math.max(cur, e);
    if (cur >= to) break;
  }
  if (cur < to) out.push([cur, to]);
  return out.filter(([s, e]) => e - s > 0);
}

function findSlot(blocks, dur, from, W, S) {
  for (const startAt of [from, W]) {
    for (const [s, e] of freeIntervals(blocks, W, S)) {
      const st = ceil5(Math.max(s, startAt));
      if (e - st >= dur) return st;
    }
  }
  return null;
}

function largestFree(blocks, W, S) {
  let best = null;
  for (const [s, e] of freeIntervals(blocks, W, S)) {
    const st = ceil5(s);
    if (!best || e - st > best[1] - best[0]) best = [st, e];
  }
  return best;
}

const FREE_TITLES = [
  'Free time — rest, hobbies or people you love',
  'Buffer — catch up or recharge',
  'Open time — read, walk, call someone',
];

// first hour earns the full importance value, each extra hour half of it (8h high = 135)
function prioPoints(pr) {
  const base = IMPORTANCE_PTS[pr.importance];
  return Math.round(base * (1 + Math.max(0, pr.duration / 60 - 1) / 2));
}

// older saves stored an end time instead of hours
function workMinutes(c) {
  if (c.hours) return c.hours * 60;
  let m = toMin(c.end || '17:00') - toMin(c.start);
  if (m <= 0) m += 1440;
  return m;
}

// Different ways to arrange the same day. "Rebuild" cycles through them.
const PLAN_STYLES = [
  { name: 'Balanced',        icon: '⚖️', desc: 'important work in the morning, lighter tasks after lunch', main: 'morning',   low: 'afternoon', exercise: 'afternoon', chunk: 90 },
  { name: 'Early bird',      icon: '🌅', desc: 'exercise first, every priority done before lunch',        main: 'morning',   low: 'morning',   exercise: 'morning',   chunk: 90 },
  { name: 'Afternoon focus', icon: '🌇', desc: 'easy morning, deep work after lunch',                      main: 'afternoon', low: 'evening',   exercise: 'morning',   chunk: 90 },
  { name: 'Short sprints',   icon: '⏱️', desc: '45-minute focus blocks with breaks in between',            main: 'morning',   low: 'afternoon', exercise: 'afternoon', chunk: 45 },
];

// `style` picks a PLAN_STYLES entry; by default the day keeps the style it already has.
function buildPlan(k, style) {
  if (!state.profile) return;
  const day = getDay(k, true);
  const p = state.profile;
  const R = routineOf(p);
  style ??= day.plan?.style ?? 0;
  const V = PLAN_STYLES[style] || PLAN_STYLES[0];
  const { W, S } = dayBounds(k);
  // today, flexible items only go into time that hasn't passed yet
  const isToday = k === todayKey();
  const floor = isToday ? Math.max(W, ceil5(nowMinutes())) : W;
  const blocks = [];
  const add = (start, dur, title, type, extra = {}) => {
    const b = { start, end: start + dur, title, type, points: POINTS[type] ?? 0, ...extra };
    blocks.push(b);
    return b;
  };

  // 1. Morning & evening anchors
  let cursor = W, tail = S;
  if (R.wake.on) { add(cursor, R.wake.dur, R.wake.title, 'routine', { tag: 'wake' }); cursor += R.wake.dur; }
  if (R.morning.on) { add(cursor, R.morning.dur, R.morning.title, 'routine', { tag: 'morning' }); cursor += R.morning.dur; }
  if (R.winddown.on) { tail -= R.winddown.dur; add(tail, R.winddown.dur, R.winddown.title, 'winddown'); }
  if (R.review.on) { tail -= R.review.dur; add(tail, R.review.dur, R.review.title, 'review'); }

  // 2. Priorities pinned to a time
  const prios = day.priorities;
  for (const pr of prios.filter(x => x.time)) {
    let st = toMin(pr.time);
    if (st < W && st + 1440 < S) st += 1440;
    add(st, pr.duration, pr.title, 'task', { pid: pr.id, points: prioPoints(pr), part: 0 });
  }
  const habits = state.habits.filter(h => h.since <= k && habitOn(h, k));
  for (const h of habits.filter(x => x.time)) {
    let st = toMin(h.time);
    if (st < W && st + 1440 < S) st += 1440;
    add(st, h.duration, h.title, 'habit', { tag: h.id });
  }
  const clashes = findClashes(blocks, W, S);

  // Blocks that stay where they are: moved by hand, or already finished today
  for (const b of keptBlocks(day, isToday, prios, habits, R, W, S)) {
    if (blocks.some(x => x.start < b.end && b.start < x.end)) continue;
    add(b.start, b.end - b.start, b.title, b.type, { pid: b.pid, tag: b.tag, part: b.part, manual: b.manual, points: b.points });
  }
  const keptMeal = tag => blocks.find(b => b.type === 'meal' && b.tag === tag);
  const hasExercise = blocks.some(b => b.type === 'exercise');

  // 3. Meals (placed after fixed-time items so they move around them)
  let lunchEnd = cursor;
  if (keptMeal('breakfast')) lunchEnd = keptMeal('breakfast').end;
  else if (R.breakfast.on) {
    const st = findSlot(blocks, R.breakfast.dur, cursor, W, S);
    if (st != null) add(st, R.breakfast.dur, R.breakfast.title, 'meal', { tag: 'breakfast' });
    lunchEnd = (st ?? cursor) + R.breakfast.dur;
  }
  const lunchTarget = Math.max(toMin(R.lunch.time), W + 120);
  let hadLunch = false;
  if (keptMeal('lunch')) { lunchEnd = keptMeal('lunch').end; hadLunch = true; }
  else if (R.lunch.on && lunchTarget + R.lunch.dur < S - 120) {
    const st = findSlot(blocks, R.lunch.dur, lunchTarget, W, S);
    if (st != null) { add(st, R.lunch.dur, R.lunch.title, 'meal', { tag: 'lunch' }); lunchEnd = st + R.lunch.dur; hadLunch = true; }
  }
  if (!hadLunch) lunchEnd = Math.max(lunchEnd, lunchTarget); // "afternoon" still starts around midday without a lunch block
  if (!keptMeal('dinner') && R.dinner.on) {
    const dinnerTarget = Math.max(Math.min(toMin(R.dinner.time), S - 180), lunchEnd + 180);
    if (dinnerTarget + R.dinner.dur <= tail) {
      const st = findSlot(blocks, R.dinner.dur, dinnerTarget, W, S);
      if (st != null && st + R.dinner.dur <= tail) add(st, R.dinner.dur, R.dinner.title, 'meal', { tag: 'dinner' });
    }
  }

  // 4. Work / school: fills `hours` of real work time from the start time,
  //    flowing around lunch and anything already placed (so the day ends later instead of shrinking)
  const c = p.commit;
  const wd = dateOf(k).getDay();
  if (c && c.enabled && c.days.includes(wd)) {
    const cs = toMin(c.start);
    const need = workMinutes(c);
    let left = need;
    const parts = [];
    for (const [s, e] of freeIntervals(blocks, W, S)) {
      if (left <= 0) break;
      const a = Math.max(s, cs);
      const take = Math.min(e - a, left);
      if (take >= 15) { parts.push(add(a, take, c.label || 'Work / School', 'commit', { part: parts.length })); left -= take; }
    }
    parts.forEach((b, i) => {
      b.points = Math.max(5, Math.round(POINTS.commit * (b.end - b.start) / need));
      if (parts.length > 1) b.title = `${c.label || 'Work / School'} (part ${i + 1}/${parts.length})`;
    });
    if (left > 0) day.workShort = left; else delete day.workShort;
  } else delete day.workShort;

  const startOf = { morning: W, afternoon: lunchEnd, evening: Math.max(lunchEnd, toMin('17:00')) };
  const needsExercise = R.exercise.on && !hasExercise && !prios.some(x => x.category === 'health') && !habits.some(x => x.category === 'health');
  const addExercise = from => {
    const st = findSlot(blocks, R.exercise.dur, Math.max(from, floor), floor, S);
    if (st != null) add(st, R.exercise.dur, R.exercise.title, 'exercise');
  };
  if (needsExercise && V.exercise === 'morning') addExercise(W);

  // 5. Daily goals without a fixed time go first so they never get squeezed out
  for (const h of habits.filter(x => !x.time && !blocks.some(b => b.type === 'habit' && b.tag === x.id))) {
    const st = findSlot(blocks, h.duration, Math.max(V.main === 'afternoon' ? startOf.evening : W, floor), floor, S);
    if (st != null) add(st, h.duration, h.title, 'habit', { tag: h.id });
  }

  // 6. Flexible priorities — most important first, placed where the style wants them
  const weight = { high: 3, medium: 2, low: 1 };
  const flexible = prios.filter(x => !x.time && !x.anytime).sort((a, b) => weight[b.importance] - weight[a.importance] || b.duration - a.duration);
  const overflow = [];
  for (const pr of flexible) {
    // parts that were kept in place count towards the duration; new parts get unused part numbers
    const chunks = blocks.filter(b => b.type === 'task' && b.pid === pr.id);
    let remaining = pr.duration - chunks.reduce((s, b) => s + b.end - b.start, 0);
    let nextPart = chunks.reduce((n, b) => Math.max(n, (b.part ?? 0) + 1), 0);
    const from = Math.max(startOf[pr.importance === 'low' ? V.low : V.main], floor);
    while (remaining > 0) {
      const want = Math.min(remaining, V.chunk);
      let st = findSlot(blocks, want, from, floor, S), take = want;
      if (st == null) {
        const lf = largestFree(blocks, floor, S);
        if (!lf || lf[1] - lf[0] < 25) break;
        st = lf[0];
        take = Math.min(want, lf[1] - lf[0]);
      }
      const b = add(st, take, pr.title, 'task', { pid: pr.id, part: nextPart++ });
      chunks.push(b);
      remaining -= take;
      // short break after a long focus block, if there is room
      if (take >= 45 && freeIntervals(blocks, b.end, b.end + 10).some(([s, e]) => s === b.end && e === b.end + 10)) {
        add(b.end, 10, 'Short break — stand up, stretch, drink water', 'break', { part: `${pr.id}-${chunks.length}` });
      }
    }
    const base = prioPoints(pr);
    const placed = pr.duration - remaining;
    chunks.sort((a, b) => a.start - b.start).forEach((b, i) => {
      b.points = Math.max(5, Math.round(base * (b.end - b.start) / pr.duration));
      b.title = chunks.length > 1 ? `${pr.title} (part ${i + 1}/${chunks.length})` : pr.title;
    });
    if (placed < pr.duration) overflow.push({ pid: pr.id, minutes: pr.duration - placed });
  }

  // 7. Exercise if the person didn't plan any health activity
  if (needsExercise && V.exercise !== 'morning') addExercise(Math.max(W, toMin('16:00')));

  // 8. Whatever is left becomes free time
  for (const f of freeSlots(blocks, W, S)) add(f.start, f.dur, f.title, 'free', { part: f.part });

  blocks.sort((a, b) => a.start - b.start);

  // 9. "Anytime" priorities get no time slot — they sit in a list under the plan
  for (const pr of prios.filter(x => x.anytime && !x.time)) {
    blocks.push({ start: S, end: S, title: pr.title, type: 'anytime', pid: pr.id, points: prioPoints(pr), part: 0 });
  }

  // keep statuses from the previous plan for blocks that still exist
  const old = {};
  for (const b of day.plan?.blocks || []) old[b.key] = b.status;
  for (const b of blocks) {
    b.key = `${b.type}|${b.pid || b.tag || b.title}|${b.part ?? 0}`;
    b.id = uid();
    b.status = b.type === 'free' ? null : (old[b.key] || 'todo');
  }
  day.plan = { blocks, overflow, clashes, style, builtAt: Date.now() };
}

// gaps of 20+ minutes become free-time blocks
function freeSlots(blocks, W, S) {
  return freeIntervals(blocks, W, S).filter(([s, e]) => e - s >= 20)
    .map(([s, e], i) => ({ start: s, dur: e - s, title: FREE_TITLES[i % FREE_TITLES.length], part: i + 1 }));
}

// Fixed-time items are placed exactly where asked, so they can overlap each other or the routine,
// or fall outside the waking day. Flags those blocks and returns what to warn about.
function findClashes(blocks, W, S) {
  const out = [];
  const pinned = b => b.type === 'task' || b.type === 'habit';
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  sorted.forEach((a, i) => {
    if (pinned(a) && (a.start < W || a.end > S)) { a.clash = true; out.push({ a: a.title, b: null, at: a.start }); }
    for (const b of sorted.slice(i + 1)) {
      if (b.start >= a.end) break;
      if (!pinned(a) && !pinned(b)) continue;
      a.clash = b.clash = true;
      out.push({ a: a.title, b: b.title, at: b.start });
    }
  });
  return out;
}
const clashText = c => c.b ? `“${c.a}” overlaps “${c.b}” at ${fmt(c.at)}` : `“${c.a}” falls outside your waking hours`;

// Which blocks of the current plan a rebuild must leave alone. Anything whose source changed
// (deleted, given a fixed time, new duration, past the new bedtime) is placed fresh instead.
function keptBlocks(day, isToday, prios, habits, R, W, S) {
  const finished = b => isToday && (b.status === 'done' || b.status === 'skipped');
  const kept = (day.plan?.blocks || []).filter(b => {
    if (!b.manual && !finished(b)) return false;
    if (b.start < W || b.end > S) return false;
    if (b.type === 'task') { const pr = prios.find(x => x.id === b.pid); return pr && !pr.time && !pr.anytime; }
    if (b.type === 'habit') { const h = habits.find(x => x.id === b.tag); return h && !h.time && b.end - b.start === h.duration; }
    if (b.type === 'meal') return R[b.tag]?.on && b.end - b.start === R[b.tag].dur;
    if (b.type === 'exercise') return R.exercise.on && b.end - b.start === R.exercise.dur;
    return false;
  });
  // a priority shortened below what is already placed gets scheduled again from scratch
  return kept.filter(b => {
    if (b.type !== 'task') return true;
    const total = kept.filter(x => x.type === 'task' && x.pid === b.pid).reduce((s, x) => s + x.end - x.start, 0);
    return total <= prios.find(x => x.id === b.pid).duration;
  });
}

/* ---------- moving blocks by hand ---------- */

function canMoveBlock(k, day, b) {
  if (!canEdit(k) || b.status !== 'todo') return false;
  if (b.type === 'habit') return !state.habits.find(h => h.id === b.tag)?.time; // a fixed time applies to every day
  return ['task', 'exercise', 'meal'].includes(b.type);
}

// Moves block `id` into a free slot, or swaps it with another movable block.
// Returns an error message, or null on success. With dry = true it only checks.
function moveBlock(k, id, targetId, dry = false) {
  const day = getDay(k), blocks = day.plan.blocks;
  const b = blocks.find(x => x.id === id), t = blocks.find(x => x.id === targetId);
  if (!b || !t || b === t || t.type === 'anytime') return 'Drop it on a free slot or another movable block';
  const { W, S } = dayBounds(k);
  const earliest = k === todayKey() ? Math.max(W, ceil5(nowMinutes())) : W;
  const dur = b.end - b.start;
  let newB, newT = null;
  if (t.type === 'free') {
    newB = Math.max(t.start, earliest);
    if (newB + dur > t.end) return `${hours(dur)} doesn't fit in that free slot`;
  } else if (canMoveBlock(k, day, t)) {
    const tDur = t.end - t.start;
    if (b.start < t.start) { newT = b.start; newB = t.end - dur; }
    else { newB = t.start; newT = b.end - tDur; }
    if (Math.min(newB, newT) < earliest) return 'That would move a block into time that has already passed';
    const fits = (s, e) => !blocks.some(x => x !== b && x !== t && x.type !== 'free' && x.type !== 'anytime' && x.start < e && s < x.end);
    if (newB < newT + tDur && newT < newB + dur) return "Those two blocks don't fit when swapped";
    if (!fits(newB, newB + dur) || !fits(newT, newT + tDur)) return "Those two blocks don't fit when swapped";
  } else return `“${t.title}” stays at a fixed time`;
  if (dry) return null;

  const place = (x, start) => {
    x.end = start + (x.end - x.start);
    x.start = start;
    const pr = x.type === 'task' && day.priorities.find(p => p.id === x.pid);
    if (pr?.time) pr.time = fmt(start); // fixed-time priorities keep their new time through rebuilds
    else x.manual = true;
  };
  if (newT != null) place(t, newT);
  place(b, newB);

  const timed = blocks.filter(x => x.type !== 'free' && x.type !== 'anytime');
  const free = freeSlots(timed, W, S).map(f => ({
    start: f.start, end: f.start + f.dur, title: f.title, type: 'free', points: 0, part: f.part,
    key: `free|${f.title}|${f.part}`, id: uid(), status: null,
  }));
  day.plan.blocks = [...timed, ...free].sort((x, y) => x.start - y.start).concat(blocks.filter(x => x.type === 'anytime'));
  const moved = [b.title, t.title];
  day.plan.clashes = (day.plan.clashes || []).filter(c => !moved.includes(c.a) && !moved.includes(c.b));
  for (const x of day.plan.blocks) x.clash = day.plan.clashes.some(c => c.a === x.title || c.b === x.title);
  return null;
}

const planSignature = k => JSON.stringify((getDay(k)?.plan?.blocks || []).map(b => [b.start, b.end, b.key]));

function habitStatus(k, h) {
  return state.days[k]?.plan?.blocks.find(b => b.type === 'habit' && b.tag === h.id)?.status || null;
}

// habits without `days` (older saves) run every day
const habitOn = (h, k) => !h.days || h.days.includes(dateOf(k).getDay());

// consecutive done days, counting today only if it's already done; days the goal is off don't break it
function habitStreak(h, fromKey = todayKey()) {
  let n = habitStatus(fromKey, h) === 'done' ? 1 : 0;
  for (let k = addDays(fromKey, -1); k >= h.since; k = addDays(k, -1)) {
    if (!habitOn(h, k)) continue;
    if (habitStatus(k, h) === 'done') n++; else break;
  }
  return n;
}

// unfinished priorities from the last 3 days that haven't been carried over or dropped yet
function carryCandidates() {
  const out = [];
  for (let i = 1; i <= 3; i++) {
    const k = addDays(todayKey(), -i), d = state.days[k];
    if (!d) continue;
    for (const pr of d.priorities) if (!pr.carried && !priorityState(d, pr).done) out.push({ k, pr });
  }
  return out;
}

// A day planned in advance locks when it starts: you planned it, now follow it (marking blocks still works).
// A day that starts with no priorities stays open so you're never stuck with an empty day; "Replan" reopens
// a locked one. Past days are a record and can't be replanned.
const canEdit = k => {
  const t = todayKey();
  if (k !== t) return k > t;
  return !state.days[k]?.locked;
};

// Runs when the app starts, a new day begins or a backup is loaded.
function ensureToday() {
  if (!state.profile) return;
  if (!state.startDay) state.startDay = Object.keys(state.days).sort()[0] || todayKey();
  const k = todayKey(), day = getDay(k, true);
  if (!day.plan) buildPlan(k);
  if (day.locked === undefined) day.locked = k !== state.startDay && day.priorities.length > 0;
  save();
}

// the first day that can still take new priorities
const planTarget = () => canEdit(todayKey()) ? todayKey() : addDays(todayKey(), 1);
const dayWord = k => k === todayKey() ? 'today' : k === addDays(todayKey(), 1) ? 'tomorrow' : prettyDate(k, { weekday: 'long' });

// past days send priorities to the next editable day, others to the day after
const moveTarget = k => k < todayKey() ? planTarget() : addDays(k, 1);

function carryTo(pr, target = planTarget()) {
  getDay(target, true).priorities.push({ ...pr, id: uid(), moved: (pr.moved || 0) + 1, carried: undefined });
  pr.carried = target; // keep the original so its day stays honest
}

// Plans saved before a routine block was removed from ROUTINE_KEYS still hold it: take it out of
// today's and future plans (unless already done, so earned points stay) and refill the gaps with free time.
function dropRemovedRoutine() {
  const R = routineOf(state.profile);
  const removed = b => b.status !== 'done' && (
    (b.type === 'meal' && !R[b.tag]?.on) ||
    (b.type === 'routine' && b.tag && !R[b.tag]?.on) ||
    (b.type === 'review' && !R.review.on) ||
    (b.type === 'winddown' && !R.winddown.on));
  const t = todayKey();
  for (const k in state.days) {
    const plan = state.days[k].plan;
    if (k < t || !plan || !plan.blocks.some(removed)) continue;
    const { W, S } = dayBounds(k);
    const timed = plan.blocks.filter(b => b.type !== 'free' && b.type !== 'anytime' && !removed(b));
    const free = freeSlots(timed, W, S).map(f => ({
      start: f.start, end: f.start + f.dur, title: f.title, type: 'free', points: 0, part: f.part,
      key: `free|${f.title}|${f.part}`, id: uid(), status: null,
    }));
    plan.blocks = [...timed, ...free].sort((x, y) => x.start - y.start).concat(plan.blocks.filter(b => b.type === 'anytime'));
  }
}

// rebuild upcoming plans after the daily routine changes (a locked today keeps its plan)
function rebuildUpcoming() {
  const t = todayKey();
  for (const k in state.days) if (k >= t && state.days[k].plan && canEdit(k)) buildPlan(k);
  if (!getDay(t)?.plan) buildPlan(t);
}

function priorityState(day, pr) {
  const bl = (day.plan?.blocks || []).filter(b => b.pid === pr.id);
  return {
    blocks: bl,
    done: bl.length > 0 && bl.every(b => b.status === 'done'),
    skipped: bl.length > 0 && bl.every(b => b.status === 'skipped'),
    overflow: day.plan?.overflow.find(o => o.pid === pr.id),
  };
}
