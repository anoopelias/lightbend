# raybend

A Chromatron-inspired laser puzzle game. Bend a beam of light through mirrors
to hit the target. Vanilla HTML/CSS/JS, no build step.

## Run

```
python3 devserver.py
```

Then open http://localhost:8934.

## Structure

- `logic.js` — game state and beam-tracing rules (grid-space, no rendering)
- `render.js` — canvas drawing, input, and animation
- `index.html` / `style.css` — page shell and styling
