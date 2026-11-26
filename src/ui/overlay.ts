import type { Stadium } from '../data/loadData';
import type { Actions } from '../state/actions';
import type { AppState, AppStore, Mode } from '../state/store';
import { escapeHtml, seatNumbers } from './labels';

const HINTS: Record<Mode, string> = {
  orbit: 'Click a section to zoom in',
  section: 'Click a seat to see its view',
  seat: 'Drag to look around · arrow keys change seat',
};

/** Controls drawn over the 3D view: back button, seat-view toolbar and a context hint. */
export function mountOverlay(root: HTMLElement, stadium: Stadium, store: AppStore, actions: Actions): void {
  root.innerHTML = `
    <div class="overlay-top">
      <button type="button" class="btn btn-overlay" id="btn-back" hidden>
        <span aria-hidden="true">←</span> Back to overview <kbd>Esc</kbd>
      </button>
      <p class="seat-chip" id="seat-chip" hidden></p>
    </div>
    <div class="overlay-bottom">
      <p class="hint" id="hint" aria-live="polite"></p>
      <div class="seat-toolbar" id="seat-toolbar" role="toolbar" aria-label="Seat view controls" hidden>
        <div class="seat-steps" role="group" aria-label="Move to adjacent seat">
          <button type="button" class="btn btn-overlay btn-icon" data-move="left" aria-label="Seat to the left (Left arrow)" title="Seat to the left (←)">◀</button>
          <button type="button" class="btn btn-overlay btn-icon" data-move="back" aria-label="Row behind (Up arrow)" title="Row behind (↑)">▲</button>
          <button type="button" class="btn btn-overlay btn-icon" data-move="forward" aria-label="Row in front (Down arrow)" title="Row in front (↓)">▼</button>
          <button type="button" class="btn btn-overlay btn-icon" data-move="right" aria-label="Seat to the right (Right arrow)" title="Seat to the right (→)">▶</button>
        </div>
        <div class="fov-control">
          <label for="fov">Field of view</label>
          <input id="fov" type="range" min="60" max="100" step="1" aria-describedby="fov-out" />
          <output id="fov-out" for="fov"></output>
        </div>
        <button type="button" class="btn btn-overlay" id="btn-aim" aria-pressed="false" title="Look at the centre spot instead of the nearest part of the pitch (C)">Centre spot</button>
        <button type="button" class="btn btn-overlay" id="btn-recentre" title="Look back at the pitch (R)">Recentre</button>
      </div>
    </div>`;

  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const back = q<HTMLButtonElement>('#btn-back');
  const hint = q<HTMLElement>('#hint');
  const chip = q<HTMLElement>('#seat-chip');
  const toolbar = q<HTMLElement>('#seat-toolbar');
  const fov = q<HTMLInputElement>('#fov');
  const fovOut = q<HTMLOutputElement>('#fov-out');
  const aim = q<HTMLButtonElement>('#btn-aim');

  back.addEventListener('click', () => actions.overview());
  q('#btn-recentre').addEventListener('click', () => actions.recentre());
  aim.addEventListener('click', () => actions.toggleAim());
  fov.addEventListener('input', () => actions.setFov(Number(fov.value)));
  toolbar.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((b) =>
    b.addEventListener('click', () => actions.moveSeat(b.dataset.move as 'left')),
  );

  let noticeTimer = 0;
  store.subscribe((s, p) => {
    if (!s.notice || s.notice === p.notice) return;
    hint.textContent = s.notice.text;
    hint.classList.add('hint-notice');
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => {
      hint.classList.remove('hint-notice');
      hint.textContent = HINTS[store.get().mode];
    }, 2200);
  });

  const render = (s: AppState, prev?: AppState) => {
    if (s.mode !== prev?.mode) {
      const focusInside = root.contains(document.activeElement);
      back.hidden = s.mode === 'orbit';
      toolbar.hidden = s.mode !== 'seat';
      // Hiding the focused button (e.g. Back, pressed with Enter) would drop keyboard focus to <body>.
      if (focusInside && (document.activeElement as HTMLElement | null)?.offsetParent === null) {
        document.getElementById('pick-section')?.focus({ preventScroll: true });
      }
      hint.textContent = HINTS[s.mode];
    }
    if (s.mode !== prev?.mode || s.selectedSeat !== prev?.selectedSeat) {
      chip.hidden = s.mode !== 'seat' || !s.selectedSeat;
      if (s.selectedSeat) {
        const n = seatNumbers(stadium, s.selectedSeat);
        chip.innerHTML = `Section <b>${escapeHtml(n.section)}</b> · Row <b>${escapeHtml(n.row)}</b> · Seat <b>${n.seat}</b>`;
        if (s.mode === 'seat') hint.textContent = HINTS.seat;
      }
    }
    if (s.fov !== prev?.fov) {
      fov.value = String(s.fov);
      fovOut.textContent = `${s.fov}°`;
    }
    if (s.aim !== prev?.aim) aim.setAttribute('aria-pressed', String(s.aim === 'centre'));
  };
  store.subscribe(render);
  render(store.get());
}
