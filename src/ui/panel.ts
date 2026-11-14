import type { SeatRef, Stadium } from '../data/loadData';
import type { Tickets } from '../data/tickets';
import type { TierId } from '../data/types';
import type { Actions } from '../state/actions';
import { sameSeat, type AppState, type AppStore } from '../state/store';
import { mountLegend } from './legend';
import { escapeHtml, sectionArea, seatNumbers, standLabel, tierLabel } from './labels';

const option = (value: string, label: string, disabled = false) => {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  o.disabled = disabled;
  return o;
};

/** Dropdown seat finder, selected seat card, chosen seat and price legend. Mirrors 3D selection both ways. */
export function mountPanel(root: HTMLElement, stadium: Stadium, tickets: Tickets, store: AppStore, actions: Actions): void {
  root.innerHTML = `
    <button type="button" class="sheet-toggle" id="sheet-toggle" aria-expanded="true" aria-controls="panel-body">
      <span id="sheet-summary">Seats &amp; prices</span><span class="sheet-chevron" aria-hidden="true">▾</span>
    </button>
    <div class="panel-body" id="panel-body">
    <section class="card" aria-labelledby="find-h">
      <h2 id="find-h">Find a seat</h2>
      <div class="field">
        <label for="pick-section">Section</label>
        <select id="pick-section"></select>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="pick-row">Row</label>
          <select id="pick-row" disabled></select>
        </div>
        <div class="field">
          <label for="pick-seat">Seat</label>
          <select id="pick-seat" disabled></select>
        </div>
      </div>
    </section>

    <section class="card" aria-labelledby="seat-h">
      <h2 id="seat-h">Previewing</h2>
      <div id="seat-card" aria-live="polite"></div>
    </section>

    <section class="card card-chosen" id="chosen" aria-labelledby="chosen-h" hidden>
      <h2 id="chosen-h">Your seat</h2>
      <div id="chosen-body"></div>
    </section>

    <section class="card" id="legend" aria-labelledby="price-h"></section>

    <section class="card" aria-labelledby="venue-h">
      <h2 id="venue-h">${escapeHtml(stadium.data.name)}</h2>
      <dl>
        <div class="stat-row"><dt>Sections</dt><dd>${stadium.sections.length}</dd></div>
        <div class="stat-row"><dt>Seats</dt><dd>${stadium.totalSeats.toLocaleString('en')}</dd></div>
        <div class="stat-row"><dt>Pitch</dt><dd>${stadium.data.pitch.length} × ${stadium.data.pitch.width} m</dd></div>
      </dl>
    </section>

    <details class="card help">
      <summary>Controls</summary>
      <ul>
        <li><b>Rotate:</b> drag · <b>Zoom:</b> scroll or pinch · <b>Pan:</b> right-drag or two-finger drag</li>
        <li>Click a section to zoom in, then click a seat to see its view.</li>
        <li><kbd>Esc</kbd> back to overview</li>
        <li><kbd>←</kbd> <kbd>→</kbd> next free seat · <kbd>↑</kbd> <kbd>↓</kbd> row behind / in front</li>
        <li>Seat view: drag or <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to look, <kbd>R</kbd> recentre, scroll or <kbd>+</kbd>/<kbd>−</kbd> for field of view</li>
      </ul>
    </details>
    </div>`;

  // Mobile bottom sheet: collapse to give the 3D view the screen.
  const toggle = root.querySelector<HTMLButtonElement>('#sheet-toggle')!;
  const summary = root.querySelector<HTMLElement>('#sheet-summary')!;
  const setOpen = (open: boolean) => {
    toggle.setAttribute('aria-expanded', String(open));
    root.classList.toggle('is-collapsed', !open);
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  store.subscribe((s, p) => {
    if (s.selectedSeat !== p.selectedSeat || s.mode !== p.mode) {
      const ref = s.selectedSeat;
      summary.textContent = ref
        ? `Sec ${seatNumbers(stadium, ref).section} · Row ${seatNumbers(stadium, ref).row} · Seat ${seatNumbers(stadium, ref).seat} · ${tickets.format(tickets.price(ref))}${tickets.isSold(ref) ? ' · sold' : ''}`
        : 'Seats & prices';
    }
    // Entering a seat view on a phone: get the sheet out of the way.
    if (s.mode === 'seat' && p.mode !== 'seat' && matchMedia('(max-width: 820px)').matches) setOpen(false);
  });

  mountLegend(root.querySelector<HTMLElement>('#legend')!, tickets, store);

  const secSel = root.querySelector<HTMLSelectElement>('#pick-section')!;
  const rowSel = root.querySelector<HTMLSelectElement>('#pick-row')!;
  const seatSel = root.querySelector<HTMLSelectElement>('#pick-seat')!;
  const card = root.querySelector<HTMLElement>('#seat-card')!;
  const chosen = root.querySelector<HTMLElement>('#chosen')!;
  const chosenBody = root.querySelector<HTMLElement>('#chosen-body')!;

  const filters = () => store.get().filters;

  const fillSections = () => {
    const keep = secSel.value;
    secSel.replaceChildren(option('', 'Overview (no section)'));
    // One group per tier, front tier first, whatever order the sections come in.
    const groups = new Map<TierId, HTMLOptGroupElement>();
    for (const tier of stadium.tierIds) {
      const g = document.createElement('optgroup');
      g.label = tierLabel(stadium, tier);
      groups.set(tier, g);
      secSel.append(g);
    }
    stadium.sections.forEach((s, i) => {
      const g = groups.get(s.tier)!;
      const c = tickets.category(i);
      const free = tickets.available(i);
      const note = free === 0 ? 'sold out' : tickets.sectionMatches(i, filters()) ? `${free} free` : 'outside filters';
      g.append(option(String(i), `${s.id} · ${c.id} ${tickets.format(c.price)} · ${standLabel(s, ' ')} (${note})`));
    });
    secSel.value = keep;
  };

  let rowsFor = -1;
  const fillRows = (si: number) => {
    rowsFor = si;
    const hadFocus = document.activeElement === rowSel || document.activeElement === seatSel;
    rowSel.replaceChildren(option('', 'Row…'));
    seatSel.replaceChildren(option('', 'Seat…'));
    seatSel.disabled = true;
    rowSel.disabled = si < 0;
    // Disabling the focused control would drop keyboard focus to <body>; keep the user in the panel.
    if (hadFocus && rowSel.disabled) secSel.focus({ preventScroll: true });
    if (si < 0) return;
    stadium.sections[si].rows.forEach((r, ri) => {
      const free = tickets.available(si, ri);
      rowSel.append(option(String(ri), `Row ${r.n} (${free} free)`));
    });
  };
  const fillSeats = (si: number, ri: number) => {
    const keep = seatSel.value;
    seatSel.replaceChildren(option('', 'Seat…'));
    seatSel.disabled = ri < 0;
    if (ri < 0) return;
    const f = filters();
    stadium.sections[si].rows[ri].seats.forEach((t, ki) => {
      const ref = { section: si, row: ri, seat: ki };
      const sold = tickets.isSold(ref);
      const ok = !sold && tickets.sectionMatches(si, f);
      seatSel.append(option(String(ki), `Seat ${t[0]}${sold ? ' · sold' : ok ? '' : ' · filtered'}`, !ok));
    });
    seatSel.value = keep;
  };

  secSel.addEventListener('change', () => {
    if (secSel.value === '') actions.overview();
    else actions.focusSection(Number(secSel.value));
  });
  rowSel.addEventListener('change', () => fillSeats(rowsFor, rowSel.value === '' ? -1 : Number(rowSel.value)));
  seatSel.addEventListener('change', () => {
    if (seatSel.value === '' || rowSel.value === '') return;
    actions.viewSeat({ section: rowsFor, row: Number(rowSel.value), seat: Number(seatSel.value) });
  });

  root.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-action]');
    if (!btn) return;
    const s = store.get();
    switch (btn.dataset.action) {
      case 'view':
        if (s.selectedSeat) actions.viewSeat(s.selectedSeat);
        break;
      case 'view-chosen':
        if (s.chosenSeat) actions.viewSeat(s.chosenSeat);
        break;
      case 'choose':
        if (s.selectedSeat && !tickets.isSold(s.selectedSeat)) store.set({ chosenSeat: s.selectedSeat });
        break;
      case 'clear-chosen':
        store.set({ chosenSeat: null });
        break;
    }
  });

  const seatFacts = (ref: SeatRef) => {
    const n = seatNumbers(stadium, ref);
    const sec = stadium.sections[ref.section];
    const c = tickets.category(ref.section);
    const sold = tickets.isSold(ref);
    return `
      <dl>
        <div class="stat-row"><dt>Section</dt><dd>${escapeHtml(n.section)}</dd></div>
        <div class="stat-row"><dt>Row</dt><dd>${n.row}</dd></div>
        <div class="stat-row"><dt>Seat</dt><dd>${n.seat}</dd></div>
        <div class="stat-row"><dt>Area</dt><dd>${escapeHtml(sectionArea(stadium, sec))}</dd></div>
        <div class="stat-row"><dt>Category</dt><dd><span class="swatch swatch-sm pat-${c.pattern}" style="--c:${c.color}" aria-hidden="true">${c.id}</span> ${c.id} · ${escapeHtml(c.label)}</dd></div>
        <div class="stat-row"><dt>Price</dt><dd class="price">${tickets.format(c.price)}</dd></div>
        <div class="stat-row"><dt>Status</dt><dd class="${sold ? 'status-sold' : 'status-free'}">${sold ? '✕ Sold' : '✓ Available'}</dd></div>
        <div class="stat-row"><dt>Seat ID</dt><dd><code>${escapeHtml(stadium.id(ref))}</code></dd></div>
      </dl>`;
  };

  const renderCard = (s: AppState) => {
    const ref = s.selectedSeat;
    if (!ref) {
      card.innerHTML = `<p class="muted">No seat yet. Click a section, then a seat, or use the menus above.</p>`;
      return;
    }
    const sold = tickets.isSold(ref);
    const isChosen = sameSeat(ref, s.chosenSeat);
    const view = s.mode === 'seat' ? '' : '<button type="button" class="btn" data-action="view">View from this seat</button>';
    const choose = sold
      ? '<button type="button" class="btn" disabled>Sold, not available</button>'
      : isChosen
        ? '<button type="button" class="btn btn-primary" disabled>✓ Selected</button>'
        : '<button type="button" class="btn btn-primary" data-action="choose">Select seat</button>';
    card.innerHTML = `${seatFacts(ref)}<div class="card-actions">${view}${choose}</div>`;
  };

  const renderChosen = (s: AppState) => {
    const ref = s.chosenSeat;
    chosen.hidden = !ref;
    if (!ref) return;
    const n = seatNumbers(stadium, ref);
    chosenBody.innerHTML = `
      <p class="chosen-line">Section <b>${escapeHtml(n.section)}</b> · Row <b>${n.row}</b> · Seat <b>${n.seat}</b>
        <span class="price">${tickets.format(tickets.price(ref))}</span></p>
      <p class="muted"><code>${escapeHtml(stadium.id(ref))}</code> is held in this session. No payment is taken in this preview.</p>
      <div class="card-actions">
        <button type="button" class="btn" data-action="view-chosen">View</button>
        <button type="button" class="btn" data-action="clear-chosen">Remove</button>
      </div>`;
  };

  const sync = (s: AppState, prev?: AppState) => {
    if (!prev || s.filters !== prev.filters) {
      fillSections();
      if (rowsFor >= 0 && rowSel.value !== '') fillSeats(rowsFor, Number(rowSel.value));
    }
    const si = s.focusedSection ?? -1;
    secSel.value = si < 0 ? '' : String(si);
    if (si !== rowsFor) fillRows(si);
    if (s.selectedSeat !== prev?.selectedSeat || s.focusedSection !== prev?.focusedSection) {
      const ref = s.selectedSeat;
      if (ref && ref.section === rowsFor) {
        rowSel.value = String(ref.row);
        fillSeats(ref.section, ref.row);
        seatSel.value = String(ref.seat);
      }
    }
    if (s.selectedSeat !== prev?.selectedSeat || s.mode !== prev?.mode || s.chosenSeat !== prev?.chosenSeat) renderCard(s);
    if (s.chosenSeat !== prev?.chosenSeat) renderChosen(s);
  };
  store.subscribe((s, p) => {
    if (
      s.focusedSection !== p.focusedSection ||
      s.selectedSeat !== p.selectedSeat ||
      s.mode !== p.mode ||
      s.chosenSeat !== p.chosenSeat ||
      s.filters !== p.filters
    ) {
      sync(s, p);
    }
  });
  sync(store.get());
}
