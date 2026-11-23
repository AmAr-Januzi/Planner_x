'use strict';

/* Planner X — Event handlers: clicks, form submits, keyboard. */

/* ---------------- events ---------------- */

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t) {
    if (e.target.id === 'modal' && $('#modal').dataset.closable) closeModal();
    return;
  }
  const act = t.dataset.act, id = t.dataset.id;
  // during onboarding, the only thing you can do besides filling it in is restore a backup
  if (!state.profile && !['import', 'confirmOk', 'closeModal'].includes(act)) return;
  const day = getDay(ui.date);
  if (['rebuild', 'editPrio', 'delPrio', 'resetMoves'].includes(act) && !canEdit(ui.date)) {
    toast(ui.date < todayKey() ? '🔒 This day is over — its plan stays as a record' : '🔒 Today\'s plan is locked — plan tomorrow or replan today');
    return;
  }

  switch (act) {
    case 'view': ui.view = t.dataset.view; ui.editing = ui.editingHabit = null; break;
    case 'daySec':
      ui.view = 'day'; ui.daySection = t.dataset.sec; ui.editing = ui.editingHabit = null;
      try { localStorage.setItem('plannerx-daySection', ui.daySection); } catch {}
      render(); window.scrollTo({ top: 0 });
      return;
    case 'sideToggle':
      try { localStorage.setItem('plannerx-side', document.documentElement.classList.contains('side-mini') ? 'full' : 'mini'); } catch {}
      applySide();
      return;
    case 'today': ui.date = todayKey(); break;
    case 'shift': ui.date = addDays(ui.date, +t.dataset.n); ui.editing = ui.editingHabit = null; break;
    case 'statsRange': ui.statsRange = +t.dataset.n; break;

    case 'replan':
      ask({ icon: '✎', title: 'Replan the rest of today?', text: 'Today opens up again, so you can add, change or remove priorities. Finished blocks stay where they are, and unfinished ones can only move into time that hasn\'t passed.', ok: 'Replan today' }, () => {
        day.locked = false; save();
      });
      return;
    case 'resetMoves':
      for (const b of day.plan.blocks) delete b.manual;
      buildPlan(ui.date); save();
      toast('Moved blocks are back in the planner\'s hands');
      break;

    case 'shiftMonth': { const d = dateOf(ui.date); ui.date = keyOf(new Date(d.getFullYear(), d.getMonth() + +t.dataset.n, 1)); break; }
    case 'shiftYear': { const d = dateOf(ui.date); ui.date = keyOf(new Date(d.getFullYear() + +t.dataset.n, 0, 1)); break; }
    case 'openDay': ui.date = t.dataset.k; ui.view = 'day'; break;
    case 'openMonth': ui.date = keyOf(new Date(dateOf(ui.date).getFullYear(), +t.dataset.m, 1)); ui.view = 'month'; break;

    case 'rebuild': {
      if (!day?.plan) { buildPlan(ui.date); save(); toast('Plan built ✨'); break; }
      // try the next styles until one actually moves something
      const before = planSignature(ui.date);
      const from = day.plan.style ?? 0;
      let changed = false;
      for (let i = 1; i <= PLAN_STYLES.length && !changed; i++) {
        buildPlan(ui.date, (from + i) % PLAN_STYLES.length);
        changed = planSignature(ui.date) !== before;
      }
      if (!changed) buildPlan(ui.date, from);
      save();
      const s = PLAN_STYLES[day.plan.style];
      toast(changed ? `${s.icon} ${s.name} — ${s.desc}` : 'Nothing to rearrange yet — add priorities without a fixed time first');
      break;
    }

    case 'mark': {
      const b = day.plan.blocks.find(x => x.id === id);
      const before = totalPoints();
      b.status = b.status === t.dataset.s ? 'todo' : t.dataset.s;
      save();
      afterPointsChange(before);
      break;
    }

    case 'clearMarks': {
      const marked = day.plan.blocks.filter(b => b.status === 'done' || b.status === 'skipped');
      const st = dayStats(ui.date);
      ask({
        icon: '⟲',
        title: 'Clear all marks?',
        text: `Every ✓ and ✕ on ${dayWord(ui.date) === 'today' ? 'today' : prettyDate(ui.date, { weekday: 'long', day: 'numeric', month: 'short' })} goes back to unmarked. The plan itself stays the same.`,
        detail: `<div class="dialog-stats">
          <span class="ds-done">✓ ${st.done} done</span>
          <span class="ds-skip">✕ ${st.skipped} skipped</span>
          <span class="ds-pts">−${st.points} pts</span>
        </div>`,
        ok: `Clear ${marked.length} mark${marked.length > 1 ? 's' : ''}`,
        danger: true,
      }, () => {
        const before = totalPoints();
        marked.forEach(b => { b.status = 'todo'; });
        save();
        afterPointsChange(before);
      });
      return;
    }

    case 'confirmOk': {
      const fn = ui.onConfirm;
      closeModal();
      fn?.();
      break;
    }

    case 'editPrio': ui.editing = id; ui.resetForms = ['prioForm']; render(); $('#pTitle')?.focus(); return;
    case 'cancelEdit': ui.editing = null; ui.resetForms = ['prioForm']; break;
    case 'delPrio': {
      const pr = day.priorities.find(p => p.id === id);
      ask({ icon: '🗑️', title: `Delete “${pr.title}”?`, text: 'It will be removed from this day and the plan will be rebuilt.', ok: 'Delete', danger: true }, () => {
        const before = totalPoints();
        day.priorities = day.priorities.filter(p => p.id !== id);
        buildPlan(ui.date); save();
        afterPointsChange(before);
      });
      return;
    }
    case 'movePrio': {
      const pr = day.priorities.find(p => p.id === id);
      const target = moveTarget(ui.date);
      // past or locked days keep the original (marked as carried) so their record stays as it was
      if (!canEdit(ui.date)) {
        carryTo(pr, target);
        buildPlan(target); save();
        toast(`Sent to ${dayWord(target)}`);
        break;
      }
      getDay(target, true).priorities.push({ ...pr, id: uid(), moved: (pr.moved || 0) + 1 });
      day.priorities = day.priorities.filter(p => p.id !== id);
      buildPlan(ui.date); buildPlan(target); save();
      toast(`Moved to ${prettyDate(target, { weekday: 'long' })}`);
      break;
    }
    case 'carryDrop':
      for (const { pr } of carryCandidates()) pr.carried = 'dropped';
      save(); toast('Dropped — they stay in your history');
      break;

    case 'remindOn': {
      const enable = () => { state.reminders.enabled = true; save(); render(); checkReminders(); };
      if (!('Notification' in window)) { enable(); toast('This browser has no notifications — reminders will show inside the page'); return; }
      Notification.requestPermission().then(p => {
        enable();
        toast(p === 'granted' ? 'Reminders on 🔔' : 'Notifications blocked — reminders will show inside the page only');
      });
      return;
    }
    case 'remindOff': state.reminders.enabled = false; save(); break;
    case 'remindTest': notify('Planner X reminder', 'This is how a reminder will look.'); return;

    case 'delLog': {
      const log = day.log, i = log.findIndex(l => l.id === id), [entry] = log.splice(i, 1);
      save();
      toastUndo('Entry deleted', () => log.splice(i, 0, entry));
      break;
    }

    case 'noteToPrio': {
      const n = state.notes.find(x => x.id === id);
      const target = noteTarget(ui.date);
      const pr = noteToPriority(n.text);
      getDay(target, true).priorities.push(pr);
      state.notes = state.notes.filter(x => x.id !== id);
      buildPlan(target); save();
      toast(`📌 Added to ${dayWord(target)}'s Anytime list (${CATEGORIES[pr.category].icon} ${CATEGORIES[pr.category].label})`);
      break;
    }
    // ✓ / ✕ for a whole priority (all its parts); pressing the same one again undoes it
    case 'donePrio':
    case 'skipPrio': {
      const status = act === 'donePrio' ? 'done' : 'skipped';
      const bl = day.plan.blocks.filter(b => b.pid === id);
      const already = bl.every(b => b.status === status);
      const before = totalPoints();
      bl.forEach(b => { b.status = already ? 'todo' : status; });
      save();
      afterPointsChange(before);
      break;
    }
    // removes finished tasks from the Top priorities list only — the task and its points stay
    case 'hideTop': {
      const pr = day.priorities.find(p => p.id === id);
      pr.hiddenTop = true; save();
      toast(`“${pr.title}” removed from the list — points kept`);
      break;
    }
    case 'clearTopDone': {
      const done = day.priorities.filter(pr => {
        const ps = priorityState(day, pr);
        return !pr.hiddenTop && (ps.done || ps.skipped);
      });
      done.forEach(pr => { pr.hiddenTop = true; });
      save();
      toast(`🧹 ${done.length} finished task${done.length > 1 ? 's' : ''} cleared — points kept`);
      break;
    }
    case 'focusStart': startFocus($('#focusBlock').value, $('#focusLen').value); break;
    case 'focusPause': state.focus.left = state.focus.endsAt - Date.now(); state.focus.endsAt = null; save(); break;
    case 'focusResume': state.focus.endsAt = Date.now() + state.focus.left; state.focus.left = null; save(); break;
    case 'focusMore':
      Object.assign(state.focus, { finished: false, total: 5 * 60000, endsAt: Date.now() + 5 * 60000, left: null });
      save(); break;
    case 'focusStop': state.focus = null; save(); toast('Focus stopped'); break;
    case 'focusDone': focusDone(); return;
    case 'showAch': showAchievements(); return;

    case 'delNote': {
      const note = state.notes.find(x => x.id === id);
      state.notes = state.notes.filter(x => x.id !== id);
      save();
      toastUndo('Note deleted', () => state.notes.push(note)); // notes are listed by date, so the position doesn't matter
      break;
    }

    case 'editHabit':
      ui.editingHabit = id; ui.resetForms = ['habitForm'];
      render();
      $('#hTitle')?.focus();
      return;
    case 'cancelEditHabit': ui.editingHabit = null; ui.resetForms = ['habitForm']; break;

    case 'delHabit': {
      const h = state.habits.find(x => x.id === id);
      ask({ icon: '🔁', title: `Stop “${h.title}”?`, text: 'It won\'t be added to new plans anymore. Past days keep their record.', ok: 'Stop daily goal', danger: true }, () => {
        const before = totalPoints();
        state.habits = state.habits.filter(x => x.id !== id);
        rebuildUpcoming(); save();
        afterPointsChange(before);
      });
      return;
    }

    case 'toggleGoal': {
      const g = state.goals[t.dataset.g].find(x => x.id === id);
      const before = totalPoints();
      g.done = !g.done; save();
      afterPointsChange(before);
      break;
    }
    case 'delGoal': {
      const before = totalPoints();
      const list = state.goals[t.dataset.g], i = list.findIndex(x => x.id === id), [goal] = list.splice(i, 1);
      save();
      afterPointsChange(before);
      toastUndo('Goal deleted', () => list.splice(i, 0, goal));
      break;
    }

    case 'levelup': showLevelUp(); return;
    case 'confirmLevel':
      state.level++;
      state.theme = null; // switch to the newly unlocked theme
      ui.levelPrompted = false;
      save(); closeModal();
      toast(`${levelInfo(state.level).icon} Welcome to ${levelInfo(state.level).name}! (Level ${state.level})`);
      break;
    case 'closeModal': closeModal(); return;

    case 'setMode': state.mode = t.dataset.m; save(); break;
    case 'theme': state.theme = +t.dataset.i; save(); toast(`${THEMES[state.theme].icon} ${THEMES[state.theme].name} theme`); break;
    case 'export':
      state.lastBackup = Date.now();
      save();
      downloadFile(JSON.stringify(state, null, 2), `planner-x-backup-${keyOf(new Date())}.json`);
      toast('Backup downloaded 💾');
      break;
    case 'downloadDamaged':
      downloadFile(damagedCopy(), `planner-x-damaged-data-${keyOf(new Date())}.json`);
      return;
    case 'discardDamaged':
      ask({ icon: '🗑️', title: 'Delete the damaged copy?', text: 'This can\'t be undone. Download it first if you might want to try to recover it.', ok: 'Delete copy', danger: true }, () => {
        localStorage.removeItem(DAMAGED_KEY);
      });
      return;
    case 'import': {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'application/json';
      inp.onchange = async () => {
        let data;
        try {
          data = JSON.parse(await inp.files[0].text());
          if (!data || typeof data.days !== 'object' || !data.days || typeof data.goals !== 'object' || !data.goals) throw new Error();
        } catch { toast('That file is not a Planner X backup'); return; }
        const n = Object.keys(data.days).length;
        ask({
          icon: '📥',
          title: state.profile ? 'Replace your data with this backup?' : 'Restore this backup?',
          text: `The backup has ${n} planned day${n === 1 ? '' : 's'}.${state.profile ? ' Everything currently in Planner X will be replaced — this can\'t be undone, so export a backup first if you might want it.' : ''}`,
          ok: state.profile ? 'Replace my data' : 'Restore',
          danger: !!state.profile,
        }, () => {
          state = normalizeState(data);
          ui.date = todayKey(); ui.view = 'day'; ui.editing = ui.editingHabit = null;
          ensureToday();
          save();
          closeModal();
          toast('Backup imported');
        });
      };
      inp.click();
      return;
    }
    case 'reset':
      ask({ icon: '⚠️', title: 'Reset everything?', text: 'All your plans, daily goals, points and levels will be deleted. This cannot be undone — export a backup first if you might want them.', ok: 'Delete everything', danger: true }, () => {
        state = defaultState(); save(); ui.view = 'day'; ui.date = todayKey();
      });
      return;
    default: return;
  }
  render();
});

document.addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target;
  const f = new FormData(form);
  // a successful submit re-renders right away with this form empty; if it fails, keep the draft
  ui.resetForms = [formKey(form)];
  setTimeout(() => { ui.resetForms = []; }, 0);

  if (form.id === 'onboardForm' || form.id === 'settingsForm') {
    const profile = readProfile(form);
    if (!profile) return;
    state.profile = profile;
    if (form.id === 'onboardForm') {
      state.startDay = todayKey();
      closeModal();
      buildPlan(todayKey());
      toast(`Let's go, ${profile.name}! Add your priorities for today.`);
    } else {
      rebuildUpcoming();
      toast(canEdit(todayKey()) ? 'Saved — plans rebuilt' : 'Saved — plans from tomorrow on rebuilt (today is locked)');
    }
    save(); render();
    return;
  }

  if (form.id === 'prioForm') {
    if (!canEdit(ui.date)) { toast('🔒 Today\'s plan is locked'); return; }
    const day = getDay(ui.date, true);
    const data = {
      title: f.get('title').trim(),
      category: f.get('category'),
      duration: +f.get('duration'),
      importance: f.get('importance'),
      anytime: f.get('anytime') === 'on',
      time: f.get('anytime') === 'on' ? '' : f.get('time') || '',
      goal: f.get('goal') || '',
    };
    if (!data.title) return;
    const before = totalPoints();
    const clashesBefore = day.plan?.clashes?.length || 0;
    if (ui.editing) {
      Object.assign(day.priorities.find(p => p.id === ui.editing), data);
      ui.editing = null;
    } else {
      day.priorities.push({ id: uid(), ...data, moved: 0 });
      ui.scrollToEnd = 'prios';
      awardAdd('priority'); // shown by afterPointsChange below
    }
    buildPlan(ui.date); save();
    afterPointsChange(before);
    if (day.plan.clashes.length > clashesBefore) toast(`⚠ ${clashText(day.plan.clashes[day.plan.clashes.length - 1])}`, 5000);
    render();
    $('#pTitle')?.focus({ preventScroll: true }); // keep the new priority in view
    return;
  }

  if (form.id === 'habitForm') {
    const title = f.get('title').trim();
    if (!title) return;
    const data = { title, category: f.get('category'), duration: +f.get('duration'), time: f.get('time') || '', days: f.getAll('hDays').map(Number) };
    if (!data.days.length) { toast('Pick at least one day'); return; }
    if (ui.editingHabit) {
      const edited = state.habits.find(x => x.id === ui.editingHabit);
      Object.assign(edited, data); // same id and start date, so the streak and history stay
      ui.editingHabit = null;
      rebuildUpcoming();
      for (const b of getDay(todayKey())?.plan?.blocks || []) if (b.type === 'habit' && b.tag === edited.id) b.title = title; // a locked today keeps its times
      toast(`“${title}” updated — ${daysLabel(data.days)}`);
      save(); render();
      return;
    }
    state.habits.push({ id: uid(), ...data, since: todayKey() });
    const h = state.habits[state.habits.length - 1];
    ui.scrollToEnd = 'habits';
    rebuildUpcoming();
    toast(`“${title}” added — ${daysLabel(h.days)}`);
    pointsForAdding('habit');
    save(); render();
    $('#hTitle')?.focus();
    return;
  }

  if (form.id === 'noteForm') {
    const text = f.get('text').trim();
    if (!text) return;
    state.notes.push({ id: uid(), text, at: Date.now() });
    ui.scrollToStart = 'notes'; // newest notes are listed first
    pointsForAdding('note');
    save(); render();
    $('#noteForm input')?.focus();
    return;
  }

  if (form.id === 'carryForm') {
    const picked = new Set(f.getAll('c'));
    let n = 0;
    for (const { k, pr } of carryCandidates()) {
      if (picked.has(`${k}|${pr.id}`)) { carryTo(pr); n++; } else pr.carried = 'dropped';
    }
    buildPlan(planTarget()); save(); render();
    toast(n ? `${n} added to ${dayWord(planTarget())}'s plan` : 'Dropped');
    return;
  }

  if (form.id === 'logForm') {
    getDay(ui.date, true).log.push({ id: uid(), time: f.get('time'), text: f.get('text').trim() });
    pointsForAdding('log');
    save(); render();
    return;
  }

  if (form.dataset.goal) {
    const gk = form.dataset.goal;
    (state.goals[gk] ||= []).push({ id: uid(), text: f.get('text').trim(), done: false });
    ui.scrollToEnd = 'goal-' + gk;
    pointsForAdding('goal');
    save(); render();
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'remindLead') { state.reminders.lead = +e.target.value; save(); }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#modal').dataset.closable) closeModal();
  // clickable cards in the week, month and year pages work from the keyboard too
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[role="button"][data-act]')) {
    e.preventDefault();
    e.target.click();
  }
});

// Another tab saved: take over its data, otherwise this tab's next save would overwrite those changes.
addEventListener('storage', e => {
  if (e.key !== STORE_KEY || !e.newValue) return;
  try { state = normalizeState(JSON.parse(e.newValue)); } catch { return; }
  ui.editing = ui.editingHabit = null;
  if (!$('#modal').classList.contains('hidden')) closeModal(); // an open dialog could still point at the old data
  render();
});
