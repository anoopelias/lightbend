// ---------- Level data ----------

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
  {
    sources: [
      { col: 1, row: 6, dir: "right", color: "red" },
      { col: 1, row: 8, dir: "right", color: "green" },
    ],
    targets: [
      { col: 12, row: 7, color: "yellow" },
      { col: 7, row: 11, color: "yellow" },
    ],
    mirrorCount: 2,
    splitterCount: 1,
  },
  {
    sources: [
      { col: 1, row: 8, dir: "right", color: "red" },
      { col: 13, row: 6, dir: "left", color: "blue" },
    ],
    targets: [
      { col: 7, row: 2, color: "red" },
      { col: 4, row: 4, color: "red" },
      { col: 10, row: 4, color: "red" },
      { col: 4, row: 10, color: "blue" },
      { col: 10, row: 10, color: "blue" },
      { col: 7, row: 12, color: "blue" },
    ],
    mirrorCount: 0,
    splitterCount: 4,
  },
  {
    sources: [
      { col: 3, row: 1, dir: "down", color: "red" },
      { col: 10, row: 1, dir: "down", color: "blue" },
    ],
    targets: [
      { col: 7, row: 3, color: "blue" },
      { col: 11, row: 4, color: "red" },
      { col: 4, row: 5, color: "blue" },
      { col: 5, row: 10, color: "red" },
    ],
    blockers: borderCells(15),
    mirrorCount: 0,
    splitterCount: 0,
    benderCount: 3,
  },
  {
    sources: [{ col: 3, row: 11, dir: "right", color: "blue" }],
    targets: [
      { col: 2, row: 9, color: "blue" },
      { col: 4, row: 3, color: "blue" },
      { col: 12, row: 5, color: "blue" },
    ],
    splitterCount: 2,
    benderCount: 1,
  },
  {
    sources: [{ col: 0, row: 14, dir: "up", color: "green" }],
    targets: [
      { col: 2, row: 11, color: "green" },
      { col: 6, row: 5, color: "green" },
      { col: 12, row: 3, color: "green" },
      { col: 12, row: 13, color: "green" },
    ],
    // One-way conduits, letting light through only top-left to bottom-right,
    // filling every row of columns 1, 4, 10 and 13.
    conduits: [1, 4, 10, 13].flatMap((col) => columnCells(col, 15).map((c) => ({ col: c.col, row: c.row, dir: "downRight" }))),
    mirrorCount: 3,
    splitterCount: 2,
    benderCount: 1,
  },
];

// Every cell along the outer ring of a `size`x`size` grid.
function borderCells(size) {
  const cells = [];
  for (let i = 0; i < size; i++) {
    cells.push({ col: i, row: 0 });
    cells.push({ col: i, row: size - 1 });
  }
  for (let i = 1; i < size - 1; i++) {
    cells.push({ col: 0, row: i });
    cells.push({ col: size - 1, row: i });
  }
  return cells;
}

// Every cell in a `size`-row column, skipping any cells listed in `skip`.
function columnCells(col, size, skip = []) {
  const cells = [];
  for (let row = 0; row < size; row++) {
    if (skip.some((s) => s.col === col && s.row === row)) continue;
    cells.push({ col, row });
  }
  return cells;
}
