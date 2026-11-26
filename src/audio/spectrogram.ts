/* ===================================================================
 * Spectrogram waterfall / real-time frequency bin renderer.
 * Deep indigo to pink to peach color ramp matching Murmur aesthetic.
 * =================================================================== */

export class SpectrogramRenderer {
  private readonly _canvas: HTMLCanvasElement;
  private readonly _ctx: CanvasRenderingContext2D;
  private readonly _history: Float32Array[] = [];
  private readonly _maxHistory = 60;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d')!;
  }

  pushBins(bins: Float32Array): void {
    this._history.push(new Float32Array(bins));
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }
    this.render();
  }

  render(): void {
    const w = this._canvas.width;
    const h = this._canvas.height;
    const ctx = this._ctx;

    ctx.clearRect(0, 0, w, h);
    if (this._history.length === 0) return;

    const rowHeight = h / this._history.length;
    const binCount = this._history[0].length;
    const colWidth = w / binCount;

    for (let row = 0; row < this._history.length; row++) {
      const bins = this._history[row];
      const y = h - (row + 1) * rowHeight;

      for (let col = 0; col < binCount; col++) {
        const val = Math.min(1, Math.max(0, bins[col]));
        // Color ramp: deep indigo (val=0) -> periwinkle -> pink -> peach -> bright orange (val=1)
        ctx.fillStyle = this._getColor(val);
        ctx.fillRect(col * colWidth, y, colWidth + 0.5, rowHeight + 0.5);
      }
    }
  }

  private _getColor(val: number): string {
    if (val < 0.25) {
      // Deep navy to indigo (#141A4A to #2A2F8F)
      const t = val / 0.25;
      const r = Math.round(20 + t * (42 - 20));
      const g = Math.round(26 + t * (47 - 26));
      const b = Math.round(74 + t * (143 - 74));
      return `rgb(${r},${g},${b})`;
    } else if (val < 0.5) {
      // Indigo to lavender/pink (#2A2F8F to #F2B8D0)
      const t = (val - 0.25) / 0.25;
      const r = Math.round(42 + t * (242 - 42));
      const g = Math.round(47 + t * (184 - 47));
      const b = Math.round(143 + t * (208 - 143));
      return `rgb(${r},${g},${b})`;
    } else if (val < 0.75) {
      // Pink to peach (#F2B8D0 to #F4C9C0)
      const t = (val - 0.5) / 0.25;
      const r = Math.round(242 + t * (244 - 242));
      const g = Math.round(184 + t * (201 - 184));
      const b = Math.round(208 + t * (192 - 208));
      return `rgb(${r},${g},${b})`;
    } else {
      // Peach to vibrant coral/orange (#F4C9C0 to #F07F45)
      const t = (val - 0.75) / 0.25;
      const r = Math.round(244 + t * (240 - 244));
      const g = Math.round(201 + t * (127 - 201));
      const b = Math.round(192 + t * (69 - 192));
      return `rgb(${r},${g},${b})`;
    }
  }
}
