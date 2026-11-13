import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SeatTuple, ShellSpec, StadiumData } from '../data/types';
import { QuadBuilder, ringBand, type V3 } from './geo';

const TREAD: V3 = [0.6, 0.61, 0.63];
const RISER: V3 = [0.45, 0.46, 0.48];
const WALL_THICKNESS = 0.2;

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

/** Keep row ends plus any seat where the row has turned noticeably; straights collapse to 2 points. */
function simplifyRow(seats: SeatTuple[]): SeatTuple[] {
  if (seats.length <= 2) return seats;
  const kept = [seats[0]];
  for (let i = 1; i < seats.length - 1; i++) {
    if (angleDiff(seats[i][4], kept[kept.length - 1][4]) > 0.045) kept.push(seats[i]);
  }
  kept.push(seats[seats.length - 1]);
  return kept;
}

/**
 * Concrete steps built straight from the seat rows, so they follow whatever seat data is
 * loaded. Each row becomes a tread under the seats plus the riser in front of it.
 */
export function buildSteps(data: StadiumData): THREE.Mesh {
  const qb = new QuadBuilder();
  const { spacing, inset, aisle } = data.seat;
  // Reaches the section boundary even when the seat block is not an exact fit; neighbouring
  // sections overlap slightly in the same plane, which is invisible.
  const extend = spacing + aisle / 2;

  for (const section of data.sections) {
    const depth = section.rowDepth;
    section.rows.forEach((row, k) => {
      if (row.seats.length === 0) return;
      const y = row.seats[0][2];
      const neighbour = section.rows[k > 0 ? k - 1 : Math.min(1, section.rows.length - 1)];
      const rise = Math.max(0.05, Math.abs(y - (neighbour.seats[0]?.[2] ?? y - 0.3)));
      const pts = simplifyRow(row.seats);

      const edge = pts.map((s, i) => {
        const fx = Math.sin(s[4]);
        const fz = Math.cos(s[4]);
        // Right-hand direction for someone facing the pitch = direction of increasing seat number.
        const shift = i === 0 ? -extend : i === pts.length - 1 ? extend : 0;
        const px = s[1] - fz * shift;
        const pz = s[3] + fx * shift;
        return {
          fx,
          fz,
          front: [px + fx * inset, y, pz + fz * inset] as V3,
          back: [px - fx * (depth - inset), y, pz - fz * (depth - inset)] as V3,
          low: [px + fx * inset, y - rise, pz + fz * inset] as V3,
        };
      });

      for (let i = 0; i < edge.length - 1; i++) {
        const a = edge[i];
        const b = edge[i + 1];
        qb.quad(a.front, a.back, b.back, b.front, [0, 1, 0], TREAD);
        qb.quad(a.low, a.front, b.front, b.low, [(a.fx + b.fx) / 2, 0, (a.fz + b.fz) / 2], RISER);
      }
    });
  }

  const mesh = new THREE.Mesh(
    qb.build(),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
  );
  mesh.name = 'steps';
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

/** Generic envelope around the seats: front walls, walkways, back wall and facade. */
export function buildShell(shell: ShellSpec): THREE.Group {
  const group = new THREE.Group();
  group.name = 'shell';
  const { shape, tiers } = shell;
  const walls: THREE.BufferGeometry[] = [];
  const floors: THREE.BufferGeometry[] = [];
  const facade: THREE.BufferGeometry[] = [];

  tiers.forEach((tier, i) => {
    const baseY = i === 0 ? 0 : tiers[i - 1].topY;
    const topY = tier.frontY + tier.parapet;
    const wallD = tier.frontD - WALL_THICKNESS;
    walls.push(ringBand(shape, { d: wallD, y: baseY }, { d: wallD, y: topY }));
    walls.push(ringBand(shape, { d: wallD, y: topY }, { d: tier.frontD, y: topY }));
    walls.push(ringBand(shape, { d: tier.frontD, y: topY }, { d: tier.frontD, y: tier.frontY }));
    if (i > 0) {
      floors.push(ringBand(shape, { d: tiers[i - 1].backD, y: baseY }, { d: wallD, y: baseY }));
    }
  });

  const top = tiers[tiers.length - 1];
  const roof = shell.roof;
  // Stop the back wall at the roof underside directly above it.
  const backTopY = roof
    ? roof.outerY + ((roof.outerD - top.backD) / (roof.outerD - roof.innerD)) * (roof.innerY - roof.outerY)
    : top.topY + 3;
  const facadeTopY = roof ? roof.outerY + roof.thickness : backTopY;
  facade.push(ringBand(shape, { d: top.backD, y: top.topY }, { d: top.backD, y: backTopY }));
  facade.push(ringBand(shape, { d: shell.outerD, y: facadeTopY }, { d: shell.outerD, y: 0 }));
  if (!roof) facade.push(ringBand(shape, { d: top.backD, y: backTopY }, { d: shell.outerD, y: backTopY }));

  const add = (geos: THREE.BufferGeometry[], material: THREE.Material, name: string, cast: boolean) => {
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = name;
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  add(walls, new THREE.MeshStandardMaterial({ color: 0x1d2a3a, roughness: 0.7 }), 'tier-walls', true);
  if (floors.length) add(floors, new THREE.MeshStandardMaterial({ color: 0x8b8d90, roughness: 0.95 }), 'walkways', false);
  add(facade, new THREE.MeshStandardMaterial({ color: 0xb9bec6, roughness: 0.85, side: THREE.DoubleSide }), 'facade', true);
  return group;
}
