import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bowlPieces, pieceLength, pointOnPiece, type Piece } from '../data/bowlPath';
import type { BowlShape, FacadeStyle, ShellSpec } from '../data/types';
import { pieceBand } from './geo';

/** Default width of the paved apron round the outer walls. */
export const DEFAULT_APRON = 15;

/** One horizontal strip of an outer wall: glazing, or cladding in a flat colour. */
interface Strip {
  y0: number;
  y1: number;
  glass?: boolean;
  color?: number;
}

/** Repeats [height, strip] modules from y0 up to y1, cutting the last one short. */
function modules(y0: number, y1: number, pattern: Array<[number, Omit<Strip, 'y0' | 'y1'>]>): Strip[] {
  const out: Strip[] = [];
  let y = y0;
  for (let i = 0; y < y1 - 1e-3; i++) {
    const [h, s] = pattern[i % pattern.length];
    out.push({ ...s, y0: y, y1: Math.min(y1, y + h) });
    y += h;
  }
  return out;
}

/** Horizontal strips for an outer wall of height h. Concrete is a single plain strip. */
export function facadeStrips(style: FacadeStyle, h: number): Strip[] {
  switch (style) {
    case 'glass': {
      // Dark plinth, then storeys of glazing over light spandrels, light parapet on top.
      const plinth = Math.min(4, h * 0.3);
      const top = Math.max(plinth, h - 1.2);
      return [
        { y0: 0, y1: plinth, color: 0x4a5058 },
        ...modules(plinth, top, [[3.3, { glass: true }], [0.9, { color: 0xdadde1 }]]),
        { y0: top, y1: h, color: 0xdadde1 },
      ];
    }
    case 'panels': {
      const base = Math.min(3, h * 0.3);
      const top = Math.max(base, h - 1);
      return [
        { y0: 0, y1: base, color: 0x7d838b },
        ...modules(base, top, [[2.75, { color: 0xe4e7eb }], [0.25, { color: 0xa9afb6 }]]),
        { y0: top, y1: h, color: 0x9aa1a9 },
      ];
    }
    case 'brick': {
      const top = Math.max(0, h - 0.8);
      return [...modules(0, top, [[5.6, { color: 0x8a4b3a }], [0.4, { color: 0xb98d6e }]]), { y0: top, y1: h, color: 0xcfc7bb }];
    }
    default:
      return [{ y0: 0, y1: h, color: 0xb9bec6 }];
  }
}

/** Paints every vertex of a geometry one colour (hex in sRGB). */
function paint(g: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Collects styled outer walls stand by stand, then builds their meshes. */
export class FacadeBuilder {
  private cladding: THREE.BufferGeometry[] = [];
  private glass: THREE.BufferGeometry[] = [];
  private mullions: THREE.Matrix4[] = [];

  /** Outer wall of one piece at offset d, from the ground to height h, facing out. */
  add(shape: BowlShape, piece: Piece, d: number, h: number, style: FacadeStyle): void {
    for (const s of facadeStrips(style, h)) {
      // Top -> bottom faces out (see pieceBand).
      const g = pieceBand(shape, piece, { d, y: s.y1 }, { d, y: s.y0 });
      if (s.glass) this.glass.push(g);
      else this.cladding.push(paint(g, s.color ?? 0xb9bec6));
    }
    if (style !== 'glass') return;
    // Vertical mullions every ~4 m over the glazed storeys, standing just proud of the wall.
    const strips = facadeStrips(style, h).filter((s) => s.glass);
    if (!strips.length) return;
    const y0 = strips[0].y0;
    const y1 = strips[strips.length - 1].y1;
    const count = Math.max(1, Math.round(pieceLength(piece, shape, d) / 4));
    for (let i = 0; i <= count; i++) {
      const p = pointOnPiece(piece, shape, d + 0.1, i / count);
      const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(p.nx, p.nz));
      this.mullions.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, (y0 + y1) / 2, p.z), rot, new THREE.Vector3(1, y1 - y0, 1)));
    }
  }

  /** Meshes for the walls added so far; `cladding` and `glass` are null when unused. */
  build(): { meshes: THREE.Object3D[]; cladding: THREE.MeshStandardMaterial | null; glass: THREE.MeshStandardMaterial | null } {
    const meshes: THREE.Object3D[] = [];
    let cladding: THREE.MeshStandardMaterial | null = null;
    let glass: THREE.MeshStandardMaterial | null = null;
    if (this.cladding.length) {
      cladding = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
      const mesh = new THREE.Mesh(mergeGeometries(this.cladding), cladding);
      mesh.name = 'facade-cladding';
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      meshes.push(mesh);
      if (this.mullions.length) {
        const m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 1, 0.25), cladding, this.mullions.length);
        // Instanced boxes need the vertex colours too: paint them the spandrel colour.
        paint(m.geometry, 0xdadde1);
        this.mullions.forEach((m4, i) => m.setMatrixAt(i, m4));
        m.computeBoundingSphere();
        m.name = 'facade-mullions';
        meshes.push(m);
      }
    }
    if (this.glass.length) {
      // Emissive warmth is turned up in the evening (lit windows); off by day.
      glass = new THREE.MeshStandardMaterial({ color: 0x2f4656, roughness: 0.2, metalness: 0.4, emissive: 0xffd28a, emissiveIntensity: 0 });
      const mesh = new THREE.Mesh(mergeGeometries(this.glass), glass);
      mesh.name = 'facade-glass';
      mesh.receiveShadow = true;
      meshes.push(mesh);
    }
    [...this.cladding, ...this.glass].forEach((g) => g.dispose());
    return { meshes, cladding, glass };
  }
}

/**
 * Paved ring round the building: from each stand's outer wall (or the front-row line where
 * there is no stand) out to a common edge `width` beyond the deepest stand.
 */
export function buildApron(shell: ShellSpec): THREE.Mesh | null {
  const width = shell.apron ?? DEFAULT_APRON;
  if (width <= 0) return null;
  const outer = Math.max(0, ...shell.stands.map((s) => s?.outerD ?? 0)) + width;
  const pieces = bowlPieces(shell.shape);
  // Inner -> outer faces up.
  const geos = pieces.map((piece, pi) => pieceBand(shell.shape, piece, { d: shell.stands[pi]?.outerD ?? 0, y: 0.02 }, { d: outer, y: 0.02 }));
  const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color: 0xa9a69e, roughness: 0.95 }));
  geos.forEach((g) => g.dispose());
  mesh.name = 'apron';
  mesh.receiveShadow = true;
  return mesh;
}
