// A placeable, rotatable piece (Mirror, Splitter, Bender). Subclasses only
// need `kind` and `outputDirections(dir)` -- given the direction a beam
// enters from, that returns the directions light leaves in: no elements if
// the beam is blocked outright, one to keep tracing in a (possibly bent)
// direction, or two when the hit also branches off a second beam (the
// first element is always the direction to keep tracing the current beam
// in, same as the one-element case; the second is the branch).
export class Tool {
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
}
