import {interiorActorScale} from './interior-scale.mjs?v=north-walls-1';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs?v=north-walls-1';
import {FAMILY_FURNITURE_ASSETS,getFamilyFurniture} from './family-furniture-definitions.mjs?v=north-walls-1';
import {apartmentDecorBounds} from './personal-room-areas.mjs?v=north-walls-1';
import {furnitureAtGroundCenter,furnitureFacingBoxes,furnitureFacingBounds,furnitureFacingDepth} from './furniture-facing.mjs?v=north-walls-1';
import {applyMidcenturyRoomLayout} from './midcentury-room-layout.mjs?v=north-walls-1';

const definitions=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(a=>[a.id,a])),CALIBRATED=Symbol.for('coda.privateFurnitureCalibration');
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const median=list=>[...list].sort((a,b)=>a-b)[Math.floor(list.length/2)];
const slot=(item,a)=>item.slot||item.collectionSlot||a?.slot;
const assetFor=(item,catalog)=>catalog?.get(item.asset)||definitions.get(item.asset);
// Logical sizes are role targets, referenced to the playable Arcade's human
// and furniture proportions, rather than assuming catalog pixels share units.
const ROLE_SCALE=Object.freeze({bed:.70,sofa:.80,wardrobe:.60,nightstand:.45,desk:.70,'desk-chair':.50,'reading-chair':.60,'dining-table':.70,'dining-chair':.50,'coffee-table':.75,sink:.55,stove:.55,fridge:.60,counter:.55,pantry:.60,toilet:.55,vanity:.60,'bath-fixture':.60,'linen-storage':.60,mirror:.55,shelf:.55,'record-console':.70,'floor-lamp':.50,'table-lamp':.45,rug:1.10,poster:.50,toy:.45,'lava-lamp':.50,arcade:.65,instrument:.65,plant:.50,clock:.50});
const legacyRoles={'furniture-0-180':'instrument','furniture-1-180':'sofa','furniture-2-180':'bed','furniture-3-180':'counter','furniture-4-180':'stove','furniture-5-180':'dining-table','furniture-6-180':'toilet','furniture-7-180':'bath-fixture','furniture-8-180':'vanity'};
const purposeRoles={'kitchen-sink':'sink','kitchen-counter':'counter','bath-vanity':'vanity',shower:'bath-fixture',bathtub:'bath-fixture',chair:'reading-chair','wall-shelf':'shelf','wall-art':'poster','wall-clock':'clock','table-decor':'toy'};
function furnitureSlot(item,a){
 const explicit=slot(item,a);if(explicit)return explicit;
 const role=item.furnitureRole||a?.furnitureRole||a?.purpose;
 return purposeRoles[role]||role||legacyRoles[item.asset]||'decor';
}
export function furniturePresentationScale(item,scene,asset){
 const actor=typeof scene==='number'?scene:interiorActorScale(scene);if(actor===1)return 1;
 const a=asset||definitions.get(item.asset),role=furnitureSlot(item,a),reference=role==='bath-fixture'&&a?.purpose==='bathtub'?.65:ROLE_SCALE[role]??.50;
 if(a?.variant==='family-room'&&role==='rug'&&typeof scene==='object'){
  const room=scene.familyFurnitureZones?.living||scene.rooms?.find(r=>r.functionalRole==='living');
  if(room)return Math.min(reference,Math.max(.1,(room.w-24)/a.w),Math.max(.1,(room.h-24)/a.h))*actor/.375;
 }
 return reference*actor/.375;
}
function footprint(a,item){
 const boxes=furnitureFacingBoxes(a,item);
 if(!boxes.length)return {x:item.x,y:item.y,w:0,h:0,cx:item.x,cy:item.y};
 const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y)),right=Math.max(...boxes.map(b=>b.x+b.w)),bottom=Math.max(...boxes.map(b=>b.y+b.h));
 return {x,y,w:right-x,h:bottom-y,cx:(x+right)/2,cy:(y+bottom)/2};
}
function moveCenter(item,a,center){Object.assign(item,furnitureAtGroundCenter(a,item,center));}
function supportedParent(item,items){
 if(!item.supportedBy||item.supportedBy==='north-wall')return null;
 const candidates=items.filter(p=>p!==item&&(p.asset===item.supportedBy||p.furnitureRole===item.supportedBy||p.slot===item.supportedBy||p.collectionSlot===item.supportedBy));
 const original=!item.roomExpansion?candidates.filter(p=>!p.roomExpansion):[],parents=original.length?original:candidates;
 return parents.find(p=>p.roomId===item.roomId)||parents[0]||null;
}
function separateFrom(item,a,other,otherAsset,oldVector,gap=10){
 const p=footprint(a,item),base=footprint(otherAsset,other),horizontal=Math.abs(oldVector.x)>Math.abs(oldVector.y),side=(horizontal?oldVector.x:oldVector.y)<0?-1:1;
 moveCenter(item,a,horizontal?{x:base.cx+side*((base.w+p.w)/2+gap),y:p.cy}:{x:p.cx,y:base.cy+side*((base.h+p.h)/2+gap)});
}
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const intersects=(a,b,pad=0)=>a.x<b.x+b.w+pad&&a.x+a.w>b.x-pad&&a.y<b.y+b.h+pad&&a.y+a.h>b.y-pad;
function roomFor(scene,item,role){
 return scene.rooms.find(r=>item?.roomId&&r.id===item.roomId)||scene.rooms.find(r=>r.functionalRole===role)||scene.rooms.find(r=>r.functionalRole==='apartment');
}
function windowFrames(scene){return (scene.windows||[]).map(w=>({x:w.x-w.w/2-18,y:w.y-8,w:w.w+36,h:100}));}
function putCenterInside(item,a,room,center,margin=8){
 const b=footprint(a,item);moveCenter(item,a,{x:clamp(center.x,room.x+margin+b.w/2,room.x+room.w-margin-b.w/2),y:clamp(center.y,room.y+margin+b.h/2,room.y+room.h-margin-b.h/2)});
}
function northWall(item,a,room,x,scene){
 const b=footprint(a,item);putCenterInside(item,a,room,{x,y:room.y+6+b.h/2},6);
 for(const passage of scene?.interiorDesign?.circulation||[]){const at=footprint(a,item);if(intersects(at,passage)&&passage.w>passage.h)moveCenter(item,a,{x:at.cx,y:passage.y+passage.h+6+at.h/2});}
}
function outerSide(scene,room){
 if(room.side)return room.side;
 const door=(scene.privacyDoors||[]).find(d=>d.roomId===room.id||d.roomId===room.functionalRole||d.roomId?.endsWith('-'+room.functionalRole));
 if(!door)return 'left';const center=door.axis==='vertical'?door.x:door.x+door.length/2;return center<room.x+room.w/2?'right':'left';
}
function sideWall(item,a,room,side,y){
 item.rotation=side==='left'?270:90;const b=footprint(a,item);putCenterInside(item,a,room,{x:side==='left'?room.x+8+b.w/2:room.x+room.w-8-b.w/2,y},8);
}
function freeHeadwallX(scene,room,item,a,preferred){
 const original={x:item.x,y:item.y},frames=windowFrames(scene);northWall(item,a,room,preferred);
 const image=furnitureFacingBounds(a,item),relevant=frames.filter(w=>image.y<w.y+w.h&&image.y+image.h>w.y),start=room.x+6+item.w/2,end=room.x+room.w-6-item.w/2;
 const options=[clamp(preferred,start,end),start,end];for(const w of relevant)options.push(w.x-6-item.w/2,w.x+w.w+6+item.w/2);
 const valid=options.filter(x=>x>=start&&x<=end).sort((x,y)=>Math.abs(x-preferred)-Math.abs(y-preferred));
 for(const x of valid){northWall(item,a,room,x);if(!frames.some(w=>intersects(furnitureFacingBounds(a,item),w)))return x;}
 Object.assign(item,original);return clamp(preferred,start,end);
}
function arrangePrivateRooms(scene,assets,old){
 const bySlot=role=>scene.items.find(i=>furnitureSlot(i,assets.get(i))===role),a=item=>assets.get(item),oldCenter=item=>footprint(a(item),old.get(item));
 const bed=bySlot('bed'),night=bySlot('nightstand'),wardrobe=bySlot('wardrobe'),desk=bySlot('desk'),deskChair=bySlot('desk-chair');
 if(bed){
  const room=roomFor(scene,bed,'bedroom');bed.rotation=0;northWall(bed,a(bed),room,freeHeadwallX(scene,room,bed,a(bed),oldCenter(bed).cx));
  if(night){
   const b=footprint(a(bed),bed),n=footprint(a(night),night),preferred=oldCenter(night).cx<oldCenter(bed).cx?-1:1;
   let x=b.cx+preferred*((b.w+n.w)/2+5);if(x-n.w/2<room.x+6||x+n.w/2>room.x+room.w-6)x=b.cx-preferred*((b.w+n.w)/2+5);
   putCenterInside(night,a(night),room,{x,y:b.cy-b.h*.3},6);
  }
  if(wardrobe)sideWall(wardrobe,a(wardrobe),room,outerSide(scene,room),room.y+room.h*.66);
  if(desk){
   const windows=(scene.windows||[]).filter(w=>w.x>=room.x+desk.w/2&&w.x<=room.x+room.w-desk.w/2),target=windows.find(w=>Math.abs(w.x-bed.x)>(bed.w+desk.w)/2+12);
   const x=target?.x??clamp(oldCenter(desk).cx,room.x+desk.w/2+8,room.x+room.w-desk.w/2-8);desk.rotation=0;northWall(desk,a(desk),room,x);
   if(deskChair){deskChair.rotation=180;const d=footprint(a(desk),desk),c=footprint(a(deskChair),deskChair);putCenterInside(deskChair,a(deskChair),room,{x:d.cx,y:d.y+d.h+24+c.h/2});}
  }
 }

 const kitchenItems=['fridge','pantry','sink','counter','stove'].map(bySlot).filter(Boolean),sink=bySlot('sink');
 if(sink){
  const room=roomFor(scene,sink,'kitchen'),frames=windowFrames(scene),gap=1.5,ordered=kitchenItems;
  for(const item of ordered)item.rotation=0;
  const width=ordered.reduce((sum,item)=>sum+footprint(a(item),item).w,0)+gap*(ordered.length-1);
  const starts=[room.x+8,room.x+(room.w-width)/2,room.x+room.w-8-width];let best=null;
  for(const row of [ordered,[...ordered].reverse()])for(const start of starts){
   if(start<room.x+6||start+width>room.x+room.w-6)continue;let x=start,score=0;const poses=[];
   for(const item of row){const b=footprint(a(item),item);northWall(item,a(item),room,x+b.w/2,scene);x+=b.w+gap;poses.push([item,{x:item.x,y:item.y}]);if(['fridge','pantry'].includes(furnitureSlot(item,a(item))))for(const w of frames){const image=furnitureFacingBounds(a(item),item);if(intersects(image,w))score+=Math.min(image.x+image.w,w.x+w.w)-Math.max(image.x,w.x)+100;} }
   if(frames.length)score+=Math.min(...frames.map(w=>Math.abs(sink.x-w.x-w.w/2)))*.01;
   if(!best||score<best.score)best={score,poses};
  }
  if(best)for(const [item,pose]of best.poses)Object.assign(item,pose);
  const openServiceSpine=(scene.interiorDesign?.circulation||[]).some(p=>p.w>p.h&&p.y<room.y+40&&p.y+p.h>room.y);
  if(openServiceSpine){
   const side=room.x+room.w/2<scene.width/2?'left':'right',passageBottom=Math.max(...scene.interiorDesign.circulation.filter(p=>p.w>p.h&&p.y<room.y+40&&p.y+p.h>room.y).map(p=>p.y+p.h));
   let y=passageBottom+8;
   for(const item of kitchenItems.filter(i=>['fridge','pantry'].includes(furnitureSlot(i,a(i))))){item.rotation=side==='left'?270:90;const b=footprint(a(item),item);sideWall(item,a(item),room,side,y+b.h/2);y+=b.h+2;}
   const run=kitchenItems.filter(i=>['sink','counter','stove'].includes(furnitureSlot(i,a(i))));
   for(const item of run)item.rotation=180;
   const total=run.reduce((n,item)=>n+footprint(a(item),item).w,0)+gap*(run.length-1);let x=room.x+(room.w-total)/2;
   for(const item of run){const b=footprint(a(item),item);moveCenter(item,a(item),{x:x+b.w/2,y:room.y+room.h-6-b.h/2});x+=b.w+gap;}
  }
  const shelf=bySlot('shelf');if(shelf&&(/kitchen/.test(shelf.furnitureRole||'')||shelf.roomId==='kitchen')){shelf.x=sink.x;shelf.y=room.y-10;}
 }

 const vanity=bySlot('vanity'),mirror=bySlot('mirror'),bath=bySlot('bath-fixture'),toilet=bySlot('toilet'),linen=bySlot('linen-storage');
 if(vanity){
  const room=roomFor(scene,vanity,'bathroom');let x=oldCenter(vanity).cx;
  if(scene.resident==='player')x=Math.min(x,380-(mirror?.w||0)/2-8);
  vanity.rotation=0;northWall(vanity,a(vanity),room,x);
  if(mirror){mirror.x=vanity.x;mirror.y=vanity.y-vanity.h-6;}
  const side=outerSide(scene,room),serviceX=side==='left'?room.x+8:room.x+room.w-8;
  if(bath){
   bath.rotation=0;const b=footprint(a(bath),bath);northWall(bath,a(bath),room,side==='left'?serviceX+b.w/2:serviceX-b.w/2);
   if(intersects(footprint(a(bath),bath),footprint(a(vanity),vanity),5))sideWall(bath,a(bath),room,side,room.y+room.h*.36);
  }
  if(toilet){
   toilet.rotation=0;const t=footprint(a(toilet),toilet);putCenterInside(toilet,a(toilet),room,{x:side==='left'?serviceX+t.w/2:serviceX-t.w/2,y:room.y+room.h-34-t.h/2});
  }
  if(linen)sideWall(linen,a(linen),room,side,room.y+room.h*.60);
 }

 const sofa=bySlot('sofa'),coffee=bySlot('coffee-table'),seat=bySlot('reading-chair'),console=bySlot('record-console'),lamp=bySlot('floor-lamp'),rug=bySlot('rug');
 if(sofa){
  const room=roomFor(scene,sofa,'living');sofa.rotation=0;northWall(sofa,a(sofa),room,oldCenter(sofa).cx,scene);const s=footprint(a(sofa),sofa);
  if(coffee){coffee.rotation=0;const c=footprint(a(coffee),coffee);putCenterInside(coffee,a(coffee),room,{x:s.cx,y:s.y+s.h+24+c.h/2});}
  if(seat&&(!seat.roomId||!sofa.roomId||seat.roomId===sofa.roomId)){
   const c=coffee?footprint(a(coffee),coffee):s,side=oldCenter(seat).cx<s.cx?-1:1;seat.rotation=side<0?270:90;const b=footprint(a(seat),seat);putCenterInside(seat,a(seat),room,{x:c.cx+side*((c.w+b.w)/2+20),y:c.cy});
  }
  if(console){const side=scene.showroom?.column===1?'right':scene.showroom?'left':oldCenter(console).cx<s.cx?'left':'right';sideWall(console,a(console),room,side,room.y+room.h*.55);}
  if(lamp){const lampRoom=roomFor(scene,lamp,'living'),ownReading=lamp.roomId&&sofa.roomId&&lamp.roomId!==sofa.roomId,b=seat&&(!seat.roomId||!sofa.roomId||seat.roomId===sofa.roomId||ownReading)?footprint(a(seat),seat):s,target=coffee?footprint(a(coffee),coffee):s,side=ownReading?1:b.cx<target.cx?-1:1;const l=footprint(a(lamp),lamp);putCenterInside(lamp,a(lamp),lampRoom,{x:b.cx+side*((b.w+l.w)/2+10),y:b.cy+10});}
  if(rug){const c=coffee?footprint(a(coffee),coffee):s;const bottom=Math.max(s.y+s.h,c.y+c.h)+14;rug.x=(s.cx+c.cx)/2;rug.y=clamp(bottom,room.y+rug.h,room.y+room.h-6);}
 }

 const dining=bySlot('dining-table'),chair=bySlot('dining-chair');
 if(dining){
  const diningRoom=scene.rooms.find(r=>r.functionalRole==='dining'),room=diningRoom||roomFor(scene,dining,'kitchen');dining.rotation=0;
  const source=oldCenter(dining),center=diningRoom?{x:room.x+room.w/2,y:room.y+room.h/2}:{x:clamp(source.cx,room.x+70,room.x+room.w-70),y:room.y+room.h-64};putCenterInside(dining,a(dining),room,center,10);
  if(chair){const d=footprint(a(dining),dining),side=oldCenter(chair).cx<source.cx?-1:1;chair.rotation=side<0?270:90;const c=footprint(a(chair),chair);putCenterInside(chair,a(chair),room,{x:d.cx+side*((d.w+c.w)/2+24),y:d.cy},8);}
 }
 // Floor accents occupy corners, not door or circulation strips.
 const plant=bySlot('plant'),arcade=bySlot('arcade');
 for(const item of [plant,arcade].filter(i=>i&&!i.supportedBy)){
  const room=roomFor(scene,item,'living'),b=footprint(a(item),item),source=oldCenter(item),arcadeSource=arcade&&!arcade.supportedBy?oldCenter(arcade):null,left=item===plant&&arcadeSource?!(arcadeSource.cx<room.x+room.w/2):source.cx<room.x+room.w/2;
  putCenterInside(item,a(item),room,{x:left?room.x+10+b.w/2:room.x+room.w-10-b.w/2,y:room.y+room.h-10-b.h/2});
 }
 // The player's reserved wall zones are left available for bought decorations.
 if(scene.resident==='player'){
  const poster=bySlot('poster'),clock=bySlot('clock');if(poster){poster.x=scene.width-170;poster.y=102;}if(clock){clock.x=1100;clock.y=102;}
 }
}

// The larger products are additions, not rescaled replacements. Keeping every
// original item/signature lets an existing room-editor layout remain authoritative.
function furnishFamilyRooms(scene,assets,old){
 const owner=scene.resident||'showroom-'+scene.showroomId,originals=[...scene.items],role=i=>furnitureSlot(i,assets.get(i)),find=r=>originals.find(i=>role(i)===r),room=r=>scene.rooms.find(a=>a.functionalRole===r);
 scene.roomExpansionLegacyPoses=Object.fromEntries(originals.map(i=>{
  const parent=supportedParent(i,originals),source=old.get(i),previous=parent&&old.get(parent);
  const sx=previous?parent.w/previous.w:1,sy=previous?parent.h/previous.h:1;
  return [i.id,{x:previous?parent.x+(source.x-previous.x)*sx:i.x,y:previous?parent.y+(source.y-previous.y)*sy:i.y,rotation:i.rotation||0}];
 }));
 const living=room('living'),bedroom=room('bedroom'),kitchen=room('kitchen');if(!living||!bedroom||!kitchen)return;
 const sofa=find('sofa'),coffee=find('coffee-table'),smallTable=find('dining-table'),smallChair=find('dining-chair'),oldRug=find('rug'),reading=find('reading-chair'),console=find('record-console'),lamp=find('floor-lamp'),plant=find('plant'),arcade=find('arcade');
 if(!sofa||!coffee||!smallTable||!smallChair)return;
 const lowerShop=scene.kind==='showroom'&&scene.height<500,wide=living.w>600,compactShort=living.w<500&&living.h<350,player=scene.resident==='player';
 const mirrored=scene.showroom?.column===1;
 let loungeZone={...living},diningZone;
 if(lowerShop){
  const day=kitchen,inner=mirrored?day.x+day.w:day.x;
  loungeZone={x:mirrored?inner-248:inner,y:214,w:248,h:206};
  diningZone={x:mirrored?day.x:day.x+day.w-254,y:164,w:254,h:154};
 }else if(scene.kind==='showroom'){
  const d=room('dining');diningZone={...d,...((scene.interiorDesign?.circulation||[]).some(p=>p.y===400)?{y:d.y-28}: {})};loungeZone={...living};
 }else if(player){
  diningZone={x:kitchen.x+100,y:kitchen.y+170,w:kitchen.w-150,h:220};
 }else if(wide){
  const split=living.w*.53;loungeZone={x:living.x,y:living.y,w:split,h:living.h};diningZone={x:living.x+split+24,y:living.y+24,w:living.w-split-24,h:living.h-48};
 }else{
  const diningH=142,loungeH=living.h-diningH-28;loungeZone={x:living.x,y:living.y,w:living.w,h:loungeH};diningZone={x:living.x+22,y:living.y+living.h-diningH-8,w:living.w-44,h:diningH};
 }
 scene.familyFurnitureZones={living:loungeZone,dining:diningZone};
 const furnitureBases=new Set(originals.flatMap(i=>i.collisionBoxes||[])),structural=scene.solids.filter(b=>!furnitureBases.has(b)),reserved=[...(apartmentDecorBounds(scene)||[])];
 for(const area of scene.rooms)if(area.point)reserved.push({x:area.point.x-9,y:area.point.y-9,w:18,h:18});
 for(const door of scene.privacyDoors||[]){
  // These are source door lengths, before normalization to the approved36px.
  const length=36,start=(door.axis==='vertical'?door.y:door.x)+((door.length||36)-length)/2;
  reserved.push(door.axis==='vertical'?{x:door.x-34,y:start-6,w:68,h:length+12}:{x:start-6,y:door.y-34,w:length+12,h:68});
 }
 for(const path of scene.interiorDesign?.circulation||[])reserved.push({...path});
 if(scene.spawn)reserved.push({x:scene.spawn.x-16,y:scene.spawn.y-16,w:32,h:32});
 if(scene.portalExit?.threshold&&scene.portalExit.enterNormal){const p=scene.portalExit,n=p.enterNormal,x=p.threshold.x+n.x*24,y=p.threshold.y+n.y*24;reserved.push({x:x-18,y:y-18,w:36,h:36});}
 if(scene.resident&&scene.resident!=='player')reserved.push({x:scene.width/2-12,y:scene.floor>=7?738:638,w:24,h:349});
 // Shoppers follow authored venue scripts, whose clearance is wider than the
 // player's6px floor radius. Reserve every real leg, including its turn caps.
 const shoppingRoute=scene.showroom?.apartment?.visitRoute||[];
 for(let n=1;n<shoppingRoute.length;n++){const from=shoppingRoute[n-1],to=shoppingRoute[n];reserved.push({x:Math.min(from.x,to.x)-18,y:Math.min(from.y,to.y)-18,w:Math.abs(to.x-from.x)+36,h:Math.abs(to.y-from.y)+36});}
 const movable=new Set([sofa,coffee,oldRug,console,lamp?.roomId==='reading'?null:lamp,plant,arcade?.supportedBy?null:arcade,reading?.roomId==='reading'?null:reading,smallTable,smallChair].filter(Boolean));
 const placed=originals.filter(i=>!movable.has(i)&&i.solid&&!i.supportedBy),counters=new Map();
 const a=i=>assets.get(i),b=i=>footprint(a(i),i);
 const clear=(items,{ignore=new Set(),gap=5}={})=>{
  if(items.some(i=>i.x-i.w/2<28||i.x+i.w/2>scene.width-28))return false;
  const boxes=items.filter(i=>i.solid).flatMap(i=>furnitureFacingBoxes(a(i),i));
  if(boxes.some(box=>box.x<28||box.y<106||box.x+box.w>scene.width-28||box.y+box.h>scene.height-28||[...structural,...reserved].some(r=>intersects(box,r))))return false;
  const other=placed.filter(i=>!ignore.has(i)).flatMap(i=>furnitureFacingBoxes(a(i),i));
  if(boxes.some(box=>other.some(r=>intersects(box,r,gap))))return false;
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(intersects(boxes[i],boxes[j],gap))return false;
  return true;
 };
 const append=(asset,designRole,roomId)=>{
  const n=(counters.get(designRole)||0)+1;counters.set(designRole,n);const size=furniturePresentationScale({asset:asset.id},scene,asset);
  const item={id:scene.id+':family-room-1:'+designRole+'-'+n,asset:asset.id,x:0,y:0,w:asset.w*size,h:asset.h*size,solid:asset.solid,rotation:0,wallMounted:false,layer:asset.layer||'objects',slot:asset.slot,collectionOwner:owner,visualSignature:asset.visualSignature,roomExpansion:'family-room-1',designRole,roomId,presentationScale:size};
  if(scene.kind==='showroom'||asset.variant==='family-room')item.productId='furniture-'+asset.id;
  assets.set(item,asset);return item;
 };
 const native=r=>definitions.get('collection-'+owner+'-'+r),added=[];let bedroomNook=null;
 const commit=items=>{for(const i of items){if(!originals.includes(i)&&!added.includes(i))added.push(i);if(i.solid&&!placed.includes(i))placed.push(i);}};
 const center=(item,x,y,rotation=item.rotation||0)=>{item.rotation=rotation;moveCenter(item,a(item),{x,y});};
 const tryGroup=(items,zone,preferred,arrange)=>{
  const centers=[preferred];for(const dy of [0,-12,12,-24,24,-36,36])for(const dx of [0,-12,12,-24,24,-36,36])centers.push({x:preferred.x+dx,y:preferred.y+dy});
  for(const at of centers){arrange(at);const bounds=items.filter(i=>i.solid).map(b);if(bounds.some(q=>q.x<zone.x-1||q.y<zone.y-1||q.x+q.w>zone.x+zone.w+1||q.y+q.h>zone.y+zone.h+1))continue;if(clear(items)){commit(items);return true;}}
  return false;
 };

 const familyTable=append(getFamilyFurniture(owner,'dining-table'),'family-dining-table',living.id||'living'),diningSeats=Array.from({length:6},()=>append(native('dining-chair'),'family-dining-chair',familyTable.roomId));
 const diningGroup=[familyTable,...diningSeats],diningAt={x:diningZone.x+diningZone.w/2,y:diningZone.y+diningZone.h/2};
 const diningFound=tryGroup(diningGroup,diningZone,diningAt,at=>{
  center(familyTable,at.x,at.y,0);const table=b(familyTable),offset=table.w/4;
  const poses=[[-offset,-1,0],[offset,-1,0],[-offset,1,180],[offset,1,180]];
   for(let n=0;n<4;n++){const [x,side,turn]=poses[n],seat=diningSeats[n];seat.rotation=turn;const box=b(seat);center(seat,at.x+x,at.y+side*(table.h/2+22+box.h/2),turn);seat.seatingTarget=familyTable.id;}
  for(let n=4;n<6;n++){const side=n===4?-1:1,seat=diningSeats[n];seat.rotation=side<0?270:90;const box=b(seat);center(seat,at.x+side*(table.w/2+22+box.w/2),at.y,seat.rotation);seat.seatingTarget=familyTable.id;}
 });
 const broadCoffee=append(getFamilyFurniture(owner,'coffee-table'),'family-coffee-table',living.id||'living'),loungeSeats=[];
 const existingReading=reading&&movable.has(reading)?reading:null;
 loungeSeats.push(existingReading||append(native('reading-chair'),'family-lounge-chair',living.id||'living'),append(native('reading-chair'),'family-lounge-chair',living.id||'living'));
 if(existingReading&&scene.kind==='showroom'&&!mirrored)loungeSeats.reverse();
 const secondSofa=!lowerShop&&!compactShort&&(loungeZone.h>=190)?append(native('sofa'),'family-lounge-sofa',living.id||'living'):null;
 const loungeItems=[sofa,broadCoffee,...loungeSeats,...(secondSofa?[secondSofa]:[])],loungeAt={x:loungeZone.x+loungeZone.w/2,y:lowerShop?350:loungeZone.y+(secondSofa?loungeZone.h/2:Math.min(loungeZone.h/2+12,120))};
 const loungeFound=tryGroup(loungeItems,loungeZone,loungeAt,at=>{
  center(broadCoffee,at.x,at.y,0);const table=b(broadCoffee);sofa.rotation=0;const s=b(sofa);center(sofa,at.x,at.y-table.h/2-22-s.h/2,0);sofa.seatingTarget=broadCoffee.id;
  if(secondSofa){
   // A foreground high-back sofa hides a low table even with a clear floor
   // aisle. Turn it onto the side; a lower chair keeps the front visually open.
   const side=mirrored||player?1:-1;secondSofa.rotation=side<0?270:90;const second=b(secondSofa);center(secondSofa,at.x+side*(table.w/2+24+second.w/2),at.y,secondSofa.rotation);secondSofa.seatingTarget=broadCoffee.id;
   const lateral=existingReading||loungeSeats[0],front=loungeSeats.find(i=>i!==lateral),opposite=-side;lateral.rotation=opposite<0?270:90;const chair=b(lateral);center(lateral,at.x+opposite*(table.w/2+24+chair.w/2),at.y,lateral.rotation);
   front.rotation=180;const low=b(front);center(front,at.x,at.y+table.h/2+54+low.h/2,180);
   for(const seat of loungeSeats){seat.seatingTarget=broadCoffee.id;seat.roomId=living.id||'living';}
  }else for(let n=0;n<2;n++){const seat=loungeSeats[n],side=n===0?-1:1;seat.rotation=side<0?270:90;const box=b(seat);center(seat,at.x+side*(table.w/2+(lowerShop?22:24)+box.w/2),at.y,seat.rotation);seat.seatingTarget=broadCoffee.id;seat.roomId=living.id||'living';}
 });
 // Keep the original small table useful as an intimate bedroom reading nook.
 // Larger living products occupy different floor space, never stretch a chair.
 const relocate=(item,area,preferred,{rotations=[item.rotation||0],gap=8}={})=>{
  if(!item||placed.includes(item))return true;const source={...item},options=[preferred];
  for(const y of [area.y+area.h*.72,area.y+area.h*.45,area.y+area.h-28,area.y+36])for(const x of [area.x+area.w*.5,area.x+area.w*.72,area.x+area.w*.28,area.x+28,area.x+area.w-28])options.push({x,y});
  for(let y=area.y+24;y<area.y+area.h-16;y+=18)for(let x=area.x+24;x<area.x+area.w-16;x+=18)options.push({x,y});
  for(const turn of rotations)for(const at of options){center(item,at.x,at.y,turn);const box=b(item);if(box.x<area.x+6||box.y<area.y+6||box.x+box.w>area.x+area.w-6||box.y+box.h>area.y+area.h-6)continue;if(clear([item],{gap})){commit([item]);return true;}}
  Object.assign(item,source);if(originals.includes(item))commit([item]);return false;
 };
 if(loungeFound){
  const nookTable=lowerShop?smallTable:coffee,nookSeat=lowerShop?smallChair:append(native('reading-chair'),'bedroom-reading-chair',bedroom.id||'bedroom');
  const pair=[nookTable,nookSeat],nookAt={x:bedroom.x+bedroom.w*(bedroom.side==='right'?.38:.62),y:bedroom.y+bedroom.h*.70};
  const nookFound=tryGroup(pair,bedroom,nookAt,at=>{
   center(nookTable,at.x,at.y,0);const table=b(nookTable);nookSeat.rotation=180;const seat=b(nookSeat);center(nookSeat,at.x,at.y+table.h/2+20+seat.h/2,180);nookSeat.seatingTarget=nookTable.id;nookSeat.roomId=bedroom.id||'bedroom';nookTable.roomId=nookSeat.roomId;
  });
  if(nookFound)bedroomNook={table:nookTable.id,seat:nookSeat.id};
  if(nookFound&&oldRug){oldRug.roomId=bedroom.id||'bedroom';oldRug.x=nookTable.x;oldRug.y=clamp(b(nookSeat).y+b(nookSeat).h+12,bedroom.y+oldRug.h,bedroom.y+bedroom.h-8);}
  else if(oldRug){const bed=find('bed');oldRug.x=bed.x;oldRug.y=bed.y+oldRug.h*.40;oldRug.roomId=bedroom.id||'bedroom';}
  if(lowerShop)relocate(coffee,{x:kitchen.x,y:152,w:kitchen.w,h:84},{x:loungeZone.x+loungeZone.w/2,y:190},{gap:6});
  else if(!nookFound)relocate(coffee,bedroom,{x:bedroom.x+bedroom.w/2,y:bedroom.y+bedroom.h*.55});
  const rug=append(getFamilyFurniture(owner,'rug'),'family-living-rug',living.id||'living');rug.x=broadCoffee.x;rug.y=clamp(b(broadCoffee).cy+rug.h/2,loungeZone.y+rug.h,loungeZone.y+loungeZone.h);commit([rug]);
 }
 if(!lowerShop){
  const breakfastAt={x:kitchen.x+kitchen.w*.48,y:kitchen.y+(scene.kind==='showroom'?126:kitchen.h-64)},pair=[smallTable,smallChair];
  const breakfastFound=tryGroup(pair,kitchen,breakfastAt,at=>{
   center(smallTable,at.x,at.y,0);const table=b(smallTable),side=kitchen.x+kitchen.w/2<scene.width/2?-1:1;smallChair.rotation=side<0?270:90;const seat=b(smallChair);center(smallChair,at.x+side*(table.w/2+24+seat.w/2),at.y,smallChair.rotation);smallChair.seatingTarget=smallTable.id;smallTable.roomId=kitchen.id||'kitchen';smallChair.roomId=smallTable.roomId;
  });
  if(!breakfastFound){relocate(smallTable,kitchen,breakfastAt);const table=b(smallTable);smallChair.rotation=180;relocate(smallChair,kitchen,{x:table.cx,y:table.y+table.h+28},{rotations:[180,90,270,0]});smallChair.seatingTarget=smallTable.id;}
 }
 if(!loungeFound)for(const item of [sofa,coffee,reading].filter(Boolean))if(movable.has(item))relocate(item,living,{x:item.x,y:b(item).cy});
 // Consoles and arcade cabinets remain useful perimeter destinations, clear of
 // the main seating group, dining seats and every original door landing.
 for(const item of [console,arcade?.supportedBy?null:arcade].filter(Boolean))if(movable.has(item)){
  const area=living,side=item===console&&scene.showroom?(mirrored?'right':'left'):area.x+area.w/2<scene.width/2?'left':'right',box=b(item),x=side==='left'?area.x+8+box.w/2:area.x+area.w-8-box.w/2;
  relocate(item,area,{x,y:area.y+area.h*.48},{rotations:[side==='left'?270:90,0,180]});
 }
 if(lamp&&movable.has(lamp))relocate(lamp,living,{x:loungeAt.x+loungeZone.w*.36,y:loungeAt.y-45});
 if(plant&&movable.has(plant))relocate(plant,living,{x:living.x+18,y:living.y+living.h-20});
 const statement=append(getFamilyFurniture(owner,'plant'),'family-statement-plant',living.id||'living');
 relocate(statement,living,{x:living.x+living.w-34,y:living.y+living.h-25},{gap:10});
 const bedroomPlant=append(native('plant'),'bedroom-plant',bedroom.id||'bedroom');
 relocate(bedroomPlant,bedroom,{x:bedroom.x+bedroom.w*.35,y:bedroom.y+bedroom.h-24},{gap:10});
 // A failed optional relocation must not create a default at its sentinel0,0.
 const validAdded=added.filter(i=>i.x!==0||i.y!==0);scene.items.push(...validAdded);
 for(const item of scene.items){const parent=supportedParent(item,scene.items);if(parent&&parent.roomId)item.roomId=parent.roomId;}
 scene.familyFurniture={version:1,expansion:'family-room-1',diningTable:diningFound?familyTable.id:null,livingTable:loungeFound?broadCoffee.id:null,diningSeats:diningFound?diningSeats.map(i=>i.id):[],livingSeats:loungeFound?[sofa,...loungeSeats,...(secondSofa?[secondSofa]:[])].map(i=>i.id):[],bedroomNook};
}

/** Apply room drawing units without changing the persisted product or anchor. */
export function presentedRoomItem(item,scene,catalog){
 const factor=furniturePresentationScale(item,scene,assetFor(item,catalog));
 if(factor===1)return item;
 return {...item,scale:(item.scale??1)*factor,...(finite(item.w)?{w:item.w*factor}:{}),...(finite(item.h)?{h:item.h*factor}:{}),presentationScale:factor};
}
function reachableNookApproach(scene){
 const step=8,radius=6,cols=Math.ceil(scene.width/step),rows=Math.ceil(scene.height/step),blocked=new Uint8Array(cols*rows),visited=new Uint8Array(cols*rows),queue=new Int32Array(cols*rows);
 for(const box of scene.solids){
  const x0=Math.max(0,Math.ceil((box.x-radius-4)/step)),x1=Math.min(cols-1,Math.floor((box.x+box.w+radius-4)/step)),y0=Math.max(0,Math.ceil((box.y-radius-4)/step)),y1=Math.min(rows-1,Math.floor((box.y+box.h+radius-4)/step));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)blocked[y*cols+x]=1;
 }
 let end=0;const sx=Math.floor(scene.spawn.x/step),sy=Math.floor(scene.spawn.y/step);
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=sx+dx,y=sy+dy,n=y*cols+x;if(x>=0&&y>=0&&x<cols&&y<rows&&!blocked[n]&&!visited[n]){visited[n]=1;queue[end++]=n;}}
 for(let head=0;head<end;head++){const n=queue[head],x=n%cols,y=Math.floor(n/cols);for(const next of [x?n-1:-1,x+1<cols?n+1:-1,y?n-cols:-1,y+1<rows?n+cols:-1])if(next>=0&&!visited[next]&&!blocked[next]){visited[next]=1;queue[end++]=next;}}
 return point=>{const x=Math.floor(point.x/step),y=Math.floor(point.y/step);for(let Y=Math.max(0,y-3);Y<=Math.min(rows-1,y+3);Y++)for(let X=Math.max(0,x-3);X<=Math.min(cols-1,x+3);X++)if(visited[Y*cols+X]&&Math.hypot(X*step+4-point.x,Y*step+4-point.y)<=25)return true;return false;};
}
function refreshFunctionalTargets(scene,assets){
 if(!scene.homePlan)return;
 let nookReachable;
 const blocked=p=>p.x<40||p.y<112||p.x>scene.width-40||p.y>scene.height-40||scene.solids.some(b=>p.x>=b.x-6&&p.x<=b.x+b.w+6&&p.y>=b.y-6&&p.y<=b.y+b.h+6);
 const approaches=(scene.homePlan.fixtureApproaches||[]).map(previous=>{
  let item=scene.items.find(i=>i.asset===previous.asset)||scene.items.find(i=>i.furnitureRole===previous.role&&i.roomId===previous.roomId);if(!item)return {...previous};
  item=supportedParent(item,scene.items)||item;const b=footprint(assets.get(item),item),front=(((item.rotation||0)/90)%4+4)%4;
  const candidates=[];for(const gap of [12,20,28]){const side=[{x:b.cx,y:b.y+b.h+gap},{x:b.x-gap,y:b.cy},{x:b.cx,y:b.y-gap},{x:b.x+b.w+gap,y:b.cy}];candidates.push(side[front],...side);}
  // A20px gap between a deep reading table and its chair is physically open,
  // but can fall between navigation rows. Use an accessible side of that nook
  // instead of assigning a target inside its narrow chair/table aisle.
  const nook=previous.role==='coffee-table'&&scene.familyFurniture?.bedroomNook?.table===item.id;
  if(nook)nookReachable||=reachableNookApproach(scene);
  const point=candidates.find(p=>!blocked(p)&&(!nook||nookReachable(p)));if(point){item.approach={...point};return {...previous,...point};}return {...previous};
 });
 const seat=scene.items.find(i=>furnitureSlot(i,assets.get(i))==='reading-chair'),lamp=scene.items.find(i=>furnitureSlot(i,assets.get(i))==='floor-lamp'),tasks=[];
 for(const task of scene.homePlan.taskLights||[]){
  const oldLight=scene.lights.find(l=>l.x===task.x&&l.y===task.y),item=seat||lamp;
  const b=item?footprint(assets.get(item),item):null,next=b?{...task,x:b.cx,y:b.cy-48}:{...task};if(oldLight)Object.assign(oldLight,next);tasks.push(next);
 }
 scene.homePlan={...scene.homePlan,fixtureApproaches:approaches,taskLights:tasks};
}

/**
 * A private room keeps its large floor plate. Role sizes use the playable
 * Arcade's furniture/person reference, without treating catalog pixels as units.
 * This is presentation/model geometry only: catalog products and saves retain
 * their original IDs, fixed scale and coordinates.
 */
export function calibratePrivateFurniture(scene,catalog){
 const factor=interiorActorScale(scene);
 if(factor===1||!Array.isArray(scene?.items)||scene[CALIBRATED])return scene;
 const old=new Map(scene.items.map(item=>[item,{...item}])),oldBoxes=new Set(scene.items.flatMap(item=>item.collisionBoxes||[]));
 const assets=new Map(scene.items.map(item=>[item,assetFor(item,catalog)]));
 const oldCenter=item=>{const a=assets.get(item);return a?footprint(a,old.get(item)):{cx:item.x,cy:item.y};};
 for(const item of scene.items){
  const a=assets.get(item);if(!a||!finite(a.w)||!finite(a.h)||a.w<=0||a.h<=0)continue;
  const source=old.get(item),support=supportedParent(item,scene.items),mini=support?Math.min(1,source.w/a.w,source.h/a.h):1;
  const center=oldCenter(item),size=furniturePresentationScale(item,scene,a);item.w=a.w*size*mini;item.h=a.h*size*mini;item.presentationScale=size;
  if(!item.wallMounted&&item.layer!=='ground'&&!support)moveCenter(item,a,{x:center.cx,y:center.cy});
 }

 arrangePrivateRooms(scene,assets,old);
 furnishFamilyRooms(scene,assets,old);

 // Listening targets belong to their actual furniture rather than the old
 // display-size coordinates. Keep the design/circulation contract meaningful.
 if(scene.interiorDesign)scene.interiorDesign={...scene.interiorDesign,focalPoints:(scene.interiorDesign.focalPoints||[]).map(point=>{
  const item=scene.items.find(item=>{if(!old.has(item))return false;const before=oldCenter(item);return Math.abs(before.cx-point.x)<1e-6&&Math.abs(before.cy-point.y)<1e-6;});
  if(!item)return {...point};const at=footprint(assets.get(item),item);return {...point,x:at.cx,y:at.cy};
 })};

 // A keepsake follows its actual tabletop/bed when the parent changes size.
 // Parent keys are legacy roles in homes and asset IDs in the showrooms.
 for(const item of scene.items){
  const parent=supportedParent(item,scene.items);if(!parent)continue;
  if(!old.has(item)||!old.has(parent))continue;
  const source=old.get(item),previous=old.get(parent),sx=parent.w/previous.w,sy=parent.h/previous.h;
  item.x=parent.x+(source.x-previous.x)*sx;item.y=parent.y+(source.y-previous.y)*sy;
  item.depth=furnitureFacingDepth(assets.get(parent),parent,parent.y)+.25;item.solid=false;
 }

 applyMidcenturyRoomLayout(scene,assets);

 // Remove only the old furniture bases. Structural walls retain their original
 // objects; each furniture collision array is rebuilt in place for consumers.
 scene.solids=scene.solids.filter(box=>!oldBoxes.has(box));
 for(const item of scene.items){
  const boxes=item.collisionBoxes||[];if(!item.collisionBoxes)Object.defineProperty(item,'collisionBoxes',{value:boxes});
  boxes.splice(0,boxes.length,...(item.solid?furnitureFacingBoxes(assets.get(item),item):[]));scene.solids.push(...boxes);
 }
 refreshFunctionalTargets(scene,assets);
 Object.defineProperty(scene,CALIBRATED,{value:true});return scene;
}
