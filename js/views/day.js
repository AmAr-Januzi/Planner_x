'use strict';

/* Planner X — Day page and its cards. */

// The Day page shows one section at a time; the sidebar (or the chip row on phones) switches between them.
const DAY_SECTIONS = [
  { id: 'plan',   icon: '🗓️', label: 'My day' },
  { id: 'prios',  icon: '🎯', label: 'Priorities' },
  { id: 'habits', icon: '🔁', label: 'Daily goals' },
  { id: 'notes',  icon: '💭', label: 'Notes' },
  { id: 'log',    icon: '📝', label: 'Done log' },
  { id: 'coach',  icon: '💬', label: 'Coach' },
  { id: 'ach',    icon: '🏅', label: 'Achievements' },
];
const daySection = () => DAY_SECTIONS.some(s => s.id === ui.daySection) ? ui.daySection : 'plan';

// small count next to a section name, so you can see what's waiting without opening it
function daySectionBadge(id) {
  const day = getDay(ui.date);
  if (id === 'prios') return day ? day.priorities.filter(p => !p.carried && !priorityState(day, p).done && !priorityState(day, p).skipped).length : 0;
  if (id === 'notes') return state.notes.length;
  if (id === 'plan' && ui.date === todayKey()) return carryCandidates().length;
  return 0;
}

const PHONE = matchMedia('(max-width: 640px)');
PHONE.addEventListener?.('change', () => renderDayNav());

function renderDayNav() {
  const box = $('#dayNav');
  if (!box) return;
  // sidebar: the list sits right under the "Day" button; phones: it's a chip row in the top bar
  // (the page buttons are a bottom bar there, so it can't go inside them)
  const dayBtn = $('#tabs > [data-view="day"]'), bar = $('.topbar');
  if (PHONE.matches) { if (box.parentElement !== bar) bar.appendChild(box); }
  else if (dayBtn && dayBtn.nextElementSibling !== box) dayBtn.after(box);
  if (ui.view !== 'day' || !state.profile) { box.innerHTML = ''; box.hidden = true; return; }
  const cur = daySection();
  box.hidden = false;
  box.innerHTML = DAY_SECTIONS.map(s => {
    const n = daySectionBadge(s.id);
    return `<button data-act="daySec" data-sec="${s.id}" class="${s.id === cur ? 'active' : ''}" ${s.id === cur ? 'aria-current="true"' : ''} title="${s.label}">` +
      `<span class="sub-ic" aria-hidden="true">${s.icon}</span><span class="sub-tx">${s.label}</span>${n ? `<span class="sub-n">${n}</span>` : ''}</button>`;
  }).join('');
}

function viewDay() {
  const k = ui.date;
  const day = getDay(k) || { priorities: [], plan: null, log: [] };
  const st = dayStats(k);
  const isToday = k === todayKey(), isFuture = k > todayKey();
  const quote = pick(QUOTES, rng(k + 'quote'));
  const locked = !canEdit(k);
  const editing = ui.editing && !locked ? day.priorities.find(p => p.id === ui.editing) : null;
  const sec = daySection();

  const head = `
  <section class="period-head">
    <button data-act="shift" data-n="-1" aria-label="Previous day">←</button>
    <h1>${prettyDate(k)}</h1>
    <button data-act="shift" data-n="1" aria-label="Next day">→</button>
    ${!isToday ? '<button data-act="today">Today</button>' : ''}
    <div class="chips">
      <span class="chip" title="Finish 80% for +20 bonus points, 100% for +50"><b>${st.pct}%</b> done</span>
      <span class="chip" title="${st.done} done · ${st.skipped} skipped · ${st.total - st.done - st.skipped} still open"><b>${st.done}</b>/${st.total} blocks</span>
      <span class="chip" title="${st.possible - (st.points - st.bonus)} points still to earn on this day"><b>${st.points}</b> pts${st.bonus ? ` (incl. +${st.bonus} bonus)` : ''}</span>
    </div>
  </section>`;

  const coach = () => `
      <div class="card coach c-coach">
        <div class="coach-greet">${greeting(k)}</div>
        <div class="muted small">Your coach for ${isToday ? 'today' : 'this day'} — based on your priorities and history.</div>
        ${msgList(coachMessages(k))}
        <div class="quote">“${esc(quote)}”</div>
      </div>`;

  const prios = () => `
      <div class="card c-prios">
        <h2>🎯 Priorities ${locked ? '<span class="muted small">🔒 locked</span>' : ''} ${day.priorities.length ? `<span class="chip style-chip">${day.priorities.length}</span>` : ''}</h2>
        <div class="card-scroll scroll-list" data-scroll="prios">
        ${locked ? (isToday ? `
        <div class="lock-note">
          <b>Today's plan is locked.</b> You planned it — now follow it. You can still mark every block done or skipped,
          and send unfinished priorities to tomorrow. If something really changed, you can replan the rest of today.
          <div class="form-actions" style="justify-content:flex-start;flex-wrap:wrap">
            <button class="btn-primary btn-small" data-act="shift" data-n="1">Plan tomorrow →</button>
            <button class="btn-small" data-act="replan">✎ Replan today</button>
          </div>
        </div>` : `
        <div class="lock-note">
          <b>This day is over.</b> Its plan stays as a record. You can still mark what you did, log anything you forgot,
          and send unfinished priorities forward.
        </div>`) : `
        <form id="prioForm">
          <div class="form-grid">
            <div class="full">
              <label for="pTitle">What do you need to do?</label>
              <input id="pTitle" name="title" required maxlength="80" placeholder="e.g. Finish the project report" value="${esc(editing?.title)}">
            </div>
            <div>
              <label for="pCat">Category</label>
              <select id="pCat" name="category">
                ${Object.entries(CATEGORIES).map(([v, c]) => `<option value="${v}" ${editing?.category === v ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label for="pDur">Duration</label>
              <select id="pDur" name="duration">
                ${[15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 420, 480].map(m => `<option value="${m}" ${(editing ? editing.duration === m : m === 60) ? 'selected' : ''}>${hours(m)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label for="pImp">Importance</label>
              <select id="pImp" name="importance">
                ${['high', 'medium', 'low'].map(v => `<option value="${v}" ${(editing ? editing.importance === v : v === 'medium') ? 'selected' : ''}>${v[0].toUpperCase() + v.slice(1)} (+${IMPORTANCE_PTS[v]}/h)</option>`).join('')}
              </select>
            </div>
            <div>
              <label for="pTime">Fixed time (optional)</label>
              <input id="pTime" name="time" type="time" value="${esc(editing?.time)}">
            </div>
            ${goalField(k, editing?.goal)}
            <div class="full">
              <label style="display:flex;gap:8px;align-items:center;color:var(--text);margin:0">
                <input type="checkbox" name="anytime" style="width:auto" ${editing?.anytime ? 'checked' : ''}>
                📌 No set time — just add it to the list under the plan
              </label>
            </div>
          </div>
          <div class="form-actions">
            ${editing ? '<button type="button" data-act="cancelEdit">Cancel</button>' : ''}
            <button class="btn-primary" type="submit">${editing ? 'Save changes' : '+ Add priority'}</button>
          </div>
        </form>`}
        ${day.priorities.length ? `<ul class="prio-list">${day.priorities.map(pr => prioRow(k, day, pr)).join('')}</ul>` : ''}
        </div>
      </div>`;

  const plan = () => `
    ${isToday ? carryCard() : ''}
    ${isToday ? '<div class="now-card now-strip" id="nowCard"></div>' : ''}
    ${isToday ? focusCard(day) : ''}
    <div class="card c-plan">
      <div class="card-head">
        <h2>🗓️ Your plan ${day.plan ? `<span class="chip style-chip" title="${esc(PLAN_STYLES[day.plan.style ?? 0].desc)}">${PLAN_STYLES[day.plan.style ?? 0].icon} ${PLAN_STYLES[day.plan.style ?? 0].name}</span>` : ''}</h2>
        <div class="form-actions" style="margin:0;align-items:center">
          ${st.done + st.skipped ? `<button class="btn-small" data-act="clearMarks" title="Unmark every ✓ and ✕ on this day">⟲ Clear all marks</button>` : ''}
          ${day.plan?.blocks.some(b => b.manual) && !locked ? '<button class="btn-small" data-act="resetMoves" title="Let the planner place the blocks you moved by hand again">↺ Reset moves</button>' : ''}
          ${locked ? `<span class="muted small">🔒 ${isToday ? 'locked for today' : 'past day'}</span>` : `<button class="btn-small" data-act="rebuild" title="Rearrange the day in a different style — your marks and moved blocks stay">${day.plan ? '↻ Rebuild plan' : 'Build my day'}</button>`}
        </div>
      </div>
      ${day.plan?.clashes?.length ? `<div class="clash-note" role="alert">${day.plan.clashes.map(c => `<div>⚠ ${esc(clashText(c))}</div>`).join('')}</div>` : ''}
      ${day.plan ? timeline(k, day, isFuture) : `<div class="empty">${locked ? 'Nothing was planned on this day.' : `No plan for this day yet.<br><br><button class="${day.priorities.length ? 'btn-primary' : ''}" data-act="rebuild">Build my day</button>`}${!locked && !day.priorities.length ? `<br><br><button class="btn-primary" data-act="daySec" data-sec="prios">🎯 Add your priorities first</button>` : ''}</div>`}
    </div>`;

  const body = {
    plan,
    prios: () => prios() + topCard(k),
    habits: () => habitsCard(k, day, isFuture),
    notes: () => notesCard(k),
    log: () => logCard(day, isToday),
    coach,
    ach: achCard,
  }[sec]();

  return `${head}
  <div class="day-section" data-sec="${sec}">
    ${body}
  </div>`;
}

/* ---------- what I actually did ---------- */

function logCard(day, isToday) {
  return `
  <div class="card c-log">
    <h2>📝 What I actually did</h2>
    <p class="muted small" style="margin-top:-6px">Log anything you did that wasn't in the plan. Your coach uses it to understand your day.</p>
    <form id="logForm" class="log-form">
      <input type="time" name="time" value="${isToday ? fmt(nowMinutes()) : ''}" required aria-label="Time">
      <input name="text" required maxlength="120" placeholder="e.g. Helped a friend move, 2 hours" aria-label="What you did">
      <button type="submit">Add</button>
    </form>
    ${day.log.length ? `<ul class="log-list scroll-list" data-scroll="log">${[...day.log].sort((a, b) => a.time.localeCompare(b.time)).map(l => `
      <li><span class="time">${esc(l.time)}</span><span>${esc(l.text)}</span><button class="btn-ghost btn-small" data-act="delLog" data-id="${l.id}" aria-label="Delete">✕</button></li>`).join('')}</ul>` : ''}
  </div>`;
}

/* ---------- top priorities reminder ---------- */

const IMP_ORDER = { high: 0, medium: 1, low: 2 };

// short status for a priority: when it happens, or that it's late / done
function prioWhen(k, pr, ps) {
  if (ps.done) return { cls: 'done', text: '✓ done' };
  if (ps.skipped) return { cls: 'late', text: '✕ not done' };
  if (pr.anytime && !pr.time) return { cls: '', text: '📌 anytime' };
  const open = ps.blocks.filter(b => b.status !== 'done');
  if (!open.length) return { cls: 'late', text: 'not scheduled' };
  const b = open[0];
  if (k !== todayKey()) return { cls: '', text: `at ${fmt(b.start)}` };
  const now = nowMinutes();
  if (b.start <= now && now < b.end) return { cls: 'now', text: '● now' };
  if (b.end <= now) return { cls: 'late', text: b.status === 'skipped' ? 'skipped' : 'overdue' };
  const left = b.start - now;
  return { cls: left <= 60 ? 'soon' : '', text: left <= 60 ? `in ${hours(left)}` : `at ${fmt(b.start)}` };
}

function topCard(k) {
  const day = getDay(k) || { priorities: [], plan: null };
  const isFuture = k > todayKey();
  const firstStart = ps => Math.min(...ps.blocks.map(b => b.start), 9999);
  const items = day.priorities
    .filter(pr => !pr.carried && !pr.hiddenTop)
    .map(pr => ({ pr, ps: priorityState(day, pr) }))
    .sort((a, b) => (a.ps.done || a.ps.skipped) - (b.ps.done || b.ps.skipped) || IMP_ORDER[a.pr.importance] - IMP_ORDER[b.pr.importance] || firstStart(a.ps) - firstStart(b.ps))
    .slice(0, 5);

  // high-importance work still waiting in the next 7 days
  const coming = [];
  for (let i = 1; i <= 7 && coming.length < 4; i++) {
    const dk = addDays(k < todayKey() ? todayKey() : k, i), d = state.days[dk];
    for (const pr of d?.priorities || []) {
      if (pr.importance === 'high' && !priorityState(d, pr).done && coming.length < 4) coming.push({ dk, pr });
    }
  }
  if (!items.length && !coming.length) return '';

  const left = items.filter(x => !x.ps.done && !x.ps.skipped).length;
  const doneCount = items.length - left; // done or skipped
  return `
  <div class="card top-card c-top">
    <div class="card-head">
      <h2>⭐ Top priorities ${items.length ? `<span class="chip style-chip">${left ? `${left} left` : 'all done 🎉'}</span>` : ''}</h2>
      ${doneCount ? `<button class="btn-small" data-act="clearTopDone" title="Remove done and not-done tasks from this list — points are kept">🧹 Clear finished</button>` : ''}
    </div>
    ${items.length ? `<ul class="top-list scroll-list" data-scroll="top">${items.map(({ pr, ps }, i) => {
      const w = prioWhen(k, pr, ps);
      return `
      <li class="${ps.done ? 'done' : ''} ${ps.skipped ? 'skipped' : ''}">
        <span class="top-rank imp-bg-${pr.importance}">${i + 1}</span>
        <div class="top-main">
          <div class="top-title">${esc(pr.title)}</div>
          <div class="top-meta">${CATEGORIES[pr.category].icon} ${CATEGORIES[pr.category].label} · ${hours(pr.duration)} · ${pr.importance}</div>
        </div>
        <span class="top-when ${w.cls}">${w.text}</span>
        <button class="check" data-act="donePrio" data-id="${pr.id}" ${isFuture || !ps.blocks.length ? 'disabled' : ''} title="${isFuture ? 'You can finish it on the day' : 'Mark the whole task done'}" aria-label="Mark done">✓</button>
        <button class="skipb" data-act="skipPrio" data-id="${pr.id}" ${isFuture || !ps.blocks.length ? 'disabled' : ''} title="${isFuture ? 'You can mark it on the day' : 'I didn\'t do it'}" aria-label="Mark not done">✕</button>
        ${ps.done || ps.skipped ? `<button class="btn-ghost btn-small top-del" data-act="hideTop" data-id="${pr.id}" title="Remove from this list — points are kept" aria-label="Remove from list">🗑</button>` : ''}
      </li>`;
    }).join('')}</ul>` : `<p class="muted small" style="margin:0">${day.priorities.some(p => p.hiddenTop) ? 'All done and cleared 🎉 Nice work.' : 'No priorities on this day yet.'}</p>`}
    ${coming.length ? `
      <div class="top-coming">
        <div class="top-coming-head">Coming up</div>
        ${coming.map(({ dk, pr }) => `
          <button class="top-coming-item" data-act="openDay" data-k="${dk}">
            <span class="imp imp-high"></span>
            <span class="tc-day">${prettyDate(dk, { weekday: 'short', day: 'numeric' })}</span>
            <span class="tc-title">${esc(pr.title)}</span>
          </button>`).join('')}
      </div>` : ''}
  </div>`;
}

/* ---------- quick notes ---------- */

// day a note becomes a priority on: the viewed day if it can still be planned, otherwise the next one
const noteTarget = k => canEdit(k) && k >= todayKey() ? k : planTarget();

const NOTE_CATEGORIES = [
  ['health',  /\b(gym|run|walk|workout|yoga|doctor|dentist|swim|stretch|meditat)/i],
  ['study',   /\b(study|learn|read|course|homework|exam|lesson|practice)/i],
  ['social',  /\b(call|meet|friend|mom|dad|family|party|birthday|visit)/i],
  ['finance', /\b(pay|bank|bill|tax|budget|invoice|money|rent)/i],
  ['home',    /\b(clean|cook|laundry|shop|buy|groceries|fix|wash|tidy)/i],
  ['work',    /\b(work|email|report|meeting|client|project|deadline|present)/i],
];

// "Gym 1h" → health, 60 min; "pay bills" → finance, 30 min
function noteToPriority(text) {
  const category = NOTE_CATEGORIES.find(([, re]) => re.test(text))?.[0] || 'personal';
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?)\b/i);
  let duration = 30;
  if (m) {
    const n = parseFloat(m[1].replace(',', '.'));
    duration = /^h/i.test(m[2]) ? n * 60 : n;
    duration = Math.min(480, Math.max(15, Math.round(duration / 15) * 15));
  }
  return { id: uid(), title: text.slice(0, 80), category, duration, importance: 'medium', time: '', anytime: true, moved: 0 };
}

function noteWhen(at) {
  const d = new Date(at), k = keyOf(d), time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const calendarToday = keyOf(new Date());
  if (k === calendarToday) return `Today ${time}`;
  if (k === addDays(calendarToday, -1)) return `Yesterday ${time}`;
  return prettyDate(k, { day: 'numeric', month: 'short' });
}

function notesCard(k) {
  const notes = [...state.notes].sort((a, b) => b.at - a.at);
  const target = noteTarget(k);
  const label = dayWord(target)[0].toUpperCase() + dayWord(target).slice(1);
  return `
  <div class="card notes-card c-notes">
    <h2>💭 Quick notes ${notes.length ? `<span class="chip style-chip">${notes.length}</span>` : ''}</h2>
    <form id="noteForm" class="note-form">
      <input name="text" required maxlength="200" autocomplete="off" placeholder="Write down an idea or a task…  e.g. Call the dentist 15m" aria-label="New note">
      <button class="btn-primary" type="submit">Add</button>
    </form>
    ${notes.length ? `<ul class="note-list scroll-list" data-scroll="notes">${notes.map(n => {
      const c = CATEGORIES[noteToPriority(n.text).category];
      return `
      <li>
        <span class="note-cat" title="${c.label}">${c.icon}</span>
        <div class="note-main">
          <div class="note-text">${esc(n.text)}</div>
          <div class="note-meta">${noteWhen(n.at)}</div>
        </div>
        <button class="btn-small" data-act="noteToPrio" data-id="${n.id}" title="Add as a priority for ${dayWord(target)}">→ ${label}</button>
        <button class="btn-ghost btn-small" data-act="delNote" data-id="${n.id}" aria-label="Delete note">✕</button>
      </li>`;
    }).join('')}</ul>` : '<p class="muted small note-empty">Nothing here yet. Write thoughts down so they stop distracting you — turn them into priorities later.</p>'}
  </div>`;
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const daysLabel = days => !days || days.length === 7 ? 'every day'
  : days.length === 5 && !days.includes(0) && !days.includes(6) ? 'weekdays'
  : days.length === 2 && days.includes(0) && days.includes(6) ? 'weekends'
  : WEEK_ORDER.filter(d => days.includes(d)).map(d => DAY_NAMES[d].slice(0, 3)).join(', ');

function carryCard() {
  const list = carryCandidates();
  if (!list.length) return '';
  const when = k => k === addDays(todayKey(), -1) ? 'yesterday' : DAY_NAMES[dateOf(k).getDay()];
  return `
  <div class="card carry">
    <h2>↩ ${list.length} unfinished ${list.length > 1 ? 'priorities' : 'priority'} from the last days</h2>
    <p class="muted small" style="margin-top:-6px">Bring them into ${dayWord(planTarget())}'s plan? Untick anything you've decided to drop.</p>
    <form id="carryForm">
      <ul class="carry-list scroll-list" data-scroll="carry">
        ${list.map(({ k, pr }) => `
          <li><label>
            <input type="checkbox" name="c" value="${k}|${pr.id}" checked>
            <span class="imp imp-${pr.importance}"></span>
            <b>${esc(pr.title)}</b>
            <span class="muted small">· ${when(k)} · ${hours(pr.duration)} · ${pr.importance}${pr.moved ? ` · moved ${pr.moved}×` : ''}</span>
          </label></li>`).join('')}
      </ul>
      <div class="form-actions">
        <button type="button" data-act="carryDrop">Drop all</button>
        <button class="btn-primary" type="submit">Bring to ${dayWord(planTarget())}</button>
      </div>
    </form>
  </div>`;
}

function habitsCard(k, day, isFuture) {
  const editing = state.habits.find(h => h.id === ui.editingHabit);
  const rows = state.habits.map(h => {
    const c = CATEGORIES[h.category];
    const b = day.plan?.blocks.find(x => x.type === 'habit' && x.tag === h.id);
    const sk = habitStreak(h, k);
    const status = h.since > k ? 'added later' : !habitOn(h, k) ? 'day off' : 'not in this plan';
    return `
    <li class="prio habit-row ${b?.status === 'done' ? 'done' : ''} ${b?.status === 'skipped' ? 'skipped' : ''}">
      ${b && !isFuture ? `<button class="check" data-act="mark" data-id="${b.id}" data-s="done" aria-label="Mark done">✓</button>` : '<span class="check placeholder">·</span>'}
      <div class="prio-main">
        <div class="prio-title">${esc(h.title)}</div>
        <div class="prio-meta">${c.icon} ${c.label} · ${hours(h.duration)} · ${daysLabel(h.days)} · ${b ? `at ${fmt(b.start)}` : esc(status)}${sk ? ` · 🔥 ${sk} day${sk > 1 ? 's' : ''}` : ''}</div>
      </div>
      <div class="prio-actions">
        <button class="btn-ghost btn-small" data-act="editHabit" data-id="${h.id}" aria-label="Edit daily goal" title="Edit — your streak is kept">✎</button>
        <button class="btn-ghost btn-small" data-act="delHabit" data-id="${h.id}" aria-label="Delete daily goal">✕</button>
      </div>
    </li>`;
  }).join('');

  return `
  <div class="card c-habits">
    <h2>🔁 Daily goals <span class="muted small">+${POINTS.habit} pts each</span></h2>
    <p class="muted small" style="margin-top:-6px">Write once what you want to do every day (or on chosen days). It's added to those plans automatically.</p>
    <form id="habitForm">
      <div class="form-grid">
        <div class="full">
          <label for="hTitle">Every day I want to…</label>
          <input id="hTitle" name="title" required maxlength="60" placeholder="e.g. Read 20 pages, Drink 2L of water, Study English" value="${esc(editing?.title)}">
        </div>
        <div>
          <label for="hCat">Category</label>
          <select id="hCat" name="category">
            ${Object.entries(CATEGORIES).map(([v, c]) => `<option value="${v}" ${v === (editing?.category || 'personal') ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label for="hDur">Duration</label>
          <select id="hDur" name="duration">
            ${[5, 10, 15, 20, 30, 45, 60].map(m => `<option value="${m}" ${m === (editing?.duration || 20) ? 'selected' : ''}>${hours(m)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label for="hTime">Fixed time (optional)</label>
          <input id="hTime" name="time" type="time" value="${esc(editing?.time)}">
        </div>
        <div style="display:flex;align-items:flex-end;gap:6px">
          ${editing ? '<button type="button" data-act="cancelEditHabit">Cancel</button>' : ''}
          <button class="btn-primary" type="submit" style="width:100%">${editing ? 'Save' : '+ Add'}</button>
        </div>
        <div class="full days-pick">
          ${WEEK_ORDER.map(d => `<label><input type="checkbox" name="hDays" value="${d}" ${!editing || !editing.days || editing.days.includes(d) ? 'checked' : ''}>${DAY_NAMES[d].slice(0, 3)}</label>`).join('')}
        </div>
      </div>
    </form>
    ${rows ? `<ul class="prio-list scroll-list" data-scroll="habits">${rows}</ul>` : ''}
  </div>`;
}

function prioRow(k, day, pr) {
  const ps = priorityState(day, pr);
  const c = CATEGORIES[pr.category];
  const isPast = k < todayKey();
  const when = pr.anytime && !pr.time ? 'anytime' : ps.blocks.length ? 'at ' + ps.blocks.map(b => fmt(b.start)).join(', ') : 'at —';
  return `
  <li class="prio ${ps.done ? 'done' : ''}">
    <span class="imp imp-${pr.importance}" title="${pr.importance} importance"></span>
    <div class="prio-main">
      <div class="prio-title">${esc(pr.title)}</div>
      <div class="prio-meta">${c.icon} ${c.label} · ${hours(pr.duration)} · ${when} · +${prioPoints(pr)} pts${pr.moved ? ` · moved ${pr.moved}×` : ''}</div>
      ${findGoal(pr.goal) ? `<div class="prio-meta">🏁 ${esc(findGoal(pr.goal).text)}</div>` : ''}
      ${ps.overflow && !isPast ? `<div class="overflow-note">⚠ ${hours(ps.overflow.minutes)} didn't fit in your day</div>` : ''}
      ${pr.carried && pr.carried !== 'dropped' ? `<div class="prio-meta">↩ carried over to ${prettyDate(pr.carried, { weekday: 'long', day: 'numeric', month: 'short' })}</div>` : ''}
      ${pr.carried === 'dropped' ? '<div class="prio-meta">✕ dropped</div>' : ''}
    </div>
    <div class="prio-actions">
      ${!ps.done && !pr.carried ? `<button class="btn-small" data-act="movePrio" data-id="${pr.id}">→ ${dayWord(moveTarget(k))[0].toUpperCase() + dayWord(moveTarget(k)).slice(1)}</button>` : ''}
      ${canEdit(k) ? `
      <button class="btn-ghost btn-small" data-act="editPrio" data-id="${pr.id}" aria-label="Edit">✎</button>
      <button class="btn-ghost btn-small" data-act="delPrio" data-id="${pr.id}" aria-label="Delete">✕</button>` : ''}
    </div>
  </li>`;
}

function timeline(k, day, isFuture) {
  const { S } = dayBounds(k);
  const row = b => {
    const pr = b.pid ? day.priorities.find(p => p.id === b.pid) : null;
    const anytime = b.type === 'anytime';
    const sub = pr ? `${CATEGORIES[pr.category].icon} ${CATEGORIES[pr.category].label} · ${pr.importance}` : TYPE_LABEL[b.type];
    const actions = b.type === 'free' ? '' : `
      ${!anytime && canMoveBlock(k, day, b) ? `<button class="drag-handle" data-drag="${b.id}" title="Drag to a free slot or another block to move it" aria-label="Move ${esc(b.title)} — use the up and down arrow keys">⠿</button>` : ''}
      <span class="pts" title="${b.points} points when you finish this">+${b.points}</span>
      <button class="check" data-act="mark" data-id="${b.id}" data-s="done" ${isFuture ? 'disabled title="You can mark it on the day"' : 'title="Done"'} aria-label="Mark done">✓</button>
      <button class="skipb" data-act="mark" data-id="${b.id}" data-s="skipped" ${isFuture ? 'disabled' : 'title="Didn\'t do it"'} aria-label="Mark skipped">✕</button>`;
    return `
    <div class="block t-${b.type} ${b.type === 'free' ? 'free' : ''} ${b.status === 'done' ? 'done' : ''} ${b.status === 'skipped' ? 'skipped' : ''} ${b.clash ? 'clash' : ''}" data-id="${b.id}" ${anytime ? '' : `data-start="${b.start}" data-end="${b.end}"`} data-status="${b.status}">
      <div class="time">${anytime ? '📌 Anytime' : `${fmt(b.start)}–${fmt(b.end)}`}</div>
      <div><div class="b-title">${esc(b.title)}</div><div class="b-sub">${esc(sub)}${anytime && pr ? ` · ~${hours(pr.duration)}` : anytime ? '' : ` · ${hours(b.end - b.start)}`}</div></div>
      <div class="b-actions">${actions}</div>
    </div>`;
  };
  const timed = day.plan.blocks.filter(b => b.type !== 'anytime');
  const anytime = day.plan.blocks.filter(b => b.type === 'anytime');
  return `
  <div class="plan-scroll" id="planScroll">
    <div class="timeline">${timed.map(row).join('')}</div>
    <div class="sleep-line">🌙 Lights out at ${fmt(S)} — sleep well</div>
    ${anytime.length ? `
    <div class="anytime-head">📌 Anytime <span class="muted small">— no set time, do them whenever you can</span></div>
    <div class="timeline">${anytime.map(row).join('')}</div>` : ''}
  </div>`;
}

// Highlights the current block and fills the "right now" card without re-rendering the page.
function tickNow() {
  if (ui.view !== 'day' || ui.date !== todayKey()) return;
  const now = nowMinutes();
  let current = null, next = null;
  const day = getDay(ui.date);
  for (const el of $$('.block')) {
    const s = +el.dataset.start, e = +el.dataset.end;
    const isNow = s <= now && now < e;
    el.classList.toggle('now', isNow);
    el.classList.toggle('past-open', e <= now && el.dataset.status === 'todo');
  }
  for (const b of day?.plan?.blocks || []) {
    if (b.start <= now && now < b.end) current = b;
    if (!next && b.start > now && b.type !== 'free' && b.type !== 'anytime') next = b;
  }
  const card = $('#nowCard');
  if (!card) return;
  if (!day?.plan) { card.innerHTML = 'Build your plan to see what to do right now.'; return; }
  const { W, S } = dayBounds(ui.date);
  if (now < W) card.innerHTML = `😴 Your day starts at <b>${fmt(W)}</b>. Rest up.`;
  else if (now >= S) card.innerHTML = '🌙 It\'s past bedtime. Go to sleep — tomorrow\'s plan is waiting.';
  else card.innerHTML = `<b>Right now:</b> ${current ? `${esc(current.title)} <span class="muted">(until ${fmt(current.end)})</span>` : 'nothing planned'}
    ${next ? `<br><b>Next:</b> ${esc(next.title)} <span class="muted">at ${fmt(next.start)}</span>` : ''}`;
}
