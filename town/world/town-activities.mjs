import {drawPierOccludedActor} from './pier-actor-occlusion.mjs?v=town-coast-pier-1';
import {groundTexture} from './ground-render.mjs?v=town-library-review-1';
import {canBoardFishingDock} from './outdoor-actor-layer.mjs?v=town-coast-pier-1';
import {netToolPose,netVisualPose} from './rhythm-hunt-motion.mjs?v=town-store-halls-1';
import {drawRhythmNet} from './rhythm-net-render.mjs?v=town-store-halls-1';
import {height,actorHeight} from './model.mjs?v=town-coast-pier-1';
import {findFishingDock} from './town-game-rules.mjs?v=town-coast-pier-1';
import {mountGameStyles,createTownJournal,gameButton} from './town-game-audio.mjs?v=town-store-halls-1';
import {createRhythmCatch} from './rhythm-catch.mjs?v=town-gold-tracker-1';
import {createNoteInventory} from './note-inventory.mjs?v=town-store-halls-1';
import {createYellowNoteCatch} from './yellow-note-catch.mjs?v=town-gold-tracker-1';
import {createNPCRhythmRequests} from './npc-rhythm-requests.mjs?v=town-coast-pier-1';
import {createTownFishing} from './town-fishing.mjs?v=town-coast-pier-1';
export function createTownActivities({canvas,getProject,getPlayer,getFacing,setFacing,getResidents,getOwner,getScene=()=>null,isConversationOpen=()=>false,catalog}){
 let netEquipped=false,netFrame=null;const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');mountGameStyles();const journal=createTownJournal(getOwner),inventory=createNoteInventory(journal),requests=createNPCRhythmRequests({canvas,journal,inventory});
 const yellow=createYellowNoteCatch({canvas,getProject,getPlayer,getFacing,setFacing,catalog,inventory,isEquipped:()=>netEquipped,getLimit:()=>Math.max(0,5-rhythm.fairyCount),canUseNet:()=>!getScene()&&!isConversationOpen()&&!rhythm.active&&!fishing.active&&!requests.active});
 const rhythm=createRhythmCatch({canvas,getProject,getPlayer,getFacing,setFacing,catalog,journal,isEquipped:()=>netEquipped,onExtraSweep:(...args)=>yellow.catchAlongSweep(...args)}),fishing=createTownFishing({canvas,journal,getProject,getPlayer,getOwner,catalog});let doc=null,dock=null,owner=getOwner?.();
 const host=()=>{const vendors=(getResidents?.(null)||[]).filter(a=>a.role==='vendor'&&!a.hidden);return vendors.find(a=>a.asset==='decor-07-06')||vendors[0];};
 function refresh(){if(doc===getProject())return;doc=getProject();dock=findFishingDock(doc,catalog);}
 function nearDock(){refresh();return canBoardFishingDock(doc,getPlayer(),dock);}
 function end(){netFrame=null;rhythm.end();fishing.end();requests.end();yellow.reset();doc=null;dock=null;}
 function tick(keys,dt){netFrame=null;if(getOwner?.()!==owner){netEquipped=false;end();owner=getOwner?.();}if(doc&&doc!==getProject()){netEquipped=false;end();}refresh();rhythm.tick();requests.tick();fishing.tick(keys,dt);if(!getScene()&&!isConversationOpen()&&!fishing.active&&!requests.fullscreen&&!rhythm.fullscreen)yellow.tick(keys,dt);else yellow.hide();}
 // Keep the hand, rear pass and front pass on the same animation sample. The
 // rear pass runs inside the player's sorted world draw, before the body.
 function captureNet(){
  netFrame=null;if(!netEquipped||getScene()||isConversationOpen()||fishing.active||requests.active)return null;
  const stroke=rhythm.active?rhythm.netStroke:yellow.netStroke,p=getPlayer();if(!stroke||!p)return null;
  const player={...p},z=actorHeight(getProject(),p),pose=netVisualPose(player,stroke.angle,stroke.age,z);
  return netFrame={player,stroke,z,pose,tool:netToolPose(player,stroke.angle,stroke.age,z)};
 }
 function paintNet(c,frame){drawRhythmNet(c,frame.player,{...frame.stroke,z:frame.z,reducedMotion:motionQuery.matches});}
 function drawNetBehind(c){const frame=netFrame||captureNet();if(frame?.pose.layer==='behind')paintNet(c,frame);}
 function draw(c,cam,w,h,time){refresh();c.save();c.translate(w/2,h/2);c.scale(cam.zoom,cam.zoom);c.translate(-cam.x,-cam.y);
  if(dock&&!fishing.active){const b=dock.boat,p=dock.stand,z=height(doc,p.x,p.y);if(b.virtual){c.save();c.translate(b.x,b.y);c.fillStyle='#382d29';c.beginPath();c.moveTo(-67,-35);c.quadraticCurveTo(-80,15,0,44);c.quadraticCurveTo(80,15,67,-35);c.closePath();c.fill();c.strokeStyle='#d6ad73';c.lineWidth=7;c.stroke();c.fillStyle='#b88e5c';c.fillRect(-55,-27,110,13);c.fillRect(-45,5,90,12);c.restore();}
   c.fillStyle='#113c3be8';c.strokeStyle='#efcd84';c.lineWidth=2;c.beginPath();c.roundRect(p.x-83,p.y-z-155,166,39,12);c.fill();c.stroke();c.font='bold 16px system-ui';c.textAlign='center';c.fillStyle='#fff0b9';c.fillText('RHYTHM FISHING',p.x,p.y-z-130);
  }
  const vendor=host();if(vendor&&!rhythm.active&&!fishing.active){const y=vendor.y-height(doc,vendor.x,vendor.y)-168;c.fillStyle='#143f36eb';c.strokeStyle='#9ae1c2';c.lineWidth=2;c.beginPath();c.roundRect(vendor.x-89,y-25,178,35,10);c.fill();c.stroke();c.font='bold 15px system-ui';c.textAlign='center';c.fillStyle='#fff0b9';c.fillText('♩ BLUE NOTE CHALLENGE',vendor.x,y-2);}
  if(!fishing.active)yellow.draw(c,cam,time,{net:false});rhythm.draw(c,cam,time,{net:false});const frame=netFrame||captureNet();if(frame?.pose.layer==='front'){if(frame.player.underPier)drawPierOccludedActor(c,doc,frame.player,ink=>paintNet(ink,frame),groundTexture('wood'));else paintNet(c,frame);}fishing.draw(c,cam,w,h,time);c.restore();
 }
 function offerVendor(actor,parent,close){if(actor.id!==host()?.id){requests.offer(actor,parent,close);return;}const p=document.createElement('p');p.textContent='Can you catch a rhythm by ear? Find my four blue cards and bring them back to build what you heard. You have five minutes. Yellow cards stay in your inventory for your neighbours’ requests.';parent.append(p);parent.append(gameButton('Play Rhythm Catch',()=>{close();rhythm.start(actor);},'town-vendor-game'));}
 function toggleNet(){if(getScene()||isConversationOpen()||fishing.active||requests.fullscreen||rhythm.fullscreen)return netEquipped;netEquipped=!netEquipped;netFrame=null;rhythm.cancelSwing();yellow.cancelSwing();canvas.focus();return netEquipped;}
 function keydown(e){if(e.key.toLowerCase()==='tab'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!getScene()&&!isConversationOpen()&&!fishing.active&&!requests.fullscreen&&!rhythm.fullscreen){e.preventDefault();if(!e.repeat)toggleNet();return true;}return requests.active?requests.keydown(e):rhythm.active?rhythm.keydown(e):fishing.active?fishing.keydown(e):!getScene()&&!isConversationOpen()?yellow.keydown(e):false;}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){rhythm.pause();requests.pause();fishing.pause();yellow.hide();}});window.addEventListener('blur',()=>{rhythm.pause();requests.pause();yellow.hide();});
 return {offerVendor,keydown,tick,draw,drawNetBehind,end,toggleNet,pointer:e=>fishing.active?fishing.pointer(e):rhythm.active?rhythm.pointer(e):yellow.pointer(e),interact(){if(requests.active)return true;if(rhythm.active)return rhythm.interact();if(fishing.active)return fishing.interact();if(nearDock()){fishing.start(dock);return true;}return false;},get active(){return rhythm.active||fishing.active||requests.active;},get fullscreen(){return rhythm.fullscreen||fishing.fullscreen||requests.fullscreen;},get blocked(){return rhythm.blocked||fishing.blocked||requests.blocked;},get netEquipped(){return netEquipped;},get netFacing(){return netEquipped?(rhythm.swingFacing||yellow.swingFacing):null;},get netToolPose(){return (netFrame||captureNet())?.tool||null;},get sailing(){return fishing.sailing;},get boatFacing(){return fishing.facing;},get hiddenBoat(){return fishing.active?dock?.boat?.id:null;},get prompt(){if(this.active)return '';if(nearDock())return 'E · Board boat · Rhythm Fishing';return '';},get state(){return {netEquipped,player:getPlayer()?{...getPlayer()}:null,rhythmCatch:rhythm.state,yellowNotes:yellow.state,npcRhythmRequest:requests.state,fishing:fishing.state,dock:dock?structuredClone(dock):null};}};
}
