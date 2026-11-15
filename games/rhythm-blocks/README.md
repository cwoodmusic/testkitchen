# The Quiet Bell

The Quiet Bell is the dungeon-puzzle evolution of Rhythm Blocks. Its first playable room replaces the falling interface at `games/rhythm-blocks/`; the URL, arcade game ID `rhythm-blocks`, and host key `rhythmBlocks` stay stable. Choose **Games → The Quiet Bell** in the arcade. It runs as static files with no build step or external service.

The room fills the browser viewport without document scrolling. A camera follows Mira across the room, including narrow portrait screens. Only the location, small square Inventory/Settings icons, and contextual interaction controls remain during exploration. Conversations, the bag, door puzzles, settings, and the arrival preview appear in temporary panels.

Mira starts with an empty satchel in the Parcel Depot. Walk with arrows/WASD, click or tap the floor, or use the on-screen arrows on a touch device. Selecting a person, chest, or door makes Mira walk over and interact. E or Space interacts with the closest object in reach. Nell’s parcel and a door’s lock require Mira to be nearby. Collision uses her feet and prevents walking through walls, the counter, residents, and the chest.

Nell the postkeeper offers eight note types through conversation; the delivery chest contains the missing half note. Both can be collected once per run, in either order. Iris the gardener and Pip the courier have their own stories and clues about the room’s three physical doors. Approaching a resident opens a conversation; approaching a door opens its rhythm editor. Taking the parcel closes the conversation and returns to exploration. I or the Notes control opens a read-only bag; the actual editor is available at a door.

Choose a door and arrange its exact ordered four-beat key. The garden requires a half rest followed by a half note. The workshop requires a half note, paired eighths, then four sixteenths. The canal requires a half note, a quarter, then paired eighths. Hear a lock or a resident’s example without spending notes. Another four-beat rhythm does not open the selected lock and does not spend anything.

Opening a door consumes only its key; unspent notes travel onward. Walking through a door gives no automatic notes. Future sources are authored conversations, chests, and hidden caches. The balanced dungeon plan is in `design/music-puzzler/dungeon.json`; its verifier checks every reachable inventory and pickup order so all three regular and two secret endings use every note. Four explicit dead ends may retain notes. Only the depot and its three departure outcomes are currently playable; later rooms and hidden doors are planned in the checked graph.

Undo returns a staged note. After opening a door, Revisit restores the collected notes and leaves the parcel/chest receipts intact, so they cannot be collected again. Start over begins a new run with an empty satchel and resets those sources; the names of discovered paths remain informational.

Quarter notes, paired eighths, four sixteenths, and quarter rests each fill one beat. Half notes and half rests fill two, dotted halves fill three, and single eighths and paired sixteenths each fill half a beat. Rests sound as silence. There is no falling timer, combat, score, or penalty for listening and experimenting.

Click or tap people, doors, and the chest to approach them. While a lock is open, keys 1–9 choose note types in inventory order and Backspace undoes. Native Tab, Enter, and Space work with controls. Escape closes a panel or opens Settings during exploration. Settings contains Sound, How to play, Start over, and Return to arcade. Every open panel pauses movement; leaving the window, hiding the tab, and exiting clear held input. The arrival preview pauses movement until the answer is revisited. Sound starts only after an explicit action and reuses the existing sound preference. The return link preserves the arcade’s same-origin close protocol.

The device-only key `codaQuietBellPageOneV1` stores a version-2 action log of claimed sources and the chosen door, plus the draft, conversation, and room position. A saved position is accepted only on walkable floor; malformed or blocked positions use the room’s spawn. Position is saved when movement stops or an interaction happens, not every animation frame. Reload reconstructs resources from those actions rather than trusting saved balances. Invalid histories cannot duplicate a gift or forge a paid door. The earlier version-1 opening save starts a fresh run under these new rules. Falling-game scores, shared profiles, arcade progress, and Notes balances remain untouched; cloud sync and currency rewards are not implemented.

`room.mjs` supplies data-driven room bounds, obstacles, targets, swept-circle movement, and pathfinding. `room-view.mjs` renders Mira, accepts keyboard/touch/floor navigation, follows her with a bounded cover camera, and reports nearby interactions without touching inventory. It schedules frames only while movement needs them. The transparent twelve-pose sheet is bundled as `assets/mira-walk.webp`; `mira.mjs` holds measured foot anchors. Foreground copies of the room art preserve depth when Mira walks behind residents or the chest.

`story.mjs` implements the opening inventory and locks; `opening.mjs` holds the characters and dialogue. `engine.mjs` retains the earlier falling-game engine and shared note catalog for regression checks. `notation.mjs` supplies musical engraving; see its license/source files. `audio.mjs` synthesizes the true note subdivisions locally. The room artwork is bundled in `assets/parcel-depot.jpg`.

Run from the repository root:

```sh
node --test games/rhythm-blocks/*.test.mjs tests/arcade-host.test.cjs tests/bundled-games.test.cjs design/music-puzzler/*.test.mjs
node design/music-puzzler/dungeon-analyze.mjs
python tests/rhythm-blocks-browser.py
python tests/rhythm-blocks-launch-browser.py
```

Browser tests require Python Playwright and Chromium.
