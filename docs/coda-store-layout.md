# Coda Furnishings: two floors and twelve homes

The exterior floor plate remains **3072 × 2048**. Ground-floor showrooms 01–08 retain their IDs, 1184 × 448 units, side entrances, and existing resident approach routes. The upper gallery contains four 1184 × 832 homes in two columns and two rows: Retrofuture Spaceport, Cyberpunk Neon Loft, Steampunk Clockwork Home, and Robot Companion Home.

## Planning decisions

The layouts apply the purpose, privacy, accessible openings, grouped seating, coherent backgrounds, and avoidance of superfluous objects discussed in Edith Wharton and Ogden Codman Jr.'s *The Decoration of Houses*, chapter II, “Rooms in General” ([Project Gutenberg, ebook 40367](https://www.gutenberg.org/ebooks/40367)). The chapter was read from the local research copy. Its fireplace-centered historical example becomes a record-listening focus in these musical homes.

Modern circulation and working-space references came from the [U.S. Access Board's walking-surface guidance](https://www.access-board.gov/ada/#ada-403_5_1), [door maneuvering guidance](https://www.access-board.gov/ada/guides/chapter-4-entrances-doors-and-gates/), and [kitchen guidance](https://www.access-board.gov/ada/#ada-804), read through the agency's official source repository. These inform continuous routes, usable approaches on both sides of doors, and connected kitchen work areas. World pixels have no established conversion to inches; these are game-layout decisions, not an accessibility certification.

- Every home has one complete private bathroom, a private bedroom, connected sink/prep/stove/refrigerator/storage, dining, and living functions. Native collision bases determine usable routes.
- The compact original homes retain their validated private-room and browse routes. The four larger homes explicitly reserve clear 120–176px circulation zones, with no furniture bases or walls inside them.
- Larger living groups pair the sofa, coffee table, rug, a cardinal-facing conversation chair, and a record console. The console is a musical focal point; its lava lamp is supported on the console rather than obstructing the floor.
- The two upper plan families separate private rooms from public arrival and dining. One stacks a bedroom and bath in a private wing; the other separates the sleeping and bathing wings around a daylight work/dining nook. Mirrored partners preserve usable door approaches.
- Each theme has coordinated individual floor and wallpaper patterns. Fine motifs leave quiet background around distinctive furniture.

## Scene and navigation contract

`SHOWROOMS` contains all twelve displays. Each has `storeFloor`, stable `id`, `threshold`, `enterNormal`, `lobbyApproach`, `lobbyReturn`, and an independent apartment plan. `getStoreFloorShowrooms(1)` returns eight; floor 2 returns four.

`getInterior({kind:'shop',floor:1})` keeps cache ID `furniture-store`. Floor 2 uses `furniture-store-floor-2`, with the same floor-plate dimensions. Showroom cache IDs remain `showroom-<id>`; their floor comes from the display, so stale caller floor values cannot return a visitor to the wrong gallery.

The controller exposes `goStoreFloor(floor,arrival='lift')` and `showStoreDirectory()`. Lift arrival is `(1536,380)`; stair arrival is `(1732,380)`. Physical lift and stair interaction zones use store-specific actions, independent of the residence tower's fifteen-floor directory. Entering a showroom requires being on its floor; leaving returns to that showroom's door on the same floor. The shop selector includes all twelve collections on either floor.

Residents bound for upper homes walk from the original street entrance to the lift, disappear only during the 2.5-second ride, then walk from the actual upper lift landing to the correct showroom. They reverse that journey on departure. Their original resident identity and purchases never change during the trip.

## Verification

Node checks cover all 48 interior scenes, all twelve apartment functions and both sides of privacy doors with 16px player collision padding, non-overlapping native furniture bases, original lower-store journeys, upper lift journeys, distinct floor cache identities, collection buyability, and deterministic material rendering. Browser QA separately checks visible transitions and actual walking.
