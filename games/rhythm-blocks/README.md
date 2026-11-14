# Rhythm Blocks

A standalone, static falling-note puzzle for Coda Arcade. Open `index.html` over HTTP, or choose **Games → Rhythm Blocks** in the arcade. No build step or external services are required.

The ten-column, twenty-four-row board uses seven connected four-square shapes: I, O, T, S, Z, J and L. A shuffled seven-piece bag supplies every shape before repeating. Each square contains its own note or rest, and each piece mixes at least two beat values. Moving, rotating and dropping moves the complete piece; the ghost and next preview show all four notes.

Any contiguous horizontal or vertical sequence totaling exactly four beats flashes and clears. It can occur inside a longer line or within one piece. Each run earns 200 points. Non-overlapping runs on the same axis count separately, so eight quarters form two four-beat runs. Overlapping same-axis windows do not double-score shared notes; crossing horizontal/vertical runs can form a combo. Gaps and board edges end a sequence. There is no separate eight-beat target.

Completing multiple runs in one drop earns 100 extra points per additional run: two simultaneous runs earn 500 points; three earn 800. Cleared columns collapse and may create chain reactions before the next piece spawns. Cascade waves multiply their base run points, while every additional run within that drop adds another 100-point combo bonus. For example, one run followed by one cascade run earns 200 + (400 + 100) = 700 points. Combo counts reset for the next dropped piece.

Nine note/rest kinds are available. Quarter notes, pairs of eighths, groups of four sixteenths and quarter rests each represent one beat. Half notes and half rests represent two; single eighths and pairs of sixteenths each represent half a beat; dotted halves represent three. Whole notes and whole rests are excluded. Rests count toward patterns and sound as silence when a cleared rhythm plays. Grouped notes play their individual attacks at the proper subdivisions.

Level one falls one row every 1,050 ms. One-beat values dominate the initial draws, with at least one different value in each shape. Every 1,000 points increases the level, accelerates falling (bounded at 150 ms/row), and increases shorter notes and dotted halves. Drops award no points by themselves. The game ends when a settled square reaches the top or the next piece cannot spawn, after any rescue clears finish.

Use left/right or A/D to move; up or X to rotate clockwise; Z to rotate counterclockwise; down or S to lower; Space to drop; P/Escape to pause; R to restart. Rotation tries bounded wall/floor adjustments without moving through occupied squares. Touch controls include rotation and held movement/lowering. Leaving the tab pauses play and requires Resume. Sound can be toggled.

This ruleset uses its own local best-score key. Earlier single-square and complete-run shaped records are preserved. The sound preference is shared. Existing arcade progress is untouched; no data is synchronized across devices.

`engine.mjs` contains exact integer half-beat arithmetic, piece geometry, matching, scoring, weighted selection and deterministic state transitions. `notation.mjs` supplies inline SVG musical symbols; see `NOTATION-SOURCES.md` and `NOTATION-LICENSE.txt`. `audio.mjs` synthesizes cleared rhythms locally with Web Audio. The renderer updates only when game state changes.

Run `node --test games/rhythm-blocks/*.test.mjs tests/arcade-host.test.cjs tests/bundled-games.test.cjs`, `python tests/rhythm-blocks-browser.py`, and `python tests/rhythm-blocks-launch-browser.py` from the repository root. Browser tests require Python Playwright and Chromium.
