const test=require('node:test'),assert=require('node:assert/strict');
const timing=require('../rhythm-timing.js'),streaks=require('../rhythm-streak.js');
const round=(targets=[0,.5,1],tolerance=.15)=>({targets,tolerance,matched:new Set(),taps:[],extras:0});
const tap=(tracker,r,time)=>{const result=timing.grade(r,time);tracker.tap(r,result);return result;};
const clean=(tracker,count=3)=>{const r=round(Array.from({length:count},(_,index)=>index*.5));tracker.begin(r);for(let i=0;i<count;i++)tap(tracker,r,i*.5);tracker.finish(r);return r;};

test('matched early/late notes and opening grace count consistently with arcade missions across rounds',()=>{
 const tracker=streaks.create(),r=round();tracker.begin(r);
 assert.equal(tap(tracker,r,-.18).openingGrace,true);
 assert.ok(tap(tracker,r,.4).error<-.07);assert.ok(tap(tracker,r,1.1).error>.07);
 assert.deepEqual(tracker.finish(r),{current:3,best:3});
 clean(tracker,2);assert.deepEqual(tracker.snapshot(),{current:5,best:5});
});

test('count-in warmups and the protected downbeat repeat cannot break or double-count a streak',()=>{
 const tracker=streaks.create();clean(tracker,3);const r=round([0,.125,.25],.1);tracker.begin(r);
 for(const time of [-2,-.5])assert.equal(tap(tracker,r,time).warmup,true);
 assert.deepEqual(tracker.snapshot(),{current:3,best:3});assert.equal(r.taps.length,0);
 assert.equal(tap(tracker,r,-.18).hit,true);assert.equal(tap(tracker,r,.02).warmup,true);
 assert.equal(tracker.snapshot().current,4);tap(tracker,r,.125);tap(tracker,r,.25);
 assert.deepEqual(tracker.finish(r),{current:6,best:6});
});

test('live misses wait through normal grading tolerance and the bounded event delivery delay',()=>{
 const tracker=streaks.create();clean(tracker,3);const r=round([.5,1]);tracker.begin(r);
 tracker.advance(r,.9);assert.equal(tracker.snapshot().current,3);
 tracker.advance(r,.900001);assert.deepEqual(tracker.snapshot(),{current:0,best:3});
 tap(tracker,r,1);assert.equal(tracker.snapshot().current,1);
 tracker.finish(r);assert.equal(tracker.snapshot().current,1,'A completed suffix survives an earlier missed note');
});

test('the opening downbeat uses its larger grace before a live miss',()=>{
 const tracker=streaks.create();clean(tracker,2);const r=round([0,.5],.1);tracker.begin(r);
 tracker.advance(r,.45);assert.equal(tracker.snapshot().current,2);
 tracker.advance(r,timing.OPENING_GRACE+.25);assert.equal(tracker.snapshot().current,2);
 tracker.advance(r,timing.OPENING_GRACE+.250001);assert.equal(tracker.snapshot().current,0);
 tap(tracker,r,.5);assert.deepEqual(tracker.finish(r),{current:1,best:2});
});

test('a valid queued pointer event remains eligible after audio time passes the ordinary window',()=>{
 const tracker=streaks.create();clean(tracker,2);const r=round([.5],.15);tracker.begin(r);
 tracker.advance(r,.89);assert.equal(tracker.snapshot().current,2);
 const corrected=timing.inputTime(.89,750,1000);assert.equal(corrected,.64);
 assert.equal(tap(tracker,r,corrected).hit,true);assert.deepEqual(tracker.finish(r),{current:3,best:3});
});

test('a skipped note resets before the next matched note, then the new run can continue',()=>{
 const tracker=streaks.create();clean(tracker,4);const r=round();tracker.begin(r);
 tap(tracker,r,.5);assert.deepEqual(tracker.snapshot(),{current:1,best:4});
 tap(tracker,r,1);assert.deepEqual(tracker.finish(r),{current:2,best:4});
 clean(tracker,3);assert.deepEqual(tracker.snapshot(),{current:5,best:5});
});

test('missed trailing notes reset immediately at round end while silence during rests preserves a run',()=>{
 const tracker=streaks.create();clean(tracker,3);const r=round();tracker.begin(r);tap(tracker,r,0);
 assert.deepEqual(tracker.finish(r),{current:0,best:4});
 clean(tracker,2);const rest=round([]);tracker.begin(rest);tracker.advance(rest,100);
 assert.deepEqual(tracker.finish(rest),{current:2,best:4});
 const badRest=round([]);tracker.begin(badRest);tap(tracker,badRest,0);
 assert.deepEqual(tracker.finish(badRest),{current:0,best:4});
});

test('extra taps break a run once and recovery later in the same round is kept',()=>{
 const tracker=streaks.create(),r=round();tracker.begin(r);tap(tracker,r,0);
 assert.equal(tap(tracker,r,.25).hit,false);assert.deepEqual(tracker.snapshot(),{current:0,best:1});
 tap(tracker,r,.5);tap(tracker,r,1);assert.deepEqual(tracker.finish(r),{current:2,best:2});
});

test('stale finished rounds and duplicate grading callbacks cannot alter the current run',()=>{
 const tracker=streaks.create(),old=clean(tracker,3),r=round();tracker.begin(r);
 const result=timing.grade(r,0);tracker.tap(r,result);tracker.tap(r,result);
 assert.deepEqual(tracker.snapshot(),{current:4,best:4});
 tracker.tap(old,{hit:false});tracker.begin(old);tracker.advance(old,100);tracker.finish(old);
 assert.deepEqual(tracker.snapshot(),{current:4,best:4});
});

test('stopping resets the current run, retains the best, and ignores old input after restarting',()=>{
 const tracker=streaks.create(),old=clean(tracker,5);assert.deepEqual(tracker.reset(),{current:0,best:5});
 clean(tracker,2);tracker.tap(old,{hit:false});tracker.finish(old);
 assert.deepEqual(tracker.snapshot(),{current:2,best:5});
 const snapshot=tracker.snapshot();snapshot.current=999;assert.equal(tracker.snapshot().current,2);
});

test('invalid rounds fail safely and feedback errors cannot interrupt real scoring',()=>{
 const tracker=streaks.create(()=>{throw Error('feedback failed');});tracker.tap(null,{hit:false});clean(tracker,2);
 for(const invalid of [null,{},round([0,0]),round([NaN]),round([-.5]),round(Array.from({length:129},(_,i)=>i)),round([0],NaN)]){
  tracker.begin(invalid);assert.deepEqual(tracker.snapshot(),{current:0,best:2});
 }
 const r=round();tracker.begin(r);tap(tracker,r,0);tracker.advance(r,NaN);tracker.advance(r,-1);
 assert.deepEqual(tracker.snapshot(),{current:1,best:2});
});
