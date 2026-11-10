import {SHOWROOM_FURNITURE} from './showroom-furniture-definitions.mjs?v=town-performance-2';

const signatures=new Map(SHOWROOM_FURNITURE.map(item=>[item.id,item]));
const rect=(x,y,w,h)=>({x,y,w,h});
const product=(id,asset,role,x,y,w,h,solid=true)=>({productId:id?'furniture-'+id:null,asset,furnitureRole:role,x,y,w,h,solid});
const accents={
 'victorian-parlor':[['rose-planter','decor-08-03',66,648,64,86],['cello','decor-02-01',260,648,60,103]],
 'art-deco-lounge':[['vinyl-bin','decor-05-16',66,648,68,74],['saxophone','decor-04-06',260,648,54,102]],
 'coastal-bedroom':[['travel-trunk','decor-01-12',66,648,68,55],['hydrangea','decor-08-02',260,648,66,86]],
 'rustic-kitchen':[['wicker-hamper','decor-01-13',66,648,64,84],['geranium','decor-08-01',260,648,64,77]],
 'botanical-conservatory':[['olive-tree','decor-08-09',66,648,68,105],['succulents','decor-08-15',260,648,66,53]],
 'midcentury-studio':[['succulents','decor-08-15',66,648,66,53],['electric-guitar','decor-02-08',260,648,54,102]],
 'french-cafe':[['geranium','decor-08-01',66,648,64,77],['acoustic-guitar','decor-02-05',260,648,54,102]],
 'industrial-loft':[['oak-barrel','decor-01-01',66,648,64,77],['double-bass','decor-02-03',260,648,54,112]]
};

// Each complete studio occupies the same 624 × 704 cell already reserved for
// it in the store's exterior floor plate. A separate scene reveals the private
// interior after its lobby door is opened; it does not increase the floor area.
export function createShowroomApartmentPlan(display){
 const bedId='showroom-'+display.id+'-bed',sofaId='showroom-'+display.id+'-sofa';
 const bed=signatures.get(bedId),sofa=signatures.get(sofaId);
 const spawn={x:312,y:600},browse={x:312,y:420};
 const items=[
  product(display.id+'-bed',bedId,'bed',490,340,150,bed?.h||188),
  product(display.id+'-sofa',sofaId,'sofa',150,575,180,sofa?.h||158),
  product('kitchen-counter','furniture-3-180','kitchen',128,252,176,128),
  product('stove','furniture-4-180','stove',254,252,70,100),
  product('dining-table','furniture-5-180','dining-table',148,380,126,112),
  product('wicker-chair','decor-06-04','dining-chair',148,320,66,86),
  product('cafe-table','decor-06-06','coffee-table',132,650,70,72),
  product(null,'furniture-7-180','shower',542,550,84,126),
  product(null,'furniture-6-180','toilet',544,640,54,78),
  product('vanity','furniture-8-180','vanity',440,640,90,95),
  ...(accents[display.id]||[]).map(([id,asset,x,y,w,h])=>product(id,asset,'accent',x,y,w,h))
 ];
 const areas=[
  {name:'Kitchen',functionalRole:'kitchen',...rect(36,112,300,170),point:{x:312,y:274}},
  {name:'Dining area',functionalRole:'dining',...rect(36,284,300,132),point:{x:238,y:390}},
  {name:'Bedroom',functionalRole:'bedroom',...rect(364,112,232,280),point:{x:392,y:370}},
  {name:'Living room',functionalRole:'living',...rect(36,424,300,240),point:{x:290,y:470}},
  {name:'Private bathroom',functionalRole:'bathroom',...rect(396,416,200,260),point:{x:440,y:540},material:'tile'}
 ];
 return {
  width:624,height:704,spawn,browse,items,areas,
  walls:[rect(376,106,20,200),rect(376,396,220,20),rect(376,416,20,56),rect(376,576,20,100)],
  bedroomDoor:{x:386,y:351,w:20,h:90},
  bathroomDoor:{x:386,y:520,w:20,h:104},
  visitRoute:[spawn,browse],exitRoute:[browse,spawn],
  routes:{
   kitchen:[spawn,{x:312,y:274}],
   dining:[spawn,{x:312,y:390},{x:238,y:390}],
   bedroom:[spawn,{x:312,y:370},{x:392,y:370}],
   living:[spawn,{x:312,y:470},{x:290,y:470}],
   bathroom:[spawn,{x:312,y:520},{x:440,y:520},{x:440,y:540}]
  }
 };
}

export function applyShowroomApartment(scene,display,{room,wall,addItem,rug,sign,light,zone,windowAt}){
 const plan=display.apartment;
 scene.kind='showroom';scene.floor=1;scene.showroomId=display.id;scene.showroom=display;
 scene.title=display.name+' · Complete Apartment';scene.spawn={...plan.spawn};
 room(scene,display.name,28,106,568,570,display.floor.id);
 Object.assign(scene.rooms.at(-1),{functionalRole:'apartment',showroomId:display.id,style:display.style,floorFinish:display.floor,wallpaper:display.wallpaper,wallpaperAreas:[rect(28,0,568,106)],productIds:display.productIds});
 for(const area of plan.areas){
  room(scene,area.name,area.x,area.y,area.w,area.h,area.material||display.floor.id);
  Object.assign(scene.rooms.at(-1),{functionalRole:area.functionalRole,showroomId:display.id,point:area.point});
 }
 for(const partition of plan.walls){wall(scene,partition.x,partition.y,partition.w,partition.h);Object.assign(scene.walls.at(-1),{color:display.wallpaper.colors[0],trim:display.wallpaper.colors[3]||display.wallpaper.colors[1]});}
 rug(scene,46,432,238,172,display.rug);
 rug(scene,424,128,150,218,display.rug);
 for(const item of plan.items){
  const placed=addItem(scene,item.asset,item.x,item.y,item.w,item.h,item.solid);
  Object.assign(placed,{productId:item.productId,showroomId:display.id,furnitureRole:item.furnitureRole});
 }
 scene.zones.push(zone('browse-'+display.id,'Shop this apartment',plan.browse.x-60,plan.browse.y-48,120,96,'shop',{showroomId:display.id}));
 scene.zones.push(zone('lobby-'+display.id,'Return to the main lobby',256,604,112,62,'showroom-lobby',{showroomId:display.id}));
 sign(scene,display.name,312,685,16);sign(scene,'MAIN LOBBY',312,674,12);
 light(scene,150,420,260);light(scene,490,210,210);light(scene,480,550,160);
 if(windowAt){windowAt(scene,140,24,140);windowAt(scene,490,24,140);}
 return scene;
}
