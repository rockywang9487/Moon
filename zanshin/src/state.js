// Global application state — all visual layers listen to this object
export const AppState = {
  scene: 1,           // 1 = 水月, 2 = 绞杀, 3 = 试割, 4 = 残心
  tension: 0,         // 0 → 1: how tight the grip (act 2 driver)
  tensionLock: 0,     // highest tension ever reached (one-way ratchet)
  isCut: false,       // has the slash been triggered
  cutProgress: 0,     // 0 → 1: cut animation progress
  isReborn: false,    // entered act 4
  ensoBreath: 0,      // 0 → 1: enso size from Ibuki gesture or auto
  time: 0,            // elapsed seconds

  // morph speed (controls 水月 state-cycle period; 1.0 = 15s full cycle)
  morphSpeed: 1.0,

  // hand tracking
  handMode: false,
  palmOpenness: 1,    // 0 = fist, 1 = open palm
  slashVelocity: 0,   // instantaneous swipe speed

  // internal callbacks
  _onSceneChange: [],

  onSceneChange(fn) {
    this._onSceneChange.push(fn);
  },

  setScene(n) {
    this.scene = n;
    this._onSceneChange.forEach(fn => fn(n));
  },

  applyTension(v) {
    this.tension = Math.min(1, Math.max(0, v));
    if (this.tension > this.tensionLock) {
      this.tensionLock = this.tension;
    }
  },

  reset() {
    this.scene = 1;
    this.tension = 0;
    this.tensionLock = 0;
    this.isCut = false;
    this.cutProgress = 0;
    this.isReborn = false;
    this.ensoBreath = 0;
    this._onSceneChange.forEach(fn => fn(1));
  }
};
