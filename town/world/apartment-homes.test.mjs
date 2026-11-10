import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildApartmentHome,createApartmentHomePlan} from './apartment-homes.mjs';
import {residents} from './resident-profiles.mjs';
import {APARTMENT_DECOR} from './apartment-decor-definitions.mjs';
import {SHOWROOM_FURNITURE} from './showroom-furniture-definitions.mjs';
import {APARTMENT_COLLECTION_ASSETS,getApartmentAsset} from './apartment-collections.mjs';
import {decorDefinitions} from './decor-definitions.mjs';
import {furnitureFacingBoxes} from './furniture-facing.mjs';

const catalog=new Map([...APARTMENT_DECOR,...SHOWROOM_FURNITURE,...APARTMENT_COLLECTION_ASSETS].map(a=>[a.id,a]));
const atlas=JSON.parse(readFileSync(new URL('../assets/decor/atlas.json',import.meta.url),'utf8'));
for(const def of decorDefinitions){const r=atlas[def.family].cells[def.index],scale=Math.min(def.maxW/r.w,def.maxH/r.h);catalog.set(def.id,{w:Math.ceil(r.w*scale),h:Math.ceil(r.h*scale)});}
const rect=(x,y,w,h)=>({x,y,w,h});
const helpers={residents,
 shell(id,title,width,height,color,trim){return {id,title,width,height,color,trim,spawn:{x:width/2,y:975},solids:[rect(0,0,width,106),rect(0,0,28,height),rect(width-28,0,28,height),rect(0,height-28,width,28)],items:[],zones:[],rooms:[],walls:[],rugs:[],windows:[],signs:[],lights:[],actors:[]};},
 room(s,name,x,y,w,h,material){s.rooms.push({name,x,y,w,h,material});},
 wall(s,x,y,w,h){const r=rect(x,y,w,h);s.walls.push(r);s.solids.push(r);},
 addItem(s,asset,x,y,w,h,solid,rotation=0){const a=catalog.get(asset);assert.ok(a,'Known art '+asset);h=h||w*a.h/a.w;const item={asset,x,y,w,h,solid,rotation};s.items.push(item);
  if(solid){if(a.collectionOwner||asset.startsWith('apartment-')||asset.startsWith('showroom-'))s.solids.push(...furnitureFacingBoxes(a,item));else {const depth=Math.min(h*.48,w*.5);s.solids.push(rect(x-w*.43,y-depth,w*.86,depth));}}
  return item;},
 rug(s,x,y,w,h,color){s.rugs.push({x,y,w,h,color});},sign(){},light(){},windowAt(s,x,y,w){s.windows.push({x,y,w});},
 zone(id,label,x,y,w,h,action,extra){return {id,label,x,y,w,h,action,...extra};}
};
const scenes=residents.map(r=>buildApartmentHome(r.id,helpers));
const hit=(s,x,y,pad=16)=>x<40||x>s.width-40||y<122||y>s.height-40||s.solids.some(r=>x>=r.x-pad&&x<=r.x+r.w+pad&&y>=r.y-pad&&y<=r.y+r.h+pad);
function flood(s){
 const step=12,cols=Math.ceil(s.width/step),rows=Math.ceil(s.height/step),seen=new Uint8Array(cols*rows),queue=[];
 const sx=Math.floor(s.spawn.x/step),sy=Math.floor(s.spawn.y/step),start=sy*cols+sx;
 assert.equal(hit(s,s.spawn.x,s.spawn.y),false,s.id+' spawn');seen[start]=1;queue.push(start);
 for(let at=0;at<queue.length;at++){const i=queue[at],x=i%cols,y=Math.floor(i/cols);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy,k=Y*cols+X;if(X<0||Y<0||X>=cols||Y>=rows||seen[k]||hit(s,X*step+step/2,Y*step+step/2))continue;seen[k]=1;queue.push(k);}}
 return p=>{for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=Math.floor(p.x/step)+dx,y=Math.floor(p.y/step)+dy;if(x>=0&&y>=0&&x<cols&&y<rows&&seen[y*cols+x]&&Math.hypot(x*step+6-p.x,y*step+6-p.y)<20)return true;}return false;};
}

test('all eighteen identities keep their exact unit scale, home pose and clear journey corridor',()=>{
 assert.equal(scenes.length,18);
 for(const s of scenes){const wide=s.floor>=7;assert.equal(s.width,wide?2304:1088);assert.equal(s.height,1120);assert.equal(s.actors.length,1);assert.equal(s.actors[0].id,s.resident);assert.deepEqual([s.actors[0].x,s.actors[0].y],[s.width/2,wide?750:650]);
  for(let y=s.actors[0].y;y<=975;y+=4)assert.equal(hit(s,s.width/2,y),false,`${s.id} home journey y=${y}`);
 }
});

test('each home has exactly one private bedroom and bathroom with actual wide doorway gaps',()=>{
 for(const s of scenes){for(const role of ['bedroom','bathroom']){const rooms=s.rooms.filter(r=>r.functionalRole===role);assert.equal(rooms.length,1,s.id+' '+role);assert.ok(rooms[0].door);const door=s.privacyDoors.find(d=>d.roomId===role);assert.ok(door);assert.equal(door.length,132);assert.equal(door.open,true);
   const p={x:door.x,y:door.y+door.length/2};assert.equal(hit(s,p.x,p.y),false,s.id+' '+role+' doorway');
  }
  const roles=s.items.map(a=>a.furnitureRole);for(const role of ['bed','toilet','vanity','fridge','sink','stove','kitchen-storage','sofa','coffee-table','dining-table'])assert.equal(roles.filter(x=>x===role).length,1,s.id+' '+role);
  assert.equal(roles.filter(x=>x==='shower'||x==='bathtub').length,1,s.id+' bathing fixture');
 }
});

test('real padded collision permits every room and every practical fixture approach from the front door',()=>{
 for(const s of scenes){const reached=flood(s);for(const area of s.homePlan.rooms){assert.equal(hit(s,area.point.x,area.point.y),false,`${s.id}: ${area.id} standing point blocked`);assert.ok(reached(area.point),`${s.id}: cannot walk into ${area.id}`);}
  for(const p of s.homePlan.fixtureApproaches){assert.equal(hit(s,p.x,p.y),false,`${s.id}: ${p.role} approach blocked at ${p.x},${p.y}`);assert.ok(reached(p),`${s.id}: cannot reach ${p.role}`);}
 }
});

test('architectural variants and personal finish palettes prevent eighteen cloned four-room layouts',()=>{
 assert.equal(new Set(scenes.map(s=>s.homePlan.variant)).size,6);
 assert.ok(new Set(scenes.map(s=>JSON.stringify(s.homePlan.rooms.map(r=>[r.id,r.side,r.y,r.h])))).size>=6);
 assert.equal(new Set(scenes.map(s=>s.homePlan.finishes.accent)).size,18);
 for(const s of scenes){assert.ok(s.items.some(a=>a.furnitureRole==='signature-instrument'&&a.inspirationAsset===s.residentInfo.instruments[0]));assert.ok(s.items.some(a=>a.collectionSlot==='toy'));assert.ok(s.rooms.every(r=>r.floorFinish));}
 assert.equal(new Set(scenes.map(s=>s.homePlan.collectionStyle)).size,18);
 for(const s of scenes)for(const a of s.items.filter(a=>a.furnitureRole==='bed'||a.furnitureRole==='sofa')){
  const def=catalog.get(a.asset);assert.equal(def.style,s.homePlan.collectionStyle);
  assert.ok(Math.abs(a.w/a.h-def.w/def.h)<1e-10,`${s.id}: ${a.furnitureRole} stretched`);
  assert.ok(a.w<=a.targetBounds.w+1e-8&&a.h<=a.targetBounds.h+1e-8,`${s.id}: ${a.furnitureRole} enlarged footprint`);
 }
});

test('curated floor furnishings do not overlap one another',()=>{
 for(const s of scenes){
  const feet=s.items.flatMap(a=>a.solid?furnitureFacingBoxes(catalog.get(a.asset),a).map(box=>({...box,role:a.furnitureRole})):[]);
  for(let i=0;i<feet.length;i++)for(let j=i+1;j<feet.length;j++){const a=feet[i],b=feet[j],w=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),h=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);assert.ok(w<=2||h<=2,`${s.id}: ${a.role} overlaps ${b.role}`);}
 }
});

test('built-in furniture respects its room and no saved player furnishings are read or moved',()=>{
 const before=JSON.stringify(residents);
 for(const s of scenes)for(const a of s.items){assert.ok(a.w>0&&a.h>0);assert.ok(a.x>=28&&a.x<=s.width-28&&a.y>=(a.wallMounted?0:106)&&a.y<=s.height-28,`${s.id}: asset outside home ${a.asset}`);const def=catalog.get(a.asset);assert.equal(a.solid,def.solid&&!a.wallMounted&&!a.supportedBy,`${s.id}: ${a.asset} collision intent`);}
 assert.equal(buildApartmentHome('player',helpers),null);assert.equal(buildApartmentHome('missing',helpers),null);assert.equal(createApartmentHomePlan(null),null);assert.equal(JSON.stringify(residents),before);
});

test('wall decorations hang on actual north wall faces and bathroom mirrors align with their vanities',()=>{
 for(const s of scenes){
  for(const a of s.items.filter(a=>a.wallMounted)){const area=s.rooms.find(r=>r.id===a.roomId);assert.ok(area);assert.equal(a.y,area.y-10,`${s.id}: floating ${a.asset}`);assert.ok(a.h<=96&&a.y-a.h>=area.y-106,`${s.id}: artwork outside wall face`);}
  for(const a of s.items.filter(a=>a.wallMounted))for(const w of s.windows){const overlapX=Math.min(a.x+a.w/2,w.x+w.w/2+20)-Math.max(a.x-a.w/2,w.x-w.w/2-20),overlapY=Math.min(a.y,w.y+88)-Math.max(a.y-a.h,w.y-6);assert.ok(overlapX<=0||overlapY<=0,`${s.id}: ${a.asset} hangs across a window`);}
  const bath=s.rooms.find(r=>r.id==='bathroom'),vanity=s.items.find(a=>a.furnitureRole==='vanity'),mirrors=s.items.filter(a=>a.furnitureRole==='bathroom-mirror');
  assert.equal(mirrors.length,1);assert.equal(mirrors[0].x,vanity.x);assert.equal(vanity.y,bath.y+(s.homePlan.wide?120:100));
  if(s.homePlan.wide){const linen=s.items.find(a=>a.furnitureRole==='bathroom-storage');assert.equal(linen.collectionSlot,'linen-storage');assert.notEqual(linen.asset,s.items.find(a=>a.collectionSlot==='wardrobe').asset);assert.equal(linen.y,bath.y+120);}
 }
});

test('wall art and miniature electronics have sensible supporting furniture',()=>{
 for(const s of scenes){
  for(const a of s.items.filter(a=>a.supportedBy&&a.supportedBy!=='north-wall')){
   const parent=s.items.find(p=>p.roomId===a.roomId&&p.furnitureRole===a.supportedBy);assert.ok(parent,`${s.id}: missing support for ${a.asset}`);
   assert.equal(a.depth,parent.y+.25);assert.equal(a.solid,false);
   if(a.supportedBy==='bed'){const purpose=catalog.get(a.asset).purpose;assert.ok(['plush','cushion'].includes(purpose)||a.asset==='apartment-headphones-books',`${s.id}: electronics on bed`);}
   if(a.collectionSlot==='toy')assert.equal(a.supportedBy,'coffee-table');
   if(a.collectionSlot==='lava-lamp')assert.ok(['writing-desk','record-storage'].includes(a.supportedBy));
   if(a.collectionSlot==='arcade')assert.equal(a.supportedBy,'record-storage');
  }
 }
});

test('every furniture placement is unique within and across the eighteen homes and the player collection',()=>{
 const all=[];
 for(const s of scenes){
  assert.ok(s.items.length<=32);assert.equal(new Set(s.items.map(a=>a.asset)).size,s.items.length);assert.equal(new Set(s.items.map(a=>a.collectionSlot)).size,s.items.length);
  for(const a of s.items){assert.equal(a.collectionOwner,s.resident);assert.equal(catalog.get(a.asset).collectionOwner,s.resident);assert.ok(a.visualSignature);all.push(a.asset);}
  assert.equal(s.rugs.length,0,'the repeated generic runner should not return');
 }
 assert.equal(new Set(all).size,all.length);
 for(const slot of ['bed','sofa','wardrobe','rug','poster','toy','lava-lamp','arcade'])assert.ok(!all.includes(getApartmentAsset('player',slot).id));
});

test('each compact and wide home has four coherent unique whimsy signatures',()=>{
 for(const s of scenes){const whimsical=s.items.filter(a=>a.whimsy);assert.deepEqual(new Set(whimsical.map(a=>a.whimsyKind)),new Set(['poster','lava-lamp','arcade','toy']));
  const arcade=whimsical.find(a=>a.collectionSlot==='arcade'),lava=whimsical.find(a=>a.collectionSlot==='lava-lamp');assert.equal(lava.motionKind,'lava');assert.equal(arcade.motionKind,'arcade');
  assert.equal(arcade.solid,s.homePlan.wide);assert.equal(!!arcade.miniature,!s.homePlan.wide);
  if(!s.homePlan.wide)assert.equal(arcade.supportedBy,'record-storage');
 }
});

test('the favored wide room footprints retain their approved geometry',()=>{
 const expected={
  ella:[[36,112,934,540],[1338,700,930,340],[1338,112,930,430],[36,730,934,310]],
  nina:[[1338,112,930,370],[36,440,934,360],[36,112,934,270],[1338,560,930,480]],
  miles:[[36,112,934,400],[1338,112,930,330],[36,590,934,450],[1338,530,930,510]],
  dj:[[1338,112,930,540],[36,112,934,320],[36,500,934,540],[1338,720,930,320]],
  'vee-jay':[[36,112,934,430],[36,680,934,360],[1338,112,930,350],[1338,530,930,510]],
  zizi:[[1338,650,930,390],[1338,112,930,340],[36,112,934,360],[36,550,934,490]]
 };
 expected.metronome=expected.ella;expected.schoenberg=expected.nina;
 for(const s of scenes.filter(s=>s.homePlan.wide))assert.deepEqual(s.homePlan.rooms.slice(0,4).map(a=>[a.x,a.y,a.w,a.h]),expected[s.resident]);
});

test('mini arcade cabinets and lava lamps fit their supporting console or desk',()=>{
 for(const s of scenes)for(const a of s.items.filter(a=>a.supportedBy&&a.supportedBy!=='north-wall')){
  const parent=s.items.find(p=>p.roomId===a.roomId&&p.furnitureRole===a.supportedBy);
  assert.ok(a.x-a.w/2>=parent.x-parent.w/2-2&&a.x+a.w/2<=parent.x+parent.w/2+2,`${s.id}: ${a.collectionSlot} overhangs its support`);
 }
});

test('the corner kitchen counter visibly connects to the stove end of its back run',()=>{
 for(const s of scenes){const stove=s.items.find(a=>a.furnitureRole==='stove'),counter=s.items.find(a=>a.furnitureRole==='kitchen-storage');
  assert.equal(counter.connectedTo,'stove');
  const overlapX=Math.min(stove.x+stove.w/2,counter.x+counter.w/2)-Math.max(stove.x-stove.w/2,counter.x-counter.w/2);
  const overlapY=Math.min(stove.y,counter.y)-Math.max(stove.y-stove.h,counter.y-counter.h);
  assert.ok(overlapX>=0&&overlapY>=0,`${s.id}: detached kitchen return`);
  assert.equal(counter.y-stove.y,s.homePlan.wide?0:80);
 }
});

test('wide living areas have a cardinal conversation seat and task light beside their focal group',()=>{
 let groups=0;
 for(const scene of scenes){
  const chair=scene.items.find(item=>item.designRole==='conversation-seat');if(!chair)continue;groups++;
  const living=scene.rooms.find(area=>area.id==='living'),table=scene.items.find(item=>item.furnitureRole==='coffee-table'),lamp=scene.items.find(item=>item.designRole==='reading-task-light');
  assert.equal(chair.rotation,living.side==='left'?90:270);assert(lamp);
  const box=furnitureFacingBoxes(catalog.get(chair.asset),chair)[0],cx=box.x+box.w/2;
  assert.equal(Math.sign(table.x-cx),living.side==='left'?-1:1,'Seat faces the coffee/listening group');
  assert(Math.abs(cx-table.x)<table.w/2+102,'Seat must belong to the group, not the far wall');
  assert(scene.homePlan.taskLights.some(light=>Math.abs(light.x-cx)<1&&light.r===150));
 }
 assert(groups>=6,'Every wide home without a separate reading room gets a conversation group');
});
