import { COLS, ROWS, rotateMirror, isMirrorCell, canPlaceMirror, moveMirror } from "./logic.js";

const DRAG_THRESHOLD = 4; // px of movement before a press counts as a drag, not a click

function clampCell(col, row) {
  return {
    col: Math.min(COLS - 1, Math.max(0, col)),
    row: Math.min(ROWS - 1, Math.max(0, row)),
  };
}

// Wires up all pointer interaction for the mirror: click-to-rotate and
// drag-to-move on the grid, plus dragging a fresh mirror in from the
// palette. Mutates `state` (via logic.js) and `view` (render-only state)
// in place; render.js owns drawing them, this owns nothing but input.
export function initDragAndDrop({ canvas, state, view, pixelToCell }) {
  function eventToCanvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function isOverCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  // ---------- Dragging/rotating an already-placed mirror on the grid ----------
  let pointerDownCell = null;
  let pointerDownClient = null;

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
    // Only handle drags this canvas itself started (pointerdown on the placed
    // mirror) -- a palette-to-grid placement drag ending over the canvas
    // would otherwise also bubble into this same listener and race the
    // palette's own.
    if (!pointerDownCell) return;

    if (view.dragging) {
      moveMirror(state, view.dragSnapCell.col, view.dragSnapCell.row);
    } else {
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

  // ---------- Placing the mirror from the palette ----------
  const paletteMirrorSlot = document.getElementById("palette-mirror");

  function updatePaletteVisibility() {
    paletteMirrorSlot.classList.toggle("palette-slot--empty", state.mirror.placed);
  }
  updatePaletteVisibility();

  paletteMirrorSlot.addEventListener("pointerdown", (e) => {
    if (state.mirror.placed) return;
    e.preventDefault();

    const ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    ghost.innerHTML = `
      <svg class="tool-icon" viewBox="0 0 24 24">
        <defs>
          <linearGradient id="mirror-gradient-ghost" x1="4" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#7c8994" />
            <stop offset="0.5" stop-color="#eef3f6" />
            <stop offset="1" stop-color="#55606b" />
          </linearGradient>
        </defs>
        <line x1="3.4" y1="19.4" x2="19.4" y2="3.4" stroke="url(#mirror-gradient-ghost)" stroke-width="1.8" />
        <line x1="4.6" y1="20.6" x2="20.6" y2="4.6" stroke="#0e1014" stroke-width="1.8" />
      </svg>`;
    document.body.appendChild(ghost);
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;

    view.dragging = true;

    function onMove(e) {
      ghost.style.left = `${e.clientX}px`;
      ghost.style.top = `${e.clientY}px`;

      if (isOverCanvas(e.clientX, e.clientY)) {
        const p = eventToCanvasPoint(e);
        const { col, row } = pixelToCell(p.x, p.y);
        view.dragSnapCell = clampCell(col, row);
      } else {
        view.dragSnapCell = null;
      }
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      ghost.remove();

      if (view.dragSnapCell && moveMirror(state, view.dragSnapCell.col, view.dragSnapCell.row)) {
        updatePaletteVisibility();
      }

      view.dragging = false;
      view.dragSnapCell = null;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}
