/** Art-fitted floor plans. The story graph, supplies and door identities stay separate. */
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const box=(id,x,y,width,height)=>({id,x,y,width,height});
const contour=(id,depth,points)=>({id,depth,clipPath:`path(evenodd,'M${points.map(point=>point.join(',')).join(' L')}Z')`});
const rectangle=(id,x,y,width,height)=>contour(id,y+height,[[x+4,y],[x+width-4,y],[x+width,y+4],[x+width,y+height-4],[x+width-4,y+height],[x+4,y+height],[x,y+height-4],[x,y+4]]);
const wallProp=(x,y,width,height,tx,ty,ax,ay)=>({rect:{x,y,width,height},target:{x:tx,y:ty,approach:{x:ax,y:ay},range:Math.ceil(Math.hypot(tx-ax,ty-ay))+20},base:null});

export const ROOM_LAYOUT_REVISION='varied-layouts-1';
export const ROOM_LAYOUTS=freeze({
 'garden-fork':{
  kind:'planter-loop',actors:{nell:{x:440,y:560},iris:{x:1040,y:480},pip:{x:1070,y:750}},
  obstacles:[box('layout-living-planter',582,490,372,214)],
  occluders:[contour('layout-living-planter',704,[[584,497],[631,497],[647,479],[663,485],[672,472],[687,479],[706,482],[717,493],[769,497],[784,483],[805,488],[818,480],[838,489],[849,478],[879,479],[894,488],[916,497],[952,497],[955,699],[949,704],[586,704],[581,696]])],
 },
 'workshop-fork':{
  kind:'staggered-workbays',actors:{nell:{x:440,y:650},iris:{x:865,y:480},pip:{x:1110,y:780}},
  obstacles:[box('layout-west-workbay',396,446,399,87),box('layout-east-workbay',785,603,383,90)],
  occluders:[rectangle('layout-west-workbay',395,441,401,92),rectangle('layout-east-workbay',785,599,384,94)],
 },
 'canal-fork':{
  kind:'two-crossings',actors:{nell:{x:520,y:430},iris:{x:1020,y:450},pip:{x:1090,y:750}},
  obstacles:[box('layout-water-west',245,487,210,166),box('layout-water-middle',645,487,291,166),box('layout-water-east',1127,487,167,166)],
  occluders:[],
 },
 'garden-alcove':{
  kind:'inset-service-nook',
  props:{'garden-alcove-root-cradle':wallProp(1200,378,250,175,1330,584,1330,650)},
  obstacles:[box('layout-root-service-wall',1032,285,456,300)],
  occluders:[contour('layout-root-service-wall',585,[[1033,199],[1513,199],[1513,578],[1506,585],[1066,585],[1052,576],[1033,544]])],
 },
 'workshop-alcove':{
  kind:'attic-throat',
  props:{'workshop-alcove-wing-wraps':wallProp(1140,378,270,145,1270,550,1270,615)},
  obstacles:[box('layout-west-storage-back',48,280,578,40),box('layout-west-storage-front',48,320,563,230),box('layout-east-storage-back',913,280,575,40),box('layout-east-storage-front',930,320,558,230)],
  occluders:[contour('layout-west-storage',550,[[29,280],[623,280],[623,316],[607,337],[607,545],[598,550],[33,550],[28,543]]),contour('layout-east-storage',550,[[914,280],[1506,280],[1511,543],[1505,550],[940,550],[930,542],[930,338],[914,316]])],
 },
 'canal-final':{
  kind:'bell-balcony',actors:{nell:{x:430,y:440},iris:{x:790,y:550},pip:{x:1110,y:440}},
  removeObstacles:['route-orrery-base','reply-winch-base'],
  obstacles:[box('layout-west-sky-court',48,535,534,443),box('layout-east-sky-court',954,535,534,443),box('route-orrery-base',80,495,210,40),box('reply-winch-base',1280,495,190,40)],
  maskTransforms:{'route-orrery':{from:[53,664,159,218],to:[57,352,156,183]},'map-chest':{from:[202,770,98,108],to:[203,449,99,86]},'reply-winch':{from:[1247,693,251,191],to:[1274,374,213,162]}},
  occluders:[rectangle('layout-west-balustrade',24,534,558,77),rectangle('layout-east-balustrade',954,534,558,77)],
 },
});

/** Refit only artwork that actually moved; original furniture contours stay intact. */
export function fitLayoutOccluders(roomId,masks=[]){
 const layout=ROOM_LAYOUTS[roomId];if(!layout)return masks;
 return [...masks.map(mask=>{
  const fit=layout.maskTransforms?.[mask.id];if(!fit)return mask;
  const [fx,fy,fw,fh]=fit.from,[tx,ty,tw,th]=fit.to;
  const clipPath=mask.clipPath.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g,(_,x,y)=>`${Math.round(tx+(Number(x)-fx)/fw*tw)},${Math.round(ty+(Number(y)-fy)/fh*th)}`);
  const ys=[...clipPath.matchAll(/-?\d+(?:\.\d+)?,(-?\d+(?:\.\d+)?)/g)].map(match=>Number(match[1]));
  return{...mask,clipPath,depth:Math.max(...ys)};
 }),...layout.occluders];
}
