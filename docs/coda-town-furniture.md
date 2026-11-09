# Coda Town furniture

Open [Town Builder · Urban kit](https://cwoodmusic.github.io/testkitchen/town/builder/?kit=urban) to place the tower and furniture store in your own map. The [optional example scene](https://cwoodmusic.github.io/testkitchen/town/?urban=1) demonstrates the buildings and previews every apartment. Press E at a door, lift, stairwell, or showroom display during Walk test or Play this town. Floor 15 is your apartment; choose Furnish apartment to place, move, or put away purchases. Scroll to zoom.

Coda Furnishings contains eight enclosed sample rooms around a shared central and cross hall. Each has its own furniture arrangement, floor texture and wallpaper:

| Room | Flooring | Wallpaper |
| --- | --- | --- |
| Victorian Parlor | Walnut herringbone | Burgundy damask |
| Art Deco Lounge | Ivory and teal marble | Peacock fans |
| Coastal Bedroom | Whitewashed driftwood | Sea-glass stripes |
| Rustic Kitchen | Hand-fired terracotta | Sage cottage toile |
| Botanical Conservatory | Garden slate mosaic | Fern fronds |
| Midcentury Studio | Honey-oak parquet | Ochre geometry |
| French Café | Bistro checkerboard | Sage lattice |
| Industrial Loft | Concrete slabs | Exposed warehouse brick |

Press E at a room's display to browse its collection, or use **Browse furniture** for all 36 products. The collection selector links every room, and buying or returning from a product keeps the selected room and category. All existing products appear in at least one display; ownership and prices are unchanged. The store retains its original 3072 × 2048 floor area and street entrance, so placed buildings and saved town maps need no migration. NPC shoppers reserve one of eight room visits, use the real doorways and return through the shared hall.

Verification: `node --test town/world/showroom-layout.test.mjs town/world/resident-venue.test.mjs tests/urban-interiors.test.mjs tests/furniture-store.test.cjs tests/urban-room.test.mjs` and `python tests/town-showrooms-browser.py --screenshots /tmp/town-showrooms`. The browser regression walks through every room using production movement and collision, checks room-specific catalogues and a real Notes purchase, preserves profile gates and source map bytes, and captures the eight visual styles.

The final suite passes 371 Node tests. Browser checks physically walked all eight rooms, verified a purchase debited exactly 18 Notes once, and measured about 60 FPS in the showroom. The six-minute town regression also passed with the updated NPC shopping routes and unchanged source map.

The furniture store uses the existing Notes wallet. Each purchase unlocks one décor item permanently; buying an owned item again costs no Notes. Furniture ownership is included in the private classroom wallet schema. Apartment layouts use the local-only `codaUrbanRoomV1` store and do not upload room designs.

Guest players and isolated developer test sessions can buy furniture immediately. Purchases for active classroom and teacher profiles stay disabled until `ARCADE_ACCOUNTS_CONFIG.classroom.townFurnitureEnabled` is explicitly `true`. Browsing the showroom remains available. This prevents new ownership IDs from blocking profile saves while the deployed database still uses older validation rules.

To enable classroom purchases:

1. Regenerate and check the rules with `node tools/build-classroom-rules.cjs` and `node tools/build-classroom-rules.cjs --check`.
2. Back up the current complete live database rules. Merge the generated classroom fragment into that backup using the [existing merge and deployment procedure](../README-CLASSROOM-PROFILES.md#back-up-and-merge-rules-before-deployment), retaining all sibling game namespaces. Review and test the candidate, then deploy it to the intended database. Static-site publication does not deploy database rules.
3. After the rules accepting the furniture IDs are deployed, set `townFurnitureEnabled:true` in [account-config.js](../account-config.js), update that script's version query in each entry page, and publish the site. Verify a classroom furniture purchase and subsequent profile save and reload.

The gate is checked again in the parent arcade before spending Notes. Changing the town frame's UI cannot bypass it.
