import test from 'node:test';
import assert from 'node:assert/strict';
import {createIslandNavigation} from './island-sailing.mjs';
import {blocked} from './model.mjs';

const point=(x,y)=>({x:x*64+32,y:y*64+32});
function lake(){const doc={cells:{},objects:[],edges:{},spawn:point(8,14)};for(let y=10;y<20;y++)for(let x=10;x<20;x++)doc.cells[`${x},${y}`]={surface:'water',level:0};return doc;}
test('the boat circles connected island water while a walker still cannot enter it',()=>{
 const doc=lake();doc.cells['14,14']={surface:'grass',level:0};doc.cells['14,15']={surface:'water',level:0,bridge:'ns',pier:{level:1,axis:'ns'}};const before=JSON.stringify(doc),catalog=new Map(),navigation=createIslandNavigation(doc,catalog,{boat:point(10,14)});
 assert(navigation);assert(navigation.points.length>85);assert(navigation.points.some(p=>p.x===point(19,14).x));assert(navigation.points.some(p=>p.y===point(14,19).y));
 assert(navigation.clear(point(12,14)));assert(blocked(doc,...Object.values(point(12,14)),catalog));assert.equal(navigation.clear(point(14,14)),false);assert.equal(navigation.clear(point(14,15)),false);
 const boat={...point(13,14)};for(let n=0;n<60;n++)navigation.move(boat,1,0,.04,850);assert(boat.x<14*64-20,'A held sail control must stop at the bank');assert(navigation.clear(boat));assert.equal(JSON.stringify(doc),before);
});
test('only the occupied placed boat is excluded from water collision',()=>{
 const doc=lake(),catalog=new Map([['boat',{w:50,h:50,boxes:[{x:0,y:0,w:50,h:50}]}]]);doc.objects=[{id:'occupied',asset:'boat',...point(11,12),collision:true},{id:'other',asset:'boat',...point(17,12),collision:true}];const before=JSON.stringify(doc),navigation=createIslandNavigation(doc,catalog,{boat:doc.objects[0]});
 assert(navigation.clear({x:doc.objects[0].x,y:doc.objects[0].y-25}));assert.equal(navigation.clear({x:doc.objects[1].x,y:doc.objects[1].y-25}),false);assert.equal(JSON.stringify(doc),before);
});
