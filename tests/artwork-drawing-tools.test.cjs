const test=require('node:test'),assert=require('node:assert/strict'),art=require('../artwork-editor.js');
const points=(values)=>new Set([...values].map(([x,y])=>x+','+y));
test('sized square and round pencil strokes retain exact pixels, clip to the source, and never repeat a pixel',()=>{
 assert.deepEqual([...art.brushPixels([[4,5]],1,'square',20,20)],[[4,5]]);
 const square=points(art.brushPixels([[4,5]],5,'square',20,20));assert.equal(square.size,25);assert.ok(square.has('2,3')&&square.has('6,7'));
 const round=points(art.brushPixels([[4,5]],5,'round',20,20));assert.ok(round.size<25);assert.ok(round.has('4,3'));assert.ok(!round.has('2,3'));
 const clipped=[...art.brushPixels([[0,0],[1,0]],128,'round',17,13)];assert.ok(clipped.every(([x,y])=>x>=0&&y>=0&&x<17&&y<13));assert.equal(points(clipped).size,clipped.length);
});
test('filled and outlined rectangle and ellipse shapes support reverse dragging and source edges',()=>{
 const outline=points(art.shapePixels([2,2],[8,8],'rectangle',false,1,20,20)),filled=points(art.shapePixels([8,8],[2,2],'rectangle',true,1,20,20));
 assert.equal(filled.size,49);assert.equal(outline.size,24);assert.ok(!outline.has('5,5'));assert.ok(outline.has('2,2'));
 assert.deepEqual(points(art.shapePixels([8,8],[2,2],'rectangle',false,1,20,20)),outline);
 const ellipse=points(art.shapePixels([2,2],[8,8],'ellipse',false,1,20,20)),disk=points(art.shapePixels([2,2],[8,8],'ellipse',true,1,20,20));
 assert.ok(disk.has('5,5'));assert.ok(!ellipse.has('5,5'));assert.ok(!disk.has('2,2'));assert.ok(disk.has('5,2'));
 assert.equal(points(art.shapePixels([-4,-4],[3,3],'rectangle',true,1,4,4)).size,16);
});
