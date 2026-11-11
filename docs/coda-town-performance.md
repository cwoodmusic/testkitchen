# Town Builder: smoother outdoors, land selection and softer concert sound

The outdoor lag was reproduced on the supplied 120-object map, with an isolated Opera House added for testing. The expensive views repeatedly redrew curved cliffs and clipped the full building image for every facade strip.

Unchanged projected ground and curved cliffs now reuse bounded terrain chunks, and consecutive building strips share a draw while retaining pedestrian and object ordering. The original cliff strip algorithm paints each chunk; there is no second cliff bitmap layer. Fully offscreen artwork and characters skip drawing; their simulation continues. Fountain displacement calculations reuse row and column buffers with byte-identical animation output. An idle player no longer performs repeated collision checks.

Initial short-sample measurements in Chromium, 1920 × 1200 viewport and device scale 2:

| View | Before | After | Mean frame CPU before → after |
| --- | ---: | ---: | ---: |
| Opera House and organic shoreline | 10 FPS | 58–60 FPS | 93.7 → 6.4–10.1 ms |
| Courtyard, night and NPCs | 38 FPS | 60 FPS | 22.0 → 6.1 ms |
| Walking outdoors at night | 41 FPS | 60 FPS | 19.2 → 6.6–7.4 ms |

These short averages missed pauses during longer camera journeys and the cost of maps with many authored walls. The sustained walking check below covers those cases. Measurements describe the test machine; they do not guarantee the same frame rate on every device. Building pixel comparisons cover all four rotations, fractional camera positions, recessed arcade wings, and characters in front and behind. Terrain caches retain live water, cliff/shores, stairs and piers; geometry and map data are unchanged.

## Sustained walking and wall-heavy maps

Twenty-second walks on the published `7a1de0a` release reproduced the reported lag. A courtyard fixture with 1,500 offscreen wall segments ran at 26.7 FPS and used 31.3 ms of frame CPU on average. New terrain chunks caused visible pauses while the camera travelled, even on the original map without authored fences.

The player now queries a spatial index of nearby collision geometry once per frame. The existing collision algorithm still checks the original boxes, polygons, gates and terrain, including its normal movement substeps. Changes to placements, terrain, gates, collision switches, undo and imported documents invalidate the index through the editor revision.

Wall runs and corner posts are derived once per revision. Drawing uses conservative bounds that include raised walls, scaled Music Square pillars, open gate posts and shadows. Offscreen walls retain their collision and NPC navigation behavior.

Terrain prefetching prepares private, detailed chunks around and ahead of the camera in small idle tasks. Only completed chunks become visible; the normal ordered terrain drawing still produces their pixels. Evicted or cancelled canvases release their backing memory immediately. Fireflies share the frame's outer canvas state save and cached glow brushes. Their curved flight and independent flashes enlarge the visible halo without rebuilding gradients for every insect; lamp fields include their expanded bloom in visibility checks.

Eighteen deterministic browser comparisons against the deployed release produced **zero changed pixels**, covering daytime and night, open and closed gates, scaled pillars, fractional camera positions, courtyards, organic cliffs and the ocean shore.

Final 20-second night walks, with NPCs enabled, compared the deployed release with this update:

| Route | FPS before → after | Frame CPU p99 before → after | Cadence pauses over 50 ms before → after |
| --- | ---: | ---: | ---: |
| Courtyards, 121 objects | 57.9 → 59.6 | 32.1 → 22.6 ms | 2 → 0 |
| Organic shore, 121 objects | 56.4 → 59.6 | 34.0 → 22.3 ms | 10 → 0 |
| Courtyards, 500 objects | 57.7 → 58.9 | 32.6 → 31.4 ms | 2 → 0 |
| Courtyards, 1,500 offscreen walls | 26.7 → 60.0 | 52.4 → 18.8 ms | 23 → 0 |

Each updated walk travelled approximately 9,000 world pixels with at least 99.9% of frames moving. All four had **zero synchronous terrain chunk builds during measured movement**; prefetch completed 98, 95, 70 and 85 chunks respectively. The heaviest wall case reduced mean frame CPU from 31.3 to 6.5 ms. A large camera jump or immediate first entry into an unwarmed area can still require a synchronous chunk; these measurements cover sustained walking.

## Cardinal furniture and first-zoom loading

A cold close-up of 500 distinct collection props exposed an image-loading hitch across 53 native atlases. DOM image loading caused each WebP to decode on a worker and again on the main thread when its pixels were consumed. Awaiting `Image.decode()` and creating a bitmap from the DOM image retained that second decode. The loaders now fetch encoded blobs and create `ImageBitmap` objects directly, with at most four active loads per provider. Eviction closes the decoded bitmaps; clearing cancels queued work and safely releases late results.

The loader-fix release completed its 53 cold native loads in 2.72 seconds while drawing continued. Its trace contains 53 worker decode events and no main-thread decodes, replacing the previous 106 worker-plus-main decode events.

After the complete furniture and interior art overhaul, the final cold transition settled 53 native requests in **3.30 seconds**, with **zero cadence stalls over 50 ms**, frame CPU p95 of 16.6 ms and maximum of 37.7 ms. Four steady far/near/repeat samples each ran at **59.8 FPS**, with CPU p95 of 9.3–10.4 ms, no stalls, repeated atlas requests or new native compilations. The four separately measured finished interiors each held 60 FPS with CPU p95 of 1.1–1.9 ms and no stalls or native requests. These are local Chromium measurements.

This dense fixture deliberately overlaps 500 different props to keep them visible. The shared native budget admitted 192 views using 2.60 megapixels; the rest used the 32-pixel overview. This measures artwork admission rather than NPC pathfinding or ordinary town walking. The four separately measured apartment interiors each held 60 FPS without stalls or native requests.

Verification includes 745 Node checks, all 5,172 collection/legacy/seating views, exact RGBA agreement for all 3,968 collection views with an independent DOM-image provider, the actual asset ZIP download, saved-room compatibility, and queued-generation cancellation. Reproduce the stress run with `python tests/town-facing-source-performance-browser.py` and pixel comparison with `python tests/town-collection-bitmap-pixels-browser.py`. These use isolated browser storage and preserve the supplied map source. See [the apartment guide](coda-apartment-homes.md) for room and cache details.

## Click to select land

Choose **Select land → Elevation / enclosed area**, then click a flat patch. The selection follows connected dry ground at that elevation and stops at elevation changes, water, walls, fences and closed gates. Open gates connect areas. Off-grid Music Square walls are respected; ordinary buildings and trees do not cut up the land selection.

Use **Raise selected land** or **Lower selected land** to edit the selected region. Undo restores the edit. Rectangular and freeform selection remain available. Selecting land alone does not change or save terrain.

## Outdoor concert music

Town music is 2.5% of the master volume with a 1.5 kHz low-pass filter. Other building interiors are nearly silent at 0.3% with a 600 Hz filter; the opera house restores the full frequency range and selected master volume. Scene changes keep the same media source and playback position. Browsers without Web Audio retain softer ordinary playback.

The audio graph is created on a user gesture, reused, and smoothed only when the listening context changes. Native audio filtering adds no per-frame music processing on the main thread.

## Reproduction

`python3 tests/town-opera-performance.py --ref fd79869 --output /tmp/town-before` reproduces the original benchmark from immutable source. Use `--ref working --output /tmp/town-after` for the current working tree. Fixtures use isolated browser storage and never write the supplied map source.

Use `--sustained --seconds 20 --ref 7a1de0a` for the deployed walking baseline and `--sustained --seconds 20 --ref working` for the current release. These runs hold movement keys along validated clear corridors, record actual camera travel and report frame CPU percentiles, worst frames and cadence stalls as well as average FPS. Fixtures include the original town with an Opera House, its organic shore, a 500-object stress copy, and 1,500 offscreen Music Square wall segments.

Initial release verification: 461 Node checks passed, along with real browser checks of click selection, gates, raise/lower/Undo, live filtered audio, eight stage programmes and all seat routes. All 64 building pixel comparisons were exact with the terrain renderer held constant. The original map and the separate Coda Arcade checkout were untouched.

Apartment and sustained-walking release verification: **585 Node checks passed**, plus all four sustained walks, the 18 exact outdoor pixel comparisons, and terrain checks for water animation, organic shores, stairs, painting, elevation and exact Undo restoration. The apartment browser checks cover all eight showroom doors, all 18 NPC homes, purchases, wall hanging placement and existing room saves; see [the apartment guide](coda-apartment-homes.md).


The larger-lighting revision was compared with the prior renderer in headless Chromium at the same Music Square position, zoom 0.42, 1280 × 1062 CSS viewport, NPCs off and matching warmup. The previous renderer measured 38.34 FPS and the updated effects 39.00 FPS; frame CPU p95 was 7.2 ms and 6.6 ms respectively, with no gaps over 50 ms or page errors in the paired samples. The result applies to this fixed-view headless test. Native furniture, doorway traversal, both showroom sign floors and saved furniture editing were verified separately in real play.
