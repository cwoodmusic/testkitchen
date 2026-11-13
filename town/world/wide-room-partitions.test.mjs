import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {getInteriorBase,residents} from './urban-interiors.mjs';
import {SHOWROOMS} from './showroom-layout.mjs';
import {wideRoomSouthPartitionGeometry,wideRoomPartitionDrawables,clearWideRoomPartitionCache,getWideRoomPartitionCacheStats} from './wide-room-partitions.mjs';
const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas');
const scene=id=>getInteriorBase({kind:'showroom',showroomId:id});
const preserved=s=>s.roomLayoutLegacySources?.[0]??s;
const requests=[...residents.map(r=>({kind:'apartment',resident:r.id})),{kind:'apartment',resident:'player'},...SHOWROOMS.map(r=>({kind:'showroom',showroomId:r.id}))];
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const item of Object.values(value))freeze(item);}return value;};
function context(){
 const stack=[],calls=[],c={fillStyle:'#123456',globalAlpha:.7,imageSmoothingEnabled:true,matrix:[1,0,0,1,3,5]};
 for(const name of ['fillRect','beginPath','rect','clip','moveTo','lineTo','closePath','fill','drawImage'])c[name]=(...args)=>{for(const n of args)if(typeof n==='number')assert(Number.isFinite(n));calls.push({name,args,alpha:c.globalAlpha});};
 c.save=()=>stack.push({fillStyle:c.fillStyle,globalAlpha:c.globalAlpha,imageSmoothingEnabled:c.imageSmoothingEnabled,matrix:[...c.matrix]});c.restore=()=>{assert(stack.length);Object.assign(c,stack.pop());};c.translate=(x,y)=>{c.matrix[4]+=x;c.matrix[5]+=y;};c.transform=(...matrix)=>{c.matrix=matrix;};return {c,stack,calls};
}
const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

test('real horizontal private doors become aligned upright openings while vertical doors stay out of the partition layer',()=>{
 let currentDoors=0,sourceDoors=0,previousDoors=0,sourceSolidFronts=0;
 const active=requests.map(getInteriorBase),previous=active.flatMap(s=>s.roomLayoutLegacySources?.slice(1)||[]);assert.equal(previous.length,23);
 for(const [version,models]of [['current',active],['preserved',active.map(preserved)],['previous',previous]])for(const s of models){
  const before=JSON.stringify(s),{groups}=wideRoomSouthPartitionGeometry(s);
  if(!s.wideRoomExpansion)assert.equal(groups.length,0);
  else if(version!=='preserved'){assert.equal(groups.length,2,s.id+' has two front-facing private rooms');assert(groups.every(g=>g.doors.length===1),s.id+' has an upright door in each private frontage');}
  for(const g of groups){
   assert(g.walls.length);assert.equal(g.wallpaper,s.homeMaterialSuite.wallpaper,'The hallway side of a bathroom uses the home dry wallpaper');
   for(const wall of g.walls){assert(s.walls.some(w=>JSON.stringify(w)===JSON.stringify(wall)));assert.equal(g.floorY,wall.y+wall.h/2);}
   for(const face of g.faces){assert.equal(face.y,g.floorY-96);assert.equal(face.h,96+g.thickness/2);}
   if(version==='preserved'&&!g.doors.length)sourceSolidFronts++;
   for(const d of g.doors){if(version==='preserved')sourceDoors++;else if(version==='previous')previousDoors++;else currentDoors++;assert(s.privacyDoors.includes(d));assert.equal(d.axis,'horizontal');assert.equal(d.length,36);assert.equal(d.y,g.floorY);for(const face of g.faces)assert(!intersects(face,{x:d.x,y:g.floorY-96,w:d.length,h:96+g.thickness/2}),'No face or cap crosses the real door opening');}
  }
  assert.equal(JSON.stringify(s),before);
 }
 assert.equal(currentDoors,62);assert.equal(sourceDoors,20);assert.equal(previousDoors,46);assert(sourceSolidFronts>=10,'Preserve front walls in the original homes with side-facing private doors');
 const player=getInteriorBase({kind:'apartment',resident:'player'}),current=wideRoomSouthPartitionGeometry(player),original=wideRoomSouthPartitionGeometry(preserved(player));assert.equal(current.groups.length,2);assert(current.groups.every(g=>g.doors.length===1));assert.equal(original.groups.length,2);assert(original.groups.every(g=>g.doors.length===0));
});

test('north walls, detached floor strips and an existing complete native wallpaper face are never doubled',()=>{
 const fixture={kind:'showroom',wideRoomExpansion:{},height:600,rooms:[{id:'bedroom',functionalRole:'bedroom',x:20,y:100,w:300,h:200}],walls:[{x:20,y:84,w:300,h:16},{x:20,y:300,w:300,h:16},{x:350,y:410,w:120,h:16}],privacyDoors:[]};
 let g=wideRoomSouthPartitionGeometry(fixture);assert.equal(g.groups.length,1);assert.equal(g.groups[0].floorY,308);
 const existing={...fixture,rooms:[...fixture.rooms,{id:'living',functionalRole:'living',x:20,y:390,w:300,h:150,wallpaperAreas:[{x:20,y:290,w:300,h:96}]}]};assert.equal(wideRoomSouthPartitionGeometry(existing).groups.length,0);
 for(const id of ['miles','dj']){const current=getInteriorBase({kind:'apartment',resident:id});assert.equal(wideRoomSouthPartitionGeometry(preserved(current)).groups.length,0,'The preserved lower-room north face remains authoritative');assert.equal(wideRoomSouthPartitionGeometry(current).groups.length,2,'The new default has two distinct private frontages');}
});

test('room and doorway focus fades only the matching front wall through its twelve-pixel crossing apron',()=>{
 const s=scene('victorian-parlor'),{c}=context(),group=wideRoomSouthPartitionGeometry(s).groups[0],x=group.room.x+group.room.w/2;
 const opacity=player=>wideRoomPartitionDrawables(c,s,{player})[0].opacity;
 assert.equal(opacity(undefined),1);assert.equal(opacity({x,y:200}),.3);assert.equal(opacity({x,y:group.floorY+12}),.3);assert.equal(opacity({x,y:group.floorY+13}),1);assert.equal(opacity({x:1000,y:200}),1);assert.equal(opacity({x,y:50}),1);
 const faded=wideRoomPartitionDrawables(c,s,{player:{x,y:300}});assert.equal(faded[0].opacity,.3);assert.equal(faded[1].opacity,1,'The neighboring bathroom remains opaque');assert.equal(wideRoomPartitionDrawables(c,s,{opacity:.5,player:{x,y:300}})[0].opacity,.15);
});

test('drawables sort at the physical wall line and pass actual door references and openness without mutation',()=>{
 const s=scene('victorian-parlor'),before=JSON.stringify(s),{c,stack}=context(),initial={fillStyle:c.fillStyle,globalAlpha:c.globalAlpha,imageSmoothingEnabled:c.imageSmoothingEnabled,matrix:[...c.matrix]},seen=[];
 const entries=wideRoomPartitionDrawables(c,s,{player:{x:100,y:300},doorOpenness:d=>{seen.push(d);return .4;}});
 for(const entry of entries){assert.equal(entry.y,334);assert(entry.bounds.y<entry.y);assert.equal(entry.doors.length,1);entry.draw();}
 assert.deepEqual(seen,s.privacyDoors);assert.deepEqual({fillStyle:c.fillStyle,globalAlpha:c.globalAlpha,imageSmoothingEnabled:c.imageSmoothingEnabled,matrix:c.matrix},initial);assert.equal(stack.length,0);assert.equal(JSON.stringify(s),before);
 const order=[];[...entries.map((entry,index)=>({...entry,draw:()=>order.push('wall'+index)})),{y:330,draw:()=>order.push('behind')},{y:350,draw:()=>order.push('in-front')}].sort((a,b)=>a.y-b.y).forEach(entry=>entry.draw());assert.equal(order[0],'behind');assert.equal(order.at(-1),'in-front');
});

test('the physical opening remains clear in face pixels and the shared upright leaf really opens',()=>{
 const source=scene('victorian-parlor'),s={...source,privacyDoors:[]},group=wideRoomSouthPartitionGeometry(s).groups[0],cv=createCanvas(s.width,s.height+108),c=cv.getContext('2d');
 wideRoomPartitionDrawables(c,s)[0].draw();for(let y=group.floorY-96;y<group.floorY+8;y++)for(let x=258;x<294;x++)assert.equal(c.getImageData(x,y,1,1).data[3],0,'Static face paints across the real 36px doorway');
 const render=openness=>{const canvas=createCanvas(source.width,source.height+108),context=canvas.getContext('2d');for(const entry of wideRoomPartitionDrawables(context,source,{doorOpenness:()=>openness}))entry.draw();return canvas;};
 const closed=render(0),open=render(1);assert.notDeepEqual(closed.toBuffer('image/png'),open.toBuffer('image/png'));
 const data=closed.getContext('2d').getImageData(0,0,closed.width,closed.height).data,geometry=wideRoomSouthPartitionGeometry(source);
 for(let y=0;y<closed.height;y++)for(let x=0;x<closed.width;x++)if(data[(y*closed.width+x)*4+3])assert(geometry.groups.some(g=>x>=g.bounds.x&&x<g.bounds.x+g.bounds.w&&y>=g.bounds.y&&y<g.bounds.y+g.bounds.h),`Pixel ${x},${y} escapes its depth-sort bounds`);
});

test('procedural wallpaper fallback receives finite world anchors and a complete dry-room face',()=>{
 const oldDocument=globalThis.document;let checked=0;
 const canvas=()=>{const cv=createCanvas(1,1),c=cv.getContext('2d');for(const name of ['translate','rect','fillRect']){const call=c[name].bind(c);c[name]=(...args)=>{args.forEach(value=>assert(Number.isFinite(value),`${name} must have a finite anchor`));checked++;return call(...args);};}return cv;};
 globalThis.document={createElement:tag=>{assert.equal(tag,'canvas');return canvas();}};
 try{
  const s=freeze({kind:'showroom',wideRoomExpansion:{},height:500,collectionOwner:'procedural-room',color:'#987b60',trim:'#ead9bc',rooms:[{id:'bedroom',functionalRole:'bedroom',x:28,y:106,w:300,h:200,wallpaper:{pattern:'botanical-leaf',colors:['#9aab90','#f0e2c2','#455443','#ac945e']}}],walls:[{x:28,y:306,w:300,h:16}],privacyDoors:[]}),cv=createCanvas(400,500),c=cv.getContext('2d');
  const entries=wideRoomPartitionDrawables(c,s);assert.equal(entries.length,1);entries[0].draw();assert(checked>10);assert(c.getImageData(80,250,1,1).data[3]>0);assert(c.getImageData(200,310,1,1).data[3]>0);clearWideRoomPartitionCache(s);
 }finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
});

test('the bounded face cache survives animation and retires only the requested scene on material refresh',()=>{
 clearWideRoomPartitionCache();const previousDocument=globalThis.document;globalThis.document={createElement:tag=>{assert.equal(tag,'canvas');return createCanvas(1,1);}};
 try{
  const a=scene('victorian-parlor'),b=scene('steampunk'),c=createCanvas(a.width,1000).getContext('2d');
  for(const s of [a,b])for(const entry of wideRoomPartitionDrawables(c,s))entry.draw();const warm=getWideRoomPartitionCacheStats();assert.equal(warm.entries,4);
  for(let n=0;n<200;n++)for(const entry of wideRoomPartitionDrawables(c,a,{player:{x:100,y:n%2?200:390},doorOpenness:()=>n%101/100}))entry.draw();const animated=getWideRoomPartitionCacheStats();assert.equal(animated.builds,warm.builds);assert.equal(animated.entries,warm.entries);assert.equal(animated.pixels,warm.pixels);
  clearWideRoomPartitionCache(a);assert.equal(getWideRoomPartitionCacheStats().entries,2);for(const entry of wideRoomPartitionDrawables(c,b))entry.draw();assert.equal(getWideRoomPartitionCacheStats().builds,warm.builds);for(const entry of wideRoomPartitionDrawables(c,a))entry.draw();assert.equal(getWideRoomPartitionCacheStats().builds,warm.builds+2);
  for(let n=0;n<70;n++){const variant={...a,id:'cache-'+n};for(const entry of wideRoomPartitionDrawables(c,variant))entry.draw();const stats=getWideRoomPartitionCacheStats();assert(stats.entries<=stats.maxEntries);assert(stats.pixels<=stats.maxPixels);}
 }finally{clearWideRoomPartitionCache();if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
 assert.equal(getWideRoomPartitionCacheStats().pixels,0);
});
