import test from 'node:test';
import assert from 'node:assert/strict';
import { smartSelection, combineSelections, selectionContains } from '../smart-select.js';
import { pointInSelection, imageDataToPixels } from '../viewport.js';

const RED = 0xc83240ff, BLUE = 0x253fb0ff;
function fixture(width, height, fill = 0) {
  const pixels = new Uint32Array(width * height).fill(fill);
  return { width, height, pixels, readPixel: (x, y) => pixels[y * width + x] };
}
function selectedPoints(selection) {
  const points = [];
  if (selection) for (let y = selection.y; y < selection.y + selection.h; y++)
    for (let x = selection.x; x < selection.x + selection.w; x++)
      if (selectionContains(selection, x, y)) points.push([x, y]);
  return points;
}

test('Smart Select keeps a connected ring, its hole and a separate same-color island distinct', () => {
  const image = fixture(5, 5);
  for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++)
    if (x === 1 || y === 1 || x === 3 || y === 3) image.pixels[y * 5 + x] = RED;
  image.pixels[24] = RED;
  const before = image.pixels.slice();
  const selection = smartSelection({ ...image, x: 1, y: 1 });
  assert.deepEqual([selection.x, selection.y, selection.w, selection.h, selection.count], [1, 1, 3, 3, 8]);
  assert.deepEqual([...selection.mask], [1, 1, 1, 1, 0, 1, 1, 1, 1]);
  assert.equal(selectionContains(selection, 4, 4), false);
  assert.equal(pointInSelection(selection, 2, 2), false);
  assert.deepEqual(image.pixels, before, 'Selecting never changes paint pixels');
});

test('Tolerance compares to the clicked color rather than creeping through a gradient', () => {
  const image = fixture(4, 1);
  image.pixels.set([0x643232ff, 0x6e3232ff, 0x783232ff, 0]);
  assert.deepEqual(selectedPoints(smartSelection({ ...image, x: 0, y: 0, tolerance: 10 })), [[0, 0], [1, 0]]);
  assert.equal(smartSelection({ ...image, x: 0, y: 0, tolerance: 20 }).count, 3);
  assert.equal(smartSelection({ ...image, x: 0, y: 0, tolerance: 255 }).count, 3,
    'Opaque colors never bridge across transparency');
});

test('Transparent seeds ignore invisible RGB but cannot bridge through opaque pixels', () => {
  const image = fixture(5, 1);
  image.pixels.set([0xff000000, 0x00ff0000, BLUE, 0x0000ff00, 0]);
  assert.deepEqual(selectedPoints(smartSelection({ ...image, x: 0, y: 0, tolerance: 255 })), [[0, 0], [1, 0]]);
  assert.deepEqual(selectedPoints(smartSelection({ ...image, x: 4, y: 0 })), [[3, 0], [4, 0]]);
});

test('Shift union and Alt subtraction compact disjoint selections and permit an empty result', () => {
  const previous = { x: 1, y: 1, w: 2, h: 2 };
  const next = { x: 5, y: 1, w: 1, h: 2, mask: new Uint8Array([1, 1]), count: 2 };
  const copy = structuredClone(next);
  const union = combineSelections(previous, next, 'add');
  assert.deepEqual([union.x, union.y, union.w, union.h, union.count], [1, 1, 5, 2, 6]);
  assert.equal(selectionContains(union, 4, 1), false);
  assert.equal(selectionContains(union, 5, 1), true);
  const removed = combineSelections(union, previous, 'subtract');
  assert.deepEqual([removed.x, removed.y, removed.w, removed.h, removed.count], [5, 1, 1, 2, 2]);
  assert.equal(combineSelections(removed, next, 'subtract'), null);
  assert.deepEqual(next, copy, 'Combining leaves both inputs unchanged');
});

test('Lasso selections can be combined with a Smart Select mask without selecting their bounding box', () => {
  const triangle = { x: 0, y: 0, w: 3, h: 3, points: [[0, 0], [3, 0], [0, 3]] };
  const single = { x: 2, y: 2, w: 1, h: 1, mask: new Uint8Array([1]), count: 1 };
  assert.deepEqual(selectedPoints(combineSelections(triangle, single, 'add')), [[0, 0], [1, 0], [0, 1], [2, 2]]);
});

test('Huge scenes reject before reading or allocating, while a bounded area remains usable', () => {
  let reads = 0;
  const readPixel = () => { reads++; return RED; };
  assert.throws(() => smartSelection({ width: 6800, height: 5100, readPixel, x: 0, y: 0 }), /smaller area/i);
  assert.equal(reads, 0);
  const selection = smartSelection({ width: 6800, height: 5100, readPixel, x: 100, y: 100,
    bounds: { x: 100, y: 100, w: 4, h: 3 }, contains: (x, y) => x <= 102 || y === 100 });
  assert.equal(selection.count, 10);
  assert.deepEqual([selection.x, selection.y, selection.w, selection.h], [100, 100, 4, 3]);
  assert.equal(selectionContains(selection, 103, 102), false);
  assert.throws(() => combineSelections({ x: 0, y: 0, w: 4096, h: 4096 },
    { x: 8191, y: 8191, w: 1, h: 1 }, 'add'), /combined selection/i);
});

test('Mask membership supports translated selections and emitted pixels retain holes and RGBA', () => {
  const selection = { x: 10, y: 20, w: 2, h: 2, mask: new Uint8Array([1, 0, 0, 1]) };
  const image = { width: 2, height: 2, data: new Uint8ClampedArray(16).fill(255) };
  assert.deepEqual([...imageDataToPixels(image, 10, 20, selection)], [[10, 20, 0xffffffff], [11, 21, 0xffffffff]]);
  assert.equal(pointInSelection(selection, 10.2, 20.2), true);
  assert.equal(pointInSelection(selection, 11.2, 20.2), false);
  assert.equal(pointInSelection(selection, 9, 20), false);
});

test('Malformed Smart Select inputs fail readably without calling a pixel reader', () => {
  assert.throws(() => smartSelection({ width: 8193, height: 1 }), /valid scene/i);
  assert.throws(() => smartSelection({ width: 4, height: 4, x: 0, y: 0 }), /readable paint/i);
  assert.throws(() => smartSelection({ ...fixture(4, 4), x: -1, y: 1 }), /click inside/i);
  assert.throws(() => smartSelection({ ...fixture(4, 4), x: 1, y: 1, bounds: { x: NaN, y: 0, w: 2, h: 2 } }), /valid selection/i);
});
