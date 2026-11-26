import type { StadiumConfig } from '../../data/types';
import { stadiumConfig } from '../stadiumConfig.ts';

/**
 * Example of per-stand overrides: four different stands in the style of an older ground.
 * Not a real venue. Run it with STADIUM_CONFIG=four-stands (see README).
 *
 * - South (main stand): lower, upper and a fourth "top" tier, full roof
 * - North: one big single tier with a shorter roof
 * - East: two tiers, further from the goal line, no roof
 * - West: one shallow tier close to the goal line
 * - Corners: only the south-east is filled; the others are open
 * - Sightlines per stand, so the East Stand's rake suits its 12 m gap
 */
export const fourStandsExample: StadiumConfig = {
  ...stadiumConfig,
  name: 'Four Stands (example)',
  // Green and white hoops are beyond the shader, so: green, white, some green/white stripes.
  // Away fans in the open East stand's back tier.
  crowd: { home: ['#1b7a3a', '#1b7a3a', '#f2f2f2', '#1b7a3a/#f2f2f2'], away: ['#f2c200'], awaySections: ['201', '202', '203', '204'] },
  // Separate stands: each designs its rake for its own distance to the pitch.
  bowl: { ...stadiumConfig.bowl, sightlines: 'stand' },
  // A fourth tier, used only by the main stand. Tier ids just need to rise from front to back.
  tiers: [
    ...stadiumConfig.tiers,
    { id: 4, name: 'Top', firstSection: 401, rows: 10, rowDepth: 0.85, rakeDeg: 34, cValue: 90, setback: 1.6, lift: 1.9, parapet: 0.7 },
  ],
  stands: {
    S: { tiers: [{ id: 1 }, { id: 3, rows: 12 }, { id: 4 }] },
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
