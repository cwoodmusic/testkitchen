import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeKnownTerrainProject,knownTerrainRepairCount,knownSouthwestCoastRepairCount} from './known-terrain-repairs.mjs';
import {knownTerrainRepairs} from './known-terrain-repair-data.mjs';
import {knownSouthwestCoastRepairs} from './southwest-coast-repair-data.mjs';
import {height,surfaceAt,parseProject} from './model.mjs';

const current=()=>JSON.parse(readFileSync(new URL('../maps/coda-town-plaza-boardwalk.json',import.meta.url)));
const published=()=>{const d=current();for(const[key,before]of knownSouthwestCoastRepairs)d.cells[key]=structuredClone(before);return d;};
const preCleanup=()=>{const d=published();for(const[key,before]of knownTerrainRepairs)d.cells[key]=structuredClone(before);return d;};
const hasSand=a=>a.surface==='sand'||a.paint?.materials.some(m=>m.surface==='sand')||a.curves?.some(q=>hasSand(q.under));

test('both published save generations reach the new southwest grass coast in one read without modifying stored project data',()=>{
 assert.equal(knownTerrainRepairCount,987);assert.equal(knownSouthwestCoastRepairCount,94);
 for(const make of [published,preCleanup]){
  const d=make(),raw=JSON.stringify(d),fixed=normalizeKnownTerrainProject(d);assert.deepEqual(fixed,current());assert.equal(JSON.stringify(d),raw);assert.notEqual(fixed,d);assert.equal(normalizeKnownTerrainProject(fixed),fixed);
  for(const key of ['objects','spawn','edges'])assert.equal(fixed[key],d[key]);
 }
});

test('the entire pictured headland has continuous grass at level1 with the exact same water contour',()=>{
 const old=published(),fresh=current();let samples=0;
 for(const[key,before,after]of knownSouthwestCoastRepairs){
  const[x,y]=key.split(',').map(Number);assert((x+.5)*64>=3040&&(x+.5)*64<7040&&(y+.5)*64>=10240&&(y+.5)*64<11840);assert.equal(after.surface,'grass');assert.equal(after.level,1);assert(!hasSand(after));assert.equal(after.paint,undefined);
  assert.equal(after.curves?.length,before.curves?.length);for(let i=0;i<(before.curves?.length||0);i++){assert.equal(after.curves[i].mask,before.curves[i].mask);assert.equal(after.curves[i].kind,'height');assert.deepEqual(after.curves[i].under,before.curves[i].under);}
  for(let dy=2;dy<64;dy+=4)for(let dx=2;dx<64;dx+=4){const X=x*64+dx,Y=y*64+dy,water=surfaceAt(old,X,Y)==='water';assert.equal(surfaceAt(fresh,X,Y)==='water',water,key+': the waterline must not move');assert.equal(height(fresh,X,Y),water?0:48,key+': grass meets the original sea rather than a lower sand shelf');samples++;}
 }
 assert.equal(samples,94*256);
 for(let y=160;y<185;y++)for(let x=47;x<110;x++)assert(!hasSand(fresh.cells[`${x},${y}`]),`${x},${y}: no hidden sand under-layer remains in the pictured headland`);
});

test('the larger beach, stairs, brick plaza, boats, boardwalk and every other map cell retain their authored state',()=>{
 const old=published(),fresh=current(),changed=new Set(knownSouthwestCoastRepairs.map(([key])=>key));
 for(const[key,before]of Object.entries(old.cells))if(!changed.has(key))assert.deepEqual(fresh.cells[key],before,key);
 for(const[key,before]of Object.entries(old.cells))if(before.stairs||before.bridge||before.pier||['brick','cobble','wood'].includes(before.surface))assert.deepEqual(fresh.cells[key],before,key+': public access stays unchanged');
 assert.deepEqual(fresh.objects,old.objects);assert.deepEqual(fresh.spawn,old.spawn);assert.deepEqual(fresh.edges,old.edges);
 assert.equal(fresh.cells['150,166'].surface,'sand');assert.deepEqual(parseProject(JSON.stringify(fresh),new Set(fresh.objects.map(o=>o.asset))),fresh);
});

test('custom coast painting and contours are preserved from either saved generation',()=>{
 for(const make of [published,preCleanup]){
  const d=make(),key=knownSouthwestCoastRepairs.find(([,before])=>before.curves)[0];d.cells[key]=structuredClone(d.cells[key]);d.cells[key].surface='wood';d.cells[key].curves[0].style='rocky';
  const raw=JSON.stringify(d),fixed=normalizeKnownTerrainProject(d);assert.equal(fixed.cells[key],d.cells[key]);assert.equal(JSON.stringify(d),raw);
 }
 const unrelated=published();unrelated.objects=unrelated.objects.filter(o=>o.asset!=='coda-residences');assert.equal(normalizeKnownTerrainProject(unrelated),unrelated);
});
