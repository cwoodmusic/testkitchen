# Coda Town apartment homes

Coda Furnishings, the 18 NPC apartments and the player's rooftop home have complete one-bedroom layouts: a private bathroom and bedroom, a practical kitchen, and living/dining space.

Apartment and showroom proportions are doubled from the previous revision: furnishings are twice as large, and rooms offer four times the floor area relative to a character. [See the corrected scale at normal play zoom](town-preview/apartments-scale-play.png). The camera compensates so your character keeps the same on-screen size and walking speed. NPCs use the same proportions. Feet, collision clearance and furnishing clicks follow the corrected scale; saved room coordinates and furniture placements stay intact. Public halls, town, store lobbies and the concert hall keep their existing scale.

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

Bedroom and bathroom doors use narrow wood and brass top edges that swing in the room’s top-down floor plane. Lift entrances stand above their floor thresholds, with steel doors, call panels and floor indicators.

Use **E** at building, apartment and showroom entrances and exits. Only bedroom and bathroom privacy doors inside apartments open automatically as you approach, stay open while someone occupies the threshold, and close once everyone clears. Owner NPC entrance behavior and player friendship requirements remain intact.

**E** also handles talking, shopping, elevator controls and sitting. Walking through bedroom and bathroom doors needs no interaction key.

Town Builder and **Furnish apartment** offer North, East, South and West; **R** cycles the facing. Furniture aligns with the room axes, without diagonal poses. Upright furniture uses directional artwork with footprint-aligned anchors. Saved rotations retain their collision geometry. Moving keeps the facing; invalid turns leave the previous placement intact. Flat wall decorations and ground patterns rotate their original texture; they do not become upright side-view objects. Asset exports follow the same convention.

## Purchases and saved rooms

Coda Furnishings offers **484 products**: all previous 100 products plus 384 pieces from the twelve showroom collections. Room shopping offers the furniture displayed there. Furniture and apartment décor cost **2,000–150,000 Notes**: beds cost 32,000, sofas 28,000, collection arcade cabinets 75,000 and collection instruments 100,000. Existing ownership IDs stay valid; owned items remain unlocked without another charge.

The player keeps the same two floor furnishing regions, three wall regions, profile isolation and local save key. New Comet Club built-ins sit outside those saved regions. Rotation is optional: old records retain absent fields and original bytes until deliberately edited. Decorations can be moved, rotated, reloaded or returned to inventory.

Generated classroom rules include the expanded allowlist and are checked offline. Static-site publication does not deploy database rules or change the classroom purchase gate.

## Performance and verification

Collection thumbnails load at startup; full art loads for viewed homes. NPC model/path queries do not fetch all 31 native atlases. Native sources and sprite canvases have bounded caches with eviction recovery. The corrected South sheets and thumbnails total about 84.5 MiB across all 31 owners; each viewed home loads its own native art. The 31 startup thumbnails total about 2.5 MiB. Source atlases remain lossless, with no approved crop resampling. Interior backgrounds are limited to eight entries and 16 megapixels, with immediate backing-store release. Lava/screen buffers update at eight frames per second without repainting the room.

Native browser checks cover all 31 homes, 992 distinct props, 840 distinct placed items, transparent boundaries and saved décor. Facing checks exercise all 3,968 native views, with animated overlays tested separately for movement and containment in their actual glass. Performance measurements use warmed, visible interiors and cold outdoor asset loading, with native request counts, frame pauses and cache bounds reported separately.

Cardinal artwork is checked against its source crop and an independent DOM-image renderer through the Blob/ImageBitmap loader. Corrected South artwork can use a taller visual envelope while retaining the original physical dimensions and saved floor center. Source recovery retains complete props rather than dividing them at arbitrary row boundaries. Cache checks cover exact pixels on room re-entry and backing-store release. In the final Chromium run, midcentury, retrofuture, Bach and player interiors each held 60 FPS. Frame CPU p95 ranged from 1.1 to 1.9 ms, with no gaps above 50 ms or native atlas requests during the measured windows. The complete Node suite passes 751 checks, including private-room camera, walking, collision, pointer placement and NPC cadence regressions. Delayed material responses also replace cached fallback finishes in place when a furniture request fails.

Model checks cover real collision padding, fixture approaches, structural walls, furniture overlaps, private doors, showroom routes and resident journeys. Browser journeys cover E interaction at all twelve showroom entrances/exits and both store floors, compact/wide/player homes, friendship locks, owner NPCs and closing behind people. The supplied town map, existing ownership and player furnishing regions stay unchanged. The 293 original furniture assets retain their physical geometry. South artwork is preserved except for the explicitly corrected corner kitchen counter and lifeguard chair; their existing dimensions and anchors remain unchanged.

Browser regressions: `tests/town-interior-warmup-browser.py`, `tests/town-surface-materials-browser.py`, `tests/town-apartment-doors-browser.py`, `tests/town-apartments-collections-browser.py`, `tests/town-showrooms-browser.py`, and `tests/town-apartments-browser.py`. The model and save fingerprint can be reproduced with `node tests/town-surface-contract-fingerprint.mjs`. When comparing against a snapshot from before the explicit economy revision, `--allow-price-changes` permits only price increases; models, route waypoints, product identities and saved placements still compare exactly. The scale correction lengthens only private-room NPC walking legs to match their proportions; public movement and door/lift waits retain their existing timing. `python tests/town-furniture-facing-browser.py --normal-camera` checks picking, turning, moving and reloading saved furniture at the default play camera. Earlier outdoor measurements are in [the performance report](coda-town-performance.md).

Previews: [tower landing and elevator](town-preview/apartments-common-hall.png), [all twelve showrooms](town-preview/apartments-showrooms-overview.png), [midcentury](town-preview/apartments-midcentury-modern.png), [retrofuture](town-preview/apartments-retrofuture.png), [cyberpunk](town-preview/apartments-cyberpunk.png), [steampunk](town-preview/apartments-steampunk.png), [robot](town-preview/apartments-robot.png), [NPC homes](town-preview/apartments-tower-overview.png), [Bach](town-preview/apartments-bach.png), [Miles](town-preview/apartments-miles.png), [Zizi](town-preview/apartments-zizi.png), [your home](town-preview/apartments-player.png).

Planning sources and their concrete layout applications are in [the interior-design notes](coda-interior-design.md).
