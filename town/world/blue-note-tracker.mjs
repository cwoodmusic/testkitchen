import {flyingNotePose} from './rhythm-hunt-motion.mjs?v=town-store-halls-1';

export const BLUE_NOTE_TRACKER_RANGE_SCREENS=1.5;
export const BLUE_NOTE_TRACKER_MIN_RADIUS=50;
const BODY_CENTER_HEIGHT=55;

/** Find a nearby fairy of one color on an invisible body orbit. */
function noteTrackerPose(color,{player,playerZ=0,tokens=[],time=0,cam,width,height,reducedMotion=false,getHeight=token=>token.z||0}={}){
 const zoom=cam?.zoom;
 if(!Number.isFinite(player?.x)||!Number.isFinite(player?.y)||!Number.isFinite(zoom)||zoom<=0||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null;
 const anchor={x:player.x,y:player.y-(Number.isFinite(playerZ)?playerZ:0)-BODY_CENTER_HEIGHT};
 let nearest=null;
 for(const token of tokens){
  if(token?.color!==color||!Number.isFinite(token.x)||!Number.isFinite(token.y))continue;
  const z=getHeight(token),point=flyingNotePose({...token,phase:Number.isFinite(token.phase)?token.phase:0},Number.isFinite(time)?time:0,Number.isFinite(z)?z:0,reducedMotion);
  const dx=(point.x-anchor.x)*zoom,dy=(point.y-anchor.y)*zoom,screenDistance=Math.hypot(dx/width,dy/height),distanceSquared=dx*dx+dy*dy;
  if(screenDistance>BLUE_NOTE_TRACKER_RANGE_SCREENS||nearest&&distanceSquared>=nearest.distanceSquared)continue;
  nearest={token,point,dx,dy,screenDistance,distanceSquared};
 }
 if(!nearest||nearest.distanceSquared<1e-8)return null;
 const angle=Math.atan2(nearest.dy,nearest.dx),radius=Math.max(BLUE_NOTE_TRACKER_MIN_RADIUS,BODY_CENTER_HEIGHT*zoom+8),worldRadius=radius/zoom;
 return {targetId:nearest.token.id,angle,x:anchor.x+Math.cos(angle)*worldRadius,y:anchor.y+Math.sin(angle)*worldRadius,anchor,target:nearest.point,zoom,radius,distanceScreens:nearest.screenDistance,distancePixels:Math.sqrt(nearest.distanceSquared)};
}

export function blueNoteTrackerPose(options){return noteTrackerPose('blue',options);}
export function goldNoteTrackerPose(options){return noteTrackerPose('yellow',options);}

/** The caller already applies the world camera; only the arrow keeps CSS size. */
function drawNoteTracker(c,pose,fill,stroke){
 if(!pose)return null;
 c.save();c.translate(pose.x,pose.y);c.scale(1/pose.zoom,1/pose.zoom);c.rotate(pose.angle);c.lineJoin='round';c.lineWidth=2;
 c.beginPath();c.moveTo(9,0);c.lineTo(-7,-5.5);c.lineTo(-3,0);c.lineTo(-7,5.5);c.closePath();c.fillStyle=fill;c.strokeStyle=stroke;c.fill();c.stroke();c.restore();
 return pose;
}

export function drawBlueNoteTracker(c,options){return drawNoteTracker(c,blueNoteTrackerPose(options),'#69d2ff','#173f6d');}
export function drawGoldNoteTracker(c,options){return drawNoteTracker(c,goldNoteTrackerPose(options),'#f4cc55','#795521');}
