// The eight sample rooms fit the existing store's exact 3072 × 2048 floor
// plate. Their doors open onto a common cross hall; no room is a shortcut
// through another display. Coordinates use the same bottom-center anchors
// and world scale as furniture in apartments and the town builder.
export const STORE_TRAFFIC=Object.freeze({incomingX:1478,outgoingX:1594,ingressY:932,egressY:996,crossY:964,spawn:Object.freeze({x:1536,y:1840})});

const finish=(id,label,pattern,colors)=>({id,name:label,label,pattern,colors});
const furniture=(product,asset,x,y,w,h,solid=true)=>({productId:'furniture-'+product,asset,x,y,w,h,solid});
const deepFreeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const part of Object.values(value))deepFreeze(part);Object.freeze(value);}return value;};
const definitions=[
 {
  id:'victorian-parlor',name:'Victorian Parlor',style:'Carved walnut, velvet and chamber music',
  floor:finish('walnut-herringbone','Walnut herringbone','herringbone',['#6b4737','#a47a55','#392d29','#c5a36c']),
  wallpaper:finish('burgundy-damask','Burgundy damask','damask',['#6b384b','#a76b75','#3e2536','#d4b575']),rug:'#744452',
  items:[
   furniture('sofa','furniture-1-180',153,430,226,164),
   furniture('piano','furniture-0-180',464,474,222,232),
   furniture('chess-table','decor-06-07',312,274,132,132),
   furniture('harp','decor-02-14',544,258,82,162),
   furniture('cello','decor-02-01',95,656,76,125),
   furniture('rose-planter','decor-08-03',540,658,98,117)
  ]
 },
 {
  id:'art-deco-lounge',name:'Art Deco Lounge',style:'Peacock blue, brass and the sound of vinyl',
  floor:finish('ivory-diamond-marble','Ivory and teal marble','diamond-marble',['#d0c1a8','#efe0c1','#263b42','#bc935d','#7b6c58']),
  wallpaper:finish('peacock-deco-fan','Peacock fan wallpaper','deco-fan',['#173c47','#316477','#10242c','#d2b271']),rug:'#2d606a',
  items:[
   furniture('sofa','furniture-1-180',160,428,238,170),
   furniture('turntable','decor-05-15',465,434,204,174),
   furniture('upright-piano','decor-03-02',312,254,214,145),
   furniture('saxophone','decor-04-06',528,660,76,126),
   furniture('vinyl-bin','decor-05-16',105,658,108,118),
   furniture('garden-lantern','decor-14-04',548,226,62,88)
  ]
 },
 {
  id:'coastal-bedroom',name:'Coastal Bedroom',style:'Washed timber, blue linen and woven storage',
  floor:finish('driftwood-planks','Whitewashed driftwood','whitewashed-planks',['#a7b8b3','#d8ddd2','#728d94','#bfc1ac']),
  wallpaper:finish('sea-glass-stripes','Sea-glass stripe wallpaper','coastal-stripe',['#b3cacc','#dce2d3','#5c8f9b','#d2bc8a']),rug:'#839fa5',
  items:[
   furniture('bed','furniture-2-180',146,492,218,298),
   furniture('vanity','furniture-8-180',472,466,166,178),
   furniture('wicker-chair','decor-06-04',505,655,112,126),
   furniture('travel-trunk','decor-01-12',108,654,128,102),
   furniture('hydrangea','decor-08-02',540,252,96,125),
   furniture('fern','decor-08-13',312,134,112,114,false)
  ]
 },
 {
  id:'rustic-kitchen',name:'Rustic Kitchen',style:'Terracotta, cottage florals and a family table',
  floor:finish('warm-terracotta','Hand-fired terracotta','terracotta',['#a85d43','#ce8c60','#693f34','#d3b47a','#846c58']),
  wallpaper:finish('sage-cottage-toile','Sage cottage toile','toile',['#ede0bc','#b6ba98','#6c7d60','#a5734f']),rug:'#a88956',
  items:[
   furniture('kitchen-counter','furniture-3-180',168,340,244,204),
   furniture('stove','furniture-4-180',492,338,116,166),
   furniture('dining-table','furniture-5-180',465,593,178,159),
   furniture('wicker-chair','decor-06-04',465,460,114,128),
   furniture('wicker-hamper','decor-01-13',548,670,84,111),
   furniture('geranium','decor-08-01',552,196,80,96),
   furniture('oak-barrel','decor-01-01',80,202,90,105)
  ]
 },
 {
  id:'botanical-conservatory',name:'Botanical Conservatory',style:'Slate, leafy walls and a sunny garden seat',
  floor:finish('garden-slate-mosaic','Garden slate mosaic','slate-mosaic',['#70877c','#a3b3a0','#385851','#b1a676','#435e55']),
  wallpaper:finish('fern-frond-wallpaper','Fern-frond wallpaper','botanical-leaf',['#34564e','#6e9273','#1e3d38','#d3c18a']),rug:'#779263',
  items:[
   furniture('wicker-chair','decor-06-04',145,422,130,148),
   furniture('cafe-table','decor-06-06',320,421,148,149),
   furniture('olive-tree','decor-08-09',111,260,116,174),
   furniture('lemon-tree','decor-08-10',518,260,128,176),
   furniture('succulents','decor-08-15',480,445,118,94),
   furniture('fern','decor-08-13',180,142,114,118,false),
   furniture('rose-planter','decor-08-03',514,654,108,130),
   furniture('wind-chimes','decor-09-08',94,650,74,132,false)
  ]
 },
 {
  id:'midcentury-studio',name:'Midcentury Studio',style:'Honey oak, geometric paper and electric sessions',
  floor:finish('honey-oak-parquet','Honey-oak parquet','parquet',['#9b6f43','#c89e63','#573d31','#e1b875']),
  wallpaper:finish('ochre-geometric','Ochre geometric wallpaper','geometric',['#bc884f','#e1c587','#6e6650','#e6d4ac']),rug:'#776c54',
  items:[
   furniture('synthesizer','decor-03-04',150,335,210,175),
   furniture('electric-guitar','decor-02-08',516,325,82,141),
   furniture('jazz-drums','decor-03-07',442,515,228,180),
   furniture('congas','decor-03-10',139,512,106,150),
   furniture('sofa','furniture-1-180',312,668,268,174),
   furniture('succulents','decor-08-15',504,176,100,80)
  ]
 },
 {
  id:'french-cafe',name:'French Café',style:'Bistro checks, painted lattice and acoustic afternoons',
  floor:finish('bistro-checkerboard','Bistro checkerboard','checkerboard',['#d8cfb4','#ede5c6','#566269','#ac8b6a','#8c8374']),
  wallpaper:finish('sage-cafe-lattice','Sage café lattice','cafe-lattice',['#a5a98a','#d6d2ac','#586957','#b48168']),rug:'#9d6e5d',
  items:[
   furniture('cafe-table','decor-06-06',145,351,150,145),
   furniture('wicker-chair','decor-06-04',145,210,102,130),
   furniture('dining-table','furniture-5-180',450,558,212,178),
   furniture('oak-bench','decor-06-01',196,660,232,146),
   furniture('acoustic-guitar','decor-02-05',100,526,90,150),
   furniture('geranium','decor-08-01',542,664,92,111),
   furniture('upright-piano','decor-03-02',481,210,206,147)
  ]
 },
 {
  id:'industrial-loft',name:'Industrial Loft',style:'Exposed brick, concrete and a late-night rehearsal',
  floor:finish('polished-concrete','Polished concrete slabs','concrete',['#727b7c','#a5a9a1','#4e5c62','#ad805c','#657073']),
  wallpaper:finish('warehouse-brick','Exposed warehouse brick','exposed-brick',['#8b5c4a','#b78063','#4b4943','#c6b59a']),rug:'#655b54',
  items:[
   furniture('oak-barrel','decor-01-01',96,252,102,122),
   furniture('travel-trunk','decor-01-12',513,243,134,112),
   furniture('double-bass','decor-02-03',132,514,92,190),
   furniture('congas','decor-03-10',502,480,104,160),
   furniture('streetlamp','decor-14-01',550,674,76,202),
   furniture('sofa','furniture-1-180',312,674,276,174),
   furniture('vinyl-bin','decor-05-16',104,660,112,102),
   furniture('garden-lantern','decor-14-04',407,434,62,86)
  ]
 }
];

export const SHOWROOMS=deepFreeze(definitions.map((definition,index)=>{
 const column=index%4,row=Math.floor(index/4),x=[64,712,1736,2384][column],y=row?1092:132,w=624,h=704,center=x+w/2;
 const doorway={x:center,y:row?y+10:y+h-10},entry={x:center,y:STORE_TRAFFIC.crossY},browse={x:center,y:y+(row?240:540)};
 const wallpaperAreas=row?[{x,y,w:w/2-90,h:92},{x:center+90,y,w:w/2-90,h:92}]:[{x,y,w,h:92}];
 return {...definition,index,row,column,x,y,w,h,showroomId:definition.id,floorFinish:definition.floor,doorway,entry,browse,wallpaperAreas,
  doorOpening:{x:center-90,y:row?y:y+h-24,w:180,h:row?92:24},
  productIds:[...new Set(definition.items.map(item=>item.productId))],
  visitRoute:[entry,doorway,browse],exitRoute:[browse,doorway,entry]
 };
}));

export function applyShowroomLayout(scene,{room,wall,addItem,rug,sign,light,zone,windowAt}){
 scene.showrooms=SHOWROOMS;scene.storeTraffic=STORE_TRAFFIC;
 for(const display of SHOWROOMS){
  const {x,y,w,h}=display,mid=x+w/2;
  room(scene,display.name,x,y,w,h,display.floor.id);
  Object.assign(scene.rooms.at(-1),{id:display.id,showroomId:display.id,style:display.style,floorFinish:display.floor,wallpaper:display.wallpaper,wallpaperAreas:display.wallpaperAreas,productIds:display.productIds,entry:display.entry,doorway:display.doorway,browse:display.browse});
  const addWall=(xx,yy,ww,hh)=>{
   wall(scene,xx,yy,ww,hh);
   Object.assign(scene.walls.at(-1),{showroomId:display.id,color:display.wallpaper.colors[0],trim:display.wallpaper.colors[3]||display.wallpaper.colors[1]});
  };
  addWall(x,y,20,h);addWall(x+w-20,y,20,h);
  if(display.row){
   addWall(x,y,w/2-90,92);addWall(mid+90,y,w/2-90,92);addWall(x,y+h-24,w,24);
  }else{
   addWall(x,y,w,92);addWall(x,y+h-24,w/2-90,24);addWall(mid+90,y+h-24,w/2-90,24);
  }
  // One rug organizes the furnishings without covering the full floor sample.
  rug(scene,x+92,y+(display.row?322:264),w-184,210,display.rug);
  for(const item of display.items){
   const placed=addItem(scene,item.asset,x+item.x,y+item.y,item.w,item.h,item.solid);
   Object.assign(placed,{showroomId:display.id,productId:item.productId});
  }
  const labelY=display.row?y-30:y+h+33;
  sign(scene,display.name,mid,labelY,25);
  light(scene,mid,y+340,325);
  scene.zones.push(zone('browse-'+display.id,display.name+' · browse this room',display.browse.x-90,display.browse.y-65,180,130,'shop',{showroomId:display.id}));
 }
 // Checkout belongs to the front foyer, off both the central walking lanes
 // and all eight room approaches. The original street door stays fixed.
 scene.title='Coda Furnishings · Eight Styled Rooms';scene.spawn={...STORE_TRAFFIC.spawn};
 const counter=addItem(scene,'decor-05-05',440,1940,278,182);
 counter.fixture='checkout';scene.checkout={x:440,y:1940};
 scene.zones.push(zone('counter','Shop all eight collections',300,1960,280,55,'shop'));
 scene.zones.push(zone('street','Return to Coda Town',1376,1810,320,190,'exit'));
 sign(scene,'CHECKOUT',440,1818,21);sign(scene,'CODA FURNISHINGS',1536,236,28);
 sign(scene,'Eight rooms · eight ways to make a home',1536,274,17);
 rug(scene,1436,420,200,1315,'#675956');
 light(scene,1536,1840,330);light(scene,440,1940,220);
 if(windowAt)for(const x of [376,1024,2048,2696])windowAt(scene,x,20,172);
 return scene;
}
