import * as THREE from 'three';
import type { Stadium } from '../data/loadData';
import type { Tickets } from '../data/tickets';

/**
 * Floating "214 | B" tag above each section, so the price category is readable in 3D by
 * letter and not by colour alone.
 */
export class SectionLabels {
  readonly group = new THREE.Group();
  private readonly sprites: THREE.Sprite[] = [];

  constructor(stadium: Stadium, tickets: Tickets) {
    this.group.name = 'section-labels';
    stadium.sections.forEach((s, si) => {
      const cat = tickets.category(si);
      const canvas = document.createElement('canvas');
      canvas.width = 176;
      canvas.height = 72;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'rgba(14, 17, 22, 0.86)';
      ctx.beginPath();
      ctx.roundRect(0, 0, 176, 72, 14);
      ctx.fill();
      ctx.fillStyle = cat.color;
      ctx.beginPath();
      ctx.roundRect(118, 10, 48, 52, 10);
      ctx.fill();
      ctx.font = 'bold 40px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(s.id, 60, 39);
      ctx.fillStyle = '#000000';
      ctx.fillText(cat.id, 142, 39);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      // On the front wall below row 1, where it covers no seats.
      const firstRow = s.rows[0].seats;
      const mid = firstRow[firstRow.length >> 1];
      const push = stadium.data.seat.inset + 0.4;
      sprite.position.set(mid[1] + Math.sin(mid[4]) * push, mid[2] + 0.2, mid[3] + Math.cos(mid[4]) * push);
      sprite.center.set(0.5, 0.75);
      sprite.renderOrder = 5;
      this.sprites.push(sprite);
      this.group.add(sprite);
    });
  }

  private readonly dimmed: boolean[] = [];

  /** Fade sections that have nothing inside the current filters. */
  setDimmed(section: number, dimmed: boolean): void {
    this.dimmed[section] = dimmed;
  }

  /**
   * Per frame: labels fade out with distance. From the overview they would be unreadable
   * specks; they appear as the camera closes in.
   */
  update(camera: THREE.Camera): void {
    const near = 90;
    const far = 150;
    for (let i = 0; i < this.sprites.length; i++) {
      const sp = this.sprites[i];
      const d = camera.position.distanceTo(sp.position);
      const fade = THREE.MathUtils.clamp((far - d) / (far - near), 0, 1);
      sp.visible = fade > 0.01;
      // Grow with distance so the tag stays a readable ~50 px wide without hiding seats up close.
      const w = THREE.MathUtils.clamp(d * 0.06, 2.2, 8.8);
      sp.scale.set(w, w * (72 / 176), 1);
      sp.material.opacity = fade * (this.dimmed[i] ? 0.3 : 1);
    }
  }
}
