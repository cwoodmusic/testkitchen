# DJ Coda's Line Dance

Walk to DJ Coda and interact. Choose **Play DJ Coda's Line Dance**, then Easy, Normal, or Hard. A four-beat count-in leads into eight bars of 4/4. Match the arrow under each note as its notehead reaches the glowing line; rests require no press. Use keyboard arrow keys or the game's touch buttons, arranged as a directional pad: Up above Left and Right, with Down below.

The camera fits the whole dance floor. The player joins a line with up to three randomly selected available NPCs. Correct presses animate larger directional dance steps with a more pronounced bounce. Wrong or missed arrows cause a short stumble, then the player gets back up; the NPCs keep dancing to the chart. Reduced motion uses smaller steps without bouncing or the fall rotation.

Easy uses quarter-note steps at 80 BPM. Normal adds eighth notes at 92 BPM. Hard adds paired sixteenths, dotted notes, and syncopation at a more manageable 88 BPM. Every round shuffles that difficulty's rhythm patterns across all eight bars, including the opening. Patterns do not repeat immediately, and each pattern appears before the pool reshuffles. Each group of two or four sixteenth notes uses the same arrow direction; tap that arrow once for each note. All modes have written rests, bar lines, actual Bravura note glyphs, and appropriate beams. Long notes require one press at the beginning. The result shows score, accuracy, best streak, saved XP, and newly earned unlocks.

Completed eight-bar dances with at least one correct step earn practice XP. The Hall of Fame's **DJ Line Dance** category lists six one-time achievements:

| Achievement | Goal | XP | Unlock |
| --- | --- | --- | --- |
| First Steps | Finish a dance with at least one correct step | 50 | First Steps DJ track |
| Find the Groove | Reach a 20-step streak in a completed dance | 100 | Shutter shades |
| Dance Floor Regular | Finish Normal with at least 80% accuracy | 100 | — |
| DJ Coda’s Headliner | Finish Hard with at least 80% accuracy | 150 | Midnight Headliner DJ track |
| Mirrorball Master | Match every step with no mistakes or extra presses | 150 | Roller skates |
| Disco Legend | Dance a perfect Hard set | 250 | Boombox |

Each run earns 10 XP plus 2 XP per correct step (up to 60), with another 20 XP for a perfect dance. Accuracy includes wrong directions, missed notes, and extra presses. Exiting early and leaving every arrow unplayed earn no dance rewards. A saved run cannot award twice. Achievements and unlocks use the existing player progress journal and follow private classroom profiles; there is no new public leaderboard or profile schema. Gear stays unequipped until selected in the boutique, and previous purchases remain available. The two new tracks unlock in DJ Coda's jukebox.

Disco-ball beams and reflections circle at elapsed-time speed, independently of capped walking physics. Small trailing rays make the reflected light's movement easier to see. Full and Lite effects keep the motion; Motion Off holds the reflections still without trails, and FX Off disables them.

Exit with Escape or the close button. Exiting restores the borrowed actor positions, camera, and previously playing jukebox/arcade track. Backgrounding the page, changing profile, or leaving the game stops its audio and input. Those interruptions do not restart music in the background. Temporary dance state never changes the saved world layout or avatar appearance.

The pure chart/timing engine is `dance-rhythm-engine.js`. Actor staging is `dance-floor-stage.js`; notation, controls, and audio are `dance-rhythm-game.js/css`; `dance-floor-world.js` coordinates the existing world and camera.
