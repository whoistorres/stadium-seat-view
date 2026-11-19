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
 *   wrapping their shared corner under one big cantilever roof. East Stand is single-tiered;
 *   Gallowgate End (south) is one bank split by a walkway (see gallowgateProfile). The other
 *   three corners are filled to the same height as the stand next to them.
 * - Capacity: about 52,300 in published figures. Square corners and 0.5 m seats give
 *   about 53,400; the model has no executive boxes, media seats or wide stair landings.
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
  // Upper tier ("Level 7") sits above a level of executive boxes. Lift checked against a fan
  // photo from Leazes Level 7 row F: eye about 27-28 m above the pitch.
  { id: 2, name: 'Upper', firstSection: 201, rows: 46, rowDepth: 0.8, rakeDeg: 30, cValue: 60, setback: 3, lift: 9.0, parapet: 1.0 },
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
/*
 * Gallowgate End, checked against two fan photos:
 * - Its seating is split by a walkway, with row lettering restarting at A behind a balcony
 *   wall. A row A seat sits about 7 m up and 12-17 m back from the front row, so the
 *   lower part is short and shallow. It is modelled as tier 1 (front) plus tier 2 (behind the wall).
 * - From Leazes Level 7 you look down on top of its roof, which falls towards the pitch: about
 *   18 m at the front edge and below 28 m at the back.
 */
const gallowgateProfile = {
  tiers: [
    { id: 1, rows: 14, rakeDeg: 21, cValue: 0 },
    { id: 2, rows: 38, rakeDeg: 24, cValue: 0, setback: 1.2, lift: 1.0, parapet: 1.1 },
  ],
  roof: { ...lowRoof, clearance: 3.5, cantilever: 30, slopeDeg: -8 },
  shellDepth: 7,
};

export const stJamesPark: StadiumConfig = {
  name: "St James' Park (approximate)",
  pitch: { length: 105, width: 68, runoffSide: 5, runoffEnd: 7 },
  bowl: {
    // The real corners are filled in square: rows run straight on and meet at the diagonal.
    // Corner sections split evenly between the two legs, so give corners even counts.
    cornerRadius: 6,
    corners: 'square',
    seatSpacing: 0.5,
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
    NE: tall('Milburn–Leazes corner', 8),
    E: tall('Leazes End', 6),
    SE: { name: 'Leazes–East corner', sections: 4, ...eastProfile },
    S: { name: 'East Stand', sections: 8, ...eastProfile },
    SW: { name: 'Strawberry Corner', sections: 4, ...eastProfile },
    W: { name: 'Gallowgate End', sections: 6, ...gallowgateProfile },
    NW: { name: 'Gallowgate–Milburn corner', sections: 6, ...gallowgateProfile },
  },
};
