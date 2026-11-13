import * as THREE from 'three';
import type { CameraController } from '../camera/cameraController';
import type { Direction, SeatRef, Stadium } from '../data/loadData';
import type { AppStore } from './store';

export interface Actions {
  overview(): void;
  focusSection(section: number): void;
  /** Select a seat and fly into its first-person view. */
  viewSeat(ref: SeatRef): void;
  /** Step to the adjacent seat (as seen facing the pitch). Returns false if there is none. */
  moveSeat(dir: Direction): boolean;
  setFov(fov: number): void;
  look(dYawDeg: number, dPitchDeg: number): void;
  recentre(): void;
  /** Seats rejected here are skipped by moveSeat (e.g. sold or filtered out). */
  setSeatFilter(fn: (ref: SeatRef) => boolean): void;
}

/** Every user intent (3D click, dropdown, keyboard, buttons) goes through here so camera and state stay in step. */
export function createActions(store: AppStore, camera: CameraController, stadium: Stadium): Actions {
  let acceptSeat: (ref: SeatRef) => boolean = () => true;

  const actions: Actions = {
    overview() {
      store.set({ mode: 'orbit', focusedSection: null, hoveredSeat: null, hoveredSection: null });
      camera.goOverview();
    },

    focusSection(section) {
      const s = store.get();
      if (s.mode === 'section' && s.focusedSection === section) return;
      store.set({ mode: 'section', focusedSection: section, hoveredSeat: null });
      camera.goSection(section);
    },

    viewSeat(ref) {
      store.set({ mode: 'seat', focusedSection: ref.section, selectedSeat: ref, hoveredSeat: null, hoveredSection: null });
      camera.goSeat(ref);
    },

    moveSeat(dir) {
      const s = store.get();
      if (!s.selectedSeat || s.mode === 'orbit') return false;
      const next = stadium.neighbour(s.selectedSeat, dir, acceptSeat);
      if (!next) {
        const where = { left: 'to the left', right: 'to the right', back: 'behind', forward: 'in front' }[dir];
        store.set({ notice: { text: `No free seat ${where} within your filters`, at: performance.now() } });
        return false;
      }
      actions.viewSeat(next);
      return true;
    },

    setFov(fov) {
      store.set({ fov: THREE.MathUtils.clamp(Math.round(fov), 60, 100) });
    },

    look(dYawDeg, dPitchDeg) {
      camera.lookBy(THREE.MathUtils.degToRad(dYawDeg), THREE.MathUtils.degToRad(dPitchDeg));
    },

    recentre() {
      camera.resetLook();
    },

    setSeatFilter(fn) {
      acceptSeat = fn;
    },
  };
  return actions;
}
