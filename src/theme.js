// ---------- Theme (light/dark) ----------
//
// Covers everything the canvas draws that CSS custom properties can't
// reach. Dark materials (mirror/bender backing, conduit bar, tool
// housings) are fixed in draw.js and never change with the theme, the way
// a real mirror's backing doesn't change color depending on the room it's
// in -- but a PALE material (splitter glass, blocker slab) reads fine
// against a dark board and nearly vanishes against a light one, so those
// still need a theme-aware color even though they're "materials" too.

const STORAGE_KEY = "lightbend-theme";

// `core` is only ever seen as a small highlight inside a dark tool housing
// (the source's muzzle glow), never against the page background, so it
// doesn't need a separate light-theme value.
const CORE = {
  red: "#ff8a80",
  green: "#8ef5c0",
  blue: "#8ab4ff",
  yellow: "#fff08a",
  cyan: "#8af5f0",
  magenta: "#ff8ae0",
  white: "#ffffff",
};

export const THEMES = {
  dark: {
    cell: "rgba(255, 255, 255, 0.045)",
    cellBorder: "rgba(255, 255, 255, 0.09)",
    snapValid: "rgba(255, 255, 255, 0.6)",
    hoverGlow: "rgba(255, 255, 255, 0.14)",
    splitter: {
      glass: ["#7fc4e8", "#f0fbff", "#7fc4e8"],
      glow: "rgba(127, 196, 232, 0.6)",
    },
    blocker: {
      top: ["#4b515c", "#2c3038"],
      edge: "rgba(255, 255, 255, 0.12)",
    },
    beam: {
      red: { core: CORE.red, mid: "#ff3d3d", glow: "255, 61, 61" },
      green: { core: CORE.green, mid: "#22c55e", glow: "34, 197, 94" },
      blue: { core: CORE.blue, mid: "#3b82f6", glow: "59, 130, 246" },
      yellow: { core: CORE.yellow, mid: "#eab308", glow: "234, 179, 8" },
      cyan: { core: CORE.cyan, mid: "#06b6d4", glow: "6, 182, 212" },
      magenta: { core: CORE.magenta, mid: "#d946ef", glow: "217, 70, 239" },
      white: { core: CORE.white, mid: "#e2e8f0", glow: "226, 232, 240" },
    },
  },
  light: {
    cell: "rgba(33, 28, 22, 0.035)",
    cellBorder: "rgba(33, 28, 22, 0.09)",
    snapValid: "rgba(33, 28, 22, 0.55)",
    hoverGlow: "rgba(33, 28, 22, 0.1)",
    // The dark theme's icy near-white glass all but vanishes on paper, so
    // it deepens into a real blue here instead of just staying pale.
    splitter: {
      glass: ["#1c7fa8", "#0ea5c4", "#1c7fa8"],
      glow: "rgba(14, 133, 168, 0.4)",
    },
    // A "darker version of white" rather than the dark theme's charcoal --
    // a pale stone slab reads as raised off paper the same way the dark
    // slab reads as raised off the night board.
    blocker: {
      top: ["#eeeae0", "#d3cdbd"],
      edge: "rgba(33, 28, 22, 0.15)",
    },
    // Beams rely on translucency reading against the board -- the same
    // alpha that glows nicely on a dark board washes out on paper, so
    // every "mid"/"glow" pair shifts darker and more saturated here.
    beam: {
      red: { core: CORE.red, mid: "#e2321f", glow: "226, 50, 31" },
      green: { core: CORE.green, mid: "#159249", glow: "21, 146, 73" },
      blue: { core: CORE.blue, mid: "#245fc9", glow: "36, 95, 201" },
      yellow: { core: CORE.yellow, mid: "#c48a06", glow: "196, 138, 6" },
      cyan: { core: CORE.cyan, mid: "#0a8fa8", glow: "10, 143, 168" },
      magenta: { core: CORE.magenta, mid: "#b026c9", glow: "176, 38, 201" },
      white: { core: CORE.white, mid: "#33363d", glow: "51, 54, 61" },
    },
  },
};

function normalize(name) {
  return name === "light" ? "light" : "dark";
}

let current = normalize(safeGet());

function safeGet() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function safeSet(name) {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // storage unavailable -- theme just won't persist across reloads
  }
}

export function getThemeName() {
  return current;
}

export function getTheme() {
  return THEMES[current];
}

export function setTheme(name) {
  current = normalize(name);
  document.documentElement.dataset.theme = current;
  safeSet(current);
}

export function toggleTheme() {
  setTheme(current === "dark" ? "light" : "dark");
}

// Applies the saved (or default) theme to the document -- call once on load.
setTheme(current);
