import type { SeatRef, Stadium } from './loadData';
import { seatKey } from './seatId';
import type { CategoryId, PriceCategory, TicketData } from './types';

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
  /** Per section index. */
  readonly sectionCategory: PriceCategory[];
  readonly availableCount: number[];
  /** Per section: 1 = sold, indexed by seat instance index. */
  private readonly sold: Uint8Array[];
  private readonly fmt: Intl.NumberFormat;

  constructor(data: TicketData, private readonly stadium: Stadium) {
    this.categories = data.categories;
    this.currency = data.currency;
    const prices = data.categories.map((c) => c.price);
    this.minPrice = Math.min(...prices);
    this.maxPrice = Math.max(...prices);
    this.fmt = new Intl.NumberFormat('en', { style: 'currency', currency: data.currency, maximumFractionDigits: 0 });

    const byId = new Map(data.categories.map((c) => [c.id, c]));
    this.sectionCategory = stadium.sections.map((s) => {
      const id = data.sections[s.id]?.category;
      const cat = id && byId.get(id);
      if (!cat) throw new Error(`tickets.json: section "${s.id}" has no valid price category`);
      return cat;
    });

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
    return this.sectionCategory[ref.section].price;
  }

  isSold(ref: SeatRef): boolean {
    return this.sold[ref.section][this.stadium.instanceIndex(ref)] === 1;
  }

  isSoldAt(section: number, instance: number): boolean {
    return this.sold[section][instance] === 1;
  }

  sectionMatches(section: number, f: TicketFilters): boolean {
    const c = this.sectionCategory[section];
    return f.categories[c.id] && c.price >= f.minPrice && c.price <= f.maxPrice;
  }

  /** Can be picked by click, dropdown or arrow keys: not sold and inside the filters. */
  selectable(ref: SeatRef, f: TicketFilters): boolean {
    return !this.isSold(ref) && this.sectionMatches(ref.section, f);
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
