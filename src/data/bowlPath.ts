import type { BowlShape, Side, Zone } from './types.ts';

/**
 * The bowl footprint is a rounded rectangle. Offsetting it outward by d keeps the straights
 * the same length and grows the corner radius to r0 + d, so every row is parallel to the
 * one in front. Axes: X along the pitch length, Z across it, Y up.
 *
 * Pieces are ordered so that travelling along the path is always left-to-right for a
 * spectator facing the pitch.
 */
export interface LinePiece {
  kind: 'line';
  zone: Zone;
  side: Side;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  nx: number;
  nz: number;
}

export interface ArcPiece {
  kind: 'arc';
  zone: Zone;
  side: Side;
  cx: number;
  cz: number;
  a0: number;
  a1: number;
}

export type Piece = LinePiece | ArcPiece;

export interface PathPoint {
  x: number;
  z: number;
  /** Outward unit normal (away from the pitch). */
  nx: number;
  nz: number;
}

/** Sides of the eight pieces, in path order. Index i here is index i of bowlPieces() and ShellSpec.stands. */
export const PIECE_SIDES: readonly Side[] = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];

export function bowlPieces({ sx, sz, r0, cx = 0, cz = 0 }: BowlShape): Piece[] {
  const hx = sx + r0;
  const hz = sz + r0;
  const H = Math.PI / 2;
  return [
    { kind: 'line', zone: 'sideline', side: 'S', x0: cx - sx, z0: cz + hz, x1: cx + sx, z1: cz + hz, nx: 0, nz: 1 },
    { kind: 'arc', zone: 'corner', side: 'SE', cx: cx + sx, cz: cz + sz, a0: H, a1: 0 },
    { kind: 'line', zone: 'end', side: 'E', x0: cx + hx, z0: cz + sz, x1: cx + hx, z1: cz - sz, nx: 1, nz: 0 },
    { kind: 'arc', zone: 'corner', side: 'NE', cx: cx + sx, cz: cz - sz, a0: 0, a1: -H },
    { kind: 'line', zone: 'sideline', side: 'N', x0: cx + sx, z0: cz - hz, x1: cx - sx, z1: cz - hz, nx: 0, nz: -1 },
    { kind: 'arc', zone: 'corner', side: 'NW', cx: cx - sx, cz: cz - sz, a0: -H, a1: -2 * H },
    { kind: 'line', zone: 'end', side: 'W', x0: cx - hx, z0: cz - sz, x1: cx - hx, z1: cz + sz, nx: -1, nz: 0 },
    { kind: 'arc', zone: 'corner', side: 'SW', cx: cx - sx, cz: cz + sz, a0: -2 * H, a1: -3 * H },
  ];
}

/**
 * Indices of the pieces whose sector contains (x, z), widened by `margin` metres so points
 * near a boundary count for both neighbours. The sectors are split by the lines through the
 * corner-arc centres, which is exactly where neighbouring pieces meet at every offset.
 */
export function piecesNear(shape: BowlShape, x: number, z: number, margin = 0): number[] {
  const px = x - (shape.cx ?? 0);
  const pz = z - (shape.cz ?? 0);
  const { sx, sz } = shape;
  const m = margin;
  const out: number[] = [];
  if (pz >= 0 && Math.abs(px) <= sx + m) out.push(0);
  if (px >= sx - m && pz >= sz - m) out.push(1);
  if (px >= 0 && Math.abs(pz) <= sz + m) out.push(2);
  if (px >= sx - m && pz <= -sz + m) out.push(3);
  if (pz <= 0 && Math.abs(px) <= sx + m) out.push(4);
  if (px <= -sx + m && pz <= -sz + m) out.push(5);
  if (px <= 0 && Math.abs(pz) <= sz + m) out.push(6);
  if (px <= -sx + m && pz >= sz - m) out.push(7);
  return out;
}

export function pieceLength(piece: Piece, shape: BowlShape, d: number): number {
  if (piece.kind === 'line') return Math.hypot(piece.x1 - piece.x0, piece.z1 - piece.z0);
  return Math.abs(piece.a1 - piece.a0) * (shape.r0 + d);
}

/** Point at fraction t (0..1) along a piece, on the path offset outward by d. */
export function pointOnPiece(piece: Piece, shape: BowlShape, d: number, t: number): PathPoint {
  if (piece.kind === 'line') {
    return {
      x: piece.x0 + (piece.x1 - piece.x0) * t + piece.nx * d,
      z: piece.z0 + (piece.z1 - piece.z0) * t + piece.nz * d,
      nx: piece.nx,
      nz: piece.nz,
    };
  }
  const a = piece.a0 + (piece.a1 - piece.a0) * t;
  const r = shape.r0 + d;
  const nx = Math.cos(a);
  const nz = Math.sin(a);
  return { x: piece.cx + nx * r, z: piece.cz + nz * r, nx, nz };
}

/**
 * Closed loop of points around the bowl at offset d. The parameterisation (and therefore
 * the point count) is identical for every d, so two rings can be stitched into a band.
 */
export function ringPoints(shape: BowlShape, d: number, arcSegments = 16): PathPoint[] {
  const pts: PathPoint[] = [];
  for (const piece of bowlPieces(shape)) {
    const n = piece.kind === 'arc' ? arcSegments : 1;
    for (let i = 0; i < n; i++) pts.push(pointOnPiece(piece, shape, d, i / n));
  }
  return pts;
}

/** Signed distance from (x, z) to the front-row line: negative over the pitch, positive in the stands. */
export function offsetAt(shape: BowlShape, x: number, z: number): number {
  const qx = Math.abs(x - (shape.cx ?? 0)) - shape.sx;
  const qz = Math.abs(z - (shape.cz ?? 0)) - shape.sz;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
  const inside = Math.min(Math.max(qx, qz), 0);
  return outside + inside - shape.r0;
}
