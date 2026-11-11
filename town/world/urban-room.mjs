import {furnitureFacingBoxes,furnitureFacingBounds} from './furniture-facing.mjs?v=apartment-scale-2';
// Room placements are local to the active arcade profile. Notes ownership is
// managed by the wallet; this file never grants furniture or changes currency.
export const ROOM_KEY='codaUrbanRoomV1';
const MAX_ITEMS=100,MAX_BYTES=96*1024;
const clone=items=>items.map(item=>({...item}));
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const rect=value=>value&&finite(value.x)&&finite(value.y)&&finite(value.w)&&finite(value.h)&&value.w>0&&value.h>0;
const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const contains=(a,b)=>b.x>=a.x&&b.y>=a.y&&b.x+b.w<=a.x+a.w&&b.y+b.h<=a.y+a.h;

// Coordinates use the same bottom-center anchor as assets in the town builder.
// Only collision boxes block walking; plants and wall hangings can overlap air.
export function roomItemBoxes(item,catalog){
 const asset=catalog?.get(item.asset),scale=item.scale??1;
 if(!asset||!finite(scale)||scale<=0)return [];
 return furnitureFacingBoxes(asset,{x:item.x,y:item.y,scale,rotation:item.rotation??0});
}

export function createRoomStorage(options={}){
 const {catalog,furniture=[],getBounds=()=>[],getSolids=()=>[],owned=()=>[]}=options;
 const owner=options.owner??'guest',validOwner=typeof owner==='string'&&owner.length>0&&owner.length<=256&&!/[\u0000-\u001f]/.test(owner);
 const stock=new Map(furniture.map(item=>[item.id,item]));
 let storage=options.storage,items=[];
 if(storage===undefined)try{storage=globalThis.localStorage;}catch{}
 const fail=error=>({ok:false,error});
 const snapshot=()=>clone(items);
 function validate(next){
  if(!validOwner)return 'The current player could not be identified. Reopen your room from the arcade.';
  if(!Array.isArray(next)||next.length>MAX_ITEMS)return 'A room can contain up to 100 decorations.';
  const ownership=new Set(owned()||[]),fixed=(getSolids()||[]).filter(rect),ids=new Set(),placed=new Set(),allBoxes=[];
  for(const item of next){
   if(!item||typeof item!=='object'||Array.isArray(item)||typeof item.id!=='string'||!/^[a-z0-9:_-]{1,100}$/i.test(item.id)||ids.has(item.id))return 'This room contains an invalid or repeated decoration.';
   const product=stock.get(item.item),asset=catalog?.get(item.asset),scale=item.scale??1,expected=product?.scale??1;
   if(!product||product.asset!==item.asset||!asset||!finite(asset.w)||!finite(asset.h)||asset.w<=0||asset.h<=0||!finite(item.x)||!finite(item.y))return 'This room contains furniture that is unavailable.';
   if(item.rotation!==undefined&&![0,90,180,270].includes(item.rotation))return 'This decoration has an invalid facing. Choose north, south, east or west.';
   if(!finite(scale)||scale<=0||scale!==expected)return 'This decoration has an invalid size. Place it again from your inventory.';
   if(!ownership.has(item.item))return 'Buy this decoration at Coda Furnishings before placing it.';
   if(placed.has(item.item))return 'Each decoration can be placed once. Select it again to move it.';
   const bounds=(getBounds(item,asset)||[]).filter(rect);
   const visual=furnitureFacingBounds(asset,{x:item.x,y:item.y,scale,rotation:item.rotation??0});
   if(!bounds.some(bound=>contains(bound,visual)))return 'Keep the entire decoration inside the furnished area of your room.';
   const boxes=roomItemBoxes(item,catalog);
   if(boxes.some(box=>fixed.some(wall=>intersects(box,wall))))return 'That spot is occupied by a wall or built-in furniture.';
   if(boxes.some(box=>allBoxes.some(other=>intersects(box,other))))return 'That spot is occupied by another decoration.';
   ids.add(item.id);placed.add(item.item);allBoxes.push(...boxes);
  }
  return null;
 }
 function save(next){
  let error;
  try{error=validate(next);}catch{return fail('Your room could not be checked. Reopen the apartment and try again.');}
  if(error)return fail(error);
  try{
   if(!storage||typeof storage.setItem!=='function')throw Error('storage');
   const json=JSON.stringify({version:1,owner,items:next});
   if(json.length>MAX_BYTES)return fail('This room layout is too large to save. Remove a decoration and try again.');
   storage.setItem(ROOM_KEY,json);
  }catch{return fail('Browser saving is unavailable. Your room has not changed. Try again.');}
  items=clone(next);
  return {ok:true,items:snapshot()};
 }
 function load(){
  let raw;
  try{raw=storage?.getItem(ROOM_KEY);}catch{return fail('Browser saving is unavailable. Your saved room could not be opened.');}
  if(!raw){items=[];return {ok:true,items:[]};}
  if(typeof raw!=='string'||raw.length>MAX_BYTES)return fail('The saved room is too large to open safely. It has not been changed.');
  let value;
  try{value=JSON.parse(raw);}catch{return fail('The saved room could not be read. It has not been changed.');}
  if(!value||value.version!==1||typeof value.owner!=='string'||!Array.isArray(value.items))return fail('The saved room has an unsupported format. It has not been changed.');
  // The classroom storage service restores this key when profiles change. A
  // delayed iframe response must never expose the previous student's layout.
  if(value.owner!==owner){items=[];return {ok:true,items:[],differentOwner:true};}
  let error;
  try{error=validate(value.items);}catch{error='The saved room could not be checked.';}
  if(error)return fail(error+' Your saved room has not been changed.');
  items=value.items.map(item=>Object.fromEntries(Object.entries(item).filter(([key])=>['id','item','asset','x','y','scale','rotation'].includes(key))));
  return {ok:true,items:snapshot()};
 }
 function place(itemId,x,y,rotation){
  const product=stock.get(itemId);
  if(!product)return fail('This decoration is unavailable.');
  const existing=items.find(item=>item.item===itemId),item={id:existing?.id||'room-'+itemId,item:itemId,asset:product.asset,x,y,scale:product.scale??1};
  if(rotation!==undefined)item.rotation=rotation;else if(existing&&Object.prototype.hasOwnProperty.call(existing,'rotation'))item.rotation=existing.rotation;
  const result=save([...items.filter(other=>other.item!==itemId),item]);
  return result.ok?{...result,item:{...item}}:result;
 }
 function remove(instanceId){
  if(!items.some(item=>item.id===instanceId))return fail('Select a decoration in your room to remove it.');
  return save(items.filter(item=>item.id!==instanceId));
 }
 return {load,snapshot,place,remove,clear:()=>save([])};
}
