'use strict';

/* Planner X — Rendering: draws the current page, keeps drafts and scroll positions. */

/* ---------------- rendering ---------------- */

function render() {
  hideTip();
  applyTheme();
  $$('#tabs > button').forEach(b => {
    b.classList.toggle('active', b.dataset.view === ui.view);
    if (b.dataset.view === ui.view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  renderLevel();
  renderDayNav();
  const v = $('#view');
  if (!state.profile) { v.innerHTML = ''; showOnboarding(); return; }
  if (state.focus && state.focus.k !== todayKey()) state.focus = null; // yesterday's timer
  checkAchievements();
  // keep the plan's scroll position when re-rendering the same day (e.g. after ticking a block)
  const keepScroll = ui.planScrollFor === ui.date ? $('#planScroll')?.scrollTop : null;
  const listScroll = saveListScroll();
  const drafts = saveDrafts();
  v.innerHTML = ({ day: viewDay, week: viewWeek, month: viewMonth, year: viewYear, stats: viewStats, settings: viewSettings })[ui.view]();
  restoreDrafts(drafts);
  restoreListScroll(listScroll);
  if (ui.view !== 'day') { ui.planScrollFor = null; return; }
  tickNow();
  const box = $('#planScroll');
  if (!box) return;
  if (keepScroll != null) box.scrollTop = keepScroll;
  else scrollPlanToNow(box);
  ui.planScrollFor = ui.date;
}

// Half-typed forms survive re-renders (e.g. ticking a block while writing a priority).
// A form that was just submitted is listed in ui.resetForms and starts empty instead.
const formKey = f => f ? (f.id || (f.dataset.goal ? 'goal-' + f.dataset.goal : '')) : '';
const fieldKey = el => `${formKey(el.form)}|${el.id || el.name}|${el.type === 'checkbox' ? el.value : ''}`;

function saveDrafts() {
  const out = { sig: ui.view + '|' + ui.date, fields: {} };
  for (const el of $$('#view form input, #view form select, #view form textarea')) {
    if (!formKey(el.form) || !(el.id || el.name)) continue;
    out.fields[fieldKey(el)] = el.type === 'checkbox' ? el.checked : el.value;
  }
  return out;
}
function restoreDrafts(saved) {
  const reset = new Set(ui.resetForms || []);
  ui.resetForms = [];
  if (saved.sig !== ui.view + '|' + ui.date) return;
  for (const el of $$('#view form input, #view form select, #view form textarea')) {
    const key = fieldKey(el);
    if (!(key in saved.fields) || reset.has(formKey(el.form))) continue;
    if (el.type === 'checkbox') el.checked = saved.fields[key];
    else if (el.type !== 'time' || saved.fields[key]) el.value = saved.fields[key];
  }
}

// Scrollable lists keep their position when the page re-renders on the same view and day.
// After adding an item, set ui.scrollToEnd = '<data-scroll name>' to reveal the new entry.
function saveListScroll() {
  const out = { sig: ui.listSig, pos: {} };
  for (const el of $$('[data-scroll]')) out.pos[el.dataset.scroll] = el.scrollTop;
  return out;
}
function restoreListScroll(saved) {
  const sig = ui.view + '|' + ui.date;
  for (const el of $$('[data-scroll]')) {
    const name = el.dataset.scroll;
    if (ui.scrollToEnd === name) el.scrollTop = el.scrollHeight;
    else if (ui.scrollToStart === name) el.scrollTop = 0;
    else if (saved.sig === sig && saved.pos[name] != null) el.scrollTop = saved.pos[name];
  }
  ui.scrollToEnd = ui.scrollToStart = null;
  ui.listSig = sig;
}

// on today, open the plan at the current block (a little of the previous one stays visible)
function scrollPlanToNow(box) {
  const target = box.querySelector('.block.now') || box.querySelector('.block.past-open') || null;
  if (ui.date !== todayKey() || !target) { box.scrollTop = 0; return; }
  box.scrollTop = Math.max(0, target.offsetTop - 70); // .plan-scroll is position:relative
}

// sidebar collapsed to icons only (wide screens); the choice is kept in this browser
function applySide() {
  let mini = false;
  try { mini = localStorage.getItem('plannerx-side') === 'mini'; } catch {}
  document.documentElement.classList.toggle('side-mini', mini);
  const btn = $('#sideToggle');
  if (btn) {
    const label = mini ? 'Expand sidebar' : 'Collapse sidebar';
    btn.textContent = mini ? '»' : '«';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-expanded', String(!mini));
    btn.dataset.tip = label;
  }
  // with only icons showing, hovering a page button shows its name
  for (const b of $$('#tabs > button')) b.dataset.tip = mini ? b.querySelector('.tab-tx')?.textContent || '' : '';
}

function renderLevel() {
  const total = totalPoints();
  const cur = levelInfo(state.level), next = levelInfo(state.level + 1);
  const pct = Math.min(100, Math.round((total - cur.need) / (next.need - cur.need) * 100));
  const ready = total >= next.need;
  $('#levelBox').innerHTML = `
    <span class="level-chip">Lv ${state.level}</span>
    ${rankBadge(state.level)}
    <div class="level-bar" title="${Math.max(0, next.need - total)} more points to reach ${next.icon} ${esc(next.name)} (Level ${state.level + 1})">
      <div class="bar"><span style="width:${Math.max(0, pct)}%"></span></div>
      <div class="level-text">${total} / ${next.need} pts to Level ${state.level + 1}</div>
    </div>
    ${ready ? '<button class="btn-primary btn-small levelup-btn" data-act="levelup">Level up ↑</button>' : ''}`;
}

const tag = kind => `<span class="tag tag-${kind}">${{ do: 'DO', change: 'CHANGE', tip: 'TIP', win: 'WIN' }[kind]}</span>`;
const msgList = msgs => `<div class="msgs">${msgs.map(m => `<div class="msg">${tag(m.kind)}<div>${esc(m.text)}</div></div>`).join('')}</div>`;
