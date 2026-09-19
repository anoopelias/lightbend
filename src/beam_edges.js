// ---------- Beam rendering geometry (color-mixing overlaps into runs) ----------

import { COLOR_MIX } from "./game_state.js";

// Breaks every beam down into unit grid-edges, merging the ones different
// sources' beams both cross so an overlap draws as its mixed color (e.g. a
// red beam and a green beam sharing a stretch of path draws yellow there)
// instead of one beam simply painting over the other -- then re-merges
// consecutive unit edges that end up the same color back into one long run,
// so a plain, non-overlapping stretch is still one continuous stroke rather
// than many 1-cell strokes whose round caps show up as dots at every cell
// boundary.
export function computeBeamEdges(beams) {
  const unitColors = new Map(); // canonical "c1,r1|c2,r2" -> Set of colors
  const unitEdges = []; // { from, to, key }, one entry per distinct unit edge

  for (const { source, segments } of beams) {
    for (const segment of segments) {
      for (let i = 0; i < segment.length - 1; i++) {
        const a = segment[i];
        const b = segment[i + 1];
        const dx = Math.sign(b.col - a.col);
        const dy = Math.sign(b.row - a.row);
        const steps = Math.max(Math.abs(b.col - a.col), Math.abs(b.row - a.row));
        let col = a.col;
        let row = a.row;
        for (let s = 0; s < steps; s++) {
          const nextCol = col + dx;
          const nextRow = row + dy;
          const from = { col, row };
          const to = { col: nextCol, row: nextRow };
          const key = edgeKey(from, to);
          if (!unitColors.has(key)) {
            unitColors.set(key, new Set());
            unitEdges.push({ from, to, key });
          }
          unitColors.get(key).add(source.color);
          col = nextCol;
          row = nextRow;
        }
      }
    }
  }

  // Group unit edges by the straight line they lie on, in each case with a
  // consistent forward direction, so consecutive same-color ones can be
  // merged into one run regardless of which beam(s) first walked over them.
  const lines = new Map(); // line key -> [{ pos, from, to, color }]
  for (const { from, to, key } of unitEdges) {
    const color = mixColorName(unitColors.get(key));
    const vertical = from.col === to.col;
    const [start, end] = (vertical ? from.row > to.row : from.col > to.col) ? [to, from] : [from, to];
    // A "\" diagonal (col and row both increase together) keeps row - col
    // constant; a "/" diagonal (col up, row down) keeps row + col constant.
    const lineKey = vertical
      ? `v:${start.col}`
      : start.row === end.row
        ? `h:${start.row}`
        : end.row > start.row
          ? `d1:${start.row - start.col}`
          : `d2:${start.row + start.col}`;
    const pos = vertical ? start.row : start.col;
    if (!lines.has(lineKey)) lines.set(lineKey, []);
    lines.get(lineKey).push({ pos, from: start, to: end, color });
  }

  const runs = [];
  for (const segs of lines.values()) {
    segs.sort((a, b) => a.pos - b.pos);
    let current = null;
    for (const seg of segs) {
      if (current && current.color === seg.color && current.to.col === seg.from.col && current.to.row === seg.from.row) {
        current.to = seg.to;
      } else {
        if (current) runs.push(current);
        current = { from: seg.from, to: seg.to, color: seg.color };
      }
    }
    if (current) runs.push(current);
  }

  return runs;
}

function edgeKey(a, b) {
  return a.col < b.col || (a.col === b.col && a.row <= b.row) ? `${a.col},${a.row}|${b.col},${b.row}` : `${b.col},${b.row}|${a.col},${a.row}`;
}

function mixColorName(colors) {
  for (const [name, parts] of Object.entries(COLOR_MIX)) {
    if (parts.length === colors.size && parts.every((c) => colors.has(c))) return name;
  }
  return colors.values().next().value;
}
