# Sydney Opera House in Coda Town

The Opera House is a movable, south-facing **Urban kit** landmark. Search for **Sydney Opera House** in Town Builder, place it, and use **Walk test**. Approach the central glass entrance and press **E**. Adding the asset does not change terrain or place anything elsewhere on the saved map.

The exterior’s floor plate and the concert hall both measure **4096 × 2560 world units**. The tall sail roofs have their own transparent padding, collision outline and depth slices. The sandstone approach stays walkable; warm windows and uplights use the town’s existing night-light renderer.

The enterable hall adapts the supplied Concert Hall reference to the game camera: sweeping honey-colored timber shells with deep undersides, stepped side galleries, recessed pairs of ceiling lights and red acoustic panels. The ceiling and suspended pink reflectors occupy separate overhead layers that shift relative to the room as the camera moves. Their cast shadows remain on the room surfaces, and cutaways preserve the organ and performance sightlines. A smaller silver-pipe organ sits inside the recessed red stage bay. There are 196 usable ground-floor seats with central, side and cross aisles. The raised stage has a broad staircase. Chairs, architectural tiers, performers and instruments have physical collision.

Press **E** at a seat to sit and watch. The camera frames the stage while seated; **drag the concert view** to look around a little. Press **E**, use **WASD**, or choose **Stand up** to return to the aisle and the walking camera. With reduced motion enabled, deliberate dragging still pans the view and the extra overhead parallax is suppressed. The entrance, **Go outside**, and **Escape** return to the town.

## Performances and music

The same shuffled playlist runs inside and outside. Orchestra recordings bring 52 performers including a conductor to the stage; early New Orleans-style jazz brings an eight-piece band; piano recitals feature historical portrayals of Chopin, Liszt or Debussy. Native character sprites have instrument-specific hand, bow and conducting movements. Formations persist between recordings of the same type and do not respawn with the camera. Between acts, the curtains close before the performers change, then retract completely as the next recording starts. No curtain border remains across the organ during a performance.

Eight locally bundled recordings provide about 28 minutes of music. Each recording plays completely before the playlist advances. The shuffle plays every track before repeating and avoids consecutive repeats across playlist cycles. Town sound is 4.5% of the selected master volume with a gentle 3.2 kHz low-pass filter, other interiors 2.5% with muffling, and the concert hall 100% with full clarity. Entering or leaving changes the gain smoothly without restarting the recording.

The **Concert music** controls offer Play/Pause, Mute, volume and **Programme & credits**. Browser playback begins after a real user gesture. The credits identify the actual recording performers separately from the historical stage characters, and offer **Next performance**. Pausing or muting remains your choice through scene changes. Removing the venue stops the town music; background tabs suspend it without losing the current position.

Full recording sources, attribution and processing details are in [opera-music-sources.md](opera-music-sources.md). The classical recordings use public-domain dedications, CC BY 3.0 or CC BY-SA 4.0; the two historic jazz selections are identified as **US public domain**, with that geographic scope preserved in the in-game credits.

## Validation

The concert model tests check every seat’s collision and route from the entrance, stage access and the exact shared floor size. Performer tests cover the actual programme’s ensemble identities, instrumentation, poses, depth ordering and cached native sprites. Audio tests cover shuffle order, gesture handling, bounded failed-track recovery, preferences, lifecycle cleanup and source/time continuity across scene changes.

Motion checks compare the fixed room with the two overhead depths during dragging and walking, including touch, reduced motion and pointer cleanup. The four cropped overhead textures are reused across camera changes; late native-art loads refresh both the room and overhead caches.

Run `python3 tests/town-opera-browser.py` for real keyboard walking and seating, stage changes, decoded audio, volume transitions, credits, frame timing and screenshots in an isolated browser save. The test never writes the supplied map source.

Reference update: [whole hall](town-preview/opera-reference-hall.webp?v=opera-parallax-1) · [watch view](town-preview/opera-reference-watch.webp?v=opera-parallax-1).

Motion demo: [dragging and walking in the actual game](town-preview/opera-parallax-actual.webm?v=opera-parallax-1).

Release previews: [exterior](town-preview/coda-opera-exterior.png), [whole hall](town-preview/coda-opera-hall.png?v=opera-parallax-1), [orchestra](town-preview/coda-opera-orchestra.png?v=opera-parallax-1), [jazz](town-preview/coda-opera-jazz.png?v=opera-parallax-1), [Chopin](town-preview/coda-opera-chopin.png?v=opera-parallax-1), [Liszt](town-preview/coda-opera-liszt.png?v=opera-parallax-1).

The browser checks cover desktop and narrow-screen framing, every seat approach, physical walking routes, chair depth, stage collisions, curtain changes, performer poses, credits and audio continuity across the entrance. The supplied map remains byte-for-byte unchanged.
