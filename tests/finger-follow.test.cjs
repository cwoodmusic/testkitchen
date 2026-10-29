const test=require('node:test'),assert=require('node:assert/strict');
const {createFingerState}=require('../finger-follow.js');
const point=(id,x,y)=>({pointerId:id,clientX:x,clientY:y});
function fixture(){let enabled=true;const calls=[];const state=createFingerState({enabled:()=>enabled,onStart:p=>calls.push(['start',p]),onTarget:(x,y)=>calls.push(['target',x,y]),onStop:reason=>calls.push(['stop',reason]),onPinch:value=>calls.push(['pinch',value.phase])});return {state,calls,disable:()=>enabled=false};}
test('a held finger follows its latest position and lifting immediately stops it',()=>{
 const {state,calls}=fixture();state.down(point(1,50,60));state.move(point(1,130,160));assert.deepEqual(state.getState().target,{clientX:130,clientY:160});assert.equal(state.getState().following,true);
 state.up(point(1,130,160));assert.equal(state.getState().following,false);assert.equal(state.getState().target,null);assert.deepEqual(calls.filter(call=>call[0]==='stop'),[['stop','lift']]);
});
test('a second finger on the map changes to pinch and never resumes the remaining finger',()=>{
 const {state,calls}=fixture();state.down(point(1,50,60));state.down(point(2,100,60));assert.equal(state.getState().following,false);assert.equal(state.getState().pinching,true);assert.equal(state.getState().pointerCount,2);
 state.move(point(2,150,60));state.up(point(2,150,60));state.move(point(1,75,80));assert.equal(state.getState().following,false);assert.equal(state.getState().target,null);
 state.up(point(1,75,80));state.down(point(3,80,90));assert.equal(state.getState().following,true);assert.deepEqual(calls.filter(call=>call[0]==='pinch').map(call=>call[1]),['start','move','end']);
});
test('untracked action-pad fingers do not stop a finger already steering the map',()=>{
 const {state}=fixture();state.down(point(1,50,60));assert.equal(state.up(point(2,200,200)),false);state.move(point(1,55,65));assert.equal(state.getState().following,true);assert.deepEqual(state.getState().target,{clientX:55,clientY:65});
});
test('cancellation, disabled contexts and explicit stops cannot leave a target behind',()=>{
 const {state,calls,disable}=fixture();state.down(point(1,30,40));state.up(point(1,30,40),'cancel');assert.equal(state.getState().pointerCount,0);
 state.down(point(2,30,40));disable();assert.equal(state.getState().following,false);assert.equal(state.getState().pointerCount,0);assert.equal(state.down(point(3,50,60)),false);
 state.stop('close');assert.equal(calls.filter(call=>call[0]==='stop').length,2);assert.equal(state.getState().target,null);
});
test('pointer snapshots are copies, and invalid coordinates do not steer the player',()=>{
 const {state}=fixture();assert.equal(state.down(point(1,NaN,20)),false);state.down(point(2,30,40));const snapshot=state.getState();snapshot.target.clientX=999;snapshot.pointers[0].clientX=999;assert.equal(state.getState().target.clientX,30);assert.equal(state.getState().pointers[0].clientX,30);
});
