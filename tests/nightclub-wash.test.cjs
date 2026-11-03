'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {POLYGON,contains,alphaAt,create}=require('../nightclub-wash.js');

function context(){
 const calls=[],stack=[];let matrix=[1,0,0,1,0,0];
 return {calls,globalAlpha:.35,globalCompositeOperation:'multiply',filter:'blur(2px)',shadowBlur:7,imageSmoothingEnabled:false,
  get depth(){return stack.length;},get matrix(){return matrix.slice();},
  save(){stack.push({matrix:matrix.slice(),alpha:this.globalAlpha,mode:this.globalCompositeOperation,filter:this.filter,shadow:this.shadowBlur,smoothing:this.imageSmoothingEnabled});calls.push(['save']);},
  restore(){const old=stack.pop();assert.ok(old,'Drawing must balance every save');matrix=old.matrix;this.globalAlpha=old.alpha;this.globalCompositeOperation=old.mode;this.filter=old.filter;this.shadowBlur=old.shadow;this.imageSmoothingEnabled=old.smoothing;calls.push(['restore']);},
  setTransform(...values){matrix=values;calls.push(['transform',...values]);},
  scale(x,y){matrix[0]*=x;matrix[1]*=x;matrix[2]*=y;matrix[3]*=y;calls.push(['scale',x,y]);},
  clearRect(...values){calls.push(['clear',...values]);},fillRect(...values){calls.push(['fill',...values]);},
  drawImage(...values){calls.push(['draw',this.globalCompositeOperation,this.globalAlpha,...values]);},
  beginPath(){calls.push(['begin']);},moveTo(...values){calls.push(['move',...values]);},lineTo(...values){calls.push(['line',...values]);},closePath(){calls.push(['close']);},clip(){calls.push(['clip']);},
  createImageData(width,height){calls.push(['pixels',width,height]);return {width,height,data:new Uint8ClampedArray(width*height*4)};},
  putImageData(value,x,y){this.pixels=value;calls.push(['put',x,y]);}
 };
}
function fixture(){const canvases=[],document={createElement(name){assert.equal(name,'canvas');const ctx=context(),canvas={width:0,height:0,getContext:()=>ctx};ctx.canvas=canvas;canvases.push(canvas);return canvas;}};return {document,canvases};}

test('the modern south-facing room has no wash outside its footprint or in the former diagonal',()=>{
 for(const [x,y]of [[760,600],[725,600],[808,700],[760,840],[30,700],[500,500],[-1,700],[NaN,700]])
  assert.equal(alphaAt(x,y),0,`No room light leaks at ${x},${y}`);
 for(const [x,y]of [[400,600],[755,740],[300,750]])assert.equal(alphaAt(x,y),255,`Keep the interior lighting at ${x},${y}`);
 assert.ok(Object.isFrozen(POLYGON)&&POLYGON.every(Object.isFrozen));
});

test('the exposed floor boundary fades inward smoothly rather than ending in a clipped rectangle',()=>{
 const levels=[649,650,660,670,680,690].map(y=>alphaAt(760,y));
 assert.equal(levels[0],0);assert.equal(levels.at(-1),255);
 for(let i=1;i<levels.length;i++)assert.ok(levels[i]>=levels[i-1]);
 assert.ok(levels[2]>0&&levels[2]<100);assert.ok(levels[3]>100&&levels[3]<200);assert.ok(levels[4]>200&&levels[4]<255);
 assert.equal(alphaAt(760,640),0);assert.ok(alphaAt(760,650)<5,'The first inward pixel starts almost transparent');
});

test('a cached low-resolution mask covers only interior samples and is reused across frames',()=>{
 const f=fixture(),wash=create({document:f.document}),target=context();
 assert.equal(f.canvases.length,0,'A disabled effect allocates no lighting surfaces');
 wash.draw(target,ctx=>ctx.fillRect(0,0,1672,941));
 assert.equal(f.canvases.length,2);assert.deepEqual(wash.getState(),{builds:1,frames:1,width:1672,height:941,raster:[836,471],feather:40});
 const mask=f.canvases[0].getContext('2d').pixels;let lit=0;
 for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++){
  const alpha=mask.data[(y*mask.width+x)*4+3];if(!alpha)continue;lit++;
  assert.equal(contains((x+.5)*1672/mask.width,(y+.5)*941/mask.height),true,'Every nontransparent mask sample is inside the actual room');
 }
 assert.ok(lit>50000,'Most of the modern room retains its lighting');
 wash.draw(target,()=>{});assert.equal(f.canvases.length,2);assert.equal(wash.getState().builds,1);assert.equal(wash.getState().frames,2);
 assert.equal(f.canvases[0].getContext('2d').calls.filter(call=>call[0]==='pixels').length,1,'Rasterize geometry only once');
});

test('painting uses world coordinates and screen compositing restores the caller context',()=>{
 const f=fixture(),wash=create({document:f.document}),target=context(),before={matrix:target.matrix,alpha:target.globalAlpha,mode:target.globalCompositeOperation,filter:target.filter,shadow:target.shadowBlur,smoothing:target.imageSmoothingEnabled};
 let painted=null;
 wash.draw(target,ctx=>{painted=ctx;assert.deepEqual(ctx.matrix,[.5,0,0,471/941,0,0]);ctx.globalAlpha=.2;ctx.fillRect(50,507,757,330);});
 assert.equal(painted,f.canvases[1].getContext('2d'));assert.equal(painted.depth,0);
 assert.deepEqual(painted.calls.find(call=>call[0]==='clear'),['clear',0,0,836,471]);
 const maskDraw=painted.calls.find(call=>call[0]==='draw');assert.equal(maskDraw[1],'destination-in');assert.equal(maskDraw[2],1);
 const output=target.calls.find(call=>call[0]==='draw');assert.equal(output[1],'screen');assert.deepEqual(output.slice(4),[0,0,1672,941]);
 assert.ok(target.calls.some(call=>call[0]==='clip'),'Exact world clipping prevents any upsampled light outside the room');
 assert.deepEqual(target.matrix,before.matrix);assert.equal(target.globalAlpha,before.alpha);assert.equal(target.globalCompositeOperation,before.mode);assert.equal(target.filter,before.filter);assert.equal(target.shadowBlur,before.shadow);assert.equal(target.imageSmoothingEnabled,before.smoothing);assert.equal(target.depth,0);
});

test('a failed paint callback leaves the target untouched and the next frame can recover',()=>{
 const f=fixture(),wash=create({document:f.document}),target=context();
 assert.throws(()=>wash.draw(target,()=>{throw Error('bad light');}),/bad light/);
 assert.equal(target.calls.length,0);assert.equal(f.canvases[1].getContext('2d').depth,0);assert.equal(wash.getState().frames,0);
 assert.equal(wash.draw(target,()=>{}),true);assert.equal(wash.getState().frames,1);assert.equal(wash.getState().builds,1);
 assert.equal(create().draw(target,()=>{}),false);
});
