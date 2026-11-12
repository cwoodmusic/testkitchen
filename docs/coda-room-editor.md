# Coda Town Room Editor

Open [Town Builder](https://cwoodmusic.github.io/testkitchen/town/builder/) and choose **Room editor** in the top bar. The **Room theme** dropdown contains all 31 interiors: twelve showrooms, eighteen neighbors’ homes and your apartment. Each theme keeps its own furniture layout. Walls, doors and room sizes stay fixed.

[Editor preview](town-preview/room-editor.webp?v=opera-shells-1) · [Browse the updated rooms](coda-room-gallery.html?v=opera-shells-1)

Click a piece in the room to pick it up, move the pointer, then click again to place it. You do not need to hold the mouse button. Use the facing buttons or arrow keys while holding a piece:

| Key | Facing |
| --- | --- |
| ↑ | North |
| → | East |
| ↓ | South |
| ← | West |

The placement outline turns red when a piece cannot go there. The status message explains the problem. Keep furniture clear of walls, entrances and bedroom/bathroom doorways. Decorations resting on a table or cabinet travel with that support when it is moved.

Use **This theme** for the selected collection’s pieces, or **All furniture** for the full catalogue. Search by name or choose a category, then click a palette piece and click in the room to add it. This edits the design template; it does not spend Notes or change furniture ownership.

| Control | Action |
| --- | --- |
| Esc | Cancel the piece you are holding; keep its previous placement. |
| Delete / Backspace | Remove the picked-up piece. For a new palette piece, cancel placement. |
| Undo / Ctrl+Z / Cmd+Z | Undo a completed edit. |
| Redo / Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y / Cmd+Y | Redo an edit. |
| Pan view | Drag with the mouse or one finger to move around without picking up furniture. Choose Arrange to move furniture again. |
| Right-drag, or Space + drag | Pan around the room. |
| − / + | Zoom out or in. The percentage shows the current zoom. |
| Mouse wheel | Zoom at the pointer. |
| Fit room | Show the whole interior. |
| Reset theme | Restore the original furniture layout for this theme. Undo can bring your edited layout back during the current session. |
| Back to town | Return to the town canvas. |

Completed edits autosave in this browser; look for **Saved** beneath the controls. Switching themes or returning to town cancels an unfinished pickup. Undo history lasts for the current page session.

If browser saving fails, the error stays visible when you return to that theme. **Export layouts ↓** includes your completed changes so you can keep a file copy. An unfinished pickup is excluded.

Saved templates appear in **Walk test** and **Play this town** in the same browser and on the same site. They apply to the selected interior theme wherever that room appears. Purchased décor placed through **Furnish apartment** remains separate.

The family-room furniture adds a long dining table, broad low coffee table, large area rug and statement plant for every theme. New default layouts include six dining chairs, fuller conversation areas and bedroom reading nooks. Previously saved layouts keep their existing furniture positions and removals; extra default pieces are added only where they fit safely.

Your apartment keeps its personal furnishing areas clear for purchased décor. Place built-in furniture outside those areas; the placement message shows when a spot is reserved.

Choose **Export layouts ↓** to download `coda-room-layouts.json`, containing all saved room templates. Place or cancel the held piece first; its preview is not exported. Use **Import layouts…** to load that file in another browser. Imported themes replace their saved layouts; themes absent from the file keep their current layouts. Incompatible layouts display an error without replacing the saved designs.

Room layouts have their own export/import controls. **Save project** backs up the town map JSON; it does not include room templates. To move both to another browser, export the town project and the room layouts, then load each through its own controls.
