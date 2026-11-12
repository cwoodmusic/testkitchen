import {createShowroomApartmentPlan} from './showroom-apartments.mjs?v=room-defaults-curtain-1';
import {createShowroomThemeSign,showroomThemeSignZone} from './showroom-signs.mjs?v=room-defaults-curtain-1';

// The original eight homes retain their ground-floor addresses. Four larger
// homes occupy a second storey inside the same exterior floor plate.
export const STORE_TRAFFIC=Object.freeze({incomingX:1478,outgoingX:1594,ingressY:992,egressY:1056,crossY:1024,spawn:Object.freeze({x:1536,y:1840})});
export const STORE_FLOOR_COUNT=2;
export const STORE_VERTICAL_CORE=Object.freeze({
 elevator:Object.freeze({x:1424,y:128,w:224,h:180}),stairs:Object.freeze({x:1660,y:128,w:144,h:180}),
 arrival:Object.freeze({x:1536,y:380}),stairsArrival:Object.freeze({x:1732,y:380}),
 incomingX:1260,outgoingX:1812,travelY:420
});

const finish=(id,label,pattern,colors)=>({id,name:label,label,pattern,colors});
const deepFreeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const part of Object.values(value))deepFreeze(part);Object.freeze(value);}return value;};
const definitions=[
 {
  id:'victorian-parlor',name:'Victorian Suite',style:'Carved walnut, velvet and chamber music',
  floor:finish('walnut-herringbone','Walnut herringbone','herringbone',['#6b4737','#a47a55','#392d29','#c5a36c']),
  wallpaper:finish('burgundy-damask','Burgundy damask','damask',['#6b384b','#a76b75','#3e2536','#d4b575']),rug:'#744452'
 },
 {
  id:'art-deco-lounge',name:'Art Deco Apartment',style:'Peacock blue, brass and the sound of vinyl',
  floor:finish('ivory-diamond-marble','Ivory and teal marble','diamond-marble',['#d0c1a8','#efe0c1','#263b42','#bc935d','#7b6c58']),
  wallpaper:finish('peacock-deco-fan','Peacock fan wallpaper','deco-fan',['#173c47','#316477','#10242c','#d2b271']),rug:'#2d606a'
 },
 {
  id:'coastal-bedroom',name:'Coastal Retreat',style:'Sea-glass linen, an axolotl friend and a sunny breakfast nook',
  floor:finish('driftwood-planks','Whitewashed driftwood','whitewashed-planks',['#a7b8b3','#d8ddd2','#728d94','#bfc1ac']),
  wallpaper:finish('sea-glass-stars','Sea-glass tiny-star wallpaper','tiny-stars',['#d5e2df','#eef0df','#7ba6ad','#c7b684']),rug:'#839fa5'
 },
 {
  id:'rustic-kitchen',name:'Rustic Cottage',style:'Terracotta, cottage florals and a family table',
  floor:finish('warm-terracotta','Hand-fired terracotta','terracotta',['#a85d43','#ce8c60','#693f34','#d3b47a','#846c58']),
  wallpaper:finish('sage-cottage-toile','Sage cottage toile','toile',['#ede0bc','#b6ba98','#6c7d60','#a5734f']),rug:'#a88956'
 },
 {
  id:'botanical-conservatory',name:'Botanical Apartment',style:'Slate, leafy walls and a sunny garden seat',
  floor:finish('garden-slate-mosaic','Garden slate mosaic','slate-mosaic',['#70877c','#a3b3a0','#385851','#b1a676','#435e55']),
  wallpaper:finish('fern-frond-wallpaper','Fern-frond wallpaper','botanical-leaf',['#34564e','#6e9273','#1e3d38','#d3c18a']),rug:'#779263'
 },
 {
  id:'midcentury-studio',name:'Midcentury Apartment',style:'Low teak, tapered legs, olive upholstery and a starburst clock',
  floor:finish('warm-teak-planks','Warm teak planks','teak-planks',['#a87342','#d8a46a','#65442d','#bb8750','#513b2e']),
  wallpaper:finish('cream-atomic','Cream, teal and olive atomic wallpaper','midcentury-atomic',['#eee1be','#fff1d1','#687a63','#c69848','#568b8b']),rug:'#776c54'
 },
 {
  id:'french-cafe',name:'Parisian Apartment',style:'Bistro checks, painted lattice and acoustic afternoons',
  floor:finish('bistro-checkerboard','Bistro checkerboard','checkerboard',['#d8cfb4','#ede5c6','#566269','#ac8b6a','#8c8374']),
  wallpaper:finish('sage-cafe-lattice','Sage café lattice','cafe-lattice',['#a5a98a','#d6d2ac','#586957','#b48168']),rug:'#9d6e5d'
 },
 {
  id:'industrial-loft',name:'Industrial Loft',style:'Concrete, music confetti and a cozy record-listening corner',
  floor:finish('polished-concrete','Polished concrete slabs','concrete',['#727b7c','#a5a9a1','#4e5c62','#ad805c','#657073']),
  wallpaper:finish('music-confetti','Cream music-confetti wallpaper','music-confetti',['#e3ddd0','#f6efda','#667d81','#c38b69']),rug:'#655b54'
 },
 {
  id:'retrofuture',name:'Retrofuture Spaceport',style:'Cream capsules, orange vinyl and a playful listening lounge',
  floor:finish('spaceport-terrazzo','Warm spaceport terrazzo','spaceport-terrazzo',['#d8d2bd','#f4edd7','#8d998e','#d77847','#6a9b9a']),
  wallpaper:finish('orbital-paper','Cream orbital wallpaper','orbital',['#eee7cf','#fff5df','#6c9293','#d77745']),rug:'#bc8058'
 },
 {
  id:'cyberpunk',name:'Cyberpunk Neon Loft',style:'Quiet midnight surfaces, plum seating and restrained neon accents',
  floor:finish('neon-inset-panels','Graphite inset panels','neon-panels',['#46535e','#72838a','#28333e','#629b9d','#8d6087']),
  wallpaper:finish('circuit-paper','Midnight circuit wallpaper','circuit',['#364654','#526579','#25323d','#70adb1','#ae719f']),rug:'#66556e'
 },
 {
  id:'steampunk',name:'Steampunk Clockwork Home',style:'Mahogany, green velvet and a warm brass music corner',
  floor:finish('clockwork-parquet','Mahogany parquet','clockwork-parquet',['#79503a','#ac8154','#49372e','#b18d5a','#55452e']),
  wallpaper:finish('clockwork-paper','Sage clockwork wallpaper','clockwork',['#b9b99a','#ddd2b3','#61735f','#a18450']),rug:'#6e7659'
 },
 {
  id:'robot',name:'Robot Companion Home',style:'Powder blue, soft yellow and friendly rounded details',
  floor:finish('companion-cork','Warm companion cork','companion-cork',['#bdab87','#e2cf9f','#8c836d','#ccbd99','#a2b6b5']),
  wallpaper:finish('companion-paper','Friendly companion wallpaper','companion',['#e5e7d6','#fff5d9','#8ca9b0','#d8bc69']),rug:'#a7b9ae'
 }
];

export const SHOWROOM_UNIT_FOOTPRINT=Object.freeze({width:1184,height:448});
export const UPPER_SHOWROOM_UNIT_FOOTPRINT=Object.freeze({width:1184,height:832});
export const SHOWROOMS=deepFreeze(definitions.map((definition,index)=>{
 const storeFloor=index<8?1:2,localIndex=index<8?index:index-8,column=localIndex%2,row=Math.floor(localIndex/2),x=column?1856:32,y=row*(storeFloor===1?480:960),w=1184,h=storeFloor===1?448:832;
 const threshold={x:column?x:x+w,y:y+h/2},enterNormal={x:column?1:-1,y:0},facing=column?'left':'right';
 const lobbyApproach={x:threshold.x-enterNormal.x*28,y:threshold.y},entry={x:lobbyApproach.x,y:storeFloor===1?STORE_TRAFFIC.crossY:STORE_VERTICAL_CORE.travelY};
 const apartment=createShowroomApartmentPlan({...definition,index,column,width:w,height:h,storeFloor});
 const productIds=[...new Set(apartment.items.map(item=>item.productId).filter(Boolean))];
 return {...definition,items:apartment.items,index,row,column,x,y,w,h,storeFloor,showroomId:definition.id,floorFinish:definition.floor,doorway:threshold,threshold,enterNormal,facing,triggerHalfWidth:64,entry,
  lobbyApproach,lobbyReturn:{...lobbyApproach},apartment,productIds,visitRoute:[entry,lobbyApproach],exitRoute:[lobbyApproach,entry]};
}));
export const getStoreFloorShowrooms=(floor=1)=>SHOWROOMS.filter(display=>display.storeFloor===floor);

export function applyShowroomLayout(scene,{room,wall,addItem,rug,sign,light,zone,windowAt}){
 const storeFloor=scene.floor===2?2:1,showrooms=getStoreFloorShowrooms(storeFloor);
 scene.showrooms=showrooms;scene.allShowrooms=SHOWROOMS;scene.storeTraffic=STORE_TRAFFIC;scene.storeFloor=storeFloor;scene.showroomSigns=[];
 const frontageBottom=storeFloor===1?1888:1792;
 scene.lobbyFloorRects=[{x:1216,y:0,w:640,h:frontageBottom},{x:28,y:frontageBottom,w:3016,h:2020-frontageBottom}];scene.sideFacingShowrooms=true;
 if(storeFloor===2)for(const x of [28,1856])scene.lobbyFloorRects.push({x,y:832,w:1188,h:128});
 for(const display of showrooms){
  const {x,y,w,h,threshold,enterNormal,facing}=display,doorId='showroom-'+display.id;
  room(scene,display.name,x,y,w,h,display.floor.id);
  Object.assign(scene.rooms.at(-1),{id:display.id,showroomId:display.id,style:display.style,floorFinish:display.floor,wallpaper:display.wallpaper,productIds:display.productIds,portalRoom:true,entry:display.entry,lobbyApproach:display.lobbyApproach,lobbyReturn:display.lobbyReturn});
  wall(scene,x,y,w,h);Object.assign(scene.walls.at(-1),{showroomId:display.id,portalRoom:true,facing,facadeHeight:190,wallpaper:display.wallpaper,color:display.wallpaper.colors[0],trim:display.wallpaper.colors[3]||display.wallpaper.colors[1]});
  const doorAsset=['decor-16-01','decor-16-02','decor-16-03','decor-16-01','decor-16-03','decor-16-02','decor-16-01','decor-16-02'][display.index];
  scene.doors??=[];scene.doors.push({id:doorId,showroomId:display.id,storeFloor,asset:doorAsset||'decor-16-02',x:threshold.x,y:threshold.y-95,w:156,h:190,floorY:threshold.y,threshold:{...threshold},enterNormal:{...enterNormal},triggerHalfWidth:64,number:String(display.index+1).padStart(2,'0'),color:display.wallpaper.colors[0],facing});
  const themeSign=createShowroomThemeSign(display);scene.showroomSigns.push(themeSign);scene.solids.push(themeSign.base);light(scene,display.lobbyApproach.x,threshold.y,150);
  scene.zones.push(zone(doorId,'Enter '+display.name+' apartment',display.lobbyApproach.x-24,display.lobbyApproach.y-64,48,128,'showroom',{doorId,showroomId:display.id,storeFloor,threshold:{...threshold},enterNormal:{...enterNormal},triggerHalfWidth:64}),showroomThemeSignZone(themeSign));
 }
 wall(scene,1216,0,640,106);Object.assign(scene.walls.at(-1),{receptionFront:true,facing:'down',color:'#4f6666',trim:'#cda056'});
 scene.title=storeFloor===1?'Coda Furnishings · Main Lobby':'Coda Furnishings · Upper Gallery';scene.spawn=storeFloor===1?{...STORE_TRAFFIC.spawn}:{...STORE_VERTICAL_CORE.arrival};
 scene.elevator={...STORE_VERTICAL_CORE.elevator,floor:storeFloor};scene.stairs=[{...STORE_VERTICAL_CORE.stairs,up:storeFloor===1}];
 scene.zones.push(zone('store-lift','Lift · choose store floor',1432,334,208,100,'store-elevator',{storeFloor}),zone('store-stairs',storeFloor===1?'Stairs to upper gallery':'Stairs to main lobby',1664,334,136,100,'store-floor',{targetFloor:storeFloor===1?2:1,arrival:'stairs'}));
 sign(scene,'LIFT',1536,118,18);sign(scene,storeFloor===1?'UP ↑':'DOWN ↓',1732,118,18);
 if(storeFloor===1){
  const counter=addItem(scene,'decor-05-05',1536,730,278,182);counter.fixture='checkout';scene.checkout={x:1536,y:730};
  scene.zones.push(zone('counter','Shop all twelve collections',1396,746,280,64,'shop'),zone('street','Return to Coda Town',1376,1810,320,190,'exit'));
 }else scene.zones.push(zone('upper-directory','Shop all twelve collections',1400,646,272,80,'shop'));
 sign(scene,'CODA FURNISHINGS',1536,474,24);sign(scene,storeFloor===1?'8 homes · 4 more upstairs':'UPPER GALLERY · 4 larger homes',1536,506,14);
 const bench=addItem(scene,'decor-06-01',1536,560,220,140);bench.fixture='lobby-seating';
 for(const x of [1350,1722]){const plant=addItem(scene,'decor-08-09',x,570,72,100);plant.fixture='lobby-plant';}
 rug(scene,1248,444,576,176,'#6e6559');rug(scene,1248,1500,576,480,'#675956');light(scene,1536,1840,330);light(scene,1536,240,280);return scene;
}
