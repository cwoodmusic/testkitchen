import test from 'node:test';
import assert from 'node:assert/strict';
import { TILE_SIZE, createProject, createStore, packColor, unpackColor, validateProject } from '../model.js';

const RED = packColor('#ef4255ff'), BLUE = packColor('#267fe0ff');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
function fixture(options = {}) {
  const store = createStore(createProject(options));
  const { activeSceneId: scene, activeLayerId: layer } = store.getState();
  return { store, scene, layer };
}
function addAsset(store) { return store.addAsset({ name: 'Sample', width: 1, height: 1, dataURL: PNG, collision: [{ x: 0, y: 0, w: 1, h: 1 }] }); }

test('truthful Coda dimensions, anchor, facings and color words', () => {
  assert.equal(TILE_SIZE, 64);
  assert.equal(packColor('#1234'), 0x11223344);
  assert.equal(unpackColor(0xaabbccdd), '#aabbccdd');
  assert.throws(() => packColor('rgb(1,2,3)'), /hexadecimal/);
  const map = createProject().scenes[0];
  assert.deepEqual([map.width, map.height, map.collision.cellSize], [1672, 941, 10]);
  const character = createProject({ preset: 'customization', fourFacings: true });
  assert.equal(character.scenes.length, 4);
  assert.deepEqual(character.scenes.map(scene => scene.facing), ['down', 'left', 'up', 'right']);
  for (const scene of character.scenes) { assert.deepEqual([scene.width, scene.height], [80, 96]); assert.deepEqual(scene.anchor, { x: 40, y: 80 }); }
  assert.throws(() => createProject({ width: 8193 }), /Scene width/);
});

test('a stroke previews immediately, commits once, cancels and restores saved state', () => {
  const { store, scene, layer } = fixture();
  const notifications = [];
  const unsubscribe = store.subscribe(state => notifications.push({ inTransaction: state.inTransaction, revision: state.revision }));
  store.begin('Stroke');
  store.writePixels(scene, layer, [[1, 1, RED], [65, 2, RED]]);
  store.writePixels(scene, layer, [[2, 1, BLUE]]);
  assert.equal(store.readPixel(scene, layer, 2, 1), BLUE);
  assert.equal(store.getState().canUndo, false);
  assert.equal(store.getState().inTransaction, true);
  store.commit();
  assert.equal(store.getState().canUndo, true);
  assert.equal(store.getState().inTransaction, false);
  assert.ok(store.getState().historyBytes < 40000);
  assert.equal(store.getState().rasterBytes, 32768);
  store.markSaved();
  assert.equal(store.getState().dirty, false);
  store.undo();
  assert.equal(store.readPixel(scene, layer, 1, 1), 0);
  assert.equal(store.getState().rasterBytes, 0);
  assert.equal(store.getState().dirty, true);
  store.redo();
  assert.equal(store.readPixel(scene, layer, 1, 1), RED);
  assert.equal(store.getState().dirty, false);
  store.begin('Cancelled stroke');
  store.writePixels(scene, layer, [[1, 1, BLUE], [130, 1, RED]]);
  store.cancel();
  assert.equal(store.readPixel(scene, layer, 1, 1), RED);
  assert.equal(store.readPixel(scene, layer, 130, 1), 0);
  assert.ok(notifications.some(item => item.inTransaction));
  assert.ok(notifications.every((item, index) => index === 0 || item.revision > notifications[index - 1].revision));
  unsubscribe();
});

test('large canvases and solid fills stay sparse; erasing a base is explicit and undoable', () => {
  const { store, scene, layer } = fixture({ preset: 'village' });
  assert.deepEqual([store.getProject().scenes[0].width, store.getProject().scenes[0].height], [6800, 5100]);
  assert.equal(store.getState().rasterBytes, 0);
  store.fillLayer(scene, layer, RED);
  assert.equal(store.getState().rasterBytes, 0);
  assert.equal(store.readTile(scene, layer, 0, 0), null);
  assert.equal(store.readPixel(scene, layer, 6799, 5099), RED);
  store.writePixels(scene, layer, [[6799, 5099, 0]]);
  assert.equal(store.getState().rasterBytes, 16384);
  assert.equal(store.readPixel(scene, layer, 6799, 5099), 0);
  assert.equal(store.readPixel(scene, layer, 6798, 5099), RED);
  const encoded = store.serialize();
  assert.equal(encoded.scenes[0].layers[0].baseColor, RED);
  assert.ok(Object.values(encoded.scenes[0].layers[0].tiles).flat().some(run => run[2] === 0));
  const copy = createStore(encoded);
  assert.equal(copy.readPixel(scene, layer, 6799, 5099), 0);
  store.undo();
  assert.equal(store.getState().rasterBytes, 0);
  store.undo();
  assert.equal(store.readPixel(scene, layer, 6799, 5099), 0);
  const huge = fixture({ width: 8192, height: 8192 });
  huge.store.fillRect(huge.scene, huge.layer, { x: 0, y: 0, w: 8192, h: 8192 }, BLUE);
  assert.equal(huge.store.getState().rasterBytes, 0);
});

test('RLE is detached, preserves alpha and accepts runtime tiles without sharing', () => {
  const { store, scene, layer } = fixture({ width: 128, height: 80 });
  store.fillLayer(scene, layer, packColor('#34567880'));
  store.fillRect(scene, layer, { x: 62, y: 62, w: 5, h: 5 }, RED);
  store.writePixels(scene, layer, [[63, 63, 0], [1, 2, 0x01020304]]);
  const native = store.serialize(), copy = createStore(native);
  assert.deepEqual(copy.serialize(), native);
  for (const [x, y] of [[0, 0], [62, 62], [63, 63], [66, 66], [1, 2], [127, 79]]) assert.equal(copy.readPixel(scene, layer, x, y), store.readPixel(scene, layer, x, y));
  native.scenes[0].layers[0].tiles['0,0'][0][2] = BLUE;
  assert.notEqual(store.readPixel(scene, layer, 1, 2), BLUE);
  const fromRuntime = createStore(store.getProject());
  fromRuntime.writePixels(scene, layer, [[1, 2, BLUE]]);
  assert.equal(store.readPixel(scene, layer, 1, 2), 0x01020304);
  assert.equal(validateProject(store.getProject()).scenes[0].layers[0].tiles['0,0'] instanceof Uint32Array, false);
});

test('invalid imports fail atomically and preserve current document and history', () => {
  const { store, scene, layer } = fixture();
  store.writePixels(scene, layer, [[2, 3, RED]]);
  const before = store.serialize(), state = store.getState();
  const malformed = [
    { ...before, version: 2 },
    { ...before, activeSceneId: 'missing' },
    { ...before, scenes: [{ ...before.scenes[0], width: 99999 }] },
    { ...before, scenes: [{ ...before.scenes[0], layers: [{ ...before.scenes[0].layers[0], tiles: { '0,0': [[0, 4097, RED]] } }] }] },
    { ...before, scenes: [{ ...before.scenes[0], layers: [{ ...before.scenes[0].layers[0], tiles: { '0,0': [[2, 4, RED], [3, 2, BLUE]] } }] }] },
    { ...before, scenes: [{ ...before.scenes[0], collision: { cellSize: 10, cells: { '900,900': 1 } } }] },
    { ...before, assets: [{ id: 'evil', name: 'Bad image', width: 1, height: 1, dataURL: 'javascript:alert(1)' }] },
  ];
  for (const document of malformed) {
    assert.throws(() => store.replace(document));
    assert.deepEqual(store.serialize(), before);
    assert.equal(store.getState().historyBytes, state.historyBytes);
    assert.equal(store.getState().revision, state.revision);
  }
  store.undo();
  assert.equal(store.readPixel(scene, layer, 2, 3), 0);
});

test('locked layers guard raster, objects, removal and reorder while unlocking remains possible', () => {
  const { store, scene, layer } = fixture();
  const asset = addAsset(store), objects = store.addLayer(scene, { name: 'Props', type: 'objects' });
  const placed = store.addObject(scene, objects, { assetId: asset, x: 10, y: 20 });
  store.updateLayer(scene, layer, { locked: true });
  for (const edit of [() => store.writePixels(scene, layer, [[1, 1, RED]]), () => store.fillLayer(scene, layer, RED), () => store.removeLayer(scene, layer), () => store.moveLayer(scene, layer, 1), () => store.updateLayer(scene, layer, { opacity: .5 })]) assert.throws(edit, /locked/);
  store.updateLayer(scene, objects, { locked: true });
  for (const edit of [() => store.addObject(scene, objects, { assetId: asset }), () => store.updateObject(scene, objects, placed, { x: 20 }), () => store.removeObject(scene, objects, placed), () => store.removeAsset(asset)]) assert.throws(edit, /locked/);
  store.updateLayer(scene, layer, { locked: false });
  store.writePixels(scene, layer, [[1, 1, RED]]);
  assert.equal(store.readPixel(scene, layer, 1, 1), RED);
});

test('scene/layer/asset/object CRUD composes through undo and redo', () => {
  const { store, scene, layer } = fixture();
  const asset = addAsset(store), objects = store.addLayer(scene, { name: 'Objects', type: 'objects' });
  const placed = store.addObject(scene, objects, { assetId: asset, x: 5, y: 6, depthOffset: 2 });
  store.begin('Move and transform');
  store.updateObject(scene, objects, placed, { x: 50, rotation: 90, flipX: true, w: 4, h: 8 });
  store.updateLayer(scene, objects, { opacity: .7, blend: 'multiply', role: 'foreground' });
  store.commit();
  const transformed = store.serialize();
  store.undo();
  assert.equal(store.getProject().scenes[0].layers[1].objects[0].x, 5);
  assert.equal(store.getProject().scenes[0].layers[1].opacity, 1);
  store.redo();
  assert.deepEqual(store.serialize(), transformed);
  store.moveLayer(scene, objects, 0);
  assert.equal(store.getProject().scenes[0].layers[0].id, objects);
  store.undo();
  assert.equal(store.getProject().scenes[0].layers[0].id, layer);
  const interior = store.addScene({ kind: 'interior', name: 'Room' });
  assert.equal(store.getState().activeSceneId, interior);
  store.updateScene(interior, { name: 'Studio room' });
  assert.equal(store.getProject().scenes[1].name, 'Studio room');
  store.removeScene(interior);
  assert.equal(store.getState().activeSceneId, scene);
  store.undo();
  assert.equal(store.getProject().scenes[1].name, 'Studio room');
  store.removeAsset(asset);
  assert.equal(store.getProject().scenes[0].layers[1].objects.length, 0);
  assert.equal(store.getProject().assets.length, 0);
  store.undo();
  assert.equal(store.getProject().scenes[0].layers[1].objects[0].id, placed);
  assert.equal(store.getProject().assets[0].id, asset);
  const duplicateAsset = store.addAsset({ ...store.getProject().assets[0], id: undefined });
  assert.notEqual(duplicateAsset, asset);
  const duplicateObject = store.addObject(scene, objects, { ...store.getProject().scenes[0].layers[1].objects[0], id: undefined });
  assert.notEqual(duplicateObject, placed);
  validateProject(store.serialize());
});

test('collision overrides are bounded, transactional, nullable and round-trip with scenes', () => {
  const { store, scene } = fixture({ width: 21, height: 19 });
  store.begin('Collision');
  store.setCollision(scene, [[0, 0, 1], [2, 1, 1]]);
  store.setCollision(scene, [[1, 0, 0]]);
  store.commit();
  assert.deepEqual(store.getProject().scenes[0].collision.cells, { '0,0': 1, '2,1': 1, '1,0': 0 });
  const before = store.serialize();
  assert.throws(() => store.setCollision(scene, [[0, 1, 1], [3, 0, 1]]), /Collision column/);
  assert.deepEqual(store.serialize(), before);
  store.setCollision(scene, [[0, 0, null]]);
  assert.equal(Object.hasOwn(store.getProject().scenes[0].collision.cells, '0,0'), false);
  store.undo();
  assert.equal(store.getProject().scenes[0].collision.cells['0,0'], 1);
  store.undo();
  assert.deepEqual(store.getProject().scenes[0].collision.cells, {});
  store.redo();
  assert.deepEqual(store.serialize(), before);
});

test('failed pixel input cancels its automatic edit and untouched tiles keep their identity', () => {
  const { store, scene, layer } = fixture({ width: 256, height: 128 });
  store.writePixels(scene, layer, [[1, 1, RED], [200, 1, BLUE]]);
  const untouched = store.readTile(scene, layer, 3, 0), before = store.serialize();
  store.writePixels(scene, layer, [[2, 1, BLUE]]);
  assert.equal(store.readTile(scene, layer, 3, 0), untouched);
  store.undo();
  assert.deepEqual(store.serialize(), before);
  assert.throws(() => store.writePixels(scene, layer, [[1, 1, BLUE], [3, 3, -1]]), /Color/);
  assert.deepEqual(store.serialize(), before);
  assert.equal(store.getState().inTransaction, false);
});

test('patch history remains under 64 MiB and a new branch drops redo', () => {
  const { store, scene, layer } = fixture({ width: 64, height: 64 });
  for (let index = 1; index <= 2100; index++) store.writePixels(scene, layer, [[0, 0, (index * 256 + 255) >>> 0]]);
  assert.ok(store.getState().historyBytes <= 64 * 1024 * 1024);
  assert.equal(store.getState().rasterBytes, 16384);
  let undos = 0;
  while (store.undo()) undos++;
  assert.ok(undos > 1000 && undos < 2100, `Expected old patches to be evicted, got ${undos} undo entries.`);
  assert.ok(store.getState().historyBytes <= 64 * 1024 * 1024);
  assert.notEqual(store.readPixel(scene, layer, 0, 0), 0);
  assert.equal(store.getState().canRedo, true);
  store.writePixels(scene, layer, [[1, 0, BLUE]]);
  assert.equal(store.getState().canRedo, false);
  assert.ok(store.getState().historyBytes < 40000);
});
