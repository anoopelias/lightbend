import { Tool } from "./tool.js";
import { DIR_ORDER } from "./directions.js";

export class Splitter extends Tool {
  kind = "splitter";

  // The splitter is a glass line resting at one of 8 orientations (45deg
  // apart, step 0-7); unlike the mirror, `step` is the line's own forward
  // direction rather than a face normal. A beam hitting it obliquely
  // (45deg to the line) keeps going (unchanged) AND spawns a second beam
  // perpendicular to it. One hitting square into the line's face (90deg)
  // just passes through unaffected. One heading dead into the line's
  // closed far end -- i.e. straight along the line, but the opposite way
  // from `step`'s own direction (180deg) -- is blocked outright.
  outputDirections(dir) {
    const d = DIR_ORDER.indexOf(dir);
    const diff = (d - this.step + 8) % 8;
    if (diff === 4) return []; // the closed end -- blocked
    if (diff % 2 === 0) return [dir]; // square with the line -- no split
    return [dir, DIR_ORDER[(((2 * this.step - d) % 8) + 8) % 8]];
  }
}
