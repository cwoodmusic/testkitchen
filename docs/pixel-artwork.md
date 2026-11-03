# Pixel artwork tools

Open **Developer mode → Pixel artwork** to paint backgrounds and assets.
Character sprite details use the same selection and color-picking workflow.

The full-screen editor keeps its controls in a compact, scrolling sidebar.
Use **Hide controls** to give the canvas the full width, then **Show controls**
to bring them back. The image stays at the same zoom and position while the
controls change. On phones in portrait orientation, controls start hidden and
open as a drawer over the canvas. **Exit pixel editor** stays on the top bar.
Long instructions are available under **Help** in the controls.

For a background, **Show assets** displays placed objects as a guide. Turn it
off to see the background by itself. This switch affects the editor view;
painting, color sampling, copying, and PNG export use the background pixels.

The **Eyedropper** samples once and returns to the tool you were using.
The **I** shortcut selects it. **Alt-click** samples without changing tools.

To use **Stamp**:

1. Use **Select** to draw a rectangle around the pixels to copy.
2. Choose **Stamp**, then **Ctrl-click** (**Command-click** on Mac) to capture
   that selection.
3. Adjust **Stamp width** and **Stamp height** for the copies you want to place.
4. Use **Clear selection** to place copies outside the captured source area.
5. Click to stamp. Keep clicking to place more copies of the captured pixels.

On touch screens, use **Capture selection** instead of Ctrl-click.

The stamp keeps its captured source until you capture another selection or
clear it with Escape. Resizing preserves sharp pixel edges and transparency.
Each placement can be undone separately.

## Smooth gradients

Choose **Smooth gradients** in the Tool menu, or press **U** over the artwork
canvas. Drag over a harsh color transition to blend neighboring colors with a
soft, round brush. **Brush radius** uses source-image pixels; **Strength %**
controls how much each stroke blends. The selected paint color is not used.
Transparency is preserved. Each complete stroke is one artwork Undo step;
Escape cancels a stroke before applying it.

## Mask everything outside a selection

Draw a rectangle, or finish a **Manual shape**, to make its inside the editable
area. Everything outside is dimmed and protected automatically. Pencil, lines,
eraser, restore, fill, smoothing, paste, and stamps stay inside the exact shape.
The selection remains active when you switch tools.

Use **Clear selection** to remove the outside mask and edit the whole image.
Escape also clears a selection after cancelling any active stroke or paste.
The mask is temporary and does not change artwork, PNG exports, or project saves.
**Show protection mask** controls the separately painted protection overlay;
the active selection's outside mask stays visible.

After copying pixels, use **Clear selection** before pasting them elsewhere.
You can also select a new destination shape to keep the paste inside that area.

## Protect details with a mask

Choose **Mask protected areas** and paint over details you want to keep sharp.
The magenta overlay marks protected pixels. Switch to **Smooth gradients** to
blend the surrounding unprotected artwork. **Unmask areas** removes protection,
**Undo mask** reverses a mask edit, and **Clear protection mask** removes it all.
Use **Show protection mask** to show or hide the overlay.

A protection mask is an editing guide for the current artwork. It survives
artwork Undo/Redo and changing tools, but selecting another artwork clears it.
The overlay is not part of PNG exports or saved world-project pixels.

## Select a specific shape

1. Choose **Select**, then set **Selection shape → Manual shape**.
2. Click or tap points around the desired outline.
3. Choose **Finish selection**, press Enter, or double-click to close the shape.
4. Paint, fill, paste, or smooth inside the finished shape; its outside is masked.

**Rectangle** remains available for drag selections. Copied manual shapes keep
their outline when pasted or resized as stamps; transparent pixels inside the
shape still replace their destination. Pixels outside the shape are untouched.

For a precise protection mask, finish a manual selection and choose **Protect
selection**, then **Clear selection** to smooth around the protected shape.
Use **Clear selection** or Escape to remove an active selection. Escape while
drawing an unfinished outline cancels that draft.
