import { Pane } from 'tweakpane';
import { AppState } from './state.js';

export function buildDebugUI(callbacks) {
  const pane = new Pane({ title: 'ZANSHIN / 斩  —  DEBUG', expanded: true });

  // Scene navigation
  const sceneFolder = pane.addFolder({ title: '幕 · Acts', expanded: true });

  const sceneParams = { scene: 1 };
  sceneFolder.addBinding(sceneParams, 'scene', {
    label: 'Current Act',
    options: {
      'I  · 水月  Liquid Moon': 1,
      'II · 绞杀  The Choke':   2,
      'III· 试割  Clean Cut':   3,
      'IV · 残心  Zanshin':     4,
    }
  }).on('change', (ev) => {
    AppState.setScene(ev.value);
    callbacks.onSceneChange?.(ev.value);
  });

  AppState.onSceneChange((n) => {
    sceneParams.scene = n;
    pane.refresh();
  });

  // Quick jump buttons
  const btnRow = sceneFolder.addFolder({ title: 'Quick Jump', expanded: true });
  btnRow.addButton({ title: 'ACT I  · 水月' }).on('click', () => {
    AppState.reset();
    callbacks.onSceneChange?.(1);
  });
  btnRow.addButton({ title: 'ACT II · 绞杀' }).on('click', () => {
    AppState.setScene(2);
    callbacks.onSceneChange?.(2);
  });
  btnRow.addButton({ title: 'ACT III · 试割' }).on('click', () => {
    AppState.setScene(3);
    callbacks.triggerCut?.();
  });
  btnRow.addButton({ title: 'ACT IV · 残心' }).on('click', () => {
    AppState.setScene(4);
    callbacks.onSceneChange?.(4);
  });

  // Tension slider
  const tensionFolder = pane.addFolder({ title: '执念 · Tension', expanded: true });
  const tensionParams = { tension: 0 };
  tensionFolder.addBinding(tensionParams, 'tension', {
    label: 'Grip (0 = open, 1 = fist)',
    min: 0, max: 1, step: 0.01,
  }).on('change', (ev) => {
    AppState.applyTension(ev.value);
  });

  // Pulse button
  tensionFolder.addButton({ title: '💥  Trigger Heartbeat Pulse' }).on('click', () => {
    callbacks.triggerPulse?.();
  });
  tensionFolder.addButton({ title: '💥💥💥💥  4 × Pulses (act 2)' }).on('click', () => {
    [0, 0.4, 0.8, 1.2].forEach(delay => {
      setTimeout(() => callbacks.triggerPulse?.(), delay * 1000);
    });
  });

  // Cut trigger
  const cutFolder = pane.addFolder({ title: '一击 · Clean Cut', expanded: true });
  cutFolder.addButton({ title: '⚔  Execute Cut (Tameshiwari)' }).on('click', () => {
    callbacks.triggerCut?.();
  });

  // Enso breath
  const ensoFolder = pane.addFolder({ title: '息吹 · Ibuki Breath', expanded: true });
  const ensoParams = { enso: 0 };
  ensoFolder.addBinding(ensoParams, 'enso', {
    label: 'Enso Size (0→1)',
    min: 0, max: 1, step: 0.01,
  }).on('change', (ev) => {
    AppState.ensoBreath = ev.value;
  });
  ensoFolder.addButton({ title: '🌕  Auto-Grow Enso' }).on('click', () => {
    callbacks.autoGrowEnso?.();
  });

  // Reset
  pane.addBlade({ view: 'separator' });
  pane.addButton({ title: '↺  FULL RESET' }).on('click', () => {
    tensionParams.tension = 0;
    ensoParams.enso = 0;
    pane.refresh();
    AppState.reset();
    callbacks.onSceneChange?.(1);
    callbacks.onReset?.();
  });

  return pane;
}
