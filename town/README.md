# Coda Town

Enter with **Explore town** from `world-preview.html`. The town stays inside the
active arcade tab, preserving its guest or classroom player. Closing the town
returns to the same arcade session. Standalone `town/` works for exploration,
with musician homes private until an arcade session supplies friendship.

## Landscape and scale

The town is 16000 × 12000 native world pixels, nearly three times the area of
the earlier 9600 × 7200 layout. Characters use the arcade's own renderer and
retain the same scale and zoom outdoors and indoors.

Straight streets, right-angle turns, and private approaches connect four raised
terraces, three river bridges, the commons, orchard, woodland, gardens, and
southern wetlands. Each neighborhood uses a different restrained material and
lighting palette. Mature trees grow in authored groves and property plantings;
their trunks have collision and their canopies cast ground shade.

Terraces have actual elevation, visible retaining walls, and nine stair routes.
Porches rise by 32, 48, 72, or 96 pixels, with varied deck depths, stone or wood
surfaces, railings, and individual stairs. Movement follows stair height and
slows while climbing. Cliff and porch edges cannot be crossed as flat ground.

## Buildings and interiors

Eighteen musician homes and the player's home use five measured plans:

- Moderate 880 × 760 cottages.
- L-shaped homes with a 960 × 800 main building and a 560 × 500 studio wing.
- 1040 × 1040 homes with an offset rear library.
- Large 2000 × 880 three-wing houses.
- Very large 2120 × 1200 courtyard houses, with a recessed front entry and
  separate reading and studio wings.

These numbers are bounding dimensions. The courtyard and L-shaped recesses
remain outdoors; actual floor area is the union of the building's parts.
Exterior roof volumes, collision, interior floor outlines, and room placement
all use that same plan. Wings are real rooms joined by usable openings.

The main house contains an entry hall, private bedroom and bathroom, kitchen
and dining, and living/music spaces. The kitchen and bathroom share a plumbing
wall. Furniture and partitions have collision. Each house's real entry is its
exit, including the recessed courtyard entries.

Homes unlock at **Trusted friend**, five earned history friendship points.
The parent provides the current avatar and musician relationship counts. Town
exploration never writes friendship, rewards, or unscoped player storage.
Identity changes close the town; revoked invitations remove the player from
an interior. Friendship quests remain in the arcade. Town villagers currently
stay near their homes; daily schedules are not implemented.

## Controls and implementation

WASD/arrows walk, Shift runs, E interacts, M opens the map, and the mouse wheel
zooms. Touch movement and interaction controls are included. Landmark discovery
lasts for the current visit.

`model.mjs` owns architecture, terrain elevations, stairs, planting, collision,
and invitations. `art.mjs` renders roof volumes, foliage, and furnished rooms.
`terrain.mjs` draws material surfaces, retaining walls, porches, and stairs.
Ground is cached in at most 32 chunks rather than allocating a giant full-world
bitmap. The map uses a separate overview.

Original house, foliage, furniture, prop, and material atlases live in `assets/`.
The arcade artwork served as the detail reference. The current house atlas is
an overhead, single-story design with subdued roof and masonry colors, replacing
the earlier brightly colored facades. Source generations remain in
`/workspace/generated_images`. No Stardew Valley assets are used.

## Validation

From the repository root:

```sh
node --test town/model.test.mjs
python3 town/browser.py
```

Model checks cover architecture, matching footprints, orthogonal routes,
cliff barriers, porch heights, terrain stairs, trunks, every interior wing,
and a full traversal from the arcade to all raised front doors. Browser checks
exercise arcade entry/return, map, mobile controls, invitations, revocation,
walking up and down porch stairs, and blocked cliff movement. Synthetic starting
positions are confined to intercepted browser-test sources; production contains
no teleport control.
