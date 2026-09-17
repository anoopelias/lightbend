import { COLS, ROWS } from "./logic.js";

const DRAG_THRESHOLD = 4; // px of movement before a press counts as a drag, not a click

function clampCell(col, row) {
  return {
    col: Math.min(COLS - 1, Math.max(0, col)),
    row: Math.min(ROWS - 1, Math.max(0, row)),
  };
}

// Wires up all pointer interaction for the mirror: click-to-rotate and
// drag-to-move on the grid, plus dragging a fresh mirror in from the
// palette. Mutates `state` (via logic.js) and `view` (render-only state) in
// place; render.js owns drawing them, this owns nothing but input.
export class DragController {
  constructor({ canvas, state, view, pixelToCell }) {
    this.canvas = canvas;
    this.state = state;
    this.view = view;
    this.pixelToCell = pixelToCell;
    this.paletteMirrorSlot = document.getElementById("palette-mirror");

    this.pointerDownCell = null;
    this.pointerDownClient = null;

    canvas.addEventListener("pointerdown", this.onGridPointerDown);
    canvas.addEventListener("pointermove", this.onGridPointerMove);
    canvas.addEventListener("pointerup", this.onGridPointerUp);
    canvas.addEventListener("pointercancel", this.onGridPointerCancel);
    this.paletteMirrorSlot.addEventListener("pointerdown", this.onPalettePointerDown);

    this.updatePaletteVisibility();
  }

  eventToCanvasPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  isOverCanvas(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  updatePaletteVisibility() {
    this.paletteMirrorSlot.classList.toggle("palette-slot--empty", this.state.mirror.placed);
  }

  resetGridDrag() {
    this.pointerDownCell = null;
    this.view.dragging = false;
    this.view.dragPos = null;
    this.view.dragSnapCell = null;
    this.canvas.style.cursor = "default";
  }

  // ---------- Dragging/rotating an already-placed mirror on the grid ----------

  onGridPointerDown = (e) => {
    const p = this.eventToCanvasPoint(e);
    const { col, row } = this.pixelToCell(p.x, p.y);
    if (!this.state.mirror.isAt(col, row)) return;

    this.pointerDownCell = { col, row };
    this.pointerDownClient = { x: e.clientX, y: e.clientY };
    this.canvas.setPointerCapture(e.pointerId);
  };

  onGridPointerMove = (e) => {
    const view = this.view;
    const p = this.eventToCanvasPoint(e);
    const { col, row } = this.pixelToCell(p.x, p.y);

    if (this.pointerDownCell && !view.dragging) {
      const dx = e.clientX - this.pointerDownClient.x;
      const dy = e.clientY - this.pointerDownClient.y;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        view.dragging = true;
      }
    }

    if (view.dragging) {
      view.dragPos = p;
      view.dragSnapCell = clampCell(col, row);
      this.canvas.style.cursor = "grabbing";
      return;
    }

    view.hoveringMirror = this.state.mirror.isAt(col, row);
    this.canvas.style.cursor = view.hoveringMirror ? "grab" : "default";
  };

  onGridPointerUp = (e) => {
    // Only handle drags this canvas itself started (pointerdown on the placed
    // mirror) -- a palette-to-grid placement drag ending over the canvas
    // would otherwise also bubble into this same listener and race the
    // palette's own.
    if (!this.pointerDownCell) return;

    if (this.view.dragging) {
      this.state.moveMirror(this.view.dragSnapCell.col, this.view.dragSnapCell.row);
    } else {
      const p = this.eventToCanvasPoint(e);
      const { col, row } = this.pixelToCell(p.x, p.y);
      if (this.state.mirror.isAt(col, row)) {
        this.state.mirror.rotate();
      }
    }

    this.resetGridDrag();
  };

  onGridPointerCancel = () => {
    this.resetGridDrag();
  };

  // ---------- Placing the mirror from the palette ----------

  onPalettePointerDown = (e) => {
    if (this.state.mirror.placed) return;
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

    this.view.dragging = true;

    const onMove = (e) => {
      ghost.style.left = `${e.clientX}px`;
      ghost.style.top = `${e.clientY}px`;

      if (this.isOverCanvas(e.clientX, e.clientY)) {
        const p = this.eventToCanvasPoint(e);
        const { col, row } = this.pixelToCell(p.x, p.y);
        this.view.dragSnapCell = clampCell(col, row);
      } else {
        this.view.dragSnapCell = null;
      }
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      ghost.remove();

      if (this.view.dragSnapCell && this.state.moveMirror(this.view.dragSnapCell.col, this.view.dragSnapCell.row)) {
        this.updatePaletteVisibility();
      }

      this.view.dragging = false;
      this.view.dragSnapCell = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
}
