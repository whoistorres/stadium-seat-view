import * as THREE from 'three';
import type { SeatRef, Stadium } from '../data/loadData';
import { QuadBuilder, type V3 } from './geo';

/** Writes the resting colour of a seat into `out`. The ref object is reused; do not keep it. */
export type BaseColorFn = (ref: SeatRef, out: THREE.Color) => void;

export interface SeatPaintState {
  mode: 'orbit' | 'section' | 'seat';
  focusedSection: number | null;
  hoveredSection: number | null;
  hoveredSeat: SeatRef | null;
  selectedSeat: SeatRef | null;
  chosenSeat: SeatRef | null;
}

const ZONE_BASE = {
  sideline: new THREE.Color('#2f66b3'),
  end: new THREE.Color('#b04a3f'),
  corner: new THREE.Color('#c99a2e'),
};
const WHITE = new THREE.Color('#ffffff');
const DIM = new THREE.Color('#252a31');
export const SELECTED_COLOR = new THREE.Color('#ff2bd6');
// Violet: stays clear of the four price-category colours.
const CHOSEN_COLOR = new THREE.Color('#b388ff');

/**
 * Seat pan + backrest, local +Z facing the pitch, origin at tread level. Only the faces a
 * spectator can actually see: 10 triangles (detailed) or 4 (far LOD) instead of 24 for two boxes.
 */
function chairGeometry(detailed: boolean): THREE.BufferGeometry {
  const w = 0.22;
  const qb = new QuadBuilder();
  const backTilt = 0.06;
  // Pan top and front lip.
  qb.quad([-w, 0.46, -0.17], [w, 0.46, -0.17], [w, 0.46, 0.22], [-w, 0.46, 0.22], [0, 1, 0]);
  if (detailed) qb.quad([-w, 0.39, 0.22], [w, 0.39, 0.22], [w, 0.46, 0.22], [-w, 0.46, 0.22], [0, 0, 1]);
  // Backrest front, plus rear and top when detailed (seen from the row behind).
  const nFront: V3 = [0, Math.sin(backTilt * 4), Math.cos(backTilt * 4)];
  qb.quad([-w, 0.46, -0.17], [w, 0.46, -0.17], [w, 0.88, -0.17 - backTilt], [-w, 0.88, -0.17 - backTilt], nFront);
  if (detailed) {
    qb.quad([-w, 0.42, -0.22], [w, 0.42, -0.22], [w, 0.88, -0.22 - backTilt], [-w, 0.88, -0.22 - backTilt], [0, 0, -1]);
    qb.quad([-w, 0.88, -0.17 - backTilt], [w, 0.88, -0.17 - backTilt], [w, 0.88, -0.22 - backTilt], [-w, 0.88, -0.22 - backTilt], [0, 1, 0]);
  }
  const g = qb.build();
  g.deleteAttribute('color');
  return g;
}

/** Sections whose centre is further than this from the camera use the 4-triangle chair. */
const LOD_DISTANCE = 70;

function buildMarker(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'seat-marker';
  g.visible = false;
  const mat = new THREE.MeshBasicMaterial({ color: SELECTED_COLOR, depthTest: false, transparent: true, opacity: 0.95 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 16), mat);
  cone.rotation.x = Math.PI;
  cone.position.y = 0.4;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 24), mat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.95;
  for (const m of [cone, ring]) {
    m.renderOrder = 10;
    g.add(m);
  }
  return g;
}

/** One InstancedMesh per section: frustum culling per section, and cheap per-section picking/repaints. */
export class SeatLayer {
  readonly group = new THREE.Group();
  readonly meshes: THREE.InstancedMesh[] = [];
  readonly marker = buildMarker();
  private baseColor: BaseColorFn;
  private readonly color = new THREE.Color();
  private readonly ref: SeatRef = { section: 0, row: 0, seat: 0 };
  private readonly tmp = new THREE.Vector3();
  private readonly near = chairGeometry(true);
  private readonly far = chairGeometry(false);
  private readonly centres: THREE.Vector3[];

  constructor(private readonly stadium: Stadium) {
    this.group.name = 'seats';
    this.centres = stadium.meta.map((m) => new THREE.Vector3(...m.centre));
    const geometry = this.far;
    const material = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 });
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);

    stadium.sections.forEach((section, si) => {
      const mesh = new THREE.InstancedMesh(geometry, material, stadium.meta[si].seatCount);
      let i = 0;
      for (const row of section.rows) {
        for (const t of row.seats) {
          p.set(t[1], t[2], t[3]);
          q.setFromAxisAngle(up, t[4]);
          mesh.setMatrixAt(i++, m4.compose(p, q, one));
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.setColorAt(0, WHITE);
      mesh.computeBoundingSphere();
      mesh.receiveShadow = true;
      mesh.userData.section = si;
      mesh.name = `seats-${section.id}`;
      this.meshes.push(mesh);
      this.group.add(mesh);
    });

    this.baseColor = (ref, out) => {
      const s = stadium.sections[ref.section];
      out.copy(ZONE_BASE[s.zone]).offsetHSL(0, 0, Math.min(4, stadium.tierIndex(s.tier)) * 0.06);
    };
  }

  /** Per-frame: swap each section between detailed and far chairs by camera distance. */
  updateLod(camera: THREE.Camera): void {
    const p = camera.position;
    for (let i = 0; i < this.meshes.length; i++) {
      const mesh = this.meshes[i];
      const want = p.distanceTo(this.centres[i]) - this.stadium.meta[i].radius < LOD_DISTANCE ? this.near : this.far;
      if (mesh.geometry !== want) mesh.geometry = want;
    }
  }

  setBaseColor(fn: BaseColorFn): void {
    this.baseColor = fn;
    this.invalidate();
  }

  private dirtyAll = false;

  /** Schedule a full repaint for the next `flush` (coalesces bursts such as slider drags). */
  invalidate(): void {
    this.dirtyAll = true;
  }

  /** Call once per frame. */
  flush(state: SeatPaintState): void {
    if (!this.dirtyAll) return;
    this.dirtyAll = false;
    this.paint(state);
  }

  /** Repaint the given sections (or all of them). */
  paint(state: SeatPaintState, only?: Iterable<number>): void {
    for (const si of only ?? this.meshes.keys()) {
      if (si >= 0 && si < this.meshes.length) this.paintSection(si, state);
    }
  }

  updateMarker(ref: SeatRef | null, visible: boolean, camera: THREE.Camera, time: number): void {
    const m = this.marker;
    m.visible = visible && ref !== null;
    if (!m.visible || !ref) return;
    const t = this.stadium.tuple(ref);
    const dist = camera.position.distanceTo(this.tmp.set(t[1], t[2], t[3]));
    const scale = THREE.MathUtils.clamp(dist / 30, 1, 8);
    m.scale.setScalar(scale);
    m.position.set(t[1], t[2] + 1 + 0.15 * scale * (1 + Math.sin(time * 4) * 0.5), t[3]);
  }

  private paintSection(si: number, state: SeatPaintState): void {
    const mesh = this.meshes[si];
    const section = this.stadium.sections[si];
    const c = this.color;
    const ref = this.ref;
    // Only dim neighbours while choosing in a section; in seat view the bowl should look as it really does.
    const dimmed = state.mode === 'section' && state.focusedSection !== null && state.focusedSection !== si;
    const lifted = state.hoveredSection === si && state.hoveredSeat === null;
    ref.section = si;
    let i = 0;
    for (let ri = 0; ri < section.rows.length; ri++) {
      ref.row = ri;
      const n = section.rows[ri].seats.length;
      for (let ki = 0; ki < n; ki++) {
        ref.seat = ki;
        this.baseColor(ref, c);
        if (dimmed) c.lerp(DIM, 0.55);
        if (lifted) c.lerp(WHITE, 0.35);
        mesh.setColorAt(i++, c);
      }
    }
    const mark = (r: SeatRef | null, color: THREE.Color) => {
      if (r && r.section === si) mesh.setColorAt(this.stadium.instanceIndex(r), color);
    };
    mark(state.chosenSeat, CHOSEN_COLOR);
    mark(state.hoveredSeat, WHITE);
    mark(state.selectedSeat, SELECTED_COLOR);
    mesh.instanceColor!.needsUpdate = true;
  }
}
