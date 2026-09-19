import { COLS, ROWS, GameState } from "./game_state.js";
import { Board } from "./board.js";
import { drawCells, drawSnapTarget, drawSource, drawMirror, drawSplitter, drawTarget, drawBeam } from "./draw.js";
import { DragController } from "./input.js";
import { ViewState } from "./view_state.js";

const state = new GameState();

const board = new Board({
  canvas: document.getElementById("board"),
  cols: COLS,
  rows: ROWS,
  wrapEl: document.querySelector(".wrap"),
  shellEl: document.querySelector(".board-shell"),
});

const nextLevelBtn = document.getElementById("next-level");
const prevLevelBtn = document.getElementById("prev-level");
const levelSelect = document.getElementById("level-select");
const paletteSlotEls = Array.from(document.querySelectorAll(".palette-slot"));

// Keeps each palette slot the same pixel size as a single grid cell, so the
// palette reads as "cut from the same grid" at any viewport size instead of
// using its own fixed size (which looked oversized next to a shrunk mobile
// board, or mismatched next to a shrunk desktop one).
function syncPaletteSlotSize() {
  const size = `${board.cellSize}px`;
  for (const slot of paletteSlotEls) {
    slot.style.width = size;
    slot.style.height = size;
  }
}

syncPaletteSlotSize();
window.addEventListener("resize", syncPaletteSlotSize);
window.addEventListener("orientationchange", syncPaletteSlotSize);

const view = new ViewState(state);
const dragController = new DragController({ board, state, views: view.toolViews });

// Rebuilds the dropdown's options -- only levels reached so far are
// selectable -- and syncs its value to the current level.
function syncLevelSelect() {
  levelSelect.innerHTML = "";
  for (let i = 0; i < state.levelCount; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = `Level ${i + 1}`;
    option.disabled = i > state.maxLevelReached;
    levelSelect.appendChild(option);
  }
  levelSelect.value = state.levelIndex;
}

function afterLevelChange() {
  view.loadLevel(state);
  dragController.views = view.toolViews;
  dragController.syncPalette();
  syncLevelSelect();
}

nextLevelBtn.addEventListener("click", () => {
  state.nextLevel();
  afterLevelChange();
});

prevLevelBtn.addEventListener("click", () => {
  state.prevLevel();
  afterLevelChange();
});

levelSelect.addEventListener("change", () => {
  state.goToLevel(Number(levelSelect.value));
  afterLevelChange();
});

syncLevelSelect();
let wasSolved = false;

// ---------- Animation loop ----------
function tick(time) {
  view.updateToolAngles(state.tools);

  const { beams, hitTargets } = state.computeBeams();
  view.updateRipples(state.targets, hitTargets, time);

  const solved = state.targets.length > 0 && state.targets.every((t) => hitTargets.has(t));
  if (solved && !wasSolved && state.hasNextLevel) {
    state.reachLevel(state.levelIndex + 1);
    syncLevelSelect();
  }
  wasSolved = solved;

  const allComplete = solved && !state.hasNextLevel;
  nextLevelBtn.disabled = !(solved && state.hasNextLevel);
  nextLevelBtn.textContent = allComplete ? "✓" : "→";
  nextLevelBtn.title = allComplete ? "All levels complete" : "Next level";
  nextLevelBtn.classList.toggle("next-level-btn--complete", allComplete);
  prevLevelBtn.disabled = !state.hasPrevLevel;

  const draggingView = view.draggingToolView;
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
    if (tool.kind === "splitter") drawSplitter(board, tool, view.toolViews[i]);
    else drawMirror(board, tool, view.toolViews[i]);
  });

  state.targets.forEach((target, i) => {
    drawTarget(board, target, view.targetViews[i], time, hitTargets.has(target));
  });

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
