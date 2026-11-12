import test from 'node:test';
import assert from 'node:assert/strict';
import {conductingMeter,conductingGeometry} from './concert-conducting.mjs';
import {createConcertCurtain} from './concert-curtain.mjs';
import {CONCERT_PROGRAMME} from './concert-programme.mjs';
import {createStagePerformance,updateStageProgramme,percussionPlayingGeometry} from './concert-performers.mjs';

test('simple and compound meters use their conducting pulses, not one circle for every piece',()=>{
 for(const [n,d,beats,subdivision] of [[2,4,2,1],[3,4,3,1],[4,4,4,1],[6,8,2,3],[9,8,3,3],[12,8,4,3]]){
  assert.deepEqual(conductingMeter({numerator:n,denominator:d}),{numerator:n,denominator:d,beats,subdivision});
 }
 assert.equal(conductingMeter({numerator:NaN,denominator:0}).beats,4);
});
test('four-beat baton pattern has a downbeat, inward second beat, outward third beat and upbeat',()=>{
 const opts={bpm:60,timeSignature:{numerator:4,denominator:4}},at=t=>conductingGeometry(t,opts).right;
 const [one,two,three,four]=[0,1,2,3].map(at);
 assert(one.y>four.y+20);assert(two.x<one.x);assert(three.x>one.x);assert(four.y<two.y);
 assert.deepEqual(at(4),at(0));
 // The baton approaches the downbeat from above rather than just circling.
 assert(at(3.9).y<one.y);
 for(let t=0;t<8;t+=.01){const g=conductingGeometry(t,opts);assert(g.right.y<=-14);assert(g.left.y<=-23);assert.equal(g.batonTip.y,g.right.y-14);}
});
test('compound duple and triple gestures repeat after two and three dotted-quarter pulses',()=>{
 for(const n of [6,9]){
  const opts={bpm:60,timeSignature:{numerator:n,denominator:8}},beats=n/3;
  assert.deepEqual(conductingGeometry(0,opts).right,conductingGeometry(beats,opts).right);
  assert.equal(conductingGeometry(beats-.01,opts).beat,beats-1);
 }
});
test('all current recordings have score meters and switching recordings updates timing without respawning musicians',()=>{
 assert.equal(CONCERT_PROGRAMME.find(t=>t.id==='grieg-morning').timeSignature.numerator,6);
 assert.equal(CONCERT_PROGRAMME.find(t=>t.id==='beethoven-storm').timeSignature.numerator,4);
 assert.equal(CONCERT_PROGRAMME.find(t=>t.id==='debussy-clair-de-lune').timeSignature.numerator,9);
 for(const track of CONCERT_PROGRAMME){assert(track.bpm>0);assert(track.timeSignature.denominator>0);}
 const [morning,storm]=['grieg-morning','beethoven-storm'].map(id=>CONCERT_PROGRAMME.find(t=>t.id===id));
 const p=createStagePerformance(morning),actors=p.actors,props=p.props;
 assert.equal(updateStageProgramme(p,storm),p);assert.equal(p.actors,actors);assert.equal(p.props,props);
 assert.deepEqual(p.timeSignature,storm.timeSignature);assert.equal(p.bpm,storm.bpm);
});
test('percussionists keep hands outboard and use instrument-specific striking motions',()=>{
 const p=createStagePerformance({kind:'orchestra'}),j=createStagePerformance({kind:'jazz'});
 for(const a of [...p.actors,...j.actors].filter(a=>['timpani','bass-drum','gong','drums'].includes(a.instrument))){
  assert.equal(a.instrumentPose,'concert');
  const prop=[...p.props,...j.props].find(q=>q.owner===a.id&&q.role==='instrument');
  assert(prop.y>=a.y+60,'Instrument is physically in front of the player');assert(prop.depth>a.y,'Body draws behind the instrument');
  let first;
  for(let beat=0;beat<Math.PI*2;beat+=.05){
   const g=percussionPlayingGeometry(a,beat);first??=g;
   assert(Math.abs(g.left[0])>=15&&Math.abs(g.right[0])>=15);
   assert.deepEqual(g.left,first.left);assert.deepEqual(g.right,first.right);
   assert.equal(g.sticks.length,['bass-drum','gong'].includes(a.instrument)?1:2);
   g.sticks.forEach((s,i)=>{
    assert(s.tip.every(Number.isFinite));
    const length=v=>Math.hypot(v.tip[0]-v.grip[0],v.tip[1]-v.grip[1]);
    assert(Math.abs(length(s)-length(first.sticks[i]))<1e-8,'Beaters rotate without changing length');
   });
  }
 }
});

test('an orchestra keeps the old meter until the curtain closes, then changes patterns on the same formation',()=>{
 const [first,next]=['grieg-morning','beethoven-storm'].map(id=>CONCERT_PROGRAMME.find(t=>t.id===id));
 const curtain=createConcertCurtain({createPerformance:(track,previous)=>previous?updateStageProgramme(previous,track):createStagePerformance(track)});
 const p=curtain.update(first,0).performance,actors=p.actors;
 assert.equal(p.timeSignature.numerator,6);
 curtain.update(next,1);assert.equal(p.timeSignature.numerator,6);
 const changed=curtain.update(next,1.71).performance;
 assert.equal(changed,p);assert.equal(changed.actors,actors);assert.equal(changed.timeSignature.numerator,4);assert.equal(changed.bpm,next.bpm);
});
