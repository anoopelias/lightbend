// ---------- Transient, render-only state (not game state) ----------
//
// One entry per state.tools / state.targets -- eased rotation angles,
// hover/drag flags, ripple timers -- created together whenever a level
// loads and updated once per animation frame.

// mirror.step 0's reflective face normal points "right" (see reflect() in
// game_state.js); the glyph itself is drawn as a horizontal line with its
// reflective side facing local "up", so it needs a quarter turn on top of
// each step's 45-degree share of the full turn to line the two up. The
// splitter's step is the line itself (not a face normal, since it's
// two-sided), and its glyph is a plain horizontal line, so step 0 needs no
// such offset.
const MIRROR_BASE_ANGLE = Math.PI / 2;
const SPLITTER_BASE_ANGLE = 0;

function createToolView(tool) {
  const base = tool.kind === "splitter" ? SPLITTER_BASE_ANGLE : MIRROR_BASE_ANGLE;
  return {
    angle: base,
    targetAngle: base,
    lastStep: 0,
    hovering: false,
    dragging: false,
    dragPos: null, // pixel position the tool is being dragged to
    dragSnapCell: null, // grid cell the drag would snap to on release
  };
}

function createTargetView() {
  return { ripple: null }; // { start: timestamp }
}

export class ViewState {
  constructor(state) {
    this.loadLevel(state);
  }

  loadLevel(state) {
    this.toolViews = state.tools.map(createToolView);
    this.targetViews = state.targets.map(createTargetView);
    this.wasHitTargets = new Set();
  }

  // Eases each tool's rotation toward its step, always turning clockwise so
  // the animation never has to backtrack mid-turn.
  updateToolAngles(tools) {
    tools.forEach((tool, i) => {
      const view = this.toolViews[i];
      if (tool.step !== view.lastStep) {
        view.lastStep = tool.step;
        view.targetAngle += Math.PI / 4;
      }
      view.angle += (view.targetAngle - view.angle) * 0.22;
    });
  }

  // Starts a ripple on any target that just became lit this frame.
  updateRipples(targets, hitTargets, time) {
    targets.forEach((target, i) => {
      if (hitTargets.has(target) && !this.wasHitTargets.has(target)) {
        this.targetViews[i].ripple = { start: time };
      }
    });
    this.wasHitTargets = hitTargets;
  }

  get draggingToolView() {
    return this.toolViews.find((v) => v.dragging);
  }
}
