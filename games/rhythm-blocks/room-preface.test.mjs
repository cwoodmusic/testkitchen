import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomPreface} from './room-preface.mjs';

test('narration waits for an explicit acknowledgment even after a long read',()=>{
 const reading=createRoomPreface({text:'The bell has stopped. The town needs its replies before evening.'});
 assert.deepEqual(reading.state,{text:'The bell has stopped. The town needs its replies before evening.',elapsed:0,playing:true,finished:false});
 for(let frame=0;frame<6000;frame++)reading.update(100);
 assert.equal(reading.state.elapsed,600000);
 assert.equal(reading.state.finished,false,'Finishing the typewriter never starts the doorway by itself.');
 assert.equal(reading.state.playing,true);
 assert.equal(reading.finish(),true);
 assert.equal(reading.state.finished,true);assert.equal(reading.state.playing,false);
 assert.equal(reading.update(16),false);assert.equal(reading.state.elapsed,600000);
 assert.equal(reading.play(),false,'A focus event cannot reopen an acknowledged preface.');
 assert.equal(reading.finish(),false);
});

test('pause and resume keep an exact deterministic reading clock without background catchup',()=>{
 const reading=createRoomPreface({text:'A warm seal means someone returned the parcel.'});
 reading.update(16);reading.update(32);assert.equal(reading.state.elapsed,48);
 assert.equal(reading.pause(),true);const paused=reading.state;
 assert.equal(reading.pause(),false);assert.equal(reading.update(60000),false);
 assert.equal(reading.state,paused);assert.equal(reading.state.elapsed,48);
 assert.equal(reading.play(),true);assert.equal(reading.play(),false);
 reading.update(16);assert.equal(reading.state.elapsed,64);
 reading.update(60000);assert.equal(reading.state.elapsed,164,'Only one bounded frame is applied after a stall.');
});

test('starting paused, invalid deltas and restart never invent elapsed time',()=>{
 const reading=createRoomPreface({text:'The room waits.',playing:false});
 assert.equal(reading.state.playing,false);assert.equal(reading.update(16),false);
 reading.play();
 for(const delta of [undefined,null,'16',NaN,Infinity,-Infinity,0,-16])assert.equal(reading.update(delta),false);
 assert.equal(reading.state.elapsed,0);
 reading.update(37.5);assert.equal(reading.state.elapsed,37.5);
 reading.finish();reading.restart();
 assert.equal(reading.state.elapsed,0);assert.equal(reading.state.finished,false);assert.equal(reading.state.playing,true);
});

test('normal and double-speed frame slices stay deterministic',()=>{
 const normal=createRoomPreface({text:'Follow the missing replies.'}),double=createRoomPreface({text:'Follow the missing replies.'});
 for(let frame=0;frame<60;frame++){
  normal.update(16);
  // The shared view passes bounded slices of its selected playback speed.
  double.update(16*2);
 }
 assert.equal(normal.state.elapsed,960);assert.equal(double.state.elapsed,1920);
 assert.equal(normal.state.finished,false);assert.equal(double.state.finished,false);
});

test('narration preserves a full room paragraph and exposes immutable cached snapshots',()=>{
 const text='A'.repeat(800),reading=createRoomPreface({text:'  '+text+'  '}),first=reading.state;
 assert.equal(first.text,text);assert(Object.isFrozen(first));assert(Object.isFrozen(reading));
 assert.equal(reading.state,first);
 assert.throws(()=>{first.elapsed=999;},TypeError);
 reading.update(16);assert.notEqual(reading.state,first);assert.equal(first.elapsed,0);
});

test('blank and nontext narration are rejected without creating a transport',()=>{
 for(const text of [undefined,null,'',' \n\t ',42,{}])assert.throws(()=>createRoomPreface({text}),TypeError);
});
