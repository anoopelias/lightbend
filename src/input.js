import { COLS, ROWS } from "./game_state.js";

const DRAG_THRESHOLD = 4; // px of movement before a press counts as a drag, not a click

const mirrorIconSvg = (gradId) => `
  <svg class="tool-icon" viewBox="0 0 24 24">
    <defs>
      <linearGradient id="${gradId}" x1="4" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#7c8994" />
        <stop offset="0.5" stop-color="#eef3f6" />
        <stop offset="1" stop-color="#55606b" />
      </linearGradient>
    </defs>
    <line x1="3.4" y1="19.4" x2="19.4" y2="3.4" stroke="url(#${gradId})" stroke-width="1.8" />
    <line x1="4.6" y1="20.6" x2="20.6" y2="4.6" stroke="#0e1014" stroke-width="1.8" />
  </svg>`;

function clampCell(col, row) {
  return {
    col: Math.min(COLS - 1, Math.max(0, col)),
    row: Math.min(ROWS - 1, Math.max(0, row)),
  };
}

// Wires up pointer interaction for every mirror in state.mirrors: click-to-
// rotate and drag-to-move on the grid, plus dragging a fresh one in from the
// palette. `views` is an array parallel to state.mirrors holding each
// mirror's transient (render-only) state -- reassign it (then call
// syncPalette()) after loading a new level. Mutates state (via game_state.js) and
// views in place; render.js owns drawing them, this owns nothing but input.
export class DragController {
  constructor({ board, state, views }) {
    this.canvas = board.canvas;
    this.pixelToCell = board.pixelToCell;
    this.state = state;
    this.views = views;
    this.paletteSlots = Array.from(document.querySelectorAll(".palette-slot"));

    this.pointerDownCell = null;
    this.pointerDownClient = null;
    this.activeMirror = null; // the mirror a canvas drag/click is acting on

    this.canvas.addEventListener("pointerdown", this.onGridPointerDown);
    this.canvas.addEventListener("pointermove", this.onGridPointerMove);
    this.canvas.addEventListener("pointerup", this.onGridPointerUp);
    this.canvas.addEventListener("pointercancel", this.onGridPointerCancel);

    this.syncPalette();
  }

  eventToCanvasPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  isOverCanvas(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  viewFor(mirror) {
    return this.views[this.state.mirrors.indexOf(mirror)];
  }

  // Populates palette slots for the level's unplaced mirrors, one each, and
  // clears the rest. Call after construction, after loading a new level, and
  // after any successful placement (so that mirror's slot empties out).
  syncPalette() {
    let i = 0;
    for (const mirror of this.state.mirrors) {
      if (mirror.placed) continue;
      const slot = this.paletteSlots[i++];
      if (!slot) break; // more unplaced mirrors than palette slots -- shouldn't happen
      slot.classList.remove("palette-slot--empty");
      slot.classList.add("palette-slot--filled");
      slot.title = "Mirror";
      slot.innerHTML = mirrorIconSvg(`mirror-gradient-${i}`);
      slot.onpointerdown = (e) => this.onPalettePointerDown(e, mirror);
    }
    for (; i < this.paletteSlots.length; i++) {
      const slot = this.paletteSlots[i];
      slot.classList.remove("palette-slot--filled");
      slot.classList.add("palette-slot--empty");
      slot.title = "";
      slot.innerHTML = "";
      slot.onpointerdown = null;
    }
  }

  resetGridDrag(view) {
    this.pointerDownCell = null;
    this.activeMirror = null;
    view.dragging = false;
    view.dragPos = null;
    view.dragSnapCell = null;
    this.canvas.style.cursor = "default";
  }

  // ---------- Dragging/rotating an already-placed mirror on the grid ----------

  onGridPointerDown = (e) => {
    const p = this.eventToCanvasPoint(e);
    const { col, row } = this.pixelToCell(p.x, p.y);
    const mirror = this.state.mirrorAt(col, row);
    if (!mirror) return;

    this.activeMirror = mirror;
    this.pointerDownCell = { col, row };
    this.pointerDownClient = { x: e.clientX, y: e.clientY };
    this.canvas.setPointerCapture(e.pointerId);
  };

  onGridPointerMove = (e) => {
    const p = this.eventToCanvasPoint(e);
    const { col, row } = this.pixelToCell(p.x, p.y);

    if (this.activeMirror) {
      const view = this.viewFor(this.activeMirror);
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
    }

    const hovered = this.state.mirrorAt(col, row);
    for (const m of this.state.mirrors) this.viewFor(m).hoveringMirror = m === hovered;
    this.canvas.style.cursor = hovered ? "grab" : "default";
  };

  onGridPointerUp = (e) => {
    // Only handle drags this canvas itself started (pointerdown on a placed
    // mirror) -- a palette-to-grid placement drag ending over the canvas
    // would otherwise also bubble into this same listener and race the
    // palette's own.
    if (!this.activeMirror) return;
    const mirror = this.activeMirror;
    const view = this.viewFor(mirror);

    if (view.dragging) {
      this.state.moveMirror(mirror, view.dragSnapCell.col, view.dragSnapCell.row);
    } else {
      const p = this.eventToCanvasPoint(e);
      const { col, row } = this.pixelToCell(p.x, p.y);
      if (mirror.isAt(col, row)) {
        mirror.rotate();
      }
    }

    this.resetGridDrag(view);
  };

  onGridPointerCancel = () => {
    if (!this.activeMirror) return;
    this.resetGridDrag(this.viewFor(this.activeMirror));
  };

  // ---------- Placing a mirror from the palette ----------

  onPalettePointerDown = (e, mirror) => {
    if (mirror.placed) return;
    e.preventDefault();

    const view = this.viewFor(mirror);

    // It's "in hand" now (the ghost below shows it) -- empty its slot right
    // away instead of leaving it sitting in the palette until it's dropped.
    const slot = e.currentTarget;
    slot.classList.remove("palette-slot--filled");
    slot.classList.add("palette-slot--empty");
    slot.title = "";
    slot.innerHTML = "";
    slot.onpointerdown = null;

    const ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    ghost.innerHTML = mirrorIconSvg("mirror-gradient-ghost");
    document.body.appendChild(ghost);
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;

    view.dragging = true;

    const onMove = (e) => {
      ghost.style.left = `${e.clientX}px`;
      ghost.style.top = `${e.clientY}px`;

      if (this.isOverCanvas(e.clientX, e.clientY)) {
        const p = this.eventToCanvasPoint(e);
        const { col, row } = this.pixelToCell(p.x, p.y);
        view.dragSnapCell = clampCell(col, row);
      } else {
        view.dragSnapCell = null;
      }
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      ghost.remove();

      if (view.dragSnapCell) {
        this.state.moveMirror(mirror, view.dragSnapCell.col, view.dragSnapCell.row);
      }
      // Resync regardless: on success this leaves the slot empty (already
      // cleared above); on a failed or abandoned drop it puts the mirror
      // back since it's still unplaced.
      this.syncPalette();

      view.dragging = false;
      view.dragSnapCell = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
}
