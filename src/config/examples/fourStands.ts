import type { StadiumConfig } from '../../data/types';
import { stadiumConfig } from '../stadiumConfig.ts';

/**
 * Example of per-stand overrides: four different stands in the style of an older ground.
 * Not a real venue. Run it with STADIUM_CONFIG=four-stands (see README).
 *
 * - South (main stand): lower and upper tier, full roof
 * - North: one big single tier with a shorter roof
 * - East: two tiers, further from the goal line, no roof
 * - West: one shallow tier close to the goal line
 * - Corners: only the south-east is filled; the others are open
 */
export const fourStandsExample: StadiumConfig = {
  ...stadiumConfig,
  name: 'Four Stands (example)',
  stands: {
    S: { tiers: [{ id: 1 }, { id: 3, rows: 18 }] },
    N: {
      tiers: [{ id: 1, rows: 36, sections: 10 }],
      roof: { ...stadiumConfig.roof, cantilever: 22, clearance: 5 },
    },
    E: { tiers: [{ id: 1, rows: 20 }, { id: 2, rows: 14 }], roof: null, runoff: 12 },
    W: { tiers: [{ id: 1, rows: 16 }], runoff: 7, roof: { ...stadiumConfig.roof, cantilever: 16, clearance: 4 } },
    SE: { tiers: [{ id: 1 }], roof: null },
    NE: null,
    NW: null,
    SW: null,
  },
};
