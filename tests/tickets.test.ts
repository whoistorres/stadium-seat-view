import { describe, expect, it } from 'vitest';
import { stadiumConfigs } from '../src/config/index.ts';
import { generateStadium } from '../src/data/generateStadium.ts';
import { generateTickets } from '../src/data/generateTickets.ts';
import { Stadium } from '../src/data/loadData.ts';
import { seatKey } from '../src/data/seatId.ts';
import { Tickets, type TicketFilters } from '../src/data/tickets.ts';
import type { CategoryId, TicketData } from '../src/data/types.ts';

const stadiumData = generateStadium(stadiumConfigs.default);
const stadium = new Stadium(stadiumData);
const data = generateTickets(stadiumData);
const tickets = new Tickets(data, stadium);

const allCategories: Record<CategoryId, boolean> = { A: true, B: true, C: true, D: true };
const filters = (minPrice: number, maxPrice: number, categories = allCategories): TicketFilters => ({ categories, minPrice, maxPrice });

describe('generated tickets', () => {
  it('are deterministic for a seed and differ for another', () => {
    expect(JSON.stringify(generateTickets(stadiumData))).toBe(JSON.stringify(data));
    expect(JSON.stringify(generateTickets(stadiumData, 7).sold)).not.toBe(JSON.stringify(data.sold));
  });

  it('price every seat once, in steps of 5', () => {
    for (const s of stadiumData.sections) {
      const runs = data.sections[s.id].prices!;
      expect(runs).toHaveLength(s.rows.length);
      s.rows.forEach((row, ri) => {
        expect(runs[ri].reduce((n, [, count]) => n + count, 0)).toBe(row.seats.length);
        for (const [price] of runs[ri]) expect(price % 5).toBe(0);
      });
    }
  });

  it('keep each category within its expected range', () => {
    const expected: Record<CategoryId, [number, number]> = { A: [125, 170], B: [75, 110], C: [50, 75], D: [35, 45] };
    for (const [id, [lo, hi]] of tickets.categoryRange) {
      expect(lo).toBeGreaterThanOrEqual(expected[id][0]);
      expect(hi).toBeLessThanOrEqual(expected[id][1]);
    }
  });

  it('only sell seats that exist', () => {
    for (const s of stadiumData.sections) {
      const keys = new Set(s.rows.flatMap((r) => r.seats.map((t) => seatKey(r.n, t[0]))));
      for (const k of data.sold[s.id] ?? []) expect(keys.has(k), `${s.id} ${k}`).toBe(true);
    }
  });

  it('sell roughly the target share of seats', () => {
    const sold = Object.values(data.sold).reduce((n, l) => n + l.length, 0);
    const share = sold / stadium.totalSeats;
    expect(share).toBeGreaterThan(0.5);
    expect(share).toBeLessThan(0.8);
  });

  it('work for every venue', () => {
    for (const config of Object.values(stadiumConfigs)) {
      const d = generateStadium(config);
      expect(() => new Tickets(generateTickets(d), new Stadium(d))).not.toThrow();
    }
  });
});

describe('Tickets', () => {
  /** Free seats inside the filters, counted one seat at a time. */
  function bruteForce(si: number, f: TicketFilters, row?: number): number {
    let n = 0;
    stadium.sections[si].rows.forEach((r, ri) => {
      if (row !== undefined && ri !== row) return;
      r.seats.forEach((_, k) => {
        if (tickets.selectable({ section: si, row: ri, seat: k }, f)) n++;
      });
    });
    return n;
  }

  it('counts free seats inside the filters', () => {
    const cases = [filters(0, 1000), filters(80, 120), filters(150, 160), filters(60, 60), filters(0, 1000, { ...allCategories, A: false })];
    for (const f of cases) {
      for (let si = 0; si < stadium.sections.length; si += 7) {
        expect(tickets.availableIn(si, f), `section ${si}`).toBe(bruteForce(si, f));
        expect(tickets.availableIn(si, f, 3)).toBe(bruteForce(si, f, 3));
      }
    }
  });

  it('with no filters counts every free seat', () => {
    stadium.sections.forEach((_, si) => expect(tickets.availableIn(si, filters(0, Infinity))).toBe(tickets.available(si)));
  });

  it('matches a section when any of its seats is in range', () => {
    stadium.sections.forEach((_, si) => {
      const [lo, hi] = tickets.sectionRange[si];
      expect(tickets.sectionMatches(si, filters(lo, lo))).toBe(true);
      expect(tickets.sectionMatches(si, filters(hi, hi))).toBe(true);
      expect(tickets.sectionMatches(si, filters(hi + 1, Infinity))).toBe(false);
    });
  });

  it('lists price points in order, within the overall range', () => {
    const p = tickets.pricePoints;
    expect([...p].sort((a, b) => a - b)).toEqual(p);
    expect(p[0]).toBe(tickets.minPrice);
    expect(p[p.length - 1]).toBe(tickets.maxPrice);
  });

  it('formats single prices and ranges', () => {
    expect(tickets.formatRange([85, 85])).toBe(tickets.format(85));
    expect(tickets.formatRange([85, 115])).toBe(`${tickets.format(85)}–${tickets.format(115)}`);
  });

  it('rejects price runs that do not add up to the row', () => {
    const bad: TicketData = structuredClone(data);
    const id = stadiumData.sections[0].id;
    bad.sections[id].prices![0].push([50, 1]);
    expect(() => new Tickets(bad, stadium)).toThrow(/don't add up/);
  });

  it('rejects a section without a category', () => {
    const bad: TicketData = structuredClone(data);
    delete (bad.sections as Record<string, unknown>)[stadiumData.sections[0].id];
    expect(() => new Tickets(bad, stadium)).toThrow(/no valid price category/);
  });

  it('falls back to the category price without per-seat prices', () => {
    const plain: TicketData = structuredClone(data);
    for (const s of Object.values(plain.sections)) delete s.prices;
    const t = new Tickets(plain, stadium);
    expect(t.price({ section: 0, row: 0, seat: 0 })).toBe(t.category(0).price);
  });
});
