'use strict';

/* Planner X — Week, Month and Year pages, and goals. */

/* ---------- goals ---------- */

// A priority can push a goal forward: pr.goal = "<goal list key>|<goal id>"
function findGoal(ref) {
  if (!ref) return null;
  const [gk, id] = ref.split('|');
  return state.goals[gk]?.find(g => g.id === id) || null;
}

// unfinished goals of the week, month and year that a day belongs to
function goalChoices(k) {
  return [['W-' + weekStart(k), 'Week'], ['M-' + k.slice(0, 7), 'Month'], ['Y-' + k.slice(0, 4), 'Year']]
    .flatMap(([gk, period]) => (state.goals[gk] || []).filter(g => !g.done).map(g => ({ ref: `${gk}|${g.id}`, period, text: g.text })));
}

function goalField(k, selected) {
  const choices = goalChoices(k);
  const current = findGoal(selected);
  if (!choices.length && !current) return '';
  const extra = current && !choices.some(c => c.ref === selected) ? `<option value="${esc(selected)}" selected>${esc(current.text)}</option>` : '';
  return `
  <div class="full">
    <label for="pGoal">Moves this goal forward (optional)</label>
    <select id="pGoal" name="goal">
      <option value="">No goal</option>
      ${extra}
      ${choices.map(c => `<option value="${esc(c.ref)}" ${c.ref === selected ? 'selected' : ''}>${c.period}: ${esc(c.text)}</option>`).join('')}
    </select>
  </div>`;
}

// { ref: { total, done } } across all days. A carried-over original is left out: its copy counts instead.
function goalProgressMap() {
  const out = {};
  for (const d of Object.values(state.days)) {
    for (const pr of d.priorities) {
      if (!pr.goal || pr.carried) continue;
      const x = out[pr.goal] ||= { total: 0, done: 0 };
      x.total++;
      if (priorityState(d, pr).done) x.done++;
    }
  }
  return out;
}

function goalsCard(gk, title) {
  const list = state.goals[gk] || [];
  const pts = GOAL_PTS[gk[0]];
  const links = goalProgressMap();
  const progress = g => {
    const p = links[`${gk}|${g.id}`];
    if (!p) return '<div class="goal-sub">No priorities linked yet</div>';
    return `
      <div class="goal-sub"><span>${p.done}/${p.total} linked ${p.total > 1 ? 'priorities' : 'priority'} done</span></div>
      <div class="bar goal-bar"><span style="width:${Math.round(p.done / p.total * 100)}%"></span></div>`;
  };
  return `
  <div class="card">
    <h2>${title} <span class="muted small">+${pts} pts each</span></h2>
    <form class="goal-form" data-goal="${gk}">
      <input name="text" required maxlength="100" placeholder="Add a goal…" aria-label="New goal">
      <button class="btn-primary" type="submit">Add</button>
    </form>
    ${list.length ? `<ul class="goal-list scroll-list" data-scroll="goal-${gk}">${list.map(g => `
      <li class="${g.done ? 'done' : ''}">
        <button class="check" data-act="toggleGoal" data-g="${gk}" data-id="${g.id}" aria-label="Toggle goal">✓</button>
        <div class="goal-main"><span class="goal-text">${esc(g.text)}</span>${progress(g)}</div>
        <button class="btn-ghost btn-small" data-act="delGoal" data-g="${gk}" data-id="${g.id}" aria-label="Delete">✕</button>
      </li>`).join('')}</ul>` : '<p class="muted small">No goals yet. Your daily priorities should push these forward.</p>'}
  </div>`;
}

function heat(pct, has) {
  if (!has) return 'var(--card)';
  return `color-mix(in srgb, var(--accent) ${10 + Math.round(pct * 0.75)}%, var(--card))`;
}

/* ---------- week ---------- */

function viewWeek() {
  const ws = weekStart(ui.date);
  const keys = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const stats = keys.map(dayStats);
  const pts = stats.reduce((a, s) => a + s.points, 0);
  const plannedDays = stats.filter(s => s.total);
  const avg = plannedDays.length ? Math.round(plannedDays.reduce((a, s) => a + s.pct, 0) / plannedDays.length) : 0;

  return `
  <section class="period-head">
    <button data-act="shift" data-n="-7" aria-label="Previous week">←</button>
    <h1>${prettyDate(ws, { day: 'numeric', month: 'short' })} – ${prettyDate(keys[6], { day: 'numeric', month: 'short', year: 'numeric' })}</h1>
    <button data-act="shift" data-n="7" aria-label="Next week">→</button>
    <button data-act="today">This week</button>
    <div class="chips">
      <span class="chip"><b>${avg}%</b> avg</span>
      <span class="chip"><b>${pts}</b> pts</span>
      <span class="chip"><b>${plannedDays.length}</b>/7 planned</span>
    </div>
  </section>

  <div class="week-grid">
    ${keys.map((k, i) => {
      const d = state.days[k], s = stats[i];
      return `
      <div class="wday ${k === todayKey() ? 'today' : ''}" role="button" tabindex="0" aria-label="Open ${prettyDate(k)}" data-act="openDay" data-k="${k}">
        <div class="wday-head"><span>${DAY_NAMES[dateOf(k).getDay()].slice(0, 3)} ${dateOf(k).getDate()}</span><span class="muted small">${s.total ? s.pct + '%' : ''}</span></div>
        <div class="bar"><span style="width:${s.pct}%"></span></div>
        <div class="small muted">${s.points} pts${(() => {
          const hb = (d?.plan?.blocks || []).filter(b => b.type === 'habit');
          return hb.length ? ` · 🔁 ${hb.filter(b => b.status === 'done').length}/${hb.length}` : '';
        })()}</div>
        <ul>${(d?.priorities || []).map(pr => `<li class="${priorityState(d, pr).done ? 'done' : ''}">${CATEGORIES[pr.category].icon} ${esc(pr.title)}</li>`).join('') || '<li class="muted">No priorities</li>'}</ul>
      </div>`;
    }).join('')}
  </div>

  <div class="two-col">
    ${goalsCard('W-' + ws, '🏁 Week goals')}
    <div class="card coach"><h2>Weekly review</h2>${msgList(periodInsights(keys, 'week'))}</div>
  </div>`;
}

/* ---------- month ---------- */

function viewMonth() {
  const d = dateOf(ui.date);
  const y = d.getFullYear(), m = d.getMonth();
  const first = new Date(y, m, 1), daysIn = new Date(y, m + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const keys = Array.from({ length: daysIn }, (_, i) => keyOf(new Date(y, m, i + 1)));
  const stats = keys.map(dayStats);
  const pts = stats.reduce((a, s) => a + s.points, 0);
  const planned = stats.filter(s => s.total);
  const avg = planned.length ? Math.round(planned.reduce((a, s) => a + s.pct, 0) / planned.length) : 0;

  return `
  <section class="period-head">
    <button data-act="shiftMonth" data-n="-1" aria-label="Previous month">←</button>
    <h1>${MONTH_NAMES[m]} ${y}</h1>
    <button data-act="shiftMonth" data-n="1" aria-label="Next month">→</button>
    <button data-act="today">This month</button>
    <div class="chips">
      <span class="chip"><b>${avg}%</b> avg</span>
      <span class="chip"><b>${pts}</b> pts</span>
      <span class="chip"><b>${planned.length}</b>/${daysIn} planned</span>
    </div>
  </section>

  <div class="two-col">
    <div class="card">
      <div class="month-grid">
        ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(x => `<div class="dow">${x}</div>`).join('')}
        ${'<div class="mcell blank"></div>'.repeat(offset)}
        ${keys.map((k, i) => `
          <div class="mcell ${k === todayKey() ? 'today' : ''}" role="button" tabindex="0" aria-label="${prettyDate(k)}, ${stats[i].total ? stats[i].pct + '% done' : 'not planned'}" data-act="openDay" data-k="${k}" style="background:${heat(stats[i].pct, stats[i].total)}" title="${stats[i].total ? stats[i].pct + '% done' : 'Not planned'}">
            <span class="num">${i + 1}</span>
            <span class="pts-m">${stats[i].total ? `${stats[i].pct}% · ${stats[i].points}p` : ''}</span>
          </div>`).join('')}
      </div>
      <div class="legend">Less <i style="background:${heat(0, 1)}"></i><i style="background:${heat(40, 1)}"></i><i style="background:${heat(70, 1)}"></i><i style="background:${heat(100, 1)}"></i> More done</div>
    </div>
    <div>
      ${goalsCard(`M-${y}-${pad(m + 1)}`, '🏆 Month goals')}
      <div class="card coach"><h2>Monthly review</h2>${msgList(periodInsights(keys, 'month'))}</div>
    </div>
  </div>`;
}

/* ---------- year ---------- */

function viewYear() {
  const y = dateOf(ui.date).getFullYear();
  const allKeys = [];
  const months = MONTH_NAMES.map((name, m) => {
    const daysIn = new Date(y, m + 1, 0).getDate();
    const keys = Array.from({ length: daysIn }, (_, i) => keyOf(new Date(y, m, i + 1)));
    allKeys.push(...keys);
    const stats = keys.map(dayStats);
    const planned = stats.filter(s => s.total);
    return {
      m, name, keys, stats,
      pts: stats.reduce((a, s) => a + s.points, 0),
      planned: planned.length,
      avg: planned.length ? Math.round(planned.reduce((a, s) => a + s.pct, 0) / planned.length) : 0,
      goals: state.goals[`M-${y}-${pad(m + 1)}`] || [],
    };
  });
  const totalPts = months.reduce((a, x) => a + x.pts, 0);
  const now = new Date();

  return `
  <section class="period-head">
    <button data-act="shiftYear" data-n="-1" aria-label="Previous year">←</button>
    <h1>${y}</h1>
    <button data-act="shiftYear" data-n="1" aria-label="Next year">→</button>
    <button data-act="today">This year</button>
    <div class="chips">
      <span class="chip"><b>${totalPts}</b> pts</span>
      <span class="chip"><b>${months.reduce((a, x) => a + x.planned, 0)}</b> days planned</span>
    </div>
  </section>

  <div class="year-grid">
    ${months.map(x => `
      <div class="card ymonth ${y === now.getFullYear() && x.m === now.getMonth() ? 'current' : ''}" role="button" tabindex="0" aria-label="Open ${x.name} ${y}" data-act="openMonth" data-m="${x.m}">
        <h3>${x.name}</h3>
        <div class="bar"><span style="width:${x.avg}%"></span></div>
        <div class="small muted" style="margin-top:6px">${x.planned ? `${x.avg}% avg · ${x.pts} pts · ${x.planned} days` : 'Nothing planned'}</div>
        ${x.goals.length ? `<div class="small" style="margin-top:4px">🏆 ${x.goals.filter(g => g.done).length}/${x.goals.length} goals</div>` : ''}
        <div class="mini-days">${x.stats.map(s => `<i style="background:${s.total ? heat(s.pct, 1) : ''}"></i>`).join('')}</div>
      </div>`).join('')}
  </div>

  <div class="two-col">
    ${goalsCard('Y-' + y, '🌟 Year goals')}
    <div class="card coach"><h2>Year in review</h2>${msgList(periodInsights(allKeys, 'year'))}</div>
  </div>`;
}
