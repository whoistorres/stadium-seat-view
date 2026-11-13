import * as THREE from 'three';
import type { Stadium } from '../data/loadData';
import type { TicketFilters, Tickets } from '../data/tickets';
import type { BaseColorFn } from './seats';

const SOLD = new THREE.Color('#4b515a');
const FILTERED_TINT = new THREE.Color('#1b1e23');

/** Seat colours from ticket data: category colour if available and matching, grey if sold, faded if filtered out. */
export class TicketColors {
  /** Per section: does it pass the current filters. */
  readonly matches: boolean[];
  private readonly base: THREE.Color[];
  private readonly filtered: THREE.Color[];

  constructor(
    stadium: Stadium,
    private readonly tickets: Tickets,
  ) {
    this.base = stadium.sections.map((_, si) => new THREE.Color(tickets.category(si).color));
    this.filtered = this.base.map((c) => c.clone().lerp(FILTERED_TINT, 0.78));
    this.matches = stadium.sections.map(() => true);
  }

  update(filters: TicketFilters): void {
    for (let i = 0; i < this.matches.length; i++) this.matches[i] = this.tickets.sectionMatches(i, filters);
  }

  readonly colorFn: BaseColorFn = (ref, out) => {
    const sold = this.tickets.isSold(ref);
    if (!this.matches[ref.section]) out.copy(sold ? FILTERED_TINT : this.filtered[ref.section]);
    else out.copy(sold ? SOLD : this.base[ref.section]);
  };
}
