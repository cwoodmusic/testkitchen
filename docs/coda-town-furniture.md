# Coda Town furniture

Open [Town Builder · Urban kit](https://cwoodmusic.github.io/testkitchen/town/builder/?kit=urban) to place the tower and furniture store in your own map. The [optional example scene](https://cwoodmusic.github.io/testkitchen/town/?urban=1) demonstrates the buildings and previews every apartment. Walk through unlocked doors during Walk test or Play this town. Use E for lifts, stairwells, shopping and conversations. Floor 15 is your apartment; choose Furnish apartment to place, move, or put away purchases. Scroll to zoom.

Coda Furnishings has twelve apartment showrooms across two floors. Eight doors open from the lower lobby; a lift and stairs lead to four larger themed homes upstairs. Approach and walk through a door to enter its separate, fully furnished apartment scene; it opens before you arrive and closes after you clear it. Every apartment includes kitchen and dining areas, a living room, a private bedroom and a bathroom with shower, toilet and vanity. Each apartment now has entirely unique furniture and fixtures, an animated lava lamp, a miniature arcade, a poster and a toy, as well as its own floors and wallpaper:

Preview the [main lobby](town-preview/coda-furnishings-lobby.png) and [the apartment collection](town-preview/apartments-showrooms-overview.png).

| Room | Flooring | Wallpaper |
| --- | --- | --- |
| Victorian Suite | Walnut herringbone | Burgundy damask |
| Art Deco Apartment | Ivory and teal marble | Peacock fans |
| Coastal Retreat | Whitewashed driftwood | Sea-glass stripes |
| Rustic Cottage | Hand-fired terracotta | Sage cottage toile |
| Botanical Apartment | Garden slate mosaic | Fern fronds |
| Midcentury Apartment | Teak plank flooring | Cream atomic motifs |
| Parisian Apartment | Bistro checkerboard | Sage lattice |
| Industrial Loft | Concrete slabs | Exposed warehouse brick |
| Retrofuture Spaceport | Warm spaceport terrazzo | Cream orbital wallpaper |
| Cyberpunk Neon Loft | Graphite inset panels | Midnight circuit wallpaper |
| Steampunk Clockwork | Mahogany parquet | Sage clockwork wallpaper |
| Robot Companion | Warm companion cork | Friendly companion wallpaper |

Use **Shop this apartment** or E at its browse point for the pieces actually displayed there. The lobby's **Browse furniture** catalogue contains all 484 products: the previous 100 and 384 pieces from the twelve collections. The new beds cost 80 Notes and sofas cost 70; legacy prices and ownership remain unchanged. Buying or returning from a product retains the selected collection and category. Walking through the apartment exit, Escape, or **Back to lobby** returns to that apartment's own door.

The eight wide 1184 × 448 lower apartments and four deeper 1184 × 832 upper apartments fit within the original 3072 × 2048 store floor plate on each floor. A common central corridor, reception desk, seating and street foyer occupy the remaining circulation area. The street entrance and placed building remain fixed; town maps and browser saves need no migration. NPC shoppers walk to a lobby door, appear only in its apartment scene, and return through the same door before heading outside.

Verification: `node --test town/world/showroom-layout.test.mjs town/world/resident-venue.test.mjs tests/urban-interiors.test.mjs tests/furniture-store.test.cjs tests/urban-room.test.mjs` and `python tests/town-showrooms-browser.py --screenshots /tmp/town-apartment-showrooms`. The browser regression physically walks every apartment area, checks models, collection-specific catalogues, purchases and Escape/HUD return positions, preserves profile gates and source map bytes, and captures all twelve interiors. `tests/town-apartment-doors-browser.py` separately checks automatic traversal without an interaction key.

The original showroom release passed 376 Node tests. Browser checks walked all eight apartments, bought a signature bed and sofa for exactly 150 Notes once, and measured about 60 FPS in both lobby and apartment views. The six-minute town regression also passed with the separate apartment visits and unchanged source map. The original generated signature atlas, sixteen transparent cutouts and metadata are retained under `town/assets/showrooms/`.

The furniture store uses the existing Notes wallet. Each purchase unlocks one décor item permanently; buying an owned item again costs no Notes. Furniture ownership is included in the private classroom wallet schema. Apartment layouts use the local-only `codaUrbanRoomV1` store and do not upload room designs.

Guest players and isolated developer test sessions can buy furniture immediately. Purchases for active classroom and teacher profiles stay disabled until `ARCADE_ACCOUNTS_CONFIG.classroom.townFurnitureEnabled` is explicitly `true`. Browsing the showroom remains available. This prevents new ownership IDs from blocking profile saves while the deployed database still uses older validation rules.

To enable classroom purchases:

1. Regenerate and check the rules with `node tools/build-classroom-rules.cjs` and `node tools/build-classroom-rules.cjs --check`.
2. Back up the current complete live database rules. Merge the generated classroom fragment into that backup using the [existing merge and deployment procedure](../README-CLASSROOM-PROFILES.md#back-up-and-merge-rules-before-deployment), retaining all sibling game namespaces. Review and test the candidate, then deploy it to the intended database. Static-site publication does not deploy database rules.
3. After the rules accepting the furniture IDs are deployed, set `townFurnitureEnabled:true` in [account-config.js](../account-config.js), update that script's version query in each entry page, and publish the site. Verify a classroom furniture purchase and subsequent profile save and reload.

The gate is checked again in the parent arcade before spending Notes. Changing the town frame's UI cannot bypass it.


The expanded [apartment homes update](coda-apartment-homes.md) redesigns the 18 NPC homes and twelve showrooms, adds practical room fixtures and playful décor, and preserves existing purchases and player placements.


