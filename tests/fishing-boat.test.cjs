const test=require('node:test'),assert=require('node:assert/strict');
const boat=require('../fishing-boat.js');
const input={boat:{x:290,y:415,facing:'right',phase:0},time:10,occupied:true};
function context(){const calls=[];let depth=0;return {calls,get depth(){return depth;},save(){depth++;calls.push(['save']);},restore(){depth--;assert.ok(depth>=0);calls.push(['restore']);},translate(...args){calls.push(['translate',...args]);},rotate(...args){calls.push(['rotate',...args]);},fillRect(...args){calls.push(['rect',...args]);},beginPath(){},ellipse(){},fill(){},moveTo(){},lineTo(){},quadraticCurveTo(){},closePath(){}};}

test('idle boats gently bob while rowing follows actual travel phase',()=>{
 const idle=boat.pose(input),later=boat.pose({...input,time:11}),moving=boat.pose({...input,moving:true,boat:{...input.boat,phase:1}});
 assert.notEqual(idle.bob,later.bob);assert.equal(idle.stroke,0);assert.equal(idle.splash,0);
 assert.notEqual(moving.stroke,0);assert.ok(moving.splash>0);assert.notDeepEqual(moving.oars,idle.oars);assert.ok(Math.abs(moving.rock)<.06);
 const inputTimeOnly=boat.pose({...input,time:20,moving:true});assert.deepEqual(inputTimeOnly.oars,boat.pose({...input,moving:true}).oars,'Rowing does not continue when travel phase stops');
});
test('a paused clock and phase produce an identical pose without changing movement coordinates',()=>{
 const state={...input,moving:true,boat:{...input.boat,phase:3}},before=JSON.stringify(state),first=boat.pose(state);
 for(let frame=0;frame<120;frame++)assert.deepEqual(boat.pose(state),first);
 assert.equal(JSON.stringify(state),before);assert.equal(first.x,290);assert.equal(first.y,415);assert.deepEqual(first.hull,{halfWidth:30,halfHeight:18});
});
test('reduced motion and effects off hold the boat and oars still even during travel',()=>{
 for(const options of [{reducedMotion:()=>true},{getQuality:()=> 'off'}]){
  const first=boat.pose({...input,moving:true},options),later=boat.pose({...input,time:99,moving:true,boat:{...input.boat,phase:20}},options);
  assert.equal(first.bob,0);assert.equal(first.rock,0);assert.equal(first.splash,0);assert.deepEqual(first.oars,later.oars);assert.equal(later.calm,true);
 }
});
test('rowing eases into a stroke and settles without snapping when movement stops',()=>{
 const render=boat.create(),ctx=context();render.draw(ctx,input);
 render.draw(ctx,{...input,time:10.05,moving:true,boat:{...input.boat,phase:1}});const starting=render.getState();
 assert.ok(starting.rowingAmount>0&&starting.rowingAmount<1);
 render.draw(ctx,{...input,time:10.1,moving:false,boat:{...input.boat,phase:1}});const stopping=render.getState();
 assert.ok(stopping.rowingAmount>0&&stopping.rowingAmount<starting.rowingAmount);
 for(let frame=0;frame<30;frame++)render.draw(ctx,{...input,time:10.1,moving:false,boat:{...input.boat,phase:1}});
 assert.deepEqual(render.getState(),stopping,'A paused caller clock must also freeze the easing state');
});
test('hull, rowing and rider share a balanced decorative transform',()=>{
 const render=boat.create(),ctx=context();let rider=null;
 render.draw(ctx,{...input,moving:true,drawRider:(value,pose)=>{assert.equal(value,ctx);rider=pose;assert.equal(ctx.depth,2);}});
 assert.ok(rider);assert.deepEqual(ctx.calls.slice(0,2),[['save'],['translate',290,415]]);
 assert.ok(ctx.calls.some(call=>call[0]==='rotate'&&call[1]===rider.rock));assert.equal(ctx.depth,0);
 const copy=render.getState();copy.oars[0].tipX=999;assert.notEqual(render.getState().oars[0].tipX,999);
 render.draw(ctx,{...input,occupied:false,drawRider:()=>assert.fail('An empty boat cannot draw a rider')});assert.equal(ctx.depth,0);
 render.destroy();const count=ctx.calls.length;render.draw(ctx,input);assert.equal(ctx.calls.length,count);assert.equal(render.getState(),null);
});
