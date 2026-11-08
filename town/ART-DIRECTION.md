# Coda Town art direction

Coda Town is an original musical town with mostly European architecture. The
user's references establish the expected richness, character and depth; they
are not a request to copy another game's town, buildings or interface.

## Approved visual benchmark

`assets/music-square.png` is the approved direction: warm limestone, crafted
ironwork, nuanced paving, planted edges, intimate musical details, and one
clearly centered fountain. Preserve that artwork's detail and color. It is
used in the playable square, with collision and live characters, rather than
being a mockup presented as a game screenshot.

`assets/houses.png` and `assets/ground.png` were redrawn against that benchmark.
Buildings should have masonry, plaster, timber, slate or clay, shutters, worn
thresholds, window boxes and appropriate musical personality. Avoid decorating
every surface with oversized musical symbols.

## Scale and composition

- Characters retain the arcade renderer's world scale indoors and outdoors.
- House roof volumes and walkable interiors use the same measured footprint,
  including real side wings, rear rooms and courtyard recesses.
- Property fence boards are 56 world pixels high, with 14-pixel posts and
  96-pixel bays. Porch railings are 42 pixels high. Show a nearby character in
  scale-review screenshots; do not judge their size from the whole-town map.
- Music Square's fountain is at the geometric center in `MUSIC_SQUARE`.
  The composition, planting, entrances and furniture support that center.
- Natural terrain needs connected ground, banks, exposed faces and shadows.
  Do not paint a small rotated fringe sprite repeatedly around a shoreline.
- Cliffs have substantial physical elevation and usable stairs, not only a
  narrow decorative band. Current main terrace heights are 240 and 160 pixels;
  the civic terrace is 128 pixels high.
- Streets stay straight with right-angle turns. Natural water and landscape
  boundaries may be irregular; ponds must not be perfect ovals.

The renderer uses a shared two-pixel screen grid. The approved square and house
art retain their authored colors; other materials use the shared world palette
and regional lighting. Do not replace detailed art with featureless geometric
shapes or mistake a passing movement test for visual quality.

Capture the running square, fences beside a character, cliff face, shoreline,
and a whole-town overview when reviewing a visual change. Compare those views
to the approved square before claiming a major graphical improvement. Keep
source-art previews and actual application screenshots clearly distinguished.

### User-directed town building

Keep the approved Music Square intact and available as a complete placeable scene. New editor maps start as grass, with no predetermined streets or buildings. Offer multiple tree species and sizes, connected wood/iron fencing, stone/brick/plaster walls, terrain stair finishes, and foliage overlays above fences. House variants retain their actual floor-area footprints. Keep the original playable town available while the builder develops independently.

### Editor/game parity

All builder-authored maps must use `town/world/` in both the builder and playable town route (`?map=builder`). Keep one asset catalog, renderer, terrain/asset collision implementation, movement, gate interaction, and pixel scale. Editor guides may overlay the scene; they must not alter the underlying game artwork. Changes to shared graphics apply to both views. Preserve saved version-1 editor projects. The original handcrafted town is available separately while authored-map NPC interiors remain future work.

### Detailed estate and construction pass

User approved Music Square and water as the visual benchmark, and rejected the procedural stairs, walls, sparse vines, and flat cliff pattern. Construction must use the matching detailed painted kit (`construction-detail.png`), botanical overlays (`foliage-detail.png`) and continuous rock/grass cliff rendering, with shared piers at fence corners. Do not return to diagonal gate-like braces on every fence cell, flat strip stairs, or isolated rock decals stamped across cliff faces.

There are 19 distinct full-resolution residential scenes (`home-estate-*.png`), one for every resident and the player, not enlarged atlas thumbnails. Each is a complete home and planted yard with a large roof footprint, musical details, deep porch, stairs, thick walls and an open entry. Keep the individual house pieces available as well. Preserve the approved Music Square and water source files. Estate scenes are visual parcels with house/wall collision; actual NPC door/interior binding remains a separate feature.

Editor tools must include obvious regional selection and a numbered, color-coded elevation plan so large level changes can be understood before returning to the game artwork view. The plan is a guide, not a replacement art style.

### Terrain connections and arcade footprint

Steps are a connection tool: drag from one existing ground height to another. Do not require a manually selected ascent direction/height. Keep endpoints at their clicked elevations, make movement continuous in both directions, and project tread artwork over the actual slope.

Painted cobble must share the source scene's stone scale, palette and entry-edge colors. Use real donor paving from Music Square or the chosen home estate; do not substitute the old generic ground atlas cobble. Feather grass borders while preserving clear passage joins.

The retrofuturistic Coda Arcade exterior uses a copper/teal Art Deco roof, neon trim, a glass main hall, lounge wing and dance dome. The inside and outside share `arcade-footprint.js`; preserve its exact floor polygon union, southeast entrance and world-unit scale. Roof shadows, ornaments and wall projection are not extra floor area. Do not estimate its floor plan from an image or resize it to fit a generic rectangle.

### Cliff attachments, decoration library and legible terrain

User requested about 250 more decorations, south-facing for the most part: barrels, crates, cellos, double basses, guitars and varied town dressing. The 256-piece pack has 16 distinct families, source atlas PNGs, cleaned alpha cutouts, component-aware sprite bounds, and small library previews. Do not count recolors as extra objects or use opaque ground squares behind props. Preserve native artwork for placement/game rendering and export.

Cliff pieces attach to the exposed vertical south-facing rock surface, not the ground tile behind it. Mount height is relative to the actual face, follows terrain changes/rounded arcs, and must use the same projection in editor and game. Six dedicated pieces supplement the pack's cliff decorations.

Round corners must use actual curved land/water/path geometry, including collision and saved maps. Terrain height changes need clear rims/contact shading and ground shadows on north/east/west as well as the textured south cliff. Keep shadows soft and material detail visible; avoid relying solely on matching grass patterns to communicate height.
