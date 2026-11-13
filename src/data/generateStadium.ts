import { bowlPieces, pieceLength, pointOnPiece } from './bowlPath.ts';
import type {
  BowlShape,
  RoofSpec,
  Row,
  SeatTuple,
  Section,
  ShellSpec,
  StadiumConfig,
  StadiumData,
  TierLayout,
} from './types';

const round = (v: number, places: number) => {
  const f = 10 ** places;
  return Math.round(v * f) / f;
};

export function bowlShape(cfg: StadiumConfig): BowlShape {
  const hx = cfg.pitch.length / 2 + cfg.pitch.runoffEnd;
  const hz = cfg.pitch.width / 2 + cfg.pitch.runoffSide;
  const r0 = Math.min(cfg.bowl.cornerRadius, hx, hz);
  return { sx: hx - r0, sz: hz - r0, r0 };
}

/**
 * Closest the front row gets to the pitch. Along the straights that is the run-off; at a
 * rounded corner the arc swings in towards the corner flag, so a large corner radius can
 * bring the front row much closer there.
 */
export function nearestPitchGap(cfg: StadiumConfig): number {
  const { runoffSide, runoffEnd } = cfg.pitch;
  const r0 = bowlShape(cfg).r0;
  const flagToArcCentre = Math.hypot(Math.max(0, r0 - runoffEnd), Math.max(0, r0 - runoffSide));
  return Math.min(runoffSide, runoffEnd, r0 - flagToArcCentre);
}

/** Steepest rake allowed by common stadium safety guidance. */
const MAX_RAKE_DEG = 35;

/**
 * Tier envelopes and the floor height of every row.
 *
 * With `cValue` set, each riser is sized so the sightline from that row to the nearest
 * touchline passes at least C above the eyes of the row in front (the standard sightline
 * design method). That makes rakes slightly parabolic: steeper further back. `rakeDeg`
 * is the minimum and MAX_RAKE_DEG the cap.
 */
export function tierLayouts(cfg: StadiumConfig): Array<TierLayout & { rowY: number[] }> {
  const out: Array<TierLayout & { rowY: number[] }> = [];
  const focal = nearestPitchGap(cfg);
  let prevBackD = 0;
  let prevTopY = 0;
  for (const t of cfg.tiers) {
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

function roofSpec(cfg: StadiumConfig, top: TierLayout): RoofSpec | null {
  if (!cfg.roof.enabled) return null;
  const slope = Math.tan((cfg.roof.slopeDeg * Math.PI) / 180);
  const baseY = top.topY + cfg.roof.clearance;
  const outerD = top.backD + cfg.shellDepth;
  const innerD = Math.max(1, top.backD - cfg.roof.cantilever);
  return {
    outerD,
    innerD,
    outerY: baseY - cfg.shellDepth * slope,
    innerY: baseY + (top.backD - innerD) * slope,
    thickness: cfg.roof.thickness,
  };
}

/** Pure function: same config in, same seats (and seat IDs) out. */
export function generateStadium(cfg: StadiumConfig): StadiumData {
  const shape = bowlShape(cfg);
  const pieces = bowlPieces(shape);
  const layouts = tierLayouts(cfg);
  const { seatSpacing, aisleWidth, seatInset, sectionsPerZone } = cfg.bowl;
  const sections: Section[] = [];

  cfg.tiers.forEach((tier, ti) => {
    const layout = layouts[ti];
    let sectionNumber = tier.firstSection;

    for (const piece of pieces) {
      const count = sectionsPerZone[piece.zone];
      for (let s = 0; s < count; s++) {
        const rows: Row[] = [];
        for (let k = 0; k < tier.rows; k++) {
          const d = layout.frontD + k * tier.rowDepth + seatInset;
          const y = layout.rowY[k];
          const total = pieceLength(piece, shape, d);
          const slice = total / count;
          const n = Math.max(1, Math.floor((slice - aisleWidth) / seatSpacing));
          // Centre the block in its slice; whatever is left over widens the aisles.
          const first = s * slice + (slice - (n - 1) * seatSpacing) / 2;
          const seats: SeatTuple[] = [];
          for (let i = 0; i < n; i++) {
            const p = pointOnPiece(piece, shape, d, (first + i * seatSpacing) / total);
            const yaw = Math.atan2(-p.nx, -p.nz);
            seats.push([i + 1, round(p.x, 2), round(y, 2), round(p.z, 2), round(yaw, 4)]);
          }
          rows.push({ n: k + 1, seats });
        }
        sections.push({
          id: String(sectionNumber++),
          tier: tier.id,
          zone: piece.zone,
          side: piece.side,
          rowDepth: tier.rowDepth,
          rows,
        });
      }
    }
  });

  const top = layouts[layouts.length - 1];
  const shell: ShellSpec = {
    shape,
    tiers: layouts.map((l) => ({
      ...l,
      frontD: round(l.frontD, 3),
      frontY: round(l.frontY, 3),
      backD: round(l.backD, 3),
      topY: round(l.topY, 3),
      rise: round(l.rise, 4),
      rowY: l.rowY.map((y) => round(y, 2)),
    })),
    outerD: round(top.backD + cfg.shellDepth, 3),
    roof: roofSpec(cfg, top),
  };

  return {
    version: 1,
    name: cfg.name,
    pitch: { length: cfg.pitch.length, width: cfg.pitch.width },
    seat: { spacing: seatSpacing, inset: seatInset, aisle: aisleWidth, eyeHeight: cfg.eyeHeight },
    shell,
    sections,
  };
}
