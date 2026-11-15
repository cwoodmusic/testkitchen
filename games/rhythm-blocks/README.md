# The Quiet Bell

The Quiet Bell is the dungeon-puzzle evolution of Rhythm Blocks. Its first playable room replaces the falling interface at `games/rhythm-blocks/`; the URL, arcade game ID `rhythm-blocks`, and host key `rhythmBlocks` stay stable. Choose **Games → The Quiet Bell** in the arcade. It runs as static files with no build step or external service.

Mira starts with an empty satchel in the Parcel Depot. Nell the postkeeper offers eight note types through conversation; the delivery chest contains the missing half note. Both can be collected once per run, in either order. Iris the gardener and Pip the courier have their own stories and clues about the room’s three physical doors.

Choose a door and arrange its exact ordered four-beat key. The garden requires a half rest followed by a half note. The workshop requires a half note, paired eighths, then four sixteenths. The canal requires a half note, a quarter, then paired eighths. Hear a lock or a resident’s example without spending notes. Another four-beat rhythm does not open the selected lock and does not spend anything.

Opening a door consumes only its key; unspent notes travel onward. Walking through a door gives no automatic notes. Future sources are authored conversations, chests, and hidden caches. The balanced dungeon plan is in `design/music-puzzler/dungeon.json`; its verifier checks every reachable inventory and pickup order so all three regular and two secret endings use every note. Four explicit dead ends may retain notes. Only the depot and its three departure outcomes are currently playable; later rooms and hidden doors are planned in the checked graph.

Undo returns a staged note. After opening a door, Revisit restores the collected notes and leaves the parcel/chest receipts intact, so they cannot be collected again. Start over begins a new run with an empty satchel and resets those sources; the names of discovered paths remain informational.

Quarter notes, paired eighths, four sixteenths, and quarter rests each fill one beat. Half notes and half rests fill two, dotted halves fill three, and single eighths and paired sixteenths each fill half a beat. Rests sound as silence. There is no falling timer, combat, score, or penalty for listening and experimenting.

Click or tap people, doors, and the chest. Keys 1–9 choose note types in inventory order; Backspace undoes. Native Tab, Enter, and Space work with the controls; Escape closes instructions. Sound starts only after an explicit action and reuses the existing sound preference. The return link preserves the arcade’s same-origin close protocol.

The device-only key `codaQuietBellPageOneV1` now stores a version-2 action log of claimed sources and the chosen door, plus the draft and conversation. Reload reconstructs resources from those actions rather than trusting saved balances. Invalid histories cannot duplicate a gift or forge a paid door. The earlier version-1 opening save starts a fresh run under these new rules. Falling-game scores, shared profiles, arcade progress, and Notes balances remain untouched; cloud sync and currency rewards are not implemented.

`story.mjs` implements the opening inventory and locks; `opening.mjs` holds the characters and dialogue. `engine.mjs` retains the earlier falling-game engine and shared note catalog for regression checks. `notation.mjs` supplies musical engraving; see its license/source files. `audio.mjs` synthesizes the true note subdivisions locally. The original room artwork is bundled in `assets/parcel-depot.jpg`.

Run from the repository root:

```sh
node --test games/rhythm-blocks/*.test.mjs tests/arcade-host.test.cjs tests/bundled-games.test.cjs design/music-puzzler/*.test.mjs
node design/music-puzzler/dungeon-analyze.mjs
python tests/rhythm-blocks-browser.py
python tests/rhythm-blocks-launch-browser.py
```

Browser tests require Python Playwright and Chromium.
