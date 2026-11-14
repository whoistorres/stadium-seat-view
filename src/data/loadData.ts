import { PIECE_SIDES } from './bowlPath';
import { seatId } from './seatId';
import type { LegacyShellSpec, SeatTuple, Section, ShellSpec, StadiumData, TierId } from './types';

/** Index-based reference to a seat: positions into sections[] / rows[] / seats[]. */
export interface SeatRef {
  section: number;
  row: number;
  seat: number;
}

export interface SectionMeta {
  /** Instance index of the first seat of each row within the section's InstancedMesh. */
  rowStart: number[];
  seatCount: number;
  centre: [number, number, number];
  /** Unit vector from the section towards the pitch (average seat facing). */
  facing: [number, number];
  radius: number;
}

export type Direction = 'left' | 'right' | 'forward' | 'back';

/** Names used when the data does not name its tiers, by number of tiers. */
const DEFAULT_TIER_NAMES: Record<number, string[]> = {
  1: ['Main'],
  2: ['Lower', 'Upper'],
  3: ['Lower', 'Middle', 'Upper'],
};

export class Stadium {
  readonly sections: Section[];
  readonly meta: SectionMeta[];
  readonly totalSeats: number;
  /** Distinct tier numbers in the data, front to back. */
  readonly tierIds: TierId[];
  private readonly byId = new Map<string, number>();
  private readonly tierNames = new Map<TierId, string>();

  constructor(readonly data: StadiumData) {
    this.sections = data.sections;
    this.meta = data.sections.map((s) => sectionMeta(s));
    this.totalSeats = this.meta.reduce((n, m) => n + m.seatCount, 0);
    data.sections.forEach((s, i) => this.byId.set(s.id, i));
    this.tierIds = [...new Set(data.sections.map((s) => s.tier))].sort((a, b) => a - b);
    const fallback = DEFAULT_TIER_NAMES[this.tierIds.length];
    this.tierIds.forEach((id, i) => {
      const named =
        data.tiers?.find((t) => t.id === id)?.name ??
        data.shell?.stands.flatMap((s) => s?.tiers ?? []).find((t) => t.id === id)?.name;
      this.tierNames.set(id, named ?? fallback?.[i] ?? `Tier ${id}`);
    });
  }

  /** Position of a tier from the front: 0 = front tier. */
  tierIndex(id: TierId): number {
    return this.tierIds.indexOf(id);
  }

  tierName(id: TierId): string {
    return this.tierNames.get(id) ?? `Tier ${id}`;
  }

  sectionIndex(id: string): number {
    return this.byId.get(id) ?? -1;
  }

  tuple(ref: SeatRef): SeatTuple {
    return this.sections[ref.section].rows[ref.row].seats[ref.seat];
  }

  id(ref: SeatRef): string {
    const s = this.sections[ref.section];
    return seatId(s.id, s.rows[ref.row].n, s.rows[ref.row].seats[ref.seat][0]);
  }

  instanceIndex(ref: SeatRef): number {
    return this.meta[ref.section].rowStart[ref.row] + ref.seat;
  }

  refFromInstance(section: number, instance: number): SeatRef {
    const starts = this.meta[section].rowStart;
    let row = starts.length - 1;
    while (row > 0 && starts[row] > instance) row--;
    return { section, row, seat: instance - starts[row] };
  }

  refFromNumbers(sectionId: string, rowN: number, seatN: number): SeatRef | null {
    const section = this.sectionIndex(sectionId);
    if (section < 0) return null;
    const row = this.sections[section].rows.findIndex((r) => r.n === rowN);
    if (row < 0) return null;
    const seat = this.sections[section].rows[row].seats.findIndex((s) => s[0] === seatN);
    return seat < 0 ? null : { section, row, seat };
  }

  /** Eye position for the seat view. */
  eye(ref: SeatRef): [number, number, number] {
    const t = this.tuple(ref);
    return [t[1], t[2] + this.data.seat.eyeHeight, t[3]];
  }

  /**
   * Nearest acceptable seat in a direction, as seen facing the pitch. Works from positions
   * rather than indices, so it crosses aisles, section boundaries and tiers.
   */
  neighbour(ref: SeatRef, dir: Direction, accept: (r: SeatRef) => boolean = () => true): SeatRef | null {
    const t = this.tuple(ref);
    const fx = Math.sin(t[4]);
    const fz = Math.cos(t[4]);
    const along = dir === 'left' || dir === 'right';
    const sign = dir === 'right' || dir === 'forward' ? 1 : -1;
    // Unit vector of travel: right = (-fz, fx); forward = (fx, fz).
    const ux = along ? -fz * sign : fx * sign;
    const uz = along ? fx * sign : fz * sign;
    const reach = along ? 12 : 8;

    let best: SeatRef | null = null;
    let bestScore = Infinity;
    this.sections.forEach((section, si) => {
      const m = this.meta[si];
      if (Math.hypot(m.centre[0] - t[1], m.centre[2] - t[3]) > m.radius + reach) return;
      section.rows.forEach((row, ri) => {
        const dy = (row.seats[0]?.[2] ?? 0) - t[2];
        // Sideways moves stay on the same row level; row moves must change level.
        if (along ? Math.abs(dy) > 0.05 : Math.abs(dy) < 0.05 || Math.abs(dy) > 3.5) return;
        row.seats.forEach((s, ki) => {
          const dx = s[1] - t[1];
          const dz = s[3] - t[3];
          const forwardness = dx * ux + dz * uz;
          if (forwardness < 0.2) return;
          const sideways = Math.abs(dx * -uz + dz * ux);
          if (along ? sideways > 1.5 : sideways > 2.5) return;
          const score = along ? forwardness : forwardness + sideways * 2 + Math.abs(dy);
          if (score >= bestScore || forwardness > reach) return;
          const cand = { section: si, row: ri, seat: ki };
          if (!accept(cand)) return;
          best = cand;
          bestScore = score;
        });
      });
    });
    return best;
  }
}

function sectionMeta(section: Section): SectionMeta {
  const rowStart: number[] = [];
  let count = 0;
  let cx = 0, cy = 0, cz = 0, fx = 0, fz = 0;
  for (const row of section.rows) {
    rowStart.push(count);
    for (const s of row.seats) {
      cx += s[1];
      cy += s[2];
      cz += s[3];
      fx += Math.sin(s[4]);
      fz += Math.cos(s[4]);
    }
    count += row.seats.length;
  }
  const n = Math.max(1, count);
  const centre: [number, number, number] = [cx / n, cy / n, cz / n];
  let radius = 0;
  for (const row of section.rows) {
    for (const s of row.seats) radius = Math.max(radius, Math.hypot(s[1] - centre[0], s[2] - centre[1], s[3] - centre[2]));
  }
  const fl = Math.hypot(fx, fz) || 1;
  return { rowStart, seatCount: count, centre, facing: [fx / fl, fz / fl], radius };
}

/**
 * Version 1 files had one shell cross-section for the whole bowl; version 2 has one per
 * piece of the bowl. Same seats either way, so upgrading just repeats the old cross-section.
 */
function upgrade(data: unknown): unknown {
  const d = data as { version?: number; shell?: LegacyShellSpec | null } | null;
  if (!d || d.version !== 1) return data;
  const old = d.shell;
  const shell: ShellSpec | null = old
    ? {
        shape: old.shape,
        stands: PIECE_SIDES.map((side) => ({ side, tiers: old.tiers, outerD: old.outerD, roof: old.roof })),
      }
    : null;
  return { ...d, version: 2, shell };
}

function validate(data: unknown): asserts data is StadiumData {
  const d = data as Partial<StadiumData> | null;
  if (!d || d.version !== 2) throw new Error('stadium.json: unsupported or missing "version" (expected 1 or 2)');
  if (d.shell && (!Array.isArray(d.shell.stands) || d.shell.stands.length !== PIECE_SIDES.length)) {
    throw new Error(`stadium.json: "shell.stands" needs ${PIECE_SIDES.length} entries (${PIECE_SIDES.join(', ')}), null for no stand`);
  }
  if (!d.pitch || !d.seat || !Array.isArray(d.sections) || d.sections.length === 0) {
    throw new Error('stadium.json: "pitch", "seat" and a non-empty "sections" array are required');
  }
  const ids = new Set<string>();
  for (const s of d.sections) {
    if (ids.has(s.id)) throw new Error(`stadium.json: duplicate section id "${s.id}"`);
    ids.add(s.id);
    if (!Number.isInteger(s.tier) || s.tier < 1) {
      throw new Error(`stadium.json: section "${s.id}" needs "tier" to be a positive whole number`);
    }
    const first = s.rows?.[0]?.seats?.[0];
    if (!Array.isArray(first) || first.length !== 5) {
      throw new Error(`stadium.json: section "${s.id}" needs rows of [n, x, y, z, yaw] seats`);
    }
  }
}

async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status})`);
  return res.json();
}

export async function loadStadium(): Promise<Stadium> {
  const data = upgrade(await fetchJson('data/stadium.json'));
  validate(data);
  return new Stadium(data);
}
