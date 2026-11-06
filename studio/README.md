# Coda Pixel Studio

[Open the studio in your browser](https://cwoodmusic.github.io/testkitchen/studio/).
The hosted version requires no Python or installation.

A standalone browser workspace for maps, interiors, reusable pixel assets, and
character customizations. It uses local project saves and downloadable files;
it has no connection to student profiles or Firebase.

Serve the `studio/` folder with any static web server. For example, from inside
that folder:

```sh
python -m http.server 8000
```

Open `http://localhost:8000/`. No install or build step is required. When serving
the whole Test Kitchen repository instead, open `http://localhost:8000/studio/`.
Starter sprites are bundled locally, and the application does not load scripts
from the arcade, so the studio folder works on its own static host.

## Create artwork

Choose **New** for a map, interior, asset, or character preset. Coda's original
map is 1672×941 source pixels; character canvases are 80×96 with a foot anchor
at (40,80). The village preset supports 6800×5100 maps. Character projects can
start with four facing scenes. Width and height are editable during creation.

Use pencil, eraser, fill, line, rectangle, ellipse, rectangular or polygon
selection, move, stamp, eyedropper, collision, and hand tools. A complete drag
is one Undo step. Selections constrain painting and effects. Copy, cut, paste,
flips, quarter-turn rotations, and **Make asset** turn painted work into reusable
pieces. **Edit asset** opens an editable copy in a new scene.

Choose **Make asset from artwork** in Assets (or **Make asset** in Layers) to
preview the visible artwork, enter a name, and choose **Create asset**. The new
asset appears selected in the library; choose **Place asset** to reuse it.
A selection captures only that area, including a lasso's shape. Without a
selection, the whole canvas is captured. For large maps, select an area under
16 million pixels first. Transparent or oversized areas show an explanation
in the preview window and leave the project unchanged.

The layer panel provides order, visibility, locking, opacity, blend mode, and
background/world/foreground roles. Object layers keep placed assets editable:
position, size, rotation, flips, and depth offset can be changed independently.
World objects use their ground anchor for depth; foreground layers stay above
the walk-test player. Import your own PNG, JPEG, or WebP assets through Assets.

Pixel effects include brightness, contrast, saturation, hue, grayscale, invert,
posterize, palette reduction, dithering, outline, shadow, blur, and sharpen.
They edit the selected pixels, active paint layer, or a selected object's asset
copy. On very large maps, select a bounded area for pixel effects and clipboard
operations. Editing uses sparse 64px tiles, rather than full-size layer canvases.

## Photo to editable pixels

Open the photo converter, choose an image, and select a Coda size preset or
custom dimensions. Adjust pixel block size, palette count, dithering, image fit,
brightness, contrast, saturation, hue, outline, and sharpening while comparing
the original and result. The result can become a reusable asset or a new paint
scene. Transparency is retained and the result remains editable.

The converter resamples and reduces image colors; it does not invent new drawn
building details. Source pixels and placement dimensions determine game scale.
The 1px setting uses native Coda pixel units; larger blocks are baked into the
result so they render consistently after export. All conversion runs locally.

## Collision and walk testing

The collision brush paints **Block movement** or **Open path** using Coda's
10px grid. Red cells block, green cells explicitly open, and unpainted cells
are open. Native values are 0 blocked and 1 open. An object's **Block footprint**
action creates an editable blocked region beneath it. **Walk test** previews
movement and depth with an 80×96 character guide. Use WASD or arrows; Escape
returns to editing.

## Save and send work for the game

Projects autosave to this browser. **Recent projects** restores earlier named
projects. Use **Save** to download an independent `.coda-studio.json` backup;
browser storage alone is not a portable backup.

- **PNG** exports the current scene's artwork without editing guides.
- **Export bundle** creates a ZIP containing the complete editable project,
  original asset PNGs, scene and layer metadata, collision, object positions,
  ground anchors, foreground roles, scene previews, and raw layer PNG chunks.

Send the bundle or editable project to have it integrated into Coda Arcade.
The bundle records all source coordinates and collision conventions. It does
not overwrite a live game or claim automatic compatibility with a different
world or room schema. Both native project files and studio bundles reopen here.

Large PNG exports stream through small scratch canvases; layer bundle chunks
are at most 512×512. Hidden layers remain in the editable project and raw layer
exports. Layer PNGs retain source alpha: apply their opacity/blend once when
integrating them.

## Shortcuts

| Action | Shortcut |
| --- | --- |
| Pencil / eraser / fill | B / E / G |
| Line / rectangle / ellipse | L / R / U (or O) |
| Rectangle selection / polygon selection | M / Q |
| Move / stamp / eyedropper / collision / hand | V / S / I / C / H |
| Temporary pan | Space + drag |
| Copy / cut / paste / select all | Ctrl or Command + C / X / V / A |
| Undo / redo | Ctrl or Command + Z / Shift+Z; Ctrl+Y |
| Save project | Ctrl or Command + S |
| Fit / zoom in / zoom out | 0 / + / − |

Shortcuts leave text fields alone. Help in the studio also lists the tools.

## Verification

```sh
npm test
```

From the full Test Kitchen repository, browser checks are available with
`python studio/tests/studio-browser.py` (Playwright, Chromium, and Pillow).
They use disposable local projects, synthetic image fixtures, and
blocked external requests. They never contact a live classroom or database.
