import { offsetAt } from './bowlPath';
import type { RoofSpec, ShellSpec } from './types';

/** Roof underside height at offset d (the roof is a straight sloped slab in section). */
export function roofUndersideAt(roof: RoofSpec, d: number): number {
  const t = (roof.outerD - d) / (roof.outerD - roof.innerD);
  return roof.outerY + t * (roof.innerY - roof.outerY);
}

/** Height of the built surface (treads, walkways) at offset d, ignoring the roof. */
export function standHeightAt(shell: ShellSpec, d: number): number {
  let h = 0;
  for (const t of shell.tiers) {
    if (d < t.frontD - 0.3) break;
    const last = Math.round((t.backD - t.frontD) / t.rowDepth) - 1;
    const k = Math.max(0, Math.min(last, Math.floor((d - t.frontD) / t.rowDepth)));
    h = t.rowY ? t.rowY[Math.min(k, t.rowY.length - 1)] : t.frontY + k * t.rise;
  }
  return h;
}

/**
 * Lowest height a free (orbit) camera may sit at above (x, z) without entering the building.
 * Over the stands it rides above the seats; approaching the roof edge it ramps up and over
 * the roof instead of slipping underneath it.
 */
export function clearanceHeightAt(shell: ShellSpec, x: number, z: number, margin = 3): number {
  const d = offsetAt(shell.shape, x, z);
  if (d > shell.outerD + 8) return margin;
  let h = standHeightAt(shell, Math.min(d, shell.outerD)) + margin;
  const roof = shell.roof;
  const top = shell.tiers[shell.tiers.length - 1];
  const lidY = roof ? Math.max(roof.outerY, roof.innerY) + roof.thickness + margin : top.topY + 3 + margin;
  const lidStart = roof ? roof.innerD : top.backD;
  const ramp = 10;
  if (d > lidStart - ramp) {
    const t = Math.min(1, (d - (lidStart - ramp)) / ramp);
    h = Math.max(h, h + (lidY - h) * t);
  }
  if (d > shell.outerD) {
    const t = (d - shell.outerD) / 8;
    h = lidY + (margin - lidY) * t;
  }
  return h;
}
