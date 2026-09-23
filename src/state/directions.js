// 8 directions, 45 degrees apart, in clockwise order starting from "right"
// (matches DIR_ORDER's index so a direction's index * 45deg is its angle).
export const DIRS = {
  right: { x: 1, y: 0 },
  downRight: { x: 1, y: 1 },
  down: { x: 0, y: 1 },
  downLeft: { x: -1, y: 1 },
  left: { x: -1, y: 0 },
  upLeft: { x: -1, y: -1 },
  up: { x: 0, y: -1 },
  upRight: { x: 1, y: -1 },
};
export const DIR_ORDER = Object.keys(DIRS);
