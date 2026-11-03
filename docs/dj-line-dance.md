# DJ Coda’s Line Dance

Visit DJ Coda and choose **Play DJ Coda’s Line Dance**. Each difficulty has ten sequential stages. Pass with at least **80% of the possible points**, including extra-tap penalties. Pass all ten stages to open the next difficulty. Replaying a passed stage never removes its pass.

The renamed difficulties retain their earlier tempo and timing windows:

| Difficulty | Previous name | Quarter-note BPM | Hit window |
| --- | --- | --- | --- |
| Normal | Easy | 80 | 190 ms |
| Hard | Normal | 92 | 160 ms |
| Extreme | Hard | 88 | 170 ms |

All stages run for **sixteen complete bars**. Each song has a fixed direction routine, so retries can be learned. Compound meters use dotted-quarter pulses; 7/8 groups eighths as 2+2+3, and cut time uses half-note pulses. Count-ins, metronome clicks, beat-line pulses, notes, and NPC cues follow the same audio transport with device-output latency compensation.

| Stage | Original song | Meter | Musical style | Animation style |
| --- | --- | --- | --- | --- |
| 1 | Neon First Light | 4/4 | Synth-pop | Bounce |
| 2 | Double Bounce | 2/4 | Funk | Robot |
| 3 | Mirrorball Waltz | 3/4 | Ballroom waltz | Curtsy and sway |
| 4 | Electric Sway | 6/8 | Celtic jig | Disco points |
| 5 | Midnight March | 2/2 | Brass march | Moonwalk |
| 6 | Five Star Strut | 5/4 | Jazz in five | Claps |
| 7 | Seven Sparks | 7/8 | Latin percussion | Spins |
| 8 | Triple Current | 9/8 | Orchestral | Air guitar |
| 9 | Twelve Lights | 12/8 | Blues shuffle | Jump and cheer |
| 10 | Afterglow Finale | 4/4 | Chiptune | Breakdance |

Each song has its own accompaniment and lead voice: synth-pop offbeats, syncopated clavinet funk, piano-and-strings oom-pah waltz, rolling flute jig, brass-and-snare march, electric-piano jazz with walking bass, mallets and congas, sustained orchestral strings and harp, organ-led blues shuffle, and square-wave chiptune. Harmony includes major, minor, seventh-chord and blues colors. The four-section theme/answer/breakdown/return form remains sixteen bars. `dance-song-audio.js` renders the same instrument envelopes and percussion in the game and the unlocked jukebox versions. A quieter pitched voice doubles the exact written tapping rhythm; rests remain silent. Music and metronome have independent controls.

Match direction arrows when their notes reach the pulsing strike line. Each note needs one press, including long notes; rests need none. A Perfect hit earns 100 points and a Good hit earns 70. Missing or pressing an incorrect arrow earns no points; extra taps also increase the score denominator. A **perfect score** requires every note to receive Perfect timing and no extra taps. It unlocks that song in the main jukebox, shared across all difficulties. All ten songs have sixteen-bar jukebox versions.

Once a stage is passed, **Watch dance** replays the music and full group routine without requiring input. The notation and arrow controls hide while watching. Watching grants no XP, passes, songs, achievements, or quest progress.

The player joins up to three available visitors. Each routine has its own gesture, step size, bounce, tilt, and squash, timed to the song. Misses cause a short stumble while the NPCs continue. Reduced motion removes bounce, rotation and scaling. Leaving restores borrowed positions, camera, and the previously playing song; backgrounding or changing profiles stops playback and input.

Stage passes and perfect-song unlocks save atomically with XP in the existing profile progression journal. Duplicate runs do not pay twice. Hard and Extreme require completed prior tours even if the start function is called directly. Failed storage writes leave progress retryable. No separate campaign store or public leaderboard is used.

Achievements cover the three complete tours, five different meters, all ten songs, and the existing dance milestones and cosmetics. Musician missions include passed stages, a perfect song, a Normal tour, and a harder-tier pass. New friendship quests can also ask for dancing. Previously accepted friendship quests keep their original rules.

Piano Lab also records Note Rush milestones (10, 30 and 50 correct pitches, plus bass clef), first melody and scale completions, twelve scales and all 24 scales. Chopin’s new friendship sequence includes melodies, scales and Note Rush; other musicians offer Note Rush missions. A Note Rush run can be finished from its game-menu section to save its final score.

Implementation: `dance-campaign.js` owns the songs, routines and campaign rules; `dance-rhythm-engine.js` owns judging; `dance-rhythm-game.js/css` owns UI and audio; `dance-floor-stage.js` owns poses; `dance-floor-world.js` borrows world actors. Classroom mission schema and generated database rules include the new missions. Deploy the updated classroom rules before syncing those mission entries to an existing Firebase database.
