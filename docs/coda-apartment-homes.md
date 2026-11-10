# Coda Town apartment homes

Both the apartment tower and Coda Furnishings now use inhabited one-bedroom homes, with a private bathroom, bedroom, kitchen and living space.

The **18 NPC homes** use six floor plans and eight personality-matched furniture families. Paired units remain 1088 × 1120; the single-owner upper floors remain 2304 × 1120. The tower exterior, floor directory, friendships, door identities and resident journeys stay compatible. Each home includes a fridge, sink, stove and kitchen storage; a shower or bathtub, toilet, vanity and wall mirror; a bed and wardrobe; and living/dining furniture with the resident’s music and keepsakes.

The **eight furniture-store apartments** use four different compact plans and their mirrored versions. Each remains 624 × 704 inside the store’s existing floor plate, entered through its own lobby door. Bedroom and bathroom doorways have open frames and clear circulation. Room-specific shopping offers the pieces actually shown in that apartment.

## Furniture and character

There are **48 new reusable assets**, bringing the furniture shop to **100 products**. The collection includes practical home fixtures, storage, reading furniture and playful details: fox and axolotl plush friends, moon/star cushions, a checkerboard beanbag, piano-key and vinyl rugs, origami art, a solar-system model, headphones/books, record cubbies, cat planters and a lava lamp.

Midcentury now uses low teak furniture, tapered legs, olive upholstery, a kidney-shaped table, a tambour record console, a starburst clock and calm cream atomic wallpaper. Other styles retain their distinct signature beds and sofas. NPC choices follow their personalities instead of using one matching set in every home.

Electronics sit on desks or consoles; soft keepsakes sit on beds. Wall art and mirrors align with wall faces and avoid windows. Rug artwork stays under furniture and characters. Decorative objects resting on furniture use the supporting piece’s depth, so they remain visible.

The native transparent images, source atlases and metadata live in `town/assets/apartments/`. They are also movable Town Builder assets under the Urban kit / apartment furniture category.

## Your room and saved purchases

All original 52 shop IDs and prices remain available. The two midcentury signature IDs retain their original dimensions and collision geometry while using the new artwork, so existing purchases still match the showroom. New purchases use the same Notes wallet and one-time unlocks.

Your existing floor furnishing areas and saved decoration records remain valid. The fixed kitchen has a correctly sized fridge beside the sink counter and stove; a wardrobe replaces the old built-in trunk, and a plush friend rests on the bed. These fixed changes stay outside the saved furnishing areas.

In **Furnish apartment**, posters, mirrors, shelves and clocks snap to clear north-wall sections. They use separate wall placement bounds; furniture continues to use the existing floor areas. You can move, reload or put away purchases as before. The room’s local save key and profile isolation stay unchanged.

The generated classroom rules fragments include the expanded catalogue. They were checked offline; static-site publication does not deploy database rules or change the existing classroom purchase gate.

## Verification

Model checks cover every room and fixture approach with the game’s actual collision padding, furniture footprint overlap, exact floor plates, all resident journeys and the restored NPC showroom visit routes. Browser tests walk all eight showrooms and representative tower units, check all 18 homes, buy and place new décor, hang wall art, reload and put it away, and confirm an existing saved decoration remains byte-for-byte unchanged.

The complete release passed 585 Node checks. The outdoor changes also passed four sustained walking scenarios and 18 exact pixel comparisons; see [the performance report](coda-town-performance.md).

Use `python3 tests/town-showrooms-browser.py` and `python3 tests/town-apartments-browser.py` for isolated browser regressions. Neither changes the supplied source map.

Previews: [all eight showrooms](town-preview/apartments-showrooms-overview.png), [midcentury modern](town-preview/apartments-midcentury-modern.png), [NPC homes](town-preview/apartments-tower-overview.png), [Bach](town-preview/apartments-bach.png), [Miles](town-preview/apartments-miles.png), [Zizi](town-preview/apartments-zizi.png), [your room](town-preview/apartments-player.png).
