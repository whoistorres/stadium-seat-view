import './ui/styles.css';
import * as THREE from 'three';
import { CameraController } from './camera/cameraController';
import { loadStadium, type Stadium } from './data/loadData';
import { parseSeatId } from './data/seatId';
import { loadTickets, type Tickets } from './data/tickets';
import { attachKeyboard } from './interaction/keyboard';
import { Picker } from './interaction/picking';
import { PointerInput } from './interaction/pointer';
import { Crowd } from './scene/crowd';
import { SectionLabels } from './scene/labels';
import { Lighting } from './scene/lighting';
import { buildPitch } from './scene/pitch';
import { AdaptiveResolution, applyQuality, defaultQuality } from './scene/quality';
import { buildRoof } from './scene/roof';
import { createScene } from './scene/sceneSetup';
import { SeatLayer } from './scene/seats';
import { buildShell, buildSteps } from './scene/stands';
import { TicketColors } from './scene/ticketColors';
import { createActions, type Actions } from './state/actions';
import { createStore, initialState, sameSeat, type AppState, type AppStore } from './state/store';
import { FpsMeter, mountHudControls } from './ui/hud';
import { mountOverlay } from './ui/overlay';
import { mountPanel } from './ui/panel';
import { Tooltip } from './ui/tooltip';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Update the loading text and let the browser paint it before the next blocking step. */
async function step(text: string): Promise<void> {
  el('loading-text').textContent = text;
  // rAF never fires in a background tab, so don't let it stall the boot there.
  await new Promise((r) => {
    requestAnimationFrame(() => setTimeout(r, 0));
    setTimeout(r, 60);
  });
}

/** Repaint only the sections whose highlight state changed. */
function connectSeatPaint(store: AppStore, seats: SeatLayer): void {
  const touched = (s: AppState) =>
    [s.hoveredSection, s.hoveredSeat?.section, s.selectedSeat?.section, s.chosenSeat?.section].filter(
      (v): v is number => v != null,
    );
  store.subscribe((s, p) => {
    if (s.focusedSection !== p.focusedSection || s.mode !== p.mode || s.filters !== p.filters) return seats.invalidate();
    const changed =
      s.hoveredSection !== p.hoveredSection ||
      s.hoveredSeat !== p.hoveredSeat ||
      s.selectedSeat !== p.selectedSeat ||
      s.chosenSeat !== p.chosenSeat;
    if (changed) seats.paint(s, new Set([...touched(s), ...touched(p)]));
  });
  seats.invalidate();
}

/** Ticket colours, label fading and arrow-key skipping all follow the current filters. */
function connectTickets(
  store: AppStore,
  stadium: Stadium,
  tickets: Tickets,
  seats: SeatLayer,
  labels: SectionLabels,
  actions: Actions,
): void {
  const colors = new TicketColors(stadium, tickets);
  const apply = (s: AppState) => {
    colors.update(s.filters);
    colors.matches.forEach((m, si) => labels.setDimmed(si, !m || tickets.available(si) === 0));
  };
  apply(store.get());
  seats.setBaseColor(colors.colorFn);
  actions.setSeatFilter((ref) => tickets.selectable(ref, store.get().filters));
  store.subscribe((s, p) => {
    if (s.filters !== p.filters) apply(s);
  });
}

/** Keeps the selected seat ID in the URL hash so a view can be reloaded or shared. */
function connectHash(store: AppStore, stadium: Stadium): string | null {
  store.subscribe((s, p) => {
    if (s.selectedSeat === p.selectedSeat) return;
    const url = s.selectedSeat ? `#${stadium.id(s.selectedSeat)}` : location.pathname + location.search;
    history.replaceState(null, '', url);
  });
  return decodeURIComponent(location.hash.slice(1)) || null;
}

async function boot(): Promise<void> {
  await step('Loading seat map…');
  const stadium = await loadStadium();
  const tickets = await loadTickets(stadium);

  await step('Building the stands…');
  const ctx = createScene(el('viewport'));
  const lighting = new Lighting(ctx.scene, ctx.renderer, stadium.data.shell);
  const pitch = buildPitch(stadium.data, ctx.renderer.capabilities.getMaxAnisotropy());
  ctx.scene.add(pitch, buildSteps(stadium.data));
  const shell = stadium.data.shell ? buildShell(stadium.data.shell) : null;
  const roof = stadium.data.shell ? buildRoof(stadium.data.shell) : null;
  if (shell) ctx.scene.add(shell);
  if (roof) ctx.scene.add(roof.group);

  const boards: THREE.MeshStandardMaterial[] = [];
  pitch.getObjectByName('ad-boards')?.traverse((o) => {
    if (o instanceof THREE.Mesh) boards.push(o.material as THREE.MeshStandardMaterial);
  });
  const exterior = ['roof-slab', 'facade']
    .map((name) => ctx.scene.getObjectByName(name))
    .filter((o): o is THREE.Mesh => o instanceof THREE.Mesh)
    .map((o) => o.material as THREE.MeshStandardMaterial);
  lighting.attach(roof?.fixtures ?? null, boards, exterior);

  await step(`Placing ${stadium.totalSeats.toLocaleString('en')} seats and the crowd…`);
  const seats = new SeatLayer(stadium);
  const crowd = new Crowd(stadium, tickets);
  const labels = new SectionLabels(stadium, tickets);
  ctx.scene.add(seats.group, crowd.group, seats.marker, labels.group);

  const store = createStore<AppState>({
    ...initialState,
    quality: defaultQuality(),
    filters: { ...initialState.filters, minPrice: tickets.minPrice, maxPrice: tickets.maxPrice },
  });
  const cameraController = new CameraController(ctx.camera, ctx.renderer.domElement, stadium);
  const actions = createActions(store, cameraController, stadium);
  const occluders = [shell, roof?.group].filter((o): o is THREE.Group => !!o);
  const picker = new Picker(stadium, seats, ctx.camera, occluders);
  const tooltip = new Tooltip(el('tooltip'), ctx.container.parentElement!);
  const pointer = new PointerInput(ctx.renderer.domElement, stadium, store, tickets, picker, cameraController, actions, tooltip);

  connectSeatPaint(store, seats);
  connectTickets(store, stadium, tickets, seats, labels, actions);

  lighting.setTime(store.get().timeOfDay);
  const resolution = new AdaptiveResolution(ctx.renderer);
  applyQuality(store.get().quality, resolution, lighting, crowd);
  store.subscribe((s, p) => {
    if (s.timeOfDay !== p.timeOfDay) lighting.setTime(s.timeOfDay);
    if (s.quality !== p.quality) applyQuality(s.quality, resolution, lighting, crowd);
    if (s.fov !== p.fov) cameraController.setSeatFov(s.fov);
  });
  cameraController.setSeatFov(store.get().fov);
  cameraController.onFovWheel = (fov) => actions.setFov(fov);

  mountPanel(el('panel'), stadium, tickets, store, actions);
  mountOverlay(el('stage-overlay'), stadium, store, actions);
  attachKeyboard(store, actions);

  const fps = new FpsMeter();
  const seatCount = document.createElement('span');
  seatCount.className = 'muted seat-count';
  seatCount.textContent = `${stadium.totalSeats.toLocaleString('en')} seats`;
  mountHudControls(el('hud'), store);
  el('hud').append(seatCount, fps.el);

  const openFromHash = (id: string | null) => {
    const parsed = id ? parseSeatId(id) : null;
    const ref = parsed ? stadium.refFromNumbers(parsed.section, parsed.row, parsed.seat) : null;
    if (ref && !sameSeat(ref, store.get().selectedSeat)) actions.viewSeat(ref);
  };
  openFromHash(connectHash(store, stadium));
  // replaceState never fires this, so it only reacts to links pasted or followed in the same tab.
  window.addEventListener('hashchange', () => openFromHash(decodeURIComponent(location.hash.slice(1)) || null));

  const clock = new THREE.Clock();
  let last = performance.now();
  ctx.renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    cameraController.update(dt);
    pointer.update();
    seats.updateLod(ctx.camera);
    crowd.updateLod(ctx.camera);
    lighting.update(ctx.camera);
    const s = store.get();
    seats.flush(s);
    crowd.hideSeat(s.mode === 'seat' ? s.selectedSeat : null);
    seats.updateMarker(s.selectedSeat, s.mode !== 'seat', ctx.camera, clock.getElapsedTime());
    labels.group.visible = s.showLabels && s.mode !== 'seat';
    if (labels.group.visible) labels.update(ctx.camera);
    ctx.renderer.render(ctx.scene, ctx.camera);
    fps.sample(now);
    resolution.update(fps.value, now);
    fps.note = resolution.scale < 0.99 ? `${Math.round(resolution.scale * 100)}% res` : '';
  });

  if (import.meta.env.DEV) {
    /** Jump straight into a seat view without animating, for repeatable screenshots. */
    const goToSeat = (id: string) => {
      const p = parseSeatId(id);
      const r = p && stadium.refFromNumbers(p.section, p.row, p.seat);
      if (!r) return false;
      store.set({ mode: 'seat', focusedSection: r.section, selectedSeat: r });
      cameraController.snapToSeat(r);
      return true;
    };
    /**
     * Real on-screen frame rate over `seconds` at the current view and quality. Keep the tab
     * visible and in front: hidden tabs are throttled by the browser.
     */
    const benchmark = (seconds = 5) =>
      new Promise<{ avgFps: number; worstFrameMs: number; frames: number; quality: string }>((resolve) => {
        const times: number[] = [];
        const start = performance.now();
        const tick = (now: number) => {
          times.push(now);
          if (now - start < seconds * 1000) requestAnimationFrame(tick);
          else {
            const gaps = times.slice(1).map((t, i) => t - times[i]);
            resolve({
              avgFps: Math.round((gaps.length * 1000) / (times[times.length - 1] - times[0])),
              worstFrameMs: Math.round(Math.max(...gaps)),
              frames: gaps.length,
              quality: store.get().quality,
            });
          }
        };
        requestAnimationFrame(tick);
      });
    Object.assign(window, {
      __stadium: { stadium, tickets, ctx, cameraController, fps, store, actions, seats, crowd, lighting, picker, resolution, goToSeat, benchmark },
    });
  }
}

boot()
  .then(() => el('loading').classList.add('is-done'))
  .catch((err: unknown) => {
    console.error(err);
    el('loading').classList.add('is-error');
    el('loading-text').textContent = `Could not start: ${err instanceof Error ? err.message : String(err)}`;
  });
