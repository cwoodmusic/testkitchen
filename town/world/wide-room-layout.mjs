import {cloneRoomLayoutScene} from './room-layout-sources.mjs?v=town-wide-layout-1';
import {applyWideRoomLayout as applyPreviousWideRoomLayout} from './wide-room-layout-v1.mjs?v=town-wide-shape-1';
import {furnitureAtGroundCenter,furnitureFacingBoxes,furnitureFacingBounds,furnitureFacingDepth} from './furniture-facing.mjs?v=opera-parallax-1';
import {apartmentDecorBounds,apartmentWallDecorBounds} from './personal-room-areas.mjs?v=opera-parallax-1';

const EPS=1e-6,RADIUS=6;
const rect=(x,y,w,h)=>({x,y,w,h});
const overlap=(a,b,pad=0)=>a.x<b.x+b.w+pad-EPS&&a.x+a.w>b.x-pad+EPS&&a.y<b.y+b.h+pad-EPS&&a.y+a.h>b.y-pad+EPS;
const contains=(a,b)=>b.x>=a.x-EPS&&b.y>=a.y-EPS&&b.x+b.w<=a.x+a.w+EPS&&b.y+b.h<=a.y+a.h+EPS;
const slot=(item,catalog)=>item.slot||item.collectionSlot||catalog.get(item.asset)?.slot||item.furnitureRole;
const centerOf=boxes=>{if(!boxes.length)return null;const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y)),right=Math.max(...boxes.map(b=>b.x+b.w)),bottom=Math.max(...boxes.map(b=>b.y+b.h));return {x,y,w:right-x,h:bottom-y,cx:(x+right)/2,cy:(y+bottom)/2};};
const flippedRect=(r,width)=>({...r,x:width-r.x-r.w});
const cloneItem=item=>{const copy={...item};Object.defineProperty(copy,'collisionBoxes',{value:(item.collisionBoxes||[]).map(b=>({...b})),configurable:true});return copy;};

/** An approved grouping, with each owner's own cardinal art and original units. */
export function applyWideRoomLayout(source,catalog,{reference}={}){
 if(!['apartment','showroom'].includes(source?.kind)||source.id==='showroom-victorian-parlor'||source.wideRoomLayout||!catalog?.get)return source;
 const legacySource=source,previousLayout=applyPreviousWideRoomLayout(source,catalog,{reference}),targetWidth=source.kind==='showroom'?1184:2368,targetHeight=source.kind==='showroom'?512:1132;
 if(previousLayout.width===targetWidth&&previousLayout.height===targetHeight)return previousLayout;
 source=cloneRoomLayoutScene(source);
 const previousWidth=source.width,previousHeight=source.height,exit=(source.zones||[]).find(z=>z.action==='showroom-lobby'||z.action==='exit'),doorId=source.portalExit?.doorId||exit?.doorId||exit?.id||source.id+'-exit',home=source.kind==='apartment',entryX=home?targetWidth/2:source.portalExit.threshold.x,entryY=targetHeight-28;
 source.width=targetWidth;source.height=targetHeight;source.spawn={x:entryX,y:home?targetHeight-145:entryY-56};
 source.portalExit={...source.portalExit,doorId,threshold:{x:entryX,y:entryY},enterNormal:{x:0,y:-1},triggerHalfWidth:18,clearOpening:true,door:{...source.portalExit?.door,id:doorId,threshold:{x:entryX,y:entryY},enterNormal:{x:0,y:1},triggerHalfWidth:18,virtual:true,clearOpening:true}};
 if(source.exit)source.exit={x:entryX,y:entryY};
 if(home)source.actors=(source.actors||[]).map(actor=>({...actor,x:entryX,y:750}));
 source.zones=(source.zones||[]).map(zone=>zone.action==='exit'||zone.action==='showroom-lobby'?{...zone,x:entryX-18,y:source.spawn.y-(home?65:24),w:36,h:home?175:48,threshold:{x:entryX,y:entryY},enterNormal:{x:0,y:-1},triggerHalfWidth:18,clearOpening:true}:home&&zone.action==='resident'?{...zone,x:entryX-80,y:680,w:160,h:180}:zone);
 if(source.homePlan)source.homePlan={...source.homePlan,width:targetWidth,height:targetHeight,wide:true,spawn:{...source.spawn},home:{x:entryX,y:750}};
 source.wideRoomExpansion={previousWidth,previousHeight,depth:targetHeight-previousHeight,previousFloorBottom:previousHeight-28,newFloorBottom:entryY,previousSpawn:{...legacySource.spawn},previousThreshold:legacySource.portalExit?.threshold?{...legacySource.portalExit.threshold}:{x:exit?exit.x+exit.w/2:previousWidth/2,y:previousHeight-28}};
 const scene=cloneRoomLayoutScene(source),width=scene.width,height=scene.height,player=scene.resident==='player';
 const previousBedroom=(legacySource.rooms||[]).find(r=>r.functionalRole==='bedroom');
 const mirrored=scene.kind==='showroom'?scene.showroom?.column===1:previousBedroom?previousBedroom.x+previousBedroom.w/2>legacySource.width/2:false;
 const canonicalPoint=p=>mirrored?{...p,x:width-p.x}:{...p};
 const originalItems=scene.items,asset=item=>catalog.get(item.asset),role=item=>slot(item,catalog),originalByRole=key=>originalItems.find(i=>!i.roomExpansion&&role(i)===key),design=key=>originalItems.filter(i=>i.designRole===key);
 const all=new Map(originalItems.map(i=>[i.id,i])),used=new Set(),placed=[],hidden=[],floorBottom=height-28,depth=floorBottom-106,wallWidth=scene.kind==='showroom'?16:18;
 const reserved=(apartmentDecorBounds(scene)||[]).map(r=>mirrored?flippedRect(r,width):{...r}),wallReserved=(apartmentWallDecorBounds(scene)||[]).map(r=>mirrored?flippedRect(r,width):{...r});
 const actorReservations=(source.actors||[]).flatMap(a=>{const p=canonicalPoint(a),spawn=canonicalPoint(source.spawn);return [rect(p.x-20,p.y-20,40,40),rect(Math.min(p.x,spawn.x)-18,Math.min(p.y,spawn.y)-18,Math.abs(p.x-spawn.x)+36,Math.abs(p.y-spawn.y)+36)];});
 const spawn=canonicalPoint(source.spawn),arrival=rect(spawn.x-19,spawn.y-19,38,38),doorApproach=canonicalPoint({x:source.portalExit.threshold.x,y:source.portalExit.threshold.y-24});
 reserved.push(...actorReservations,arrival,rect(doorApproach.x-18,doorApproach.y-18,36,36));
 const snap=value=>Math.round(value/4)*4,privateDepth=player?220:snap(depth*220/378),front=106+privateDepth;
 const bedWidth=player?255:snap(328*(width-56)/1128),bathWidth=player?305:snap(200*(width-56)/1128);
 const bed=rect(28,106,bedWidth,privateDepth),bath=rect(player?315:bed.x+bed.w+wallWidth*2,106,bathWidth,privateDepth);
 const dayStart=player?width-710:bath.x+bath.w+wallWidth+24,day=rect(dayStart,106,width-28-dayStart,depth);
 const oldRoom=key=>(source.rooms||[]).find(r=>r.functionalRole===key)||{},roomId=key=>oldRoom(key).id||key;
 const bedDoor=(source.privacyDoors||[]).find(d=>d.roomId===roomId('bedroom')||d.roomId==='bedroom'||d.roomId?.endsWith('-bedroom'));
 const bathDoor=(source.privacyDoors||[]).find(d=>d.roomId===roomId('bathroom')||d.roomId==='bathroom'||d.roomId?.endsWith('-bathroom'));
 const doors=[['bedroom',bed,bedDoor,bed.x+bed.w-80],['bathroom',bath,bathDoor,bath.x+84]].map(([key,area,old,cx])=>({...old,id:old?.id||scene.id+'-'+key,roomId:roomId(key),axis:'horizontal',x:cx-18,y:front+wallWidth/2,length:36,open:true,hinge:'start',swing:1,clearOpening:true,wallThickness:wallWidth,color:scene.homeMaterialSuite?.trim.wood||scene.color,trim:scene.homeMaterialSuite?.trim.light||scene.trim}));
 const walls=[];
 for(const [area,door]of [[bed,doors[0]],[bath,doors[1]]]){
  if(area.x>28)walls.push(rect(area.x-wallWidth,106,wallWidth,privateDepth));
  walls.push(rect(area.x+area.w,106,wallWidth,privateDepth),rect(area.x,front,door.x-area.x,wallWidth),rect(door.x+36,front,area.x+area.w-door.x-36,wallWidth));
 }
 const trim=scene.homeMaterialSuite?.trim||{wood:scene.color,light:scene.trim};for(const wall of walls)Object.assign(wall,{color:trim.wood,trim:trim.light});
 const shell=[rect(0,0,width,106),rect(0,0,28,height),rect(width-28,0,28,height),rect(0,height-28,width,28)],structural=[...shell,...walls];
 const passages=doors.map(d=>rect(d.x-6,d.y-34,48,68));
 reserved.push(...passages);
 const footprint=item=>centerOf(furnitureFacingBoxes(asset(item),item));
 const placeCenter=(item,x,y,rotation=0)=>{item.rotation=rotation;Object.assign(item,furnitureAtGroundCenter(asset(item),item,{x,y}));};
 const solid=item=>{const a=asset(item);return !!(a?.solid??a?.collisionDefault??a?.boxes?.length)&&!item.wallMounted&&item.layer!=='ground'&&!item.supportedBy;};
 for(const item of originalItems){
  if(item.supportedBy!=='north-wall')delete item.supportedBy;delete item.depth;delete item.approach;delete item.seatingTarget;
  item.solid=solid(item);if(item.wallMounted)item.supportedBy='north-wall';
 }
 const legal=(items,area,{gap=3,ignore=new Set()}={})=>{
  const others=placed.filter(i=>!ignore.has(i)).flatMap(i=>i.solid?furnitureFacingBoxes(asset(i),i):[]);
  for(const item of items){
   const boxes=item.solid?furnitureFacingBoxes(asset(item),item):[];
   for(const box of boxes)if(!contains(rect(28,106,width-56,height-134),box)||area&&!contains(area,box)||[...structural,...reserved].some(r=>overlap(box,r))||others.some(r=>overlap(box,r,gap)))return false;
   if(player&&wallReserved.length&&wallReserved.some(r=>overlap(furnitureFacingBounds(asset(item),item),r)))return false;
  }
  const boxes=items.flatMap(i=>i.solid?furnitureFacingBoxes(asset(i),i):[]);for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++)if(overlap(boxes[a],boxes[b],gap))return false;return true;
 };
 const commit=items=>{for(const i of items){used.add(i);if(!placed.includes(i))placed.push(i);}};
 function fit(items,area,preferred,arrange,{gap=3,ignore=new Set()}={}){
  const options=[preferred];for(const radius of [8,16,24,36,52,76,104,140])for(const [dx,dy]of [[-1,0],[1,0],[0,1],[0,-1],[-1,1],[1,1],[-1,-1],[1,-1]])options.push({x:preferred.x+dx*radius,y:preferred.y+dy*radius});
  for(const p of options){arrange(p);if(legal(items,area,{gap,ignore})){commit(items);return true;}}
  for(let y=area.y+24;y<area.y+area.h-12;y+=12)for(let x=area.x+24;x<area.x+area.w-12;x+=12){arrange({x,y});if(legal(items,area,{gap,ignore})){commit(items);return true;}}
  throw Error('No coherent '+items.map(i=>i.designRole||role(i)).join('/')+' placement in '+scene.id);
 }
 const put=(item,area,x,y,rotation=0)=>{if(!item)return;fit([item],area,{x,y},p=>placeCenter(item,p.x,p.y,rotation));};
 const north=(item,area,x)=>{if(!item)return;item.rotation=0;const b=footprint(item);put(item,area,x,area.y+6+b.h/2,0);};
 const attach=(child,parent,{dx=0,dy,sourceChild,sourceParent}={})=>{
  if(!child||!parent)return;const b=footprint(parent),p=b?{x:b.cx,y:b.cy}:{x:parent.x,y:parent.y};
  if(sourceChild&&sourceParent){const pb=centerOf(furnitureFacingBoxes(catalog.get(sourceParent.asset),sourceParent));p.x+=(sourceChild.x-(pb?.cx??sourceParent.x));p.y+=(sourceChild.y-(pb?.cy??sourceParent.y));}
  else{p.x+=dx;p.y+=dy??-parent.h*.5;}
  Object.assign(child,{x:p.x,y:p.y,rotation:0,supportedBy:parent.id,solid:false,roomId:parent.roomId,depth:furnitureFacingDepth(asset(parent),parent,parent.y)+.25});commit([child]);
 };
 const ownerRoom=(item,key)=>{if(item)item.roomId=roomId(key);return item;};
 const bedItem=ownerRoom(originalByRole('bed'),'bedroom'),night=ownerRoom(originalByRole('nightstand'),'bedroom'),wardrobe=ownerRoom(originalByRole('wardrobe'),'bedroom');
 north(bedItem,bed,bed.x+bed.w*.63);const bedFoot=footprint(bedItem);north(night,bed,bedFoot.cx+bedFoot.w/2+5+(footprint(night)?.w||0)/2);north(wardrobe,bed,bed.x+6+(footprint(wardrobe)?.w||0)/2);
 attach(originalByRole('toy'),bedItem,{dy:-bedItem.h*.2});attach(originalByRole('table-lamp'),night,{dy:-night.h*.5});
 const vanity=ownerRoom(originalByRole('vanity'),'bathroom'),tub=ownerRoom(originalByRole('bath-fixture'),'bathroom'),toilet=ownerRoom(originalByRole('toilet'),'bathroom');
 north(vanity,bath,bath.x+(player?32:54));
 if(tub){tub.rotation=0;const t=footprint(tub);put(tub,bath,bath.x+bath.w-8-t.w/2,player?210:112+t.h/2,0);}
 if(toilet){toilet.rotation=270;const t=footprint(toilet);put(toilet,bath,bath.x+6+t.w/2,bath.y+54,270);}
 const mirror=originalByRole('mirror');if(mirror){Object.assign(mirror,{x:vanity.x,y:vanity.y-69.6,rotation:0,roomId:roomId('bathroom'),supportedBy:'north-wall',solid:false});commit([mirror]);}
 const kitchenRoles=['fridge','sink','stove','counter','pantry'],kitchen=kitchenRoles.map(originalByRole).filter(Boolean);for(const i of kitchen)ownerRoom(i,'kitchen');
 const runWidth=kitchen.reduce((sum,i)=>{i.rotation=0;return sum+footprint(i).w;},0)+(kitchen.length-1)*4,runLeft=width-34-runWidth,kitchenArea=rect(runLeft-8,106,width-28-runLeft+8,170);
 let runX=runLeft;for(const item of kitchen){const b=footprint(item);north(item,kitchenArea,runX+b.w/2);runX+=b.w+4;}
 attach(originalByRole('lava-lamp'),originalByRole('pantry')||kitchen.at(-1),{dy:-(originalByRole('pantry')||kitchen.at(-1)).h*.5});
 const familyTable=ownerRoom(design('family-dining-table')[0],'dining'),diners=design('family-dining-chair'),diningSeats=[diners[4],diners[5],diners[1]].filter(Boolean),diningCenter={x:day.x+Math.max(128,day.w*.244),y:106+depth*.222};
 fit([familyTable,...diningSeats],day,diningCenter,p=>{
  placeCenter(familyTable,p.x,p.y,180);const t=footprint(familyTable);
  for(let n=0;n<diningSeats.length;n++){const chair=diningSeats[n],rotation=n===0?90:n===1?270:180;chair.rotation=rotation;const b=footprint(chair);placeCenter(chair,n===0?t.x+t.w+12+b.w/2:n===1?t.x-12-b.w/2:t.cx,n===2?t.y+t.h+12+b.h/2:t.cy,rotation);chair.seatingTarget=familyTable.id;chair.roomId=roomId('dining');}
 });
 const broadCoffee=ownerRoom(design('family-coffee-table')[0],'living'),sofa=ownerRoom(originalByRole('sofa'),'living'),loungeChairs=design('family-lounge-chair');
 const alternate=originalByRole('reading-chair');if(loungeChairs.length<2&&alternate)loungeChairs.push(alternate);
 const lounge=loungeChairs.slice(0,2),loungeY=106+depth*.567;
 fit([broadCoffee,sofa,...lounge],day,{x:width-138,y:loungeY},p=>{
  placeCenter(broadCoffee,p.x,p.y,270);const t=footprint(broadCoffee);sofa.rotation=90;const s=footprint(sofa);placeCenter(sofa,t.x+t.w+38+s.w/2,t.cy,90);sofa.seatingTarget=broadCoffee.id;
  for(let n=0;n<lounge.length;n++){const chair=lounge[n];chair.rotation=270;const b=footprint(chair);placeCenter(chair,t.x-26-b.w/2,t.cy+(n?27:-27),270);chair.seatingTarget=broadCoffee.id;chair.roomId=roomId('living');}
 });
 const smallTable=ownerRoom(originalByRole('dining-table'),'bedroom'),smallChair=ownerRoom(originalByRole('dining-chair'),'bedroom'),nookCenter={x:bed.x+bed.w*.33,y:106+privateDepth*.53};
 fit([smallTable,smallChair],bed,nookCenter,p=>{placeCenter(smallTable,p.x,p.y,0);const t=footprint(smallTable);smallChair.rotation=270;const b=footprint(smallChair);placeCenter(smallChair,t.x-24-b.w/2,t.cy,270);smallChair.seatingTarget=smallTable.id;});
 attach(design('bedroom-plant')[0],smallTable,{dy:-smallTable.h*.3});attach(originalByRole('plant'),broadCoffee,{dy:13});
 const lamp=ownerRoom(originalByRole('floor-lamp'),'living');if(lamp)put(lamp,day,width-50,Math.min(floorBottom-32,loungeY+96));
 const arcade=ownerRoom(originalByRole('arcade'),'bedroom'),sourceArcade=arcade&&source.items.find(i=>i.id===arcade.id),miniArcade=sourceArcade?.supportedBy&&sourceArcade.supportedBy!=='north-wall'&&(sourceArcade.miniature||arcade.w<(asset(arcade)?.w||100)*.65*.8);
 if(arcade&&!miniArcade)put(arcade,bed,bed.x+bed.w-24,Math.min(front-70,106+privateDepth*.46),90);
 const statement=ownerRoom(design('family-statement-plant')[0],'dining');if(statement)put(statement,day,day.x+20,142);
 const extrasArea=player?flippedRect(rect(710,650,780,height-690),width):rect(day.x,Math.max(front+wallWidth+34,loungeY+110),day.w,Math.max(90,floorBottom-Math.max(front+wallWidth+34,loungeY+110)-16));
 const desk=ownerRoom(originalByRole('desk'),'bedroom'),deskChair=ownerRoom(originalByRole('desk-chair'),'bedroom');
 if(desk){const pair=[desk,...(deskChair?[deskChair]:[])];fit(pair,bed,{x:bed.x+bed.w-80,y:front-100},p=>{placeCenter(desk,p.x,p.y,0);if(deskChair){const t=footprint(desk),b=footprint(deskChair);placeCenter(deskChair,t.cx,t.y+t.h+24+b.h/2,180);deskChair.seatingTarget=desk.id;}});}
 const linen=ownerRoom(originalByRole('linen-storage'),'bathroom');if(linen)put(linen,bath,bath.x+54,Math.min(front-70,260),0);
 const extraSofa=design('family-lounge-sofa')[0],extraChair=design('bedroom-reading-chair')[0],spareReading=alternate&&!used.has(alternate)?alternate:null,smallCoffee=originalByRole('coffee-table');
 const shortShowroom=scene.kind==='showroom'&&legacySource.height>targetHeight;
 if(shortShowroom){for(const item of [extraSofa,smallCoffee,extraChair,spareReading].filter(Boolean)){hidden.push(item);used.add(item);}}
 else if(extraSofa&&smallCoffee){
  fit([smallCoffee,extraSofa,...(extraChair?[extraChair]:[]),...(spareReading?[spareReading]:[])],extrasArea,{x:extrasArea.x+extrasArea.w*.5,y:extrasArea.y+extrasArea.h*.5},p=>{
   placeCenter(smallCoffee,p.x,p.y,0);const t=footprint(smallCoffee);extraSofa.rotation=0;const b=footprint(extraSofa);placeCenter(extraSofa,t.cx,t.y-20-b.h/2,0);extraSofa.seatingTarget=smallCoffee.id;
   if(extraChair){extraChair.rotation=180;const s=footprint(extraChair);placeCenter(extraChair,t.cx,t.y+t.h+24+s.h/2,180);extraChair.seatingTarget=smallCoffee.id;}
   if(spareReading){spareReading.rotation=270;const s=footprint(spareReading);placeCenter(spareReading,t.x-24-s.w/2,t.cy,270);spareReading.seatingTarget=smallCoffee.id;}
   for(const item of [smallCoffee,extraSofa,extraChair,spareReading].filter(Boolean))item.roomId=roomId('living');
  });
 }
 if(extraChair&&!used.has(extraChair)){
  extraChair.rotation=180;const table=footprint(smallTable),chair=footprint(extraChair);ownerRoom(extraChair,'bedroom');put(extraChair,bed,table.cx,table.y+table.h+24+chair.h/2,180);extraChair.seatingTarget=smallTable.id;
 }
 for(const item of originalItems){
  if(used.has(item)||item.layer==='ground'||item.wallMounted||miniArcade&&item===arcade)continue;
  if(diners.includes(item)||item===smallCoffee&&!extraSofa){hidden.push(item);continue;}
  const key=role(item),area=key==='instrument'||key==='record-console'?player?extrasArea:day:extrasArea;
  const preferred=key==='instrument'?{x:day.x+120,y:106+depth*.43}:key==='record-console'?{x:area.x+46,y:area.y+Math.min(area.h*.6,180)}:{x:area.x+area.w*.7,y:area.y+area.h*.65};
  ownerRoom(item,key==='instrument'?'music':'living');put(item,area,preferred.x,preferred.y,key==='record-console'?270:item.rotation||0);
 }
 if(miniArcade){
  const parent=originalByRole('record-console')||desk,previous=source.items.find(i=>i.id===parent?.id),at=previous&&centerOf(furnitureFacingBoxes(catalog.get(previous.asset),previous));
  const dx=sourceArcade.x-(at?.cx??previous?.x??0),dy=sourceArcade.y-(at?.cy??previous?.y??0);
  if(parent)attach(arcade,parent,{dx:mirrored?-dx:dx,dy});
 }
 // Wall pieces use real north faces; windows are assigned only after these
 // anchors are known, so no framed art is hidden behind the glazing.
 for(const item of originalItems.filter(i=>i.wallMounted&&!used.has(i))){
  const key=role(item),x=key==='poster'?bed.x+bed.w*.66:key==='shelf'?day.x+Math.min(120,day.w*.2):width-250;
  Object.assign(item,{x,y:94,rotation:0,solid:false,supportedBy:'north-wall',roomId:key==='poster'?roomId('bedroom'):roomId('kitchen')});
  if(player&&wallReserved.some(r=>overlap(furnitureFacingBounds(asset(item),item),r))){for(let at=width-80;at>day.x;at-=60){item.x=at;if(!wallReserved.some(r=>overlap(furnitureFacingBounds(asset(item),item),r)))break;}}
  commit([item]);
 }
 for(const item of originalItems.filter(i=>i.layer==='ground')){
  const family=item.designRole==='family-living-rug',at=family?footprint(familyTable):footprint(smallTable),area=family?day:bed;
  if(family){const scale=Math.min(item.w/asset(item).w,(area.w-24)/asset(item).w,(Math.min(200,area.h)-24)/asset(item).h);item.w=asset(item).w*scale;item.h=asset(item).h*scale;}
  item.rotation=0;item.x=at.cx;item.y=Math.min(area.y+area.h-4,Math.max(area.y+item.h,at.cy+item.h/2));item.roomId=family?roomId('dining'):roomId('bedroom');item.solid=false;commit([item]);
 }
 // The decluttered pieces stay in the new canonical stock with valid poses.
 // Their complete old locations also remain available in the legacy scene.
 for(const item of hidden){const area=player?extrasArea:day;fit([item],area,{x:area.x+area.w*.45,y:area.y+area.h*.72},p=>placeCenter(item,p.x,p.y,0),{gap:0,ignore:new Set(hidden)});}
 const inactive=new Set(hidden),active=placed.filter(i=>!inactive.has(i));
 const roomFrom=(key,area,extra={})=>({...oldRoom(key),...area,id:roomId(key),functionalRole:key,wallpaperAreas:key==='bedroom'||key==='bathroom'?[rect(area.x,0,area.w,106)]:[],...extra});
 const livingArea=rect(day.x,106+depth*.43,day.w,depth*.57),musicArea=rect(day.x,106+depth*.32,Math.min(day.w*.45,300),Math.max(140,depth*.28));
 scene.rooms=[roomFrom('bedroom',bed),roomFrom('bathroom',bath),roomFrom('kitchen',kitchenArea,{floorBounds:{...kitchenArea}}),roomFrom('dining',rect(day.x,106+depth*.08,Math.min(day.w*.55,340),Math.max(140,depth*.35)),{floorOverlay:false}),roomFrom('living',livingArea),roomFrom('music',musicArea,{floorOverlay:false})];
 scene.walls=walls;scene.privacyDoors=doors;scene.items=active;scene.rugs=[];scene.spawn={...spawn};scene.portalExit={...scene.portalExit,threshold:canonicalPoint(source.portalExit.threshold),enterNormal:{x:0,y:-1},door:{...scene.portalExit.door,threshold:canonicalPoint(source.portalExit.threshold),enterNormal:{x:0,y:1}}};
 if(mirrored){
  for(const item of originalItems){const b=footprint(item),at=b?{x:b.cx,y:b.cy}:{x:item.x,y:item.y};item.rotation=(360-(item.rotation||0))%360;Object.assign(item,furnitureAtGroundCenter(asset(item),item,{x:width-at.x,y:at.y}));}
  scene.walls=scene.walls.map(w=>flippedRect(w,width));scene.rooms=scene.rooms.map(r=>({...flippedRect(r,width),wallpaperAreas:(r.wallpaperAreas||[]).map(a=>flippedRect(a,width)),...(r.floorBounds?{floorBounds:flippedRect(r.floorBounds,width)}:{})}));
  scene.privacyDoors=scene.privacyDoors.map(d=>({...d,x:width-d.x-d.length,hinge:'end'}));scene.spawn=canonicalPoint(scene.spawn);scene.portalExit={...scene.portalExit,threshold:canonicalPoint(scene.portalExit.threshold),door:{...scene.portalExit.door,threshold:canonicalPoint(scene.portalExit.door.threshold)}};
 }
 if(player)scene.rooms.push(...source.rooms.filter(r=>['study','personal-studio'].includes(r.functionalRole)).map(r=>({...r,h:Math.min(r.h,floorBottom-r.y),...(r.floorBounds?{floorBounds:{...r.floorBounds,h:Math.min(r.floorBounds.h,floorBottom-r.floorBounds.y)}}:{}),wallpaperAreas:[]})));
 if(miniArcade){
  const parent=all.get(arcade.supportedBy),picture=parent&&furnitureFacingBounds(asset(parent),parent),foot=footprint(arcade);
  if(picture&&foot){const pad=3,cx=Math.max(picture.x+pad+foot.w/2,Math.min(picture.x+picture.w-pad-foot.w/2,foot.cx)),cy=Math.max(picture.y+pad+foot.h/2,Math.min(picture.y+picture.h-pad-foot.h/2,foot.cy));Object.assign(arcade,furnitureAtGroundCenter(asset(arcade),arcade,{x:cx,y:cy}));}
 }
 for(const item of originalItems){const parent=all.get(item.supportedBy);if(parent){item.solid=false;item.depth=furnitureFacingDepth(asset(parent),parent,parent.y)+.25;}const boxes=item.solid?furnitureFacingBoxes(asset(item),item):[];if(item.collisionBoxes)item.collisionBoxes.splice(0,item.collisionBoxes.length,...boxes);else Object.defineProperty(item,'collisionBoxes',{value:boxes,configurable:true});}
 scene.solids=[...shell,...scene.walls,...scene.items.flatMap(i=>i.collisionBoxes)];
 const clear=p=>p.x>=40&&p.y>=112&&p.x<=width-40&&p.y<=height-40&&!scene.solids.some(b=>p.x>=b.x-RADIUS&&p.x<=b.x+b.w+RADIUS&&p.y>=b.y-RADIUS&&p.y<=b.y+b.h+RADIUS);
 function reachable(){
  const step=8,cols=Math.ceil(width/step),rows=Math.ceil(height/step),seen=new Uint8Array(cols*rows),queue=new Int32Array(cols*rows);let end=0;const sx=Math.floor(scene.spawn.x/step),sy=Math.floor(scene.spawn.y/step);
  const at=n=>({x:n%cols*step+4,y:Math.floor(n/cols)*step+4});
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=sx+dx,y=sy+dy,n=y*cols+x;if(x>=0&&x<cols&&y>=0&&y<rows&&clear(at(n))&&!seen[n]){seen[n]=1;queue[end++]=n;}}
  for(let head=0;head<end;head++){const n=queue[head],x=n%cols,y=Math.floor(n/cols);for(const [X,Y]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const k=Y*cols+X;if(X>=0&&X<cols&&Y>=0&&Y<rows&&!seen[k]&&clear(at(k))){seen[k]=1;queue[end++]=k;}}}
  return p=>{if(!clear(p))return false;const x=Math.floor(p.x/step),y=Math.floor(p.y/step);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy,n=Y*cols+X;if(X>=0&&X<cols&&Y>=0&&Y<rows&&seen[n]&&Math.hypot(at(n).x-p.x,at(n).y-p.y)<14)return true;}return false;};
 }
 const reaches=reachable(),near=(area,preferred)=>{
  const options=[preferred];for(let y=area.y+20;y<area.y+area.h-12;y+=12)for(let x=area.x+20;x<area.x+area.w-12;x+=12)options.push({x,y});return options.find(reaches)||null;
 };
 for(const r of scene.rooms){r.point=near(r,{x:r.x+r.w*.5,y:r.y+r.h*.65});if(!r.point&&r.functionalRole!=='music')throw Error('No reachable '+r.functionalRole+' in '+scene.id);}
 for(const d of scene.privacyDoors)for(const sign of [-1,1])if(!reaches({x:d.x+18,y:d.y+sign*24}))throw Error('Blocked '+d.id+' doorway in '+scene.id);
 const approaches=[];for(const item of scene.items.filter(i=>i.solid)){
  const b=footprint(item),frontIndex=Math.round((item.rotation||0)/90)%4,options=[];for(const gap of [14,22,32]){const sides=[{x:b.cx,y:b.y+b.h+gap},{x:b.x-gap,y:b.cy},{x:b.cx,y:b.y-gap},{x:b.x+b.w+gap,y:b.cy}];options.push(sides[frontIndex],...sides);}
  const p=options.find(reaches);if(p){item.approach={...p};approaches.push({role:item.furnitureRole||role(item),asset:item.asset,roomId:item.roomId,...p});}
 }
 if(scene.homePlan)scene.homePlan={...scene.homePlan,width,height,spawn:{...scene.spawn},rooms:scene.rooms,fixtureApproaches:approaches,taskLights:[]};
 const actualDining=scene.items.find(i=>i.id===familyTable.id),actualCoffee=scene.items.find(i=>i.id===broadCoffee.id),browse=near(scene.rooms.find(r=>r.functionalRole==='dining'),actualDining.approach||{x:actualDining.x,y:actualDining.y+70});
 if(scene.showroom){const plan=scene.showroom.apartment;scene.showroom={...scene.showroom,apartment:{...plan,width,height,spawn:{...scene.spawn},browse,visitRoute:[{...scene.spawn},browse],exitRoute:[browse,{...scene.spawn}],areas:scene.rooms,items:scene.items,walls:scene.walls,privacyDoors:scene.privacyDoors}};}
 scene.zones=scene.zones.map(z=>z.action==='shop'&&z.showroomId?{...z,x:browse.x-30,y:browse.y-28,w:60,h:56}:z.action==='resident'?{...z}:z);
 scene.familyFurniture={...scene.familyFurniture,diningTable:familyTable.id,livingTable:broadCoffee.id,diningSeats:diningSeats.map(i=>i.id),livingSeats:[sofa,...lounge].map(i=>i.id),bedroomNook:{table:smallTable.id,seat:smallChair.id}};
 const familyRug=scene.items.find(i=>i.designRole==='family-living-rug');
 scene.familyFurnitureZones={living:{...scene.rooms.find(r=>r.functionalRole==='living')},dining:{...scene.rooms.find(r=>r.functionalRole==='dining')},...(familyRug?{rug:rect(familyRug.x-familyRug.w/2-12,familyRug.y-familyRug.h-12,familyRug.w+24,familyRug.h+24)}:{})};
 scene.interiorDesign={...scene.interiorDesign,circulation:[],focalPoints:[{x:actualDining.x,y:actualDining.y,role:'dining'},{x:actualCoffee.x,y:actualCoffee.y,role:'conversation'}]};
 scene.lights=scene.rooms.filter(r=>r.point).map(r=>({x:r.point.x,y:r.point.y,r:r.functionalRole==='living'?220:150}));
 const windowObstacles=scene.items.filter(i=>i.wallMounted||['bed','wardrobe','fridge','pantry'].includes(role(i))).map(i=>furnitureFacingBounds(asset(i),i));
 scene.windows=[];for(const area of scene.rooms.filter(r=>['bedroom','kitchen'].includes(r.functionalRole))){
  const low=area.functionalRole==='kitchen'?['sink','stove','counter'].map(key=>scene.items.find(i=>role(i)===key)).filter(Boolean).map(i=>footprint(i).cx):[];
  const candidates=[...low,area.x+area.w*.35,area.x+area.w*.65,area.x+area.w*.5];
  for(const x of candidates){const w=70,box=rect(x-w/2-4,16,w+8,90);if(!windowObstacles.some(i=>overlap(i,box))&&(!player||!(apartmentWallDecorBounds(scene)||[]).some(r=>overlap(r,box)))){scene.windows.push({x,y:24,w});break;}}
 }
 if(scene.showroom)scene.showroom.apartment.windows=scene.windows;
 delete scene.roomLayoutSignatureFrame;delete scene.roomExpansionLegacyPoses;
 scene.wideRoomLayout={version:2,reference:reference?.id||'showroom-victorian-parlor',mirrored};
 // Saved layouts reconstruct pieces from this canonical stock. Capture the
 // final approach/support metadata so Reset and a fresh reload agree exactly.
 scene.roomLayoutBaseItems=originalItems.map(cloneItem);
 Object.defineProperty(scene,'roomLayoutLegacySources',{value:[legacySource,previousLayout],configurable:true});
 return scene;
}
