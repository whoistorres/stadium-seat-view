import { offsetAt, piecesNear } from './bowlPath.ts';
import type { RoofSpec, ShellSpec, StandShell } from './types';

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
  return h;
}
