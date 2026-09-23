import { Tool } from "./tool.js";
import { DIR_ORDER } from "./directions.js";

export class Bender extends Tool {
  kind = "bender";

  // A one-sided card exactly like the mirror -- same reflection physics,
  // angle in equals angle out off its face -- just with its face normal
  // sitting half a step (22.5deg) further round than `step` alone would
  // put a mirror's (see BENDER_BASE_ANGLE in view_state.js). That half-step
  // offset means no incoming direction ever lands exactly parallel to it,
  // so unlike the mirror there's no grazing-past case: the 4 directions
  // roughly facing its normal hit the black backing and are blocked, and
  // the other 4 reflect -- by 45deg from the two more glancing angles, or
  // by a steeper 135deg from the two closer to dead-on.
  outputDirections(dir) {
    const d = DIR_ORDER.indexOf(dir);
    const diff = (d - this.step + 8) % 8;
    if (diff < 3 || diff > 6) return []; // facing roughly the same way as the normal -- hits the black backing, blocked
    // The face's line sits half a step past a mirror's own (this.step + 2.5);
    // doubling keeps that .5 as an integer through the reflection formula.
    return [DIR_ORDER[(((2 * this.step + 5 - d) % 8) + 8) % 8]];
  }
}
