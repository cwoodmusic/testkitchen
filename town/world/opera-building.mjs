// The floor plate is shared with the concert-hall interior. The exterior is
// padded independently so its tall sails never change that playable scale.
export const OPERA_FOOTPRINT=Object.freeze({x:256,y:80,w:4096,h:2560});

const native=Object.freeze({w:1448,h:1086});
const artwork=Object.freeze({x:256,y:180,w:4096,h:3072});
const nativePoint=([x,y])=>Object.freeze([artwork.x+x*artwork.w/native.w,artwork.y+y*artwork.h/native.h]);
const polygon=points=>Object.freeze(points.map(p=>Object.freeze(p)));

// Chamfer the rear corners instead of blocking the large transparent gaps
// beside the sails. Only the masonry side parapets extend past the foyer;
// the broad front staircase remains an ordinary, walkable ground approach.
const body=polygon([[1280,80],[2816,80],[4352,1408],[4352,2496],[4184,2640],[424,2640],[256,2496],[256,1408]]);
const westParapet=Object.freeze([[56,1028],[92,1028],[93,998],[190,921],[217,871],[190,871],[72,966],[57,986]].map(nativePoint));
const eastParapet=Object.freeze([[1393,1028],[1356,1028],[1354,998],[1258,921],[1231,871],[1258,871],[1376,966],[1393,986]].map(nativePoint));
const masonry=Object.freeze([body,westParapet,eastParapet]);
// Follow the metal post bases on the stair plane, rather than their elevated
// handrail tops. Wide base plates remain solid and the stair lanes stay open.
function handrailBase(points){
 const first=points[0],last=points.at(-1);
 return Object.freeze([[first[0],first[1]+5],...points.map(([x,y])=>[x+8,y]),[last[0],last[1]-5],...points.toReversed().map(([x,y])=>[x-8,y])].map(nativePoint));
}
const westRail=handrailBase([[383,977],[429,936],[462,909],[489,889]]);
const eastRail=handrailBase([[1065,977],[1018,936],[985,910],[958,889]]);
const polygons=Object.freeze([...masonry,westRail,eastRail]);

function frontAtX(x){
 let front=-Infinity;
 // The opaque stair field is a floor. Slender rails must not make its whole
 // vertical artwork strip hide people who are standing on that floor.
 for(const points of masonry)for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[j],b=points[i];
  if(x<Math.min(a[0],b[0])||x>Math.max(a[0],b[0]))continue;
  if(a[0]===b[0]){if(x===a[0])front=Math.max(front,a[1],b[1]);continue;}
  front=Math.max(front,a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]));
 }
 return Number.isFinite(front)?front:null;
}

const emitter=(x,y,kind,radius,power=1,extra={})=>Object.freeze({u:(artwork.x+x*artwork.w/native.w)/4608,v:(artwork.y+y*artwork.h/native.h)/3328,kind,radius,power,color:Object.freeze([255,202,128]),...extra});
const lightEmitters=Object.freeze([
 emitter(194,658,'window',300,.85),emitter(321,689,'window',280,.8),
 emitter(561,705,'window',300,.85),emitter(718,652,'window',360,.95),emitter(879,705,'window',300,.85),
 emitter(1114,684,'window',280,.8),emitter(1265,659,'window',300,.85),
 emitter(293,817,'window',300,.9),emitter(1157,817,'window',300,.9),
 emitter(718,830,'door',430,1),
 ...[105,393,438,1012,1057,1365].map((x,i)=>emitter(x,i===0||i===5?844:851,'uplight',280,.88,{groundV:(artwork.y+861*artwork.h/native.h)/3328,beamHeight:420,beamWidth:145}))
]);

export const OPERA_BUILDING=Object.freeze({
 id:'sydney-opera-house',name:'Sydney Opera House · concert hall',group:'landmarks',
 w:4608,h:3328,native,artwork,footprint:OPERA_FOOTPRINT,
 // Door is 32 units in front of the physical facade, at the central glass
 // threshold. Returning from a performance therefore cannot trap a player.
 door:Object.freeze({x:2304,y:2672}),
 entranceProjection:Object.freeze({x:2304,y:2672}),
 approach:Object.freeze({x:2304,y:3032}),
 front:2640,boxes:Object.freeze([]),polygons,depthPolygons:masonry,frontAtX,lightEmitters,
 urban:'opera',kit:'urban',facing:'south',fixedScale:true,collisionDefault:true,
 image:'../assets/opera/sydney-opera-house.png'
});

export async function registerOperaBuilding(add){
 const def=OPERA_BUILDING,image=new Image();
 await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Could not load the Sydney Opera House exterior.'));image.src=new URL(def.image,import.meta.url).href;});
 const asset=add(def.id,def.name,def.group,def.w,def.h,c=>{
  c.imageSmoothingEnabled=false;
  c.drawImage(image,def.artwork.x,def.artwork.y,def.artwork.w,def.artwork.h);
 },[], 'objects');
 Object.assign(asset,{
  urban:def.urban,kit:def.kit,facing:def.facing,fixedScale:def.fixedScale,
  collisionDefault:def.collisionDefault,footprint:def.footprint,door:def.door,
  entranceProjection:def.entranceProjection,approach:def.approach,
  polygons:def.polygons,depthPolygons:def.depthPolygons,frontAtX:def.frontAtX,lightEmitters:def.lightEmitters
 });
 return asset;
}
