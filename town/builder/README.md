# Coda Town Builder

Open `town/builder/`, or use **Town Builder** in Test Kitchen. Choose **Play this town** to save the current map and open its playable version at `town/?map=builder`; **Edit town** returns to the saved project. New projects contain grass only on a 16,384 × 12,288 map. The existing playable town and Music Square remain available.

Choose an asset, then click the map. Select / move repositions objects; the inspector changes size, quarter-turn rotation, collision and layer. The library includes 15 tree size/species combinations, shrubs, 30 house combinations, a grand gazebo, furniture, musical decorations, landscape pieces and foliage overlays. Music Square is a complete placeable scene, with decorative walls baked into its artwork; add editable fencing with the fence tool. Houses retain their floor-area footprints; this editor does not yet connect placed doors to NPC interiors or friendship progress.

Drag Fence / wall along grid edges to connect segments. Corners share posts. Gates open with E in walk test. Put ivy, roses or other foliage on the overgrowth layer to draw it over barriers. Construction PNG samples are decorations; the fence tool and terrain Steps tool provide connected barriers and climbable ground.

Ground tools paint grass, cobbles, dirt, wood, sand and water. Raise/lower changes height one level per stroke; Set level uses the inspector level. Steps connect the level below the selected level toward the chosen ascent direction. Paint water for lakes/rivers, then paint bridges across it. Cliff edges and water block movement; stairs and bridges provide routes. Gazebo posts block walking while its center stays open. Collision overlays show asset footprints; walk test uses the arcade character renderer and never changes arcade rewards or relationships.

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
