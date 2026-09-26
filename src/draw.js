import { COLS, ROWS, DIRS } from "./state/game_state.js";
import { getTheme } from "./theme.js";

// ---------- Drawing (pure: reads entities + transient view, writes to canvas) ----------

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawCells(board) {
  const { ctx, cellRect } = board;
  const theme = getTheme();
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const r = cellRect(col, row);
      roundRect(ctx, r.x, r.y, r.w, r.h, 4);
      ctx.fillStyle = theme.cell;
      ctx.fill();
      ctx.strokeStyle = theme.cellBorder;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

// A fixed obstacle, drawn as a raised platform filling its cell -- a dark
// drop shadow peeking out from under a lighter top face reads as "solid
// block sitting above the floor" without needing an isometric perspective.
export function drawBlocker(board, blocker) {
  const { ctx, cellRect } = board;
  const r = cellRect(blocker.col, blocker.row);
  const inset = Math.max(1, r.w * 0.06);
  const lift = Math.max(1, r.w * 0.035);
  const x = r.x + inset;
  const y = r.y + inset;
  const w = r.w - inset * 2;
  const h = r.h - inset * 2;
  const { top, edge } = getTheme().blocker;

  roundRect(ctx, x, y + lift, w, h, 3);
  ctx.fillStyle = "rgba(0, 0, 0, 0.13)";
  ctx.fill();

  roundRect(ctx, x, y, w, h - lift, 3);
  const grad = ctx.createLinearGradient(x, y, x, y + h - lift);
  grad.addColorStop(0, top[0]);
  grad.addColorStop(1, top[1]);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// A fixed tube, open at both ends along its one axis -- drawn plainly, a
// black bar with a thin silver line down its center, so it reads as part
// of the board's fixed furniture rather than calling attention to itself.
export function drawConduit(board, conduit) {
  const { ctx, cellRect, cellCenter } = board;
  const r = cellRect(conduit.col, conduit.row);
  const c = cellCenter(conduit.col, conduit.row);
  const dir = DIRS[conduit.dir];
  const mag = Math.hypot(dir.x, dir.y);
  const ux = dir.x / mag;
  const uy = dir.y / mag;
  const half = r.w * 0.32;
  const x1 = c.x - ux * half;
  const y1 = c.y - uy * half;
  const x2 = c.x + ux * half;
  const y2 = c.y + uy * half;

  ctx.save();
  ctx.lineCap = "round";

  ctx.strokeStyle = "#0e1014";
  ctx.lineWidth = r.w * 0.09;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(214, 224, 232, 0.7)";
  ctx.lineWidth = r.w * 0.05;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.restore();
}

// Drawn as an emitter tube pointing the direction it fires, rather than a
// plain dot -- the shape itself reads as "source", clearly distinct from
// the target's ring, and needs no separate direction indicator.
export function drawSource(board, source, time) {
  const { ctx, cellCenter } = board;
  const c = cellCenter(source.col, source.row);
  const pulse = 1 + 0.08 * Math.sin(time / 260);
  const color = getTheme().beam[source.color];
  const dir = DIRS[source.dir];
  const angle = Math.atan2(dir.y, dir.x);

  const bodyLen = 20;
  const bodyWidth = 11;
  const muzzleRadius = 5.5 * pulse;

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(angle);

  // glow spilling out of the open front end
  const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, muzzleRadius * 2.6);
  glow.addColorStop(0, `rgba(${color.glow}, 0.6)`);
  glow.addColorStop(1, `rgba(${color.glow}, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, muzzleRadius * 2.6, 0, Math.PI * 2);
  ctx.fill();

  // dark metal tube body, trailing back from the muzzle at the cell center
  roundRect(ctx, -bodyLen, -bodyWidth / 2, bodyLen + 2, bodyWidth, bodyWidth / 2);
  const bodyGrad = ctx.createLinearGradient(0, -bodyWidth / 2, 0, bodyWidth / 2);
  bodyGrad.addColorStop(0, "#3a3f47");
  bodyGrad.addColorStop(0.5, "#7c8994");
  bodyGrad.addColorStop(1, "#2a2e35");
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // glowing core visible through the muzzle
  const core = ctx.createRadialGradient(0, 0, 0.5, 0, 0, muzzleRadius);
  core.addColorStop(0, color.core);
  core.addColorStop(1, color.mid);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, muzzleRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// Drawn as a flat reflective face backed by a curved black shell, like a
// plano-convex lens, so which side is the mirror face reads at a glance. The
// reflective face is always the same local side (-1); it's the caller's
// rotation angle -- a multiple of 90 degrees from mirror.step -- that sweeps
// it to face the right way, so there's nothing here to fall out of sync
// with the angle mid-animation.
export function drawMirrorGlyph(ctx, len) {
  ctx.lineCap = "round";

  const half = len / 2;
  const bulge = len * 0.32;

  // black backing, curving away from the flat reflective face like a
  // plano-convex lens instead of a flat plate
  ctx.beginPath();
  ctx.moveTo(-half, -1);
  ctx.lineTo(half, -1);
  ctx.quadraticCurveTo(0, bulge, -half, -1);
  ctx.closePath();
  ctx.fillStyle = "#0e1014";
  ctx.fill();

  ctx.lineWidth = 2;
  const grad = ctx.createLinearGradient(-half, -1, half, -1);
  grad.addColorStop(0, "#7c8994");
  grad.addColorStop(0.5, "#eef3f6");
  grad.addColorStop(1, "#55606b");
  ctx.strokeStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-half, -1);
  ctx.lineTo(half, -1);
  ctx.stroke();
}

// Drawn like the mirror's flat reflective face, but backed by a short
// straight plate with a small handle kicked out behind one end -- the
// classic look for this piece, and a silhouette that reads as different
// from the mirror's at a glance no matter the rotation, on top of the
// 22.5deg the caller already offsets it by.
export function drawBenderGlyph(ctx, len) {
  ctx.lineCap = "round";

  const half = len / 2;
  const handle = len * 0.22;

  ctx.strokeStyle = "#0e1014";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-half, 1);
  ctx.lineTo(half, 1);
  ctx.lineTo(half + handle * 0.7, 1 + handle);
  ctx.stroke();

  const grad = ctx.createLinearGradient(-half, -1, half, -1);
  grad.addColorStop(0, "#7c8994");
  grad.addColorStop(0.5, "#eef3f6");
  grad.addColorStop(1, "#55606b");
  ctx.strokeStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-half, -1);
  ctx.lineTo(half, -1);
  ctx.stroke();
}

// Drawn as an "I-beam": a thin silver stem with a thick black flange
// perpendicular to it at each end -- a beam splits or passes through the
// same way regardless of which side it hits, so there's no front/back
// shading like the mirror's, just the two end caps. Silver rather than
// glass-blue reads clearly on both themes without a separate light-theme
// color, the same as the mirror and bender's face.
export function drawSplitterGlyph(ctx, len) {
  ctx.lineCap = "round";

  const stemHalf = len * 0.46;
  const capX = len * 0.46;
  const capHalf = len * 0.11;

  const grad = ctx.createLinearGradient(-stemHalf, 0, stemHalf, 0);
  grad.addColorStop(0, "#7c8994");
  grad.addColorStop(0.5, "#eef3f6");
  grad.addColorStop(1, "#55606b");
  ctx.strokeStyle = grad;
  ctx.lineWidth = 5;
  ctx.shadowColor = "rgba(180, 190, 200, 0.5)";
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.moveTo(-stemHalf, 0);
  ctx.lineTo(stemHalf, 0);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = "#0e1014";
  ctx.lineWidth = len * 0.1;
  for (const x of [-capX, capX]) {
    ctx.beginPath();
    ctx.moveTo(x, -capHalf);
    ctx.lineTo(x, capHalf);
    ctx.stroke();
  }
}

// `valid` says whether the dragged mirror can be dropped on view.dragSnapCell.
export function drawSnapTarget(board, view, valid) {
  if (!view.dragging || !view.dragSnapCell) return;
  const { ctx, cellRect } = board;
  const r = cellRect(view.dragSnapCell.col, view.dragSnapCell.row);

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = valid ? getTheme().snapValid : "rgba(255, 90, 90, 0.7)";
  ctx.lineWidth = 2;
  roundRect(ctx, r.x, r.y, r.w, r.h, 4);
  ctx.stroke();
  ctx.restore();
}

// Shared by drawMirror and drawSplitter: the hover glow, drag-ghost and
// drag-scale treatment are identical for every tool -- only the glyph itself
// (drawn by `glyph(ctx, len)`) differs.
function drawToolBase(board, tool, view, glyph) {
  const { ctx, cellCenter, cellSize } = board;
  const len = cellSize * 0.62;

  if (view.dragging) {
    // faint ghost marking the tool's position until it's dropped
    const orig = cellCenter(tool.col, tool.row);
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.translate(orig.x, orig.y);
    ctx.rotate(view.angle);
    glyph(ctx, len);
    ctx.restore();
  } else if (view.hovering) {
    const c = cellCenter(tool.col, tool.row);
    const glow = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, cellSize * 0.5);
    glow.addColorStop(0, getTheme().hoverGlow);
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c.x, c.y, cellSize * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const c = view.dragging ? view.dragPos : cellCenter(tool.col, tool.row);

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(view.angle);
  if (view.dragging) ctx.scale(1.15, 1.15);
  glyph(ctx, len);
  ctx.restore();
}

export function drawMirror(board, mirror, view) {
  drawToolBase(board, mirror, view, drawMirrorGlyph);
}

export function drawSplitter(board, splitter, view) {
  drawToolBase(board, splitter, view, drawSplitterGlyph);
}

export function drawBender(board, bender, view) {
  drawToolBase(board, bender, view, drawBenderGlyph);
}

// Mutates view.ripple (clears it once the hit-pulse animation finishes).
export function drawTarget(board, target, view, time, hit) {
  const { ctx, cellCenter } = board;
  const c = cellCenter(target.col, target.row);
  const baseRadius = 8;
  const color = getTheme().beam[target.color];

  if (hit) {
    const pulse = 1 + 0.12 * Math.sin(time / 200);
    const glow = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, baseRadius * 2.4);
    glow.addColorStop(0, `rgba(${color.glow}, 0.6)`);
    glow.addColorStop(1, `rgba(${color.glow}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c.x, c.y, baseRadius * 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color.mid;
    ctx.beginPath();
    ctx.arc(c.x, c.y, baseRadius * pulse, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = `rgba(${color.glow}, 0.12)`;
    ctx.beginPath();
    ctx.arc(c.x, c.y, baseRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(${color.glow}, 0.55)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, baseRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (view.ripple) {
    const age = time - view.ripple.start;
    const duration = 600;
    if (age < duration) {
      const t = age / duration;
      ctx.strokeStyle = `rgba(${color.glow}, ${1 - t})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, baseRadius + t * 14, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      view.ripple = null;
    }
  }
}

export function drawBeam(board, points, color, time) {
  const { ctx } = board;
  const flicker = 0.85 + 0.15 * Math.sin(time / 90);

  const strokePath = (strokeStyle, lineWidth) => {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  };

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (color === "white") {
    // White carries every primary color at once -- unlike a hued color,
    // there's no "darker version of white" for the light theme that still
    // reads as white rather than grey heading to black (which is exactly
    // the trouble: it was washing out to near-black on a pale board, the
    // same look as a *blocked* beam). So, like the mirror/splitter/bender
    // materials elsewhere in this file, it's drawn as a fixed silver-white
    // regardless of theme, with a thin dark outline underneath for
    // contrast against a light-theme board.
    strokePath("rgba(10, 12, 16, 0.45)", 7);
    strokePath(`rgba(255, 255, 255, ${0.35 * flicker})`, 6);
    strokePath(`rgba(255, 255, 255, ${0.95 * flicker})`, 2);
  } else {
    const light = getTheme().beam[color];
    strokePath(`rgba(${light.glow}, ${0.35 * flicker})`, 6); // outer glow
    strokePath(`rgba(${light.glow}, ${0.95 * flicker})`, 2); // core beam
  }

  ctx.restore();
}
