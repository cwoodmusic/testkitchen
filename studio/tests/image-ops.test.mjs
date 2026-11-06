import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pixelate, applyEffect, transform, extractPalette } from '../image-ops.js';

const image = (width, height, pixels) => ({ width, height, data: new Uint8ClampedArray(pixels.flat()) });
const pixels = img => Array.from({ length: img.width * img.height }, (_, i) => [...img.data.slice(i * 4, i * 4 + 4)]);
const red = [255, 0, 0, 255], green = [0, 255, 0, 128], blue = [0, 0, 255, 255], clear = [16, 24, 32, 0];

test('nearest-neighbor resize uses source pixels and preserves partial transparency', () => {
  const source = image(2, 1, [red, green]);
  const result = pixelate(source, { width: 4, height: 2, colors: 0 });
  assert.deepEqual(pixels(result), [red, red, green, green, red, red, green, green]);
  assert.notEqual(result.data, source.data);
  assert.deepEqual(pixels(source), [red, green]);
});

test('contain gives transparent padding, cover crops, dimensions stay exact', () => {
  const source = image(2, 1, [red, blue]);
  const fitted = pixelate(source, { width: 2, height: 3, fit: 'contain', colors: 0 });
  assert.equal(fitted.data[3], 0);
  assert.deepEqual(pixels(fitted).slice(2, 4), [red, blue]);
  assert.equal(fitted.data.at(-1), 0);
  const cropped = pixelate(source, { width: 1, height: 2, fit: 'cover', colors: 0 });
  assert.deepEqual(pixels(cropped), [blue, blue]);
});

test('palette ignores transparent hidden RGB and retains exact small palettes', () => {
  const source = image(4, 1, [red, green, red, clear]);
  const palette = extractPalette(source, 4);
  assert.equal(palette.length, 2);
  assert.ok(palette.some(p => p[0] === 255 && p[1] === 0));
  assert.ok(palette.some(p => p[0] === 0 && p[1] === 255));
  assert.deepEqual(extractPalette(image(1, 1, [clear]), 4), []);
});

test('median-cut reduction returns bounded weighted colors', () => {
  const source = image(5, 1, [[0, 0, 0, 255], [32, 32, 32, 255], [120, 120, 120, 255], [210, 210, 210, 255], [255, 255, 255, 255]]);
  const palette = extractPalette(source, 2);
  assert.equal(palette.length, 2);
  assert.ok(Math.min(...palette.map(p => p[0])) < 80);
  assert.ok(Math.max(...palette.map(p => p[0])) > 150);
  const output = pixelate(source, { colors: 2 });
  assert.ok(new Set(pixels(output).map(p => p.slice(0, 3).join(','))).size <= 2);
});

test('ordered and Floyd dithering use only palette colors and preserve alpha', () => {
  const source = image(16, 4, Array.from({ length: 64 }, (_, i) => [120, 120, 120, i % 9 === 0 ? 0 : i % 2 ? 128 : 255]));
  const palette = ['#000000', '#ffffff'];
  for (const dither of ['none', 'ordered', 'floyd-steinberg']) {
    const output = pixelate(source, { palette, dither });
    for (let i = 0; i < source.data.length; i += 4) {
      assert.equal(output.data[i + 3], source.data[i + 3]);
      if (output.data[i + 3]) assert.ok(output.data[i] === 0 || output.data[i] === 255);
      else assert.deepEqual([...output.data.slice(i, i + 4)], [...source.data.slice(i, i + 4)]);
    }
    if (dither !== 'none') {
      const visible = pixels(output).filter(p => p[3]);
      assert.ok(visible.some(p => p[0] === 0));
      assert.ok(visible.some(p => p[0] === 255));
    }
  }
});

test('adjustments clamp channel boundaries and never mutate or drop alpha', () => {
  const source = image(3, 1, [red, green, clear]);
  assert.deepEqual(pixels(applyEffect(source, 'brightness', { amount: 100 }))[0], [255, 255, 255, 255]);
  assert.deepEqual(pixels(applyEffect(source, 'brightness', { amount: -100 }))[0], [0, 0, 0, 255]);
  assert.deepEqual(pixels(applyEffect(source, 'invert'))[1], [255, 0, 255, 128]);
  for (const effect of ['brightness', 'contrast', 'saturation', 'hue', 'grayscale', 'invert', 'posterize']) {
    const result = applyEffect(source, effect, { amount: 30, levels: 3 });
    assert.equal(result.data[7], 128);
    assert.deepEqual(pixels(result)[2], clear);
  }
  const gray = pixels(applyEffect(source, 'saturation', { amount: -100 }))[0];
  assert.equal(gray[0], gray[1]); assert.equal(gray[1], gray[2]);
  const hue = pixels(applyEffect(source, 'hue', { amount: 120 }))[0];
  assert.ok(hue[1] > hue[0]);
  assert.deepEqual(pixels(source), [red, green, clear]);
});

test('posterize produces the requested levels', () => {
  const source = image(1, 1, [[64, 128, 240, 100]]);
  assert.deepEqual(pixels(applyEffect(source, 'posterize', { levels: 2 })), [[0, 255, 255, 100]]);
});

test('blur uses premultiplied colors and transparent outside boundaries', () => {
  const source = image(3, 1, [[0, 0, 0, 0], red, [0, 0, 0, 0]]);
  const result = applyEffect(source, 'blur', { radius: 1 });
  for (const p of pixels(result)) { assert.equal(p[0], 255); assert.equal(p[1], 0); assert.equal(p[2], 0); assert.ok(p[3] > 0 && p[3] < 255); }
  assert.deepEqual(pixels(applyEffect(source, 'blur', { radius: 0 })), pixels(source));
  const sharp = applyEffect(source, 'sharpen', { amount: 2 });
  assert.deepEqual(pixels(sharp).map(p => p[3]), [0, 255, 0]);
});

test('outline and shadow composite behind the source and clip at boundaries', () => {
  const source = image(3, 3, Array.from({ length: 9 }, (_, i) => i === 4 ? red : [0, 0, 0, 0]));
  const outlined = applyEffect(source, 'outline', { size: 1, color: '#0000ffff' });
  assert.deepEqual(pixels(outlined)[4], red);
  assert.deepEqual(pixels(outlined)[1], blue);
  assert.equal(pixels(outlined)[0][3], 0);
  const shadow = applyEffect(source, 'shadow', { offsetX: 1, offsetY: 1, color: '#00000080', opacity: 1 });
  assert.deepEqual(pixels(shadow)[4], red);
  assert.deepEqual(pixels(shadow)[8], [0, 0, 0, 128]);
  const clipped = applyEffect(source, 'shadow', { offsetX: 50, offsetY: 50 });
  assert.deepEqual(pixels(clipped), pixels(source));
});

test('flips and clockwise right-angle rotations retain every RGBA pixel', () => {
  const source = image(2, 2, [red, green, blue, clear]);
  assert.deepEqual(pixels(transform(source, { flipX: true })), [green, red, clear, blue]);
  assert.deepEqual(pixels(transform(source, { flipY: true })), [blue, clear, red, green]);
  assert.deepEqual(pixels(transform(source, { rotate: 90 })), [blue, red, clear, green]);
  assert.deepEqual(pixels(transform(source, { rotate: -90 })), [green, clear, red, blue]);
  assert.deepEqual(pixels(transform(source, { rotate: 360 })), pixels(source));
  const rectangular = image(3, 1, [red, green, blue]);
  const rotated = transform(rectangular, { rotate: 90 });
  assert.equal(rotated.width, 1); assert.equal(rotated.height, 3);
  assert.deepEqual(pixels(rotated), [red, green, blue]);
});

test('arbitrary nearest rotation has transparent corners and bounded output', () => {
  const result = transform(image(2, 2, [red, red, red, red]), { rotate: 45 });
  assert.equal(result.width, 3); assert.equal(result.height, 3);
  assert.ok(pixels(result).some(p => p[3] === 0));
  assert.ok(pixels(result).every(p => p[3] === 0 || p[0] === 255));
});

test('malformed dimensions, buffers, palettes and effects fail readably', () => {
  const source = image(1, 1, [red]);
  assert.throws(() => pixelate(source, { width: 0 }), /dimensions/i);
  assert.throws(() => pixelate(source, { width: 8192, height: 8192 }), /million/i);
  assert.throws(() => pixelate({ width: 1, height: 1, data: new Uint8ClampedArray(3) }), /complete/i);
  assert.throws(() => pixelate(source, { palette: [] }), /palette/i);
  assert.throws(() => pixelate(source, { palette: ['bogus'] }), /colors/i);
  assert.throws(() => pixelate(source, { dither: 'nonsense' }), /dither/i);
  assert.throws(() => applyEffect(source, 'nonsense'), /unknown/i);
});
