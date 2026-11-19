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

/**
 * A corner. Round: an arc of radius r0 + d about (cx, cz) from angle a0 to a1. Square: the
 * same two end points joined by two straight legs that meet at the corner point
 * (cx, cz) + (r0 + d)(n0 + n1), where n0 and n1 are the unit normals at a0 and a1. The first
 * half of t runs along the first leg (facing n0), the second half along the second (facing n1).
 */
export interface ArcPiece {
  kind: 'arc';
  zone: Zone;
  side: Side;
  cx: number;
  cz: number;
  a0: number;
  a1: number;
  square?: boolean;
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

export function bowlPieces({ sx, sz, r0, cx = 0, cz = 0, squareCorners = [] }: BowlShape): Piece[] {
  const hx = sx + r0;
  const hz = sz + r0;
  const H = Math.PI / 2;
  const corner = (side: 'SE' | 'NE' | 'NW' | 'SW', x: number, z: number, a0: number, a1: number): ArcPiece => ({
    kind: 'arc',
    zone: 'corner',
    side,
    cx: x,
    cz: z,
    a0,
    a1,
    ...(squareCorners.includes(side) ? { square: true } : {}),
  });
  return [
    { kind: 'line', zone: 'sideline', side: 'S', x0: cx - sx, z0: cz + hz, x1: cx + sx, z1: cz + hz, nx: 0, nz: 1 },
    corner('SE', cx + sx, cz + sz, H, 0),
    { kind: 'line', zone: 'end', side: 'E', x0: cx + hx, z0: cz + sz, x1: cx + hx, z1: cz - sz, nx: 1, nz: 0 },
    corner('NE', cx + sx, cz - sz, 0, -H),
    { kind: 'line', zone: 'sideline', side: 'N', x0: cx + sx, z0: cz - hz, x1: cx - sx, z1: cz - hz, nx: 0, nz: -1 },
    corner('NW', cx - sx, cz - sz, -H, -2 * H),
    { kind: 'line', zone: 'end', side: 'W', x0: cx - hx, z0: cz - sz, x1: cx - hx, z1: cz + sz, nx: -1, nz: 0 },
    corner('SW', cx - sx, cz + sz, -2 * H, -3 * H),
  ];
}

/**
 * Path fractions at which to sample a piece for building meshes, ends included. Lines need
 * only their ends; round corners `arcSegments` steps; square corners their two legs, with the
 * corner point listed twice so each leg keeps its own flat face.
 */
export function pieceSamples(piece: Piece, arcSegments: number): number[] {
  if (piece.kind === 'line') return [0, 1];
  if (piece.square) return [0, 0.5, 0.5, 1];
  return Array.from({ length: arcSegments + 1 }, (_, i) => i / arcSegments);
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
  if (piece.square) return 2 * (shape.r0 + d);
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
  const r = shape.r0 + d;
  if (piece.square) {
    const n0x = Math.cos(piece.a0), n0z = Math.sin(piece.a0);
    const n1x = Math.cos(piece.a1), n1z = Math.sin(piece.a1);
    // Corner point, then walk back along the leg: towards n0's end on the first half, n1's on the second.
    const kx = piece.cx + r * (n0x + n1x);
    const kz = piece.cz + r * (n0z + n1z);
    if (t < 0.5) {
      const s = (1 - 2 * t) * r;
      return { x: kx - s * n1x, z: kz - s * n1z, nx: n0x, nz: n0z };
    }
    if (t > 0.5) {
      const s = (2 * t - 1) * r;
      return { x: kx - s * n0x, z: kz - s * n0z, nx: n1x, nz: n1z };
    }
    return { x: kx, z: kz, nx: (n0x + n1x) / Math.SQRT2, nz: (n0z + n1z) / Math.SQRT2 };
  }
  const a = piece.a0 + (piece.a1 - piece.a0) * t;
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
    const ts = pieceSamples(piece, arcSegments);
    // Drop the end (the next piece starts there) and the repeated corner point.
    ts.slice(0, -1).forEach((t, i) => {
      if (i === 0 || t !== ts[i - 1]) pts.push(pointOnPiece(piece, shape, d, t));
    });
  }
  return pts;
}

/** Corner of the bowl that (x, z) lies towards. */
function cornerOf(shape: BowlShape, x: number, z: number): 'SE' | 'NE' | 'NW' | 'SW' {
  const east = x >= (shape.cx ?? 0);
  const south = z >= (shape.cz ?? 0);
  return south ? (east ? 'SE' : 'SW') : east ? 'NE' : 'NW';
}

/** Signed distance from (x, z) to the front-row line: negative over the pitch, positive in the stands. */
export function offsetAt(shape: BowlShape, x: number, z: number): number {
  const qx = Math.abs(x - (shape.cx ?? 0)) - shape.sx;
  const qz = Math.abs(z - (shape.cz ?? 0)) - shape.sz;
  // In a square corner every row is a right angle, so distance is measured square on too.
  const square = qx > 0 && qz > 0 && shape.squareCorners?.includes(cornerOf(shape, x, z));
  const outside = square ? Math.max(qx, qz) : Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
  const inside = Math.min(Math.max(qx, qz), 0);
  return outside + inside - shape.r0;
}
