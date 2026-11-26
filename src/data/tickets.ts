import type { SeatRef, Stadium } from './loadData';
import { seatKey } from './seatId';
import type { CategoryId, PriceCategory, TicketData } from './types';

const ROWS_DONT_ADD_UP = (id: string, row: string, n: number) =>
  `tickets.json: section "${id}" row ${row} has prices that don't add up to its ${n} seats`;

export interface TicketFilters {
  categories: Record<CategoryId, boolean>;
  minPrice: number;
  maxPrice: number;
}

/** Ticket data resolved against the loaded stadium, indexed for per-frame lookups. */
export class Tickets {
  readonly categories: PriceCategory[];
  readonly currency: string;
  readonly minPrice: number;
  readonly maxPrice: number;
  /** Every distinct seat price, ascending. */
  readonly pricePoints: number[];
  /** Per section index. */
  readonly sectionCategory: PriceCategory[];
  readonly availableCount: number[];
  /** Per section: [cheapest, dearest] seat. */
  readonly sectionRange: Array<[number, number]>;
  /** Per category id: [cheapest, dearest] seat. */
  readonly categoryRange: Map<CategoryId, [number, number]>;
  /** Per section: 1 = sold, indexed by seat instance index. */
  private readonly sold: Uint8Array[];
  /** Per section: seat price, indexed by seat instance index. */
  private readonly prices: Float32Array[];
  private readonly fmt: Intl.NumberFormat;

  constructor(data: TicketData, private readonly stadium: Stadium) {
    this.categories = data.categories;
    this.currency = data.currency;
    this.fmt = new Intl.NumberFormat('en', { style: 'currency', currency: data.currency, maximumFractionDigits: 0 });

    const byId = new Map(data.categories.map((c) => [c.id, c]));
    this.sectionCategory = stadium.sections.map((s) => {
      const id = data.sections[s.id]?.category;
      const cat = id && byId.get(id);
      if (!cat) throw new Error(`tickets.json: section "${s.id}" has no valid price category`);
      return cat;
    });

    this.prices = stadium.sections.map((s, si) => {
      const out = new Float32Array(stadium.meta[si].seatCount).fill(this.sectionCategory[si].price);
      const runs = data.sections[s.id].prices;
      if (!runs) return out;
      if (runs.length !== s.rows.length) throw new Error(`tickets.json: section "${s.id}" has prices for ${runs.length} rows, not ${s.rows.length}`);
      s.rows.forEach((row, ri) => {
        let i = stadium.meta[si].rowStart[ri];
        let left = row.seats.length;
        for (const [price, count] of runs[ri]) {
          if (!(price >= 0) || !Number.isInteger(count) || count < 1 || count > left) {
            throw new Error(ROWS_DONT_ADD_UP(s.id, row.label ?? String(row.n), row.seats.length));
          }
          out.fill(price, i, i + count);
          i += count;
          left -= count;
        }
        if (left !== 0) throw new Error(ROWS_DONT_ADD_UP(s.id, row.label ?? String(row.n), row.seats.length));
      });
      return out;
    });
    this.sectionRange = this.prices.map((p) => {
      let lo = Infinity;
      let hi = -Infinity;
      for (const v of p) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      return [lo, hi];
    });
    this.categoryRange = new Map();
    this.sectionRange.forEach(([lo, hi], si) => {
      const id = this.sectionCategory[si].id;
      const r = this.categoryRange.get(id);
      this.categoryRange.set(id, r ? [Math.min(r[0], lo), Math.max(r[1], hi)] : [lo, hi]);
    });
    const points = new Set<number>();
    this.prices.forEach((p) => p.forEach((v) => points.add(v)));
    this.pricePoints = [...points].sort((a, b) => a - b);
    this.minPrice = this.pricePoints[0] ?? 0;
    this.maxPrice = this.pricePoints[this.pricePoints.length - 1] ?? 0;

    this.sold = stadium.sections.map((s, si) => {
      const flags = new Uint8Array(stadium.meta[si].seatCount);
      const keys = new Set(data.sold[s.id] ?? []);
      s.rows.forEach((row, ri) =>
        row.seats.forEach((seat, ki) => {
          if (keys.has(seatKey(row.n, seat[0]))) flags[stadium.meta[si].rowStart[ri] + ki] = 1;
        }),
      );
      return flags;
    });
    this.availableCount = this.sold.map((f) => f.length - f.reduce((n, v) => n + v, 0));
  }

  category(section: number): PriceCategory {
    return this.sectionCategory[section];
  }

  price(ref: SeatRef): number {
    return this.prices[ref.section][this.stadium.instanceIndex(ref)];
  }

  /** "€85" or "€85–€115" for a [cheapest, dearest] pair. */
  formatRange([lo, hi]: [number, number]): string {
    return lo === hi ? this.format(lo) : `${this.format(lo)}–${this.format(hi)}`;
  }

  isSold(ref: SeatRef): boolean {
    return this.sold[ref.section][this.stadium.instanceIndex(ref)] === 1;
  }

  isSoldAt(section: number, instance: number): boolean {
    return this.sold[section][instance] === 1;
  }

  /** Seat (by instance index) inside the filters: its category is shown and its price is in range. */
  matchesAt(section: number, instance: number, f: TicketFilters): boolean {
    const p = this.prices[section][instance];
    return f.categories[this.sectionCategory[section].id] && p >= f.minPrice && p <= f.maxPrice;
  }

  matches(ref: SeatRef, f: TicketFilters): boolean {
    return this.matchesAt(ref.section, this.stadium.instanceIndex(ref), f);
  }

  /** At least one seat in the section, sold or not, is inside the filters. */
  sectionMatches(section: number, f: TicketFilters): boolean {
    const [lo, hi] = this.sectionRange[section];
    if (!f.categories[this.sectionCategory[section].id] || hi < f.minPrice || lo > f.maxPrice) return false;
    if (lo >= f.minPrice && hi <= f.maxPrice) return true;
    return this.prices[section].some((p) => p >= f.minPrice && p <= f.maxPrice);
  }

  /** Free seats inside the filters, in a section or one of its rows. */
  availableIn(section: number, f: TicketFilters, row?: number): number {
    if (!this.sectionMatches(section, f)) return 0;
    const meta = this.stadium.meta[section];
    const start = row === undefined ? 0 : meta.rowStart[row];
    const end = row === undefined ? meta.seatCount : start + this.stadium.sections[section].rows[row].seats.length;
    let n = 0;
    for (let i = start; i < end; i++) if (!this.sold[section][i] && this.matchesAt(section, i, f)) n++;
    return n;
  }

  /** Can be picked by click, dropdown or arrow keys: not sold and inside the filters. */
  selectable(ref: SeatRef, f: TicketFilters): boolean {
    return !this.isSold(ref) && this.matches(ref, f);
  }

  available(section: number, row?: number): number {
    if (row === undefined) return this.availableCount[section];
    const start = this.stadium.meta[section].rowStart[row];
    const n = this.stadium.sections[section].rows[row].seats.length;
    let free = 0;
    for (let i = start; i < start + n; i++) free += 1 - this.sold[section][i];
    return free;
  }

  format(price: number): string {
    return this.fmt.format(price);
  }
}

function validate(data: unknown): asserts data is TicketData {
  const d = data as Partial<TicketData> | null;
  if (!d || d.version !== 1) throw new Error('tickets.json: unsupported or missing "version" (expected 1)');
  if (!Array.isArray(d.categories) || d.categories.length === 0 || !d.sections || !d.sold || !d.currency) {
    throw new Error('tickets.json: "currency", "categories", "sections" and "sold" are required');
  }
}

export async function loadTickets(stadium: Stadium): Promise<Tickets> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/tickets.json`);
  if (!res.ok) throw new Error(`Could not load data/tickets.json (HTTP ${res.status})`);
  const data: unknown = await res.json();
  validate(data);
  return new Tickets(data, stadium);
}
