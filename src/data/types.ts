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
  /** Number of the first section in this tier, e.g. 101. */
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
}

export interface RoofConfig {
  enabled: boolean;
  /** Height of the roof underside above the last row's tread, at the back wall. */
  clearance: number;
  /** How far the roof reaches in over the seats from the back wall. */
  cantilever: number;
  /** Upward slope towards the pitch, degrees. */
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
}

/**
 * Per-stand overrides. A stand is one piece of the bowl: a sideline (N, S), an end (E, W)
 * or a corner (NE, NW, SE, SW). Anything left out falls back to the stadium-wide value.
 */
export interface StandConfig {
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
}

export interface StadiumConfig {
  name: string;
  pitch: { length: number; width: number; runoffSide: number; runoffEnd: number };
  bowl: {
    /** Corner radius of the front-row line; larger = rounder bowl. */
    cornerRadius: number;
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
  /** Ordered left-to-right as seen when facing the pitch. */
  seats: SeatTuple[];
}

export interface Section {
  /** Section label, e.g. "214". */
  id: string;
  tier: TierId;
  zone: Zone;
  side: Side;
  rowDepth: number;
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

export interface TicketData {
  version: 1;
  currency: string;
  categories: PriceCategory[];
  sections: Record<string, { category: CategoryId }>;
  /** sectionId -> sold seat keys in "R12-N07" form. */
  sold: Record<string, string[]>;
}
