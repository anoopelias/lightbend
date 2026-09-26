// ---------- Game logic (grid-space, no pixels, no drawing) ----------

import { loadProgress, saveProgress } from "../storage.js";
import { LEVELS } from "../levels.js";
import { DIRS, DIR_ORDER } from "./directions.js";
import { Mirror } from "./mirror.js";
import { Splitter } from "./splitter.js";
import { Bender } from "./bender.js";

export const COLS = 15;
export const ROWS = 15;

export { DIRS };

// A composite target color is lit by the exact set of primary beam colors
// it's mixed from -- a beam of any other color (or a missing one) means the
// target doesn't light.
export const COLOR_MIX = {
  red: ["red"],
  green: ["green"],
  blue: ["blue"],
  yellow: ["red", "green"],
  cyan: ["green", "blue"],
  magenta: ["red", "blue"],
  white: ["red", "green", "blue"],
};

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

// A fixed obstacle, placed by the level itself rather than the player --
// never movable, never rotatable. Its housing blocks any beam that reaches
// it, the same as a source's.
export class Blocker {
  constructor(col, row) {
    this.col = col;
    this.row = row;
  }
}

// A fixed tube, placed by the level like a blocker -- not a tool, never
// movable or rotatable. Its orientation is fixed, but it's open at both
// ends: a beam already travelling along its axis (`dir`, or straight back
// the opposite way) passes straight through unaffected; anything else is
// blocked, same as hitting a blocker.
export class Conduit {
  constructor(col, row, dir = "downRight") {
    this.col = col;
    this.row = row;
    this.dir = dir;
  }

  allows(dir) {
    const d = DIR_ORDER.indexOf(dir);
    const axis = DIR_ORDER.indexOf(this.dir);
    return d === axis || d === (axis + 4) % 8;
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
    this.blockers = (level.blockers ?? []).map((b) => new Blocker(b.col, b.row));
    this.conduits = (level.conduits ?? []).map((c) => new Conduit(c.col, c.row, c.dir));
    this.tools = [
      ...Array.from({ length: level.mirrorCount ?? 0 }, () => new Mirror()),
      ...Array.from({ length: level.splitterCount ?? 0 }, () => new Splitter()),
      ...Array.from({ length: level.benderCount ?? 0 }, () => new Bender()),
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
    if (this.blockers.some((b) => b.col === col && b.row === row)) return false;
    if (this.conduits.some((c) => c.col === col && c.row === row)) return false;
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
  // black side, a bender's, a splitter's closed end, a fixed blocker, a
  // conduit crossed off-axis, or reaching any source's cell (its own
  // included, though a beam starting there never re-enters it). Targets
  // never block a beam -- it passes
  // straight through, whether or not their color matches. A splitter mostly
  // doesn't redirect a beam like a mirror does -- the beam keeps going, and
  // a second one branches off perpendicular to it (see Splitter.split) --
  // so one source can produce several ray segments.
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
        if (this.blockers.some((b) => b.col === col && b.row === row)) {
          segment.push({ col, row });
          break; // a fixed obstacle -- blocked
        }
        const conduit = this.conduits.find((c) => c.col === col && c.row === row);
        if (conduit && !conduit.allows(dir)) {
          segment.push({ col, row });
          break; // off-axis -- blocked
        }

        const tool = this.toolAt(col, row);
        if (tool) {
          segment.push({ col, row });
          const [outDir, branch] = tool.outputDirections(dir);
          if (branch) segments.push(trace(col, row, branch));
          if (!outDir) break; // blocked
          dir = outDir;
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
  // just a one-color mix, so this also covers plain color-purity. A source
  // can itself be a composite color (e.g. white) -- COLOR_MIX expands it to
  // the primaries it carries, same as it does for a target's own color, so
  // a white source satisfies a white target but not a plain red one.
  computeBeams() {
    const beams = this.sources.map((source) => ({ source, ...this.computeBeamFor(source) }));

    const hitTargets = new Set();
    for (const target of this.targets) {
      const key = `${target.col},${target.row}`;
      const colorsPresent = new Set(beams.filter((b) => b.visited.has(key)).flatMap((b) => COLOR_MIX[b.source.color]));
      const wanted = COLOR_MIX[target.color];
      if (wanted.length === colorsPresent.size && wanted.every((c) => colorsPresent.has(c))) {
        hitTargets.add(target);
      }
    }

    return { beams, hitTargets };
  }
}
