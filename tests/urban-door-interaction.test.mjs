import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createAutomaticDoors} from '../town/world/automatic-doors.mjs';
import {interiorActorScale,effectiveInteriorZoom} from '../town/world/interior-scale.mjs';
import {roomItemBoxes} from '../town/world/urban-room.mjs';
import {presentedRoomItem} from '../town/world/private-furniture.mjs';
import {FLOOR_COUNT,residents,getInterior,residentInteractionZones,configureUrbanInteriors} from '../town/world/urban-interiors.mjs';
import {APARTMENT_COLLECTION_ASSETS} from '../town/world/apartment-collection-definitions.mjs';
import {SHOWROOMS,STORE_FLOOR_COUNT,STORE_VERTICAL_CORE} from '../town/world/showroom-layout.mjs';

// Run the production controller with actual scene geometry/door physics. Only
// DOM drawing and native artwork loading are replaced; no browser/image work.
const urbanURL=new URL('../town/world/urban.mjs',import.meta.url);
const controllerSource=readFileSync(urbanURL,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export function /gm,'function ').replaceAll('import.meta.url',JSON.stringify(urbanURL.href))+'\n({createUrbanController,buildingDoor});';
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.style={};this.dataset={};this.hidden=false;this.open=false;this.events=new Map();}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=[...children];}
 addEventListener(name,fn){this.events.set(name,fn);}
 setAttribute(){}
 close(){this.open=false;this.events.get('close')?.();}
 showModal(){this.open=true;}
 focus(){}
 getBoundingClientRect(){return {left:10,top:20,width:1200,height:760};}
 getContext(){return new Proxy({},{get:()=>()=>{},set:()=>true});}
}
function fixture({preview=false,furnishing=false}={}){
 const catalog=new Map(APARTMENT_COLLECTION_ASSETS.map(d=>[d.id,d]));
 for(const [id,urban]of [['tower','tower'],['store','shop'],['opera','opera']])catalog.set(id,{id,urban,w:1000,h:900,door:{x:500,y:880}});
 const objects=['tower','store','opera'].map((asset,i)=>({id:asset,asset,x:2000+i*4000,y:2000,scale:1,rotation:0}));
 const project={objects},original=JSON.stringify(project),outside={x:0,y:0},actors=[],elements=[],events=new Map(),win={CodaFurnitureCatalog:[]};let clock=0,storageWrites=0;const placements=[],renderCalls=[],drawn=[];
 if(furnishing){win.CodaFurnitureCatalog=[{id:'test-chair',asset:'collection-player-dining-chair',name:'Test chair',scale:1}];win.CodaNotesShop={createWallet:()=>({snapshot:()=>({balance:100,owned:['test-chair']})})};}
 const document={head:new Element('head'),body:new Element('body'),createElement(tag){const e=new Element(tag);elements.push(e);return e;}};
 const context={catalog,window:win,parent:win,document,location:{origin:'https://coda.invalid'},URL,performance:{now:()=>clock},matchMedia:()=>({matches:false}),localStorage:{getItem:()=>furnishing?null:'active-classroom',setItem(){storageWrites++;}},addEventListener:(type,fn)=>events.set(type,fn),setTimeout,
  FLOOR_COUNT,residents,getInterior,residentInteractionZones,configureUrbanInteriors,createAutomaticDoors,interiorActorScale,effectiveInteriorZoom,presentedRoomItem,SHOWROOMS,STORE_FLOOR_COUNT,STORE_VERTICAL_CORE,
  renderInterior(c,scene,options){renderCalls.push({scene,viewport:options.viewport});options.drawPlayer?.(c,options.player);},createRoomStorage(){if(!furnishing)throw Error('Unexpected storage access');return {load:()=>({ok:true}),snapshot:()=>[],place(item,x,y,rotation){placements.push({item,x,y,rotation});return {ok:true};}};},roomItemBoxes,apartmentDecorBounds:()=>[],apartmentWallDecorBounds:()=>[],furnitureFacingPlacement:()=>null,furnitureFacingBounds:()=>null,
  createStagePerformance:()=>({assetIds:[]}),stagePerformanceSignature:()=> 'test-performance',stageCollisionBoxes:()=>[],CONCERT_PROGRAMME:[{id:'test-performance'}]};
 const {createUrbanController,buildingDoor}=vm.runInNewContext(controllerSource,context,{filename:urbanURL.pathname});
 const canvas=new Element('canvas');canvas.id='door-controller-test';const q=createUrbanController({canvas,getProject:()=>project,getPlayer:()=>outside,getResidents:()=>actors,preview});
 const ctx=new Proxy({},{get:(_target,key)=>()=>{},set:()=>true});
 const frame=(keys=new Set(),dt=.04)=>{clock+=dt*1000;return q.frame(ctx,keys,dt,clock,1200,760,(_c,x,y,state)=>drawn.push({x,y,state}));};
 const walk=(normal,seconds=1)=>{const keys=new Set([normal.x>.5?'d':normal.x<-.5?'a':normal.y>.5?'s':'w']);for(let t=0;t<seconds;t+=.04)frame(keys);};
 const key=key=>q.keydown({key,repeat:false,preventDefault(){}});
 const approach=p=>{Object.assign(q.player,p.approach);frame();};
 return {q,project,original,outside,actors,buildingDoor,frame,walk,key,approach,elements,canvas,placements,renderCalls,drawn,dialog:elements.find(e=>e.tagName==='dialog'),hint:elements.find(e=>e.className==='urban-prompt'),assertUntouched(){assert.equal(JSON.stringify(project),original);assert.equal(storageWrites,0);},unlock(id){events.get('message')({origin:'https://coda.invalid',source:win,data:{type:'coda-town-state-result',people:[{id,relationship:{count:5}}]}});}};
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
   f.walk({x:-o.nx,y:-o.ny},210/(450*interiorActorScale(f.q.scene)));const signed=(f.q.player.x-o.x)*o.nx+(f.q.player.y-o.y)*o.ny;assert(signed<-25,'The player walks through the privacy leaf without E');assert(state.openness>.7);
   Object.assign(f.q.player,{x:o.x-o.nx*110,y:o.y-o.ny*110});for(let i=0;i<30;i++)f.frame();assert.equal(state.openness,0,'Privacy closes after the player clears it');
   Object.assign(f.q.player,{x:m.width-100,y:m.height-150});f.actors.push({id:'privacy-npc',x:o.x+o.nx*55,y:o.y+o.ny*55});for(let i=0;i<10;i++)f.frame();assert(state.openness>.9);f.actors[0].x=o.x-o.nx*120;f.actors[0].y=o.y-o.ny*120;for(let i=0;i<30;i++)f.frame();assert.equal(state.openness,0);f.actors.length=0;
  }
  f.assertUntouched();
 }
});

test('private camera compensation preserves actor presentation and uses the same viewport units',()=>{
 for(const kind of [null,'lobby','hall','shop','concert','apartment','showroom']){
  const scene=kind?{kind}:null,scale=interiorActorScale(scene),expected=['apartment','showroom'].includes(kind)?.375:1;
  assert.equal(scale,expected);assert.equal(effectiveInteriorZoom(scene,.72)*scale,.72);
 }
 const f=fixture();f.q.openRoom('player');f.frame();assert.equal(f.q.view.zoom,1.92);assert.equal(f.renderCalls.at(-1).viewport.w,1200/1.92);assert.equal(f.renderCalls.at(-1).viewport.h,760/1.92);
 assert.equal(f.drawn.at(-1).state.scale,undefined,'Actor draw calibration belongs to renderInterior, without a second controller scale');
 f.q.goFloor(1);f.frame();assert.equal(f.q.view.zoom,.72);assert.equal(f.renderCalls.at(-1).viewport.w,1200/.72);f.assertUntouched();
});

test('private player speed, gait and foot clearance calibrate together while public movement is unchanged',()=>{
 for(const privateRoom of [false,true])for(const run of [false,true]){
  const f=fixture();if(privateRoom)f.q.openRoom('player');else f.q.goFloor(1);const start={...f.q.player};f.frame(new Set(run?['d','shift']:['d']),.04);
  const factor=privateRoom?.375:1,distance=(run?780:450)*factor*.04;assert(Math.abs(f.q.player.x-start.x-distance)<1e-8);assert.equal(f.q.player.y,start.y);
  const expectedPhase=(run?780:450)*.04*Math.PI*2/150;assert(Math.abs(f.drawn.at(-1).state.phase-expectedPhase)<1e-8,'Stride scales with speed, retaining real-time cadence');
  const m=getInterior(f.q.scene);
  if(privateRoom){
   // Test a real interior wall: the outer world boundary at40 would hide
   // whether a six-pixel foot collider was actually used.
   let wallProbe;
   for(const wall of m.solids.filter(r=>r.w<=28&&r.h>=100&&r.x>120&&r.x<m.width-120)){
    for(let y=wall.y+32;y<wall.y+wall.h-32&&!wallProbe;y+=40)for(const side of [-1,1]){
     const face=side<0?wall.x:wall.x+wall.w,x=face+side*60;
     if(y<140||y>m.height-80||m.solids.some(r=>r!==wall&&y>=r.y-20&&y<=r.y+r.h+20&&Math.max(face,x)>=r.x-20&&Math.min(face,x)<=r.x+r.w+20))continue;
     wallProbe={x,y,face,side};break;
    }
    if(wallProbe)break;
   }
   assert(wallProbe);Object.assign(f.q.player,{x:wallProbe.x,y:wallProbe.y});f.walk({x:-wallProbe.side,y:0},.5);
   const gap=(f.q.player.x-wallProbe.face)*wallProbe.side;assert(gap>=6-1e-8&&gap<9.2,'Actual private foot radius is6 at authored interior walls');
  }else{
   const y=Array.from({length:Math.floor((m.height-300)/20)},(_,i)=>200+i*20).find(y=>!m.solids.some(r=>r.x>0&&r.x<120&&y>r.y-40&&y<r.y+r.h+40));assert(y!==undefined);Object.assign(f.q.player,{x:80,y});f.walk({x:-1,y:0},.5);assert(f.q.player.x>=44-1e-8&&f.q.player.x<47.2,'Public foot radius stays16');
  }
  f.assertUntouched();
 }
});

test('furnishing pointer coordinates invert effective private zoom without moving the saved target',()=>{
 const f=fixture({furnishing:true});f.q.openRoom('player');f.frame();const view=f.q.view,target={x:Math.round(view.x+150),y:Math.round(view.y+20)};assert.equal(view.zoom,1.92);
 const furnish=f.elements.find(e=>e.tagName==='button'&&e.textContent==='Furnish apartment');assert(furnish);furnish.onclick();
 const item=f.elements.find(e=>e.tagName==='button'&&e.children.some(c=>c?.textContent==='Test chair'));assert(item);item.onclick();assert.equal(f.placements.length,0);
 const rect=f.canvas.getBoundingClientRect();f.q.handlePointer({clientX:rect.left+600+(target.x-view.x)*view.zoom,clientY:rect.top+380+(target.y-view.y)*view.zoom,preventDefault(){}});
 assert.equal(f.placements.length,1);assert.deepEqual(f.placements[0],{item:'test-chair',...target,rotation:0});assert.equal(JSON.stringify(f.project),f.original);
});

test('spacious private rooms retain their area while furniture matches native game proportions',()=>{
 for(const showroom of [false,true]){
  const f=fixture();if(showroom){f.q.enterBuilding(f.project.objects.find(o=>o.asset==='store'));f.q.openShowroom('midcentury-studio');}else f.q.openRoom('player');
  const m=getInterior(f.q.scene),physical=JSON.stringify({width:m.width,height:m.height,items:m.items,solids:m.solids,rooms:m.rooms}),oldScale=.75,oldZoom=.96;f.frame();
  const scale=interiorActorScale(f.q.scene),zoom=f.q.view.zoom;assert.equal(oldScale/scale,2);
  assert.equal(m.width*zoom/(m.width*oldZoom),2);assert.equal(m.height*zoom/(m.height*oldZoom),2);assert.equal((m.width*zoom*m.height*zoom)/(m.width*oldZoom*m.height*oldZoom),4,'Actual rendered room floor area is four times the previous calibration');
  const sofa=m.items.find(i=>i.furnitureRole==='sofa'),native=APARTMENT_COLLECTION_ASSETS.find(a=>a.id===sofa?.asset);assert(native);assert.equal(sofa.w/scale,native.w);assert.equal(sofa.h/scale,native.h,'Furniture uses the same human proportions as its native town asset');
  assert.equal(scale*zoom,oldScale*oldZoom,'On-screen actor size is unchanged');assert.equal(450*scale*zoom,450*oldScale*oldZoom,'On-screen walking speed is unchanged');
  assert.equal(JSON.stringify({width:m.width,height:m.height,items:m.items,solids:m.solids,rooms:m.rooms}),physical,'Authored furniture, walls, rooms and solids keep their exact coordinates');f.assertUntouched();
 }
});

test('each showroom theme sign opens its information without entering the apartment',()=>{
 const f=fixture();f.q.enterBuilding(f.project.objects.find(o=>o.asset==='store'));
 for(const floor of [1,2]){
  f.q.goStoreFloor(floor);const model=getInterior(f.q.scene),signs=model.showroomSigns;assert.equal(signs.length,floor===1?8:4);
  for(const sign of signs){
   Object.assign(f.q.player,sign.approach);f.frame();f.key('e');assert.equal(f.dialog.open,true);
   assert.equal(f.dialog.children[0].children[0].textContent,sign.title);assert.equal(f.dialog.children[1].textContent,sign.description);
   assert.equal(f.q.scene.kind,'shop');assert.equal(f.q.scene.floor,floor);f.dialog.children[0].children[1].onclick();
  }
 }
 f.assertUntouched();
});
