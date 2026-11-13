import test from 'node:test';
import assert from 'node:assert/strict';
import {createRhythmCatch} from './rhythm-catch.mjs';
import {netSweepPose,facingAngle} from './rhythm-hunt-motion.mjs';
import {noteName} from './town-game-audio.mjs';
import {blocked} from './model.mjs';

class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.dataset={};this.events={};this.open=false;this.hidden=false;this.disabled=false;this.textContent='';this.innerHTML='';}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=[...children];}
 setAttribute(key,value){this.attributes[key]=value;}
 addEventListener(key,callback){this.events[key]=callback;}
 showModal(){this.open=true;}
 close(){this.open=false;}
 focus(){}
 all(){return this.children.flatMap(child=>[child,...child.all()]);}
 querySelector(selector){return this.all().find(node=>selector.startsWith('#')?node.id===selector.slice(1):false)||null;}
 querySelectorAll(selector){return this.all().filter(node=>selector==='[role="timer"]'&&node.attributes.role==='timer');}
 click(){if(!this.disabled)return this.onclick?.();}
}
function fixture(t){
 const original={document:globalThis.document,matchMedia:globalThis.matchMedia,performance:globalThis.performance};let time=0;
 const body=new Element('body');globalThis.document={body,createElement:tag=>new Element(tag)};globalThis.matchMedia=()=>({matches:true});globalThis.performance={now:()=>time*1000};t.after(()=>Object.assign(globalThis,original));
 let project={version:1,cells:{},objects:[],edges:{},spawn:{x:1344,y:1344}};
 for(let i=0;i<43;i++)for(const [x,y]of [[i,0],[i,42],[0,i],[42,i]])project.cells[`${x},${y}`]={surface:'water',level:0};
 const before=JSON.stringify(project),player={...project.spawn},host={id:'vendor',...project.spawn,interaction:{...project.spawn}},catalog=new Map();let facing='down',writes=0,saveOK=true;
 const journal={data:{stars:7,netWins:0,fish:{},yellowNotes:{quarter:20,'eighth-pair':20,'sixteenth-group':20,'quarter-rest':20},npcRhythmWins:{bach:2}},save(){writes++;return saveOK;},warning:''};
 const audio={now:0,tones:[],async unlock(){return true;},get time(){return this.now;},tone(...args){this.tones.push(args);},stop(){},suspend(){},async resume(){}};
 const q=createRhythmCatch({canvas:new Element('canvas'),getProject:()=>project,getPlayer:()=>player,getFacing:()=>facing,setFacing:value=>{facing=value;},catalog,journal,audio}),dialog=body.children[0];
 const button=label=>{const found=dialog.all().find(node=>node.tagName==='button'&&(node.textContent===label||node.attributes['aria-label']===label));assert(found,'Missing button: '+label);return found;};
 const event=key=>({key,repeat:false,preventDefault(){}});
 const start=async()=>{q.start(host);await Promise.resolve();assert.equal(q.state.phase,'listen');};
 const hunt=async()=>{await start();audio.now+=8;q.tick();assert.equal(q.state.phase,'hunt');assert.equal(q.state.remainingSeconds,300);};
 const step=seconds=>{time+=seconds;audio.now+=seconds;q.tick();};
 function catchOne(){
  const token=q.state.tokens[0];assert(token);const visual={x:token.x,y:token.y-80};
  let pose;
  for(const direction of ['right','left','up','down']){
   const offset=netSweepPose({x:0,y:0},facingAngle(direction),.59),candidate={x:visual.x-offset.x,y:visual.y-offset.y};
   if(Array.from({length:32},(_,i)=>({x:candidate.x+(token.x-candidate.x)*i/31,y:candidate.y+(token.y-candidate.y)*i/31})).every(p=>!blocked(project,p.x,p.y,catalog))){pose={candidate,direction};break;}
  }
  assert(pose,'A clear approach to the spawned card must exist');Object.assign(player,pose.candidate);facing=pose.direction;
  const count=q.state.bag.length;q.keydown(event('f'));step(.38);assert.equal(q.state.bag.length,count+1);step(.2);
 }
 function vendor(){Object.assign(player,host.interaction);q.interact();assert.equal(q.state.phase,'arrange');}
 return {q,dialog,host,player,journal,audio,button,event,start,hunt,step,catchOne,vendor,get time(){return time;},get writes(){return writes;},failSave(){saveOK=false;},allowSave(){saveOK=true;},replaceMap(){project=structuredClone(project);},assertMapUnchanged(){assert.equal(JSON.stringify(project),before);}};
}

test('the initial example hides the answer and starts exactly four blue cards with five full minutes',async t=>{
 const f=fixture(t);await f.start();assert.equal(f.q.state.timeLimit,300);assert.equal(f.q.state.timerStarted,false);assert.equal(f.q.state.tokens.length,4);assert(f.q.state.tokens.every(token=>token.color==='blue'));
 assert.equal(f.dialog.all().some(node=>node.innerHTML.includes('<svg')),false);assert(f.audio.tones.length>4);
 f.step(45);assert.equal(f.q.state.phase,'hunt');assert.equal(f.q.state.remainingSeconds,300);assert.equal(f.q.state.timerStarted,true);
 f.step(17);assert.equal(f.q.state.remainingSeconds,283);assert.equal(f.writes,0);f.assertMapUnchanged();
});

test('the deadline runs through building and replay and a late submission cannot earn stars',async t=>{
 const f=fixture(t);await f.hunt();f.step(20);f.vendor();const submit=f.button('Check my rhythm');
 f.step(20);assert.equal(f.q.state.remainingSeconds,260);f.button('Hear it again').click();await Promise.resolve();assert.equal(f.q.state.phase,'listen');f.step(8);assert.equal(f.q.state.phase,'arrange');assert.equal(f.q.state.remainingSeconds,252);
 const yellow={...f.journal.data.yellowNotes};f.step(252);assert.equal(f.q.state.phase,'lost');assert.equal(f.q.state.remainingSeconds,0);assert.equal(f.q.state.tokens.length,0);assert.equal(f.q.state.swing,null);
 submit.click();assert.equal(f.journal.data.stars,7);assert.equal(f.journal.data.netWins,0);assert.deepEqual(f.journal.data.yellowNotes,yellow);assert.equal(f.writes,0);
 f.button('Try again').click();await Promise.resolve();assert.equal(f.q.state.phase,'listen');assert.equal(f.q.state.remainingSeconds,300);assert.equal(f.q.state.timerStarted,false);assert.equal(f.q.state.tokens.length,4);
 f.audio.now+=8;f.q.tick();assert.equal(f.q.state.phase,'hunt');assert.equal(f.q.state.remainingSeconds,300);
});

test('blue cards alone fill the vendor tray and a real four-card sweep win does not spend yellow inventory',async t=>{
 const f=fixture(t);await f.hunt();const yellow={...f.journal.data.yellowNotes};f.vendor();assert.equal(f.dialog.all().filter(node=>node.attributes['aria-label']?.startsWith('Add ')).length,0,'Saved yellow cards must not appear in the blue tray');f.button('Check my rhythm').click();assert.equal(f.q.state.phase,'arrange');f.button('Catch more notes').click();
 for(let i=0;i<4;i++)f.catchOne();assert.equal(f.q.state.tokens.length,0);assert.equal(f.q.state.bag.length,4);assert.deepEqual(f.journal.data.yellowNotes,yellow);f.vendor();
 const target=f.q.state.target,submit=f.button('Check my rhythm');for(const value of target)f.button('Add '+noteName(value)).click();submit.click();assert.equal(f.q.state.phase,'won');assert.equal(f.journal.data.stars,10);assert.equal(f.journal.data.netWins,1);assert.equal(f.writes,1);assert.deepEqual(f.journal.data.yellowNotes,yellow);
 submit.click();assert.equal(f.writes,1);const remaining=f.q.state.remainingSeconds;f.step(500);assert.equal(f.q.state.phase,'won');assert.equal(f.q.state.remainingSeconds,remaining);f.assertMapUnchanged();
});

test('explicit pausing freezes time without resetting the deadline when play resumes',async t=>{
 const f=fixture(t);await f.hunt();f.step(37);f.q.pause();assert.equal(f.q.state.paused,true);assert.equal(f.q.state.remainingSeconds,263);f.step(1000);assert.equal(f.q.state.remainingSeconds,263);
 await f.button('Continue').click();assert.equal(f.q.state.paused,false);assert.equal(f.q.state.phase,'hunt');f.step(3);assert.equal(f.q.state.remainingSeconds,260);f.assertMapUnchanged();
});

test('blur during pending unlock and a newer pause during Continue cannot unpause or freeze the round',async t=>{
 const f=fixture(t);let unlock;f.audio.unlock=()=>new Promise(resolve=>{unlock=resolve;});f.q.start(f.host);assert.equal(f.q.state.phase,'ready');f.q.pause();unlock(true);await Promise.resolve();assert.equal(f.q.state.phase,'ready');assert.equal(f.q.state.paused,true);
 let resume;f.audio.resume=()=>new Promise(resolve=>{resume=resolve;});const pending=f.button('Continue').click();f.q.pause();resume();await pending;assert.equal(f.q.state.paused,true);assert.equal(f.q.state.timerStarted,false);
 f.audio.resume=async()=>{};f.audio.unlock=async()=>true;await f.button('Continue').click();await Promise.resolve();assert.equal(f.q.state.phase,'listen');assert.equal(f.q.state.paused,false);f.audio.now+=8;f.q.tick();f.step(4);assert.equal(f.q.state.remainingSeconds,296);
 f.audio.unlock=()=>new Promise(resolve=>{unlock=resolve;});f.q.keydown(f.event('r'));f.q.pause();unlock(true);await Promise.resolve();assert.equal(f.q.state.paused,true);assert.equal(f.q.state.phase,'hunt');f.step(500);assert.equal(f.q.state.remainingSeconds,296);
});

test('leaving or changing maps cancels delayed audio and cannot write a former round reward',async t=>{
 const f=fixture(t);let unlock;f.audio.unlock=()=>new Promise(resolve=>{unlock=resolve;});f.q.start(f.host);f.q.end();unlock(true);await Promise.resolve();assert.equal(f.q.active,false);assert.equal(f.dialog.open,false);assert.equal(f.q.state.timerStarted,false);
 f.audio.unlock=async()=>true;await f.hunt();f.replaceMap();f.q.tick();assert.equal(f.q.active,false);assert.equal(f.q.state.tokens.length,0);assert.equal(f.q.state.bag.length,0);assert.equal(f.writes,0);f.assertMapUnchanged();
});


test('a failed blue reward save rolls back progress and allows one frozen-clock save retry',async t=>{
 const f=fixture(t);await f.hunt();for(let i=0;i<4;i++)f.catchOne();f.vendor();for(const value of f.q.state.target)f.button('Add '+noteName(value)).click();
 const before=structuredClone(f.journal.data),submit=f.button('Check my rhythm');f.failSave();submit.click();
 assert.equal(f.q.state.phase,'reward');assert.deepEqual(f.journal.data,before);assert.equal(f.writes,1);const remaining=f.q.state.remainingSeconds;f.step(1000);assert.equal(f.q.state.phase,'reward');assert.equal(f.q.state.remainingSeconds,remaining,'A solved answer must not time out while its reward waits for storage');
 const retry=f.button('Try saving again');f.allowSave();retry.click();assert.equal(f.q.state.phase,'won');assert.equal(f.journal.data.stars,before.stars+3);assert.equal(f.journal.data.netWins,before.netWins+1);assert.deepEqual(f.journal.data.yellowNotes,before.yellowNotes);assert.equal(f.writes,2);
 retry.click();submit.click();assert.equal(f.writes,2);assert.equal(f.journal.data.stars,before.stars+3);assert.equal(f.journal.data.netWins,before.netWins+1);f.assertMapUnchanged();
});
