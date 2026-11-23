'use strict';

/* Planner X — Coach: daily messages, greetings and week/month/year insights. */

/* ---------------- coach ---------------- */

const QUOTES = [
  'Small steps every day add up to big results.',
  'You don\'t have to be extreme, just consistent.',
  'Do the hard thing first. The rest of the day gets easier.',
  'A goal without a plan is just a wish.',
  'Discipline is choosing what you want most over what you want now.',
  'Done is better than perfect.',
  'Focus on progress, not perfection.',
  'The best time to start was yesterday. The next best time is now.',
  'What you do every day matters more than what you do once in a while.',
  'Rest is part of the plan, not a break from it.',
  'One task at a time. One day at a time.',
  'Your future is created by what you do today, not tomorrow.',
  'If it takes less than two minutes, do it now.',
  'Energy, not time, is your most valuable resource.',
  'Protect your mornings and your mornings will protect your day.',
  'Motivation gets you started. Habit keeps you going.',
  'Say no to the good so you can say yes to the great.',
  'Clarity comes from action, not thought.',
];

function coachMessages(k) {
  const msgs = [];
  const r = rng(k + (state.profile?.name || ''));
  const day = getDay(k) || { priorities: [], plan: null, log: [] };
  const today = todayKey();
  const isToday = k === today, isPast = k < today;
  const prios = day.priorities;
  const blocks = day.plan?.blocks || [];
  const name = state.profile?.name || 'friend';
  const push = (kind, text) => msgs.push({ kind, text });

  // --- priorities ---
  if (isToday && !canEdit(k)) {
    const tomorrow = getDay(addDays(k, 1));
    if (!tomorrow?.priorities.length) {
      push('do', pick([
        'Today\'s plan is locked — follow it. Tonight, write tomorrow\'s priorities so tomorrow starts with a plan.',
        'Before bed, plan tomorrow. A day that starts with a plan is already half won.',
      ], r));
    }
  }
  if (!prios.length && !(isToday && !canEdit(k))) {
    push('do', pick([
      'Write 1–3 priorities for {d}. A day without priorities gets filled by other people\'s.',
      'Start by adding your priorities. What would make {d} a win?',
      'No priorities yet. Add the 3 things that matter most and I\'ll build your day around them.',
    ], r).replace('{d}', isToday ? 'today' : DAY_NAMES[dateOf(k).getDay()]));
  } else {
    const firstTask = blocks.filter(b => b.type === 'task' && b.status !== 'done').map(b => ({ b, pr: prios.find(p => p.id === b.pid) }))
      .filter(x => x.pr).sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.pr.importance] - { high: 0, medium: 1, low: 2 }[b.pr.importance] || a.b.start - b.b.start))[0];
    if (firstTask) {
      push('do', fill(pick([
        'Your most important task is “{t}” at {time}. Do it before you check messages.',
        'At {time} it\'s time for “{t}”. Phone in another room — protect this block.',
        '“{t}” is the one that moves your life forward. It starts at {time}.',
        'If you only finish one thing, make it “{t}” ({time}).',
      ], r), { t: firstTask.pr.title, time: fmt(firstTask.b.start) }));
    }
    const highs = prios.filter(p => p.importance === 'high').length;
    if (highs > 3) push('change', `You marked ${highs} priorities as high. If everything is important, nothing is — keep max 3 high.`);
    if (prios.length > 7) push('change', `${prios.length} priorities is a lot for one day. Move the least important ones to another day.`);
  }

  // --- overload ---
  const ov = day.plan?.overflow || [];
  if (ov.length) {
    const mins = ov.reduce((s, o) => s + o.minutes, 0);
    const names = ov.map(o => `“${prios.find(p => p.id === o.pid)?.title}”`).join(', ');
    push('change', fill(pick([
      'Your day is overbooked by {h}. {n} didn\'t fit — move it to tomorrow or make it shorter.',
      '{h} of tasks don\'t fit in your day ({n}). Be realistic: reschedule or shrink them.',
    ], r), { h: hours(mins), n: names }));
  }

  // --- postponed tasks ---
  for (const pr of prios.filter(p => (p.moved || 0) >= 2)) {
    push('change', fill(pick([
      '“{t}” has been postponed {n} times. Break it into a 25-minute first step and do that first.',
      'You keep moving “{t}” ({n}×). Either do it first today, or decide it doesn\'t matter and delete it.',
    ], r), { t: pr.title, n: pr.moved }));
  }

  // --- daily goals ---
  if (!state.habits.length && !isPast) {
    push('tip', 'Add daily goals — things you want to do every day, like reading or drinking water. They appear in every plan automatically.');
  }
  const habitMsgs = [];
  for (const h of state.habits.filter(x => x.since <= k)) {
    let missed = 0;
    for (let i = 1; i <= 7; i++) {
      const dk = addDays(k, -i);
      if (dk < h.since) break;
      if (dk >= todayKey()) continue;
      const s = habitStatus(dk, h);
      if (s === 'skipped' || s === 'todo') missed++;
    }
    const sk = habitStreak(h, isPast ? k : addDays(k, -1));
    if (missed >= 3) {
      habitMsgs.push({ kind: 'change', text: fill(pick([
        'You missed “{t}” {n} times this week. Make it smaller — even 5 minutes keeps the habit alive.',
        h.time
          ? '“{t}” keeps slipping ({n} misses in 7 days). Maybe {time} is a bad moment — try another time.'
          : '“{t}” keeps slipping ({n} misses in 7 days). Give it a fixed time so it stops getting pushed away.',
      ], r), { t: h.title, n: missed, time: h.time }) });
    } else if (sk >= 3) {
      habitMsgs.push({ kind: 'win', text: fill(pick([
        '🔥 “{t}”: {n} days in a row. Keep the chain going today!',
        '{n}-day streak on “{t}”. This is how habits are built.',
      ], r), { t: h.title, n: sk }) });
    }
  }
  habitMsgs.slice(0, 2).forEach(m => push(m.kind, m.text));

  // --- yesterday ---
  const yk = addDays(k, -1), ys = dayStats(yk);
  if (ys.total && !isPast) {
    if (ys.pct < 50) {
      push('change', fill(pick([
        'Yesterday you finished {p}% of your plan. Plan a bit less today and nail your top task.',
        'Only {p}% done yesterday. What got in the way? Remove one thing from today to make room.',
        'Yesterday was {p}%. No guilt — today is a new day. Start with the easiest win to build momentum.',
      ], r), { p: ys.pct }));
    } else if (ys.pct >= 80) {
      push('win', fill(pick([
        'Yesterday: {p}% done and +{pts} points. Keep that energy, {name}!',
        'Great job yesterday — {p}% completed. Let\'s repeat it.',
      ], r), { p: ys.pct, pts: ys.points, name }));
    }
  }

  // --- patterns over the last 7 days ---
  const skips = {};
  let healthDone = 0, socialDays = 0;
  for (let i = 1; i <= 7; i++) {
    const d = state.days[addDays(k, -i)];
    if (!d?.plan) continue;
    for (const b of d.plan.blocks) {
      if (b.status === 'skipped') skips[b.type] = (skips[b.type] || 0) + 1;
      if (b.status === 'done' && (b.type === 'exercise' || (b.type === 'task' && d.priorities.find(p => p.id === b.pid)?.category === 'health'))) healthDone++;
    }
    if (d.priorities.some(p => p.category === 'social' || p.category === 'personal')) socialDays++;
  }
  if ((skips.exercise || 0) >= 3) push('change', `You skipped exercise ${skips.exercise} times this week. Try just 10 minutes — small beats nothing.`);
  if ((skips.winddown || 0) >= 3) push('change', 'You keep skipping wind-down. Screens before bed hurt your sleep — try putting the phone away 30 minutes earlier.');
  if ((skips.routine || 0) >= 4) push('change', 'Your morning routine is getting skipped. Prepare clothes and breakfast the night before.');
  if ((skips.meal || 0) >= 3) push('change', 'You\'ve been skipping meals. Your focus depends on fuel — don\'t skip lunch today.');
  if ((skips.task || 0) >= 5) push('change', `You skipped ${skips.task} priority blocks this week. Your plans may be too big — use shorter durations.`);
  if (Object.keys(state.days).length > 3 && healthDone === 0 && !prios.some(p => p.category === 'health')) {
    push('tip', 'No healthy activity done in the last 7 days. Add a health priority — even a 20-minute walk.');
  }
  if (Object.keys(state.days).length > 5 && socialDays === 0 && !prios.some(p => p.category === 'social' || p.category === 'personal')) {
    push('tip', 'Your last week was all duty. Plan something just for you or someone you care about.');
  }

  // --- sleep ---
  if (state.profile) {
    const { W, S } = dayBounds(k);
    const sleepH = (1440 - (S - W)) / 60;
    if (sleepH < 7) push('change', `You're giving yourself only ${sleepH.toFixed(1)}h of sleep. Move bedtime 30 minutes earlier in Settings.`);
  }
  if (!isPast && state.notes.length >= 5) {
    push('tip', `You have ${state.notes.length} quick notes waiting. Turn the important ones into priorities and delete the rest.`);
  }
  if (isToday && !state.reminders.enabled && r() < 0.4) {
    push('tip', 'Turn on reminders in Settings and I\'ll tell you when each block starts.');
  }

  // --- live (today) ---
  if (isToday && blocks.length) {
    const now = nowMinutes();
    const open = blocks.filter(b => b.type !== 'free' && b.type !== 'anytime' && b.end <= now && b.status === 'todo');
    if (open.length >= 2) push('do', `You have ${open.length} unmarked blocks from earlier. Mark them done or skipped — honesty makes the plan smarter.`);
    const st = dayStats(k);
    if (st.pct === 100) push('win', `Perfect day! Every block done. +${st.bonus} bonus points.`);
  }
  if (isPast && day.plan) {
    const st = dayStats(k);
    push(st.pct >= 70 ? 'win' : 'tip', `This day: ${st.pct}% done, ${st.points} points. ${st.pct >= 70 ? 'Well done.' : 'Look at what was skipped and plan it better next time.'}`);
  }

  // --- streak & level ---
  const s = streak(isPast ? k : addDays(k, -1));
  if (s >= 3) push('win', `🔥 ${s}-day streak of 70%+ days. Don't break the chain!`);
  if (!isPast) {
    const left = levelInfo(state.level + 1).need - totalPoints();
    const possible = dayStats(k).possible - dayStats(k).points + dayStats(k).bonus;
    if (left > 0) push('tip', `You're ${left} pts away from Level ${state.level + 1} (${levelInfo(state.level + 1).name}). ${possible > 0 ? `This plan still has ~${possible} pts to earn.` : ''}`);
  }

  // --- goals with nothing pushing them forward ---
  if (!isPast && canEdit(k)) {
    const links = goalProgressMap();
    const lonely = goalChoices(k).find(g => !links[g.ref]);
    if (lonely) push('do', `Your ${lonely.period.toLowerCase()} goal “${lonely.text}” has no priorities yet. Add one and link it to this goal.`);
  }

  // --- backup ---
  if (isToday && backupDue()) {
    push('do', state.lastBackup
      ? 'It\'s been over two weeks since your last backup. Your plans only live in this browser — export one in Settings.'
      : 'Your plans only live in this browser. Export a backup in Settings so you can\'t lose them.');
  }

  // --- calendar nudges ---
  const dt = dateOf(k), wd = dt.getDay();
  const wk = 'W-' + weekStart(k), mk = 'M-' + k.slice(0, 7), yk2 = 'Y-' + k.slice(0, 4);
  if (!isPast) {
    if (!(state.goals[wk] || []).length) push('do', wd === 1 ? 'It\'s Monday — set 1–3 goals for this week in the Week tab.' : 'You have no goals for this week yet. Add them in the Week tab.');
    if (dt.getDate() <= 3 && !(state.goals[mk] || []).length) push('do', `New month! What do you want to achieve in ${MONTH_NAMES[dt.getMonth()]}? Add month goals.`);
    if (!(state.goals[yk2] || []).length && r() < 0.5) push('tip', `Set your big goals for ${dt.getFullYear()} in the Year tab — daily plans should serve them.`);
    if (wd === 5) push('tip', 'Friday: finish open loops before the weekend. Review the Week tab tonight.');
    if (wd === 0) push('tip', 'Sunday: take 15 minutes to plan next week. Future-you will thank you.');
  }

  // order: change > do > win > tip, keep it readable
  const order = { change: 0, do: 1, win: 2, tip: 3 };
  msgs.sort((a, b) => order[a.kind] - order[b.kind]);
  return msgs.slice(0, 7);
}

function greeting(k) {
  const name = esc(state.profile?.name || '');
  if (k !== todayKey()) return k < todayKey() ? `Looking back at ${prettyDate(k, { weekday: 'long', day: 'numeric', month: 'short' })}` : `Planning ${prettyDate(k, { weekday: 'long', day: 'numeric', month: 'short' })}`;
  const h = Math.floor(nowMinutes() / 60);
  const r = rng(k + 'greet');
  if (h < 12) return pick([`Good morning, ${name}`, `Rise and shine, ${name}`, `Morning, ${name} — let's go`], r);
  if (h < 18) return pick([`Good afternoon, ${name}`, `Keep going, ${name}`, `Halfway there, ${name}`], r);
  return pick([`Good evening, ${name}`, `Almost done, ${name}`, `Time to finish strong, ${name}`], r);
}

function nowMinutes() {
  const d = new Date();
  const m = d.getHours() * 60 + d.getMinutes();
  return todayKey() === keyOf(d) ? m : m + 1440; // still awake after midnight: the day continues past 24:00
}

// Insights for week / month / year views
function periodInsights(keys, label) {
  const msgs = [];
  const planned = keys.map(k => ({ k, s: dayStats(k) })).filter(x => x.s.total);
  if (!planned.length) return [{ kind: 'do', text: `No planned days in this ${label} yet. Open a day and add your priorities.` }];
  const avg = Math.round(planned.reduce((a, x) => a + x.s.pct, 0) / planned.length);
  const pts = planned.reduce((a, x) => a + x.s.points, 0);
  const best = planned.reduce((a, x) => x.s.pct > a.s.pct ? x : a);
  const worst = planned.reduce((a, x) => x.s.pct < a.s.pct ? x : a);

  msgs.push({ kind: avg >= 70 ? 'win' : 'tip', text: `Average completion this ${label}: ${avg}% across ${planned.length} planned day${planned.length > 1 ? 's' : ''}, ${pts} points earned.` });
  if (planned.length > 1) {
    msgs.push({ kind: 'win', text: `Best day: ${prettyDate(best.k, { weekday: 'long', day: 'numeric', month: 'short' })} with ${best.s.pct}%.` });
    if (worst.s.pct < 60) msgs.push({ kind: 'change', text: `Weakest day: ${prettyDate(worst.k, { weekday: 'long', day: 'numeric', month: 'short' })} (${worst.s.pct}%). What got in the way? Plan lighter on days like that.` });
  }

  // weekday pattern for longer periods
  if (label !== 'week' && planned.length >= 10) {
    const byWd = Array.from({ length: 7 }, () => []);
    planned.forEach(x => byWd[dateOf(x.k).getDay()].push(x.s.pct));
    const avgs = byWd.map((a, i) => ({ i, v: a.length ? a.reduce((s, x) => s + x, 0) / a.length : null })).filter(x => x.v != null);
    const low = avgs.reduce((a, x) => x.v < a.v ? x : a);
    if (low.v < avg - 10) msgs.push({ kind: 'change', text: `${DAY_NAMES[low.i]}s are your weakest days (${Math.round(low.v)}%). Schedule fewer priorities on ${DAY_NAMES[low.i]}s.` });
  }

  // time per category
  const cat = {};
  let skipped = 0;
  for (const { k } of planned) {
    const d = state.days[k];
    for (const b of d.plan.blocks) {
      if (b.status === 'skipped') skipped++;
      if (b.type !== 'task' || b.status !== 'done') continue;
      const c = d.priorities.find(p => p.id === b.pid)?.category || 'personal';
      cat[c] = (cat[c] || 0) + (b.end - b.start);
    }
  }
  const cats = Object.entries(cat).sort((a, b) => b[1] - a[1]);
  if (cats.length) {
    msgs.push({ kind: 'tip', text: `Most of your focused time went to ${CATEGORIES[cats[0][0]].icon} ${CATEGORIES[cats[0][0]].label} (${hours(cats[0][1])}). ${cats.length === 1 ? 'Consider balancing with health or personal time.' : ''}` });
  }
  if (!cat.health) msgs.push({ kind: 'change', text: `No health priorities completed this ${label}. Your body runs the whole plan — give it time.` });
  if (skipped > planned.length * 3) msgs.push({ kind: 'change', text: `${skipped} blocks skipped this ${label}. Your plans may be too ambitious — try shorter durations.` });
  return msgs;
}
