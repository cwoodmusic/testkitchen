# Coda Town furniture

Open [Town Builder · Urban kit](https://cwoodmusic.github.io/testkitchen/town/builder/?kit=urban) to place the tower and furniture store in your own map. The [optional example scene](https://cwoodmusic.github.io/testkitchen/town/?urban=1) demonstrates the buildings and previews every apartment. Use E at building, apartment and showroom entrances and exits during Walk test or Play this town. Bedroom and bathroom doors inside apartments open automatically. E also handles lifts, stairwells, shopping and conversations. Floor 15 is your apartment; choose Furnish apartment to place, move, or put away purchases. Scroll to zoom.

Choose **Room editor** in Town Builder to rearrange any of the 31 interior themes. Click to pick up and place furniture, use the arrow keys to choose its facing, and add pieces from the palette. Visible +/− buttons, a zoom percentage and Pan view make it easy to inspect and navigate the room. Designs autosave separately from the town map and appear in Walk test and Play this town in the same browser. See the [Room Editor controls and layout backup guide](coda-room-editor.md).

[See the new rooms](coda-room-gallery.html). The apartments share a compact floor plan, with Arcade-referenced furniture sizes, practical wall-backed layouts, rugs and dining sets. Bedrooms, kitchens, living spaces and bathrooms have their own floor finishes. Contrasting materials, detailed windows and clear door thresholds keep the furniture and entrances readable.

Coda Furnishings has twelve apartment showrooms across two floors. Eight doors open from the lower lobby; a lift and stairs lead to four equally sized themed homes upstairs. Read the small numbered sign outside each door with E to learn its theme ([preview](town-preview/showroom-theme-sign.png)). Approach the doorway and press E to enter its separate, fully furnished apartment scene. Bedroom and bathroom privacy doors inside that apartment open and close automatically. Every apartment includes kitchen and dining areas, a living room, a private bedroom and a bathroom with a shower or bathtub, toilet and vanity. Each apartment now has entirely unique furniture and fixtures, an animated lava lamp, a miniature arcade, a poster and a toy, as well as its own floors and wallpaper:

Preview the [main lobby](town-preview/coda-furnishings-lobby.png), [upper gallery](town-preview/coda-furnishings-upper-lobby.png) and [all twelve apartments](town-preview/apartments-showrooms-overview.png).

| Room | Flooring | Wallpaper |
| --- | --- | --- |
| Victorian Suite | Chestnut octagonal marquetry | Plum silk cameo damask |
| Art Deco Apartment | Ebony and ivory octagonal marble | Peacock silk and champagne fan rays |
| Coastal Retreat | Bleached-oak rope-jointed deck | Sea-glass linen and shell-sprig paper |
| Rustic Cottage | Warm clay honeycomb pavement | Cream gingham and tiny bee-wing toile |
| Botanical Apartment | Pale limestone garden flag mosaic | Sage fern-jacquard and rattan dado |
| Midcentury Apartment | Oiled-walnut finger parquet | Cream atomic linen and walnut dado |
| Parisian Apartment | Cream and charcoal small bistro hex | Blush ticking and painted café lattice |
| Industrial Loft | Reclaimed-oak iron-capped boards | Mineral brick and fine copper service band |
| Retrofuture Spaceport | Cream orbital-aggregate terrazzo | Warm ivory capsule weave and aqua dado |
| Cyberpunk Neon Loft | Brushed graphite staggered service panels | Midnight acoustic ribs and sparse circuits |
| Steampunk Clockwork Home | Mahogany octagon and brass-key parquet | Sage woven cog-stripe and mahogany dado |
| Robot Companion Home | Warm cork and powder-blue charging joints | Ivory micro-weave and rounded companion band |

All 31 private homes and showrooms have independent authored dry floors, wallpaper, bathroom ceramics and dado trim. Floor grain continues through circulation gaps. The tower halls use detailed limestone landings, timber floors, inset runners, wainscoting and carved trim. Bedroom and bathroom privacy doors open automatically. Entrances and exits use E interaction. The elevator is a metal entrance with a floor display and call buttons. Saved furniture positions and purchases remain in place.

Use **Shop this apartment** or E at its browse point for the pieces actually displayed there. The lobby's **Browse furniture** catalogue contains all 639 products, including 124 new family-room pieces. Default layouts include dining, conversation groups, bedroom reading nooks and plants; the original furniture scale remains fixed. Beds cost 32,000 Notes and sofas cost 28,000. All furniture prices are now substantially higher, while existing ownership remains unlocked. Buying or returning from a product retains the selected collection and category. Pressing E at the apartment exit, Escape, or **Back to lobby** returns to that apartment's own door.

Every apartment and showroom default has the same compact dimensions and floor plan as the Victorian showroom, with a visible south exterior wall, framed entrance and doorstep below it. Bedroom and bathroom partitions also show their hallway-facing walls and door faces. These foreground walls fade when you walk or arrange furniture behind them. **Fit room** includes the complete exterior. Previous saved designs keep their own room geometry, furniture placements and removals. Tower apartments and showrooms now have identical room dimensions.

Apartment and showroom defaults follow the approved Victorian arrangement: a private bedroom and adjacent bathroom, a kitchen along the back of the shared wing, central dining, and a conversation group against its outer side. Left and right versions keep their mirrored orientation and each home keeps its own furniture and finishes. Your apartment's purchased decorating areas stay clear. Existing saved designs restore their original room architecture and furniture; **Reset theme** switches to the new default, and **Undo** brings the saved design back.

The original 3072 × 2048 store floor plate, lobby doors, common corridors, reception desk, seating and street foyer stay in place. Each door opens its own themed compact interior. The street entrance and placed building remain fixed; town maps and browser saves need no migration. NPC shoppers walk to a lobby door, appear only in its apartment scene, and return through the same door before heading outside.

Verification: `node --test town/world/showroom-layout.test.mjs town/world/resident-venue.test.mjs tests/urban-interiors.test.mjs tests/furniture-store.test.cjs tests/urban-room.test.mjs` and `python tests/town-showrooms-browser.py --screenshots /tmp/town-apartment-showrooms`. The browser regression physically walks every apartment area, checks models, collection-specific catalogues, purchases and Escape/HUD return positions, preserves profile gates and source map bytes, and captures all twelve interiors. `tests/town-apartment-doors-browser.py` checks manual entrances and automatic bedroom/bathroom privacy doors.

The original showroom release passed 376 Node tests. Browser checks walked all eight apartments, bought a signature bed and sofa for exactly 150 Notes once, and measured about 60 FPS in both lobby and apartment views. The six-minute town regression also passed with the separate apartment visits and unchanged source map. The original generated signature atlas, sixteen transparent cutouts and metadata are retained under `town/assets/showrooms/`.

The **Plushies** and **Playful decor** categories add twelve soft musical friends and nineteen owner-themed playthings, each with a visible preview and an individual 4,000–12,000-Note price. These are ordinary purchases with permanent ownership.

The furniture store uses the existing Notes wallet. Furniture and apartment décor cost 2,000–150,000 Notes, including 32,000-Note beds, 75,000-Note arcade cabinets and 100,000-Note collection instruments. Each purchase unlocks one décor item permanently; buying an owned item again costs no Notes. Furniture ownership is included in the private classroom wallet schema. Purchased décor placements use the local-only `codaUrbanRoomV1` store. Room Editor templates use separate local browser storage; neither uploads room designs.

Guest players and isolated developer test sessions can buy furniture immediately. Purchases for active classroom and teacher profiles stay disabled until `ARCADE_ACCOUNTS_CONFIG.classroom.townFurnitureEnabled` is explicitly `true`. Browsing the showroom remains available. This prevents new ownership IDs from blocking profile saves while the deployed database still uses older validation rules.

To enable classroom purchases:

1. Regenerate and check the rules with `node tools/build-classroom-rules.cjs` and `node tools/build-classroom-rules.cjs --check`.
2. Back up the current complete live database rules. Merge the generated classroom fragment into that backup using the [existing merge and deployment procedure](../README-CLASSROOM-PROFILES.md#back-up-and-merge-rules-before-deployment), retaining all sibling game namespaces. Review and test the candidate, then deploy it to the intended database. Static-site publication does not deploy database rules.
3. After the rules accepting the furniture IDs are deployed, set `townFurnitureEnabled:true` in [account-config.js](../account-config.js), update that script's version query in each entry page, and publish the site. Verify a classroom furniture purchase and subsequent profile save and reload.

The gate is checked again in the parent arcade before spending Notes. Changing the town frame's UI cannot bypass it.


The expanded [apartment homes update](coda-apartment-homes.md) redesigns the 18 NPC homes and twelve showrooms, adds practical room fixtures and playful décor, and preserves existing purchases and player placements.


