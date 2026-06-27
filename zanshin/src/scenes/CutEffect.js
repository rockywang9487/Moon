// Renders the white slash line on the 2D canvas overlay
export class CutEffect {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.active = false;
    this.age = 0;
    this.line = null;  // { x1, y1, x2, y2 }
  }

  trigger(x1, y1, x2, y2) {
    this.active = true;
    this.age = 0;
    this.line = { x1, y1, x2, y2 };
  }

  // Auto-trigger a diagonal slash across center
  triggerAuto() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const cx = W * 0.5;
    const cy = H * 0.5;
    const len = Math.min(W, H) * 0.55;
    const angle = -Math.PI * 0.15;  // slight diagonal
    this.trigger(
      cx - Math.cos(angle) * len,
      cy - Math.sin(angle) * len,
      cx + Math.cos(angle) * len,
      cy + Math.sin(angle) * len
    );
  }

  update(dt) {
    const W = this.canvas.width;
    const H = this.canvas.height;

    if (!this.active) {
      this.ctx.clearRect(0, 0, W, H);
      return;
    }

    this.age += dt;
    this.ctx.clearRect(0, 0, W, H);

    if (!this.line) return;
    const { x1, y1, x2, y2 } = this.line;

    // Phase 1 (0 - 0.08s): INSTANT bright white flash line
    if (this.age < 0.08) {
      const progress = this.age / 0.08;
      // Draw cut from start to current end
      const ex = x1 + (x2 - x1) * progress;
      const ey = y1 + (y2 - y1) * progress;

      // Core white line
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(ex, ey);
      this.ctx.strokeStyle = 'rgba(255,255,255,1.0)';
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = 'round';
      this.ctx.stroke();

      // Broad glow
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(ex, ey);
      this.ctx.strokeStyle = 'rgba(200,255,230,0.3)';
      this.ctx.lineWidth = 20;
      this.ctx.stroke();

    // Phase 2 (0.08 - 0.6s): Linger and fade
    } else if (this.age < 0.6) {
      const fadeAlpha = 1.0 - (this.age - 0.08) / 0.52;

      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.strokeStyle = `rgba(255,255,255,${fadeAlpha * 0.7})`;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.strokeStyle = `rgba(180,255,220,${fadeAlpha * 0.1})`;
      this.ctx.lineWidth = 12;
      this.ctx.stroke();
    } else {
      this.active = false;
      this.ctx.clearRect(0, 0, W, H);
    }
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }
}
