# Town Builder: smoother outdoors, land selection and softer concert sound

The outdoor lag was reproduced on the supplied 120-object map, with an isolated Opera House added for testing. The expensive views repeatedly redrew curved cliffs and clipped the full building image for every facade strip.

Unchanged projected ground and curved cliffs now reuse bounded terrain chunks, and consecutive building strips share a draw while retaining pedestrian and object ordering. The original cliff strip algorithm paints each chunk; there is no second cliff bitmap layer. Fully offscreen artwork and characters skip drawing; their simulation continues. Fountain displacement calculations reuse row and column buffers with byte-identical animation output. An idle player no longer performs repeated collision checks.

Measured in the same Chromium session setup, 1920 × 1200 viewport and device scale 2:

| View | Before | After | Mean frame CPU before → after |
| --- | ---: | ---: | ---: |
| Opera House and organic shoreline | 10 FPS | 58–60 FPS | 93.7 → 6.4–10.1 ms |
| Courtyard, night and NPCs | 38 FPS | 60 FPS | 22.0 → 6.1 ms |
| Walking outdoors at night | 41 FPS | 60 FPS | 19.2 → 6.6–7.4 ms |

These are measurements on the test machine, not a guarantee for every device. The full-map view remains around 59–60 FPS. Building pixel comparisons cover all four rotations, fractional camera positions, recessed arcade wings, and characters in front and behind. Terrain caches retain live water, cliff/shores, stairs and piers; geometry and map data are unchanged.

## Click to select land

Choose **Select land → Elevation / enclosed area**, then click a flat patch. The selection follows connected dry ground at that elevation and stops at elevation changes, water, walls, fences and closed gates. Open gates connect areas. Off-grid Music Square walls are respected; ordinary buildings and trees do not cut up the land selection.

Use **Raise selected land** or **Lower selected land** to edit the selected region. Undo restores the edit. Rectangular and freeform selection remain available. Selecting land alone does not change or save terrain.

## Outdoor concert music

Town music is now 4.5% of the master volume, with a gentle 3.2 kHz low-pass filter. Other interiors remain quiet and muffled; the concert hall restores the full frequency range and selected master volume. Scene changes keep the same media source and playback position. Browsers without Web Audio retain softer ordinary playback.

The audio graph is created on a user gesture, reused, and smoothed only when the listening context changes. Native audio filtering adds no per-frame music processing on the main thread.

## Reproduction

`python3 tests/town-opera-performance.py --ref fd79869 --output /tmp/town-before` reproduces the original benchmark from immutable source. Use `--ref working --output /tmp/town-after` for the current working tree. Fixtures use isolated browser storage and never write the supplied map source.

Release verification: 461 Node checks passed, along with real browser checks of click selection, gates, raise/lower/Undo, live filtered audio, eight stage programmes and all seat routes. All 64 building pixel comparisons were exact with the terrain renderer held constant. The original map and the separate Coda Arcade checkout were untouched.
