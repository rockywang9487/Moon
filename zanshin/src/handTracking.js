import { AppState } from './state.js';

// Indices of finger tip and pip (proximal joint) landmarks
const TIPS = [4, 8, 12, 16, 20];
const PIPS = [3, 6, 10, 14, 18];
const WRIST = 0;
const PALM_CENTER = 9;

let hands = null;
let lastPalmPos = null;
let lastPalmTime = 0;

function getDistance(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

function computeOpenness(landmarks) {
  // Average of distances from each finger tip to wrist, normalized
  const wrist = landmarks[WRIST];
  let totalDist = 0;
  for (const tipIdx of TIPS) {
    totalDist += getDistance(landmarks[tipIdx], wrist);
  }
  // Open palm ~0.5 in normalized coords, fist ~0.15
  const avg = totalDist / TIPS.length;
  return Math.min(1, Math.max(0, (avg - 0.12) / 0.28));
}

function computeSlashVelocity(landmarks) {
  const palm = landmarks[PALM_CENTER];
  const now = performance.now() / 1000;
  const dt = now - lastPalmTime;

  if (!lastPalmPos || dt > 0.2) {
    lastPalmPos = { x: palm.x, y: palm.y };
    lastPalmTime = now;
    return 0;
  }

  const dx = palm.x - lastPalmPos.x;
  const dy = palm.y - lastPalmPos.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const vel = dist / dt;

  lastPalmPos = { x: palm.x, y: palm.y };
  lastPalmTime = now;

  return vel;
}

function computePalmRotation(landmarks) {
  const wrist = landmarks[0];
  const middle = landmarks[9];
  const dx = middle.x - wrist.x;
  const dy = middle.y - wrist.y;
  return { rx: dy * 2.0, ry: dx * 3.0 };
}

function computeIbukiGesture(landmarks) {
  // Detect hand moving downward slowly with open palm
  const palm = landmarks[PALM_CENTER];
  if (!lastPalmPos) return 0;
  const dy = lastPalmPos.y - palm.y;  // positive = moving up in screen space
  // Ibuki = slow downward push (dy < 0 means palm moving down in video coords which is up on screen)
  return Math.max(0, -dy * 5.0);
}

export async function initHandTracking(videoEl, onReady) {
  // Dynamic import of MediaPipe from CDN script tag approach (no bundling issues)
  try {
    const { Hands } = await import('@mediapipe/hands');

    hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands:          1,
      modelComplexity:      1,
      minDetectionConfidence:  0.75,
      minTrackingConfidence:   0.75,
    });

    hands.onResults((results) => {
      if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        AppState.palmOpenness = 1;
        AppState.slashVelocity = 0;
        return;
      }

      const landmarks = results.multiHandLandmarks[0];

      const openness = computeOpenness(landmarks);
      AppState.palmOpenness = openness;

      const vel = computeSlashVelocity(landmarks);
      AppState.slashVelocity = vel;

      // Map openness → tension (fist = high tension)
      const grip = 1.0 - openness;
      if (AppState.scene === 2) {
        AppState.applyTension(grip);
      }

      // Act 1: palm rotation drives moon rotation
      if (AppState.scene === 1) {
        const rot = computePalmRotation(landmarks);
        window._moonRotationTarget = rot;
      }

      // Slash detection: sudden high velocity while in act 2 (after tension lock)
      if (AppState.scene === 2 && AppState.tensionLock > 0.7 && vel > 2.5) {
        window._triggerCut = true;
      }

      // Act 4: slow downward push expands enso
      if (AppState.scene === 4 && openness > 0.7) {
        const gest = computeIbukiGesture(landmarks);
        if (gest > 0) {
          AppState.ensoBreath = Math.min(1, AppState.ensoBreath + gest * 0.02);
        }
      }
    });

    // Attach camera stream
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    videoEl.srcObject = stream;
    videoEl.play();

    const sendFrame = async () => {
      if (videoEl.readyState >= 2) {
        await hands.send({ image: videoEl });
      }
      requestAnimationFrame(sendFrame);
    };
    sendFrame();

    AppState.handMode = true;
    if (onReady) onReady();

  } catch (err) {
    console.warn('Hand tracking unavailable:', err.message);
    AppState.handMode = false;
  }
}
