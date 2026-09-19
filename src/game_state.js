// ---------- Game logic (grid-space, no pixels, no drawing) ----------

import { loadProgress, saveProgress } from "./storage.js";

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
  {
    sources: [{ col: 1, row: 7, dir: "right", color: "green" }],
    targets: [
      { col: 9, row: 3, color: "green" },
      { col: 8, row: 4, color: "green" },
      { col: 4, row: 4, color: "green" },
      { col: 6, row: 5, color: "green" },
      { col: 6, row: 11, color: "green" },
    ],
    mirrorCount: 0,
    splitterCount: 3,
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
  kind = "mirror";
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

export class Splitter {
  kind = "splitter";
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

  // The splitter is a glass line resting at one of 8 orientations (45deg
  // apart, step 0-7); unlike the mirror, `step` is the line's own forward
  // direction rather than a face normal. A beam hitting it obliquely
  // (45deg to the line) keeps going AND spawns a second beam perpendicular
  // to it. One hitting square into the line's face (90deg) just passes
  // through unaffected. One heading dead into the line's closed far end --
  // i.e. straight along the line, but the opposite way from `step`'s own
  // direction (180deg) -- is blocked outright. Returns `{ through, branch }`:
  // `through` is false only for that last case; `branch` is the second
  // beam's direction, or undefined when the hit doesn't split one off.
  split(dir) {
    const d = DIR_ORDER.indexOf(dir);
    const diff = (d - this.step + 8) % 8;
    if (diff === 4) return { through: false, branch: undefined }; // the closed end -- blocked
    if (diff % 2 === 0) return { through: true, branch: undefined }; // square with the line -- no split
    return { through: true, branch: DIR_ORDER[(((2 * this.step - d) % 8) + 8) % 8] };
  }
}

export class GameState {
  constructor() {
    const saved = loadProgress();
    this.levelSnapshots = saved?.levelSnapshots ?? {}; // levelIndex -> that level's last tool placements
    this.maxLevelReached = saved?.maxLevelReached ?? 0;
    this.loadLevel(saved?.levelIndex ?? 0);
  }

  get levelCount() {
    return LEVELS.length;
  }

  loadLevel(index) {
    const level = LEVELS[index];
    this.levelIndex = index;
    this.sources = level.sources.map((s) => new Source(s.col, s.row, s.dir, s.color));
    this.targets = level.targets.map((t) => new Target(t.col, t.row, t.color));
    this.tools = [
      ...Array.from({ length: level.mirrorCount ?? 0 }, () => new Mirror()),
      ...Array.from({ length: level.splitterCount ?? 0 }, () => new Splitter()),
    ];
    this.applySnapshot(this.levelSnapshots[index]);
    this.captureSnapshot();
  }

  // Restores a level's tools to how the player last left them -- a no-op
  // for a level that's never been visited.
  applySnapshot(snapshot) {
    if (!snapshot) return;
    snapshot.forEach((s, i) => {
      const tool = this.tools[i];
      if (!tool) return;
      tool.step = s.step;
      if (s.placed) tool.moveTo(s.col, s.row);
    });
  }

  // Records the current level's tool placements and saves progress, so
  // leaving the level (or reloading the page) and coming back restores it
  // instead of starting blank.
  captureSnapshot() {
    this.levelSnapshots[this.levelIndex] = this.tools.map((t) => ({
      col: t.col,
      row: t.row,
      step: t.step,
      placed: t.placed,
    }));
    saveProgress({
      levelIndex: this.levelIndex,
      levelSnapshots: this.levelSnapshots,
      maxLevelReached: this.maxLevelReached,
    });
  }

  get hasNextLevel() {
    return this.levelIndex < LEVELS.length - 1;
  }

  get hasPrevLevel() {
    return this.levelIndex > 0;
  }

  // Marks `index` as selectable in the level dropdown -- called the moment
  // a level is solved, not just when the player clicks Next, so the
  // dropdown unlocks it immediately either way.
  reachLevel(index) {
    if (index <= this.maxLevelReached) return;
    this.maxLevelReached = index;
    this.captureSnapshot();
  }

  nextLevel() {
    if (!this.hasNextLevel) return;
    this.reachLevel(this.levelIndex + 1);
    this.loadLevel(this.levelIndex + 1);
  }

  prevLevel() {
    if (this.hasPrevLevel) this.loadLevel(this.levelIndex - 1);
  }

  // Jumps to any level the player has already reached (via nextLevel) --
  // used by the level-select dropdown.
  goToLevel(index) {
    if (index >= 0 && index <= this.maxLevelReached && index < LEVELS.length) this.loadLevel(index);
  }

  toolAt(col, row) {
    return this.tools.find((t) => t.isAt(col, row));
  }

  // `ignoring` lets a tool being repositioned drop back onto its own cell.
  canPlaceTool(col, row, ignoring = null) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (this.sources.some((s) => s.col === col && s.row === row)) return false;
    if (this.targets.some((t) => t.col === col && t.row === row)) return false;
    if (this.tools.some((t) => t !== ignoring && t.isAt(col, row))) return false;
    return true;
  }

  // Places `tool` on the grid (from the palette, or repositions it if
  // already placed).
  moveTool(tool, col, row) {
    if (!this.canPlaceTool(col, row, tool)) return false;
    tool.moveTo(col, row);
    this.captureSnapshot();
    return true;
  }

  rotateTool(tool) {
    tool.rotate();
    this.captureSnapshot();
  }

  // Traces one source's beam, following it (and any beams a splitter spawns
  // off it) until each ray exits the grid or is blocked -- by a mirror's
  // black side, a splitter's closed end, or reaching any source's cell
  // (its own included, though a beam starting there never re-enters it).
  // Targets never block a beam -- it passes straight through, whether or
  // not their color matches. A splitter mostly doesn't redirect a beam
  // like a mirror does -- the beam keeps going, and a second one branches
  // off perpendicular to it (see Splitter.split) -- so one source can
  // produce several ray segments.
  // Returns those segments (each a list of grid-space cells, for drawing)
  // and the full set of cells visited across all of them, as "col,row" keys
  // (used to check which colors pass through a given target).
  computeBeamFor(source) {
    const visited = new Set();
    const segments = [];

    const trace = (col, row, dir) => {
      const segment = [{ col, row }];
      visited.add(`${col},${row}`);

      for (let steps = 0; steps < COLS * ROWS + 2; steps++) {
        const d = DIRS[dir];
        col += d.x;
        row += d.y;

        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) {
          segment.push({ col, row });
          break;
        }
        visited.add(`${col},${row}`);

        if (this.sources.some((s) => s.col === col && s.row === row)) {
          segment.push({ col, row });
          break; // a source's housing blocks any beam reaching it, own or not
        }

        const tool = this.toolAt(col, row);
        if (tool?.kind === "mirror") {
          segment.push({ col, row });
          const outDir = tool.reflect(dir);
          if (!outDir) break; // hit the black side -- blocked
          dir = outDir;
          continue;
        }
        if (tool?.kind === "splitter") {
          segment.push({ col, row });
          const { through, branch } = tool.split(dir);
          if (branch) segments.push(trace(col, row, branch));
          if (!through) break; // hit the closed end -- blocked
          continue;
        }
      }

      return segment;
    };

    segments.push(trace(source.col, source.row, source.dir));
    return { segments, visited };
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
