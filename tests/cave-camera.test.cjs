const test=require('node:test'),assert=require('node:assert/strict');
const {createCodaCaveCamera}=require('../cave-camera.js');
function fixture(){let focus={x:500,y:310},enabled=true,gesture={};let starts=0;const camera=createCodaCaveCamera({canvas:{width:1000,height:620,getBoundingClientRect:()=>({left:20,top:30,width:500,height:310})},getFocus:()=>focus,enabled:()=>enabled,getGestureState:()=>gesture,onGestureStart:()=>starts++});return{camera,setFocus:value=>focus=value,setEnabled:value=>enabled=value,setGesture:value=>gesture=value,starts:()=>starts};}
test('cave zoom follows the boat or avatar, keeps map bounds, and converts displayed input back to world coordinates',()=>{
 const f=fixture();assert.deepEqual(f.camera.toWorld(270,185),{x:500,y:310});f.camera.setZoom(2);assert.deepEqual(f.camera.toWorld(270,185),{x:500,y:310});assert.equal(f.camera.getState().x,250);assert.equal(f.camera.getState().visibleWidth,500);
 f.setFocus({x:120,y:285});f.camera.update();assert.equal(f.camera.getState().x,0);assert.equal(f.camera.getState().y,130);assert.deepEqual(f.camera.toWorld(140,185),{x:120,y:285});
 f.setFocus({x:990,y:615});f.camera.update();assert.equal(f.camera.getState().x,500);assert.equal(f.camera.getState().y,310);f.camera.reset();assert.equal(f.camera.getState().x,0);assert.equal(f.camera.getState().y,0);
});
test('pinch ratios clamp to a usable range and a remaining suppressed finger keeps the movement guard active',()=>{
 const f=fixture();f.camera.onPinch({phase:'start',distance:100});f.camera.onPinch({phase:'move',distance:240});assert.equal(f.camera.getState().zoom,2.4);assert.equal(f.starts(),1);f.camera.onPinch({phase:'move',distance:1000});assert.equal(f.camera.getState().zoom,3);f.camera.onPinch({phase:'move',distance:10});assert.equal(f.camera.getState().zoom,1);
 f.setGesture({suppressed:true});f.camera.onPinch({phase:'end'});assert.equal(f.camera.getState().pinching,true);f.setGesture({});assert.equal(f.camera.getState().pinching,false);f.setEnabled(false);f.camera.onPinch({phase:'start',distance:100});assert.equal(f.starts(),1);
});
test('canvas transforms remain balanced and preferences are not corrupted by nonfinite zoom input',()=>{
 const f=fixture(),calls=[];f.camera.setZoom(2);const ctx={save:()=>calls.push('save'),restore:()=>calls.push('restore'),scale:(...v)=>calls.push(['scale',...v]),translate:(...v)=>calls.push(['translate',...v])};f.camera.begin(ctx);f.camera.end(ctx);assert.deepEqual(calls,['save',['scale',2,2],['translate',-250,-155],'restore']);for(const value of [NaN,Infinity,undefined])f.camera.setZoom(value);assert.equal(f.camera.getState().zoom,2);f.camera.destroy();f.camera.setZoom(3);assert.equal(f.camera.getState().zoom,2);
});

test('a cropped phone viewport follows the visible clip and keeps the actual artwork inside its bounds',()=>{
 let focus={x:135,y:285};
 const viewport={clientWidth:400,clientHeight:620,clientLeft:0,clientTop:0,getBoundingClientRect:()=>({left:20,top:30,width:400,height:620})};
 const canvas={width:1000,height:620,parentElement:viewport,getBoundingClientRect:()=>({left:-280,top:30,width:1000,height:620})};
 const camera=createCodaCaveCamera({canvas,getFocus:()=>focus,controls:false});
 assert.deepEqual(camera.getState().viewport,{left:300,top:0,width:400,height:620});
 assert.equal(camera.getState().x,-300,'Hidden canvas width must not keep shore actors off screen');
 assert.deepEqual(camera.toWorld(155,315),{x:135,y:285});
 camera.setZoom(2);assert.deepEqual(camera.toWorld(220,340),focus);
 for(const point of [{x:0,y:0},{x:1000,y:620},{x:500,y:310}]){
  focus=point;camera.update();const state=camera.getState(),view=state.viewport;
  assert.ok(state.x+view.left/state.zoom>=-1e-8);
  assert.ok(state.x+(view.left+view.width)/state.zoom<=1000+1e-8);
  assert.ok(state.y+view.top/state.zoom>=-1e-8);
  assert.ok(state.y+(view.top+view.height)/state.zoom<=620+1e-8);
 }
});

test('cover sizing retains the native aspect ratio and clears only its own inline dimensions',()=>{
 let cover=true;const viewport={clientWidth:390,clientHeight:650,clientLeft:0,clientTop:0,getBoundingClientRect:()=>({left:0,top:0,width:390,height:650})};
 const canvas={width:1000,height:620,parentElement:viewport,style:{},getBoundingClientRect(){const width=parseFloat(this.style.width)||390,height=parseFloat(this.style.height)||241.8;return {left:(390-width)/2,top:(650-height)/2,width,height};}};
 const camera=createCodaCaveCamera({canvas,coverViewport:()=>cover,controls:false});
 assert.ok(parseFloat(canvas.style.height)>=650);assert.ok(parseFloat(canvas.style.width)>=390);
 assert.ok(Math.abs(parseFloat(canvas.style.width)/parseFloat(canvas.style.height)-1000/620)<1e-10);
 assert.ok(camera.getState().visibleWidth<400,'A phone must display a closer slice of the world');
 cover=false;camera.update();assert.equal(canvas.style.width,'');assert.equal(canvas.style.height,'');
});

test('mobile begins close once and keeps a chosen overview zoom through later room entries',()=>{
 let enabled=false;
 const canvas={width:1000,height:620,getBoundingClientRect:()=>({left:0,top:0,width:390,height:241.8})};
 const camera=createCodaCaveCamera({canvas,isMobile:true,enabled:()=>enabled,controls:false});
 assert.equal(camera.getState().zoom,1,'A hidden room has no active mobile view yet');
 enabled=true;camera.update();assert.equal(camera.getState().zoom,2);
 camera.reset();camera.update();assert.equal(camera.getState().zoom,1);
 enabled=false;camera.update();enabled=true;camera.update();assert.equal(camera.getState().zoom,1,'Returning must keep the chosen overview instead of forcing another close-up');
});
