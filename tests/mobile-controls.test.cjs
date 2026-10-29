const test=require('node:test'),assert=require('node:assert/strict');
const {createHoldRouter}=require('../mobile-controls.js');
function fixture(){const calls=[];let context={id:'world',enabled:true,key:(key,down)=>calls.push(['world',key,down]),release:()=>calls.push(['release','world'])};return {calls,router:createHoldRouter(()=>context),set:value=>context=value};}
test('diagonal movement and simultaneous jump are independent until every finger releases',()=>{
 const {router,calls}=fixture();router.hold(1,['w','d']);router.hold(2,[' ']);router.release(2);assert.deepEqual(router.snapshot()[0].keys,['w','d']);router.release(1);
 assert.deepEqual(calls,[['world','w',true],['world','d',true],['world',' ',true],['world',' ',false],['world','w',false],['world','d',false]]);
});
test('overlapping fingers cannot release a direction still held by another finger',()=>{
 const {router,calls}=fixture();router.hold(1,['d']);router.hold(2,['w','d']);router.release(1);assert.equal(calls.filter(row=>row[1]==='d'&&row[2]===false).length,0);router.release(2);assert.equal(calls.filter(row=>row[1]==='d'&&row[2]===false).length,1);
});
test('cancel and context changes release the original room without leaking inputs into the next one',()=>{
 const {router,calls,set}=fixture();router.hold(1,['d']);set({id:'piano',enabled:true,key:(key,down)=>calls.push(['piano',key,down])});router.hold(1,['e']);router.releaseAll();assert.deepEqual(calls.slice(0,4),[['world','d',true],['world','d',false],['piano','e',true],['piano','e',false]]);assert.deepEqual(router.snapshot(),[]);
});
test('disabled menus reject input and repeated pointer moves never repeat an action',()=>{
 const {router,calls,set}=fixture();router.hold(1,['e']);router.hold(1,['e']);assert.equal(calls.length,1);set({id:'world',enabled:false});router.hold(1,['e']);assert.deepEqual(calls,[['world','e',true],['world','e',false]]);assert.deepEqual(router.snapshot(),[]);
});

const {joystickVector,vectorKeys,createJoystickRouter}=require('../mobile-controls.js');
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10,`${actual} differs from ${expected}`);

test('the radial deadzone prevents drift while preserving the thumb position',()=>{
 const center=joystickVector(0,0,50);assert.deepEqual(center,{x:0,y:0,strength:0,thumbX:0,thumbY:0});
 const tiny=joystickVector(3,4,50);assert.equal(tiny.strength,0);assert.equal(tiny.x,0);assert.equal(tiny.y,0);near(tiny.thumbX,3);near(tiny.thumbY,4);
 const edge=joystickVector(8,0,50);assert.equal(edge.strength,0);
 const deliberate=joystickVector(8.1,0,50);assert.ok(deliberate.strength>0);assert.ok(deliberate.strength<.01);
});

test('joystick angles remain analog and travel clamps outside the base',()=>{
 const gentle=joystickVector(20,10,50);near(gentle.y/gentle.x,.5);assert.ok(gentle.strength>0&&gentle.strength<.5);
 const far=joystickVector(300,-400,50);near(far.x,.6);near(far.y,-.8);near(far.strength,1);near(far.thumbX,30);near(far.thumbY,-40);
 const diagonal=joystickVector(50,50,50);near(Math.hypot(diagonal.x,diagonal.y),1);near(Math.hypot(diagonal.thumbX,diagonal.thumbY),50);
 const directions=Array.from({length:360},(_,degree)=>joystickVector(Math.cos(degree*Math.PI/180)*50,Math.sin(degree*Math.PI/180)*50,50));
 assert.equal(new Set(directions.map(({x,y})=>x.toFixed(5)+','+y.toFixed(5))).size,360,'All angles must be retained rather than snapping to eight buttons');
});

test('invalid geometry becomes neutral and the digital fallback covers eight directions',()=>{
 for(const args of [[NaN,1,50],[1,Infinity,50],[1,1,0],[1,1,-4],[1,1,NaN]])assert.deepEqual(joystickVector(...args),{x:0,y:0,strength:0,thumbX:0,thumbY:0});
 assert.deepEqual(vectorKeys(0,0),[]);
 assert.deepEqual([[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]].map(([x,y])=>vectorKeys(x,y)),[['d'],['s','d'],['s'],['s','a'],['a'],['w','a'],['w'],['w','d']]);
});

test('analog steering does not emit fallback keys or release a second action finger',()=>{
 const calls=[],context={id:'world',enabled:true,move:(x,y)=>calls.push(['move',x,y]),key:(key,down)=>calls.push(['key',key,down])};
 const holds=createHoldRouter(()=>context),stick=createJoystickRouter(()=>context,holds);
 stick.move(.3,.4);holds.hold(2,[' ']);stick.move(.3,.4);
 assert.equal(calls.filter(call=>call[0]==='move').length,1,'Repeated unchanged pointer moves should be quiet');
 stick.release();assert.deepEqual(holds.snapshot(),[{id:2,context:'world',keys:[' ']}]);
 assert.deepEqual(calls,[['move',.3,.4],['key',' ',true],['move',0,0]]);
 holds.release(2);assert.deepEqual(calls.at(-1),['key',' ',false]);assert.equal(stick.getState().strength,0);
});

test('switching views or disabling input stops only the original analog context',()=>{
 const calls=[];let context={id:'world',enabled:true,move:(x,y)=>calls.push(['world',x,y])};
 const stick=createJoystickRouter(()=>context);stick.move(.2,.4);
 context={id:'piano',enabled:true,move:(x,y)=>calls.push(['piano',x,y])};stick.move(-.5,.1);
 assert.deepEqual(calls.slice(0,3),[['world',.2,.4],['world',0,0],['piano',-.5,.1]]);
 context={id:'classroom',enabled:false,move:(x,y)=>calls.push(['classroom',x,y])};
 assert.equal(stick.move(1,0),false);assert.deepEqual(calls.at(-1),['piano',0,0]);
 assert.deepEqual(stick.getState(),{context:null,x:0,y:0,strength:0,analog:false});
 assert.equal(calls.some(call=>call[0]==='classroom'),false);
});

test('analog and fallback routes clamp inputs and preserve overlapping key holds',()=>{
 const calls=[];let context={id:'piano',enabled:true,move:(x,y)=>calls.push(['move',x,y]),key:(key,down)=>calls.push(['key',key,down])};
 const holds=createHoldRouter(()=>context),stick=createJoystickRouter(()=>context,holds);
 stick.move(3,4);near(calls[0][1],.6);near(calls[0][2],.8);
 stick.move(NaN,0);assert.deepEqual(calls.at(-1),['move',0,0]);
 context={id:'legacy',enabled:true,key:(key,down)=>calls.push(['legacy',key,down])};
 holds.hold(7,['d']);stick.move(1,-1);stick.release();
 assert.equal(calls.filter(call=>call[0]==='legacy'&&call[1]==='d'&&call[2]===false).length,0);
 assert.deepEqual(holds.snapshot(),[{id:7,context:'legacy',keys:['d']}]);
 holds.release(7);assert.deepEqual(calls.at(-1),['legacy','d',false]);
});
