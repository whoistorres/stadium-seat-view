import type { StadiumConfig } from '../data/types';

/**
 * Single source of truth for the procedural stadium. Edit values here, restart the dev
 * server (or rebuild) and public/data/*.json is regenerated. Rendering code never reads this.
 */
export const stadiumConfig: StadiumConfig = {
  name: 'Generic Arena',
  pitch: { length: 105, width: 68, runoffSide: 8, runoffEnd: 9 },
  bowl: {
    // Larger = rounder corners, but the corner front row also moves closer to the corner flag (see nearestPitchGap).
    cornerRadius: 14,
    seatSpacing: 0.5,
    aisleWidth: 1.2,
    seatInset: 0.5,
    // 2*8 + 2*4 + 4*4 = 40 sections per tier -> 101-140, 201-240, 301-340
    sectionsPerZone: { sideline: 8, end: 4, corner: 4 },
  },
  tiers: [
    { id: 1, name: 'Lower', firstSection: 101, rows: 24, rowDepth: 0.8, rakeDeg: 20, cValue: 90, setback: 0, lift: 1.0, parapet: 0.35 },
    { id: 2, name: 'Middle', firstSection: 201, rows: 10, rowDepth: 0.85, rakeDeg: 27, cValue: 90, setback: 1.6, lift: 1.5, parapet: 0.7 },
    { id: 3, name: 'Upper', firstSection: 301, rows: 22, rowDepth: 0.85, rakeDeg: 34, cValue: 90, setback: 1.6, lift: 1.9, parapet: 0.7 },
  ],
  roof: { enabled: true, clearance: 6.5, cantilever: 30, slopeDeg: 3, thickness: 0.7 },
  shellDepth: 4,
  eyeHeight: 1.2,
};
