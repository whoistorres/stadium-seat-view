import * as THREE from 'three';
import type { CameraController } from '../camera/cameraController';
import type { SeatRef, Stadium } from '../data/loadData';
import type { Tickets } from '../data/tickets';
import type { Actions } from '../state/actions';
import { sameSeat, type AppStore } from '../state/store';
import { escapeHtml, sectionArea, seatNumbers } from '../ui/labels';
import type { Tooltip } from '../ui/tooltip';
import type { Picker } from './picking';

const CLICK_SLOP_PX = 6;
const CLICK_MAX_MS = 700;

/** Hover, tooltip and click-to-select on the canvas. Hover picking runs at most once per frame. */
export class PointerInput {
  private pending: { x: number; y: number } | null = null;
  private down: { id: number; x: number; y: number; t: number } | null = null;
  private readonly ndcVec = new THREE.Vector2();

  constructor(
    private readonly dom: HTMLElement,
    private readonly stadium: Stadium,
    private readonly store: AppStore,
    private readonly tickets: Tickets,
    private readonly picker: Picker,
    private readonly camera: CameraController,
    private readonly actions: Actions,
    private readonly tooltip: Tooltip,
  ) {
    dom.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' && e.buttons === 0) this.pending = { x: e.clientX, y: e.clientY };
      else if (this.down) this.clearHover();
    });
    dom.addEventListener('pointerleave', () => {
      this.pending = null;
      this.clearHover();
    });
    dom.addEventListener('pointerdown', (e) => {
      if (e.isPrimary) this.down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    });
    dom.addEventListener('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      if (!d || d.id !== e.pointerId || e.button > 0) return;
      const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      if (moved <= CLICK_SLOP_PX && performance.now() - d.t <= CLICK_MAX_MS) this.click(e.clientX, e.clientY);
    });
  }

  /** Call once per frame. */
  update(): void {
    if (!this.pending) return;
    const { x, y } = this.pending;
    this.pending = null;
    this.hover(x, y);
  }

  private ndc(x: number, y: number): THREE.Vector2 {
    const r = this.dom.getBoundingClientRect();
    return this.ndcVec.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  }

  private clearHover(): void {
    this.tooltip.hide();
    this.dom.style.cursor = '';
    this.store.set({ hoveredSection: null, hoveredSeat: null });
  }

  private hover(x: number, y: number): void {
    const s = this.store.get();
    if (this.camera.busy) return this.clearHover();
    const hit = this.picker.section(this.ndc(x, y));
    if (!hit) return this.clearHover();

    const found = s.mode !== 'orbit' ? this.picker.seat(hit) : null;
    const seat = sameSeat(found, s.hoveredSeat) ? s.hoveredSeat : found;
    this.store.set({ hoveredSection: hit.section, hoveredSeat: seat });
    this.dom.style.cursor = 'pointer';
    this.tooltip.show(seat ? this.seatTip(seat) : this.sectionTip(hit.section, s.mode === 'orbit'), x, y);
  }

  private categoryLine(si: number): string {
    const c = this.tickets.category(si);
    return (
      `<span class="tip-cat"><span class="swatch swatch-sm pat-${c.pattern}" style="--c:${c.color}" aria-hidden="true">${c.id}</span>` +
      `${c.id} · ${escapeHtml(c.label)} · <b>${this.tickets.format(c.price)}</b></span>`
    );
  }

  private sectionTip(si: number, orbit: boolean): string {
    const sec = this.stadium.sections[si];
    const seats = this.stadium.meta[si].seatCount;
    const free = this.tickets.available(si);
    const inFilters = this.tickets.sectionMatches(si, this.store.get().filters);
    return (
      `<strong>Section ${escapeHtml(sec.id)}</strong>` +
      `${escapeHtml(sectionArea(this.stadium, sec))}` +
      this.categoryLine(si) +
      `${free.toLocaleString('en')} of ${seats} seats free` +
      (inFilters ? '' : ' · <em>outside your filters</em>') +
      `<span class="muted">${orbit ? 'Click to zoom in' : 'Click to move here'}</span>`
    );
  }

  /** Why a seat can't be picked, or null if it can. */
  private blocked(ref: SeatRef): string | null {
    if (this.tickets.isSold(ref)) return 'Sold, not selectable';
    if (!this.tickets.sectionMatches(ref.section, this.store.get().filters)) return 'Outside your price filters';
    return null;
  }

  private seatTip(ref: SeatRef): string {
    const n = seatNumbers(this.stadium, ref);
    const reason = this.blocked(ref);
    const verb = this.store.get().mode === 'seat' ? 'Click to move to this seat' : 'Click to view from this seat';
    return (
      `<strong>Section ${escapeHtml(n.section)} · Row ${escapeHtml(n.row)} · Seat ${n.seat}</strong>` +
      this.categoryLine(ref.section) +
      `<span class="${this.tickets.isSold(ref) ? 'status-sold' : 'status-free'}">${this.tickets.isSold(ref) ? '✕ Sold' : '✓ Available'}</span>` +
      `<span class="muted">${escapeHtml(reason ?? verb)}</span>`
    );
  }

  private click(x: number, y: number): void {
    const s = this.store.get();
    const hit = this.picker.section(this.ndc(x, y));
    if (!hit) return;
    this.tooltip.hide();
    if (s.mode === 'orbit') {
      this.actions.focusSection(hit.section);
      return;
    }
    // In section view a click flies into the seat; in seat view it jumps to the clicked seat.
    const seat = this.picker.seat(hit);
    if (seat && this.blocked(seat)) {
      // Explain on touch too, where there is no hover tooltip.
      this.tooltip.show(this.seatTip(seat), x, y);
      window.clearTimeout(this.tipTimer);
      this.tipTimer = window.setTimeout(() => this.tooltip.hide(), 1800);
      return;
    }
    if (seat && !sameSeat(seat, s.selectedSeat)) this.actions.viewSeat(seat);
    else if (!seat && s.mode === 'section') this.actions.focusSection(hit.section);
  }

  private tipTimer = 0;
}
