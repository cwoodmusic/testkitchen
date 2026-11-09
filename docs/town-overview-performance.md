# Town Builder overview performance

Zooming out previously redrew up to 49,152 terrain cells every frame and repeatedly sampled the full-resolution building textures. On the current 120-object island map, the full-map view fell to about 2 FPS in the development browser.

At distant zoom levels the renderer now reuses a projected terrain image. Terrain edits repair the affected area; fills, project changes and paving dependencies invalidate the cache as needed. The builder supplies an edit revision so unchanged frames do not scan all terrain cells. Other callers retain value-based change detection. The first build batches plain terrain into row runs while preserving the original rendering around shores, cliffs, paint, stairs, piers and curbs.

Sea water animates behind the cached foreground. Raised lakes retain live rendering and their original depth order. Lighting, fountains, NPCs, footprints and movable objects remain live. Large static sprites reuse bounded, oversampled overview images; close views keep the original pixels. Contextual property lawn masks retain their live source images.

The overview terrain image uses about 14 MB per rendering context; the shared sprite cache has a 4-million-pixel limit. Grid changes invalidate the overview, while elevation colors and the elevation plan use their existing rendering paths.

Saved projects, terrain data, collision and map files are unchanged. Reloading the builder applies the improvement to existing projects without importing a new JSON file.

## Verification

- `python tests/town-overview-browser.py --map project.json`: 29 rendering and invalidation cases, including actual builder paint/lower tools, Undo/Redo/reload, animation, reduced motion and exact close-view terrain pixels.
- `node --test town/builder/*.test.mjs town/world/*.test.mjs town/model.test.mjs tests/urban-room.test.mjs tests/urban-interiors.test.mjs tests/furniture-store.test.cjs`: 220 tests pass.
- Overview run batching: 29 exact native-scale pixel comparisons across seven dry ground materials at four heights and transparent sea cutouts.
- Visual comparison of the uploaded island at distant day/night views and closer shore/stair views preserves shoreline shape, cliff depth, stairs, paving and building scale. Far-view resampling can differ slightly; close terrain rendering remains byte-identical.

Timing measurements use Chromium at a 1500 × 1000 browser viewport with the existing native pixel grid, night lighting and NPCs enabled. Baseline and updated code use the same uploaded map and display settings. Performance varies with hardware and project contents.

| View | Before | After |
| --- | ---: | ---: |
| Zoom 0.25 | 13.3 FPS | 61.1 FPS |
| Zoom 0.12 | 4.3 FPS | 59.2 FPS |
| Zoom 0.08 | 2.8 FPS | 60.4 FPS |
| Full map | 2.2 FPS | 60.7 FPS |
| Pan at zoom 0.08 | 2.6 FPS | 60.7 FPS |

The first overview still has a preparation cost: about 1.4–1.9 seconds to the second frame in these cold-start checks, versus 2.0–2.2 seconds before. Subsequent unchanged overview frames reuse that work; their 95th-percentile interval was about 16.8 milliseconds. Close walk-scale rendering stayed around 60 FPS. Large regions of elevated water use live terrain patches and can cost more than this map's sea-level ocean.
