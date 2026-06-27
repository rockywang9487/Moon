import * as THREE from 'three';
import { AppState } from '../state.js';

const PARTICLE_COUNT = 3000;

export class BloodParticles {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.age = 0;
    this._build();
  }

  _build() {
    const positions  = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const colors     = new Float32Array(PARTICLE_COUNT * 3);
    const sizes      = new Float32Array(PARTICLE_COUNT);
    const lifetimes  = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Start at sphere surface
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r = 1.0 + Math.random() * 0.1;
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      // Outward velocity with some randomness
      const speed = 0.5 + Math.random() * 2.5;
      const vTheta = theta + (Math.random() - 0.5) * 0.8;
      const vPhi   = phi + (Math.random() - 0.5) * 0.8;
      velocities[i * 3]     = speed * Math.sin(vPhi) * Math.cos(vTheta);
      velocities[i * 3 + 1] = speed * Math.cos(vPhi) + (Math.random() - 0.2) * 0.5;
      velocities[i * 3 + 2] = speed * Math.sin(vPhi) * Math.sin(vTheta);

      // Deep red to bright red to orange
      const tone = Math.random();
      if (tone < 0.5) {
        colors[i * 3] = 0.7 + Math.random() * 0.3; // R
        colors[i * 3+1] = 0.01 + Math.random() * 0.05;
        colors[i * 3+2] = 0.02 + Math.random() * 0.03;
      } else if (tone < 0.8) {
        // Green flecks (her hair dissolving)
        colors[i * 3]   = 0.05;
        colors[i * 3+1] = 0.4 + Math.random() * 0.4;
        colors[i * 3+2] = 0.2 + Math.random() * 0.2;
      } else {
        // White-hot core
        colors[i * 3]   = 0.9;
        colors[i * 3+1] = 0.85;
        colors[i * 3+2] = 0.8;
      }

      sizes[i]     = 2.0 + Math.random() * 6.0;
      lifetimes[i] = 0.4 + Math.random() * 2.0;
    }

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    this.geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

    // Store for animation
    this._positions  = positions;
    this._velocities = velocities;
    this._lifetimes  = lifetimes;
    this._ages       = new Float32Array(PARTICLE_COUNT);
    this._originalPos = positions.slice();

    this.mat = new THREE.PointsMaterial({
      size:            0.04,
      vertexColors:    true,
      blending:        THREE.AdditiveBlending,
      transparent:     true,
      depthWrite:      false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(this.geo, this.mat);
    this.points.visible = false;
    this.scene.add(this.points);
  }

  trigger() {
    this.active = true;
    this.age = 0;
    this.points.visible = true;

    // Reset positions
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this._positions[i * 3]     = this._originalPos[i * 3];
      this._positions[i * 3 + 1] = this._originalPos[i * 3 + 1];
      this._positions[i * 3 + 2] = this._originalPos[i * 3 + 2];
      this._ages[i] = 0;
    }
    this.geo.attributes.position.needsUpdate = true;
  }

  update(dt) {
    if (!this.active) return;
    this.age += dt;

    if (this.age > 4.0) {
      this.active = false;
      this.points.visible = false;
      return;
    }

    const gravity = -0.3;
    const damping = 0.98;
    let allDead = true;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this._ages[i] += dt;
      const life = this._ages[i] / this._lifetimes[i];

      if (life < 1.0) {
        allDead = false;
        // Update position
        this._velocities[i * 3 + 1] += gravity * dt;
        this._velocities[i * 3]     *= damping;
        this._velocities[i * 3 + 2] *= damping;

        this._positions[i * 3]     += this._velocities[i * 3]     * dt;
        this._positions[i * 3 + 1] += this._velocities[i * 3 + 1] * dt;
        this._positions[i * 3 + 2] += this._velocities[i * 3 + 2] * dt;
      } else {
        // Collapse to origin (ash)
        this._positions[i * 3]     *= 0.9;
        this._positions[i * 3 + 1] *= 0.9;
        this._positions[i * 3 + 2] *= 0.9;
      }
    }

    this.geo.attributes.position.needsUpdate = true;

    // Overall fade out
    this.mat.opacity = Math.max(0, 1.0 - (this.age / 3.5) * (this.age / 3.5));
  }

  dispose() {
    this.scene.remove(this.points);
    this.geo.dispose();
    this.mat.dispose();
  }
}
