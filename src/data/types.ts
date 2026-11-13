export type TierId = 1 | 2 | 3;
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
  tiers: TierConfig[];
  roof: {
    enabled: boolean;
    /** Height of the roof underside above the last row's tread, at the back wall. */
    clearance: number;
    /** How far the roof reaches in over the seats from the back wall. */
    cantilever: number;
    /** Upward slope towards the pitch, degrees. */
    slopeDeg: number;
    thickness: number;
  };
  /** Depth of the concourse/facade ring behind the top tier. */
  shellDepth: number;
  /** Eye height above the seat anchor (row tread level). */
  eyeHeight: number;
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

/** Rounded-rectangle footprint of the front-row line: straight half-lengths plus corner radius. */
export interface BowlShape {
  sx: number;
  sz: number;
  r0: number;
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

/**
 * Optional generic envelope (walls, walkways, facade, roof). A real venue can omit it and
 * supply its own model instead; seats and steps render from `sections` alone.
 */
export interface ShellSpec {
  shape: BowlShape;
  tiers: TierLayout[];
  outerD: number;
  roof: RoofSpec | null;
}

export interface StadiumData {
  version: 1;
  name: string;
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
