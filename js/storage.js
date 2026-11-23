'use strict';

/* Planner X — App state: loading and saving to localStorage. */

/* ---------------- state ---------------- */

const DAMAGED_KEY = STORE_KEY + '.damaged';
let state = load();
const ui = { view: 'day', date: keyOf(new Date()), editing: null, editingHabit: null, levelPrompted: false, statsRange: 30, daySection: (() => { try { return localStorage.getItem('plannerx-daySection'); } catch { return null; } })() };

function defaultState() {
  return { profile: null, level: 1, theme: null, mode: 'auto', days: {}, goals: {}, habits: [], notes: [], activity: {},
    achievements: {}, stats: { focusSessions: 0, focusMinutes: 0, added: {} }, focus: null, reminders: { enabled: false, lead: 5 }, lastBackup: null };
}

// fills in anything an older save or a hand-edited backup is missing, so the views can rely on it
function normalizeState(raw) {
  const d = defaultState();
  const s = { ...d, ...raw };
  s.stats = { ...d.stats, ...raw.stats, added: { ...raw.stats?.added } };
  s.reminders = { ...d.reminders, ...raw.reminders };
  for (const day of Object.values(s.days)) {
    day.priorities ||= [];
    day.log ||= [];
    if (day.plan && !Array.isArray(day.plan.blocks)) day.plan = null;
    if (day.plan) day.plan.overflow ||= [];
    for (const pr of day.priorities) {
      if (!CATEGORIES[pr.category]) pr.category = 'personal';
      if (!IMPORTANCE_PTS[pr.importance]) pr.importance = 'medium';
    }
  }
  return s;
}

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : defaultState();
  } catch {
    // unreadable data: keep a copy, because the next save would otherwise overwrite it for good
    if (raw) try { localStorage.setItem(DAMAGED_KEY, raw); } catch { /* nothing more we can do */ }
    return defaultState();
  }
}
function damagedCopy() {
  try { return localStorage.getItem(DAMAGED_KEY); } catch { return null; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { toast('Could not save — storage is full or blocked'); }
}
function getDay(k, create = false) {
  if (!state.days[k] && create) state.days[k] = { priorities: [], plan: null, log: [] };
  return state.days[k];
}

// data lives in this browser only, so nudge a backup every two weeks once there is something to lose
function backupDue() {
  if (Object.keys(state.days).length < 7) return false;
  return !state.lastBackup || Date.now() - state.lastBackup > 14 * 86400000;
}

function downloadFile(text, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
