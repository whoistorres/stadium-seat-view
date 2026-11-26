import * as THREE from 'three';
import { offsetAt, PIECE_SIDES } from '../data/bowlPath';
import { OVERHANG_SLAB, overhangs, WALL_THICKNESS } from '../data/overhang';
import type { SeatTuple, Section, StadiumData } from '../data/types';
import { QuadBuilder, type V3 } from './geo';
import { backWallTop } from './stands';

const STEP: V3 = [0.66, 0.67, 0.69];
const STEP_RISER: V3 = [0.5, 0.51, 0.53];
const NOSING: V3 = [0.84, 0.7, 0.24];
const DOOR: V3 = [0.05, 0.06, 0.07];
const DOOR_FRAME: V3 = [0.32, 0.34, 0.37];

/** Clear height a tunnel mouth needs; lower walls get none. */
const MIN_DOOR = 1.9;
const MAX_DOOR = 2.4;

/** One row's worth of a stair aisle: the gap between two sections' row ends. */
export interface AislePoint {
  x: number;
  z: number;
  /** Tread level of the row. */
  y: number;
  /** Unit direction towards the pitch. */
  fx: number;
  fz: number;
  /** Half the clear width between the two end seats. */
  half: number;
}

export interface Aisle {
  /** Section on the left of the aisle (as seen facing the pitch). */
  section: Section;
  /** Front row first. */
  points: AislePoint[];
}

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

/**
 * Stair aisles between neighbouring sections of the same tier, found from the seat rows: where
 * one section's row ends a little short of the next section's row start, at the same height and
 * facing the same way. Joins at a square corner's diagonal (rows meeting at an angle) and between
 * stands of different cross-sections are left out.
 */
export function findAisles(data: StadiumData): Aisle[] {
  const { spacing, aisle } = data.seat;
  const maxGap = spacing + aisle * 1.5 + 1;
  const out: Aisle[] = [];
  for (const a of data.sections) {
    for (const b of data.sections) {
      if (a === b || a.tier !== b.tier || a.rows.length === 0 || b.rows.length === 0) continue;
      const points: AislePoint[] = [];
      const rows = Math.min(a.rows.length, b.rows.length);
      for (let k = 0; k < rows; k++) {
        const l: SeatTuple | undefined = a.rows[k].seats[a.rows[k].seats.length - 1];
        const r: SeatTuple | undefined = b.rows[k].seats[0];
        if (!l || !r || Math.abs(l[2] - r[2]) > 0.05 || angleDiff(l[4], r[4]) > 0.35) break;
        const gap = Math.hypot(r[1] - l[1], r[3] - l[3]);
        // b must start to the right of a's row end: right = (-fz, fx) for facing (fx, fz).
        const right = (r[1] - l[1]) * -Math.cos(l[4]) + (r[3] - l[3]) * Math.sin(l[4]);
        if (gap > maxGap || right < spacing * 0.5) break;
        const fx = Math.sin(l[4]) + Math.sin(r[4]);
        const fz = Math.cos(l[4]) + Math.cos(r[4]);
        const n = Math.hypot(fx, fz);
        points.push({
          x: (l[1] + r[1]) / 2,
          z: (l[3] + r[3]) / 2,
          y: l[2],
          fx: fx / n,
          fz: fz / n,
          half: THREE.MathUtils.clamp(gap - spacing, 0.7, 1.6) / 2,
        });
      }
      if (points.length > 1) out.push({ section: a, points });
    }
  }
  return out;
}

/** Point p moved `along` towards the pitch and `side` to the right. */
function at(p: AislePoint, along: number, side: number, y: number): V3 {
  return [p.x + p.fx * along - p.fz * side, y, p.z + p.fz * along + p.fx * side];
}

/**
 * Aisle stairs (two steps per row, with yellow nosings) and, where the wall at the top of the
 * aisle is tall enough, a tunnel mouth: under an overhanging tier, in the front wall of the tier
 * above a walkway, or in the back wall of the top tier.
 */
export function buildAisles(data: StadiumData): THREE.Mesh | null {
  const aisles = findAisles(data);
  if (aisles.length === 0) return null;
  const qb = new QuadBuilder();
  const inset = data.seat.inset;
  const up: V3 = [0, 1, 0];

  for (const { section, points } of aisles) {
    const depth = section.rowDepth;
    points.forEach((p, k) => {
      const w = p.half;
      const f: V3 = [p.fx, 0, p.fz];
      const right: V3 = [-p.fz, 0, p.fx];
      const left: V3 = [p.fz, 0, -p.fx];
      // Nosing along the front edge of this row's tread in the aisle.
      const ny = p.y + 0.004;
      qb.quad(at(p, inset, -w, ny), at(p, inset, w, ny), at(p, inset - 0.07, w, ny), at(p, inset - 0.07, -w, ny), up, NOSING);
      const next = points[k + 1];
      if (!next) return;
      const rise = next.y - p.y;
      if (rise < 0.12) return;
      // Half step on the back half of this row's tread, halfway up to the next row.
      const mid = p.y + rise / 2;
      const front = inset - depth / 2;
      const back = inset - depth;
      qb.quad(at(p, front, -w, mid), at(p, front, w, mid), at(p, back, w, mid), at(p, back, -w, mid), up, STEP);
      qb.quad(at(p, front, -w, p.y), at(p, front, w, p.y), at(p, front, w, mid), at(p, front, -w, mid), f, STEP_RISER);
      qb.quad(at(p, front, w, p.y), at(p, back, w, p.y), at(p, back, w, mid), at(p, front, w, mid), right, STEP_RISER);
      qb.quad(at(p, front, -w, p.y), at(p, back, -w, p.y), at(p, back, -w, mid), at(p, front, -w, mid), left, STEP_RISER);
      const sy = mid + 0.004;
      qb.quad(at(p, front, -w, sy), at(p, front, w, sy), at(p, front - 0.07, w, sy), at(p, front - 0.07, -w, sy), up, NOSING);
    });
    addTunnelMouth(qb, data, section, points[points.length - 1]);
  }

  const mesh = new THREE.Mesh(qb.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }));
  mesh.name = 'aisles';
  mesh.receiveShadow = true;
  return mesh;
}

function addTunnelMouth(qb: QuadBuilder, data: StadiumData, section: Section, top: AislePoint): void {
  const shell = data.shell;
  const stand = shell?.stands[PIECE_SIDES.indexOf(section.side)];
  if (!shell || !stand) return;
  const ti = stand.tiers.findIndex((t) => t.id === section.tier);
  if (ti < 0) return;
  const tier = stand.tiers[ti];
  const next = stand.tiers[ti + 1];
  let wallD: number;
  let ceiling: number;
  if (!next) {
    wallD = tier.backD;
    ceiling = backWallTop(stand);
  } else if (overhangs(stand.tiers, ti + 1)) {
    wallD = tier.backD;
    ceiling = next.frontY - OVERHANG_SLAB;
  } else {
    // Front wall of the tier above, behind the walkway; its front row's floor sits on top.
    wallD = next.frontD - WALL_THICKNESS;
    ceiling = next.frontY - 0.3;
  }
  const floor = tier.topY;
  const h = Math.min(MAX_DOOR, ceiling - floor - 0.15);
  if (h < MIN_DOOR) return;

  // From the aisle top straight back to the wall face, a hair in front of it.
  const back = wallD - offsetAt(shell.shape, top.x, top.z) - 0.06;
  if (back < 0) return;
  const c: AislePoint = { ...top, x: top.x - top.fx * back, z: top.z - top.fz * back };
  const w = Math.min(1.1, top.half + 0.3);
  const f: V3 = [c.fx, 0, c.fz];
  const frame = 0.18;
  qb.quad(at(c, 0, -w - frame, floor), at(c, 0, w + frame, floor), at(c, 0, w + frame, floor + h + frame), at(c, 0, -w - frame, floor + h + frame), f, DOOR_FRAME);
  qb.quad(at(c, 0.01, -w, floor + 0.01), at(c, 0.01, w, floor + 0.01), at(c, 0.01, w, floor + h), at(c, 0.01, -w, floor + h), f, DOOR);
}
