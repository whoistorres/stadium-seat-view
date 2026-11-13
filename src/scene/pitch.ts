import * as THREE from 'three';
import { ringPoints } from '../data/bowlPath';
import type { BowlShape, StadiumData } from '../data/types';
import { QuadBuilder, type V3 } from './geo';

const LINE = 0.12;
const MARGIN = 4;
const UP: V3 = [0, 1, 0];

/** Mowing stripes plus fine mottling, drawn once to a canvas. */
function grassTexture(length: number, width: number, maxAnisotropy: number): THREE.CanvasTexture {
  const totalL = length + MARGIN * 2;
  const totalW = width + MARGIN * 2;
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = Math.round((2048 * totalW) / totalL);
  const ctx = canvas.getContext('2d')!;
  const px = canvas.width / totalL;

  ctx.fillStyle = '#2f6f31';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const stripes = 18;
  const stripeW = length / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#3f9140' : '#357f37';
    ctx.fillRect((MARGIN + i * stripeW) * px, MARGIN * px, stripeW * px + 1, width * px);
  }

  // Deterministic speckle so the turf is not a flat fill up close.
  let seed = 1337;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 26000; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(rand() * canvas.width, rand() * canvas.height, 2 + rand() * 4, 1 + rand() * 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function markings(length: number, width: number): THREE.BufferGeometry {
  const qb = new QuadBuilder();
  const y = 0.02;
  const hl = length / 2;
  const hw = width / 2;
  const h = LINE / 2;

  const rect = (x0: number, z0: number, x1: number, z1: number) =>
    qb.quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0], UP);
  const alongX = (x0: number, x1: number, z: number) => rect(Math.min(x0, x1) - h, z - h, Math.max(x0, x1) + h, z + h);
  const alongZ = (x: number, z0: number, z1: number) => rect(x - h, Math.min(z0, z1) - h, x + h, Math.max(z0, z1) + h);
  const arc = (cx: number, cz: number, rIn: number, rOut: number, a0: number, a1: number) => {
    const segs = Math.max(6, Math.ceil((Math.abs(a1 - a0) * rOut) / 0.5));
    for (let i = 0; i < segs; i++) {
      const p = a0 + ((a1 - a0) * i) / segs;
      const q = a0 + ((a1 - a0) * (i + 1)) / segs;
      qb.quad(
        [cx + Math.cos(p) * rIn, y, cz + Math.sin(p) * rIn],
        [cx + Math.cos(p) * rOut, y, cz + Math.sin(p) * rOut],
        [cx + Math.cos(q) * rOut, y, cz + Math.sin(q) * rOut],
        [cx + Math.cos(q) * rIn, y, cz + Math.sin(q) * rIn],
        UP,
      );
    }
  };
  const circle = (cx: number, cz: number, r: number, a0 = 0, a1 = Math.PI * 2) => arc(cx, cz, r - h, r + h, a0, a1);
  const spot = (cx: number, cz: number) => arc(cx, cz, 0, 0.2, 0, Math.PI * 2);

  alongX(-hl, hl, -hw);
  alongX(-hl, hl, hw);
  alongZ(-hl, -hw, hw);
  alongZ(hl, -hw, hw);
  alongZ(0, -hw, hw);
  circle(0, 0, 9.15);
  spot(0, 0);

  // Law 1 dimensions: penalty area 16.5 x 40.32, goal area 5.5 x 18.32, spot at 11, arc radius 9.15.
  const arcHalf = Math.acos(5.5 / 9.15);
  for (const s of [-1, 1]) {
    const gx = s * hl;
    alongZ(gx - s * 16.5, -20.16, 20.16);
    alongX(gx, gx - s * 16.5, -20.16);
    alongX(gx, gx - s * 16.5, 20.16);
    alongZ(gx - s * 5.5, -9.16, 9.16);
    alongX(gx, gx - s * 5.5, -9.16);
    alongX(gx, gx - s * 5.5, 9.16);
    spot(gx - s * 11, 0);
    const towardsCentre = s > 0 ? Math.PI : 0;
    circle(gx - s * 11, 0, 9.15, towardsCentre - arcHalf, towardsCentre + arcHalf);
    for (const t of [-1, 1]) {
      // Quarter circle opening into the pitch from each corner.
      const mid = Math.atan2(-t, -s);
      circle(gx, t * hw, 1, mid - Math.PI / 4, mid + Math.PI / 4);
    }
  }
  return qb.build();
}

function goal(side: number, halfLength: number): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const x = side * halfLength;
  const W = 7.32 / 2;
  const H = 2.44;
  const R = 0.06;

  for (const z of [-W, W]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 10), post);
    m.position.set(x, H / 2, z);
    m.castShadow = true;
    g.add(m);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(R, R, W * 2 + R * 2, 10), post);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(x, H, 0);
  bar.castShadow = true;
  g.add(bar);

  // Net as line grids on four bilinear patches (top, back, two sides).
  const topBack = x + side * 0.8;
  const floorBack = x + side * 2.0;
  const P = (px: number, py: number, pz: number) => new THREE.Vector3(px, py, pz);
  const patches: THREE.Vector3[][] = [
    [P(x, H, -W), P(x, H, W), P(topBack, H, W), P(topBack, H, -W)],
    [P(topBack, H, -W), P(topBack, H, W), P(floorBack, 0, W), P(floorBack, 0, -W)],
    [P(x, H, -W), P(topBack, H, -W), P(floorBack, 0, -W), P(x, 0, -W)],
    [P(x, H, W), P(topBack, H, W), P(floorBack, 0, W), P(x, 0, W)],
  ];
  const pts: number[] = [];
  const lerp = (a: THREE.Vector3, b: THREE.Vector3, t: number) => a.clone().lerp(b, t);
  for (const [a, b, c, d] of patches) {
    const nu = Math.max(2, Math.round(a.distanceTo(b) / 0.25));
    const nv = Math.max(2, Math.round(a.distanceTo(d) / 0.25));
    for (let i = 0; i <= nu; i++) {
      const p = lerp(a, b, i / nu);
      const q = lerp(d, c, i / nu);
      pts.push(p.x, p.y, p.z, q.x, q.y, q.z);
    }
    for (let j = 0; j <= nv; j++) {
      const p = lerp(a, d, j / nv);
      const q = lerp(b, c, j / nv);
      pts.push(p.x, p.y, p.z, q.x, q.y, q.z);
    }
  }
  const netGeo = new THREE.BufferGeometry();
  netGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })));
  return g;
}

function boardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const panels: Array<[string, string, string]> = [
    ['#0b3d91', '#ffffff', 'MATCHDAY'],
    ['#f2f2f2', '#14213d', 'SEAT VIEW'],
    ['#b3171d', '#ffffff', 'KICK-OFF'],
    ['#101418', '#ffd23f', 'FAN ZONE'],
  ];
  const w = canvas.width / panels.length;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 34px system-ui, sans-serif';
  panels.forEach(([bg, fg, text], i) => {
    ctx.fillStyle = bg;
    ctx.fillRect(i * w, 0, w, canvas.height);
    ctx.fillStyle = fg;
    ctx.fillText(text, i * w + w / 2, canvas.height / 2 + 2);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function adBoards(length: number, width: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'ad-boards';
  const height = 0.9;
  const runs: Array<{ len: number; x: number; z: number; rot: number }> = [
    { len: length - 9, x: 0, z: width / 2 + 4, rot: 0 },
    { len: length - 9, x: 0, z: -(width / 2 + 4), rot: 0 },
    { len: width - 12, x: length / 2 + 5.5, z: 0, rot: Math.PI / 2 },
    { len: width - 12, x: -(length / 2 + 5.5), z: 0, rot: Math.PI / 2 },
  ];
  const base = boardTexture();
  for (const run of runs) {
    const tex = base.clone();
    tex.needsUpdate = true;
    tex.repeat.set(run.len / 16, 1);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: 0xffffff,
      emissiveIntensity: 0.35,
      roughness: 0.6,
    });
    const m = new THREE.Mesh(new THREE.BoxGeometry(run.len, height, 0.15), mat);
    m.position.set(run.x, height / 2, run.z);
    m.rotation.y = run.rot;
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

function surround(shape: BowlShape | null, length: number, width: number): THREE.Mesh {
  const outline = new THREE.Shape();
  if (shape) {
    ringPoints(shape, 0.5, 20).forEach((p, i) => (i === 0 ? outline.moveTo(p.x, -p.z) : outline.lineTo(p.x, -p.z)));
  } else {
    const hx = length / 2 + 12;
    const hz = width / 2 + 12;
    outline.moveTo(-hx, -hz).lineTo(hx, -hz).lineTo(hx, hz).lineTo(-hx, hz);
  }
  outline.closePath();
  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(outline),
    new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.95 }),
  );
  // ShapeGeometry is built in XY; lay it flat (shape y = -z so it lands the right way up).
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  mesh.name = 'track';
  return mesh;
}

export function buildPitch(data: StadiumData, maxAnisotropy: number): THREE.Group {
  const { length, width } = data.pitch;
  const group = new THREE.Group();
  group.name = 'pitch';

  group.add(surround(data.shell?.shape ?? null, length, width));

  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(length + MARGIN * 2, width + MARGIN * 2),
    new THREE.MeshStandardMaterial({ map: grassTexture(length, width, maxAnisotropy), roughness: 1 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0.01;
  grass.receiveShadow = true;
  grass.name = 'grass';
  group.add(grass);

  const lines = new THREE.Mesh(
    markings(length, width),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  lines.receiveShadow = true;
  lines.name = 'markings';
  group.add(lines);

  group.add(goal(-1, length / 2), goal(1, length / 2), adBoards(length, width));
  return group;
}
