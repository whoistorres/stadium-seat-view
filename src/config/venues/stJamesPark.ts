import type { BlockBand, RoofConfig, StadiumConfig, StandConfig, TierConfig } from '../../data/types';

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
 * - Capacity: about 52,300 in published figures; the model has about 52,200 (square corners,
 *   0.5 m seats). It has no executive box levels, media seats or wide stair landings, so the
 *   close match is partly luck.
 * - Blocks: the club's own block map ("Seating Categories", newcastleunited.com, updated
 *   11 August 2026) gives every block's name and position. Its labels repeat between stands
 *   (an L7A in both the Milburn and the Leazes Stand), so each name here carries the stand
 *   prefix ticket sites use: MS (Milburn), LS (Leazes, including the Milburn-Leazes corner),
 *   ES (East), GS (Gallowgate), and NE / SE / SW for the Leazes-East, Strawberry (Gallowgate-
 *   East) and Gallowgate-Milburn corners, named by their real compass points.
 *   Where a stand's rows hold several bands of blocks (L1 in front of L2, LL7 in front of L7),
 *   the rows per band are estimates from the map's proportions: the map gives no row counts.
 *   Rows are lettered and start again at A in each band, also an assumption.
 * - Row counts, rakes and roof sizes are fitted estimates, not survey data.
 *
 * - Outside: glazed backs on the tall Milburn/Leazes stands, brick East Stand, clad Gallowgate.
 *   Chosen to read as St James' Park from the overview, not surveyed.
 *
 * Mapping to the generator's compass pieces (the generator runs the pitch along X):
 * N = Milburn (real west), E = Leazes (real north), S = East Stand, W = Gallowgate (real south).
 */

const tiers: TierConfig[] = [
  // Real rakes are not published. Rows steepen towards a 60 mm sightline target (the usual
  // minimum), capped at 35°. The tall upper tier hits that cap, so its near-touchline
  // clearance stays low (about 14–25 mm): check against real seat photos before relying on it.
  { id: 1, name: 'Lower', firstSection: 101, rows: 32, rowDepth: 0.8, rakeDeg: 24, cValue: 60, setback: 0, lift: 1.0, parapet: 0.4, rowLabels: 'letters' },
  // Upper tier ("Level 7") sits above the executive box levels and hangs out over the back of
  // the lower tier. Lift checked against a fan photo from Leazes Level 7 row F: eye about
  // 27-28 m above the pitch. The 4 m overhang is an estimate: no photo or plan shows it yet.
  { id: 2, name: 'Upper', firstSection: 201, rows: 46, rowDepth: 0.8, rakeDeg: 30, cValue: 60, setback: -4, lift: 9.0, parapet: 1.0, rowLabels: 'letters' },
];

const bigRoof: RoofConfig = { enabled: true, clearance: 6, cantilever: 43, slopeDeg: 3, thickness: 1.2 };
const lowRoof: RoofConfig = { enabled: true, clearance: 5, cantilever: 24, slopeDeg: 4, thickness: 0.8 };

/**
 * Milburn, Leazes and their shared corner: same cross-section so they join seamlessly. The
 * deep concourse keeps the outer wall at the OSM depth (about 72 m) now the upper tier
 * starts further forward.
 */
const tall = (name: string, lower: BlockBand[], upper: BlockBand[]): StandConfig => ({
  name,
  tiers: [
    { id: 1, bands: lower },
    { id: 2, bands: upper },
  ],
  roof: bigRoof,
  shellDepth: 14,
  facade: 'glass',
});

/** `rows` rows of blocks, named with the stand's ticket prefix, left to right as seen from the stand. */
const band = (rows: number, prefix: string, blocks: string[]): BlockBand => ({ rows, blocks: blocks.map((b) => prefix + b) });

/** Single-tier stands; a corner gets the same cross-section as the stand it continues. */
const eastProfile = (name: string, front: BlockBand, back: BlockBand): StandConfig => ({
  name,
  tiers: [{ id: 1, rows: 28, bands: [front, back] }],
  roof: { ...lowRoof, cantilever: 22 },
  shellDepth: 6,
  facade: 'brick',
});
/*
 * Gallowgate End, checked against two fan photos:
 * - Its seating is split by a walkway, with row lettering restarting at A behind a balcony
 *   wall. A row A seat sits about 7 m up and 12-17 m back from the front row, so the
 *   lower part is short and shallow. It is modelled as tier 1 (front) plus tier 2 (behind the wall).
 * - From Leazes Level 7 you look down on top of its roof, which falls towards the pitch: about
 *   18 m at the front edge and below 28 m at the back.
 */
const gallowgateProfile = (name: string, front: BlockBand[], back: BlockBand[]): StandConfig => ({
  name,
  tiers: [
    { id: 1, rows: 14, rakeDeg: 21, cValue: 0, bands: front },
    { id: 2, rows: 38, rakeDeg: 24, cValue: 0, setback: 1.2, lift: 1.0, parapet: 1.1, bands: back },
  ],
  roof: { ...lowRoof, clearance: 3.5, cantilever: 30, slopeDeg: -8 },
  shellDepth: 7,
  facade: 'panels',
});

export const stJamesPark: StadiumConfig = {
  name: "St James' Park (approximate)",
  pitch: { length: 105, width: 68, runoffSide: 5, runoffEnd: 7 },
  bowl: {
    // The real corners are filled in square: rows run straight on and meet at the diagonal.
    // Corner sections split between the two legs; a lone block covers both.
    cornerRadius: 6,
    corners: 'square',
    seatSpacing: 0.5,
    aisleWidth: 1.2,
    seatInset: 0.5,
    // Unused: every stand lists its real blocks.
    sectionsPerZone: { sideline: 8, end: 5, corner: 3 },
  },
  tiers,
  roof: lowRoof,
  shellDepth: 8,
  eyeHeight: 1.2,
  // Big screens for 2026-27. The club's Fan Advisory Board minutes (meeting of 8 June 2026,
  // published 3 July) confirm a Gallowgate screen; press reports of the same meeting add one in
  // Strawberry Corner and a replacement for the Leazes End screen. The club also installed four
  // smaller in-bowl replay screens (21 August 2026), positions not given, not modelled.
  // Positions along each stand and the 14 x 6 m size are placeholders. The minutes say the
  // Gallowgate screen faces "outward"; modelled facing the pitch until a photo shows otherwise.
  details: {
    scoreboards: [{ stand: 'E' }, { stand: 'W' }, { stand: 'SW' }],
  },
  // Black and white stripes (most fans), some plain black or white. Away fans: the club's block
  // map marks the whole straight Leazes Level 7 (blocks L7F-L7M and LL7F-LL7M) as visiting
  // supporters. The usual league allocation is up to about 3,000, fewer than the area holds.
  crowd: {
    home: ['#111111/#f2f2f2', '#111111/#f2f2f2', '#111111/#f2f2f2', '#111111', '#f2f2f2'],
    away: ['#d4122a'],
    awaySections: ['M', 'L', 'K', 'J', 'H', 'F'].flatMap((b) => [`LSLL7${b}`, `LSL7${b}`]),
  },
  stands: {
    // Left = Leazes end. L1 has no E block: the players' tunnel takes its place at halfway.
    // LL2 (Bar 1892) are the front rows of the L2 (Platinum Club) blocks; the directors' box
    // (L3B-L3D) sits between the L2 halves. LL7 are the front rows of the Level 7 blocks.
    N: tall(
      'Milburn Stand',
      [
        band(8, 'MS', ['L1I', 'L1H', 'L1G', 'L1F', 'L1D', 'L1C', 'L1B', 'L1A']),
        band(4, 'MS', ['LL2H', 'LL2G', 'LL2F', 'LL2E', 'LL2D', 'LL2C', 'LL2B', 'LL2A']),
        band(14, 'MS', ['L2H', 'L2G', 'L2F', 'L2E', 'L3D', 'L3C', 'L3B', 'L2D', 'L2C', 'L2B', 'L2A']),
        band(6, 'MS', ['L4H', 'L4G', 'L4F', 'L4E', 'L4D', 'L4C', 'L4B', 'L4A']),
      ],
      [
        band(6, 'MS', ['LL7H', 'LL7G', 'LL7F', 'LL7E', 'LL7D', 'LL7C', 'LL7B', 'LL7A']),
        band(40, 'MS', ['L7H', 'L7G', 'L7F', 'L7E', 'L7D', 'L7C', 'L7B', 'L7A']),
      ],
    ),
    // Leazes Stand numbering. L7C-L7E: the singing section from 2026-27, next to the away end.
    NE: tall(
      'Milburn–Leazes corner',
      [band(18, 'LS', ['L2D', 'L2C', 'L2B', 'L2A']), band(14, 'LS', ['L4F', 'L4E', 'L4D', 'L4C', 'L4B', 'L4A'])],
      [band(6, 'LS', ['LL7E', 'LL7D', 'LL7C', 'LL7B', 'LL7A']), band(40, 'LS', ['L7E', 'L7D', 'L7C', 'L7B', 'L7A'])],
    ),
    // Left = East Stand end. No L7G or L7I on the club's map. L6: Park Grill, in front of Level 7.
    E: tall(
      'Leazes End',
      [
        band(6, 'LS', ['L1F', 'L1E', 'L1D', 'L1C', 'L1B', 'L1A']),
        band(7, 'LS', ['L1L', 'L1K', 'L1J', 'L1I', 'L1H', 'L1G']),
        band(11, 'LS', ['L2S', 'L2R', 'L2Q', 'L2SB', 'L2P', 'L2N', 'L2M']),
        band(8, 'LS', ['L4X', 'L4W', 'L4V', 'L4U', 'L4T']),
      ],
      [
        band(3, 'LS', ['L6E', 'L6D', 'L6C', 'L6B', 'L6A']),
        band(6, 'LS', ['LL7M', 'LL7L', 'LL7K', 'LL7J', 'LL7H', 'LL7F']),
        band(37, 'LS', ['L7M', 'L7L', 'L7K', 'L7J', 'L7H', 'L7F']),
      ],
    ),
    // Left = East Stand side. The map's H and J sit one behind the other at the Leazes end.
    SE: eastProfile('Leazes–East corner', band(10, 'NE', ['F', 'G', 'H', 'J']), band(18, 'NE', ['A', 'B', 'C', 'D', 'E'])),
    // Left = Gallowgate end. No G block on the map.
    S: eastProfile('East Stand', band(11, 'ES', ['F', 'E', 'D', 'C', 'B', 'A']), band(17, 'ES', ['M', 'L', 'K', 'J', 'I', 'H'])),
    // Left = Gallowgate side. Several blocks have safe standing.
    SW: eastProfile('Strawberry Corner', band(10, 'SE', ['B', 'A']), band(18, 'SE', ['F', 'E', 'D', 'C'])),
    // Left = Milburn end. Four bands of blocks; Q (row A behind the balcony wall, from a fan
    // photo) starts the third. No O block.
    W: gallowgateProfile(
      'Gallowgate End',
      [band(7, 'GS', ['E', 'D', 'C', 'B', 'A']), band(7, 'GS', ['J', 'I', 'H', 'G', 'F'])],
      [band(17, 'GS', ['Q', 'P', 'N', 'M', 'L', 'K']), band(21, 'GS', ['V', 'U', 'T', 'S', 'R'])],
    ),
    // Left = Milburn side. One front block (A) round the corner, B-E behind the walkway.
    NW: gallowgateProfile('Gallowgate–Milburn corner', [band(14, 'SW', ['A'])], [band(38, 'SW', ['E', 'D', 'C', 'B'])]),
  },
};
