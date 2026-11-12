# Town rhythm adventures

Both activities work in **Walk test** in Town Builder and **Play this town**.
They leave the saved map unchanged. Town stars and the coastal fish journal save
on this device for the active town player; standalone town uses its guest save.
These stars are separate from the arcade Notes wallet and the existing cave
fishing journal.

## Rhythm Catch

With **NPCs on**, approach the coffee-cart host and press **E** (or tap the
interaction prompt). Choose **Play Rhythm Catch**. If a map has other vendors
but no coffee cart, the first available vendor hosts the game.

Watch **1 · 2 · Ready · GO!**, then listen to the four-beat rhythm twice. Borrow
a big net and walk around town to collect the quarter, eighth and half notes
that make the rhythm. Floating notes spawn on connected, walkable ground near
the host. Additional note values are decoys. Nothing is placed in the map JSON.

- **WASD / arrows:** walk; **Shift:** run.
- **Space** or **Swing net:** catch a nearby note. Clicking the canvas aims and swings.
- **R / Hear rhythm:** replay the example without losing caught notes.
- **Escape / Leave:** leave the hunt.

Once all needed notes are caught, arrange them in the order you heard. Undo,
replay and check as often as needed. Completing a rhythm earns one to three
town stars. Three rounds earn the Town Rhythm Ranger finish screen.

## Fishing at the apartment pier

Walk to the boat at the end of the pier near the apartment building and press
**E / Board boat**. Existing placed rowboats, fishing skiffs and canoes near
that pier are recognized. When a map has a pier but no placed boat, the activity
draws a boat beside its boarding point without editing the map.

Row with **WASD / arrows** or the on-screen directional buttons. Row near a fish
shadow, then press **E / Cast** or click the shadow. Choose among four games:

| Game | Challenge |
| --- | --- |
| Echo the fish | Listen to a bar, then repeat it from memory. |
| Beat current | Tap when notes reach the gold line. |
| Reel & hold | Tap short notes; hold long notes until their tails pass. |
| Call & response | Answer two alternating calls from the fish. |

Use **Space**, **Enter**, or the large **Tap / Hold** button. At least 65%
accuracy lands the fish. Extra taps reduce the score; an escaped fish can be
tried again. A successful catch reveals the species, rarity, size and stars.
The journal has 24 new coastal species, with rarer fish appearing as more species
are discovered. It records catch counts and personal best sizes.

Fishing rhythms include 4/4, 3/4, compound 6/8 and cut time. The count-in follows
the meter's pulse; dotted quarters are shown with dots, and held notes have a
visible tail. Timing is judged against the audio clock, independently of the
rendering frame rate. Leaving the tab pauses a challenge. Resume or leave from
the pause screen. **Escape / Leave boat** returns to the same pier.

## Validation

`node --test town/world/town-games.test.mjs` checks rhythm construction, connected
note spawning, pier anchoring, all species and meters, all four fishing games,
hold releases, and rejection of random tapping.

`python3 tests/town-adventures-browser.py` runs an isolated browser through the
real vendor interaction, countdown, keyboard walking and net catches, incorrect
and correct rhythm reconstruction, four successful fishing modes, pause/resume,
collection saving, page reload, and the normal play route at a narrow viewport.
