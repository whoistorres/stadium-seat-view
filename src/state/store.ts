import type { SeatRef } from '../data/loadData';
import type { TicketFilters } from '../data/tickets';

export type Mode = 'orbit' | 'section' | 'seat';
export type Quality = 'low' | 'high';
export type TimeOfDay = 'day' | 'evening';

export interface AppState {
  mode: Mode;
  /** Section index the camera is zoomed on (section and seat modes). */
  focusedSection: number | null;
  hoveredSection: number | null;
  hoveredSeat: SeatRef | null;
  /** Seat currently being previewed. */
  selectedSeat: SeatRef | null;
  /** Seat the user confirmed with "Select seat". */
  chosenSeat: SeatRef | null;
  filters: TicketFilters;
  showLabels: boolean;
  /** Short transient message for the overlay (e.g. "No free seat that way"). */
  notice: { text: string; at: number } | null;
  quality: Quality;
  timeOfDay: TimeOfDay;
  fov: number;
}

export type Listener<T> = (state: T, prev: T) => void;

export interface Store<T> {
  get(): T;
  set(patch: Partial<T>): void;
  subscribe(listener: Listener<T>): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener<T>>();
  return {
    get: () => state,
    set(patch) {
      const keys = Object.keys(patch) as Array<keyof T>;
      if (keys.every((k) => Object.is(state[k], patch[k]))) return;
      const prev = state;
      state = { ...state, ...patch };
      listeners.forEach((l) => l(state, prev));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const sameSeat = (a: SeatRef | null, b: SeatRef | null) =>
  a === b || (!!a && !!b && a.section === b.section && a.row === b.row && a.seat === b.seat);

export const initialState: AppState = {
  mode: 'orbit',
  focusedSection: null,
  hoveredSection: null,
  hoveredSeat: null,
  selectedSeat: null,
  chosenSeat: null,
  filters: { categories: { A: true, B: true, C: true, D: true }, minPrice: 0, maxPrice: Infinity },
  showLabels: true,
  notice: null,
  quality: 'high',
  timeOfDay: 'day',
  fov: 70,
};

export type AppStore = Store<AppState>;
