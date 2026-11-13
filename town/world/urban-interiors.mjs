import {assetImage} from './asset-color.mjs?v=opera-parallax-1';
import {SHOWROOMS,applyShowroomLayout} from './showroom-layout.mjs?v=town-room-placement-2';
import {drawShowroomThemeSign} from './showroom-signs.mjs?v=town-store-halls-1';
import {applyShowroomApartment} from './showroom-apartments.mjs?v=town-room-placement-2';
import {drawShowroomFloor,drawShowroomWallpaper} from './showroom-materials.mjs?v=town-victorian-2';
import {applyHomeMaterialSuite,fitCompactKitchenFloor,warmHomeMaterials,drawHomeMaterialRug} from './home-materials.mjs?v=town-victorian-2';
import {drawTowerCommonSurfaces,drawTowerCommonStairs,towerCommonMaterialsReady,warmTowerCommonMaterials} from './tower-common-materials.mjs?v=opera-parallax-1';
import {drawInteriorDoor,drawPrivacyDoor,drawElevatorPortal,getElevatorVisualGeometry,interiorPortalVisualDepth,warmInteriorPortalArt} from './interior-portal-art.mjs?v=opera-parallax-1';
import {applyTowerCommonArchitecture} from './tower-common-architecture.mjs?v=opera-parallax-1';
import {interiorActorScale} from './interior-scale.mjs?v=opera-parallax-1';
import {calibratePrivateFurniture,presentedRoomItem} from './private-furniture.mjs?v=town-store-halls-1';
import {normalizeInteriorDoorways} from './interior-doorways.mjs?v=opera-parallax-1';
import {drawInteriorWindow,warmInteriorWindows} from './interior-window-art.mjs?v=opera-parallax-1';
import {drawInteriorWallNetwork} from './interior-wall-art.mjs?v=town-victorian-4';
import {createRoomLayoutResolver} from './room-layout-runtime.mjs?v=town-room-placement-2';
export {apartmentDecorBounds,apartmentWallDecorBounds} from './personal-room-areas.mjs?v=opera-parallax-1';
import {getConcertHall,renderConcertHallBackground,concertHallDrawables} from './concert-hall.mjs?v=town-flight-1';
import {renderStagePerformance} from './concert-performers.mjs?v=opera-players-2';
import {buildApartmentHome} from './apartment-homes.mjs?v=town-room-placement-2';
import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs?v=opera-parallax-1';
import {APARTMENT_COLLECTION_ASSETS,getApartmentAsset} from './apartment-collections.mjs?v=town-room-placement-2';
import {drawApartmentMotion} from './apartment-motion.mjs?v=opera-parallax-1';
import {furnitureFacingPlacement,furnitureFacingDepth,furnitureFacingBoxes,furnitureAtGroundCenter} from './furniture-facing.mjs?v=opera-parallax-1';
import {drawFurnitureContactShadow} from './furniture-contact-shadow.mjs?v=town-room-placement-2';
import {preparePlacedFacingArt} from './furniture-art-access.mjs?v=opera-parallax-1';
// The apartment tower has one consistent floor plate. Residential floors use
// a 608px common hall and 1120px private apartments, within its 2304 × 1728 lot.
export const FLOOR_COUNT=15;
export const TOWER_FOOTPRINT=Object.freeze({width:2304,height:1728});
export const STORE_FOOTPRINT=Object.freeze({width:3072,height:2048});
export {residents} from './resident-profiles.mjs?v=opera-parallax-1';
import {residents} from './resident-profiles.mjs?v=opera-parallax-1';
const sceneCache=new Map(),backgroundCache=new Map();
const MAX_BACKGROUNDS=8,MAX_BACKGROUND_PIXELS=16*1024*1024;
let backgroundPixels=0;
function discardBackground(id){const canvas=backgroundCache.get(id);if(!canvas)return; backgroundPixels-=canvas.width*canvas.height;backgroundCache.delete(id);canvas.width=canvas.height=0;}
function clearBackgrounds(){for(const id of backgroundCache.keys())discardBackground(id);}
function rememberBackground(id,canvas){discardBackground(id);backgroundCache.set(id,canvas);backgroundPixels+=canvas.width*canvas.height;while(backgroundCache.size>MAX_BACKGROUNDS||backgroundPixels>MAX_BACKGROUND_PIXELS&&backgroundCache.size>1)discardBackground(backgroundCache.keys().next().value);}
export const getInteriorRenderCacheStats=()=>({backgrounds:backgroundCache.size,pixels:backgroundPixels,maxBackgrounds:MAX_BACKGROUNDS,maxPixels:MAX_BACKGROUND_PIXELS});
export function clearInteriorRenderCache(){clearBackgrounds();warmedScene=null;warmedCatalog=null;}
const collectionDefinitions=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(a=>[a.id,a]));
let warmedScene=null,warmedCatalog=null,portalArtWarmed=false;
let nativeCatalog=null,woodTexture=null,npcRenderer=null;
let roomLayouts;
const drawConcertNPC=(ctx,actor,time)=>npcRenderer?.drawNPC(ctx,actor,time);
export function configureUrbanInteriors(catalog){if(nativeCatalog!==catalog){nativeCatalog=catalog;clearBackgrounds();}}
if(typeof document!=='undefined'){
 import('./ground-textures.mjs?v=opera-parallax-1').then(({groundTextures})=>{woodTexture=groundTextures.wood;clearBackgrounds();}).catch(()=>{});
}
const rect=(x,y,w,h)=>({x,y,w,h});
const zone=(id,label,x,y,w,h,action,extra={})=>({id,label,x,y,w,h,action,...extra});
function addItem(scene,asset,x,y,w,h=null,solid=true,rotation=0){
 const a=nativeCatalog?.get(asset)||collectionDefinitions.get(asset),height=h||w*(a?.h||1)/(a?.w||1),item={id:`${scene.id}-item-${scene.items.length}`,asset,x,y,w,h:height,solid,...(rotation?{rotation}:{})};scene.items.push(item);
 const boxes=[];Object.defineProperty(item,'collisionBoxes',{value:boxes});
 // Furniture is upright in the three-quarter cutaway. Its feet, rather than
 // its pictured height, block walking; beds occupy their full floor footprint.
 if(solid){
  if((asset.startsWith('apartment-')||asset.startsWith('showroom-')||a?.apartmentCollection)&&a){boxes.push(...furnitureFacingBoxes(a,item));}
  else{const bed=asset==='furniture-2-180'||asset.endsWith('-bed'),depth=bed?height*.72:Math.min(height*.48,w*.5);boxes.push(rect(x-w*.43,y-depth,w*.86,depth));}
  scene.solids.push(...boxes);
 }
 return item;
}
function room(scene,name,x,y,w,h,material='wood'){scene.rooms.push({name,x,y,w,h,material});}
function shell(id,title,width,height,color='#526d63',trim='#c8aa77'){
 return {id,title,width,height,color,trim,spawn:{x:width/2,y:height-150},solids:[rect(0,0,width,106),rect(0,0,28,height),rect(width-28,0,28,height),rect(0,height-28,width,28)],items:[],zones:[],rooms:[],walls:[],rugs:[],windows:[],signs:[],lights:[],actors:[]};
}
function wall(scene,x,y,w,h){scene.walls.push(rect(x,y,w,h));scene.solids.push(rect(x,y,w,h));}
function windowAt(scene,x,y,w=148){scene.windows.push({x,y,w});}
function rug(scene,x,y,w,h,color=scene.color){scene.rugs.push({x,y,w,h,color});}
function sign(scene,text,x,y,size=23){scene.signs.push({text,x,y,size});}
function light(scene,x,y,r=190){scene.lights.push({x,y,r});}
function commonZones(s,floor){
 const mid=s.width/2;
 s.zones.push(zone('lift',`Elevator · floor ${floor}`,mid-120,130,240,200,'elevator',{floor}),zone('stair-up',floor<15?'Stairs up':'Top floor',200,160,250,210,'stairs-up',{floor}),zone('stair-down',floor>1?'Stairs down':'Street level',s.width-450,160,250,210,floor>1?'stairs-down':'exit',{floor}));
 sign(s,'ELEVATOR',mid,118,20);sign(s,floor<15?'UP ↑':'FLOOR 15',325,145,20);sign(s,floor>1?'DOWN ↓':'STREET ↓',s.width-325,145,20);
 s.elevator={x:mid-112,y:112,w:224,h:210,floor};s.stairs=[{x:200,y:170,w:250,h:192,up:true},{x:s.width-450,y:170,w:250,h:192,up:false}];
}
function lobby(){
 const s=shell('tower-lobby','Coda Residences · Grand Lobby',2304,1728,'#2b6371','#cda056');s.kind='lobby';s.floor=1;
 commonZones(s,1);rug(s,868,380,568,1160,'#3c8190');rug(s,170,820,540,550,'#7b5159');rug(s,1594,820,540,550,'#526d63');
 room(s,'Reception lounge',140,690,620,800);room(s,'Music salon',1544,690,620,800);
 for(const x of [600,1704])windowAt(s,x,24,220);
 addItem(s,'furniture-1-180',430,1070,350,235);addItem(s,'furniture-5-180',430,1325,270,240);addItem(s,'furniture-1-180',1850,1070,350,235);addItem(s,'furniture-0-180',1850,1390,330,340);
 addItem(s,'decor-05-05',550,600,250,230);addItem(s,'decor-05-06',1750,600,180,170);
 for(const x of [170,750,1554,2134])addItem(s,'decor-08-09',x,770,180,250);
 for(const [x,y]of [[170,1450],[2134,1450],[800,400],[1504,400]])addItem(s,'decor-08-02',x,y,130,165);
 s.zones.push(zone('street','Return to Coda Town',s.width/2-170,s.height-240,340,190,'exit'));
 s.directory={x:865,y:122,w:180,h:270};s.zones.push(zone('directory','Building directory',870,400,180,150,'elevator',{floor:1}));
 sign(s,'CODA RESIDENCES',1152,680,52);sign(s,'Fifteen floors. One musical neighbourhood.',1152,730,24);sign(s,'STREET',1152,1630,20);
 light(s,1152,600,420);light(s,430,1160,330);light(s,1850,1160,330);
 return s;
}
function hall(floor){
 const s=shell(`tower-floor-${floor}`,`Coda Residences · Floor ${floor}`,2304,608,'#536580','#b08e60');s.kind='hall';s.floor=floor;
 // The stair and lift core occupies the center of every residential hall;
 // apartment doors sit on the north wall at each end of a broad corridor.
 const occupants=residents.filter(r=>r.floor===floor),doors=floor===15?[{id:'player',name:'Your apartment',number:'15A',theme:'The Rooftop Studio'}]:occupants;
 s.elevator={x:1032,y:112,w:240,h:150,floor};s.stairs=[...(floor<15?[{x:730,y:120,w:220,h:155,up:true}]:[]),{x:1354,y:120,w:220,h:155,up:false}];
 s.zones.push(zone('lift',`Elevator · floor ${floor}`,1032,252,240,160,'elevator',{floor}));
 if(floor<15)s.zones.push(zone('stair-up','Stairs up',730,260,220,150,'stairs-up',{floor}));
 s.zones.push(zone('stair-down','Stairs down',1354,260,220,150,'stairs-down',{floor}));
 rug(s,100,420,2104,100,'#5b3e48');
 doors.forEach((r,i)=>{const x=doors.length===1?500:i===0?430:1874;s.doors??=[];s.doors.push({x,y:112,w:170,h:190,number:r.number,color:residents.find(n=>n.id===r.id)?.color||'#3c8190'});s.zones.push(zone(`room-${r.id}`,`${r.number} · ${r.name}`,x-95,282,190,150,'room',{resident:r.id,floor}));sign(s,r.theme,x,385,20);});
 for(const x of [150,2154])addItem(s,'decor-08-02',x,340,130,170);
 sign(s,`FLOOR ${floor}`,1152,505,24);sign(s,'LIFT',1152,116,18);sign(s,floor<15?'UP ↑':'ROOFTOP',840,116,18);sign(s,'DOWN ↓',1464,116,18);
 s.spawn={x:1152,y:440};s.zones.push(zone('lobby','Lobby directory',1057,435,190,130,'elevator',{floor}));return s;
}
function apartment(residentId){
 const home=buildApartmentHome(residentId,{residents,shell,room,wall,addItem,rug,sign,light,windowAt,zone});if(home)return applyHomeMaterialSuite(home,residentId);
 const r=residents.find(r=>r.id===residentId),player=residentId==='player',wide=player||(r?.floor||0)>=7,w=wide?2304:1088,h=1120;
 const s=shell(`apartment-${residentId}`,player?'Your apartment · The Rooftop Studio':`${r?.name||'Resident'} · ${r?.theme||'Apartment'}`,w,h,r?.color||'#3c8190',r?.trim||'#c8aa77');s.kind='apartment';s.floor=player?15:r?.floor||2;s.resident=residentId;s.residentInfo=r||null;
 const left=wide?650:420,right=wide?w-750:668,mid=w/2;
 room(s,'Bathroom',36,112,left-52,330,'tile');room(s,'Kitchen & dining',36,496,left-52,h-532,'tile');room(s,'Bedroom',right,112,w-right-36,330);room(s,player?'Your studio':'Living & music',right,496,w-right-36,h-532);
 // Two privacy walls with generous door openings onto the entry hall.
 for(const x of [left,right-20]){wall(s,x,106,20,112);wall(s,x,370,20,236);wall(s,x,820,20,h-848);}
 wall(s,28,460,left-8,20);wall(s,right-20,460,w-right-8,20);
 if(wide){room(s,'Library & gallery',left+36,112,right-left-72,330);rug(s,left+66,160,right-left-132,248);}
 const kx=left/2+18,bx=right+(w-right)/2;
 addItem(s,'furniture-7-180',128,346,154,215);addItem(s,'furniture-6-180',left-92,265,84,129);addItem(s,'furniture-8-180',left-112,428,136,155);
 addItem(s,'furniture-2-180',w-205,414,250,330);if(!player)addItem(s,'decor-01-12',right+85,218,120,94);addItem(s,'decor-08-01',right+70,432,90,115,false);
 addItem(s,'furniture-3-180',player?345:wide?230:150,690,wide?300:218,210);addItem(s,'furniture-4-180',left-92,player?690:680,wide?124:108,180);addItem(s,'furniture-5-180',kx,996,230,215);
 rug(s,right+28,650,w-right-70,390);rug(s,mid-76,510,152,550,'#7b5159');
 // A calm circulation strip leads directly from the door to every room.
 if(!player){
  addItem(s,'furniture-1-180',wide?right+370:bx,990,wide?360:300,235);
  const instruments=r?.instruments||['decor-03-02'];
  if(wide){
   addItem(s,instruments[0],right+250,652,300,264);addItem(s,instruments[1],right+610,600,150,180);addItem(s,instruments[2],left+180,400,160,170);
   addItem(s,'decor-05-05',left+470,400,220,220);addItem(s,'decor-06-07',right+585,1010,150,154);
   addItem(s,'decor-08-09',right+90,1035,145,210);addItem(s,'decor-08-02',left+310,405,115,150);
  }else{
   addItem(s,instruments[0],bx,654,230,205);addItem(s,instruments[1],right+65,810,100,133);addItem(s,instruments[2],w-80,1025,90,130);
  }
  const ax=wide?mid:mid,ay=wide?750:650;s.actors.push({id:residentId,name:r?.name||residentId,x:ax,y:ay,facing:'down'});s.zones.push(zone('resident',`Talk to ${r?.name||'your neighbour'}`,ax-80,ay-70,160,180,'resident',{resident:residentId}));
 }else{
  // Starter essentials are fixed; the large studio is kept free for decor.
  addItem(s,'furniture-1-180',right+190,425,240,180);addItem(s,'decor-08-02',w-95,425,130,175);addItem(s,'decor-08-09',95,1060,145,210);
  s.zones.push(zone('decorate','Decorate your apartment',mid-190,715,380,300,'decorate'));
  sign(s,'YOUR ROOFTOP STUDIO',mid,690,26);
 }
 for(const x of wide?[220,mid,w-220]:[190,w-190])windowAt(s,x,20,155);
 if(player){
  s.title='Your apartment · Rooftop home';s.color='#a9b5a4';s.trim='#d9c49b';
  const oak={id:'rooftop-teak',pattern:'teak-planks',colors:['#9c7752','#c5a477','#604b37','#b68a57']},bath={id:'rooftop-hex',pattern:'bathroom-hex',colors:['#d7ded2','#f2edda','#a3b6ac','#7b9a92']};
  for(const r of s.rooms){r.functionalRole=/Bathroom/.test(r.name)?'bathroom':/Kitchen/.test(r.name)?'kitchen':/Bedroom/.test(r.name)?'bedroom':/studio/i.test(r.name)?'living':'study';r.floorFinish=r.functionalRole==='bathroom'?bath:oak;}
  s.privacyDoors=[{id:'rooftop-bath-door',roomId:'bathroom',axis:'vertical',x:left+10,y:218,length:152,open:true,color:'#96714c',trim:'#ddc5a0'},{id:'rooftop-bedroom-door',roomId:'bedroom',axis:'vertical',x:right-10,y:218,length:152,open:true,color:'#96714c',trim:'#ddc5a0'}];
  // Keep every existing furnishing rectangle clear, so saved decorations
  // remain valid. New essentials live in the fixed service/bedroom wings.
  addItem(s,'apartment-blue-fridge',130,690,120,210);
  addItem(s,'apartment-wardrobe',1660,218,110,158);
  const plush=addItem(s,'apartment-fox-plush',w-205,215,48,58,false);plush.depth=414.25;plush.furnitureRole='bed-decoration';
 }
 sign(s,player?'15A':r?.number||'',mid,98,22);sign(s,player?'Make room for your own rhythm.':r?.theme||'',mid,1074,22);
 s.zones.push(zone('hall','Return to the hall',mid-105,h-210,210,175,'exit',{floor:s.floor}));s.spawn={x:mid,y:h-145};
 light(s,bx,210,250);light(s,kx,650,250);light(s,mid,840,350);if(player)furnishPlayerHome(s);return applyHomeMaterialSuite(s,residentId);
}
function furnishPlayerHome(scene){
 const previous=new Set(scene.items.flatMap(item=>item.collisionBoxes));
 scene.solids=scene.solids.filter(box=>!previous.has(box));scene.items=[];scene.rugs=[];scene.collectionOwner='player';
 const studio=scene.rooms.find(r=>r.functionalRole==='living');if(studio)studio.functionalRole='personal-studio';
 scene.rooms.push({name:'Living & listening nook',functionalRole:'living',...rect(1254,706,280,384),material:'wood',floorFinish:studio?.floorFinish,point:{x:1300,y:900}});
 const put=(slot,role,x,y,w,extra={})=>{
  const a=getApartmentAsset('player',slot),item=addItem(scene,a.id,x,y,w,w*a.h/a.w,a.solid&&!extra.supportedBy,extra.rotation||0);
  return Object.assign(item,{collectionOwner:'player',slot,purpose:a.purpose,wallMounted:a.wallMounted,layer:a.layer,furnitureRole:role,...extra});
 };
 put('bath-fixture','bathtub',145,346,190);put('toilet','toilet',510,300,65);
 put('vanity','vanity',370,260,104);put('mirror','bathroom-mirror',370,102,65);
 put('linen-storage','bathroom-storage',510,422,72);
 put('fridge','fridge',130,690,120);put('sink','sink',330,690,150);
 put('stove','stove',462,690,109);put('counter','kitchen-storage',570,690,115);
 put('pantry','pantry',100,900,85);put('dining-table','dining-table',300,996,190);put('dining-chair','dining-chair',490,996,70);
 const bed=put('bed','bed',2099,414,240);put('wardrobe','wardrobe',1660,218,110);
 const night=put('nightstand','nightstand',1915,400,68);
 put('toy','personal-keepsake',night.x,341,35,{supportedBy:'nightstand',depth:night.y+.25});
 put('poster','personal-poster',1835,102,88);put('clock','wall-clock',1350,102,70);
 const sofaDef=getApartmentAsset('player','sofa'),sofaPose=furnitureAtGroundCenter(sofaDef,{w:190,h:190*sofaDef.h/sofaDef.w,rotation:180},{x:1400,y:1036.5});
 put('sofa','sofa',sofaPose.x,sofaPose.y,190,{rotation:180,designRole:'listening-sofa'});put('coffee-table','coffee-table',1400,950,100);
 const console=put('record-console','record-storage',1400,820,160);
 put('arcade','mini-arcade',1367,732,55,{supportedBy:'record-storage',depth:console.y+.25});
 put('lava-lamp','lava-lamp',1445,732,29,{supportedBy:'record-storage',depth:console.y+.3});
 const lampDef=getApartmentAsset('player','floor-lamp'),lampPose=furnitureAtGroundCenter(lampDef,{w:85,h:85*lampDef.h/lampDef.w,rotation:180},{x:1510,y:960});
 put('floor-lamp','reading-light',lampPose.x,lampPose.y,85,{rotation:180,designRole:'reading-task-light'});put('plant','home-plant',95,1060,115);
 light(scene,1450,900,150);
 put('rug','music-rug',1400,1080,260);
 scene.title='Your apartment · Comet Club';bed.roomId='bedroom';
}
function shop(floor=1){
 const storeFloor=floor===2?2:1,s=shell(storeFloor===1?'furniture-store':'furniture-store-floor-2',storeFloor===1?'Coda Furnishings · Main Lobby':'Coda Furnishings · Upper Gallery',STORE_FOOTPRINT.width,STORE_FOOTPRINT.height,'#665b58','#cda056');s.kind='shop';s.floor=storeFloor;
 applyShowroomLayout(s,{room,wall,addItem,rug,sign,light,zone,windowAt});return s;
}
function showroomApartment(showroomId){
 const display=SHOWROOMS.find(room=>room.id===showroomId),plan=display.apartment;
 const s=shell('showroom-'+display.id,display.name+' · Apartment',plan.width,plan.height,display.wallpaper.colors[0],display.wallpaper.colors[3]);
 s.kind='showroom';s.floor=display.storeFloor||1;s.showroomId=display.id;
 applyShowroomApartment(s,display,{room,wall,addItem,rug,sign,light,zone,windowAt});
 applyHomeMaterialSuite(s,'showroom-'+display.id);
 return s;
}
function warmScene(scene){
 if(!portalArtWarmed){portalArtWarmed=true;void warmInteriorPortalArt().catch(()=>{});}
 if(!nativeCatalog||warmedScene===scene&&warmedCatalog===nativeCatalog)return;
 warmedScene=scene;warmedCatalog=nativeCatalog;
 Promise.allSettled([preparePlacedFacingArt({objects:[...scene.items,...(scene.doors||[])]},nativeCatalog),warmHomeMaterials(scene.homeMaterialSuite),warmInteriorWindows(scene,nativeCatalog)]).finally(()=>discardBackground(scene)).catch(()=>{});
}
export function getInteriorBase(scene={}){
 if(scene.kind==='concert')return getConcertHall();
 const requestedKind=scene.kind||'lobby',floor=Math.max(1,Math.min(15,Math.round(Number(scene.floor)||1))),storeFloor=floor===2?2:1,kind=requestedKind==='hall'&&floor===1?'lobby':requestedKind==='showroom'&&!SHOWROOMS.some(room=>room.id===scene.showroomId)?'shop':requestedKind,resident=scene.resident||'player',id=kind==='apartment'?`apartment-${resident}`:kind==='hall'?`tower-floor-${floor}`:kind==='shop'?(storeFloor===1?'furniture-store':'furniture-store-floor-2'):kind==='showroom'?'showroom-'+scene.showroomId:'tower-lobby';
 if(!sceneCache.has(id)){const s=kind==='apartment'?apartment(resident):kind==='hall'?hall(floor):kind==='shop'?shop(storeFloor):kind==='showroom'?showroomApartment(scene.showroomId):lobby();
  calibratePrivateFurniture(s,nativeCatalog||collectionDefinitions);fitCompactKitchenFloor(s,nativeCatalog||collectionDefinitions);normalizeInteriorDoorways(s);applyTowerCommonArchitecture(s);
  // Floor lettering is retired; retain labels painted on the north wall and
  // the separate framed door, lift, directory and showroom-sign renderers.
  const wallDepth=s.towerArchitecture?.northWallDepth||106;s.signs=s.signs.filter(label=>label.y<=wallDepth);
  for(const d of s.privacyDoors||[]){const r=s.rooms.find(r=>r.id===d.roomId||r.functionalRole===d.roomId);if(r&&d.swing===undefined)d.swing=d.axis==='vertical'?(r.x+r.w/2>d.x?1:-1):(r.y+r.h/2>d.y?-1:1);}
  sceneCache.set(id,s);}return sceneCache.get(id);
}
export function getInterior(scene={}){
 const base=getInteriorBase(scene);
 if(typeof window==='undefined')return base;
 if(!roomLayouts){let storage;try{storage=window.localStorage;}catch{}roomLayouts=createRoomLayoutResolver({storage});}
 return roomLayouts.resolve(base,nativeCatalog);
}
function fill(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function floor(c,x,y,w,h,tile=false){
 c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
 if(!tile&&woodTexture){const p=c.createPattern(woodTexture,'repeat');c.fillStyle=p;c.fillRect(x,y,w,h);fill(c,x,y,w,h,'#493b3624');}
 else if(tile){const step=48;fill(c,x,y,w,h,'#526d63');for(let yy=y;yy<y+h;yy+=step)for(let xx=x;xx<x+w;xx+=step){const odd=(Math.floor((xx-x)/step)+Math.floor((yy-y)/step))%2;fill(c,xx+2,yy+2,step-4,step-4,odd?'#b1a18a':'#d1bea2');fill(c,xx+4,yy+4,step-8,2,'#f5e6c888');fill(c,xx+4,yy+step-7,step-8,2,'#614c3c33');}}
 else{fill(c,x,y,w,h,'#94754f');for(let yy=y;yy<y+h;yy+=32)for(let xx=x-(Math.floor(yy/32)%2)*90;xx<x+w;xx+=180){fill(c,xx+2,yy+2,176,28,(Math.floor(xx/180)+Math.floor(yy/32))%3?'#b08e60':'#94754f');fill(c,xx+6,yy+6,158,2,'#c8aa77');fill(c,xx+20,yy+20,72,2,'#614c3c44');}}
 c.restore();
}
function carpet(c,r){
 if(r.texture){drawHomeMaterialRug(c,r);return;}
 fill(c,r.x+8,r.y+10,r.w,r.h,'#302c3138');fill(c,r.x,r.y,r.w,r.h,'#493b36');fill(c,r.x+4,r.y+4,r.w-8,r.h-8,'#c8aa77');fill(c,r.x+10,r.y+10,r.w-20,r.h-20,r.color);fill(c,r.x+17,r.y+17,r.w-34,r.h-34,'#302c3128');
 for(let y=r.y+28;y<r.y+r.h-22;y+=32)for(let x=r.x+28;x<r.x+r.w-22;x+=32){fill(c,x,y,4,4,'#e0c69566');if(x<r.x+46||x>r.x+r.w-52||y<r.y+46||y>r.y+r.h-52){fill(c,x-5,y+5,14,3,'#c8aa77');fill(c,x,y-4,4,17,'#c8aa77');}}
}
function plasterWall(c,r,color,trim){
 fill(c,r.x+12,r.y+16,r.w,r.h,'#16232b32');fill(c,r.x,r.y,r.w,r.h,'#614c3c');fill(c,r.x+3,r.y+3,r.w-6,r.h-6,color);
 if(r.w>r.h){fill(c,r.x+3,r.y+4,r.w-6,7,trim);fill(c,r.x+3,r.y+r.h-12,r.w-6,4,'#302c3155');fill(c,r.x+3,r.y+r.h-5,r.w-6,4,trim);}else{fill(c,r.x+3,r.y+3,5,r.h-6,trim);fill(c,r.x+r.w-7,r.y+3,4,r.h-6,'#302c3155');}
}
function drawWindow(c,x,y,w,color){
 const h=74;fill(c,x-w/2-12,y-6,w+24,h+12,'#614c3c');fill(c,x-w/2-8,y-2,w+16,h+4,'#e0c695');fill(c,x-w/2,y+6,w,h-12,'#3b4a61');
 for(let i=0;i<4;i++){fill(c,x-w/2+6+i*w/4,y+12,w/4-10,h-24,['#8fbfc1','#61a0a7','#99a6b5','#72859b'][i]);fill(c,x-w/2+8+i*w/4,y+14,4,h-28,'#c1dcd066');}
 fill(c,x-w/2,y+32,w,5,'#e0c695');fill(c,x-w/2-8,y+68,w+16,12,'#94754f');fill(c,x-w/2-6,y+68,w+12,3,'#f5e6c8');
 for(const xx of [x-w/2-18,x+w/2+7]){fill(c,xx,y-4,14,82,color);fill(c,xx+3,y,3,74,'#e8d6b377');}
}
function stairs(c,s){
 fill(c,s.x-7,s.y-4,s.w+14,s.h+14,'#493b36');const count=8;
 for(let i=0;i<count;i++){const y=s.y+i*s.h/count;fill(c,s.x,y,s.w,s.h/count-2,['#b1a18a','#d1bea2','#b1a18a','#958578'][s.up?i%4:(7-i)%4]);fill(c,s.x+4,y+2,s.w-8,3,'#f5e6c8');fill(c,s.x+4,y+s.h/count-5,s.w-8,3,'#614c3c');}
 for(const x of [s.x-8,s.x+s.w+1]){fill(c,x,s.y-8,7,s.h+24,'#493b36');fill(c,x,s.y-8,3,s.h+24,'#cda056');}
}
function lobbyFrontage(c,r){
 if(r.facing==='left'||r.facing==='right'){
  const x=r.facing==='right'?r.x+r.w-28:r.x,trim=r.trim||'#c8aa77';
  plasterWall(c,rect(x,r.y,28,r.h),'#626461',trim);
  fill(c,x+(r.facing==='right'?28:-8),r.y,8,r.h,'#11192045');
  for(let y=r.y+14;y<r.y+r.h-14;y+=36){fill(c,x+4,y,20,2,'#e5dcc43b');fill(c,x+8,y+2,1,32,'#24303935');}return;
 }
 const h=Math.min(r.h,r.facadeHeight||190),y=r.facing==='up'?r.y:r.y+r.h-h,trim=r.trim||'#c8aa77';
 plasterWall(c,rect(r.x,y,r.w,h),'#626461',trim);
 // The hidden apartments are black void. Only their lobby-facing stonework
 // and doors are shown, like the cutaway walls around a normal interior.
 for(let yy=y+15,row=0;yy<y+h-35;yy+=28,row++)for(let x=r.x+8-(row%2)*42;x<r.x+r.w-8;x+=84){
  const left=Math.max(r.x+6,x),right=Math.min(r.x+r.w-6,x+80);if(right<=left)continue;
  fill(c,left,yy,right-left,1,'#e5dcc42b');fill(c,left,yy+1,1,24,'#e5dcc41f');fill(c,left,yy+25,right-left,1,'#242f3430');
 }
 fill(c,r.x+4,y+h-35,r.w-8,4,trim);fill(c,r.x+4,y+h-30,r.w-8,23,'#465151');
 for(let x=r.x+12;x<r.x+r.w-30;x+=48){fill(c,x,y+h-25,35,1,'#e5dcc43b');fill(c,x,y+h-25,1,14,'#e5dcc43b');}
 if(r.facing==='up')fill(c,r.x,y-10,r.w,10,'#11192045');
}
function background(s){
 const cached=backgroundCache.get(s);if(cached){backgroundCache.delete(s);backgroundCache.set(s,cached);return cached;}const cv=document.createElement('canvas');cv.width=s.width;cv.height=s.height;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;
 const lobby=s.kind==='shop'&&Array.isArray(s.lobbyFloorRects);
 const towerCommon=drawTowerCommonSurfaces(c,s);
 if(towerCommon&&!towerCommonMaterialsReady())void warmTowerCommonMaterials().then(()=>discardBackground(s)).catch(()=>{});
 if(!towerCommon){if(lobby){fill(c,0,0,s.width,s.height,'#10171d');for(const r of s.lobbyFloorRects)floor(c,r.x,r.y,r.w,r.h);}
 else if(s.homeMaterialSuite)drawShowroomFloor(c,{x:0,y:0,w:s.width,h:s.height,floorFinish:s.homeMaterialSuite.floor});else floor(c,0,0,s.width,s.height);}
 for(const r of s.rooms){if(r.portalRoom)continue;if(r.floorFinish)drawShowroomFloor(c,r);else if(r.material==='tile')floor(c,r.x,r.y,r.w,r.h,true);}if(!towerCommon)for(const r of s.rugs)carpet(c,r);
 for(const item of s.items)if(floorItem(item))drawItem(c,item);
 // Full-height north facade, low cutaway south and side edges.
 if(!lobby&&!towerCommon){plasterWall(c,rect(0,0,s.width,106),s.color,s.trim);plasterWall(c,rect(0,0,28,s.height),s.color,s.trim);plasterWall(c,rect(s.width-28,0,28,s.height),s.color,s.trim);plasterWall(c,rect(0,s.height-28,s.width,28),s.color,s.trim);}
 else if(lobby&&(s.sideFacingShowrooms||s.southFacingShowrooms)){
  const main=s.lobbyFloorRects[0],entry=s.lobbyFloorRects[1];
  plasterWall(c,rect(entry.x-20,entry.y,20,entry.h),s.color,s.trim);plasterWall(c,rect(entry.x+entry.w,entry.y,20,entry.h),s.color,s.trim);
  for(const x of [entry.x,entry.x+entry.w-120])plasterWall(c,rect(x,s.height-28,120,28),s.color,s.trim);
  fill(c,main.x,entry.y-6,main.w,6,'#c8aa7755');
 }else if(lobby){
  const main=s.lobbyFloorRects[0],entry=s.lobbyFloorRects[1];
  plasterWall(c,rect(main.x-20,main.y,20,main.h),s.color,s.trim);plasterWall(c,rect(main.x+main.w,main.y,20,main.h),s.color,s.trim);
  for(const x of [entry.x-20,entry.x+entry.w])plasterWall(c,rect(x,entry.y,20,entry.h),s.color,s.trim);
  for(const x of [entry.x,entry.x+entry.w-120])plasterWall(c,rect(x,s.height-28,120,28),s.color,s.trim);
  fill(c,s.width/2-80,s.height-28,160,8,'#c8aa77');fill(c,s.width/2-80,s.height-20,160,12,'#614c3c');
 }
 // Wainscoting and fine masonry add depth without changing collision.
 if(!lobby&&!towerCommon)for(let x=48;x<s.width-40;x+=62){fill(c,x,14,50,2,'#f5e6c833');fill(c,x,91,50,3,'#302c3144');fill(c,x+1,72,2,19,'#e0c69566');}
 if(s.kind!=='apartment'&&s.kind!=='showroom')for(const r of s.walls){if(lobby&&(r.portalRoom||r.receptionFront))lobbyFrontage(c,r);else plasterWall(c,r,r.color||s.color,r.trim||s.trim);}
 for(const r of s.rooms)if(r.wallpaper&&!r.portalRoom)drawShowroomWallpaper(c,r);
 drawInteriorWallNetwork(c,s);
 for(const w of s.windows)if(!drawInteriorWindow(c,w,{catalog:nativeCatalog,scene:s}))drawWindow(c,w.x,w.y,w.w,s.color);
 for(const st of s.stairs||[])if(!drawTowerCommonStairs(c,st,s))stairs(c,st);
 for(const item of s.items)if(wallItem(item))drawItem(c,item);
 if(s.directory){const r=s.directory;fill(c,r.x-10,r.y-8,r.w+20,r.h+16,'#614c3c');fill(c,r.x-4,r.y-2,r.w+8,r.h+4,'#cda056');fill(c,r.x+4,r.y+6,r.w-8,r.h-12,'#293246');c.textAlign='center';c.font='bold 15px Georgia';c.fillStyle='#e0c695';c.fillText('DIRECTORY',r.x+r.w/2,r.y+30);c.font='11px Georgia';for(let f=2;f<=15;f++){const names=f===15?'Your studio':residents.filter(n=>n.floor===f).map(n=>n.name.split(' ')[0]).join(' · ');c.fillStyle='#d1bea2';c.fillText(`${String(f).padStart(2,'0')}  ${names}`,r.x+r.w/2,r.y+34+f*14);}}
 for(const t of s.signs){c.textAlign='center';c.font=`${t.size>25?'bold ':''}${t.size}px Georgia`;c.fillStyle='#302c3155';c.fillText(t.text,t.x+2,t.y+2);c.fillStyle=t.size>25?'#ebc679':'#c8aa77';c.fillText(t.text,t.x,t.y);}
 // Warm pools from wall sconces sit underneath characters and furnishings.
 for(const l of s.lights){const radius=l.r*1.55,glow=c.createRadialGradient(l.x,l.y,0,l.x,l.y,radius);glow.addColorStop(0,'#ffe1a018');glow.addColorStop(.45,'#ffe1a008');glow.addColorStop(1,'#ffe1a000');c.fillStyle=glow;c.fillRect(l.x-radius,l.y-radius,radius*2,radius*2);}
 rememberBackground(s,cv);return cv;
}
function floorItem(item){return item.layer==='ground'||item.furnitureRole==='rug'||nativeCatalog?.get(item.asset)?.layer==='ground';}
function wallItem(item){return !!(item.wallMounted||nativeCatalog?.get(item.asset)?.wallMounted);}
function drawItem(c,item,time=0){
 const a=nativeCatalog?.get(item.asset);if(!a)return;const scale=Number.isFinite(item.scale)&&item.scale>0?item.scale:1,w=item.w||a.w*scale,h=item.h||w*a.h/a.w;
 const placed={...item,w,h},facing=furnitureFacingPlacement(a,placed);
 c.save();drawFurnitureContactShadow(c,a,item,facing);c.imageSmoothingEnabled=false;
 if(facing){const graded=Object.create(a);Object.defineProperty(graded,'canvas',{value:facing.image});c.drawImage(assetImage(graded),facing.x,facing.y,facing.w,facing.h);drawApartmentMotion(c,facing.view,{x:facing.x+facing.w/2,y:facing.y+facing.h,w:facing.w,h:facing.h},time);}
 else{c.translate(item.x,item.y);c.rotate((item.rotation||0)*Math.PI/180);c.drawImage(assetImage(a),-w/2,-h,w,h);drawApartmentMotion(c,a,{x:0,y:0,w,h},time);}
 c.restore();
}
function itemDepth(item){const a=nativeCatalog?.get(item.asset);return item.depth??(a?furnitureFacingDepth(a,item,item.y):item.y);}
export function residentInteractionZones(actors=[]){
 return actors.filter(a=>!a.hidden&&Number.isFinite(a.x)&&Number.isFinite(a.y)).map(a=>zone(`resident-${a.id}`,`Talk to ${a.name||residents.find(r=>r.id===a.id)?.name||'your neighbour'}`,a.x-72,a.y-64,144,144,'resident',{resident:a.id}));
}
function drawInteriorCharacter(c,scene,actor,draw){
 const scale=interiorActorScale(scene);
 if(scale===1){draw(c,actor);return;}
 // The furnished maps use their own drawing units. Keep the character's feet
 // on the saved world point while matching the furniture's human scale.
 c.save();c.translate(actor.x,actor.y);c.scale(scale,scale);
 try{draw(c,{...actor,x:0,y:0});}finally{c.restore();}
}
export function renderInterior(c,scene,{model,player,drawPlayer,time=0,decor=[],catalog,actors,performance,audioTime,reducedMotion=false,viewport,doorStates=[],doorOpenness=()=>0}={}){
 if(catalog&&catalog!==nativeCatalog)configureUrbanInteriors(catalog);const s=model||getInterior(scene);
 if(scene.kind==='concert'){
  renderConcertHallBackground(c,s);
  if(!npcRenderer&&typeof window!=='undefined'&&window.createCodaCharacterRenderer)npcRenderer=window.createCodaCharacterRenderer({worldScale:2.5});
  const extraDrawables=concertHallDrawables(c,s,{viewport});
  for(const actor of actors||[]){if(actor.hidden)continue;const bounds={x:actor.x-60,y:actor.y-170,w:120,h:190};if(viewport&&(bounds.x+bounds.w<viewport.x||bounds.x>viewport.x+viewport.w||bounds.y+bounds.h<viewport.y||bounds.y>viewport.y+viewport.h))continue;extraDrawables.push({y:actor.y,bounds,draw:()=>npcRenderer?.drawNPC(c,actor,time)});}
  if(player&&drawPlayer)extraDrawables.push({y:player.y,draw:()=>drawPlayer(c,player)});
  if(performance)renderStagePerformance(c,performance,{time,audioTime,catalog:nativeCatalog,drawNPC:drawConcertNPC,reducedMotion,extraDrawables,viewport});
  else for(const item of extraDrawables)item.draw();
  return;
 }
 warmScene(s);c.drawImage(background(s),0,0);
 const queue=s.items.filter(item=>!floorItem(item)&&!wallItem(item)).map(item=>({y:itemDepth(item),draw:()=>drawItem(c,item,time)}));
 if(s.elevator)queue.push({y:getElevatorVisualGeometry(s.elevator).floorY,draw:()=>drawElevatorPortal(c,s.elevator,{floors:s.kind==='shop'?2:15})});
 for(const sign of s.showroomSigns||[])queue.push({y:sign.y,draw:()=>drawShowroomThemeSign(c,sign,nativeCatalog)});
 for(const d of s.doors||[])queue.push({y:d.threshold?.y??d.floorY??d.y+d.h,draw:()=>drawInteriorDoor(c,d,doorOpenness(d),{theme:s.collectionOwner||s.showroomId})});
 for(const d of s.privacyDoors||[])queue.push({y:interiorPortalVisualDepth(d,doorOpenness(d)),draw:()=>drawPrivacyDoor(c,d,doorOpenness(d))});
 for(const state of doorStates){const d=state.door;if(!d.virtual||!d.threshold)continue;const at=d.threshold,normal=d.enterNormal||{x:0,y:1},length=(d.triggerHalfWidth||70)*2;
  const visual={...d,axis:normal.x?'vertical':'horizontal',x:at.x-(normal.x?0:length/2),y:at.y-(normal.x?length/2:0),length,color:s.color,trim:s.trim};
  queue.push({y:interiorPortalVisualDepth(visual,state.openness),draw:()=>drawPrivacyDoor(c,visual,state.openness)});
 }
 for(const saved of decor){const item=presentedRoomItem(saved,s,nativeCatalog);if(!item||!nativeCatalog?.has(item.asset)||!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;if(floorItem(item)||wallItem(item))drawItem(c,item,time);else queue.push({y:itemDepth(item),draw:()=>drawItem(c,item,time)});}
 const people=Array.isArray(actors)?actors:s.actors;
 if(people.length&&!npcRenderer&&typeof window!=='undefined'&&window.createCodaCharacterRenderer)npcRenderer=window.createCodaCharacterRenderer({worldScale:2.5});
 for(const a of people)if(!a.hidden)queue.push({y:a.y,draw:()=>drawInteriorCharacter(c,s,a,(ctx,actor)=>npcRenderer?.drawNPC(ctx,actor,time))});
 if(player&&drawPlayer)queue.push({y:player.y,draw:()=>drawInteriorCharacter(c,s,player,drawPlayer)});queue.sort((a,b)=>a.y-b.y);for(const o of queue)o.draw();
}
