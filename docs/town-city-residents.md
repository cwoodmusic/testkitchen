# Coda Town residents

The city now simulates eighteen named residents independently of the camera. Their destinations follow the placed apartment tower, Coda Arcade, furniture store and nearby seating. Panning or zooming does not move residents or create replacements. Builder and Play use the same simulation.

Residents walk to entrances and gathering spots, take seats on actual bench cushions, stop for paired conversations, and return home. Apartment journeys pass through the room door, floor hall, elevator and lobby. The interior and street share one resident state, so a resident who is outside is absent from their room. The city keeps advancing while the player is indoors. Routines start when a town session loads; they are not written into the user's map JSON.

Each bench seat has one reservation and a separate walk-up point. Residents wait for that point to be clear before standing. The opt-in seated pose has bent knees and a cushion-level hip anchor. Conversation partners face each other, and casual walkers resume their destination after stopping to talk. Player dialogue holds its participant until the dialogue closes.

When the streets have gone quiet, two available residents can arrange a short meeting at clear points away from entrances. Both walk over before talking, then resume their errands. Only one meeting is scheduled at a time; a blocked or interrupted meeting expires and releases both residents. Queue members, homebound residents, seated people and stage visitors keep their current activity.

Apartment, arcade and furniture-store visitors join a physical first-in, first-out line near the door. Up to three people wait in spaced positions while one person enters. One arriving visitor approaches the tail at a time; extra arrivals reserve separate nearby waiting spots. Separate incoming and outgoing lanes are used where the artwork and placed obstacles leave room. A narrow entrance reserves the entire shared corridor, keeps its waiting line beyond it, and routes exiting residents into a clear side pocket before admitting the next person. Waiting exits receive priority after the current entrant clears. A full line sends extra visitors to a nearby gathering spot to try again later. Reservations, journeys and visits belong to the running session and never alter the saved map.

Pedestrians keep a minimum foot separation and commit to a collision-checked route around someone in their way. They can step back to make room before passing through a narrow passage. People in the same entrance line follow their leader. A blocked path is reconsidered without changing the destination.

The large gazebo has a reserved stage visit: approach the front, walk up the center steps, pause on the deck, and leave by the same steps. The side planters, posts and rear rail stay solid. The deck uses the gazebo's terrain anchor so the resident stays at the correct height on raised ground. Furniture-store visitors reserve one of eight apartments, walk to its lobby door and enter that apartment's separate scene. They are visible only in the correct apartment and return to the same lobby door before taking the outgoing lane to the street. Arcade visits remain inside until the visitor comes back out. Cart hosts still offer dialogue only.

The coffee, bakery and flower carts on the current map each have a host. Other supported market and festival carts also receive hosts when placed on reachable land. Walk up to a counter and press **E** in Walk test or Play to talk. Cart hosts offer dialogue only. The existing furniture store continues to use its purchasing system.

Navigation prefers sidewalks and plazas, checks production terrain and object collision, and respects stairs, water, walls and closed gates. Cached navigation data changes when authored geometry changes; route searches share a small per-frame time budget. Moving a building or cart updates its destinations. NPCs can still be hidden with the builder's NPC toggle.

## Verification

- `node --test town/world/ambient-npcs.test.mjs town/world/city-residents.test.mjs town/world/npc-navigation.test.mjs town/world/npc-district.test.mjs tests/urban-interiors.test.mjs tests/character-renderer.test.cjs`
- `python tests/town-city-residents-browser.py --map project.json --screenshots /tmp/city-residents`
- `python tests/town-npc-queues-stage-browser.py --screenshots /tmp/town-queues-stage`

The browser regression advances six city minutes on the imported map and checks camera independence, complete apartment round trips, scene exclusivity, seat reservations, paired conversations, collision, movement progress and fixed cart hosts. It also exercises actual Play, continued indoor simulation, conversation holds and vendor dialogue. It never changes the source project file.

The current Node suite passes 376 tests. Focused regressions cover six simultaneous entrance arrivals, a queue leader returning from a passing detour, shared-corridor exit priority, bench departure clearance, venue deletion, scheduled meetings, eight independent apartment showroom scenes and six opposing pedestrians crossing a narrow promenade.

The final browser run used the unchanged 120-object island. All three entrances formed visible FIFO lines and cleared both test visitors. A simultaneous shared-arcade entry/exit kept 86 pixels between residents and admitted the entrant only after the exit cleared. Both NPC and player physics traversed the gazebo steps and deck. Actual pedestrian detours maintained 64 pixels of clearance.

Over six simulated minutes at 60 updates per second with the apartment store, the city completed 40 passing maneuvers, 32 queue services, 27 building entries, 25 room returns, three gazebo visits and two planned conversations. It passed 22,527 walking collision samples with no stalled residents or physical/FIFO errors. All queues cleared; the longest completed wait was 3.17 seconds. Real Play measured about 58 FPS at overview scale, and lobby/apartment views measured about 60 FPS. Performance depends on hardware and map contents; no source map bytes changed.
