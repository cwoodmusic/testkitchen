import {interiorActorScale} from './interior-scale.mjs?v=interior-design-1';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs?v=interior-design-1';
import {furnitureAtGroundCenter,furnitureFacingBoxes,furnitureFacingBounds,furnitureFacingDepth} from './furniture-facing.mjs?v=interior-design-1';

const definitions=new Map(APARTMENT_COLLECTION_ASSETS.map(a=>[a.id,a])),CALIBRATED=Symbol.for('coda.privateFurnitureCalibration');
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
 return candidates.find(p=>p.roomId===item.roomId)||candidates[0]||null;
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

/** Apply room drawing units without changing the persisted product or anchor. */
export function presentedRoomItem(item,scene,catalog){
 const factor=furniturePresentationScale(item,scene,assetFor(item,catalog));
 if(factor===1)return item;
 return {...item,scale:(item.scale??1)*factor,...(finite(item.w)?{w:item.w*factor}:{}),...(finite(item.h)?{h:item.h*factor}:{}),presentationScale:factor};
}
function refreshFunctionalTargets(scene,assets){
 if(!scene.homePlan)return;
 const blocked=p=>p.x<40||p.y<112||p.x>scene.width-40||p.y>scene.height-40||scene.solids.some(b=>p.x>=b.x-6&&p.x<=b.x+b.w+6&&p.y>=b.y-6&&p.y<=b.y+b.h+6);
 const approaches=(scene.homePlan.fixtureApproaches||[]).map(previous=>{
  let item=scene.items.find(i=>i.asset===previous.asset)||scene.items.find(i=>i.furnitureRole===previous.role&&i.roomId===previous.roomId);if(!item)return {...previous};
  item=supportedParent(item,scene.items)||item;const b=footprint(assets.get(item),item),front=(((item.rotation||0)/90)%4+4)%4;
  const candidates=[];for(const gap of [12,20,28]){const side=[{x:b.cx,y:b.y+b.h+gap},{x:b.x-gap,y:b.cy},{x:b.cx,y:b.y-gap},{x:b.x+b.w+gap,y:b.cy}];candidates.push(side[front],...side);}
  const point=candidates.find(p=>!blocked(p));if(point){item.approach={...point};return {...previous,...point};}return {...previous};
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

 // Listening targets belong to their actual furniture rather than the old
 // display-size coordinates. Keep the design/circulation contract meaningful.
 if(scene.interiorDesign)scene.interiorDesign={...scene.interiorDesign,focalPoints:(scene.interiorDesign.focalPoints||[]).map(point=>{
  const item=scene.items.find(item=>{const before=oldCenter(item);return Math.abs(before.cx-point.x)<1e-6&&Math.abs(before.cy-point.y)<1e-6;});
  if(!item)return {...point};const at=footprint(assets.get(item),item);return {...point,x:at.cx,y:at.cy};
 })};

 // A keepsake follows its actual tabletop/bed when the parent changes size.
 // Parent keys are legacy roles in homes and asset IDs in the showrooms.
 for(const item of scene.items){
  const parent=supportedParent(item,scene.items);if(!parent)continue;
  const source=old.get(item),previous=old.get(parent),sx=parent.w/previous.w,sy=parent.h/previous.h;
  item.x=parent.x+(source.x-previous.x)*sx;item.y=parent.y+(source.y-previous.y)*sy;
  item.depth=furnitureFacingDepth(assets.get(parent),parent,parent.y)+.25;item.solid=false;
 }

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
