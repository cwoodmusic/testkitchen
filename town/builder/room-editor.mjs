import {createRoomLayoutModel} from '../world/room-layout-model.mjs?v=town-library-review-1';
import {createRoomLayoutStorage} from '../world/room-layout-storage.mjs?v=town-library-review-1';
import {SHOWROOMS} from '../world/showroom-layout.mjs?v=town-room-placement-2';
import {residents} from '../world/resident-profiles.mjs?v=opera-parallax-1';
import {furnitureFacingPlacement,furnitureFacingBounds,cardinalFacing} from '../world/furniture-facing.mjs?v=opera-parallax-1';
import {furnitureFacingDrawSource,drawFurnitureFacingSource} from '../world/furniture-facing-source.mjs?v=town-flight-1';
import {assetFilter} from '../world/asset-color.mjs?v=opera-parallax-1';
import {getInteriorVisualBounds} from '../world/wide-room-shell.mjs?v=town-wide-rooms-1';

const FACINGS=[['north','↑','North',180],['east','→','East',270],['south','↓','South',0],['west','←','West',90]];
const ARROWS={ArrowUp:180,ArrowRight:270,ArrowDown:0,ArrowLeft:90};
const slotNames={'desk-chair':'Desk chair','reading-chair':'Reading chair','dining-table':'Dining table','dining-chair':'Dining chair','coffee-table':'Coffee table','bath-fixture':'Bath or shower','linen-storage':'Linen cabinet','record-console':'Record console','floor-lamp':'Floor lamp','table-lamp':'Table lamp','lava-lamp':'Lava lamp',toy:'Musical friend',poster:'Wall art',sink:'Sink counter'};
const label=value=>slotNames[value]||String(value||'Furniture').replaceAll('-',' ').replace(/^./,s=>s.toUpperCase());
const fieldTarget=target=>target?.closest?.('input,select,textarea,[contenteditable="true"]');
const clamp=(n,low,high)=>Math.max(low,Math.min(high,n));
function node(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;}
function button(text,action,className=''){const b=node('button',className,text);b.type='button';b.onclick=action;return b;}

export function roomEditorThemes(){
 return [
  ...SHOWROOMS.map(r=>({id:'showroom-'+r.id,owner:'showroom-'+r.id,label:r.name,group:'Showrooms',scene:{kind:'showroom',showroomId:r.id,floor:r.storeFloor}})),
  ...residents.map(r=>({id:r.id,owner:r.id,label:r.name+' · '+r.theme,group:'Neighbors',scene:{kind:'apartment',resident:r.id,floor:r.floor}})),
  {id:'player',owner:'player',label:'Your apartment',group:'Your home',scene:{kind:'apartment',resident:'player',floor:15}}
 ];
}

/** A separate canvas mode. The world document/camera never enter this editor. */
export function createRoomEditor({canvas,catalog,renderRoom,getBaseModel,getThemes=roomEditorThemes,storage,owner='builder',onActiveChange=()=>{},onStatus=()=>{}}){
 if(!canvas||!catalog||typeof renderRoom!=='function'||typeof getBaseModel!=='function')throw Error('Room editor needs a canvas, artwork catalog and room renderer.');
 if(storage===undefined)try{storage=globalThis.localStorage;}catch{storage=null;}
 const store=typeof storage?.load==='function'&&typeof storage?.save==='function'?storage:createRoomLayoutStorage({storage,owner});
 const themes=getThemes(),models=new Map(),views=new Map(),blockedThemes=new Map(),saveProblems=new Map(),thumbTimers=new Set();
 let active=false,theme=null,model=null,lastTheme='showroom-midcentury-studio',rotation=0,scope='theme',limit=48,pan=null,drag=null,panMode=false,space=false,loadToken=0,displayCache=null;
 const view={x:0,y:0,zoom:1},cursor={x:0,y:0};let statusText='Saved',statusKind='saved';
 const preferenceKey='codaRoomEditorThemeV1:'+encodeURIComponent(owner);
 try{const remembered=storage?.getItem?.(preferenceKey);if(themes.some(t=>t.id===remembered))lastTheme=remembered;}catch{}

 const panel=node('section','room-editor-panel');panel.hidden=true;panel.setAttribute('aria-label','Room editor');
 const top=node('div','room-editor-title');top.append(node('h1','','Room editor'),button('Back to town',close,'room-editor-exit'));panel.append(top);
 const themeLabel=node('label','room-editor-label','Room theme'),themeSelect=node('select');themeSelect.id='roomEditorTheme';themeSelect.setAttribute('aria-label','Room theme');
 for(const group of [...new Set(themes.map(t=>t.group))]){const options=node('optgroup');options.label=group;for(const t of themes.filter(t=>t.group===group)){const option=node('option','',t.label);option.value=t.id;options.append(option);}themeSelect.append(options);}
 themeSelect.onchange=()=>switchTheme(themeSelect.value);themeLabel.append(themeSelect);panel.append(themeLabel);
 const intro=node('p','room-editor-intro','Drag furniture to move it, or click to pick it up and click again to place it.');panel.append(intro);
 const viewTools=node('div','room-editor-view-tools');viewTools.setAttribute('role','group');viewTools.setAttribute('aria-label','Room view');
 const zoomOut=button('−',()=>zoomBy(1/1.25),'room-editor-zoom-out'),zoomValue=node('output','room-editor-zoom-value','100%'),zoomIn=button('+',()=>zoomBy(1.25),'room-editor-zoom-in'),fit=button('Fit room',fitView,'room-editor-fit');
 zoomOut.setAttribute('aria-label','Zoom out');zoomIn.setAttribute('aria-label','Zoom in');zoomValue.setAttribute('aria-label','Room zoom');viewTools.append(zoomOut,zoomValue,zoomIn,fit);panel.append(viewTools);
 const modeTools=node('div','room-editor-mode-tools');modeTools.setAttribute('role','group');modeTools.setAttribute('aria-label','Room tools');
 const arrangeButton=button('Arrange',()=>setPanMode(false),'room-editor-arrange'),panButton=button('Pan view',()=>setPanMode(!panMode),'room-editor-pan');modeTools.append(arrangeButton,panButton);panel.append(modeTools);
 const actions=node('div','room-editor-actions'),undo=button('Undo',()=>mutate('undo')),redo=button('Redo',()=>mutate('redo')),reset=button('Reset theme',()=>mutate('reset'));
 actions.append(undo,redo,reset);panel.append(actions);
 const facing=node('div','room-editor-facing');facing.setAttribute('role','group');facing.setAttribute('aria-label','Furniture facing');
 for(const [id,arrow,name,degrees]of FACINGS){const b=button(arrow+' '+name,()=>face(degrees));b.dataset.facing=id;b.title=name+' · '+arrow+' arrow key';facing.append(b);}panel.append(facing);
 const heldInfo=node('p','room-editor-held','Choose a piece to place.');heldInfo.setAttribute('aria-live','polite');panel.append(heldInfo);
 const remove=button('Remove picked-up piece',removeHeld,'room-editor-remove');remove.disabled=true;panel.append(remove);
 const hint=node('p','room-editor-keys','Arrow keys face furniture · Esc cancels · Delete removes · Wheel zooms · Space-drag or right-drag pans');panel.append(hint);
 const saveStatus=node('p','room-editor-save','Saved');saveStatus.setAttribute('role','status');saveStatus.setAttribute('aria-live','polite');panel.append(saveStatus);
 const tabs=node('div','room-editor-tabs'),themeTab=button('This theme',()=>setScope('theme')),allTab=button('All furniture',()=>setScope('all'));tabs.append(themeTab,allTab);panel.append(tabs);
 const search=node('input','room-editor-search');search.type='search';search.placeholder='Find a piece…';search.setAttribute('aria-label','Search room furniture');search.oninput=()=>{limit=48;refreshPalette();};panel.append(search);
 const category=node('select','room-editor-category');category.setAttribute('aria-label','Furniture category');category.onchange=()=>{limit=48;refreshPalette(false);};panel.append(category);
 const count=node('p','room-editor-count'),palette=node('div','room-editor-palette');palette.setAttribute('aria-label','Room furniture');panel.append(count,palette);
 const more=button('Show more pieces',()=>{limit+=48;refreshPalette(false);},'room-editor-more');panel.append(more);
 const files=node('div','room-editor-files'),exportButton=button('Export layouts ↓',exportLayouts),importButton=button('Import layouts…',()=>upload.click());files.append(exportButton,importButton);panel.append(files);
 const upload=node('input');upload.type='file';upload.accept='.json,application/json';upload.hidden=true;upload.onchange=importLayouts;panel.append(upload);
 document.body.append(panel);

 function tell(text,kind='saved'){if(statusText===text&&statusKind===kind)return;statusText=text;statusKind=kind;saveStatus.textContent=text;saveStatus.dataset.state=kind;onStatus(text);}
 function canEdit(){const error=blockedThemes.get(theme?.id);if(!error)return true;tell(error+' Export a backup, then choose Reset theme to start again.','error');return false;}
 function controls(){
  const blocked=blockedThemes.has(theme?.id);undo.disabled=!model?.canUndo||blocked;redo.disabled=!model?.canRedo||blocked;remove.disabled=!model?.held||blocked;
  for(const b of facing.children)b.setAttribute('aria-pressed',String(Number(FACINGS.find(f=>f[0]===b.dataset.facing)?.[3])===rotation));
  if(model?.held){const a=catalog.get(model.held.item.asset);heldInfo.textContent=(a?.purpose==='plush'?a.name:label(a?.slot||a?.name))+' · '+label(cardinalFacing(rotation));heldInfo.dataset.valid=String(model.held.valid);}
  else{heldInfo.textContent='Choose a piece, or click furniture in the room.';delete heldInfo.dataset.valid;}
  viewControls();
 }
 function viewControls(){
  zoomValue.value=Math.round(view.zoom*100)+'%';zoomValue.textContent=zoomValue.value;zoomOut.disabled=view.zoom<=.15;zoomIn.disabled=view.zoom>=4;
  arrangeButton.setAttribute('aria-pressed',String(!panMode));panButton.setAttribute('aria-pressed',String(panMode));
  intro.textContent=panMode?'Drag the room to look around. Choose Arrange to move furniture.':'Drag furniture to move it, or click to pick it up and click again to place it.';
  if(active)canvas.dataset.roomEditorTool=pan?'panning':panMode||space?'pan':'arrange';else delete canvas.dataset.roomEditorTool;
 }
 function endPan(event){
  const pointerId=pan?.pointerId??event?.pointerId;pan=null;drag=null;
  if(pointerId!==undefined)try{if(canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);}catch{}
  viewControls();
 }
 function setPanMode(value){endPan();panMode=value;viewControls();canvas.focus({preventScroll:true});}
 function zoomBy(factor){if(!model)return;view.zoom=clamp(view.zoom*factor,.15,4);viewControls();canvas.focus({preventScroll:true});}
 function save(message='Saved'){
  if(blockedThemes.has(theme.id)){canEdit();return {ok:false,error:blockedThemes.get(theme.id)};}
  const result=store.save(theme.id,model.record());
  if(result.ok){saveProblems.delete(theme.id);tell(message,'saved');}else{const error=result.error||'This change could not be saved in this browser.';saveProblems.set(theme.id,error);tell(error+' Export layouts to keep a downloadable copy.','error');}controls();return result;
 }
 function resultMessage(result,success='Saved'){
  if(result?.ok===false){tell(result.error||model?.held?.reason||'That piece cannot go here.','error');controls();return false;}
  displayCache=null;if(result?.changed)save(success);else controls();return true;
 }
 function mutate(action){
  if(!model||action!=='reset'&&!canEdit())return;drag=null;model.cancel();
  const result=model[action]();
  if(action==='reset'&&result.ok){blockedThemes.delete(theme.id);if(!result.changed){displayCache=null;save('Original theme restored.');return;}}
  resultMessage(result,action==='reset'?'Original theme restored · Undo brings your layout back.':'Saved');
 }
 function removeHeld(){drag=null;if(!model?.held)return;const original=model.held.originalId;if(original)resultMessage(model.remove(original));else{model.cancel();tell('Placement canceled.');controls();}}
 function face(degrees){rotation=degrees;if(model?.held){model.rotate(degrees);previewStatus();}controls();canvas.focus({preventScroll:true});}
 function previewStatus(){if(!model?.held)return;const a=catalog.get(model.held.item.asset),piece=a?.name||'Furniture';tell(model.held.valid?'Click to place · '+label(cardinalFacing(rotation)):model.held.reason||'Choose a clear spot for '+piece,model.held.valid?'held':'error');controls();}
 function setScope(value){scope=value;category.value='';limit=48;refreshPalette();}
 function products(){return globalThis.CodaFurnitureCatalog||globalThis.window?.CodaFurnitureCatalog||[];}
 function categoryOf(a,p){
  if(p?.category)return p.category;
  const s=a.slot||a.purpose;
  if(['sink','counter','stove','fridge','pantry','kitchen-sink','kitchen-counter'].includes(s))return 'kitchen';
  if(['toilet','vanity','bath-fixture','mirror','linen-storage','bath-vanity','shower','bathtub'].includes(s))return 'bathroom';
  if(['floor-lamp','table-lamp','lava-lamp','lighting'].includes(s))return 'lighting';
  if(s==='plant')return 'plants';if(s==='rug')return 'rugs';if(s==='instrument')return 'instruments';if(a.purpose==='plush')return 'plushies';
  return ['toy','poster','clock','shelf'].includes(s)?'decorations':'furniture';
 }
 function entries(){
  const stock=products(),byAsset=new Map(stock.map(p=>[p.asset,p]));
  if(scope==='all')return stock.map(p=>({a:catalog.get(p.asset),p})).filter(e=>e.a);
  return [...catalog.values()].filter(a=>(a.owner||a.collectionOwner||a.apartmentCollection)===theme?.owner&&a.slot).map(a=>({a,p:byAsset.get(a.id)}));
 }
 function paintThumb(a,cv,attempt=0){
  const c=cv.getContext('2d'),v=a.getFacingView?.('south',{image:false})||a,fit=Math.min(100/v.w,74/v.h);c.clearRect(0,0,112,82);c.save();c.imageSmoothingEnabled=false;c.translate((112-v.w*fit)/2,(78-v.h*fit)/2);c.scale(fit,fit);c.filter=assetFilter(a);
  let pending=false;
  try{
   const source=a.getFacingDrawSource?.('south',{native:false});
   if(source){if(source.image)c.drawImage(source.image,source.sx,source.sy,source.sw,source.sh,source.dx,source.dy,source.dw,source.dh);else pending=true;}
   else if(typeof a.draw==='function')a.draw(c);
   else if(a.canvas)c.drawImage(a.canvas,0,0,a.w,a.h);
  }catch{pending=true;}finally{c.restore();}
  if(pending&&attempt<20){const timer=setTimeout(()=>{thumbTimers.delete(timer);if(active&&cv.isConnected)paintThumb(a,cv,attempt+1);},120);thumbTimers.add(timer);}
 }
 function refreshPalette(rebuildCategories=true){
  if(!theme)return;const list=entries();
  if(rebuildCategories){const current=category.value;category.replaceChildren();for(const [id,name]of [['','All categories'],...[...new Set(list.map(({a,p})=>categoryOf(a,p)))].sort().map(id=>[id,label(id)])]){const option=node('option','',name);option.value=id;category.append(option);}category.value=[...category.options].some(o=>o.value===current)?current:'';}
  const query=search.value.trim().toLowerCase(),filtered=list.filter(({a,p})=>(!category.value||categoryOf(a,p)===category.value)&&(!query||[p?.name,a.name,label(a.slot),categoryOf(a,p)].join(' ').toLowerCase().includes(query)));
  palette.replaceChildren();themeTab.setAttribute('aria-pressed',String(scope==='theme'));allTab.setAttribute('aria-pressed',String(scope==='all'));count.textContent=filtered.length+' pieces';more.hidden=filtered.length<=limit;
  for(const {a,p}of filtered.slice(0,limit)){
   const name=scope==='theme'?label(a.slot):p?.name||a.name,b=button('',()=>choose(a,p),'room-editor-piece');b.dataset.asset=a.id;b.setAttribute('aria-label','Place '+name);
   const cv=node('canvas');cv.width=112;cv.height=82;b.append(cv,node('span','',name));palette.append(b);paintThumb(a,cv);
  }
 }
 function choose(a,p){
  if(!model||!canEdit())return;drag=null;model.cancel();const result=model.add({asset:a.id,...(p?{productId:p.id,scale:p.scale}:{})},cursor);
  if(result?.ok===false&&!model.held){tell(result.error,'error');return;}model.rotate(rotation);displayCache=null;previewStatus();canvas.focus({preventScroll:true});
  a.ensureFull?.(cardinalFacing(rotation))?.catch?.(()=>{});
 }
 function fitView(){if(!model)return;const r=canvas.getBoundingClientRect(),bounds=getInteriorVisualBounds(model.scene);view.x=bounds.x+bounds.w/2;view.y=bounds.y+bounds.h/2;view.zoom=clamp(Math.min((r.width-56)/bounds.w,(r.height-56)/bounds.h),.15,2.5);cursor.x=model.scene.width/2;cursor.y=model.scene.height/2;viewControls();}
 function screenToRoom(event){const r=canvas.getBoundingClientRect();return {x:view.x+(event.clientX-r.left-r.width/2)/view.zoom,y:view.y+(event.clientY-r.top-r.height/2)/view.zoom};}
 async function switchTheme(id){
  const selected=themes.find(t=>t.id===id);if(!selected)return false;endPan();const token=++loadToken;
  if(model){model.cancel();views.set(theme.id,{...view});}
  theme=selected;themeSelect.value=id;lastTheme=id;displayCache=null;
  try{
   if(!models.has(id)){const base=await getBaseModel(selected.scene,selected);if(token!==loadToken)return false;const loaded=store.load(id);let next;
    if(!loaded.ok)blockedThemes.set(id,loaded.error||'The saved room could not be read.');
    try{next=createRoomLayoutModel({themeId:id,scene:base,catalog,...(loaded.ok&&loaded.record?{record:loaded.record}:{})});}catch(error){next=createRoomLayoutModel({themeId:id,scene:base,catalog});blockedThemes.set(id,error.message||'This saved room cannot be opened.');}
    models.set(id,next);
   }
   if(token!==loadToken)return false;model=models.get(id);if(views.has(id))Object.assign(view,views.get(id));else fitView();
   if(!model.held){cursor.x=view.x;cursor.y=view.y;}
   try{storage?.setItem?.(preferenceKey,id);}catch{}
   search.value='';category.value='';scope='theme';limit=48;refreshPalette();if(blockedThemes.has(id))canEdit();else if(saveProblems.has(id))tell(saveProblems.get(id)+' Export layouts to keep a downloadable copy.','error');else tell('Saved · '+selected.label);controls();return true;
  }catch(error){tell(error.message||'This room could not be opened.','error');return false;}
 }
 async function open(id=lastTheme){
  if(!active){active=true;panel.hidden=false;document.body.classList.add('room-editor-active');onActiveChange(true);}
  const ok=await switchTheme(themes.some(t=>t.id===id)?id:themes[0].id);canvas.focus({preventScroll:true});return ok;
 }
 function close(){if(!active)return;model?.cancel();displayCache=null;if(theme)views.set(theme.id,{...view});active=false;++loadToken;endPan();space=false;panel.hidden=true;document.body.classList.remove('room-editor-active');for(const t of thumbTimers)clearTimeout(t);thumbTimers.clear();onActiveChange(false);}
 function displayModel(){
  const hidden=[model.held?.originalId,...(model.held?.companions||[]).map(i=>i.id)].filter(Boolean),key=model.revision+'|'+hidden.join('|');
  if(displayCache?.key!==key){const excluded=new Set(hidden);displayCache={key,value:{...model.scene,id:model.scene.id+'-room-editor-'+theme.id+'-'+key,items:model.scene.items.filter(i=>!excluded.has(i.id)),actors:[]}};}
  return displayCache.value;
 }
 function drawGhost(c,item){
  const a=catalog.get(item.asset);if(!a)return;c.save();c.globalAlpha=.72;c.filter=assetFilter(a);
  const facing=furnitureFacingPlacement(a,item,{x:item.x,y:item.y,offset:1},{includeImage:false});
  try{
   if(facing){if(!drawFurnitureFacingSource(c,facing,furnitureFacingDrawSource(a,facing,{native:true}))){const native=furnitureFacingPlacement(a,item);if(native?.image)c.drawImage(native.image,native.x,native.y,native.w,native.h);}}
   else{const image=a.canvas;if(image){c.translate(item.x,item.y);c.rotate((item.rotation||0)*Math.PI/180);c.drawImage(image,-item.w/2,-item.h,item.w,item.h);}}
  }finally{c.restore();}
 }
 function frame(now=performance.now(),width=canvas.getBoundingClientRect().width,height=canvas.getBoundingClientRect().height){
  if(!active)return false;const c=canvas.getContext('2d');c.save();c.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);c.clearRect(0,0,width,height);c.fillStyle='#152128';c.fillRect(0,0,width,height);
  if(model){c.translate(width/2,height/2);c.scale(view.zoom,view.zoom);c.translate(-view.x,-view.y);c.imageSmoothingEnabled=false;
   const viewport={x:view.x-width/view.zoom/2,y:view.y-height/view.zoom/2,w:width/view.zoom,h:height/view.zoom};
   renderRoom(c,theme.scene,{model:displayModel(),revision:model.revision,catalog,actors:[],wallFocus:model.held?.item??cursor,time:now/1000,viewport});
   if(model.held){for(const item of [model.held.item,...model.held.companions])drawGhost(c,item);c.save();c.lineWidth=1.8/view.zoom;c.strokeStyle=model.held.valid?'#9ce6b2':'#ff8581';c.fillStyle=model.held.valid?'#55cc8829':'#f55c4d30';const boxes=model.held.boxes.length?model.held.boxes:[furnitureFacingBounds(catalog.get(model.held.item.asset),model.held.item)];for(const b of boxes){c.fillRect(b.x,b.y,b.w,b.h);c.strokeRect(b.x,b.y,b.w,b.h);}c.restore();}
  }c.restore();return true;
 }
 function handlePointer(event){
  if(!active)return false;if(!model)return true;
  if(event.type==='pointerup'||event.type==='pointercancel'){
   if(drag&&drag.pointerId===event.pointerId){const released=drag;drag=null;if(event.type==='pointerup'&&released.dragged&&!pan&&!panMode&&!space&&model.held?.originalId===released.originalId){Object.assign(cursor,screenToRoom(event));resultMessage(model.place(cursor));event.preventDefault();}}
   if(!pan||event.pointerId===pan.pointerId)endPan(event);return true;
  }
  if(event.type==='pointerdown'){
   if(drag&&drag.pointerId!==event.pointerId){drag=null;event.preventDefault();return true;}
   drag=null;
   canvas.focus({preventScroll:true});try{canvas.setPointerCapture(event.pointerId);}catch{}
   if(event.button!==0||space||panMode){pan={x:event.clientX,y:event.clientY,pointerId:event.pointerId};viewControls();event.preventDefault();return true;}
   if(!canEdit()){event.preventDefault();return true;}
   Object.assign(cursor,screenToRoom(event));
   if(model.held)resultMessage(model.place(cursor));else{model.pick(cursor);if(model.held){drag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,originalId:model.held.originalId,dragged:false};rotation=model.held.item.rotation||0;displayCache=null;previewStatus();}}
   controls();event.preventDefault();return true;
  }
  if(event.type==='pointermove'){
   if(pan){if(event.pointerId!==pan.pointerId)return true;view.x-=(event.clientX-pan.x)/view.zoom;view.y-=(event.clientY-pan.y)/view.zoom;pan.x=event.clientX;pan.y=event.clientY;return true;}
   if(drag){if(event.pointerId!==drag.pointerId)return true;if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>4)drag.dragged=true;}
   Object.assign(cursor,screenToRoom(event));if(model.held&&!panMode&&!space){model.move(cursor);previewStatus();}return true;
  }
  return true;
 }
 function wheel(event){if(!active)return false;event.preventDefault();const before=screenToRoom(event);view.zoom=clamp(view.zoom*Math.exp(-event.deltaY*.001),.15,4);const after=screenToRoom(event);view.x+=before.x-after.x;view.y+=before.y-after.y;if(model?.held&&!panMode&&!space){Object.assign(cursor,screenToRoom(event));model.move(cursor);previewStatus();}viewControls();return true;}
 function keydown(event){
  if(!active)return false;if(fieldTarget(event.target))return false;
  if(event.key===' '){drag=null;space=true;viewControls();event.preventDefault();return true;}
  if(Object.hasOwn(ARROWS,event.key)){event.preventDefault();face(ARROWS[event.key]);return true;}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();mutate(event.shiftKey?'redo':'undo');return true;}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();mutate('redo');return true;}
  if(event.key==='Escape'){drag=null;model?.cancel();displayCache=null;tell('Placement canceled.');controls();event.preventDefault();return true;}
  if(event.key==='Delete'||event.key==='Backspace'){removeHeld();event.preventDefault();return true;}
  return true;
 }
 function keyup(event){if(event.key===' '){space=false;viewControls();}return active;}
 canvas.addEventListener('lostpointercapture',event=>{if(drag?.pointerId===event.pointerId)drag=null;if(pan?.pointerId===event.pointerId){pan=null;viewControls();}});
 globalThis.addEventListener?.('keyup',keyup);globalThis.addEventListener?.('blur',()=>{space=false;endPan();});
 function exportLayouts(){
  try{
   let raw,backup=false,recovery=false;
   try{const pack=JSON.parse(store.exportJSON());for(const id of saveProblems.keys()){const session=models.get(id);if(session&&!blockedThemes.has(id))pack.rooms[id]=session.record();}raw=JSON.stringify(pack,null,2);}
   catch(error){raw=store.raw;if(typeof raw!=='string')throw error;const rooms={};for(const id of saveProblems.keys()){const session=models.get(id);if(session&&!blockedThemes.has(id))rooms[id]=session.record();}if(Object.keys(rooms).length){raw=JSON.stringify({format:'coda-room-layouts',version:1,owner,rooms,recoveryBackup:raw},null,2);recovery=true;}else backup=true;}
   const blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=backup?'coda-room-layouts-backup.json':recovery?'coda-room-layouts-recovery.json':'coda-room-layouts.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   if(blockedThemes.has(theme?.id))canEdit();else if(saveProblems.size)tell('Current layouts exported. Browser autosave is still unavailable.','error');else tell(model?.held?'Exported placed furniture. The piece you are holding is not included.':'Room layouts exported.');
  }catch(error){tell(error.message||'The layouts could not be exported.','error');}
 }
 async function importLayouts(){
  const file=upload.files?.[0];upload.value='';if(!file)return;
  try{const raw=await file.text(),result=store.importJSON(raw,{validateRecord:(id,record)=>{const t=themes.find(t=>t.id===id);if(!t)throw Error('This file contains an unknown room theme.');createRoomLayoutModel({themeId:id,scene:getBaseModel(t.scene,t),catalog,record});return true;}});
   if(!result.ok)throw Error(result.error||'This layout file could not be opened.');
   for(const [id,session]of models){if(!result.themeIds?.includes(id))continue;session.cancel();const loaded=store.load(id);if(loaded.ok&&loaded.record){const applied=session.applyRecord(loaded.record);if(!applied.ok)throw Error(applied.error);blockedThemes.delete(id);saveProblems.delete(id);}}
   displayCache=null;if(saveProblems.has(theme.id))tell(saveProblems.get(theme.id),'error');else tell('Room layouts imported.');controls();refreshPalette();
  }catch(error){tell(error.message||'Choose a room-layout JSON file.','error');}
 }
 return {get unsaved(){return saveProblems.size>0;},get active(){return active;},get model(){return model;},get held(){return model?.held||null;},get theme(){return theme;},get view(){return {...view};},get status(){return {text:statusText,kind:statusKind};},open,close,frame,handlePointer,keydown,keyup,wheel,screenToRoom,fit:fitView};
}
