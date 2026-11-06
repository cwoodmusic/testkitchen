import assert from 'node:assert/strict';
import { createPattern, imageToTile, repeatTile } from '../pattern-ops.js';

const pixel = (image, x, y) => Array.from(image.data.subarray((y * image.width + x) * 4, (y * image.width + x + 1) * 4));
const source = { width: 3, height: 2, data: new Uint8ClampedArray([
  255,0,0,255, 0,255,0,128, 0,0,255,255,
  80,90,100,0, 20,30,40,64, 10,20,30,255]) };

for (const pattern of ['wood', 'checker', 'stone', 'stripes', 'dots', 'diamonds']) {
  const first = createPattern({ pattern, width: 32, height: 64 });
  const second = createPattern({ pattern, width: 32, height: 64 });
  assert.deepEqual(first, second, `${pattern} is deterministic`);
  assert.equal(first.data.length, 32 * 64 * 4);
  const colors = new Set();
  for (let offset = 0; offset < first.data.length; offset += 4) {
    colors.add(first.data.slice(offset, offset + 4).toString());
    assert.equal(first.data[offset + 3], 255);
  }
  assert.ok(colors.size >= 3, `${pattern} has shaded detail`);
}
assert.notDeepEqual(createPattern({ width: 32, height: 32 }), createPattern({ width: 32, height: 64 }));
const original = new Uint8ClampedArray(source.data);
for (const [width, height] of [[32,32], [32,64], [9,11], [8,8], [256,256]]) {
  const mirrored = imageToTile(source, { width, height });
  for (let y = 0; y < height; y++) assert.deepEqual(pixel(mirrored, 0, y), pixel(mirrored, width - 1, y), 'horizontal edges meet exactly');
  for (let x = 0; x < width; x++) assert.deepEqual(pixel(mirrored, x, 0), pixel(mirrored, x, height - 1), 'vertical edges meet exactly');
  assert.ok(Array.from(mirrored.data).some(value => value === 128), 'semitransparent pixels survive');
}
assert.deepEqual(source.data, original, 'tile conversion never changes source pixels');
const tile = imageToTile(source, { width: 8, height: 8, seamless: 'repeat' });
const repeated = repeatTile(tile, { columns: 3, rows: 2 });
assert.deepEqual([repeated.width, repeated.height], [24,16]);
for (let y = 0; y < repeated.height; y++) for (let x = 0; x < repeated.width; x++) assert.deepEqual(pixel(repeated, x, y), pixel(tile, x % 8, y % 8));
assert.notDeepEqual(pixel(tile, 0, 0), pixel(tile, 7, 0), 'original repeat does not silently mirror the composition');
assert.throws(() => createPattern({ width: 0 }), /8 to 256/);
assert.throws(() => createPattern({ height: 257 }), /8 to 256/);
assert.throws(() => createPattern({ width: 8.5 }), /whole/);
assert.throws(() => createPattern({ pattern: 'missing' }), /wood/);
assert.throws(() => createPattern({ colors: ['#000000'] }), /three/);
assert.throws(() => createPattern({ colors: ['invalid','#000000','#000000'] }), /hexadecimal/);
assert.throws(() => imageToTile({ ...source, data: new Uint8ClampedArray(2) }), /complete/);
assert.throws(() => imageToTile(source, { seamless: 'unknown' }), /mirror/);
assert.throws(() => repeatTile(tile, { columns: 100 }), /1–8/);
console.log('Pattern pixels, exact mirrored edges, alpha, repeats, determinism and limits pass.');
