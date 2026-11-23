'use strict';

/* Planner X — Moving plan blocks by hand: drag the ⠿ handle (mouse or touch) or use the arrow keys on it. */

let drag = null;

// runs the move and offers to undo it
function moveWithUndo(id, targetId) {
  const day = getDay(ui.date);
  const snapshot = JSON.stringify(day.plan);
  const times = day.priorities.map(p => [p, p.time]);
  const error = moveBlock(ui.date, id, targetId);
  if (error) return error;
  save();
  render();
  toastUndo('Block moved', () => {
    day.plan = JSON.parse(snapshot);
    for (const [p, time] of times) p.time = time;
  });
  return null;
}

function endDrag() {
  if (!drag) return;
  drag.row.classList.remove('dragging');
  drag.row.style.transform = '';
  drag.target?.classList.remove('drop-ok', 'drop-bad');
  clearInterval(drag.scroller);
  drag = null;
}

document.addEventListener('pointerdown', e => {
  const handle = e.target.closest?.('.drag-handle');
  if (!handle || e.button) return;
  e.preventDefault();
  handle.setPointerCapture(e.pointerId);
  const box = $('#planScroll');
  drag = { id: handle.dataset.drag, row: handle.closest('.block'), box, y: e.clientY, startY: e.clientY, startScroll: box.scrollTop, x: e.clientX, target: null, scroller: null };
  drag.row.classList.add('dragging');
  // keep scrolling while the pointer rests near the top or bottom edge of the plan
  drag.scroller = setInterval(() => {
    const r = box.getBoundingClientRect();
    if (drag.y < r.top + 40) box.scrollTop -= 12;
    else if (drag.y > r.bottom - 40) box.scrollTop += 12;
    else return;
    followPointer();
  }, 30);
});

function followPointer() {
  drag.row.style.transform = `translateY(${drag.y - drag.startY + drag.box.scrollTop - drag.startScroll}px)`;
  const over = document.elementFromPoint(drag.x, drag.y)?.closest('.block'); // the dragged row ignores the pointer
  const target = over && over !== drag.row ? over : null;
  if (target === drag.target) return;
  drag.target?.classList.remove('drop-ok', 'drop-bad');
  drag.target = target;
  if (target) target.classList.add(moveBlock(ui.date, drag.id, target.dataset.id, true) ? 'drop-bad' : 'drop-ok');
}

document.addEventListener('pointermove', e => {
  if (!drag) return;
  drag.y = e.clientY;
  drag.x = e.clientX;
  followPointer();
});

document.addEventListener('pointerup', () => {
  if (!drag) return;
  const { id, target } = drag;
  endDrag();
  if (!target) return;
  const error = moveWithUndo(id, target.dataset.id);
  if (error) toast(error, 4000);
});
document.addEventListener('pointercancel', endDrag);

// arrow keys: move to the nearest slot above or below that actually works
document.addEventListener('keydown', e => {
  const handle = e.target.closest?.('.drag-handle');
  if (!handle || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
  e.preventDefault();
  const id = handle.dataset.drag;
  const rows = $$('.timeline .block[data-start]');
  const here = rows.findIndex(r => r.dataset.id === id);
  const step = e.key === 'ArrowUp' ? -1 : 1;
  for (let i = here + step; rows[i]; i += step) {
    if (moveBlock(ui.date, id, rows[i].dataset.id, true)) continue;
    moveWithUndo(id, rows[i].dataset.id);
    $(`[data-drag="${id}"]`)?.focus();
    return;
  }
  toast(`Nowhere to move it ${step < 0 ? 'up' : 'down'} to`);
});
