import type { SeatRef, Stadium } from '../data/loadData';
import type { Section, Side, TierId, Zone } from '../data/types';

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
  const name = stadium.data.shell?.tiers.find((t) => t.id === tier)?.name ?? ['Lower', 'Middle', 'Upper'][tier - 1];
  return `${name} tier`;
}

export function sectionArea(stadium: Stadium, s: Section): string {
  return `${tierLabel(stadium, s.tier)} · ${zoneLabel[s.zone]}, ${sideLabel[s.side]}`;
}

export function seatNumbers(stadium: Stadium, ref: SeatRef): { section: string; row: number; seat: number } {
  const s = stadium.sections[ref.section];
  return { section: s.id, row: s.rows[ref.row].n, seat: s.rows[ref.row].seats[ref.seat][0] };
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
