const test=require('node:test'),assert=require('node:assert/strict'),input=require('../fishing-rhythm-input.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} differs from ${b}`);

test('a late animation frame does not make rapid input share a stale game time',()=>{
 let state={clock:12,lastNow:100};
 state=input.captureTime({...state,sourceNow:100.078,performanceNow:100.078,eventTimeStamp:100078});close(state.clock,12.078);
 state=input.captureTime({...state,sourceNow:100.156,performanceNow:100.156,eventTimeStamp:100156});close(state.clock,12.156);
 state=input.captureTime({...state,sourceNow:100.234,performanceNow:100.234,eventTimeStamp:100234});close(state.clock,12.234);
 close(state.clock+(100.25-state.lastNow),12.25,'The next frame must not count input elapsed time twice');
});

test('same-origin event timestamps compensate dispatch delay without allowing backwards or future scoring',()=>{
 const delayed=input.captureTime({clock:10,lastNow:20,sourceNow:20.12,performanceNow:20.12,eventTimeStamp:20080});close(delayed.clock,10.08);close(delayed.lastNow,20.08);
 const older=input.captureTime({clock:10,lastNow:20,sourceNow:20.12,performanceNow:20.12,eventTimeStamp:19980});close(older.clock,10);
 const future=input.captureTime({clock:10,lastNow:20,sourceNow:20.12,performanceNow:20.12,eventTimeStamp:999999});close(future.clock,10.12);
 const stale=input.captureTime({clock:10,lastNow:20,sourceNow:20.12,performanceNow:20.12,eventTimeStamp:19000});close(stale.clock,10.12);
});

test('custom simulation clocks and invalid timestamps remain authoritative',()=>{
 const custom=input.captureTime({clock:10,lastNow:20,sourceNow:20.12,performanceNow:2,eventTimeStamp:1900,useEventTimeStamp:false});close(custom.clock,10.12);
 const epoch=input.captureTime({clock:10,lastNow:20,sourceNow:20.12,performanceNow:2,eventTimeStamp:1790000000000});close(epoch.clock,10.12);
 assert.deepEqual(input.captureTime({clock:10,lastNow:20,sourceNow:NaN}),{clock:10,lastNow:20});
 assert.deepEqual(input.captureTime({clock:10,lastNow:null,sourceNow:20}),{clock:10,lastNow:20});
 assert.deepEqual(input.captureTime({clock:10,lastNow:20,sourceNow:19}),{clock:10,lastNow:20});
});

test('two fingers may alternate rapidly but a duplicate held pointer cannot score twice',()=>{
 const calls=[],tracker=input.createPressTracker({onPress:(event,source)=>calls.push(['down',source,event.time]),onRelease:(event,source)=>calls.push(['up',source,event.time])});
 assert.equal(tracker.down('pointer:1',{time:0}),true);assert.equal(tracker.down('pointer:1',{time:.001}),false);
 assert.equal(tracker.down('pointer:2',{time:.078}),true);tracker.up('pointer:1',{time:.09});tracker.up('pointer:2',{time:.10});
 assert.equal(tracker.down('pointer:1',{time:.156}),true);tracker.up('pointer:1',{time:.17});
 assert.deepEqual(calls.filter(row=>row[0]==='down').map(row=>row[2]),[0,.078,.156]);assert.deepEqual(tracker.getState().held,[]);
});

test('cancel/reset clears physical holds without synthesizing release penalties or a debounce delay',()=>{
 const resets=[],releases=[],tracker=input.createPressTracker({onReset:(reason,sources)=>resets.push({reason,sources}),onRelease:(event,source)=>releases.push(source)});
 tracker.down('key:Space',{});tracker.down('pointer:2',{});tracker.reset('hidden');
 assert.deepEqual(releases,[]);assert.deepEqual(resets,[{reason:'hidden',sources:['key:Space','pointer:2']}]);
 assert.equal(tracker.down('pointer:2',{}),true);tracker.up('pointer:2',{});assert.deepEqual(releases,['pointer:2']);
});
