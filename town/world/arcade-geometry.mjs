import '../../arcade-footprint.js';
import {PLAYER_SCALE} from './player-settings.mjs?v=opera-parallax-1';

// Interior pixels and the native avatar use one scale. Authored-town avatars
// are larger, so convert the complete floor shape by that same factor.
export const arcadeFootprint=globalThis.CodaArcadeFootprint;
export const ARCADE_INTERIOR_SCALE=PLAYER_SCALE;
export const ARCADE_WALL=100;
export const arcadeNativeSize={w:arcadeFootprint.width,h:arcadeFootprint.height+ARCADE_WALL};
export function arcadePointFromInterior({x,y}){return {x:x*ARCADE_INTERIOR_SCALE,y:(y+ARCADE_WALL)*ARCADE_INTERIOR_SCALE};}
export function arcadePointToInterior({x,y}){return {x:x/ARCADE_INTERIOR_SCALE,y:y/ARCADE_INTERIOR_SCALE-ARCADE_WALL};}
// Front-most floor edge at a local town X. Use the occupied polygon rather
// than the transparent bottom of the artwork when sorting a foreground actor.
export function arcadeFrontAtX(x){
 const X=x/ARCADE_INTERIOR_SCALE;let front=-Infinity;
 for(const polygon of arcadeFootprint.floorPolys)for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[j],b=polygon[i];if(X<Math.min(a[0],b[0])||X>Math.max(a[0],b[0]))continue;
  if(a[0]===b[0]){if(Math.abs(X-a[0])<1e-8)front=Math.max(front,a[1],b[1]);continue;}
  const t=(X-a[0])/(b[0]-a[0]);front=Math.max(front,a[1]+(b[1]-a[1])*t);
 }
 return Number.isFinite(front)?(front+ARCADE_WALL)*ARCADE_INTERIOR_SCALE:null;
}
const f=arcadeFootprint,s=ARCADE_INTERIOR_SCALE;
export const arcadeGeometry={
 w:Math.ceil(arcadeNativeSize.w*s),h:Math.ceil(arcadeNativeSize.h*s),
 polygons:f.floorPolys.map(p=>p.map(([x,y])=>{const q=arcadePointFromInterior({x,y});return [q.x,q.y];})),
 door:arcadePointFromInterior(f.entrance),
 bounds:{x:f.bounds.x*s,y:(f.bounds.y+ARCADE_WALL)*s,w:f.bounds.w*s,h:f.bounds.h*s},
 interiorScale:s,frontAtX:arcadeFrontAtX
};
