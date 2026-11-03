const test=require('node:test');
const assert=require('node:assert/strict');
const selections=require('../layer-selection.js');
const pixels=require('../pixel-selection.js');

test('validates only bounded integer rectangles and normalized nondegenerate polygons',()=>{
 const rect={x:1,y:2,width:3,height:4};assert.equal(selections.validate(rect,10,10),true);
 for(const invalid of [{...rect,x:-1},{...rect,width:0},{...rect,y:.5},{...rect,x:9},{...rect,extra:true},{...rect,points:[[1,2],[2,2],[3,2]]},{...rect,points:[[0,0],[4,0],[4,6]]}])assert.equal(selections.validate(invalid,10,10),false);
 const polygon=pixels.polygonSelection([[1,2],[4,2],[2,6]],10,10);assert.equal(selections.validate(polygon,10,10),true);
 assert.equal(selections.validate({...polygon,points:[...polygon.points,polygon.points[0]]},10,10),false);
 assert.equal(selections.validate({...polygon,points:[[1,2],[1,2],[4,2],[2,6]]},10,10),false);
 assert.equal(selections.validate(rect,Infinity,10),false);
});

test('scanline fills match inclusive polygon centres for concave, sloped and crossing edges',()=>{
 const shapes=[[[1,1],[12,1],[12,4],[5,4],[5,12],[1,12]],[[0,0],[13,7],[2,14]],[[1,1],[13,13],[1,13],[13,1]],[[0,0],[0,15],[15,15],[15,0]],[[1,1],[4,7],[7,1],[10,7],[13,1],[13,13],[1,13]],[[2,3],[13,5],[11,14],[0,9]],[[3,0],[3,15],[6,9],[0,9]]];
 for(const shape of shapes){
  const selection=pixels.polygonSelection(shape,16,16),actual=new Set();
  selections.eachSpan(selection,(x,y,width,height)=>{assert.equal(height,1);for(let xx=x;xx<x+width;xx++){const key=xx+','+y;assert.equal(actual.has(key),false,'Spans do not overlap');actual.add(key);}});
  for(let y=0;y<16;y++)for(let x=0;x<16;x++)assert.equal(actual.has(x+','+y),pixels.containsSelection(selection,x,y),JSON.stringify({shape,x,y}));
 }
});

test('large rectangles emit one span per row and invalid selections emit no spans',()=>{
 let calls=0,area=0;assert.equal(selections.eachSpan({x:0,y:0,width:1672,height:941},(x,y,width,height)=>{assert.equal(x,0);assert.equal(y,calls++);area+=width*height;}),true);
 assert.equal(calls,941);assert.equal(area,1672*941);
 assert.equal(selections.eachSpan({x:0,y:0,width:-3,height:1},()=>assert.fail()),false);
});

test('rectangle gestures select inclusive clamped pixels without replacing a committed selection until end',()=>{
 const changes=[],controller=selections.create({width:20,height:10,onChange:state=>changes.push(state)});
 controller.down([7,8]);controller.move([2,3]);assert.equal(controller.getSelection(),null);assert.equal(controller.getState().dragging,true);controller.end();
 assert.deepEqual(controller.getSelection(),{x:2,y:3,width:6,height:6});
 controller.down([-4,-3]);controller.move([30,20]);assert.deepEqual(controller.getSelection(),{x:2,y:3,width:6,height:6});controller.cancel();
 assert.deepEqual(controller.getSelection(),{x:2,y:3,width:6,height:6});assert.equal(controller.getState().draft,null);
 controller.down([-1,-1]);controller.move([25,15]);controller.finish();assert.deepEqual(controller.getSelection(),{x:0,y:0,width:20,height:10});
 const state=controller.getState();state.selection.width=1;assert.equal(controller.getSelection().width,20);assert.ok(changes.length>=8);
});

test('manual selections need a real polygon, preserve prior selection on cancel, and clear fully',()=>{
 const controller=selections.create({width:20,height:20});controller.down([1,1]);controller.end();const original=controller.getSelection();
 controller.setShape('manual');controller.down([2,2]);controller.down([3,3]);assert.equal(controller.finish(),false);controller.down([4,4]);assert.equal(controller.finish(),false);controller.cancel();assert.deepEqual(controller.getSelection(),original);
 for(const point of [[2,2],[8,2],[8,8],[2,8]])controller.down(point);
 assert.equal(controller.end(),false);assert.equal(controller.finish(),true);assert.deepEqual(controller.getSelection(),{x:2,y:2,width:7,height:7,points:[[2,2],[8,2],[8,8],[2,8]]});
 controller.down([9,9]);controller.setShape('rectangle');assert.equal(controller.getState().draft,null);assert.equal(controller.getSelection().width,7);
 assert.equal(controller.clear(),true);assert.equal(controller.getSelection(),null);assert.equal(controller.clear(),false);assert.equal(controller.setShape('bad'),false);
});

test('manual point limit prevents unbounded drafts and invalid inputs cannot start a gesture',()=>{
 const controller=selections.create({width:100,height:100});assert.equal(controller.down([NaN,0]),false);assert.equal(controller.move([1,1]),false);controller.setShape('manual');
 for(let index=0;index<512;index++)assert.equal(controller.down([index%100,Math.floor(index/100)]),true);
 assert.equal(controller.down([70,70]),false);assert.equal(controller.getState().draft.length,512);
});
