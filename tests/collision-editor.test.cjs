const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'collision-editor.js'), 'utf8');
function editor() {
  const context = { window: {} }; vm.runInNewContext(source, context);
  const baseGrid = new Uint8Array(30); baseGrid[0] = 1;
  const grid = baseGrid.slice(); grid[1] = 1; // A legacy saved change is not a default.
  let invalidations = 0;
  const instance = context.window.createCodaCollisionEditor({ W: 60, H: 50, cell: 10, gridWidth: 6, gridHeight: 5,
    navGrid: grid, baseGrid, invalidateRoutes() { invalidations++; }, toWorld(x,y) { return {x:x/2, y:y/2}; } });
  return { instance, grid, invalidations: () => invalidations };
}
test('explicit overrides affect architectural blocked cells and restore the immutable original map', () => {
  const {instance, grid} = editor();
  assert.equal(grid[1],1, 'constructing editor must preserve legacy runtime state');
  instance.apply([[0,0],[1,1]]);
  assert.equal(instance.overrideAt(5,5),false);
  assert.equal(instance.overrideAt(15,5),true);
  assert.equal(grid[1],1);
  assert.equal(instance.overrideAt(60,0),undefined);
  assert.equal(instance.overrideAt(-1,0),undefined);
  instance.apply([]);
  assert.equal(grid[0],1);
  assert.equal(grid[1],0,'clear returns to original defaults, not saved legacy changes');
});
test('invalid imports are rejected atomically, including ambiguous duplicate cells', () => {
  const {instance,grid,invalidations} = editor(); instance.apply([[3,1]]);
  const previous = [...grid], count = invalidations();
  for (const bad of [null, [[3,1],[3,0]], [[30,1]], [[1,2]], [[1.5,1]], [[2, true]], [[2,0,5]]]) {
    assert.equal(instance.validate(bad),false);
    assert.throws(() => instance.apply(bad), /Invalid collision/);
    assert.deepEqual([...grid],previous);
  }
  assert.equal(invalidations(),count);
});
test('captured brush drags interpolate skipped cells in world coordinates and isolate other pointers', () => {
  const {instance,grid} = editor(); instance.setActive(true);
  const event = (x,y,pointerId=1) => ({clientX:x,clientY:y,pointerId,button:0,preventDefault(){},currentTarget:{setPointerCapture(){}}});
  // 2 screen px per world px: (10,10) maps to world (5,5), (90,10) to (45,5).
  assert.equal(instance.pointerDown(event(10,10)),true);
  assert.equal(instance.pointerMove(event(90,10,2)),false);
  assert.equal(instance.pointerMove(event(90,10)),true);
  assert.equal(instance.pointerEnd({pointerId:2}),false);
  assert.equal(instance.pointerEnd({pointerId:1}),true);
  assert.equal(instance.get().length,5);
  for(let id=0;id<5;id++)assert.equal(grid[id],0);
  instance.setActive(false); assert.equal(instance.pointerDown(event(10,10)),false);
});
