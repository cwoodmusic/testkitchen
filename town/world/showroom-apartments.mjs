import {APARTMENT_COLLECTION_ASSETS,getApartmentAsset} from './apartment-collections.mjs?v=furniture-facings-1';
import {furnitureFacingBoxes,furnitureFacingDepth,furnitureAtGroundCenter} from './furniture-facing.mjs?v=furniture-facings-1';
const native=new Map(APARTMENT_COLLECTION_ASSETS.map(a=>[a.id,a]));
const rect=(x,y,w,h)=>({x,y,w,h}),point=(x,y)=>({x,y});
const rooms=[
 {bed:{x:28,w:328},bath:{x:388,w:200},front:326},
 {bed:{x:276,w:344},bath:{x:28,w:216},front:318},
 {bed:{x:28,w:368},bath:{x:428,w:208},front:318},
 {bed:{x:308,w:328},bath:{x:28,w:248},front:326}
];
function add(items,owner,slot,role,x,y,maxW,maxH,extra={}){
 const a=getApartmentAsset(owner,slot),scale=Math.min(maxW/a.w,maxH/a.h);
 const item={asset:a.id,productId:'furniture-'+a.id,furnitureRole:role,slot,collectionOwner:owner,visualSignature:a.visualSignature,x,y,w:a.w*scale,h:a.h*scale,solid:a.solid,wallMounted:a.wallMounted,layer:a.layer,motionKind:a.motionKind,...extra};
 items.push(item);return item;
}
// The eight wide units occupy two columns/four rows of the original store.
// Four different private-room arrangements each have a mirrored counterpart.
export function createShowroomApartmentPlan(display){
 if(display.storeFloor===2)return createUpperApartmentPlan(display);
 const width=1184,height=448,index=display.index??0,mirror=(display.column??index%2)===1,variant=Math.floor(index/2)%4,config=rooms[variant],owner='showroom-'+display.id;
 const items=[],walls=[],areas=[],privacyDoors=[],F=config.front;
 const bed={...config.bed,y:106,h:F-106},bath={...config.bath,y:106,h:F-106};
 const dayX=Math.max(bed.x+bed.w,bath.x+bath.w)+40;
 const privateRoom=(r,role,label,entryOffset)=>{
  const gap=r.x+entryOffset,length=role==='bedroom'?112:120;
  if(r.x>28)walls.push(rect(r.x-16,106,16,F-106));
  walls.push(rect(r.x+r.w,106,16,F-106),rect(r.x,F,gap-r.x,16),rect(gap+length,F,r.x+r.w-gap-length,16));
  privacyDoors.push({id:role,roomId:role,axis:'horizontal',x:gap,y:F+8,length,open:true,hinge:'start'});
  areas.push({name:label,functionalRole:role,...r,point:role==='bedroom'?point(r.x+r.w-84,268):point(r.x+56,270)});
 };
 privateRoom(bed,'bedroom','Private bedroom',bed.w-136);privateRoom(bath,'bathroom','Private bathroom',24);
 areas.push({name:'Kitchen & breakfast counter',functionalRole:'kitchen',...rect(dayX,106,1156-dayX,190),point:point(dayX+90,248)},
  {name:'Living & listening room',functionalRole:'living',...rect(dayX,276,1156-dayX,144),point:point(dayX+280,356)},
  {name:'Everyday dining',functionalRole:'dining',...rect(dayX+270,244,210,120),point:point(dayX+340,350)});
 const bedItem=add(items,owner,'bed','bed',bed.x+87,302,150,150);
 add(items,owner,'wardrobe','wardrobe',bed.x+bed.w-76,236,80,130);
 const night=add(items,owner,'nightstand','nightstand',bed.x+190,300,48,62);
 add(items,owner,'toy','playful-accent',bedItem.x,234,42,46,{solid:false,depth:bedItem.y+.25,supportedBy:bedItem.asset});
 add(items,owner,'table-lamp','table-lamp',night.x,254,28,42,{solid:false,depth:night.y+.25,supportedBy:night.asset});
 add(items,owner,'poster','wall-art',bed.x+bed.w-110,94,84,92);
 add(items,owner,'vanity','vanity',bath.x+54,212,76,102,{fixtureRole:'vanity'});
 add(items,owner,'mirror','bathroom-mirror',bath.x+54,96,58,64,{fixtureRole:'bathroom-mirror'});
 const bathing=getApartmentAsset(owner,'bath-fixture');
 add(items,owner,'bath-fixture',bathing.purpose==='bathtub'?'bathtub':'shower',bath.x+bath.w-52,250,bathing.purpose==='bathtub'?104:90,140,{fixtureRole:'bath-fixture'});
 add(items,owner,'toilet','toilet',bath.x+bath.w-52,300,46,78,{fixtureRole:'toilet'});
 add(items,owner,'sink','kitchen',dayX+58,220,100,104,{fixtureRole:'sink'});
 add(items,owner,'counter','kitchen-counter',dayX+166,220,110,100,{fixtureRole:'counter'});
 add(items,owner,'stove','stove',dayX+266,224,76,108,{fixtureRole:'stove'});
 const pantry=add(items,owner,'pantry','pantry',dayX+350,230,64,110,{fixtureRole:'pantry'});
 add(items,owner,'fridge','fridge',dayX+444,270,70,126,{fixtureRole:'fridge'});
 add(items,owner,'lava-lamp','lava-lamp',pantry.x,162,26,58,{solid:false,depth:pantry.y+.25,supportedBy:pantry.asset});
 add(items,owner,'sofa','sofa',dayX+160,344,180,126);
 add(items,owner,'coffee-table','coffee-table',dayX+160,404,104,66);
 add(items,owner,'dining-table','dining-table',dayX+340,318,90,90);
 add(items,owner,'dining-chair','dining-chair',dayX+430,330,48,78);
 add(items,owner,'arcade','arcade',dayX+324,410,62,112);
 add(items,owner,'floor-lamp','floor-lamp',dayX+262,404,68,88);
 add(items,owner,'plant','plant',dayX+438,410,50,82);
 add(items,owner,'rug','music-rug',dayX+164,414,220,142);
 add(items,owner,'clock','wall-accent',dayX+300,94,64,78);
 let plan={width,height,collectionOwner:owner,layoutId:['west-bedroom','west-bathroom','long-bedroom','broad-bathroom'][variant],spawn:point(1100,352),browse:point(dayX+280,356),items,walls,areas,privacyDoors,
  design:{purpose:'A compact home with a private sleeping/service wing and a shared day room',focalPoints:[{x:dayX+324,y:410,role:'personal-music-and-games'}],groups:[{role:'conversation',slots:['sofa','coffee-table','floor-lamp','rug']},{role:'kitchen-work-area',slots:['sink','counter','stove','fridge','pantry']}],circulation:[]},
  windows:[{x:bed.x+90,w:80},{x:dayX+430,w:70}],portalExit:{threshold:point(1156,352),enterNormal:point(-1,0),triggerHalfWidth:64}};
 if(mirror)plan=mirrorPlan(plan);
 plan.layoutId+=mirror?'-mirrored':'-original';plan.bedroomDoor=plan.privacyDoors.find(d=>d.id==='bedroom');plan.bathroomDoor=plan.privacyDoors.find(d=>d.id==='bathroom');
 plan.visitRoute=browsingRoute(plan);plan.exitRoute=plan.visitRoute.map(p=>({...p})).reverse();return plan;
}
function createUpperApartmentPlan(display){
 const width=1184,height=832,owner='showroom-'+display.id,mirror=display.column===1,variant=Math.floor((display.index-8)/2),items=[],walls=[],areas=[],privacyDoors=[];
 const put=(slot,role,x,y,w,h,extra={})=>add(items,owner,slot,role,x,y,w,h,extra);
 const area=(role,name,r,p)=>areas.push({functionalRole:role,name,...r,point:p});
 const door=(role,axis,x,y,length)=>privacyDoors.push({id:role,roomId:role,axis,x,y,length,open:true,hinge:'start'});
 const bed=rect(28,106,variant?390:368,308),bath=variant?rect(916,106,240,328):rect(28,550,368,254);
 // Sleeping and bathing remain genuinely private. Door openings meet the
 // circulation spine rather than opening behind a chair or an appliance.
 if(!variant){
  walls.push(rect(396,106,16,164),rect(396,390,16,40),rect(28,414,384,16),rect(28,444,368,106),rect(396,550,16,100),rect(396,770,16,34));
  door('bedroom','vertical',404,270,120);door('bathroom','vertical',404,650,120);
 }else{
  walls.push(rect(418,106,16,344),rect(28,434,254,16),rect(402,434,32,16),rect(900,106,16,344),rect(916,434,24,16),rect(1060,434,96,16));
  door('bedroom','horizontal',282,442,120);door('bathroom','horizontal',940,442,120);
 }
 area('bedroom','Quiet private bedroom',bed,point(330,350));
 area('bathroom','Complete private bathroom',bath,variant?point(1040,360):point(230,750));
 const bedItem=put('bed','bed',145,345,170,170),night=put('nightstand','nightstand',260,345,48,62);
 put('wardrobe','wardrobe',variant?340:320,260,80,130);
 put('toy','playful-accent',bedItem.x,268,42,46,{solid:false,depth:bedItem.y+.25,supportedBy:bedItem.asset});
 put('table-lamp','table-lamp',night.x,300,28,42,{solid:false,depth:night.y+.25,supportedBy:night.asset});
 put('poster','wall-art',variant?346:336,94,84,92);
 const vanity=variant?point(970,212):point(100,656),mirrorBottom=variant?96:540;
 put('vanity','vanity',vanity.x,vanity.y,76,102,{fixtureRole:'vanity'});
 put('mirror','bathroom-mirror',vanity.x,mirrorBottom,58,64,{fixtureRole:'bathroom-mirror'});
 const bathing=getApartmentAsset(owner,'bath-fixture'),bathW=bathing.purpose==='bathtub'?104:90;
 put('bath-fixture',bathing.purpose==='bathtub'?'bathtub':'shower',variant?1100:310,variant?300:730,bathW,140,{fixtureRole:'bath-fixture'});
 put('toilet','toilet',variant?960:100,variant?380:785,46,78,{fixtureRole:'toilet'});
 put('linen-storage','bathroom-storage',variant?1030:220,variant?230:650,50,88);
 const kitchen=variant?{x:90,y:640}: {x:660,y:230};
 for(const [slot,role,dx,dy,w,h]of [['sink','kitchen',0,0,100,104],['counter','kitchen-counter',110,0,110,100],['stove','stove',205,4,76,108],['fridge','fridge',310,30,70,126],['pantry','pantry',420,30,64,110]])put(slot,role,kitchen.x+dx,kitchen.y+dy,w,h,{fixtureRole:slot});
 area('kitchen','Connected kitchen work area',variant?rect(28,530,560,274):rect(606,106,550,274),variant?point(350,730):point(650,310));
 const dining=variant?point(650,370):point(900,370);
 const diningTable=put('dining-table','dining-table',dining.x,dining.y,100,100);put('dining-chair','dining-chair',dining.x+150,dining.y+10,56,88);
 area('dining','Sunny breakfast and homework nook',variant?rect(470,270,390,144):rect(810,280,346,150),variant?point(550,350):point(1000,425));
 const desk=variant?put('desk','window-desk',650,220,160,114):null;
 const loungeX=variant?830:780,console=put('record-console','listening-focal-point',0,0,180,124,{rotation:270});
 Object.assign(console,furnitureAtGroundCenter(getApartmentAsset(owner,'record-console'),console,point(650,660)));
 put('sofa','sofa',loungeX,650,190,134);put('coffee-table','coffee-table',loungeX,728,115,72);
 put('reading-chair','conversation-chair',variant?1040:1000,680,84,114,{rotation:90});
 put('arcade','arcade',variant?1090:1080,790,62,112);
 put('floor-lamp','floor-lamp',variant?1030:990,800,80,100);
 put('plant','plant',variant?580:650,800,50,82);
 put('rug','music-rug',loungeX+35,790,360,224);
 // Use the clear writing surface, keeping the record-player platter usable.
 // The first pair shares a breakfast/homework table; the second has desks.
 const lampSupport=desk||diningTable,lampX=desk?desk.x-(mirror?32:18):diningTable.x-26,lampY=desk?desk.y-(mirror?52:56):diningTable.y-48;
 put('lava-lamp','lava-lamp',lampX,lampY,26,58,{solid:false,depth:furnitureFacingDepth(getApartmentAsset(owner,lampSupport.slot),lampSupport)+.25,supportedBy:lampSupport.asset});
 put('clock','wall-accent',variant?820:650,94,64,78);
 area('living','Conversation and record-listening lounge',rect(variant?620:600,550,variant?536:556,254),variant?point(980,760):point(920,760));
 let plan={width,height,collectionOwner:owner,layoutId:variant?'separated-night-wings':'stacked-private-wing',spawn:point(1100,480),browse:point(variant?890:920,480),items,walls,areas,privacyDoors,
  wallpaperAreas:[rect(28,0,width-56,106),...(!variant?[rect(28,444,368,106)]:[])],
  design:{purpose:'A full home organized around quiet private rooms and a shared listening lounge',focalPoints:[{x:650,y:660,role:'record-listening'},{x:variant?650:900,y:370,role:'daylight-dining'}],groups:[{role:'conversation',slots:['sofa','coffee-table','reading-chair','record-console','rug']},{role:'kitchen-work-area',slots:['sink','counter','stove','fridge','pantry']}],circulation:variant?[rect(44,452,1096,120)]:[rect(420,240,176,548),rect(420,400,736,176)]},
  windows:variant?[{x:230,w:100},{x:650,w:140},{x:1090,w:70}]:[{x:220,w:100},{x:900,w:150}],portalExit:{threshold:point(1156,480),enterNormal:point(-1,0),triggerHalfWidth:64}};
 if(mirror)plan=mirrorPlan(plan);
 plan.layoutId+=mirror?'-mirrored':'-original';plan.bedroomDoor=plan.privacyDoors.find(d=>d.id==='bedroom');plan.bathroomDoor=plan.privacyDoors.find(d=>d.id==='bathroom');
 plan.visitRoute=browsingRoute(plan);plan.exitRoute=plan.visitRoute.map(p=>({...p})).reverse();return plan;
}
function mirrorPlan(plan){
 const flip=p=>({...p,x:plan.width-p.x}),flipRect=r=>({...r,x:plan.width-r.x-r.w});
 return {...plan,spawn:flip(plan.spawn),browse:flip(plan.browse),windows:plan.windows.map(flip),items:plan.items.map(item=>({...flip(item),...(item.rotation?{rotation:(360-item.rotation)%360}:{})})),walls:plan.walls.map(flipRect),areas:plan.areas.map(a=>({...flipRect(a),point:flip(a.point)})),privacyDoors:plan.privacyDoors.map(d=>({...d,x:plan.width-d.x-(d.axis==='horizontal'?d.length:0),hinge:'end'})),wallpaperAreas:plan.wallpaperAreas?.map(flipRect),design:plan.design?{...plan.design,focalPoints:plan.design.focalPoints.map(flip),circulation:plan.design.circulation.map(flipRect)}:undefined,portalExit:{...plan.portalExit,threshold:flip(plan.portalExit.threshold),enterNormal:point(1,0)}};
}
function browsingRoute(plan){
 const solids=[rect(0,0,plan.width,106),rect(0,0,28,plan.height),rect(plan.width-28,0,28,plan.height),rect(0,plan.height-28,plan.width,28),...plan.walls];
 for(const item of plan.items){if(!item.solid)continue;const a=native.get(item.asset);solids.push(...furnitureFacingBoxes(a,item));}
 const blocked=p=>solids.some(r=>p.x>=r.x-16&&p.x<=r.x+r.w+16&&p.y>=r.y-16&&p.y<=r.y+r.h+16);
 const clear=(a,b)=>{const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/3));for(let i=0;i<=steps;i++)if(blocked({x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps}))return false;return true;};
 const start={...plan.spawn,parent:-1},queue=[start],seen=new Set([start.x+','+start.y]);let end=-1,corner=null;
 for(let next=0;next<queue.length;next++){
  const a=queue[next];if(Math.hypot(a.x-plan.browse.x,a.y-plan.browse.y)<=12){const c={x:plan.browse.x,y:a.y};if(clear(a,c)&&clear(c,plan.browse)){end=next;corner=c;break;}}
  for(const [dx,dy]of [[8,0],[-8,0],[0,8],[0,-8]]){const p={x:a.x+dx,y:a.y+dy,parent:next},k=p.x+','+p.y;if(p.x<40||p.y<122||p.x>plan.width-40||p.y>plan.height-44||seen.has(k)||blocked(p))continue;seen.add(k);queue.push(p);}
 }
 if(end<0)throw Error('Apartment browsing route is blocked: '+plan.layoutId);
 const path=[];for(let i=end;i>=0;i=queue[i].parent)path.push({x:queue[i].x,y:queue[i].y});path.reverse();path.push(corner,{...plan.browse});const result=[];
 for(const p of path){if(result.length&&p.x===result.at(-1).x&&p.y===result.at(-1).y)continue;while(result.length>1){const a=result.at(-2),b=result.at(-1);if((a.x===b.x&&b.x===p.x)||(a.y===b.y&&b.y===p.y))result.pop();else break;}result.push(p);}return result;
}
export function applyShowroomApartment(scene,display,{room,wall,addItem,rug,sign,light,zone,windowAt}){
 const plan=display.apartment;scene.kind='showroom';scene.floor=display.storeFloor||1;scene.storeFloor=scene.floor;scene.showroomId=display.id;scene.showroom=display;scene.title=display.name+' · Wide One-bedroom Apartment';scene.spawn={...plan.spawn};scene.apartmentLayout=plan.layoutId;scene.collectionOwner=plan.collectionOwner;scene.interiorDesign=plan.design;scene.portalExit={...plan.portalExit,doorId:'showroom-'+display.id,threshold:{...plan.portalExit.threshold},enterNormal:{...plan.portalExit.enterNormal}};
 room(scene,display.name,28,106,scene.width-56,scene.height-134,display.floor.id);
 Object.assign(scene.rooms.at(-1),{functionalRole:'apartment',showroomId:display.id,style:display.style,floorFinish:display.floor,wallpaper:display.wallpaper,wallpaperAreas:plan.wallpaperAreas||[rect(28,0,scene.width-56,106)],productIds:display.productIds});
 for(const a of plan.areas){room(scene,a.name,a.x,a.y,a.w,a.h,a.functionalRole==='bathroom'?'tile':display.floor.id);Object.assign(scene.rooms.at(-1),{id:display.id+'-'+a.functionalRole,functionalRole:a.functionalRole,showroomId:display.id,point:a.point,...(a.functionalRole==='bathroom'?{floorFinish:{id:'bathroom-hex',pattern:'bathroom-hex',colors:['#e1ddd0','#f0eadc','#a4b6aa','#6c817c']}}:{})});}
 for(const p of plan.walls){wall(scene,p.x,p.y,p.w,p.h);Object.assign(scene.walls.at(-1),{color:display.wallpaper.colors[0],trim:display.wallpaper.colors[3]||display.wallpaper.colors[1]});}
 scene.privacyDoors=plan.privacyDoors.map(d=>({...d,id:display.id+'-'+d.id,roomId:display.id+'-'+d.roomId,color:display.wallpaper.colors[0],trim:display.wallpaper.colors[3]}));
 for(const item of plan.items){const placed=addItem(scene,item.asset,item.x,item.y,item.w,item.h,item.solid,item.rotation||0);Object.assign(placed,{productId:item.productId,showroomId:display.id,furnitureRole:item.furnitureRole,fixtureRole:item.fixtureRole,wallMounted:item.wallMounted,layer:item.layer,depth:item.depth,rotation:item.rotation||0,slot:item.slot,collectionOwner:item.collectionOwner,visualSignature:item.visualSignature,motionKind:item.motionKind,supportedBy:item.supportedBy});}
 scene.zones.push(zone('browse-'+display.id,'Shop this apartment',plan.browse.x-30,plan.browse.y-28,60,56,'shop',{showroomId:display.id}),zone('lobby-'+display.id,'Return to '+(scene.floor===2?'the upper gallery':'the main lobby'),plan.spawn.x-28,plan.spawn.y-56,56,112,'showroom-lobby',{showroomId:display.id,storeFloor:scene.floor,doorId:'showroom-'+display.id,...plan.portalExit}));
 sign(scene,display.name,scene.width/2,scene.height-12,14);for(const a of plan.areas)light(scene,a.point.x,a.point.y,a.functionalRole==='living'?220:150);
 if(windowAt)for(const window of plan.windows)windowAt(scene,window.x,24,window.w);return scene;
}
