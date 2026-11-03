# Connected-world developer console

The editor lives in `world-preview.html`. The original `index.html` arcade and Song Machine are separate pages. Serve the repository with a static web server, for example:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `world-preview.html` from that server in your browser. Use the **Developer** button, **F2**, or **Shift+A** to open the editor. It edits scene data through controls; it does not evaluate JavaScript or require browser developer tools.

**C** opens Collision from gameplay or switches to it from another editor tab or playtest. **Shift+L** opens Layers the same way. These shortcuts leave text entry and browser modifier shortcuts alone. Opening the editor ends an active NPC conversation so map painting can receive pointer input. Fullscreen includes the map and its editor controls. On portrait phones, the console appears below the map; scroll between the tools and the canvas to paint without the panel covering the artwork.

For the live musician cast, conversations, and avatar customization, see [MUSICIANS.md](MUSICIANS.md). NPC routes use the same editable collision map and follow moved cabinet approach points.

## Piano Lab and fishing cave

Each room has its own **Developer** button. **F2** opens or closes the console for the room you are currently in. Room editors keep their own camera and selection; opening Layers or switching tools retains the zoom and pan. The arcade layout remains separate from room edits.

- **Objects:** move Chopin or Captain Cadence, lift a rectangular region of existing room art, or add an image. Move and resize artwork with its handles or numeric fields, choose its background/actor-depth/foreground layer, and adjust the clean source sample used to cover its original position.
- **Fish:** in the cave’s Objects tab, click a fish shadow or choose a numbered fish from the character/fish list. Change its species, position, size, body/accent colors, or visibility. Drag its gold corner to resize. Editing freezes swimming. Species labels show meter requirements; a placed fish appears in gameplay only in its allowed meter, while switching meters preserves its authored placement and colors. The edited species is the one used by its fishing challenge; changing appearance does not grant catches or rewards. Restore returns a fish to its defaults.
- **Collision:** paint red blocking cells, green open cells, or restore original cells. Piano walking and cave walking/boating use these edits during playtest and after closing the console. The cave retains the distinction between shore and boat water.
- **Layers:** select a rectangle or manual shape and fill its foreground/background coverage, paint individual strokes, and inspect the mask. Artwork layers and collision are separate controls.
- **Sprites:** edit your avatar or the room’s musician pixel by pixel. These details use the shared character sprite journal, so avatar changes follow you between rooms and complete world exports include them.
- **Project:** save, export/import the room, reset its edits, undo/redo, and playtest. The arcade’s complete world export also includes edited rooms and their fish. Older world files without room data preserve existing local room edits.

Fishing edits are available on shore or while exploring the lake. Finish or cancel an active fishing round first. Editing pauses room movement and releases held sound/input; playtest resumes it. Room saves remain browser-local, so export a backup before clearing browser data.

## Objects

Choose a named object from **Existing world objects**, then click **Edit existing object**. You can also click its visible pixels on the map. **Lift a region** lets you select artwork outside the named catalog.

The list starts with **Disco balls** (Arcade and Dance floor) and **Arcade cabinets** (Pitch Race, Music Triad, Rhythm Room, and Song Machine). Moving or resizing a disco ball carries its animated sphere and projected rays; its spin speed and rays checkbox appear in the artwork controls. Hiding a ball hides its live effects. The global FX control still sets the overall effect quality.

Cabinet play prompts, NPC approach points, animated screens, and collision footprints follow the edited cabinet. Hiding an original cabinet removes its prompt; **Restore original** restores its original location and interaction. Duplicates are decorative copies and do not create additional game portals.

- Drag an object to move it. Drag its gold corner to resize or its round handle to rotate. Numeric fields provide precise position, size, rotation, and opacity.
- Use **Lock aspect** to preserve proportions, **Lock** to prevent canvas dragging, and **Visible** to hide artwork. Arrows nudge the selected object; Shift increases the nudge distance. Shift-drag bypasses the snap grid.
- **Add image(s)** uploads artwork. **Replace image** changes a selected object's appearance while retaining placement. **Duplicate** creates an independent copy.
- Choose **Background / behind actors**, **Actor depth / Y-sort**, or **Foreground / above actors** to control draw order. Actor-depth objects sort relative to the player's feet.
- **Restore original** removes an original object's edits and reveals its published artwork again. Deleting an edited original hides it while retaining its source cleanup; deleting a newly placed object removes it.

The room art is a flattened PNG: the original pixels beneath furniture and plants are unavailable. Moving or hiding an existing object covers its old silhouette with a tiled floor clone. Adjust **Floor sample X/Y**, or use **Pick floor sample on map**, to choose a clean patch matching that part of the room. This is an editable cleanup patch, not automatic recovery of hidden artwork. A lifted rectangular region includes all pixels inside that rectangle.

The room now uses a cleaned background and foreground atlas with all 33 painted people removed. Reconstructed cabinet fronts no longer have customer-shaped holes. The live player and NPC sprites remain separate and active. Existing painted light rays and halos outside a disco ball’s silhouette are still part of the room art; the movable live effects are separate. Previously embedded custom image copies are preserved as user artwork.

## Collision

Open the **Collision** tab, or press **C** from gameplay. Drag to paint **Block walking**, **Allow walking**, or **Restore original** with a 1, 3, or 5-cell brush. Cells are 10 world pixels across. Green cells allow walking; red cells block it. Outlined cells contain explicit overrides. These changes affect player movement and NPC pathfinding, including the original architectural walls.

The displayed cell grid is the shared authority for walking and pathfinding. Original room geometry generates its initial values; additional invisible geometry checks do not override the cells during play. Select **Playtest** after painting to walk the edited map, or close the console with **F2**. Editing mode pauses character movement.

Route smoothing checks every crossed collision cell and prevents shortcuts through blocked corners. This keeps NPCs from receiving a route that appears clear at widely spaced sample points but catches their walking position on a red-cell corner.

Object art and collision are separate. For an edited original, **Open collision at original position** releases its old rectangular source area. Enable **Solid collision footprint** to add a footprint that follows the object's position, size, and rotation; its left/top/width/height fields use percentages of the object's dimensions. Explicit collision paint takes priority over object footprints and released source areas. Restore removes painted overrides and returns those cells to the original map.

## Decor library and DJ floodlights

Open **Objects → Asset library** to browse 91 assets: 16 floor pieces, 22 tabletop pieces, 19 wall decorations, 11 rugs, and 23 furniture pieces. Search or filter, choose a preview, then **Add to layout**. Browsing does not place anything. Each added item is a separate image asset with its source PNG embedded, so it supports moving, resizing, rotation, duplication, pixel editing, image replacement, ordering, background-mask overrides, undo, and project export/import. New items appear in the centre of the editor camera. Rugs use the Background layer so characters and furniture remain above them. Set a solid footprint if a floor decoration should block walking.

The published layout places a large **Notes shop arcade rug** in front of the Notes counter and a four-head **DJ color-changing floodlights** rig above the DJ. Other rug designs remain in the library. For an existing saved layout, **Asset library → Place Notes shop rug** places the rectangle in front of the current counter without resetting your edits. Existing saved layouts remain intact; **Asset library → Add DJ floodlights** places a rig above the current DJ console without resetting your project. Select the rig to adjust **Lights enabled**, **Color cycle speed**, **Brightness %**, and **Beam length (px)**. Moving, resizing, rotation, opacity, and visibility apply to the light emitters too. Duplicate a rig to add more, or delete it like any other asset. Color transitions are smooth; reduced motion uses steady colors and FX Off hides live lights.

## Moving NPC sprites and arranging assets

In the main arcade’s **Objects** tab, **NPC sprites → Select NPC** lists **The Scholar**, **Riff · Notes Shop**, and **Pip · Avatar Boutique**. Select one here or click their sprite on the map, then drag or edit NPC X/Y. They stay independent when their couch or counter moves or is hidden. Their conversation/shop interaction points move with them. Set facing, visibility, NPC layer, and depth offset individually; **Edit NPC sprite pixels** opens that character in the Pixel editor. **Reset NPC position** returns only their position to its default. These edits support undo, saving, and complete project export/import.

**Flip horizontal** and **Flip vertical** mirror a selected asset. **Rotate left 90°** and **Rotate right 90°** provide quick quarter turns; the existing **Rotation °** field and gold rotation handle allow other angles. The source PNG stays intact. Flips, rotation, masks, local collision footprints, linked cabinet approach points, and attached lights follow the same transform, with undo and save/export support. Room asset controls offer the same flip and rotation actions.

For a selected prop or uploaded image, **Depth layer** chooses Background, Actor depth, or Foreground. **Asset order → Arrange relative to** lists other placed assets and the three NPCs; choose a target, then **Place behind** or **Place in front**. The prop stays at its physical position. **Depth offset (px)** adjusts its sorting boundary; higher values place it in front. **Bring forward** and **Send back** are shared controls near the top of Objects. They act on the selected prop or NPC, whether selected on the map or from a list, and keep its position fixed. They cross other items in the current layer and move between Background, Actor depth, and Foreground at layer boundaries. NPCs and props can be interleaved within Background and Foreground. Undo restores each step, and saving/exporting keeps the order.

## Foreground and background masks

Open **Layers**, or press **Shift+L**. **Paint foreground** promotes pixels from the existing room artwork to an occluding layer. **Send to background / erase mask** removes foreground coverage while retaining the room art beneath actors. Adjust brush size and depth offset. **Stroke shape → Line** makes a straight stroke: drag from its first pixel to its last, then release to commit one undoable edit. The brush preview covers exactly the quantized pixels that will change at the current zoom. **Show foreground masks** helps inspect coverage. Use object layer controls when changing the depth of a moved or newly added object.

**Select area** enables selection instead of brush painting. Choose **Rectangle** and drag, or choose **Manual shape** and click its corners, then double-click the last corner, choose **Finish selection**, or press Enter. Choose **Paint foreground** or **Send to background**, then **Fill selection** to apply that layer to the entire selected shape. Each fill is one undoable edit and is included in saved/exported projects. **Clear selection** removes the outline; Escape cancels a draft or clears a finished selection. Toggle Select area off, or choose a Stroke shape, to return to brush painting. Right-drag, middle-drag, or hold Space and drag to pan while keeping a finished selection or the corners of an unfinished manual shape. Continue clicking corners after panning. The Piano Lab and fishing cave offer the same selection and fill controls.

Erasing foreground also works on lifted original objects and their animated screens or disco spheres: erased pixels render behind characters, while the rest retains the object's selected layer. Brush strokes stay at their world coordinates. Moving, resizing, or rotating an object recomputes its intersection with those strokes; the resulting split follows the object's animation.

**Objects → Asset order → Draw in front of background masks** lets a selected asset keep its chosen draw depth where **Send to background** masks overlap. This applies to uploaded images, lifted originals, and note props; it supports undo, save, and project export/import. Other assets continue to follow the mask. Use **Depth layer** and forward/back controls to choose the asset’s position relative to characters and other objects. The same checkbox is available in room asset controls.

Layer painting changes occlusion, not walking collision. Painting existing room pixels also does not create or redraw an object; use Objects for that.

## Fishing trapdoor

**Objects → Existing world objects → Trapdoor · Rhythm Fishing cave** selects the new floor hatch. Lift it to move, resize, rotate, hide, or animate it. Its cave-entry interaction follows the same transform as the artwork. It starts in the main open room’s southwest corner, left of the Entrance sign. The native hatch is drawn above the existing floor, so lifting or restoring it preserves the underlying floor grid and painted collision. Its placement travels with the complete project export, just like edited cabinets.

## Musician dialogue

Open **Dialogue** and choose a musician. Edit the biography, greetings, conversation button labels, and replies; add, remove, or reorder conversation choices. The preview shows your draft. **Apply dialogue** makes it active in the game. Leave the activity reply blank to keep the live description of what the musician is doing. **Revert draft** returns to the current applied dialogue; **Reset this musician to default** restores the authored lines and can be undone.

Dialogue is plain text. It cannot run scripts, change mission rewards, or change trivia answers. Applied edits travel with complete project saves and exports; older project files without dialogue load the default conversations.

## Pixel sprite details

Open **Sprites** to edit your avatar, the nine musicians, or DJ Coda. Select the character and facing direction, then zoom into the 80 × 96 pixel grid. Pencil paints pixels, Eraser makes a character pixel transparent, Pick colour samples the current appearance, Fill changes a connected colour region, and Restore returns a pixel to the JavaScript drawing. Choose **Pan canvas** to move around a zoomed grid with your finger. Each direction has separate edits. The live preview offers idle, walk, and equipped-emote animations. **Export facing as PNG** saves the current view as an image.

Pixel details follow the animated body while the JavaScript character keeps walking, jumping, and wearing boutique items. Edits are appearance details for each character and direction, rather than replacements for the animation system. Reset the direction or character to remove those details. Completed strokes share the console Undo/Redo history. Complete project saves and exports include the sprite edits; importing an older project restores the default drawings.

## Playtest, undo, and saving

**Playtest** resumes normal WASD/arrow movement and click-to-walk with editor overlays hidden. Click **Stop playtest** to resume editing. Every tab has camera controls: **−**, the zoom percentage/reset button, **+**, and **Pan**. Zoom with the wheel or +/− up to **800%** for detail work; reset with 0. Wheel zoom keeps the point under the cursor in place when map bounds allow it. Opening Layers retains the current camera. Right-drag, middle-drag, or hold Space and left-drag to pan; enable **Pan** to drag with the left mouse button or one finger. Panning does not paint or change the project history. Use the ⇄ button to dock the console on the other side when it covers artwork. The arcade returns to its 300% gameplay limit when leaving editing; room cameras retain their editing view for the next visit.

Undo and redo apply to complete project edits, including objects, collision, layer strokes, applied musician dialogue, and completed pixel strokes. Use the buttons, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, or Ctrl/Cmd+Y. Escape cancels a pending selection or closes the console.

Edits save locally in this browser and origin. The Project tab's **Save project** reports storage success or failure. **Export project JSON** backs up the whole project, including embedded uploaded images, source cleanup patches, collision overrides, local foreground strokes, dialogue, and sprite details. **Import project JSON** validates a backup before replacing the current project and can be undone. **Reset project** replaces the current layout with the shared published layout and saves that copy locally; it can also be undone. Individual object and collision **Restore original** tools still return to the underlying original artwork or collision cells.

Fresh browsers load `published-world-project.json` as the shared default. The refreshed main arcade has a complete empty-room background and independent furniture, plants and fixtures, including the large curved lounge couch. The current published export contains 59 placed assets, 2,106 collision overrides, 26 foreground layer strokes, character placements and pixel artwork, with Piano Lab and fishing edits preserved. The previous main-world pixel repairs and 793 brush strokes are archived in `assets/environment/legacy-world-project.json`. See [Environment artwork](ENVIRONMENT-ART.md) for source files and compatibility.

Valid local projects, including deliberately empty projects, take priority; legacy local asset, collision, and layer edits are also preserved. Use **Project → Reset project** to replace those local edits with the current published layout. Merely visiting the world does not save a local override, so browsers without local edits receive later published updates. Movement waits for the layout to finish loading. If the shared file fails to load or validate, existing local edits remain intact and the editor reports the failure.

Export before switching browsers, clearing site data, or moving to another server origin. Browser storage is not a shared project database. The editor does not write source files, commit changes, update Firebase rules, or publish a live site. To publish a new shared default, replace `published-world-project.json` with a validated complete project export and deploy the site. Other browser sessions can import the export directly. The original PNG files remain unchanged.

Image uploads support PNG, JPEG, WebP, GIF, and APNG up to 8 MB each and 8192 × 8192 pixels. Sprite-sheet controls provide explicit animation frames; GIF/APNG animation depends on browser support. Projects allow up to 200 placed/edited objects and 1,000 local layer strokes. Imported project files are limited to 70 MB. Browser storage quotas may be lower, so keep JSON backups.

## Verification

From the repository root:

```sh
node --test tests/collision-editor.test.cjs
node --test tests/world-object-runtime.test.cjs
python3 tests/clean-world-art.py
python3 tests/developer-console-browser.py
python3 tests/editor-camera-browser.py
python3 tests/room-developer-browser.py
python3 tests/room-editor-input-browser.py
node --test tests/room-developer-editor.test.cjs
python3 tests/dialogue-editor-browser.py
python3 tests/pixel-editor-browser.py
python3 tests/published-world-browser.py
python3 tests/artwork-selection-edit-browser.py
node --test tests/artwork-feather.test.cjs
python3 tests/artwork-feather-browser.py
python3 tests/collision-integration-browser.py
python3 tests/dance-passage-browser.py
python3 tests/world-features-browser.py
```

The collision tests exercise override restoration, atomic rejection of invalid imports, and coordinate-aware interpolated pointer strokes. The browser runner requires Python Playwright and Chromium, starts its own temporary local server, and exercises the editor through its UI in disposable browser contexts. Existing local projects are preserved.

The published-world checks cover the exact shared export, local-save priority, Reset and undo, loading and failure handling, cabinet reachability, and lifted-object erasures, including transformed masks and actual character occlusion.

The collision integration checks compare walkability with every displayed cell, test a restored cell at a former hidden wall edge, and exercise real walking and click navigation against painted walls, opening cells and reloading saves, editor shortcuts, conversations, fullscreen controls, and portrait phone map access.

The dance-passage checks pin the uploaded object, collision, and layer data outside the authorized plant removal, preserve neighboring solid walls, and exercise the production NPC movement code through the former plant footprint in both directions.

The art checks require Pillow and verify that pixels outside the 33 repair regions are unchanged and that foreground atlas coordinates and alpha masks remain stable. To rebuild art from a new image-generated empty-room plate, run `node scripts/build-clean-world.cjs /path/to/empty-room-plate.png`. The plate must be exactly 1672 × 941. This uses Chromium to align repaired areas to surrounding pixels, feather their seams, and update only the affected foreground texels. The original images and live character atlas are retained.

Learning rooms, Notes, missions, levels, the interactive dance floor, and the permanently repaired four-plant area are documented in [LEARNING-WORLD.md](LEARNING-WORLD.md). The permanent repair remains clear even in older editor projects containing the former passage-plant asset.

The main world, Piano Lab, and cave consoles have **Show collision** and **Show layers** controls above the tool tabs. Collision shows the base walking boundary as well as painted overrides. Layer overlays tint foreground masks and outline background, actor-depth, and foreground assets with a color legend. They can stay visible independently while you select objects or pan. Room Layers also offers a straight Line tool and a pixel-exact brush preview. **C** toggles the Collision tool; **L** or **Shift+L** toggles Layers. Press the same shortcut again to return to Objects. Zoom and pan stay in place. Debug overlays disappear during Playtest and after closing the editor; authored collision and layer edits continue to work.

## Feather asset edges

In **Pixel editor**, choose the asset under **Background, asset or character**,
then choose **Tool → Feather edges**. Brush across its coloured/transparent
boundary to soften the cut-out against the background. **Brush radius** controls
the area and fade width; **Strength %** controls how much each stroke blends.
Transparent pixels near the edge gain a faint matching colour while the solid
edge fades, without dark fringes. Fully opaque interior details stay sharp.
A fully cropped image also fades at its canvas boundary.

Selections restrict the brush and painted protection masks preserve details.
**Show assets** can help preview neighbouring artwork when editing a background;
choose the actual asset to blend its edges into the world underneath. Each stroke
is one Undo/Redo step; Escape cancels an unfinished stroke. Feathered alpha saves
with project JSON and Export PNG. **Smooth gradients** continues to blend colours
while preserving opacity.

## Fill and move selected pixels

In **Pixel editor**, choose **Select** and mark a rectangle or finish a manual
shape. **Fill selection** colours every pixel inside it with the selected
RGBA colour, across colour boundaries. **Fill connected colour** remains the
bucket tool for filling a connected region.

With **Select** active, drag inside the finished selection to cut and move its
pixels. The **Move selection** button also enables dragging. The vacated pixels
become transparent; overlapping moves preserve the original selected pixels,
including their transparency. Manual shapes move only their selected pixels.
The selection follows the move and stays within the image. Shift-drag starts a
new selection inside the existing one; dragging outside also selects a new area.

Release to apply a move, or press **Escape** to cancel it. Each fill or completed
move is one Undo/Redo step and saves with the complete world project. The same
tools work on backgrounds, objects, room artwork, and character artwork.

## Music facts

Open **F2 → Music facts** to read and edit all 180 facts across the 18 musicians (10 each).
Locked discoveries are visible here for authoring. Choose a musician and fact
number, or use **Search all facts** to search the entire catalog. The fact list
shows the full text; selecting one opens its editor.

Choose **Apply fact** to use edited text in this browser. **Revert draft** returns
to the applied text; **Restore default fact** removes that fact's override. Drafts
stay available when switching musicians. Linked quiz questions appear beneath
the fact, with editable questions, answer choices, and the correct answer. Use
**Apply quiz question** after reviewing those changes.

Applied facts and quiz questions use the console's Undo/Redo and save with the
complete world project. Choose **Project → Save project** and **Export project
JSON** for a portable backup or publication. Reimporting an older project without
music-history content restores the original facts and questions. Authored content
uses the optional `musicHistoryContent` project field; player discoveries,
friendship points, quiz eligibility, and reward records stay separate. An active
quiz keeps the questions and answers it had when it started.

## History progression

Open **F2 → History progression** to inspect each musician's friendship points,
ready/carried/recorded facts, active quest and quiz eligibility. This view is
read-only for a normal player. Choose **Open temporary progression test** to
use the existing isolated test player; then use the same tab to unlock a fact,
put it in the pouch, prepare a full record for a quiz, or reset that friendship.
Test progress stays in memory and is excluded from world-project exports.

## Gradient smoothing and masks

In **Pixel editor**, choose **Smooth gradients** (**U**) for a soft brush with
radius and strength controls. Paint **Mask protected areas** to preserve detail,
or use **Select → Manual shape** and **Protect selection** for a precise mask.
Clear the active selection to smooth around it. See
[the pixel artwork guide](docs/pixel-artwork.md) for masking and custom outlines.
