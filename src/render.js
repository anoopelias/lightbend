import { COLS, ROWS, GameState } from "./game_state.js";
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
import { clearProgress } from "./storage.js";
import { getThemeName, toggleTheme } from "./theme.js";

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
const resetBtn = document.getElementById("reset-progress");
const themeToggleBtn = document.getElementById("theme-toggle");
const paletteSlotEls = Array.from(document.querySelectorAll(".palette-slot"));

// Hand-drawn rather than emoji -- an emoji glyph's shape and weight are up
// to whatever font the OS picks, which is exactly what left the crescent
// moon pale and the "new moon" disc unrecognizable as a moon at all.
// `currentColor` ties each icon to the button's own (theme-driven) ink
// color, so contrast is never in question either.
const SUN_ICON = `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="4" />
    <line x1="12" y1="20" x2="12" y2="22" />
    <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
    <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
    <line x1="2" y1="12" x2="4" y2="12" />
    <line x1="20" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
    <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
  </svg>`;

const MOON_ICON = `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>`;

// Shows the theme the button switches *to*, not the current one -- a moon
// invites you into the dark, a sun invites you back out.
function syncThemeToggle() {
  const isDark = getThemeName() === "dark";
  themeToggleBtn.innerHTML = isDark ? SUN_ICON : MOON_ICON;
  themeToggleBtn.title = isDark ? "Switch to light theme" : "Switch to dark theme";
  themeToggleBtn.setAttribute("aria-label", themeToggleBtn.title);
}

themeToggleBtn.addEventListener("click", () => {
  toggleTheme();
  syncThemeToggle();
  dragController.syncPalette(); // palette icons carry theme colors of their own (e.g. splitter glass)
});

syncThemeToggle();

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

resetBtn.addEventListener("click", () => {
  if (window.confirm("Clear saved progress? This resets every level back to blank.")) {
    clearProgress();
    window.location.reload();
  }
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
  state.blockers.forEach((blocker) => drawBlocker(board, blocker));
  state.conduits.forEach((conduit) => drawConduit(board, conduit));
  if (draggingView) drawSnapTarget(board, draggingView, snapValid);

  computeBeamEdges(beams).forEach(({ from, to, color }) => {
    const fromPt = board.cellCenter(from.col, from.row);
    let toPt = board.cellCenter(to.col, to.row);
    if (state.blockers.some((b) => b.col === to.col && b.row === to.row)) {
      // A blocker's platform fills its whole cell, so the beam should stop
      // at its near edge instead of visually boring into the middle.
      const dx = Math.sign(to.col - from.col);
      const dy = Math.sign(to.row - from.row);
      toPt = { x: toPt.x - (dx * board.cellSize) / 2, y: toPt.y - (dy * board.cellSize) / 2 };
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
