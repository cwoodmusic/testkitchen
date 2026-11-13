# Town rhythm adventures

The town activities work in **Walk test** and **Play this town**, and leave the saved map unchanged. Town stars remain separate from arcade Notes. Cave and coastal fish now share one journal, including catch counts and largest sizes from the earlier coastal game.

## Musical fairies and yellow-note inventory

Small musical fairies drift around town with translucent wings and glitter trails. Their musical glyphs have no circular badge. Yellow fairies supply the saved inventory; blue fairies belong to the vendor challenge. **At most five fairies appear on the island at once, counting both colors.** When all four blue fairies are out, only one yellow fairy appears. More yellow slots become available as blue notes are caught.

Press **Tab** to equip or stow the net. It starts stowed. Turn with **WASD / arrows**, then press **F** or click/tap to swing in the direction the avatar faces. Clicking does not turn or aim the avatar. While walking, the net rests over the back shoulder and draws behind the body. The whole shaft and hoop start from that resting pose and sweep forward over the head in one arc. The hoop stands vertically overhead and tilts with the shaft, while the mesh trails behind it. The hoop reaches the ground first, with the mesh still above it. The hand stays aligned with the tilted hoop. Fairy notes have a small catch margin around that opening, so a close overlap counts. Behind-the-body positions and the return to the shoulder cannot catch a note. Stowing cancels the stroke; no net is drawn and no catches happen while it is stowed. Touch players can use **Equip net / Stow net** in the Play controls.

A yellow catch saves one quarter-note card, beamed eighth-note pair, or beamed four-sixteenth group. Rests no longer appear in the fairy collection, vendor challenges, or NPC rhythm requests. Previously saved quarter-rest cards convert one-for-one into quarter notes. It replenishes in its original slot after twelve active outdoor seconds. The compact inventory counter stays out of the way. Inventory remains separate for each active player in this browser/device; cross-device syncing is deferred. Existing town stars, fish records, and maps are preserved.

## NPC rhythm requests

Approach a named neighbour, press **E**, and choose **Hear rhythm request**. Hear the count-in and example twice, then write four beats from your saved yellow inventory. The answer is hidden while listening. Replay and undo in the NPC’s actual interaction panel; incorrect answers spend nothing. Leave to catch more yellow fairies and return to the same request. A correct answer uses exactly four cards, earns one town star, and advances that neighbour’s next request. Failed saves leave the cards available to retry. NPC requests are untimed.

## Blue vendor challenge

With **NPCs on**, approach the coffee-cart host, press **E**, and choose **Play Rhythm Catch**. If there is no coffee cart, another vendor hosts.

Watch **1 · 2 · Ready · GO!**, then hear the four-beat rhythm twice. Exactly **four blue fairies** appear around the connected island. Their values match the heard rhythm; their order is not shown.

A small blue compass arrow appears around the avatar when a remaining blue fairy comes within roughly one and a half screens. It points toward the nearest nearby blue fairy, follows its flight, and switches when that note is caught. Its circular orbit is invisible. It disappears when no blue fairy is close enough or the hunt is paused or finished.

You have **five minutes** to catch all four blue notes, return to the original vendor, and rebuild the rhythm by ear. The timer starts after the first example and continues during reconstruction. Hunting shows only a small timer and blue-note count, with no replay or action-button panel. **E** at the vendor opens the four-slot rhythm builder. A correct answer earns one to three town stars; three rounds earn the Town Rhythm Ranger finish screen. Every new round starts with a fresh five minutes.

**Escape** opens **“Are you sure you want to end Rhythm Catch?”**. **Keep playing** (or Escape again) returns to the same round without resetting the notes, written order, or remaining time. The clock pauses while confirming. **End Rhythm Catch** clears that blue hunt while preserving saved yellow inventory and stars.

If time expires, the round ends without a reward. **Try again** starts fresh. Blue notes never become saved inventory; yellow catches during a blue hunt still go into the yellow collection. Background-tab protection freezes the clock and note movement. A correct answer awaiting a failed progress save keeps its remaining time while **Try saving again** retries without duplicate rewards.

Water, solid walls, and cliffs stop flying fairies and catches. All five slots use connected paths with safe approaches. Reduced motion freezes decorative wing motion, bobbing, and glitter while leaving recognizable notation and the catch action available.

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

- `tests/town-adventures-browser.py`: four blue fairies, Tab equip/stow, shoulder carry and forward overhead directions, clean HUD, Escape confirmation, five-minute deadline/build/pause/timeout/retry, rewards and save/reload.
- `tests/town-yellow-notes-browser.py`: five-note cap, fairy art, equipped catches, inventory persistence, replenishment, interactions, and mobile controls.
- `tests/town-npc-rhythm-browser.py`: real neighbour conversation, by-ear reconstruction, exact inventory spend and persistence.
- `tests/town-island-browser.py`: actual island sailing, a four-bar perfect cave-engine catch, 54-species journal, reload and mobile layout.
- `tests/town-fishing-shared-browser.py`: real arcade/iframe catch sharing, existing cave catches retained, one Notes reward, and persistence.
- `tests/town-concert-visitors-browser.py`: reserved seats, walking/seated town residents, inward gallery chairs, NPC switch and unchanged map.
- `tests/fishing-coast-journal-browser.py`: a real cave catch preserves coastal catches, awards Notes once, and survives reload.
- Existing Opera, biome sailing, terrain, rendering, fishing-engine, journal and profile-validation suites provide regression coverage.
