import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SeatRef, Stadium } from '../data/loadData';
import type { Tickets } from '../data/tickets';
import { QuadBuilder } from './geo';

type Face = 'front' | 'back' | 'left' | 'right' | 'top';

function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, faces: Face[], head: boolean) {
  const qb = new QuadBuilder();
  const F: Record<Face, () => void> = {
    front: () => qb.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]),
    back: () => qb.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1]),
    left: () => qb.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]),
    right: () => qb.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0]),
    top: () => qb.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0]),
  };
  faces.forEach((f) => F[f]());
  const g = qb.build();
  g.deleteAttribute('color');
  const n = g.getAttribute('position').count;
  g.setAttribute('aHead', new THREE.Float32BufferAttribute(new Float32Array(n).fill(head ? 1 : 0), 1));
  return g;
}

/** Oval low-poly head (20 triangles). */
function head(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.1, 0);
  g.deleteAttribute('uv');
  g.scale(0.88, 1.12, 0.98);
  g.translate(0, 1.15, -0.03);
  const n = g.getAttribute('position').count;
  g.setAttribute('aHead', new THREE.Float32BufferAttribute(new Float32Array(n).fill(1), 1));
  return g;
}

/** Seated spectator, origin at tread level, facing +Z. Near: 30 triangles. Far: 4. */
function figure(detailed: boolean): THREE.BufferGeometry {
  const all: Face[] = ['front', 'back', 'left', 'right', 'top'];
  const parts = detailed
    ? [box(-0.18, 0.18, 0.46, 1.0, -0.16, 0.05, all, false), head()]
    : [box(-0.18, 0.18, 0.46, 1.0, -0.16, 0.05, ['front'], false), box(-0.1, 0.1, 1.04, 1.26, -0.12, 0.08, ['top'], true)];
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  g.computeBoundingSphere();
  return g;
}

// Generic mixed crowd, used when the stadium has no team colours.
const SHIRTS = ['#c8102e', '#f2f2f2', '#1d2b53', '#111111', '#7a7f87', '#f1c40f', '#2e7d32', '#5fa8e8', '#8e1b3a', '#e67e22', '#ffffff', '#24324a'];
/** Jackets and jumpers worn over (or instead of) the shirt. */
const COATS = ['#1a1f2b', '#2b2f36', '#3a3f47', '#4a4440', '#20262e', '#5b6068', '#3b2f2a'];
/** Share of a team-coloured crowd wearing the shirt; the rest wear a coat. */
const IN_SHIRT = 0.62;

/** A kit split into its main colour and, for stripes, the second colour. */
function parseKit(kit: string): [string, string | null] {
  const [a, b] = kit.split('/');
  return [a, b ?? null];
}

function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

function crowdMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.92 });
  // Instance colour is the shirt. Heads are not tinted by it: the face side (object-space +Z,
  // towards the pitch) gets skin, the back and top get hair, both varied per person.
  // aKit2 (per instance): second shirt colour in rgb, a = 1 for vertical stripes across the torso.
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSkin = { value: new THREE.Color('#c08a68') };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float aHead;\nattribute vec4 aKit2;\nuniform vec3 uSkin;\nvarying vec4 vKit2;\nvarying float vLocalX;\nvarying float vTorso;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvKit2 = aKit2;\nvLocalX = position.x;\nvTorso = 1.0 - aHead;')
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        #ifdef USE_INSTANCING_COLOR
          vec3 seedC = instanceColor.rgb + vec3(float(gl_InstanceID) * 0.618);
          float r1 = fract(sin(dot(seedC, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          float r2 = fract(sin(dot(seedC, vec3(39.346, 11.135, 83.155))) * 24634.6345);
          vec3 skin = uSkin * (0.45 + 0.75 * r1);
          vec3 hair = r2 < 0.15 ? vec3(0.45, 0.33, 0.12) : r2 < 0.3 ? vec3(0.25, 0.25, 0.25) : vec3(0.02 + 0.06 * r2, 0.015 + 0.03 * r2, 0.01);
          float face = smoothstep(-0.15, 0.35, normal.z) * (1.0 - smoothstep(0.5, 0.8, normal.y));
          vColor.rgb = mix(instanceColor.rgb, mix(hair, skin, face), aHead);
        #endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vKit2;\nvarying float vLocalX;\nvarying float vTorso;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // Four stripes across the 0.36 m torso, front and back.
        float stripe = step(0.5, fract((vLocalX + 0.18) / 0.09)) * vKit2.a * step(0.5, vTorso);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuse * vKit2.rgb, stripe);`,
      );
  };
  return m;
}

/** A figure geometry for one section: shares the base buffers, adds that section's stripes. */
function withKits(base: THREE.BufferGeometry, kit2: THREE.InstancedBufferAttribute): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  if (base.index) g.setIndex(base.index);
  for (const [name, attr] of Object.entries(base.attributes)) g.setAttribute(name, attr);
  g.setAttribute('aKit2', kit2);
  g.boundingSphere = base.boundingSphere;
  return g;
}

/** Low-cost spectators on sold seats: one InstancedMesh per section, near/far LOD, density cut by draw count. */
export class Crowd {
  readonly group = new THREE.Group();
  private readonly meshes: Array<THREE.InstancedMesh | null> = [];
  /** Per section: near and far figure geometries carrying its stripes. */
  private readonly lods: Array<{ near: THREE.BufferGeometry; far: THREE.BufferGeometry } | null> = [];
  /** Per section: seat instance index -> crowd instance index, or -1. */
  private readonly slot: Int32Array[] = [];
  private readonly centres: THREE.Vector3[];
  private readonly near = figure(true);
  private readonly far = figure(false);
  private nearDistance = 60;
  private hidden: { section: number; index: number; matrix: THREE.Matrix4 } | null = null;

  constructor(
    private readonly stadium: Stadium,
    tickets: Tickets,
  ) {
    this.group.name = 'crowd';
    this.centres = stadium.meta.map((m) => new THREE.Vector3(...m.centre));
    const material = crowdMaterial();
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const color = new THREE.Color();
    const second = new THREE.Color();
    const teams = stadium.data.crowd;
    const away = new Set(teams?.awaySections ?? []);

    stadium.sections.forEach((section, si) => {
      const seatCount = stadium.meta[si].seatCount;
      const slots = new Int32Array(seatCount).fill(-1);
      this.slot.push(slots);
      const sold: number[] = [];
      for (let i = 0; i < seatCount; i++) if (tickets.isSoldAt(si, i)) sold.push(i);
      if (sold.length === 0) {
        this.meshes.push(null);
        this.lods.push(null);
        return;
      }
      // Shuffle deterministically so lowering the draw count removes a random-looking subset.
      sold.sort((a, b) => hash(si, a) - hash(si, b));

      const kit2 = new THREE.InstancedBufferAttribute(new Float32Array(sold.length * 4), 4);
      const lod = { near: withKits(this.near, kit2), far: withKits(this.far, kit2) };
      this.lods.push(lod);
      const kits = teams ? (away.has(section.id) && teams.away ? teams.away : teams.home) : null;
      const mesh = new THREE.InstancedMesh(lod.far, material, sold.length);
      sold.forEach((inst, k) => {
        slots[inst] = k;
        const ref = stadium.refFromInstance(si, inst);
        const t = stadium.tuple(ref);
        const r = hash(inst, si + 1000);
        // Small random lean, turn and size so rows don't look stamped.
        q.setFromAxisAngle(up, t[4] + (r - 0.5) * 0.35);
        p.set(t[1], t[2], t[3]);
        s.setScalar(0.92 + r * 0.16);
        mesh.setMatrixAt(k, m4.compose(p, q, s));
        const pick = hash(si * 7 + 3, inst);
        if (!kits) {
          mesh.setColorAt(k, color.set(SHIRTS[Math.floor(pick * SHIRTS.length)]));
        } else if (hash(si * 13 + 5, inst) < IN_SHIRT) {
          const [a, b] = parseKit(kits[Math.floor(pick * kits.length)]);
          mesh.setColorAt(k, color.set(a));
          if (b) {
            second.set(b);
            kit2.setXYZW(k, second.r, second.g, second.b, 1);
          }
        } else {
          mesh.setColorAt(k, color.set(COATS[Math.floor(pick * COATS.length)]));
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.receiveShadow = true;
      mesh.name = `crowd-${section.id}`;
      this.meshes.push(mesh);
      this.group.add(mesh);
    });
  }

  /** 0..1 share of sold seats that get a figure. */
  setDensity(density: number): void {
    for (const mesh of this.meshes) {
      if (mesh) mesh.count = Math.round(mesh.instanceMatrix.count * density);
    }
  }

  setNearDistance(d: number): void {
    this.nearDistance = d;
  }

  get drawnFigures(): number {
    return this.meshes.reduce((n, m) => n + (m?.count ?? 0), 0);
  }

  updateLod(camera: THREE.Camera): void {
    const p = camera.position;
    for (let i = 0; i < this.meshes.length; i++) {
      const mesh = this.meshes[i];
      if (!mesh) continue;
      const lod = this.lods[i]!;
      const want = p.distanceTo(this.centres[i]) - this.stadium.meta[i].radius < this.nearDistance ? lod.near : lod.far;
      if (mesh.geometry !== want) mesh.geometry = want;
    }
  }

  /** Remove the figure on the seat the camera is sitting in (null restores it). */
  hideSeat(ref: SeatRef | null): void {
    const h = this.hidden;
    if (h && (!ref || ref.section !== h.section || this.slot[h.section][this.stadium.instanceIndex(ref)] !== h.index)) {
      const mesh = this.meshes[h.section]!;
      mesh.setMatrixAt(h.index, h.matrix);
      mesh.instanceMatrix.needsUpdate = true;
      this.hidden = null;
    }
    if (!ref || this.hidden) return;
    const index = this.slot[ref.section][this.stadium.instanceIndex(ref)];
    const mesh = this.meshes[ref.section];
    if (index < 0 || !mesh) return;
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(index, matrix);
    mesh.setMatrixAt(index, new THREE.Matrix4().makeScale(0, 0, 0));
    mesh.instanceMatrix.needsUpdate = true;
    this.hidden = { section: ref.section, index, matrix };
  }
}
