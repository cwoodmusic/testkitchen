# Town collision and layers

The collision audit found furniture and planted beds painted into Music Square without corresponding obstacles, undersized standalone bench and planter footprints, and irregular buildings sorted using the player's column even when drawing NPCs in another column.

Music Square now includes the occupied ground beneath its benches, eight planted beds, lamp bases, noticeboard and fountain. Standalone benches and planters cover their pictured seats and containers. The gazebo's posts, side planters and rear railing block walking while its center deck and stairs remain open. Apartment and furniture-store floor sizes remain unchanged; small extra plinth shapes cover their visible base edges.

NPC navigation, destination selection and walking use one derived collision view with foot clearance. Residents avoid loose flower and shrub placements saved with older default-off collision settings. The original placement flags and the player's explicit collision toggle remain unchanged. Bench seats have a separate walking approach and use the asset's ground elevation when drawing the seated resident.

Buildings sort by the physical front in each column, independently of player or camera position. Raised furniture and planting inside composite scenes return to the depth queue. Grounded foliage follows its feet, while decorative vines retain their overlay behavior. Layer separation preserves the original artwork and transparency.

Apartment transitions occur at the doorway rather than at a point far in front of the facade. Returning residents take turns approaching the entrance; visitors gather to the side and exiting residents clear the passage. Entering the building as the player removes the player's outdoor collision presence.

These are runtime metadata and rendering changes. Existing map files, uploaded backups and browser-save data are not migrated or rewritten. Reloading applies the fixes without importing another JSON file.

Verification:

- `node --test town/world/scene-collision.test.mjs town/world/actor-depth.test.mjs town/world/npc-navigation.test.mjs town/world/npc-district.test.mjs town/world/city-residents.test.mjs`
- `python tests/town-collision-layers-browser.py --map project.json --screenshots /tmp/collision-layers`

The browser regression uses independently chosen native-art collision probes, player/NPC visibility masks, artwork comparisons, actual walking paths and a city simulation. It checks benches, beds, clear entrances, building corners, doorway transitions, room round trips and movement progress. A pedestrian behind a building can be properly occluded; a clear pedestrian in front must remain visible, regardless of the player's location.
