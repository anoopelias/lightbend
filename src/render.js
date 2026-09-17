import { COLS, ROWS, GameState } from "./game_state.js";
import { Board } from "./board.js";
import { drawCells, drawSnapTarget, drawSource, drawMirror, drawSplitter, drawTarget, drawBeam } from "./draw.js";
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
// each step's 45-degree share of the full turn to line the two up. The
// splitter's step is the line itself (not a face normal, since it's
// two-sided), and its glyph is a plain horizontal line, so step 0 needs no
// such offset.
const MIRROR_BASE_ANGLE = Math.PI / 2;
const SPLITTER_BASE_ANGLE = 0;

function createToolView(tool) {
  const base = tool.kind === "splitter" ? SPLITTER_BASE_ANGLE : MIRROR_BASE_ANGLE;
  return {
    angle: base,
    targetAngle: base,
    lastStep: 0,
    hovering: false,
    dragging: false,
    dragPos: null, // pixel position the tool is being dragged to
    dragSnapCell: null, // grid cell the drag would snap to on release
  };
}

function createTargetView() {
  return { ripple: null }; // { start: timestamp }
}

// ---------- Transient visual state (not game state), parallel to
// state.tools / state.targets ----------
let toolViews = state.tools.map(createToolView);
let targetViews = state.targets.map(createTargetView);
let wasHitTargets = new Set();

const dragController = new DragController({ board, state, views: toolViews });

nextLevelBtn.addEventListener("click", () => {
  state.nextLevel();
  toolViews = state.tools.map(createToolView);
  targetViews = state.targets.map(createTargetView);
  wasHitTargets = new Set();
  dragController.views = toolViews;
  dragController.syncPalette();
});

// ---------- Animation loop ----------
function tick(time) {
  state.tools.forEach((tool, i) => {
    const view = toolViews[i];
    if (tool.step !== view.lastStep) {
      view.lastStep = tool.step;
      // Always turns clockwise, so the target just keeps climbing -- no
      // shortest-path math, and nothing to fall out of sync mid-turn.
      view.targetAngle += Math.PI / 4;
    }
    view.angle += (view.targetAngle - view.angle) * 0.22;
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

  const draggingView = toolViews.find((v) => v.dragging);
  const snapValid =
    draggingView && draggingView.dragSnapCell
      ? state.canPlaceTool(draggingView.dragSnapCell.col, draggingView.dragSnapCell.row, dragController.activeTool)
      : false;

  board.clear();
  drawCells(board);
  if (draggingView) drawSnapTarget(board, draggingView, snapValid);

  beams.forEach(({ source, segments }) => {
    segments.forEach((cells) => {
      const points = cells.map((c) => board.cellCenter(c.col, c.row));
      drawBeam(board, points, source.color, time);
    });
  });

  state.sources.forEach((source) => drawSource(board, source, time));

  state.tools.forEach((tool, i) => {
    if (!tool.placed) return;
    if (tool.kind === "splitter") drawSplitter(board, tool, toolViews[i]);
    else drawMirror(board, tool, toolViews[i]);
  });

  state.targets.forEach((target, i) => {
    drawTarget(board, target, targetViews[i], time, hitTargets.has(target));
  });

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
