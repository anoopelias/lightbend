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
import { drawCells, drawSnapTarget, drawSource, drawMirror, drawTarget, drawBeam } from "./draw.js";

// ---------- Board geometry (pixel-space) ----------
const MAX_CELL = 40;
const MIN_CELL = 10;
const GAP = 6;
const PAD = 10;
let CELL = MAX_CELL;

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

// Bundles the canvas context and geometry helpers drawing needs.
const rc = { ctx, cellRect, cellCenter, cell: () => CELL };

function orientationAngle(orientation) {
  return orientation === "slash" ? -Math.PI / 4 : Math.PI / 4;
}

// ---------- Transient visual state (not game state) ----------
const view = {
  mirrorAngle: orientationAngle(state.mirror.orientation),
  mirrorTargetAngle: orientationAngle(state.mirror.orientation),
  lastOrientation: state.mirror.orientation,
  hoveringMirror: false,
  ripple: null, // { start: timestamp }
  dragging: false,
  dragPos: null, // pixel position the mirror is being dragged to
  dragSnapCell: null, // grid cell the drag would snap to on release
};
let wasHit = false;

// Drag-to-move state
const DRAG_THRESHOLD = 4; // px of movement before a press counts as a drag, not a click
let pointerDownCell = null;
let pointerDownClient = null;

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

  if (pointerDownCell && !view.dragging) {
    const dx = e.clientX - pointerDownClient.x;
    const dy = e.clientY - pointerDownClient.y;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      view.dragging = true;
    }
  }

  if (view.dragging) {
    view.dragPos = p;
    view.dragSnapCell = clampCell(col, row);
    canvas.style.cursor = "grabbing";
    return;
  }

  view.hoveringMirror = isMirrorCell(state, col, row);
  canvas.style.cursor = view.hoveringMirror ? "grab" : "default";
});

canvas.addEventListener("pointerup", (e) => {
  if (view.dragging) {
    moveMirror(state, view.dragSnapCell.col, view.dragSnapCell.row);
  } else if (pointerDownCell) {
    const p = eventToCanvasPoint(e);
    const { col, row } = pixelToCell(p.x, p.y);
    if (isMirrorCell(state, col, row)) {
      rotateMirror(state);
    }
  }

  pointerDownCell = null;
  view.dragging = false;
  view.dragPos = null;
  view.dragSnapCell = null;
  canvas.style.cursor = "default";
});

canvas.addEventListener("pointercancel", () => {
  pointerDownCell = null;
  view.dragging = false;
  view.dragPos = null;
  view.dragSnapCell = null;
  canvas.style.cursor = "default";
});

// ---------- Animation loop ----------
function tick(time) {
  if (state.mirror.orientation !== view.lastOrientation) {
    view.lastOrientation = state.mirror.orientation;
    const base = orientationAngle(state.mirror.orientation);
    const delta = base - (view.mirrorTargetAngle % (Math.PI * 2));
    view.mirrorTargetAngle += delta;
  }
  view.mirrorAngle += (view.mirrorTargetAngle - view.mirrorAngle) * 0.22;

  const beam = computeBeam(state);
  const points = beam.cells.map((c) => cellCenter(c.col, c.row));

  if (beam.hit && !wasHit) {
    view.ripple = { start: time };
  }
  wasHit = beam.hit;

  const snapValid =
    view.dragging && view.dragSnapCell
      ? canPlaceMirror(state, view.dragSnapCell.col, view.dragSnapCell.row)
      : false;

  ctx.clearRect(0, 0, cssWidth, cssHeight);
  drawCells(rc);
  drawSnapTarget(rc, view, snapValid);
  drawBeam(rc, state, points, time);
  drawSource(rc, state, time);
  drawMirror(rc, state, view);
  drawTarget(rc, state, view, time, beam.hit);

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
