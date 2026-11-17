import test from 'node:test';
import assert from 'node:assert/strict';
import {getDepotPropState,DEPOT_COURIER,DEPOT_CUE_DURATION_MS,createDepotProps} from './depot-props.mjs';

const caption=(elapsedMs,stageCue='courier-signal',extra={})=>({phase:'story',finished:false,manualDialogue:true,currentTile:1000,dialogueElapsed:elapsedMs,quantumMs:100,beat:{id:'depot-arrival-2',kind:'dialogue',speaker:'pip',text:'Watch the bird.',startTile:10,stageCue},...extra});

test('the courier turns before its screen receives the pulse, on the manual speech clock',()=>{
 const turn=getDepotPropState(caption(400));
 assert.equal(turn.bird.frame,2);assert.equal(turn.bird.phase,'turn');assert.equal(turn.radar.phase,'listening');
 const received=getDepotPropState(caption(1700));
 assert.equal(received.radar.phase,'received');assert(received.radar.flash>0);assert(received.radar.pulseOpacity>0);
 assert.equal(received.elapsedMs,1700,'A parked physical timeline does not age a new spoken cue.');
 assert.equal(getDepotPropState(caption(200)).radar.received,false);
});

test('radar speech receives once, waits without a reply, then settles and releases RAF',()=>{
 assert.equal(getDepotPropState(caption(0,'radar')).radar.phase,'scan');
 assert.equal(getDepotPropState(caption(650,'radar')).radar.phase,'received');
 assert(getDepotPropState(caption(500,'radar')).radar.pulseScale>getDepotPropState(caption(1000,'radar')).radar.pulseScale,'The received pulse converges inward without an outgoing echo.');
 assert.equal(getDepotPropState(caption(1800,'radar')).radar.phase,'waiting');
 const last=getDepotPropState(caption(DEPOT_CUE_DURATION_MS,'radar'));
 assert.equal(last.radar.phase,'no-reply');assert.equal(last.radar.flash,0);assert.equal(last.radar.pulseOpacity,0);assert.equal(last.radar.sweepOpacity,0);
 assert.equal(last.active,false);assert.equal(last.bird.visible,false);
 assert.equal(getDepotPropState(caption(DEPOT_CUE_DURATION_MS-1)).active,true);
 assert.equal(getDepotPropState(caption(60000)).active,false,'Waiting for player input never creates an endless animation.');
});

test('seek and pause sample the same finite pose without a separate timer',()=>{
 const manual=caption(1700),automatic=caption(0,'courier-signal',{manualDialogue:false,currentTile:27});
 assert.deepEqual(getDepotPropState(manual),getDepotPropState(automatic));
 assert.deepEqual(getDepotPropState({...manual,playing:false}),getDepotPropState(manual));
 assert.deepEqual(getDepotPropState(manual),getDepotPropState(manual),'Repainting/revealing text cannot restart an illustration.');
 assert.equal(getDepotPropState({...manual,phase:'entry'}),null);
 assert.equal(getDepotPropState({...manual,finished:true}),null);
 assert.equal(getDepotPropState(caption(0,null)),null);
 assert.equal(getDepotPropState({...manual,beat:{...manual.beat,text:''}}),null);
});

test('reduced motion uses still poses and a stationary received pulse',()=>{
 const turning=getDepotPropState(caption(400),{reducedMotion:true}),received=getDepotPropState(caption(1700),{reducedMotion:true});
 assert.equal(turning.bird.frame,2);assert.equal(received.bird.frame,2);
 assert.equal(turning.radar.angle,0);assert.equal(received.radar.angle,0);assert.equal(received.radar.sweepOpacity,0);
 assert.equal(received.radar.pulseScale,.7);assert.equal(received.radar.pulseOpacity,.55);
 assert.equal(getDepotPropState(caption(5000),{reducedMotion:true}).bird.frame,0);
});

test('all six atlas poses keep their measured feet inside the original case',()=>{
 assert.equal(DEPOT_COURIER.feet.length,6);
 assert.equal(DEPOT_COURIER.columns*DEPOT_COURIER.rows,6);
 for(const [x,y]of DEPOT_COURIER.feet){assert(x>0&&x<1);assert.equal(y,405/512);}
 assert(Object.isFrozen(DEPOT_COURIER));assert(Object.isFrozen(DEPOT_COURIER.feet));assert(Object.isFrozen(DEPOT_COURIER.feet[0]));
});

test('other rooms and custom room artwork never gain stock overlay layers',()=>{
 for(const scene of [{id:'garden-porch',image:'assets/garden-porch.webp'},{id:'depot',image:'data:image/png;base64,custom'}]){
  const view=createDepotProps({scene,map:null});
  assert.equal(view.needsAnimation(caption(0)),false);assert.doesNotThrow(()=>view.paint(caption(100)));assert.doesNotThrow(()=>view.destroy());
 }
});
