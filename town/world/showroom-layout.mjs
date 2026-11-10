import {createShowroomApartmentPlan} from './showroom-apartments.mjs?v=opera-concert-1';

// Eight private apartment showrooms occupy the same cells in the store's
// exact floor plate. The lobby shows their closed doors, then opening one
// reveals its complete interior in an independent scene at the same scale.
export const STORE_TRAFFIC=Object.freeze({incomingX:1478,outgoingX:1594,ingressY:992,egressY:1056,crossY:1024,spawn:Object.freeze({x:1536,y:1840})});

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
  id:'coastal-bedroom',name:'Coastal Retreat',style:'Washed timber, blue linen and woven storage',
  floor:finish('driftwood-planks','Whitewashed driftwood','whitewashed-planks',['#a7b8b3','#d8ddd2','#728d94','#bfc1ac']),
  wallpaper:finish('sea-glass-stripes','Sea-glass stripe wallpaper','coastal-stripe',['#b3cacc','#dce2d3','#5c8f9b','#d2bc8a']),rug:'#839fa5'
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
  id:'midcentury-studio',name:'Midcentury Apartment',style:'Honey oak, geometric paper and electric sessions',
  floor:finish('honey-oak-parquet','Honey-oak parquet','parquet',['#9b6f43','#c89e63','#573d31','#e1b875']),
  wallpaper:finish('ochre-geometric','Ochre geometric wallpaper','geometric',['#bc884f','#e1c587','#6e6650','#e6d4ac']),rug:'#776c54'
 },
 {
  id:'french-cafe',name:'Parisian Apartment',style:'Bistro checks, painted lattice and acoustic afternoons',
  floor:finish('bistro-checkerboard','Bistro checkerboard','checkerboard',['#d8cfb4','#ede5c6','#566269','#ac8b6a','#8c8374']),
  wallpaper:finish('sage-cafe-lattice','Sage café lattice','cafe-lattice',['#a5a98a','#d6d2ac','#586957','#b48168']),rug:'#9d6e5d'
 },
 {
  id:'industrial-loft',name:'Industrial Loft',style:'Exposed brick, concrete and a late-night rehearsal',
  floor:finish('polished-concrete','Polished concrete slabs','concrete',['#727b7c','#a5a9a1','#4e5c62','#ad805c','#657073']),
  wallpaper:finish('warehouse-brick','Exposed warehouse brick','exposed-brick',['#8b5c4a','#b78063','#4b4943','#c6b59a']),rug:'#655b54'
 }
];

export const SHOWROOMS=deepFreeze(definitions.map((definition,index)=>{
 const column=index%4,row=Math.floor(index/4),x=[64,712,1736,2384][column],y=row?1344:0,w=624,h=704,center=x+w/2;
 const doorway={x:center,y:row?y:y+h},entry={x:center,y:STORE_TRAFFIC.crossY};
 const lobbyApproach={x:center,y:row?y-28:y+h+28},apartment=createShowroomApartmentPlan(definition);
 const productIds=[...new Set(apartment.items.map(item=>item.productId).filter(Boolean))];
 return {...definition,items:apartment.items,index,row,column,x,y,w,h,showroomId:definition.id,floorFinish:definition.floor,doorway,entry,
  lobbyApproach,lobbyReturn:{...lobbyApproach},apartment,productIds,
  visitRoute:[entry,lobbyApproach],exitRoute:[lobbyApproach,entry]
 };
}));

export function applyShowroomLayout(scene,{room,wall,addItem,rug,sign,light,zone,windowAt}){
 scene.showrooms=SHOWROOMS;scene.storeTraffic=STORE_TRAFFIC;
 scene.lobbyFloorRects=[{x:28,y:704,w:3016,h:640},{x:1336,y:1344,w:400,h:676}];
 for(const display of SHOWROOMS){
  const {x,y,w,h}=display,mid=x+w/2;
  room(scene,display.name,x,y,w,h,display.floor.id);
  Object.assign(scene.rooms.at(-1),{id:display.id,showroomId:display.id,style:display.style,floorFinish:display.floor,wallpaper:display.wallpaper,productIds:display.productIds,portalRoom:true,entry:display.entry,lobbyApproach:display.lobbyApproach,lobbyReturn:display.lobbyReturn});
  // Solid facade masks prevent seeing or walking into a neighbouring scene.
  wall(scene,x,y,w,h);Object.assign(scene.walls.at(-1),{showroomId:display.id,portalRoom:true,facing:display.row?'up':'down',facadeHeight:190,wallpaper:display.wallpaper,color:display.wallpaper.colors[0],trim:display.wallpaper.colors[3]||display.wallpaper.colors[1]});
  const doorAsset=['decor-16-01','decor-16-02','decor-16-03','decor-16-01','decor-16-03','decor-16-02','decor-16-01','decor-16-02'][display.index];
  scene.doors??=[];scene.doors.push({showroomId:display.id,asset:doorAsset,x:mid,y:display.row?y:y+h-190,w:156,h:190,floorY:display.doorway.y,number:String(display.index+1).padStart(2,'0'),color:display.wallpaper.colors[0],facing:display.row?'up':'down'});
  const labelY=display.row?y-24:y+h+35;
  sign(scene,display.name,mid,labelY,24);light(scene,mid,display.lobbyApproach.y,170);
  scene.zones.push(zone('showroom-'+display.id,'Enter '+display.name+' apartment',display.lobbyApproach.x-70,display.lobbyApproach.y-25,140,50,'showroom',{showroomId:display.id}));
 }
 // The reception cap closes the unused north stem. Its 94px front is visible
 // from the main lobby, while the upper floor area remains an opaque mask.
 wall(scene,1336,0,400,704);Object.assign(scene.walls.at(-1),{portalRoom:true,receptionFront:true,facing:'down',facadeHeight:94,color:'#4f6666',trim:'#cda056'});
 // Reception and seating sit outside the two cross-hall walking lanes and
 // all eight room approaches. The original street door stays fixed.
 scene.title='Coda Furnishings · Main Lobby';scene.spawn={...STORE_TRAFFIC.spawn};
 const counter=addItem(scene,'decor-05-05',1536,900,278,182);
 counter.fixture='checkout';scene.checkout={x:1536,y:900};
 scene.zones.push(zone('counter','Shop all eight collections',1396,916,280,64,'shop'));
 scene.zones.push(zone('street','Return to Coda Town',1376,1810,320,190,'exit'));
 sign(scene,'CODA FURNISHINGS',1536,656,25);sign(scene,'Eight apartments · step inside a new style',1536,686,14);
 for(const x of [670,2360]){const bench=addItem(scene,'decor-06-01',x,1210,220,140);bench.fixture='lobby-seating';}
 for(const x of [845,2530]){const plant=addItem(scene,'decor-08-09',x,1220,80,110);plant.fixture='lobby-plant';}
 rug(scene,470,1110,480,165,'#6e6559');rug(scene,2160,1110,480,165,'#6e6559');rug(scene,1436,1380,200,570,'#675956');
 light(scene,1536,1840,330);light(scene,1536,916,280);light(scene,670,1210,220);light(scene,2360,1210,220);
 return scene;
}
