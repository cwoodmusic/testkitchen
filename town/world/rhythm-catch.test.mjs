import test from 'node:test';
import assert from 'node:assert/strict';
import {createRhythmCatch} from './rhythm-catch.mjs';
import {netSweepPose,netSweepHits,advanceFlyingNote,flyingNotePose,facingAngle,NET_SWEEP_SECONDS,NET_RECOVERY_SECONDS,NET_STRIKE_FRACTION} from './rhythm-hunt-motion.mjs';
import {noteName} from './town-game-audio.mjs';
import {blocked} from './model.mjs';

class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.dataset={};this.events={};this.open=false;this.hidden=false;this.disabled=false;this.textContent='';this.innerHTML='';this.clientWidth=1200;this.clientHeight=800;this.isConnected=true;}
 append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}
 replaceChildren(...children){this.children=[];this.append(...children);}
 setAttribute(key,value){this.attributes[key]=value;}
 addEventListener(key,callback){this.events[key]=callback;}
 showModal(){this.open=true;}
 close(){this.open=false;}
 focus(){if(globalThis.document)globalThis.document.activeElement=this;}
 contains(node){return node===this||this.all().includes(node);}
 getBoundingClientRect(){return {left:0,top:0,width:this.clientWidth,height:this.clientHeight,right:this.clientWidth,bottom:this.clientHeight};}
 all(){return this.children.flatMap(child=>[child,...child.all()]);}
 matches(selector){if(selector.startsWith('#'))return this.id===selector.slice(1);if(selector.startsWith('.'))return this.className?.split(' ').includes(selector.slice(1));if(selector==='[role="timer"]')return this.attributes.role==='timer';return this.tagName===selector;}
 querySelector(selector){return this.all().find(node=>node.matches(selector))||null;}
 querySelectorAll(selector){return this.all().filter(node=>node.matches(selector));}
 click(){if(!this.disabled)return this.onclick?.();}
}
const drawingContext=()=>new Proxy({globalAlpha:1},{get(target,key){return key in target?target[key]:()=>{};},set(target,key,value){target[key]=value;return true;}});
function fixture(t,{equipped:initialEquipped=true}={}){
 const original={document:globalThis.document,matchMedia:globalThis.matchMedia,performance:globalThis.performance};let time=0;
 const body=new Element('body');globalThis.document={body,activeElement:null,createElement:tag=>new Element(tag)};globalThis.matchMedia=()=>({matches:true});globalThis.performance={now:()=>time*1000};t.after(()=>Object.assign(globalThis,original));
 let project={version:1,cells:{},objects:[],edges:{},spawn:{x:1344,y:1344}};
 for(let i=0;i<43;i++)for(const [x,y]of [[i,0],[i,42],[0,i],[42,i]])project.cells[`${x},${y}`]={surface:'water',level:0};
 const before=JSON.stringify(project),player={...project.spawn},host={id:'vendor',...project.spawn,interaction:{...project.spawn}},catalog=new Map(),canvas=new Element('canvas');let facing='down',equipped=initialEquipped,writes=0,saveOK=true;
 const journal={data:{stars:7,netWins:0,fish:{},yellowNotes:{quarter:20,'eighth-pair':20,'sixteenth-group':20},npcRhythmWins:{bach:2}},save(){writes++;return saveOK;},warning:''};
 const audio={now:0,running:true,tones:[],async unlock(){this.running=true;return true;},get time(){return this.now;},tone(...args){this.tones.push(args);},stop(){},suspend(){this.running=false;},async resume(){this.running=true;}};
 const q=createRhythmCatch({canvas,getProject:()=>project,getPlayer:()=>player,getFacing:()=>facing,setFacing:value=>{facing=value;},isEquipped:()=>equipped,catalog,journal,audio});
 const dialog=body.children.find(node=>node.className?.split(' ').includes('rhythm-catch-dialog')),
  hud=body.children.find(node=>node.className?.split(' ').includes('blue-rhythm-hud'));
 const button=(label,scope=body)=>{const found=scope.all().find(node=>node.tagName==='button'&&(node.textContent===label||node.attributes['aria-label']===label));assert(found,'Missing button: '+label);return found;};
 const event=key=>({key,repeat:false,prevented:false,preventDefault(){this.prevented=true;}});
 const start=async()=>{q.start(host);await Promise.resolve();assert.equal(q.state.phase,'listen');};
 const hunt=async()=>{await start();audio.now+=8;q.tick();assert.equal(q.state.phase,'hunt');assert.equal(q.state.remainingSeconds,300);};
 const step=seconds=>{time+=seconds;if(audio.running)audio.now+=seconds;q.tick();};
 function catchOne(){
  // Prime this frame so the following real swing advances the fairy by the
  // same bounded flight tick that we use to find a legal approach below.
  q.tick();const state=q.state,token=state.tokens[0];assert(token);const visual=flyingNotePose(token,state.flightTime,0,true),flightAt=state.flightTime+.05;
  const offsets=[0,-8,8,-16,16,-24,24,-28,28,-32,32],shifts=offsets.flatMap(x=>offsets.map(y=>({x,y}))).sort((a,b)=>a.x*a.x+a.y*a.y-b.x*b.x-b.y*b.y);
  function clearPath(from,to){
   if(blocked(project,from.x,from.y,catalog))return false;const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/4));let previous=from;
   for(let i=1;i<=steps;i++){const point={x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps};if(blocked(project,point.x,point.y,catalog,previous))return false;previous=point;}return true;
  }
  let pose;
  search:for(const shift of shifts)for(const direction of ['right','left','up','down']){
   const angle=facingAngle(direction),offset=netSweepPose({x:0,y:0},angle,NET_STRIKE_FRACTION),candidate={x:visual.x-offset.x+shift.x,y:visual.y-offset.y+shift.y},next={...token};
   advanceFlyingNote(next,candidate,.05,flightAt,(a,b)=>!blocked(project,b.x,b.y,catalog,a));
   const point=flyingNotePose(next,flightAt,0,true);
   if(clearPath(candidate,next)&&netSweepHits(point,candidate,angle,0,1)){pose={candidate,direction};break search;}
  }
  assert(pose,'A clear approach to the spawned fairy must exist');Object.assign(player,pose.candidate);facing=pose.direction;
  const count=q.state.bag.length;q.keydown(event('f'));step(NET_SWEEP_SECONDS);assert.equal(q.state.bag.length,count+1);step(NET_RECOVERY_SECONDS+.02);
 }
 function vendor(){Object.assign(player,host.interaction);q.interact();assert.equal(q.state.phase,'arrange');}
 function fillTarget(){for(const value of q.state.target)button('Add '+noteName(value),dialog).click();}
 const exitDialog=()=>body.children.find(node=>node.className?.split(' ').includes('rhythm-exit-dialog'));
 return {q,body,dialog,hud,canvas,host,player,journal,audio,button,event,start,hunt,step,catchOne,vendor,fillTarget,exitDialog,
  equip(value){equipped=value;},face(value){facing=value;},get facing(){return facing;},get time(){return time;},get writes(){return writes;},failSave(){saveOK=false;},allowSave(){saveOK=true;},replaceMap(){project=structuredClone(project);},assertMapUnchanged(){assert.equal(JSON.stringify(project),before);}};
}

test('the initial example hides the answer and starts exactly four blue fairies with five full minutes',async t=>{
 const f=fixture(t);await f.start();assert.equal(f.q.state.timeLimit,300);assert.equal(f.q.state.timerStarted,false);assert.equal(f.q.state.tokens.length,4);assert(f.q.state.tokens.every(token=>token.color==='blue'));
 assert(f.q.state.target.every(value=>['quarter','eighth-pair','sixteenth-group'].includes(value)));assert(f.q.state.tokens.every(token=>token.value!=='quarter-rest'));
 assert.equal(f.dialog.all().some(node=>node.innerHTML.includes('<svg')),false);assert(f.audio.tones.length>4);
 f.step(45);assert.equal(f.q.state.phase,'hunt');assert.equal(f.q.state.remainingSeconds,300);assert.equal(f.q.state.timerStarted,true);
 f.step(17);assert.equal(f.q.state.remainingSeconds,283);assert.equal(f.writes,0);f.assertMapUnchanged();
});

test('the hunt has only compact status and the answer cannot be replayed from a floating control panel',async t=>{
 const f=fixture(t);await f.hunt();assert(f.hud);assert.equal(f.hud.all().some(node=>node.tagName==='button'),false);assert.equal(f.hud.all().some(node=>/hear|listen again/i.test(node.textContent)),false);
 const tones=f.audio.tones.length;f.q.keydown(f.event('r'));await Promise.resolve();assert.equal(f.q.state.phase,'hunt');assert.equal(f.audio.tones.length,tones);
 f.vendor();assert.equal(f.dialog.all().some(node=>node.tagName==='button'&&/hear|listen again/i.test(node.textContent)),false);f.button('Continue hunting',f.dialog).click();assert.equal(f.q.state.phase,'hunt');
});

test('the deadline runs through building and a late submission cannot earn stars',async t=>{
 const f=fixture(t);await f.hunt();f.step(20);f.vendor();const submit=f.button('Check my rhythm',f.dialog);
 f.step(20);assert.equal(f.q.state.remainingSeconds,260);
 const yellow={...f.journal.data.yellowNotes};f.step(260);assert.equal(f.q.state.phase,'lost');assert.equal(f.q.state.remainingSeconds,0);assert.equal(f.q.state.tokens.length,0);assert.equal(f.q.state.swing,null);
 submit.click();assert.equal(f.journal.data.stars,7);assert.equal(f.journal.data.netWins,0);assert.deepEqual(f.journal.data.yellowNotes,yellow);assert.equal(f.writes,0);
 f.button('Try again',f.dialog).click();await Promise.resolve();assert.equal(f.q.state.phase,'listen');assert.equal(f.q.state.remainingSeconds,300);assert.equal(f.q.state.timerStarted,false);assert.equal(f.q.state.tokens.length,4);
 f.audio.now+=8;f.q.tick();assert.equal(f.q.state.phase,'hunt');assert.equal(f.q.state.remainingSeconds,300);
});

test('blue fairies alone fill the vendor tray and a four-fairy overhead catch win does not spend yellow inventory',async t=>{
 const f=fixture(t);await f.hunt();const yellow={...f.journal.data.yellowNotes};f.vendor();assert.equal(f.dialog.all().filter(node=>node.attributes['aria-label']?.startsWith('Add ')).length,0,'Saved yellow notes must not appear in the blue tray');f.button('Check my rhythm',f.dialog).click();assert.equal(f.q.state.phase,'arrange');f.button('Continue hunting',f.dialog).click();
 for(let i=0;i<4;i++)f.catchOne();assert.equal(f.q.state.tokens.length,0);assert.equal(f.q.state.bag.length,4);assert.deepEqual(f.journal.data.yellowNotes,yellow);f.vendor();
 const submit=f.button('Check my rhythm',f.dialog);f.fillTarget();submit.click();assert.equal(f.q.state.phase,'won');assert.equal(f.journal.data.stars,10);assert.equal(f.journal.data.netWins,1);assert.equal(f.writes,1);assert.deepEqual(f.journal.data.yellowNotes,yellow);
 submit.click();assert.equal(f.writes,1);const remaining=f.q.state.remainingSeconds;f.step(500);assert.equal(f.q.state.phase,'won');assert.equal(f.q.state.remainingSeconds,remaining);f.assertMapUnchanged();
});

test('stowed F and pointer input cannot swing or catch; an equipped click uses current facing',async t=>{
 const f=fixture(t,{equipped:false});await f.hunt();const before=f.q.state.tokens.map(token=>token.id);f.q.keydown(f.event('f'));assert.equal(f.q.state.swing,null);
 f.q.draw(drawingContext(),{x:f.player.x,y:f.player.y,zoom:1},0);
 f.q.pointer({button:0,clientX:0,clientY:400,preventDefault(){}});assert.equal(f.q.state.swing,null);f.step(NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS);assert.deepEqual(f.q.state.tokens.map(token=>token.id),before);assert.equal(f.q.state.bag.length,0);
 f.equip(true);f.face('right');f.q.pointer({button:0,clientX:0,clientY:400,preventDefault(){}});assert.equal(f.q.state.swing.angle,0,'A click behind the avatar must not turn or retarget its overhead chop');assert.equal(f.facing,'right');
 f.q.cancelSwing();assert.equal(f.q.state.swing,null);f.equip(false);f.q.keydown(f.event('f'));assert.equal(f.q.state.swing,null);f.assertMapUnchanged();
});

test('Escape asks before ending a hunt and Keep playing retains its caught fairies, time and inventory',async t=>{
 const f=fixture(t);await f.hunt();f.catchOne();f.step(17);const before=structuredClone(f.q.state),yellow={...f.journal.data.yellowNotes};const event=f.event('Escape');f.q.keydown(event);
 assert(event.prevented);assert.equal(f.q.state.requestingEnd,true);assert(f.exitDialog()?.open);assert(f.exitDialog().all().some(node=>node.textContent==='Are you sure you want to end Rhythm Catch?'));
 assert.equal(f.q.state.phase,'hunt');assert.equal(f.q.state.paused,true);f.step(1000);assert.equal(f.q.state.remainingSeconds,before.remainingSeconds);assert.deepEqual(f.q.state.bag,before.bag);
 await f.button('Keep playing',f.exitDialog()).click();assert.equal(f.q.state.requestingEnd,false);assert.equal(f.exitDialog().open,false);assert.equal(f.q.state.paused,false);assert.deepEqual(f.q.state.bag,before.bag);assert.equal(f.q.state.remainingSeconds,before.remainingSeconds);
 f.step(3);assert.equal(f.q.state.remainingSeconds,before.remainingSeconds-3);assert.deepEqual(f.journal.data.yellowNotes,yellow);assert.equal(f.writes,0);f.assertMapUnchanged();
});

test('canceling Escape during the heard example resumes the same audio without replaying or starting the timer early',async t=>{
 const f=fixture(t);await f.start();f.step(1);const heardTime=f.audio.time,tones=f.audio.tones.length;f.q.keydown(f.event('Escape'));f.step(30);
 assert.equal(f.q.state.requestingEnd,true);assert.equal(f.audio.time,heardTime);assert.equal(f.q.state.timerStarted,false);assert.equal(f.q.state.remainingSeconds,300);
 await f.button('Keep playing',f.exitDialog()).click();assert.equal(f.q.state.phase,'listen');assert.equal(f.q.state.requestingEnd,false);assert.equal(f.audio.tones.length,tones,'Canceling the exit must not play the whole example again');
 f.step(1);assert.equal(f.q.state.phase,'listen');assert.equal(f.q.state.timerStarted,false);f.step(7);assert.equal(f.q.state.phase,'hunt');assert.equal(f.q.state.remainingSeconds,300);f.assertMapUnchanged();
});

test('ending from the confirmation clears the blue round without spending yellow notes or awarding stars',async t=>{
 const f=fixture(t);await f.hunt();f.catchOne();const saved=structuredClone(f.journal.data);f.q.keydown(f.event('Escape'));f.button('End Rhythm Catch',f.exitDialog()).click();
 assert.equal(f.q.active,false);assert.equal(f.q.state.phase,'idle');assert.equal(f.q.state.requestingEnd,false);assert.equal(f.q.state.tokens.length,0);assert.equal(f.q.state.bag.length,0);assert.equal(f.q.state.timerStarted,false);assert.equal(f.exitDialog().open,false);assert.equal(f.dialog.open,false);assert.deepEqual(f.journal.data,saved);assert.equal(f.writes,0);f.assertMapUnchanged();
});

test('native Escape cancellation confirms a vendor dialog and canceling the confirmation preserves its written order',async t=>{
 const f=fixture(t);await f.hunt();f.catchOne();f.vendor();f.button('Add '+noteName(f.q.state.bag[0]),f.dialog).click();const before=structuredClone(f.q.state);
 const request=f.event('Escape');f.dialog.events.cancel(request);assert(request.prevented);assert.equal(f.q.state.requestingEnd,true);assert.equal(f.dialog.open,true);
 f.step(8);const cancel=f.event('Escape');await f.exitDialog().events.cancel(cancel);await Promise.resolve();assert(cancel.prevented);assert.equal(f.q.state.requestingEnd,false);assert.equal(f.q.state.phase,'arrange');assert.equal(f.dialog.open,true);assert.deepEqual(f.q.state.order,before.order);assert.equal(f.q.state.remainingSeconds,before.remainingSeconds);f.assertMapUnchanged();
});

test('explicit pausing freezes time without resetting the deadline when play resumes',async t=>{
 const f=fixture(t);await f.hunt();f.step(37);f.q.pause();assert.equal(f.q.state.paused,true);assert.equal(f.q.state.remainingSeconds,263);f.step(1000);assert.equal(f.q.state.remainingSeconds,263);
 await f.button('Continue',f.dialog).click();assert.equal(f.q.state.paused,false);assert.equal(f.q.state.phase,'hunt');f.step(3);assert.equal(f.q.state.remainingSeconds,260);f.assertMapUnchanged();
});

test('blur during pending unlock and a newer pause during Continue cannot unpause or freeze the round',async t=>{
 const f=fixture(t);let unlock;f.audio.unlock=()=>new Promise(resolve=>{unlock=resolve;});f.q.start(f.host);assert.equal(f.q.state.phase,'ready');f.q.pause();unlock(true);await Promise.resolve();assert.equal(f.q.state.phase,'ready');assert.equal(f.q.state.paused,true);
 let resume;f.audio.resume=()=>new Promise(resolve=>{resume=resolve;});const pending=f.button('Continue',f.dialog).click();f.q.pause();resume();await pending;assert.equal(f.q.state.paused,true);assert.equal(f.q.state.timerStarted,false);
 f.audio.resume=async()=>{};f.audio.unlock=async()=>true;await f.button('Continue',f.dialog).click();await Promise.resolve();assert.equal(f.q.state.phase,'listen');assert.equal(f.q.state.paused,false);f.audio.now+=8;f.q.tick();f.step(4);assert.equal(f.q.state.remainingSeconds,296);
});

test('a newer blur or map change cancels a pending Keep playing resume without writing an old round',async t=>{
 const f=fixture(t);await f.hunt();f.q.keydown(f.event('Escape'));let resume;f.audio.resume=()=>new Promise(resolve=>{resume=resolve;});const pending=f.button('Keep playing',f.exitDialog()).click();f.q.pause();resume();await pending;assert.equal(f.q.state.requestingEnd,true);assert.equal(f.q.state.paused,true);
 f.audio.resume=async()=>{};await f.button('Keep playing',f.exitDialog()).click();assert.equal(f.q.state.requestingEnd,false);assert.equal(f.q.state.paused,false);
 f.q.keydown(f.event('Escape'));f.audio.resume=()=>new Promise(resolve=>{resume=resolve;});const stale=f.button('Keep playing',f.exitDialog()).click();f.replaceMap();f.q.tick();resume();await stale;assert.equal(f.q.active,false);assert.equal(f.exitDialog().open,false);assert.equal(f.q.state.requestingEnd,false);assert.equal(f.writes,0);f.assertMapUnchanged();
});

test('leaving or changing maps cancels delayed audio and cannot write a former round reward',async t=>{
 const f=fixture(t);let unlock;f.audio.unlock=()=>new Promise(resolve=>{unlock=resolve;});f.q.start(f.host);f.q.end();unlock(true);await Promise.resolve();assert.equal(f.q.active,false);assert.equal(f.dialog.open,false);assert.equal(f.q.state.timerStarted,false);
 f.audio.unlock=async()=>true;await f.hunt();f.replaceMap();f.q.tick();assert.equal(f.q.active,false);assert.equal(f.q.state.tokens.length,0);assert.equal(f.q.state.bag.length,0);assert.equal(f.writes,0);f.assertMapUnchanged();
});

test('a failed blue reward save rolls back progress and allows one frozen-clock save retry',async t=>{
 const f=fixture(t);await f.hunt();for(let i=0;i<4;i++)f.catchOne();f.vendor();f.fillTarget();
 const before=structuredClone(f.journal.data),submit=f.button('Check my rhythm',f.dialog);f.failSave();submit.click();
 assert.equal(f.q.state.phase,'reward');assert.deepEqual(f.journal.data,before);assert.equal(f.writes,1);const remaining=f.q.state.remainingSeconds;f.step(1000);assert.equal(f.q.state.phase,'reward');assert.equal(f.q.state.remainingSeconds,remaining,'A solved answer must not time out while its reward waits for storage');
 const retry=f.button('Try saving again',f.dialog);f.q.keydown(f.event('Escape'));assert.equal(f.q.state.requestingEnd,true);await f.button('Keep playing',f.exitDialog()).click();assert.equal(f.q.state.phase,'reward');assert.equal(f.q.state.requestingEnd,false);f.allowSave();retry.click();assert.equal(f.q.state.phase,'won');assert.equal(f.journal.data.stars,before.stars+3);assert.equal(f.journal.data.netWins,before.netWins+1);assert.deepEqual(f.journal.data.yellowNotes,before.yellowNotes);assert.equal(f.writes,2);
 retry.click();submit.click();assert.equal(f.writes,2);assert.equal(f.journal.data.stars,before.stars+3);assert.equal(f.journal.data.netWins,before.netWins+1);f.assertMapUnchanged();
});

test('the blue compass guides an active hunt with the net stowed and hides during every dialog or exit',async t=>{
 const f=fixture(t,{equipped:false}),cam={x:f.player.x,y:f.player.y,zoom:1};
 const nearBlue=()=>{const token=f.q.state.tokens[0];Object.assign(f.player,{x:token.x-200,y:token.y});};
 function arrows(){let count=0;const c=drawingContext();c.fill=()=>{if(c.fillStyle==='#69d2ff')count++;};f.q.draw(c,cam,0,{net:false});return count;}
 await f.start();assert.equal(arrows(),0,'Listening must not reveal a compass before the hunt');
 f.audio.now+=8;f.q.tick();nearBlue();assert.equal(arrows(),1,'The compass must not require an equipped net');
 f.q.pause();assert.equal(arrows(),0);await f.button('Continue',f.dialog).click();assert.equal(arrows(),1);
 f.q.keydown(f.event('Escape'));assert.equal(arrows(),0);await f.button('Keep playing',f.exitDialog()).click();assert.equal(arrows(),1);
 f.vendor();assert.equal(arrows(),0);f.button('Continue hunting',f.dialog).click();nearBlue();assert.equal(arrows(),1);
 f.q.end();assert.equal(arrows(),0);f.assertMapUnchanged();
});
