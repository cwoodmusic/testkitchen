import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {netToolPose,netVisualPose,facingAngle,NET_SWEEP_SECONDS,NET_RECOVERY_SECONDS,NET_STRIKE_FRACTION} from './rhythm-hunt-motion.mjs';
import {drawRhythmNet} from './rhythm-net-render.mjs';

// Exercise the production coordinator and actual net drawing. The other games
// expose controllable strokes so scene timing does not depend on audio or RNG.
const url=new URL('./town-activities.mjs',import.meta.url);
const source=readFileSync(url,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export function /gm,'function ')+'\n({createTownActivities});';
function ink(){
 const nets=[],events=[];let path=[];const stack=[];
 const c={globalAlpha:1,pass:'behind',nets,events,
  save(){stack.push({strokeStyle:this.strokeStyle,fillStyle:this.fillStyle,lineWidth:this.lineWidth,globalAlpha:this.globalAlpha});},
  restore(){Object.assign(this,stack.pop()||{});},beginPath(){path=[];},moveTo(x,y){path.push({x,y});},lineTo(x,y){path.push({x,y});},
  stroke(){if(this.strokeStyle==='#5d412b'){const net={pass:this.pass,grip:{...path[0]},joint:{...path[1]}};nets.push(net);events.push('net:'+this.pass);}}
 };
 return new Proxy(c,{get:(target,key)=>key in target?target[key]:()=>{},set:(target,key,value)=>{target[key]=value;return true;}});
}
function fixture(){
 let now=0,facing='right',scene=null,conversation=false,owner='guest',yellowAt=null,blueAt=null,blueActive=false,blueCount=4,requestActive=false,fishingActive=false;
 let yellowOptions,blueOptions;const occluded=[],draws=[],cancelled={yellow:0,blue:0},player={x:640,y:768},doc={objects:[],cells:{},edges:{},spawn:{...player}};let z=48;
 const canvas={focus(){}};
 const yellow={tick(){},hide(){},reset(){yellowAt=null;},catchAlongSweep:()=>false,
  cancelSwing(){cancelled.yellow++;yellowAt=null;},
  keydown(e){if(e.key==='f'&&yellowOptions.isEquipped()){yellowAt=now;return true;}return false;},pointer:()=>false,
  draw(_c,_cam,_time,options){draws.push({game:'yellow',net:options?.net});},
  get swingFacing(){return yellowAt!==null&&now-yellowAt<NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS?facing:null;},
  get netStroke(){return {angle:facingAngle(facing),age:yellowAt===null?Infinity:now-yellowAt};},get state(){return {};}
 };
 const blue={end(){blueActive=false;blueAt=null;},tick(){},pause(){},cancelSwing(){cancelled.blue++;blueAt=null;},interact:()=>false,pointer:()=>false,
  keydown(e){if(e.key==='f'&&blueOptions.isEquipped()){blueAt=now;return true;}return false;},
  draw(_c,_cam,_time,options){draws.push({game:'blue',net:options?.net});},
  get active(){return blueActive;},get fullscreen(){return false;},get blocked(){return false;},get fairyCount(){return blueActive?blueCount:0;},
  get swingFacing(){return blueActive&&blueAt!==null&&now-blueAt<NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS?facing:null;},
  get netStroke(){return {angle:facingAngle(facing),age:blueAt===null?Infinity:now-blueAt};},get state(){return {};}
 };
 const requests={offer(){},end(){requestActive=false;},tick(){},pause(){},keydown:()=>false,get active(){return requestActive;},get fullscreen(){return requestActive;},get blocked(){return requestActive;},get state(){return {};}};
 const fishing={end(){fishingActive=false;},tick(){},pause(){},draw(){},keydown:()=>false,pointer:()=>false,interact:()=>false,get active(){return fishingActive;},get fullscreen(){return false;},get blocked(){return fishingActive;},get state(){return {};}};
 const context={netToolPose,netVisualPose,drawRhythmNet,groundTexture:()=>null,drawPierOccludedActor:(c,_doc,actor,draw)=>{occluded.push({...actor});draw(c);},height:()=>z,actorHeight:(_doc,actor)=>actor.underPier?0:z,canBoardFishingDock:()=>false,findFishingDock:()=>null,mountGameStyles(){},createTownJournal:()=>({data:{stars:0}}),gameButton(){},createNoteInventory:()=>({counts:{},total:0}),createNPCRhythmRequests:()=>requests,
  createYellowNoteCatch(options){yellowOptions=options;return yellow;},createRhythmCatch(options){blueOptions=options;return blue;},createTownFishing:()=>fishing,
  matchMedia:()=>({matches:true}),performance:{now:()=>now*1000},document:{addEventListener(){}},window:{addEventListener(){}}
 };
 const {createTownActivities}=vm.runInNewContext(source,context,{filename:url.pathname});
 const q=createTownActivities({canvas,getProject:()=>doc,getPlayer:()=>player,getFacing:()=>facing,setFacing:value=>{facing=value;},getResidents:()=>[],getOwner:()=>owner,getScene:()=>scene,isConversationOpen:()=>conversation,catalog:new Map()});
 const event=key=>({key,repeat:false,prevented:false,preventDefault(){this.prevented=true;}});
 function frame({advanceBetweenPasses=0}={}){
  const c=ink();q.tick(new Set(),0);c.pass='behind';q.drawNetBehind(c);const tool=q.netToolPose;
  c.events.push('body');now+=advanceBetweenPasses;c.pass='front';q.draw(c,{x:player.x,y:player.y,zoom:1},1200,800,now);
  return {c,tool};
 }
 return {q,player,get z(){return z;},underPier(){z=384;doc.cells['10,12']={surface:'sand',level:0,bridge:'ns',pier:{level:8,axis:'ns'}};player.underPier=true;},event,frame,occluded,draws,cancelled,get yellowOptions(){return yellowOptions;},get blueOptions(){return blueOptions;},get now(){return now;},face(value){facing=value;},advance(seconds){now+=seconds;},blue(){blueActive=true;},setScene(value){scene=value;},setConversation(value){conversation=value;},setFishing(value){fishingActive=value;},setRequest(value){requestActive=value;},changeOwner(){owner='second-player';}};
}
const close=(actual,expected,message)=>assert(Math.abs(actual-expected)<1e-9,message+`: ${actual} versus ${expected}`);
function registered(tool,net,player,z){
 assert(tool);assert.equal(tool.kind,'net');close(player.x+tool.hand.x*2.5,net.grip.x,'The visible hand and handle must share x');close(player.y-z+tool.hand.y*2.5,net.grip.y,'The visible hand and handle must share elevated y');
}

test('an equipped shoulder carry has exactly one net pass behind the body in all four facings',()=>{
 for(const direction of ['up','right','down','left']){
  const f=fixture();f.face(direction);const tab=f.event('Tab');assert.equal(f.q.keydown(tab),true);assert(tab.prevented);assert.equal(f.q.netEquipped,true);
  const {c,tool}=f.frame();assert.equal(c.nets.length,1,direction);assert.equal(c.nets[0].pass,'behind');assert(c.events.indexOf('net:behind')<c.events.indexOf('body'));registered(tool,c.nets[0],f.player,f.z);
  const pose=netVisualPose(f.player,facingAngle(direction),Infinity,f.z);assert.equal(pose.layer,'behind');assert(pose.groundForward<0);assert.equal(tool.active,false);assert.equal(tool.facing,direction);
  assert(f.draws.every(draw=>draw.net===false),'Both child controllers must suppress their former standalone net pass');
 }
});

test('the forward strike draws once after the body using the same cached sample as its tool hand',()=>{
 for(const direction of ['up','right','down','left']){
  const f=fixture();f.face(direction);f.q.keydown(f.event('Tab'));f.q.keydown(f.event('f'));f.advance(NET_SWEEP_SECONDS*NET_STRIKE_FRACTION);
  const sampled=f.now,expected=netVisualPose(f.player,facingAngle(direction),sampled,f.z),{c,tool}=f.frame({advanceBetweenPasses:2});
  assert.equal(expected.layer,'front');assert.equal(c.nets.length,1,direction);assert.equal(c.nets[0].pass,'front');assert(c.events.indexOf('body')<c.events.indexOf('net:front'));registered(tool,c.nets[0],f.player,f.z);
  close(c.nets[0].grip.x,expected.grip.x,'A slow body draw must not resample the net x');close(c.nets[0].grip.y,expected.grip.y,'A slow body draw must not resample the net y');assert.equal(tool.active,true);
  const rest=f.frame();assert.equal(rest.c.nets.length,1);assert.equal(rest.c.nets[0].pass,'behind');assert.equal(rest.tool.active,false,'The next frame must release the completed stroke sample');
 }
});

test('a tool-pose query before the rear pass seeds the same animation sample for both net passes',()=>{
 const f=fixture();f.q.keydown(f.event('Tab'));f.q.keydown(f.event('f'));f.advance(NET_SWEEP_SECONDS*NET_STRIKE_FRACTION);f.q.tick(new Set(),0);
 const firstTool=f.q.netToolPose;assert.equal(firstTool.active,true);f.advance(2);const c=ink();c.pass='behind';f.q.drawNetBehind(c);
 assert.equal(c.nets.length,0,'A later rear pass must retain the already sampled forward strike');assert.equal(f.q.netToolPose,firstTool,'The actor must receive the exact cached hand pose object');
 c.events.push('body');c.pass='front';f.q.draw(c,{x:f.player.x,y:f.player.y,zoom:1},1200,800,f.now);assert.equal(c.nets.length,1);assert.equal(c.nets[0].pass,'front');registered(firstTool,c.nets[0],f.player,f.z);
 const rest=f.frame();assert.equal(rest.c.nets.length,1);assert.equal(rest.c.nets[0].pass,'behind');assert.equal(rest.tool.active,false);
});

test('Tab stows both net passes and its tool pose while routing the same equipment state to both controllers',()=>{
 const f=fixture();assert.equal(f.q.netEquipped,false);assert.equal(f.yellowOptions.isEquipped(),false);assert.equal(f.blueOptions.isEquipped(),false);const first=f.frame();assert.equal(first.c.nets.length,0);assert.equal(first.tool,null);
 f.q.keydown(f.event('Tab'));assert.equal(f.yellowOptions.isEquipped(),true);assert.equal(f.blueOptions.isEquipped(),true);f.q.keydown(f.event('f'));f.advance(NET_SWEEP_SECONDS*NET_STRIKE_FRACTION);assert.equal(f.frame().c.nets.length,1);
 f.q.keydown(f.event('Tab'));assert.equal(f.q.netEquipped,false);assert.equal(f.yellowOptions.isEquipped(),false);assert.equal(f.blueOptions.isEquipped(),false);const stowed=f.frame();assert.equal(stowed.c.nets.length,0);assert.equal(stowed.tool,null);assert(f.cancelled.yellow>=2&&f.cancelled.blue>=2,'Every toggle cancels each potential owner of an unfinished stroke');
});

test('a vendor stroke uses the blue sample while both fairy controllers suppress duplicate nets',()=>{
 const f=fixture();f.q.keydown(f.event('Tab'));f.face('left');f.blue();assert.equal(f.yellowOptions.canUseNet(),false);assert.equal(f.yellowOptions.getLimit(),1);f.q.keydown(f.event('f'));f.advance(NET_SWEEP_SECONDS*NET_STRIKE_FRACTION);
 const {c,tool}=f.frame();assert.equal(c.nets.length,1);assert.equal(c.nets[0].pass,'front');assert.equal(tool.facing,'left');registered(tool,c.nets[0],f.player,f.z);assert.deepEqual(f.draws.map(draw=>draw.net),[false,false]);
});

test('interiors, conversations, fishing, NPC requests and changing owner cannot retain a net frame',()=>{
 for(const mode of ['scene','conversation','fishing','request','owner']){
  const f=fixture();f.q.keydown(f.event('Tab'));assert.equal(f.frame().c.nets.length,1);
  if(mode==='scene')f.setScene({kind:'concert'});if(mode==='conversation')f.setConversation(true);if(mode==='fishing')f.setFishing(true);if(mode==='request')f.setRequest(true);if(mode==='owner')f.changeOwner();
  const {c,tool}=f.frame();assert.equal(c.nets.length,0,mode);assert.equal(tool,null,mode);if(mode==='owner')assert.equal(f.q.netEquipped,false);
 }
});


test('an under-pier player carries the net on its own ground layer rather than on the deck above',()=>{
 const f=fixture();f.underPier();f.q.keydown(f.event('Tab'));const {c,tool}=f.frame();assert.equal(c.nets.length,1);registered(tool,c.nets[0],f.player,0);
 delete f.player.underPier;const top=f.frame();registered(top.tool,top.c.nets[0],f.player,f.z);
});


test('the lower forward net pass uses the pier ink mask while a top-deck swing stays unmasked',()=>{
 const f=fixture();f.underPier();f.q.keydown(f.event('Tab'));f.q.keydown(f.event('f'));f.advance(NET_SWEEP_SECONDS*NET_STRIKE_FRACTION);const under=f.frame();assert.equal(under.c.nets[0].pass,'front');assert.equal(f.occluded.length,1);assert.equal(f.occluded[0].underPier,true);
 delete f.player.underPier;const top=f.frame();assert.equal(top.c.nets[0].pass,'front');assert.equal(f.occluded.length,1,'Top-deck ink must remain above the deck');
});
