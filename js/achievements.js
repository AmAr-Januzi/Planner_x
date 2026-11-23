'use strict';

/* Planner X — Achievements: badges, progress and unlocking. */

/* ---------- achievements ---------- */

const ACH_PTS = 25;
const ACHIEVEMENTS = [
  { id: 'first',     icon: '🎯', name: 'First Step',      desc: 'Finish your first priority',            stat: 'tasks',    goal: 1 },
  { id: 'tasks25',   icon: '✅', name: 'Getting Things Done', desc: 'Finish 25 priority blocks',         stat: 'tasks',    goal: 25 },
  { id: 'tasks100',  icon: '🏗️', name: 'Unstoppable',     desc: 'Finish 100 priority blocks',             stat: 'tasks',    goal: 100 },
  { id: 'perfect',   icon: '🌟', name: 'Perfect Day',     desc: 'Finish 100% of a day\'s plan',           stat: 'perfect',  goal: 1 },
  { id: 'perfect5',  icon: '💯', name: 'Perfectionist',   desc: 'Have 5 perfect days',                    stat: 'perfect',  goal: 5 },
  { id: 'streak3',   icon: '🔥', name: 'On Fire',         desc: '3 days in a row with 70%+ done',         stat: 'streak',   goal: 3 },
  { id: 'streak7',   icon: '⚡', name: 'Week Warrior',    desc: '7 days in a row with 70%+ done',         stat: 'streak',   goal: 7 },
  { id: 'streak30',  icon: '🏔️', name: 'Unbreakable',     desc: '30 days in a row with 70%+ done',        stat: 'streak',   goal: 30 },
  { id: 'early',     icon: '🌅', name: 'Early Bird',      desc: 'Tick "Wake up" on 5 days',               stat: 'wake',     goal: 5 },
  { id: 'habits',    icon: '🔁', name: 'Habit Builder',   desc: 'Complete daily goals 20 times',          stat: 'habits',   goal: 20 },
  { id: 'focus1',    icon: '⏱️', name: 'Deep Focus',      desc: 'Finish a focus session',                 stat: 'focus',    goal: 1 },
  { id: 'focus25',   icon: '🧠', name: 'Focus Master',    desc: 'Finish 25 focus sessions',               stat: 'focus',    goal: 25 },
  { id: 'notes',     icon: '💭', name: 'Idea Machine',    desc: 'Write 20 quick notes',                   stat: 'notes',    goal: 20 },
  { id: 'planner',   icon: '🗓️', name: 'Planner Pro',     desc: 'Plan priorities on 10 different days',   stat: 'planned',  goal: 10 },
  { id: 'goals',     icon: '🏁', name: 'Goal Getter',     desc: 'Complete 5 week, month or year goals',   stat: 'goals',    goal: 5 },
  { id: 'gold',      icon: '🥇', name: 'Golden',          desc: 'Reach the Gold rank',                    stat: 'level',    goal: 4 },
  { id: 'diamond',   icon: '💎', name: 'Diamond Mind',    desc: 'Reach the Diamond rank',                 stat: 'level',    goal: 6 },
];

function achievementStats() {
  const s = { tasks: 0, perfect: 0, streak: 0, wake: 0, habits: 0, planned: 0 };
  let run = 0, prev = null;
  for (const k of Object.keys(state.days).sort()) {
    const d = state.days[k], st = dayStats(k);
    if (d.priorities?.length) s.planned++;
    for (const b of d.plan?.blocks || []) {
      if (b.status !== 'done') continue;
      if (b.type === 'task' || b.type === 'anytime') s.tasks++;
      if (b.type === 'habit') s.habits++;
      if (b.tag === 'wake') s.wake++;
    }
    if (st.total >= 5 && st.pct === 100) s.perfect++;
    if (st.pct >= 70) { run = prev && addDays(prev, 1) === k ? run + 1 : 1; prev = k; s.streak = Math.max(s.streak, run); }
    else { run = 0; prev = null; }
  }
  s.focus = state.stats.focusSessions;
  s.notes = state.stats.added.note || 0;
  s.goals = Object.values(state.goals).flat().filter(g => g.done).length;
  s.level = state.level;
  return s;
}

// unlocks anything newly earned; unlocked achievements stay unlocked
function checkAchievements() {
  const s = achievementStats();
  const fresh = ACHIEVEMENTS.filter(a => !state.achievements[a.id] && s[a.stat] >= a.goal);
  if (!fresh.length) return;
  const before = totalPoints();
  fresh.forEach(a => { state.achievements[a.id] = todayKey(); });
  save();
  fresh.slice(0, 3).forEach(a => toast(`🏅 Achievement unlocked: ${a.icon} ${a.name} (+${ACH_PTS} pts)`));
  if (fresh.length > 3) toast(`…and ${fresh.length - 3} more achievements!`);
  if (totalPoints() > before && canLevelUp() && !ui.levelPrompted) { ui.levelPrompted = true; setTimeout(showLevelUp, 600); }
}

function achCard() {
  const s = achievementStats();
  const got = ACHIEVEMENTS.filter(a => state.achievements[a.id]);
  const next = ACHIEVEMENTS.filter(a => !state.achievements[a.id])
    .map(a => ({ a, p: Math.min(1, s[a.stat] / a.goal) }))
    .sort((x, y) => y.p - x.p)[0];
  return `
  <div class="card c-ach">
    <div class="card-head">
      <h2>🏅 Achievements <span class="chip style-chip">${got.length}/${ACHIEVEMENTS.length}</span></h2>
      <button class="btn-small" data-act="showAch">View all</button>
    </div>
    <div class="ach-row">
      ${ACHIEVEMENTS.map(a => `<span class="ach-dot ${state.achievements[a.id] ? 'got' : ''}" title="${esc(a.name)} — ${esc(a.desc)}${state.achievements[a.id] ? ' ✓' : ''}">${state.achievements[a.id] ? a.icon : '🔒'}</span>`).join('')}
    </div>
    ${next ? `
    <div class="ach-next">
      <div class="small"><b>Next:</b> ${next.a.icon} ${esc(next.a.name)} <span class="muted">— ${esc(next.a.desc)}</span></div>
      <div class="ach-progress"><div class="bar"><span style="width:${Math.round(next.p * 100)}%"></span></div>
      <span class="small muted">${Math.min(s[next.a.stat], next.a.goal)}/${next.a.goal}</span></div>
    </div>` : '<p class="small" style="margin:10px 0 0">You unlocked everything. Legend! 🌟</p>'}
  </div>`;
}

function showAchievements() {
  const s = achievementStats();
  openModal(`
    <h2>🏅 Achievements</h2>
    <p class="muted small" style="margin-top:-6px">${Object.keys(state.achievements).length} of ${ACHIEVEMENTS.length} unlocked · each one gives +${ACH_PTS} pts</p>
    <div class="ach-grid">
      ${ACHIEVEMENTS.map(a => {
        const when = state.achievements[a.id];
        const cur = Math.min(s[a.stat], a.goal);
        return `
        <div class="ach-item ${when ? 'got' : ''}">
          <div class="ach-icon">${a.icon}</div>
          <div class="ach-body">
            <div class="ach-name">${esc(a.name)}</div>
            <div class="ach-desc">${esc(a.desc)}</div>
            ${when
              ? `<div class="ach-when">✓ Unlocked ${prettyDate(when, { day: 'numeric', month: 'short' })}</div>`
              : `<div class="ach-progress"><div class="bar"><span style="width:${Math.round(cur / a.goal * 100)}%"></span></div><span class="small muted">${cur}/${a.goal}</span></div>`}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="form-actions"><button class="btn-primary" data-act="closeModal">Close</button></div>`);
}
