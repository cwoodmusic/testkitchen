# Coda Town residents

The city now simulates eighteen named residents independently of the camera. Their destinations follow the placed apartment tower, Coda Arcade, furniture store and nearby seating. Panning or zooming does not move residents or create replacements. Builder and Play use the same simulation.

Residents walk to entrances and gathering spots, take seats on actual bench cushions, stop for paired conversations, and return home. Apartment journeys pass through the room door, floor hall, elevator and lobby. The interior and street share one resident state, so a resident who is outside is absent from their room. The city keeps advancing while the player is indoors. Routines start when a town session loads; they are not written into the user's map JSON.

Each bench seat has one reservation and a separate walk-up point. The opt-in seated pose has bent knees and a cushion-level hip anchor. Conversation partners face each other, and player dialogue holds its participant until the dialogue closes. Entrances and hangouts have individual arrival positions, with yielding and crowd-aware rerouting to keep shared passages moving.

The coffee, bakery and flower carts on the current map each have a host. Other supported market and festival carts also receive hosts when placed on reachable land. Walk up to a counter and press **E** in Walk test or Play to talk. Cart hosts offer dialogue only. The existing furniture store continues to use its purchasing system.

Navigation prefers sidewalks and plazas, checks production terrain and object collision, and respects stairs, water, walls and closed gates. Cached navigation data changes when authored geometry changes; route searches share a small per-frame time budget. Moving a building or cart updates its destinations. NPCs can still be hidden with the builder's NPC toggle.

## Verification

- `node --test town/world/ambient-npcs.test.mjs town/world/city-residents.test.mjs town/world/npc-navigation.test.mjs town/world/npc-district.test.mjs tests/urban-interiors.test.mjs tests/character-renderer.test.cjs`
- `python tests/town-city-residents-browser.py --map project.json --screenshots /tmp/city-residents`

The browser regression advances six city minutes on the imported map and checks camera independence, complete apartment round trips, scene exclusivity, seat reservations, paired conversations, collision, movement progress and fixed cart hosts. It also exercises actual Play, continued indoor simulation, conversation holds and vendor dialogue. It never changes the source project file.

The final local checks passed 296 Node tests. The browser run on the unchanged 120-object island observed 21 returns home, 18 subsequent departures, 54 sitting events, and later conversations over six simulated minutes. Actual Play measured about 59 FPS at overview scale with eighteen residents and three vendors. Timing depends on hardware and map contents.
