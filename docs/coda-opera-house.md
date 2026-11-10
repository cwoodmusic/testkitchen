# Sydney Opera House in Coda Town

The Opera House is a movable, south-facing **Urban kit** landmark. Search for **Sydney Opera House** in Town Builder, place it, and use **Walk test**. Approach the central glass entrance and press **E**. Adding the asset does not change terrain or place anything elsewhere on the saved map.

The exterior’s floor plate and the concert hall both measure **4096 × 2560 world units**. The tall sail roofs have their own transparent padding, collision outline and depth slices. The sandstone approach stays walkable; warm windows and uplights use the town’s existing night-light renderer.

The enterable hall follows the supplied Concert Hall reference: warm timber ribs, red seats, wrapping galleries, a large rear pipe organ and pink acoustic reflectors. There are 196 usable ground-floor seats with central, side and cross aisles. The raised stage has a broad staircase. Chairs, architectural tiers, performers and instruments have physical collision.

Press **E** at a seat to sit and watch. The camera frames the stage while seated. Press **E**, use **WASD**, or choose **Stand up** to return to the aisle and the walking camera. The entrance, **Go outside**, and **Escape** return to the town.

## Performances and music

The same shuffled playlist runs inside and outside. Orchestra recordings bring 52 performers including a conductor to the stage; early New Orleans-style jazz brings an eight-piece band; piano recitals feature historical portrayals of Chopin, Liszt or Debussy. Native character sprites have instrument-specific hand, bow and conducting movements. Formations persist between recordings of the same type and do not respawn with the camera.

Eight locally bundled recordings provide about 28 minutes of music. Each recording plays completely before the playlist advances. The shuffle plays every track before repeating and avoids consecutive repeats across playlist cycles. Town sound is 4.5% of the selected master volume with a gentle 3.2 kHz low-pass filter, other interiors 2.5% with muffling, and the concert hall 100% with full clarity. Entering or leaving changes the gain smoothly without restarting the recording.

The **Concert music** controls offer Play/Pause, Mute, volume and **Programme & credits**. Browser playback begins after a real user gesture. The credits identify the actual recording performers separately from the historical stage characters, and offer **Next performance**. Pausing or muting remains your choice through scene changes. Removing the venue stops the town music; background tabs suspend it without losing the current position.

Full recording sources, attribution and processing details are in [opera-music-sources.md](opera-music-sources.md). The classical recordings use public-domain dedications, CC BY 3.0 or CC BY-SA 4.0; the two historic jazz selections are identified as **US public domain**, with that geographic scope preserved in the in-game credits.

## Validation

The concert model tests check every seat’s collision and route from the entrance, stage access and the exact shared floor size. Performer tests cover the actual programme’s ensemble identities, instrumentation, poses, depth ordering and cached native sprites. Audio tests cover shuffle order, gesture handling, bounded failed-track recovery, preferences, lifecycle cleanup and source/time continuity across scene changes.

Run `python3 tests/town-opera-browser.py` for real keyboard walking and seating, stage changes, decoded audio, volume transitions, credits, frame timing and screenshots in an isolated browser save. The test never writes the supplied map source.

Release previews: [exterior](town-preview/coda-opera-exterior.png), [whole hall](town-preview/coda-opera-hall.png), [orchestra](town-preview/coda-opera-orchestra.png), [jazz](town-preview/coda-opera-jazz.png), [Chopin](town-preview/coda-opera-chopin.png), [Liszt](town-preview/coda-opera-liszt.png).

The release passed 413 Node checks and real-browser Opera House and eight-showroom regressions. The concert browser measured about 60 FPS; it checked all eight actual recordings, all 196 seat approaches, physical walking routes, chair depth, narrow-screen framing, stage collisions and ensemble changes, credits, controls and uninterrupted audio across the door. The supplied map SHA-256 remained `c1eaa096ff14b3a4d2b66ba85a87eb9cfda95027e6d138162c27c8c1e73277b9`.
