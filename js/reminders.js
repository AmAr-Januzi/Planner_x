'use strict';

/* Planner X — Reminders and browser notifications. */

/* ---------------- reminders ---------------- */

function notify(title, body) {
  if (document.visibilityState === 'visible') toast(`🔔 ${title}`);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon: 'favicon.svg', tag: title });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* some mobile browsers only allow notifications from a service worker */ }
}

// remembers which reminders already fired today, so a reload doesn't repeat them
function sentReminders(k) {
  try {
    const s = JSON.parse(localStorage.getItem('plannerx.sent') || '{}');
    return new Set(s.k === k ? s.keys : []);
  } catch { return new Set(); }
}
function saveSentReminders(k, set) {
  try { localStorage.setItem('plannerx.sent', JSON.stringify({ k, keys: [...set] })); } catch { /* not critical */ }
}

function checkReminders() {
  const r = state.reminders;
  if (!r.enabled || !state.profile) return;
  const k = todayKey(), day = getDay(k);
  if (!day?.plan) return;
  const now = nowMinutes();
  const sent = sentReminders(k);
  const due = at => now >= at && now < at + 3; // small window so a sleeping tab still catches it
  let changed = false;

  for (const b of day.plan.blocks) {
    if (['free', 'review', 'anytime'].includes(b.type) || b.status !== 'todo' || sent.has(b.key)) continue;
    if (due(b.start - r.lead)) {
      sent.add(b.key); changed = true;
      notify(r.lead ? `In ${r.lead} min: ${b.title}` : `Now: ${b.title}`, `${fmt(b.start)}–${fmt(b.end)} · +${b.points} pts`);
    }
  }

  const review = day.plan.blocks.find(b => b.type === 'review');
  if (review && !sent.has('evening') && due(review.start)) {
    sent.add('evening'); changed = true;
    const open = day.plan.blocks.filter(b => b.type !== 'free' && b.status === 'todo' && b.end <= now).length;
    notify('Time to review your day', open
      ? `${open} block${open > 1 ? 's are' : ' is'} still unmarked. Mark what you did and didn't do.`
      : `Everything is marked — ${dayStats(k).pct}% done today. Check tomorrow's plan.`);
  }
  if (changed) saveSentReminders(k, sent);
}
