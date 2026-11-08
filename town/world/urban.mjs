import {catalog} from './catalog.mjs?v=urban-assets-2';
import {FLOOR_COUNT,residents,getInterior,renderInterior,apartmentDecorBounds,configureUrbanInteriors} from './urban-interiors.mjs?v=urban-assets-2';
import {createRoomStorage,roomItemBoxes} from './urban-room.mjs?v=urban-assets-2';

configureUrbanInteriors(catalog);
const furniture=window.CodaFurnitureCatalog||[];
const rectHit=(x,y,r,pad=0)=>x>=r.x-pad&&x<=r.x+r.w+pad&&y>=r.y-pad&&y<=r.y+r.h+pad;
const guestStorageAvailable=()=>{try{return !localStorage.getItem('codaClassroomWorkspaceV1');}catch{return false;}};
export function buildingDoor(o){
 const a=catalog.get(o.asset);if(!a?.urban)return null;
 const p=a.door||{x:a.w/2,y:a.h},r=o.rotation*Math.PI/180,dx=(p.x-a.w/2)*o.scale,dy=(p.y-a.h)*o.scale;
 return {x:o.x+dx*Math.cos(r)-dy*Math.sin(r),y:o.y+dx*Math.sin(r)+dy*Math.cos(r),kind:a.urban};
}
function decorSolids(items){return items.flatMap(o=>roomItemBoxes(o,catalog));}
export function createUrbanController({canvas,getProject,getPlayer,preview=false}){
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./urban.css?v=urban-assets-2',import.meta.url);document.head.append(css);
 const hud=document.createElement('section');hud.className='urban-hud';hud.hidden=true;document.body.append(hud);
 const hint=document.createElement('button');hint.className='urban-prompt';hint.hidden=true;hint.onclick=()=>interact();document.body.append(hint);
 const dialog=document.createElement('dialog');dialog.className='urban-dialog';dialog.setAttribute('aria-label','Coda Town');document.body.append(dialog);
 let scene=null,player={x:0,y:0},outside=null,people=[],owner=parent===window&&guestStorageAvailable()?'guest':null,roomOwner=owner,wallet=null,localWallet=null,room=null,decor=[],selectedDecor=null,decorate=false,hover=null,purchasesEnabled=parent===window&&guestStorageAvailable(),purchasesMessage='';
 let facing='down',phase=0,walking=false,zoom=.72,view={x:0,y:0},lastSize={width:1,height:1},lastHint='',notice='',noticeUntil=0,request=0;
 const pending=new Map();
 const owned=()=>wallet?.owned||[];
 const bridge=parent!==window;
 if(!bridge&&owner&&window.CodaNotesShop){
  const character=window.createCodaCharacterRenderer?.();localWallet=window.CodaNotesShop.createWallet({catalog:character?.catalog,preserveEquipped:false});wallet=localWallet.snapshot();
 }
 function makeRoom(){
  if(!owner)return;
  let storage;try{storage=bridge?parent.localStorage:localStorage;}catch{}
  room=createRoomStorage({storage,owner:roomOwner||owner,catalog,furniture,owned,getBounds:()=>apartmentDecorBounds({kind:'apartment',floor:15,resident:'player'}),getSolids:()=>getInterior({kind:'apartment',floor:15,resident:'player'}).solids});
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
 canvas.addEventListener('pointermove',e=>{if(!scene||!decorate)return;hover=pointerWorld(e);});
 function flash(message){notice=message||'';noticeUntil=performance.now()+4500;}
 function closeDialog(){dialog.close();canvas.focus();}
 function modal(title,description){
  dialog.replaceChildren();const header=document.createElement('div');header.className='urban-dialog-head';const h=document.createElement('h2');h.textContent=title;const x=document.createElement('button');x.textContent='Close';x.onclick=closeDialog;header.append(h,x);dialog.append(header);
  if(description){const p=document.createElement('p');p.textContent=description;dialog.append(p);}if(!dialog.open)dialog.showModal();return dialog;
 }
 function actionButton(label,fn,parentElement=hud){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{fn();canvas.focus();};parentElement.append(b);return b;}
 function updateHud(){
  hud.hidden=!scene;if(!scene)return;
  hud.replaceChildren();const title=document.createElement('strong');title.textContent=getInterior(scene).title;hud.append(title);
  if(preview){const tag=document.createElement('small');tag.textContent='Preview · friendship doors open';hud.append(tag);}
  if(scene.kind==='shop')actionButton('Browse furniture',showShop);
  else {actionButton('Floor directory',showDirectory);if(scene.resident==='player')actionButton(decorate?'Finish furnishing':'Furnish apartment',()=>{decorate=!decorate;selectedDecor=null;updateHud();if(decorate)showInventory();});}
  actionButton('Go outside',reset);
 }
 function setScene(next,spawn){
  closeDialog();scene=next;selectedDecor=null;decorate=false;hover=null;const model=getInterior(scene);player={...(spawn||model.spawn)};walking=false;facing='up';updateHud();
  // Furniture collision is tested at the feet, like the outdoor character.
  if(solid(player.x,player.y)){let found=false;for(let y=model.height-140;y>100&&!found;y-=40)for(let x=model.width/2;x<model.width-100;x+=40)if(!solid(x,y)){player={x,y};found=true;break;}}
 }
 function enterBuilding(o){const door=buildingDoor(o);if(!door)return false;outside={object:o,position:{...getPlayer()}};setScene(door.kind==='shop'?{kind:'shop',floor:1}:{kind:'lobby',floor:1});return true;}
 function reset(){closeDialog();scene=null;outside=null;decorate=false;selectedDecor=null;hover=null;hud.hidden=true;hint.hidden=true;lastHint='';}
 function goFloor(floor){if(!Number.isInteger(floor)||floor<1||floor>FLOOR_COUNT)return;setScene(floor===1?{kind:'lobby',floor:1}:{kind:'hall',floor});}
 function showDirectory(){
  const body=modal('Coda Residences · 15 floors','Choose a floor. The elevator and stairwells connect every storey.');const grid=document.createElement('div');grid.className='urban-floors';body.append(grid);
  for(let f=FLOOR_COUNT;f>=1;f--){const names=f===1?'Lobby · music lounge':f===15?'Your apartment':residents.filter(r=>r.floor===f).map(r=>r.name).join(' · ');actionButton(`${String(f).padStart(2,'0')}  ${names}`,()=>goFloor(f),grid);}
 }
 function canEnter(id){return id==='player'||preview||(people.find(p=>p.id===id)?.relationship?.count||0)>=5;}
 function openRoom(id){
  if(!canEnter(id)){const r=residents.find(r=>r.id===id);modal(r?.name+'’s apartment','Build your friendship to level 5 in the arcade to receive an invitation.');return;}
  const r=residents.find(r=>r.id===id);setScene({kind:'apartment',floor:id==='player'?15:r.floor,resident:id});
 }
 function nearestZone(){if(!scene)return null;const model=getInterior(scene);return model.zones.map(z=>({...z,distance:Math.hypot(player.x-Math.max(z.x,Math.min(z.x+z.w,player.x)),player.y-Math.max(z.y,Math.min(z.y+z.h,player.y)))})).filter(z=>z.distance<120).sort((a,b)=>a.distance-b.distance)[0]||null;}
 function nearestBuilding(){const p=getPlayer();return getProject().objects.map(o=>({o,door:buildingDoor(o)})).filter(a=>a.door).map(a=>({...a,distance:Math.hypot(p.x-a.door.x,p.y-a.door.y)})).filter(a=>a.distance<240*a.o.scale).sort((a,b)=>a.distance-b.distance)[0];}
 function interact(){
  if(dialog.open)return true;
  if(!scene){const target=nearestBuilding();return target?enterBuilding(target.o):false;}
  if(decorate){showInventory();return true;}
  const z=nearestZone();if(!z)return true;
  if(z.action==='elevator')showDirectory();
  else if(z.action==='stairs-up')goFloor(scene.floor+1);
  else if(z.action==='stairs-down')goFloor(scene.floor-1);
  else if(z.action==='room')openRoom(z.resident);
  else if(z.action==='shop')showShop();
  else if(z.action==='decorate'){decorate=true;updateHud();showInventory();}
  else if(z.action==='resident'){const r=residents.find(r=>r.id===scene.resident);modal(r?.name||'Your neighbor',r?.theme?`Welcome to my ${r.theme.toLowerCase()} apartment. It is good to see a familiar face in the building.`:'Welcome! There is always room for another musician in Coda Town.');}
  else if(z.action==='exit'){
   if(scene.kind==='apartment')setScene({kind:'hall',floor:scene.floor});else if(scene.kind==='hall')goFloor(1);else reset();
  }
  return true;
 }
 function tick(){
  if(canvas.id==='map'){const r=canvas.getBoundingClientRect();hud.style.left=(r.left+16)+'px';hud.style.top=(r.top+16)+'px';hud.style.maxWidth=Math.max(180,Math.min(420,r.width-32))+'px';hint.style.left=(r.left+r.width/2)+'px';}
  if(dialog.open){hint.hidden=true;return;}
  let text='';if(notice&&performance.now()<noticeUntil)text=notice;
  else if(scene){const z=nearestZone();text=decorate?(selectedDecor?'Click the floor to place · E inventory · Escape finish':'E · Choose furniture · click a placed item to move or put away'):(z?`E · ${z.label}`:'WASD / arrows · Walk · E interact');}
  else {const n=nearestBuilding();if(n)text=`E · Enter ${n.door.kind==='shop'?'Coda Furnishings':'Coda Residences'}`;}
  if(text!==lastHint){hint.textContent=text;lastHint=text;}hint.hidden=!text;
 }
 function solid(x,y){
  const m=getInterior(scene);if(x<40||y<100||x>m.width-40||y>m.height-40)return true;
  const items=scene.resident==='player'?decorSolids(decor):[];
  return [...m.solids,...items].some(r=>rectHit(x,y,r,16));
 }
 function frame(ctx,keys,dt,now,width,height,drawPlayer){
  if(!scene)return false;lastSize={width,height};const m=getInterior(scene);walking=false;
  if(!dialog.open&&!decorate){let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);const length=Math.hypot(dx,dy);if(length){dx/=length;dy/=length;facing=Math.abs(dx)>Math.abs(dy)?dx<0?'left':'right':dy<0?'up':'down';const speed=keys.has('shift')?780:450,n=Math.ceil(speed*dt/3),sx=dx*speed*dt/n,sy=dy*speed*dt/n;let distance=0;for(let i=0;i<n;i++){const old={...player};if(!solid(player.x+sx,player.y))player.x+=sx;if(!solid(player.x,player.y+sy))player.y+=sy;distance+=Math.hypot(player.x-old.x,player.y-old.y);}walking=distance>0;phase=(phase+distance*Math.PI*2/150)%(Math.PI*2);}}
  const clampView=(p,length,visible)=>length<=visible?length/2:Math.max(visible/2,Math.min(length-visible/2,p));view={x:clampView(player.x,m.width,width/zoom),y:clampView(player.y,m.height,height/zoom)};
  tick();ctx.clearRect(0,0,width,height);ctx.fillStyle='#131b21';ctx.fillRect(0,0,width,height);ctx.save();ctx.translate(width/2,height/2);ctx.scale(zoom,zoom);ctx.translate(-view.x,-view.y);
  renderInterior(ctx,scene,{player,drawPlayer:(c,p)=>drawPlayer(c,p.x,p.y,{facing,walking,phase}),time:now/1000,decor:scene.resident==='player'?decor:[]});
  if(decorate&&selectedDecor&&hover){const item=furniture.find(i=>i.id===selectedDecor),a=catalog.get(item?.asset),scale=item?.scale||1;if(a){ctx.save();ctx.globalAlpha=.55;ctx.drawImage(a.canvas,Math.round(hover.x-a.w*scale/2),Math.round(hover.y-a.h*scale),a.w*scale,a.h*scale);ctx.restore();}}
  ctx.restore();return true;
 }
 function pointerWorld(e){const rect=canvas.getBoundingClientRect();return {x:Math.round(view.x+(e.clientX-rect.left-lastSize.width/2)/zoom),y:Math.round(view.y+(e.clientY-rect.top-lastSize.height/2)/zoom)};}
 function handlePointer(e){
  if(!scene)return false;if(!decorate||dialog.open)return true;e.preventDefault();if(!bridge&&!guestStorageAvailable()){flash('Open town from the arcade to furnish your active player’s apartment.');return true;}const p=pointerWorld(e);
  if(selectedDecor){const product=furniture.find(i=>i.id===selectedDecor),boxes=roomItemBoxes({asset:product?.asset,scale:product?.scale||1,...p},catalog);if(boxes.some(b=>rectHit(player.x,player.y,b,20))){flash('Leave some space around your character before placing furniture.');return true;}const result=room?.place(selectedDecor,p.x,p.y);if(result?.ok){decor=room.snapshot();selectedDecor=null;flash('Furniture saved in your apartment.');}else flash(result?.error||'Wait for your player profile to load.');}
  else {const target=[...decor].reverse().find(o=>{const a=catalog.get(o.asset),scale=o.scale||1;return a&&rectHit(p.x,p.y,{x:o.x-a.w*scale/2,y:o.y-a.h*scale,w:a.w*scale,h:a.h*scale});});if(target){const item=furniture.find(i=>i.id===target.item);const body=modal(item?.name||'Furniture','Move this item or put it away. Your purchase remains in your inventory.');actionButton('Move',()=>{selectedDecor=target.item;closeDialog();},body);actionButton('Put away',()=>{const result=room.remove(target.id);if(result.ok){decor=room.snapshot();closeDialog();}else flash(result.error);},body);}}
  return true;
 }
 function thumbnail(item){const a=catalog.get(item.asset),c=document.createElement('canvas');c.width=c.height=100;if(a){const g=c.getContext('2d');g.imageSmoothingEnabled=false;const fit=Math.min(90/a.w,90/a.h);g.drawImage(a.canvas,(100-a.w*fit)/2,95-a.h*fit,a.w*fit,a.h*fit);}return c;}
 function showInventory(){
  const body=modal('Your furniture','Choose an owned item, then click an open part of your apartment. Each purchase unlocks one movable item.');const grid=document.createElement('div');grid.className='urban-catalog';body.append(grid);const items=furniture.filter(i=>owned().includes(i.id));
  if(!items.length){const p=document.createElement('p');p.textContent='Visit Coda Furnishings to buy furniture, instruments, plants, and lights with Notes.';body.append(p);}
  for(const item of items){const b=document.createElement('button');b.append(thumbnail(item));const name=document.createElement('span');name.textContent=item.name+(decor.some(o=>o.item===item.id)?' · Move':'');b.append(name);b.onclick=()=>{decorate=true;selectedDecor=item.id;closeDialog();updateHud();};grid.append(b);}
 }
 async function buy(item){
  if(!purchasesEnabled||!bridge&&!guestStorageAvailable())return {ok:false,error:purchasesMessage||'Open town from the arcade to use your active player.'};
  if(!bridge){const result=localWallet?.buy(item.id)||{ok:false,error:'Notes wallet unavailable.'};wallet=localWallet?.snapshot();return result;}
  if(!owner)return {ok:false,error:'Wait for your arcade player to finish loading.'};
  const requestId=`furniture:${Date.now()}:${++request}`;return new Promise(resolve=>{pending.set(requestId,resolve);parent.postMessage({type:'coda-town-buy',id:item.id,requestId},location.origin);setTimeout(()=>{if(pending.delete(requestId))resolve({ok:false,error:'The arcade did not confirm the purchase. Please reopen the store to check your inventory.'});},10000);});
 }
 function showShop(){
  if(localWallet)wallet=localWallet.refresh();const body=modal('Coda Furnishings',purchasesEnabled?`${wallet?.balance??'…'} Notes · Furniture and musical décor for your apartment. Purchases unlock one movable item each.`:purchasesMessage||'Connecting to your arcade player…');const tabs=document.createElement('div');tabs.className='urban-categories';const grid=document.createElement('div');grid.className='urban-catalog';body.append(tabs,grid);
  function populate(category='all'){grid.replaceChildren();for(const item of furniture.filter(i=>category==='all'||i.category===category)){const b=document.createElement('button');const own=owned().includes(item.id);b.append(thumbnail(item));const name=document.createElement('span');name.textContent=item.name;const price=document.createElement('small');price.textContent=own?'Owned':`${item.price} Notes`;b.append(name,price);b.disabled=own;b.onclick=()=>{const detail=modal(item.name,`Buy for ${item.price} Notes? You have ${wallet?.balance??0} Notes. This item will be available in your apartment’s furniture inventory.`);detail.append(thumbnail(item));const confirm=actionButton(`Buy · ${item.price} Notes`,async()=>{confirm.disabled=true;const result=await buy(item);if(result.ok){showShop();flash(`${item.name} added to your apartment inventory.`);}else {const error=document.createElement('p');error.setAttribute('role','status');error.textContent=result.error||'Purchase unavailable.';detail.append(error);confirm.disabled=false;}},detail);actionButton('Back to showroom catalog',showShop,detail);};grid.append(b);}}
  for(const category of ['all',...new Set(furniture.map(i=>i.category))])actionButton(category[0].toUpperCase()+category.slice(1),()=>populate(category),tabs);populate();
 }
 function keydown(e){
  if(dialog.open)return true;
  if(e.key==='Escape'&&scene){e.preventDefault();if(selectedDecor){selectedDecor=null;}else if(decorate){decorate=false;updateHud();}else if(scene.kind==='apartment')setScene({kind:'hall',floor:scene.floor});else if(scene.kind==='hall')goFloor(1);else reset();return true;}
  if(e.key.toLowerCase()==='e'&&!e.repeat){const handled=interact();if(handled)e.preventDefault();return handled;}
  return false;
 }
 return {get active(){return !!scene;},get blocked(){return dialog.open;},get scene(){return scene;},get player(){return player;},get decor(){return decor;},get view(){return {...view,zoom};},tick,frame,keydown,handlePointer,zoom:delta=>{zoom=Math.max(.3,Math.min(1.4,zoom*Math.exp(-delta*.001)));},reset,interact,enterBuilding,goFloor,openRoom,showShop,showInventory};
}
