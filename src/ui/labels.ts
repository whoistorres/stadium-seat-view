import type { SeatRef, Stadium } from '../data/loadData';
import type { Row, Section, Side, TierId, Zone } from '../data/types';

export const zoneLabel: Record<Zone, string> = { sideline: 'Sideline', end: 'Behind the goal', corner: 'Corner' };

export const sideLabel: Record<Side, string> = {
  N: 'North',
  S: 'South',
  E: 'East',
  W: 'West',
  NE: 'North-east',
  NW: 'North-west',
  SE: 'South-east',
  SW: 'South-west',
};

export function tierLabel(stadium: Stadium, tier: TierId): string {
  return `${stadium.tierName(tier)} tier`;
}

/** Where a section is: its stand's name if the data has one, else e.g. "Sideline, North". */
export function standLabel(s: Section, separator = ', '): string {
  return s.stand ?? `${zoneLabel[s.zone]}${separator}${sideLabel[s.side]}`;
}

export function sectionArea(stadium: Stadium, s: Section): string {
  return `${tierLabel(stadium, s.tier)} · ${standLabel(s)}`;
}

/** Row name for display: its ticket label if it has one, else its number. */
export function rowName(row: Row): string {
  return row.label ?? String(row.n);
}

export function seatNumbers(stadium: Stadium, ref: SeatRef): { section: string; row: string; seat: number } {
  const s = stadium.sections[ref.section];
  const row = s.rows[ref.row];
  return { section: s.id, row: rowName(row), seat: row.seats[ref.seat][0] };
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
