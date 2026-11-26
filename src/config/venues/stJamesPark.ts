import type { BlockBand, RoofConfig, StadiumConfig, StandConfig, StandTier, TierConfig } from '../../data/types';

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
 * - Capacity: the club gives 52,719 (August 2026); the model has about 53,300 (square corners,
 *   0.5 m seats). It has no executive box levels, media seats or wide stair landings.
 * - Blocks: the club's own block map ("Seating Categories", newcastleunited.com, updated
 *   11 August 2026) gives every block's name and position. Its labels repeat between stands
 *   (an L7A in both the Milburn and the Leazes Stand), so each name here carries the stand
 *   prefix used on fan photo tags and ticket sites: MS (Milburn), LS (Leazes), ES (East),
 *   GS (Gallowgate), and for the corners LWC, LEC, GEC and GWC (Leazes West, Leazes East,
 *   Gallowgate East = Strawberry, Gallowgate West).
 * - Rows and seat numbers: from 362 fan photos tagged with block, row and seat on
 *   aviewfrommyseat.com (fetched 26 November 2026; see docs/research/st-james-park.md). Each
 *   band's rows are the furthest-back row seen there, where the stand's shape allows; rows skip
 *   I and O; the lowest levels use doubled letters (AA, BB...). Seats are numbered right to left
 *   along each band, and Level 7 runs on from the Milburn Stand round to the Leazes End.
 * - Rakes, the Level 7 overhang and roof heights are fitted estimates, not survey data. The big
 *   roof is 64.5 m from the back wall to its front edge, a figure published for the real one.
 *
 * - Outside: glazed backs on the tall Milburn/Leazes stands, brick East Stand, clad Gallowgate.
 *   Chosen to read as St James' Park from the overview, not surveyed.
 *
 * Mapping to the generator's compass pieces (the generator runs the pitch along X):
 * N = Milburn (real west), E = Leazes (real north), S = East Stand, W = Gallowgate (real south).
 */

const tiers: TierConfig[] = [
  // Real rakes are not published. Rows steepen towards a 60 mm sightline target (the usual
  // minimum), capped at 35°. The Milburn/Leazes lower tier overrides this (see `tall`).
  // Seats are numbered along the whole stand, right to left as seen from the seat, as fan photo
  // tags show everywhere in the ground.
  { id: 1, name: 'Lower', firstSection: 101, rows: 32, rowDepth: 0.8, rakeDeg: 24, cValue: 60, setback: 0, lift: 1.0, parapet: 0.4, rowLabels: 'letters', seatNumbers: { across: 'stand', from: 'right' } },
  // Upper tier ("Level 7"): LL7 (5 rows) and L7 (23 rows, A-Y) in the Milburn Stand and the
  // corner, from fan photo tags. It hangs far out over the lower tier: placed so that Leazes L7
  // row F (the 14th row, behind L6 and LL7) is where a fan photo from that row puts it, about
  // 40 m behind the goal line and 28 m up. That gives an overhang of about 16 m (an estimate: no
  // plan shows it), with the underside rising over the rows beneath. A fan's "186 steps to row
  // W" fits: row W is about 35 m up.
  { id: 2, name: 'Upper', firstSection: 201, rows: 28, rowDepth: 0.8, rakeDeg: 30, cValue: 60, setback: -16.2, lift: 1.7, parapet: 1.0, rowLabels: 'letters', seatNumbers: { across: 'stand', from: 'right' } },
];

// Cantilever 38.5 m from the back row: with the 26 m concourse behind it, 64.5 m in all.
const bigRoof: RoofConfig = { enabled: true, clearance: 6, cantilever: 38.5, slopeDeg: 3, thickness: 1.2 };
const lowRoof: RoofConfig = { enabled: true, clearance: 5, cantilever: 24, slopeDeg: 4, thickness: 0.8 };

/**
 * Row labels as on St James' Park tickets: no I or O, so A-H, J-N, P-Z (row Y is the 23rd).
 * `double` gives AA, BB, CC... (used at the front of the lowest levels); `from` starts that many
 * letters in, for a band whose lettering runs on from the band in front. Past Z: AA, BB... (or
 * AAA... when doubled), only where the model has more rows than any photo shows.
 */
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const rowLetters = (rows: number, { double = false, from = 0 } = {}): string[] =>
  Array.from({ length: rows }, (_, k) => {
    const i = from + k;
    return LETTERS[i % LETTERS.length].repeat((double ? 2 : 1) + Math.floor(i / LETTERS.length));
  });

/** `rows` rows of blocks, named with the stand's ticket prefix, left to right as seen from the stand. */
const band = (rows: number, prefix: string, blocks: string[], rowLabels: string[] = rowLetters(rows)): BlockBand => ({
  rows,
  blocks: blocks.map((b) => prefix + b),
  rowLabels,
});

/**
 * Milburn, Leazes and their shared corner: the same cross-section so they join seamlessly.
 * The lower tier is 51 rows (Leazes: L1 12, L2 22, L4 17, from fan photo tags), its back third
 * under Level 7. Its sightline target is 20 mm, not 60: with Level 7 where the photo puts it, a
 * 60 mm tier would climb above Level 7's front edge, and about 4,500 seats under it would lose
 * the far side of the pitch. At 20 mm they keep it. The deep concourse keeps the outer wall at
 * the OSM depth (about 73 m from the front row).
 */
const LOWER_ROWS = 51;
const LOWER = { rows: LOWER_ROWS, rakeDeg: 16, cValue: 20 };
/** Floor height of that tier's 13th row (row index 12), where the corner's lower tier starts. */
const LOWER_ROW_13_Y = 5.24;
const tall = (
  name: string,
  lower: BlockBand[],
  upper: BlockBand[],
  geometry: { lower?: Partial<StandTier>; upper?: Partial<StandTier> } = {},
): StandConfig => ({
  name,
  tiers: [
    { id: 1, ...LOWER, ...geometry.lower, bands: lower },
    { id: 2, ...geometry.upper, bands: upper },
  ],
  roof: bigRoof,
  shellDepth: 26,
  facade: 'glass',
});

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
    // Rows from fan photo tags: L1 AA-NN, LL2 to M, L2 to N, L4 doubled letters (seen to QQ, so
    // the model's 13 is a little short). L2 and L4 tags mix single and doubled letters; the
    // commoner one is used.
    N: tall(
      'Milburn Stand',
      [
        band(13, 'MS', ['L1I', 'L1H', 'L1G', 'L1F', 'L1D', 'L1C', 'L1B', 'L1A'], rowLetters(13, { double: true })),
        band(12, 'MS', ['LL2H', 'LL2G', 'LL2F', 'LL2E', 'LL2D', 'LL2C', 'LL2B', 'LL2A']),
        band(13, 'MS', ['L2H', 'L2G', 'L2F', 'L2E', 'L3D', 'L3C', 'L3B', 'L2D', 'L2C', 'L2B', 'L2A']),
        band(13, 'MS', ['L4H', 'L4G', 'L4F', 'L4E', 'L4D', 'L4C', 'L4B', 'L4A'], rowLetters(13, { double: true })),
      ],
      [
        band(5, 'MS', ['LL7H', 'LL7G', 'LL7F', 'LL7E', 'LL7D', 'LL7C', 'LL7B', 'LL7A']),
        band(23, 'MS', ['L7H', 'L7G', 'L7F', 'L7E', 'L7D', 'L7C', 'L7B', 'L7A']),
      ],
    ),
    // Leazes West Corner (LWC). L7C-L7E: the singing section from 2026-27, next to the away end.
    // No L1 here, so its lower tier is the Leazes End's without the 12 L1 rows: it starts 12 rows
    // further back and higher, behind a front wall. Level 7 numbers run on from the Milburn Stand.
    NE: tall(
      'Leazes West Corner',
      [band(22, 'LWC', ['L2D', 'L2C', 'L2B', 'L2A']), band(17, 'LWC', ['L4F', 'L4E', 'L4D', 'L4C', 'L4B', 'L4A'])],
      [band(5, 'LWC', ['LL7E', 'LL7D', 'LL7C', 'LL7B', 'LL7A']), band(23, 'LWC', ['L7E', 'L7D', 'L7C', 'L7B', 'L7A'])],
      {
        lower: { rows: LOWER_ROWS - 12, setback: 12 * 0.8, lift: LOWER_ROW_13_Y },
        upper: { seatNumbers: { across: 'stand', from: 'right', continueFrom: 'N' } },
      },
    ),
    // Left = East Stand end. No L7G or L7I on the club's map. L1 rows run on from the front
    // blocks (AA-FF) to the ones behind (GG-MM). L6 (Park Grill): three rows in front of LL7, so
    // this stand's Level 7 starts three rows further forward and lower than the corner's.
    E: tall(
      'Leazes End',
      [
        band(6, 'LS', ['L1F', 'L1E', 'L1D', 'L1C', 'L1B', 'L1A'], rowLetters(6, { double: true })),
        band(6, 'LS', ['L1L', 'L1K', 'L1J', 'L1I', 'L1H', 'L1G'], rowLetters(6, { double: true, from: 6 })),
        band(22, 'LS', ['L2S', 'L2R', 'L2Q', 'L2SB', 'L2P', 'L2N', 'L2M']),
        band(17, 'LS', ['L4X', 'L4W', 'L4V', 'L4U', 'L4T']),
      ],
      [
        band(3, 'LS', ['L6E', 'L6D', 'L6C', 'L6B', 'L6A']),
        band(5, 'LS', ['LL7M', 'LL7L', 'LL7K', 'LL7J', 'LL7H', 'LL7F']),
        band(23, 'LS', ['L7M', 'L7L', 'L7K', 'L7J', 'L7H', 'L7F']),
      ],
      { upper: { rows: 31, setback: -16.2 - 3 * 0.8, lift: 0.1, seatNumbers: { across: 'stand', from: 'right', continueFrom: 'NE' } } },
    ),
    // Leazes East Corner (LEC). Left = East Stand side. The map's H and J sit one behind the
    // other at the Leazes end. Front blocks lettered AA-MM, the back ones A-R (photo tags).
    SE: eastProfile('Leazes East Corner', band(12, 'LEC', ['F', 'G', 'H', 'J'], rowLetters(12, { double: true })), band(16, 'LEC', ['A', 'B', 'C', 'D', 'E'])),
    // Left = Gallowgate end. No G block on the map. Photo tags reach row R in A-F and row W in
    // H-M ("East Stand Upper"), 37 rows in all: the model's 28-row East Stand is too shallow.
    S: eastProfile('East Stand', band(12, 'ES', ['F', 'E', 'D', 'C', 'B', 'A']), band(16, 'ES', ['M', 'L', 'K', 'J', 'I', 'H'])),
    // Strawberry Corner, the Gallowgate East Corner (GEC). Left = Gallowgate side. Several
    // blocks have safe standing. Back blocks to row U (photo tags).
    SW: eastProfile('Gallowgate East Corner', band(9, 'GEC', ['B', 'A']), band(19, 'GEC', ['F', 'E', 'D', 'C'])),
    // Left = Milburn end. Four bands of blocks; Q (row A behind the balcony wall, from a fan
    // photo) starts the third. No O block. Lower blocks lettered AA... (seen to JJ in F); the
    // back blocks R-V to row U, which a fan calls the back row.
    W: gallowgateProfile(
      'Gallowgate End',
      [band(5, 'GS', ['E', 'D', 'C', 'B', 'A'], rowLetters(5, { double: true })), band(9, 'GS', ['J', 'I', 'H', 'G', 'F'], rowLetters(9, { double: true }))],
      [band(19, 'GS', ['Q', 'P', 'N', 'M', 'L', 'K']), band(19, 'GS', ['V', 'U', 'T', 'S', 'R'])],
    ),
    // Gallowgate West Corner (GWC). Left = Milburn side. One front block (A, doubled letters)
    // round the corner, B-E behind the walkway. Photo tags reach row Y in B-E; the model's 38
    // rows run on past Z.
    NW: gallowgateProfile('Gallowgate West Corner', [band(14, 'GWC', ['A'], rowLetters(14, { double: true }))], [band(38, 'GWC', ['E', 'D', 'C', 'B'])]),
  },
};
