import {getShowroomNavigation} from './showroom-navigation.mjs?v=town-wide-rooms-1';

const cache=new WeakMap(),MAX_ROUTES=32;
const finite=Number.isFinite;
const point=p=>p&&finite(p.x)&&finite(p.y);
const same=(a,b)=>a.x===b.x&&a.y===b.y;

/** Share the existing six-pixel-clearance router without changing room data. */
export function getApartmentNavigation(scene,from,to){
 if(!scene||typeof scene!=='object'||!point(from)||!point(to))return null;
 let saved=cache.get(scene);
 if(!saved||saved.revision!==scene.layoutRevision||saved.solids!==scene.solids||saved.width!==scene.width||saved.height!==scene.height){
  saved={revision:scene.layoutRevision,solids:scene.solids,width:scene.width,height:scene.height,routes:new Map()};cache.set(scene,saved);
 }
 const key=[from.x,from.y,to.x,to.y].join(':');if(saved.routes.has(key))return saved.routes.get(key);
 const outRoute=Object.freeze([Object.freeze({x:from.x,y:from.y}),Object.freeze({x:to.x,y:to.y})]),plan={...scene,spawn:outRoute[0],layoutRevision:scene.layoutRevision??0,showroom:{apartment:{browse:outRoute[1],visitRoute:outRoute,exitRoute:[...outRoute].reverse()}}};
 const navigation=getShowroomNavigation(plan);
 // A resident must reach the actual door and home point; a nearby fallback
 // accepted for a showroom browsing target is not a valid scene transition.
 const result=navigation&&same(navigation.visitRoute[0],from)&&same(navigation.visitRoute.at(-1),to)?Object.freeze({outRoute:navigation.visitRoute,homeRoute:navigation.exitRoute}):null;
 if(saved.routes.size>=MAX_ROUTES)saved.routes.delete(saved.routes.keys().next().value);
 saved.routes.set(key,result);return result;
}
