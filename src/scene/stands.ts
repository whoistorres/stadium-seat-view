import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bowlPieces } from '../data/bowlPath';
import { OVERHANG_SLAB, overhangs, WALL_THICKNESS } from '../data/overhang';
import type { SeatTuple, ShellSpec, StadiumData, StandShell } from '../data/types';
import { pieceBand, pieceCap, QuadBuilder, type RingEdge, type V3 } from './geo';

const TREAD: V3 = [0.6, 0.61, 0.63];
const RISER: V3 = [0.45, 0.46, 0.48];

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

/** Height where a stand's back wall meets the underside of its roof (or a lid without one). */
function backWallTop(stand: StandShell): number {
  const top = stand.tiers[stand.tiers.length - 1];
  const roof = stand.roof;
  return roof
    ? roof.outerY + ((roof.outerD - top.backD) / (roof.outerD - roof.innerD)) * (roof.innerY - roof.outerY)
    : top.topY + 3;
}

/**
 * Cross-section of a stand's building as a closed (d, y) outline: front walls, stepped
 * treads, walkways, back wall, concourse under the roof and facade. Used to close the ends
 * of a stand where its neighbour is different or missing.
 */
function standOutline(stand: StandShell): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  stand.tiers.forEach((t, i) => {
    const prev = i > 0 ? stand.tiers[i - 1] : null;
    const parapetY = t.frontY + t.parapet;
    if (prev && overhangs(stand.tiers, i)) {
      // Up the lower tier's back wall, forward along the underside, up the front wall.
      const wallD = t.frontD - WALL_THICKNESS;
      const soffitY = t.frontY - OVERHANG_SLAB;
      pts.push([prev.backD, soffitY], [wallD, soffitY], [wallD, parapetY], [t.frontD, parapetY]);
    } else {
      const baseY = prev ? prev.topY : 0;
      const wallD = Math.max(prev ? prev.backD : -Infinity, t.frontD - WALL_THICKNESS);
      pts.push([wallD, baseY], [wallD, parapetY], [t.frontD, parapetY]);
    }
    const rows = Math.round((t.backD - t.frontD) / t.rowDepth);
    for (let k = 0; k < rows; k++) {
      const y = t.rowY?.[k] ?? t.frontY + k * t.rise;
      const d0 = t.frontD + k * t.rowDepth;
      pts.push([d0, y], [d0 + t.rowDepth, y]);
    }
  });
  const backTopY = backWallTop(stand);
  const top = stand.tiers[stand.tiers.length - 1];
  pts.push([top.backD, backTopY], [stand.outerD, stand.roof ? stand.roof.outerY + stand.roof.thickness : backTopY], [stand.outerD, 0]);
  return pts;
}

const profileKey = (s: StandShell | null) => (s ? JSON.stringify([s.tiers, s.outerD, s.roof]) : '');

/** Generic envelope around the seats: front walls, walkways, back wall and facade, stand by stand. */
export function buildShell(shell: ShellSpec): THREE.Group {
  const group = new THREE.Group();
  group.name = 'shell';
  const { shape, stands } = shell;
  const pieces = bowlPieces(shape);
  const keys = stands.map(profileKey);
  const walls: THREE.BufferGeometry[] = [];
  const floors: THREE.BufferGeometry[] = [];
  const facade: THREE.BufferGeometry[] = [];
  const soffits: THREE.BufferGeometry[] = [];

  pieces.forEach((piece, pi) => {
    const stand = stands[pi];
    if (!stand) return;
    const { tiers } = stand;
    const band = (a: RingEdge, b: RingEdge) => pieceBand(shape, piece, a, b);

    tiers.forEach((tier, i) => {
      const prev = i > 0 ? tiers[i - 1] : null;
      const over = overhangs(tiers, i);
      // An overhanging tier's front wall hangs down to the flat underside over the rows below.
      const baseY = !prev ? 0 : over ? tier.frontY - OVERHANG_SLAB : prev.topY;
      const topY = tier.frontY + tier.parapet;
      const wallD = tier.frontD - WALL_THICKNESS;
      walls.push(band({ d: wallD, y: baseY }, { d: wallD, y: topY }));
      walls.push(band({ d: wallD, y: topY }, { d: tier.frontD, y: topY }));
      walls.push(band({ d: tier.frontD, y: topY }, { d: tier.frontD, y: tier.frontY }));
      if (prev && over) {
        soffits.push(band({ d: prev.backD, y: baseY }, { d: wallD, y: baseY }));
        soffits.push(band({ d: prev.backD, y: prev.topY }, { d: prev.backD, y: baseY }));
      } else if (prev) {
        floors.push(band({ d: prev.backD, y: baseY }, { d: wallD, y: baseY }));
      }
    });

    const top = tiers[tiers.length - 1];
    const roof = stand.roof;
    // Stop the back wall at the roof underside directly above it.
    const backTopY = backWallTop(stand);
    const facadeTopY = roof ? roof.outerY + roof.thickness : backTopY;
    facade.push(band({ d: top.backD, y: top.topY }, { d: top.backD, y: backTopY }));
    facade.push(band({ d: stand.outerD, y: facadeTopY }, { d: stand.outerD, y: 0 }));
    if (!roof) facade.push(band({ d: top.backD, y: backTopY }, { d: stand.outerD, y: backTopY }));

    // Close the ends where the neighbouring stand has a different cross-section, or none.
    const outline = standOutline(stand);
    const before = (pi + pieces.length - 1) % pieces.length;
    const after = (pi + 1) % pieces.length;
    if (keys[before] !== keys[pi]) facade.push(pieceCap(shape, piece, 0, outline));
    if (keys[after] !== keys[pi]) facade.push(pieceCap(shape, piece, 1, outline));
  });

  const add = (geos: THREE.BufferGeometry[], material: THREE.Material, name: string, cast: boolean) => {
    if (geos.length === 0) return;
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = name;
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  add(walls, new THREE.MeshStandardMaterial({ color: 0x1d2a3a, roughness: 0.7 }), 'tier-walls', true);
  add(floors, new THREE.MeshStandardMaterial({ color: 0x8b8d90, roughness: 0.95 }), 'walkways', false);
  add(facade, new THREE.MeshStandardMaterial({ color: 0xb9bec6, roughness: 0.85, side: THREE.DoubleSide }), 'facade', true);
  // Underside of overhanging tiers and the back wall beneath: a lighter ceiling over the rows.
  add(soffits, new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.9 }), 'overhangs', true);
  return group;
}
