// ---------- Board geometry & canvas sizing (pixel-space) ----------

// Responsive cell size: shrinks to fit narrow viewports, capped at a
// comfortable desktop size.
const MAX_CELL = 40;
const MIN_CELL = 10;
const GAP = 0;
const PAD = 10;

export class Board {
  constructor({ canvas, cols, rows, wrapEl, shellEl }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cols = cols;
    this.rows = rows;
    this.wrapEl = wrapEl;
    this.shellEl = shellEl;

    this.cellSize = MAX_CELL;
    this.cssWidth = 0;
    this.cssHeight = 0;

    this.resize();
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("orientationchange", () => this.resize());
  }

  resize() {
    const wrapStyle = getComputedStyle(this.wrapEl);
    const shellStyle = getComputedStyle(this.shellEl);
    const horizontalChrome =
      parseFloat(wrapStyle.paddingLeft) +
      parseFloat(wrapStyle.paddingRight) +
      parseFloat(shellStyle.paddingLeft) +
      parseFloat(shellStyle.paddingRight) +
      parseFloat(shellStyle.borderLeftWidth) +
      parseFloat(shellStyle.borderRightWidth);
    const available = window.innerWidth - horizontalChrome - 4;

    this.cellSize = Math.max(
      MIN_CELL,
      Math.min(MAX_CELL, Math.floor((available - PAD * 2 - GAP * (this.cols - 1)) / this.cols))
    );

    this.cssWidth = PAD * 2 + this.cols * this.cellSize + (this.cols - 1) * GAP;
    this.cssHeight = PAD * 2 + this.rows * this.cellSize + (this.rows - 1) * GAP;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = this.cssWidth + "px";
    this.canvas.style.height = this.cssHeight + "px";
    this.canvas.width = Math.round(this.cssWidth * dpr);
    this.canvas.height = Math.round(this.cssHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Arrow-function fields so these stay correctly bound to `this` even when
  // destructured out (draw.js takes just the pieces it needs off `board`).

  cellRect = (col, row) => {
    return {
      x: PAD + col * (this.cellSize + GAP),
      y: PAD + row * (this.cellSize + GAP),
      w: this.cellSize,
      h: this.cellSize,
    };
  };

  cellCenter = (col, row) => {
    const r = this.cellRect(col, row);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  };

  pixelToCell = (x, y) => {
    return {
      col: Math.floor((x - PAD) / (this.cellSize + GAP)),
      row: Math.floor((y - PAD) / (this.cellSize + GAP)),
    };
  };

  clear() {
    this.ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
  }
}
