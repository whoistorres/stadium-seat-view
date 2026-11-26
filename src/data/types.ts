/**
 * Tier number: any positive integer, unique within a stadium. Higher numbers sit further back
 * and higher up (1 = front tier); the numbers need not be consecutive.
 */
export type TierId = number;
export type Zone = 'sideline' | 'end' | 'corner';
export type Side = 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';

/* ---------- Generator input (src/config/stadiumConfig.ts) ---------- */

export interface TierConfig {
  id: TierId;
  name: string;
  /** Number of the first section in this tier, e.g. 101. Stands with `blocks` use names instead. */
  firstSection: number;
  rows: number;
  /** Tread depth per row, metres. */
  rowDepth: number;
  /** Minimum rake angle in degrees; riser = rowDepth * tan(rake). */
  rakeDeg: number;
  /**
   * Target sightline clearance (C-value) in millimetres over the eyes of the row in front,
   * measured to the nearest touchline. Risers grow where needed to meet it. Omit for a constant rake.
   */
  cValue?: number;
  /** Horizontal walkway between the previous tier's back and this tier's front. */
  setback: number;
  /** Vertical rise from the previous tier's last tread (or pitch level) to this tier's first tread. */
  lift: number;
  /** Height of the front wall above the first tread. */
  parapet: number;
  /**
   * How rows are labelled, front to back. 'numbers' (default): 1, 2, 3... 'letters': A to Z,
   * then AA, BB, CC... An array gives every row's label in order, e.g. to skip I and O.
   */
  rowLabels?: RowLabels;
  /** How seats are numbered along each row. Default: 1, 2, 3... from the left in every block. */
  seatNumbers?: SeatNumbering;
}

export type RowLabels = 'numbers' | 'letters' | string[];

export interface SeatNumbering {
  /** 'block' (default): numbering starts again in each block. 'stand': it runs on along the stand's whole row. */
  across?: 'block' | 'stand';
  /** Number of the first seat. Default 1. */
  first?: number;
  /** Which end the first seat is at, as seen sitting in the stand facing the pitch. Default 'left'. */
  from?: 'left' | 'right';
  /**
   * Carry the numbers on from the neighbouring stand on this side (e.g. round a corner): each
   * row starts one after the highest number in the matching row of that stand's same tier.
   * Bands of blocks are matched from the back of the tier (back band to back band); a band with
   * no match starts at 1. Use with `across: 'stand'`, without `first`.
   */
  continueFrom?: Side;
}

export interface RoofConfig {
  enabled: boolean;
  /** Height of the roof underside above the last row's tread, at the back wall. */
  clearance: number;
  /** How far the roof reaches in over the seats from the back wall. */
  cantilever: number;
  /** Upward slope towards the pitch, degrees. Negative = the roof falls towards the pitch. */
  slopeDeg: number;
  thickness: number;
}

/** Geometry fields of a tier that a single stand may change. */
export type TierGeometry = Pick<TierConfig, 'rows' | 'rowDepth' | 'rakeDeg' | 'cValue' | 'setback' | 'lift' | 'parapet'>;

/** One tier as it exists in one stand: the global tier with this id, with any fields replaced. */
export interface StandTier extends Partial<TierGeometry> {
  id: TierId;
  /** Sections across this tier in this stand. Overrides the stand's and the zone's count. */
  sections?: number;
  /**
   * Real block names for this tier in this stand, left to right as seen sitting in the stand
   * facing the pitch. Sets the section count and replaces the generated numbers. No hyphens.
   */
  blocks?: string[];
  /**
   * For a tier whose rows are split into separately named blocks stacked front to back (e.g. a
   * band of "L1" blocks in front of a band of "L2" blocks): each band takes `rows` rows and has
   * its own `blocks`, left to right. The bands' rows must add up to the tier's. Row numbers and
   * labels start again in each band unless the band gives its own `rowLabels`. Replaces `blocks`
   * and `sections`.
   */
  bands?: BlockBand[];
  /** Row labels in this stand, if they differ from the tier's. */
  rowLabels?: RowLabels;
  /** Seat numbering in this stand, if it differs from the tier's. */
  seatNumbers?: SeatNumbering;
}

export interface BlockBand {
  /** Rows in this band. */
  rows: number;
  /** Block names across the band, left to right as seen sitting in the stand facing the pitch. */
  blocks: string[];
  /** Row labels in this band, front to back, if they differ from the tier's (e.g. "GG" onwards). */
  rowLabels?: RowLabels;
}

/**
 * Per-stand overrides. A stand is one piece of the bowl: a sideline (N, S), an end (E, W)
 * or a corner (NE, NW, SE, SW). Anything left out falls back to the stadium-wide value.
 */
export interface StandConfig {
  /** Display name, e.g. "Milburn Stand". Shown instead of the compass position. */
  name?: string;
  /** Tiers present in this stand, front to back. Omit for all of the stadium's tiers. */
  tiers?: StandTier[];
  /** Sections per tier in this stand. */
  sections?: number;
  /** null = this stand has no roof. */
  roof?: RoofConfig | null;
  shellDepth?: number;
  /**
   * Gap from the touchline (N, S) or goal line (E, W) to the front of this stand. Ignored on
   * corners, which follow the stands either side.
   */
  runoff?: number;
  /** Corners only: 'square' carries both neighbouring stands' rows straight into the corner. */
  corner?: CornerStyle;
  /** Look of this stand's outer wall; falls back to `exterior.facade`. */
  facade?: FacadeStyle;
}

/** Shirt: one colour ('#c8102e'), or two for vertical stripes ('#111111/#f2f2f2'). */
export type Kit = string;

export interface CrowdColours {
  /** Home shirts; list a kit more than once to make it more common. */
  home: Kit[];
  /** Away shirts, worn in `awaySections`. */
  away?: Kit[];
  /** Section labels (block names or numbers) of the away end. */
  awaySections?: string[];
}

export interface ScoreboardConfig {
  /** Stand it sits on. */
  stand: Side;
  /** Position along the stand, 0 = left end to 1 = right end as seen sitting in it facing the pitch. Default 0.5. */
  at?: number;
  /** Screen size in metres. Defaults 14 × 6. */
  width?: number;
  height?: number;
}

/**
 * Outer wall finish, drawn in flat colours. 'concrete' (default): plain grey. 'glass': curtain
 * wall with floor bands and mullions, lit at night. 'panels': light cladding with joint lines.
 * 'brick': brick with lighter courses.
 */
export type FacadeStyle = 'concrete' | 'glass' | 'panels' | 'brick';

/**
 * 'round': rows curve round the corner (radius grows with each row). 'square': rows run
 * straight on and meet the other stand's rows at the diagonal, as in a filled-in corner.
 */
export type CornerStyle = 'round' | 'square';

export interface StadiumConfig {
  name: string;
  pitch: { length: number; width: number; runoffSide: number; runoffEnd: number };
  bowl: {
    /** Corner radius of the front-row line; larger = rounder bowl. */
    cornerRadius: number;
    /** Shape of every corner unless a corner stand sets its own `corner`. Default 'round'. */
    corners?: CornerStyle;
    /**
     * What each stand's rake is designed for. 'shared' (default): the nearest point the front row
     * gets to the pitch anywhere, so matching stands join seamlessly. 'stand': each stand its own
     * touchline or goal line (corners follow their nearer neighbour), for grounds of separate stands.
     */
    sightlines?: 'shared' | 'stand';
    /** Centre-to-centre seat spacing along a row. */
    seatSpacing: number;
    /** Stair aisle width between neighbouring sections. */
    aisleWidth: number;
    /** Distance from the tread's front edge to the seat anchor. */
    seatInset: number;
    sectionsPerZone: Record<Zone, number>;
  };
  /** Stadium-wide tiers: ids, names, section numbering and the default geometry. */
  tiers: TierConfig[];
  roof: RoofConfig;
  /** Depth of the concourse/facade ring behind the top tier. */
  shellDepth: number;
  /** Eye height above the seat anchor (row tread level). */
  eyeHeight: number;
  /** Outside of the building. */
  exterior?: {
    /** Outer wall finish for every stand that doesn't set its own. Default 'concrete'. */
    facade?: FacadeStyle;
    /** Width of the paved apron round the outer walls, metres. Default 15; 0 for none. */
    apron?: number;
  };
  /** Team colours worn by the crowd. Omitted: a generic mix of colours. */
  crowd?: CrowdColours;
  /** Pitchside and stand details. */
  details?: {
    /**
     * Big screens, standing on the front of a stand's roof (or on its back wall without one).
     * Default: one in the middle of each end stand (E, W) that exists. [] for none.
     */
    scoreboards?: ScoreboardConfig[];
    /** Touchline the team dugouts are on, either side of the halfway line. Default 'N'; null for none. */
    dugouts?: 'N' | 'S' | null;
  };
  /**
   * Per-stand overrides. A missing stand uses the stadium-wide values; `null` leaves that
   * piece of the bowl empty (an open corner, or no stand behind a goal).
   */
  stands?: Partial<Record<Side, StandConfig | null>>;
}

/* ---------- stadium.json: everything the renderer consumes ---------- */

/** [seat number, x, y, z, yaw]. y is the row's tread level; yaw is rotation about Y so local +Z faces the pitch. */
export type SeatTuple = [n: number, x: number, y: number, z: number, yaw: number];

export interface Row {
  n: number;
  /** Row name as printed on tickets, e.g. "F". Omitted when it is just the number. */
  label?: string;
  /** Ordered left-to-right as seen when facing the pitch. */
  seats: SeatTuple[];
}

export interface Section {
  /** Section label: the block name if the config gives one, else a number such as "214". */
  id: string;
  tier: TierId;
  zone: Zone;
  side: Side;
  /** Name of the stand the section is in, e.g. "Milburn Stand". Optional. */
  stand?: string;
  rowDepth: number;
  /**
   * Rows of the same tier in front of this section's first row, when the tier is split into
   * bands of blocks (StandTier.bands). Omitted = 0: the section starts at the tier's front.
   */
  rowOffset?: number;
  rows: Row[];
}

/**
 * Rounded-rectangle footprint of the front-row line: straight half-lengths plus corner radius,
 * centred on (cx, cz). The centre moves off the centre spot when opposite stands sit at
 * different distances from the pitch.
 */
export interface BowlShape {
  sx: number;
  sz: number;
  r0: number;
  cx?: number;
  cz?: number;
  /**
   * Corners built square instead of round: each row runs straight on along both stands and
   * the two meet at the diagonal. Offsetting keeps the corner square. Omitted = all round.
   */
  squareCorners?: Array<'SE' | 'NE' | 'NW' | 'SW'>;
}

/** Resolved tier envelope. d = horizontal offset outward from the front-row line, y = height. */
export interface TierLayout {
  id: TierId;
  name: string;
  frontD: number;
  frontY: number;
  backD: number;
  topY: number;
  /** Average riser height. */
  rise: number;
  rowDepth: number;
  parapet: number;
  /** Floor height of each row (rakes may be non-linear). Optional for hand-made data. */
  rowY?: number[];
}

export interface RoofSpec {
  outerD: number;
  innerD: number;
  outerY: number;
  innerY: number;
  thickness: number;
}

/** Cross-section of one stand's building: tiers, back of the facade and roof. */
export interface StandShell {
  side: Side;
  tiers: TierLayout[];
  outerD: number;
  roof: RoofSpec | null;
  /** Outer wall finish; omitted = 'concrete'. */
  facade?: FacadeStyle;
}

/**
 * Optional generic envelope (walls, walkways, facade, roof). A real venue can omit it and
 * supply its own model instead; seats and steps render from `sections` alone.
 */
export interface ShellSpec {
  shape: BowlShape;
  /**
   * One entry per piece of the bowl, in path order: S, SE, E, NE, N, NW, W, SW (see
   * bowlPieces). null = no stand there.
   */
  stands: Array<StandShell | null>;
  /** Width of the paved apron round the outer walls; omitted = 15 m, 0 = none. */
  apron?: number;
  /** Big screens. Omitted = none. */
  scoreboards?: ScoreboardSpec[];
  /** Team dugouts by the touchline. Omitted = none. */
  dugouts?: DugoutSpec[];
}

/** A box standing at (x, y, z), rotated by yaw about Y so its local +Z faces the pitch. */
interface Placed {
  x: number;
  /** Height of its base. */
  y: number;
  z: number;
  yaw: number;
}

export interface ScoreboardSpec extends Placed {
  width: number;
  height: number;
}

export interface DugoutSpec extends Placed {
  /** Along the touchline. */
  length: number;
  /** Back to front. */
  depth: number;
  /** Height at the back; the canopy slopes down towards the pitch. */
  height: number;
}

/** stadium.json version 1 shell: one cross-section all the way round. Upgraded on load. */
export interface LegacyShellSpec {
  shape: BowlShape;
  tiers: TierLayout[];
  outerD: number;
  roof: RoofSpec | null;
}

/** Name of a tier for the UI, e.g. { id: 2, name: 'Middle' }. */
export interface TierInfo {
  id: TierId;
  name: string;
}

export interface StadiumData {
  version: 2;
  name: string;
  /** Tier names, front to back. Optional: without it the UI derives names from the tier count. */
  tiers?: TierInfo[];
  pitch: { length: number; width: number };
  /** Rendering hints for building steps from seat rows. */
  seat: { spacing: number; inset: number; aisle: number; eyeHeight: number };
  shell: ShellSpec | null;
  sections: Section[];
  /** Team colours for the crowd. Omitted: a generic mix. */
  crowd?: CrowdColours;
}

/* ---------- tickets.json ---------- */

export type CategoryId = 'A' | 'B' | 'C' | 'D';

export interface PriceCategory {
  id: CategoryId;
  label: string;
  price: number;
  /** CSS hex colour. */
  color: string;
  /** Non-colour cue shown next to the swatch. */
  pattern: 'solid' | 'stripes' | 'dots' | 'cross';
}

/**
 * Seat prices along each row as runs of [price, number of seats], front row first, seats left to
 * right as seen facing the pitch. One run per row gives per-row pricing; any mix gives per-seat.
 */
export type PriceRuns = Array<Array<[price: number, seats: number]>>;

export interface TicketSection {
  /** Price zone: colour, label and the price used where `prices` is omitted. */
  category: CategoryId;
  /** Per-row or per-seat prices. Omitted: every seat costs the category price. */
  prices?: PriceRuns;
}

export interface TicketData {
  version: 1;
  currency: string;
  categories: PriceCategory[];
  sections: Record<string, TicketSection>;
  /** sectionId -> sold seat keys in "R12-N07" form. */
  sold: Record<string, string[]>;
}
