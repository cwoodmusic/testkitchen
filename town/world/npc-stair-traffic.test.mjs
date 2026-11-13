import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blank,height} from './model.mjs';
import {createAmbientNPCs} from './ambient-npcs.mjs';
import {createNPCStairTraffic} from './npc-stair-traffic.mjs';
import {normalizeKnownTerrainProject} from './known-terrain-repairs.mjs';
import {knownTerrainRepairs} from './known-terrain-repair-data.mjs';

const authored=JSON.parse(readFileSync(new URL('../maps/coda-town-plaza-boardwalk.json',import.meta.url),'utf8'));
const catalog=new Map(),point=a=>({x:a.x,y:a.y}),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function walker(actor,from,to){
 Object.assign(actor,from,{state:'walking',location:{kind:'street'},hidden:false,seated:false,walking:true,conversation:null,_held:false,_goingHome:false,_homeDue:Infinity,_path:[to],_goal:{id:'crossing:'+actor.id,kind:'hangout',approach:to,...to,_arrival:true},_wait:1000,_progress:{...from,time:0},_socialAfter:Infinity});
}
function crossing(doc,{center=9220,count=6,lanes=false,player=null,held=false}={}){
 const sim=createAmbientNPCs({getProject:()=>doc,catalog,getPlayer:()=>player,count,random:()=>.5});sim.update(0);
 Object.assign(sim.district.bounds,{x0:7000,y0:8500,x1:9700,y1:11000});
 const half=count/2,arrived=new Set();
 for(const [i,actor]of sim.residents.entries()){
  const down=i<half,n=down?i:i-half,x=lanes?[8800,8864,8928][i%3]:8864,y=down?center-220-n*85:center+220+n*85;
  walker(actor,{x,y},{x,y:down?center+600-n*90:center-600+n*90});
  if(held&&i===2)Object.assign(actor,{y:center,_held:true});
 }
 let smallestPlayerGap=Infinity;
 for(let frame=0;frame<3600&&arrived.size<count-(held?1:0);frame++){
  sim.update(1/60);
  for(const actor of sim.residents){
   if(player)smallestPlayerGap=Math.min(smallestPlayerGap,distance(actor,player));
   if(sim.events.some(e=>e.type==='arrive'&&e.id===actor.id&&e.destination==='crossing:'+actor.id)){arrived.add(actor.id);actor._held=true;}
  }
 }
 assert.equal(arrived.size,count-(held?1:0),'Every moving resident must finish instead of deadlocking or abandoning their goal');
 assert(!sim.events.some(e=>e.type==='unreachable'),'A temporary crowd must not turn this stair crossing into an unreachable destination');
 if(player)assert(smallestPlayerGap>=40-1e-6,'Passing must retain physical foot separation from the stopped player');
 return sim;
}

test('continuous stair flights are derived without joining different-height adjacent ramps or changing the map',()=>{
 const raw=JSON.stringify(authored),traffic=createNPCStairTraffic();traffic.reset(authored);
 assert.equal(traffic.size,3);assert.equal(traffic.at({x:8864,y:9220}),traffic.at({x:8800,y:9150}));assert.notEqual(traffic.at({x:8864,y:9220}),traffic.at({x:8864,y:10300}));assert.equal(JSON.stringify(authored),raw);
 const doc=blank();doc.cells['10,10']={surface:'wood',level:0,stairs:'north',stairBase:0,stairRise:1};doc.cells['11,10']={surface:'wood',level:3,stairs:'north',stairBase:3,stairRise:1};traffic.reset(doc);assert.equal(traffic.size,2);
 traffic.reset(blank());assert.equal(traffic.size,0);
});

for(const [name,center]of [['steep seven-level approach',9220],['shallow beach flight',10300]]){
 test(`${name} lets a head-on pair complete in both directions`,()=>{
  const raw=JSON.stringify(authored);crossing(authored,{center,count:2});assert.equal(JSON.stringify(authored),raw);
 });
 test(`${name} clears six opposing walkers across all three lanes`,()=>{
  const raw=JSON.stringify(authored);crossing(authored,{center,lanes:true});assert.equal(JSON.stringify(authored),raw);
 });
 test(`${name} clears six walkers around a stopped player`,()=>{
  const player={x:8864,y:center},before=point(player),raw=JSON.stringify(authored);crossing(authored,{center,player});assert.deepEqual(player,before);assert.equal(JSON.stringify(authored),raw);
 });
 test(`${name} lets five walkers pass a resident held in dialogue`,()=>{
  const sim=crossing(authored,{center,held:true});assert.deepEqual(point(sim.residents[2]),{x:8864,y:center});assert(sim.residents[2]._held);
 });
}

test('a resident on a different cliff level does not block the path below',()=>{
 const doc=blank();doc.spawn={x:8180,y:7000};for(let y=100;y<=115;y++)for(let x=128;x<=131;x++)doc.cells[x+','+y]={surface:'grass',level:2};
 const sim=createAmbientNPCs({getProject:()=>doc,catalog,count:2,random:()=>.5});sim.update(0);
 const [a,b]=sim.residents;walker(a,{x:8180,y:7250},{x:8180,y:6750});walker(b,{x:8208,y:7000},{x:8208,y:7000});b._held=true;
 assert.equal(height(doc,a.x,a.y),0);assert.equal(height(doc,b.x,b.y),96);
 const raw=JSON.stringify(doc);for(let frame=0;frame<600&&a.state==='walking';frame++)sim.update(1/60);
 assert.equal(a.y,6750);assert(!sim.events.some(e=>e.type==='passing-start'));assert.deepEqual(point(b),{x:8208,y:7000});assert.equal(JSON.stringify(doc),raw);
});

test('stair entry waits for the opposing group without stopping an existing bypass or a turn before the flight',()=>{
 const doc=blank();doc.cells['10,10']={surface:'wood',level:0,stairs:'north',stairBase:0,stairRise:1};const traffic=createNPCStairTraffic();traffic.reset(doc);
 const occupant={id:'first',_index:0,x:672,y:670,state:'walking',_path:[{x:672,y:800}]};
 const incoming={id:'second',_index:1,x:672,y:760,state:'walking',_path:[{x:672,y:600}]},before=JSON.stringify({doc,occupant,incoming});
 assert.equal(traffic.shouldWait(incoming,[occupant,incoming]),true);assert.equal(traffic.shouldWait(occupant,[occupant,incoming]),false);
 assert.equal(traffic.shouldWait({...incoming,_path:[{x:672,y:720},{x:800,y:720}]},[occupant]),false);
 assert.equal(traffic.shouldWait({...incoming,_passingRemaining:2},[occupant]),false);assert.equal(JSON.stringify({doc,occupant,incoming}),before);
});

test('old and repaired island terrain both retain the actual crowded stair and landing routes',()=>{
 const old={...authored,cells:{...authored.cells}};for(const [key,before]of knownTerrainRepairs)old.cells[key]=structuredClone(before);
 const raw=JSON.stringify(old),normalized=normalizeKnownTerrainProject(old),stairs=doc=>Object.entries(doc.cells).filter(([,a])=>a.stairs);
 assert.deepEqual(stairs(normalized),stairs(old));assert.equal(normalized.objects,old.objects);assert.equal(JSON.stringify(old),raw);
 crossing(old,{lanes:true});crossing(normalized,{player:{x:8864,y:9220}});assert.equal(JSON.stringify(old),raw);
});
