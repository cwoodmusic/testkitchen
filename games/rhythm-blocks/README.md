# Rhythm Blocks

A standalone, static falling-note puzzle for Coda Arcade. Open `index.html` over HTTP, or choose **Games → Rhythm Blocks** in the arcade. No build step or external services are required.

The ten-column, twenty-four-row board now uses seven connected four-square shapes: I, O, T, S, Z, J and L. A shuffled seven-piece bag supplies every shape before repeating. Each square contains its own note or rest, and each piece mixes at least two beat values. Moving, rotating and dropping always moves the complete piece; the ghost and next preview show all four notes.

A complete uninterrupted horizontal or vertical run totaling exactly four beats flashes and clears for 200 points; eight beats earns 500. Every connected square in that run counts, and a gap or board edge ends it. A longer run cannot clear a four- or eight-beat subsection automatically: a six-beat run must reach eight or be broken by a crossing clear. A pattern must contain at least two squares from different dropped pieces: shapes and whole notes cannot score by clearing themselves. Simultaneous patterns add 100 points per extra pattern; cascade waves multiply the award. Cleared columns collapse, carrying each square's original piece identity into the next wave. An eight-beat pattern can be dotted half + dotted half + half, or two whole notes from different pieces.

Quarter notes, pairs of eighths, groups of four sixteenths and quarter rests each represent one beat. Half notes/rests represent two; whole notes/rests four; single eighths and pairs of sixteenths each represent half a beat; dotted halves represent three. Rests count toward patterns and sound as silence when a cleared rhythm plays. Grouped notes play their individual attacks at the proper subdivisions.

Level one falls one row every 1,050 ms. One-beat values dominate the initial draws, with at least one different value in each shape. Every 1,000 points increases the level, accelerates falling (bounded at 150 ms/row), and increases shorter notes and dotted halves. Drops award no points. The game ends when a settled square reaches the top or the next piece cannot spawn, after any rescue clears finish.

Use left/right or A/D to move; up or X to rotate clockwise; Z to rotate counterclockwise; down or S to lower; Space to drop; P/Escape to pause; R to restart. Rotation tries bounded wall/floor adjustments without moving through occupied squares. Touch controls include rotation and held movement/lowering. Leaving the tab pauses play and requires Resume. Sound can be toggled.

The shaped game uses its own local best-score key, separate from the earlier single-square game's record; the old score is preserved. The sound preference is shared. Existing arcade progress is untouched, and no data is synchronized across devices.

`engine.mjs` contains exact integer half-beat arithmetic, piece geometry, matching, scoring, weighted selection and deterministic state transitions. `notation.mjs` supplies inline SVG musical symbols; see `NOTATION-SOURCES.md` and `NOTATION-LICENSE.txt`. `audio.mjs` synthesizes cleared rhythms locally with Web Audio. The renderer updates only when game state changes.

Run `node --test games/rhythm-blocks/*.test.mjs tests/arcade-host.test.cjs tests/bundled-games.test.cjs`, `python tests/rhythm-blocks-browser.py`, and `python tests/rhythm-blocks-launch-browser.py` from the repository root. Browser tests require Python Playwright and Chromium.
