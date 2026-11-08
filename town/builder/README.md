# Coda Town Builder

Open `town/builder/`, or use **Town Builder** in Test Kitchen. Choose **Play this town** to save the current map and open its playable version at `town/?map=builder`; **Edit town** returns to the saved project. New projects contain grass only on a 16,384 × 12,288 map. The existing playable town and Music Square remain available.

Choose an asset, then click the map. Select / move repositions objects; the inspector changes size, quarter-turn rotation, collision and layer. The library includes 15 tree size/species combinations, shrubs, 30 house combinations, a grand gazebo, furniture, musical decorations, landscape pieces and foliage overlays. Music Square is a complete placeable scene, with decorative walls baked into its artwork; add editable fencing with the fence tool. Houses retain their floor-area footprints; this editor does not yet connect placed doors to NPC interiors or friendship progress.

Drag Fence / wall along grid edges to connect segments. Corners share posts. Gates open with E in walk test. Put ivy, roses or other foliage on the overgrowth layer to draw it over barriers. Construction PNG samples are decorations; the fence tool and terrain Steps tool provide connected barriers and climbable ground.

Ground tools paint grass, cobbles, dirt, wood, sand and water. Raise/lower changes height one level per stroke; Set level uses the inspector level. Steps connect the two ground levels you drag between, with direction and rise chosen automatically. Paint water for lakes/rivers, then paint bridges across it. Cliff edges and water block movement; stairs and bridges provide routes. Gazebo posts block walking while its center stays open. Collision overlays show asset footprints; walk test uses the arcade character renderer and never changes arcade rewards or relationships.

Right drag pans, wheel zooms, Full map fits the map. Brush width controls terrain painting. Undo/redo tracks strokes. Projects autosave in IndexedDB on this origin/browser. **Save project** exports a portable JSON backup; **Open** validates and restores it. Asset pack downloads individual transparent PNGs, ground textures and anchor/collision metadata. Save local work before switching browsers or clearing site data.

Validation: `node --test town/builder/model.test.mjs town/model.test.mjs`; `python3 town/builder/browser.py`; `python3 town/browser.py`.

The editor and playable authored maps both use `town/world/` for the asset catalog, renderer, pixel resolution, project format, collision, spawn placement, movement, gates and camera height. Walk test uses those same functions. Editor guides (selection, grid, collision highlights and ghosts) are intentionally excluded from gameplay. Pixel comparison tests verify that static scenes match exactly with equal camera and viewport settings. The original handcrafted town remains a separate map; placed NPC home interiors are still not connected.

Additional validation: `node --test town/world/physics.test.mjs`; `python3 town/world/browser.py`.

Use **Select land** and drag a rectangle to select terrain tiles. The Land selection panel shows the selected size. **Raise selected land +1** and **Lower selected land −1** change the whole selection by one level while preserving its surfaces and relative heights (within the 0–8 limits). Each click is one undoable action. **Clear selection** or Escape clears the highlight. Selection itself does not alter or save terrain.

## Detailed construction and home estates

The **home estates** category contains 19 complete home-and-yard scenes: every resident plus your own home. Each has its own full-resolution source artwork, garden, roof shape, porch, boundary planting and musical theme. These complete scenes use the ground layer like Music Square. Place them on level ground; their painted porch steps are part of the scene, while the terrain **Steps** tool creates climbable level connections. Houses and boundary walls have collision, with an open central yard entrance. Placed estate doors are not yet connected to NPC interiors or friendship invitations.

Connected fence/wall tools now draw shared detailed panels and corner piers; adjacent stair cells form wider flights. Existing ivy/rose/wisteria/honeysuckle IDs now use dense painted foliage. Raised terrain uses a world-aligned mossy rock face and an overhanging grass crown rather than flat patterned blocks. Existing project IDs and terrain levels remain compatible. Music Square and the water artwork are unchanged.

The canvas toolbar offers **Select land region**, **Select whole map**, and three views:

- **Artwork** shows the shared game rendering.
- **Height colors** overlays numbered levels and contour boundaries.
- **Elevation plan** hides the scenery and projection so tiles, stairs, water crossings and height boundaries are easy to read and select. Its labels render sharply for planning.

Region raise/lower works in all three views. Use Full map to select broad portions of the valley, then raise or lower them one level per click. Planning views are editor guides and are not saved into the map's appearance.

Additional checks: `python3 town/builder/details-browser.py` validates the 19 estates, parcel collision, elevation views, large selections and whole-map height undo.

## Drag stairs, matching paving, and the arcade exterior

**Steps** now works by dragging between two existing terrain levels. Either drag order works. The editor snaps to a straight north/south/east/west run, reads both end heights, previews the connection, and builds it when you release. Brush width sets the width; Finish chooses stone, wood or brick. Flat landings at the clicked centers connect to a continuous slope, including multi-level changes. Same-height drags and obstructed/water routes show a message instead of changing the map. Escape cancels; each completed run is one Undo. Existing one-level stair cells still load.

Cobble painting now samples actual scene paving at its world scale. **Paving match → Auto · nearest property** chooses Music Square or the nearest home estate; a specific scene can also be selected. The donor strip meets the asset's entrance edge, and mirrored continuation shares its edge colors and stone size. Paths have feathered grassy borders. The asset pack includes the matching paving textures.

**Landmarks → Coda Arcade · exact interior footprint** is a retrofuturistic exterior with a lounge roof, disco dome, glass main-hall roof and southeast entrance. Its floor footprint and polygon collision use the exact same `arcade-footprint.js` geometry as the actual interior. Scaling is locked at 1:1; the original canvas is 1672×941 world units and the occupied floor bounds are 1512×685. Roof/facade projection adds visual height without changing that footprint. The exterior is a placeable building; placing it does not relocate or replace the active arcade interior.

Validation: `node --test town/builder/stairs.test.mjs`; `python3 town/builder/drag-stairs-browser.py`. The browser check covers drag preview, reverse dragging, one-action undo, saved stair profiles, paving joins, exact arcade polygon collision and scale locking.

## South-facing decoration pack and cliff placement

The library now includes **256 new decorations in 16 families**, plus six dedicated cliff pieces. Search for individual objects or use the category dropdown (each family has 16 items): containers, strings, keys and percussion, brass and winds, music workshop, street furniture, market goods, garden pots, garden features, foliage and rocks, waterfront, farm and utility, festival, signs and lights, cliff decorations, and architectural details. Fronts and openings face south by default. These are individually drawn sprites with transparent cutouts, not ground-square scene plates.

Choose **Cliff assets** in the canvas toolbar, select a piece, then click directly on the exposed south-facing rock face. The attachment stores its position on that face; it follows terrain height changes and curved cliff edges rather than falling onto a grass tile. Use **Height on cliff** to move a selected piece up/down. Existing objects can also be attached: select one, choose **Placement surface → Cliff face**, then click a face. Choose Ground to detach it. If its face is completely removed, the attachment hides until a cliff is restored there; Undo restores the original terrain.

The 256-piece library uses small previews while browsing and fetches the native artwork when selected or used in a saved map. Play mode waits for used artwork, so the editor and game use the same finished art. Asset pack exports load full artwork and include individual PNGs and metadata. Decorative doors/gates/ladders are props; use the connected Gate and Steps tools for working passages and terrain connections.

## Round corners and elevation shading

Choose **Round corners**, then brush near an outside corner of raised land, water, or a painted path. Click **Round corners** again, or the **Corners** button above the map, to cycle **Smooth round → Rocky irregular → Beveled**. Brush an existing corner to apply the selected shape without shrinking its radius; Undo restores the previous shape. Brush width sets the requested rounding size (up to eight tiles), limited to fit narrow terrain. One stroke is one Undo. Corner geometry is saved, visible in Elevation plan, and used by both rendering and collision. Existing rounded corners load as Smooth round. Region raise/lower preserves corner geometry; direct height-brush edits can square individual tiles again.

Terrain now has shaded upper rims, directional ground shadows, and contact shading at height changes. North/east/west edges remain readable even where the grass texture matches the lower ground. Rounded boundaries receive the same shading. South-facing exposed cliffs retain their detailed rock faces.

Stairs and terrain render together from north to south, so higher foreground land covers flights behind it. Cliff support follows the full stair slope at either bank, including adjacent stair lanes, rather than cutting a rectangular gap or leaving the map background exposed.

Validation: `python3 town/builder/decor-browser.py`; `python3 town/builder/round-browser.py`; `node --test town/world/cliff-mount.test.mjs town/builder/round-terrain.test.mjs`. Sprite bounds and browsing thumbnails can be rebuilt with `python3 scripts/build-town-decor.py`; the full source PNG artwork is preserved.

Corner/depth regression checks: `node --test town/builder/corner-styles.test.mjs`; `python3 town/builder/corner-styles-browser.py`; `python3 town/world/stair-occlusion-browser.py`. These cover reversible shapes, saved styles, Undo/Redo, editor/game pixel parity, foreground occlusion in all four stair directions, and rock support along sloped banks.
