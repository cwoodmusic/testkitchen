# Coda Offline Pixel Studio

Open `coda-pixel-editor.html` in Chrome, Edge, Firefox, or Safari. It contains the
artwork and tools: no installation, server, sign-in, or Internet is needed.
If you downloaded the ZIP, extract it first.

- Browse/search the main arcade, room backgrounds, placed assets, full decor
  collection, original art styles, source sheets, characters, and pet companions.
- Every character has four editable directions. Every wardrobe option is
  available, including earned equipment, colors, forms, pets, and emotes.
- Use the arcade's existing pencil and eraser (1–128 pixels, round or square), fill, line,
  rectangle/ellipse shapes (outline or solid), manual polygon/freehand lasso
  selection/move, stamp,
  eyedropper, blend brush (radius and strength), feathering, and protection-mask tools. Undo/redo work
  across pixel and appearance changes. Export PNG saves the selected picture;
  character sheet export includes all four directions.
- Import PNG adds a custom canvas. New canvas starts transparent. Flip tools
  work on image assets; character direction changes use the four separate views.
- **Export edits JSON** saves all artwork and appearance changes together.
  Upload `coda-pixel-edited.json` to the assistant to apply it to the game.
  Use **Open edits** in this same studio file to continue editing later.
- Export regularly. Local drafts are convenient but depend on browser storage.

The studio starts with the current published project, including its existing
pixel edits and embedded placed objects. It includes Coda Arcade and its rooms;
separate cabinet-game repositories are outside this collection. It edits art
and character looks, not room placement, quests, or player accounts. Nothing is
published automatically. The JSON is an artwork authoring file, not a world
project import. Its stable target IDs and baseline project hash help apply only
the intended changes. Artwork made for a different source revision needs review.

Changing a character's wardrobe edits their studio preset; painting edits their
actor/direction overlay. It does not automatically redesign every instance of a
hat globally. Library images and pet artwork retain separate targets for review
and application. PNGs can also be used in other pixel art programs.

## Applying an edits file

The authoring JSON includes the original artwork/appearances, revised values,
custom PNGs, source replacements, target identities, and source fingerprints.
The assistant can compare originals to revisions before applying changes.
Character textures map back to the existing directional sprite journal; root
background/object patches, placed asset patches, and room patches retain the
game’s normal target IDs. Library/source-sheet images and pet artwork retain
their source identity; applying those or adding new presets may require asset
file or renderer changes. No layout or player progress is automatically changed.

Build from the repository with `python tools/build-art-workshop.py`. Repackage
the last captured snapshot after UI changes with
`python tools/package-art-workshop.py`. The build resolves sources through the
real game, including its hand-drawn replacements and published project edits.
