import { COLS, ROWS, GameState } from "./state/game_state.js";
import { computeBeamEdges } from "./beam_edges.js";
import { Board } from "./board.js";
import {
  drawCells,
  drawBlocker,
  drawConduit,
  drawSnapTarget,
  drawSource,
  drawMirror,
  drawSplitter,
  drawBender,
  drawTarget,
  drawBeam,
} from "./draw.js";
import { DragController } from "./input.js";
import { ViewState } from "./view_state.js";
import { setupThemeToggle } from "./theme_toggle.js";
import { createLevelNav } from "./level_nav.js";

const state = new GameState();

const board = new Board({
  canvas: document.getElementById("board"),
  cols: COLS,
  rows: ROWS,
  wrapEl: document.querySelector(".wrap"),
  shellEl: document.querySelector(".board-shell"),
});

const view = new ViewState(state);
const dragController = new DragController({ board, state, views: view.toolViews });

// Keeps each palette slot (and the icon drawn inside it) the same pixel
// size as a single grid cell, so the palette reads as "cut from the same
// grid" at any viewport size instead of using its own fixed size (which
// looked oversized next to a shrunk mobile board, or mismatched next to a
// shrunk desktop one). Board's own resize listener (registered first, in
// its constructor above) updates board.cellSize before this fires.
window.addEventListener("resize", () => dragController.resizeSlots());
window.addEventListener("orientationchange", () => dragController.resizeSlots());

setupThemeToggle(document.getElementById("theme-toggle"), () => dragController.syncPalette());
const levelNav = createLevelNav({ state, view, dragController });

// ---------- Animation loop ----------
function tick(time) {
  view.updateToolAngles(state.tools);

  const { beams, hitTargets } = state.computeBeams();
  view.updateRipples(state.targets, hitTargets, time);
  levelNav.updateForFrame(hitTargets);

  const draggingView = view.draggingToolView;
  const snapValid =
    draggingView && draggingView.dragSnapCell
      ? state.canPlaceTool(draggingView.dragSnapCell.col, draggingView.dragSnapCell.row, dragController.activeTool)
      : false;

  board.clear();
  drawCells(board);
  state.blockers.forEach((blocker) => drawBlocker(board, blocker));
  state.conduits.forEach((conduit) => drawConduit(board, conduit));
  if (draggingView) drawSnapTarget(board, draggingView, snapValid);

  computeBeamEdges(beams).forEach(({ from, to, color }) => {
    let fromPt = board.cellCenter(from.col, from.row);
    let toPt = board.cellCenter(to.col, to.row);
    // A blocker's platform fills its whole cell, so the beam should stop at
    // its near edge instead of visually boring into the middle. Runs are
    // normalized (for merging same-color edges) to always point from the
    // lower column/row toward the higher one, regardless of which way the
    // beam actually travelled -- so the blocked cell can end up labelled
    // either `to` (travelling up/right into it) or `from` (down/left), and
    // both need checking, with the shift direction flipped for `from`.
    const dx = Math.sign(to.col - from.col);
    const dy = Math.sign(to.row - from.row);
    if (state.blockers.some((b) => b.col === to.col && b.row === to.row)) {
      toPt = { x: toPt.x - (dx * board.cellSize) / 2, y: toPt.y - (dy * board.cellSize) / 2 };
    }
    if (state.blockers.some((b) => b.col === from.col && b.row === from.row)) {
      fromPt = { x: fromPt.x + (dx * board.cellSize) / 2, y: fromPt.y + (dy * board.cellSize) / 2 };
    }
    drawBeam(board, [fromPt, toPt], color, time);
  });

  state.sources.forEach((source) => drawSource(board, source, time));

  state.tools.forEach((tool, i) => {
    if (!tool.placed) return;
    if (tool.kind === "splitter") drawSplitter(board, tool, view.toolViews[i]);
    else if (tool.kind === "bender") drawBender(board, tool, view.toolViews[i]);
    else drawMirror(board, tool, view.toolViews[i]);
  });

  state.targets.forEach((target, i) => {
    drawTarget(board, target, view.targetViews[i], time, hitTargets.has(target));
  });

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
