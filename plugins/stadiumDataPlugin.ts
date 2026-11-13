import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { stadiumConfig } from '../src/config/stadiumConfig.ts';
import { generateStadium } from '../src/data/generateStadium.ts';
import { generateTickets } from '../src/data/generateTickets.ts';

function writeIfChanged(file: string, content: string): boolean {
  if (existsSync(file) && readFileSync(file, 'utf8') === content) return false;
  writeFileSync(file, content);
  return true;
}

/**
 * Regenerates public/data/stadium.json and tickets.json from stadiumConfig whenever Vite
 * starts (dev or build). Set STADIUM_DATA=external to keep hand-supplied JSON instead.
 */
export function stadiumDataPlugin(): Plugin {
  return {
    name: 'stadium-data',
    config() {
      if (process.env.STADIUM_DATA === 'external') return;
      const dir = resolve(process.cwd(), 'public/data');
      mkdirSync(dir, { recursive: true });

      const stadium = generateStadium(stadiumConfig);
      const seats = stadium.sections.reduce((n, s) => n + s.rows.reduce((m, r) => m + r.seats.length, 0), 0);
      if (writeIfChanged(resolve(dir, 'stadium.json'), JSON.stringify(stadium))) {
        console.log(`stadium.json written: ${stadium.sections.length} sections, ${seats} seats`);
      }

      const tickets = generateTickets(stadium);
      const sold = Object.values(tickets.sold).reduce((n, l) => n + l.length, 0);
      if (writeIfChanged(resolve(dir, 'tickets.json'), JSON.stringify(tickets))) {
        console.log(`tickets.json written: ${sold} of ${seats} seats sold (${Math.round((sold / seats) * 100)}%)`);
      }
    },
  };
}
