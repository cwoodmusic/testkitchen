# The Quiet Bell

The Quiet Bell is the story-puzzle evolution of Rhythm Blocks. Its first playable page, **The parcel**, replaces the falling-block interface at `games/rhythm-blocks/`. The URL, arcade game ID `rhythm-blocks`, and host key `rhythmBlocks` stay stable. Open `index.html` over HTTP or launch the game through the arcade. No build step or external service is required.

Mira receives nine musical tiles at the parcel depot. Nell the postkeeper, Iris the gardener, and Pip the courier each have a place in the story, a reason to care about the silent bell, and a different route to suggest. Select a resident to talk about their story, a way forward, or the notes you are carrying. Their example rhythms can be heard without spending tiles or filling the answer.

Choose tiles from the satchel to arrange an ordered answer totaling exactly four beats. Listen before committing, or return placed tiles to try another phrase. There is no falling timer, movement grid, combat, score, or penalty for experimenting. Committing spends the actual tiles used. Unspent tiles carry forward, and a parcel of three new tiles is added for the next stop.

The first page has three outcomes. A rest first leads to the Garden Gate and takes priority over every other pattern. Otherwise, two or more grouped-note tiles lead to Makers Lane. All other four-beat answers lead to the Canal Landing. The grouped tiles are paired eighths, four sixteenths, and paired sixteenths; a single eighth is not a grouped tile. Different note orders can therefore lead to different destinations even when their total duration matches.

This release ends with the first-page outcome and the carried inventory for the next stop. The next story page, the later promises and seals, the complete chapter, profile endings, and currency rewards are not implemented here. An opening choice does not earn a later-page promise or flag. The outcome can be revisited to try another answer.

Quarter notes, paired eighths, four sixteenths, and quarter rests each fill one beat. Half notes and half rests fill two beats; dotted halves fill three. Single eighths and paired sixteenths each fill half a beat. Whole notes and whole rests are excluded. Rests play as silence; grouped notes sound their individual attacks at the proper subdivisions.

Use the visible controls with a mouse, touch, or the keyboard’s native focus and activation keys. Keys 1–9 choose note kinds in the displayed inventory order; Backspace undoes the latest answer edit. Enter and Space activate the focused button. Escape closes the instructions. Select a person and dialogue topic, choose note tiles, listen, return tiles, and commit when the answer reaches four beats. Use the restart button to begin again; there is no restart shortcut. Sound is optional, starts only after an explicit action, and reuses the existing sound preference. Exit returns to the arcade host when embedded.

The device-only save key `codaQuietBellPageOneV1` stores the draft or committed answer and the selected conversation. Committed progress is replayed against the opening rules so consumed tiles, carried inventory, and the single three-tile arrival remain consistent; reloading does not award another parcel. This save does not synchronize across devices. Existing falling-game scores, arcade progress, profile data, and Notes balances are preserved.

`opening.mjs` contains the opening characters, dialogue, and three outcome tableaux. The prior falling-block engine remains in `engine.mjs` for further development and regression checks; it is not the current interface. `notation.mjs` supplies inline musical engraving; see `NOTATION-SOURCES.md` and `NOTATION-LICENSE.txt`. `audio.mjs` synthesizes rhythms locally with Web Audio.

From the repository root, run:

```sh
node --test games/rhythm-blocks/*.test.mjs tests/arcade-host.test.cjs tests/bundled-games.test.cjs
python tests/rhythm-blocks-browser.py
python tests/rhythm-blocks-launch-browser.py
```

The Node suite covers game rules and the stable host/bundled-game contracts. Browser coverage exercises the new opening interface and its arcade launch. Browser tests require Python Playwright and Chromium.
