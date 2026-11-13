import * as THREE from 'three';
import type { SeatRef, Stadium } from '../data/loadData';
import type { SeatLayer } from '../scene/seats';

export interface SectionHit {
  section: number;
  point: THREE.Vector3;
}

function angleDiff(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

/**
 * Low-poly sloped sheet over a section, from the front edge of row 1 to the top of the last
 * row's seat backs. Raycasting 120 of these is far cheaper than testing 50k seat instances.
 */
function sectionProxy(stadium: Stadium, si: number): THREE.BufferGeometry {
  const section = stadium.sections[si];
  const { spacing, inset, aisle } = stadium.data.seat;
  const first = section.rows[0].seats;
  const last = section.rows[section.rows.length - 1].seats;
  const K = angleDiff(first[0][4], first[first.length - 1][4]) > 0.05 ? 12 : 1;
  const ext = spacing / 2 + aisle / 2;

  const edge = (seats: typeof first, i: number, front: boolean): number[] => {
    const t = seats[Math.round((i / K) * (seats.length - 1))];
    const fx = Math.sin(t[4]);
    const fz = Math.cos(t[4]);
    const shift = i === 0 ? -ext : i === K ? ext : 0;
    const off = front ? inset : -(section.rowDepth - inset);
    return [t[1] - fz * shift + fx * off, t[2] + (front ? 0.2 : 0.95), t[3] + fx * shift + fz * off];
  };

  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= K; i++) {
    pos.push(...edge(first, i, true), ...edge(last, i, false));
    if (i < K) {
      const a = i * 2;
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export class Picker {
  private readonly raycaster = new THREE.Raycaster();
  private readonly proxies: THREE.Mesh[] = [];
  private readonly targets: THREE.Object3D[];

  /** `occluders` (walls, facade, roof) block picks behind them. */
  constructor(
    private readonly stadium: Stadium,
    private readonly seats: SeatLayer,
    private readonly camera: THREE.Camera,
    occluders: THREE.Object3D[],
  ) {
    // Proxies never join the scene, so they are never drawn; identity world matrices are enough.
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    stadium.sections.forEach((_, si) => {
      const m = new THREE.Mesh(sectionProxy(stadium, si), material);
      m.userData.section = si;
      m.updateMatrixWorld();
      this.proxies.push(m);
    });
    this.targets = [...this.proxies, ...occluders];
  }

  /** Section under the pointer. Also primes the ray for a following `seat()` call. */
  section(ndc: THREE.Vector2): SectionHit | null {
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.targets, true)[0];
    const section = hit?.object.userData.section;
    return typeof section === 'number' ? { section, point: hit.point.clone() } : null;
  }

  /** Exact seat under the ray from the last `section()` call, else the nearest seat to the hit point. */
  seat(hit: SectionHit): SeatRef | null {
    const exact = this.raycaster.intersectObject(this.seats.meshes[hit.section], false)[0];
    if (exact?.instanceId !== undefined) return this.stadium.refFromInstance(hit.section, exact.instanceId);

    let best: SeatRef | null = null;
    let bestD = 1.1;
    const p = hit.point;
    this.stadium.sections[hit.section].rows.forEach((row, ri) =>
      row.seats.forEach((t, ki) => {
        const d = Math.hypot(t[1] - p.x, t[2] + 0.6 - p.y, t[3] - p.z);
        if (d < bestD) {
          bestD = d;
          best = { section: hit.section, row: ri, seat: ki };
        }
      }),
    );
    return best;
  }
}
