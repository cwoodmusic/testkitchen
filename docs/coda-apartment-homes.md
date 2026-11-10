# Coda Town apartment homes

Coda Furnishings, the 18 NPC apartments and the player's rooftop home have complete one-bedroom layouts: a private bathroom and bedroom, a practical kitchen, and living/dining space.

The favorite wide NPC floor plans remain 2304 × 1120. Paired tower units remain 1088 × 1120, within the same fifteen-story building and floor directory. Friendships, resident identities and home journeys retain their existing contracts.

The store has **twelve apartments across two floors** inside its existing 3072 × 2048 footprint. The original eight **1184 × 448 wide homes** retain their lower-floor entrances. Four additional **1184 × 832 homes** upstairs have retrofuture, cyberpunk, steampunk and robot themes. A store lift and stairs connect the floors. No exterior building or authored town placement is enlarged.

## Individual collections

Each of the 31 homes has an independently drawn 32-piece collection: **992 reusable assets**. The furnishings placed in the homes have no repeated asset IDs or repeated visible artwork. Fixtures share a practical purpose, while their shapes, materials and details follow the owner.

Examples include Bach's organ-pipe oak, Mozart's ribboned rosewood, Beethoven's angled steel and smoked ash, Miles's midnight walnut and brass, Zizi's lunar garden and the player's patchwork Comet Club. The twelve showrooms have separate collections; Atomic Walnut uses low walnut furniture, tapered legs, teal wool, burnt orange and atomic details.

Every home has its own poster, playful toy, animated lava lamp and miniature arcade. Compact homes use tabletop cabinets; wide homes have game corners. Lava rises inside the actual glass, and arcade screens show different animated games. Static furniture artwork stays unchanged beneath the overlays; reduced-motion preferences stop them.

Wall decorations align with real wall faces. Rugs draw below people and furniture. Tabletop pieces use their supporting furniture's depth and do not create invisible floor obstacles.

Native WebP atlases, crop/motion metadata and source hashes live in `town/assets/apartment-collections/`. Generation originals are not required by the game. All collections are also available in Town Builder's Urban kit.

## Doors and furniture facings

Walk toward an unlocked door to enter or leave. Bedroom and bathroom leaves open before arrival, stay open while someone occupies the threshold, and close once everyone clears. They close behind a visitor standing inside. Owner NPCs can use their doors; player friendship requirements still apply. Arrival guards prevent held movement from bouncing between scenes.

**E** remains available for talking, shopping, elevator controls and sitting. Door traversal needs no interaction key.

Town Builder and **Furnish apartment** offer North, East, South and West; **R** cycles the facing. Furniture aligns with the room axes, without diagonal poses. Upright furniture uses directional artwork with footprint-aligned anchors. Saved rotations retain their collision geometry. Moving keeps the facing; invalid turns leave the previous placement intact. Flat ground patterns still rotate as flat artwork.

## Purchases and saved rooms

Coda Furnishings offers **484 products**: all previous 100 products plus 384 pieces from the twelve showroom collections. Room shopping offers the furniture displayed there. Existing ownership IDs, prices and one-time Notes charges remain valid.

The player keeps the same two floor furnishing regions, three wall regions, profile isolation and local save key. New Comet Club built-ins sit outside those saved regions. Rotation is optional: old records retain absent fields and original bytes until deliberately edited. Decorations can be moved, rotated, reloaded or returned to inventory.

Generated classroom rules include the expanded allowlist and are checked offline. Static-site publication does not deploy database rules or change the classroom purchase gate.

## Performance and verification

Collection thumbnails load at startup; full art loads for viewed homes. NPC model/path queries do not fetch all 31 native atlases. Native sources and sprite canvases have bounded caches with eviction recovery. Interior backgrounds are limited to eight entries and 16 megapixels, with immediate backing-store release. Lava/screen buffers update at eight frames per second without repainting the room.

The initial native front-art run covered all 864 distinct assets across the original 27 homes, 726 distinct placed images and 54 animations, including transparent boundaries, unchanged static art, saved decor and cache limits. Midcentury, Bach and player interiors held 60 FPS with frame CPU p95 of 1.4, 1.9 and 1.4 ms and no pauses above 50 ms in the test environment. Native art made no requests during measurement.

The original 27 backgrounds also passed cache stress: limits held, 19 evicted canvases released their backing stores, and re-entering Bach reproduced exact pixels. Model checks cover real collision padding, fixture approaches, furniture overlaps, private doors, showroom routes and resident journeys. Keyboard checks cover all eight automatic showroom entrances/exits, compact/wide/player homes, friendship locks, owner NPCs and closing behind people. The supplied town map stays unchanged.

Browser regressions: `tests/town-apartment-doors-browser.py`, `tests/town-apartments-collections-browser.py`, `tests/town-showrooms-browser.py`, and `tests/town-apartments-browser.py`. Earlier outdoor measurements are in [the performance report](coda-town-performance.md).

Previews: [showrooms](town-preview/apartments-showrooms-overview.png), [midcentury](town-preview/apartments-midcentury-modern.png), [NPC homes](town-preview/apartments-tower-overview.png), [Bach](town-preview/apartments-bach.png), [Miles](town-preview/apartments-miles.png), [Zizi](town-preview/apartments-zizi.png), [your home](town-preview/apartments-player.png).

Planning sources and their concrete layout applications are in [the interior-design notes](coda-interior-design.md).
