import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { stadiumConfigs } from '../src/config/index.ts';
import { generateStadium } from '../src/data/generateStadium.ts';
import { generateTickets } from '../src/data/generateTickets.ts';

/**
 * Writes via a temp file and a rename, so the browser never reads a half-written file, and
 * retries for a moment if Windows still has the file locked (e.g. mid-restart).
 */
function writeIfChanged(file: string, content: string): boolean {
  if (existsSync(file) && readFileSync(file, 'utf8') === content) return false;
  const tmp = `${file}.tmp`;
  for (let attempt = 1; ; attempt++) {
    try {
      writeFileSync(tmp, content);
      renameSync(tmp, file);
      return true;
    } catch (err) {
      if (attempt >= 10) throw err;
      const until = Date.now() + 100 * attempt;
      while (Date.now() < until) {
        // Short synchronous wait: Vite's config hook expects the files once it returns.
      }
    }
  }
}

/**
 * Regenerates public/data/stadium.json and tickets.json from a stadium config whenever Vite
 * starts (dev or build). STADIUM_CONFIG=<name> picks a config from src/config/index.ts
 * (default: "default"). Set STADIUM_DATA=external to keep hand-supplied JSON instead.
 */
export function stadiumDataPlugin(): Plugin {
  return {
    name: 'stadium-data',
    config() {
      if (process.env.STADIUM_DATA === 'external') return;
      const name = process.env.STADIUM_CONFIG || 'default';
      const config = stadiumConfigs[name];
      if (!config) {
        throw new Error(`STADIUM_CONFIG="${name}" is not in src/config/index.ts (have: ${Object.keys(stadiumConfigs).join(', ')})`);
      }
      const dir = resolve(process.cwd(), 'public/data');
      mkdirSync(dir, { recursive: true });

      const stadium = generateStadium(config);
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
