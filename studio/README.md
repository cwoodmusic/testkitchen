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
Interiors start as an empty gray room with separate **Floor** and **Walls**
layers. Uncheck **Start with floor and walls** for a transparent canvas. The
first visit opens this empty room; existing browser projects restore as before.

Use pencil, eraser, fill, line, rectangle, ellipse, rectangular or polygon
selection, Smart Select, move, stamp, eyedropper, collision, and hand tools. A complete drag
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

**Smart Select (W)** is a magic wand for the active paint layer. Click to select
connected matching colors, and increase **Color tolerance** to include similar
shades. Shift-click adds an area; Alt-click removes one. Paint, effects, copy,
clear pixels, asset creation, and tile fills follow the selected shape, including
holes. Select a photo's background and clear it to remove that color region;
this is color selection rather than automatic subject recognition. For an asset
placed as an object, use **Edit pixels** first. Escape clears the selection.
On large maps, first draw a bounded selection to limit the search area.

**Resize image** above the canvas offers two modes: **Resize canvas** keeps
artwork at its existing size, cropping or adding transparent space at the right
and bottom; **Resize image** scales all layers together with sharp nearest-pixel
resampling. Placed assets and collision scale with the image. Resizes are one
Undo step; sizes are bounded to keep that history available. Select an area with
Select, Lasso, or Smart Select and choose **Clear selected area** to erase it to
transparency on the active paint layer. Undo brings it back.

## Pixelify uploaded images

In **Assets → Pixelify image**, upload a PNG, JPEG, or WebP. **Coda arcade**
starts with a palette drawn from the bundled arcade artwork and reduces fine
photo detail. **Cozy** provides a softer interior palette; **Original colors**
keeps the image's own colors. Compare the original and result while adjusting
detail simplification, pixel block size, palette, dithering, image fitting, and
the manual effects. Size presets include floor tiles (32×32), wallpaper
(32×64), assets, and characters. Add the result to the asset library or uncheck
that option to create an editable paint scene. Transparency stays editable.

The converter resamples and reduces image colors; it does not invent new drawn
building details. Source pixels and placement dimensions determine game scale.
The 1px setting uses native Coda pixel units; larger blocks are baked into the
result so they render consistently after export. All conversion runs locally.

## Make floors and wallpaper

Choose **Assets → Make floor / wallpaper**. Start with a wood, stone, checker,
stripe, dot, or diamond pattern, upload an image, or use the current artwork or
selected asset. Adjust tile dimensions and colors. The single-tile preview and
4×4 repeat preview show exactly how it will cover a surface. The mirror option
makes uploaded or painted artwork meet at its edges; repeating the original
keeps its existing edge design. Save the tile to your library or download its
PNG directly from the tile maker.

To decorate an interior, select a rectangular or lasso area, choose a tile in
Assets, and click **Fill area with tile → Fill area**. Without a selection it
fills the whole canvas. Tiles repeat at native source size on a new paint layer,
above earlier paint layers and beneath placed world objects. Source layers and
collision remain intact. One Undo removes the fill. Individual fills are
limited to 8 million pixels to keep Undo available; large maps can be filled
in selected areas. The layer controls still let you change depth and order.

Use **Download asset PNG** for the selected tile's native-size image. Native
projects and bundles also preserve the tile PNG, dimensions, and floor or
wallpaper tags for later game integration.

## Collision and walk testing

The collision brush paints **Block movement** or **Open path** using Coda's
10px grid. Red cells block, green cells explicitly open, and unpainted cells
are open. Native values are 0 blocked and 1 open. An object's **Block footprint**
action creates an editable blocked region beneath it. **Walk test** previews
movement and depth with an 80×96 character guide. Use WASD or arrows; Escape
returns to editing.

## Save and send work for the game

Projects autosave to this browser. **Recent projects** restores earlier named
projects. **Save**, or the **Save your work** buttons in Assets, opens four clear
choices: **Save interior**, **Save asset**, **Save flooring**, and **Save
wallpaper**. Give the file a name and choose its format:

- **Editable project** keeps every scene, layer, asset, and collision edit in a
  `.coda-studio.json` file. A different file name changes the saved copy's name.
- **PNG image** saves visible pixels. Asset, flooring, and wallpaper PNGs also
  stay in the asset library; choose the current artwork/selection or a selected
  library asset. Flooring and wallpaper receive their matching tile tags.
- **Game integration bundle** includes the editable project and image files.

Interior saves default to editable projects; other types default to PNG. Browser
storage alone is not a portable backup.

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
| Smart Select | W |
| Move / stamp / eyedropper / collision / hand | V / S / I / C / H |
| Temporary pan | Space + drag |
| Copy / cut / paste / select all | Ctrl or Command + C / X / V / A |
| Undo / redo | Ctrl or Command + Z / Shift+Z; Ctrl+Y |
| Save your work | Ctrl or Command + S |
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
