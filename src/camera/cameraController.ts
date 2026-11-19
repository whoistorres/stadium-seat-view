import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bowlPieces, offsetAt, PIECE_SIDES } from '../data/bowlPath';
import { clearanceHeightAt } from '../data/envelope';
import type { SeatRef, Stadium } from '../data/loadData';

const ORBIT_FOV = 45;
const ORBIT_NEAR = 1;
const SEAT_NEAR = 0.1;
const OVERVIEW_POS = new THREE.Vector3(-105, 215, 200);
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 0);
const PITCH_CENTRE = new THREE.Vector3(0, 0, 0);
const MAX_LOOK_YAW = THREE.MathUtils.degToRad(110);
const MIN_PITCH = THREE.MathUtils.degToRad(-75);
const MAX_PITCH = THREE.MathUtils.degToRad(50);

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

interface Segment {
  length: number;
  /** Keep the camera above the building envelope along this segment. */
  clamped: boolean;
  at(t: number, out: THREE.Vector3): void;
}

interface Flight {
  segments: Segment[];
  total: number;
  duration: number;
  elapsed: number;
  q0: THREE.Quaternion;
  q1: THREE.Quaternion;
  fov0: number;
  fov1: number;
  near0: number;
  near1: number;
  interruptible: boolean;
  done: () => void;
}

function line(a: THREE.Vector3, b: THREE.Vector3, clamped: boolean): Segment {
  const p0 = a.clone();
  const p1 = b.clone();
  return { length: p0.distanceTo(p1), clamped, at: (t, out) => void out.lerpVectors(p0, p1, t) };
}

function bezier(a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, clamped: boolean): Segment {
  const curve = new THREE.QuadraticBezierCurve3(a.clone(), c.clone(), b.clone());
  return { length: curve.getLength(), clamped, at: (t, out) => void curve.getPoint(t, out) };
}

export type CameraMode = 'orbit' | 'seat';

/**
 * Owns the camera in both modes and every animated move between them.
 *
 * Flights are built from segments. Anything travelling through "orbit space" is clamped to
 * stay above the stands and roof; the last leg into a seat (and the first leg out of one)
 * runs along the seat's own sightline, which is the one corridor guaranteed to be clear
 * underneath the roof.
 */
export class CameraController {
  readonly controls: OrbitControls;
  mode: CameraMode = 'orbit';
  onFovWheel: (fov: number) => void = () => {};

  private flight: Flight | null = null;
  private pending: (() => void) | null = null;
  private seat: SeatRef | null = null;
  private seatFov = 70;
  private baseYaw = 0;
  private basePitch = 0;
  private lookYaw = 0;
  private lookPitch = 0;
  private curYaw = 0;
  private curPitch = 0;
  private drag: { id: number; x: number; y: number } | null = null;
  private readonly tmp = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly dom: HTMLElement,
    private readonly stadium: Stadium,
  ) {
    camera.fov = ORBIT_FOV;
    camera.near = ORBIT_NEAR;
    camera.position.copy(OVERVIEW_POS);
    camera.updateProjectionMatrix();

    const c = (this.controls = new OrbitControls(camera, dom));
    c.target.copy(OVERVIEW_TARGET);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.minDistance = 8;
    c.maxDistance = 520;
    c.maxPolarAngle = 1.48;
    c.screenSpacePanning = false;
    c.zoomToCursor = true;
    c.update();

    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('pointercancel', this.onPointerUp);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
  }

  get busy(): boolean {
    return this.flight !== null;
  }

  /* ---------- commands ---------- */

  goOverview(): void {
    this.flyToOrbitPose(OVERVIEW_POS, OVERVIEW_TARGET);
  }

  goSection(section: number): void {
    const m = this.stadium.meta[section];
    const centre = new THREE.Vector3(...m.centre);
    const dist = m.radius * 2 + 14;
    const pos = centre.clone().add(new THREE.Vector3(m.facing[0] * dist, dist * 0.42, m.facing[1] * dist));
    this.flyToOrbitPose(pos, centre);
  }

  goSeat(ref: SeatRef): void {
    if (this.defer(() => this.goSeat(ref))) return;
    const eye = new THREE.Vector3(...this.stadium.eye(ref));
    const from = this.camera.position.clone();
    const hop = this.mode === 'seat' && from.distanceTo(eye) < 5;
    const base = this.lookAngles(eye);

    const segments: Segment[] = [];
    if (hop) {
      // Arc up and over: a straight line between tiers would cut through the parapet wall.
      const lift = new THREE.Vector3().addVectors(from, eye).multiplyScalar(0.5);
      lift.y = Math.max(from.y, eye.y) + 0.6 + Math.abs(from.y - eye.y) * 0.6;
      segments.push(bezier(from, lift, eye, false));
    } else {
      let start = from;
      if (this.mode === 'seat' && this.seat) {
        start = this.approachPoint(this.seat);
        segments.push(line(from, start, false));
      }
      const approach = this.approachPoint(ref);
      // Control point further out along the sightline so the turn into the last leg is smooth.
      const control = approach.clone().add(approach.clone().sub(eye).setY(0).normalize().multiplyScalar(30));
      control.y = approach.y + 5;
      segments.push(bezier(start, control, approach, true), line(approach, eye, false));
      this.lookYaw = 0;
      this.lookPitch = 0;
    }

    const yaw = base.yaw + this.lookYaw;
    const pitch = THREE.MathUtils.clamp(base.pitch + this.lookPitch, MIN_PITCH, MAX_PITCH);
    const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));

    this.controls.enabled = false;
    this.startFlight(segments, q1, this.seatVerticalFov(), SEAT_NEAR, hop, hop ? 0.35 : undefined, () => {
      this.mode = 'seat';
      this.seat = ref;
      this.baseYaw = base.yaw;
      this.basePitch = base.pitch;
      this.curYaw = this.lookYaw;
      this.curPitch = this.lookPitch;
    });
  }

  setSeatFov(fov: number): void {
    this.seatFov = fov;
  }

  /**
   * Vertical FOV to use in seat view. The slider value applies to the narrower screen axis,
   * so a portrait phone still sees the width of the pitch (capped to limit distortion).
   */
  private seatVerticalFov(): number {
    const aspect = this.camera.aspect;
    if (aspect >= 1) return this.seatFov;
    const h = THREE.MathUtils.degToRad(this.seatFov) / 2;
    return Math.min(105, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(h) / aspect)));
  }

  /** Turn the head by a relative amount (radians); used by keyboard look controls. */
  lookBy(dYaw: number, dPitch: number): void {
    if (this.mode !== 'seat') return;
    this.lookYaw = THREE.MathUtils.clamp(this.lookYaw + dYaw, -MAX_LOOK_YAW, MAX_LOOK_YAW);
    this.lookPitch = THREE.MathUtils.clamp(this.lookPitch + dPitch, MIN_PITCH - this.basePitch, MAX_PITCH - this.basePitch);
  }

  resetLook(): void {
    this.lookYaw = 0;
    this.lookPitch = 0;
  }

  /** Place the camera without animating (used for deterministic screenshots/tests). */
  snapToSeat(ref: SeatRef): void {
    this.goSeat(ref);
    if (this.flight) this.flight.elapsed = this.flight.duration;
    this.update(0);
    this.curYaw = this.lookYaw;
    this.curPitch = this.lookPitch;
    this.update(0);
  }

  /* ---------- per-frame ---------- */

  update(dt: number): void {
    const cam = this.camera;
    const f = this.flight;
    if (f) {
      f.elapsed = Math.min(f.duration, f.elapsed + dt);
      const s = easeInOut(f.duration === 0 ? 1 : f.elapsed / f.duration);
      this.samplePath(f, s, cam.position);
      cam.quaternion.slerpQuaternions(f.q0, f.q1, easeInOut(Math.min(1, s * 1.15)));
      cam.fov = f.fov0 + (f.fov1 - f.fov0) * s;
      cam.near = f.near0 + (f.near1 - f.near0) * s;
      cam.updateProjectionMatrix();
      if (f.elapsed >= f.duration) {
        this.flight = null;
        f.done();
        const next = this.pending;
        this.pending = null;
        next?.();
      }
      return;
    }

    if (this.mode === 'orbit') {
      const t = this.controls.target;
      t.set(THREE.MathUtils.clamp(t.x, -115, 115), THREE.MathUtils.clamp(t.y, 0, 40), THREE.MathUtils.clamp(t.z, -100, 100));
      this.controls.update();
      const shell = this.stadium.data.shell;
      if (shell) {
        const minY = clearanceHeightAt(shell, cam.position.x, cam.position.z);
        if (cam.position.y < minY) {
          cam.position.y = minY;
          cam.lookAt(t);
        }
      }
    } else {
      const k = 1 - Math.exp(-dt * 16);
      this.curYaw += (this.lookYaw - this.curYaw) * k;
      this.curPitch += (this.lookPitch - this.curPitch) * k;
      const pitch = THREE.MathUtils.clamp(this.basePitch + this.curPitch, MIN_PITCH, MAX_PITCH);
      cam.quaternion.setFromEuler(new THREE.Euler(pitch, this.baseYaw + this.curYaw, 0, 'YXZ'));
      // Follows slider changes and window resizes (aspect) alike.
      const fov = this.seatVerticalFov();
      if (Math.abs(cam.fov - fov) > 0.01) {
        cam.fov += (fov - cam.fov) * Math.min(1, k * 1.5);
        if (Math.abs(cam.fov - fov) < 0.05) cam.fov = fov;
        cam.updateProjectionMatrix();
      }
    }
  }

  /* ---------- internals ---------- */

  private defer(cmd: () => void): boolean {
    if (this.flight && !this.flight.interruptible) {
      this.pending = cmd;
      return true;
    }
    return false;
  }

  private flyToOrbitPose(pos: THREE.Vector3, target: THREE.Vector3): void {
    if (this.defer(() => this.flyToOrbitPose(pos, target))) return;
    const from = this.camera.position.clone();
    const segments: Segment[] = [];
    if (this.mode === 'seat' && this.seat) {
      const out = this.approachPoint(this.seat);
      const control = out.clone().add(out.clone().sub(from).setY(0).normalize().multiplyScalar(25));
      control.y = out.y + 6;
      segments.push(line(from, out, false), bezier(out, control, pos, true));
    } else {
      segments.push(line(from, pos, true));
    }
    const q1 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, target, THREE.Object3D.DEFAULT_UP));
    const leavingSeat = this.mode === 'seat';

    this.controls.enabled = false;
    this.startFlight(segments, q1, ORBIT_FOV, ORBIT_NEAR, !leavingSeat, undefined, () => {
      this.mode = 'orbit';
      this.seat = null;
      this.controls.target.copy(target);
      this.controls.enabled = true;
      this.controls.update();
    });
  }

  private startFlight(
    segments: Segment[],
    q1: THREE.Quaternion,
    fov: number,
    near: number,
    interruptible: boolean,
    duration: number | undefined,
    done: () => void,
  ): void {
    const total = segments.reduce((n, s) => n + s.length, 0);
    this.flight = {
      segments,
      total,
      duration: duration ?? THREE.MathUtils.clamp(0.8 + total / 150, 1, 2.4),
      elapsed: 0,
      q0: this.camera.quaternion.clone(),
      q1,
      fov0: this.camera.fov,
      fov1: fov,
      near0: this.camera.near,
      near1: near,
      interruptible,
      done,
    };
  }

  private samplePath(f: Flight, s: number, out: THREE.Vector3): void {
    let dist = s * f.total;
    let seg = f.segments[f.segments.length - 1];
    let t = 1;
    for (const candidate of f.segments) {
      if (dist <= candidate.length) {
        seg = candidate;
        t = candidate.length > 0 ? dist / candidate.length : 1;
        break;
      }
      dist -= candidate.length;
    }
    seg.at(t, out);
    const shell = this.stadium.data.shell;
    if (seg.clamped && shell) out.y = Math.max(out.y, clearanceHeightAt(shell, out.x, out.z));
  }

  /** Point out over the pitch on the seat's sightline; the seat is entered and left through it. */
  private approachPoint(ref: SeatRef): THREE.Vector3 {
    const t = this.stadium.tuple(ref);
    const [ex, ey, ez] = this.stadium.eye(ref);
    const shell = this.stadium.data.shell;
    if (!shell) return new THREE.Vector3(ex + Math.sin(t[4]) * 12, ey + 1.5, ez + Math.cos(t[4]) * 12);
    const d = offsetAt(shell.shape, ex, ez);
    const pi = PIECE_SIDES.indexOf(this.stadium.data.sections[ref.section].side);
    const piece = bowlPieces(shell.shape)[pi];

    // Head straight out the way the seat faces, losing 1 m of offset per metre travelled.
    // In a square corner that line would cross the stand next door, so aim at the corner's
    // centre point instead (where the rows' right angles all point): the line stays inside the
    // corner, offset falls evenly along it, and past the centre it is out over the pitch.
    let ux = Math.sin(t[4]);
    let uz = Math.cos(t[4]);
    let perMetre = 1;
    let reach = Math.max(6, d + 8);
    if (piece.kind === 'arc' && piece.square) {
      const len = Math.hypot(piece.cx - ex, piece.cz - ez);
      ux = (piece.cx - ex) / len;
      uz = (piece.cz - ez) / len;
      perMetre = (d + shell.shape.r0) / len;
      reach = len + 8;
    }
    let y = ey + 1.5;
    // Under a roof that falls towards the pitch, a level last leg would pass through the roof's
    // front edge: come in low enough that the straight line to the eye stays 1 m beneath it.
    const roof = shell.stands[pi]?.roof;
    if (roof && d > roof.innerD && d <= roof.outerD) {
      y = Math.min(y, ey + ((roof.innerY - 1 - ey) * reach * perMetre) / (d - roof.innerD));
    }
    return new THREE.Vector3(ex + ux * reach, y, ez + uz * reach);
  }

  private lookAngles(eye: THREE.Vector3): { yaw: number; pitch: number } {
    const v = this.tmp.copy(PITCH_CENTRE).sub(eye);
    return { yaw: Math.atan2(-v.x, -v.z), pitch: Math.atan2(v.y, Math.hypot(v.x, v.z)) };
  }

  private readonly onPointerDown = (e: PointerEvent) => {
    if (this.mode !== 'seat' || this.flight || this.drag) return;
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    this.dom.setPointerCapture(e.pointerId);
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.id || this.mode !== 'seat') return;
    // Grab-the-world: the scene follows the pointer, so the head turns the opposite way.
    const perPixel = THREE.MathUtils.degToRad(this.camera.fov) / Math.max(1, this.dom.clientHeight);
    this.lookBy((e.clientX - this.drag.x) * perPixel, (e.clientY - this.drag.y) * perPixel);
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;
  };

  private readonly onPointerUp = (e: PointerEvent) => {
    if (this.drag && e.pointerId === this.drag.id) this.drag = null;
  };

  private readonly onWheel = (e: WheelEvent) => {
    if (this.mode !== 'seat') return;
    e.preventDefault();
    this.onFovWheel(THREE.MathUtils.clamp(Math.round(this.seatFov + Math.sign(e.deltaY) * 2), 60, 100));
  };
}
