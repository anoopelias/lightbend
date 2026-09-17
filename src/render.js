import { COLS, ROWS, GameState } from "./game_state.js";
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

const nextLevelBtn = document.getElementById("next-level");

// mirror.step 0's reflective face normal points "right" (see reflect() in
// game_state.js); the glyph itself is drawn as a horizontal line with its
// reflective side facing local "up", so it needs a quarter turn on top of
// each step's 45-degree share of the full turn to line the two up.
const MIRROR_BASE_ANGLE = Math.PI / 2;

function createMirrorView() {
  return {
    mirrorAngle: MIRROR_BASE_ANGLE,
    mirrorTargetAngle: MIRROR_BASE_ANGLE,
    lastStep: 0,
    hoveringMirror: false,
    dragging: false,
    dragPos: null, // pixel position the mirror is being dragged to
    dragSnapCell: null, // grid cell the drag would snap to on release
  };
}

function createTargetView() {
  return { ripple: null }; // { start: timestamp }
}

// ---------- Transient visual state (not game state), parallel to
// state.mirrors / state.targets ----------
let mirrorViews = state.mirrors.map(createMirrorView);
let targetViews = state.targets.map(createTargetView);
let wasHitTargets = new Set();

const dragController = new DragController({ board, state, views: mirrorViews });

nextLevelBtn.addEventListener("click", () => {
  state.nextLevel();
  mirrorViews = state.mirrors.map(createMirrorView);
  targetViews = state.targets.map(createTargetView);
  wasHitTargets = new Set();
  dragController.views = mirrorViews;
  dragController.syncPalette();
});

// ---------- Animation loop ----------
function tick(time) {
  state.mirrors.forEach((mirror, i) => {
    const view = mirrorViews[i];
    if (mirror.step !== view.lastStep) {
      view.lastStep = mirror.step;
      // Always turns clockwise, so the target just keeps climbing -- no
      // shortest-path math, and nothing to fall out of sync mid-turn.
      view.mirrorTargetAngle += Math.PI / 4;
    }
    view.mirrorAngle += (view.mirrorTargetAngle - view.mirrorAngle) * 0.22;
  });

  const { beams, hitTargets } = state.computeBeams();

  state.targets.forEach((target, i) => {
    if (hitTargets.has(target) && !wasHitTargets.has(target)) {
      targetViews[i].ripple = { start: time };
    }
  });
  wasHitTargets = hitTargets;

  const solved = state.targets.length > 0 && state.targets.every((t) => hitTargets.has(t));
  nextLevelBtn.disabled = !(solved && state.hasNextLevel);
  nextLevelBtn.textContent = solved && !state.hasNextLevel ? "All levels complete" : "Next Level →";

  const draggingView = mirrorViews.find((v) => v.dragging);
  const snapValid =
    draggingView && draggingView.dragSnapCell
      ? state.canPlaceMirror(draggingView.dragSnapCell.col, draggingView.dragSnapCell.row, dragController.activeMirror)
      : false;

  board.clear();
  drawCells(board);
  if (draggingView) drawSnapTarget(board, draggingView, snapValid);

  beams.forEach(({ source, cells }) => {
    const points = cells.map((c) => board.cellCenter(c.col, c.row));
    drawBeam(board, points, source.color, time);
  });

  state.sources.forEach((source) => drawSource(board, source, time));

  state.mirrors.forEach((mirror, i) => {
    if (mirror.placed) drawMirror(board, mirror, mirrorViews[i]);
  });

  state.targets.forEach((target, i) => {
    drawTarget(board, target, targetViews[i], time, hitTargets.has(target));
  });

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
