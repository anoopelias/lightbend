# LightBend

A Chromatron-inspired laser puzzle game. Bend a beam of light through mirrors
and splitters to hit the target. Vanilla HTML/CSS/JS, no build step.

## Run

```
python3 devserver.py
```

Then open http://localhost:8934.

## Structure

- `src/game_state.js` — game state and beam-tracing rules (grid-space, no rendering)
- `src/board.js` — canvas geometry and responsive sizing
- `src/draw.js` — canvas drawing
- `src/input.js` — drag/rotate input handling
- `src/view_state.js` — transient (non-game) view state, e.g. animation
- `src/storage.js` — progress persistence (localStorage)
- `src/render.js` — orchestrates the above and runs the animation loop
- `index.html` / `style.css` — page shell and styling
