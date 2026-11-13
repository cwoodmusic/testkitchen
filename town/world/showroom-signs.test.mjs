import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SHOWROOMS} from './showroom-layout.mjs';
import {getInterior} from './urban-interiors.mjs';
import {SHOWROOM_SIGN_ASSET,createShowroomThemeSign,showroomThemeSignZone,drawShowroomThemeSign} from './showroom-signs.mjs';

const inside=(p,r)=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;
const distance=(p,r)=>Math.hypot(p.x-Math.max(r.x,Math.min(r.x+r.w,p.x)),p.y-Math.max(r.y,Math.min(r.y+r.h,p.y)));
const blocked=(m,p)=>m.solids.some(r=>inside(p,{x:r.x-16,y:r.y-16,w:r.w+32,h:r.h+32}));

test('all twelve showroom doors have one small public theme sign with a clear independent E interaction',()=>{
 const seen=new Set();
 for(const display of SHOWROOMS){
  const model=getInterior({kind:'shop',floor:display.storeFloor}),matching=model.showroomSigns.filter(s=>s.showroomId===display.id);
  assert.equal(matching.length,1);const sign=matching[0];seen.add(sign.id);
  assert.deepEqual(sign,createShowroomThemeSign(display));assert.equal(sign.asset,SHOWROOM_SIGN_ASSET);assert.equal(sign.solid,true);
  assert.deepEqual(sign.base,{x:sign.x-12,y:sign.y-8,w:24,h:10});assert(model.solids.includes(sign.base));
  assert.equal(sign.title,display.name);assert.equal(sign.description,display.style);assert.equal(sign.w,84);assert.equal(sign.h,83);
  assert.equal(sign.storeFloor,display.storeFloor);assert.equal(sign.doorId,'showroom-'+display.id);
  const info=model.zones.find(z=>z.id===sign.id),entry=model.zones.find(z=>z.action==='showroom'&&z.showroomId===display.id);
  assert.deepEqual(info,showroomThemeSignZone(sign));assert(!inside(display.lobbyApproach,info));
  assert(distance(display.lobbyApproach,entry)<distance(display.lobbyApproach,info),'Door entry remains the nearest E action at the threshold');
  assert.equal(distance(sign.approach,info),0);assert(distance(sign.approach,entry)>0,'A sign reader gets its info action independently');
  assert(!blocked(model,sign.approach));assert(blocked(model,{x:sign.x,y:sign.y}),'The stand has a physical base');
  const route=[display.lobbyApproach,{x:display.lobbyApproach.x,y:sign.approach.y},sign.approach];
  for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/4);for(let n=0;n<=steps;n++)assert(!blocked(model,{x:a.x+(b.x-a.x)*n/steps,y:a.y+(b.y-a.y)*n/steps}),'A player must reach the reading spot from the door queue');}
  assert(sign.base.y>display.y+display.h,'The small stand base belongs in the public hallway');assert(inside(sign.approach,display.hallway),'The reading spot belongs to the shared hallway');
  assert(sign.x-sign.w/2>display.threshold.x+display.triggerHalfWidth,'A framed marquee stays beside the south doorway instead of covering its queue');
  assert(!model.items.some(item=>item.id===sign.id||item.asset===SHOWROOM_SIGN_ASSET),'Only the explicit24×10 base creates sign collision');
  for(const stair of model.stairs)assert(!(sign.x-sign.w/2<stair.x+stair.w&&sign.x+sign.w/2>stair.x&&sign.y-sign.h<stair.y+stair.h&&sign.y>stair.y),'A sign must remain clear of the pictured stair flight');
  assert(!model.signs.some(label=>label.text===display.name),'Theme names are removed from the public floor');
  const room=getInterior({kind:'showroom',showroomId:display.id,floor:display.storeFloor});
  assert(!room.signs.some(label=>label.text===display.name),'Theme names are removed from the private floor');
 }
 assert.equal(seen.size,12);
 for(const floor of [1,2]){
  const model=getInterior({kind:'shop',floor});
  assert.equal(model.showroomSigns.length,floor===1?8:4);
  assert(model.signs.some(s=>s.text==='LIFT'));assert(!model.signs.some(s=>s.text==='CODA FURNISHINGS'));assert(model.signs.every(s=>s.y<=106),'Only north-wall signage remains; the walkable floor has no painted labels');
 }
});

test('theme signs draw their existing native marquee upright at its own aspect and only overlay a small number plaque',()=>{
 const sign=createShowroomThemeSign(SHOWROOMS[0]),image={width:112,height:95},asset={w:112,h:95,canvas:image},images=[],texts=[];
 const c={save(){},restore(){},drawImage(...args){images.push(args);},fillRect(){},fillText(...args){texts.push(args);}};
 drawShowroomThemeSign(c,sign,new Map([[SHOWROOM_SIGN_ASSET,asset]]));
 assert.equal(images.length,1);assert.equal(images[0][0],image);
 const [,x,y,w,h]=images[0];assert.equal(w/h,asset.w/asset.h);assert.equal(x+w/2,sign.x);assert.equal(y+h,sign.y);
 assert(w<=sign.w&&h<=sign.h);assert.deepEqual(texts.map(t=>t[0]),['01']);
});
