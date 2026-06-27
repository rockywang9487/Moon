import * as THREE from 'three';
import gsap from 'gsap';
import { AppState } from './state.js';
import { LiquidMoon }    from './scenes/LiquidMoon.js';
import { RedThreads }    from './scenes/RedThreads.js';
import { BloodParticles } from './scenes/BloodParticles.js';
import { Enso }          from './scenes/Enso.js';
import { CutEffect }     from './scenes/CutEffect.js';
import { buildDebugUI }  from './debugUI.js';
import { initHandTracking } from './handTracking.js';

// ─── Three.js Setup ──────────────────────────────────────────────────────────

const container = document.getElementById('canvas-container');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
container.appendChild(renderer.domElement);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 4.5);

// ─── 2D Canvas Overlay (cut + enso) ──────────────────────────────────────────

const svgCanvas = document.getElementById('svg-overlay');
svgCanvas.width  = window.innerWidth;
svgCanvas.height = window.innerHeight;

// ─── Scene Objects ─────────────────────────────────────────────────────────

const liquidMoon    = new LiquidMoon(scene, camera);
const redThreads    = new RedThreads(scene);
const bloodParticles = new BloodParticles(scene);
const enso          = new Enso(svgCanvas);
const cutEffect     = new CutEffect(svgCanvas);

// Split sphere halves (revealed at cut moment)
let halfTop = null, halfBottom = null;

function buildCutHalves() {
  // Two half-spheres that slide apart on cut
  const geoTop = new THREE.SphereGeometry(1.0, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2);
  const geoBot = new THREE.SphereGeometry(1.0, 64, 64, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x0a1f18,
    emissive: 0x063020,
    emissiveIntensity: 0.4,
    roughness: 0.1,
    metalness: 0.6,
    transparent: true,
    opacity: 0,
  });

  halfTop = new THREE.Mesh(geoTop, mat.clone());
  halfBottom = new THREE.Mesh(geoBot, mat.clone());

  halfTop.visible    = false;
  halfBottom.visible = false;

  scene.add(halfTop);
  scene.add(halfBottom);
}
buildCutHalves();

// ─── UI Elements ──────────────────────────────────────────────────────────

const cutFlash   = document.getElementById('cut-flash');
const chromaEl   = document.getElementById('chroma-overlay');
const sceneLabel = document.getElementById('scene-label');
const zanshinText = document.getElementById('zanshin-text');
const cameraBtn  = document.getElementById('camera-btn');
const videoEl    = document.getElementById('camera-feed');

const SCENE_LABELS = {
  1: 'ACT I  · 水月',
  2: 'ACT II · 绞杀',
  3: 'ACT III · 试割',
  4: 'ACT IV · 残心',
};

function updateSceneLabel(n) {
  sceneLabel.style.opacity = '0';
  setTimeout(() => {
    sceneLabel.textContent = SCENE_LABELS[n] || '';
    sceneLabel.style.opacity = '1';
  }, 500);
}

// ─── 4-Threshold Pulse System (Task 3) ───────────────────────────────────────

const PULSE_THRESHOLDS = [0.25, 0.50, 0.75, 0.95];
let pulsedThresholds = new Set();
let prevTension = 0;

function checkPulseThresholds(newTension) {
  PULSE_THRESHOLDS.forEach((threshold) => {
    if (newTension >= threshold && prevTension < threshold && !pulsedThresholds.has(threshold)) {
      pulsedThresholds.add(threshold);
      triggerThresholdPulse(threshold);
    }
  });
  prevTension = newTension;
}

function triggerThresholdPulse(threshold) {
  // Intensity scales with which threshold we crossed
  const intensity = 0.7 + (threshold / 0.95) * 0.5;

  // 1) GSAP: sphere scale erupts then elastic-springs back
  gsap.killTweensOf(liquidMoon, 'pulseScale');
  gsap.to(liquidMoon, {
    pulseScale: 1.0 + intensity * 0.22,
    duration:   0.10,
    ease:       'power4.out',
    onComplete: () => {
      gsap.to(liquidMoon, {
        pulseScale: 1.0,
        duration:   0.65,
        ease:       'elastic.out(1, 0.45)',
      });
    },
  });

  // 2) Screen flash — brief white bleed
  gsap.fromTo(cutFlash,
    { opacity: 0 },
    {
      opacity:  intensity * 0.28,
      duration: 0.06,
      ease:     'linear',
      yoyo:     true,
      repeat:   1,
    }
  );

  // 3) Moon internal pulse (shader bulge + brightness)
  liquidMoon.triggerPulse(intensity);

  // 4) Chroma vignette spike
  const curChroma = parseFloat(chromaEl.style.opacity) || 0;
  chromaEl.style.opacity = Math.min(1, curChroma + intensity * 0.3);
}

function resetPulseThresholds() {
  pulsedThresholds.clear();
  prevTension = 0;
}

// ─── Cut Sequence ────────────────────────────────────────────────────────────

let cutSequenceActive = false;
let cutSilenceTimer = 0;

function executeCut() {
  if (cutSequenceActive) return;
  cutSequenceActive = true;
  AppState.isCut = true;
  AppState.setScene(3);

  // 1) Trigger the white slash line
  const W = svgCanvas.width, H = svgCanvas.height;
  const cx = W / 2, cy = H / 2;
  const len = Math.min(W, H) * 0.52;
  const angle = -0.2;
  cutEffect.trigger(
    cx - Math.cos(angle) * len,
    cy - Math.sin(angle) * len,
    cx + Math.cos(angle) * len,
    cy + Math.sin(angle) * len
  );

  // 2) White screen flash
  gsap.fromTo(cutFlash, { opacity: 0 }, { opacity: 1, duration: 0.04, ease: 'linear',
    onComplete: () => {
      gsap.to(cutFlash, { opacity: 0, duration: 0.35, ease: 'power2.out' });
    }
  });

  // 3) After 0.05s: silence (opacity=0), then reveal halves
  setTimeout(() => {
    liquidMoon.hide();
    AppState.cutProgress = 0.1;

    // Show halves and animate them apart
    halfTop.material.opacity    = 0.95;
    halfBottom.material.opacity = 0.95;
    halfTop.visible    = true;
    halfBottom.visible = true;
    halfTop.position.set(0, 0, 0);
    halfBottom.position.set(0, 0, 0);

    gsap.to(halfTop.position,    { y:  0.6, z: 0.2, duration: 0.8, ease: 'power2.out' });
    gsap.to(halfBottom.position, { y: -0.6, z: 0.2, duration: 0.8, ease: 'power2.out' });

    // Fade halves out (glassy dissolution)
    gsap.to(halfTop.material,    { opacity: 0, delay: 0.5, duration: 1.2, ease: 'power2.in' });
    gsap.to(halfBottom.material, { opacity: 0, delay: 0.5, duration: 1.2, ease: 'power2.in' });

    // 4) Blood particle explosion
    bloodParticles.trigger();

    AppState.cutProgress = 0.5;
  }, 80);

  // 5) Transition to act 4 after 3.5s
  setTimeout(() => {
    AppState.cutProgress = 1.0;
    halfTop.visible    = false;
    halfBottom.visible = false;
    transitionToAct4();
    cutSequenceActive = false;
  }, 3500);
}

function transitionToAct4() {
  AppState.setScene(4);
  enso.activate();
  zanshinText.classList.add('visible');
  updateSceneLabel(4);

  // Auto-grow enso slowly
  let growTimer = 0;
  const growEnso = () => {
    if (AppState.scene !== 4) return;
    if (AppState.ensoBreath < 1) {
      AppState.ensoBreath = Math.min(1, AppState.ensoBreath + 0.005);
      requestAnimationFrame(growEnso);
    }
  };
  setTimeout(growEnso, 1000);
}

// ─── Debug UI ────────────────────────────────────────────────────────────────

const debugUI = buildDebugUI({
  onSceneChange(n) {
    updateSceneLabel(n);
    if (n === 1) {
      liquidMoon.show();
      halfTop.visible = false;
      halfBottom.visible = false;
      enso.deactivate();
      zanshinText.classList.remove('visible');
      cutSequenceActive = false;
      AppState.cutProgress = 0;
      resetPulseThresholds();
    } else if (n === 2) {
      liquidMoon.show();
      halfTop.visible = false;
      halfBottom.visible = false;
      enso.deactivate();
      zanshinText.classList.remove('visible');
      resetPulseThresholds();
    } else if (n === 3) {
      executeCut();
    } else if (n === 4) {
      liquidMoon.hide();
      halfTop.visible = false;
      halfBottom.visible = false;
      AppState.cutProgress = 1.0;
      transitionToAct4();
    }
  },
  triggerCut() {
    if (AppState.scene === 2 || AppState.scene === 1) {
      executeCut();
    }
  },
  setMorphPhase(phase) {
    liquidMoon.morphPhase = phase;
  },
  triggerPulse() {
    liquidMoon.triggerPulse(1.0);
  },
  autoGrowEnso() {
    if (AppState.scene !== 4) return;
    const grow = () => {
      if (AppState.ensoBreath < 1 && AppState.scene === 4) {
        AppState.ensoBreath = Math.min(1, AppState.ensoBreath + 0.01);
        requestAnimationFrame(grow);
      }
    };
    grow();
  },
  onReset() {
    liquidMoon.show();
    liquidMoon.pulseScale = 1.0;
    halfTop.visible = false;
    halfBottom.visible = false;
    enso.deactivate();
    zanshinText.classList.remove('visible');
    cutSequenceActive = false;
    cutFlash.style.opacity = '0';
    chromaEl.style.opacity = '0';
    resetPulseThresholds();
    updateSceneLabel(1);
  }
});

// ─── Hand Tracking Button ─────────────────────────────────────────────────

cameraBtn.addEventListener('click', () => {
  if (AppState.handMode) return;
  cameraBtn.textContent = 'INITIALIZING...';
  initHandTracking(videoEl, () => {
    cameraBtn.textContent = 'HAND TRACKING ACTIVE';
    cameraBtn.classList.add('active');
  });
});

// ─── Resize ──────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  const W = window.innerWidth, H = window.innerHeight;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
  svgCanvas.width  = W;
  svgCanvas.height = H;
  cutEffect.resize(W, H);
  enso.resize(W, H);
});

// ─── Chromatic Aberration (act 2) ────────────────────────────────────────────

function updateChroma(dt) {
  if (AppState.scene === 2) {
    const targetOp = AppState.tensionLock * 0.85;
    const cur = parseFloat(chromaEl.style.opacity) || 0;
    chromaEl.style.opacity = cur + (targetOp - cur) * Math.min(1, dt * 3);
  } else {
    const cur = parseFloat(chromaEl.style.opacity) || 0;
    if (cur > 0.01) chromaEl.style.opacity = cur * 0.92;
    else chromaEl.style.opacity = '0';
  }
}

// ─── Animation Loop ──────────────────────────────────────────────────────────

let lastTime = performance.now() / 1000;

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now() / 1000;
  const dt  = Math.min(now - lastTime, 0.05);
  lastTime  = now;
  AppState.time += dt;

  // Hand tracking → moon rotation
  if (window._moonRotationTarget && AppState.scene === 1) {
    liquidMoon.setRotationTarget(
      window._moonRotationTarget.rx,
      window._moonRotationTarget.ry
    );
  }

  // Hand tracking → auto-cut trigger
  if (window._triggerCut) {
    window._triggerCut = false;
    executeCut();
  }

  // Threshold pulse detection (fires in act 2 as tension rises)
  if (AppState.scene === 2) {
    checkPulseThresholds(AppState.tensionLock);
  }

  // Update enso from state
  enso.size = AppState.ensoBreath;

  // Update subsystems
  liquidMoon.update(dt);
  redThreads.update(dt);
  bloodParticles.update(dt);
  cutEffect.update(dt);
  enso.update(dt);
  updateChroma(dt);

  renderer.render(scene, camera);
}

// ─── Boot ─────────────────────────────────────────────────────────────────

updateSceneLabel(1);
animate();
