# Town rhythm adventures

The town activities work in **Walk test** and **Play this town**, and leave the saved map unchanged. Town stars remain separate from arcade Notes. Cave and coastal fish now share one journal, including catch counts and largest sizes from the earlier coastal game.

## Yellow-note inventory and NPC requests

Yellow note bugs fly around the connected town whenever you are outside. No vendor game is needed. Chase them with **WASD / arrows** and **Shift**, then swing with **F** or **Swing net**. Clicking turns toward the pointer and swings. Each successful sweep catches one card; yellow cards replenish after twelve active outdoor seconds.

The yellow inventory saves quarter notes, beamed eighth-note pairs, beamed four-sixteenth groups, and quarter rests. Each card represents one beat. It stays with the active player on this browser/device, separately from blue challenge cards and arcade Notes. Existing town stars, fish records, and maps are preserved.

Approach a named neighbour, press **E**, and choose **Hear rhythm request**. Hear the count-in and example twice, then write four beats from your yellow inventory. The answer is hidden while listening. Replay and undo freely; incorrect answers spend nothing. You can leave to catch more yellow cards and return to the same neighbour’s request. A correct answer uses exactly four cards, earns one town star, and advances that neighbour’s next request. A failed inventory save leaves the cards available to retry. NPC requests have no timer.

## Blue vendor challenge

With **NPCs on**, approach the coffee-cart host, press **E**, and choose **Play Rhythm Catch**. If there is no coffee cart, another vendor hosts.

Watch **1 · 2 · Ready · GO!**, then hear the four-beat rhythm twice. Exactly **four blue cards** appear around the connected island. They flutter and flee like the yellow bugs, but belong only to this vendor challenge. Their values match the heard rhythm; their order is not shown.

You have **five minutes** to catch all four blue cards, return to the original vendor, and rebuild the rhythm by ear. The timer starts after the first example and keeps running during reconstruction and replays. **R / Hear rhythm** replays the example. **E / Build at vendor** opens the four-slot builder near the vendor. A correct answer earns one to three town stars; three rounds earn the Town Rhythm Ranger finish screen. Each new round starts with a fresh five minutes.

If time runs out, that round ends without a reward. **Try again** starts fresh. Your yellow inventory is kept, and blue cards never become inventory cards. Yellow catches during a blue hunt still go into the yellow collection. Leaving, pausing, or switching the active player cannot spend yellow cards on a blue challenge.

The shared net uses a direction-specific wrist anchor, a short windup, a forward sweep, and a straight retract. The visible rim and catch collision use the same geometry. WASD sets facing immediately before F; the avatar keeps that facing through the stroke. Water, solid walls and cliffs stop both flying cards and catches. Reduced motion removes wing flicker, bobbing, and the trail. Explicit pause/background-tab protection freezes the challenge clock and note movement.

## Sailing and fishing

Board the boat at the apartment pier with **E**. The boat sails through the actual town map, following connected open water around the island. Shorelines, cliffs, piers, fences and collidable objects stop its hull. Existing placed boats are recognized; a map without a boat gets a runtime boat beside the pier. Neither case edits the map JSON.

- **WASD / arrows / touch arrows:** sail; **Shift:** sail faster.
- **Click water:** steer toward that point.
- **Cast / E:** cast near a fish shadow. Near the pier, **E** disembarks instead.
- **J / Fish journal:** see every cave and coastal species.
- **Return to pier / Escape:** return safely to the boarding point.

Fish shadows occupy the island's connected sea. Common species are easy to find near the pier; more distant waters offer rarer fish.

Casting uses the **same rhythm engine, battle, notation, audio settings, and tap/hold controls as the arcade cave**. Fish use 4/4, compound 6/8, or cut time. Tap short notes, hold half/whole notes, and stay quiet for rests. Four perfect bars land a fish. After mistakes, recover through the cave game's longer progress challenge. Rarer species bring syncopations and changing tempos. Pause, audio controls and background-tab protection are shared with the cave game.

The journal includes **30 cave species and 24 coastal species**. Opening town from the arcade shares the active player's journal and awards the existing Notes/XP rewards once per catch. Standalone town retains its guest journal on this device. Guest archives do not enter owned classroom profiles; developer test catches remain temporary.

Earlier coastal catch counts and personal best sizes migrate as summary records. They do not invent perfect catches or pay old rewards again. New classroom cloud catches require the prepared Firebase validation update described in [island-fishing-cloud-save.md](island-fishing-cloud-save.md).

## Rendering and checks

Static objects now reuse cropped, color-graded, filtered rasters at their displayed scale, including atlas-backed furniture. Terrain uses filtered walking and overview scales. Full-screen fishing panels pause unnecessary town rendering; leaving fishing disposes its listeners, audio context and bridge. The fixed concert view and existing map data remain intact.

On the same saved 137-object town in managed Chromium, the district view improved from roughly 14 to 58 FPS and full-map view from 9 to 60 FPS. These are measurements from the test environment.

Browser checks:

- `tests/town-adventures-browser.py`: four blue cards, all four net directions, five-minute deadline/replay/build/pause/timeout/retry, rewards and save/reload.
- `tests/town-yellow-notes-browser.py`: permanent yellow catches, inventory persistence, respawn and interactions.
- `tests/town-npc-rhythm-browser.py`: real neighbour conversation, by-ear reconstruction, exact inventory spend and persistence.
- `tests/town-island-browser.py`: actual island sailing, a four-bar perfect cave-engine catch, 54-species journal, reload and mobile layout.
- `tests/town-fishing-shared-browser.py`: real arcade/iframe catch sharing, existing cave catches retained, one Notes reward, and persistence.
- `tests/town-concert-visitors-browser.py`: reserved seats, walking/seated town residents, inward gallery chairs, NPC switch and unchanged map.
- `tests/fishing-coast-journal-browser.py`: a real cave catch preserves coastal catches, awards Notes once, and survives reload.
- Existing Opera, biome sailing, terrain, rendering, fishing-engine, journal and profile-validation suites provide regression coverage.
