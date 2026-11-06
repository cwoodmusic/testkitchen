import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { createProject, createStore, packColor } from '../model.js';
import { readProject, pngFromRows, imageHeader, decodeDataURL, safeName, createAutosave, AUTOSAVE_DB, exportBundle, exportPNG, downloadProject } from '../io.js';
import { encodeZip, decodeZip, crc32 } from '../zip.js';

async function png(width, height, rgba = [255, 0, 0, 255]) {
  async function* rows() { for (let y = 0; y < height; y++) yield Uint8Array.from({ length: width * 4 }, (_, i) => rgba[i % 4]); }
  return pngFromRows(width, height, rows());
}
async function fixture() {
  const blob = await png(1, 1), bytes = new Uint8Array(await blob.arrayBuffer());
  return { blob, bytes, dataURL: `data:image/png;base64,${Buffer.from(bytes).toString('base64')}` };
}
function nativeFile(project) { return new Blob([JSON.stringify(project)], { type: 'application/json' }); }
function unpackPNG(bytes) {
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), parts = [];
  let pos = 8;
  while (pos < bytes.length) {
    const length = d.getUint32(pos), tag = new TextDecoder().decode(bytes.subarray(pos + 4, pos + 8)), payload = bytes.subarray(pos + 8, pos + 8 + length);
    assert.equal(d.getUint32(pos + 8 + length), crc32(payload, crc32(bytes.subarray(pos + 4, pos + 8))));
    if (tag === 'IDAT') parts.push(payload);
    pos += length + 12;
  }
  return inflateSync(Buffer.concat(parts));
}
test('streaming PNG encoder preserves exact RGBA and valid CRC/zlib, including fallback', async () => {
  for (const fallback of [false, true]) {
    const original = globalThis.CompressionStream;
    if (fallback) globalThis.CompressionStream = undefined;
    try {
      const blob = await png(3, 2, [21, 42, 63, 127]), bytes = new Uint8Array(await blob.arrayBuffer());
      assert.deepEqual(imageHeader(bytes), { width: 3, height: 2, type: 'image/png' });
      const data = unpackPNG(bytes);
      assert.equal(data.length, 26); assert.equal(data[0], 0); assert.equal(data[13], 0);
      assert.deepEqual([...data.subarray(1, 5)], [21, 42, 63, 127]);
    } finally { globalThis.CompressionStream = original; }
  }
  await assert.rejects(() => pngFromRows(2, 1, [new Uint8Array(4)]), /scanline/);
});
test('native JSON and ZIP imports preserve editable layers, collisions, placements and anchors', async () => {
  const image = await fixture(), store = createStore(createProject({ width: 40, height: 30, name: 'Round trip' }));
  const scene = store.getProject().scenes[0], layer = scene.layers[0];
  store.writePixels(scene.id, layer.id, [[2, 3, packColor('#abcdef80')]]);
  store.updateLayer(scene.id, layer.id, { role: 'foreground', opacity: 0.5, blend: 'multiply' });
  store.setCollision(scene.id, [[1, 1, 1], [2, 1, 0]]);
  const assetId = store.addAsset({ name: 'Dot', width: 1, height: 1, dataURL: image.dataURL, anchor: { x: 0.5, y: 1 }, collision: [{ x: 0, y: 0, w: 1, h: 1 }] });
  const objects = store.addLayer(scene.id, { name: 'Objects', type: 'objects', role: 'world' });
  store.addObject(scene.id, objects, { assetId, x: 4, y: 5, w: 3, h: 2, rotation: 45, flipX: true, depthOffset: 7 });
  const expected = store.serialize(), actual = await readProject(nativeFile(expected));
  assert.deepEqual(actual, expected);
  const bundle = new Blob([encodeZip([['project.coda-studio.json', JSON.stringify(expected)], ['manifest.json', '{}']])]);
  assert.deepEqual(await readProject(bundle), expected);
  const newStore = createStore(actual);
  assert.equal(newStore.readPixel(scene.id, layer.id, 2, 3), packColor('#abcdef80'));
});
test('invalid imports fail before replacement and leave current edits intact', async () => {
  const store = createStore(createProject({ width: 16, height: 16 })), previous = store.serialize();
  const invalid = structuredClone(previous); invalid.scenes[0].width = 999999;
  await assert.rejects(() => readProject(nativeFile(invalid)), /width/);
  await assert.rejects(() => readProject(new Blob(['{bad json'])), /valid JSON/);
  await assert.rejects(() => readProject(new Blob([encodeZip([['README.txt', 'not a project']])])), /does not contain/);
  assert.deepEqual(store.serialize(), previous);
  const image = await fixture();
  invalid.scenes[0].width = 16;
  invalid.assets = [{ id: 'bad-image', name: 'bad', width: 2, height: 1, dataURL: image.dataURL, anchor: { x: 1, y: 1 }, collision: [], tags: [] }];
  await assert.rejects(() => readProject(nativeFile(invalid)), /dimensions/);
  assert.throws(() => decodeDataURL('https://example.com/image.png'), /data URL/);
  const oversized = image.bytes.slice(); new DataView(oversized.buffer).setUint32(16, 999999);
  assert.throws(() => imageHeader(oversized), /8192/);
});
test('autosave failure remains isolated and does not mutate a project', async () => {
  assert.equal(AUTOSAVE_DB, 'CodaPixelStudioV1');
  const statuses = [], store = createStore(createProject()), before = store.serialize();
  const autosave = createAutosave({ store, onStatus: value => statuses.push(value) });
  assert.equal(await autosave.ready, false);
  assert.equal(await autosave.saveNow(), false);
  assert.deepEqual(await autosave.list(), []);
  assert.deepEqual(store.serialize(), before);
  assert.ok(statuses.some(text => text.includes('Download project JSON')));
  autosave.destroy();
});
test('bundle downloads complete native handoff with sparse bounded chunks and safe unique names', async () => {
  const downloads = [], original = globalThis.document, createURL = URL.createObjectURL, revokeURL = URL.revokeObjectURL;
  globalThis.document = { body: { append() {} }, createElement(tag) { assert.equal(tag, 'a'); return { click() {}, remove() {} }; } };
  URL.createObjectURL = blob => { downloads.push(blob); return 'blob:test'; }; URL.revokeObjectURL = () => {};
  try {
    const image = await fixture(), store = createStore(createProject({ width: 1200, height: 700, name: '../../My village' }));
    const scene = store.getProject().scenes[0], layer = scene.layers[0];
    store.writePixels(scene.id, layer.id, [[600, 600, 0xff0000ff]]);
    store.updateLayer(scene.id, layer.id, { opacity: 0.5, role: 'foreground', visible: false });
    store.setCollision(scene.id, [[0, 0, 1]]);
    store.addAsset({ name: 'Reusable', width: 1, height: 1, dataURL: image.dataURL });
    const requests = [], viewport = { async renderRegion(options) {
      requests.push(options);
      const width = Math.ceil(options.rect.w * options.scale), height = Math.ceil(options.rect.h * options.scale);
      return { width, height, toBlob(callback) { png(width, height).then(callback); } };
    } };
    const result = await exportBundle({ store, viewport }), entries = await decodeZip(downloads[0]);
    assert.ok(result.filename.startsWith('My-village-')); assert.ok(result.filename.endsWith('-integration.zip'));
    assert.deepEqual(JSON.parse(new TextDecoder().decode(entries.get('project.coda-studio.json'))), store.serialize());
    const manifest = JSON.parse(new TextDecoder().decode(entries.get('manifest.json'))), metadata = JSON.parse(new TextDecoder().decode(entries.get(manifest.scenes[0].metadata)));
    assert.equal(metadata.layers[0].role, 'foreground'); assert.equal(metadata.layers[0].visible, false); assert.equal(metadata.layers[0].opacity, 0.5);
    assert.deepEqual(metadata.collision.cells, { '0,0': 1 });
    assert.deepEqual(metadata.layers[0].chunks.map(c => [c.x, c.y, c.width, c.height]), [[512, 512, 512, 188]]);
    assert.equal(requests[0].rawLayer, true); assert.equal(requests[0].objects, false);
    assert.ok(entries.has(manifest.assets[0].path)); assert.ok(entries.has('README.txt'));
    const first = await downloadProject(store), second = await downloadProject(store);
    assert.notEqual(first.filename, second.filename); assert.equal(store.getState().dirty, false);
    assert.equal(safeName('../../', 'fallback'), 'fallback');
  } finally { globalThis.document = original; URL.createObjectURL = createURL; URL.revokeObjectURL = revokeURL; }
});
test('large PNG export visits bounded stripes sequentially without a full-map canvas', async () => {
  const downloads = [], original = globalThis.document, createURL = URL.createObjectURL, revokeURL = URL.revokeObjectURL;
  globalThis.document = { body: { append() {} }, createElement() { return { click() {}, remove() {} }; } };
  URL.createObjectURL = blob => { downloads.push(blob); return 'blob:test'; }; URL.revokeObjectURL = () => {};
  try {
    const store = createStore(createProject({ width: 4096, height: 4097 }));
    let area = 0, concurrent = 0, maximum = 0, renders = 0;
    const viewport = { async renderRegion({ rect, objects, scale }) {
      assert.ok(rect.w <= 512 && rect.h <= 64); assert.equal(scale, 1); assert.equal(objects, true);
      maximum = Math.max(maximum, ++concurrent); area += rect.w * rect.h; renders++;
      await Promise.resolve(); concurrent--;
      return { width: rect.w, height: rect.h, getContext() { return { getImageData() { return { data: new Uint8ClampedArray(rect.w * rect.h * 4).fill(255) }; } }; } };
    } };
    await exportPNG({ store, viewport });
    assert.equal(maximum, 1); assert.equal(area, 4096 * 4097); assert.equal(renders, 8 * 65);
    const header = new DataView(await downloads[0].arrayBuffer());
    assert.equal(header.getUint32(16), 4096); assert.equal(header.getUint32(20), 4097);
    assert.ok(downloads[0].size < 200000);
  } finally { globalThis.document = original; URL.createObjectURL = createURL; URL.revokeObjectURL = revokeURL; }
});
