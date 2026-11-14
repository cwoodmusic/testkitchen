# Rhythm Blocks

A standalone, static falling-note puzzle for Coda Arcade. Open `index.html` over HTTP, or choose **Games → Rhythm Blocks** in the arcade. No build step or external services are required.

The board is ten columns wide and twenty-four rows tall. Each falling block contains one of ten note/rest symbols. Connected horizontal or vertical sequences totaling four beats flash and clear for 200 points. Eight-beat patterns take priority and earn 500 points. Simultaneous patterns add 100 points per extra pattern; cascade waves multiply the award. Columns collapse after a clear. A whole note or whole rest clears by itself because it already represents four beats. Eight-beat patterns can be made with, for example, dotted half + dotted half + half.

Quarter notes, beamed pairs of eighths, groups of four sixteenths and quarter rests each represent one beat. Half notes/rests represent two; whole notes/rests four; a single eighth represents half a beat; a dotted half represents three. Rests are included in the total and sound as silence when a cleared rhythm plays.

Level one falls one cell every 1,050 ms, with 85% one-beat blocks. Every 1,000 points increases the level, accelerates falling (bounded at 150 ms/cell), and increases the frequency of single eighth notes and dotted halves. Drops do not award points. The game ends when any settled block reaches the top, after any available rescue clears finish.

Use arrows or A/D to move, down or S to lower, Space to drop, P/Escape to pause, and R to restart. Touch controls support holding a direction or lowering. Leaving the tab pauses play; returning requires Resume. Sound can be toggled. The high score and sound preference save on this browser only, under dedicated Rhythm Blocks keys. Existing arcade progress is untouched.

`engine.mjs` contains exact integer half-beat arithmetic, scoring, weighted selection and deterministic state transitions. `notation.mjs` supplies inline SVG musical symbols; see `NOTATION-SOURCES.md` and `NOTATION-LICENSE.txt`. `audio.mjs` synthesizes cleared rhythms locally with Web Audio. The renderer updates only when game state changes.

Run `node --test games/rhythm-blocks/*.test.mjs tests/arcade-host.test.cjs`, `python tests/rhythm-blocks-browser.py`, and `python tests/rhythm-blocks-launch-browser.py` from the repository root. Browser tests require Python Playwright and Chromium.
