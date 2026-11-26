import { offsetAt, piecesNear } from './bowlPath.ts';
import type { RoofSpec, ScoreboardSpec, ShellSpec, StandShell } from './types';

/** Roof underside height at offset d (the roof is a straight sloped slab in section). */
export function roofUndersideAt(roof: RoofSpec, d: number): number {
  const t = (roof.outerD - d) / (roof.outerD - roof.innerD);
  return roof.outerY + t * (roof.innerY - roof.outerY);
}

/** Height of the built surface (treads, walkways) at offset d in one stand, ignoring the roof. */
export function standHeightAt(stand: StandShell, d: number): number {
  let h = 0;
  for (const t of stand.tiers) {
    if (d < t.frontD - 0.3) break;
    const last = Math.round((t.backD - t.frontD) / t.rowDepth) - 1;
    const k = Math.max(0, Math.min(last, Math.floor((d - t.frontD) / t.rowDepth)));
    h = t.rowY ? t.rowY[Math.min(k, t.rowY.length - 1)] : t.frontY + k * t.rise;
  }
  return h;
}

/** Lowest safe camera height at offset d, assuming this stand's cross-section. */
function standClearanceAt(stand: StandShell, d: number, margin: number): number {
  if (d > stand.outerD + 8) return margin;
  let h = standHeightAt(stand, Math.min(d, stand.outerD)) + margin;
  const roof = stand.roof;
  const top = stand.tiers[stand.tiers.length - 1];
  const lidY = roof ? Math.max(roof.outerY, roof.innerY) + roof.thickness + margin : top.topY + 3 + margin;
  const lidStart = roof ? roof.innerD : top.backD;
  const ramp = 10;
  if (d > lidStart - ramp) {
    const t = Math.min(1, (d - (lidStart - ramp)) / ramp);
    h = Math.max(h, h + (lidY - h) * t);
  }
  if (d > stand.outerD) {
    const t = (d - stand.outerD) / 8;
    h = lidY + (margin - lidY) * t;
  }
  return h;
}

/** How far past the end of a stand the camera still keeps clear of it. */
const END_MARGIN = 4;

/**
 * Lowest height a free (orbit) camera may sit at above (x, z) without entering the building.
 * Over the stands it rides above the seats; approaching the roof edge it ramps up and over
 * the roof instead of slipping underneath it. Near the end of a stand the stand next door
 * counts too, so the camera clears whichever is higher; over an open corner it can drop.
 */
export function clearanceHeightAt(shell: ShellSpec, x: number, z: number, margin = 3): number {
  const d = offsetAt(shell.shape, x, z);
  let h = margin;
  for (const i of piecesNear(shell.shape, x, z, END_MARGIN)) {
    const stand = shell.stands[i];
    if (stand) h = Math.max(h, standClearanceAt(stand, d, margin));
  }
  for (const b of shell.scoreboards ?? []) h = Math.max(h, scoreboardClearanceAt(b, x, z, margin));
  return h;
}

/** Scoreboard frame and legs above its base, as built by the renderer (1 m legs, 0.3 m frame). */
export const scoreboardTop = (b: ScoreboardSpec) => b.y + 1 + b.height + 0.6;

/**
 * Over a scoreboard and 2 m round it the camera stays `margin` above its top, then the
 * requirement fades out over the next 10 m.
 */
function scoreboardClearanceAt(b: ScoreboardSpec, x: number, z: number, margin: number): number {
  const fx = Math.sin(b.yaw);
  const fz = Math.cos(b.yaw);
  const u = (x - b.x) * -fz + (z - b.z) * fx;
  const v = (x - b.x) * fx + (z - b.z) * fz;
  const e = Math.hypot(Math.max(0, Math.abs(u) - b.width / 2 - 0.3), Math.max(0, Math.abs(v) - 0.4));
  const k = Math.min(1, Math.max(0, 1 - (e - 2) / 10));
  return (scoreboardTop(b) + margin) * k;
}
