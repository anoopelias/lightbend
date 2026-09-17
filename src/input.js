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

// Drawn as a single even stroke (no two-tone shading) since the splitter is
// two-sided -- there's no "back" the way there is for the mirror.
const splitterIconSvg = (gradId) => `
  <svg class="tool-icon" viewBox="0 0 24 24">
    <defs>
      <linearGradient id="${gradId}" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#bfe9ff" />
        <stop offset="0.5" stop-color="#f0fbff" />
        <stop offset="1" stop-color="#7fc4e8" />
      </linearGradient>
    </defs>
    <line x1="12" y1="2.5" x2="12" y2="21.5" stroke="url(#${gradId})" stroke-width="2.2" />
  </svg>`;

const toolIconSvg = (tool, gradId) => (tool.kind === "splitter" ? splitterIconSvg(gradId) : mirrorIconSvg(gradId));

function clampCell(col, row) {
  return {
    col: Math.min(COLS - 1, Math.max(0, col)),
    row: Math.min(ROWS - 1, Math.max(0, row)),
  };
}

// Wires up pointer interaction for every tool (mirror or splitter) in
// state.tools: click-to-rotate and drag-to-move on the grid, plus dragging a
// fresh one in from the palette. `views` is an array parallel to state.tools
// holding each tool's transient (render-only) state -- reassign it (then
// call syncPalette()) after loading a new level. Mutates state (via
// game_state.js) and views in place; render.js owns drawing them, this owns
// nothing but input.
export class DragController {
  constructor({ board, state, views }) {
    this.canvas = board.canvas;
    this.pixelToCell = board.pixelToCell;
    this.state = state;
    this.views = views;
    this.paletteSlots = Array.from(document.querySelectorAll(".palette-slot"));

    this.pointerDownCell = null;
    this.pointerDownClient = null;
    this.activeTool = null; // the tool a canvas drag/click is acting on

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

  viewFor(tool) {
    return this.views[this.state.tools.indexOf(tool)];
  }

  // Populates palette slots for the level's unplaced tools, one each, and
  // clears the rest. Call after construction, after loading a new level, and
  // after any successful placement (so that tool's slot empties out).
  syncPalette() {
    let i = 0;
    for (const tool of this.state.tools) {
      if (tool.placed) continue;
      const slot = this.paletteSlots[i++];
      if (!slot) break; // more unplaced tools than palette slots -- shouldn't happen
      slot.classList.remove("palette-slot--empty");
      slot.classList.add("palette-slot--filled");
      slot.title = tool.kind === "splitter" ? "Splitter" : "Mirror";
      slot.innerHTML = toolIconSvg(tool, `tool-gradient-${i}`);
      slot.onpointerdown = (e) => this.onPalettePointerDown(e, tool);
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
    this.activeTool = null;
    view.dragging = false;
    view.dragPos = null;
    view.dragSnapCell = null;
    this.canvas.style.cursor = "default";
  }

  // ---------- Dragging/rotating an already-placed tool on the grid ----------

  onGridPointerDown = (e) => {
    const p = this.eventToCanvasPoint(e);
    const { col, row } = this.pixelToCell(p.x, p.y);
    const tool = this.state.toolAt(col, row);
    if (!tool) return;

    this.activeTool = tool;
    this.pointerDownCell = { col, row };
    this.pointerDownClient = { x: e.clientX, y: e.clientY };
    this.canvas.setPointerCapture(e.pointerId);
  };

  onGridPointerMove = (e) => {
    const p = this.eventToCanvasPoint(e);
    const { col, row } = this.pixelToCell(p.x, p.y);

    if (this.activeTool) {
      const view = this.viewFor(this.activeTool);
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

    const hovered = this.state.toolAt(col, row);
    for (const t of this.state.tools) this.viewFor(t).hovering = t === hovered;
    this.canvas.style.cursor = hovered ? "grab" : "default";
  };

  onGridPointerUp = (e) => {
    // Only handle drags this canvas itself started (pointerdown on a placed
    // tool) -- a palette-to-grid placement drag ending over the canvas would
    // otherwise also bubble into this same listener and race the palette's
    // own.
    if (!this.activeTool) return;
    const tool = this.activeTool;
    const view = this.viewFor(tool);

    if (view.dragging) {
      this.state.moveTool(tool, view.dragSnapCell.col, view.dragSnapCell.row);
    } else {
      const p = this.eventToCanvasPoint(e);
      const { col, row } = this.pixelToCell(p.x, p.y);
      if (tool.isAt(col, row)) {
        tool.rotate();
      }
    }

    this.resetGridDrag(view);
  };

  onGridPointerCancel = () => {
    if (!this.activeTool) return;
    this.resetGridDrag(this.viewFor(this.activeTool));
  };

  // ---------- Placing a tool from the palette ----------

  onPalettePointerDown = (e, tool) => {
    if (tool.placed) return;
    e.preventDefault();

    const view = this.viewFor(tool);

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
    ghost.innerHTML = toolIconSvg(tool, "tool-gradient-ghost");
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
        this.state.moveTool(tool, view.dragSnapCell.col, view.dragSnapCell.row);
      }
      // Resync regardless: on success this leaves the slot empty (already
      // cleared above); on a failed or abandoned drop it puts the tool back
      // since it's still unplaced.
      this.syncPalette();

      view.dragging = false;
      view.dragSnapCell = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
}
