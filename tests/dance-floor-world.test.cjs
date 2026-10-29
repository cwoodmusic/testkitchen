const test=require('node:test'),assert=require('node:assert/strict');
const worldModule=require('../dance-floor-world.js');

function fixture(){
 const controls={identity:'player-a',canPlay:true,stageReady:true},awards=[],cues=[],restoredMusic=[],errors=[];
 let callbacks,staged=false,stageCloses=0,stageStarts=0,camera={x:30,y:40,zoom:1.5,targetZoom:1.5},facing='left';
 const music={song:'previous-song'},reward={ok:true,rewards:{notes:25,xp:50}};
 const stage={
  getState:()=>({active:staged}),
  start(){stageStarts++;if(!controls.stageReady)return false;staged=true;return true;},
  close(){stageCloses++;staged=false;},destroy(){staged=false;},
  cue:direction=>cues.push(direction),step(){},miss(){},update(){},pose:()=>null
 };
 const game={
  open:()=>true,close:reason=>callbacks.onClose({reason}),destroy:()=>callbacks.onClose({reason:'destroyed'}),
  getState:()=>({open:staged})
 };
 const window={document:{hidden:false},CodaDanceFloorStage:{create:()=>stage},CodaDanceRhythmGame:{create(api){callbacks=api;return game;}}};
 const scene=worldModule.create({window,player:{x:0,y:0},npcs:[],canPlay:()=>controls.canPlay,
  getIdentity:()=>controls.identity,getCamera:()=>camera,setCamera:value=>{camera={...value};},
  getFacing:()=>facing,setFacing:value=>{facing=value;},pauseMusic:()=>music,restoreMusic:value=>restoredMusic.push(value),
  onFinish:event=>{awards.push(event);return reward;},onError:message=>errors.push(message)
 });
 return {scene,callbacks,controls,awards,cues,reward,music,restoredMusic,errors,
  get camera(){return camera;},get facing(){return facing;},get stageCloses(){return stageCloses;},get stageStarts(){return stageStarts;},
  moveCamera:value=>{camera={...value};},turn:value=>{facing=value;}};
}
function start(f,runId='run-a'){
 assert.equal(f.scene.open(),true);
 assert.equal(f.callbacks.onStart({runId}),true);
}
const result=runId=>({runId,complete:true,difficulty:'hard',score:3000,accuracy:1,hits:30,misses:0});

test('a completed dance forwards its bound result and reward response only once',()=>{
 const f=fixture();start(f);const event=result('run-a');
 assert.equal(f.callbacks.onFinish(event),f.reward);
 assert.deepEqual(f.awards,[event]);assert.deepEqual(f.cues,['down']);
 assert.equal(f.callbacks.onFinish(event).ok,false);assert.equal(f.awards.length,1);
});

test('another run, a changed player or a blocked player cannot receive the completed dance reward',()=>{
 for(const cause of ['run','identity','permission']){
  const f=fixture();start(f);
  if(cause==='identity')f.controls.identity='player-b';
  if(cause==='permission')f.controls.canPlay=false;
  const outcome=f.callbacks.onFinish(result(cause==='run'?'another-run':'run-a'));
  assert.equal(outcome.ok,false,cause);assert.equal(f.awards.length,0,cause);
 }
});

test('closing or abandoning a dance prevents delayed completion from awarding it',()=>{
 for(const reason of ['close','profile','hidden','paused','profile-changed','destroyed']){
  const f=fixture();start(f);f.scene.close(reason);
  assert.equal(f.scene.isOpen(),false);
  assert.equal(f.callbacks.onFinish(result('run-a')).ok,false,reason);
  assert.equal(f.awards.length,0,reason);
 }
 const f=fixture();start(f);f.controls.canPlay=false;f.scene.update(.1);
 assert.equal(f.scene.isOpen(),false);assert.equal(f.callbacks.onFinish(result('run-a')).ok,false);assert.equal(f.awards.length,0);
});

test('replaying binds a new run and rejects stale callbacks from the previous dance',()=>{
 const f=fixture();start(f);assert.equal(f.callbacks.onFinish(result('run-a')),f.reward);
 assert.equal(f.callbacks.onStart({runId:'run-b'}),true);
 assert.equal(f.stageStarts,2);assert.equal(f.stageCloses,1,'replay releases the old staging before starting again');
 assert.equal(f.callbacks.onFinish(result('run-a')).ok,false);assert.equal(f.awards.length,1);
 assert.equal(f.callbacks.onFinish(result('run-b')),f.reward);assert.deepEqual(f.awards.map(event=>event.runId),['run-a','run-b']);
});

test('reopening after an abandoned dance binds the current player and new run',()=>{
 const f=fixture();start(f);f.scene.close('profile');f.controls.identity='player-b';start(f,'run-b');
 assert.equal(f.callbacks.onFinish(result('run-a')).ok,false);assert.equal(f.awards.length,0);
 assert.equal(f.callbacks.onFinish(result('run-b')),f.reward);assert.deepEqual(f.awards.map(event=>event.runId),['run-b']);
});

test('blocked staging cannot bind a run or retain the previous run on replay',()=>{
 for(const replay of [false,true]){
  const f=fixture();assert.equal(f.scene.open(),true);
  if(replay)assert.equal(f.callbacks.onStart({runId:'previous-run'}),true);
  f.controls.stageReady=false;assert.equal(f.callbacks.onStart({runId:'blocked-run'}),false);
  assert.equal(f.callbacks.onFinish(result('blocked-run')).ok,false);
  assert.equal(f.callbacks.onFinish(result('previous-run')).ok,false);
  assert.equal(f.awards.length,0);assert.equal(f.errors.length,1);
 }
});

test('normal closure restores the camera, facing and music without repeating rewards or restoration',()=>{
 const f=fixture(),camera={...f.camera},facing=f.facing;start(f);
 f.moveCamera({x:100,y:450,zoom:2,targetZoom:2});f.turn('down');
 f.callbacks.onFinish(result('run-a'));f.scene.close();
 assert.deepEqual(f.camera,camera);assert.equal(f.facing,facing);assert.deepEqual(f.restoredMusic,[f.music]);
 assert.equal(f.stageCloses,1);f.scene.close();assert.equal(f.stageCloses,1);assert.equal(f.restoredMusic.length,1);assert.equal(f.awards.length,1);
 for(const reason of ['profile','hidden','paused','profile-changed','destroyed']){
  const interrupted=fixture();start(interrupted);interrupted.scene.close(reason);
  assert.deepEqual(interrupted.restoredMusic,[],reason+' must not restart background music');
 }
});
