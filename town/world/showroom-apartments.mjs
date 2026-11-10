import {SHOWROOM_FURNITURE} from './showroom-furniture-definitions.mjs?v=apartment-homes-2';
import {APARTMENT_DECOR} from './apartment-decor-definitions.mjs?v=apartment-homes-2';
const signatures=new Map(SHOWROOM_FURNITURE.map(a=>[a.id,a])),native=new Map(APARTMENT_DECOR.map(a=>[a.id,a]));
const rect=(x,y,w,h)=>({x,y,w,h}),point=(x,y)=>({x,y});
const product=(id,asset,role,x,y,w,h,solid=true,extra={})=>({productId:id?'furniture-'+id:null,asset,furnitureRole:role,x,y,w,h,solid,...extra});
const area=(name,functionalRole,x,y,w,h,px,py)=>({name,functionalRole,...rect(x,y,w,h),point:point(px,py)});
const placements={
 'victorian-parlor':{variant:0,mirror:false,friend:'fox-plush',art:'patchwork-wall-art',rug:'record-rug'},
 'art-deco-lounge':{variant:1,mirror:false,friend:'moon-star-cushions',art:'origami-artboard',rug:'record-rug'},
 'coastal-bedroom':{variant:2,mirror:false,friend:'axolotl-plush',art:'origami-artboard',rug:'rainbow-keys-rug'},
 'rustic-kitchen':{variant:3,mirror:false,friend:'cat-planter',art:'patchwork-wall-art',rug:'rainbow-keys-rug'},
 'botanical-conservatory':{variant:1,mirror:true,friend:'cat-planter',art:'origami-artboard',rug:'record-rug'},
 'midcentury-studio':{variant:2,mirror:true,friend:'fox-plush',art:'patchwork-wall-art',rug:'record-rug'},
 'french-cafe':{variant:3,mirror:true,friend:'axolotl-plush',art:'origami-artboard',rug:'rainbow-keys-rug'},
 'industrial-loft':{variant:0,mirror:true,friend:'moon-star-cushions',art:'patchwork-wall-art',rug:'record-rug'}
};
function addNative(items,suffix,role,x,y,w,h,extra={}){
 const asset='apartment-'+suffix,a=native.get(asset);
 items.push(product(asset,asset,role,x,y,w||a.w,h||a.h,a.solid,{wallMounted:a.wallMounted,layer:a.layer,...extra}));
}
function kitchen(items,{north=false,west=false,blue=false}={}){
 const x=n=>west?624-n:n,y=n=>north?n-224:n;
 for(const [suffix,role,X,Y,w,h,fixture]of [
  ['sink-counter','kitchen',404,472,88,88,'sink'],['corner-kitchen-counter','kitchen-counter',488,472,88,77,'counter'],
  ['cream-stove','stove',560,472,56,77,'stove'],[blue?'blue-fridge':'pastel-fridge','fridge',550,north?540:588,64,112,'fridge'],['wardrobe','pantry',north?342:450,north?442:588,north?48:64,north?100:92,'pantry']
 ])addNative(items,suffix,role,x(X),y(Y),w,h,{fixtureRole:fixture});
}
function bath(items,v){
 const fixtures=v===2?[
  ['glass-shower','shower',546,250,82,129],['toilet','toilet',546,320,46,76],['bath-vanity','vanity',458,212,76,101]
 ]:v===3?[
  ['glass-shower','shower',80,552,82,129],['toilet','toilet',80,650,46,76],['bath-vanity','vanity',190,520,76,101]
 ]:v===1?[
  ['glass-shower','shower',546,552,82,129],['toilet','toilet',546,650,46,76],['bath-vanity','vanity',456,520,76,101]
 ]:[
  ['glass-shower','shower',546,250,82,129],['toilet','toilet',546,344,46,76],['bath-vanity','vanity',456,212,76,101]
 ];
 for(const [asset,role,x,y,w,h]of fixtures)addNative(items,asset,role,x,y,w,h,{fixtureRole:role});
 const vanity=fixtures.find(f=>f[1]==='vanity'),north=v===1||v===3?414:106;
 addNative(items,'round-mirror','bathroom-mirror',vanity[2],north-10,58,63,{fixtureRole:'bathroom-mirror'});
}
// Four compact one-bedroom floor plates, each paired with a mirrored plan.
// Opening a showroom never enlarges its reserved 624 × 704 exterior cell.
export function createShowroomApartmentPlan(display){
 const config=placements[display.id],v=config.variant,bedId='showroom-'+display.id+'-bed',sofaId='showroom-'+display.id+'-sofa';
 const bed=signatures.get(bedId),sofa=signatures.get(sofaId),items=[],walls=[],privacyDoors=[],areas=[];
 const door=(id,axis,x,y,length=104)=>privacyDoors.push({id,roomId:id,axis,x,y,length,open:true,hinge:'start'});
 const bedAt=v===2?point(110,310):point(110,340),sofaAt=v===2?point(470,538):v===3?point(480,550):point(128,550);
 items.push(product(display.id+'-bed',bedId,'bed',bedAt.x,bedAt.y,150,bed.h),product(display.id+'-sofa',sofaId,'sofa',sofaAt.x,sofaAt.y,180,sofa.h));
 if(v===2){
  areas.push(area('Quiet bedroom','bedroom',28,106,384,244,300,310),area('Private bathroom','bathroom',412,106,184,278,474,310),area('L-shaped kitchen','kitchen',28,414,248,262,192,514),area('Living & music nook','living',310,414,286,262,356,570),area('Breakfast nook','dining',250,490,120,160,300,620));
  walls.push(rect(396,106,16,262),rect(28,350,202,16),rect(334,350,78,16),rect(412,368,10,16),rect(526,368,70,16));
  door('bedroom','horizontal',230,358);door('bathroom','horizontal',422,376);kitchen(items,{west:true,blue:true});
  addNative(items,'round-dining-table','dining-table',300,580,72,70);addNative(items,'molded-dining-chair','dining-chair',300,496,44,69);addNative(items,'wardrobe','wardrobe',330,250,70,110);
 }else{
  areas.push(area('Private bedroom','bedroom',28,106,266,288,230,306));
  const bathWest=v===3,bathSouth=v!==0;
  areas.push(area('Private bathroom','bathroom',bathWest?28:410,bathSouth?414:106,bathWest?264:186,bathSouth?262:288,bathWest?190:456,bathSouth?562:306));
  const kitchenNorth=v!==0,livingEast=v===3;
  areas.push(area(kitchenNorth?'Window-side galley':'Corner kitchen','kitchen',348,kitchenNorth?106:410,248,266,432,kitchenNorth?308:514),area('Living & reading nook','living',livingEast?330:28,414,livingEast?266:274,262,livingEast?350:250,v===1?510:570));
  walls.push(rect(278,106,16,148),rect(278,358,16,36),rect(28,394,266,16));door('bedroom','vertical',286,254);
  if(v===0){walls.push(rect(394,106,16,148),rect(394,358,16,52),rect(410,394,186,16));door('bathroom','vertical',402,254);}
  else if(v===1){walls.push(rect(394,414,16,88),rect(394,606,16,70),rect(394,398,202,16));door('bathroom','vertical',402,502);}
  else{walls.push(rect(278,414,16,88),rect(278,606,16,70),rect(28,414,250,16));door('bathroom','vertical',286,502);}
  kitchen(items,{north:kitchenNorth,blue:v===1});
  const table=v===0?point(376,580):v===1?point(256,650):point(384,414),chair=v===0?point(300,580):v===1?point(256,570):point(384,480),target=v===0?point(376,616):v===1?point(304,650):point(332,456);
  areas.push(area(v===1?'Two-seat dining nook':'Everyday dining','dining',v===1?210:300,v===1?560:v===0?490:370,v===1?120:150,v===1?116:v===0?154:150,target.x,target.y));
  addNative(items,'round-dining-table','dining-table',table.x,table.y,v===1?64:72,v===1?62:70);addNative(items,'molded-dining-chair','dining-chair',chair.x,chair.y,44,69);addNative(items,'molded-lounge-chair','reading-chair',226,210,56,76);
 }
 bath(items,v);
 const coffeeX=v===2?470:v===3?480:130;
 addNative(items,'kidney-coffee-table','coffee-table',coffeeX,650,82,51);addNative(items,'nightstand','nightstand',v===2?220:230,v===2?310:350,44,55);
 // One playful friend, a music rug and framed art have deliberate places.
 const rightLiving=v===2||v===3;
 addNative(items,config.friend,'playful-accent',rightLiving?568:230,430,40,48);
 addNative(items,config.rug,'music-rug',rightLiving?468:134,610,rightLiving?180:176,config.rug==='record-rug'?156:102);
 addNative(items,config.art,'wall-art',230,88,64,64);
 addNative(items,display.id==='midcentury-studio'?'starburst-clock':'wall-shelf','wall-accent',344,88,64,56);
 let plan={width:624,height:704,layoutId:['north-pair','diagonal-private','broad-bedroom','west-private'][v],spawn:point(312,620),browse:v===2?point(356,600):point(344,v===0?438:450),items,walls,areas,privacyDoors};
 if(config.mirror)plan=mirrorPlan(plan);
 plan.layoutId+=config.mirror?'-mirrored':'-original';plan.bedroomDoor=plan.privacyDoors.find(d=>d.id==='bedroom');plan.bathroomDoor=plan.privacyDoors.find(d=>d.id==='bathroom');
 plan.visitRoute=browsingRoute(plan);plan.exitRoute=plan.visitRoute.map(p=>({...p})).reverse();return plan;
}
function mirrorPlan(plan){
 const flip=p=>({...p,x:624-p.x}),flipRect=r=>({...r,x:624-r.x-r.w});
 return {...plan,spawn:flip(plan.spawn),browse:flip(plan.browse),items:plan.items.map(flip),walls:plan.walls.map(flipRect),areas:plan.areas.map(a=>({...flipRect(a),point:flip(a.point)})),privacyDoors:plan.privacyDoors.map(d=>({...d,x:624-d.x-(d.axis==='horizontal'?d.length:0),hinge:d.axis==='horizontal'?'end':'start'}))};
}
// Residents use this same route to enter, browse and leave the private scene.
// Compute it once with the native art's physical bases, not room rectangles.
function browsingRoute(plan){
 const solids=[rect(0,0,624,106),rect(0,0,28,704),rect(596,0,28,704),rect(0,676,624,28),...plan.walls];
 for(const item of plan.items){
  if(!item.solid)continue;
  const a=native.get(item.asset);
  if(a){for(const b of a.boxes)solids.push(rect(item.x-item.w/2+b.x*item.w/a.w,item.y-item.h+b.y*item.h/a.h,b.w*item.w/a.w,b.h*item.h/a.h));}
  else{const depth=item.furnitureRole==='bed'?item.h*.72:Math.min(item.h*.48,item.w*.5);solids.push(rect(item.x-item.w*.43,item.y-depth,item.w*.86,depth));}
 }
 const blocked=p=>solids.some(r=>p.x>=r.x-16&&p.x<=r.x+r.w+16&&p.y>=r.y-16&&p.y<=r.y+r.h+16);
 const clear=(a,b)=>{const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/3));for(let i=0;i<=steps;i++)if(blocked({x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps}))return false;return true;};
 const start={...plan.spawn,parent:-1},queue=[start],seen=new Set([start.x+','+start.y]);let end=-1,corner=null;
 for(let next=0;next<queue.length;next++){
  const a=queue[next];
  if(Math.hypot(a.x-plan.browse.x,a.y-plan.browse.y)<=12){const c={x:plan.browse.x,y:a.y};if(clear(a,c)&&clear(c,plan.browse)){end=next;corner=c;break;}}
  for(const [dx,dy]of [[8,0],[-8,0],[0,8],[0,-8]]){const p={x:a.x+dx,y:a.y+dy,parent:next},k=p.x+','+p.y;if(p.x<40||p.y<122||p.x>584||p.y>660||seen.has(k)||blocked(p))continue;seen.add(k);queue.push(p);}
 }
 if(end<0)throw Error('Apartment browsing route is blocked: '+plan.layoutId);
 const path=[];for(let i=end;i>=0;i=queue[i].parent)path.push({x:queue[i].x,y:queue[i].y});path.reverse();path.push(corner,{...plan.browse});
 const result=[];
 for(const p of path){if(result.length&&p.x===result.at(-1).x&&p.y===result.at(-1).y)continue;while(result.length>1){const a=result.at(-2),b=result.at(-1);if((a.x===b.x&&b.x===p.x)||(a.y===b.y&&b.y===p.y))result.pop();else break;}result.push(p);}
 return result;
}
export function applyShowroomApartment(scene,display,{room,wall,addItem,rug,sign,light,zone,windowAt}){
 const plan=display.apartment;scene.kind='showroom';scene.floor=1;scene.showroomId=display.id;scene.showroom=display;scene.title=display.name+' · One-bedroom Apartment';scene.spawn={...plan.spawn};scene.apartmentLayout=plan.layoutId;
 room(scene,display.name,28,106,568,570,display.floor.id);
 Object.assign(scene.rooms.at(-1),{functionalRole:'apartment',showroomId:display.id,style:display.style,floorFinish:display.floor,wallpaper:display.wallpaper,wallpaperAreas:[rect(28,0,568,106)],productIds:display.productIds});
 for(const a of plan.areas){room(scene,a.name,a.x,a.y,a.w,a.h,a.functionalRole==='bathroom'?'tile':display.floor.id);Object.assign(scene.rooms.at(-1),{id:display.id+'-'+a.functionalRole,functionalRole:a.functionalRole,showroomId:display.id,point:a.point,...(a.functionalRole==='bathroom'?{floorFinish:{id:'bathroom-hex',pattern:'bathroom-hex',colors:['#e1ddd0','#f0eadc','#a4b6aa','#6c817c']}}:{})});}
 const bathroom=plan.areas.find(a=>a.functionalRole==='bathroom');
 if(bathroom.y>106)scene.walls.push({...rect(bathroom.x,bathroom.y-96,bathroom.w,96),visualOnly:true,bathroomNorthFace:true,color:'#ddd9c8',trim:'#b7c8ba'});
 for(const p of plan.walls){wall(scene,p.x,p.y,p.w,p.h);Object.assign(scene.walls.at(-1),{color:display.wallpaper.colors[0],trim:display.wallpaper.colors[3]||display.wallpaper.colors[1]});}
 scene.privacyDoors=plan.privacyDoors.map(d=>({...d,id:display.id+'-'+d.id,roomId:display.id+'-'+d.roomId,color:display.wallpaper.colors[0],trim:display.wallpaper.colors[3]}));
 for(const item of plan.items){const placed=addItem(scene,item.asset,item.x,item.y,item.w,item.h,item.solid);Object.assign(placed,{productId:item.productId,showroomId:display.id,furnitureRole:item.furnitureRole,fixtureRole:item.fixtureRole,wallMounted:item.wallMounted,layer:item.layer,depth:item.depth});}
 scene.zones.push(zone('browse-'+display.id,'Shop this apartment',plan.browse.x-42,plan.browse.y-35,84,70,'shop',{showroomId:display.id}),zone('lobby-'+display.id,'Return to the main lobby',256,604,112,62,'showroom-lobby',{showroomId:display.id}));
 sign(scene,display.name,312,690,14);sign(scene,'MAIN LOBBY',312,674,11);for(const a of plan.areas)light(scene,a.point.x,a.point.y,a.functionalRole==='living'?220:150);
 if(windowAt){windowAt(scene,74,24,60);windowAt(scene,550,24,60);}return scene;
}
