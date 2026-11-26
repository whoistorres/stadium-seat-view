import type { Direction } from '../data/loadData';
import type { Actions } from '../state/actions';
import type { AppStore } from '../state/store';

const MOVES: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'back', // up the stand = the row behind
  ArrowDown: 'forward',
};

const LOOK_STEP = 8;

/**
 * Esc: back to overview. Arrows: adjacent seat. W/A/S/D: look around. R: recentre.
 * C: look at the centre spot / the nearest part of the pitch.
 * +/-: field of view.
 */
export function attachKeyboard(store: AppStore, actions: Actions): void {
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const s = store.get();

    // Esc works everywhere, including from the dropdowns where keyboard users end up after
    // picking a seat. An open <select> consumes Esc itself, so this never fights with closing it.
    if (e.key === 'Escape') {
      if (s.mode !== 'orbit') {
        e.preventDefault();
        actions.overview();
      }
      return;
    }

    // Other keys belong to the focused form control (arrows change values, letters jump options).
    if (e.target instanceof Element && e.target.closest('select, input, textarea, [contenteditable="true"]')) return;

    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    let handled = true;

    if (key in MOVES && s.selectedSeat && s.mode !== 'orbit') actions.moveSeat(MOVES[key]);
    else if (s.mode !== 'seat') handled = false;
    else if (key === 'a') actions.look(LOOK_STEP, 0);
    else if (key === 'd') actions.look(-LOOK_STEP, 0);
    else if (key === 'w') actions.look(0, LOOK_STEP);
    else if (key === 's') actions.look(0, -LOOK_STEP);
    else if (key === 'r') actions.recentre();
    else if (key === 'c') actions.toggleAim();
    else if (key === '+' || key === '=') actions.setFov(s.fov + 5);
    else if (key === '-' || key === '_') actions.setFov(s.fov - 5);
    else handled = false;

    if (handled) e.preventDefault();
  });
}
