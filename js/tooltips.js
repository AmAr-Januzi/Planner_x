'use strict';

/* Planner X — Styled hover tooltips. */

/* ---------------- tooltips ---------------- */
// Replaces the browser's plain `title` tooltips with styled ones. Any element with a
// title gets it automatically: on first hover the title moves to data-tip.

let tipEl = null, tipTarget = null, tipTimer = null;

function getTip() {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'tip';
    tipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

function showTip(el) {
  const tip = getTip();
  tip.textContent = el.dataset.tip;
  const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
  let top = r.top - t.height - 10, below = false;
  if (top < 8) { top = r.bottom + 10; below = true; }
  const left = Math.max(8, Math.min(r.left + r.width / 2 - t.width / 2, innerWidth - t.width - 8));
  tip.style.top = `${top}px`;
  tip.style.left = `${left}px`;
  tip.style.setProperty('--arrow-x', `${Math.max(12, Math.min(t.width - 12, r.left + r.width / 2 - left))}px`);
  tip.classList.toggle('below', below);
  tip.classList.add('show');
}

function hideTip() {
  clearTimeout(tipTimer);
  tipTarget = null;
  tipEl?.classList.remove('show');
}

if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
  // pointer events also fire on disabled buttons, so their hints still show
  document.addEventListener('pointerover', e => {
    const el = e.target.closest?.('[title], [data-tip]');
    if (!el || el === tipTarget) return;
    if (el.hasAttribute('title')) {
      el.dataset.tip = el.getAttribute('title');
      el.removeAttribute('title');
    }
    hideTip();
    if (!el.dataset.tip) return;
    tipTarget = el;
    tipTimer = setTimeout(() => { if (tipTarget === el && el.isConnected) showTip(el); }, 280);
  });
  document.addEventListener('pointerout', e => {
    if (tipTarget && !tipTarget.contains(e.relatedTarget)) hideTip();
  });
  document.addEventListener('pointerdown', hideTip);
  document.addEventListener('keydown', hideTip);
  addEventListener('scroll', hideTip, true);
  addEventListener('blur', hideTip);
}
