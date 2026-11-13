import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pointOnPiece, bowlPieces, pieceLength } from '../data/bowlPath';
import type { ShellSpec } from '../data/types';
import { ringBand } from './geo';

export interface Roof {
  group: THREE.Group;
  /** Emissive light fixtures along the leading edge; brightness follows time of day. */
  fixtures: THREE.MeshStandardMaterial;
}

/** Cantilevered roof ring: sloped slab from the facade to `innerD`, with floodlight fixtures under its front edge. */
export function buildRoof(shell: ShellSpec): Roof | null {
  const roof = shell.roof;
  if (!roof) return null;
  const { shape } = shell;
  const t = roof.thickness;
  const group = new THREE.Group();
  group.name = 'roof';

  // Band direction sets the face normal (see ringBand): outer->inner faces down, inner->outer faces up.
  const slab = mergeGeometries([
    ringBand(shape, { d: roof.outerD, y: roof.outerY }, { d: roof.innerD, y: roof.innerY }, 24),
    ringBand(shape, { d: roof.innerD, y: roof.innerY + t }, { d: roof.outerD, y: roof.outerY + t }, 24),
    ringBand(shape, { d: roof.innerD, y: roof.innerY }, { d: roof.innerD, y: roof.innerY + t }, 24),
  ])!;
  const mesh = new THREE.Mesh(slab, new THREE.MeshStandardMaterial({ color: 0xd4d8de, roughness: 0.55, metalness: 0.25 }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'roof-slab';
  group.add(mesh);

  // Radial ribs on top (cantilever girders), every ~12 m around the ring.
  const span = roof.outerD - roof.innerD;
  const slope = Math.atan2(roof.innerY - roof.outerY, span);
  const ribGeo = new THREE.BoxGeometry(0.7, 1.1, span);
  const ribs: THREE.Matrix4[] = [];
  const mid = (roof.outerD + roof.innerD) / 2;
  const midY = (roof.outerY + roof.innerY) / 2 + t + 0.55;
  for (const piece of bowlPieces(shape)) {
    const n = Math.max(1, Math.round(pieceLength(piece, shape, mid) / 12));
    for (let i = 0; i < n; i++) {
      const p = pointOnPiece(piece, shape, mid, (i + 0.5) / n);
      const yaw = Math.atan2(-p.nx, -p.nz);
      const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(-slope, yaw, 0, 'YXZ'));
      ribs.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, midY, p.z), rot, new THREE.Vector3(1, 1, 1)));
    }
  }
  const ribMesh = new THREE.InstancedMesh(ribGeo, mesh.material, ribs.length);
  ribs.forEach((m4, i) => ribMesh.setMatrixAt(i, m4));
  ribMesh.computeBoundingSphere();
  ribMesh.castShadow = true;
  ribMesh.name = 'roof-ribs';
  group.add(ribMesh);

  // Fixtures every ~7 m along the leading edge, tilted down towards the pitch.
  const spots: Array<{ x: number; z: number; yaw: number }> = [];
  const d = roof.innerD + 1.2;
  for (const piece of bowlPieces(shape)) {
    const len = pieceLength(piece, shape, d);
    const n = Math.max(1, Math.round(len / 7));
    for (let i = 0; i < n; i++) {
      const p = pointOnPiece(piece, shape, d, (i + 0.5) / n);
      spots.push({ x: p.x, z: p.z, yaw: Math.atan2(-p.nx, -p.nz) });
    }
  }
  const fixtures = new THREE.MeshStandardMaterial({
    color: 0x30343a,
    emissive: 0xf4f7ff,
    emissiveIntensity: 0.15,
    roughness: 0.4,
  });
  const lamp = new THREE.BoxGeometry(1.8, 0.35, 0.6);
  lamp.rotateX(-0.6);
  const lamps = new THREE.InstancedMesh(lamp, fixtures, spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const y = roof.innerY + ((roof.outerY - roof.innerY) * (d - roof.innerD)) / (roof.outerD - roof.innerD) - 0.35;
  spots.forEach((s, i) => lamps.setMatrixAt(i, m.compose(new THREE.Vector3(s.x, y, s.z), q.setFromAxisAngle(up, s.yaw), new THREE.Vector3(1, 1, 1))));
  lamps.computeBoundingSphere();
  lamps.name = 'roof-lights';
  group.add(lamps);

  return { group, fixtures };
}
