import {height} from './model.mjs?v=opera-parallax-1';
import {findFishingDock} from './town-game-rules.mjs?v=town-games-1';
import {mountGameStyles,createTownJournal,gameButton} from './town-game-audio.mjs?v=town-games-1';
import {createRhythmCatch} from './rhythm-catch.mjs?v=town-games-1';
import {createTownFishing} from './town-fishing.mjs?v=town-games-1';
export function createTownActivities({canvas,getProject,getPlayer,getResidents,getOwner,catalog}){
 mountGameStyles();const journal=createTownJournal(getOwner),rhythm=createRhythmCatch({canvas,getProject,getPlayer,catalog,journal}),fishing=createTownFishing({canvas,journal});let doc=null,dock=null,owner=getOwner?.();
 const host=()=>{const vendors=(getResidents?.(null)||[]).filter(a=>a.role==='vendor'&&!a.hidden);return vendors.find(a=>a.asset==='decor-07-06')||vendors[0];};
 function refresh(){if(doc===getProject())return;doc=getProject();dock=findFishingDock(doc,catalog);}
 function nearDock(){refresh();const p=getPlayer();return p&&dock&&Math.hypot(p.x-dock.stand.x,p.y-dock.stand.y)<190;}
 function end(){rhythm.end();fishing.end();doc=null;dock=null;}
 function tick(){if(getOwner?.()!==owner){end();owner=getOwner?.();}if(doc&&doc!==getProject()){end();}refresh();rhythm.tick();fishing.tick();}
 function draw(c,cam,w,h,time){refresh();c.save();c.translate(w/2,h/2);c.scale(cam.zoom,cam.zoom);c.translate(-cam.x,-cam.y);
  if(dock){const b=dock.boat,p=dock.stand,z=height(doc,p.x,p.y);if(b.virtual){c.save();c.translate(b.x,b.y);c.fillStyle='#382d29';c.beginPath();c.moveTo(-67,-35);c.quadraticCurveTo(-80,15,0,44);c.quadraticCurveTo(80,15,67,-35);c.closePath();c.fill();c.strokeStyle='#d6ad73';c.lineWidth=7;c.stroke();c.fillStyle='#b88e5c';c.fillRect(-55,-27,110,13);c.fillRect(-45,5,90,12);c.restore();}
   c.fillStyle='#113c3be8';c.strokeStyle='#efcd84';c.lineWidth=2;c.beginPath();c.roundRect(p.x-83,p.y-z-155,166,39,12);c.fill();c.stroke();c.font='bold 16px system-ui';c.textAlign='center';c.fillStyle='#fff0b9';c.fillText('RHYTHM FISHING',p.x,p.y-z-130);
  }
  const vendor=host();if(vendor&&!rhythm.active&&!fishing.active){const y=vendor.y-height(doc,vendor.x,vendor.y)-168;c.fillStyle='#143f36eb';c.strokeStyle='#9ae1c2';c.lineWidth=2;c.beginPath();c.roundRect(vendor.x-89,y-25,178,35,10);c.fill();c.stroke();c.font='bold 15px system-ui';c.textAlign='center';c.fillStyle='#fff0b9';c.fillText('♩ RHYTHM CATCH',vendor.x,y-2);}
  rhythm.draw(c,cam,time);c.restore();
 }
 function offerVendor(actor,parent,close){if(actor.id!==host()?.id)return;const p=document.createElement('p');p.textContent='Got sharp ears? Borrow my big net, catch the floating notes around town, and build the rhythm I play!';parent.append(p);parent.append(gameButton('Play Rhythm Catch',()=>{close();rhythm.start(actor);},'town-vendor-game'));}
 function keydown(e){return rhythm.active?rhythm.keydown(e):fishing.active?fishing.keydown(e):false;}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){rhythm.pause();fishing.pause();}});window.addEventListener('blur',()=>rhythm.pause());
 return {offerVendor,keydown,tick,draw,end,pointer:e=>rhythm.pointer(e),interact(){if(rhythm.active||fishing.active)return true;if(nearDock()){fishing.start();return true;}return false;},get active(){return rhythm.active||fishing.active;},get blocked(){return rhythm.blocked||fishing.active;},get prompt(){if(this.active)return '';if(nearDock())return 'E · Board boat · Rhythm Fishing';return '';},get state(){return {player:getPlayer()?{...getPlayer()}:null,rhythmCatch:rhythm.state,fishing:fishing.state,dock:dock?structuredClone(dock):null};}};
}
