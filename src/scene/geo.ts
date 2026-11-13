import * as THREE from 'three';
import { pieceLength, pointOnPiece, type PathPoint, type Piece } from '../data/bowlPath';
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

/** Points along one piece at offset d, ends included. Same count for every d, so two can be stitched. */
function piecePoints(shape: BowlShape, piece: Piece, d: number, arcSegments: number): PathPoint[] {
  const n = piece.kind === 'arc' ? arcSegments : 1;
  return Array.from({ length: n + 1 }, (_, i) => pointOnPiece(piece, shape, d, i / n));
}

/**
 * Strip between two offset lines along one piece of the bowl. The face normal is
 * (b - a) x pathDirection: bottom->top faces the pitch, inner->outer faces up, outer->inner
 * faces down, top->bottom faces out.
 */
export function pieceBand(shape: BowlShape, piece: Piece, a: RingEdge, b: RingEdge, arcSegments = 16): THREE.BufferGeometry {
  const pa = piecePoints(shape, piece, a.d, arcSegments);
  const pb = piecePoints(shape, piece, b.d, arcSegments);
  const n = pa.length;
  const pos = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) pos.set([pa[i].x, a.y, pa[i].z, pb[i].x, b.y, pb[i].z], i * 6);
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a0 = i * 2, b0 = a0 + 1, a1 = a0 + 2, b1 = a0 + 3;
    idx.push(a0, b0, b1, a0, b1, a1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Flat end wall closing one end of a piece: a cross-section outline of (d, y) points, stood up
 * across the path at its start (end = 0) or finish (end = 1) and facing out of the piece. It
 * sits `inset` metres inside the piece so two caps on a shared boundary never overlap.
 */
export function pieceCap(shape: BowlShape, piece: Piece, end: 0 | 1, outline: Array<readonly [number, number]>, inset = 0.05): THREE.BufferGeometry {
  const pts = outline.filter((p, i) => {
    const q = outline[(i + outline.length - 1) % outline.length];
    return Math.abs(p[0] - q[0]) > 1e-4 || Math.abs(p[1] - q[1]) > 1e-4;
  });
  const pos: number[] = [];
  for (const [d, y] of pts) {
    const len = Math.max(1e-3, pieceLength(piece, shape, d));
    const t = end === 0 ? Math.min(0.5, inset / len) : Math.max(0.5, 1 - inset / len);
    const p = pointOnPiece(piece, shape, d, t);
    pos.push(p.x, y, p.z);
  }
  // Outward = against the path direction at the start, along it at the finish.
  const e = 1e-3;
  const p0 = pointOnPiece(piece, shape, pts[0][0], end === 0 ? 0 : 1 - e);
  const p1 = pointOnPiece(piece, shape, pts[0][0], end === 0 ? e : 1);
  const outward = new THREE.Vector3(p1.x - p0.x, 0, p1.z - p0.z).multiplyScalar(end === 0 ? -1 : 1);

  const v = (i: number) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  const idx: number[] = [];
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(pts.map(([d, y]) => new THREE.Vector2(d, y)), [])) {
    const n = v(b).sub(v(a)).cross(v(c).sub(v(a)));
    if (n.dot(outward) >= 0) idx.push(a, b, c);
    else idx.push(a, c, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
