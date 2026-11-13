import type { Tickets } from '../data/tickets';
import type { CategoryId } from '../data/types';
import type { AppState, AppStore } from '../state/store';
import { escapeHtml } from './labels';

/** Price legend that doubles as the category filter, plus min/max price sliders. */
export function mountLegend(root: HTMLElement, tickets: Tickets, store: AppStore): void {
  const freeByCat = new Map<CategoryId, number>();
  tickets.sectionCategory.forEach((c, si) => freeByCat.set(c.id, (freeByCat.get(c.id) ?? 0) + tickets.available(si)));
  // Largest step that still lands exactly on every price point.
  const gcd = (a: number, b: number): number => (b < 0.5 ? a : gcd(b, a % b));
  const step = tickets.categories.reduce((g, c) => gcd(g, Math.round(c.price - tickets.minPrice)), 0) || 1;

  root.innerHTML = `
    <h2 id="price-h">Prices &amp; availability</h2>
    <fieldset class="legend">
      <legend class="sr-only">Price categories to show</legend>
      ${tickets.categories
        .map(
          (c) => `
        <label class="legend-item">
          <input type="checkbox" data-cat="${c.id}" checked />
          <span class="swatch pat-${c.pattern}" style="--c:${c.color}" aria-hidden="true">${c.id}</span>
          <span class="legend-text">
            <span><b>${c.id} · ${escapeHtml(c.label)}</b> <span class="price">${tickets.format(c.price)}</span></span>
            <span class="muted">${(freeByCat.get(c.id) ?? 0).toLocaleString('en')} seats free</span>
          </span>
        </label>`,
        )
        .join('')}
      <div class="legend-item legend-static">
        <span class="swatch swatch-sold" aria-hidden="true">✕</span>
        <span class="legend-text"><b>Sold</b><span class="muted">Grey seats can't be selected</span></span>
      </div>
    </fieldset>
    <div class="field">
      <label for="min-price">Min price <output id="min-out"></output></label>
      <input type="range" id="min-price" min="${tickets.minPrice}" max="${tickets.maxPrice}" step="${step}" />
    </div>
    <div class="field">
      <label for="max-price">Max price <output id="max-out"></output></label>
      <input type="range" id="max-price" min="${tickets.minPrice}" max="${tickets.maxPrice}" step="${step}" />
    </div>
    <p class="match-count" id="match-count" aria-live="polite"></p>
    <div class="legend-actions">
      <button type="button" class="btn" id="reset-filters">Reset filters</button>
      <label class="check"><input type="checkbox" id="show-labels" checked /> Section labels</label>
    </div>`;

  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const minIn = q<HTMLInputElement>('#min-price');
  const maxIn = q<HTMLInputElement>('#max-price');
  const minOut = q<HTMLOutputElement>('#min-out');
  const maxOut = q<HTMLOutputElement>('#max-out');
  const count = q<HTMLElement>('#match-count');
  const labels = q<HTMLInputElement>('#show-labels');
  const boxes = [...root.querySelectorAll<HTMLInputElement>('[data-cat]')];

  const setFilters = (patch: Partial<AppState['filters']>) =>
    store.set({ filters: { ...store.get().filters, ...patch } });

  boxes.forEach((b) =>
    b.addEventListener('change', () =>
      setFilters({ categories: { ...store.get().filters.categories, [b.dataset.cat as CategoryId]: b.checked } }),
    ),
  );
  minIn.addEventListener('input', () => {
    const v = Number(minIn.value);
    setFilters({ minPrice: v, maxPrice: Math.max(v, store.get().filters.maxPrice) });
  });
  maxIn.addEventListener('input', () => {
    const v = Number(maxIn.value);
    setFilters({ maxPrice: v, minPrice: Math.min(v, store.get().filters.minPrice) });
  });
  q('#reset-filters').addEventListener('click', () =>
    setFilters({ categories: { A: true, B: true, C: true, D: true }, minPrice: tickets.minPrice, maxPrice: tickets.maxPrice }),
  );
  labels.addEventListener('change', () => store.set({ showLabels: labels.checked }));

  const render = (s: AppState) => {
    const f = s.filters;
    boxes.forEach((b) => (b.checked = f.categories[b.dataset.cat as CategoryId]));
    minIn.value = String(f.minPrice);
    maxIn.value = String(f.maxPrice);
    minOut.textContent = tickets.format(f.minPrice);
    maxOut.textContent = tickets.format(f.maxPrice);
    let free = 0;
    tickets.sectionCategory.forEach((_, si) => {
      if (tickets.sectionMatches(si, f)) free += tickets.available(si);
    });
    count.textContent = free
      ? `${free.toLocaleString('en')} seats available in your filters`
      : 'No seats match these filters. Try a higher max price or more categories.';
    labels.checked = s.showLabels;
  };
  store.subscribe((s, p) => {
    if (s.filters !== p.filters || s.showLabels !== p.showLabels) render(s);
  });
  render(store.get());
}
