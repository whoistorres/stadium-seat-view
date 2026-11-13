export class Tooltip {
  constructor(
    private readonly el: HTMLElement,
    private readonly stage: HTMLElement,
  ) {}

  show(html: string, clientX: number, clientY: number): void {
    if (this.el.innerHTML !== html) this.el.innerHTML = html;
    this.el.hidden = false;
    const r = this.stage.getBoundingClientRect();
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    let x = clientX - r.left + 16;
    let y = clientY - r.top + 16;
    if (x + w > r.width - 8) x = clientX - r.left - w - 16;
    if (y + h > r.height - 8) y = clientY - r.top - h - 16;
    this.el.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  }

  hide(): void {
    this.el.hidden = true;
  }
}
