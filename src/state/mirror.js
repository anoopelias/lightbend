import { Tool } from "./tool.js";
import { DIR_ORDER } from "./directions.js";

export class Mirror extends Tool {
  kind = "mirror";

  // The mirror is a one-sided card resting at one of 8 orientations (45deg
  // apart, step 0-7): `step` is the direction its reflective face's outward
  // normal points. A beam entering from `dir` hits that face -- and
  // reflects -- only if it's heading roughly into it; heading roughly the
  // same way as the normal instead means it hit the black backing, and is
  // blocked; heading exactly parallel to the mirror's line means it grazes
  // past both faces, unaffected.
  outputDirections(dir) {
    const d = DIR_ORDER.indexOf(dir);
    const diff = (d - this.step + 8) % 8;
    if (diff === 2 || diff === 6) return [dir]; // parallel to the mirror -- passes straight through
    if (diff !== 3 && diff !== 4 && diff !== 5) return []; // hit the black side -- blocked
    const line = (this.step + 2) % 8; // the mirror's line is perpendicular to its face normal
    return [DIR_ORDER[(((2 * line - d) % 8) + 8) % 8]];
  }
}
