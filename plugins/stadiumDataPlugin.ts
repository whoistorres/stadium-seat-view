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

const FILES = ['stadium.json', 'tickets.json'] as const;
type DataFiles = Record<(typeof FILES)[number], string>;

/** Generates both data files for a named config, logging a one-line summary of each. */
function generate(name: string): DataFiles {
  const config = stadiumConfigs[name];
  if (!config) {
    throw new Error(`STADIUM_CONFIG="${name}" is not in src/config/index.ts (have: ${Object.keys(stadiumConfigs).join(', ')})`);
  }
  const stadium = generateStadium(config);
  const seats = stadium.sections.reduce((n, s) => n + s.rows.reduce((m, r) => m + r.seats.length, 0), 0);
  const tickets = generateTickets(stadium);
  const sold = Object.values(tickets.sold).reduce((n, l) => n + l.length, 0);
  console.log(`${name}: ${stadium.sections.length} sections, ${seats} seats, ${sold} sold (${Math.round((sold / seats) * 100)}%)`);
  return { 'stadium.json': JSON.stringify(stadium), 'tickets.json': JSON.stringify(tickets) };
}

/**
 * Generates stadium.json and tickets.json from a stadium config whenever Vite starts (dev or
 * build). STADIUM_CONFIG=<name> picks a config from src/config/index.ts (default: "default").
 *
 * Only the default config is written to public/data, the files kept in git. Any other config
 * never touches them: the dev server serves its data from memory at the same URLs, and a build
 * writes it into the output folder (over the copied public/data). So previewing a venue can't
 * leave its data behind to be committed by mistake.
 *
 * Set STADIUM_DATA=external to keep hand-supplied JSON in public/data instead.
 */
export function stadiumDataPlugin(): Plugin {
  let venue: DataFiles | null = null;
  let base = '/';
  let outDir = 'dist';
  return {
    name: 'stadium-data',
    configResolved(cfg) {
      // A relative base ('./') still serves from '/' in dev.
      base = cfg.base.startsWith('/') ? cfg.base : '/';
      outDir = resolve(cfg.root, cfg.build.outDir);
      // Tests import the generators directly; they don't need the files.
      if (process.env.STADIUM_DATA === 'external' || process.env.VITEST) return;
      const name = process.env.STADIUM_CONFIG || 'default';
      const files = generate(name);
      if (name !== 'default') {
        venue = files;
        console.log(`${name}: ${cfg.command === 'build' ? 'written to the build output' : 'served from memory'}; public/data left as it is`);
        return;
      }
      const dir = resolve(cfg.root, 'public/data');
      mkdirSync(dir, { recursive: true });
      for (const f of FILES) if (writeIfChanged(resolve(dir, f), files[f])) console.log(`public/data/${f} written`);
    },
    configureServer(server) {
      // Added directly (not returned), so it runs before Vite serves public/ files.
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0];
        const file = venue && FILES.find((f) => path === `${base}data/${f}`);
        if (!venue || !file) return next();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(venue[file]);
      });
    },
    writeBundle() {
      if (!venue) return;
      const dir = resolve(outDir, 'data');
      mkdirSync(dir, { recursive: true });
      for (const f of FILES) writeFileSync(resolve(dir, f), venue[f]);
    },
  };
}
