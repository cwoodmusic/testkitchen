# Coda Furnishings: two floors and twelve homes

The exterior floor plate remains **3072 × 2048**, with all twelve original showroom IDs and collections. Every public showroom door faces south onto a horizontal hallway connected to the central 640px spine. Ground-floor frontage blocks measure **1184 × 320**, leaving **160px hallways** between their four rows. Upper frontage blocks measure **1184 × 736**, leaving **224px hallways** between two rows. These public facade rectangles are separate from the unchanged private apartment scenes: the original eight homes remain **1184 × 448**, and the four upper homes remain **1184 × 832**.

## Planning decisions

The layouts apply the purpose, privacy, accessible openings, grouped seating, coherent backgrounds, and avoidance of superfluous objects discussed in Edith Wharton and Ogden Codman Jr.'s *The Decoration of Houses*, chapter II, “Rooms in General” ([Project Gutenberg, ebook 40367](https://www.gutenberg.org/ebooks/40367)). The chapter was read from the local research copy. Its fireplace-centered historical example becomes a record-listening focus in these musical homes.

Modern circulation and working-space references came from the [U.S. Access Board's walking-surface guidance](https://www.access-board.gov/ada/#ada-403_5_1), [door maneuvering guidance](https://www.access-board.gov/ada/guides/chapter-4-entrances-doors-and-gates/), and [kitchen guidance](https://www.access-board.gov/ada/#ada-804), read through the agency's official source repository. These inform continuous routes, usable approaches on both sides of doors, and connected kitchen work areas. World pixels have no established conversion to inches; these are game-layout decisions, not an accessibility certification.

- Every home has one complete private bathroom, a private bedroom, connected sink/prep/stove/refrigerator/storage, dining, and living functions. Native collision bases determine usable routes.
- The compact original homes retain their validated private-room and browse routes. The four larger homes explicitly reserve clear 120–176px circulation zones, with no furniture bases or walls inside them.
- Larger living groups pair the sofa, coffee table, rug, a cardinal-facing conversation chair, and a record console. The console is a musical focal point; its lava lamp is supported on the console rather than obstructing the floor.
- The two upper plan families separate private rooms from public arrival and dining. One stacks a bedroom and bath in a private wing; the other separates the sleeping and bathing wings around a daylight work/dining nook. Mirrored partners preserve usable door approaches.
- Each theme has coordinated individual floor and wallpaper patterns. Fine motifs leave quiet background around distinctive furniture.

## Scene and navigation contract

`SHOWROOMS` contains all twelve displays. Each has `storeFloor`, stable `id`, `threshold`, `enterNormal`, `hallway`, `lobbyApproach`, `lobbyReturn`, and an independent apartment plan. Public thresholds are centered on the south facade, use `enterNormal: {x:0,y:-1}`, and have a landing 56px below the door. Cardinal `visitRoute` and `exitRoute` legs connect each landing to the central spine. `getStoreFloorShowrooms(1)` returns eight; floor 2 returns four.

`getInterior({kind:'shop',floor:1})` keeps cache ID `furniture-store`. Floor 2 uses `furniture-store-floor-2`, with the same floor-plate dimensions. Showroom cache IDs remain `showroom-<id>`; their floor comes from the display, so stale caller floor values cannot return a visitor to the wrong gallery.

The controller exposes `goStoreFloor(floor,arrival='lift')` and `showStoreDirectory()`. Lift arrival is `(1536,380)`; stair arrival is `(1732,380)`. Physical lift and stair interaction zones use store-specific actions, independent of the residence tower's fifteen-floor directory. Entering a showroom requires being on its floor; leaving returns to that showroom's door on the same floor. The shop selector includes all twelve collections on either floor.

Residents bound for upper homes walk from the original street entrance to the lift, disappear only during the 2.5-second ride, then walk from the actual upper lift landing to the correct showroom. They reverse that journey on departure. Ground-floor visits also use the new horizontal hallways, with no path cutting through a private frontage block. Their original resident identity and purchases never change during the trip.

The primary entrance and return portal inside every apartment also use the south edge, with the arrival point 56px inside. Short foyer paths join the earlier validated browsing routes. Furniture calibration retains its earlier reservation metadata so changing the public entrance does not redecorate a home. All original furniture coordinates, sizes, IDs, private walls and private-room doors remain intact. The upper south door bays also clear the arcade cabinets in older saved room records, so imports retain their original placements and still pass the normal doorway-access checks.

Free floor lettering is removed from store floors, private apartments, showrooms and residence common areas. Back-wall labels, native framed door addresses, lift labels, directories and the small framed showroom-number signs remain available. Room names and interactions also remain in the normal HUD and dialogs.

## Verification

Node checks cover all 48 interior scenes, south-facing primary portals on both sides, connected public hallways and plain walkable floors, all twelve apartment functions and both sides of privacy doors with 16px player collision padding, non-overlapping native furniture bases, original lower-store journeys, upper lift journeys, distinct floor cache identities, collection buyability, and deterministic material rendering. Browser QA separately checks visible transitions and actual walking.
