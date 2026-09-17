import {
  COLS,
  ROWS,
  createState,
  rotateMirror,
  isMirrorCell,
  canPlaceMirror,
  moveMirror,
  computeBeam,
} from "./logic.js";

// ---------- Board geometry (pixel-space) ----------
const MAX_CELL = 40;
const MIN_CELL = 10;
const GAP = 6;
const PAD = 10;
let CELL = MAX_CELL;

// RGB light colors and their combinations
const LIGHT = {
  red: { core: "#ff8a80", mid: "#ff3d3d", glow: "255, 61, 61" },
  green: { core: "#8ef5c0", mid: "#22c55e", glow: "34, 197, 94" },
  blue: { core: "#8ab4ff", mid: "#3b82f6", glow: "59, 130, 246" },
  yellow: { core: "#fff08a", mid: "#eab308", glow: "234, 179, 8" },
  cyan: { core: "#8af5f0", mid: "#06b6d4", glow: "6, 182, 212" },
  magenta: { core: "#ff8ae0", mid: "#d946ef", glow: "217, 70, 239" },
  white: { core: "#ffffff", mid: "#e2e8f0", glow: "226, 232, 240" },
};

const state = createState();

// ---------- Canvas setup ----------
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

let cssWidth, cssHeight;

const wrapEl = document.querySelector(".wrap");
const shellEl = document.querySelector(".board-shell");

function resize() {
  const wrapStyle = getComputedStyle(wrapEl);
  const shellStyle = getComputedStyle(shellEl);
  const horizontalChrome =
    parseFloat(wrapStyle.paddingLeft) +
    parseFloat(wrapStyle.paddingRight) +
    parseFloat(shellStyle.paddingLeft) +
    parseFloat(shellStyle.paddingRight) +
    parseFloat(shellStyle.borderLeftWidth) +
    parseFloat(shellStyle.borderRightWidth);
  const available = window.innerWidth - horizontalChrome - 4;

  CELL = Math.max(
    MIN_CELL,
    Math.min(MAX_CELL, Math.floor((available - PAD * 2 - GAP * (COLS - 1)) / COLS))
  );

  cssWidth = PAD * 2 + COLS * CELL + (COLS - 1) * GAP;
  cssHeight = PAD * 2 + ROWS * CELL + (ROWS - 1) * GAP;
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = cssWidth + "px";
  canvas.style.height = cssHeight + "px";
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

resize();
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", resize);

function cellRect(col, row) {
  return {
    x: PAD + col * (CELL + GAP),
    y: PAD + row * (CELL + GAP),
    w: CELL,
    h: CELL,
  };
}

function cellCenter(col, row) {
  const r = cellRect(col, row);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function orientationAngle(orientation) {
  return orientation === "slash" ? -Math.PI / 4 : Math.PI / 4;
}

// ---------- Transient visual state (not game state) ----------
let mirrorAngle = orientationAngle(state.mirror.orientation);
let mirrorTargetAngle = mirrorAngle;
let lastOrientation = state.mirror.orientation;
let hoveringMirror = false;
let ripple = null; // { start: timestamp }
let wasHit = false;

// Drag-to-move state
const DRAG_THRESHOLD = 4; // px of movement before a press counts as a drag, not a click
let pointerDownCell = null;
let pointerDownClient = null;
let dragging = false;
let dragPos = null; // pixel position the mirror is being dragged to
let dragSnapCell = null; // grid cell the drag would snap to on release

function pixelToCell(x, y) {
  return {
    col: Math.floor((x - PAD) / (CELL + GAP)),
    row: Math.floor((y - PAD) / (CELL + GAP)),
  };
}

function eventToCanvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function clampCell(col, row) {
  return {
    col: Math.min(COLS - 1, Math.max(0, col)),
    row: Math.min(ROWS - 1, Math.max(0, row)),
  };
}

canvas.addEventListener("pointerdown", (e) => {
  const p = eventToCanvasPoint(e);
  const { col, row } = pixelToCell(p.x, p.y);
  if (!isMirrorCell(state, col, row)) return;

  pointerDownCell = { col, row };
  pointerDownClient = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  const p = eventToCanvasPoint(e);
  const { col, row } = pixelToCell(p.x, p.y);

  if (pointerDownCell && !dragging) {
    const dx = e.clientX - pointerDownClient.x;
    const dy = e.clientY - pointerDownClient.y;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      dragging = true;
    }
  }

  if (dragging) {
    dragPos = p;
    dragSnapCell = clampCell(col, row);
    canvas.style.cursor = "grabbing";
    return;
  }

  hoveringMirror = isMirrorCell(state, col, row);
  canvas.style.cursor = hoveringMirror ? "grab" : "default";
});

canvas.addEventListener("pointerup", (e) => {
  if (dragging) {
    moveMirror(state, dragSnapCell.col, dragSnapCell.row);
  } else if (pointerDownCell) {
    const p = eventToCanvasPoint(e);
    const { col, row } = pixelToCell(p.x, p.y);
    if (isMirrorCell(state, col, row)) {
      rotateMirror(state);
    }
  }

  pointerDownCell = null;
  dragging = false;
  dragPos = null;
  dragSnapCell = null;
  canvas.style.cursor = "default";
});

canvas.addEventListener("pointercancel", () => {
  pointerDownCell = null;
  dragging = false;
  dragPos = null;
  dragSnapCell = null;
  canvas.style.cursor = "default";
});

// ---------- Drawing ----------
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCells() {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const r = cellRect(col, row);
      roundRect(r.x, r.y, r.w, r.h, 4);
      ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.09)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function drawSource(time) {
  const c = cellCenter(state.source.col, state.source.row);
  const pulse = 1 + 0.06 * Math.sin(time / 260);
  const radius = 9 * pulse;
  const color = LIGHT[state.source.color];

  const glow = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, radius * 2.2);
  glow.addColorStop(0, `rgba(${color.glow}, 0.55)`);
  glow.addColorStop(1, `rgba(${color.glow}, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(c.x, c.y, radius * 2.2, 0, Math.PI * 2);
  ctx.fill();

  const grad = ctx.createLinearGradient(c.x - radius, c.y - radius, c.x + radius, c.y + radius);
  grad.addColorStop(0, color.core);
  grad.addColorStop(1, color.mid);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawMirrorGlyph(len) {
  const grad = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
  grad.addColorStop(0, "#7c8994");
  grad.addColorStop(0.5, "#eef3f6");
  grad.addColorStop(1, "#55606b");

  ctx.strokeStyle = grad;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0);
  ctx.lineTo(len / 2, 0);
  ctx.stroke();
}

function drawSnapTarget() {
  if (!dragging || !dragSnapCell) return;
  const r = cellRect(dragSnapCell.col, dragSnapCell.row);
  const valid = canPlaceMirror(state, dragSnapCell.col, dragSnapCell.row);

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = valid ? "rgba(255, 255, 255, 0.6)" : "rgba(255, 90, 90, 0.7)";
  ctx.lineWidth = 2;
  roundRect(r.x, r.y, r.w, r.h, 4);
  ctx.stroke();
  ctx.restore();
}

function drawMirror() {
  const len = CELL * 0.62;

  if (dragging) {
    // faint ghost marking the mirror's position until it's dropped
    const orig = cellCenter(state.mirror.col, state.mirror.row);
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.translate(orig.x, orig.y);
    ctx.rotate(mirrorAngle);
    drawMirrorGlyph(len);
    ctx.restore();
  } else if (hoveringMirror) {
    const c = cellCenter(state.mirror.col, state.mirror.row);
    const glow = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, CELL * 0.5);
    glow.addColorStop(0, "rgba(255, 255, 255, 0.14)");
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c.x, c.y, CELL * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const c = dragging ? dragPos : cellCenter(state.mirror.col, state.mirror.row);

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(mirrorAngle);
  if (dragging) ctx.scale(1.15, 1.15);
  drawMirrorGlyph(len);
  ctx.restore();
}

function drawTarget(time, hit) {
  const c = cellCenter(state.target.col, state.target.row);
  const baseRadius = 8;
  const color = LIGHT[state.source.color];

  if (hit) {
    const pulse = 1 + 0.12 * Math.sin(time / 200);
    const glow = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, baseRadius * 2.4);
    glow.addColorStop(0, `rgba(${color.glow}, 0.6)`);
    glow.addColorStop(1, `rgba(${color.glow}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c.x, c.y, baseRadius * 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color.mid;
    ctx.beginPath();
    ctx.arc(c.x, c.y, baseRadius * pulse, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = `rgba(${color.glow}, 0.12)`;
    ctx.beginPath();
    ctx.arc(c.x, c.y, baseRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(${color.glow}, 0.55)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, baseRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (ripple) {
    const age = time - ripple.start;
    const duration = 600;
    if (age < duration) {
      const t = age / duration;
      ctx.strokeStyle = `rgba(${color.glow}, ${1 - t})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, baseRadius + t * 14, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ripple = null;
    }
  }
}

function drawBeam(points, time) {
  const flicker = 0.85 + 0.15 * Math.sin(time / 90);
  const color = LIGHT[state.source.color];

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // outer glow
  ctx.strokeStyle = `rgba(${color.glow}, ${0.35 * flicker})`;
  ctx.lineWidth = 6;
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();

  // core beam
  ctx.strokeStyle = `rgba(${color.glow}, ${0.95 * flicker})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();

  ctx.restore();
}

// ---------- Animation loop ----------
function tick(time) {
  if (state.mirror.orientation !== lastOrientation) {
    lastOrientation = state.mirror.orientation;
    const base = orientationAngle(state.mirror.orientation);
    const delta = base - (mirrorTargetAngle % (Math.PI * 2));
    mirrorTargetAngle += delta;
  }
  mirrorAngle += (mirrorTargetAngle - mirrorAngle) * 0.22;

  const beam = computeBeam(state);
  const points = beam.cells.map((c) => cellCenter(c.col, c.row));

  if (beam.hit && !wasHit) {
    ripple = { start: time };
  }
  wasHit = beam.hit;

  ctx.clearRect(0, 0, cssWidth, cssHeight);
  drawCells();
  drawSnapTarget();
  drawBeam(points, time);
  drawSource(time);
  drawMirror();
  drawTarget(time, beam.hit);

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
