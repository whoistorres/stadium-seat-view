import * as THREE from 'three';
import type { DugoutSpec, ScoreboardSpec, ShellSpec } from '../data/types';

/** Legs lifting a scoreboard's frame off the roof (or wall top) it stands on. */
const LEG = 1.0;
const FRAME = 0.3;
const FRAME_DEPTH = 0.8;

/** Score display drawn on a canvas: generic teams, nil-nil, kick-off clock. */
function screenTexture(width: number, height: number): THREE.CanvasTexture {
  const w = 1024;
  const h = Math.max(128, Math.round((w * height) / width));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#0a0f1c';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#16213d';
  c.fillRect(0, h * 0.62, w, h * 0.38);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#ffffff';
  c.font = `700 ${Math.round(h * 0.26)}px system-ui, sans-serif`;
  c.fillText('HOME', w * 0.2, h * 0.33);
  c.fillText('AWAY', w * 0.8, h * 0.33);
  c.font = `800 ${Math.round(h * 0.36)}px system-ui, sans-serif`;
  c.fillText('0 – 0', w * 0.5, h * 0.33);
  c.fillStyle = '#ffd34d';
  c.font = `700 ${Math.round(h * 0.2)}px ui-monospace, monospace`;
  c.fillText('00:00', w * 0.5, h * 0.81);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Big screens: a dark frame on two legs with a lit display facing the pitch. */
export function buildScoreboards(boards: readonly ScoreboardSpec[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'scoreboards';
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.7, metalness: 0.2 });
  for (const b of boards) {
    const g = new THREE.Group();
    g.position.set(b.x, b.y, b.z);
    g.rotation.y = b.yaw;
    const fw = b.width + FRAME * 2;
    const fh = b.height + FRAME * 2;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, FRAME_DEPTH), frameMat);
    frame.position.y = LEG + fh / 2;
    frame.castShadow = true;
    frame.receiveShadow = true;
    g.add(frame);
    for (const x of [-fw / 3, fw / 3]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, LEG + 0.2, 0.5), frameMat);
      leg.position.set(x, (LEG + 0.2) / 2 - 0.2, 0);
      g.add(leg);
    }
    // Unlit so it reads as a lit screen by day and by night.
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(b.width, b.height),
      new THREE.MeshBasicMaterial({ map: screenTexture(b.width, b.height) }),
    );
    screen.position.set(0, LEG + fh / 2, FRAME_DEPTH / 2 + 0.01);
    g.add(screen);
    group.add(g);
  }
  return group;
}

/** Team dugouts: back wall, bench seats, clear side panels and a clear canopy sloping to the pitch. */
export function buildDugouts(dugouts: readonly DugoutSpec[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'dugouts';
  const concrete = new THREE.MeshStandardMaterial({ color: 0x55595f, roughness: 0.95 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1f2a44, roughness: 0.8 });
  const clear = new THREE.MeshStandardMaterial({
    color: 0xcfe3f0,
    roughness: 0.1,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, cast = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
  };

  for (const d of dugouts) {
    const g = new THREE.Group();
    g.position.set(d.x, d.y, d.z);
    g.rotation.y = d.yaw;
    const { length: L, depth: D, height: H } = d;
    const front = H * 0.75;
    const back = -D / 2;
    // Home bench red, away bench blue.
    const seatMat = new THREE.MeshStandardMaterial({ color: d.x * Math.cos(d.yaw) < 0 ? 0xb3262e : 0x2b5fb3, roughness: 0.6 });
    g.add(
      box(L, 0.12, D, concrete, 0, 0.06, 0),
      // Solid kick panel, clear above it so the rows behind see through.
      box(L, 0.9, 0.15, wallMat, 0, 0.45, back + 0.075),
      box(L, H - 0.9, 0.03, clear, 0, 0.9 + (H - 0.9) / 2, back + 0.075, false),
      box(L - 0.6, 0.45, 0.5, seatMat, 0, 0.345, back + 0.5),
      box(L - 0.6, 0.55, 0.08, seatMat, 0, 0.85, back + 0.25),
    );
    // Clear canopy from the top of the back wall down to the front edge.
    const run = Math.hypot(D, H - front);
    const canopy = box(L, 0.03, run, clear, 0, (H + front) / 2, 0, false);
    canopy.rotation.x = Math.atan2(H - front, D);
    g.add(canopy);
    for (const x of [-L / 2, L / 2]) {
      const side = new THREE.Shape([new THREE.Vector2(back, 0), new THREE.Vector2(-back, 0), new THREE.Vector2(-back, front), new THREE.Vector2(back, H)]);
      const pane = new THREE.Mesh(new THREE.ShapeGeometry(side), clear);
      // Shape is drawn in (z, y); turn it to stand across the dugout's end.
      pane.rotation.y = -Math.PI / 2;
      pane.position.x = x;
      g.add(pane);
    }
    group.add(g);
  }
  return group;
}

/** Scoreboards and dugouts from the shell, or null when it has neither. */
export function buildDetails(shell: ShellSpec): THREE.Group | null {
  if (!shell.scoreboards?.length && !shell.dugouts?.length) return null;
  const group = new THREE.Group();
  group.name = 'details';
  if (shell.scoreboards?.length) group.add(buildScoreboards(shell.scoreboards));
  if (shell.dugouts?.length) group.add(buildDugouts(shell.dugouts));
  return group;
}
