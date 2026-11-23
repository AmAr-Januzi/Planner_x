'use strict';

/* Planner X — Stats page: how the last days, weeks or months really went. */

const STAT_RANGES = [[30, '30 days'], [90, '90 days'], [365, 'Year']];

const avgOf = list => list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null;

// a day counts once it's over, or as soon as something on today is marked; an untouched today says nothing yet
function countedDays(n) {
  const today = todayKey();
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1))
    .map(k => ({ k, s: dayStats(k) }))
    .filter(({ k, s }) => s.total && (k < today || s.done));
}

// 30 days → one column per day, 90 → per week, a year → per month
function completionColumns(n, days) {
  const today = todayKey();
  const by = {};
  for (const d of days) (by[n === 30 ? d.k : n === 90 ? weekStart(d.k) : d.k.slice(0, 7)] ||= []).push(d.s.pct);
  const cols = [];
  const shortDate = k => prettyDate(k, { day: 'numeric', month: 'short' });
  if (n === 30) {
    for (let i = 29; i >= 0; i--) {
      const k = addDays(today, -i);
      cols.push({ key: k, label: shortDate(k) });
    }
  } else if (n === 90) {
    for (let i = 12; i >= 0; i--) {
      const k = weekStart(addDays(today, -i * 7));
      cols.push({ key: k, label: `Week of ${shortDate(k)}` });
    }
  } else {
    const t = dateOf(today);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(t.getFullYear(), t.getMonth() - i, 1);
      cols.push({ key: keyOf(d).slice(0, 7), label: `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}` });
    }
  }
  return cols.map(c => ({ label: c.label, value: avgOf(by[c.key] || []) }));
}

function columnChart(cols, name, showAllLabels) {
  const tip = c => `${c.label}: ${c.value == null ? 'nothing planned' : c.value + '% done'}`;
  const mid = Math.floor((cols.length - 1) / 2);
  return `
  <div class="vchart" role="img" aria-label="${esc(name)}. The table below has every value.">
    <div class="vgrid" aria-hidden="true">
      <div><span>100%</span></div><div><span>50%</span></div><div><span>0%</span></div>
    </div>
    <div class="vcols">
      ${cols.map(c => `<div class="vcol" title="${esc(tip(c))}"><span style="height:${c.value || 0}%"></span></div>`).join('')}
    </div>
  </div>
  <div class="vaxis ${showAllLabels ? 'all' : ''}" aria-hidden="true">
    ${showAllLabels
      ? cols.map(c => `<span>${esc(c.label)}</span>`).join('')
      : `<span>${esc(cols[0].label)}</span><span>${esc(cols[mid].label)}</span><span>${esc(cols[cols.length - 1].label)}</span>`}
  </div>`;
}

const tableView = (head, rows) => `
  <details class="table-view">
    <summary>Show as table</summary>
    <table class="levels-table">
      <thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </details>`;

// minutes planned and finished per category; anytime priorities count with their estimated duration
function categoryTime(days) {
  const out = {};
  for (const { k } of days) {
    const d = state.days[k];
    for (const b of d.plan.blocks) {
      if (b.type !== 'task' && b.type !== 'anytime') continue;
      const pr = d.priorities.find(p => p.id === b.pid);
      if (!pr) continue;
      const min = b.type === 'anytime' ? pr.duration : b.end - b.start;
      const c = out[pr.category] ||= { planned: 0, done: 0 };
      c.planned += min;
      if (b.status === 'done') c.done += min;
    }
  }
  return Object.entries(out).sort((a, b) => b[1].planned - a[1].planned);
}

function categoryCard(days) {
  const cats = categoryTime(days);
  const max = Math.max(1, ...cats.map(([, c]) => c.planned));
  return `
  <div class="card">
    <h2>⏳ Planned vs. done, by category</h2>
    ${cats.length ? `
    <div class="legend stat-legend"><i class="sw-done"></i> Done <i class="sw-planned"></i> Planned but not done</div>
    <div class="hbars">
      ${cats.map(([cat, c]) => `
      <div class="hbar">
        <div class="hbar-label">${CATEGORIES[cat].icon} ${CATEGORIES[cat].label}</div>
        <div class="hbar-track-wrap"><div class="hbar-track" style="width:${c.planned / max * 100}%"><span style="width:${c.done / c.planned * 100}%"></span></div></div>
        <div class="hbar-value">${hours(c.done)} of ${hours(c.planned)}</div>
      </div>`).join('')}
    </div>
    ${tableView(['Category', 'Planned', 'Done', 'Share done'], cats.map(([cat, c]) => [CATEGORIES[cat].label, hours(c.planned), hours(c.done), `${Math.round(c.done / c.planned * 100)}%`]))}`
    : '<p class="muted small">No priorities in this period yet.</p>'}
  </div>`;
}

function habitsHistoryCard() {
  if (!state.habits.length) return '';
  const today = todayKey();
  const keys = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
  const cell = (h, k) => {
    const date = prettyDate(k, { day: 'numeric', month: 'short' });
    if (k < h.since || !habitOn(h, k)) return `<i class="hc off" title="${date}: not scheduled"></i>`;
    const s = habitStatus(k, h);
    if (s === 'done') return `<i class="hc done" title="${date}: done"></i>`;
    if (k === today && s !== 'skipped') return `<i class="hc off" title="${date}: still open"></i>`;
    return `<i class="hc missed" title="${date}: not done"></i>`;
  };
  const rows = state.habits.map(h => {
    const sched = keys.filter(k => k >= h.since && habitOn(h, k) && (k < today || habitStatus(k, h) === 'done'));
    const done = sched.filter(k => habitStatus(k, h) === 'done').length;
    const sk = habitStreak(h);
    return { h, done, sched: sched.length, sk };
  });
  return `
  <div class="card">
    <h2>🔁 Daily goals <span class="muted small">last 30 days</span></h2>
    <div class="legend stat-legend"><i class="hc done"></i> Done <i class="hc missed"></i> Not done <i class="hc off"></i> Not scheduled or still open</div>
    <div class="habit-hist">
      ${rows.map(({ h, done, sched, sk }) => `
      <div class="habit-hist-row">
        <div class="habit-hist-head">
          <b>${esc(h.title)}</b>
          <span class="muted small">${done}/${sched} done${sk ? ` · 🔥 ${sk} day${sk > 1 ? 's' : ''}` : ''}</span>
        </div>
        <div class="habit-cells">${keys.map(k => cell(h, k)).join('')}</div>
      </div>`).join('')}
    </div>
    ${tableView(['Daily goal', 'Done', 'Scheduled', 'Streak'], rows.map(({ h, done, sched, sk }) => [h.title, done, sched, `${sk} day${sk === 1 ? '' : 's'}`]))}
  </div>`;
}

function viewStats() {
  const n = ui.statsRange;
  const days = countedDays(n);
  const avg = avgOf(days.map(d => d.s.pct));
  const points = days.reduce((a, d) => a + d.s.points, 0);
  const finished = days.reduce((a, { k }) => a + state.days[k].plan.blocks.filter(b => (b.type === 'task' || b.type === 'anytime') && b.status === 'done').length, 0);
  const span = n === 30 ? 'per day' : n === 90 ? 'per week' : 'per month';
  const cols = completionColumns(n, days);
  const weekdays = WEEK_ORDER.map(wd => ({
    label: DAY_NAMES[wd].slice(0, 3),
    value: avgOf(days.filter(d => dateOf(d.k).getDay() === wd).map(d => d.s.pct)),
  }));
  const tile = (label, value) => `<div class="stat-tile"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`;

  return `
  <section class="period-head">
    <h1>Stats</h1>
    <div class="range-pick" role="group" aria-label="Time range">
      ${STAT_RANGES.map(([v, label]) => `<button class="${v === n ? 'sel' : ''}" data-act="statsRange" data-n="${v}" ${v === n ? 'aria-pressed="true"' : 'aria-pressed="false"'}>${label}</button>`).join('')}
    </div>
  </section>

  ${days.length ? `
  <div class="stat-tiles">
    ${tile('Average completion', `${avg}%`)}
    ${tile('Points earned', points.toLocaleString())}
    ${tile('Days tracked', days.length)}
    ${tile('Priority blocks finished', finished)}
    ${tile('Focus time, all time', hours(state.stats.focusMinutes))}
  </div>

  <div class="card">
    <h2>📈 Completion <span class="muted small">share of each day's points earned, ${span}</span></h2>
    ${columnChart(cols, `Completion ${span}`, false)}
    ${tableView(['Period', 'Completion'], cols.filter(c => c.value != null).map(c => [c.label, `${c.value}%`]))}
  </div>

  <div class="two-col">
    <div class="card">
      <h2>📆 Your week <span class="muted small">average completion by weekday</span></h2>
      ${columnChart(weekdays, 'Average completion by weekday', true)}
      ${tableView(['Weekday', 'Completion'], weekdays.filter(c => c.value != null).map(c => [c.label, `${c.value}%`]))}
    </div>
    ${categoryCard(days)}
  </div>
  ${habitsHistoryCard()}` : `
  <div class="card empty">
    Nothing to show for this period yet.<br>Mark some blocks in your plan and your stats will appear here.
  </div>`}`;
}
