# Playing on phones and tablets

The same site adapts to a phone or tablet; no separate installation is required. Both the original arcade and `world-preview.html` support portrait and landscape screens. The original landing page includes an **Explore the connected world** link.

## Connected world

- Drag the joystick in any direction to walk. Push lightly for slow movement or all the way for normal speed. Return to its center or lift to stop. A second finger can press **Jump** while you keep moving.
- **Interact** talks, opens cabinets, visits shops, or enters rooms according to the nearby prompt. **Emote** performs your equipped emote.
- Hold and drag a finger on the map to steer toward it. Lift to stop immediately. This uses normal walking collision without a stored path. Pinch two fingers on the map to zoom between 100% and 300%; the camera stays centered on your character. Your zoom is saved. Movement stays stopped until both fingers lift, and canceled gestures or rotation clear the pinch. The phone camera follows the player and remains usable at every map edge.
- The header contains **Profile**, **Developer**, music on/off, and **Settings**. **Tab** opens settings while playing; zoom, FX, account, and fullscreen live there. Walk to doors, counters, musicians, and the DJ to enter rooms, buy things, customize your avatar, or change jukebox songs. Profile shortcuts guide you to destinations. **Escape** closes the top dialogue or store. Closing a menu or room clears its held touch inputs. Pointer cancellation, rotation, app switching, and screen hiding also release controls.
- The joystick hides while shopping, typing, editing, reading books, or playing a cabinet game. Cabinets use their own controls. **Return to world** stays accessible above the iframe.

Large, translucent controls float over the bottom corners in both orientations. The joystick base is 216–244 pixels across in portrait and 200–232 pixels in landscape, with an 88/92-pixel thumb grip. Main action buttons are 104 pixels tall in portrait and 112 pixels in landscape. The fishing rhythm pad is 144 pixels tall in portrait and 112 pixels in landscape. The map extends behind them and the middle remains available for finger steering. Layouts account for mobile browser bars and safe areas. A first-time touch device starts with Lite effects; an existing FX preference is preserved.

Developer tools keep the map’s scale when opening Layers. Zoom and **Pan** controls stay available; enable Pan to drag the map with one finger without painting. The Piano Lab and fishing cave also have **Menu → Developer** tools with room-specific artwork, collision, layers, and sprite tools. In the cave, select a fish to edit its species, size, colors, visibility, or placement. Room edits are included in complete world project backups.

## Music rooms

Piano Lab opens on the room itself. **Menu** holds Chopin games, the accessible keyboard, recording, and settings, including letter names, zoom, and Developer tools. Talking to Chopin opens a dialogue box with melody and interval choices. Nine melodies offer guided practice for 35 Notes each, then a hint-free memory challenge for 60 bonus Notes each. Rewards are paid once per melody and mode; mistakes restart the memory tune. Free play sounds when you walk over a key; melody and interval games require the touch **Play note / E** action while standing on the chosen key. Letter names remain optional; pitch labels show C, D, E and so on, without octave numbers. Hold and drag on the floor to steer; lifting stops walking. The shared joystick controls only the active room, and the arcade avatar pauses outside it.

The Piano Lab and fishing cave fill the available room viewport, start at a closer 200% view on phones, and follow the player or boat. Both support pinch zoom from 100% to 300%; Piano Lab’s zoom buttons are in Menu → Settings. The classroom also has Settings with 100–300% zoom, desktop wheel zoom, and mobile pinch. The piano keeps a readable sounded-note badge above the floor. Room tools and controls stay outside the central playable area, including in landscape.

The classroom offers **Room** and **Lessons & books**, plus a compact **Settings** button for zoom. **Tab** opens room settings and **Escape** closes them. Choose **Start a lesson** for the numbered beginner path. **All lessons** returns from an activity to that path. Each lesson ends with five quiz questions, shown one at a time with large answer buttons. Get four correct to pass; you can retry without a timer. Hold and drag on the room floor, or use the joystick, to approach Professor Haydn and the bookshelves, then use **Talk / Read**. Books, quizzes, search, and audio examples remain available without using the joystick.

## Underground Rhythm Fishing

Enter through the arcade trapdoor. On the dock, use the joystick or hold/drag to walk; **Talk** meets Captain Cadence. The cave’s **Menu** holds the collection, meter, practice, audio, effects, and Developer tools. Walk down the pier before using **Board boat** to start lake exploration. On shore, **Climb / E** at the rope ladder returns to the arcade; the larger stone landing connects the ladder and dock. Steer the boat with the same finger controls and use **Cast** near a fish shadow.

Pinch the cave with two fingers to zoom up to 300%, or use the corner’s **− / percentage / +** controls. The camera follows your avatar or boat. Steering and casting stop during the pinch and resume on a fresh touch after both fingers lift. Some species require 4/4, 6/8, or cut time; choose the meter before casting and check the collection cards for requirements.

During a bite and rhythm challenge, the joystick hides. Eight clean bars fill the catch meter; mistakes lower it and extend the battle. Epic and Legendary encounters use more manageable tempos and allow recovery from missed notes. Press the large rhythm button or the one-line staff when each note reaches the gold line. Tap quarter notes (including dotted quarters), eighths, and sixteenths. Hold only half and whole notes. Near the tail, **Release when ready** tells you when you can lift and prepare for the next note; the next adjacent note has a small late grace window. Rests need no input. Alternate thumbs for fast patterns. The rhythm surfaces suppress double-tap zoom, text selection, dragging, and long-press menus with both touch-event cancellation and browser callout styles. Blue lines divide bars. The 4/4, 6/8, and cut-time choices use their proper pulses. Pause and **Audio** remain available, and changing apps pauses a hooked fish. Audio has independent saved music, metronome, guide-note, and master switches plus a music-volume slider. The louder backing has six fish-family themes with species variations. Fish collection and achievement progress are available from the room header. Fish shadows swim, and Full/Lite/Off effects control the cave lights, water shimmer, rowing, and wakes. Eighth/sixteenth notes use readable beam groups. Losing removes that fish shadow; a new fish can appear elsewhere after 24 seconds.

Choose **Practice fishing** beside Audio to set any meter and difficulty through Legendary. Practice runs endlessly, even at zero or full progress, and **End practice** returns to the lake. It uses the same tapping/holding rules and audio controls, without catches or rewards.

The battle illustration shows the fish tugging on your line and being reeled closer after good taps. Rare catches get a brief announcement. Quarter, half, eighth, and whole-bar rests are silent; rarer fish add more syncopation. Short landscape screens place the illustration beside progress so the full rhythm button remains visible.

Harder fish also change speed. Watch the tempo cue: **accelerando** means gradually faster and **ritardando** means gradually slower. Epic and Legendary fish stay within 108–144 quarter notes per minute. Follow the moving notes and metronome; the speed display and tap timing stay together. Pause freezes the change as well as the battle.

## Song Machine

Song Machine starts in **Simple** mode with one grid containing three octaves and three drum rows. Choose an instrument and tap a note-length icon. The **Advanced** toggle opens the original full editor, preserving the same song and all its tracks. The phone composer has a fixed Play/Stop/Undo/Loop dock and expandable instrument options in Advanced mode. Tap a grid cell to place or remove a note; swipe horizontally for later bars and vertically for other pitches. **Draw notes** enables sideways duration drawing; **Tap & scroll** restores navigation. Canceled gestures never place notes. Editing retains the visible bar and pitch rather than jumping back to the grid's beginning.

Song settings contain meter, scale, bars, file import, and the existing account/save controls. Hold a track's Clear button for three seconds; releasing or canceling the touch stops the clear, and Undo restores a completed clear. Stop silences sounding and scheduled audio sources.

## Progress and implementation

Phones use the existing avatar, Notes, XP, achievements, and project storage keys. Alien forms and companion pets are selected at the boutique; pets follow across the world and music rooms. Premium invitations add original visitors to the rotating arcade cast. Changing orientation or using the responsive layout does not reset progress. Existing guest and account restrictions still apply.

`finger-follow.js` captures held floor gestures, cancels on lift/blur/rotation, and leaves simultaneous action fingers available. Desktop mouse clicks keep click-to-walk.

`mobile-controls.js` shares multi-touch handling between views, with analog steering, independent action fingers, reference-counted held keys, and context-bound releases. The world keeps its original bitmap and collision coordinates; its camera uses the visible clipped viewport. Room modules expose `controlMove(x, y)`, `control(key, pressed)`, and `releaseControls()` for touch input. Desktop keyboard, mouse, editing, and previews remain supported.

Phone checks use real Chromium touch events in 390×844 and 844×390 viewports:

```sh
node --test tests/mobile-controls.test.cjs
python3 tests/mobile-joystick-browser.py
python3 tests/room-joystick-browser.py
python3 tests/finger-follow-browser.py
python3 tests/mobile-world-browser.py
python3 tests/mobile-landing-browser.py
python3 tests/mobile-rooms-browser.py
python3 tests/piano-mobile-browser.py
python3 tests/cave-mobile-browser.py
python3 tests/fishing-rhythm-input-browser.py
python3 tests/fishing-audio-browser.py
python3 tests/song-mobile-browser.py
```

These are browser-emulated phone checks; device-specific Safari and Android behavior can also be checked on the published site.
