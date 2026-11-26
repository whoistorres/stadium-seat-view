import type { AppState, AppStore, Quality, TimeOfDay } from '../state/store';

/** Rolling FPS readout; `sample()` is called once per rendered frame. */
export class FpsMeter {
  readonly el: HTMLElement;
  /** Latest half-second average, exposed for automated checks. */
  value = 0;
  /** Extra text after the fps figure, e.g. "85% res" when resolution is reduced or "60 fps target". */
  note = '';
  private frames = 0;
  private last = performance.now();

  constructor() {
    this.el = document.createElement('span');
    this.el.className = 'fps';
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-label', 'Frames per second');
    this.el.setAttribute('aria-live', 'off');
    this.el.textContent = '-- fps';
  }

  sample(now: number): void {
    this.frames++;
    const span = now - this.last;
    if (span >= 500) {
      this.value = (this.frames * 1000) / span;
      this.el.textContent = `${Math.round(this.value)} fps${this.note ? ` · ${this.note}` : ''}`;
      this.el.title = !this.note
        ? ''
        : this.note.includes('res')
          ? 'Rendering at reduced resolution to keep up with the display'
          : 'Keeping up with this display would blur the image, so aiming for a sharp 60 fps instead';
      this.frames = 0;
      this.last = now;
    }
  }
}

function segmented<T extends string>(name: string, label: string, options: Array<[T, string]>): HTMLElement {
  // A div radiogroup rather than fieldset/legend: a legend can't be visually hidden reliably.
  const fs = document.createElement('div');
  fs.className = 'seg';
  fs.setAttribute('role', 'radiogroup');
  fs.setAttribute('aria-label', label === 'Time' ? 'Time of day' : 'Graphics quality');
  fs.innerHTML =
    `<span class="seg-label" aria-hidden="true">${label}</span>` +
    options.map(([v, text]) => `<label><input type="radio" name="${name}" value="${v}" /><span>${text}</span></label>`).join('');
  return fs;
}

/** Time-of-day and quality switches for the top bar. */
export function mountHudControls(root: HTMLElement, store: AppStore): void {
  const tod = segmented<TimeOfDay>('tod', 'Time', [
    ['day', 'Day'],
    ['evening', 'Evening'],
  ]);
  const quality = segmented<Quality>('quality', 'Quality', [
    ['low', 'Low'],
    ['high', 'High'],
  ]);
  root.append(tod, quality);

  tod.addEventListener('change', (e) => store.set({ timeOfDay: (e.target as HTMLInputElement).value as TimeOfDay }));
  quality.addEventListener('change', (e) => store.set({ quality: (e.target as HTMLInputElement).value as Quality }));

  const render = (s: AppState) => {
    tod.querySelectorAll<HTMLInputElement>('input').forEach((i) => (i.checked = i.value === s.timeOfDay));
    quality.querySelectorAll<HTMLInputElement>('input').forEach((i) => (i.checked = i.value === s.quality));
  };
  store.subscribe((s, p) => {
    if (s.timeOfDay !== p.timeOfDay || s.quality !== p.quality) render(s);
  });
  render(store.get());
}
