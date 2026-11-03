# Learning rooms, Notes, missions, and levels

Open `world-preview.html`. Guest play works with a static web server and no credentials. The connected world keeps the uploaded project layout, collision paint, and layer edits.

Phones and tablets use the same page with touch movement, a compact menu, a following camera, and room-specific controls. See [MOBILE.md](MOBILE.md) for phone play and the touch composer.

## Rooms and people

- **Piano Lab:** approach the north doorway and press E / Interact. WASD/arrows walk, Space jumps. The 22 painted floor keys have individual perspective polygons. Free play sounds on entry; during a Chopin game, stand on the desired key and press **E**. The back wall shows the sounded pitch. **Show letter names on keys** is optional. Accessible piano buttons offer the same intentional note input.
- **Chopin:** press E nearby to open his dialogue, or use Menu → Challenges. Nine familiar melodies include Twinkle Twinkle Little Star, Mary Had a Little Lamb, London Bridge, and six more beginner tunes. Guided completion awards 35 Notes once per melody; then play it from memory without hints for 60 bonus Notes once per melody. A wrong memory note restarts the tune. Fourteen interval games ask for a starting pitch, then a second, third, fourth, fifth, or octave higher or lower. Timing is flexible. Keyboard, recording, settings, zoom, and Developer tools stay behind Menu.
- **Music Classroom:** enter the east-wall doorway. Professor Haydn and three bookshelves open fifteen searchable topics, including guided **Note naming**, **Rhythm tree**, and **Time signatures** activities written for ages 10–11. Note naming uses two/three black-key groups, keyboard questions, and treble-staff questions. The rhythm tree lets students split whole through sixteenth notes, compare values, and fill a four-beat bar. The time-signature lesson teaches 4/4, 6/8, and cut time through listening, pulse tapping, questions, and three bar-building recipes. In 6/8 the six eighth notes form two groups of three; cut time has two half-note beats. Classroom examples use the self-hosted Bravura music font with correctly aligned staff notes. The guides explain the actual cabinet rules, including Music Triad's rhythm-card battles, Pitch Race's note-reading and holds, and Rhythm Room's listen/repeat patterns.
- **Rhythm Fishing:** use the floor trapdoor in the southwest corner of the main open arcade, left of the Entrance sign. Descend to the underground lake, explore the larger stone landing, talk to Captain Cadence, walk down the pier to board, and cast near swimming fish shadows. The rope ladder is a working exit. Animated crystals, lantern reflections, water caustics, drips, and wakes respect the saved effects setting. Thirty species span five rarities; some require a specific meter, listed on their collection cards. Choose 4/4, 6/8, or cut time. Ninety patterns include eighth, quarter, half, and whole-bar rests, with more syncopation for rare fish. Difficult species can gradually accelerate or slow down, with manageable Epic and Legendary tempos; the tempo label explains the change and the beat, notes, and tapping stay synchronized. A small fish-and-line battle graphic reacts to good taps and mistakes, with a start announcement for Rare/Epic/Legendary fish. Pinch the cave to zoom while exploring. Tap Space/Enter, the staff, or the large rhythm button as notes cross the gold line; correct taps raise progress, misses and extra taps lower it. Eighth and sixteenth notes share beams grouped for the selected meter. Full progress catches the fish, zero lets it escape. Catches earn Notes and XP, with nine fishing achievements and a saved collection. See [RHYTHM-FISHING.md](RHYTHM-FISHING.md).
- **Pip:** the boutique attendant opens the wardrobe. **Riff**, behind the main arcade counter, sells cosmetics. Both follow their counter's transform, visibility, and opacity. Use their physical counters with E / Interact; the header contains essential controls only.

Talking to Haydn opens four large choices: **Keep learning**, **Choose a lesson**, **Look something up**, and **My progress**. New learners see **Start learning** as the first choice. The lesson picker begins with **Note names → Note lengths → Time signatures**; **All lessons** includes the remaining categories and Haydn’s Final Exam. Cards show **New**, **In progress**, or **Finished** from saved progress. Continuing reopens an available unfinished section at its saved teaching card; advanced sections keep their existing prerequisites. Reference books have a searchable list and a **Reference books** back button. Haydn’s advice and music history remain under **Talk with Haydn**. Each activity separates a short explanation, a worked example, and one clear task. Visual hints, split-by-split prompts, and recipe slots guide the next action. Optional tapping and extra note choices stay behind expandable help. Reference books are labeled **Look something up**. Each lesson ends with a five-question quiz. Four correct answers pass; answers receive explanations and retries are unlimited. New lesson completion and its once-only 50 XP achievement require a saved passing quiz. Quiz attempts resume in `codaClassroomQuizzesV1`; **Quiz ready** appears in the profile after the guided steps. Existing completed lessons and rewards remain earned, and **Take the quiz** lets those students try the new check directly. Saved lesson progress and completion IDs are retained.

DJ Coda opens four choices: **Dance with friends**, **Play music**, **My songs**, and **Music history**. Music starts only with **Play**; **Stop music** stays available on each DJ page. **My songs** holds local song files and saved Song Machine songs. Back or Escape returns to the DJ menu while a selected song keeps playing.

Riff’s Notes Shop starts with **Browse the shop**, **Big goals**, **My Notes**, and **Wear my things**. Browsing shows categories before items, with exact prices and the extra Notes needed for unaffordable items. My Notes explains earning and the coin purse. Buying and wearing remain separate actions. Pip’s boutique groups appearance choices into **Clothes & shoes**, **Hair & colors**, **Hats & extras**, and **Pets & magic**. Trying on and switching menus keep a draft; **Save my look** applies it and **Cancel** keeps the saved look. Base looks remain under **More looks**.

The Scholar opens **Turn in facts**, **My fact book**, **Take a quiz**, and **How to find facts**. Turn in facts opens the pouch; recording facts still requires the explicit hand-in button. Quiz eligibility and rewards use the existing recorded collections. Back and Escape move up one menu level before closing.

Rooms use detailed pixel-art backgrounds, with live JavaScript characters, note displays, interactions, and lighting over the art. In the classroom, Escape steps from a lesson or submenu to the classroom menu, then to the room, then to the arcade; leaving a lesson stops its audio. Main-world movement pauses inside a room or full panel.

On phones, the Piano Lab and cave use a closer following camera with pinch zoom and larger movement/action controls. Fishing has original background music and separate metronome and guide-note switches under **Audio**. Tap quarter notes and shorter notes; only half and whole notes need a hold. A release cue and short transition grace make the following note easier to play; rests stay silent. Blue bar lines mark the measures. An escaped fish disappears, and a new shadow may appear elsewhere after 24 seconds. The boat rocks and rows while exploring, respecting reduced motion and the effects preference. **Practice fishing** offers all three meters and five difficulty tiers through Legendary, continues endlessly, and gives no catches or rewards.

The Piano Lab and fishing cave have contextual **Developer / F2** consoles for room artwork, collision, layers, and character/fish placement. Their cameras support close zoom and panning without resetting when switching tools. Cave fish also have editable species, size, colors, and visibility. Edited rooms travel with the complete world project export; see [DEVELOPER-CONSOLE.md](DEVELOPER-CONSOLE.md).

Achievement, level-up, and mission-completion notices stay visible over games and room screens, including supported native fullscreen and game dialogs. During play they appear above the play area controls; they do not take keyboard focus or interrupt the game. New friendship-quest completion also announces which musician to return to for the earned history fact. Restoring existing saves stays quiet, and notifications do not grant extra rewards.

## Notes and wardrobe

Notes are integer units. The purse makes exact change using whole notes worth 16, half notes 8, quarter notes 4, eighth notes 2, and sixteenth notes 1. New guests receive 150 Notes. Completed cabinet rounds provide repeatable income: Triad awards 16 for a win or 4 for a completed loss; Pitch Race with correct notes awards 16 for a win or 8 otherwise; Rhythm Room awards 1–16 based on tap accuracy. Each run pays once. Quests add larger rewards, so buying cosmetics remains possible after all authored quests are complete. Purchases debit once and remain owned after reload. Previously equipped items are retained when loading older profiles.

The renderer has 158 choices across hair, outfits, hats, glasses, accessories, shoes, and emotes, including 48 accessories. Of the 123 nonempty choices in the five equipment/emote groups, 112 (91%) start behind Notes, achievements, or level rewards. Hair, skin, clothing colors, base outfits, and a small starter wardrobe remain available. Locked items can be previewed; saving explains the unlock requirement. Unlocks never equip automatically.

## Musician missions and XP

Talk to a musician and choose **Any missions for me?**, or open a mission from **Meet musicians**. Accept before starting a fresh cabinet game. Nine authored missions use completed results, including Music Triad wins/captures/comebacks, Pitch Race runs/streaks, and Rhythm Room perfect rounds or 20/50 consecutive notes. Consecutive-hit tracking resets on misses and extra taps. Finishing a mission marks it ready to collect and opens a notification, including while a game is open. Return within talking distance of its musician and choose **Collect reward** to receive its Notes and 100 quest XP once. Remote mission panels and the profile show progress but cannot pay rewards. Collection can be retried after a browser write failure without duplicate payment. Earned achievements also show notifications; loading old progress does not replay them.

Talk to a nearby musician and choose **Ask me a music question · Earn Notes** for trivia. Each of the nine visitors has five questions: 45 in total, covering pitch, rhythm, steady beat, dynamics, timbre, tempo, articulation, melody, harmony, and musical form. Correct answers award 4 Notes the first time that question is solved. Wrong answers offer a hint and another try; completed questions can be practiced without another payment. Trivia rewards stay in the existing Notes journal and do not award XP.

XP comes from completed cabinet games, earned achievements, musician quests, Chopin challenges, and played original Song Machine compositions. Buying items or spending Notes awards no XP. Twelve levels unlock cosmetics and eight additional Song Machine sounds. **Profile** shows your live character, level, exact XP remaining, the actual next cosmetic and sound rewards, active missions, and classroom progress. The Profile home keeps the avatar, level, Notes, and exact XP-to-next visible, with **My missions**, **Level prizes**, **My learning**, and **My activity** cards. **Level prizes → See all level prizes** opens all thresholds and rewards. Submenu navigation keeps current saved progress and never grants rewards. Gaining a level opens a popup with the newly unlocked character looks and Song Machine sounds, plus a shortcut to your profile. Level changes from Song Machine inside its cabinet also announce in the world; loading an existing saved level stays quiet. Each new classroom tutorial completion earns a once-only 50 XP achievement; reviews award no extra XP. Imported songs retain their instrument sounds even when the listener has not unlocked those sounds for new selections.

Game messages check the active iframe, expected origin, game ID, and per-session token. On the published shared origin, live hooks additionally observe actual Rhythm Room hit ordering. These are client-reported progress records, not a server anti-cheat system. Local development cannot establish the public games' parent-origin handshake; unit and integration fixtures cover the bridge without changing those games' allowlists.

## Hall of Fame and dance floor

**Hall of Fame** or E near its wall opens number-one records. Pitch Race's existing public Classic leaderboard is read without credentials. Completed cabinet results also maintain per-mode browser records for Pitch Race, Music Triad, and Rhythm Room. The latter two have no existing shared leaderboard, so their records are explicitly labeled **Best in this browser**. Piano Lab shows completed challenge mastery; Song Machine remains a composition studio.

The dance floor has 78 measured quadrilateral tiles. Grounded footsteps illuminate the actual cell, preserving its grout, and departed tiles fade. Disco pins ignore walking collision; room boundaries still contain their projections. FX Off retains basic footstep interaction while disabling decorative lighting.

## Storage and art

New local keys: `codaNotesWalletV1`, `codaMusicianMissionsV1`, `codaPlayerProgressV1`, `codaHallOfFameV1`, `codaPianoTakeV1`, `codaPianoProgressV1`, `codaClassroomLessonsV1`, `codaClassroomQuizzesV1`, `codaRhythmFishingV1`, and `codaFishingAudioV1`. Existing avatar, NPC costume, and editor data keep their current keys. Currency, quests, levels, and records currently remain in this browser; existing avatar cloud sync is unchanged.

The four pictured plants, including pots and shadows, were rebuilt in both world and foreground art. `scripts/build-plant-repairs.cjs` stitches the generated repair plate into the approved crop, rephases the floor grid, and retains the fifth plant outside the screenshot. It pins the already character-cleaned input revision for deterministic rebuilding. Legacy passage-plant project entries remain valid but render transparently, preventing old local layouts from repainting the permanently removed plant.

Relevant checks:

```sh
node --test tests/*.test.cjs
python3 tests/learning-world-browser.py
python3 tests/fishing-world-browser.py
python3 tests/rhythm-fishing-browser.py
python3 tests/time-signature-lesson-browser.py
python3 tests/music-notation-browser.py
python3 tests/student-world-browser.py
python3 tests/music-rewards-world-browser.py
python3 tests/musician-trivia-browser.py
python3 tests/classroom-tutorials-browser.py
python3 tests/classroom-quiz-world-browser.py
python3 tests/player-profile-browser.py
python3 tests/settings-profile-menus-browser.py
python3 tests/reward-notifications-browser.py
python3 tests/game-reward-notifications-browser.py
python3 tests/piano-lab-browser.py
python3 tests/music-classroom-browser.py
python3 tests/activity-menus-browser.py
python3 tests/notes-shop-menus-browser.py
python3 tests/classroom-menus-browser.py
python3 tests/song-progression-browser.py
python3 tests/clean-world-art.py
```


## Long-term rewards and visitors

Visit Riff’s Notes Shop for **Big goals**, **Pets**, **Transformations**, **Visitors**, and **Mastery rewards**. Purchases stay owned; visit Pip’s boutique to equip a look or companion. Unlocks never equip themselves.

| Reward | Requirement |
| --- | --- |
| Alien transformation | 12,000 Notes |
| Cosmic cat companion | 6,000 Notes |
| Neon dragon companion | 9,000 Notes |
| Celestial crown / Nebula aura | 4,000 / 3,000 Notes |
| Rhythm fox companion | 100 notes in a row in Rhythm Room |
| Lake otter companion | Catch every one of the 30 fish species |
| Piano phoenix companion | Complete all nine melodies from memory; mistakes restart the tune |
| Triad champion crown | Win Advanced Music Triad on Hard |
| Pitch laurels, radiant crown, Starlight transformation | Complete Pitch Race Level-mode levels 10, 20, 30, 40, and 50 |

External-game milestones use accepted game results. Music Triad now reports its Simple/Advanced rules and the lowest computer difficulty used during the match; a Hard Advanced computer win unlocks the Triad crown. Pitch Race must report a completed Level-mode level. Tutorials, incomplete matches, duplicate reports, and missing metadata never grant those rewards. Existing Firebase projects and rules are unchanged.

Six regular visitors take turns in the arcade, walking through the entrance when they arrive or leave. Active quest givers and people you are talking to remain available. Finding an absent musician asks them to return through the entrance. Invitations unlock Vee Jay, an original TV-headed DJ (6,000 Notes), Zizi, an original alien visitor (8,000), and Metronome, an original robot (10,000). These purchases expand the visitor pool and do not replace your character.

The compact header offers Profile, Developer, music, and Settings. Settings starts with **Sound & reading**, **Screen & effects**, **My player**, and **Help & updates**. The existing text-speed, music, effects, zoom, vibe, player, logout, title-screen, notebook, and history controls live on their focused pages. The music switch mirrors the header control. Back and Escape return to Settings home before closing; Done closes the panel. Settings replaces an open shared panel, including Profile, so dialogs stay separate. Enter rooms through their doors, visit the boutique to customize, and talk to the DJ to choose jukebox music. A selected jukebox song loops continuously until stopped or replaced. Escape closes the top dialogue or store, and Tab opens settings during play.

Song Machine opens in Simple mode: one grid with three octaves and three drum rows, plus note-length icons. Advanced mode preserves the original full editor and the same composition, including tracks and notes outside the Simple grid.

### Chopin’s Note Rush

Use the main **Note Rush**, **Scales**, and **Melodies** buttons, or talk to Chopin for his greeting, advice, and music-history friendship quests. Note Rush also appears in **Menu → Challenges**. Choose treble or bass clef; difficulty increases automatically every ten correct pitches. Walk onto the pitch shown on the wall staff and press **E** (touch: **Play note**). Keyboard-panel playing and recording playback do not submit answers.

The countdown starts at 10 seconds. Every correct pitch adds 3 seconds; incorrect pitches subtract one second and leave the current target in place while the clock continues. Read pairs and three-pitch turns from left to right, one pitch at a time. The game shows the score when time runs out and offers a restart or new settings. Menus, conversations, editing, and a hidden page pause the timer. Leaving the lab cancels the run.

Pitches 1–10 use natural notes. Pitches 11–20 introduce sharps and flats. Pitches 21–30 add key signatures. From pitch 31, natural signs can cancel key signatures. From pitch 41, turns contain two pitches; from pitch 51, they contain three. Each pitch is answered in order and earns its own three-second bonus. Both clefs use the fixed C4–B5 floor-piano range (bass-clef notes use ledger lines above the staff); grand staff is omitted. The target piano key is not highlighted.

All melody, scale, and interval challenges use C4–B5. Frère Jacques is arranged one octave higher throughout so its closing low G remains below the opening C while staying on the keyboard. Written notation, demonstrations, guided targets, and memory pitches share that arrangement.

### DJ Line Dance tours

DJ Coda now offers Normal, Hard, and Extreme tours with ten stages each. Every stage is a fixed sixteen-bar song and dance. Score at least 80% of the points to pass each stage; finish all ten before the next tour unlocks. Perfect scores unlock the ten original songs in the jukebox. Passed stages offer **Watch dance** with no input or rewards. The musical backing includes a quiet voice playing the exact scored rhythm. The stages cover 4/4, 2/4, 3/4, 6/8, cut time, 5/4, 7/8, 9/8, and 12/8. See [the Line Dance guide](docs/dj-line-dance.md) for the song list, timings, achievements and quest links.

Note Rush results now count toward new musician missions and Chopin friendship quests. Note Rush, melody and scale achievements appear in the existing achievement list. Use **Finish current Note Rush run** in its game-menu section to save a run without waiting out the timer.
