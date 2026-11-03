# Rhythm Room

A classroom rhythm practice app with a one-line staff, recorded instruments, a bouncing beat ball, and listen/play rounds.

## Run

Serve this folder with any static web server. For example:

```sh
python -m http.server 8000
```

Open http://localhost:8000 in a modern browser and press **Start loop** to enable sound. No build step, dependencies, account, or API keys are required.

## GitHub Pages

1. Create a GitHub repository and upload the contents of this folder. Keep `index.html`, the JavaScript/CSS files, and the bundled font/audio files together at the repository root.
2. In the repository, open **Settings → Pages**.
3. Choose **Deploy from a branch**, then select `main` and `/ (root)` and save.
4. Open the Pages link shown by GitHub once deployment completes.

## Practice controls

Select rhythm building blocks, choose a tempo, and start the loop. Each rhythm plays once with the Listen cue, repeats with the drum cue, then is replaced by a new random rhythm. **Settings** contains the recorded-instrument choices, repeat-turn sound, steady click, initial count-in, tap sound, and rhythm-count visibility.

The main controls are **Tempo**, **Volume**, and **Settings**. Tempo shows an
approximate musical word (Largo through Presto) alongside the exact BPM.
The shared Volume slider controls recorded instruments, synthesized sounds,
taps, and the metronome, including exact mute. It changes smoothly while the
loop keeps its current position, score, and streak, and remembers this device's
setting when browser storage is available.

Single eighth notes unlock basic syncopations when the other required note types are selected. Paired eighth notes alone do not. Adjacent short notes are beamed and consecutive rests are consolidated while preserving beat boundaries. Dotted sixteenth notes are excluded.

## Tap Practice count-in

Tap Practice listens for two bars, gives you a four-pulse count-in, then starts your two-bar turn. Tap along during the count without penalties. A tap close to the opening downbeat can match the first note early; the immediate handoff does not add an accidental extra tap. A delayed input event cannot reopen an already completed round or report its rewards twice. Listen & Follow retains its listen/play timing without that extra preparation phase. The optional initial count-in remains separate. Acoustic snare is the default recorded instrument.

Click the **time signature on the staff** to choose **4/4**, **2/2 (cut time)**,
or **6/8** from a small menu. Enter/Space opens it from the keyboard; Escape
closes it. Tempo and the
metronome follow quarter-note, half-note, or dotted-quarter beats respectively.
Each rhythm fills two measures in that meter. Notes beam in the selected
meter's beat groups.

6/8 has its own checkbox set: dotted half, dotted quarter, eighth–quarter,
quarter–eighth, and three eighths. Optional sixteenth patterns replace eighths
in pairs, with runs of 2, 4, or 6 sixteenths; they are straight subdivisions,
not triplets. Its four rest choices are dotted half, dotted quarter, quarter,
and eighth. There are no sixteenth rests. Every small group fills one big
dotted-quarter beat; the dotted halves fill a complete bar. The quarter/eighth
rest choices add matching notes to finish the big beat. Each meter remembers
its checked choices when switching to another meter and back.

**Counts under the notes** places the actual rhythm's syllables directly below
the staff, aligned with the noteheads. It replaces the old beat-number boxes;
there is no separate counting panel. Short notes show their onset syllables,
so an eighth followed by two sixteenths reads `1 & a`, without an unused `e`.
Longer holds keep the main beat numbers: a whole note in 4/4 reads `1 2 3 4`,
and a dotted quarter followed by an eighth reads `1 2 &`. They do not fill the
hold with unused eighth- or sixteenth-note syllables.

In 6/8, six eighths read `1 la li 2 la li`; quarter–eighth–quarter–eighth reads
`1 li 2 li`. Cut time uses half-note main beats, so a whole note reads `1 2`.
Rest counts appear in gray parentheses and are counted silently. The current
syllable follows the same audio clock as the notation, including during holds
and rests. Choose **Off** under **Settings → Counts under the notes** to hide
the counts without stopping playback.
Changing the meter stops and regenerates the rhythm. On phones the staff and
its counts scroll together.

A large **1 → 2 → READY → GO!** appears over the screen before every Tap
Practice turn, one cue per preparation beat: GO appears on count four and the
overlay clears when playing starts. The countdown and PERFECT text are
translucent with no panel behind them, keeping the notation visible. Tapping
stays enabled, including in fullscreen and on phones. The countdown does not
appear in Listen & Follow.

Timing checks: `node --test tests/*.test.cjs` and `python3 tests/rhythm-count-in-browser.py` and `python3 tests/rhythm-session-browser.py` (Python Playwright and Chromium). Browser tests block external services and use a disposable profile.

Meter and counting checks: `python3 tests/rhythm-meters-browser.py` and
`python3 tests/rhythm-written-counts-browser.py`. Compound controls and the
time-signature picture: `python3 tests/rhythm-compound-catalog-browser.py`.

## Note streaks and perfect rounds

Tap Practice shows a large **Note streak** counter above the tap pad, with the
best streak from this visit. It carries between rounds while the loop runs.
Matched notes count toward the same streak goals as the arcade missions;
count-in warmups and written rests do not add notes or break a streak.
Missing a note or adding an extra tap resets the counter. Stop, changing modes,
or changing the rhythm/tempo starts a new streak, while the visit's best remains.

A completed round celebrates with a large **PERFECT!** and confetti when every
note is matched and there are no misses or extra taps. Accepted early/late hits
still count; their timing tips remain in the practice tracker. All-rest rounds
do not trigger confetti. The effect does not interrupt input or add sounds.
Reduced motion, or the arcade's saved Motion: Off setting, uses a static perfect
badge. Effects stop when the loop stops or the page is hidden.

Feedback checks: `python3 tests/rhythm-feedback-browser.py` and
`python3 tests/rhythm-turn-countdown-browser.py`.

## Classroom privacy

Rhythm Room keeps gameplay local and does not use Firebase or public score services. When embedded in a same-origin Coda classroom, it inherits the parent's scoped progress store before reading practice history, and reports completed rounds through the existing arcade bridge. Standalone play remains local.

## Included assets and credits

- Bravura music font, Steinberg Media Technologies: SIL Open Font License 1.1. See `Bravura-LICENSE.txt`.
- Acoustic snare, Karoryfer Samples / Frankensnare: CC0. See `LICENSE-Frankensnare.txt`.
- Recorded piano and organ, Versilian Studios / VSO2, distributed by Nicholaus Brosowsky's tonejs-instruments: CC BY 3.0. See `CREDITS.txt` and `organ-source-info.txt`.

The app loads these bundled files directly, so browsers can cache the font and recordings separately from the page. Keep the bundled asset credits and licenses with redistributed copies.
