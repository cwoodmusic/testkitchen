# Coda Town

Enter with **Explore town** in the connected arcade (`world-preview.html`). The
town runs in a modal frame so guest and classroom identity stays in the original
tab. Closing it resumes the arcade. `town/` can also run standalone, with private
NPC homes locked because no active arcade identity has been supplied.

The 9600 × 7200 world spans roughly 300 × 225 32-pixel ground tiles. Seven districts,
three river bridges, an orchard, northern woodland, a pond, a glasshouse, a
bandstand, a lookout, a southern shore, and garden lanes connect 18 musician
homes and the player's cottage. Use WASD/arrows, Shift to run, E to interact,
M for a map, and the mouse wheel to zoom. Touch movement and interaction buttons
are provided. Landmark discoveries are temporary for the current visit.

Every musician's house opens at **Trusted friend**, five existing history
friendship points. The parent sends the current avatar appearance, musician IDs and relationship counts
from the current history engine. The town never writes progress, invents
friendship rewards, or reads unscoped storage. Identity changes close the town;
revoked invitations remove the player from an interior. Existing friendship
quests are still accepted and completed through the arcade. The player's own
cottage is available immediately. Each home's exterior ground footprint and interior envelope are both 640 × 560
native pixels. Indoor and outdoor rendering share one zoom and the arcade's own
character renderer. Interiors use a real five-zone floor plan: an entry hall,
private bedroom and bathroom, kitchen/dining, and living/music. The bathroom
and kitchen share a plumbing wall; the sofa faces its coffee table; doors and
room routes have physical clearance. Furniture and partitions have collision.
The front door is the only exit. Residents share this floor plan with their
own palette and exterior style. Town villagers currently stay near
their homes; daily schedules are not implemented.

Detailed original house, foliage, public-prop, furniture and terrain atlases live
in `assets/`; their source generations are retained in `/workspace/generated_images`.
They were created using the existing arcade artwork as a style reference.
`art.mjs` draws the atlas sprites and furnished room. `terrain.mjs` rasterizes
curved lanes, worn verges, mossy paving, water, gardens, and woodland. Paths
use textured surfaces along sampled curves rather than stroked lines.
`model.mjs` owns the authored layout, room geometry, home invitations, water,
and collision. Tree canopies overlap walking space decoratively. The town is a
playable foundation at valley scale, not a claim of Stardew Valley's finished
asset density or content volume. No Stardew assets are used.

From the repository root:

```sh
node --test town/model.test.mjs
python3 town/browser.py
```

Model tests also verify exterior/interior footprint equality and walkable
routes from the front door to every room. Browser checks cover arcade entry/return, map, mobile controls, locked homes,
earned invitations and invitation revocation. Their synthetic start position
and friendship fixture are confined to intercepted test responses.
