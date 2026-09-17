// ---------- Game logic (grid-space, no pixels, no drawing) ----------

export const COLS = 15;
export const ROWS = 15;

// 8 directions, 45 degrees apart, in clockwise order starting from "right"
// (matches DIR_ORDER's index so a direction's index * 45deg is its angle).
export const DIRS = {
  right: { x: 1, y: 0 },
  downRight: { x: 1, y: 1 },
  down: { x: 0, y: 1 },
  downLeft: { x: -1, y: 1 },
  left: { x: -1, y: 0 },
  upLeft: { x: -1, y: -1 },
  up: { x: 0, y: -1 },
  upRight: { x: 1, y: -1 },
};
const DIR_ORDER = Object.keys(DIRS);

// A composite target color is lit by the exact set of primary beam colors
// it's mixed from -- a beam of any other color (or a missing one) means the
// target doesn't light.
const COLOR_MIX = {
  red: ["red"],
  green: ["green"],
  blue: ["blue"],
  yellow: ["red", "green"],
  cyan: ["green", "blue"],
  magenta: ["red", "blue"],
  white: ["red", "green", "blue"],
};

// Each level lists its sources and targets (by color) and how many mirrors
// are available to place -- the mirrors themselves always start unplaced in
// the palette.
export const LEVELS = [
  {
    sources: [{ col: 2, row: 7, dir: "right", color: "red" }],
    targets: [{ col: 8, row: 2, color: "red" }],
    mirrorCount: 1,
  },
  {
    sources: [
      { col: 3, row: 9, dir: "right", color: "red" },
      { col: 12, row: 6, dir: "left", color: "blue" },
    ],
    targets: [
      { col: 7, row: 10, color: "blue" },
      { col: 8, row: 6, color: "red" },
    ],
    mirrorCount: 3,
  },
  {
    sources: [
      { col: 0, row: 3, dir: "downRight", color: "blue" },
      { col: 14, row: 11, dir: "left", color: "red" },
      { col: 3, row: 14, dir: "upRight", color: "green" },
    ],
    targets: [
      { col: 7, row: 4, color: "yellow" },
      { col: 9, row: 6, color: "cyan" },
      { col: 7, row: 8, color: "magenta" },
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
    this.step = (this.step + 1) % 8;
  }

  moveTo(col, row) {
    this.col = col;
    this.row = row;
    this.placed = true;
  }

  isAt(col, row) {
    return this.placed && col === this.col && row === this.row;
  }

  // The mirror is a one-sided card resting at one of 8 orientations (45deg
  // apart, step 0-7): `step` is the direction its reflective face's outward
  // normal points. A beam entering from `dir` hits that face -- and
  // reflects -- only if it's heading roughly into it; heading roughly the
  // same way as the normal instead means it hit the black backing, and is
  // blocked; heading exactly parallel to the mirror's line means it grazes
  // past both faces, unaffected. Returns the outgoing direction, or
  // undefined if blocked.
  reflect(dir) {
    const d = DIR_ORDER.indexOf(dir);
    const diff = (d - this.step + 8) % 8;
    if (diff === 2 || diff === 6) return dir; // parallel to the mirror -- passes straight through
    if (diff !== 3 && diff !== 4 && diff !== 5) return undefined; // hit the black side -- blocked
    const line = (this.step + 2) % 8; // the mirror's line is perpendicular to its face normal
    return DIR_ORDER[(((2 * line - d) % 8) + 8) % 8];
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
  // is blocked. Targets never block it -- it passes straight through,
  // whether or not their color matches. Returns the grid-space cells
  // (col/row, not pixels) and the full set of cells visited, as "col,row"
  // keys (used to check which colors pass through a given target).
  computeBeamFor(source) {
    const cells = [{ col: source.col, row: source.row }];
    const visited = new Set([`${source.col},${source.row}`]);
    let col = source.col;
    let row = source.row;
    let dir = source.dir;

    for (let steps = 0; steps < COLS * ROWS + 2; steps++) {
      const d = DIRS[dir];
      col += d.x;
      row += d.y;

      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) {
        cells.push({ col, row });
        break;
      }
      visited.add(`${col},${row}`);

      const mirror = this.mirrorAt(col, row);
      if (mirror) {
        cells.push({ col, row });
        const outDir = mirror.reflect(dir);
        if (!outDir) break; // hit the black side -- blocked
        dir = outDir;
        continue;
      }
    }

    return { cells, visited };
  }

  // Traces every source's beam. A target lights up only if the exact set of
  // primary colors passing through its cell matches the set it's mixed from
  // -- nothing missing, nothing extra. A plain red/green/blue target is
  // just a one-color mix, so this also covers plain color-purity.
  computeBeams() {
    const beams = this.sources.map((source) => ({ source, ...this.computeBeamFor(source) }));

    const hitTargets = new Set();
    for (const target of this.targets) {
      const key = `${target.col},${target.row}`;
      const colorsPresent = new Set(beams.filter((b) => b.visited.has(key)).map((b) => b.source.color));
      const wanted = COLOR_MIX[target.color];
      if (wanted.length === colorsPresent.size && wanted.every((c) => colorsPresent.has(c))) {
        hitTargets.add(target);
      }
    }

    return { beams, hitTargets };
  }
}
