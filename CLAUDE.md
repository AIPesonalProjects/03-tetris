# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris. Three files, no dependencies, no build step, no package.json:

- `index.html` — DOM structure, two `<canvas>` elements (board 300×600, next-piece preview 120×120)
- `style.css` — dark/retro arcade styling
- `game.js` — all game logic (~300 lines)

README.md (in Spanish) has a full write-up of mechanics and architecture if deeper context is needed.

## Running

No install/build required. Either open `index.html` directly in a browser, or serve statically:

```bash
python3 -m http.server 8000
# or
npx serve .
```

There is no test suite, linter, or bundler configured.

## Architecture (game.js)

Single-file, global-state game loop — no modules, no classes, no framework.

- **Board model**: `board` is a `ROWS × COLS` matrix (20×10); each cell is `0` (empty) or a color index `1–7` identifying which piece locked there.
- **Pieces**: `PIECES` array holds the 7 tetrominoes as square matrices. Rotation is done via `rotateCW` (transpose + row reverse), not precomputed rotation states.
- **Collision**: `collide(shape, ox, oy)` checks board bounds and overlap with locked cells; used for movement, rotation, and ghost-piece projection.
- **Wall kicks**: `tryRotate()` attempts the rotated shape at offsets `[0, -1, 1, -2, 2]` columns, keeping the first that doesn't collide.
- **Game loop**: `loop(ts)` runs via `requestAnimationFrame`, accumulates elapsed time in `dropAccum`, and advances the piece one row once `dropAccum >= dropInterval`.
- **Line clearing**: `clearLines()` scans bottom-up, splices out full rows and unshifts empty ones at the top; re-checks the same row index after a splice.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; hard drop adds 2 pts/row dropped, soft drop adds 1 pt/row.
- **Leveling/speed**: level = `floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
- **Ghost piece**: `ghostY()` projects the current piece straight down until it would collide, drawn at `globalAlpha = 0.2`.

Key tunables live as top-of-file constants: `COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, and the initial `dropInterval` in `init()`. If `COLS`/`ROWS`/`BLOCK` change, update the `<canvas id="board">` `width`/`height` in `index.html` to match (`COLS × BLOCK` by `ROWS × BLOCK`).

Controls (keydown handler at bottom of `game.js`): arrows to move/soft-drop, `↑`/`X` to rotate, `Space` for hard drop, `P` to pause.
