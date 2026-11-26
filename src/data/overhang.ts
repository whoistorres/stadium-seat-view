import type { TierLayout } from './types';

/** Thickness of a tier's front wall. */
export const WALL_THICKNESS = 0.2;
/** Depth of the structure under an overhanging tier's first tread. */
export const OVERHANG_SLAB = 1.0;

/**
 * Underside where a tier hangs out over the back rows of the tier below it (a negative
 * `setback`): from the front wall of the upper tier (`innerD`) back to the lower tier's back
 * (`outerD`). It starts at height `y` under the front wall and rises going back at `slope`
 * (metres up per metre back), the rake of the upper tier's first rows, so it stays under the
 * upper tier's treads (which only get steeper) and clear of the rows beneath it.
 */
export interface Overhang {
  /** Index (into the stand's tiers) of the tier underneath. */
  below: number;
  innerD: number;
  outerD: number;
  /** Height of the underside at `innerD`, its lowest point. */
  y: number;
  /** Rise of the underside per metre back. 0 = flat. */
  slope: number;
}

type TierEdges = Pick<TierLayout, 'frontD' | 'frontY' | 'backD'> & Partial<Pick<TierLayout, 'rise' | 'rowDepth' | 'rowY'>>;

/** True when tier `i` starts in front of the back of the tier below it. */
export function overhangs(tiers: readonly TierEdges[], i: number): boolean {
  return i > 0 && tiers[i].frontD < tiers[i - 1].backD - 1e-6;
}

/** Rake of a tier's first rows, in metres up per metre back (0 when unknown). */
function frontSlope(t: TierEdges): number {
  if (!t.rowDepth) return 0;
  const first = t.rowY && t.rowY.length > 1 ? t.rowY[1] - t.rowY[0] : (t.rise ?? 0);
  return Math.max(0, first / t.rowDepth);
}

/** The overhangs in one stand's stack of tiers, front tier first. */
export function standOverhangs(tiers: readonly TierEdges[]): Overhang[] {
  const out: Overhang[] = [];
  tiers.forEach((t, i) => {
    if (!overhangs(tiers, i)) return;
    out.push({ below: i - 1, innerD: t.frontD - WALL_THICKNESS, outerD: tiers[i - 1].backD, y: t.frontY - OVERHANG_SLAB, slope: frontSlope(t) });
  });
  return out;
}

/** Height of an overhang's underside at offset `d` (clamped to its extent). */
export function overhangY(o: Overhang, d: number): number {
  return o.y + o.slope * (Math.min(o.outerD, Math.max(o.innerD, d)) - o.innerD);
}
