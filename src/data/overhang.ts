import type { TierLayout } from './types';

/** Thickness of a tier's front wall. */
export const WALL_THICKNESS = 0.2;
/** Depth of the structure under an overhanging tier's first tread. */
export const OVERHANG_SLAB = 1.0;

/**
 * Flat ceiling where a tier hangs out over the back rows of the tier below it (a negative
 * `setback`): from the front wall of the upper tier (`innerD`) back to the lower tier's
 * back (`outerD`), at height `y`.
 */
export interface Overhang {
  /** Index (into the stand's tiers) of the tier underneath. */
  below: number;
  innerD: number;
  outerD: number;
  y: number;
}

type TierEdges = Pick<TierLayout, 'frontD' | 'frontY' | 'backD'>;

/** True when tier `i` starts in front of the back of the tier below it. */
export function overhangs(tiers: readonly TierEdges[], i: number): boolean {
  return i > 0 && tiers[i].frontD < tiers[i - 1].backD - 1e-6;
}

/** The overhangs in one stand's stack of tiers, front tier first. */
export function standOverhangs(tiers: readonly TierEdges[]): Overhang[] {
  const out: Overhang[] = [];
  tiers.forEach((t, i) => {
    if (!overhangs(tiers, i)) return;
    out.push({ below: i - 1, innerD: t.frontD - WALL_THICKNESS, outerD: tiers[i - 1].backD, y: t.frontY - OVERHANG_SLAB });
  });
  return out;
}
