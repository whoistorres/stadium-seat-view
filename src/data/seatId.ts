const pad = (n: number) => String(n).padStart(2, '0');

/** "S-214-R12-N07" — stable for a given section/row/seat number. */
export function seatId(section: string, row: number, seat: number): string {
  return `S-${section}-R${pad(row)}-N${pad(seat)}`;
}

/** "R12-N07" — the per-section key used in tickets.json. */
export function seatKey(row: number, seat: number): string {
  return `R${pad(row)}-N${pad(seat)}`;
}

export function parseSeatId(id: string): { section: string; row: number; seat: number } | null {
  const m = /^S-([^-]+)-R(\d+)-N(\d+)$/.exec(id);
  return m ? { section: m[1], row: Number(m[2]), seat: Number(m[3]) } : null;
}
