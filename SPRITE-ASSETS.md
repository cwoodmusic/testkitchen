# JavaScript characters

The connected world uses the earlier JavaScript-drawn pixel characters again. `character-renderer.js` draws their bodies, faces, hair, clothes, and equipment directly on Canvas. It does not load the image-sprite manifest or generated character PNGs. Room artwork, world editing, collision, cabinet positions, and the recent lighting performance improvements remain in place.

## Appearance and customization

The plain base is bald, with a gray shirt (`#999ca6`), gray trousers (`#626875`), neutral sneakers, and no equipment. Hair, skin tone, upper/lower clothing colors, hats, glasses, accessories, shoes, and emotes remain editable in the boutique. Hats, glasses, and another accessory use separate slots.

**Plain base avatar** resets the draft to that base. **Classic cap look** is an optional equipped look. Saving applies a draft; canceling or switching targets leaves the saved appearance intact. Player appearance and progress stay in `musicArcadeV1`; musician overrides remain separate in `codaNPCOutfitsV1`. Explicit custom equipment is preserved, and earned rewards do not automatically equip themselves.

The nine musicians keep their identities, default costume cues, dialogue, navigation, and activities. Player and NPC wardrobes share the same drawing functions. Four facings, distance-based walking, gestures, sitting, and reduced-motion preferences are supported. Individual builds, face details, period hair, props and clothing silhouettes distinguish the cast beyond color. Feet remain anchored at the gameplay position; boutique portraits retain the musician identity and use a larger display scale. The expanded catalog contains 158 real drawing choices, including fantasy hats, chic eyewear, accessories, footwear and eighteen emotes.

## Keyboard movement

Move with **WASD** or the arrow keys and press **Space** for one hop. Horizontal movement continues in the air, with the usual wall collision and grounded depth order. The body and name label rise while the shadow stays on the floor. Another jump requires landing and a new press; holding Space does not repeat it. Explicit jumps still work with reduced motion enabled.

Typing, dialogs, cabinets, and editing keep their own controls. Space activates a focused toolbar button normally; a movement key returns focus to the canvas. Blur and hidden tabs clear held movement keys. Successful jumps increment the existing local jump-progress counter.

## Renderer API

`createCodaCharacterRenderer()` exposes `drawPlayer`, `drawNPC`, `normalizeProfile`, `appearanceFor`, `sampleMotion`, `labelOffset`, `catalog`, `ready`, `isReady`, `error`, and `getState`. Readiness is immediate because character art needs no downloads. QA reports `mode: javascript-characters`, `base: bald-gray`, and `sourcePolicy: javascript-drawn`. A bounded palette cache avoids repeated color calculations.

The implementation restores the procedural style from the version before image sprites, with the current independent cosmetic slots and saved-profile compatibility. The world loads it with revision `mobile-28` so returning browsers fetch the restored renderer.

## World rendering

Glowing music notes reuse cached glyphs, and broad soft lighting uses a small cached surface. Soft disco beams share that surface, while sharp floor pins and pulsing lantern glass draw at the display rate. Characters and sharp room artwork render at the display rate. Modal backdrops pause while boutique previews continue on their own clock. Full/Lite/Off FX preferences are preserved. NPCs keep facing their route during brief avoidance sidesteps rather than flashing another direction for one frame.

## Retained image assets

`assets/characters/`, the original atlas, `sprite-animation.js`, and the sprite-building scripts remain available as historical assets and tools. They are not the active character renderer. Running `scripts/build-character-sprites.cjs` only rebuilds those retained PNGs; it does not switch the game back to image characters. `tests/character-sprite-art.py` optionally validates those stored artifacts.

## Verification

```sh
node --test tests/*.test.cjs
python3 tests/clean-world-art.py
python3 tests/developer-console-browser.py
python3 tests/sprite-boutique-browser.py
python3 tests/javascript-characters-browser.py
python3 tests/player-controls-browser.py
python3 tests/world-animation-performance.py
python3 tests/world-features-browser.py
```

The checks exercise direct Canvas drawing without character-image requests, four-direction movement and emotes, the nine musicians, independent cosmetics and clothing colors, plain-base reset, saved reloads, separate NPC overrides, and editor/cabinet behavior. Rendering-work checks guard the lighting and paused-backdrop performance fixes without imposing a hardware-dependent FPS threshold.
