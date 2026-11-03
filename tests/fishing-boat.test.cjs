const test=require('node:test'),assert=require('node:assert/strict');
const boat=require('../fishing-boat.js');
const input={boat:{x:290,y:415,facing:'right',phase:0},time:10,occupied:true};
function context(){
 const calls=[],rects=[],stack=[];let matrix=[1,0,0,1,0,0];
 return {calls,rects,fillStyle:null,get depth(){return stack.length;},get matrix(){return [...matrix];},
  save(){stack.push({matrix:[...matrix],fillStyle:this.fillStyle});calls.push(['save']);},
  restore(){assert.ok(stack.length>0);const old=stack.pop();matrix=old.matrix;this.fillStyle=old.fillStyle;calls.push(['restore']);},
  translate(x,y){const [a,b,c,d]=matrix;matrix[4]+=a*x+c*y;matrix[5]+=b*x+d*y;calls.push(['translate',x,y]);},
  rotate(angle){const [a,b,c,d]=matrix,cos=Math.cos(angle),sin=Math.sin(angle);matrix[0]=a*cos+c*sin;matrix[1]=b*cos+d*sin;matrix[2]=-a*sin+c*cos;matrix[3]=-b*sin+d*cos;calls.push(['rotate',angle]);},
  fillRect(x,y,width,height){const [a,b,c,d,e,f]=matrix;rects.push({color:this.fillStyle,corners:[[x,y],[x+width,y],[x+width,y+height],[x,y+height]].map(([px,py])=>[a*px+c*py+e,b*px+d*py+f])});calls.push(['rect',x,y,width,height]);}
 };
}

test('idle boats gently bob while rowing follows actual travel phase',()=>{
 const idle=boat.pose(input),later=boat.pose({...input,time:11}),moving=boat.pose({...input,moving:true,boat:{...input.boat,phase:1}});
 assert.notEqual(idle.bob,later.bob);assert.equal(idle.stroke,0);assert.equal(idle.splash,0);
 assert.notEqual(moving.stroke,0);assert.ok(moving.splash>0);assert.notDeepEqual(moving.oars,idle.oars);assert.ok(Math.abs(moving.rock)<.06);
 const inputTimeOnly=boat.pose({...input,time:20,moving:true});assert.deepEqual(inputTimeOnly.oars,boat.pose({...input,moving:true}).oars,'Rowing does not continue when travel phase stops');
});
test('a paused clock and phase produce an identical pose without changing movement coordinates',()=>{
 const state={...input,moving:true,boat:{...input.boat,phase:3}},before=JSON.stringify(state),first=boat.pose(state);
 for(let frame=0;frame<120;frame++)assert.deepEqual(boat.pose(state),first);
 assert.equal(JSON.stringify(state),before);assert.equal(first.x,290);assert.equal(first.y,415);assert.deepEqual(first.hull,{halfWidth:18,halfHeight:12});
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
test('the rider stays upright while the hull follows all four steering directions',()=>{
 for(const [facing,heading]of [['down',0],['left',Math.PI/2],['up',Math.PI],['right',-Math.PI/2]]){
  const ctx=context(),render=boat.create();let rider=null;
  render.draw(ctx,{...input,boat:{...input.boat,facing},moving:true,drawRider:(value,pose)=>{
   assert.equal(value,ctx);rider=pose;assert.equal(ctx.depth,2);
   assert.deepEqual(ctx.matrix.slice(0,4),[1,0,0,1],'The rider never inherits hull rotation');
  }});
  assert.equal(rider.facing,facing,'The rider callback receives the original cardinal facing');assert.equal(rider.heading,heading);
  assert.ok(ctx.calls.some(call=>call[0]==='rotate'&&call[1]===heading));assert.equal(ctx.depth,0);
 }
});
test('pixel hulls fit the existing collision footprint even while bobbing in every direction',()=>{
 for(const occupied of [false,true])for(const origin of [input.boat,{x:270.35,y:435.65}])for(const facing of ['down','left','up','right'])for(const phase of [0,1,3,5]){
  const ctx=context(),render=boat.create();
  render.draw(ctx,{...input,boat:{...origin,facing,phase},moving:true,time:phase,occupied});
  const outline=ctx.rects.filter(rect=>rect.color==='#172a36');assert.equal(outline.length,5);
  const points=outline.flatMap(rect=>rect.corners),width=Math.max(...points.map(point=>point[0]))-Math.min(...points.map(point=>point[0])),height=Math.max(...points.map(point=>point[1]))-Math.min(...points.map(point=>point[1]));
  assert.ok(Math.abs(width-28)<1e-9&&Math.abs(height-20)<1e-9,'Every cardinal heading keeps a readable 28×20 world hull');
  for(const rect of outline)for(const [x,y]of rect.corners){
   assert.ok(Math.abs(x-origin.x)<=18+1e-9,`${facing} hull stays inside the boat's horizontal clearance`);
   assert.ok(Math.abs(y-origin.y)<=12+1e-9,`${facing} hull stays inside the boat's vertical clearance`);
  }
  for(const call of ctx.calls.filter(call=>call[0]==='rect'))assert.ok(call.slice(1).every(Number.isInteger),'All artwork uses whole-pixel rectangles');
  for(const call of ctx.calls.filter(call=>call[0]==='rotate'))assert.ok(Math.abs(call[1]/(Math.PI/2)-Math.round(call[1]/(Math.PI/2)))<1e-9,'Only cardinal turns rotate the pixel artwork');
 }
});
test('effects quality reduces splash density while calm modes draw no splashes',()=>{
 const splashes=quality=>{
  const ctx=context(),render=boat.create({getQuality:()=>quality});render.draw(ctx,{...input,moving:true});
  return ctx.rects.filter(rect=>['#a7e4e0b0','#65bfc9a0'].includes(rect.color)).length;
 };
 assert.equal(splashes('full'),8);assert.equal(splashes('lite'),4);assert.equal(splashes('off'),0);
});
test('drawing restores the caller context and returns independent snapshots',()=>{
 const render=boat.create(),ctx=context();let rider=null;
 render.draw(ctx,{...input,moving:true,drawRider:(value,pose)=>{assert.equal(value,ctx);rider=pose;assert.equal(ctx.depth,2);}});
 assert.ok(rider);assert.deepEqual(ctx.calls.slice(0,2),[['save'],['translate',290,415]]);
 assert.equal(ctx.depth,0);
 const copy=render.getState();copy.oars[0].tipX=999;assert.notEqual(render.getState().oars[0].tipX,999);
 render.draw(ctx,{...input,occupied:false,drawRider:()=>assert.fail('An empty boat cannot draw a rider')});assert.equal(ctx.depth,0);
 render.destroy();const count=ctx.calls.length;render.draw(ctx,input);assert.equal(ctx.calls.length,count);assert.equal(render.getState(),null);
});
