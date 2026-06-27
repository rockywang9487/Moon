import * as THREE from 'three';
import { AppState } from '../state.js';

const NUM_TUBES  = 12;
const CURVE_PTS  = 9;    // control points per CatmullRomCurve3
const TUBE_SEGS  = 48;   // segments along length
const RADIAL_SEGS = 5;   // segments around circumference
const BASE_TUBE_R = 0.013; // visual tube radius

// ── Inline GLSL ─────────────────────────────────────────────────────────────

const TUBE_VERT = /* glsl */`
  uniform float u_time;
  uniform float u_tension;

  varying vec2  vUv;
  varying float vFresnel;

  void main() {
    vUv = uv;

    // Squirm: oscillate the tube surface outward along its normal
    float squirm = sin(uv.x * 10.0 + u_time * (3.5 + u_tension * 5.0))
                   * u_tension * 0.018;
    vec3 pos = position + normal * squirm;

    // Tighten: pull the whole rope inward toward the sphere center
    float grip = 1.0 - u_tension * 0.10;
    pos *= grip;

    // View-space normal for Fresnel
    vec3 vNorm = normalize(normalMatrix * normal);
    vec3 viewDir = normalize(-( modelViewMatrix * vec4(pos, 1.0) ).xyz);
    vFresnel = pow(1.0 - max(dot(vNorm, viewDir), 0.0), 2.5);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const TUBE_FRAG = /* glsl */`
  uniform float u_time;
  uniform float u_tension;
  uniform float u_opacity;

  varying vec2  vUv;
  varying float vFresnel;

  void main() {
    // Crimson core → hot red → white-hot at Fresnel edge
    vec3 crimson  = vec3(0.42, 0.00, 0.02);
    vec3 hotRed   = vec3(0.95, 0.08, 0.04);
    vec3 whiteHot = vec3(1.00, 0.60, 0.25);

    vec3 col = mix(crimson, hotRed, u_tension);
    col = mix(col, whiteHot, vFresnel * u_tension * 0.9);

    // Pulse traveling along the rope (energy rushing through the constraint)
    float pulsePos = fract(vUv.x * 4.0 - u_time * 2.0);
    float pulse    = pow(max(0.0, 1.0 - pulsePos * 3.5), 3.0) * u_tension;
    col += whiteHot * pulse * 0.7;

    // Soft end-caps fade
    float endFade = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);

    gl_FragColor = vec4(col, u_opacity * endFade);
  }
`;

// ── RedThreads class ─────────────────────────────────────────────────────────

export class RedThreads {
  constructor(scene) {
    this.scene   = scene;
    this.group   = new THREE.Group();
    this.tubes   = [];    // { mesh, geo }
    this.mats    = [];    // per-tube ShaderMaterial (reused across rebuilds)
    this._lastRebuildTension = -1;

    this.scene.add(this.group);
    this._buildMaterials();
    this._buildGeometries(0, 0);
  }

  // ── Materials (created once, uniforms updated each frame) ──────────────────

  _buildMaterials() {
    for (let i = 0; i < NUM_TUBES; i++) {
      this.mats.push(new THREE.ShaderMaterial({
        vertexShader:   TUBE_VERT,
        fragmentShader: TUBE_FRAG,
        uniforms: {
          u_time:    { value: 0 },
          u_tension: { value: 0 },
          u_opacity: { value: 0 },
        },
        transparent: true,
        blending:    THREE.AdditiveBlending,
        depthWrite:  false,
        side:        THREE.DoubleSide,
      }));
    }
  }

  // ── Curve generation ───────────────────────────────────────────────────────

  _makeCurve(index, tension, time) {
    const phase    = (index / NUM_TUBES) * Math.PI * 2;
    // Use golden-angle-like spread for even initial phi distribution
    const phiBase  = ((index * 137.508) % 180) * (Math.PI / 180) - Math.PI / 2;

    // Rope radius: loosely above the sphere at low tension, biting in at high
    const r        = 1.13 - tension * 0.11;
    // Coil density increases with tension (rope wraps tighter)
    const coils    = 1.8 + tension * 1.6;
    // Slow auto-rotation so ropes drift around the sphere
    const drift    = time * (0.12 + (index % 4) * 0.04);

    const pts = [];
    for (let j = 0; j < CURVE_PTS; j++) {
      const t     = j / (CURVE_PTS - 1);
      // Latitude sweep along the sphere
      const phi   = phiBase + t * Math.PI * 1.5 - Math.PI * 0.55;
      const theta = t * Math.PI * coils + phase + drift;

      // Constriction bands: equatorial regions squeeze inward
      const constrictR = r * (1.0 - tension * 0.08 * Math.pow(Math.cos(phi * 1.5), 2));

      pts.push(new THREE.Vector3(
        constrictR * Math.cos(phi) * Math.cos(theta),
        constrictR * Math.sin(phi),
        constrictR * Math.cos(phi) * Math.sin(theta),
      ));
    }
    return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  }

  // ── Geometry build/rebuild ─────────────────────────────────────────────────

  _buildGeometries(tension, time) {
    // Dispose old meshes
    this.tubes.forEach(({ mesh, geo }) => {
      this.group.remove(mesh);
      geo.dispose();
    });
    this.tubes = [];

    for (let i = 0; i < NUM_TUBES; i++) {
      const curve = this._makeCurve(i, tension, time);
      const geo   = new THREE.TubeGeometry(
        curve, TUBE_SEGS, BASE_TUBE_R, RADIAL_SEGS, false
      );
      const mesh  = new THREE.Mesh(geo, this.mats[i]);
      this.group.add(mesh);
      this.tubes.push({ mesh, geo });
    }
    this._lastRebuildTension = tension;
  }

  // ── Per-frame update ───────────────────────────────────────────────────────

  update(dt) {
    const t       = AppState.time;
    const tension = AppState.tensionLock;

    // Only show in act 2 (and briefly during cut)
    const inAct2    = AppState.scene === 2;
    const inCutFade = AppState.scene === 3 && AppState.cutProgress < 0.4;
    const shouldShow = (inAct2 || inCutFade) && tension > 0.01;

    this.group.visible = shouldShow;
    if (!shouldShow) return;

    // Rebuild curves when tension changes meaningfully (cheap throttle)
    // Use a hysteresis band of 0.03 to avoid thrashing
    if (Math.abs(tension - this._lastRebuildTension) > 0.025) {
      this._buildGeometries(tension, t);
    }

    // Opacity: fade in from act2 entry, fade out during cut
    let targetOp;
    if (inCutFade) {
      targetOp = Math.max(0, 1.0 - AppState.cutProgress * 2.5);
    } else {
      // Appear quickly once tension > 0, then scale with tension
      targetOp = Math.min(1.0, tension * 1.8) * 0.9;
    }

    for (let i = 0; i < NUM_TUBES; i++) {
      const u = this.mats[i].uniforms;
      u.u_time.value     = t;
      u.u_tension.value  = tension;
      // Smooth opacity transition
      u.u_opacity.value += (targetOp - u.u_opacity.value) * Math.min(1, dt * 6);
    }
  }

  dispose() {
    this.tubes.forEach(({ mesh, geo }) => {
      this.group.remove(mesh);
      geo.dispose();
    });
    this.mats.forEach(m => m.dispose());
    this.scene.remove(this.group);
  }
}
