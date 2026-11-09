import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,blocked} from './model.mjs';
import {createAmbientNPCs} from './ambient-npcs.mjs';

function city(){
 const doc=blank();doc.spawn={x:8200,y:6350};
 const catalog=new Map([
  ['coda-residences',{w:400,h:600,urban:'tower',door:{x:200,y:600},boxes:[]}],
  ['coda-arcade',{w:500,h:400,boxes:[]}],
  ['shop',{w:400,h:400,urban:'shop',door:{x:200,y:400},boxes:[]}],
  ['decor-06-01',{w:200,h:160,boxes:[{x:0,y:70,w:200,h:50}]}],
  ['decor-07-06',{name:'Coffee cart',w:200,h:180,boxes:[{x:0,y:80,w:200,h:100}]}]
 ]);
 for(const[id,asset,x,y]of [['tower','coda-residences',8000,6000],['arcade','coda-arcade',8500,6000],['shop','shop',9000,6000],['bench','decor-06-01',8300,6400],['cart','decor-07-06',9300,6400]])doc.objects.push({id,asset,x,y,scale:1,rotation:0,layer:'objects',collision:true});
 const cam={x:8200,y:6200,zoom:1};let revision=0;
 const sim=createAmbientNPCs({getProject:()=>doc,catalog,getRevision:()=>revision,getCamera:()=>cam});sim.update(0);
 return {doc,catalog,sim,cam,edit:()=>revision++};
}

test('residents and cart hosts are independent of the camera and never write into a map',()=>{
 const {doc,sim,cam}=city(),before=JSON.stringify(doc);
 const poses=()=>sim.residents.map(({id,x,y,state,location})=>({id,x,y,state,location})),initial=poses(),vendors=sim.actors.filter(a=>a.role==='vendor').map(a=>({id:a.id,x:a.x,y:a.y}));
 for(const x of [1000,15000,6000]){cam.x=x;cam.zoom=.08;sim.update(0);assert.deepEqual(poses(),initial);}
 assert.equal(sim.residents.length,18);assert.equal(vendors.length,1);
 for(let frame=0;frame<200;frame++)sim.update(.1);
 assert.deepEqual(sim.actors.filter(a=>a.role==='vendor').map(a=>({id:a.id,x:a.x,y:a.y})),vendors);
 assert.equal(JSON.stringify(doc),before);
});

test('city routines complete room departures and returns with exclusive indoor presence',()=>{
 const {doc,catalog,sim}=city(),before=JSON.stringify(doc);const seen=new Set();
 for(let frame=0;frame<1800;frame++){
  sim.update(.1);
  for(const event of sim.events)seen.add(event.type);
  const ids=new Set(sim.actors.map(a=>a.id));
  for(const resident of sim.residents){
   if(resident.location.kind==='street'){
    if(resident.walking)assert.equal(blocked(doc,resident.x,resident.y,catalog),false);
   }else if(!resident.hidden){
    const actors=sim.interiorActors(resident.location);assert(actors.some(a=>a.id===resident.id));assert(!ids.has(resident.id));
   }
  }
  const seats=sim.actors.filter(a=>a.seated).map(a=>a.seatId);assert.equal(new Set(seats).size,seats.length);
 }
 for(const type of ['leave-room','exit-building','enter-building','enter-room','sit','stand','chat'])assert(seen.has(type),'Missing routine event '+type);
 assert.equal(JSON.stringify(doc),before);
});

test('edited geometry invalidates routes and safely recovers a resident without a camera relocation',()=>{
 const {doc,catalog,sim,edit}=city(),actor=sim.actors.find(a=>a.role==='resident'&&!a.seated);
 const key=`${Math.floor(actor.x/64)},${Math.floor(actor.y/64)}`;doc.cells[key]={surface:'water',level:0};edit();sim.update(.1);
 const current=sim.residents.find(a=>a.id===actor.id);assert(current.hidden||!blocked(doc,current.x,current.y,catalog));
 assert.equal(sim.residents.length,18);
});


test('a player conversation holds one resident while the rest of the city keeps moving',()=>{
 const {sim}=city(),actor=sim.residents.find(a=>a.state==='idle'),time=sim.simulationTime;
 sim.setConversation(actor.id,true,{x:actor.x+80,y:actor.y});const before={x:actor.x,y:actor.y};
 for(let i=0;i<100;i++)sim.update(.1);
 assert.equal(actor.x,before.x);assert.equal(actor.y,before.y);assert.equal(actor.facing,'right');assert(sim.simulationTime>time+9);
 assert(!actor.conversation);sim.setConversation(actor.id,false);assert.equal(actor._held,false);
 for(let i=0;i<100;i++)sim.update(.1);
 assert(actor.walking||actor.x!==before.x||actor.y!==before.y);
});
