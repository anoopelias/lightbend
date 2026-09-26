import { COLS, ROWS } from "./state/game_state.js";
import { drawMirrorGlyph, drawSplitterGlyph, drawBenderGlyph } from "./draw.js";
import { baseAngle } from "./view_state.js";

const DRAG_THRESHOLD = 4; // px of movement before a press counts as a drag, not a click

const GLYPHS = { mirror: drawMirrorGlyph, splitter: drawSplitterGlyph, bender: drawBenderGlyph };

// The palette's footprint stays the same across every level -- sized to
// comfortably fit the largest level's tool count (Level 10 needs 19) --
// rather than growing or shrinking as you move between levels.
const PALETTE_COLUMNS = 5;
const PALETTE_ROWS = 4;

// Renders a tool's palette icon with the exact same glyph function -- and
// the same len = size * 0.62 relationship drawToolBase uses -- that draws
// it on the grid, at step 0's angle (see baseAngle in view_state.js).
// Sharing the drawing code instead of a separately hand-tuned SVG icon per
// tool means the palette can never drift out of sync with what the tool
// actually looks like once placed, the way it once did.
function renderToolIcon(tool, size) {
  const canvas = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  canvas.style.display = "block";

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(size / 2, size / 2);
  ctx.rotate(baseAngle(tool.kind));
  GLYPHS[tool.kind](ctx, size * 0.62);

  return canvas;
}

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
    this.board = board;
    this.canvas = board.canvas;
    this.pixelToCell = board.pixelToCell;
    this.state = state;
    this.views = views;
    this.paletteEl = document.querySelector(".palette");
    this.paletteSlots = [];

    this.pointerDownCell = null;
    this.pointerDownClient = null;
    this.activeTool = null; // the tool a canvas drag/click is acting on

    this.canvas.addEventListener("pointerdown", this.onGridPointerDown);
    this.canvas.addEventListener("pointermove", this.onGridPointerMove);
    this.canvas.addEventListener("pointerup", this.onGridPointerUp);
    this.canvas.addEventListener("pointercancel", this.onGridPointerCancel);

    this.buildPaletteSlots();
    this.syncPalette();
  }

  // Builds the palette's fixed grid once -- see PALETTE_COLUMNS/ROWS above.
  // Slots are sized to the board's cell size right away (not left at the
  // CSS default) since syncPalette, right after this, draws each icon's
  // canvas at the slot's current size -- if that ran before the slot had
  // its real size, the canvas would be baked in too big (the desktop
  // default) and never shrink back down to fit a mobile-sized slot.
  buildPaletteSlots() {
    this.paletteEl.style.setProperty("--palette-columns", PALETTE_COLUMNS);
    this.paletteEl.innerHTML = "";
    const size = `${this.board.cellSize}px`;
    this.paletteSlots = Array.from({ length: PALETTE_COLUMNS * PALETTE_ROWS }, () => {
      const slot = document.createElement("div");
      slot.className = "palette-slot palette-slot--empty";
      slot.style.width = size;
      slot.style.height = size;
      this.paletteEl.appendChild(slot);
      return slot;
    });
  }

  // Re-sizes every slot to the board's current cell size and redraws their
  // icons at that size -- call after the board itself resizes (window
  // resize/orientation change). A slot's icon is a canvas drawn once at a
  // fixed pixel size, so it won't scale on its own when the slot's box does.
  resizeSlots() {
    const size = `${this.board.cellSize}px`;
    for (const slot of this.paletteSlots) {
      slot.style.width = size;
      slot.style.height = size;
    }
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
      slot.title = tool.kind === "splitter" ? "Splitter" : tool.kind === "bender" ? "Bender" : "Mirror";
      slot.innerHTML = "";
      slot.appendChild(renderToolIcon(tool, slot.getBoundingClientRect().width)); // slot is square
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
        this.state.rotateTool(tool);
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
    const slotSize = slot.getBoundingClientRect().width; // slot is square
    slot.classList.remove("palette-slot--filled");
    slot.classList.add("palette-slot--empty");
    slot.title = "";
    slot.innerHTML = "";
    slot.onpointerdown = null;

    const ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    ghost.appendChild(renderToolIcon(tool, slotSize));
    ghost.style.width = `${slotSize}px`;
    ghost.style.height = `${slotSize}px`;
    ghost.style.marginLeft = `${-slotSize / 2}px`;
    ghost.style.marginTop = `${-slotSize / 2}px`;
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
