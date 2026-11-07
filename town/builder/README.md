# Coda Town Builder

Open `town/builder/`, or use **Town Builder** in Test Kitchen. New projects contain grass only on a 16,384 × 12,288 map. The existing playable town and Music Square remain available.

Choose an asset, then click the map. Select / move repositions objects; the inspector changes size, quarter-turn rotation, collision and layer. The library includes 15 tree size/species combinations, shrubs, 30 house combinations, a grand gazebo, furniture, musical decorations, landscape pieces and foliage overlays. Music Square is a complete placeable scene, with decorative walls baked into its artwork; add editable fencing with the fence tool. Houses retain their floor-area footprints; this editor does not yet connect placed doors to NPC interiors or friendship progress.

Drag Fence / wall along grid edges to connect segments. Corners share posts. Gates open with E in walk test. Put ivy, roses or other foliage on the overgrowth layer to draw it over barriers. Construction PNG samples are decorations; the fence tool and terrain Steps tool provide connected barriers and climbable ground.

Ground tools paint grass, cobbles, dirt, wood, sand and water. Raise/lower changes height one level per stroke; Set level uses the inspector level. Steps connect the level below the selected level toward the chosen ascent direction. Paint water for lakes/rivers, then paint bridges across it. Cliff edges and water block movement; stairs and bridges provide routes. Gazebo posts block walking while its center stays open. Collision overlays show asset footprints; walk test uses the arcade character renderer and never changes arcade rewards or relationships.

Right drag pans, wheel zooms, Full map fits the map. Brush width controls terrain painting. Undo/redo tracks strokes. Projects autosave in IndexedDB on this origin/browser. **Save project** exports a portable JSON backup; **Open** validates and restores it. Asset pack downloads individual transparent PNGs, ground textures and anchor/collision metadata. Save local work before switching browsers or clearing site data.

Validation: `node --test town/builder/model.test.mjs town/model.test.mjs`; `python3 town/builder/browser.py`; `python3 town/browser.py`.
