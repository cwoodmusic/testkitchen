import test from 'node:test';
import assert from 'node:assert/strict';
import {CAST,CAST_IMAGE} from './cast.mjs';
import {getNpcSpriteFrame} from './npc-sprites.mjs';
import {PIP_FORWARD_FALL,forwardFallBlend,getNpcForwardFall} from './npc-gestures.mjs';

const project=()=>({settings:{castImage:CAST_IMAGE},cast:structuredClone(CAST)});
const actor={id:'pip',character:'pip',worldSize:160,feet:{x:700,y:700},facing:'down'};
const near=(actual,expected)=>assert(Math.abs(actual-expected)<.000001,`${actual} != ${expected}`);
function select(p,gesture,progress,facing='down'){
 const pose={id:'pip',x:700,y:700,facing,moving:false,gesture,gestureProgress:progress};
 return getNpcForwardFall({project:p,actor,pose,standingSprite:getNpcSpriteFrame({project:p,actor,pose})});
}

test('the dedicated prone poses point head-first along each actual facing direction',()=>{
 const p=project(),directions={down:[0,1],left:[-1,0],right:[1,0],up:[0,-1]};
 for(const [facing,[dx,dy]]of Object.entries(directions)){
  const visual=select(p,'fallen',.5,facing);assert.equal(visual.mode,'forward-fall');assert.equal(visual.pose,'prone');
  assert.equal(visual.standingOpacity,0);assert.equal(visual.layers.length,1);const layer=visual.layers[0];
  assert.equal(layer.pose,'prone');assert.equal(layer.row,PIP_FORWARD_FALL.directions.indexOf(facing));assert.equal(layer.frame,1);
  assert(visual.head.x*dx+visual.head.y*dy>10,`${facing} puts the cap ahead of the rear heels, rather than rolling sideways`);
  assert.equal(layer.image,'assets/pip-forward-fall.webp');assert.equal(layer.backgroundSize,'300% 400%');
  assert(layer.anchor.every(n=>Number.isFinite(n)&&n>=0&&n<=1));
 }
 assert(Object.isFrozen(PIP_FORWARD_FALL.anchors[0][0]));
});

test('real stumble, prone and push-up artwork joins the standing sprite without a transition pop',()=>{
 const p=project();
 for(const facing of PIP_FORWARD_FALL.directions){
  const start=select(p,'trip',0,facing),tripEnd=select(p,'trip',1,facing),down=select(p,'fallen',0,facing),recover=select(p,'recover',0,facing),end=select(p,'recover',1,facing);
  near(start.standingOpacity,1);near(end.standingOpacity,1);near(tripEnd.standingOpacity,0);
  for(const [first,second]of [[tripEnd.head,down.head],[down.head,recover.head],[start.head,end.head]]){near(first.x,second.x);near(first.y,second.y);}
  let last=null;
  for(const gesture of ['trip','fallen','recover'])for(let step=0;step<=100;step++){
   const visual=select(p,gesture,step/100,facing);
   near(visual.standingOpacity+visual.layers.reduce((sum,layer)=>sum+layer.opacity,0),1);
   assert(visual.layers.length<=2);assert(visual.layers.every(layer=>layer.opacity>=0&&layer.opacity<=1));
   if(last)assert(Math.hypot(visual.head.x-last.head.x,visual.head.y-last.head.y)<9,'Head movement remains continuous through frame blends and gesture boundaries.');
   last=visual;
  }
 }
 assert.equal(forwardFallBlend('trip',.35).from,'stumble');assert.equal(forwardFallBlend('recover',.48).from,'pushup');
});

test('fall selection is deterministic and leaves logical feet, timing and authoring data untouched',()=>{
 const p=project(),before=JSON.stringify(p),pose={id:'pip',x:500,y:800,facing:'right',gesture:'recover',gestureProgress:.7};
 const original=structuredClone(pose),first=getNpcForwardFall({project:p,actor,pose});
 for(let repeat=0;repeat<10;repeat++)assert.deepEqual(getNpcForwardFall({project:p,actor,pose}),first);
 assert.deepEqual(pose,original);assert.equal(JSON.stringify(p),before);assert(Object.isFrozen(first));assert(Object.isFrozen(first.layers[0]));
 assert.throws(()=>{first.layers[0].anchor[0]=0;},TypeError);
 for(const invalid of [NaN,Infinity,-Infinity,undefined]){
  const visual=select(p,'trip',invalid);assert(Number.isFinite(visual.progress));assert(Number.isFinite(visual.head.x)&&Number.isFinite(visual.head.y));
 }
 assert.equal(select(p,null,0),null);assert.equal(select(p,'magnify',.5),null);
});

test('saved portrait-only stock projects gain the fall poses while custom artwork keeps its own renderer',()=>{
 const current=project(),legacy=project();delete legacy.cast.pip.walk;
 for(const facing of PIP_FORWARD_FALL.directions)assert.deepEqual(select(current,'fallen',.5,facing),select(legacy,'fallen',.5,facing));
 for(const edit of [
  p=>{p.settings.castImage='assets/my-cast.webp';},p=>{p.cast.pip.column=1;},p=>{p.cast.pip.anchor=[.3,.8];},
  p=>{p.cast.pip.walk.image='assets/my-pip.webp';},p=>{p.cast.pip.walk.anchors[0][0]=[.3,.8];},
  p=>{p.cast.pip.walk=false;},p=>{p.cast.pip.forwardFall=false;},
 ]){const p=project();edit(p);assert.equal(select(p,'fallen',.5),null);}
 const p=project(),nell={...actor,id:'nell',character:'nell'};
 assert.equal(getNpcForwardFall({project:p,actor:nell,pose:{gesture:'fallen',gestureProgress:.5}}),null);
});
