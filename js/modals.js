'use strict';

/* Planner X — Pop-ups (confirm, onboarding, level up) and toasts. */

/* ---------------- modals & toasts ---------------- */

function openModal(html, closable = true) {
  $('#modalBody').innerHTML = html;
  $('#modal').classList.remove('hidden');
  $('#modal').dataset.closable = closable ? '1' : '';
  $('#modalBody').focus({ preventScroll: true }); // screen readers and the keyboard start inside the dialog
}
function closeModal() {
  $('#modal').classList.add('hidden');
  ui.onConfirm = null;
  if (!state.profile) showOnboarding(); // e.g. cancelling a backup import during onboarding
}

// In-app confirmation pop-up (replaces the browser's confirm()).
function ask({ icon = '❓', title, text = '', detail = '', ok = 'Confirm', danger = false }, onOk) {
  openModal(`
    <div class="dialog">
      <div class="dialog-icon ${danger ? 'danger' : ''}">${icon}</div>
      <h2>${esc(title)}</h2>
      ${text ? `<p class="muted">${esc(text)}</p>` : ''}
      ${detail}
      <div class="form-actions dialog-actions">
        <button data-act="closeModal">Cancel</button>
        <button class="${danger ? 'btn-danger' : 'btn-primary'}" data-act="confirmOk">${esc(ok)}</button>
      </div>
    </div>`);
  ui.onConfirm = onOk;
  $('#modalBody [data-act="confirmOk"]').focus();
}

function showOnboarding() {
  openModal(`
    <h2>Welcome to Planner X 👋</h2>
    <p class="muted">Tell me about your day. I'll build a full plan from the moment you wake up until you go to sleep, coach you every day, and reward everything you finish with points.</p>
    <form id="onboardForm">${profileFields(null)}
      <div class="form-actions">
        <button type="button" data-act="import">Restore a backup</button>
        <button class="btn-primary" type="submit">Start planning →</button>
      </div>
    </form>`, false);
}

function showLevelUp() {
  const next = levelInfo(state.level + 1);
  const nextTheme = THEMES[levelTheme(state.level + 1)];
  openModal(`
    <div class="levelup">
      <div class="big rank-medal" style="--r1:${next.r1};--r2:${next.r2}">${next.icon}</div>
      <h2>You reached ${next.need} points!</h2>
      <p class="muted">You hit the point limit of ${esc(levelInfo(state.level).name)}. You're ready to rank up.</p>
      <div style="margin:6px 0 4px">${rankBadge(state.level + 1, true)}</div>
      <div class="small muted">Level ${state.level + 1}</div>
      <p class="small muted">${state.level < THEMES.length ? `Unlocks the ${nextTheme.icon} ${nextTheme.name} theme. ` : ''}Next limit: ${levelInfo(state.level + 2).need} pts.</p>
      <div class="form-actions" style="justify-content:center">
        <button data-act="closeModal">Later</button>
        <button class="btn-primary" data-act="confirmLevel" style="background:linear-gradient(135deg, ${nextTheme.a}, color-mix(in srgb, ${nextTheme.a} 75%, ${nextTheme.b}))">Move to Level ${state.level + 1} →</button>
      </div>
    </div>`);
}

function toast(text, ms = 2600) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), ms);
  return el;
}

// A toast with an Undo button. `undo` puts things back; saving and redrawing happen here.
function toastUndo(text, undo) {
  const el = toast(text, 6000);
  el.classList.add('toast-undo');
  const btn = document.createElement('button');
  btn.textContent = 'Undo';
  btn.onclick = () => {
    const before = totalPoints();
    undo();
    el.remove();
    save();
    afterPointsChange(before);
    render();
  };
  el.appendChild(btn);
}
