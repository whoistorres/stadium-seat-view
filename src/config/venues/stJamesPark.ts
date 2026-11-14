import type { RoofConfig, StadiumConfig, StandConfig, TierConfig } from '../../data/types';

/*
 * St James' Park, Newcastle upon Tyne: an approximate model fitted to public data.
 *
 * Contains information from OpenStreetMap (stadium building relation 1698564: outer wall
 * and inner edge of the stands), © OpenStreetMap contributors, available under the Open
 * Database License (ODbL) 1.0: https://www.openstreetmap.org/copyright. Because of that,
 * this file is a derived database under the ODbL, not under the project's MIT licence.
 *
 * What comes from where:
 * - Pitch-to-stand gaps and each stand's overall depth: OSM building footprint.
 *   Ends 6.8 m from the goal lines (used 7 m). Sides 3.8 m from the touchlines in OSM;
 *   5 m used so the advertising boards fit.
 *   Depths, front row to outer wall: Milburn ~72 m, Leazes ~73 m, Gallowgate ~49 m, East ~29 m.
 * - Layout: Milburn Stand (west) and Leazes End (north) are two-tiered, with the upper tier
 *   wrapping their shared corner under one big cantilever roof. Gallowgate End (south) and
 *   East Stand are single-tiered; the other three corners are filled to the same height.
 * - Capacity: about 52,300 in published figures; rows here are fitted to land close to it.
 *   The generator's corners are arcs, not the real square-filled corners, so corner seats
 *   are fewer and the stands carry the difference.
 * - Section numbers (101..., 201...) are generated, NOT the club's real block numbers.
 *   Row counts, rakes and roof sizes are fitted estimates, not survey data.
 *
 * Mapping to the generator's compass pieces (the generator runs the pitch along X):
 * N = Milburn (real west), E = Leazes (real north), S = East Stand, W = Gallowgate (real south).
 */

const tiers: TierConfig[] = [
  // Real rakes are not published. Rows steepen towards a 60 mm sightline target (the usual
  // minimum), capped at 35°. The tall upper tier hits that cap, so its near-touchline
  // clearance stays low (about 14–25 mm): check against real seat photos before relying on it.
  { id: 1, name: 'Lower', firstSection: 101, rows: 32, rowDepth: 0.8, rakeDeg: 24, cValue: 60, setback: 0, lift: 1.0, parapet: 0.4 },
  // Upper tier ("Level 7") sits above a level of executive boxes.
  { id: 2, name: 'Upper', firstSection: 201, rows: 46, rowDepth: 0.8, rakeDeg: 30, cValue: 60, setback: 3, lift: 6.5, parapet: 1.0 },
];

const bigRoof: RoofConfig = { enabled: true, clearance: 6, cantilever: 50, slopeDeg: 3, thickness: 1.2 };
const lowRoof: RoofConfig = { enabled: true, clearance: 5, cantilever: 24, slopeDeg: 4, thickness: 0.8 };

/** Milburn, Leazes and their shared corner: same cross-section so they join seamlessly. */
const tall = (name: string, sections: number): StandConfig => ({
  name,
  tiers: [{ id: 1 }, { id: 2 }],
  sections,
  roof: bigRoof,
  shellDepth: 7,
});

/** Single-tier stands; a corner gets the same cross-section as the stand it continues. */
const eastProfile = { tiers: [{ id: 1, rows: 28 }], roof: { ...lowRoof, cantilever: 22 }, shellDepth: 6 };
const gallowgateProfile = { tiers: [{ id: 1, rows: 52 }], roof: { ...lowRoof, cantilever: 32 }, shellDepth: 7 };

export const stJamesPark: StadiumConfig = {
  name: "St James' Park (approximate)",
  pitch: { length: 105, width: 68, runoffSide: 5, runoffEnd: 7 },
  bowl: {
    // Small radius: the real corners are filled close to square.
    cornerRadius: 6,
    // Close to the 460 mm minimum seat width common in older UK grounds.
    seatSpacing: 0.47,
    aisleWidth: 1.2,
    seatInset: 0.5,
    sectionsPerZone: { sideline: 8, end: 5, corner: 3 },
  },
  tiers,
  roof: lowRoof,
  shellDepth: 8,
  eyeHeight: 1.2,
  stands: {
    N: tall('Milburn Stand', 9),
    NE: tall('Milburn–Leazes corner', 4),
    E: tall('Leazes End', 6),
    SE: { name: 'Leazes–East corner', sections: 3, ...eastProfile },
    S: { name: 'East Stand', sections: 8, ...eastProfile },
    SW: { name: 'Strawberry Corner', sections: 3, ...eastProfile },
    W: { name: 'Gallowgate End', sections: 6, ...gallowgateProfile },
    NW: { name: 'Gallowgate–Milburn corner', sections: 4, ...gallowgateProfile },
  },
};
