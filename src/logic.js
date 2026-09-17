// ---------- Game logic (grid-space, no pixels, no drawing) ----------

export const COLS = 15;
export const ROWS = 15;

export const DIRS = {
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

// '/' reflection map and '\' reflection map
const REFLECT = {
  slash: { right: "up", left: "down", up: "right", down: "left" },
  backslash: { right: "down", left: "up", up: "left", down: "right" },
};

export function createState() {
  return {
    source: { col: 0, row: 7, dir: "right", color: "green" },
    mirror: { col: null, row: null, orientation: "slash", placed: false },
    target: { col: 7, row: 14 },
  };
}

export function rotateMirror(state) {
  state.mirror.orientation = state.mirror.orientation === "slash" ? "backslash" : "slash";
}

export function isMirrorCell(state, col, row) {
  return state.mirror.placed && col === state.mirror.col && row === state.mirror.row;
}

export function canPlaceMirror(state, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
  if (col === state.source.col && row === state.source.row) return false;
  if (col === state.target.col && row === state.target.row) return false;
  return true;
}

// Places the mirror on the grid (from the palette, or repositions it if
// already placed).
export function moveMirror(state, col, row) {
  if (!canPlaceMirror(state, col, row)) return false;
  state.mirror.col = col;
  state.mirror.row = row;
  state.mirror.placed = true;
  return true;
}

// Traces the beam from the source through mirrors until it exits the grid or
// lands on the target. Returns grid-space cells (col/row, not pixels) and
// whether the target was hit.
export function computeBeam(state) {
  const cells = [{ col: state.source.col, row: state.source.row }];
  let col = state.source.col;
  let row = state.source.row;
  let dir = state.source.dir;
  let hit = false;

  for (let steps = 0; steps < COLS * ROWS + 2; steps++) {
    const d = DIRS[dir];
    col += d.x;
    row += d.y;

    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) {
      cells.push({ col, row });
      break;
    }

    if (isMirrorCell(state, col, row)) {
      cells.push({ col, row });
      dir = REFLECT[state.mirror.orientation][dir];
      continue;
    }

    if (col === state.target.col && row === state.target.row) {
      cells.push({ col, row });
      hit = true;
      break;
    }
  }

  return { cells, hit };
}
