# Town rhythm adventures

Both activities work in **Walk test** and **Play this town**, and leave the saved map unchanged. Town stars remain separate from arcade Notes. Cave and coastal fish now share one journal, including catch counts and largest sizes from the earlier coastal game.

## Rhythm Catch

With **NPCs on**, approach the coffee-cart host, press **E**, and choose **Play Rhythm Catch**. If there is no coffee cart, another vendor hosts.

Watch **1 · 2 · Ready · GO!**, then hear the four-beat rhythm twice. Up to 96 note bugs are scattered across connected, walkable parts of town. They wander, flutter, and dart away when approached. They cannot cross solid walls, water, or sheer cliffs, and stay near their original neighborhood so every card remains reachable.

Catch quarter notes, beamed eighth-note pairs, beamed four-sixteenth groups, and quarter rests. Each card fills one beat. There are no isolated eighths/sixteenths, longer notes, or other rests in this game.

- **WASD / arrows:** chase; **Shift:** run.
- **F / Swing net:** sweep a forward arc in the direction you face. The rim must pass the bug; notes behind you or across a wall cannot be caught.
- **Click:** turn toward the pointer and sweep. One swing catches one card.
- **R / Hear rhythm:** replay without losing caught cards.
- **Escape / Leave:** finish hunting.

The net has a visible sweep and recovery, with a brief trail. Reduced motion removes wing flicker, bobbing, and the trail while preserving the chase. Pausing freezes note movement.

Return to the original vendor and press **E / Build at vendor**. Arrange four cards to rebuild the example. Extra cards are allowed, and **Catch more notes** returns to the hunt. Undo, replay and retry freely. A correct rhythm earns one to three town stars; three rounds earn the Town Rhythm Ranger finish screen.

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

- `tests/town-adventures-browser.py`: real note chase, forward F sweeps, vendor return, reconstruction, rewards and save/reload.
- `tests/town-island-browser.py`: actual island sailing, a four-bar perfect cave-engine catch, 54-species journal, reload and mobile layout.
- `tests/town-fishing-shared-browser.py`: real arcade/iframe catch sharing, existing cave catches retained, one Notes reward, and persistence.
- `tests/town-concert-visitors-browser.py`: reserved seats, walking/seated town residents, inward gallery chairs, NPC switch and unchanged map.
- `tests/fishing-coast-journal-browser.py`: a real cave catch preserves coastal catches, awards Notes once, and survives reload.
- Existing Opera, biome sailing, terrain, rendering, fishing-engine, journal and profile-validation suites provide regression coverage.
