# Empty arcade background and independent props

## Hand-drawn library style and facing

The original 79 library items use the chunky hand-drawn pixel style established by
the Notes pencil cup, ledger and price display. Seventy-four have new artwork;
the five matching Notes accessories keep their existing art. Props use simpler
teal, coral, cream, muted purple and ochre shapes with fewer glossy highlights.
Furniture and equipment face straight south rather than diagonally. The cash
register faces north: its rear housing and vents face the player, with the
operator's keypad and screen on the far side. Rugs remain flat and top-down.
The preview states each asset's direction; searching **north** finds the register.

`pixel-style.js` maps the current library to
`assets/decor/handdrawn/v1/` and records the facing directions. The original
PNG collection and its source sheets remain available. Existing custom image
imports retain their embedded art. Standard arcade sofas, counters, DJ desk and
candle tables use the matching new designs. Sofas retain their original world
silhouettes and foot baselines, keeping the Lounge sign clear. The published
rectangular table uses its new artwork at the same position and dimensions.

The eleven generated sheets are retained as `assets/decor/source/handdrawn-*.png`.
Run `node scripts/build-pixel-style-assets.cjs` to extract the 74 transparent
sprites and their provenance manifest; `--check` verifies reproduction. The
earlier artwork builders still reproduce the retained original collection.
Validate the active collection with `node --test tests/pixel-style.test.cjs`
and `python3 tests/decor-library-browser.py`.

## Vertical east- and west-facing furniture

The library includes twelve additional hand-drawn furniture assets: coral
box-style two-seaters, navy round-arm two-seaters with cream cushions, amber
club armchairs, teal wooden chairs, jade counters and walnut tables. Each has
an east-facing (right) and west-facing (left) version. The long footprint runs
north–south; the artwork is a side view rather than a rotated front sprite.
No additional turntable desks are included.

Open **Objects → Asset library → Furniture** and search **east** or **west**.
Each search lists six pieces. Add the pieces you want; browsing leaves your
layout unchanged. Copies support the existing move, size, flip, layer, Undo,
Save and Export controls. The editor does not auto-place them; the published layout retains the pieces
chosen in the latest uploaded project.

The source sheet is `assets/decor/source/handdrawn-east-west-furniture.png`.
The hand-drawn collection now has 86 extracted sprites across twelve sheets;
five preferred Notes accessories retain their original sources. Rebuild with
`node scripts/build-pixel-style-assets.cjs`, or verify with `--check`.

## Empty walls and movable decorations

The current main arcade uses `assets/environment/v1/empty-walls.png` beneath
separate wall decorations. The Lounge masonry is amber and flat beneath its
horizontal cap; the north central wall between Lounge and Piano Lab is green;
the dance floor's north wall is purple. Other walls remain blue. Signs,
lanterns, musical plaques, bottle shelves and wall gems are not painted into
these walls. The previous `empty-arcade.png` and older scenery remain available.

In **Developer → Objects → Existing world objects**, choose **Neon signs & wall
art** or **Wall lanterns**, then **Edit existing object**. These 25 originals
support movement, resizing, rotation, mirroring, opacity, hiding, duplication,
Undo/Redo and the existing project Save/Export/Import workflow. The Classroom
label is also separate; moving a sign does not relocate its doorway/activity.

Lantern sprites have transparent surrounds. Their warm halo, pulsing core and
lighting use the same position, scale, rotation, animation and opacity as the
sprite. Hiding a lantern hides its light; duplicating it creates another light.
No fixed orange stain or previous lantern image remains in the empty wall.
Moving a lantern reveals that wall's underlying amber, green, purple or blue
material. Existing guest progress, collision, furniture and project data are
unchanged. Legacy scenery keeps its original baked decorations.

`wall-fixtures.js` records source crops, editor identities and lighting anchors.
The generated empty wall and transparent atlas sources are retained under
`assets/environment/source/`. Run `node scripts/build-wall-fixtures.cjs` to
rebuild the background and 13 sprite files; `--check` verifies reproducibility.
The builder is offline and requires Chromium with permission for local sockets.
Validate with `node --test tests/wall-fixtures.test.cjs tests/world-lighting.test.cjs`
and `PYTHONDONTWRITEBYTECODE=1 python3 tests/wall-fixtures-browser.py`.

The following sections document the retained earlier artwork and its builders.

## Rectangular lounge table and music collection

The published layout follows uploaded world project (13), including its
arranged lounge and Notes counter accessories. The upload is retained exactly;
new library assets are available for manual placement.

The **Asset library** now contains 91 items. **Furniture** includes
the new walnut table. **Wall decor** adds framed treble and bass clefs, grand
staff sheet music, a gold record award, a golden saxophone, crossed electric
guitars and a drum kit. Each is a separate transparent image; adding, moving,
resizing, duplicating and saving use the existing editor controls. The wall art
is available for placement rather than added over the uploaded layout.

The generated sheet is `assets/decor/source/music-lounge-additions.png`.
`node scripts/build-lounge-assets.cjs` rebuilds the cutouts and provenance
manifest; `--check` verifies them. The earlier 71 library entries and artwork
are retained.

The main arcade's refreshed environment uses `scenery: "environment-v1"` in a
world-project export. `assets/environment/v1/empty-arcade.png` is a complete
1672 × 941 empty-room image. Floors, carpet, masonry, trim, doorways and fixed
wall signs are finished behind movable furniture, plants, counters and cabinets.
Moving or hiding a prop reveals this image rather than a repeated floor sample.

`environment-art.js` loads the backdrop and clean transparent prop images. It
retains the source dimensions and identities of 36 furniture, plant and bollard
pieces. The lounge keeps its large curved couch and its existing placement.
Counter, mirror and DJ-console props share the new visual style. The four
speaker stacks are independent image assets in the published project. Cabinet
and disco-ball art continues to use its existing isolated sources, so game
screens, lights and interactions remain connected.

The renderer uses the empty backdrop as the base and draws props separately in
depth order. Structural foreground pieces are cut from the finished architecture;
old annotated masks and clone patches are not layered onto the refreshed scene.
Additional defaults are a movable four-head DJ floodlight rig and a large rectangle rug in front of the Notes shop. The other 47 library images stay unplaced until added. Their source art and reproducible extraction are in `assets/decor/` and `scripts/build-decor-props.cjs`; rug extraction uses `scripts/build-rug-props.cjs`. NPC appearance, accessories, accounts and game progress are separate systems.

## Glass floor palette and sparse stars

The exposed main floor, connecting walkways and nightclub perimeter use quiet
dark-blue glass. The dense cosmic dust and isolated reflection splotches are
removed. Forty-eight small warm-white and icy-blue stars pulse and gently flicker
behind objects and actors. The lounge carpet, walls, signs, doorways, object
placements and collision stay intact.

The image-generated palette source is `assets/environment/source/glass-floor.png`.
The previous cosmic reference and original backdrop remain in that source
directory. Rebuild the scoped composite from the repository root with
`node scripts/build-cosmic-floor.cjs`. Its reviewed masks are in
`scripts/cosmic-floor-regions.json`; pixels outside those masks are preserved
exactly. Floor repair paint is rebased onto the new material while the authored
wall-top repair keeps its coverage and transparency.

Dance-floor colors advance about once per second with smooth transitions.
Grounded footsteps brighten the tile beneath the player. Color animation and
star pulses pause with Motion Off or reduced motion. FX Off hides stars and
holds the dance-floor palette still, with footstep feedback available.

## Emerald wall and jade counter

The back-wall masonry around the main Coda sign and beside the cyan Piano Lab
entrance is emerald green. The long
shop counter uses jade panels and mint lighting with its original gold trim.
The three existing counter icons use a matching mint/emerald rendering palette;
their stored image data and player artwork remain intact.

The generated sources are `source/green-back-wall.png` and
`source/jade-counter.png` inside `assets/environment/`. Original counter and
backdrop references are retained alongside them. Run
`node scripts/build-green-accents.cjs` to rebuild the scoped palette edit.
The floor builder runs that step automatically, so regenerating glass does not
remove the green accents. Floor, sign and lamp pixels outside the masonry mask
remain unchanged; the counter retains its alpha silhouette and original gold
pixels. No project reset or layout change is needed.

## Saved floor-paint compatibility

Older environment-v1 editor projects may contain painted blue floor repairs
that cover the newer glass backdrop. `floor-palette-compat.js` resolves only
known old RGBA pixels at their recorded positions, for both the base background
and structural fragments. It preserves local project JSON, object placement,
collision, transparent object erasures and custom paint with different colors.
The saved project does not need a Reset. Legacy scenery without environment-v1
keeps its original rendering.

`scripts/build-floor-palette-compat.cjs` rebuilds the compatibility manifest from
its retained old-color rules and the current published background journal. Run
it after the floor builder, then use `--check` to verify reproducibility. The
reviewed native floor mask and repair-color predicate retain lamps and wall
trim rather than painting the entire bounding rectangle as floor.

## Walkway joins and lamp cleanup

The boutique-to-nightclub walkway is a continuous glass surface with clean
wall-cap joins. The generated cleanup removes the old flat repair band, blue
stub and clipped divider-lamp glow within a narrow reviewed mask. The lamp and
wall stay in their existing positions.

`source/walkway-cleanup.png` is composited only through
`scripts/walkway-cleanup-regions.json` by `scripts/build-walkway-cleanup.cjs`.
This runs after the floor and green accents. The cleaned native artwork owns
that mask, so the builder removes only overlapping published background-journal
pixels. It retains all edits outside the mask, object erasures and layout data.
Regenerate `scripts/build-floor-palette-compat.cjs` afterward; historical floor
pigments then reveal the cleaned source in existing local projects too.

## Reshaped boutique path

The current path follows the newer editor export: the west wall segment and
dance-floor disco ball remain hidden, and its six collision edits are retained.
The 10,543 transparent background pixels defining the removed area reveal a
scoped glass underlay. Foreground fragments keep those same pixels transparent,
so the removed wall cannot cover actors on the new floor. The opaque authored
outline, saved JSON and custom paint remain intact. Nightclub ambience is
clipped below the refreshed north wall, so its former lighting boundary cannot
paint a rectangular haze band across this new walkway.

`assets/environment/boutique-pathway-shape.json` records the reviewed row masks.
`pathway-floor-fill.js` samples approved glass from the empty main-floor artwork
and draws it behind the background composition. Both the floor repair pass and
walkway cleanup protect the newer authored pixels, preserving the reshaped path
on repeated builds instead of restoring the earlier diagonal.

## Rectangular boutique lamp wall

The later rectangular-wall edit replaces the boutique's diagonal lantern return
with a flat wall and continuous glass below it. Its generated source is
`source/boutique-rectangle.png`; `scripts/boutique-rectangle-regions.json` limits
ownership to the reviewed wall and floor. `build-boutique-rectangle.cjs` runs
after the older floor, green and walkway passes so those earlier sources cannot
restore the diagonal. Only background journal pixels inside this newer mask
are removed. Exact legacy journal colors are mapped to the current artwork at
render time; imported project data and stored backups remain unchanged.

The dance-room corner is also a south-facing rectangle: its top and bottom
end at the same vertical edge, and both music plaques face forward. The final
`build-stage-wall.cjs` pass owns only `scripts/stage-wall-regions.json`; that
mask explicitly protects the painted dance tiles. The removed return wall
reveals glass around the existing sofa and cactus. Published collision follows
the new walls and open floor, and refreshed-scene lamp anchors follow the new
artwork while the original scene retains its original anchors.
The stage source is normalized from its declared 1671×941 size with nearest
sampling. Reflection edges blend only over existing glass beyond the removed
masonry, using the saved pre-edit plate so repeated builds do not accumulate
the blend.

The boutique's recessed shoulders are filled by
`scripts/build-boutique-flat-top.cjs`, under one horizontal roof. Its explicit
mask preserves the central icon/sign journal, hanging lamp, mirror, counter,
lower wall and floor; collision blocks only the newly filled shoulders.

`wall-reflections.js` adds cached soft colored projections of the composed
backdrop onto reviewed glass regions around the room. Reflections draw before
actors and furniture, protect carpet/dance tiles/architecture, and follow the
Full/Lite/Off effects setting. Dark masonry is filtered out before projection
to prevent rectangular haze bands. The original artwork and project data are
never modified by the reflection effect.

The final `build-boutique-corner-cap.cjs` pass completes both blue cap elbows
and their continuous inner/outer neon trim. Its cropped generated source has
an explicit native placement; only the narrow reviewed cap mask is copied.
The surrounding floor, fixtures and collision remain as reviewed.

The final Hall/loungeroof passes follow the later orthogonal-cap guides. The
Hall's upper portrait wall becomes black exterior space, and a continuous blue
cap replaces its left lantern; the refreshed-scene lantern effect is disabled
for that removed fixture. The gold display, right lantern and Piano Lab stay
in place. The lounge cap now runs straight into both corners, with its exterior
face extended downward; the club cap beneath it is level. Only newly covered
lounge masonry receives collision blocks, leaving the exit corridor open.
Both passes use explicit crop placements and protected regions to retain the
other accepted artwork and repairs.

The later northwest inner-wall pass makes the dance-room face south, with its
inner cap aligned to the long DJ wall and glass below the removed diagonal.
The left couch and other props remain independent, while the two lamp bodies
and painted dance tiles are excluded from this art patch. A separate narrow
north-cap pass connects the lounge roof to the Piano Lab post and preserves
the sign faces, lamp fixtures and elevated Piano roof. Both run after the
earlier Hall/lounge cap passes so those sources cannot restore the old angles.
The wide generated north source has an explicit content crop to discard its
white margins before native placement. A reviewed copy of its own blue cap
course fills the small left connection to the existing lounge post; all copy
destinations remain inside the north-cap ownership mask.

## DJ stage lighting

The four-head rig above DJ Coda projects colored beams and soft pools of light
onto the dance floor. Beam origins follow the visible lamps when the rig is
moved, resized, rotated or flipped. The published rig uses a 280-pixel throw and
75% intensity; its existing editor controls still adjust these values. Light is
composited above the tile-color animation and below props and characters, with
matching light in the foreground-brush source. Hiding or disabling the rig,
setting its opacity/intensity to zero, or choosing FX Off removes its light.
Motion Off and reduced motion hold the colors and beam directions steady.

## Projects and compatibility

New browsers load the refreshed published project. Its object placements,
collision overrides and room projects are retained from the previous export.
Its old main-world brush strokes and pixel repairs are retired because they
refer to the previous artwork. The complete pre-refresh export, including all
793 main-world strokes and pixel repairs, is preserved in
`assets/environment/legacy-world-project.json`.

Existing local projects and imports without a `scenery` field continue to use
their original artwork and edits. No automatic migration overwrites them. To
switch an existing editor workspace, export a backup, then use **Project →
Reset project**. Undo can restore the previous project. Exported refreshed
projects retain their scenery revision through import, save and reload.

## Source art and rebuilding sprites

The approved transparent source sheets are retained in
`assets/environment/source/`. The finished empty-room PNG is retained separately.
Run from the repository root:

```sh
node scripts/build-environment-props.cjs
```

This uses the installed Chromium to slice the source sheets into separate PNGs,
keeping original RGBA pixels inside each crop. It does not regenerate the art.
`assets/environment/v1/sprite-sources.json` records the source cells and crops.
The runtime fits sprites into the existing source canvases without changing
their aspect ratios or clipping their silhouettes.

Checks:

```sh
node --test tests/environment-art.test.cjs
PYTHONDONTWRITEBYTECODE=1 python3 tests/environment-scenery-console-browser.py
PYTHONDONTWRITEBYTECODE=1 python3 tests/environment-world-browser.py
PYTHONDONTWRITEBYTECODE=1 python3 tests/published-world-browser.py
```

The last suite explicitly serves the archived export to retain the previous
world's compatibility checks. The environment suite exercises current defaults.

## South-facing furniture

The three sofas use new front-facing PNGs, while the original angled and curved
source files remain available. Logical sizes, placements and foot baselines are
preserved. The counters, DJ desk and candle table already face south and retain
their accepted artwork. All seven pieces are reusable under **Asset library →
South-facing furniture**, where each placement creates an independent copy.

`node scripts/build-south-facing-furniture.cjs` rebuilds the transparent cutouts
from `scripts/south-facing-furniture.json`; `--check` verifies the outputs and
their provenance manifest. Sofa sprites are bottom-aligned within the original
canvases. The other four designs use the same centered fit as the runtime.
This build does not modify the backdrop, project data or original sprites.


## Room finishing repairs

The finishing passes in `build-cosmic-floor.cjs` own only reviewed native-art
regions: the obsolete wall band above the dance-room inner cap and its neon
corner, deeper front exterior courses, the exposed masonry beside the Coda
sign, and continuous glass beside Hall of Fame. The removed upper dance lamp
and the removed east Piano lamp have no refreshed-scene glow emitters.

Each finishing pass declares `preserveProject: true`; the compositor rejects
any overlap with authored background pixels before writing files. The world
remains 1672×941, with furniture, collisions, and saved-project data unchanged.
The Hall floor uses an immutable sparse before-image to feather its outer
edges without accumulating changes on repeated builds. Source dimensions and
placements are recorded in the four `*-regions.json` files.

The final `build-dance-northwest-finish.cjs` pass replaces the northwest wall
face and adjoining glass lane together so their tile grids and reflections
cannot meet at the former y710 seam. Its source copies normalize the upper
neon to the width and centerline of the retained lower border. The existing
lamp, colored tile interiors, outside posts, and southwest turn are protected.
An eight-pixel feather replaces the old blue fringe along the diagonal tile
edge, blending into an immutable sparse before-image. Reflection clips follow
the repaired glass and exclude both lengths of the thick neon border.


## Uniform wall and foreground audit

The final boutique and DJ-wall passes replace inconsistent masonry with a
single grid per face. Their metadata protects the existing labels, lanterns,
plaque interiors, caps, floor and authored shirt artwork. The front-depth pass
owns complete brick faces below the caps, preventing a source boundary from
cutting diagonally through a course. Other north, Lounge, Piano and Hall faces
were checked and retain their accepted artwork.

`foreground-floor-compat.js` recognizes eleven exact historical wall-selection
shapes used by twelve saved paint actions. It removes their floor coverage at
render time so those pixels cannot obscure actors or floor effects. The raw
project, history and selections stay unchanged; new custom floor painting
remains available. The southwest structural cutout also excludes real floor
while retaining its neon border. Furniture and cabinet transparency was
checked independently; no floor patches were found in their cutouts.
