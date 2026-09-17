import { COLS, ROWS, GameState } from "./logic.js";
import { Board } from "./board.js";
import { drawCells, drawSnapTarget, drawSource, drawMirror, drawTarget, drawBeam } from "./draw.js";
import { DragController } from "./input.js";

const state = new GameState();

const board = new Board({
  canvas: document.getElementById("board"),
  cols: COLS,
  rows: ROWS,
  wrapEl: document.querySelector(".wrap"),
  shellEl: document.querySelector(".board-shell"),
});

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

new DragController({ board, state, view });

// ---------- Animation loop ----------
function tick(time) {
  if (state.mirror.step !== view.lastStep) {
    view.lastStep = state.mirror.step;
    // Always turns clockwise, so the target just keeps climbing -- no
    // shortest-path math, and nothing to fall out of sync mid-turn.
    view.mirrorTargetAngle += Math.PI / 2;
  }
  view.mirrorAngle += (view.mirrorTargetAngle - view.mirrorAngle) * 0.22;

  const beam = state.computeBeam();
  const points = beam.cells.map((c) => board.cellCenter(c.col, c.row));

  if (beam.hit && !wasHit) {
    view.ripple = { start: time };
  }
  wasHit = beam.hit;

  const snapValid =
    view.dragging && view.dragSnapCell
      ? state.canPlaceMirror(view.dragSnapCell.col, view.dragSnapCell.row)
      : false;

  board.clear();
  drawCells(board);
  drawSnapTarget(board, view, snapValid);
  drawBeam(board, state, points, time);
  drawSource(board, state, time);
  if (state.mirror.placed) drawMirror(board, state, view);
  drawTarget(board, state, view, time, beam.hit);

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
