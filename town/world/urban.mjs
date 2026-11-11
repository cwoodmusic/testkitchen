import {catalog} from './catalog.mjs?v=family-rooms-1';
import {FLOOR_COUNT,residents,getInterior,renderInterior,residentInteractionZones,apartmentDecorBounds,apartmentWallDecorBounds,configureUrbanInteriors} from './urban-interiors.mjs?v=family-rooms-1';
import {createRoomStorage,roomItemBoxes} from './urban-room.mjs?v=family-rooms-1';
import {SHOWROOMS,STORE_FLOOR_COUNT,STORE_VERTICAL_CORE} from './showroom-layout.mjs?v=family-rooms-1';
import {createStagePerformance,stagePerformanceSignature,stageCollisionBoxes} from './concert-performers.mjs?v=family-rooms-1';
import {CONCERT_PROGRAMME} from './concert-programme.mjs?v=family-rooms-1';
import {createAutomaticDoors} from './automatic-doors.mjs?v=family-rooms-1';
import {furnitureFacingPlacement,furnitureFacingBounds} from './furniture-facing.mjs?v=family-rooms-1';
import {interiorActorScale,effectiveInteriorZoom} from './interior-scale.mjs?v=family-rooms-1';
import {presentedRoomItem,furniturePresentationScale} from './private-furniture.mjs?v=family-rooms-1';

configureUrbanInteriors(catalog);
const furniture=window.CodaFurnitureCatalog||[];
const FURNITURE_FACINGS=[['North',180],['East',270],['South',0],['West',90]];
const rectHit=(x,y,r,pad=0)=>x>=r.x-pad&&x<=r.x+r.w+pad&&y>=r.y-pad&&y<=r.y+r.h+pad;
const guestStorageAvailable=()=>{try{return !localStorage.getItem('codaClassroomWorkspaceV1');}catch{return false;}};
export function buildingDoor(o){
 const a=catalog.get(o.asset);if(!a?.urban)return null;
 const p=a.door||{x:a.w/2,y:a.h},r=o.rotation*Math.PI/180,dx=(p.x-a.w/2)*o.scale,dy=(p.y-a.h)*o.scale;
 return {x:o.x+dx*Math.cos(r)-dy*Math.sin(r),y:o.y+dx*Math.sin(r)+dy*Math.cos(r),kind:a.urban};
}
function decorSolids(items,scene){const model=scene?.rooms?scene:getInterior(scene);return items.flatMap(o=>roomItemBoxes(o,catalog,(item,asset)=>furniturePresentationScale(item,model,asset)));}
export function createUrbanController({canvas,getProject,getPlayer,getResidents,onConversation,getConcert=()=>null,preview=false}){
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./urban.css?v=family-rooms-1',import.meta.url);document.head.append(css);
 const hud=document.createElement('section');hud.className='urban-hud';hud.hidden=true;document.body.append(hud);
 const hint=document.createElement('button');hint.className='urban-prompt';hint.hidden=true;hint.onclick=()=>interact();document.body.append(hint);
 const dialog=document.createElement('dialog');dialog.className='urban-dialog';dialog.setAttribute('aria-label','Coda Town');document.body.append(dialog);
 let scene=null,player={x:0,y:0},outside=null,people=[],owner=parent===window&&guestStorageAvailable()?'guest':null,roomOwner=owner,wallet=null,localWallet=null,room=null,decor=[],selectedDecor=null,decorate=false,hover=null,selectedRotation=0,purchasesEnabled=parent===window&&guestStorageAvailable(),purchasesMessage='';
 let facing='down',phase=0,walking=false,zoom=.72,view={x:0,y:0},lastSize={width:1,height:1},lastHint='',notice='',noticeUntil=0,request=0,conversation=null;
 const pending=new Map(),dialogueTurns=new Map();
 let automaticDoors=null,portals=[],exteriorDoors=null,exteriorPortals=[],exteriorDoc=null,exteriorCount=-1,doorOwners=new WeakMap();
 let seated=null,performanceModel=null,performanceKey=null,performanceBoxes=[],settledPerformance=null,walkZoom=zoom;
 const reducedMotion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 function concertPerformance(){
  if(scene?.kind!=='concert')return null;
  const track=getConcert()?.currentTrack||CONCERT_PROGRAMME[0],signature=stagePerformanceSignature(track);
  if(signature!==performanceKey||!performanceModel){performanceKey=signature;performanceModel=createStagePerformance(track,{stage:getInterior(scene).stage});performanceBoxes=stageCollisionBoxes(performanceModel,{catalog});for(const id of performanceModel.assetIds||[])catalog.get(id)?.ensureFull?.().catch(()=>{});}
  performanceModel.programmeId=track?.id||performanceModel.programmeId;
  return performanceModel;
 }
 function refreshStage(){
  if(scene?.kind!=='concert')return;
  concertPerformance();const changed=settledPerformance!==performanceModel;settledPerformance=performanceModel;
  if(seated||!changed||!performanceBoxes.some(r=>rectHit(player.x,player.y,r,16)))return;
  // A changing ensemble can put a piano or a musician where a visitor was
  // standing. Step to the nearest clear patch before applying walking input.
  const model=getInterior(scene),occupied=[...model.solids,...performanceBoxes];
  for(let radius=24;radius<=720;radius+=24)for(let angle=0;angle<16;angle++){
   const p={x:player.x+Math.cos(angle*Math.PI/8)*radius,y:player.y+Math.sin(angle*Math.PI/8)*radius};
   if(p.x<72||p.x>model.width-72||p.y<192||p.y>model.height-72||occupied.some(r=>rectHit(p.x,p.y,r,16)))continue;
   player=p;return;
  }
  player={...model.spawn};
 }
 const owned=()=>wallet?.owned||[];
 const bridge=parent!==window;
 if(!bridge&&owner&&window.CodaNotesShop){
  const character=window.createCodaCharacterRenderer?.();localWallet=window.CodaNotesShop.createWallet({catalog:character?.catalog,preserveEquipped:false});wallet=localWallet.snapshot();
 }
 function makeRoom(){
  if(!owner)return;
  let storage;try{storage=bridge?parent.localStorage:localStorage;}catch{}
  room=createRoomStorage({storage,owner:roomOwner||owner,catalog,furniture,owned,presentationScale:(item,asset)=>furniturePresentationScale(item,getInterior({kind:'apartment',resident:'player',floor:15}),asset),getBounds:(_item,asset)=>(asset?.wallMounted?apartmentWallDecorBounds:apartmentDecorBounds)({kind:'apartment',floor:15,resident:'player'}),getSolids:()=>getInterior({kind:'apartment',floor:15,resident:'player'}).solids});
  const result=room.load();decor=room.snapshot();if(!result.ok)flash(result.error);
 }
 makeRoom();
 if(!bridge&&!owner)purchasesMessage='Open town from the arcade to use your active player and Notes wallet.';
 addEventListener('storage',e=>{if(!bridge&&e.key==='codaClassroomWorkspaceV1'&&!guestStorageAvailable()){purchasesEnabled=false;purchasesMessage='Open town from the arcade to use your active player.';room=null;decor=[];wallet=null;localWallet=null;decorate=false;selectedDecor=null;reset();}});
 addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==parent)return;
  const data=e.data;if(data?.type==='coda-town-state-result'){
   people=Array.isArray(data.people)?data.people:[];
   if(data.wallet)wallet=data.wallet;
   if(typeof data.furniturePurchasesEnabled==='boolean')purchasesEnabled=data.furniturePurchasesEnabled;
   purchasesMessage=data.furniturePurchasesMessage||'';
   if(typeof data.owner==='string'&&(data.owner!==owner||data.roomOwner!==roomOwner)){owner=data.owner;roomOwner=data.roomOwner||owner;selectedDecor=null;decorate=false;makeRoom();}
   if(scene)updateHud();
  }
  if(data?.type==='coda-town-buy-result'&&pending.has(data.requestId)){
   const resolve=pending.get(data.requestId);pending.delete(data.requestId);if(data.wallet)wallet=data.wallet;resolve(data);
  }
 });
 if(bridge)parent.postMessage({type:'coda-town-state'},location.origin);
 dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
 dialog.addEventListener('close',()=>{if(!dialog.open)endConversation();});
 canvas.addEventListener('pointermove',e=>{if(!scene||!decorate)return;hover=pointerWorld(e);});
 function flash(message){notice=message||'';noticeUntil=performance.now()+4500;}
 function conversationViewer(){return {...(scene?player:getPlayer())};}
 function endConversation(){const id=conversation;if(id===null)return;conversation=null;onConversation?.(id,false,conversationViewer());}
 function beginConversation(id){endConversation();if(typeof id!=='string'||!id)return;conversation=id;onConversation?.(id,true,conversationViewer());}
 function closeDialog(){endConversation();dialog.close();canvas.focus();}
 function modal(title,description){
  endConversation();
  dialog.replaceChildren();const header=document.createElement('div');header.className='urban-dialog-head';const h=document.createElement('h2');h.textContent=title;const x=document.createElement('button');x.textContent='Close';x.onclick=closeDialog;header.append(h,x);dialog.append(header);
  if(description){const p=document.createElement('p');p.textContent=description;dialog.append(p);}if(!dialog.open)dialog.showModal();return dialog;
 }
 function actionButton(label,fn,parentElement=hud){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{fn();canvas.focus();};parentElement.append(b);return b;}
 function updateHud(){
  hud.hidden=!scene;if(!scene)return;
  hud.replaceChildren();const title=document.createElement('strong');title.textContent=getInterior(scene).title;hud.append(title);
  if(preview&&scene.kind!=='concert'){const tag=document.createElement('small');tag.textContent='Preview · friendship doors open';hud.append(tag);}
  if(scene.kind==='concert'){
   actionButton('Programme & credits',showProgramme);
   if(seated)actionButton('Stand up',standUp);
  }
  else if(scene.kind==='shop'){actionButton('Browse furniture',showShop);actionButton('Store floors',showStoreDirectory);}
  else if(scene.kind==='showroom'){
   actionButton('Shop this apartment',()=>showShop(scene.showroomId));
   actionButton(scene.floor===2?'Back to upper gallery':'Back to lobby',returnToStore);
  }
  else {actionButton('Floor directory',showDirectory);if(scene.resident==='player')actionButton(decorate?'Finish furnishing':'Furnish apartment',()=>{decorate=!decorate;selectedDecor=null;updateHud();if(decorate)showInventory();});}
  if(decorate&&scene.resident==='player'){
   const group=document.createElement('div');group.className='urban-categories urban-furniture-facing';group.style.margin='0';group.style.alignItems='center';const label=document.createElement('span');label.textContent='Facing';group.append(label);group.setAttribute('role','group');group.setAttribute('aria-label','Furniture facing');
   for(const [label,rotation]of FURNITURE_FACINGS){const button=actionButton(label,()=>{selectedRotation=rotation;updateHud();},group);button.dataset.roomFacing=label.toLowerCase();button.setAttribute('aria-pressed',String(selectedRotation===rotation));}
   hud.append(group);
  }
  if(scene.kind!=='showroom')actionButton(scene.kind==='shop'&&scene.floor===2?'Main lobby':'Go outside',scene.kind==='shop'&&scene.floor===2?()=>goStoreFloor(1):reset);
 }
 function normalForDoor(d){return d.enterNormal||({down:{x:0,y:-1},up:{x:0,y:1},left:{x:1,y:0},right:{x:-1,y:0}})[d.facing]||{x:0,y:-1};}
 function doorForZone(model,z){
  const list=model.doors||[],profile=z.resident==='player'?{number:'15A'}:residents.find(r=>r.id===z.resident);
  return list.find(d=>z.doorId&&d.id===z.doorId||z.showroomId&&d.showroomId===z.showroomId||profile&&d.number===profile.number)||null;
 }
 function describePortal(id,threshold,enterNormal,extra={}){
  const p={id,threshold,enterNormal,triggerHalfWidth:extra.triggerHalfWidth||70,approachDistance:extra.approachDistance||64,...extra},n=enterNormal;
  p.approach={x:threshold.x-n.x*56,y:threshold.y-n.y*56};
  const xs=[threshold.x-n.x*p.approachDistance,threshold.x+n.x*24],ys=[threshold.y-n.y*p.approachDistance,threshold.y+n.y*24];
  p.trigger={x:Math.min(...xs)-(n.y?p.triggerHalfWidth:0),y:Math.min(...ys)-(n.x?p.triggerHalfWidth:0),w:Math.abs(xs[1]-xs[0])+(n.y?p.triggerHalfWidth*2:0),h:Math.abs(ys[1]-ys[0])+(n.x?p.triggerHalfWidth*2:0)};
  return p;
 }
 function scenePortals(model){
  const result=[];doorOwners=new WeakMap();
  for(const z of model.zones){
   if(z.action==='room'||z.action==='showroom'){
    const d=doorForZone(model,z),normal=z.enterNormal||d&&normalForDoor(d)||{x:0,y:-1};
    const threshold=z.threshold||d?.threshold||(d?{x:d.x,y:d.floorY??d.y+d.h}:{x:z.x+z.w/2,y:z.y+20});
    const door=d||{id:z.doorId||z.id,threshold,enterNormal:normal,triggerHalfWidth:z.triggerHalfWidth||70,virtual:true};
    const portal=describePortal(z.id,threshold,normal,{zone:z,door,action:z.action,resident:z.resident,showroomId:z.showroomId,triggerHalfWidth:z.triggerHalfWidth||d?.triggerHalfWidth||Math.min(85,(d?.w||140)/2),allowed:z.action==='room'?()=>canEnter(z.resident):true});
    if(z.resident)doorOwners.set(door,z.resident);result.push(portal);
   }else if(z.action==='showroom-lobby'){
    const entry=model.portalExit,normal=entry?{x:-entry.enterNormal.x,y:-entry.enterNormal.y}:{x:0,y:1},threshold=entry?.threshold||{x:model.width/2,y:model.height-28};
    const door=entry?.door||(model.doors||[]).find(d=>d.id===(entry?.doorId||z.doorId))||{id:entry?.doorId||entry?.id||z.doorId||z.id,threshold,enterNormal:normal,triggerHalfWidth:entry?.triggerHalfWidth||70,virtual:true};
    result.push(describePortal(z.id,threshold,normal,{zone:z,door,action:z.action,showroomId:z.showroomId,triggerHalfWidth:entry?.triggerHalfWidth||70}));
   }else if(z.action==='exit'&&!(z.id==='stair-down'||z.id==='stair-up')){
    const threshold=model.exit||{x:z.x+z.w/2,y:model.height-28},normal={x:0,y:1},door={id:z.id,threshold,enterNormal:normal,triggerHalfWidth:Math.min(110,z.w/2),clearOpening:z.clearOpening,virtual:true};
    result.push(describePortal(z.id,threshold,normal,{zone:z,door,action:'exit',triggerHalfWidth:door.triggerHalfWidth}));
   }
  }
  return result;
 }
 function configureSceneDoors(model){
  portals=scenePortals(model);const privacyDoors=scene.kind==='apartment'||scene.kind==='showroom'?model.privacyDoors||[]:[],privacy=new WeakSet(privacyDoors),defs=[...privacyDoors,...(model.doors||[])];
  for(const p of portals)if(!defs.includes(p.door))defs.push(p.door);
  automaticDoors=createAutomaticDoors(defs,{canOpen:(door,actor,isPlayer)=>{if(privacy.has(door))return true;if(isPlayer)return false;const resident=doorOwners.get(door);return !resident||actor.id===resident;}});
  automaticDoors.prime(player,sceneResidents());
 }
 function refreshExteriorDoors(){
  const doc=getProject();let changed=doc!==exteriorDoc||doc.objects.length!==exteriorCount;
  if(!changed)for(const p of exteriorPortals){const o=p.object;if(doc.objects[p.objectIndex]!==o||o.x!==p.objectX||o.y!==p.objectY||o.rotation!==p.objectRotation||o.scale!==p.objectScale){changed=true;break;}}
  if(!changed)return;
  exteriorDoc=doc;exteriorCount=doc.objects.length;exteriorPortals=[];
  for(let index=0;index<doc.objects.length;index++){
   const o=doc.objects[index],at=buildingDoor(o);if(!at)continue;
   const angle=(o.rotation||0)*Math.PI/180,normal={x:Math.sin(angle),y:-Math.cos(angle)},door={id:'building-'+(o.id||index),threshold:{x:at.x,y:at.y},enterNormal:normal,triggerHalfWidth:85*(o.scale||1),virtual:true,object:o};
   exteriorPortals.push(describePortal(door.id,door.threshold,normal,{door,action:'building',object:o,objectIndex:index,objectX:o.x,objectY:o.y,objectRotation:o.rotation,objectScale:o.scale,triggerHalfWidth:door.triggerHalfWidth,approachDistance:80*(o.scale||1)}));
  }
  exteriorDoors=createAutomaticDoors(exteriorPortals.map(p=>p.door),{canOpen:(_door,_actor,isPlayer)=>!isPlayer});
 }
 // Building entrances are manual for the player; NPC entrance animation keeps
 // following the existing resident journeys without changing their queue.
 function updateExteriorDoors(dt){
  refreshExteriorDoors();exteriorDoors?.update(dt,getPlayer(),getResidents?.(null)||[]);
 }
 function setScene(next,spawn){
  closeDialog();if(seated)zoom=walkZoom;scene=next;seated=null;selectedDecor=null;decorate=false;hover=null;const model=getInterior(scene);player={...(spawn||model.spawn)};walking=false;facing='up';configureSceneDoors(model);updateHud();getConcert()?.updateContext(scene);
  // Furniture collision is tested at the feet, like the outdoor character.
  if(solid(player.x,player.y)){let found=false;for(let y=model.height-140;y>100&&!found;y-=40)for(let x=model.width/2;x<model.width-100;x+=40)if(!solid(x,y)){player={x,y};found=true;break;}}
  automaticDoors.prime(player,sceneResidents());
 }
 function enterBuilding(o){const door=buildingDoor(o);if(!door)return false;outside={object:o,position:{...getPlayer()}};setScene(door.kind==='opera'?{kind:'concert'}:door.kind==='shop'?{kind:'shop',floor:1}:{kind:'lobby',floor:1});return true;}
 function reset(){closeDialog();if(seated)zoom=walkZoom;scene=null;seated=null;outside=null;decorate=false;selectedDecor=null;hover=null;hud.hidden=true;hint.hidden=true;lastHint='';automaticDoors=null;portals=[];getConcert()?.updateContext(null);}
 function standUp(){if(!seated)return false;const seat=seated;seated=null;zoom=walkZoom;player={...seat.approach};walking=false;facing='up';updateHud();return true;}
 function watchSeat(seatId){
  if(scene?.kind!=='concert')return false;
  const seat=getInterior(scene).audience.seats.find(s=>s.id===seatId);if(!seat)return false;
  if(!seated)walkZoom=zoom;
  const stage=getInterior(scene).stage;zoom=Math.max(.04,Math.min(.6,lastSize.width/(stage.w+800),lastSize.height/(stage.h+550)));
  seated=seat;player={...seat.seat};walking=false;facing='up';updateHud();return true;
 }
 function showProgramme(){
  const audio=getConcert(),current=audio?.currentTrack;
  const body=modal('Sydney Opera House · Programme & credits','A shuffled concert programme. The same performance continues as you enter and leave the hall.');
  if(current){const now=document.createElement('p');now.textContent=`Now playing: ${current.title} · ${current.composer}`;body.append(now);}
  if(audio)actionButton('Next performance',()=>{audio.skip();showProgramme();},body);
  const list=document.createElement('div');list.className='concert-programme';body.append(list);
  for(const track of CONCERT_PROGRAMME){
   const entry=document.createElement('article'),h=document.createElement('h3'),info=document.createElement('p'),history=document.createElement('p'),rights=document.createElement('p');
   h.textContent=track.title;info.textContent=`${track.composer} · ${track.compositionYear||''} · ${track.category==='orchestra'?'Full orchestra':track.category==='jazz'?'New Orleans jazz band':'Solo piano'} · ${track.performer}${track.recordingYear?' · recording '+track.recordingYear:''}`;
   history.textContent=track.historicalNote||'';rights.textContent=track.license?.attribution||track.license?.name||'';
   entry.append(h,info,history,rights);
   for(const [label,url]of [['Recording source',track.sourceUrl],[track.license?.name||'Recording rights',track.license?.url]]){
    if(!/^https:\/\//.test(url||''))continue;const link=document.createElement('a');link.textContent=label;link.href=url;link.target='_blank';link.rel='noopener noreferrer';entry.append(link,document.createTextNode(' '));
   }
   if(track.license?.recordingRights){const scope=document.createElement('small');scope.textContent=track.license.recordingRights;entry.append(scope);}
   list.append(entry);
  }
 }
 function goFloor(floor){if(!Number.isInteger(floor)||floor<1||floor>FLOOR_COUNT)return;setScene(floor===1?{kind:'lobby',floor:1}:{kind:'hall',floor});}
 function goStoreFloor(floor,arrival='lift'){
  if(!Number.isInteger(floor)||floor<1||floor>STORE_FLOOR_COUNT)return false;
  setScene({kind:'shop',floor},arrival==='stairs'?STORE_VERTICAL_CORE.stairsArrival:STORE_VERTICAL_CORE.arrival);return true;
 }
 function showStoreDirectory(){
  const body=modal('Coda Furnishings · Store floors','Eight complete homes on the main floor. Four larger homes in the upper gallery. The lift and stairs connect both floors.');
  const grid=document.createElement('div');grid.className='urban-floors';body.append(grid);
  for(let floor=1;floor<=STORE_FLOOR_COUNT;floor++){
   const names=SHOWROOMS.filter(room=>room.storeFloor===floor).map(room=>room.name).join(' · ');
   actionButton(`${floor===1?'Main lobby':'Upper gallery'} · ${names}`,()=>goStoreFloor(floor),grid);
  }
 }
 function showDirectory(){
  const body=modal('Coda Residences · 15 floors','Choose a floor. The elevator and stairwells connect every storey.');const grid=document.createElement('div');grid.className='urban-floors';body.append(grid);
  for(let f=FLOOR_COUNT;f>=1;f--){const names=f===1?'Lobby · music lounge':f===15?'Your apartment':residents.filter(r=>r.floor===f).map(r=>r.name).join(' · ');actionButton(`${String(f).padStart(2,'0')}  ${names}`,()=>goFloor(f),grid);}
 }
 function canEnter(id){return id==='player'||preview||(people.find(p=>p.id===id)?.relationship?.count||0)>=5;}
 function openRoom(id){
  if(!canEnter(id)){const r=residents.find(r=>r.id===id);modal(r?.name+'’s apartment','Build your friendship to level 5 in the arcade to receive an invitation.');return;}
  const r=residents.find(r=>r.id===id);setScene({kind:'apartment',floor:id==='player'?15:r.floor,resident:id});
 }
 function openShowroom(showroomId){
  const display=SHOWROOMS.find(room=>room.id===showroomId);
  if(scene?.kind!=='shop'||!display||display.storeFloor!==(scene.floor||1))return false;
  setScene({kind:'showroom',showroomId,floor:display.storeFloor});return true;
 }
 function returnToStore(){
  if(scene?.kind!=='showroom')return false;
  const showroom=SHOWROOMS.find(room=>room.id===scene.showroomId);
  setScene({kind:'shop',floor:showroom?.storeFloor||1},showroom?.lobbyReturn);return true;
 }
 function sceneResidents(){if(scene?.kind==='concert')return [];const actors=getResidents?.(scene);return Array.isArray(actors)?actors:getInterior(scene).actors;}
 function nearestZone(){if(!scene)return null;const model=getInterior(scene),zones=[...model.zones.filter(z=>z.action!=='resident'),...residentInteractionZones(sceneResidents())];return zones.map(z=>({...z,distance:Math.hypot(player.x-Math.max(z.x,Math.min(z.x+z.w,player.x)),player.y-Math.max(z.y,Math.min(z.y+z.h,player.y)))})).filter(z=>z.distance<120).sort((a,b)=>a.distance-b.distance)[0]||null;}
 function nearestBuilding(){const p=getPlayer();return getProject().objects.map(o=>({o,door:buildingDoor(o)})).filter(a=>a.door).map(a=>({...a,distance:Math.hypot(p.x-a.door.x,p.y-a.door.y)})).filter(a=>a.distance<240*a.o.scale).sort((a,b)=>a.distance-b.distance)[0];}
 function nearestPerson(){
  const p=getPlayer(),actors=getResidents?.(null);if(!Array.isArray(actors))return null;
  return actors.filter(a=>!a.hidden).map(actor=>{const at=actor.interaction||actor;return {actor,distance:Math.hypot(p.x-at.x,p.y-at.y)};}).filter(a=>Number.isFinite(a.distance)&&a.distance<140).sort((a,b)=>a.distance-b.distance)[0]||null;
 }
 function outsideTarget(){const person=nearestPerson(),building=nearestBuilding();return person&&(!building||person.distance<=building.distance)?{person}:building?{building}:null;}
 function talkTo(actor){
  const lines=Array.isArray(actor.dialogue)?actor.dialogue.filter(line=>typeof line==='string'&&line.trim()):[],turn=dialogueTurns.get(actor.id)||0;
  const fallback='Good to see you around Coda Town. I hope we can catch some music together later.';
  modal(actor.name||residents.find(r=>r.id===actor.id)?.name||'Your neighbour',lines.length?lines[turn%lines.length]:fallback);dialogueTurns.set(actor.id,turn+1);beginConversation(actor.id);
 }
 function interact(){
  if(dialog.open)return true;
  if(!scene){const target=outsideTarget();if(target?.person){talkTo(target.person.actor);return true;}return target?.building?enterBuilding(target.building.o):false;}
  if(decorate){showInventory();return true;}
  if(seated){standUp();return true;}
  const z=nearestZone();if(!z)return true;
  if(z.action==='store-elevator')showStoreDirectory();
  else if(z.action==='store-floor')goStoreFloor(z.targetFloor,z.arrival);
  else if(z.action==='elevator')showDirectory();
  else if(z.action==='stairs-up')goFloor(scene.floor+1);
  else if(z.action==='stairs-down')goFloor(scene.floor-1);
  else if(z.action==='room')openRoom(z.resident);
  else if(z.action==='showroom')openShowroom(z.showroomId);
  else if(z.action==='showroom-info'){
   const display=SHOWROOMS.find(room=>room.id===z.showroomId&&room.storeFloor===(scene.floor||1));
   if(display)modal(display.name,display.style);
  }
  else if(z.action==='showroom-lobby')returnToStore();
  else if(z.action==='shop')showShop(z.showroomId);
  else if(z.action==='concert-seat')watchSeat(z.seatId);
  else if(z.action==='concert-watch'){
   const seat=[...getInterior(scene).audience.seats].sort((a,b)=>Math.hypot(player.x-a.approach.x,player.y-a.approach.y)-Math.hypot(player.x-b.approach.x,player.y-b.approach.y))[0];if(seat)watchSeat(seat.id);
  }
  else if(z.action==='programme'||z.action==='concert-programme')showProgramme();
  else if(z.action==='decorate'){decorate=true;updateHud();showInventory();}
  else if(z.action==='resident'){const r=residents.find(r=>r.id===z.resident);modal(r?.name||'Your neighbor',scene.kind==='apartment'&&r?.theme?`Welcome to my ${r.theme.toLowerCase()} apartment. It is good to see a familiar face in the building.`:'Good to see you around Coda Town. I hope we can catch some music together later.');beginConversation(z.resident);}
  else if(z.action==='exit'){
   if(scene.kind==='showroom')returnToStore();else if(scene.kind==='apartment')setScene({kind:'hall',floor:scene.floor});else if(scene.kind==='hall')goFloor(1);else reset();
  }
  return true;
 }
 function tick(){
  if(canvas.id==='map'){const r=canvas.getBoundingClientRect();hud.style.left=(r.left+16)+'px';hud.style.top=(r.top+16)+'px';hud.style.maxWidth=Math.max(180,Math.min(420,r.width-32))+'px';hint.style.left=(r.left+r.width/2)+'px';}
  if(dialog.open){hint.hidden=true;return;}
  let text='';if(notice&&performance.now()<noticeUntil)text=notice;
  else if(scene){const z=nearestZone(),label=z?`E · ${z.label}${z.action==='room'&&!canEnter(z.resident)?' · Friendship level 5 required':''}`:'WASD / arrows · Walk · E interact';text=seated?'Watching the performance · E or WASD to stand up':decorate?(selectedDecor?(catalog.get(furniture.find(item=>item.id===selectedDecor)?.asset)?.wallMounted?'Click to hang on the north wall · R turn · E inventory · Escape finish':'Click the floor to place · R turn · E inventory · Escape finish'):'E · Choose furniture · click a placed item to move or put away'):label;}
  else {const n=outsideTarget();if(n?.person)text=`E · Talk to ${n.person.actor.name||residents.find(r=>r.id===n.person.actor.id)?.name||'your neighbour'}`;else if(n?.building)text=`E · Enter ${n.building.door.kind==='opera'?'Sydney Opera House':n.building.door.kind==='shop'?'Coda Furnishings':'Coda Residences'}`;}
  if(text!==lastHint){hint.textContent=text;lastHint=text;}hint.hidden=!text;
 }
 function solid(x,y){
  const m=getInterior(scene),radius=16*interiorActorScale(scene);if(x<40||y<100||x>m.width-40||y>m.height-40)return true;
  const items=scene.resident==='player'?decorSolids(decor,scene):[];
  const onStage=scene.kind==='concert'&&rectHit(x,y,m.stage,24);if(onStage)concertPerformance();
  return !!automaticDoors?.blocked(x,y,radius)||[...m.solids,...items,...(onStage?performanceBoxes:[])].some(r=>rectHit(x,y,r,radius));
 }
 function frame(ctx,keys,dt,now,width,height,drawPlayer){
  if(!scene){updateExteriorDoors(dt);return false;}lastSize={width,height};const actorScale=interiorActorScale(scene),drawZoom=effectiveInteriorZoom(scene,zoom),m=getInterior(scene),actors=sceneResidents();automaticDoors.update(dt,player,actors);refreshStage();walking=false;
  if(!dialog.open&&!decorate){let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);const length=Math.hypot(dx,dy);if(length){if(seated)standUp();dx/=length;dy/=length;facing=Math.abs(dx)>Math.abs(dy)?dx<0?'left':'right':dy<0?'up':'down';const speed=(keys.has('shift')?780:450)*actorScale,n=Math.ceil(speed*dt/3),sx=dx*speed*dt/n,sy=dy*speed*dt/n;let distance=0;for(let i=0;i<n;i++){const old={...player};if(!solid(player.x+sx,player.y))player.x+=sx;if(!solid(player.x,player.y+sy))player.y+=sy;distance+=Math.hypot(player.x-old.x,player.y-old.y);}walking=distance>0;phase=(phase+distance*Math.PI*2/(150*actorScale))%(Math.PI*2);}}
  const clampView=(p,length,visible)=>length<=visible?length/2:Math.max(visible/2,Math.min(length-visible/2,p)),focus=seated?{x:m.stage.x+m.stage.w/2,y:m.stage.y+m.stage.h/2+60}:player;view={x:clampView(focus.x,m.width,width/drawZoom),y:clampView(focus.y,m.height,height/drawZoom)};
  tick();ctx.clearRect(0,0,width,height);ctx.fillStyle='#131b21';ctx.fillRect(0,0,width,height);ctx.save();ctx.translate(width/2,height/2);ctx.scale(drawZoom,drawZoom);ctx.translate(-view.x,-view.y);
  renderInterior(ctx,scene,{player,drawPlayer:(c,p)=>drawPlayer(c,p.x,p.y,{facing,walking,phase,seated:!!seated}),time:now/1000,decor:scene.resident==='player'?decor:[],actors,doorStates:automaticDoors.states,doorOpenness:automaticDoors.openness,performance:concertPerformance(),audioTime:getConcert()?.currentTime,reducedMotion,viewport:{x:view.x-width/drawZoom/2,y:view.y-height/drawZoom/2,w:width/drawZoom,h:height/drawZoom}});
  if(decorate&&selectedDecor&&hover){const item=furniture.find(i=>i.id===selectedDecor),a=catalog.get(item?.asset),scale=(item?.scale||1)*furniturePresentationScale(item,getInterior(scene),a),p=decorPlacementPoint(item,hover),object={...p,asset:a?.id,scale,rotation:selectedRotation};if(a){
   const placement=furnitureFacingPlacement(a,object),image=placement?.image||(placement&&a.getFacingImage?.(placement.direction));ctx.save();ctx.globalAlpha=.55;
   if(placement&&image)ctx.drawImage(image,placement.x,placement.y,placement.w,placement.h);
   else{ctx.translate(p.x,p.y);ctx.rotate(selectedRotation*Math.PI/180);ctx.drawImage(a.canvas,-a.w*scale/2,-a.h*scale,a.w*scale,a.h*scale);}ctx.restore();
  }}
  ctx.restore();return true;
 }
 function pointerWorld(e){const rect=canvas.getBoundingClientRect(),drawZoom=effectiveInteriorZoom(scene,zoom);return {x:Math.round(view.x+(e.clientX-rect.left-lastSize.width/2)/drawZoom),y:Math.round(view.y+(e.clientY-rect.top-lastSize.height/2)/drawZoom)};}
 function decorPlacementPoint(product,p){
  const a=catalog.get(product?.asset);if(!a?.wallMounted)return p;
  const scale=(product?.scale||1)*furniturePresentationScale(product,getInterior(scene),a),relative=furnitureFacingBounds(a,{x:0,y:0,scale,rotation:selectedRotation});
  const spots=(apartmentWallDecorBounds(scene)||[]).filter(b=>relative.w<=b.w&&relative.h<=b.h).map(b=>({x:Math.max(b.x-relative.x,Math.min(b.x+b.w-relative.x-relative.w,p.x)),y:b.y+b.h-relative.y-relative.h}));
  return spots.sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0]||p;
 }
 function selectFurniture(itemId){const existing=decor.find(o=>o.item===itemId);selectedDecor=itemId;if(existing)selectedRotation=existing.rotation??0;closeDialog();updateHud();}
 function placementResult(itemId,point,rotation){
  const product=furniture.find(i=>i.id===itemId),boxes=roomItemBoxes({asset:product?.asset,scale:product?.scale||1,...point,rotation},catalog,(item,asset)=>furniturePresentationScale(item,getInterior(scene),asset));
  if(boxes.some(b=>rectHit(player.x,player.y,b,20*interiorActorScale(scene))))return {ok:false,error:'Leave some space around your character before placing furniture.'};
  return room?.place(itemId,point.x,point.y,rotation)||{ok:false,error:'Wait for your player profile to load.'};
 }
 function handlePointer(e){
  if(!scene)return false;if(!decorate||dialog.open)return true;e.preventDefault();if(!bridge&&!guestStorageAvailable()){flash('Open town from the arcade to furnish your active player’s apartment.');return true;}const p=pointerWorld(e);
  if(selectedDecor){const product=furniture.find(i=>i.id===selectedDecor),point=decorPlacementPoint(product,p),result=placementResult(selectedDecor,point,selectedRotation);if(result.ok){decor=room.snapshot();selectedDecor=null;updateHud();flash('Furniture saved in your apartment.');}else flash(result.error);}
  else {
   const target=[...decor].reverse().find(o=>{const a=catalog.get(o.asset);return a&&rectHit(p.x,p.y,furnitureFacingBounds(a,presentedRoomItem(o,getInterior(scene),catalog)));});
   if(target){
    const item=furniture.find(i=>i.id===target.item),body=modal(item?.name||'Furniture','Move, turn, or put away this item. Your purchase remains in your inventory.');
    actionButton('Move',()=>selectFurniture(target.item),body);
    const directions=document.createElement('div');directions.className='urban-categories';directions.setAttribute('role','group');directions.setAttribute('aria-label','Turn furniture');body.append(directions);
    for(const [label,rotation]of FURNITURE_FACINGS){
     const button=actionButton(label,()=>{const result=placementResult(target.item,target,rotation);if(result.ok){decor=room.snapshot();selectedRotation=rotation;closeDialog();updateHud();flash(label+'-facing furniture saved.');}else{let error=body.querySelector('[role="status"]');if(!error){error=document.createElement('p');error.setAttribute('role','status');body.append(error);}error.textContent=result.error;}},directions);
     button.dataset.roomFacing=label.toLowerCase();button.setAttribute('aria-pressed',String((target.rotation??0)===rotation));
    }
    actionButton('Put away',()=>{const result=room.remove(target.id);if(result.ok){decor=room.snapshot();closeDialog();}else flash(result.error);},body);
   }
  }

  return true;
 }
 function thumbnail(item){const a=catalog.get(item.asset),c=document.createElement('canvas');c.width=c.height=100;if(a){const g=c.getContext('2d');g.imageSmoothingEnabled=false;const view=a.getFacingView?.('south',{image:false}),w=view?.w||a.w,h=view?.h||a.h,fit=Math.min(90/w,90/h);g.translate((100-w*fit)/2,95-h*fit);g.scale(fit,fit);if(typeof view?.ready==='boolean')a.draw(g);else g.drawImage(a.canvas,0,0,w,h);}return c;}
 function showInventory(){
  const body=modal('Your furniture','Choose an owned item, then use the facing buttons or R before placing it. Select a placed item to turn it in place. Posters, clocks, mirrors and shelves snap to the open north-wall sections.');const grid=document.createElement('div');grid.className='urban-catalog';body.append(grid);const items=furniture.filter(i=>owned().includes(i.id));
  if(!items.length){const p=document.createElement('p');p.textContent='Visit Coda Furnishings to buy furniture, instruments, plants, and lights with Notes.';body.append(p);}
  for(const item of items){const b=document.createElement('button');b.append(thumbnail(item));const name=document.createElement('span');name.textContent=item.name+(decor.some(o=>o.item===item.id)?' · Move':'');b.append(name);b.onclick=()=>{decorate=true;selectFurniture(item.id);};grid.append(b);}
 }
 async function buy(item){
  if(!purchasesEnabled||!bridge&&!guestStorageAvailable())return {ok:false,error:purchasesMessage||'Open town from the arcade to use your active player.'};
  if(!bridge){const result=localWallet?.buy(item.id)||{ok:false,error:'Notes wallet unavailable.'};wallet=localWallet?.snapshot();return result;}
  if(!owner)return {ok:false,error:'Wait for your arcade player to finish loading.'};
  const requestId=`furniture:${Date.now()}:${++request}`;return new Promise(resolve=>{pending.set(requestId,resolve);parent.postMessage({type:'coda-town-buy',id:item.id,requestId},location.origin);setTimeout(()=>{if(pending.delete(requestId))resolve({ok:false,error:'The arcade did not confirm the purchase. Please reopen the store to check your inventory.'});},10000);});
 }
 function showShop(showroomId=null,category='all'){
  if(localWallet)wallet=localWallet.refresh();
  const showrooms=SHOWROOMS;
  const showroom=showrooms.find(r=>(r.showroomId||r.id)===showroomId)||null,selectedRoom=showroom?.showroomId||showroom?.id||null;
  const displayed=showroom?getInterior({kind:'showroom',showroomId:selectedRoom,floor:showroom.storeFloor}).items.map(item=>item.productId).filter(Boolean):[];
  const collectionProducts=new Set([...(showroom?.productIds||[]),...displayed]);
  const stock=showroom?furniture.filter(item=>collectionProducts.has(item.id)||item.asset.startsWith('family-')&&item.collectionOwner==='showroom-'+selectedRoom):furniture;
  const body=modal(showroom?`Coda Furnishings · ${showroom.name}`:'Coda Furnishings',purchasesEnabled?`${wallet?.balance??'…'} Notes · Furniture and musical décor for your apartment. Purchases unlock one movable item each.`:purchasesMessage||'Connecting to your arcade player…');
  if(showrooms.length){
   const label=document.createElement('label');label.className='urban-showroom-choice';label.append('Collection ');
   const select=document.createElement('select');select.setAttribute('aria-label','Showroom collection');
   for(const [id,name]of [[null,'All furniture'],...showrooms.map(r=>[r.showroomId||r.id,r.name])]){const option=document.createElement('option');option.value=id||'';option.textContent=name;select.append(option);}
   select.value=selectedRoom||'';select.onchange=()=>{showShop(select.value||null);dialog.querySelector('.urban-showroom-choice select')?.focus();};label.append(select);body.append(label);
  }
  const summary=document.createElement('section');summary.className='urban-showroom-summary';summary.setAttribute('aria-label','Collection details');
  if(showroom){
   const style=document.createElement('strong');style.textContent=showroom.style||showroom.name;
   const finishes=document.createElement('p'),floor=showroom.floorFinish?.label||showroom.floorFinish?.name||showroom.material||'Wood flooring',wallpaper=showroom.wallpaper?.label||showroom.wallpaper?.name||'Coordinated wallpaper';
   finishes.textContent=`Floor: ${floor} · Wallpaper: ${wallpaper}`;summary.append(style,finishes);
  }else{const description=document.createElement('p');description.textContent='Explore twelve complete apartment showrooms across two store floors. Take the lift or stairs to the four larger homes upstairs, then choose a collection to shop its pieces.';summary.append(description);}
  body.append(summary);
  const tabs=document.createElement('div');tabs.className='urban-categories';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Furniture categories');
  const grid=document.createElement('div');grid.className='urban-catalog';body.append(tabs,grid);
  const categories=['all',...new Set(stock.map(i=>i.category))];let selectedCategory=categories.includes(category)?category:'all';
  function populate(nextCategory='all'){
   selectedCategory=nextCategory;for(const button of tabs.children)button.setAttribute('aria-pressed',String(button.dataset.category===selectedCategory));grid.replaceChildren();
   for(const item of stock.filter(i=>selectedCategory==='all'||i.category===selectedCategory)){
    const b=document.createElement('button'),own=owned().includes(item.id);b.append(thumbnail(item));const name=document.createElement('span');name.textContent=item.name;const price=document.createElement('small');price.textContent=own?'Owned':`${item.price} Notes`;b.append(name,price);b.disabled=own;
    b.onclick=()=>{
     const detail=modal(item.name,`Buy for ${item.price} Notes? You have ${wallet?.balance??0} Notes. This item will be available in your apartment’s furniture inventory.`);detail.append(thumbnail(item));
     const confirm=actionButton(`Buy · ${item.price} Notes`,async()=>{confirm.disabled=true;const result=await buy(item);if(result.ok){showShop(selectedRoom,selectedCategory);flash(`${item.name} added to your apartment inventory.`);}else{const error=document.createElement('p');error.setAttribute('role','status');error.textContent=result.error||'Purchase unavailable.';detail.append(error);confirm.disabled=false;}},detail);
     actionButton('Back to showroom catalog',()=>showShop(selectedRoom,selectedCategory),detail);
    };grid.append(b);
   }
  }
  for(const itemCategory of categories){const button=actionButton(itemCategory[0].toUpperCase()+itemCategory.slice(1),()=>populate(itemCategory),tabs);button.dataset.category=itemCategory;}populate(selectedCategory);
 }
 function keydown(e){
  if(dialog.open)return true;
  if(scene&&decorate&&selectedDecor&&e.key.toLowerCase()==='r'&&!e.repeat){e.preventDefault();selectedRotation=(selectedRotation+90)%360;updateHud();return true;}
  if(e.key==='Escape'&&scene){e.preventDefault();if(selectedDecor){selectedDecor=null;}else if(decorate){decorate=false;updateHud();}else if(scene.kind==='showroom')returnToStore();else if(scene.kind==='shop'&&scene.floor===2)goStoreFloor(1);else if(scene.kind==='apartment')setScene({kind:'hall',floor:scene.floor});else if(scene.kind==='hall')goFloor(1);else reset();return true;}
  if(e.key.toLowerCase()==='e'&&!e.repeat){const handled=interact();if(handled)e.preventDefault();return handled;}
  return false;
 }
 return {get active(){return !!scene;},get blocked(){return dialog.open;},get scene(){return scene;},get player(){return player;},get decor(){return decor;},get furnitureRotation(){return selectedRotation;},get view(){return {...view,zoom:effectiveInteriorZoom(scene,zoom)};},get seated(){return seated;},get automaticDoors(){return scene?automaticDoors:exteriorDoors;},get portals(){if(!scene)refreshExteriorDoors();return scene?portals:exteriorPortals;},get performance(){return concertPerformance();},tick,frame,keydown,handlePointer,zoom:delta=>{zoom=Math.max(seated?.04:.3,Math.min(1.4,zoom*Math.exp(-delta*.001)));},reset,interact,enterBuilding,goFloor,goStoreFloor,showStoreDirectory,openRoom,openShowroom,returnToStore,showShop,showInventory,showProgramme,watchSeat,standUp};
}
