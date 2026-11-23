'use strict';

/* Planner X — Startup: first render and timers. Loaded last. */

/* ---------------- start ---------------- */

applySide();
ui.date = todayKey();
ensureToday();
render();
if (damagedCopy()) toast('⚠ Some saved data couldn\'t be read. A copy is kept — see Settings → Data.', 8000);
// turn transitions on only after the first frame has been painted in the saved mode
requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('preload')));

checkReminders();

// refresh the "right now" card and reminders every 30s; rebuild everything when the date changes
let lastDay = todayKey();
setInterval(() => {
  if (todayKey() !== lastDay) {
    if (ui.date === lastDay) ui.date = todayKey();
    lastDay = todayKey();
    ensureToday();
    render();
  } else tickNow();
  checkReminders();
}, 30 * 1000);

setInterval(focusTick, 1000);
focusTick();
