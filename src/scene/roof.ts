import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pointOnPiece, bowlPieces, pieceLength } from '../data/bowlPath';
import type { RoofSpec, ShellSpec } from '../data/types';
import { pieceBand, pieceCap } from './geo';

export interface Roof {
  group: THREE.Group;
  /** Emissive light fixtures along the leading edge; brightness follows time of day. */
  fixtures: THREE.MeshStandardMaterial;
}

const roofKey = (r: RoofSpec | null | undefined) => (r ? JSON.stringify(r) : '');

/**
 * Cantilevered roof over each stand that has one: sloped slab from the facade to `innerD`,
 * girders on top and floodlight fixtures under the front edge. Neighbouring stands with the
 * same roof join seamlessly; elsewhere the slab end is closed off.
 */
export function buildRoof(shell: ShellSpec): Roof | null {
  const { shape, stands } = shell;
  const pieces = bowlPieces(shape);
  if (!stands.some((s) => s?.roof)) return null;
  const group = new THREE.Group();
  group.name = 'roof';

  const slabs: THREE.BufferGeometry[] = [];
  const ribs: THREE.Matrix4[] = [];
  const spots: Array<{ x: number; y: number; z: number; yaw: number }> = [];
  const keys = stands.map((s) => roofKey(s?.roof));

  pieces.forEach((piece, pi) => {
    const roof = stands[pi]?.roof;
    if (!roof) return;
    const t = roof.thickness;

    // Band direction sets the face normal (see pieceBand): outer->inner faces down, inner->outer faces up.
    slabs.push(
      pieceBand(shape, piece, { d: roof.outerD, y: roof.outerY }, { d: roof.innerD, y: roof.innerY }, 24),
      pieceBand(shape, piece, { d: roof.innerD, y: roof.innerY + t }, { d: roof.outerD, y: roof.outerY + t }, 24),
      pieceBand(shape, piece, { d: roof.innerD, y: roof.innerY }, { d: roof.innerD, y: roof.innerY + t }, 24),
    );
    const section: Array<[number, number]> = [
      [roof.outerD, roof.outerY],
      [roof.innerD, roof.innerY],
      [roof.innerD, roof.innerY + t],
      [roof.outerD, roof.outerY + t],
    ];
    const n = pieces.length;
    if (keys[(pi + n - 1) % n] !== keys[pi]) slabs.push(pieceCap(shape, piece, 0, section));
    if (keys[(pi + 1) % n] !== keys[pi]) slabs.push(pieceCap(shape, piece, 1, section));

    // Radial ribs on top (cantilever girders), every ~12 m along the stand.
    const span = roof.outerD - roof.innerD;
    const slope = Math.atan2(roof.innerY - roof.outerY, span);
    const mid = (roof.outerD + roof.innerD) / 2;
    const midY = (roof.outerY + roof.innerY) / 2 + t + 0.55;
    const ribCount = Math.max(1, Math.round(pieceLength(piece, shape, mid) / 12));
    for (let i = 0; i < ribCount; i++) {
      const p = pointOnPiece(piece, shape, mid, (i + 0.5) / ribCount);
      const yaw = Math.atan2(-p.nx, -p.nz);
      const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(-slope, yaw, 0, 'YXZ'));
      // Unit-length box scaled to this stand's span.
      ribs.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, midY, p.z), rot, new THREE.Vector3(1, 1, span)));
    }

    // Fixtures every ~7 m along the leading edge, tilted down towards the pitch.
    const d = roof.innerD + 1.2;
    const y = roof.innerY + ((roof.outerY - roof.innerY) * (d - roof.innerD)) / (roof.outerD - roof.innerD) - 0.35;
    const lampCount = Math.max(1, Math.round(pieceLength(piece, shape, d) / 7));
    for (let i = 0; i < lampCount; i++) {
      const p = pointOnPiece(piece, shape, d, (i + 0.5) / lampCount);
      spots.push({ x: p.x, y, z: p.z, yaw: Math.atan2(-p.nx, -p.nz) });
    }
  });

  const mesh = new THREE.Mesh(mergeGeometries(slabs)!, new THREE.MeshStandardMaterial({ color: 0xd4d8de, roughness: 0.55, metalness: 0.25 }));
  slabs.forEach((g) => g.dispose());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'roof-slab';
  group.add(mesh);

  const ribMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 1.1, 1), mesh.material, ribs.length);
  ribs.forEach((m4, i) => ribMesh.setMatrixAt(i, m4));
  ribMesh.computeBoundingSphere();
  ribMesh.castShadow = true;
  ribMesh.name = 'roof-ribs';
  group.add(ribMesh);

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
  const one = new THREE.Vector3(1, 1, 1);
  spots.forEach((s, i) => lamps.setMatrixAt(i, m.compose(new THREE.Vector3(s.x, s.y, s.z), q.setFromAxisAngle(up, s.yaw), one)));
  lamps.computeBoundingSphere();
  lamps.name = 'roof-lights';
  group.add(lamps);

  return { group, fixtures };
}
