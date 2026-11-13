import * as THREE from 'three';
import { ringPoints } from '../data/bowlPath';
import type { BowlShape } from '../data/types';

export type V3 = readonly [number, number, number];

/** Accumulates flat-shaded quads into one non-indexed geometry. */
export class QuadBuilder {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];

  /** Corners in ring order. Winding is fixed up automatically so the face points along `n`. */
  quad(a: V3, b: V3, c: V3, d: V3, n: V3, color: V3 = [1, 1, 1]): void {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
    const facing = gx * n[0] + gy * n[1] + gz * n[2] >= 0;
    const order = facing ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
    for (const p of order) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(color[0], color[1], color[2]);
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

export interface RingEdge {
  d: number;
  y: number;
}

/**
 * Closed strip between two offset rings of the bowl. The face normal is (b - a) x pathDirection:
 * bottom->top faces the pitch, inner->outer faces up, outer->inner faces down, top->bottom faces out.
 */
export function ringBand(shape: BowlShape, a: RingEdge, b: RingEdge, arcSegments = 16): THREE.BufferGeometry {
  const pa = ringPoints(shape, a.d, arcSegments);
  const pb = ringPoints(shape, b.d, arcSegments);
  const n = pa.length;
  const pos = new Float32Array((n + 1) * 6);
  for (let i = 0; i <= n; i++) {
    const j = i % n;
    pos.set([pa[j].x, a.y, pa[j].z, pb[j].x, b.y, pb[j].z], i * 6);
  }
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = i * 2, b0 = a0 + 1, a1 = a0 + 2, b1 = a0 + 3;
    idx.push(a0, b0, b1, a0, b1, a1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
