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

## Interior finishes, doors and furniture facings

Each home and showroom has a separate set of textured floor, wall, bathroom and dado materials. The tower common floors use detailed limestone, walnut, green marble, wainscoting, stair rails and runners. These finishes follow the existing room boundaries and circulation routes.

Doors use framed wood, brass and glass artwork, with leaves drawn at the correct depth around people. Lift entrances stand upright above their floor thresholds, with sliding steel doors, call panels and floor indicators.

Walk toward an unlocked door to enter or leave. Bedroom and bathroom leaves open before arrival, stay open while someone occupies the threshold, and close once everyone clears. They close behind a visitor standing inside. Owner NPCs can use their doors; player friendship requirements still apply. Arrival guards prevent held movement from bouncing between scenes.

**E** remains available for talking, shopping, elevator controls and sitting. Door traversal needs no interaction key.

Town Builder and **Furnish apartment** offer North, East, South and West; **R** cycles the facing. Furniture aligns with the room axes, without diagonal poses. Upright furniture uses directional artwork with footprint-aligned anchors. Saved rotations retain their collision geometry. Moving keeps the facing; invalid turns leave the previous placement intact. Flat wall decorations and ground patterns rotate their original texture; they do not become upright side-view objects. Asset exports follow the same convention.

## Purchases and saved rooms

Coda Furnishings offers **484 products**: all previous 100 products plus 384 pieces from the twelve showroom collections. Room shopping offers the furniture displayed there. Existing ownership IDs, prices and one-time Notes charges remain valid.

The player keeps the same two floor furnishing regions, three wall regions, profile isolation and local save key. New Comet Club built-ins sit outside those saved regions. Rotation is optional: old records retain absent fields and original bytes until deliberately edited. Decorations can be moved, rotated, reloaded or returned to inventory.

Generated classroom rules include the expanded allowlist and are checked offline. Static-site publication does not deploy database rules or change the classroom purchase gate.

## Performance and verification

Collection thumbnails load at startup; full art loads for viewed homes. NPC model/path queries do not fetch all 31 native atlases. Native sources and sprite canvases have bounded caches with eviction recovery. The corrected South sheets and thumbnails total about 84.5 MiB across all 31 owners; each viewed home loads its own native art. The 31 startup thumbnails total about 2.5 MiB. Source atlases remain lossless, with no approved crop resampling. Interior backgrounds are limited to eight entries and 16 megapixels, with immediate backing-store release. Lava/screen buffers update at eight frames per second without repainting the room.

Native browser checks cover all 31 homes, 992 distinct props, 840 distinct placed items, transparent boundaries and saved décor. Facing checks exercise all 3,968 native views, with animated overlays tested separately for movement and containment in their actual glass. Performance measurements use warmed, visible interiors and cold outdoor asset loading, with native request counts, frame pauses and cache bounds reported separately.

Cardinal artwork is checked against its source crop and an independent DOM-image renderer through the Blob/ImageBitmap loader. Corrected South artwork can use a taller visual envelope while retaining the original physical dimensions and saved floor center. Source recovery retains complete props rather than dividing them at arbitrary row boundaries. Cache checks cover exact pixels on room re-entry and backing-store release. Delayed material responses also replace cached fallback finishes in place when a furniture request fails.

Model checks cover real collision padding, fixture approaches, structural walls, furniture overlaps, private doors, showroom routes and resident journeys. Browser journeys cover all twelve automatic showroom entrances/exits and both store floors, compact/wide/player homes, friendship locks, owner NPCs and closing behind people. The supplied town map, existing ownership and player furnishing regions stay unchanged. The 293 original furniture assets retain their physical geometry. South artwork is preserved except for the explicitly corrected corner kitchen counter and lifeguard chair; their existing dimensions and anchors remain unchanged.

Browser regressions: `tests/town-interior-warmup-browser.py`, `tests/town-surface-materials-browser.py`, `tests/town-apartment-doors-browser.py`, `tests/town-apartments-collections-browser.py`, `tests/town-showrooms-browser.py`, and `tests/town-apartments-browser.py`. The model and save fingerprint can be reproduced with `node tests/town-surface-contract-fingerprint.mjs`. Earlier outdoor measurements are in [the performance report](coda-town-performance.md).

Previews: [tower landing and elevator](town-preview/apartments-common-hall.png), [all twelve showrooms](town-preview/apartments-showrooms-overview.png), [midcentury](town-preview/apartments-midcentury-modern.png), [retrofuture](town-preview/apartments-retrofuture.png), [cyberpunk](town-preview/apartments-cyberpunk.png), [steampunk](town-preview/apartments-steampunk.png), [robot](town-preview/apartments-robot.png), [NPC homes](town-preview/apartments-tower-overview.png), [Bach](town-preview/apartments-bach.png), [Miles](town-preview/apartments-miles.png), [Zizi](town-preview/apartments-zizi.png), [your home](town-preview/apartments-player.png).

Planning sources and their concrete layout applications are in [the interior-design notes](coda-interior-design.md).
