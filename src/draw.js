import { COLS, ROWS, DIRS } from "./logic.js";

// ---------- Drawing (pure: reads state + transient view, writes to canvas) ----------

// RGB light colors and their combinations
const LIGHT = {
  red: { core: "#ff8a80", mid: "#ff3d3d", glow: "255, 61, 61" },
  green: { core: "#8ef5c0", mid: "#22c55e", glow: "34, 197, 94" },
  blue: { core: "#8ab4ff", mid: "#3b82f6", glow: "59, 130, 246" },
  yellow: { core: "#fff08a", mid: "#eab308", glow: "234, 179, 8" },
  cyan: { core: "#8af5f0", mid: "#06b6d4", glow: "6, 182, 212" },
  magenta: { core: "#ff8ae0", mid: "#d946ef", glow: "217, 70, 239" },
  white: { core: "#ffffff", mid: "#e2e8f0", glow: "226, 232, 240" },
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawCells(rc) {
  const { ctx, cellRect } = rc;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const r = cellRect(col, row);
      roundRect(ctx, r.x, r.y, r.w, r.h, 4);
      ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.09)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

export function drawSource(rc, state, time) {
  const { ctx, cellCenter } = rc;
  const c = cellCenter(state.source.col, state.source.row);
  const pulse = 1 + 0.06 * Math.sin(time / 260);
  const radius = 9 * pulse;
  const color = LIGHT[state.source.color];

  const glow = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, radius * 2.2);
  glow.addColorStop(0, `rgba(${color.glow}, 0.55)`);
  glow.addColorStop(1, `rgba(${color.glow}, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(c.x, c.y, radius * 2.2, 0, Math.PI * 2);
  ctx.fill();

  const grad = ctx.createLinearGradient(c.x - radius, c.y - radius, c.x + radius, c.y + radius);
  grad.addColorStop(0, color.core);
  grad.addColorStop(1, color.mid);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
  ctx.fill();

  // arrow pointing the direction the beam is emitted
  const dir = DIRS[state.source.dir];
  const angle = Math.atan2(dir.y, dir.x);
  const tip = radius + 9;
  const base = radius + 1;
  const halfWidth = 4;

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(tip, 0);
  ctx.lineTo(base, -halfWidth);
  ctx.lineTo(base, halfWidth);
  ctx.closePath();
  ctx.fillStyle = color.mid;
  ctx.fill();
  ctx.restore();
}

// Drawn as a thin two-sided card: a reflective metallic face and a black
// backing, so which side is the mirror face reads at a glance. The
// reflective face is always the same local side (-1); it's the caller's
// rotation angle -- a multiple of 90 degrees from mirror.step -- that sweeps
// it to face the right way, so there's nothing here to fall out of sync
// with the angle mid-animation.
function drawMirrorGlyph(ctx, len) {
  ctx.lineCap = "round";
  ctx.lineWidth = 2;

  const grad = ctx.createLinearGradient(-len / 2, -1, len / 2, -1);
  grad.addColorStop(0, "#7c8994");
  grad.addColorStop(0.5, "#eef3f6");
  grad.addColorStop(1, "#55606b");
  ctx.strokeStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-len / 2, -1);
  ctx.lineTo(len / 2, -1);
  ctx.stroke();

  ctx.strokeStyle = "#0e1014";
  ctx.beginPath();
  ctx.moveTo(-len / 2, 1);
  ctx.lineTo(len / 2, 1);
  ctx.stroke();
}

// `valid` says whether the dragged mirror can be dropped on view.dragSnapCell.
export function drawSnapTarget(rc, view, valid) {
  if (!view.dragging || !view.dragSnapCell) return;
  const { ctx, cellRect } = rc;
  const r = cellRect(view.dragSnapCell.col, view.dragSnapCell.row);

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = valid ? "rgba(255, 255, 255, 0.6)" : "rgba(255, 90, 90, 0.7)";
  ctx.lineWidth = 2;
  roundRect(ctx, r.x, r.y, r.w, r.h, 4);
  ctx.stroke();
  ctx.restore();
}

export function drawMirror(rc, state, view) {
  const { ctx, cellCenter, cell } = rc;
  const len = cell() * 0.62;

  if (view.dragging) {
    // faint ghost marking the mirror's position until it's dropped
    const orig = cellCenter(state.mirror.col, state.mirror.row);
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.translate(orig.x, orig.y);
    ctx.rotate(view.mirrorAngle);
    drawMirrorGlyph(ctx, len);
    ctx.restore();
  } else if (view.hoveringMirror) {
    const c = cellCenter(state.mirror.col, state.mirror.row);
    const glow = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, cell() * 0.5);
    glow.addColorStop(0, "rgba(255, 255, 255, 0.14)");
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c.x, c.y, cell() * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const c = view.dragging ? view.dragPos : cellCenter(state.mirror.col, state.mirror.row);

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(view.mirrorAngle);
  if (view.dragging) ctx.scale(1.15, 1.15);
  drawMirrorGlyph(ctx, len);
  ctx.restore();
}

// Mutates view.ripple (clears it once the hit-pulse animation finishes).
export function drawTarget(rc, state, view, time, hit) {
  const { ctx, cellCenter } = rc;
  const c = cellCenter(state.target.col, state.target.row);
  const baseRadius = 8;
  const color = LIGHT[state.source.color];

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

export function drawBeam(rc, state, points, time) {
  const { ctx } = rc;
  const flicker = 0.85 + 0.15 * Math.sin(time / 90);
  const color = LIGHT[state.source.color];

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // outer glow
  ctx.strokeStyle = `rgba(${color.glow}, ${0.35 * flicker})`;
  ctx.lineWidth = 6;
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();

  // core beam
  ctx.strokeStyle = `rgba(${color.glow}, ${0.95 * flicker})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();

  ctx.restore();
}
