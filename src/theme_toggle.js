import { getThemeName, toggleTheme } from "./theme.js";

// Hand-drawn rather than emoji -- an emoji glyph's shape and weight are up
// to whatever font the OS picks, which is exactly what left the crescent
// moon pale and the "new moon" disc unrecognizable as a moon at all.
// `currentColor` ties the moon to the button's own (theme-driven) ink
// color, so its contrast is never in question. The sun instead takes the
// app's own warm accent plus a soft drop-shadow glow, echoing the same
// glow already used on the logo and the next-level button, rather than
// reading as just another flat ink-colored icon.
const SUN_ICON = `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff9f1c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 3px rgba(255, 159, 28, 0.85))">
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="4" />
    <line x1="12" y1="20" x2="12" y2="22" />
    <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
    <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
    <line x1="2" y1="12" x2="4" y2="12" />
    <line x1="20" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
    <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
  </svg>`;

const MOON_ICON = `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>`;

// Wires up the theme toggle button. `onToggle` fires after the theme has
// switched, for callers with their own theme-dependent state to resync
// (e.g. the palette's icons, which carry theme colors of their own).
export function setupThemeToggle(button, onToggle) {
  // Shows the theme the button switches *to*, not the current one -- a
  // moon invites you into the dark, a sun invites you back out.
  function sync() {
    const isDark = getThemeName() === "dark";
    button.innerHTML = isDark ? SUN_ICON : MOON_ICON;
    button.title = isDark ? "Switch to light theme" : "Switch to dark theme";
    button.setAttribute("aria-label", button.title);
  }

  button.addEventListener("click", () => {
    toggleTheme();
    sync();
    onToggle?.();
  });

  sync();
}
