import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerRoadLights,roadLightDefinitions,uplightDefinitions} from './road-light-art.mjs';
import {cityLights} from './city-night.mjs';
import {blank,blocked} from './model.mjs';

function fixtures(){
 const catalog=new Map(),add=(id,name,group,w,h,draw,boxes=[],layer='objects')=>{const a={id,name,group,w,h,draw,boxes,layer};catalog.set(id,a);return a;};
 registerRoadLights(add,{props:[null,null,{sw:247,sh:476}]});return catalog;
}
const placement=(asset,x=8192,y=6144,more={})=>({id:asset,asset,x,y,scale:1,rotation:0,layer:'objects',collision:true,...more});

test('road lights are large native fixtures with foot collisions, while ground uplights stay walkable',()=>{
 const catalog=fixtures();assert.equal(catalog.size,6);
 for(const def of roadLightDefinitions){
  const a=catalog.get(def.id);assert(a.h>=700);assert(a.w>=500);assert.equal(a.kit,'urban');assert.equal(a.collisionDefault,true);assert.equal(a.lightEmitters.length,def.variant==='double'?2:1);
  const d=blank();d.objects.push(placement(a.id,1000,1000));assert.equal(blocked(d,1000,990,catalog),true);assert.equal(blocked(d,1000,900,catalog),false);
  assert(a.boxes.every(b=>b.y>=a.h-48));
 }
 for(const def of uplightDefinitions){
  const a=catalog.get(def.id);assert.equal(a.collisionDefault,false);assert.equal(a.boxes.length,0);assert.equal(a.lightEmitters[0].kind,'uplight');assert.deepEqual(a.lightEmitters[0].color,def.color);
  const d=blank();d.objects.push(placement(a.id,1000,1000));assert.equal(blocked(d,1000,990,catalog),false);
 }
});

test('light anchors follow the exact scale, rotation and elevation used by their native assets',()=>{
 const catalog=fixtures(),d=blank(),a=catalog.get('urban-roadlight-neon');
 d.cells['128,96']={surface:'asphalt',level:2};const o=placement(a.id,8192,6144,{scale:.5,rotation:90});d.objects.push(o);
 const before=JSON.stringify(d),[light]=cityLights(d,catalog),emitter=a.lightEmitters[0];
 const dx=(emitter.u*a.w-a.w/2)*o.scale,dy=(emitter.v*a.h-a.h)*o.scale;
 assert(Math.abs(light.x-(o.x-dy))<1e-8);assert(Math.abs(light.y-(o.y-96+dx))<1e-8);
 assert.equal(light.gx,o.x);assert.equal(light.gy,o.y-96);assert.equal(light.radius,emitter.radius*.5*1.5);assert.deepEqual(light.color,[118,230,255]);assert.equal(JSON.stringify(d),before);
});

test('the gazebo emits from hanging lamps, its lit cupola and its string lights',()=>{
 const catalog=new Map([['props-4-960',{w:960,h:970}]]),d=blank();d.objects.push(placement('props-4-960'));
 const lights=cityLights(d,catalog);assert.equal(lights.length,12);assert.equal(lights.filter(l=>l.kind==='lamp').length,4);assert.equal(lights.filter(l=>l.kind==='window').length,8);
 assert(lights.every(l=>l.power>0&&l.radius>0&&Number.isFinite(l.x)&&Number.isFinite(l.y)));
});
