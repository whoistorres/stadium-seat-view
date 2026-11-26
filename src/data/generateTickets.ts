import { seatKey } from './seatId.ts';
import type { CategoryId, PriceCategory, PriceRuns, Section, StadiumData, TicketData } from './types.ts';

/** Okabe-Ito colours (colour-blind safe); each also has a letter and a pattern in the UI. */
export const DEFAULT_CATEGORIES: PriceCategory[] = [
  { id: 'A', label: 'Premium', price: 145, color: '#D55E00', pattern: 'solid' },
  { id: 'B', label: 'Central', price: 95, color: '#E69F00', pattern: 'stripes' },
  { id: 'C', label: 'Standard', price: 65, color: '#56B4E9', pattern: 'dots' },
  { id: 'D', label: 'Value', price: 40, color: '#009E73', pattern: 'cross' },
];

/** Target share of seats already sold, per category. */
const SOLD_SHARE: Record<CategoryId, number> = { A: 0.72, B: 0.62, C: 0.55, D: 0.68 };
/** Chance the next seat in a row is sold given this one is: sales come in blocks (groups, season tickets). */
const STICKY = 0.88;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/**
 * Mock seat prices, in steps of 5. Within a section the category price is adjusted by row
 * (the first rows are low and cheaper, the middle of the tier is dearest, the back of the top
 * tier is cheaper) and by position (sideline seats near halfway cost more than those near the
 * corner flags; end seats behind the goal a little more than those towards the corners).
 */
function sectionPrices(s: Section, base: number, isBack: boolean, pitch: StadiumData['pitch']): PriceRuns {
  const rows = s.rows.length;
  return s.rows.map((row, k) => {
    const r = rows > 1 ? k / (rows - 1) : 0.5;
    const byRow = 1 + 0.08 * Math.sin(Math.PI * r) - 0.15 * Math.max(0, 1 - r / 0.15) - (isBack ? 0.1 * Math.max(0, (r - 0.7) / 0.3) : 0);
    const runs: Array<[number, number]> = [];
    for (const t of row.seats) {
      const along =
        s.zone === 'sideline'
          ? 1 + 0.08 * (1 - 2 * Math.min(1, Math.abs(t[1]) / (pitch.length / 2)))
          : s.zone === 'end'
            ? 1 + 0.04 * (1 - 2 * Math.min(1, Math.abs(t[3]) / (pitch.width / 2)))
            : 0.96;
      const price = Math.max(5, Math.round((base * byRow * along) / 5) * 5);
      const last = runs[runs.length - 1];
      if (last && last[0] === price) last[1]++;
      else runs.push([price, 1]);
    }
    return runs;
  });
}

/** Mock ticketing: deterministic for a given stadium and seed. */
export function generateTickets(stadium: StadiumData, seed = 2026): TicketData {
  // Pricing goes by a tier's position, not its number: front, back (if more than one) or in between.
  const tierIds = [...new Set(stadium.sections.map((s) => s.tier))].sort((a, b) => a - b);
  const front = tierIds[0];
  const back = tierIds.length > 1 ? tierIds[tierIds.length - 1] : null;

  // Position of each section within its stand (same tier and side), to find the central ones.
  const groupSize = new Map<string, number>();
  const groupIndex = stadium.sections.map((s) => {
    const key = `${s.tier}${s.side}`;
    const i = groupSize.get(key) ?? 0;
    groupSize.set(key, i + 1);
    return i;
  });

  const sections: TicketData['sections'] = {};
  const sold: TicketData['sold'] = {};

  stadium.sections.forEach((s, si) => {
    const n = groupSize.get(`${s.tier}${s.side}`)!;
    const central = Math.abs(groupIndex[si] - (n - 1) / 2) < n / 4;
    let category: CategoryId;
    const isBack = s.tier === back;
    const isMiddle = s.tier !== front && !isBack;
    if (s.zone === 'sideline') category = isBack ? (central ? 'B' : 'C') : central ? 'A' : 'B';
    else if (s.zone === 'corner') category = isBack ? 'D' : 'C';
    else category = isMiddle ? 'C' : 'D';
    sections[s.id] = { category, prices: sectionPrices(s, DEFAULT_CATEGORIES.find((c) => c.id === category)!.price, isBack, stadium.pitch) };

    // Two-state Markov chain whose long-run sold share equals p.
    const p = SOLD_SHARE[category];
    const fromFree = (p * (1 - STICKY)) / (1 - p);
    const rand = mulberry32(seed ^ hashString(s.id));
    const list: string[] = [];
    for (const row of s.rows) {
      let isSold = rand() < p;
      for (const seat of row.seats) {
        if (isSold) list.push(seatKey(row.n, seat[0]));
        isSold = rand() < (isSold ? STICKY : fromFree);
      }
    }
    sold[s.id] = list;
  });

  return { version: 1, currency: 'EUR', categories: DEFAULT_CATEGORIES, sections, sold };
}
