// ---------- Progress persistence (localStorage) ----------
//
// Remembers which level the player's on and how they've placed tools on
// each level they've visited, so reloading the page (or coming back to an
// earlier level) picks up where they left off instead of starting blank.

const STORAGE_KEY = "raybend-progress-v1";

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // storage unavailable (private browsing, quota) -- just skip saving
  }
}
