import { bowlPieces, pieceLength, pointOnPiece, type Piece } from './bowlPath.ts';
import { standOverhangs } from './overhang.ts';
import type {
  BowlShape,
  FacadeStyle,
  RoofConfig,
  RoofSpec,
  Row,
  RowLabels,
  SeatNumbering,
  SeatTuple,
  Section,
  ShellSpec,
  StadiumConfig,
  StadiumData,
  StandShell,
  Side,
  StandTier,
  TierConfig,
  TierLayout,
} from './types';

const round = (v: number, places: number) => {
  const f = 10 ** places;
  return Math.round(v * f) / f;
};

/** Front-row gap for each straight stand: its own override, else the pitch-wide run-off. */
function runoffs(cfg: StadiumConfig): { S: number; N: number; E: number; W: number } {
  const st = cfg.stands ?? {};
  return {
    S: st.S?.runoff ?? cfg.pitch.runoffSide,
    N: st.N?.runoff ?? cfg.pitch.runoffSide,
    E: st.E?.runoff ?? cfg.pitch.runoffEnd,
    W: st.W?.runoff ?? cfg.pitch.runoffEnd,
  };
}

const CORNERS = ['SE', 'NE', 'NW', 'SW'] as const;

/** Corners built square: a corner stand's own `corner`, else the bowl-wide `corners`. */
function squareCorners(cfg: StadiumConfig): Array<(typeof CORNERS)[number]> {
  return CORNERS.filter((side) => (cfg.stands?.[side]?.corner ?? cfg.bowl.corners ?? 'round') === 'square');
}

export function bowlShape(cfg: StadiumConfig): BowlShape {
  const r = runoffs(cfg);
  const halfL = cfg.pitch.length / 2;
  const halfW = cfg.pitch.width / 2;
  const xE = halfL + r.E;
  const xW = -(halfL + r.W);
  const zS = halfW + r.S;
  const zN = -(halfW + r.N);
  const hx = (xE - xW) / 2;
  const hz = (zS - zN) / 2;
  const r0 = Math.min(cfg.bowl.cornerRadius, hx, hz);
  const shape: BowlShape = { sx: hx - r0, sz: hz - r0, r0 };
  // Only written when the bowl is off-centre, so symmetric stadiums keep their old JSON.
  const cx = round((xE + xW) / 2, 3);
  const cz = round((zS + zN) / 2, 3);
  if (cx !== 0) shape.cx = cx;
  if (cz !== 0) shape.cz = cz;
  const square = squareCorners(cfg);
  if (square.length) shape.squareCorners = square;
  return shape;
}

/**
 * Closest the front row gets to the pitch. Along the straights that is the run-off; at a
 * rounded corner the arc swings in towards the corner flag, so a large corner radius can
 * bring the front row much closer there. A square corner stays further away than either stand.
 */
export function nearestPitchGap(cfg: StadiumConfig): number {
  return Math.min(...Object.values(pieceGaps(cfg)));
}

/** Closest each piece of the bowl's front row gets to the pitch (Infinity for a square corner). */
function pieceGaps(cfg: StadiumConfig): Record<Side, number> {
  const r = runoffs(cfg);
  const { r0, squareCorners: square = [] } = bowlShape(cfg);
  const corner = (side: (typeof CORNERS)[number], end: number, touch: number) => {
    if (square.includes(side)) return Infinity;
    const flagToArcCentre = Math.hypot(Math.max(0, r0 - end), Math.max(0, r0 - touch));
    return r0 - flagToArcCentre;
  };
  return {
    S: r.S, N: r.N, E: r.E, W: r.W,
    SE: corner('SE', r.E, r.S), NE: corner('NE', r.E, r.N), NW: corner('NW', r.W, r.N), SW: corner('SW', r.W, r.S),
  };
}

/**
 * Distance each piece's rake is designed for. 'shared' (default): the nearest gap anywhere,
 * so stands with the same tier settings get the same cross-section and join seamlessly.
 * 'stand': each straight stand its own touchline or goal line; a corner the nearer of its two
 * neighbours (or its own gap, if closer), so it joins that neighbour seamlessly.
 */
export function sightlineFocal(cfg: StadiumConfig, side: Side): number {
  const gaps = pieceGaps(cfg);
  if ((cfg.bowl.sightlines ?? 'shared') === 'shared') return Math.min(...Object.values(gaps));
  if (side.length === 1) return gaps[side];
  return Math.min(gaps[side], gaps[side[0] as Side], gaps[side[1] as Side]);
}

/** Steepest rake allowed by common stadium safety guidance. */
const MAX_RAKE_DEG = 35;

/**
 * Tier envelopes and the floor height of every row, for one stand's stack of tiers.
 *
 * With `cValue` set, each riser is sized so the sightline from that row to the nearest
 * touchline passes at least C above the eyes of the row in front (the standard sightline
 * design method). That makes rakes slightly parabolic: steeper further back. `rakeDeg`
 * is the minimum and MAX_RAKE_DEG the cap. The focal distance is the stadium-wide nearest
 * gap, so stands that share tier settings also share a cross-section and meet cleanly.
 */
export function tierLayouts(
  cfg: StadiumConfig,
  tiers: TierConfig[] = cfg.tiers,
  focal = nearestPitchGap(cfg),
): Array<TierLayout & { rowY: number[] }> {
  const out: Array<TierLayout & { rowY: number[] }> = [];
  let prevBackD = 0;
  let prevTopY = 0;
  for (const t of tiers) {
    const minRise = t.rowDepth * Math.tan((t.rakeDeg * Math.PI) / 180);
    const maxRise = t.rowDepth * Math.tan((MAX_RAKE_DEG * Math.PI) / 180);
    const c = (t.cValue ?? 0) / 1000;
    const frontD = prevBackD + t.setback;
    const frontY = prevTopY + t.lift;
    const backD = frontD + t.rows * t.rowDepth;

    const rowY = [frontY];
    for (let k = 1; k < t.rows; k++) {
      let rise = minRise;
      if (c > 0) {
        // C = D(N + R)/(D + T) - R, solved for the riser N. R and D belong to the row in front.
        const R = rowY[k - 1] + cfg.eyeHeight;
        const D = focal + frontD + (k - 1) * t.rowDepth + cfg.bowl.seatInset;
        rise = Math.max(minRise, ((R + c) * (D + t.rowDepth)) / D - R);
      }
      rowY.push(rowY[k - 1] + Math.min(maxRise, rise));
    }
    const topY = rowY[rowY.length - 1];
    const rise = t.rows > 1 ? (topY - frontY) / (t.rows - 1) : minRise;
    out.push({ id: t.id, name: t.name, frontD, frontY, backD, topY, rise, rowDepth: t.rowDepth, parapet: t.parapet, rowY });
    prevBackD = backD;
    prevTopY = topY;
  }
  return out;
}

function roofSpec(roof: RoofConfig, shellDepth: number, top: TierLayout): RoofSpec | null {
  if (!roof.enabled) return null;
  const slope = Math.tan((roof.slopeDeg * Math.PI) / 180);
  const baseY = top.topY + roof.clearance;
  const outerD = top.backD + shellDepth;
  const innerD = Math.max(1, top.backD - roof.cantilever);
  return {
    outerD,
    innerD,
    outerY: baseY - shellDepth * slope,
    innerY: baseY + (top.backD - innerD) * slope,
    thickness: roof.thickness,
  };
}

/** A stand with every override applied: what the generator actually builds for one piece. */
export interface ResolvedStand {
  name?: string;
  tiers: TierConfig[];
  /** Sections across each tier, parallel to `tiers`. */
  sections: number[];
  /** Block names across each tier, parallel to `tiers`; undefined = numbered. */
  blocks: Array<string[] | undefined>;
  roof: RoofConfig;
  shellDepth: number;
  facade: FacadeStyle;
}

function withoutUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Applies `cfg.stands` to each piece of the bowl. null = no stand on that piece. */
export function resolveStands(cfg: StadiumConfig, pieces: Piece[] = bowlPieces(bowlShape(cfg))): Array<ResolvedStand | null> {
  return pieces.map((piece) => {
    const o = cfg.stands?.[piece.side];
    if (o === null) return null;
    const list: StandTier[] = o?.tiers ?? cfg.tiers.map((t) => ({ id: t.id }));
    if (list.length === 0) return null;
    const tiers = list.map(({ sections: _sections, blocks: _blocks, ...geometry }) => {
      const base = cfg.tiers.find((t) => t.id === geometry.id);
      if (!base) throw new Error(`stadiumConfig: stand ${piece.side} uses tier ${geometry.id}, which is not in "tiers"`);
      return { ...base, ...withoutUndefined(geometry) };
    });
    return {
      name: o?.name,
      tiers,
      sections: list.map((t) => t.blocks?.length ?? t.sections ?? o?.sections ?? cfg.bowl.sectionsPerZone[piece.zone]),
      blocks: list.map((t) => t.blocks),
      roof: o?.roof === undefined ? cfg.roof : (o.roof ?? { ...cfg.roof, enabled: false }),
      shellDepth: o?.shellDepth ?? cfg.shellDepth,
      facade: o?.facade ?? cfg.exterior?.facade ?? 'concrete',
    };
  });
}

/** Catches tier mistakes in a config with a message that says what to fix. */
function checkTiers(cfg: StadiumConfig): void {
  if (cfg.tiers.length === 0) throw new Error('stadiumConfig: "tiers" needs at least one tier');
  const ids = new Set<number>();
  for (const t of cfg.tiers) {
    if (!Number.isInteger(t.id) || t.id < 1) throw new Error(`stadiumConfig: tier id ${t.id} must be a positive whole number`);
    if (ids.has(t.id)) throw new Error(`stadiumConfig: tier id ${t.id} is used twice in "tiers"`);
    ids.add(t.id);
  }
  for (const t of cfg.tiers) checkRowLabels(t.rowLabels, t.rows, `tier ${t.id}`);
  const checkFirst = (n: SeatNumbering | undefined, where: string) => {
    if (n?.first !== undefined && (!Number.isInteger(n.first) || n.first < 1)) {
      throw new Error(`stadiumConfig: ${where} "seatNumbers.first" must be a whole number of at least 1`);
    }
  };
  for (const t of cfg.tiers) checkFirst(t.seatNumbers, `tier ${t.id}`);
  for (const [side, stand] of Object.entries(cfg.stands ?? {})) for (const t of stand?.tiers ?? []) checkFirst(t.seatNumbers, `stand ${side}, tier ${t.id}`);
  for (const [side, stand] of Object.entries(cfg.stands ?? {})) {
    for (const t of stand?.tiers ?? []) {
      const where = `stand ${side}, tier ${t.id}`;
      if (t.blocks) {
        if (t.blocks.length === 0) throw new Error(`stadiumConfig: ${where} has an empty "blocks" list; leave it out to number the sections`);
        if (t.sections !== undefined && t.sections !== t.blocks.length) {
          throw new Error(`stadiumConfig: ${where} has ${t.blocks.length} blocks but "sections: ${t.sections}"; drop "sections"`);
        }
        for (const b of t.blocks) {
          if (!/^[^\s-]+$/.test(b)) throw new Error(`stadiumConfig: ${where} block "${b}" must be one word with no hyphens`);
        }
      }
      if (t.rowLabels !== undefined) {
        const base = cfg.tiers.find((c) => c.id === t.id);
        checkRowLabels(t.rowLabels, t.rows ?? base?.rows ?? 0, where);
      }
    }
    const list = stand?.tiers?.map((t) => t.id) ?? [];
    list.forEach((id, i) => {
      if (i > 0 && id <= list[i - 1]) {
        throw new Error(`stadiumConfig: stand ${side} lists tiers ${list.join(', ')}; list each tier once, front to back (rising ids)`);
      }
    });
  }
}

function checkRowLabels(labels: RowLabels | undefined, rows: number, where: string): void {
  if (!Array.isArray(labels)) return;
  if (labels.length < rows) throw new Error(`stadiumConfig: ${where} has ${rows} rows but only ${labels.length} "rowLabels"`);
  if (new Set(labels).size !== labels.length) throw new Error(`stadiumConfig: ${where} repeats a row label in "rowLabels"`);
}

/**
 * Renumbers the seats of one tier in one stand (its sections given left to right). Seats stay
 * in left-to-right order in the data; only their numbers change. No rule = 1, 2, 3... per block.
 */
function numberSeats(secs: Section[], rule: SeatNumbering | undefined): void {
  if (!rule || secs.length === 0) return;
  const first = rule.first ?? 1;
  const fromRight = rule.from === 'right';
  const groups = (k: number) => ((rule.across ?? 'block') === 'stand' ? [secs.flatMap((s) => s.rows[k].seats)] : secs.map((s) => s.rows[k].seats));
  for (let k = 0; k < secs[0].rows.length; k++) {
    for (const seats of groups(k)) seats.forEach((t, i) => (t[0] = first + (fromRight ? seats.length - 1 - i : i)));
  }
}

/** Clear height needed between the back row's tread and an overhanging tier's underside. */
const MIN_HEADROOM = 2.4;

/** An overhanging tier must leave headroom over the rows beneath and some of the tier open. */
function checkOverhangs(tiers: TierLayout[], side: string): void {
  for (const o of standOverhangs(tiers)) {
    const below = tiers[o.below];
    const upper = tiers[o.below + 1];
    if (o.innerD <= below.frontD) {
      throw new Error(`stadiumConfig: stand ${side}, tier ${upper.id} overhangs all of tier ${below.id}; make its "setback" less negative`);
    }
    const clear = o.y - below.topY;
    if (clear < MIN_HEADROOM) {
      throw new Error(
        `stadiumConfig: stand ${side}, tier ${upper.id} hangs over tier ${below.id} with only ${clear.toFixed(1)} m ` +
          `above its back row (needs ${MIN_HEADROOM} m); raise its "lift" by ${(MIN_HEADROOM - clear + 0.05).toFixed(1)} m or more`,
      );
    }
  }
}

/** Label of row k (0 = front), or undefined when rows are plain numbers. */
export function rowLabel(labels: RowLabels | undefined, k: number): string | undefined {
  if (Array.isArray(labels)) return labels[k];
  if (labels !== 'letters') return undefined;
  // A..Z, then AA, BB, ... ZZ, then AAA...
  return String.fromCharCode(65 + (k % 26)).repeat(Math.floor(k / 26) + 1);
}

/** Pure function: same config in, same seats (and seat IDs) out. */
export function generateStadium(cfg: StadiumConfig): StadiumData {
  checkTiers(cfg);
  const shape = bowlShape(cfg);
  const pieces = bowlPieces(shape);
  const stands = resolveStands(cfg, pieces);
  const { seatSpacing, aisleWidth, seatInset } = cfg.bowl;

  // Stands with the same tier settings share one cross-section (and so meet without a step).
  const cache = new Map<string, Array<TierLayout & { rowY: number[] }>>();
  const layouts = stands.map((st, pi) => {
    if (!st) return null;
    const focal = sightlineFocal(cfg, pieces[pi].side);
    const key = JSON.stringify([st.tiers, focal]);
    if (!cache.has(key)) cache.set(key, tierLayouts(cfg, st.tiers, focal));
    return cache.get(key)!;
  });

  layouts.forEach((ls, pi) => ls && checkOverhangs(ls, pieces[pi].side));

  // Tier by tier, then round the bowl: section numbers run on within a tier and skip
  // pieces that do not have that tier, and sections that have a block name.
  const sections: Section[] = [];
  for (const tier of cfg.tiers) {
    let sectionNumber = tier.firstSection;
    pieces.forEach((piece, pi) => {
      const st = stands[pi];
      const ti = st ? st.tiers.findIndex((t) => t.id === tier.id) : -1;
      if (!st || ti < 0) return;
      const t = st.tiers[ti];
      const layout = layouts[pi]![ti];
      const count = st.sections[ti];
      const names = st.blocks[ti];
      const firstSection = sections.length;
      // A square corner is two straight legs; sections never wrap round the turn, so the
      // aisle between the legs' blocks runs up the diagonal. The first leg takes the odd one.
      const legs = piece.kind === 'arc' && piece.square ? [Math.ceil(count / 2), Math.floor(count / 2)] : [count];
      for (let s = 0; s < count; s++) {
        const leg = s < legs[0] ? 0 : 1;
        const inLeg = s - (leg ? legs[0] : 0);
        const rows: Row[] = [];
        for (let k = 0; k < t.rows; k++) {
          const d = layout.frontD + k * t.rowDepth + seatInset;
          const y = layout.rowY[k];
          const total = pieceLength(piece, shape, d);
          const legLength = total / legs.length;
          const slice = legLength / legs[leg];
          const n = Math.max(1, Math.floor((slice - aisleWidth) / seatSpacing));
          // Centre the block in its slice; whatever is left over widens the aisles.
          const first = leg * legLength + inLeg * slice + (slice - (n - 1) * seatSpacing) / 2;
          const seats: SeatTuple[] = [];
          for (let i = 0; i < n; i++) {
            const p = pointOnPiece(piece, shape, d, (first + i * seatSpacing) / total);
            const yaw = Math.atan2(-p.nx, -p.nz);
            seats.push([i + 1, round(p.x, 2), round(y, 2), round(p.z, 2), round(yaw, 4)]);
          }
          const label = rowLabel(t.rowLabels, k);
          rows.push(label === undefined ? { n: k + 1, seats } : { n: k + 1, label, seats });
        }
        sections.push({
          id: names ? names[s] : String(sectionNumber++),
          tier: tier.id,
          zone: piece.zone,
          side: piece.side,
          ...(st.name ? { stand: st.name } : {}),
          rowDepth: t.rowDepth,
          rows,
        });
      }
      numberSeats(sections.slice(firstSection), t.seatNumbers);
    });
  }

  const seen = new Map<string, TierConfig['id']>();
  for (const sec of sections) {
    const other = seen.get(sec.id);
    if (other !== undefined) {
      throw new Error(
        `stadiumConfig: section ${sec.id} is used twice (tiers ${other} and ${sec.tier}); ` +
          `rename a block, or move a tier's "firstSection" so the numbers no longer overlap`,
      );
    }
    seen.set(sec.id, sec.tier);
  }

  const shell: ShellSpec = {
    shape,
    stands: pieces.map((piece, pi): StandShell | null => {
      const st = stands[pi];
      const ls = layouts[pi];
      if (!st || !ls) return null;
      const top = ls[ls.length - 1];
      return {
        side: piece.side,
        tiers: ls.map((l) => ({
          ...l,
          frontD: round(l.frontD, 3),
          frontY: round(l.frontY, 3),
          backD: round(l.backD, 3),
          topY: round(l.topY, 3),
          rise: round(l.rise, 4),
          rowY: l.rowY.map((y) => round(y, 2)),
        })),
        outerD: round(top.backD + st.shellDepth, 3),
        roof: roofSpec(st.roof, st.shellDepth, top),
        // Written only when it differs from the default, so plain stadiums keep their old JSON.
        ...(st.facade !== 'concrete' ? { facade: st.facade } : {}),
      };
    }),
    ...(cfg.exterior?.apron !== undefined ? { apron: cfg.exterior.apron } : {}),
  };

  return {
    version: 2,
    name: cfg.name,
    tiers: [...cfg.tiers].sort((a, b) => a.id - b.id).map((t) => ({ id: t.id, name: t.name })),
    pitch: { length: cfg.pitch.length, width: cfg.pitch.width },
    seat: { spacing: seatSpacing, inset: seatInset, aisle: aisleWidth, eyeHeight: cfg.eyeHeight },
    shell,
    sections,
  };
}
