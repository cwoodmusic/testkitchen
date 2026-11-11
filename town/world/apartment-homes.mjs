import {residents as defaultResidents} from './resident-profiles.mjs?v=wall-caps-1';
import {APARTMENT_DECOR} from './apartment-decor-definitions.mjs?v=wall-caps-1';
import {SHOWROOM_FURNITURE} from './showroom-furniture-definitions.mjs?v=wall-caps-1';
import {getApartmentAsset} from './apartment-collections.mjs?v=wall-caps-1';
import {furnitureAtGroundCenter,furnitureFacingBoxes} from './furniture-facing.mjs?v=wall-caps-1';

const furniture=new Map(APARTMENT_DECOR.map(a=>[a.id,a]));
const signatureFurniture=new Map(SHOWROOM_FURNITURE.map(a=>[a.id,a]));
const homeThemes={bach:'victorian-parlor',mozart:'french-cafe',beethoven:'industrial-loft',clara:'botanical-conservatory',chopin:'victorian-parlor',haydn:'rustic-kitchen',handel:'victorian-parlor',vivaldi:'rustic-kitchen',joplin:'midcentury-studio',ellington:'art-deco-lounge',ella:'french-cafe',nina:'botanical-conservatory',miles:'midcentury-studio',dj:'industrial-loft','vee-jay':'art-deco-lounge',zizi:'coastal-bedroom',metronome:'rustic-kitchen',schoenberg:'industrial-loft'};
const woods={
 'victorian-parlor':['#82553e','#c4976f','#4a352e','#a16c4a'],
 'french-cafe':['#b39067','#dfc69a','#6e523e','#bd9c72'],
 'botanical-conservatory':['#968d66','#d0c69c','#5e664f','#a79a71'],
 'rustic-kitchen':['#aa7950','#d7b17f','#6b4c37','#be8d5e'],
 'art-deco-lounge':['#7d6250','#b3916a','#453c37','#977153'],
 'midcentury-studio':['#a87342','#d8a46a','#65442d','#bb8750','#513b2e'],
 'industrial-loft':['#8c7966','#bca88d','#544a43','#9c856d'],
 'coastal-bedroom':['#b4bba8','#e3e4ce','#7e9991','#c5cbb6']
};
const rect=(x,y,w,h)=>({x,y,w,h});
const palette=(pattern,colors)=>({pattern,colors});
const variants=[
 {id:'garden-crossing',bedroom:['left',112,400],bathroom:['right',112,330],kitchen:['left',590,450],living:['right',530,510]},
 {id:'long-gallery',bedroom:['right',112,540],bathroom:['left',112,320],kitchen:['left',500,540],living:['right',720,320]},
 {id:'quiet-wing',bedroom:['left',112,430],bathroom:['left',680,360],kitchen:['right',112,350],living:['right',530,510]},
 {id:'sunset-bedroom',bedroom:['right',650,390],bathroom:['right',112,340],kitchen:['left',112,360],living:['left',550,490]},
 {id:'music-gallery',bedroom:['left',112,540],bathroom:['right',700,340],kitchen:['right',112,430],living:['left',730,310]},
 {id:'reading-courtyard',bedroom:['right',112,370],bathroom:['left',440,360],kitchen:['left',112,270],living:['right',560,480],reading:['left',850,190]}
];
const personalities={
 bach:['#658475','#e4d5a9','botanical-leaf','fern-planter','fox-plush'],
 mozart:['#b67d84','#eedbc1','music-confetti','cat-planter','axolotl-plush'],
 beethoven:['#687e9b','#d8c5a7','midcentury-atomic','monstera','moon-star-cushions'],
 clara:['#81a28b','#e8dfc8','botanical-leaf','fern-planter','headphones-books'],
 chopin:['#9181a3','#e7dcef','tiny-stars','cat-planter','moon-star-cushions'],
 haydn:['#c49a53','#f0dfb2','tiny-stars','cat-planter','fox-plush'],
 handel:['#8c9b73','#e8dcba','midcentury-atomic','monstera','headphones-books'],
 vivaldi:['#bd8b6c','#f1ddc0','botanical-leaf','fern-planter','origami-artboard'],
 joplin:['#ad8856','#ead6a7','midcentury-atomic','cat-planter','headphones-books'],
 ellington:['#64929a','#e0d3b1','midcentury-atomic','monstera','record-player'],
 ella:['#bd8e96','#f2dfcc','music-confetti','fern-planter','fox-plush'],
 nina:['#819b7a','#e3d9b9','botanical-leaf','monstera','headphones-books'],
 miles:['#657a97','#ddc990','midcentury-atomic','monstera','record-player'],
 dj:['#9480ae','#dfd7ed','music-confetti','cat-planter','lava-lamp'],
 'vee-jay':['#6eaaab','#d5e7df','midcentury-atomic','cat-planter','solar-system-model'],
 zizi:['#b09ec7','#e7e6c5','tiny-stars','fern-planter','solar-system-model'],
 metronome:['#b09272','#e6d6bc','midcentury-atomic','monstera','origami-artboard'],
 schoenberg:['#b4948b','#e7dccb','midcentury-atomic','fern-planter','patchwork-wall-art']
};

function finishFor(resident){
 const [accent,cream,pattern,plant,keepsake]=personalities[resident.id]||personalities.bach;
 const theme=homeThemes[resident.id]||'midcentury-studio';
 const wood=palette(theme==='midcentury-studio'||theme==='industrial-loft'?'teak-planks':'parquet',woods[theme]);
 const paper=palette(pattern,[cream,'#fff2d7',accent,'#c19a62','#6c9e98']);
 const tile=palette('bathroom-hex',['#c4d4ca','#ecedde','#78968f','#d8bd8c']);
 const terrazzo=palette('terrazzo',['#d0c7af','#eee5cf',accent,'#ab8e70','#779996']);
 return {accent,cream,plant,keepsake,wood,paper,tile,terrazzo};
}
function areaFor(role,tuple,width,wide){
 const [side,y,h]=tuple,leftEnd=wide?970:430,rightStart=wide?1338:658;
 const x=side==='left'?36:rightStart,w=side==='left'?leftEnd-36:width-36-rightStart;
 return {id:role,name:{bedroom:'Bedroom',bathroom:'Private bathroom',kitchen:'Kitchen & dining',living:'Living & music',reading:'Reading nook'}[role],functionalRole:role,side,...rect(x,y,w,h)};
}
function privateRoom(plan,area,finishes){
 const left=area.x-18,right=area.x+area.w,top=area.y-18,bottom=area.y+area.h;
 const side=area.side==='left'?'right':'left',wallX=side==='right'?right:left;
 const centre=bottom-105,start=centre-66,end=centre+66;
 plan.walls.push(rect(left,top,area.w+36,18),rect(left,bottom,area.w+36,18));
 plan.walls.push(rect(side==='right'?left:right,top,18,area.h+36));
 plan.walls.push(rect(wallX,top,18,start-top),rect(wallX,end,18,bottom+18-end));
 const door={id:area.id+'-door',roomId:area.id,axis:'vertical',x:wallX+9,y:start,length:132,open:true,hinge:'start',color:finishes.accent,trim:'#c6aa78'};
 plan.doors.push(door);area.door={x:wallX,y:start,w:18,h:132};
 area.point={x:side==='right'?right-56:area.x+56,y:centre};
}
function add(plan,suffix,role,x,y,scale=1,extra={}){
 const asset='apartment-'+suffix,def=furniture.get(asset);
 if(!def)throw Error('Unknown apartment furnishing: '+suffix);
 const item={asset,furnitureRole:role,purpose:def.purpose,x:Math.round(x),y:Math.round(y),w:Math.round(def.w*scale),h:Math.round(def.h*scale),solid:def.solid,wallMounted:def.wallMounted,layer:def.layer,...extra};
 plan.items.push(item);return item;
}
function addSignature(plan,role,x,y,targetW,targetH,extra={}){
 const asset=`showroom-${plan.furnitureTheme}-${role}`,def=signatureFurniture.get(asset),fit=Math.min(targetW/def.w,targetH/def.h);
 const item={asset,furnitureRole:role,purpose:role,x:Math.round(x),y:Math.round(y),w:def.w*fit,h:def.h*fit,solid:true,layer:'objects',furnitureTheme:plan.furnitureTheme,targetBounds:{w:targetW,h:targetH},...extra};
 plan.items.push(item);return item;
}
function approach(plan,item,x,y){item.approach={x:Math.round(x),y:Math.round(y)};plan.fixtureApproaches.push({role:item.furnitureRole,asset:item.asset,roomId:item.roomId,...item.approach});}
function keepsakeKind(suffix){const a=furniture.get('apartment-'+suffix);return a.wallMounted?'wall':['plush','cushion'].includes(a.purpose)||suffix==='headphones-books'?'bed':'table';}
function bedroom(plan,area,f){
 const wide=plan.wide,outer=area.side==='left'?area.x+125:area.x+area.w-125,inner=area.side==='left'?area.x+area.w-85:area.x+85;
 const bedScale=wide?1.6:1.32,bedY=area.y+Math.min(area.h-90,310);
 const bed=addSignature(plan,'bed',outer,bedY,150*bedScale,150*bedScale,{roomId:area.id});
 approach(plan,bed,area.side==='left'?outer+bed.w*.66:outer-bed.w*.66,bedY+24);
 add(plan,'nightstand','nightstand',area.side==='left'?outer+150:outer-150,bedY-34,.82,{roomId:area.id});
 add(plan,'wardrobe','wardrobe',inner,area.y+165,wide?1.1:.8,{roomId:area.id});
 const kind=keepsakeKind(f.keepsake),deskX=area.x+area.w*.54,artX=wide?deskX:inner;
 // The compact north bedrooms have a window above the bed. Keep its wall
 // free; larger rooms have a separate book shelf beside the writing corner.
 if(wide||area.y>112)add(plan,'wall-shelf','books-and-treasures',wide?area.x+area.w*.38:outer,area.y-10,wide?1.1:.85,{roomId:area.id,solid:false,supportedBy:'north-wall'});
 add(plan,kind==='bed'?f.keepsake:plan.resident.index%2?'fox-plush':'moon-star-cushions',kind==='bed'?'personal-keepsake':'cozy-bed-friend',outer,bedY-75,.65,{roomId:area.id,solid:false,depth:bedY+.25,supportedBy:'bed'});
 add(plan,kind==='wall'?f.keepsake:'origami-artboard',kind==='wall'?'personal-keepsake':'bedroom-art',artX,area.y-10,.68,{roomId:area.id,solid:false,supportedBy:'north-wall'});
 if(wide){
  const desk=add(plan,'teak-desk','writing-desk',deskX,area.y+168,1.1,{roomId:area.id});
  add(plan,'desk-chair','desk-chair',deskX,area.y+276,.85,{roomId:area.id});
  approach(plan,desk,deskX,desk.y+45);
  add(plan,'mushroom-lamp','desk-lamp',deskX+62,desk.y-desk.h*.76,.62,{roomId:area.id,solid:false,depth:desk.y+.25,supportedBy:'writing-desk'});
  if(kind==='table')add(plan,f.keepsake,'personal-keepsake',deskX-40,desk.y-desk.h*.76,.65,{roomId:area.id,solid:false,depth:desk.y+.25,supportedBy:'writing-desk'});
 }
 area.floorFinish=f.wood;area.wallpaper=f.paper;area.wallpaperAreas=[rect(area.x,area.y-106,area.w,96)];
}
function bathroom(plan,area,f){
 const x=area.x,top=area.y,bottom=top+area.h,wide=plan.wide,left=area.side==='left',direction=left?1:-1;
 const outer=margin=>left?x+margin:x+area.w-margin,inner=margin=>left?x+area.w-margin:x+margin;
 const shower=add(plan,wide?'bathtub':'glass-shower',wide?'bathtub':'shower',outer(wide?125:78),top+166,wide?1.28:1,{roomId:area.id});
 const toilet=add(plan,'toilet','toilet',outer(wide?135:78),bottom-54,wide?1.16:1,{roomId:area.id});
 const vanity=add(plan,'bath-vanity','vanity',inner(wide?150:80),top+(wide?120:100),wide?1.35:1,{roomId:area.id});
 approach(plan,shower,shower.x+direction*(wide?140:105),shower.y+24);
 approach(plan,toilet,toilet.x+direction*85,toilet.y+18);
 approach(plan,vanity,vanity.x,vanity.y+40);
 add(plan,'round-mirror','bathroom-mirror',vanity.x,top-10,.72,{roomId:area.id,solid:false,supportedBy:'north-wall'});
 add(plan,'fern-planter','bathroom-plant',inner(wide?155:73),bottom-48,.56,{roomId:area.id});
 if(wide){const linen=add(plan,'wardrobe','bathroom-storage',(shower.x+vanity.x)/2,top+120,.95,{roomId:area.id});approach(plan,linen,linen.x,linen.y+50);}
 area.floorFinish=f.tile;area.wallpaper=palette('coastal-stripe',['#c5d8ce','#edf0df',f.accent,'#b6b998']);area.wallpaperAreas=[rect(area.x,area.y-98,area.w,88)];
}
function kitchen(plan,area,f){
 const wide=plan.wide,s=wide?1.3:.94,x=area.x,y=area.y,back=y+140;
 const fridge=add(plan,plan.resident.index%2?'pastel-fridge':'blue-fridge','fridge',x+58*s,back,s,{roomId:area.id});
 const sink=add(plan,'sink-counter','sink',x+174*s,back,s,{roomId:area.id});
 const stove=add(plan,'cream-stove','stove',x+284*s,back,s,{roomId:area.id});
 // The L piece's sloping back corner has transparent padding. An 80px
 // return places its opaque countertop against the stove, with clear feet.
 const counter=add(plan,'corner-kitchen-counter','kitchen-storage',wide?stove.x+90*s:x+area.w-48,back+(wide?0:80),s,{roomId:area.id,connectedTo:'stove'});
 for(const a of [fridge,sink,stove])approach(plan,a,a.x,a.y+47);
 approach(plan,counter,wide?counter.x:counter.x-100*s,counter.y+(wide?47:20));
 const shelfX=y===112?(wide?x+area.w*.55:area.side==='left'?x+area.w-62:x+62):sink.x;
 add(plan,'wall-shelf','kitchen-shelf',shelfX,y-10,.85,{roomId:area.id,solid:false,supportedBy:'north-wall'});
 if(area.h>=400){
  const table=add(plan,'round-dining-table','dining-table',x+(wide?300:142),area.y+area.h-52,wide?1.25:.9,{roomId:area.id});
  add(plan,'molded-dining-chair','dining-chair',table.x-(wide?140:98),table.y-5,.75,{roomId:area.id});
  approach(plan,table,table.x+table.w*.65,table.y+20);
 }
 area.point={x:x+area.w*.52,y:area.y+area.h-28};area.floorFinish=f.terrazzo;
 area.wallpaper=palette('cafe-lattice',[f.cream,'#f4ead4',f.accent,'#b89c6c']);area.wallpaperAreas=[rect(x,y-98,area.w,88)];
}
function living(plan,area,f){
 const wide=plan.wide,outer=area.side==='left'?area.x+155:area.x+area.w-155,back=area.y+133,needsDining=plan.rooms.find(a=>a.id==='kitchen').h<400;
 const sofaScale=wide?1.75:1.35,sofa=addSignature(plan,'sofa',outer,back,180*sofaScale,126*sofaScale,{roomId:area.id});
 const table=add(plan,'kidney-coffee-table','coffee-table',outer,back+111,wide?1.15:.86,{roomId:area.id});
 approach(plan,sofa,area.side==='left'?outer+sofa.w*.6:outer-sofa.w*.6,sofa.y+24);
 approach(plan,table,area.side==='left'?outer+table.w*.65:outer-table.w*.65,table.y+30);
 add(plan,'headphones-books','favorite-records',table.x,table.y-table.h*.68,.5,{roomId:area.id,solid:false,depth:table.y+.25,supportedBy:'coffee-table'});
 const storageX=wide?(area.side==='left'?area.x+area.w-190:area.x+190):(area.side==='left'?area.x+area.w-70:area.x+70);
 const storageY=wide?back+8:area.y+96;
 const storage=add(plan,plan.resident.index%2?'tambour-record-console':'low-bookcase','record-storage',storageX,storageY,wide?1.2:.62,{roomId:area.id});
 add(plan,'patchwork-wall-art','living-art',storageX,area.y-10,.68,{roomId:area.id,solid:false,supportedBy:'north-wall'});
 if(!wide&&keepsakeKind(f.keepsake)==='table')add(plan,f.keepsake,'personal-keepsake',storageX,storage.y-storage.h*.8,.65,{roomId:area.id,solid:false,depth:storage.y+.25,supportedBy:'record-storage'});
 add(plan,plan.resident.index%2?'record-rug':'rainbow-keys-rug','music-rug',outer,back+114,wide?1.8:1.1,{roomId:area.id,solid:false});
 if(wide){
  add(plan,'molded-lounge-chair','reading-chair',storageX,back+180,1.05,{roomId:area.id});
  add(plan,'reading-lamp','reading-lamp',storageX+110,back+170,.9,{roomId:area.id});
  add(plan,f.plant,'living-plant',area.side==='left'?area.x+45:area.x+area.w-45,area.y+area.h-40,.9,{roomId:area.id});
 }else if(area.h>400){const plantX=needsDining?(area.side==='left'?area.x+65:area.x+area.w-65):(area.side==='left'?area.x+area.w-70:area.x+70);add(plan,'cat-planter','living-plant',plantX,area.y+area.h-40,.7,{roomId:area.id});}
 if(needsDining){
  const diningX=wide?storageX:area.side==='left'?area.x+area.w-75:area.x+75;
  const dining=add(plan,'round-dining-table','dining-table',diningX,area.y+area.h-44,wide?1:.72,{roomId:area.id});
  add(plan,'molded-dining-chair','dining-chair',diningX,area.y+area.h-140,.66,{roomId:area.id});
  approach(plan,dining,area.side==='left'?diningX-85:diningX+85,dining.y+15);
 }
 area.point={x:area.side==='left'?area.x+area.w-48:area.x+48,y:area.y+180};area.floorFinish=f.wood;
 area.wallpaper=f.paper;area.wallpaperAreas=[rect(area.x,area.y-98,area.w,88)];
}

// Geometry stays authored at the same scale. Each retained role receives its
// owner's independently drawn collection piece; repeated generic accents are
// removed rather than renamed into extra clutter.
function personalizeHome(plan){
 const owner=plan.resident.id,old=plan.items,items=[],used=new Set();
 const find=role=>old.find(a=>a.furnitureRole===role),room=id=>plan.rooms.find(a=>a.id===id);
 function place(slot,source,extra={}){
  const def=getApartmentAsset(owner,slot);if(used.has(slot))throw Error(`Duplicate home collection slot: ${owner}/${slot}`);
  const target=extra.targetBounds||source.targetBounds||{w:source.w,h:source.h||source.w*def.h/def.w};
  const fit=Math.min(target.w/def.w,target.h/def.h),item={...source,...extra,asset:def.id,w:def.w*fit,h:def.h*fit,targetBounds:{...target},purpose:def.purpose,solid:source.solid===false?false:def.solid,wallMounted:def.wallMounted,layer:def.layer,collectionOwner:owner,collectionSlot:slot,collectionStyle:def.style,furnitureTheme:def.style,visualSignature:def.visualSignature,motionKind:def.motionKind};
  used.add(slot);items.push(item);return item;
 }
 const core={bed:'bed',sofa:'sofa',wardrobe:'wardrobe',nightstand:'nightstand',desk:'writing-desk','desk-chair':'desk-chair','dining-table':'dining-table','dining-chair':'dining-chair','coffee-table':'coffee-table',sink:'sink',stove:'stove',fridge:'fridge',counter:'kitchen-storage',toilet:'toilet',vanity:'vanity','linen-storage':'bathroom-storage',mirror:'bathroom-mirror',shelf:'kitchen-shelf','record-console':'record-storage',rug:'music-rug'};
 for(const [slot,role]of Object.entries(core)){const source=find(role);if(source)place(slot,source);}
 const bath=find('shower')||find('bathtub');place('bath-fixture',bath);
 const signature=find('signature-instrument'),instrument=place('instrument',signature,{inspirationAsset:signature.asset});
 if(plan.wide&&['zizi','metronome','schoenberg'].includes(owner)){
  // The deep grand-piano base needs eight pixels below the106px north wall.
  // Move its floor center vertically; retain X, rotation and every other item.
  const def=getApartmentAsset(owner,'instrument'),boxes=furnitureFacingBoxes(def,instrument),top=Math.min(...boxes.map(b=>b.y)),bottom=Math.max(...boxes.map(b=>b.y+b.h));
  if(top<114){const left=Math.min(...boxes.map(b=>b.x)),right=Math.max(...boxes.map(b=>b.x+b.w));Object.assign(instrument,furnitureAtGroundCenter(def,instrument,{x:(left+right)/2,y:114+(bottom-top)/2}));}
 }
 const clock=find('music-clock');place('clock',clock,{targetBounds:{w:88,h:86}});
 const poster=find('bedroom-art')||old.find(a=>a.furnitureRole==='personal-keepsake'&&a.wallMounted);
 place('poster',poster,{furnitureRole:'signature-poster',whimsy:true,whimsyKind:'poster',targetBounds:{w:100,h:86}});
 const reading=room('reading'),chair=reading?find('reading-beanbag'):find('reading-chair');
 if(chair)place('reading-chair',chair,{furnitureRole:'reading-chair'});
 const lamp=find('reading-lamp');
 if(lamp)place('floor-lamp',lamp,{...(reading?{roomId:'reading',x:reading.x+250,y:reading.y+120}:{}),targetBounds:{w:140,h:175}});
 else if(reading)place('floor-lamp',{furnitureRole:'reading-lamp',roomId:'reading',x:reading.x+250,y:reading.y+120,w:100,h:150,solid:true});
 const livingRoom=room('living'),plant=find('living-plant');
 place('plant',plant||{furnitureRole:'living-plant',roomId:'living',x:livingRoom.side==='left'?livingRoom.x+65:livingRoom.x+livingRoom.w-65,y:livingRoom.y+livingRoom.h-38,w:70,h:105,solid:true});
 if(plan.wide){const kitchenRoom=room('kitchen');place('pantry',{furnitureRole:'pantry',roomId:'kitchen',x:kitchenRoom.x+kitchenRoom.w-130,y:kitchenRoom.y+140,w:104,h:174,solid:true});}

 const table=items.find(a=>a.furnitureRole==='coffee-table');
 place('toy',{furnitureRole:'signature-toy',roomId:table.roomId,x:table.x,y:table.y-table.h*.68,w:42,h:50,solid:false,supportedBy:'coffee-table',depth:table.y+.25,whimsy:true,whimsyKind:'toy'});
 const support=items.find(a=>a.furnitureRole===(plan.wide?'writing-desk':'record-storage'));
 const top=support.y-support.h*(plan.wide?.76:.8);
 place('lava-lamp',{furnitureRole:'signature-lava-lamp',roomId:support.roomId,x:support.x+(plan.wide?55:32),y:top,w:plan.wide?32:22,h:plan.wide?70:48,solid:false,supportedBy:support.furnitureRole,depth:support.y+.25,whimsy:true,whimsyKind:'lava-lamp'});
 if(plan.wide)place('arcade',{furnitureRole:'arcade',roomId:'living',x:livingRoom.x+livingRoom.w*.51,y:livingRoom.y+livingRoom.h-65,w:118,h:184,solid:true,whimsy:true,whimsyKind:'arcade'});
 else place('arcade',{furnitureRole:'arcade',roomId:support.roomId,x:support.x-14,y:top,w:65,h:115,solid:false,supportedBy:'record-storage',depth:support.y+.25,miniature:true,whimsy:true,whimsyKind:'arcade'});

 plan.items=items;plan.collectionOwner=owner;plan.collectionStyle=getApartmentAsset(owner,'bed').style;plan.furnitureTheme=plan.collectionStyle;
 arrangeConversationGroup(plan);
 plan.fixtureApproaches=plan.fixtureApproaches.flatMap(p=>{const item=items.find(a=>a.furnitureRole===p.role);return item?[{...p,asset:item.asset}]:[];});
 for(const item of items.filter(a=>a.collectionSlot==='pantry'||a.collectionSlot==='arcade')){
  const parent=item.supportedBy?items.find(p=>p.furnitureRole===item.supportedBy):item;
  approach(plan,item,parent.x,parent.y+35);
 }
 return plan;
}

function arrangeConversationGroup(plan){
 const living=plan.rooms.find(r=>r.id==='living'),table=plan.items.find(a=>a.furnitureRole==='coffee-table'),chair=plan.items.find(a=>a.collectionSlot==='reading-chair'&&a.roomId==='living');
 living.focalPoint={x:table.x,y:table.y-50};
 if(!plan.wide||!chair)return;
 const side=living.side==='left'?1:-1,center={x:table.x+side*(table.w/2+100),y:table.y-14};
 Object.assign(chair,furnitureAtGroundCenter(getApartmentAsset(plan.resident.id,'reading-chair'),{...chair,rotation:side===1?90:270},center),{designRole:'conversation-seat'});
 approach(plan,chair,center.x-side*58,center.y);
 const lamp=plan.items.find(a=>a.collectionSlot==='floor-lamp'&&a.roomId==='living');
 if(lamp){
  const at={x:center.x+side*96,y:center.y+32};
  Object.assign(lamp,furnitureAtGroundCenter(getApartmentAsset(plan.resident.id,'floor-lamp'),{...lamp,rotation:side===1?180:0},at),{designRole:'reading-task-light'});
  plan.taskLights=[{x:center.x,y:center.y-96,r:150}];
 }
}

/** Pure authored room and furnishing data, independent of the canvas/catalog. */
export function createApartmentHomePlan(resident){
 if(!resident||resident.id==='player')return null;
 const wide=resident.floor>=7,width=wide?2304:1088,variant=variants[resident.index%variants.length],finishes=finishFor(resident);
 const plan={resident,wide,width,height:1120,variant:variant.id,furnitureTheme:homeThemes[resident.id]||'midcentury-studio',finishes,rooms:[],walls:[],doors:[],items:[],fixtureApproaches:[],spawn:{x:width/2,y:975},home:{x:width/2,y:wide?750:650}};
 for(const role of ['bedroom','bathroom','kitchen','living'])plan.rooms.push(areaFor(role,variant[role],width,wide));
 for(const area of plan.rooms){if(['bedroom','bathroom'].includes(area.id))privateRoom(plan,area,finishes);({bedroom,bathroom,kitchen,living}[area.id])(plan,area,finishes);}
 const music={id:'music',name:'Personal music alcove',functionalRole:'music',...rect((wide?1000:452),112,wide?304:184,210),point:{x:width/2,y:338},floorFinish:finishes.wood};plan.rooms.push(music);
 plan.items.push({asset:resident.instruments[0],furnitureRole:'signature-instrument',purpose:'instrument',x:width/2,y:250,w:wide?232:164,h:null,solid:true,roomId:'music'});
 add(plan,'starburst-clock','music-clock',width/2,102,.64,{roomId:'music',solid:false,supportedBy:'north-wall'});
 if(variant.reading){
  const area=areaFor('reading',variant.reading,width,wide);area.point={x:area.x+area.w-52,y:area.y+90};area.floorFinish=finishes.wood;plan.rooms.push(area);
  add(plan,'checkered-beanbag','reading-beanbag',area.x+110,area.y+120,.95,{roomId:area.id});add(plan,'low-bookcase','reading-books',area.x+area.w-120,area.y+100,.75,{roomId:area.id});
 }
 return personalizeHome(plan);
}

/** Build the existing interior scene shape; the player apartment stays owned
 * by its original builder so purchased furniture and decor bounds never move.
 */
export function buildApartmentHome(residentId,{residents=defaultResidents,shell,room,wall,addItem,rug,sign,light,windowAt,zone}={}){
 if(residentId==='player')return null;
 const resident=residents.find(r=>r.id===residentId);if(!resident)return null;
 const plan=createApartmentHomePlan(resident),f=plan.finishes;
 const s=shell(`apartment-${residentId}`,`${resident.name} · ${resident.theme}`,plan.width,plan.height,f.accent,resident.trim);
 s.kind='apartment';s.floor=resident.floor;s.resident=residentId;s.residentInfo=resident;s.homePlan=plan;s.spawn={...plan.spawn};s.privacyDoors=plan.doors.map(d=>({...d}));
 for(const area of plan.rooms){room(s,area.name,area.x,area.y,area.w,area.h,area.id==='bathroom'?'tile':'wood');Object.assign(s.rooms.at(-1),area);}
 for(const r of plan.walls){wall(s,r.x,r.y,r.w,r.h);Object.assign(s.walls.at(-1),{color:f.accent,trim:resident.trim});}
 for(const spec of plan.items){const item=addItem(s,spec.asset,spec.x,spec.y,spec.w,spec.h,spec.solid,spec.rotation||0);Object.assign(item,spec,{h:item.h});}
 // The collection contains this home's one deliberately designed rug.
 for(const x of plan.wide?[220,plan.width-220]:[190,plan.width-190])windowAt(s,x,20,150);
 sign(s,resident.number,plan.width/2,98,22);sign(s,resident.theme,plan.width/2,1074,22);
 s.actors.push({id:residentId,name:resident.name,...plan.home,facing:'down'});
 s.zones.push(zone('resident',`Talk to ${resident.name}`,plan.home.x-80,plan.home.y-70,160,180,'resident',{resident:residentId}));
 s.zones.push(zone('hall','Return to the hall',plan.width/2-105,910,210,175,'exit',{floor:resident.floor}));
 light(s,plan.width/2,840,300);for(const area of plan.rooms.filter(a=>a.id!=='music'))light(s,area.x+area.w/2,area.y+area.h/2,230);
 for(const task of plan.taskLights||[])light(s,task.x,task.y,task.r);
 return s;
}
