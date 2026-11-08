# Coda Town Builder

Open `town/builder/`, or use **Town Builder** in Test Kitchen. Choose **Play this town** to save the current map and open its playable version at `town/?map=builder`; **Edit town** returns to the saved project. New projects contain grass only on a 16,384 × 12,288 map. The existing playable town and Music Square remain available.

Choose an asset, then click the map. Select / move repositions objects; the inspector changes size, quarter-turn rotation, collision and layer. The library includes 15 tree size/species combinations, shrubs, 30 house combinations, a grand gazebo, furniture, musical decorations, landscape pieces and foliage overlays. Music Square is a complete placeable scene, with decorative walls baked into its artwork; add editable fencing with the fence tool. Houses retain their floor-area footprints; this editor does not yet connect placed doors to NPC interiors or friendship progress.

Drag Fence / wall along grid edges to connect segments. Corners share posts. Gates open with E in walk test. Put ivy, roses or other foliage on the overgrowth layer to draw it over barriers. Construction PNG samples are decorations; the fence tool and terrain Steps tool provide connected barriers and climbable ground.

Ground tools paint grass, cobbles, dirt, wood, sand and water. Raise/lower changes height one level per stroke; Set level uses the inspector level. Steps connect the two ground levels you drag between, with direction and rise chosen automatically. Paint water for lakes/rivers, then paint bridges across it. Cliff edges and water block movement; stairs and bridges provide routes. Gazebo posts block walking while its center stays open. Collision overlays show asset footprints; walk test uses the arcade character renderer and never changes arcade rewards or relationships.

Right drag pans, wheel zooms, Full map fits the map. Brush width controls terrain painting. Undo/redo tracks strokes. Projects autosave in IndexedDB on this origin/browser. **Save project** exports a portable JSON backup; **Open** validates and restores it. Asset pack downloads individual transparent PNGs, ground textures and anchor/collision metadata. Save local work before switching browsers or clearing site data.

## Freehand ground brush and blending

**Paint ground** now follows the cursor with a round brush rather than filling terrain squares. Choose grass, dirt, cobble, sand or wood, then adjust **Brush size**, **Hardness** and **Opacity / strength**. Lower hardness feathers the edge; lower opacity builds up the material over successive passes. Small brush sizes allow fine details. Cobble still samples the selected property's paving so its scale and color match the entrance.

**Brush shape → Square tiles** keeps full-tile painting available alongside **Round soft**. Square mode snaps to the terrain grid, paints complete tiles and replaces any freehand mask on those tiles. Brush size becomes a whole-number tile width; hardness and opacity apply to Round soft. Fast square drags fill every crossed tile, and each stroke remains one Undo. **Blend ground** uses a round brush and remembers the previous Paint ground shape when you return.

Dirt now uses dedicated packed earth with grit and pebbles, without footprints. Sand has fine grains, small stones and subtle ripples; wood has detailed grain, knots, nails and staggered plank joints. The textures share a world-aligned, mirrored continuation so neighboring tiles and soft brush strokes join cleanly. Existing painted maps receive the new artwork automatically. Asset pack downloads include all six ground materials, including sand and wood.

Choose **Blend ground** and brush along a boundary to soften the transition between existing materials, including older square-painted paths. It blends material coverage while keeping the source textures sharp. The circular cursor shows the full brush size and the harder inner area. Long, fast drags interpolate continuously, and each stroke is one Undo.

These tools change dry ground appearance while retaining heights and collision. Stairs, bridges and water are protected; use **Lake / river** for water. Freehand paint saves and exports with the project and uses the same renderer in gameplay. Projects accept up to 64 MiB, and autosave uses the same size limit as reopening a project.

Checks: `node --test town/builder/ground-brush.test.mjs`; `python3 town/builder/ground-brush-browser.py`. The browser check covers circular/soft edges, opacity, continuous drags, legacy material blending, Undo/Redo, protected terrain, portable export, reload and exact editor/game pixel parity.

Square/material checks: `python3 town/builder/square-ground-browser.py`; `python3 town/world/ground-textures-browser.py`. These cover tile replacement, drag coverage, geometry preservation, source texture joins, matching round/tile material scale and editor/game pixel parity.

Validation: `node --test town/builder/model.test.mjs town/model.test.mjs`; `python3 town/builder/browser.py`; `python3 town/browser.py`.

The editor and playable authored maps both use `town/world/` for the asset catalog, renderer, pixel resolution, project format, collision, spawn placement, movement, gates and camera height. Walk test uses those same functions. Editor guides (selection, grid, collision highlights and ghosts) are intentionally excluded from gameplay. Pixel comparison tests verify that static scenes match exactly with equal camera and viewport settings. The original handcrafted town remains a separate map; placed NPC home interiors are still not connected.

Additional validation: `node --test town/world/physics.test.mjs`; `python3 town/world/browser.py`.

Use **Select land** and drag a rectangle to select terrain tiles. The Land selection panel shows the selected size. **Raise selected land +1** and **Lower selected land −1** change the whole selection by one level while preserving its surfaces and relative heights (within the 0–8 limits). Each click is one undoable action. **Clear selection** or Escape clears the highlight. Selection itself does not alter or save terrain.

Choose **Selection shape → Freeform lasso** to draw around an irregular region instead. Release to close the outline and select the terrain tiles whose centers fall inside it. The highlight and selected count reflect that shape; Raise/Lower affects only its selected tiles. Rectangle and whole-map selection remain available. Freeform selection works in Artwork, Height colors and Elevation plan, and preserves paint, curves and relative heights when moved.

## Detailed construction and home estates

The **home estates** category contains 19 complete home-and-yard scenes: every resident plus your own home. Each has its own full-resolution source artwork, garden, roof shape, porch, planting and musical theme. NPC estates are 15% smaller than their original placement sizes, retaining their relative size differences; your home keeps its existing size. These complete scenes use the ground layer like Music Square. Place them on level ground; their painted porch steps are part of the scene, while the terrain **Steps** tool creates climbable level connections. Houses and wings have collision; yard edges are open. Placed estate doors are not yet connected to NPC interiors or friendship invitations.

Detached perimeter walls, fencing and gateposts have been removed from all 19 home source images. Gardens, paths and structural porch details remain. Add your own boundaries using **Fence / wall**. Existing estate IDs, anchors and saved placement scales remain valid, so saved towns receive the smaller NPC homes and open artwork automatically. The arcade retains its exact interior footprint and current exterior size.

Connected fence/wall tools now draw shared detailed panels and corner piers; adjacent stair cells form wider flights. Existing ivy/rose/wisteria/honeysuckle IDs now use dense painted foliage. Raised terrain uses a world-aligned mossy rock face and an overhanging grass crown rather than flat patterned blocks. Existing project IDs and terrain levels remain compatible. Music Square and the water artwork are unchanged.

The canvas toolbar offers **Select land region**, **Select whole map**, and three views:

- **Artwork** shows the shared game rendering.
- **Height colors** overlays numbered levels and contour boundaries.
- **Elevation plan** hides the scenery and projection so tiles, stairs, water crossings and height boundaries are easy to read and select. Its labels render sharply for planning.

Region raise/lower works in all three views. Use Full map to select broad portions of the valley, then raise or lower them one level per click. Planning views are editor guides and are not saved into the map's appearance.

Additional checks: `python3 town/builder/details-browser.py` validates the 19 estates, parcel collision, elevation views, large selections and whole-map height undo.

Open-home checks: `node --test town/world/estates.test.mjs`; `python3 town/world/open-estates-browser.py` verifies NPC sizes, open former wall positions, solid buildings/wings, native artwork, stable saved placements, arcade footprint and editor/game pixel parity.

## Drag stairs, matching paving, and the arcade exterior

**Steps** now works by dragging between two existing terrain levels. Either drag order works. The editor snaps to a straight north/south/east/west run, reads both end heights, previews the connection, and builds it when you release. Brush width sets the width; Finish chooses stone, wood or brick. Flat landings at the clicked centers connect to a continuous slope, including multi-level changes. Same-height drags and obstructed/water routes show a message instead of changing the map. Escape cancels; each completed run is one Undo. Existing one-level stair cells still load.

North/south stair flights use straight top-down treads with parallel sides, sampled from the detailed stone, wood and brick artwork without its baked perspective edges. Wide flights share one continuous tread across their lanes. The decorative stair-flight assets use the same straight tread interior. Terrain heights, climbable slopes and collision are unchanged.

East/west flights also use the opaque tread interior, with atlas lanes and phases oriented to join across the whole flight. This removes the diagonal grass slits that appeared between side-facing stair lanes. `python3 town/world/stair-sideways-browser.py` checks both directions, all finishes, narrow/wide flights, odd/even source phases and single/multiple levels.

Cobble painting now samples actual scene paving at its world scale. **Paving match → Auto · nearest property** chooses Music Square or the nearest home estate; a specific scene can also be selected. The donor strip meets the asset's entrance edge, and mirrored continuation shares its edge colors and stone size. Paths have feathered grassy borders. The asset pack includes the matching paving textures.

**Landmarks → Coda Arcade · exact interior footprint** is a retrofuturistic exterior with a lounge roof, disco dome, glass main-hall roof and southeast entrance. Its floor footprint and polygon collision use the exact same `arcade-footprint.js` geometry as the actual interior. Scaling is locked at 1:1; the original canvas is 1672×941 world units and the occupied floor bounds are 1512×685. Roof/facade projection adds visual height without changing that footprint. The exterior is a placeable building; placing it does not relocate or replace the active arcade interior.

Validation: `node --test town/builder/stairs.test.mjs`; `python3 town/builder/drag-stairs-browser.py`. The browser check covers drag preview, reverse dragging, one-action undo, saved stair profiles, paving joins, exact arcade polygon collision and scale locking.

Projection check: `python3 town/world/stair-topdown-browser.py` verifies constant-width north/south surfaces in all three finishes at widths one and three, and captures the actual shared game rendering.

## South-facing decoration pack and cliff placement

The library now includes **256 new decorations in 16 families**, plus six dedicated cliff pieces. Search for individual objects or use the category dropdown (each family has 16 items): containers, strings, keys and percussion, brass and winds, music workshop, street furniture, market goods, garden pots, garden features, foliage and rocks, waterfront, farm and utility, festival, signs and lights, cliff decorations, and architectural details. Fronts and openings face south by default. These are individually drawn sprites with transparent cutouts, not ground-square scene plates.

Choose **Cliff assets** in the canvas toolbar, select a piece, then click directly on the exposed south-facing rock face. The attachment stores its position on that face; it follows terrain height changes and curved cliff edges rather than falling onto a grass tile. Use **Height on cliff** to move a selected piece up/down. Existing objects can also be attached: select one, choose **Placement surface → Cliff face**, then click a face. Choose Ground to detach it. If its face is completely removed, the attachment hides until a cliff is restored there; Undo restores the original terrain.

The 256-piece library uses small previews while browsing and fetches the native artwork when selected or used in a saved map. Play mode waits for used artwork, so the editor and game use the same finished art. Asset pack exports load full artwork and include individual PNGs and metadata. Decorative doors/gates/ladders are props; use the connected Gate and Steps tools for working passages and terrain connections.

## Round corners and elevation shading

Choose **Round corners**, then brush near an outside corner of raised land, water, or a painted path. Click **Round corners** again, or the **Corners** button above the map, to cycle **Smooth round → Rocky irregular → Beveled**. Brush an existing corner to apply the selected shape without shrinking its radius; Undo restores the previous shape. Brush width sets the requested rounding size (up to eight tiles), limited to fit narrow terrain. One stroke is one Undo. Corner geometry is saved, visible in Elevation plan, and used by both rendering and collision. Existing rounded corners load as Smooth round. Region raise/lower preserves corner geometry; direct height-brush edits can square individual tiles again.

The same tool also rounds **inside corners**: brush an inward notch to add a matching curved fillet. Inside corners support the same three styles, saved geometry, collision and Undo. Rounded cliff junctions now draw both the upper curved face and the exposed lower ledge face, so adjacent terraces meet without the missing cliff strip.

Additional checks: `node --test town/builder/inside-corners.test.mjs town/builder/freeform-region.test.mjs`; `python3 town/builder/inside-corners-browser.py`; `python3 town/world/cliff-junction-browser.py`; `python3 town/builder/freeform-region-browser.py`.

Terrain now has shaded upper rims, directional ground shadows, and contact shading at height changes. North/east/west edges remain readable even where the grass texture matches the lower ground. Rounded boundaries receive the same shading. South-facing exposed cliffs retain their detailed rock faces.

Stairs and terrain render together from north to south, so higher foreground land covers flights behind it. Cliff support follows the full stair slope at either bank, including adjacent stair lanes, rather than cutting a rectangular gap or leaving the map background exposed.

Validation: `python3 town/builder/decor-browser.py`; `python3 town/builder/round-browser.py`; `node --test town/world/cliff-mount.test.mjs town/builder/round-terrain.test.mjs`. Sprite bounds and browsing thumbnails can be rebuilt with `python3 scripts/build-town-decor.py`; the full source PNG artwork is preserved.

Corner/depth regression checks: `node --test town/builder/corner-styles.test.mjs`; `python3 town/builder/corner-styles-browser.py`; `python3 town/world/stair-occlusion-browser.py`. These cover reversible shapes, saved styles, Undo/Redo, editor/game pixel parity, foreground occlusion in all four stair directions, and rock support along sloped banks.

## Asset color matching

Standalone trees, props, instruments, furniture, foliage and decorations now share a restrained saturation/lighting adjustment to sit closer to Music Square and the terrain. The same adjustment appears in library previews, placed artwork, gameplay and exported asset PNGs. Native artwork remains intact. Finished scenes, their paving, water and matching construction materials retain their existing colors.
