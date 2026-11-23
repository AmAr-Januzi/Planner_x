'use strict';

/* Planner X — Small helpers: DOM shortcuts, escaping, dates, times, seeded random. */

/* ---------------- helpers ---------------- */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, '0');

const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = dateOf(k); d.setDate(d.getDate() + n); return keyOf(d); };
// "today" is the day you're living, not the calendar date: with a 01:00 bedtime, 00:30 still belongs to yesterday
const todayKey = () => {
  const now = new Date(), k = keyOf(now);
  if (!state?.profile) return k;
  const y = addDays(k, -1);
  return now.getHours() * 60 + now.getMinutes() + 1440 < dayBounds(y).S ? y : k;
};
const weekStart = k => { const d = dateOf(k); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return keyOf(d); };
const prettyDate = (k, opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) => dateOf(k).toLocaleDateString(undefined, opts);

const toMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const fmt = min => { min = ((min % 1440) + 1440) % 1440; return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`; };
const ceil5 = m => Math.ceil(m / 5) * 5;
const hours = min => { const h = Math.floor(min / 60), m = min % 60; return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`; };

// Seeded random so a day's coach messages are stable for that day but differ between days.
function rng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  return () => {
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
