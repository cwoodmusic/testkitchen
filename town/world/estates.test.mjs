import {test} from 'node:test';import assert from 'node:assert/strict';
import {residents} from '../model.mjs';import {estateDefinitions,estateBoxes} from './estates.mjs';
import {blank,blocked,parseProject} from './model.mjs';
test('every resident and the player has a distinct portable estate',()=>{assert.deepEqual(new Set(estateDefinitions.map(a=>a.id)),new Set([...residents.map(a=>a.id),'player']));assert.equal(estateDefinitions.length,19);assert(new Set(estateDefinitions.map(a=>a.size)).size>=3);});
test('NPC homes are modestly smaller while retaining relative sizes and the player footprint',()=>{
 const npc=estateDefinitions.filter(a=>a.id!=='player');
 for(const a of npc){assert(a.size<a.sourceSize,a.id);assert(Math.abs(a.size/a.sourceSize-.85)<.001,a.id+' size');}
 assert.equal(estateDefinitions.find(a=>a.id==='haydn').size,1414);
 assert.equal(estateDefinitions.find(a=>a.id==='beethoven').size,1958);
 assert.equal(estateDefinitions.find(a=>a.id==='player').size,2048);
 for(const a of npc)for(const b of npc)if(a.sourceSize<b.sourceSize)assert(a.size<b.size);
});
test('houses and wings stay solid while former perimeter walls and garden entrances stay walkable',()=>{
 for(const a of estateDefinitions){
  const boxes=estateBoxes(a),catalog=new Map([[`estate-${a.id}`,{w:a.size,h:a.size,boxes}]]),d=blank(),x=8192,y=8192,s=a.size;
  d.objects.push({asset:`estate-${a.id}`,x,y,scale:1,rotation:0,collision:true,layer:'ground'});
  const solid=(u,v)=>blocked(d,x+(u-.5)*s,y+(v-1)*s,catalog);
  assert(solid(.5,.4),a.id+' house');assert(solid(.5,a.front-.02),a.id+' house front');
  if(['clara','nina','vee-jay','player'].includes(a.id))assert(solid(.91,.4),a.id+' house wing');
  for(const[u,v]of [[.045,.7],[.955,.7],[.2,.91],[.8,.91],[.045,.12],[.955,.12],[.5,.9],[.5,.75]])assert(!solid(u,v),a.id+' open yard at '+u+','+v);
  assert.doesNotThrow(()=>parseProject(JSON.stringify(d),new Set(catalog.keys())));
 }
});
