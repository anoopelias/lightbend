import { clearProgress } from "./storage.js";

// Owns the level-navigation UI: the prev/next buttons, the level dropdown,
// and the reset-progress button. Also tracks the solved -> next-level
// transition across frames (see updateForFrame) since that's driven by the
// same per-level state as everything else here.
export function createLevelNav({ state, view, dragController }) {
  const nextLevelBtn = document.getElementById("next-level");
  const prevLevelBtn = document.getElementById("prev-level");
  const levelSelect = document.getElementById("level-select");
  const resetBtn = document.getElementById("reset-progress");

  // Rebuilds the dropdown's options -- only levels reached so far are
  // selectable -- and syncs its value to the current level.
  function syncLevelSelect() {
    levelSelect.innerHTML = "";
    for (let i = 0; i < state.levelCount; i++) {
      const option = document.createElement("option");
      option.value = i;
      option.textContent = `Level ${i + 1}`;
      option.disabled = i > state.maxLevelReached;
      levelSelect.appendChild(option);
    }
    levelSelect.value = state.levelIndex;
  }

  function afterLevelChange() {
    view.loadLevel(state);
    dragController.views = view.toolViews;
    dragController.syncPalette();
    syncLevelSelect();
  }

  nextLevelBtn.addEventListener("click", () => {
    state.nextLevel();
    afterLevelChange();
  });

  prevLevelBtn.addEventListener("click", () => {
    state.prevLevel();
    afterLevelChange();
  });

  levelSelect.addEventListener("change", () => {
    state.goToLevel(Number(levelSelect.value));
    afterLevelChange();
  });

  resetBtn.addEventListener("click", () => {
    if (window.confirm("Clear saved progress? This resets every level back to blank.")) {
      clearProgress();
      window.location.reload();
    }
  });

  syncLevelSelect();

  let wasSolved = false;

  // Called once per frame with this frame's hitTargets -- advances to the
  // next level on the solved rising edge, and keeps the nav buttons synced
  // to the solved/complete state.
  function updateForFrame(hitTargets) {
    const solved = state.targets.length > 0 && state.targets.every((t) => hitTargets.has(t));
    if (solved && !wasSolved && state.hasNextLevel) {
      state.reachLevel(state.levelIndex + 1);
      syncLevelSelect();
    }
    wasSolved = solved;

    const allComplete = solved && !state.hasNextLevel;
    nextLevelBtn.disabled = !(solved && state.hasNextLevel);
    nextLevelBtn.textContent = allComplete ? "✓" : "→";
    nextLevelBtn.title = allComplete ? "All levels complete" : "Next level";
    nextLevelBtn.classList.toggle("next-level-btn--complete", allComplete);
    prevLevelBtn.disabled = !state.hasPrevLevel;
  }

  return { updateForFrame };
}
