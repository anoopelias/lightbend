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

// Each level lists its sources and targets (by color) and how many mirrors
// are available to place -- the mirrors themselves always start unplaced in
// the palette.
export const LEVELS = [
  {
    sources: [{ col: 3, row: 8, dir: "right", color: "red" }],
    targets: [{ col: 9, row: 3, color: "red" }],
    mirrorCount: 1,
  },
  {
    // Replicates the original Chromatron's level 2: a red source/mirror/
    // target, plus a blue source whose beam passes through one target on
    // its way to a second.
    sources: [
      { col: 2, row: 4, dir: "right", color: "red" },
      { col: 0, row: 5, dir: "right", color: "blue" },
    ],
    targets: [
      { col: 7, row: 2, color: "red" },
      { col: 6, row: 5, color: "blue" },
      { col: 11, row: 2, color: "blue" },
    ],
    mirrorCount: 3,
  },
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
  constructor(col, row, color) {
    this.col = col;
    this.row = row;
    this.color = color;
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
    this.sources = level.sources.map((s) => new Source(s.col, s.row, s.dir, s.color));
    this.targets = level.targets.map((t) => new Target(t.col, t.row, t.color));
    this.mirrors = Array.from({ length: level.mirrorCount }, () => new Mirror());
  }

  get hasNextLevel() {
    return this.levelIndex < LEVELS.length - 1;
  }

  nextLevel() {
    if (this.hasNextLevel) this.loadLevel(this.levelIndex + 1);
  }

  mirrorAt(col, row) {
    return this.mirrors.find((m) => m.isAt(col, row));
  }

  // `ignoring` lets a mirror being repositioned drop back onto its own cell.
  canPlaceMirror(col, row, ignoring = null) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (this.sources.some((s) => s.col === col && s.row === row)) return false;
    if (this.targets.some((t) => t.col === col && t.row === row)) return false;
    if (this.mirrors.some((m) => m !== ignoring && m.isAt(col, row))) return false;
    return true;
  }

  // Places `mirror` on the grid (from the palette, or repositions it if
  // already placed).
  moveMirror(mirror, col, row) {
    if (!this.canPlaceMirror(col, row, mirror)) return false;
    mirror.moveTo(col, row);
    return true;
  }

  // Traces one source's beam through the mirrors until it exits the grid or
  // is blocked. Targets of the source's own color don't stop it, just get
  // recorded as hit. Returns grid-space cells (col/row, not pixels) and the
  // list of targets this beam hit.
  computeBeamFor(source) {
    const cells = [{ col: source.col, row: source.row }];
    let col = source.col;
    let row = source.row;
    let dir = source.dir;
    const hitTargets = [];

    for (let steps = 0; steps < COLS * ROWS + 2; steps++) {
      const d = DIRS[dir];
      col += d.x;
      row += d.y;

      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) {
        cells.push({ col, row });
        break;
      }

      const mirror = this.mirrorAt(col, row);
      if (mirror) {
        cells.push({ col, row });
        const outDir = mirror.reflect(dir);
        if (!outDir) break; // hit the black side -- blocked
        dir = outDir;
        continue;
      }

      const target = this.targets.find((t) => t.col === col && t.row === row && t.color === source.color);
      if (target) {
        cells.push({ col, row });
        hitTargets.push(target);
        continue; // the target doesn't block the beam -- it keeps going
      }
    }

    return { cells, hitTargets };
  }

  // Traces every source's beam. Returns each beam (paired with its source)
  // and the set of targets hit across all of them.
  computeBeams() {
    const beams = this.sources.map((source) => ({ source, ...this.computeBeamFor(source) }));
    const hitTargets = new Set(beams.flatMap((b) => b.hitTargets));
    return { beams, hitTargets };
  }
}
