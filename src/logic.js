// ---------- Game logic (grid-space, no pixels, no drawing) ----------

export const COLS = 15;
export const ROWS = 15;

export const DIRS = {
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

// The mirror is one-sided: it reflects a beam that hits its mirrored face,
// and blocks (absorbs) a beam that hits its black backing. It has 4 possible
// orientations, each a 90-degree clockwise turn from the last (step 0-3);
// axis-aligned angles aren't valid resting states, so a turn always lands on
// a diagonal. Each entry maps an incoming direction to the outgoing one for
// the beams that hit the mirrored face -- a direction missing from an entry
// hits the black side instead and is blocked.
const ONE_SIDED_REFLECT = [
  { right: "up", down: "left" }, // "/", mirrored face toward upper-left
  { left: "up", down: "right" }, // "\", mirrored face toward upper-right
  { left: "down", up: "right" }, // "/", mirrored face toward lower-right
  { right: "down", up: "left" }, // "\", mirrored face toward lower-left
];

export function createState() {
  return {
    source: { col: 0, row: 7, dir: "right", color: "green" },
    mirror: { col: null, row: null, step: 0, placed: false },
    target: { col: 7, row: 14 },
  };
}

export function rotateMirror(state) {
  state.mirror.step = (state.mirror.step + 1) % 4;
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
      const outDir = ONE_SIDED_REFLECT[state.mirror.step][dir];
      if (!outDir) break; // hit the black side -- blocked
      dir = outDir;
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
