import test from 'node:test';
import assert from 'node:assert/strict';
import { linePoints, shapePoints } from '../tools.js';
import { selectionBounds, pointInSelection, imageDataToPixels, objectLocalPoint, polygonsOverlap, collisionBlocksRect } from '../viewport.js';

test('line interpolation stays connected in all directions and includes endpoints', () => {
  for (const [x, y] of [[9, 3], [-9, 3], [3, 9], [3, -9], [0, 0]]) {
    const points = [...linePoints(0, 0, x, y)];
    assert.deepEqual(points[0], [0, 0]); assert.deepEqual(points.at(-1), [x, y]);
    for (let i = 1; i < points.length; i++) assert.equal(Math.max(Math.abs(points[i][0] - points[i - 1][0]), Math.abs(points[i][1] - points[i - 1][1])), 1);
  }
});

test('pixel shapes include single-pixel axes and reverse drags identically', () => {
  for (const tool of ['line', 'rectangle', 'ellipse']) for (const filled of [false, true]) {
    const normalize = points => [...new Set(points.map(p => p.join(',')))].sort();
    assert.deepEqual(normalize([...shapePoints(tool, { x: 2, y: 3 }, { x: 9, y: 8 }, filled)]), normalize([...shapePoints(tool, { x: 9, y: 8 }, { x: 2, y: 3 }, filled)]));
    assert.deepEqual([...shapePoints(tool, { x: 2, y: 3 }, { x: 2, y: 3 }, filled)][0], [2, 3]);
  }
});

test('polygon selection masks constrain emitted image pixels and preserve unsigned RGBA', () => {
  const selection = { x: 0, y: 0, w: 3, h: 3, points: [[0, 0], [3, 0], [0, 3]] };
  assert.equal(pointInSelection(selection, 0, 0), true); assert.equal(pointInSelection(selection, 2, 2), false);
  const image = { width: 3, height: 3, data: new Uint8ClampedArray(36).fill(255) };
  const pixels = [...imageDataToPixels(image, 0, 0, selection)];
  assert.deepEqual(pixels, [[0, 0, 0xffffffff], [1, 0, 0xffffffff], [0, 1, 0xffffffff]]);
  assert.deepEqual(selectionBounds({ x: 1.25, y: 2.5, w: 2, h: 3 }), { x: 1, y: 2, w: 3, h: 4 });
});

test('inverse object transform maps rotated and flipped source positions', () => {
  const object = { x: 100, y: 200, w: 40, h: 20, rotation: 90, flipX: true, flipY: false };
  const p = objectLocalPoint(object, { x: 120, y: 190 }, { width: 80, height: 40 });
  assert.ok(Math.abs(p.x - 80) < 1e-9); assert.ok(Math.abs(p.y - 20) < 1e-9);
});

test('collision SAT blocks overlapping transformed feet but permits touching edges', () => {
  const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const shift = amount => square.map(p => ({ x: p.x + amount, y: p.y }));
  assert.equal(polygonsOverlap(square, shift(9)), true); assert.equal(polygonsOverlap(square, shift(10)), false);
});

test('Coda walk collision treats 0 as blocked, 1 as open and absent cells as open', () => {
  const collision = { cellSize: 10, cells: { '2,3': 0, '3,3': 1 } };
  assert.equal(collisionBlocksRect(collision, { x: 20, y: 30, w: 10, h: 10 }), true);
  assert.equal(collisionBlocksRect(collision, { x: 30, y: 30, w: 10, h: 10 }), false);
  assert.equal(collisionBlocksRect(collision, { x: 40, y: 30, w: 10, h: 10 }), false);
  assert.equal(collisionBlocksRect(collision, { x: 29, y: 35, w: 2, h: 2 }), true);
});
