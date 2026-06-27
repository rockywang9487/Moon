// Renders the Enso (圆相) using an SVG-like canvas overlay
// to get pixel-perfect edges that 3D can't match

export class Enso {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = 0;       // 0 → 1
    this.opacity = 0;
    this.breathPhase = 0;
    this.fractalAge = 0;
    this.active = false;
  }

  activate() {
    this.active = true;
    this.size = 0;
    this.opacity = 0;
    this.fractalAge = 0;
  }

  // size 0→1, dt in seconds
  update(dt) {
    if (!this.active) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    this.fractalAge += dt;

    const W = this.canvas.width;
    const H = this.canvas.height;
    this.ctx.clearRect(0, 0, W, H);

    const cx = W * 0.5;
    const cy = H * 0.5;

    // Enso target radius based on ensoBreath
    const targetR = Math.min(W, H) * 0.28 * this.size;
    if (targetR < 2) return;

    this.opacity = Math.min(1, this.opacity + dt * 0.6);

    // Main ring
    const strokeW = Math.max(1, 1.5 + (1 - this.size) * 3);
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, targetR, 0, Math.PI * 2);
    this.ctx.strokeStyle = `rgba(255,255,255,${this.opacity * 0.9})`;
    this.ctx.lineWidth = strokeW;
    this.ctx.stroke();

    // Outer soft glow ring
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, targetR, 0, Math.PI * 2);
    this.ctx.strokeStyle = `rgba(200,255,230,${this.opacity * 0.15})`;
    this.ctx.lineWidth = strokeW + 8;
    this.ctx.stroke();

    // Fractal edge petals — geometric "digital bloom"
    if (this.fractalAge > 0.5 && this.size > 0.3) {
      const petalCount = 12;
      const petalOpacity = Math.min(1, (this.fractalAge - 0.5) * 0.5) * this.opacity * 0.4;

      for (let i = 0; i < petalCount; i++) {
        const angle = (i / petalCount) * Math.PI * 2;
        const px = cx + Math.cos(angle) * targetR;
        const py = cy + Math.sin(angle) * targetR;

        const petalLen = targetR * 0.08 * (1 + Math.sin(this.fractalAge * 1.2 + i) * 0.3);

        this.ctx.beginPath();
        this.ctx.moveTo(px, py);
        this.ctx.lineTo(
          px + Math.cos(angle) * petalLen,
          py + Math.sin(angle) * petalLen
        );
        this.ctx.strokeStyle = `rgba(255,255,255,${petalOpacity})`;
        this.ctx.lineWidth = 0.5;
        this.ctx.stroke();
      }
    }

    // Breathing pulse: concentric faint ring
    if (this.size > 0.5) {
      const breathR = targetR * (1.0 + Math.sin(this.fractalAge * 0.8) * 0.04);
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, breathR, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(255,255,255,${this.opacity * 0.06})`;
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    }
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  deactivate() {
    this.active = false;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
