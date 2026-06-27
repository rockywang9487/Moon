import * as THREE from 'three';
import { AppState } from '../state.js';
import vertShader from '../shaders/waterMoon.vert?raw';
import fragShader from '../shaders/waterMoon.frag?raw';

// One full morph cycle at speed=1.0 takes CYCLE_SECS seconds
const CYCLE_SECS = 15.0;

export class LiquidMoon {
  constructor(scene, camera) {
    this.scene  = scene;
    this.camera = camera;
    this.mesh   = null;
    this.uniforms = null;

    // Pulse system
    this.pulseQueue = [];
    this.pulseValue = 0;

    // Morph phase accumulator (0 → 2π)
    this.morphPhase = 0;

    // GSAP targets this; multiplied into final mesh scale
    this.pulseScale = 1.0;

    // Hand rotation targets
    this.rotationTarget  = { x: 0, y: 0 };
    this.rotationCurrent = { x: 0, y: 0 };

    this._init();
  }

  _init() {
    const geo = new THREE.SphereGeometry(1.0, 128, 128);

    this.uniforms = {
      u_time:          { value: 0 },
      u_tension:       { value: 0 },
      u_pulse:         { value: 0 },
      u_morphPhase:    { value: 0 },
      u_cameraPos:     { value: new THREE.Vector3() },
      u_isReflection:  { value: 0.0 },  // always 0 for the main sphere
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader:   vertShader,
      fragmentShader: fragShader,
      uniforms:       this.uniforms,
      transparent:    true,
      side:           THREE.FrontSide,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    // Moved up ~20% of viewport height, renderOrder above water (2)
    this.mesh.position.set(0, 0.75, 0);
    this.mesh.renderOrder = 2;
    this.scene.add(this.mesh);

    // Warm key light (bar ambience)
    this.keyLight = new THREE.PointLight(0xffe8a0, 1.4, 10);
    this.keyLight.position.set(2.5, 2.8, 3.0);
    this.scene.add(this.keyLight);

    // Cool fill light (opposite side — ice/shadow edge)
    this.fillLight = new THREE.PointLight(0x8ab4ff, 0.5, 8);
    this.fillLight.position.set(-2.0, -1.0, 1.5);
    this.scene.add(this.fillLight);

    // Ambient
    this.ambient = new THREE.AmbientLight(0x050508, 1.0);
    this.scene.add(this.ambient);
  }

  // ── External API ─────────────────────────────────────────────────────────────

  triggerPulse(intensity = 1.0) {
    this.pulseQueue.push({ t: 0, intensity });
  }

  setRotationTarget(rx, ry) {
    this.rotationTarget.x = rx;
    this.rotationTarget.y = ry;
  }

  // ── Update ───────────────────────────────────────────────────────────────────

  update(dt) {
    const t       = AppState.time;
    const tension = AppState.tensionLock;

    // Advance morph phase
    const speed = AppState.morphSpeed ?? 1.0;
    this.morphPhase = (this.morphPhase + dt * speed * (Math.PI * 2) / CYCLE_SECS) % (Math.PI * 2);

    // Update uniforms
    this.uniforms.u_time.value       = t;
    this.uniforms.u_tension.value    = tension;
    this.uniforms.u_morphPhase.value = this.morphPhase;
    this.uniforms.u_cameraPos.value.copy(this.camera.position);

    // Pulse queue
    this.pulseValue *= Math.exp(-dt * 5.0);
    if (this.pulseQueue.length > 0) {
      const p = this.pulseQueue[0];
      p.t += dt;
      this.pulseValue = Math.max(
        this.pulseValue,
        p.intensity * Math.sin(p.t * Math.PI * 3) * Math.exp(-p.t * 3.0)
      );
      if (p.t > 1.2) this.pulseQueue.shift();
    }
    this.uniforms.u_pulse.value = Math.max(0, this.pulseValue);

    // Scale: 0.8 base (20% smaller) × tension oscillation × heartbeat × GSAP
    const tensionBulge = 1.0 + tension * 0.05 * Math.sin(t * 8.0);
    const pulseBulge   = 1.0 + this.pulseValue * 0.08;
    this.mesh.scale.setScalar(0.8 * tensionBulge * pulseBulge * this.pulseScale);

    // Gentle auto-rotation (act 1 meditation)
    this.mesh.rotation.y += dt * 0.07;
    this.mesh.rotation.x += dt * 0.025;

    // Hand-driven rotation override (act 1 only)
    if (AppState.scene === 1 && AppState.handMode) {
      this.rotationCurrent.x += (this.rotationTarget.x - this.rotationCurrent.x) * 0.08;
      this.rotationCurrent.y += (this.rotationTarget.y - this.rotationCurrent.y) * 0.08;
      this.mesh.rotation.x   = this.rotationCurrent.x;
      this.mesh.rotation.y  += this.rotationCurrent.y * dt;
    }

    // Light animation: key light breathes slightly (bar flicker)
    this.keyLight.intensity  = 1.4 + Math.sin(t * 2.1) * 0.18 + Math.sin(t * 5.3) * 0.06;
    this.fillLight.intensity = 0.5 + Math.sin(t * 1.4 + 1.2) * 0.08;

    // Hide during act 3 cut
    this.mesh.visible = AppState.scene < 3 || AppState.cutProgress < 0.05;
  }

  show() { this.mesh.visible = true; }
  hide() { this.mesh.visible = false; }

  dispose() {
    [this.mesh, this.keyLight, this.fillLight, this.ambient].forEach(o => this.scene.remove(o));
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
