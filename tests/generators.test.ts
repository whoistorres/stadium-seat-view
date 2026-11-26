import { describe, expect, it } from 'vitest';
import { stadiumConfigs } from '../src/config/index.ts';
import { generateStadium, rowLabel } from '../src/data/generateStadium.ts';
import { Stadium } from '../src/data/loadData.ts';
import { parseSeatId, seatId } from '../src/data/seatId.ts';
import { viewNotes } from '../src/data/viewNotes.ts';
import type { StadiumConfig, StadiumData } from '../src/data/types.ts';

const seatCount = (d: StadiumData) => d.sections.reduce((n, s) => n + s.rows.reduce((m, r) => m + r.seats.length, 0), 0);

/** A copy of a config with some fields changed, so tests never alter the shared configs. */
function variant(name: string, change: (c: StadiumConfig) => void): StadiumConfig {
  const c = structuredClone(stadiumConfigs[name]);
  change(c);
  return c;
}

describe.each(Object.keys(stadiumConfigs))('venue %s', (name) => {
  const data = generateStadium(stadiumConfigs[name]);

  it('is deterministic', () => {
    expect(JSON.stringify(generateStadium(stadiumConfigs[name]))).toBe(JSON.stringify(data));
  });

  it('has unique section ids and seat ids that round-trip', () => {
    const ids = data.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of data.sections) {
      const seen = new Set<string>();
      for (const r of s.rows) {
        for (const t of r.seats) {
          const id = seatId(s.id, r.n, t[0]);
          expect(seen.has(id), id).toBe(false);
          seen.add(id);
          expect(parseSeatId(id)).toEqual({ section: s.id, row: r.n, seat: t[0] });
        }
      }
    }
  });

  it('has finite seat positions above the pitch', () => {
    for (const s of data.sections) {
      for (const r of s.rows) {
        for (const [n, x, y, z, yaw] of r.seats) {
          expect(Number.isInteger(n) && n >= 1).toBe(true);
          expect([x, y, z, yaw].every(Number.isFinite)).toBe(true);
          expect(y).toBeGreaterThan(0);
        }
      }
    }
  });

  it('has seats outside the pitch, facing it', () => {
    const { length, width } = data.pitch;
    for (const s of data.sections) {
      for (const r of s.rows) {
        for (const [, x, , z, yaw] of r.seats) {
          expect(Math.abs(x) > length / 2 || Math.abs(z) > width / 2).toBe(true);
          // Facing (sin yaw, cos yaw) points back towards the pitch centre, give or take.
          expect(Math.sin(yaw) * -x + Math.cos(yaw) * -z).toBeGreaterThan(0);
        }
      }
    }
  });

  it('places crowd away sections that exist', () => {
    const ids = new Set(data.sections.map((s) => s.id));
    for (const id of data.crowd?.awaySections ?? []) expect(ids.has(id)).toBe(true);
  });
});

describe('capacity', () => {
  it.each([
    ['default', 54448],
    ['st-james-park', 53804],
  ])('%s seats %i', (name, seats) => {
    expect(seatCount(generateStadium(stadiumConfigs[name]))).toBe(seats);
  });
});

describe('bands of blocks', () => {
  // Default tier 1 has 24 rows: 10 rows of three blocks in front of 14 rows of two.
  const withBands = (bands: Array<{ rows: number; blocks: string[] }>) =>
    generateStadium(variant('default', (c) => (c.stands = { ...c.stands, N: { tiers: [{ id: 1, bands }, { id: 2 }, { id: 3 }] } })));
  const data = withBands([
    { rows: 10, blocks: ['F1', 'F2', 'F3'] },
    { rows: 14, blocks: ['B1', 'B2'] },
  ]);
  const byId = (id: string) => data.sections.find((s) => s.id === id)!;

  it('splits the tier into bands front to back', () => {
    expect(byId('F1').rows).toHaveLength(10);
    expect(byId('B1').rows).toHaveLength(14);
    expect(byId('F1').rowOffset).toBeUndefined();
    expect(byId('B2').rowOffset).toBe(10);
    // The back band starts one row behind the front band's last row, higher up.
    expect(byId('B1').rows[0].seats[0][2]).toBeGreaterThan(byId('F1').rows[9].seats[0][2]);
  });

  it('numbers rows from 1 again in each band', () => {
    expect(byId('B1').rows.map((r) => r.n).slice(0, 3)).toEqual([1, 2, 3]);
  });

  it('keeps the tier the same size and shape', () => {
    const plain = generateStadium(stadiumConfigs.default);
    const n = (d: StadiumData) => d.sections.filter((s) => s.side === 'N' && s.tier === 1);
    const ys = (d: StadiumData) => [...new Set(n(d).flatMap((s) => s.rows.map((r) => r.seats[0][2])))].sort((a, b) => a - b);
    expect(ys(data)).toEqual(ys(plain));
  });

  it.each([
    ['rows that do not add up', [{ rows: 10, blocks: ['F1'] }, { rows: 10, blocks: ['B1'] }], /20 rows in all, but the tier has 24/],
    ['an empty band', [{ rows: 24, blocks: [] }], /at least one block/],
    ['a band of no rows', [{ rows: 0, blocks: ['F1'] }, { rows: 24, blocks: ['B1'] }], /whole number of rows/],
  ])('rejects %s', (_, bands, message) => {
    expect(() => withBands(bands)).toThrow(message);
  });

  it('rejects bands alongside blocks', () => {
    expect(() =>
      generateStadium(
        variant('default', (c) => (c.stands = { N: { tiers: [{ id: 1, blocks: ['X'], bands: [{ rows: 24, blocks: ['F1'] }] }, { id: 2 }, { id: 3 }] } })),
      ),
    ).toThrow(/drop "blocks"/);
  });

  it('lets a lone block cover both legs of a square corner', () => {
    const sjp = generateStadium(stadiumConfigs['st-james-park']);
    const a = sjp.sections.find((s) => s.id === 'SWA')!;
    const row = a.rows[0].seats;
    // Seats on both legs: facing changes by about 90 degrees across the diagonal.
    const turn = Math.abs(Math.atan2(Math.sin(row[0][4] - row[row.length - 1][4]), Math.cos(row[0][4] - row[row.length - 1][4])));
    expect(turn).toBeGreaterThan(1.2);
    expect(row.map((t) => t[0])).toEqual(row.map((_, i) => i + 1));
  });
});

describe("St James' Park blocks (club map, 2026-27)", () => {
  const sjp = generateStadium(stadiumConfigs['st-james-park']);
  const ids = (side: string, tier: number) => sjp.sections.filter((s) => s.side === side && s.tier === tier).map((s) => s.id);

  it('runs the Milburn lower blocks left to right from the Leazes end, with no L1E', () => {
    expect(ids('N', 1).slice(0, 8)).toEqual(['MSL1I', 'MSL1H', 'MSL1G', 'MSL1F', 'MSL1D', 'MSL1C', 'MSL1B', 'MSL1A']);
  });

  it('puts the away fans in all of the straight Leazes Level 7', () => {
    const away = new Set(sjp.crowd!.awaySections);
    const upper = sjp.sections.filter((s) => s.side === 'E' && s.tier === 2 && /L7/.test(s.id));
    expect(upper.length).toBe(12);
    for (const s of upper) expect(away.has(s.id), s.id).toBe(true);
  });

  it('has the singing section next to the away end', () => {
    // Leazes corner blocks run left (Leazes side) to right: L7E, L7D, L7C next to L7F.
    expect(ids('NE', 2).filter((id) => /^LSL7/.test(id))).toEqual(['LSL7E', 'LSL7D', 'LSL7C', 'LSL7B', 'LSL7A']);
  });

  it('measures the first row of a band over the last row of the band in front', () => {
    const stadium = new Stadium(sjp);
    const back = sjp.sections.findIndex((s) => s.id === 'LSL2Q');
    const front = sjp.sections.findIndex((s) => s.id === 'LSL1F');
    expect(sjp.sections[back].rowOffset).toBe(13);
    const first = viewNotes(stadium, { section: back, row: 0, seat: 5 });
    expect(first.over).toBe('row');
    expect(first.clearance).not.toBeNull();
    // A band at the very front still measures over its tier's front wall.
    expect(viewNotes(stadium, { section: front, row: 0, seat: 5 }).over).toBe('wall');
  });

  it('has screens on the Leazes End, the Gallowgate End and in Strawberry Corner', () => {
    const boards = sjp.shell!.scoreboards!;
    expect(boards).toHaveLength(3);
    // Leazes: +x end; Gallowgate: -x end; Strawberry Corner: -x, +z.
    expect(boards.map((b) => [Math.sign(Math.round(b.x)), Math.sign(Math.round(b.z))])).toEqual([
      [1, 0],
      [-1, 0],
      [-1, 1],
    ]);
  });
});

describe('row labels', () => {
  it('numbers by default', () => {
    expect(rowLabel(undefined, 0)).toBeUndefined();
    expect(rowLabel('numbers', 5)).toBeUndefined();
  });
  it('letters run A..Z then AA, BB', () => {
    expect(rowLabel('letters', 0)).toBe('A');
    expect(rowLabel('letters', 25)).toBe('Z');
    expect(rowLabel('letters', 26)).toBe('AA');
    expect(rowLabel('letters', 27)).toBe('BB');
  });
  it('a list is used as given', () => {
    expect(rowLabel(['A', 'B', 'C', 'D'], 3)).toBe('D');
  });
  it('labels rows in the generated data', () => {
    const data = generateStadium(variant('default', (c) => (c.tiers[0].rowLabels = 'letters')));
    const s = data.sections.find((x) => x.tier === 1)!;
    expect(s.rows.map((r) => r.label).slice(0, 3)).toEqual(['A', 'B', 'C']);
    expect(data.sections.find((x) => x.tier === 2)!.rows[0].label).toBeUndefined();
  });
});

describe('blocks and seat numbers', () => {
  const withBlocks = (seatNumbers?: StadiumConfig['tiers'][number]['seatNumbers']) =>
    generateStadium(
      variant('default', (c) => {
        c.stands = { ...c.stands, N: { tiers: [{ id: 1, blocks: ['NA', 'NB', 'NC'], seatNumbers }, { id: 2 }, { id: 3 }] } };
      }),
    );
  const blockSeats = (d: StadiumData, row = 0) => ['NA', 'NB', 'NC'].map((id) => d.sections.find((s) => s.id === id)!.rows[row].seats.map((t) => t[0]));

  it('names sections after the blocks', () => {
    const d = withBlocks();
    for (const id of ['NA', 'NB', 'NC']) expect(d.sections.filter((s) => s.id === id)).toHaveLength(1);
    expect(d.sections.find((s) => s.id === 'NA')!.side).toBe('N');
  });

  it('restarts at 1 in each block by default', () => {
    for (const seats of blockSeats(withBlocks())) expect(seats).toEqual(seats.map((_, i) => i + 1));
  });

  it('runs along the whole stand from the right', () => {
    const all = blockSeats(withBlocks({ across: 'stand', from: 'right', first: 1 })).flat();
    expect(all).toEqual(all.map((_, i) => all.length - i));
  });

  it('can start from another number', () => {
    for (const seats of blockSeats(withBlocks({ first: 101 }))) expect(seats[0]).toBe(101);
  });

  it('rejects a first seat below 1', () => {
    expect(() => withBlocks({ first: 0 })).toThrow(/seatNumbers.first/);
  });

  it('rejects block names with hyphens', () => {
    expect(() =>
      generateStadium(variant('default', (c) => (c.stands = { N: { tiers: [{ id: 1, blocks: ['N-A'] }, { id: 2 }, { id: 3 }] } }))),
    ).toThrow(/no hyphens/);
  });
});

describe('details', () => {
  it('puts screens on both ends and dugouts on the north side by default', () => {
    const shell = generateStadium(stadiumConfigs.default).shell!;
    expect(shell.scoreboards).toHaveLength(2);
    expect(shell.dugouts).toHaveLength(2);
    for (const d of shell.dugouts!) expect(d.z).toBeLessThan(0);
  });

  it('can move the dugouts south or drop them', () => {
    const south = generateStadium(variant('default', (c) => (c.details = { dugouts: 'S' }))).shell!;
    for (const d of south.dugouts!) expect(d.z).toBeGreaterThan(0);
    expect(generateStadium(variant('default', (c) => (c.details = { dugouts: null }))).shell!.dugouts ?? []).toEqual([]);
  });

  it.each([
    ['a stand that is missing', { scoreboards: [{ stand: 'NE' as const }] }, /where there is no stand/, true],
    ['"at" out of range', { scoreboards: [{ stand: 'E' as const, at: 1.5 }] }, /between 0 and 1/, false],
    ['zero size', { scoreboards: [{ stand: 'E' as const, width: 0 }] }, /positive width/, false],
    ['bad dugout side', { dugouts: 'E' as 'N' }, /details.dugouts/, false],
  ])('rejects %s', (_, details, message, square) => {
    // The four-stands example has no corner stands, so a corner is a stand that is missing.
    const name = square ? 'four-stands' : 'default';
    expect(() => generateStadium(variant(name, (c) => (c.details = details)))).toThrow(message);
  });
});

describe('crowd', () => {
  it('rejects a colour that is not #rrggbb', () => {
    expect(() => generateStadium(variant('default', (c) => (c.crowd = { home: ['red'] })))).toThrow(/crowd.home/);
  });
  it('accepts striped kits', () => {
    expect(() => generateStadium(variant('default', (c) => (c.crowd = { home: ['#111111/#f2f2f2'] })))).not.toThrow();
  });
  it('rejects away sections that do not exist', () => {
    expect(() => generateStadium(variant('default', (c) => (c.crowd = { home: ['#c8102e'], away: ['#1d4ed8'], awaySections: ['999'] })))).toThrow(
      /don't exist: 999/,
    );
  });
  it('rejects away sections without away colours', () => {
    expect(() => generateStadium(variant('default', (c) => (c.crowd = { home: ['#c8102e'], awaySections: ['101'] })))).toThrow(/needs "crowd.away"/);
  });
});

describe('tiers', () => {
  it('rejects a repeated tier id', () => {
    expect(() => generateStadium(variant('default', (c) => (c.tiers[1].id = 1)))).toThrow(/used twice/);
  });
  it('rejects too few row labels', () => {
    expect(() => generateStadium(variant('default', (c) => (c.tiers[0].rowLabels = ['A', 'B'])))).toThrow(/only 2 "rowLabels"/);
  });
});
