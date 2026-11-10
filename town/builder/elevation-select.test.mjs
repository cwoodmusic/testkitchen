import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,connect,History,key,COLS,ROWS} from '../world/model.mjs';
import {encodeMask} from '../world/organic-mask.mjs';
import {musicSquareWalls} from '../world/music-wall-geometry.mjs';
import {selectionContains,regionHeightEdits} from './region.mjs';
import {selectElevationRegion,elevationBarriers} from './elevation-select.mjs';

function floor(doc,x0,y0,x1,y1,level=2,surface='grass'){for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)doc.cells[key(x,y)]={surface,level};}
function wall(doc,x,y,xx,yy,extra={}){
 const dx=Math.abs(xx-x),dy=Math.abs(yy-y),X=Math.min(x,xx),Y=Math.min(y,yy),length=dx+dy;
 for(let at=0;at<length;at+=64){const n=Math.min(64,length-at),k=`w:${dx?X+at:X}:${dy?Y+at:Y}:${dx?n:0}:${dy?n:0}`;doc.edges[k]={style:'music-square',gate:false,open:false,...extra};}
}
function pen(doc,x0,y0,x1,y1){wall(doc,x0,y0,x1,y0);wall(doc,x0,y1,x1,y1);wall(doc,x0,y0,x0,y1);wall(doc,x1,y0,x1,y1);}
const center=(x,y)=>({x:x*64+32,y:y*64+32});

test('selects one four-connected elevation across all dry materials, retaining holes and excluding stairs/water',()=>{
 const d=blank();floor(d,4,4,8,8,3);d.cells['6,6']={surface:'water',level:3};d.cells['5,5']={surface:'sand',level:3};d.cells['7,5']={surface:'cobble',level:3};d.cells['7,7']={surface:'grass',level:4};d.cells['8,8']={surface:'wood',level:3,stairs:'north'};
 d.cells['9,9']={surface:'grass',level:3};
 const r=selectElevationRegion(d,center(4,4));
 assert.equal(r.shape,'elevation');assert.equal(r.level,3);assert.equal(r.cells.length,22);
 assert.ok(selectionContains(r,5,5));assert.ok(selectionContains(r,7,5));
 for(const [x,y]of [[6,6],[7,7],[8,8],[9,9]])assert.equal(selectionContains(r,x,y),false,`${x},${y}`);
 assert.equal(selectElevationRegion(d,center(6,6)),null);assert.equal(selectElevationRegion(d,center(8,8)),null);
});

test('grid fences enclose land; a closed gate bounds the yard and an open gate connects it',()=>{
 const d=blank();floor(d,0,0,9,9,1);
 connect(d,{x:2,y:2},{x:6,y:2},'wood');connect(d,{x:6,y:2},{x:6,y:6},'brick');connect(d,{x:6,y:6},{x:2,y:6},'iron');connect(d,{x:2,y:6},{x:2,y:2},'limestone');
 d.edges['v:6:4']={style:'wood',gate:true,open:false};
 assert.equal(selectElevationRegion(d,center(3,3)).cells.length,16);
 d.edges['v:6:4'].open=true;
 assert.equal(selectElevationRegion(d,center(3,3)).cells.length,100);
});

test('off-grid thin walls partition actual world space, including a click on the far side of its tile centre',()=>{
 const d=blank();floor(d,0,0,9,9,1);pen(d,180,180,420,420);
 const original=JSON.stringify(d),inside=selectElevationRegion(d,{x:184,y:200});
 assert.equal(inside.cells.length,25);assert.deepEqual([inside.x0,inside.y0,inside.x1,inside.y1],[2,2,6,6]);
 assert.ok(selectionContains(inside,4,4));assert.equal(selectionContains(inside,1,3),false);
 // Both clicks are in terrain cell (2,3); its ordinary centre x=160 is
 // outside the pen, so a centre-only flood would select the wrong component.
 const outside=selectElevationRegion(d,{x:170,y:200});
 assert.equal(outside.cells.length,91);assert.equal(selectionContains(outside,4,4),false);
 assert.equal(JSON.stringify(d),original);
});

test('a narrow enclosure entirely within one tile does not leak to the tile centre or outside',()=>{
 const d=blank();floor(d,0,0,5,5,1);pen(d,135.5,138.25,151.75,153.5);
 const r=selectElevationRegion(d,{x:140,y:145});assert.deepEqual(r.cells,['2,2']);
 assert.ok(selectElevationRegion(d,center(1,1)).cells.length>1);
});

test('nested enclosures preserve an unselected hollow and a missing wall reconnects the two dry areas',()=>{
 const d=blank();floor(d,0,0,11,11,1);pen(d,128,128,640,640);pen(d,256,256,512,512);
 const ring=selectElevationRegion(d,center(3,3));assert.equal(ring.cells.length,48);assert.equal(selectionContains(ring,5,5),false);
 const inner=selectElevationRegion(d,center(5,5));assert.equal(inner.cells.length,16);
 delete d.edges['w:256:320:0:64'];
 assert.equal(selectElevationRegion(d,center(3,3)).cells.length,64);
});

test('Music Square built walls retain their entrance gaps; authored extensions can close those gaps',()=>{
 const d=blank();floor(d,10,10,70,60,1);
 const square={id:'square',asset:'music-square',x:3000,y:3000,rotation:0,scale:1,collision:true};d.objects.push(square);
 const original=selectElevationRegion(d,{x:3000,y:2300});assert.equal(original.cells.length,61*51);
 const sides=musicSquareWalls(square);
 for(const [a,b]of [[sides[0],sides[1]],[sides[2],sides[3]],[sides[4],sides[5]],[sides[6],sides[7]]])wall(d,a.b.x,a.b.y,b.a.x,b.a.y);
 const enclosed=selectElevationRegion(d,{x:3000,y:2300});
 assert.equal(enclosed.cells.length,36*23);assert.equal(selectionContains(enclosed,10,10),false);assert.ok(selectionContains(enclosed,46,35));
 assert.ok(elevationBarriers(d).length>8);
});

test('buildings and trees never form terrain boundaries or remove their underlying ground',()=>{
 const d=blank();floor(d,2,2,6,6,2);const expected=selectElevationRegion(d,center(2,2));
 d.objects.push({asset:'oak-tree',x:220,y:250,scale:3,collision:true},{asset:'apartment-tower',x:300,y:400,scale:1,collision:true});
 assert.deepEqual(selectElevationRegion(d,center(2,2)),expected);assert.equal(elevationBarriers(d).length,0);
});

test('organic shores use evaluated dry ground and cannot jump a four-pixel water channel within a tile',()=>{
 const d=blank();floor(d,9,9,11,11,3);d.cells['10,9']={surface:'water',level:3};d.cells['10,11']={surface:'water',level:3};
 const bits=Uint8Array.from({length:256},(_,i)=>i%16!==8?1:0);
 d.cells['10,10']={surface:'grass',level:3,curves:[{kind:'surface',corner:'nw',cx:704,cy:704,r:64,underX:10,underY:9,under:{surface:'water',level:3},mask:encodeMask(bits)}]};
 // Raise the outside north/south rows so the only possible connection across
 // the island would be the wet strip inside (10,10).
 for(const y of [9,11])for(const x of [9,11])d.cells[key(x,y)].level=4;
 const left=selectElevationRegion(d,{x:650,y:670});assert.ok(selectionContains(left,9,10));assert.equal(selectionContains(left,11,10),false);
 const right=selectElevationRegion(d,{x:690,y:670});assert.ok(selectionContains(right,11,10));assert.equal(selectionContains(right,9,10),false);
 assert.equal(selectElevationRegion(d,{x:674,y:670}),null);
});

test('a selected enclosure raises and lowers through the existing mask edits in one undo step without changing objects or walls',()=>{
 const d=blank();floor(d,0,0,9,9,1);pen(d,128,128,384,384);d.cells['3,3'].surface='sand';
 const original=JSON.stringify(d),r=selectElevationRegion(d,center(3,3)),history=new History();
 assert.equal(JSON.stringify(d),original);assert.equal(history.undo.length,0);
 history.record(d);for(const [k,next]of regionHeightEdits(d,r,1))d.cells[k]=next;
 assert.equal(history.undo.length,1);assert.equal(d.cells['3,3'].level,2);assert.equal(d.cells['3,3'].surface,'sand');assert.equal(d.cells['1,1'].level,1);
 assert.deepEqual(d.edges,JSON.parse(original).edges);assert.deepEqual(d.objects,JSON.parse(original).objects);
 assert.equal(JSON.stringify(history.back(d)),original);
 for(const [k,next]of regionHeightEdits(d,r,-1))d.cells[k]=next;
 assert.equal(d.cells['3,3'].level,1);
});

test('level-zero whole-map selection stays bounded and rejects invalid clicks without mutating a blank map',()=>{
 const d=blank(),before=JSON.stringify(d),r=selectElevationRegion(d,center(128,96));
 assert.equal(r.cells.length,COLS*ROWS);assert.deepEqual([r.x0,r.y0,r.x1,r.y1],[0,0,255,191]);assert.equal(JSON.stringify(d),before);
 for(const p of [{x:-1,y:0},{x:COLS*64,y:0},{x:0,y:ROWS*64},{x:NaN,y:1},null])assert.equal(selectElevationRegion(d,p),null);
});
