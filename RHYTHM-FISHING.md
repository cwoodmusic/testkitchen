# Rhythm Fishing: connected waters

The trapdoor is in the southwest corner of the main arcade’s open room, left of the Entrance sign. Stand nearby and press **E / Interact**. The developer console can move the hatch without changing the floor art or collision.

Fishing now spans six fixed screens in a connected 2×3 map. Sail through the open waterways at a screen edge to enter the neighboring area; the discovery map shows where you are. North/south routes connect the two screens within each biome, while east/west routes lead to the next biome.

| Biome | Screens | Fishing rhythm |
| --- | --- | --- |
| Cave Lake | Lantern Lake, Glowstone Narrows | 4/4 |
| Underground Swamp | Mistfen Channel, Mosswater Basin | 6/8 |
| Ocean Expanse | Tidegate Inlet, Starlit Expanse | Cut time (2/2) |

Each biome has twelve eligible species: Silver Minnow, Cave Guppy and Bluegill are common to all three, while nine other species are exclusive to that biome. All thirty existing species and their catch rewards remain intact. The biome sets the encounter meter automatically; **Practice fishing** still offers every meter. Collection cards show each fish’s biome and rhythm. The swamp has drifting mist; ocean screens have broad open water.

Discovered areas and away-screen boat position save under `codaFishingVoyageV1`, independently of the catch journal. Reopening fishing resumes an away-screen voyage; returning to Lantern Lake uses the familiar shore entrance. **Return to dock** brings you home from any area. Existing dock artwork, collision and character edits remain local to Lantern Lake and are not copied across the other screens.

The room opens with a compact header and **Menu**. Collection, practice, audio, effects, and Developer tools live inside Menu; movement pauses while it is open.

A rectangular stone landing at the ladder’s foot leads onto a straight south-facing dock. Its planks, walkable footprint, boarding point and boat berth share the same top-down coordinates. Clear departure water below the pier lets the boat row south before turning into the lake. Across all six screens, boating follows the painted coastlines and bays instead of the former oval boundary. The whole hull stays clear of rocks, dock posts and shore; the editor and water effects use the same boundary. Walk to the end of the pier before choosing **Board boat**. Sail beside the dock and press **E / Leave boat**, or click the nearby dock on desktop, to step back onto the pier. **Return to dock** remains available from the fishing menu in any area. To leave, walk to the foot of the rope ladder and press **E / Climb**, click the nearby ladder, or choose **Climb ladder**. The header’s Arcade button also remains available.

Captain Cadence waits on the lantern dock. His original shanty verses explain casting, rests, and the three meters. **Board boat** starts exploring; steer with WASD/arrows, desktop floor clicks, the mobile joystick, or held-finger movement. Fish shadows swim around the lake, turn away from banks, and gently avoid the boat. Hooked fish stay fixed while their rhythm challenge plays. Move within casting range and press **E / Cast rod**, or click a nearby shadow.

Desktop shows each area as a complete fixed screen. On phones, the cave fills the available screen height and the camera follows your avatar or boat. Pinch two fingers to zoom from 100% to 300%. The corner’s **− / percentage / +** controls offer the same zoom. Pinching stops steering and casting until both fingers lift. Rotation, cancellation, and leaving the room release captured touches. The developer camera remains independent and can zoom further.

After a bite, listen to one bar of count-in. Notes scroll left across a one-line staff, with blue lines dividing bars. Notes and rests sit between the dividers, with space after each bar line as in sheet music. The dividers adapt to the neighboring symbols; note onsets, hold lengths, and audio retain their musical timing. Press **Space**, **Enter**, the staff, or **Tap / Hold rhythm** when a notehead crosses the gold line. Short notes need a tap. Only half and whole notes need holding; quarter notes (including dotted quarters), eighths, and sixteenths are taps. The button changes to **Release when ready** near a held note’s tail. You may lift up to 180 milliseconds early (at most 35% of its length) to prepare for the next note; letting go earlier counts as a miss. The immediately following note also has a small late grace window, bounded so it cannot steal the next note or rest. Its musical timing and the held note’s reward time stay unchanged. Rests need no input. Four full mistake-free bars catch the fish. After a mistake, eight clean bars’ worth of progress fills the catch bar, regardless of note density or meter, with extra bars needed to recover the lost progress. Correct notes and silent rests earn progress in proportion to their written length. Misses and extra taps lower it, so recovery takes extra bars. Tapping a rest forfeits its silent credit. The perfect shortcut cannot finish before the end of bar four; recovery catches cannot finish before the end of bar eight. Reaching 100% catches the fish; reaching zero lets it escape. An escaped shadow disappears; a new fish can appear elsewhere after 24 seconds. Pause is available, and switching away from the page pauses the hooked fish and its audio.

The original synthesized **Lantern Lake** theme plays while exploring. Battles use six original fish-family arrangements, with species-specific keys and motifs. The accompaniment is louder, with a saved **Music volume** slider (85% by default). **Audio** offers separate saved switches for music, metronome, guide notes, and all sound; music volume does not change guide or metronome levels. The metronome follows the selected meter and changing tempo. Opening Audio pauses an active battle; closing it resumes only if it was running before. Leaving the room stops its audio.

A small boat, rod, line, and fish illustrate the battle above the staff. Good taps reel the fish closer; mistakes make it pull away and tighten the line. Its species, edited colors, and size follow the hooked fish. Rare, Epic, and Legendary encounters show a brief announcement at the start of the count-in. The illustration and announcement use the paused game clock and respect reduced motion; neither changes scoring.

## Endless practice

Choose **Practice fishing** in the room heading. The setup has two steps: pick **4/4**, **6/8**, or **cut time**, then choose **Next: choose a challenge** for **Common**, **Uncommon**, **Rare**, **Epic**, or **Legendary**. Large beat pictures and short descriptions explain each choice. **Back to rhythms** changes the beat without losing the selected challenge; **Back to fishing** closes setup. Only **Start practice** begins the count-in. No boat or wild fish is needed. The rhythms, tempo changes, notation, holds, music, and metronome use the normal game rules.

Practice continues at both zero and full progress, generating new bars for as long as you want. **Pause** and **Audio** remain available. **End practice** (or Escape) returns to your previous place at the lake. It keeps the practice choices for your next visit to the settings during this page session. Practice does not catch fish, remove shadows, or award Notes, XP, or achievements.

## Meters and rarity

- **4/4:** four quarter-note beats: ONE, TWO, THREE, FOUR.
- **6/8:** six eighth-note lengths grouped in two dotted-quarter pulses: ONE-la-li, TWO-la-li.
- **Cut time / 2/2:** two half-note beats: ONE-and, TWO-and.

Eighth notes share one beam and sixteenth notes share two. Beams follow each meter’s big-beat grouping and stop at rests, beat boundaries, or bar lines; isolated short notes keep their flags.

The BPM label names the actual pulse unit. The engine keeps note lengths separate from the pulse, so six eighth notes in 6/8 do not become six quarter-note beats. Thirty species, six in each of five rarities, use 90 rhythm patterns across all three meters. Quarter, half, eighth, sixteenth, and whole-bar rests use the bundled music glyphs. A whole-bar rest fills that meter’s complete bar, including all six eighth-note lengths in 6/8. Staying quiet during a rest earns its share of progress; tapping it counts as an extra tap and forfeits that rest’s credit. Rarer catches introduce shorter notes, dots, offbeat entrances, and notes held across the main pulse. No copyrighted music recordings are used.

In the connected world, three common species live in every biome; the remaining species use their assigned cave, swamp or ocean habitat. The current biome chooses the wild encounter meter, and every collection card lists its waters and rhythm. Standalone legacy rooms retain the manual **Fishing meter** selector. For example, Glass Cavefish and Thunderfin Pike require 4/4, Sapphire Pike and Starlight Sturgeon require 6/8, and Amethyst Koi and Prism Koi require cut time. Existing saved catches remain in the journal.

## Tempo and changing speed

Each species has a tempo profile. Common fish use 72 quarter notes per minute and Uncommon fish use 76. Rare fish use 72–80, Epic fish use 76–84, and Legendary fish use 80–88. Timing windows are more forgiving at every tier, and mistakes remove less progress: Legendary misses cost 3 points and extra taps cost 2. Its sixteenth notes, syncopations, rests and changing tempos still make it the hardest tier; occasional mistakes now leave room to recover. Some difficult fish stay fast; others use **accelerando** (gradually getting faster) or **ritardando** (gradually getting slower). The first bar stays steady, then the change unfolds over three bars and settles at its target speed.

The tempo display names the current speed with Andante, Moderato, Allegro, Vivace, or Presto and explains the change in plain language. These markings use quarter-note BPM. The metronome follows the selected meter’s actual pulse: quarter notes in 4/4, dotted quarters in 6/8, and half notes in cut time. A change of tempo does not change the time signature.

Note onsets, rests, bar lines, scrolling, and metronome clicks use the same tempo map. Longer notes and rests keep their musical lengths through a speed change. Dense fast notes have separate timing windows, so one tap cannot collect neighboring notes. Pausing or switching away freezes the musical clock and speed change; resuming does not replay a beat that already sounded. Catch rewards still depend on the fish species.

## Catches and rewards

Each successful catch records the species, size, meter, result, and stable catch ID in `codaRhythmFishingV1`. Common through legendary fish award 4–80 Notes and 8–35 catch XP. Nine milestones cover the first catch, five/twenty catches, a perfect catch, rare/legendary catches, all three meters, ten species, and all thirty species. Each achievement gives 50 XP once and uses the existing bottom notifications and level rewards.

The catch journal saves before Notes or XP are awarded. Failed writes leave an explicit retry; stable catch IDs prevent duplicate payment after partial saves or reload. Escapes and canceled casts award nothing. Saved collection entries do not replay reward popups. All guest progress stays in this browser, alongside the existing Notes/XP journals.

All six screens use top-down SNES-era pixel art: dark tile outlines, stepped rock shapes, clustered water pixels and distinct cave, swamp and ocean palettes. The home landing and dock have square corners; the dock points south, and the live boat turns its pixel hull with the steering direction while keeping its rider upright. The home water mask includes the departure pool below the pier; other screen passages keep their existing coordinates. The native texture stays at 1592×988 so existing room artwork remains compatible; gameplay uses the same 1000×620 coordinate system. Generated sources and normalization records are retained in `assets/world/source/`; the five additional screen plates are in `assets/world/fishing/`. Boat, avatar, Captain, shadows, and effects remain live layers. Crystals breathe with teal/violet light, lanterns cast warm reflections, water shimmers with caustics and falling-drop rings, and the boat leaves rippling wakes. Its hull gently bobs, with rowing and paddle splashes while moving. **Effects: Full / Lite / Off** shares the arcade’s saved effects setting; reduced motion keeps calm static lighting and removes drifting particles, rocking, and ripples. Effects never change catch timing or rewards. Bravura 1.482 supplies the actual music glyphs; its SIL Open Font License and source details are bundled under `assets/fonts/bravura`.

**Developer / F2** opens the cave’s editor while on shore or exploring. Select a fish shadow or a numbered fish in Objects to change its species, position, size, colors, or visibility; fish freeze during editing. The console also edits room artwork, collision, and foreground layers, with zoom up to 800% and drag-to-pan. Room edits save locally and are included in complete world project exports. See [DEVELOPER-CONSOLE.md](DEVELOPER-CONSOLE.md).

The Lantern Lake developer list includes all species and their meter and habitat requirements. A placed fish that belongs to another habitat remains visible while editing and waits during normal Lantern Lake gameplay. Authored fish and their customization remain saved.

## Checks

```sh
node --test tests/fishing-biomes.test.cjs tests/fishing-biome-species.test.cjs
python3 tests/fishing-biomes-browser.py
node --test tests/rhythm-fishing-engine.test.cjs tests/fishing-progress.test.cjs tests/music-notation.test.cjs tests/time-signature-lesson.test.cjs tests/rhythm-beaming.test.cjs tests/fishing-cave-layout.test.cjs tests/fish-shadow-motion.test.cjs tests/fishing-cave-effects.test.cjs
python3 tests/rhythm-fishing-browser.py
python3 tests/fishing-world-browser.py
python3 tests/cave-upgrade-browser.py
python3 tests/rhythm-beaming-browser.py
python3 tests/fishing-upgrade-browser.py
python3 tests/fishing-tempo-browser.py
python3 tests/cave-camera-browser.py
python3 tests/fishing-battle-browser.py
node --test tests/cave-camera.test.cjs tests/fishing-battle.test.cjs tests/fishing-tempo.test.cjs
node --test tests/fishing-music.test.cjs tests/fishing-boat.test.cjs tests/fishing-holds.test.cjs tests/fishing-rhythm-input.test.cjs tests/fishing-practice.test.cjs
python3 tests/fishing-audio-browser.py
python3 tests/fishing-practice-widget-browser.py
python3 tests/fishing-practice-world-browser.py
python3 tests/fishing-rhythm-input-browser.py
python3 tests/fishing-barlines-browser.py
python3 tests/cave-mobile-browser.py
python3 tests/time-signature-lesson-browser.py
python3 tests/music-notation-browser.py
```

The browser tests use actual keyboard/touch input and a controlled browser clock. They cover catches and escapes, save retries, meter pulses, font rendering, boat collision, mobile input, audio cleanup, and moving the trapdoor in the production editor.

Rhythm notation includes a scrolling counting row aligned with the notes. Compound 6/8 uses “1 la li 2 la li” and accompaniment grouped into two dotted-quarter pulses, with lighter eighth-note subdivisions.

Fishing songs develop over sixteen bars with stronger bass and low drum downbeats, sustained chord backing, flowing arpeggios, and question-and-answer lead melodies. Fast and legendary encounters retain a lead melody. The 6/8 backing emphasizes two dotted-quarter pulses.

**Practice fishing** is available directly in the main room heading, beside Menu and Arcade, on desktop and phones. It opens practice settings without opening the fishing menu and returns to the main screen when practice ends.
