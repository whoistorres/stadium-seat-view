import { offsetAt, PIECE_SIDES } from './bowlPath';
import type { SeatRef, Stadium } from './loadData';
import { standOverhangs } from './overhang';

/** What limits the view from one seat, worked out from the seat data and the building shell. */
export interface ViewNotes {
  /**
   * Sightline clearance in mm: how far the line from this seat's eyes to the nearest point of
   * the pitch passes above the eyes of the person in front (or above the front wall, for a
   * front row). Negative = the near touchline is hidden. null when it can't be worked out.
   */
  clearance: number | null;
  /** What the clearance is measured over. */
  over: 'row' | 'wall' | null;
  /** True when a dugout stands in the way of the near touchline. */
  dugout: boolean;
  /** What is overhead: the roof, the tier above, or nothing. */
  covered: 'roof' | 'tier' | null;
  /**
   * Highest angle above eye level you can see towards the pitch before the edge of what is
   * overhead, in degrees. null when nothing overhead reaches out in front of the seat.
   */
  topAngle: number | null;
  /** Horizontal distance to the nearest point of the pitch, metres. */
  toPitch: number;
  /** Horizontal distance to the centre spot, metres. */
  toCentre: number;
  /** Eye height above the pitch, metres. */
  height: number;
}

export function viewNotes(stadium: Stadium, ref: SeatRef): ViewNotes {
  const data = stadium.data;
  const [ex, ey, ez] = stadium.eye(ref);
  const section = stadium.sections[ref.section];

  // Nearest point of the pitch (origin at the centre spot, X along the length).
  const px = Math.max(-data.pitch.length / 2, Math.min(data.pitch.length / 2, ex));
  const pz = Math.max(-data.pitch.width / 2, Math.min(data.pitch.width / 2, ez));
  const toPitch = Math.hypot(ex - px, ez - pz);
  const notes: ViewNotes = {
    clearance: null,
    over: null,
    dugout: false,
    covered: null,
    topAngle: null,
    toPitch,
    toCentre: Math.hypot(ex, ez),
    height: ey,
  };

  // Height of the sightline (eye -> pitch edge, which is at y = 0) at horizontal distance dist from the pitch edge.
  const lineAt = (dist: number) => (ey * dist) / Math.max(toPitch, 1e-6);

  if (ref.row > 0) {
    // The person in front: the nearest seat in the row in front.
    let best = Infinity;
    let head = section.rows[ref.row - 1].seats[0];
    for (const t of section.rows[ref.row - 1].seats) {
      const dist = Math.hypot(t[1] - ex, t[3] - ez);
      if (dist < best) {
        best = dist;
        head = t;
      }
    }
    if (head) {
      const hy = head[2] + data.seat.eyeHeight;
      notes.clearance = (lineAt(Math.hypot(head[1] - px, head[3] - pz)) - hy) * 1000;
      notes.over = 'row';
    }
  }

  const shell = data.shell;
  if (!shell) return notes;
  notes.dugout = (shell.dugouts ?? []).some((dg) => {
    // Walk the sightline to the nearest pitch point and test it against the dugout's box,
    // whose canopy falls from the full height at the back to 3/4 of it at the front.
    const fx = Math.sin(dg.yaw);
    const fz = Math.cos(dg.yaw);
    for (let i = 1; i < 40; i++) {
      const s = i / 40;
      const x = ex + (px - ex) * s;
      const z = ez + (pz - ez) * s;
      const u = (x - dg.x) * -fz + (z - dg.z) * fx;
      const v = (x - dg.x) * fx + (z - dg.z) * fz;
      if (Math.abs(u) > dg.length / 2 || Math.abs(v) > dg.depth / 2) continue;
      const top = dg.y + dg.height * (1 - 0.25 * (v / dg.depth + 0.5));
      if (ey * (1 - s) < top) return true;
    }
    return false;
  });
  const pi = PIECE_SIDES.indexOf(section.side);
  const stand = shell.stands[pi];
  if (!stand) return notes;
  const d = offsetAt(shell.shape, ex, ez);
  const ti = stand.tiers.findIndex((t) => t.id === section.tier);

  if (ref.row === 0 && ti >= 0) {
    // Front row: the front wall of its tier is what the sightline has to clear.
    const tier = stand.tiers[ti];
    const wallDist = toPitch - (d - tier.frontD);
    if (wallDist > 0) {
      notes.clearance = (lineAt(wallDist) - (tier.frontY + tier.parapet)) * 1000;
      notes.over = 'wall';
    }
  }

  // Overhead: the tier above (if it hangs over this seat), else the roof.
  const over = standOverhangs(stand.tiers).find((o) => o.below === ti && d > o.innerD && d <= o.outerD);
  const roof = stand.roof;
  let edge: { d: number; y: number } | null = null;
  if (over) {
    notes.covered = 'tier';
    edge = { d: over.innerD, y: over.y };
  } else if (roof && d > roof.innerD && d <= roof.outerD) {
    notes.covered = 'roof';
    edge = { d: roof.innerD, y: roof.innerY };
  }
  if (edge) notes.topAngle = (Math.atan2(edge.y - ey, d - edge.d) * 180) / Math.PI;
  return notes;
}

/** Sightline guidance: 60 mm acceptable, 90 mm good, 120 mm excellent. */
function clearanceText(n: ViewNotes): string | null {
  if (n.clearance === null) return null;
  const mm = Math.round(n.clearance);
  if (n.over === 'wall') {
    return mm >= 0 ? `Clear over the front wall (${mm} mm)` : `Front wall hides the near touchline (${mm} mm)`;
  }
  if (mm >= 120) return `Excellent over the row in front (${mm} mm)`;
  if (mm >= 90) return `Good over the row in front (${mm} mm)`;
  if (mm >= 60) return `Acceptable over the row in front (${mm} mm)`;
  if (mm >= 0) return `Tight: heads in front may hide the near touchline (${mm} mm)`;
  return `Heads in front hide the near touchline (${mm} mm)`;
}

/** Label/text pairs for the seat card. */
export function describeView(n: ViewNotes): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const sight = clearanceText(n);
  const dugout = 'a dugout hides part of the near touchline';
  if (sight) out.push(['Sightline', n.dugout ? `${sight}; ${dugout}` : sight]);
  else if (n.dugout) out.push(['Sightline', dugout[0].toUpperCase() + dugout.slice(1)]);
  const cover = n.covered === 'tier' ? 'Under the tier above' : n.covered === 'roof' ? 'Under the roof' : 'Open to the sky';
  const what = n.covered === 'tier' ? 'the tier above' : 'the roof edge';
  const angle = n.topAngle === null ? null : Math.round(n.topAngle);
  const top =
    angle === null || angle >= 25
      ? ''
      : angle < 2
        ? `; ${what} is about level with your eyes, so high balls soon go out of sight`
        : `; ${what} cuts the view ${angle}° above eye level, so high balls can go out of sight`;
  out.push(['Cover', cover + top]);
  out.push(['Distance', `${Math.round(n.toPitch)} m to the pitch, ${Math.round(n.toCentre)} m to the centre spot, eyes ${Math.round(n.height)} m up`]);
  return out;
}
