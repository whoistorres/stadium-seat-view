import * as THREE from 'three';
import type { ShellSpec } from '../data/types';
import type { TimeOfDay } from '../state/store';

interface Look {
  skyTop: string;
  skyHorizon: string;
  ground: string;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  key: string;
  keyIntensity: number;
  /** Direction towards the key light. */
  keyDir: [number, number, number];
  spots: number;
  fixtures: number;
  boards: number;
  /** Glow of lit windows in glass facades. */
  windows: number;
  exposure: number;
}

const LOOKS: Record<TimeOfDay, Look> = {
  day: {
    skyTop: '#3d7cc9',
    skyHorizon: '#d4e6f5',
    ground: '#6c7766',
    hemiSky: '#d6e8ff',
    hemiGround: '#59614a',
    hemi: 1.05,
    key: '#fff1da',
    keyIntensity: 2.7,
    keyDir: [-0.5, 0.75, 0.42],
    spots: 0,
    fixtures: 0.15,
    boards: 0.35,
    windows: 0,
    exposure: 1,
  },
  // Under lights: a near-overhead cool key stands in for the combined roof floodlights,
  // corner spots add the cross-light on the pitch.
  evening: {
    skyTop: '#060a1c',
    skyHorizon: '#2b2c52',
    ground: '#14181a',
    hemiSky: '#3a4878',
    hemiGround: '#0b0c0f',
    hemi: 0.5,
    key: '#e8efff',
    keyIntensity: 1.5,
    keyDir: [0.12, 1, -0.2],
    spots: 1.3,
    fixtures: 5,
    windows: 0.6,
    boards: 1.2,
    exposure: 1.1,
  },
};

const SHADOW_EXTENT = 150;

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // pin to the far plane
  }`;

const skyFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  varying vec3 vDir;
  void main() {
    float h = normalize(vDir).y;
    vec3 c = h > 0.0 ? mix(uHorizon, uTop, pow(h, 0.55)) : mix(uHorizon, uGround, clamp(-h * 6.0, 0.0, 1.0));
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export class Lighting {
  private readonly sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly hemi: THREE.HemisphereLight;
  private readonly key: THREE.DirectionalLight;
  private readonly spots: THREE.SpotLight[] = [];
  private readonly ground: THREE.Mesh<THREE.CircleGeometry, THREE.MeshStandardMaterial>;
  private readonly fog: THREE.Fog;
  private fixtures: THREE.MeshStandardMaterial | null = null;
  private boards: THREE.MeshStandardMaterial[] = [];
  private shadows = true;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly renderer: THREE.WebGLRenderer,
    shell: ShellSpec | null,
  ) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // Everything that casts is static, so the shadow map is only redrawn when lighting changes.
    renderer.shadowMap.autoUpdate = false;

    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(1500, 32, 16),
      new THREE.ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        uniforms: { uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color() } },
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    this.sky.renderOrder = -1;
    this.sky.frustumCulled = false;
    this.sky.name = 'sky';

    this.hemi = new THREE.HemisphereLight();
    this.key = new THREE.DirectionalLight();
    const sc = this.key.shadow;
    sc.mapSize.set(2048, 2048);
    Object.assign(sc.camera, { left: -SHADOW_EXTENT, right: SHADOW_EXTENT, top: SHADOW_EXTENT, bottom: -SHADOW_EXTENT, near: 10, far: 700 });
    sc.camera.updateProjectionMatrix();
    sc.bias = -0.0004;
    sc.normalBias = 0.06;
    sc.radius = 3;

    // Floodlight cross-light from the four corners, at the front edge of the roofs (or the
    // back of the stands where there is no roof).
    const stands = shell?.stands.filter((s) => s !== null) ?? [];
    const roofs = stands.map((s) => s.roof).filter((r) => r !== null);
    const reach = shell
      ? shell.shape.r0 +
        (roofs.length ? Math.max(...roofs.map((r) => r.innerD)) : Math.max(...stands.map((s) => s.tiers[s.tiers.length - 1].backD), 0))
      : 40;
    const height = roofs.length ? Math.min(...roofs.map((r) => r.innerY)) - 1 : 35;
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const spot = new THREE.SpotLight(0xf2f6ff, 0, 0, 0.75, 0.7, 0);
      const cx = shell ? (shell.shape.cx ?? 0) + shell.shape.sx * sx : 40 * sx;
      const cz = shell ? (shell.shape.cz ?? 0) + shell.shape.sz * sz : 30 * sz;
      spot.position.set(cx + (sx * reach) / Math.SQRT2, height, cz + (sz * reach) / Math.SQRT2);
      spot.target.position.set(-sx * 18, 0, -sz * 10);
      this.spots.push(spot);
    }

    this.ground = new THREE.Mesh(new THREE.CircleGeometry(1200, 48), new THREE.MeshStandardMaterial({ roughness: 1 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.05;
    this.ground.receiveShadow = true;
    this.ground.name = 'ground';

    this.fog = new THREE.Fog(0xffffff, 450, 1400);
    scene.fog = this.fog;
    scene.add(this.sky, this.hemi, this.key, this.key.target, this.ground, ...this.spots, ...this.spots.map((s) => s.target));
  }

  private exterior: Array<{ material: THREE.MeshStandardMaterial; day: THREE.Color }> = [];

  /**
   * Materials whose look follows time of day: fixture and board glow, plus exterior surfaces
   * (roof top, facade). The evening key light stands in for the floodlights and would otherwise
   * light the outside of the building as if it were daytime.
   */
  attach(
    fixtures: THREE.MeshStandardMaterial | null,
    boards: THREE.MeshStandardMaterial[],
    exterior: THREE.MeshStandardMaterial[],
    windows: THREE.MeshStandardMaterial[] = [],
  ): void {
    this.fixtures = fixtures;
    this.boards = boards;
    this.exterior = exterior.map((material) => ({ material, day: material.color.clone() }));
    this.windows = windows;
  }

  private windows: THREE.MeshStandardMaterial[] = [];

  setTime(time: TimeOfDay): void {
    const L = LOOKS[time];
    const u = this.sky.material.uniforms;
    u.uTop.value.set(L.skyTop);
    u.uHorizon.value.set(L.skyHorizon);
    u.uGround.value.set(L.ground);
    this.fog.color.set(L.skyHorizon);
    this.scene.background = null;
    this.ground.material.color.set(L.ground);
    this.hemi.color.set(L.hemiSky);
    this.hemi.groundColor.set(L.hemiGround);
    this.hemi.intensity = L.hemi;
    this.key.color.set(L.key);
    this.key.intensity = L.keyIntensity;
    this.key.position.set(...L.keyDir).normalize().multiplyScalar(320);
    for (const s of this.spots) s.intensity = L.spots;
    if (this.fixtures) this.fixtures.emissiveIntensity = L.fixtures;
    for (const b of this.boards) b.emissiveIntensity = L.boards;
    for (const w of this.windows) w.emissiveIntensity = L.windows;
    for (const e of this.exterior) e.material.color.copy(e.day).multiplyScalar(time === 'evening' ? 0.28 : 1);
    this.renderer.toneMappingExposure = L.exposure;
    this.renderer.shadowMap.needsUpdate = true;
  }

  setShadows(on: boolean): void {
    this.shadows = on;
    this.key.castShadow = on;
    this.renderer.shadowMap.needsUpdate = true;
  }

  get shadowsOn(): boolean {
    return this.shadows;
  }

  /** Per frame: keep the sky dome centred on the camera. */
  update(camera: THREE.Camera): void {
    this.sky.position.copy(camera.position);
  }
}
