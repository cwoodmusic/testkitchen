# Coda Town — playable art direction

These are captures from the running game. Music Square uses the approved
European musical piazza artwork, with a centered fountain, collision, live
musicians and working terrace entrances. Houses and ground materials have
been redrawn against that visual benchmark.

## Music Square

The whole square is framed so the fountain's center and the perimeter layout
are visible. The bandstand is outside the square rather than obstructing it.

[![Playable Music Square](music-square.png)](music-square.png)

## Fence scale

A character stands beside the enlarged porch railing. Property fences have
substantial posts and complete bays; porch railings use their own height.

[![Fence beside a character](fence-scale.png)](fence-scale.png)

## Cliff height

Main cliffs are 240 and 160 world pixels high, with physical stair connections.
The civic terrace is 128 pixels high. The renderer uses connected terrain tiles.

[![Cliff face](cliff-face.png)](cliff-face.png)

## Lake bank

Connected terrain edges share the water collision boundary. The repeated,
rotated fringe images have been removed.

[![Lake bank](lake-bank.png)](lake-bank.png)

## Whole town

[![Town overview](map-overview.png)](full-map.png)

## House and interior

[House and porch](house.png) · [Matching interior](interior.png)

The approved square is the benchmark for subsequent visual work. Movement
checks verify functionality; they do not establish that every part of the town
has reached the same artistic quality.

## Town Builder

The builder starts with grass only and preserves the approved Music Square as a placeable scene. Includes connected fences/walls, multiple trees and house footprints, terrain, stairs, water, bridges, collision walk testing and portable project/asset downloads.

![Town Builder — actual browser capture](builder.png)

### Playable authored maps

**Play this town** saves the editor map and opens it in the actual town route. The builder and authored-map gameplay now share their renderer, assets, pixel resolution and collision/movement rules. Static scene pixel parity is checked in the browser tests. The original handcrafted town remains available separately.

![Authored map in gameplay — actual browser capture](builder-play.png)

### Land region selection

Choose **Select land**, drag a rectangle, then **Raise selected land +1** or **Lower selected land −1**. Each action is undoable; Clear selection or Escape removes the highlight.

![Land selection in the builder](land-selection.png)

## Detailed estates, terraces and elevation tools

Actual browser captures of the updated shared game artwork:

- [Full home-and-yard asset library — 19 properties](home-estates-library.png)
- [Your home and garden at placement scale](home-estate.png)
- [Detailed connected walls, stair flights, foliage and cliff faces](terraces-detail.png)
- [Numbered elevation plan and large-area selection](elevation-plan.png)

Open the **home estates** category to place whole properties. Use the canvas toolbar for **Select land region**, **Select whole map**, **Height colors**, or **Elevation plan**. Music Square and water retain their existing artwork.

## Drag stairs, matching paving and Coda Arcade exterior

Actual browser captures:

- [Drag-built multi-level stair connection](drag-stairs.png)
- [Paving joined to Music Square](matched-paving.png)
- [Paving joined to a home courtyard](matched-home-paving.png)
- [Retrofuturistic Coda Arcade exterior](arcade-exterior.png)

Use **Steps** and drag between levels. Cobble uses **Paving match → Auto · nearest property** by default. The arcade is under **landmarks**, with scale locked to its actual interior footprint. Both inside and outside now use the same authoritative floor polygons.

## Decoration pack, cliff attachments and rounded terrain

- [256 new decorations — actual full-resolution browser asset gallery](decor-256-library.png)
- [Cliff-mounted ivy, roots and lantern with instruments and containers](cliff-decorations.png)
- [Rounded land, lake and paving with elevation edge shading](rounded-terrain.png)
- [Rounded terrain in the elevation plan](rounded-elevation-plan.png)

The pack is divided into 16 categories and is south-facing by default. **Cliff assets** opens the dedicated attachment pieces. **Round corners** softens outside land/water/path corners. The shared editor/game renderer now shades terrain rims and lower-ground contact areas to make northern and side boundaries readable.

## Corner styles and stair depth

[Smooth round, Rocky irregular and Beveled — actual shared-renderer browser captures](corner-styles.png)

Click **Round corners** repeatedly, or use the **Corners** button above the map, to cycle the three styles. Brush a new or existing land/water/path corner to apply the current style. Shapes share their original radius and endpoints, are undoable, persist in saved projects, and affect collision as well as artwork.

Stair flights now draw behind higher foreground land. Their exposed banks follow the slope with continuous rock faces, including the north bank and adjacent wide flights. The updated [drag-stairs capture](drag-stairs.png) shows the shared editor/game rendering.

North/south stairs now use parallel sides and rectangular top-down treads, including the decorative flight assets. [Stone, wood and brick in the actual shared renderer](stairs-topdown.png).

## Freehand ground and continuous side stairs

- [Round soft painting and before/after material blending](ground-brush.png)
- [Continuous east/west stairs in stone, wood and brick](stairs-sideways.png)
- [Standalone asset colors beside Music Square, before and after matching](asset-color.png)

**Paint ground** has a round cursor, adjustable hardness and opacity. **Blend ground** smooths existing material boundaries while preserving texture detail. Paint is saved in the project and drawn identically in the editor and game. Side stair flights no longer have grass slits between lanes. Standalone assets share a restrained palette treatment in the library, world and exports.

## Ground shapes and upgraded materials

Choose **Brush shape → Round soft / Square tiles** in Paint ground. Square tiles paints complete grid cells, while Round soft retains hardness and opacity controls. Both use the same native materials and are compatible with Blend ground.

[Detailed sand, wood and footprint-free dirt in the shared renderer](ground-materials.png)

Existing maps use the new materials automatically. The asset pack includes sand and wood alongside the other ground textures.

## Inside corners, cliff joins and freeform selection

- [Inside corners in the shared renderer](inside-corners.png)
- [Rounded cliff meeting a lower terrace with its exposed face intact](cliff-junction.png)
- [Freeform land selection in the builder](freeform-selection.png)

**Round corners** works on inward notches as well as outside corners, using the same smooth, rocky and beveled modes. **Select land → Selection shape → Freeform lasso** lets you draw an irregular region and raise/lower just those selected tiles.

## Smaller NPC homes and open yards

[NPC homes, your home and the arcade at the same world scale](open-estates.png)

NPC estates are 15% smaller while retaining their size differences. All 19 home assets have open yard edges, with detached baked fencing/walls/gateposts and their collision removed. Houses, porches, gardens and paths remain. Your home's size is retained; the arcade uses its exact interior blueprint converted to the town character's scale. Existing saved placements receive the revised artwork and sizes automatically.

## Town character scale and walking

[Larger walk-test character beside town scenery](walk-player.png)

Walk test and authored-map gameplay now use a character at 2.5× native size, with faster walking and Shift-running. Directional animation and equipment retain their proportions, feet follow the actual terrain/stair height, and the gait follows movement rather than continuing against a wall.

## Consistent arcade and stair scale

- [Arcade and NPC home at matching character/camera scales, with entrance closeups](arcade-scale.png)
- [Consistent stair materials across wide and steep flights](stairs-material-scale.png)

The arcade uses the same 2.5× town-unit conversion as the avatar, preserving its exact interior shape and collision. Stair treads and material detail repeat at a fixed visible size, and movement is paced by the slope so steep stairs cannot rush the camera.
