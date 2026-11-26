import type * as THREE from 'three';
import type { Quality } from '../state/store';
import type { Crowd } from './crowd';
import type { Lighting } from './lighting';

export interface QualityPreset {
  shadows: boolean;
  crowdDensity: number;
  /** Crowd sections closer than this (metres past their edge) use the detailed figure. */
  crowdNear: number;
  maxPixelRatio: number;
}

export const QUALITY: Record<Quality, QualityPreset> = {
  // 1.5x, not 2x: on high-DPI laptops 2x quadruples the pixel count for little visible gain.
  high: { shadows: true, crowdDensity: 1, crowdNear: 45, maxPixelRatio: 1.5 },
  low: { shadows: false, crowdDensity: 0.4, crowdNear: 25, maxPixelRatio: 1 },
};

/** Phones and small touch screens start on Low. */
export function defaultQuality(): Quality {
  return matchMedia('(pointer: coarse)').matches || innerWidth < 820 ? 'low' : 'high';
}

export function applyQuality(
  q: Quality,
  resolution: AdaptiveResolution,
  lighting: Lighting,
  crowd: Crowd,
): void {
  const p = QUALITY[q];
  resolution.setCap(Math.min(window.devicePixelRatio, p.maxPixelRatio));
  lighting.setShadows(p.shadows);
  crowd.setDensity(p.crowdDensity);
  crowd.setNearDistance(p.crowdNear);
}

// Margins below the target rate. A smooth 60 Hz loop averages 59.5+, so a smoothed rate under 58
// is real slowdown; faster displays get proportionally wider margins (139.7 / 141.8 at 144 Hz,
// where 138 fps would already mean a dropped frame every fifth of a second).
const slowBelow = (target: number) => target - Math.max(2, target * 0.03);
const steadyFrom = (target: number) => target - Math.max(1, target * 0.015);
// Lowest pixel ratio on ordinary windows, when aiming for 60 fps. Measured on Iris Xe: a
// 2560x1440 window needs ~0.7 to hold 60 fps in upper-tier seat views. Lowering resolution was
// preferred over switching shadows off, which pops the lighting.
const MIN_RATIO = 0.7;
// On very large windows the floor may go lower, but never below this many rendered pixels of
// height (about 1080p sharpness) or below 0.5.
const MIN_RENDER_HEIGHT = 1100;
// On a display faster than 60 Hz, resolution may drop this far (share of full) to keep up with
// it. Past that, a sharp image at 60 fps beats a soft one at the display rate.
export const SHARP_SCALE = 0.85;
const BASE_FPS = 60;
// Refresh rates displays commonly run at. A measured rate must be within 3% of one to count:
// anything else is timing noise (a 64 Hz reading on a 60 Hz screen, say) or a GPU-bound rate.
const COMMON_HZ = [60, 75, 85, 90, 100, 120, 144, 165, 170, 180, 200, 240, 280, 360];

/**
 * Finds the display's refresh rate from the gaps between animation frames. While frames keep up,
 * the typical gap is one refresh; browser timestamps jitter, so single gaps can't be trusted. A rate is accepted when two one-second windows in a row agree on it, and only ever
 * goes up: a slow GPU makes gaps longer, never shorter.
 */
export class RefreshRate {
  hz = BASE_FPS;
  private gaps: number[] = [];
  private last = 0;
  private windowStart = 0;
  private candidate = 0;

  /** Call once per animation frame; returns true when the rate went up. */
  frame(now: number): boolean {
    const gap = this.last ? now - this.last : 0;
    this.last = now;
    if (gap <= 0 || gap > 200) return false;
    this.gaps.push(gap);
    this.windowStart ||= now;
    if (now - this.windowStart < 1000 || this.gaps.length < 30) return false;
    // Mean of the gaps near the median: averages out jitter, leaves out frames that took two refreshes.
    const median = this.gaps.sort((a, b) => a - b)[Math.floor(this.gaps.length / 2)];
    const near = this.gaps.filter((g) => Math.abs(g - median) < median * 0.25);
    const hz = snapHz((1000 * near.length) / near.reduce((n, g) => n + g, 0));
    this.gaps = [];
    this.windowStart = now;
    const agreed = hz !== null && hz === this.candidate;
    this.candidate = hz ?? 0;
    if (!agreed || hz <= this.hz) return false;
    this.hz = hz;
    return true;
  }
}

/** The common refresh rate within 3% of a measurement, or null. */
function snapHz(measured: number): number | null {
  return COMMON_HZ.find((h) => Math.abs(measured - h) / h < 0.03) ?? null;
}

/**
 * Dynamic resolution. Aims for the display's refresh rate: when the frame rate stays below it,
 * render fewer pixels; when it has been steady at the target for a while, try one step back up.
 * The wait before stepping up doubles each time a step-up has to be undone, so it can't keep
 * oscillating.
 *
 * On a display faster than 60 Hz the resolution only drops to SHARP_SCALE. If that still isn't
 * enough, it aims for 60 fps instead, at full resolution, and tries the display rate again later
 * (after a wait that doubles the same way).
 */
export class AdaptiveResolution {
  readonly refresh = new RefreshRate();
  /** Frame rate being aimed for: the display's rate, or 60 while that is out of reach. */
  target = BASE_FPS;
  private cap = 1;
  private ratio = 1;
  private slowSince = 0;
  private steadySince = 0;
  private holdUntil = 0;
  private holdMs = 20_000;
  private highHoldUntil = 0;
  private highHoldMs = 30_000;
  private smoothed = BASE_FPS;
  private lastUpdate = 0;
  private settleUntil = 0;

  constructor(private readonly renderer: Pick<THREE.WebGLRenderer, 'setPixelRatio' | 'domElement'>) {}

  /** Highest pixel ratio allowed (from the quality preset); resets adaptation. */
  setCap(cap: number): void {
    this.cap = cap;
    this.holdMs = 20_000;
    this.holdUntil = 0;
    this.highHoldMs = 30_000;
    this.highHoldUntil = 0;
    this.target = this.refresh.hz;
    this.set(cap, this.lastUpdate || performance.now());
  }

  /** Share of the full resolution currently rendered (1 = full). */
  get scale(): number {
    return this.ratio / this.cap;
  }

  /** True while aiming for 60 fps because the display's faster rate would cost too much sharpness. */
  get cappedAt60(): boolean {
    return this.target < this.refresh.hz;
  }

  /** Call every frame with the latest measured fps. */
  update(rawFps: number, now: number): void {
    const was = this.refresh.hz;
    if (this.refresh.frame(now) && this.target === was) {
      // The display turned out faster than assumed: aim for it.
      this.target = this.refresh.hz;
      this.set(this.ratio, now);
    }
    if (rawFps <= 0) return;
    // ~1 s moving average, so readings that flicker around the threshold still count as slow.
    const dt = this.lastUpdate ? Math.min(0.25, (now - this.lastUpdate) / 1000) : 0;
    this.lastUpdate = now;
    // Right after a change the fps reading still describes the old setting; don't judge it yet.
    if (now < this.settleUntil) return;
    this.smoothed += (rawFps - this.smoothed) * dt;
    const fps = this.smoothed;
    if (fps < slowBelow(this.target)) {
      this.steadySince = 0;
      this.slowSince ||= now;
      if (now - this.slowSince <= 1500) return;
      const floor = this.floor();
      if (this.ratio > floor + 1e-3) {
        this.set(Math.max(floor, +(this.ratio - 0.15).toFixed(3)), now);
        this.holdUntil = now + this.holdMs;
        this.holdMs = Math.min(120_000, this.holdMs * 2);
      } else if (this.target > BASE_FPS) {
        // Keeping up with the display would cost too much sharpness: aim for 60 at full resolution.
        this.target = BASE_FPS;
        this.highHoldUntil = now + this.highHoldMs;
        this.highHoldMs = Math.min(240_000, this.highHoldMs * 2);
        this.holdMs = 20_000;
        this.holdUntil = 0;
        this.set(this.cap, now);
      }
      return;
    }
    this.slowSince = 0;
    if (fps < steadyFrom(this.target)) {
      this.steadySince = 0;
      return;
    }
    this.steadySince ||= now;
    if (now - this.steadySince <= 8000) return;
    if (this.ratio < this.cap - 1e-3 && now > this.holdUntil) {
      this.set(Math.min(this.cap, this.ratio + 0.1), now);
    } else if (this.target < this.refresh.hz && this.ratio >= this.cap - 1e-3 && now > this.highHoldUntil) {
      // Sharp and comfortably at 60 for a while: try the display rate again.
      this.target = this.refresh.hz;
      this.set(this.cap, now);
    }
  }

  private floor(): number {
    if (this.target > BASE_FPS) return this.cap * SHARP_SCALE;
    const cssHeight = this.renderer.domElement.clientHeight || 800;
    return Math.min(MIN_RATIO, Math.max(0.5, MIN_RENDER_HEIGHT / cssHeight));
  }

  private set(ratio: number, now: number): void {
    this.ratio = ratio;
    this.renderer.setPixelRatio(ratio);
    this.settleUntil = now + 1000;
    this.smoothed = this.target;
    this.slowSince = 0;
    this.steadySince = 0;
  }
}
