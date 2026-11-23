'use strict';

/* Planner X — Focus timer. */

/* ---------- focus timer ---------- */
// state.focus = { k, blockKey, title, total (ms), endsAt (epoch ms while running), left (ms while paused), finished }

const RING_C = 2 * Math.PI * 52; // circumference of the countdown ring

function mmss(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

const focusLeft = f => f.finished ? 0 : f.endsAt ? f.endsAt - Date.now() : f.left;
const focusBlock = f => getDay(f.k)?.plan?.blocks.find(b => b.key === f.blockKey);

function focusCard(day) {
  const f = state.focus;
  if (f) {
    const left = focusLeft(f);
    const b = focusBlock(f);
    const status = f.finished ? 'finished' : f.endsAt ? 'running' : 'paused';
    return `
    <div class="card c-focus focus-card ${status}">
      <div class="focus-live">
        <div class="focus-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <defs><linearGradient id="focusGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style="stop-color:var(--accent)"/><stop offset="1" style="stop-color:var(--accent-2)"/>
            </linearGradient></defs>
            <circle class="ring-bg" cx="60" cy="60" r="52"/>
            <circle class="ring-fg" id="focusRing" cx="60" cy="60" r="52"
              style="stroke-dasharray:${RING_C};stroke-dashoffset:${RING_C * (1 - left / f.total)}"/>
          </svg>
          <div class="focus-center">
            <div class="focus-time" id="focusTime">${f.finished ? '00:00' : mmss(left)}</div>
            <div class="focus-state">${f.finished ? "time's up" : status === 'paused' ? 'paused' : 'left'}</div>
          </div>
        </div>
        <div class="focus-info">
          <div class="muted small">⏱️ ${f.finished ? 'Time\'s up — did you finish?' : 'Focusing on'}</div>
          <div class="focus-title">${esc(f.title)}</div>
          ${b ? `<div class="muted small">${fmt(b.start)}–${fmt(b.end)} · +${b.points} pts</div>` : ''}
          <div class="focus-actions">
            ${f.finished
              ? '<button class="btn-small" data-act="focusMore">+5 min</button>'
              : f.endsAt
                ? '<button class="btn-small" data-act="focusPause">⏸ Pause</button>'
                : '<button class="btn-small" data-act="focusResume">▶ Resume</button>'}
            <button class="btn-primary btn-small" data-act="focusDone">✓ Done</button>
            <button class="btn-ghost btn-small" data-act="focusStop" title="Stop without marking anything">⏹ Stop</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  // not running: choose what to focus on
  const now = nowMinutes();
  const open = (day.plan?.blocks || []).filter(b => !['free', 'anytime'].includes(b.type) && b.status === 'todo' && b.end > now);
  const anytime = (day.plan?.blocks || []).filter(b => b.type === 'anytime' && b.status === 'todo');
  const choices = [...open, ...anytime];
  if (!choices.length) return '';
  const current = open.find(b => b.start <= now) || open[0] || anytime[0];
  return `
  <div class="card c-focus focus-card">
    <div class="card-head"><h2>⏱️ Focus timer</h2><span class="muted small">one thing at a time</span></div>
    <div class="focus-setup">
      <div>
        <label for="focusBlock">Work on</label>
        <select id="focusBlock">
          ${choices.map(b => `<option value="${esc(b.key)}" ${b === current ? 'selected' : ''}>${b.type === 'anytime' ? '📌' : fmt(b.start)} · ${esc(b.title)}${b.start <= now && b.type !== 'anytime' ? ' (now)' : ''}</option>`).join('')}
        </select>
      </div>
      <div>
        <label for="focusLen">For</label>
        <select id="focusLen">
          <option value="block">Until the block ends</option>
          <option value="15">15 min</option>
          <option value="25">25 min · Pomodoro</option>
          <option value="50">50 min · deep work</option>
        </select>
      </div>
      <button class="btn-primary" data-act="focusStart">▶ Start focus</button>
    </div>
  </div>`;
}

function startFocus(blockKey, len) {
  const b = getDay(todayKey())?.plan?.blocks.find(x => x.key === blockKey);
  if (!b) return;
  const now = nowMinutes();
  let minutes = +len;
  if (len === 'block') minutes = b.type === 'anytime' ? 25 : b.start <= now ? b.end - now : b.end - b.start;
  minutes = Math.max(5, minutes);
  state.focus = { k: todayKey(), blockKey, title: b.title, total: minutes * 60000, endsAt: Date.now() + minutes * 60000, left: null, finished: false };
  save();
  toast(`⏱️ Focus started — ${hours(minutes)}. You've got this!`);
}

function finishFocus() {
  const f = state.focus;
  f.finished = true; f.endsAt = null; f.left = 0;
  state.stats.focusSessions++;
  state.stats.focusMinutes += Math.round(f.total / 60000);
  f.counted = true;
  save();
  beep();
  notify('⏱️ Time\'s up!', `Did you finish “${f.title}”?`);
  render();
  ask({ icon: '⏱️', title: 'Time\'s up!', text: `Did you finish “${f.title}”?`, ok: 'Yes — mark it done ✓' }, focusDone);
}

function focusDone() {
  const f = state.focus;
  if (!f) return;
  const before = totalPoints();
  const b = focusBlock(f);
  if (b) b.status = 'done';
  // a session ended early still counts if you focused for at least 5 minutes
  if (!f.counted && f.total - focusLeft(f) >= 5 * 60000) {
    state.stats.focusSessions++;
    state.stats.focusMinutes += Math.round((f.total - focusLeft(f)) / 60000);
  }
  state.focus = null;
  save();
  afterPointsChange(before);
  render();
}

// runs every second: moves the ring, updates the tab title, ends the session on time
function focusTick() {
  const f = state.focus;
  const running = f && f.endsAt && !f.finished;
  document.title = running ? `⏱ ${mmss(f.endsAt - Date.now())} · Planner X` : 'Planner X';
  if (!running) return;
  const left = f.endsAt - Date.now();
  if (left <= 0) { finishFocus(); return; }
  const t = $('#focusTime'), ring = $('#focusRing');
  if (t) t.textContent = mmss(left);
  if (ring) ring.style.strokeDashoffset = RING_C * (1 - left / f.total);
}

// three soft beeps
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, .28, .56].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(.18, ctx.currentTime + t + .02);
      g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + t + .22);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + .25);
    });
  } catch { /* sound is optional */ }
}
