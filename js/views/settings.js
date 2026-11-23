'use strict';

/* Planner X — Settings page. */

/* ---------- settings ---------- */

function profileFields(p) {
  const c = p?.commit || { enabled: true, label: 'Work', start: '09:00', hours: 8, days: [1, 2, 3, 4, 5] };
  const workH = workMinutes(c) / 60;
  const we = p?.weekend || { enabled: false, wake: '09:00', sleep: '00:00' };
  return `
  <div class="row"><label for="sName">Your name</label><input id="sName" name="name" required maxlength="30" value="${esc(p?.name)}"></div>
  <div class="row2">
    <div><label for="sWake">I wake up at</label><input id="sWake" type="time" name="wake" required value="${esc(p?.wake || '07:00')}"></div>
    <div><label for="sSleep">I go to sleep at</label><input id="sSleep" type="time" name="sleep" required value="${esc(p?.sleep || '23:00')}"></div>
  </div>
  <div class="row">
    <label style="display:flex;gap:8px;align-items:center;color:var(--text)"><input type="checkbox" name="wEnabled" style="width:auto" ${we.enabled ? 'checked' : ''}> Different times on weekends (Sat & Sun)</label>
  </div>
  <div class="row2">
    <div><label for="wWake">Weekend wake up</label><input id="wWake" type="time" name="wWake" value="${esc(we.wake)}"></div>
    <div><label for="wSleep">Weekend sleep</label><input id="wSleep" type="time" name="wSleep" value="${esc(we.sleep)}"></div>
  </div>
  <div class="row">
    <label style="display:flex;gap:8px;align-items:center;color:var(--text)"><input type="checkbox" name="cEnabled" style="width:auto" ${c.enabled ? 'checked' : ''}> I have fixed work / school hours</label>
  </div>
  <div class="row2">
    <div><label for="cLabel">Name</label><input id="cLabel" name="cLabel" maxlength="30" value="${esc(c.label)}"></div>
    <div class="row2" style="margin:0">
      <div><label for="cStart">Starts at</label><input id="cStart" type="time" name="cStart" value="${esc(c.start)}"></div>
      <div><label for="cHours">Hours of work</label>
        <select id="cHours" name="cHours">
          ${[2, 3, 4, 5, 6, 7, 7.5, 8, 9, 10, 11, 12].map(h => `<option value="${h}" ${h === workH ? 'selected' : ''}>${hours(h * 60)}</option>`).join('')}
        </select>
      </div>
    </div>
  </div>
  <p class="muted small" style="margin-top:-4px">Lunch doesn't count as work — if it falls inside work time, your workday ends later.</p>
  <div class="row days-pick">
    ${[1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" name="cDays" value="${d}" ${c.days.includes(d) ? 'checked' : ''}>${DAY_NAMES[d].slice(0, 3)}</label>`).join('')}
  </div>
  ${routineFields(p)}`;
}

function routineFields(p) {
  const R = routineOf(p);
  return `
  <details class="routine-box">
    <summary>Customize your daily routine</summary>
    <p class="muted small">Untick anything you don't want in your plans, and rename it or change how long it takes. Exercise is only added on days with no health activity.</p>
    ${Object.entries(R).map(([key, r]) => `
    <div class="routine-row">
      <label class="routine-on"><input type="checkbox" name="rOn_${key}" ${r.on ? 'checked' : ''}> ${esc(DEFAULT_ROUTINE[key].label)}</label>
      <input class="${r.time ? '' : 'routine-wide'}" name="rTitle_${key}" maxlength="60" value="${esc(r.title)}" aria-label="${esc(DEFAULT_ROUTINE[key].label)} — name in your plan">
      ${r.time ? `<input type="time" name="rTime_${key}" value="${esc(r.time)}" aria-label="${esc(DEFAULT_ROUTINE[key].label)} — time">` : ''}
      <select name="rDur_${key}" aria-label="${esc(DEFAULT_ROUTINE[key].label)} — duration">
        ${[...new Set([5, 10, 15, 20, 30, 40, 45, 60, 90, r.dur])].sort((a, b) => a - b).map(m => `<option value="${m}" ${m === r.dur ? 'selected' : ''}>${hours(m)}</option>`).join('')}
      </select>
    </div>`).join('')}
  </details>`;
}

function readRoutine(f) {
  return Object.fromEntries(Object.entries(DEFAULT_ROUTINE).map(([key, d]) => {
    const r = { on: f.get(`rOn_${key}`) === 'on', title: (f.get(`rTitle_${key}`) || '').trim() || d.title, dur: +f.get(`rDur_${key}`) || d.dur };
    if (d.time) r.time = f.get(`rTime_${key}`) || d.time;
    return [key, r];
  }));
}

function awakeMinutes(wake, sleep) {
  const m = toMin(sleep) - toMin(wake);
  return m <= 0 ? m + 1440 : m;
}

function readProfile(form) {
  const f = new FormData(form);
  const wake = f.get('wake'), sleep = f.get('sleep');
  const awake = awakeMinutes(wake, sleep);
  if (awake < 8 * 60) { toast('Your day needs at least 8 awake hours for a plan'); return null; }
  const weekend = { enabled: f.get('wEnabled') === 'on', wake: f.get('wWake') || '09:00', sleep: f.get('wSleep') || '00:00' };
  if (weekend.enabled && awakeMinutes(weekend.wake, weekend.sleep) < 8 * 60) {
    toast('Your weekend day needs at least 8 awake hours too');
    return null;
  }
  const workH = +f.get('cHours') || 8;
  if (f.get('cEnabled') === 'on' && workH * 60 > awake - 3 * 60) {
    toast(`${hours(workH * 60)} of work doesn't fit in your day — wake earlier, sleep later or work fewer hours`);
    return null;
  }
  return {
    name: f.get('name').trim(),
    wake, sleep, weekend,
    routine: readRoutine(f),
    commit: {
      enabled: f.get('cEnabled') === 'on',
      label: (f.get('cLabel') || 'Work / School').trim(),
      start: f.get('cStart') || '09:00',
      hours: workH,
      days: f.getAll('cDays').map(Number),
    },
  };
}

function remindersCard() {
  const r = state.reminders;
  const supported = 'Notification' in window;
  const perm = supported ? Notification.permission : 'unsupported';
  const status = !r.enabled ? 'Off'
    : perm === 'granted' ? 'On — you\'ll get a notification for each block'
    : 'On — notifications are blocked by the browser, so you\'ll only see reminders inside the page';
  return `
  <div class="card">
    <h2>🔔 Reminders</h2>
    <p class="muted small" style="margin-top:-6px">A notification when each block starts, and an evening nudge to mark what you did. Works while Planner X is open in a tab — it can be in the background.</p>
    <p class="small"><b>Status:</b> ${status}</p>
    <div class="form-actions" style="justify-content:flex-start;align-items:center;flex-wrap:wrap">
      ${r.enabled ? '<button data-act="remindOff">Turn off</button>' : '<button class="btn-primary" data-act="remindOn">Turn on reminders</button>'}
      <select id="remindLead" style="width:auto" aria-label="When to remind">
        ${[0, 5, 10, 15].map(m => `<option value="${m}" ${r.lead === m ? 'selected' : ''}>${m ? `${m} min before` : 'When it starts'}</option>`).join('')}
      </select>
      ${r.enabled ? '<button data-act="remindTest">Send a test</button>' : ''}
    </div>
  </div>`;
}

function viewSettings() {
  const total = totalPoints();
  const current = state.theme ?? levelTheme(state.level);
  const rows = Array.from({ length: Math.max(10, state.level + 2) }, (_, i) => levelInfo(i + 1));
  return `
  <section class="period-head"><h1>Settings</h1></section>
  <div class="two-col">
    <div class="card">
      <h2>👤 Your day</h2>
      <form id="settingsForm">${profileFields(state.profile)}
        <div class="form-actions"><button class="btn-primary" type="submit">Save & rebuild plans</button></div>
      </form>
    </div>
    <div>
      <div class="card">
        <h2>🌗 Appearance</h2>
        <div class="mode-pick">
          ${Object.entries(MODES).map(([m, v]) => `
            <button class="${(state.mode || 'auto') === m ? 'sel' : ''}" data-act="setMode" data-m="${m}">
              ${v.icon} ${v.label}<br><span class="muted small" style="font-weight:400">${v.hint}</span>
            </button>`).join('')}
        </div>
      </div>
      ${remindersCard()}
      <div class="card">
        <h2>🎨 Themes <span class="muted small">a new one unlocks every level</span></h2>
        <div class="themes">
          ${THEMES.map((th, i) => {
            const locked = i + 1 > state.level;
            return `
            <button class="theme-card ${i === current ? 'sel' : ''} ${locked ? 'locked' : ''}" ${locked ? 'disabled' : ''} data-act="theme" data-i="${i}" title="${locked ? `Unlocks at Level ${i + 1}` : th.name}">
              <span class="theme-dot" style="background:${themeGrad(th)}">${locked ? '🔒' : th.icon}</span>
              <span class="theme-name">${th.name}</span>
              <span class="theme-lvl">${locked ? `Level ${i + 1}` : i === current ? 'Active' : 'Unlocked'}</span>
            </button>`;
          }).join('')}
        </div>
      </div>
      <div class="card">
        <h2>🏅 Levels <span class="muted small">you have ${total} pts</span></h2>
        <table class="levels-table">
          ${rows.map((l, i) => `<tr class="${i + 1 === state.level ? 'cur' : ''} ${i + 1 > state.level ? 'locked' : ''}"><td>Level ${i + 1}</td><td>${rankBadge(i + 1)}</td><td style="text-align:right">${l.need} pts</td><td>${i + 1 < state.level ? '✓' : i + 1 === state.level ? '← you' : ''}</td></tr>`).join('')}
        </table>
        <p class="muted small">How to earn: planning — adding a priority +2, daily goal +3, week/month/year goal +3, "what I did" entry +2, quick note +1 (up to ${ADD_CAP} pts a day). Doing — priorities +10/+20/+30 for the first hour by importance (half that for each extra hour), a full workday +40, exercise +15, daily goals +10, routines & meals +5, wind-down +10, breaks +2. Earn 80% of a day's points: +20 bonus, 100%: +50. Week / month / year goals: +40 / +80 / +200.</p>
      </div>
      <div class="card">
        <h2>💾 Data</h2>
        <p class="muted small">Everything is saved in this browser only, so clearing its data deletes your plans. Keep a backup somewhere safe.</p>
        <p class="small"><b>Last backup:</b> ${state.lastBackup ? `${prettyDate(keyOf(new Date(state.lastBackup)), { day: 'numeric', month: 'long', year: 'numeric' })}` : 'never'}${backupDue() ? ' — <span class="backup-due">time for a new one</span>' : ''}</p>
        <div class="form-actions" style="justify-content:flex-start;flex-wrap:wrap">
          <button class="${backupDue() ? 'btn-primary' : ''}" data-act="export">Export backup</button>
          <button data-act="import">Import backup</button>
          <button data-act="reset" style="color:var(--skip)">Reset everything</button>
        </div>
        ${damagedCopy() ? `
        <div class="clash-note" style="margin-top:12px">
          <div>⚠ Saved data that couldn't be read was kept as a copy.</div>
          <div class="form-actions" style="justify-content:flex-start;flex-wrap:wrap">
            <button class="btn-small" data-act="downloadDamaged">Download the copy</button>
            <button class="btn-small" data-act="discardDamaged">Delete the copy</button>
          </div>
        </div>` : ''}
      </div>
    </div>
  </div>`;
}
