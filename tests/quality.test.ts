import { describe, expect, it } from 'vitest';
import { AdaptiveResolution, RefreshRate, SHARP_SCALE } from '../src/scene/quality.ts';

/**
 * Runs the controller against a simulated display and GPU. Each frame costs `costMs * ratio²`
 * (pixel count) and starts as soon as the previous one is done; it is shown at the next refresh.
 * `costMs` may change over time. Returns the controller after `seconds`.
 */
function simulate(hz: number, costMs: (t: number) => number, seconds: number, onFrame?: (r: AdaptiveResolution, t: number) => void) {
  let ratio = 1;
  const renderer = { setPixelRatio: (r: number) => (ratio = r), domElement: { clientHeight: 1000 } as HTMLCanvasElement };
  const res = new AdaptiveResolution(renderer);
  const period = 1000 / hz;
  const start = performance.now();
  res.setCap(1);
  let busyUntil = start;
  let frames = 0;
  let meterStart = start;
  let fps = 0;
  for (let t = start; t < start + seconds * 1000; ) {
    // The next frame is shown at the first refresh after it finishes.
    busyUntil += costMs(t - start) * ratio * ratio;
    t = Math.max(t + period, Math.ceil(busyUntil / period) * period);
    busyUntil = Math.max(busyUntil, t - period);
    // Same half-second average as the HUD's FpsMeter.
    frames++;
    if (t - meterStart >= 500) {
      fps = (frames * 1000) / (t - meterStart);
      frames = 0;
      meterStart = t;
    }
    res.update(fps, t);
    onFrame?.(res, t - start);
  }
  return res;
}

describe('RefreshRate', () => {
  it.each([60, 75, 120, 144, 165, 240])('finds %i Hz from regular frames', (hz) => {
    const r = new RefreshRate();
    for (let i = 0, t = 1000; i < 3 * hz; i++, t += 1000 / hz + (i % 3 === 0 ? 0.3 : -0.15)) r.frame(t);
    expect(r.hz).toBe(hz);
  });

  it('finds the display rate when some frames are late', () => {
    const r = new RefreshRate();
    const period = 1000 / 144;
    // One in three frames takes two refreshes.
    for (let i = 0, t = 1000; i < 600; i++, t += i % 3 === 0 ? 2 * period : period) r.frame(t);
    expect(r.hz).toBe(144);
  });

  it('ignores timing jitter on a 60 Hz display', () => {
    // Seen in Chromium: gaps scatter around 16.7 ms, some well short of it. A 10th-percentile
    // estimate read this as 64 Hz.
    const r = new RefreshRate();
    const jitter = [-1.1, 0.9, -0.3, 1.4, -1.6, 0.2, 0.5, -0.8, 1.0, -0.2];
    for (let i = 0, t = 1000; i < 900; i++, t += 1000 / 60 + jitter[i % jitter.length]) r.frame(t);
    expect(r.hz).toBe(60);
  });

  it("doesn't mistake a GPU-bound rate for the display's", () => {
    const r = new RefreshRate();
    const period = 1000 / 144;
    // Two in three frames take two refreshes: about 86 fps, typical gap 13.9 ms (72 Hz).
    for (let i = 0, t = 1000; i < 900; i++, t += i % 3 === 0 ? period : 2 * period) r.frame(t);
    expect([60, 144]).toContain(r.hz);
  });

  it('never goes below 60 or down', () => {
    const r = new RefreshRate();
    for (let i = 0, t = 1000; i < 300; i++, t += 1000 / 144) r.frame(t);
    for (let i = 0, t = 10_000; i < 300; i++, t += 1000 / 30) r.frame(t);
    expect(r.hz).toBe(144);
    const slow = new RefreshRate();
    for (let i = 0, t = 1000; i < 300; i++, t += 1000 / 30) slow.frame(t);
    expect(slow.hz).toBe(60);
  });
});

describe('AdaptiveResolution', () => {
  it('stays sharp on a 60 Hz display with a fast GPU', () => {
    const r = simulate(60, () => 5, 30);
    expect(r.target).toBe(60);
    expect(r.scale).toBe(1);
  });

  it('aims for a 144 Hz display it can keep up with', () => {
    const r = simulate(144, () => 4, 30);
    expect(r.refresh.hz).toBe(144);
    expect(r.target).toBe(144);
    expect(r.scale).toBe(1);
    expect(r.cappedAt60).toBe(false);
  });

  it('lowers resolution a little to keep up with 144 Hz', () => {
    // 7.8 ms at full resolution is ~128 fps; at 85% it is ~5.6 ms, inside a 6.9 ms refresh.
    // Steps back up to 95% after 20 s, finds it too slow and waits 40 s before the next try.
    const r = simulate(144, () => 7.8, 60);
    expect(r.target).toBe(144);
    expect(r.scale).toBeCloseTo(SHARP_SCALE);
  });

  it('aims for a sharp 60 fps when 144 Hz would need too much blur', () => {
    let lowest = 1;
    // 10 ms at full resolution is 100 fps; even 85% (7.2 ms) misses a 6.9 ms refresh.
    const r = simulate(144, () => 10, 25, (res) => (lowest = Math.min(lowest, res.scale)));
    expect(r.cappedAt60).toBe(true);
    expect(r.target).toBe(60);
    expect(r.scale).toBe(1);
    expect(lowest).toBeGreaterThanOrEqual(SHARP_SCALE - 1e-9);
  });

  it('tries the display rate again later, less often each time', () => {
    const retries: number[] = [];
    let was = 0;
    simulate(144, () => 10, 300, (res, t) => {
      if (res.target === 144 && was === 60) retries.push(Math.round(t / 1000));
      was = res.target;
    });
    expect(retries.length).toBeGreaterThanOrEqual(2);
    const gaps = retries.slice(1).map((t, i) => t - retries[i]);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThan(gaps[i - 1]);
  });

  it('goes back to the display rate when the scene gets lighter', () => {
    // Heavy for the first 20 s (an upper-tier seat view, say), then light.
    const r = simulate(144, (t) => (t < 20_000 ? 10 : 4), 120);
    expect(r.target).toBe(144);
    expect(r.scale).toBe(1);
  });

  it('on a 60 Hz display lowers resolution down to its floor as before', () => {
    // 25 ms at full resolution is 40 fps; 70% (12 ms) holds 60.
    const r = simulate(60, () => 25, 30);
    expect(r.target).toBe(60);
    expect(r.scale).toBeCloseTo(0.7);
  });
});
