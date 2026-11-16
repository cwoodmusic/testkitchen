/** Directional sprite selection; animation never changes an actor's feet. */
import {CAST,CAST_IMAGE,NPC_WALKS} from './cast.mjs';

const FACINGS=new Set(['down','left','right','up']);
const equal=(left,right)=>Array.isArray(left)&&Array.isArray(right)&&left.length===right.length&&left.every((value,index)=>Array.isArray(value)?equal(value,right[index]):value===right[index]);
const sameWalk=(walk,stock)=>walk&&stock&&walk.image===stock.image&&walk.cellWidth===stock.cellWidth&&walk.cellHeight===stock.cellHeight&&equal(walk.directions,stock.directions)&&equal(walk.anchors,stock.anchors);
function walkDefinition(project,character,sprite){
 const stock=CAST[character],walk=sprite.walk;
 if(walk===false)return null;
 // Older saved projects have only the portrait fields. Inherited stock walk
 // metadata is likewise a fallback, so changing the global artwork still works.
 const stockPortrait=stock&&project.settings.castImage===CAST_IMAGE&&sprite.column===stock.column&&sprite.row===stock.row&&equal(sprite.anchor,stock.anchor);
 if(walk&&!sameWalk(walk,NPC_WALKS[character]))return walk;
 return stockPortrait?(walk||NPC_WALKS[character]):null;
}

export function getNpcSpriteFrame({project,actor,pose=actor,elapsed=0}){
 const sprite=project.cast[actor.character],walk=walkDefinition(project,actor.character,sprite);
 const facing=FACINGS.has(pose.facing)?pose.facing:FACINGS.has(actor.facing)?actor.facing:'down';
 if(!walk)return{image:project.settings.castImage,backgroundSize:'200% 200%',backgroundPosition:`${sprite.column*100}% ${sprite.row*100}%`,anchor:sprite.anchor,frame:0,row:sprite.row,facing,animated:false,aspectRatio:1};
 const row=Math.max(0,walk.directions.indexOf(facing)),phase=Number.isFinite(elapsed)?Math.max(0,elapsed):0;
 const frame=pose.moving?[1,0,2,0][Math.floor(phase/125)%4]:0;
 return{image:walk.image,backgroundSize:'300% 400%',backgroundPosition:`${frame*50}% ${row*100/3}%`,anchor:walk.anchors[row][frame],frame,row,facing,animated:true,aspectRatio:walk.cellWidth/walk.cellHeight};
}
