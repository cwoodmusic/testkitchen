import {furnitureFacingBounds,furnitureFacingBoxes,furnitureFacingDepth} from './furniture-facing.mjs?v=opera-parallax-1';
import {furniturePresentationScale} from './private-furniture.mjs?v=town-store-halls-1';
import {apartmentDecorBounds,apartmentWallDecorBounds} from './personal-room-areas.mjs?v=opera-parallax-1';
import {createRoomRugItems} from './room-rugs.mjs?v=town-room-placement-2';

export const ROOM_LAYOUT_FORMAT='coda-room-layout';
export const ROOM_LAYOUT_VERSION=1;
const MAX_ITEMS=600,MAX_HISTORY=60,EPS=1e-6,RADIUS=6;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const validId=id=>typeof id==='string'&&/^[a-z0-9][a-z0-9:_-]{0,149}$/i.test(id)&&!['__proto__','constructor','prototype'].includes(id);
const rect=r=>r&&[r.x,r.y,r.w,r.h].every(finite)&&r.w>0&&r.h>0;
const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>EPS&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>EPS;
const contains=(a,b)=>b.x>=a.x-EPS&&b.y>=a.y-EPS&&b.x+b.w<=a.x+a.w+EPS&&b.y+b.h<=a.y+a.h+EPS;
const point=p=>p&&finite(p.x)&&finite(p.y);
const rotation=n=>[0,90,180,270].includes(n);
const direction=value=>({up:180,north:180,right:270,east:270,down:0,south:0,left:90,west:90})[String(value).toLowerCase()]??value;
const fail=error=>({ok:false,changed:false,error});
function clone(value,seen=new WeakMap()){
 if(!value||typeof value!=='object')return value;if(seen.has(value))return seen.get(value);
 const proto=Object.getPrototypeOf(value);if(!Array.isArray(value)&&proto!==Object.prototype&&proto!==null)return value;
 const result=Array.isArray(value)?[]:{};seen.set(value,result);for(const [key,item]of Object.entries(value))result[key]=clone(item,seen);
 for(const symbol of Object.getOwnPropertySymbols(value))if(typeof value[symbol]!=='object')Object.defineProperty(result,symbol,{value:value[symbol]});
 return result;
}
const copyItem=item=>{const result=clone(Object.fromEntries(Object.entries(item).filter(([key])=>key!=='collisionBoxes')));Object.defineProperty(result,'collisionBoxes',{value:(item.collisionBoxes||[]).map(b=>({...b})),configurable:true});return result;};
function supportOf(item,items){
 if(!item.supportedBy||item.supportedBy==='north-wall')return null;
 return items.find(p=>p!==item&&(p.id===item.supportedBy||((p.asset===item.supportedBy||p.furnitureRole===item.supportedBy||p.slot===item.supportedBy||p.collectionSlot===item.supportedBy)&&(!item.roomId||!p.roomId||item.roomId===p.roomId))))||null;
}
function canonicalItems(items,catalog){
 const result=items.map(copyItem);
 for(const item of result){const parent=supportOf(item,result);if(parent){item.supportedBy=parent.id;item.solid=false;item.depth=furnitureFacingDepth(catalog.get(parent.asset),parent,parent.y)+.25;}else if(item.supportedBy&&item.supportedBy!=='north-wall'){delete item.supportedBy;delete item.depth;}}
 for(const item of result){item.collisionBoxes.splice(0,item.collisionBoxes.length,...(item.solid?furnitureFacingBoxes(catalog.get(item.asset),item):[]));}
 return result;
}
function signature(scene){
 const data=JSON.stringify({id:scene.id,width:scene.width,height:scene.height,walls:scene.walls,doors:scene.privacyDoors,items:scene.items.map(i=>[i.id,i.asset,i.w,i.h,i.solid,i.wallMounted,i.layer])});let hash=2166136261;
 for(let i=0;i<data.length;i++){hash^=data.charCodeAt(i);hash=Math.imul(hash,16777619);}return 'room-'+(hash>>>0).toString(16).padStart(8,'0');
}
function doorClearance(scene){
 const areas=[],targets=[];
 for(const d of scene.privacyDoors||[]){const vertical=d.axis==='vertical',length=d.length||36,cx=vertical?d.x:d.x+length/2,cy=vertical?d.y+length/2:d.y;
  areas.push(vertical?{x:cx-30,y:cy-length/2-6,w:60,h:length+12}:{x:cx-length/2-6,y:cy-30,w:length+12,h:60});
  targets.push(vertical?{x:cx-24,y:cy}:{x:cx,y:cy-24},vertical?{x:cx+24,y:cy}:{x:cx,y:cy+24});
 }
 if(point(scene.spawn)){areas.push({x:scene.spawn.x-16,y:scene.spawn.y-16,w:32,h:32});targets.push({...scene.spawn});}
 const paths=[];for(const actor of scene.actors||[])if(point(actor)){areas.push({x:actor.x-14,y:actor.y-14,w:28,h:28});targets.push({x:actor.x,y:actor.y});if(point(scene.spawn))paths.push([actor,{x:actor.x,y:scene.spawn.y},scene.spawn]);}
 // A showroom's tour may detour after decorating. Protect its destination's
 // reachability instead of reserving every old transit leg as empty floor.
 const browse=scene.showroom?.apartment?.visitRoute?.at(-1);if(point(browse))targets.push({...browse});
 for(const path of paths)for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];if(!point(a)||!point(b))continue;areas.push({x:Math.min(a.x,b.x)-8,y:Math.min(a.y,b.y)-8,w:Math.abs(b.x-a.x)+16,h:Math.abs(b.y-a.y)+16});targets.push({...b});}
 const p=scene.portalExit;if(point(p?.threshold)&&point(p.enterNormal)){const at={x:p.threshold.x+p.enterNormal.x*24,y:p.threshold.y+p.enterNormal.y*24};areas.push({x:at.x-18,y:at.y-18,w:36,h:36});targets.push(at);}
 return {areas,targets};
}
function canReach(scene,solids,targets){
 if(!targets.length)return true;const step=8,cols=Math.ceil(scene.width/step),rows=Math.ceil(scene.height/step),blocked=new Uint8Array(cols*rows),seen=new Uint8Array(cols*rows),queue=new Int32Array(cols*rows);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(x*step+4<40||x*step+4>scene.width-40||y*step+4<112||y*step+4>scene.height-40)blocked[y*cols+x]=1;
 for(const b of solids){const x0=Math.max(0,Math.ceil((b.x-RADIUS-4)/step)),x1=Math.min(cols-1,Math.floor((b.x+b.w+RADIUS-4)/step)),y0=Math.max(0,Math.ceil((b.y-RADIUS-4)/step)),y1=Math.min(rows-1,Math.floor((b.y+b.h+RADIUS-4)/step));for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)blocked[y*cols+x]=1;}
 const origin=scene.spawn||targets[0],sx=Math.floor(origin.x/step),sy=Math.floor(origin.y/step);let end=0;
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=sx+dx,y=sy+dy,n=y*cols+x;if(x>=0&&y>=0&&x<cols&&y<rows&&!blocked[n]&&!seen[n]){seen[n]=1;queue[end++]=n;}}
 for(let head=0;head<end;head++){const n=queue[head],x=n%cols,y=Math.floor(n/cols);for(const [X,Y]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const k=Y*cols+X;if(X>=0&&Y>=0&&X<cols&&Y<rows&&!blocked[k]&&!seen[k]){seen[k]=1;queue[end++]=k;}}}
 return targets.every(p=>{const x=Math.floor(p.x/step),y=Math.floor(p.y/step);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X>=0&&Y>=0&&X<cols&&Y<rows&&seen[Y*cols+X]&&Math.hypot(X*step+4-p.x,Y*step+4-p.y)<14)return true;}return false;});
}

/** Committed scene is independent of authored models; held previews never save. */
export function createRoomLayoutModel({themeId,scene:authored,catalog,record:initialRecord}={}){
 if(!validId(themeId)||!authored||!finite(authored.width)||!finite(authored.height)||!catalog?.get)throw Error('Choose a valid room theme and asset catalog.');
 const base=clone(authored);base.items=(authored.items||[]).map((i,index)=>copyItem({...i,id:i.id||'base-'+index,collisionBoxes:i.collisionBoxes||[]}));
 if(new Set(base.items.map(i=>i.id)).size!==base.items.length)throw Error('The room contains repeated furniture IDs.');
 const authoredBases=new Set((authored.items||[]).flatMap(i=>i.collisionBoxes||[])),structural=(authored.solids||[]).filter(b=>!authoredBases.has(b)).map(b=>({...b}));
 const originalItems=canonicalItems(base.items,catalog),rugItems=createRoomRugItems(base,catalog),rugMap=new Map(rugItems.map(item=>[item.roomRugId,item])),baseItems=canonicalItems([...originalItems,...rugItems],catalog),baseMap=new Map(baseItems.map(i=>[i.id,i])),originalMap=new Map(originalItems.map(i=>[i.id,i])),baseSignature=signature({...base,items:originalItems}),clearance=doorClearance(base);
 // Textured rugs use the normal picking/history/rendering pipeline, while
 // their optional saved poses leave every existing furniture signature intact.
 base.rugs=(base.rugs||[]).filter(rug=>!rug.texture);
 // Only this explicitly appended family is compatible with the preceding
 // room. Changes to old IDs, asset sizes, walls or doors still fail strictly.
 const expansionItems=originalItems.filter(i=>i.roomExpansion==='family-room-1'),legacyItems=originalItems.filter(i=>i.roomExpansion!=='family-room-1'),legacyMap=new Map(legacyItems.map(i=>[i.id,i])),legacySignature=expansionItems.length?signature({...base,items:legacyItems}):null;
 const legacyPoses=new Map(expansionItems.length?legacyItems.flatMap(item=>{const pose=base.roomExpansionLegacyPoses?.[item.id];return point(pose)&&rotation(pose.rotation??0)?[[item.id,{x:pose.x,y:pose.y,rotation:pose.rotation??0}]]:[];}):[]);
 const personalFloor=apartmentDecorBounds(base)||[],personalWalls=apartmentWallDecorBounds(base)||[];
 const wallAreas=[{x:28,y:0,w:base.width-56,h:106},...(base.rooms||[]).flatMap(r=>r.wallpaperAreas||[]),...(base.walls||[]).map(w=>({x:w.x,y:w.y-96,w:w.w,h:96})).filter(r=>r.w>40)];
 let current=clone(base),held=null,revision=0,serial=1,undo=[],redo=[];current.items=baseItems.map(copyItem);
 function rebuild(items=current.items){const next={...current,items,solids:[...structural,...items.flatMap(i=>i.collisionBoxes)],layoutRevision:revision};for(const symbol of Object.getOwnPropertySymbols(current))Object.defineProperty(next,symbol,{value:current[symbol]});current=next;}
 rebuild();
 function geometryError(item){
  const a=catalog.get(item.asset);if(!a)return 'This furniture artwork is unavailable.';
  if(!validId(item.id)||!point(item)||![item.w,item.h].every(n=>finite(n)&&n>0&&n<=8192)||!rotation(item.rotation||0))return 'Furniture needs a valid position, size and cardinal facing.';
  const visual=furnitureFacingBounds(a,item);
  if(item.wallMounted){if(!wallAreas.some(area=>contains(area,visual)))return 'Place wall decorations completely on a wall.';if(personalWalls.some(area=>overlap(area,visual)))return 'Keep this wall space free for your purchased decorations.';const glass=(current.windows||[]).map(w=>({x:w.x-w.w/2,y:w.y+6,w:w.w,h:62}));if(glass.some(w=>overlap(w,visual)))return 'Leave the window clear.';}
  else if(item.layer==='ground'){if(!contains({x:28,y:106,w:base.width-56,h:base.height-134},visual))return 'Keep the rug or floor decoration inside the room.';}
  else if(!item.collisionBoxes.length&&!item.supportedBy&&(item.x<28||item.x>base.width-28||item.y<106||item.y>base.height-28))return 'Keep furniture inside the apartment.';
  for(const b of item.collisionBoxes){if(!contains({x:28,y:106,w:base.width-56,h:base.height-134},b))return 'Keep the furniture base inside the room.';if(personalFloor.some(area=>overlap(area,b)))return 'Keep this floor space free for your purchased furniture.';if(structural.some(w=>overlap(b,w)))return 'That spot is occupied by a wall.';if(clearance.areas.some(r=>overlap(b,r)))return 'Leave doorways and the arrival point clear.';}
  return null;
 }
 function validate(items,{changedIds,reach=false}={}){
  if(items.filter(item=>!item.roomRugId).length>MAX_ITEMS)return 'A room can contain up to600 furniture pieces.';
  const ids=new Set();for(const item of items){if(ids.has(item.id))return 'The layout contains repeated furniture IDs.';ids.add(item.id);if(!changedIds||changedIds.has(item.id)){const original=baseMap.get(item.id),oldPose=legacyPoses.get(item.id),samePose=pose=>pose&&item.x===pose.x&&item.y===pose.y&&(item.rotation||0)===(pose.rotation||0),unchanged=original&&item.supportedBy===original.supportedBy&&(samePose(original)||samePose(oldPose));const error=unchanged?null:geometryError(item);if(error)return error;}}
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)if(!changedIds||changedIds.has(items[i].id)||changedIds.has(items[j].id)){if(items[i].collisionBoxes.some(a=>items[j].collisionBoxes.some(b=>overlap(a,b))))return 'That spot is occupied by another piece of furniture.';}
  if(reach&&!canReach(current,[...structural,...items.flatMap(i=>i.collisionBoxes)],clearance.targets))return 'Keep a walkable route from the entrance to every door.';
  return null;
 }
 function snapshot(){return current.items.map(copyItem);}
 function commit(items){undo.push(snapshot());if(undo.length>MAX_HISTORY)undo.shift();redo=[];const next=canonicalItems(items,catalog);revision++;rebuild(next);return {ok:true,changed:true};}
 function descendants(item,items){const set=new Set([item.id]);let changed=true;while(changed){changed=false;for(const i of items){const p=supportOf(i,items);if(p&&set.has(p.id)&&!set.has(i.id)){set.add(i.id);changed=true;}}}return items.filter(i=>i!==item&&set.has(i.id));}
 function ghost(){
  if(!held)return null;return {item:copyItem(held.item),companions:held.companions.map(copyItem),valid:held.valid,reason:held.reason,originalId:held.originalId,offset:{...held.offset},boxes:[...held.item.collisionBoxes,...held.companions.flatMap(i=>i.collisionBoxes)].map(b=>({...b}))};
 }
 function updatePreview(){
  const oldBounds=furnitureFacingBounds(catalog.get(held.original.asset),held.original),newBounds=furnitureFacingBounds(catalog.get(held.item.asset),held.item);
  held.companions=held.originalCompanions.map(source=>{const item=copyItem(source),u=(source.x-oldBounds.x)/oldBounds.w,v=(source.y-oldBounds.y)/oldBounds.h;item.x=newBounds.x+u*newBounds.w;item.y=newBounds.y+v*newBounds.h;item.depth=furnitureFacingDepth(catalog.get(held.item.asset),held.item,held.item.y)+.25;return item;});
  const removed=new Set([held.originalId,...held.originalCompanions.map(i=>i.id)]),remaining=current.items.filter(i=>!removed.has(i.id));
  const smallRole=catalog.get(held.item.asset)?.purpose;
  if(held.original.supportedBy&&held.original.supportedBy!=='north-wall'||['table-decor','lava-lamp','table-lamp','plant','arcade','plush','toy'].includes(smallRole)){
   const supports=remaining.filter(i=>['desk','coffee-table','dining-table','nightstand','record-console','bed','kitchen-counter'].includes(catalog.get(i.asset)?.purpose));
   const parent=supports.filter(i=>{const b=furnitureFacingBounds(catalog.get(i.asset),i);return held.item.x>=b.x&&held.item.x<=b.x+b.w&&held.item.y>=b.y&&held.item.y<=b.y+b.h&&held.item.w<=b.w*1.15;}).sort((a,b)=>furnitureFacingDepth(catalog.get(b.asset),b,b.y)-furnitureFacingDepth(catalog.get(a.asset),a,a.y))[0];
   if(parent){held.item.supportedBy=parent.id;held.item.solid=false;held.item.depth=furnitureFacingDepth(catalog.get(parent.asset),parent,parent.y)+.25;}
   else if(held.item.supportedBy&&held.item.supportedBy!=='north-wall'){delete held.item.supportedBy;delete held.item.depth;const a=catalog.get(held.item.asset);held.item.solid=!!(a.solid??a.collisionDefault??a.boxes?.length);}
  }
  const items=canonicalItems([...remaining,held.item,...held.companions],catalog);held.item=items.find(i=>i.id===held.item.id);held.companions=held.companions.map(i=>items.find(n=>n.id===i.id));const changedIds=new Set([held.item.id,...held.companions.map(i=>i.id)]);
  const reason=validate(items,{changedIds});held.valid=!reason;held.reason=reason||'';return {ok:held.valid,changed:false,...(reason?{error:reason}:{}),preview:ghost()};
 }
 function begin(item,point,originalId){const original=copyItem(item),companions=originalId?descendants(item,current.items):[];held={item:copyItem(item),original,originalId,offset:{x:point.x-item.x,y:point.y-item.y},originalCompanions:companions.map(copyItem),companions:[],valid:true,reason:''};return updatePreview();}
 function pick(p){
  if(!point(p))return fail('Choose a point inside the room.');if(held)return fail('Place or cancel the furniture you are holding first.');
  const hit=current.items.map((item,index)=>({item,index,layer:item.layer==='ground'?0:item.wallMounted?.5:1,depth:item.depth??furnitureFacingDepth(catalog.get(item.asset),item,item.y)})).filter(({item})=>{const b=furnitureFacingBounds(catalog.get(item.asset),item);return p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;}).sort((a,b)=>b.layer-a.layer||b.depth-a.depth||b.index-a.index)[0];
  return hit?begin(hit.item,p,hit.item.id):fail('No furniture at that point.');
 }
 function move(p){if(!held)return fail('Choose furniture first.');if(!point(p))return fail('Choose a valid position.');held.item.x=p.x-held.offset.x;held.item.y=p.y-held.offset.y;return updatePreview();}
 function rotate(value){if(!held)return fail('Choose furniture first.');const r=direction(value);if(!rotation(r))return fail('Choose north, east, south or west.');held.item.rotation=r;return updatePreview();}
 function place(p){if(!held)return fail('Choose furniture first.');if(p){const moved=move(p);if(!moved.ok)return moved;}if(!held.valid)return fail(held.reason);
  const removed=new Set([held.originalId,...held.originalCompanions.map(i=>i.id)]),items=[...current.items.filter(i=>!removed.has(i.id)),held.item,...held.companions],error=validate(items,{reach:true});if(error){held.valid=false;held.reason=error;return fail(error);}const result=commit(items);held=null;return result;
 }
 function add(source,p){
  if(held)return fail('Place or cancel the furniture you are holding first.');if(!point(p))return fail('Choose a valid position.');const spec=typeof source==='string'?{asset:source}:source,a=catalog.get(spec?.asset);if(!a)return fail('Choose furniture from the asset library.');const productScale=spec.scale??1;if(!finite(productScale)||productScale<=0||productScale>8)return fail('This furniture has an invalid product size.');
  let id;do{id='layout-item-'+serial++;}while(current.items.some(i=>i.id===id)||baseMap.has(id));
  const scale=furniturePresentationScale(spec,current,a)*productScale,item={id,asset:spec.asset,x:p.x,y:p.y,w:a.w*scale,h:a.h*scale,rotation:0,solid:!!(a.solid??a.collisionDefault??a.boxes?.length),wallMounted:!!a.wallMounted,layer:a.layer||'objects',sourceScale:productScale,...(typeof spec.productId==='string'?{productId:spec.productId}:{})};Object.defineProperty(item,'collisionBoxes',{value:[],configurable:true});return begin(item,p,null);
 }
 function remove(id=held?.originalId){if(!validId(id))return fail('Pick up furniture before removing it.');const item=current.items.find(i=>i.id===id);if(!item)return fail('That furniture is no longer in this room.');const ids=new Set([id,...descendants(item,current.items).map(i=>i.id)]);const result=commit(current.items.filter(i=>!ids.has(i.id)));held=null;return result;}
 function history(from,to){held=null;if(!from.length)return {ok:true,changed:false};to.push(snapshot());const next=canonicalItems(from.pop(),catalog);revision++;rebuild(next);return {ok:true,changed:true};}
 function record(){
  const result={format:ROOM_LAYOUT_FORMAT,version:ROOM_LAYOUT_VERSION,themeId,baseSignature,placements:current.items.filter(i=>originalMap.has(i.id)).map(i=>({id:i.id,x:i.x,y:i.y,rotation:i.rotation||0,support:i.supportedBy&&i.supportedBy!=='north-wall'?i.supportedBy:null})),removed:originalItems.filter(i=>!current.items.some(n=>n.id===i.id)).map(i=>i.id),added:current.items.filter(i=>!baseMap.has(i.id)).map(i=>({id:i.id,asset:i.asset,x:i.x,y:i.y,rotation:i.rotation||0,scale:i.sourceScale??1,...(i.supportedBy&&i.supportedBy!=='north-wall'?{support:i.supportedBy}:{}),...(i.productId?{productId:i.productId}:{})}))};
  const rugs=[];for(const source of rugItems){const item=current.items.find(i=>i.id===source.id);if(!item)rugs.push({id:source.roomRugId,removed:true});else if(item.x!==source.x||item.y!==source.y||(item.rotation||0)!==(source.rotation||0))rugs.push({id:source.roomRugId,x:item.x,y:item.y,rotation:item.rotation||0});}
  if(rugs.length)result.rugs=rugs;return result;
 }
 function rugsFromRecord(value){
  const rugs=new Map(rugItems.map(item=>[item.roomRugId,copyItem(item)]));if(value===undefined)return [...rugs.values()];
  if(!Array.isArray(value)||value.length>rugItems.length)throw Error('The room contains an invalid rug layout.');
  const seen=new Set();for(const pose of value){if(!validId(pose?.id)||seen.has(pose.id)||!rugMap.has(pose.id)||pose.removed!==undefined&&typeof pose.removed!=='boolean')throw Error('A rug placement is invalid.');seen.add(pose.id);
   if(pose.removed){rugs.delete(pose.id);continue;}if(!point(pose)||!rotation(pose.rotation??0))throw Error('A rug needs a valid position and cardinal facing.');Object.assign(rugs.get(pose.id),{x:pose.x,y:pose.y,rotation:pose.rotation??0});
  }return [...rugs.values()];
 }
 function itemsFromRecord(value){
  const legacy=!!value&&legacySignature!==null&&value.baseSignature===legacySignature,originals=legacy?legacyItems:originalItems,sourceMap=legacy?legacyMap:originalMap;
  if(!value||value.format!==ROOM_LAYOUT_FORMAT||value.version!==ROOM_LAYOUT_VERSION||value.themeId!==themeId||value.baseSignature!==baseSignature&&!legacy||!Array.isArray(value.placements)||!Array.isArray(value.removed)||!Array.isArray(value.added))throw Error('This layout belongs to a different room or room version.');
  if(value.placements.length+value.added.length>MAX_ITEMS||value.removed.length>originals.length)throw Error('The room layout is too large.');const removed=new Set(value.removed);if(removed.size!==value.removed.length||[...removed].some(id=>!sourceMap.has(id)))throw Error('The removed furniture list is invalid.');
  const items=[],seen=new Set();for(const p of value.placements){if(!validId(p?.id)||seen.has(p.id)||removed.has(p.id)||!sourceMap.has(p.id)||!point(p)||!rotation(p.rotation??0))throw Error('A furniture placement is invalid.');const item=copyItem(sourceMap.get(p.id));Object.assign(item,{x:p.x,y:p.y,rotation:p.rotation??0});if(p.support!==undefined){if(p.support!==null&&!validId(p.support))throw Error('A furniture support is invalid.');if(p.support===null&&item.supportedBy!=='north-wall'){const wasSupported=!!item.supportedBy;delete item.supportedBy;delete item.depth;if(wasSupported){const a=catalog.get(item.asset);item.solid=!!(a.solid??a.collisionDefault??a.boxes?.length);}}else if(p.support)item.supportedBy=p.support;}items.push(item);seen.add(p.id);}
  if(originals.some(i=>!seen.has(i.id)&&!removed.has(i.id)))throw Error('The room layout omits original furniture without removing it.');
  for(const p of value.added){if(!validId(p?.id)||seen.has(p.id)||baseMap.has(p.id)||typeof p.asset!=='string'||!point(p)||!rotation(p.rotation??0)||!finite(p.scale??1)||(p.scale??1)<=0||(p.scale??1)>8)throw Error('An added furniture placement is invalid.');const a=catalog.get(p.asset);if(!a)throw Error('This layout uses unavailable furniture: '+p.asset);const scale=furniturePresentationScale(p,current,a)*(p.scale??1),item={id:p.id,asset:p.asset,x:p.x,y:p.y,w:a.w*scale,h:a.h*scale,rotation:p.rotation??0,solid:!!(a.solid??a.collisionDefault??a.boxes?.length),wallMounted:!!a.wallMounted,layer:a.layer||'objects',sourceScale:p.scale??1,...(p.support?{supportedBy:p.support,solid:false}:{}),...(typeof p.productId==='string'?{productId:p.productId}:{})};Object.defineProperty(item,'collisionBoxes',{value:[],configurable:true});items.push(item);seen.add(p.id);}
  for(const item of items)if(item.supportedBy&&item.supportedBy!=='north-wall'){const parent=items.find(i=>i.id===item.supportedBy);if(!parent||parent===item)throw Error('A tabletop decoration is missing its support.');const a=catalog.get(item.asset);if(!['table-decor','lava-lamp','table-lamp','plant','arcade','plush','toy'].includes(a.purpose)&&!baseMap.get(item.id)?.supportedBy)throw Error('Only small decorations can rest on supporting furniture.');let p=parent,steps=0;while(p?.supportedBy&&p.supportedBy!=='north-wall'){p=items.find(i=>i.id===p.supportedBy);if(++steps>items.length)throw Error('Furniture supports cannot form a loop.');}}
  return {items:canonicalItems([...items,...rugsFromRecord(value.rugs)],catalog),legacy};
 }
 function mergeExpansion(items){
  const admitted=new Set(items.map(i=>i.id)),attempted=new Set(),visiting=new Set();
  function admit(source){
   if(admitted.has(source.id))return true;if(attempted.has(source.id)||visiting.has(source.id))return false;visiting.add(source.id);
   const item=copyItem(source),sourceParent=supportOf(source,baseItems);
   if(sourceParent){
    if(!admitted.has(sourceParent.id)&&sourceParent.roomExpansion==='family-room-1')admit(sourceParent);
    const parent=items.find(i=>i.id===sourceParent.id);if(!parent){visiting.delete(source.id);attempted.add(source.id);return false;}
    // New tabletop pieces may follow an edited support; saved furniture is
    // never moved, resized or removed to make an expansion fit.
    const old=furnitureFacingBounds(catalog.get(sourceParent.asset),sourceParent),next=furnitureFacingBounds(catalog.get(parent.asset),parent);
    item.x=next.x+(source.x-old.x)/old.w*next.w;item.y=next.y+(source.y-old.y)/old.h*next.h;
   }
   const next=canonicalItems([...items,item],catalog),candidate=next.at(-1),visual=furnitureFacingBounds(catalog.get(item.asset),item),decoration=candidate.wallMounted||candidate.supportedBy&&candidate.supportedBy!=='north-wall';
   const obstructsDecoration=decoration&&items.some(other=>(candidate.wallMounted&&other.wallMounted||candidate.supportedBy&&candidate.supportedBy===other.supportedBy)&&overlap(visual,furnitureFacingBounds(catalog.get(other.asset),other)));
   const error=geometryError(candidate)||obstructsDecoration||validate(next,{changedIds:new Set([source.id]),reach:true});
   visiting.delete(source.id);attempted.add(source.id);
   if(error)return false;items=next;admitted.add(source.id);return true;
  }
  for(const source of expansionItems)admit(source);
  return items;
 }
 function applyRecord(value,{initial=false}={}){let decoded;try{decoded=itemsFromRecord(value);}catch(e){return fail(e.message);}let {items}=decoded;const error=validate(items,{reach:true});if(error)return fail(error);if(decoded.legacy)items=mergeExpansion(items);held=null;if(initial){rebuild(items);undo=[];redo=[];return {ok:true,changed:false};}return commit(items);}
 const api={get themeId(){return themeId;},get scene(){return current;},get held(){return ghost();},get revision(){return revision;},get canUndo(){return !!undo.length;},get canRedo(){return !!redo.length;},get hasEdits(){return JSON.stringify(record())!==baseRecord;},pick,move,rotate,place,add,remove,cancel(){held=null;return {ok:true,changed:false};},undo:()=>history(undo,redo),redo:()=>history(redo,undo),reset(){held=null;return commit(baseItems);},record,applyRecord};
 const baseRecord=JSON.stringify(record());if(initialRecord){const result=applyRecord(initialRecord,{initial:true});if(!result.ok){const error=Error(result.error);error.code='INVALID_ROOM_LAYOUT';throw error;}}
 return api;
}
