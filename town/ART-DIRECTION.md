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

- Character-relative proportions stay consistent indoors and outdoors; town-unit conversion applies to both the character and the arcade building.
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

### Parallel 2/3 furniture projection

Furniture and floor decorations use the user's parallel 2/3 game view: show
the top and front, with no vanishing point. Corresponding straight near and far
edges have equal widths, and depth edges remain parallel. Rectangular tables,
countertops, mattresses, seat panels and woven rug borders must not become
trapezoids. Front-facing cabinets stay front-facing. Preserve real oval tops,
rounded upholstery, scalloped rugs, decorative carving and splayed legs.

Earlier asset-review notes that say “3/4 perspective” mean this same parallel
2/3 rule; they are not requests for a different projection. Correct the native
drawings rather than warping them while rendering. Retain each collection's
materials and motifs, original catalog IDs, view sizes, foot anchors, collision
and saved placements. Apply shared-source repairs to derived furniture too.
Accepted redraws and their original image-generation files are recorded in
`assets/parallel-art/`; the catalog, reviewer, builder, game and exports use the
same bounded native-art runtime.

Capture the running square, fences beside a character, cliff face, shoreline,
and a whole-town overview when reviewing a visual change. Compare those views
to the approved square before claiming a major graphical improvement. Keep
source-art previews and actual application screenshots clearly distinguished.

### User-directed town building

Keep the approved Music Square intact and available as a complete placeable scene. New editor maps start as grass, with no predetermined streets or buildings. Offer multiple tree species and sizes, connected wood/iron fencing, stone/brick/plaster walls, terrain stair finishes, and foliage overlays above fences. House variants retain their actual floor-area footprints. Keep the original playable town available while the builder develops independently.

### Editor/game parity

All builder-authored maps must use `town/world/` in both the builder and playable town route (`?map=builder`). Keep one asset catalog, renderer, terrain/asset collision implementation, movement, gate interaction, and pixel scale. Editor guides may overlay the scene; they must not alter the underlying game artwork. Changes to shared graphics apply to both views. Preserve saved version-1 editor projects. The original handcrafted town is available separately while authored-map NPC interiors remain future work.

Authored-town characters use a 2.5× instance scale so the native arcade avatar remains readable beside town-sized scenery. Scale the existing character, outfit and equipment around its foot anchor; do not substitute a placeholder or change the arcade's global character defaults. Walk test and gameplay share 450/780 walking/running speeds and distance-driven gait. Draw one character shadow, and retain collision substeps so the faster actor cannot skip gates or stairs.

### Detailed estate and construction pass

User approved Music Square and water as the visual benchmark, and rejected the procedural stairs, walls, sparse vines, and flat cliff pattern. Construction must use the matching detailed painted kit (`construction-detail.png`), botanical overlays (`foliage-detail.png`) and continuous rock/grass cliff rendering, with shared piers at fence corners. Do not return to diagonal gate-like braces on every fence cell, flat strip stairs, or isolated rock decals stamped across cliff faces.

There are 19 distinct full-resolution residential scenes (`home-estate-*.png`), one for every resident and the player, not enlarged atlas thumbnails. Each is a complete home and planted yard with a large roof footprint, musical details, deep porch and stairs. Keep the individual house pieces available as well. Preserve the approved Music Square and water source files. Estate scenes have house/wing collision; actual NPC door/interior binding remains a separate feature.

NPC home estates use 85% of their original world placement size while preserving relative variation; the player home keeps its current size. Preserve native art resolution and stable bottom-center anchors. Home yards must have no baked detached perimeter walls, fencing, gates or gateposts, and no collision left where those boundaries stood. Retain structural house/porch walls, stairs, gardens and paths. Custom boundaries belong to the connected fence/wall tool. Preserve Coda Arcade's exact interior geometry and convert its town scale consistently with the character.

Editor tools must include obvious regional selection and a numbered, color-coded elevation plan so large level changes can be understood before returning to the game artwork view. The plan is a guide, not a replacement art style.

### Terrain connections and arcade footprint

Steps are a connection tool: drag from one existing ground height to another. Do not require a manually selected ascent direction/height. Keep endpoints at their clicked elevations, make movement continuous in both directions, and project tread artwork over the actual slope.

North/south stairs have a top-down view: rectangular treads and parallel flight edges. Exclude baked trapezoidal perspective and angled step ends from the source sampling, while retaining its detailed material, tread highlights and riser shadows. Apply the same sampling to decorative stair-flight assets.

Side-facing stair lanes must form one opaque continuous surface. Orient both the source lane and tread phase before projection; never expose source-sprite transparency as diagonal grass strips between lanes.

Ground painting uses freehand circular coverage with adjustable hardness and opacity. Blend material weights across boundaries while retaining sharp pixel texture detail, consistent source scale and property paving alignment. Interpolate both sides of terrain-cell boundaries so the storage grid cannot appear as seams. Keep height, water and stair collision independent of dry surface paint.

Keep square, grid-snapped full-tile painting as an explicit alternative to the soft round brush. Dirt must be free of footprints and tracks. Sand needs detailed grains and restrained ripples; wood ground needs authored planks, grain, knots and joints. Use the dedicated ground-surfaces.png artwork with consistent world scale and matching repeat edges; do not return to flat sand fills or procedural board stripes.

Raw standalone asset packs receive restrained shared saturation/lighting correction to match the terrain around Music Square. Apply the same correction in previews, placement, gameplay and exported PNGs. Preserve native source images and the approved finished scenes, water, paving and construction palette.

Painted cobble must share the source scene's stone scale, palette and entry-edge colors. Use real donor paving from Music Square or the chosen home estate; do not substitute the old generic ground atlas cobble. Feather grass borders while preserving clear passage joins.

The retrofuturistic Coda Arcade exterior uses a copper/teal Art Deco roof, neon trim, a glass main hall, lounge wing and dance dome. The inside and outside share `arcade-footprint.js`; preserve its exact floor polygon union and southeast entrance through the 2.5× interior-to-town conversion. That factor must track the character's town scale, so door and floor dimensions remain consistent relative to a person. Roof shadows, ornaments and wall projection are not extra floor area. Do not estimate its floor plan from an image or resize it to fit a generic rectangle. Sort a foreground actor at the actual front polygon edge, not the blank canvas bottom.

Keep stair grain and visible tread pitch at a fixed size across different widths and grades. Repeating authored material fills the projected walking surface; do not stretch a whole stair sprite over a wide or steep flight. Budget stair movement against surface and projected travel so elevation cannot produce a camera rush. Advance gait by real surface travel.

### Cliff attachments, decoration library and legible terrain

User requested about 250 more decorations, south-facing for the most part: barrels, crates, cellos, double basses, guitars and varied town dressing. The 256-piece pack has 16 distinct families, source atlas PNGs, cleaned alpha cutouts, component-aware sprite bounds, and small library previews. Do not count recolors as extra objects or use opaque ground squares behind props. Preserve native artwork for placement/game rendering and export.

Cliff pieces attach to the exposed vertical south-facing rock surface, not the ground tile behind it. Mount height is relative to the actual face, follows terrain changes/rounded arcs, and must use the same projection in editor and game. Six dedicated pieces supplement the pack's cliff decorations.

Round corners must use actual curved land/water/path geometry, including collision and saved maps. Terrain height changes need clear rims/contact shading and ground shadows on north/east/west as well as the textured south cliff. Keep shadows soft and material detail visible; avoid relying solely on matching grass patterns to communicate height.

Corner shaping offers smooth curves, irregular rocky angles and a straight bevel. Keep their cardinal endpoints and radius stable when changing styles; irregular cuts must remain inside the original corner. Rendering, edge shading, elevation guides, cliff attachments and collision must all use the same boundary.

Support both outside corners and inside notches. Concave fillets add the neighboring material/height around the notch while retaining a stable lower surface. At curved terrace junctions, draw the curved upper face and any exposed lower tile-edge face independently; neither may hide the other.

Land selection offers rectangles and a freeform lasso. Preview the drawn outline, then highlight/count/edit the actual selected terrain cells rather than its rectangular bounds. Regional height changes must preserve painted surfaces and curved upper/lower height relationships inside irregular masks.

Render terrain and stair flights in north-to-south order so foreground ground covers stairs behind it. Exposed cliff support must follow stair slopes along both banks without gaps or a flat false floor. Preserve the approved detailed cliff material rather than covering depth problems with plain polygons.
