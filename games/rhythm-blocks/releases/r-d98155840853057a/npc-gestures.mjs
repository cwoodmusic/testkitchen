/** Dedicated forward faceplants. Pose art is anchored at the rear heel, not its bounding box. */
import {CAST,CAST_IMAGE,NPC_WALKS} from './cast.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const equal=(left,right)=>Array.isArray(left)&&Array.isArray(right)&&left.length===right.length&&left.every((value,index)=>Array.isArray(value)?equal(value,right[index]):value===right[index]);
const POSES=['stumble','prone','pushup'];
const DIRECTIONS=['down','left','right','up'];

export const PIP_FORWARD_FALL=freeze({
 image:'assets/pip-forward-fall.webp',cellWidth:362,cellHeight:362,
 directions:DIRECTIONS,poses:POSES,
 anchors:[[[0.522099,0.922652],[0.480663,0.472376],[0.491713,0.831492]],[[0.621547,0.88674],[0.848066,0.773481],[0.767956,0.812155]],[[0.389503,0.823204],[0.132597,0.718232],[0.21547,0.78453]],[[0.522099,0.845304],[0.480663,0.853591],[0.480663,0.845304]]],
 headAnchors:[[[0.51105,0.168508],[0.480663,0.549724],[0.494475,0.245856]],[[0.450276,0.174033],[0.345304,0.38674],[0.417127,0.209945]],[[0.58011,0.099448],[0.60221,0.325967],[0.593923,0.149171]],[[0.513812,0.063536],[0.48895,0.198895],[0.480663,0.124309]]],
});

function stockPip(project,actor){
 const sprite=project?.cast?.[actor?.character],stock=CAST.pip,walk=NPC_WALKS.pip;
 if(actor?.character!=='pip'||!sprite||sprite.forwardFall===false||sprite.walk===false)return false;
 if(project.settings?.castImage!==CAST_IMAGE||sprite.column!==stock.column||sprite.row!==stock.row||!equal(sprite.anchor,stock.anchor))return false;
 return sprite.walk===undefined||sprite.walk?.image===walk.image&&sprite.walk.cellWidth===walk.cellWidth&&sprite.walk.cellHeight===walk.cellHeight&&equal(sprite.walk.directions,walk.directions)&&equal(sprite.walk.anchors,walk.anchors);
}

/** Short crossfades between real poses avoid spinning an upright sprite onto its side. */
export function forwardFallBlend(gesture,progress=0){
 const p=clamp(Number.isFinite(progress)?progress:0,0,1);
 if(gesture==='trip'){
  if(p<.2)return{from:'standing',to:'stumble',amount:p/.2};
  if(p<.52)return{from:'stumble',to:'stumble',amount:0};
  return{from:'stumble',to:'prone',amount:(p-.52)/.48};
 }
 if(gesture==='fallen')return{from:'prone',to:'prone',amount:0};
 if(gesture==='recover')return p<.48?{from:'prone',to:'pushup',amount:p/.48}:{from:'pushup',to:'standing',amount:(p-.48)/.52};
 return null;
}

/** Read-only visual metadata; logical feet and collision never change. */
export function getNpcForwardFall({project,actor,pose=actor,standingSprite}={}){
 if(!stockPip(project,actor))return null;
 const blend=forwardFallBlend(pose?.gesture,pose?.gestureProgress);if(!blend)return null;
 const facing=DIRECTIONS.includes(pose?.facing)?pose.facing:DIRECTIONS.includes(actor.facing)?actor.facing:'down';
 const row=DIRECTIONS.indexOf(facing),size=Number.isFinite(actor.worldSize)&&actor.worldSize>0?actor.worldSize:160;
 const standingAnchor=standingSprite?.anchor??NPC_WALKS.pip.anchors[row][0];
 const describe=name=>{
  if(name==='standing')return{pose:name,head:{x:(.5-standingAnchor[0])*size,y:(.12-standingAnchor[1])*size}};
  const frame=POSES.indexOf(name),anchor=PIP_FORWARD_FALL.anchors[row][frame],head=PIP_FORWARD_FALL.headAnchors[row][frame];
  return{pose:name,frame,row,anchor,head:{x:(head[0]-anchor[0])*size,y:(head[1]-anchor[1])*size},image:PIP_FORWARD_FALL.image,backgroundSize:'300% 400%',backgroundPosition:`${frame*50}% ${row*100/3}%`,aspectRatio:1};
 };
 const from=describe(blend.from),to=describe(blend.to),mix=blend.amount,layers=[];
 let standingOpacity=0;
 for(const [description,opacity]of blend.from===blend.to?[[from,1]]:[[from,1-mix],[to,mix]]){
  if(description.pose==='standing')standingOpacity+=opacity;
  else layers.push({...description,opacity});
 }
 return freeze({mode:'forward-fall',facing,gesture:pose.gesture,progress:clamp(Number.isFinite(pose.gestureProgress)?pose.gestureProgress:0,0,1),pose:mix<.5?blend.from:blend.to,standingOpacity,layers,
  head:{x:from.head.x+(to.head.x-from.head.x)*mix,y:from.head.y+(to.head.y-from.head.y)*mix}});
}
