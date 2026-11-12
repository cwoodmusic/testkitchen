import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import{createConcertCurtain,CONCERT_CHANGEOVER,drawConcertCurtain}from'./concert-curtain.mjs';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
const track=id=>({id});
const create=()=>{const swaps=[];return{swaps,curtain:createConcertCurtain({createPerformance:p=>{swaps.push(p.id);return{id:p.id};}})};};
test('entry shows the current act; every recording change closes before its hidden ensemble swap',()=>{
 const {curtain:c,swaps}=create();assert.equal(c.update(track('one'),10).closure,0);
 assert.equal(c.update(track('two'),11).performance.id,'one');
 const halfway=c.update(track('two'),11.35);assert(halfway.closure>0&&halfway.closure<1);assert.equal(halfway.performance.id,'one');
 const closed=c.update(track('two'),11.7);assert.equal(closed.closure,1);assert.equal(closed.performance.id,'two');assert.equal(closed.phase,'closed');
 const opening=c.update(track('two'),12.2);assert.equal(opening.performance.id,'two');assert(opening.closure>0&&opening.closure<1);
 assert.equal(c.update(track('two'),13).closure,0);assert.deepEqual(swaps,['one','two']);
});
test('rapid Next clicks coalesce while closed and never expose an intermediate act',()=>{
 const{curtain:c,swaps}=create();c.update(track('one'),0);c.update(track('two'),1);c.update(track('three'),1.2);
 assert.equal(c.update(track('three'),1.71).performance.id,'three');assert.deepEqual(swaps,['one','three']);
 const closed=c.update(track('four'),1.75);assert.equal(closed.closure,1);assert.equal(closed.performance.id,'four');
});
test('a new request while opening closes from its visible position without jumping fully open',()=>{
 const{curtain:c}=create();c.update(track('one'),0);c.update(track('two'),1);const first=c.update(track('two'),2.2);assert(first.closure>0&&first.closure<1);
 const next=c.update(track('three'),2.2);assert(Math.abs(next.closure-first.closure)<.08);assert.equal(next.performance.id,'two');
 assert.equal(c.update(track('three'),4).performance.id,'three');
});
test('reduced motion keeps a stationary closed intermission, then reveals the next act',()=>{
 const{curtain:c}=create();c.update(track('one'),0,{reducedMotion:true});const closed=c.update(track('two'),1,{reducedMotion:true});assert.equal(closed.closure,1);assert.equal(closed.performance.id,'two');assert.equal(c.update(track('two'),1.2,{reducedMotion:true}).closure,1);assert.equal(c.update(track('two'),1.4,{reducedMotion:true}).closure,0);
 c.reset();assert.equal(c.update(track('three'),20).closure,0);
});
test('a fully closed opaque curtain spans every performer and culls outside the hall view',()=>{
 const rects=[],c={save(){},restore(){},fillRect(x,y,w,h){rects.push({x,y,w,h,color:this.fillStyle});}};const stage={x:768,y:300,w:2560,h:900};
 assert(drawConcertCurtain(c,stage,{closure:1}));const opaque=rects.filter(r=>/^#[a-f0-9]{6}$/i.test(r.color));for(const[x,y]of[[768,255],[2048,470],[3328,1190]])assert(opaque.some(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h));assert.equal(drawConcertCurtain(c,stage,{closure:1},{viewport:{x:0,y:2000,w:100,h:100}}),false);
});

test('an open curtain leaves every native pipe-chamber pixel untouched with no valance, track or wings',async()=>{
 const cv=createCanvas(400,380),c=cv.getContext('2d'),stage={x:768,y:300,w:2560,h:900};
 c.fillStyle='#752e35';c.fillRect(0,0,400,380);
 const organ=await loadImage(new URL('../assets/concert/hall-organ.png',import.meta.url).pathname);
 c.drawImage(organ,42,40,300,312);
 const before=Buffer.from(c.getImageData(0,0,400,380).data);
 // This crop includes the actual native organ and the old y208 crossbar.
 c.translate(-1856,0);
 assert.equal(drawConcertCurtain(c,stage,{phase:'open',closure:0}),false);
 assert.deepEqual(Buffer.from(c.getImageData(0,0,400,380).data),before);
 cv.width=cv.height=1;
});

test('closed fabric covers the complete pipe chamber from the hidden rig to the same front-stage baseline',()=>{
 const cv=createCanvas(400,1208),c=cv.getContext('2d'),stage={x:768,y:300,w:2560,h:900};
 c.translate(-1856,0);assert(drawConcertCurtain(c,stage,{phase:'closed',closure:1}));
 const data=c.getImageData(42,0,300,1200).data;
 for(let i=3;i<data.length;i+=4)assert.equal(data[i],255,'The closed cloth must hide both the organ and changing performers');
 const below=c.getImageData(42,1200,300,8).data;
 for(let i=3;i<below.length;i+=4)assert.equal(below[i],0,'The front edge remains at stage y1200');
 cv.width=cv.height=1;
});

test('entry or re-entry during the shared audio changeover respects its current curtain and performer',()=>{
 const {curtain:c}=create(),one=track('one'),two=track('two');
 let state=c.update(one,10,{timeline:{phase:'closing',closure:.6,previousTrack:one,nextTrack:two}});assert.equal(state.performance.id,'one');assert.equal(state.closure,.6);
 state=c.update(two,10.4,{timeline:{phase:'closed',closure:1,previousTrack:one,nextTrack:two}});assert.equal(state.performance.id,'two');assert.equal(state.closure,1);
 c.reset();state=c.update(two,11,{timeline:{phase:'opening',closure:.4,previousTrack:one,nextTrack:two}});assert.equal(state.performance.id,'two');assert.equal(state.closure,.4);
 state=c.update(two,12);assert.equal(state.closure,0);assert.equal(state.performance.id,'two');
});
