import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createAutomaticDoors} from '../town/world/automatic-doors.mjs';
import {FLOOR_COUNT,residents,getInterior,residentInteractionZones,configureUrbanInteriors} from '../town/world/urban-interiors.mjs';
import {APARTMENT_COLLECTION_ASSETS} from '../town/world/apartment-collection-definitions.mjs';
import {SHOWROOMS,STORE_FLOOR_COUNT,STORE_VERTICAL_CORE} from '../town/world/showroom-layout.mjs';

// Run the production controller with actual scene geometry/door physics. Only
// DOM drawing and native artwork loading are replaced; no browser/image work.
const urbanURL=new URL('../town/world/urban.mjs',import.meta.url);
const controllerSource=readFileSync(urbanURL,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export function /gm,'function ').replaceAll('import.meta.url',JSON.stringify(urbanURL.href))+'\n({createUrbanController,buildingDoor});';
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.style={};this.hidden=false;this.open=false;this.events=new Map();}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=[...children];}
 addEventListener(name,fn){this.events.set(name,fn);}
 setAttribute(){}
 close(){this.open=false;this.events.get('close')?.();}
 showModal(){this.open=true;}
 focus(){}
}
function fixture({preview=false}={}){
 const catalog=new Map(APARTMENT_COLLECTION_ASSETS.map(d=>[d.id,d]));
 for(const [id,urban]of [['tower','tower'],['store','shop'],['opera','opera']])catalog.set(id,{id,urban,w:1000,h:900,door:{x:500,y:880}});
 const objects=['tower','store','opera'].map((asset,i)=>({id:asset,asset,x:2000+i*4000,y:2000,scale:1,rotation:0}));
 const project={objects},original=JSON.stringify(project),outside={x:0,y:0},actors=[],elements=[],events=new Map(),win={CodaFurnitureCatalog:[]};let clock=0,storageWrites=0;
 const document={head:new Element('head'),body:new Element('body'),createElement(tag){const e=new Element(tag);elements.push(e);return e;}};
 const context={catalog,window:win,parent:win,document,location:{origin:'https://coda.invalid'},URL,performance:{now:()=>clock},matchMedia:()=>({matches:false}),localStorage:{getItem:()=> 'active-classroom',setItem(){storageWrites++;}},addEventListener:(type,fn)=>events.set(type,fn),setTimeout,
  FLOOR_COUNT,residents,getInterior,residentInteractionZones,configureUrbanInteriors,createAutomaticDoors,SHOWROOMS,STORE_FLOOR_COUNT,STORE_VERTICAL_CORE,
  renderInterior(){},createRoomStorage(){throw Error('Unexpected storage access');},roomItemBoxes:()=>[],apartmentDecorBounds:()=>[],apartmentWallDecorBounds:()=>[],furnitureFacingPlacement:()=>null,furnitureFacingBounds:()=>null,
  createStagePerformance:()=>({assetIds:[]}),stagePerformanceSignature:()=> 'test-performance',stageCollisionBoxes:()=>[],CONCERT_PROGRAMME:[{id:'test-performance'}]};
 const {createUrbanController,buildingDoor}=vm.runInNewContext(controllerSource,context,{filename:urbanURL.pathname});
 const canvas=new Element('canvas');canvas.id='door-controller-test';const q=createUrbanController({canvas,getProject:()=>project,getPlayer:()=>outside,getResidents:()=>actors,preview});
 const ctx=new Proxy({},{get:(_target,key)=>()=>{},set:()=>true});
 const frame=(keys=new Set(),dt=.04)=>{clock+=dt*1000;return q.frame(ctx,keys,dt,clock,1200,760,()=>{});};
 const walk=(normal,seconds=1)=>{const keys=new Set([normal.x>.5?'d':normal.x<-.5?'a':normal.y>.5?'s':'w']);for(let t=0;t<seconds;t+=.04)frame(keys);};
 const key=key=>q.keydown({key,repeat:false,preventDefault(){}});
 const approach=p=>{Object.assign(q.player,p.approach);frame();};
 return {q,project,original,outside,actors,buildingDoor,frame,walk,key,approach,dialog:elements.find(e=>e.tagName==='dialog'),hint:elements.find(e=>e.className==='urban-prompt'),assertUntouched(){assert.equal(JSON.stringify(project),original);assert.equal(storageWrites,0);},unlock(id){events.get('message')({origin:'https://coda.invalid',source:win,data:{type:'coda-town-state-result',people:[{id,relationship:{count:5}}]}});}};
}

test('street entrances and lobby exits wait for E and stay closed to player proximity',()=>{
 for(const [asset,kind]of [['tower','lobby'],['store','shop'],['opera','concert']]){
  const f=fixture(),object=f.project.objects.find(o=>o.asset===asset),door=f.buildingDoor(object);Object.assign(f.outside,{x:door.x,y:door.y+30});
  for(let i=0;i<30;i++)f.frame(new Set(['w']));assert.equal(f.q.scene,null);assert(f.q.automaticDoors.states.every(s=>s.openness===0));f.q.tick();assert.match(f.hint.textContent,/^E · Enter /);
  f.key('e');assert.equal(f.q.scene.kind,kind);const exit=f.q.portals.find(p=>p.action==='exit');assert(exit);f.approach(exit);f.walk(exit.enterNormal);assert.equal(f.q.scene.kind,kind,'Walking through the exit must not change scene');
  f.q.tick();assert.match(f.hint.textContent,/^E · /);f.key('e');assert.equal(f.q.scene,null);f.assertUntouched();
 }
});

test('apartment entrances retain E friendship checks while owner NPC door animation still works',()=>{
 const f=fixture();f.q.goFloor(residents.find(r=>r.id==='bach').floor);const portal=f.q.portals.find(p=>p.resident==='bach');f.approach(portal);f.walk(portal.enterNormal);assert.equal(f.q.scene.kind,'hall');assert.equal(f.q.automaticDoors.openness(portal.door),0);
 f.q.tick();assert.match(f.hint.textContent,/^E · .*Friendship level 5/);f.key('e');assert.equal(f.q.scene.kind,'hall');assert.equal(f.dialog.open,true);f.dialog.close();
 f.actors.push({id:'bach',x:portal.threshold.x,y:portal.threshold.y+30});for(let i=0;i<10;i++)f.frame();assert(f.q.automaticDoors.openness(portal.door)>.9,'Owner NPC keeps the entrance animation');f.walk(portal.enterNormal);assert.equal(f.q.scene.kind,'hall','An open owner NPC leaf does not auto-admit the player');
 f.actors.length=0;f.unlock('bach');f.key('e');assert.equal(f.q.scene.kind,'apartment');assert.equal(f.q.scene.resident,'bach');const exit=f.q.portals.find(p=>p.action==='exit');f.approach(exit);f.walk(exit.enterNormal);assert.equal(f.q.scene.kind,'apartment');f.key('e');assert.equal(f.q.scene.kind,'hall');f.assertUntouched();
});

test('showrooms on both store floors require E to enter and return, with manual floor controls intact',()=>{
 const f=fixture();f.q.enterBuilding(f.project.objects.find(o=>o.asset==='store'));
 for(const floor of [1,2]){
  assert.equal(f.q.goStoreFloor(floor),true);const display=SHOWROOMS.find(s=>s.storeFloor===floor),portal=f.q.portals.find(p=>p.showroomId===display.id);f.approach(portal);f.walk(portal.enterNormal);assert.equal(f.q.scene.kind,'shop');assert.equal(f.q.scene.floor,floor);assert.equal(f.q.automaticDoors.openness(portal.door),0);
  f.key('e');assert.equal(f.q.scene.kind,'showroom');assert.equal(f.q.scene.showroomId,display.id);const exit=f.q.portals.find(p=>p.action==='showroom-lobby');f.approach(exit);f.walk(exit.enterNormal);assert.equal(f.q.scene.kind,'showroom');f.key('e');assert.equal(f.q.scene.kind,'shop');assert.equal(f.q.scene.floor,floor);
 }
 const stairs=getInterior(f.q.scene).zones.find(z=>z.action==='store-floor');assert(stairs);Object.assign(f.q.player,{x:stairs.x+stairs.w/2,y:stairs.y+stairs.h/2});f.frame();assert.equal(f.q.scene.floor,2);f.key('e');assert.equal(f.q.scene.floor,1);
 const lift=getInterior(f.q.scene).zones.find(z=>z.action==='store-elevator');Object.assign(f.q.player,{x:lift.x+lift.w/2,y:lift.y+lift.h/2});f.frame();assert.equal(f.dialog.open,false);f.key('e');assert.equal(f.dialog.open,true);f.assertUntouched();
});

test('only bedroom and bathroom privacy leaves open and pass automatically for player and NPC',()=>{
 for(const showroom of [false,true]){
  const f=fixture({preview:true});if(showroom){f.q.enterBuilding(f.project.objects.find(o=>o.asset==='store'));f.q.goStoreFloor(2);f.q.openShowroom('steampunk');}else f.q.openRoom('player');
  const m=getInterior(f.q.scene);assert.equal(m.privacyDoors.length,2);
  for(const door of m.privacyDoors){
   const state=f.q.automaticDoors.states.find(s=>s.door===door),o=state.opening;assert(state);Object.assign(f.q.player,{x:o.x+o.nx*125,y:o.y+o.ny*125});for(let i=0;i<30;i++)f.frame();assert.equal(state.openness,0);
   f.walk({x:-o.nx,y:-o.ny},.65);const signed=(f.q.player.x-o.x)*o.nx+(f.q.player.y-o.y)*o.ny;assert(signed<-25,'The player walks through the privacy leaf without E');assert(state.openness>.7);
   Object.assign(f.q.player,{x:o.x-o.nx*110,y:o.y-o.ny*110});for(let i=0;i<30;i++)f.frame();assert.equal(state.openness,0,'Privacy closes after the player clears it');
   Object.assign(f.q.player,{x:m.width-100,y:m.height-150});f.actors.push({id:'privacy-npc',x:o.x+o.nx*55,y:o.y+o.ny*55});for(let i=0;i<10;i++)f.frame();assert(state.openness>.9);f.actors[0].x=o.x-o.nx*120;f.actors[0].y=o.y-o.ny*120;for(let i=0;i<30;i++)f.frame();assert.equal(state.openness,0);f.actors.length=0;
  }
  f.assertUntouched();
 }
});
