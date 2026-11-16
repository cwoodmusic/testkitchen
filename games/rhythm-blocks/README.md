# The Quiet Bell

The Quiet Bell is the dungeon-puzzle evolution of Rhythm Blocks. Its first playable room replaces the falling interface at `games/rhythm-blocks/`; the URL, arcade game ID `rhythm-blocks`, and host key `rhythmBlocks` stay stable. Choose **Games → The Quiet Bell** in the arcade. It ships as static files and uses no runtime service or package installation.

The room fills the browser viewport without document scrolling. A camera follows Mira across the room, including narrow portrait screens. Only the location, small square Inventory/Settings icons, and contextual interaction controls remain during exploration. Conversations, the bag, door puzzles, settings, and the arrival preview appear in temporary panels.

The room and all four characters use the selected Pocket Pixel style: compact proportions, large readable pixel clusters, warm dark outlines, simple faces, and a small palette. Mira keeps her blue bow, blue coat, and backpack; Nell her gray bun, glasses, and burgundy outfit; Iris her flowered garden hat and green overalls; Pip his teal cap, gold goggles, and satchel. The room keeps its orthographic layout, parallel edges, three doors, post counter, music decorations, and delivery chest. The artwork and transparent twelve-pose walking sheet are stored as lossless WebP assets. Measured boot anchors and foreground silhouettes keep the sprites grounded and preserve depth around the residents and chest.

The setting is the Lumen Reach: floating islands connected by a worn star-post network, living conduits, light canals, and inherited crystal machinery. The depot occupies a former sky-survey hall. Its warm returned mail, clockwork roost, sleeping dispatch screen, route orrery, and star-post receiver can be approached and inspected with E/Space or a click/tap. Each opens a short observation and keeps that discovered text in the journal across runs. These inspections leave note inventory, door payments, and the discovered map unchanged. Nell, Iris, and Pip connect the machinery to ordinary deliveries, gardening, repairs, and missing replies.

The room-by-room world guide in `design/music-puzzler/worldbuilding.json` and `worldbuilding.md` gives all fourteen authored locations a landmark, daily use, trace of the past, unanswered question, and inspection props. Thirteen locations remain planned; the depot is the playable example of that direction.

The same game address checks for the latest published release whenever it opens or reloads. Each release keeps its HTML, scripts, styles, and artwork together under a content-versioned directory, so a cached arcade page or old version parameter cannot mix old and new game files. The address and origin stay unchanged, preserving local notes, discoveries, settings, and the arcade return protocol. The game never reloads itself during a puzzle and never clears browser storage. GitHub Pages publishing and CDN propagation can still take a few minutes; no manual cache clearing is needed after the updated launcher has loaded once.

Mira starts with an empty satchel in the Parcel Depot. Walk with arrows/WASD, click or tap the floor, or use the on-screen arrows on a touch device. Selecting a person, chest, or door makes Mira walk over and interact. E or Space interacts with the closest object in reach. Nell’s parcel and a door’s lock require Mira to be nearby. Collision uses her feet and prevents walking through walls, the counter, residents, and the chest.

Nell the postkeeper offers eight note types through conversation; the delivery chest contains the missing half note. Both can be collected once per run, in either order. Iris the gardener and Pip the courier have their own stories and clues about the room’s three physical doors. Approaching a resident opens a conversation; approaching a door opens its rhythm editor. Taking the parcel closes the conversation and returns to exploration. I or the Notes control opens a read-only bag; the actual editor is available at a door.

Choose a door and arrange its exact ordered four-beat key. The garden requires a half rest followed by a half note. The workshop requires a half note, paired eighths, then four sixteenths. The canal requires a half note, a quarter, then paired eighths. Hear a lock or a resident’s example without spending notes. Another four-beat rhythm does not open the selected lock and does not spend anything.

Opening a door consumes only its key; unspent notes travel onward. Walking through a door gives no automatic notes. Future sources are authored conversations, chests, and hidden caches. The balanced dungeon plan is in `design/music-puzzler/dungeon.json`; its verifier checks every reachable inventory and pickup order so all three regular and two secret endings use every note. Four explicit dead ends may retain notes. Only the depot and its three departure outcomes are currently playable; later rooms and hidden doors are planned in the checked graph.

Undo returns a staged note. After opening a door, Revisit restores the collected notes and leaves the parcel/chest receipts intact, so they cannot be collected again. Start over begins a new run with an empty satchel and resets those sources; permanent discoveries remain informational.

The pause screen draws a journey chart from rooms actually reached and connections actually travelled, accumulated across runs. It shows no unknown branches, placeholders, locked names, or completion totals. Reading a resident’s route clue adds it to the journal without revealing a place or connection on the chart. Successful opening locks record their arrival locations, not dungeon endings. Revisit, Start over, and reload preserve discoveries separately from the current run’s notes. Existing opening door discoveries migrate into the chart.

The ultimate achievement, **The Complete Score**, requires every authored location, travelled connection, and outcome across runs, including secret endings and dead ends. The achievement is disabled while only the opening is released; finding its three doors cannot complete the dungeon. The deeper replay routes and companion finales remain planned in `design/music-puzzler/replay-and-party.md`.

Quarter notes, paired eighths, four sixteenths, and quarter rests each fill one beat. Half notes and half rests fill two, dotted halves fill three, and single eighths and paired sixteenths each fill half a beat. Rests sound as silence. There is no falling timer, combat, score, or penalty for listening and experimenting.

Click or tap people, doors, and the chest to approach them. While a lock is open, keys 1–9 choose note types in inventory order and Backspace undoes. Native Tab, Enter, and Space work with controls. Escape closes a panel or pauses during exploration. The settings icon opens the same pause screen, with the journey chart, discovered journal, Sound, How to play, Start over, and Return to arcade. The arrival preview also offers Your journey. Every open panel pauses movement; leaving the window, hiding the tab, and exiting clear held input. The arrival preview pauses movement until the answer is revisited. Sound starts only after an explicit action and reuses the existing sound preference. The return link preserves the arcade’s same-origin close protocol.

The device-only key `codaQuietBellPageOneV1` stores a version-2 action log of claimed sources and the chosen door, plus the draft, conversation, and room position. A saved position is accepted only on walkable floor; malformed or blocked positions use the room’s spawn. Position is saved when movement stops or an interaction happens, not every animation frame. Reload reconstructs resources from those actions rather than trusting saved balances. Invalid histories cannot duplicate a gift or forge a paid door. The earlier version-1 opening save starts a fresh run under these new rules. Falling-game scores, shared profiles, arcade progress, and Notes balances remain untouched; cloud sync and currency rewards are not implemented.

`codaQuietBellJourneyV1` stores only observed IDs for places, connections, clues, and outcomes. `journey.mjs` filters them against a trusted catalog, supplies immutable discovered-only snapshots, and checks the completion predicate. `journey-view.mjs` renders only those snapshots. Unknown saved entries and forged achievement records are ignored; labels and clue text come from the catalog.

`room.mjs` supplies data-driven room bounds, obstacles, targets, swept-circle movement, and pathfinding. `room-view.mjs` renders Mira, accepts keyboard/touch/floor navigation, follows her with a bounded cover camera, and reports nearby interactions without touching inventory. It schedules frames only while movement needs them. The transparent twelve-pose sheet is bundled as `assets/mira-walk.webp`; `mira.mjs` holds measured foot anchors. Foreground copies of the room art preserve depth when Mira walks behind residents or the chest.

`story.mjs` implements the opening inventory and locks; `opening.mjs` holds the characters and dialogue, and `lore.mjs` holds the five environmental observations. `engine.mjs` retains the earlier falling-game engine and shared note catalog for regression checks. `notation.mjs` supplies musical engraving; see its license/source files. `audio.mjs` synthesizes the true note subdivisions locally. The room artwork is bundled in `assets/parcel-depot.webp`.

Edit `game.html` and the runtime source files, rather than generated `index.html`, `release.json`, or the contents of `releases/`. Before testing or publishing any runtime change, run `node games/rhythm-blocks/build-release.mjs`. It creates an immutable release, updates the launcher and current release manifest, and keeps earlier releases available for already open or cached sessions. Commit the generated files with their source change. The release test checks that the published bundle matches the current source, so a forgotten rebuild fails the checks. Ordinary game changes no longer need manual cache-version edits in the arcade or module imports.

Run from the repository root:

```sh
node games/rhythm-blocks/build-release.mjs
node --test games/rhythm-blocks/*.test.mjs tests/arcade-host.test.cjs tests/bundled-games.test.cjs design/music-puzzler/*.test.mjs
node design/music-puzzler/dungeon-analyze.mjs
python tests/rhythm-blocks-browser.py
python tests/rhythm-blocks-launch-browser.py
python tests/quiet-bell-journey-browser.py
python tests/quiet-bell-journey-renderer-browser.py
python tests/quiet-bell-updates-browser.py
python tests/quiet-bell-worldbuilding-browser.py
```

Browser tests require Python Playwright and Chromium.
