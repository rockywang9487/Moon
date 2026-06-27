import * as THREE from 'three';
import { AppState } from '../state.js';
import vertShader from '../shaders/liquidMoon.vert?raw';
import fragShader from '../shaders/liquidMoon.frag?raw';

export class LiquidMoon {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.mesh = null;
    this.uniforms = null;
    this.pulseQueue = [];      // scheduled pulse events
    this.pulseValue = 0;
    this.rotationTarget = { x: 0, y: 0 };
    this.rotationCurrent = { x: 0, y: 0 };
    this._init();
  }

  // GSAP animates this; update() multiplies it into the final scale
  pulseScale = 1.0;

  _init() {
    const geo = new THREE.SphereGeometry(1.0, 128, 128);

    this.uniforms = {
      u_time:      { value: 0 },
      u_tension:   { value: 0 },
      u_pulse:     { value: 0 },
      u_cameraPos: { value: new THREE.Vector3() },
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader:   vertShader,
      fragmentShader: fragShader,
      uniforms:       this.uniforms,
      transparent:    true,
      side:           THREE.FrontSide,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.mesh);

    // Subtle point light for extra depth
    this.light = new THREE.PointLight(0x33ffaa, 1.2, 8);
    this.light.position.set(2, 2, 3);
    this.scene.add(this.light);

    // Ambient fill
    this.ambient = new THREE.AmbientLight(0x041008, 0.8);
    this.scene.add(this.ambient);
  }

  // Called externally to trigger one of the 4 heartbeat pulses
  triggerPulse(intensity = 1.0) {
    this.pulseQueue.push({ t: 0, intensity });
  }

  // Set sphere rotation from hand palm orientation
  setRotationTarget(rx, ry) {
    this.rotationTarget.x = rx;
    this.rotationTarget.y = ry;
  }

  update(dt) {
    const t = AppState.time;
    const tension = AppState.tensionLock;

    this.uniforms.u_time.value = t;
    this.uniforms.u_tension.value = tension;
    this.uniforms.u_cameraPos.value.copy(this.camera.position);

    // Process pulse queue
    this.pulseValue *= Math.exp(-dt * 5.0);  // exponential decay
    if (this.pulseQueue.length > 0) {
      const p = this.pulseQueue[0];
      p.t += dt;
      this.pulseValue = Math.max(this.pulseValue, p.intensity * Math.sin(p.t * Math.PI * 3) * Math.exp(-p.t * 3.0));
      if (p.t > 1.2) this.pulseQueue.shift();
    }
    this.uniforms.u_pulse.value = Math.max(0, this.pulseValue);

    // Scale: tension + heartbeat + GSAP-driven pulseScale
    const tensionBulge = 1.0 + tension * 0.05 * Math.sin(t * 8.0);
    const pulseBulge   = 1.0 + this.pulseValue * 0.08;
    this.mesh.scale.setScalar(tensionBulge * pulseBulge * this.pulseScale);

    // Gentle auto-rotation (act 1 laziness)
    this.mesh.rotation.y += dt * 0.08;
    this.mesh.rotation.x += dt * 0.03;

    // Hand-driven rotation override in act 1
    if (AppState.scene === 1 && AppState.handMode) {
      this.rotationCurrent.x += (this.rotationTarget.x - this.rotationCurrent.x) * 0.08;
      this.rotationCurrent.y += (this.rotationTarget.y - this.rotationCurrent.y) * 0.08;
      this.mesh.rotation.x = this.rotationCurrent.x;
      this.mesh.rotation.y += this.rotationCurrent.y * dt;
    }

    // Light flicker (jazz bar ambience)
    this.light.intensity = 1.2 + Math.sin(t * 2.3) * 0.15 + Math.sin(t * 5.7) * 0.05;

    // Visibility
    this.mesh.visible = AppState.scene < 3 || AppState.cutProgress < 0.05;
  }

  show() { this.mesh.visible = true; }
  hide() { this.mesh.visible = false; }

  dispose() {
    this.scene.remove(this.mesh);
    this.scene.remove(this.light);
    this.scene.remove(this.ambient);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
