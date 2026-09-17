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

// Each level just needs a source and a target -- the mirror always starts
// unplaced in the palette.
export const LEVELS = [
  { source: { col: 3, row: 8, dir: "right", color: "red" }, target: { col: 9, row: 3 } },
  { source: { col: 2, row: 11, dir: "right", color: "blue" }, target: { col: 11, row: 2 } },
];

export class Source {
  constructor(col, row, dir, color) {
    this.col = col;
    this.row = row;
    this.dir = dir;
    this.color = color;
  }
}

export class Target {
  constructor(col, row) {
    this.col = col;
    this.row = row;
  }
}

export class Mirror {
  col = null;
  row = null;
  step = 0;
  placed = false;

  rotate() {
    this.step = (this.step + 1) % 4;
  }

  moveTo(col, row) {
    this.col = col;
    this.row = row;
    this.placed = true;
  }

  isAt(col, row) {
    return this.placed && col === this.col && row === this.row;
  }

  // Outgoing direction for a beam entering from `dir`, or undefined if it
  // hits the black side and is blocked.
  reflect(dir) {
    return ONE_SIDED_REFLECT[this.step][dir];
  }
}

export class GameState {
  constructor(levelIndex = 0) {
    this.loadLevel(levelIndex);
  }

  loadLevel(index) {
    const level = LEVELS[index];
    this.levelIndex = index;
    this.source = new Source(level.source.col, level.source.row, level.source.dir, level.source.color);
    this.target = new Target(level.target.col, level.target.row);
    this.mirror = new Mirror();
  }

  get hasNextLevel() {
    return this.levelIndex < LEVELS.length - 1;
  }

  nextLevel() {
    if (this.hasNextLevel) this.loadLevel(this.levelIndex + 1);
  }

  canPlaceMirror(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (col === this.source.col && row === this.source.row) return false;
    if (col === this.target.col && row === this.target.row) return false;
    return true;
  }

  // Places the mirror on the grid (from the palette, or repositions it if
  // already placed).
  moveMirror(col, row) {
    if (!this.canPlaceMirror(col, row)) return false;
    this.mirror.moveTo(col, row);
    return true;
  }

  // Traces the beam from the source through the mirror until it exits the
  // grid or is blocked -- the target doesn't stop it, just marks it as hit.
  // Returns grid-space cells (col/row, not pixels) and whether the target
  // was hit.
  computeBeam() {
    const cells = [{ col: this.source.col, row: this.source.row }];
    let col = this.source.col;
    let row = this.source.row;
    let dir = this.source.dir;
    let hit = false;

    for (let steps = 0; steps < COLS * ROWS + 2; steps++) {
      const d = DIRS[dir];
      col += d.x;
      row += d.y;

      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) {
        cells.push({ col, row });
        break;
      }

      if (this.mirror.isAt(col, row)) {
        cells.push({ col, row });
        const outDir = this.mirror.reflect(dir);
        if (!outDir) break; // hit the black side -- blocked
        dir = outDir;
        continue;
      }

      if (col === this.target.col && row === this.target.row) {
        cells.push({ col, row });
        hit = true;
        continue; // the target doesn't block the beam -- it keeps going
      }
    }

    return { cells, hit };
  }
}
