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

// A smooth 60 Hz loop averages 59.5+, so a smoothed rate under 58 is real slowdown.
const SLOW_FPS = 58;
const STEADY_FPS = 59;
// Lowest pixel ratio on ordinary windows. Measured on Iris Xe: a 2560x1440 window needs ~0.7 to
// hold 60 fps in upper-tier seat views. Lowering resolution was preferred over switching shadows
// off, which pops the lighting.
const MIN_RATIO = 0.7;
// On very large windows the floor may go lower, but never below this many rendered pixels of
// height (about 1080p sharpness) or below 0.5.
const MIN_RENDER_HEIGHT = 1100;

/**
 * Dynamic resolution: when the frame rate stays low, render fewer pixels; when it has been
 * steady at the display rate for a while, try one step back up. The wait before stepping up
 * doubles each time a step-up has to be undone, so it can't keep oscillating.
 */
export class AdaptiveResolution {
  private cap = 1;
  private ratio = 1;
  private slowSince = 0;
  private steadySince = 0;
  private holdUntil = 0;
  private holdMs = 20_000;
  private smoothed = 60;
  private lastUpdate = 0;
  private settleUntil = 0;

  constructor(private readonly renderer: THREE.WebGLRenderer) {}

  /** Highest pixel ratio allowed (from the quality preset); resets adaptation. */
  setCap(cap: number): void {
    this.cap = cap;
    this.holdMs = 20_000;
    this.holdUntil = 0;
    this.set(cap);
  }

  /** Share of the full resolution currently rendered (1 = full). */
  get scale(): number {
    return this.ratio / this.cap;
  }

  /** Call every frame with the latest measured fps. */
  update(rawFps: number, now: number): void {
    if (rawFps <= 0) return;
    // ~1 s moving average, so readings that flicker around the threshold still count as slow.
    const dt = this.lastUpdate ? Math.min(0.25, (now - this.lastUpdate) / 1000) : 0;
    this.lastUpdate = now;
    // Right after a change the fps reading still describes the old setting; don't judge it yet.
    if (now < this.settleUntil) return;
    this.smoothed += (rawFps - this.smoothed) * dt;
    const fps = this.smoothed;
    if (fps < SLOW_FPS) {
      this.steadySince = 0;
      this.slowSince ||= now;
      const floor = this.floor();
      if (now - this.slowSince > 1500 && this.ratio > floor + 1e-3) {
        this.set(Math.max(floor, +(this.ratio - 0.15).toFixed(2)));
        this.holdUntil = now + this.holdMs;
        this.holdMs = Math.min(120_000, this.holdMs * 2);
      }
      return;
    }
    this.slowSince = 0;
    if (fps < STEADY_FPS) {
      this.steadySince = 0;
      return;
    }
    this.steadySince ||= now;
    if (now - this.steadySince > 8000 && now > this.holdUntil && this.ratio < this.cap - 1e-3) {
      this.set(Math.min(this.cap, this.ratio + 0.1));
      this.steadySince = now;
    }
  }

  private floor(): number {
    const cssHeight = this.renderer.domElement.clientHeight || 800;
    return Math.min(MIN_RATIO, Math.max(0.5, MIN_RENDER_HEIGHT / cssHeight));
  }

  private set(ratio: number): void {
    this.ratio = ratio;
    this.renderer.setPixelRatio(ratio);
    this.settleUntil = performance.now() + 1000;
    this.smoothed = 60;
    this.slowSince = 0;
    this.steadySince = 0;
  }
}
