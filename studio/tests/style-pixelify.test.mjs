import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CODA_PALETTES, PIXELIFY_STYLES, pixelifyImage } from '../coda-style.js';

const image = (width, height, pixels) => ({ width, height, data: new Uint8ClampedArray(pixels.flat()) });
const pixels = value => Array.from({ length: value.width * value.height }, (_, i) => [...value.data.slice(i * 4, i * 4 + 4)]);
const rgb = value => '#' + value.slice(0, 3).map(channel => channel.toString(16).padStart(2, '0')).join('');

test('Coda conversion uses a shared game palette on different uploads', () => {
  for (const source of [
    image(3, 1, [[70, 125, 180, 255], [250, 180, 60, 255], [200, 80, 90, 255]]),
    image(3, 1, [[60, 150, 160, 255], [240, 220, 190, 255], [80, 40, 20, 255]]),
  ]) {
    const result = pixelifyImage(source);
    assert.ok(pixels(result).every(pixel => CODA_PALETTES.coda.includes(rgb(pixel))));
    assert.notDeepEqual(pixels(result), pixels(source));
  }
});

test('fixed game palettes obey the requested color limit without inventing colors', () => {
  const source = image(64, 1, Array.from({ length: 64 }, (_, i) => [i * 4, 255 - i * 4, (i * 71) % 256, 255]));
  for (const palette of ['coda', 'cozy']) {
    const result = pixelifyImage(source, { colors: 6, palette, dither: 'ordered' });
    const colors = new Set(pixels(result).map(rgb));
    assert.ok(colors.size > 1 && colors.size <= 6);
    assert.ok([...colors].every(value => CODA_PALETTES[palette].includes(value)));
  }
});

test('simplification retains native alpha and never changes the source buffer', () => {
  const source = image(3, 2, [[80, 120, 130, 0], [82, 118, 130, 40], [90, 128, 140, 128],
    [75, 115, 125, 200], [80, 120, 130, 255], [83, 123, 133, 1]]);
  const before = new Uint8ClampedArray(source.data);
  const result = pixelifyImage(source, { simplify: 3 });
  assert.deepEqual(pixels(result).map(p => p[3]), pixels(source).map(p => p[3]));
  assert.deepEqual(source.data, before);
  assert.notEqual(result.data, source.data);
});

test('Original style retains exact small image palettes and disables style adjustments', () => {
  const source = image(2, 2, [[12, 130, 251, 255], [80, 40, 25, 128], [250, 200, 10, 255], [0, 0, 0, 0]]);
  const result = pixelifyImage(source, { style: 'original', colors: 256 });
  assert.deepEqual(pixels(result), pixels(source));
  assert.equal(PIXELIFY_STYLES.original.simplify, 0);
  assert.equal(PIXELIFY_STYLES.original.palette, 'image');
});

test('detail simplification groups nearby photo colors while keeping sharp boundaries', () => {
  const source = image(5, 1, [[80, 80, 80, 255], [100, 100, 100, 255], [80, 80, 80, 255],
    [250, 20, 20, 255], [250, 20, 20, 255]]);
  const result = pixelifyImage(source, { style: 'original', colors: 256, simplify: 1 });
  const output = pixels(result);
  assert.ok(output[1][0] < 100 && output[1][0] > 80);
  assert.deepEqual(output[3], [250, 20, 20, 255]);
  assert.deepEqual(output[4], [250, 20, 20, 255]);
});

test('pixel blocks expand cleanly at source resolution and preserve transparent padding', () => {
  const source = image(4, 2, Array.from({ length: 8 }, (_, i) => [i * 30, 120, 70, i < 4 ? 128 : 255]));
  const result = pixelifyImage(source, { width: 8, height: 8, block: 2 });
  assert.deepEqual([result.width, result.height], [8, 8]);
  const output = pixels(result);
  assert.equal(output[0][3], 0);
  assert.equal(output.at(-1)[3], 0);
  for (let y = 0; y < 8; y += 2) for (let x = 0; x < 8; x += 2) {
    const first = output[y * 8 + x];
    assert.deepEqual(output[y * 8 + x + 1], first);
    assert.deepEqual(output[(y + 1) * 8 + x], first);
    assert.deepEqual(output[(y + 1) * 8 + x + 1], first);
  }
});

test('floor and wallpaper dimensions produce bounded editable pixels', () => {
  const source = image(2, 2, [[250, 210, 170, 255], [80, 40, 25, 255], [60, 140, 140, 255], [245, 100, 80, 255]]);
  for (const [width, height] of [[32, 32], [32, 64]]) {
    const result = pixelifyImage(source, { width, height, fit: 'cover', style: 'cozy' });
    assert.deepEqual([result.width, result.height], [width, height]);
    assert.equal(result.data.length, width * height * 4);
    assert.ok(pixels(result).every(value => value[3] === 255 && CODA_PALETTES.cozy.includes(rgb(value))));
  }
});

test('invalid style, size, detail, block and palette fail before allocating oversized output', () => {
  const source = image(1, 1, [[100, 100, 100, 255]]);
  for (const options of [{ style: 'unknown' }, { palette: 'unknown' }, { block: 0 }, { block: 1.5 },
    { simplify: 4 }, { colors: 1 }, { width: 8192, height: 8192 }, { width: 0, height: 1 }])
    assert.throws(() => pixelifyImage(source, options), /choose|size|detail|dimensions/i);
});
