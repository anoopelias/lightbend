import { COLS, ROWS, createState, canPlaceMirror, computeBeam } from "./logic.js";
import { drawCells, drawSnapTarget, drawSource, drawMirror, drawTarget, drawBeam } from "./draw.js";
import { initDragAndDrop } from "./input.js";

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

function pixelToCell(x, y) {
  return {
    col: Math.floor((x - PAD) / (CELL + GAP)),
    row: Math.floor((y - PAD) / (CELL + GAP)),
  };
}

// Bundles the canvas context and geometry helpers drawing needs.
const rc = { ctx, cellRect, cellCenter, cell: () => CELL };

// mirror.step 0 renders as "/"; each step is a 90-degree clockwise turn.
const MIRROR_BASE_ANGLE = -Math.PI / 4;

// ---------- Transient visual state (not game state) ----------
const view = {
  mirrorAngle: MIRROR_BASE_ANGLE + state.mirror.step * (Math.PI / 2),
  mirrorTargetAngle: MIRROR_BASE_ANGLE + state.mirror.step * (Math.PI / 2),
  lastStep: state.mirror.step,
  hoveringMirror: false,
  ripple: null, // { start: timestamp }
  dragging: false,
  dragPos: null, // pixel position the mirror is being dragged to
  dragSnapCell: null, // grid cell the drag would snap to on release
};
let wasHit = false;

initDragAndDrop({ canvas, state, view, pixelToCell });

// ---------- Animation loop ----------
function tick(time) {
  if (state.mirror.step !== view.lastStep) {
    view.lastStep = state.mirror.step;
    // Always turns clockwise, so the target just keeps climbing -- no
    // shortest-path math, and nothing to fall out of sync mid-turn.
    view.mirrorTargetAngle += Math.PI / 2;
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
  if (state.mirror.placed) drawMirror(rc, state, view);
  drawTarget(rc, state, view, time, beam.hit);

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
