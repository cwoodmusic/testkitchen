# Courtyard walking performance

Large areas of plain cobblestone rebuilt their paving texture and grass edge mask every frame. Painted blends already reused their finished pixels, so the new courtyard floors added disproportionate rendering work during Walk test.

Ordinary opaque cobblestone now caches its finished 64-pixel tiles. The cache responds to neighboring material, stair and bridge edits, paving donor changes, property transforms and elevation, and project replacement. It shares the existing 4,096-tile limit. Curved layers, filtered drawing and translucent drawing retain their original compositing.

The map files, collision, artwork, lighting and movement settings are unchanged. Existing saved maps use the improvement after reloading the builder or game.

## Verification

- `python tests/town-paving-cache-browser.py`: 31 exact pixel comparisons and checks for editing, donor movement, undo/reload, blended painting and the cache limit.
- Related Node suite: 197 tests pass.
- Actual Walk test with night and ten NPCs, at a 1500 × 1000 browser viewport using the existing native pixel grid:

| Area | Before | After |
| --- | ---: | ---: |
| Market | 44.1 FPS | 56.8 FPS |
| Gazebo | 52.0 FPS | 55.6 FPS |
| Street | 60.7 FPS | 60.7 FPS |

Market ground rendering fell from about 9.34 to 2.98 milliseconds per frame. A separate 12,000-draw paving check fell from 422.8 to 58.1 milliseconds. These are measurements from Chromium in the development environment, with identical display and quality settings before and after.
