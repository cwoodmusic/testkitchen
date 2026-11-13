import test from 'node:test';
import assert from 'node:assert/strict';
import {createRhythmRoundClock} from './rhythm-round-clock.mjs';

test('the five-minute round does not begin during its introduction or by resuming',()=>{
 const clock=createRhythmRoundClock();
 assert.equal(clock.timeLimit,300);assert.equal(clock.remainingSeconds,300);
 assert.equal(clock.update(400),300);clock.pause(500);clock.resume(900);
 assert.equal(clock.started,false);assert.equal(clock.running,false);assert.equal(clock.expired,false);
 assert.equal(clock.update(1000),300);clock.start(1000);
 assert.equal(clock.started,true);assert.equal(clock.running,true);assert.equal(clock.update(1001),299);
});

test('the round charges full elapsed time across delayed or capped movement frames',()=>{
 const clock=createRhythmRoundClock();clock.start(10);
 assert.equal(clock.update(10.25),299.75);assert.equal(clock.update(90),220);
 assert.equal(clock.update(309.5),.5);assert.equal(clock.running,true);
 assert.equal(clock.update(310),0);assert.equal(clock.expired,true);assert.equal(clock.running,false);
 assert.equal(clock.update(1000),0);clock.resume(1000);assert.equal(clock.running,false);
});

test('pausing charges the current frame then excludes background or modal pause time',()=>{
 const clock=createRhythmRoundClock();clock.start(20);
 assert.equal(clock.pause(35),285);assert.equal(clock.running,false);
 assert.equal(clock.update(400),285);clock.pause(500);assert.equal(clock.remainingSeconds,285);
 assert.equal(clock.resume(900),285);assert.equal(clock.running,true);
 assert.equal(clock.update(905),280);assert.equal(clock.stop(907),278);
 assert.equal(clock.update(2000),278);assert.equal(clock.running,false);
});

test('repeated timestamps, repeated resume and backwards timestamps do not give or double-charge time',()=>{
 const clock=createRhythmRoundClock();clock.start(50);
 assert.equal(clock.update(60),290);assert.equal(clock.update(60),290);
 assert.equal(clock.update(55),290);assert.equal(clock.update(61),289);
 assert.equal(clock.resume(62),288);assert.equal(clock.update(63),287);
 clock.pause(64);assert.equal(clock.remainingSeconds,286);clock.resume(60);
 assert.equal(clock.update(64),286);assert.equal(clock.update(65),285);
});

test('a failed round starts fresh and resetting prevents an abandoned round from expiring',()=>{
 const clock=createRhythmRoundClock();clock.start(0);clock.update(301);
 assert.equal(clock.expired,true);assert.equal(clock.start(400),300);assert.equal(clock.expired,false);
 assert.equal(clock.update(402),298);assert.equal(clock.reset(),300);
 assert.equal(clock.started,false);assert.equal(clock.running,false);assert.equal(clock.expired,false);
 assert.equal(clock.update(10000),300);clock.start(10000);assert.equal(clock.update(10001),299);
});

test('custom durations expire exactly and invalid inputs cannot corrupt the clock',()=>{
 const clock=createRhythmRoundClock({duration:2.5});clock.start(1);
 assert.equal(clock.update(3),.5);assert.equal(clock.pause(3.5),0);assert.equal(clock.expired,true);
 for(const duration of [0,-1,NaN,Infinity])assert.throws(()=>createRhythmRoundClock({duration}),RangeError);
 for(const now of [undefined,NaN,Infinity,-Infinity]){
  assert.throws(()=>clock.update(now),TypeError);assert.equal(clock.remainingSeconds,0);
 }
});
