const test=require('node:test'),assert=require('node:assert/strict');
const art=require('../artwork-editor.js');

test('artwork imports reject oversized, overlapping, out-of-bounds and executable-looking data',()=>{
 const valid={width:70,height:3,tiles:{'0,0':[[0,64,'#ff33aaff']],'1,0':[[0,6,'#00000000'],[64,6,'#12345678']]}};
 assert.equal(art.validateTexture(valid,70,3),true);
 assert.equal(art.validateTexture(valid,71,3),false);
 for(const value of [null,[],{}, {...valid,width:0},{...valid,height:art.MAX_DIMENSION+1},{...valid,width:8192,height:8192},
  {...valid,tiles:{'-1,0':[[0,1,'#000000ff']]}}, {...valid,tiles:{'01,0':[]}},
  {...valid,tiles:{'2,0':[[0,1,'#000000ff']]}}, {...valid,tiles:{'1,0':[[5,2,'#000000ff']]}},
  {...valid,tiles:{'0,0':[[0,2,'#000000ff'],[1,2,'#ffffff00']]}},
  {...valid,tiles:{'0,0':[[0,1,'url(javascript:bad)']]}}
 ])assert.equal(art.validateTexture(value),false,JSON.stringify(value));
 assert.equal(art.validate({'background.world':valid,'character.player.down':valid}),true);
 for(const id of ['__proto__','constructor','background.__proto__','asset.constructor','bad/path'])
  assert.equal(art.validate(JSON.parse('{"'+id+'":'+JSON.stringify(valid)+'}')),false,id);
});

test('normalization preserves alpha and merges adjacent equal-colour runs deterministically',()=>{
 const input={'background.world':{width:128,height:1,tiles:{'1,0':[[0,1,'#FF33AA80'],[1,2,'#ff33aa80']],'0,0':[[3,1,'#00000000']]}},unused:{width:2,height:2,tiles:{}}};
 const frozen=JSON.stringify(input),normalized=art.normalize(input);
 assert.equal(JSON.stringify(input),frozen);
 assert.deepEqual(Object.keys(normalized),['background.world']);
 assert.deepEqual(normalized['background.world'].tiles,{'0,0':[[3,1,'#00000000']],'1,0':[[0,3,'#ff33aa80']]});
});

test('pixel paint, transparent erase and restore keep originals and other artwork independent',()=>{
 const source={'asset.first':{width:4,height:1,tiles:{'0,0':[[1,1,'#112233ff']]}}};
 const painted=art.changePixels(source,'background.world',70,3,[[63,1],[64,1],[69,2]],'#abcdef80');
 assert.equal(source['background.world'],undefined);
 assert.deepEqual(painted['asset.first'],source['asset.first']);
 assert.equal(art.validateTexture(painted['background.world'],70,3),true);
 const erased=art.changePixels(painted,'background.world',70,3,[[64,1]],null);
 const rgba=new Uint8ClampedArray(70*3*4).fill(43),composed=art.composePixels(rgba,erased['background.world']);
 assert.deepEqual(Array.from(composed.slice((1*70+63)*4,(1*70+63)*4+4)),[171,205,239,128]);
 assert.deepEqual(Array.from(composed.slice((1*70+64)*4,(1*70+64)*4+4)),[0,0,0,0]);
 assert.deepEqual(Array.from(rgba.slice((1*70+64)*4,(1*70+64)*4+4)),[43,43,43,43]);
 const restored=art.changePixels(erased,'background.world',70,3,[[63,1],[64,1],[69,2]],undefined);
 assert.deepEqual(restored,source);
 assert.equal(art.changePixels(source,'asset.first',6,1,[[1,0]],'#ffffffff'),null);
});

test('large solid background fills remain compact and handle partial edge tiles losslessly',()=>{
 const width=1672,height=941;
 function* points(){for(let y=0;y<height;y++)for(let x=0;x<width;x++)yield [x,y];}
 const changed=art.changePixels({},'background.world',width,height,points(),'#2468acff');
 assert.equal(art.validate(changed),true);
 assert.ok(JSON.stringify(changed).length<50000,'A room-wide solid fill must not become millions of JSON pixel tuples');
 const original=new Uint8ClampedArray(width*height*4),result=art.composePixels(original,changed['background.world']);
 for(const [x,y]of [[0,0],[63,63],[64,64],[width-1,0],[0,height-1],[width-1,height-1]])
  assert.deepEqual(Array.from(result.slice((y*width+x)*4,(y*width+x)*4+4)),[36,104,172,255]);
});

test('straight lines contain their endpoints and never leave gaps on steep or reversed drags',()=>{
 for(const [a,b]of [[[0,0],[6,2]],[[7,1],[2,12]],[[8,8],[8,1]],[[4,4],[4,4]]]){
  const points=art.linePoints(a,b);assert.deepEqual(points[0],a);assert.deepEqual(points.at(-1),b);
  for(let i=1;i<points.length;i++)assert.equal(Math.max(Math.abs(points[i][0]-points[i-1][0]),Math.abs(points[i][1]-points[i-1][1])),1);
 }
});

function smoothingSource(width,height,pixel){const rgba=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++)rgba.set(pixel(x,y),(y*width+x)*4);return rgba;}
function smoothed(source,width,height,path,options={}){const stroke=art.createSmoothingStroke(source,width,height,options),output=new Uint8ClampedArray(source);assert.ok(stroke);let changes=0;for(let index=0;index<path.length;index++){const result=stroke.applySegment(path[index?index-1:0],path[index]);changes+=result.changes.length;for(const [at,value]of result.changes)output.set([value&255,value>>>8&255,value>>>16&255,value>>>24&255],at*4);}return {output,stroke,changes};}

test('smoothing softens a banded gradient using existing colours and preserves every alpha byte',()=>{
 const width=40,height=24,source=smoothingSource(width,height,(x,y)=>[x<20?0:255,x<20?32:224,80,y%3?255:128]),before=source.slice();
 const {output,changes}=smoothed(source,width,height,[[20,12]],{radius:8,strength:1});assert.ok(changes>0);
 const left=(12*width+19)*4,right=(12*width+20)*4;assert.ok(output[left]>0&&output[left]<255);assert.ok(output[right]>0&&output[right]<255);assert.ok(output[right]-output[left]<255);
 assert.deepEqual(source,before,'The caller’s current composite is immutable during smoothing');
 for(let index=0;index<width*height;index++)assert.equal(output[index*4+3],source[index*4+3]);
 assert.deepEqual(output.slice(0,4),source.slice(0,4),'Distant artwork is untouched');
});

test('smoothing ignores hidden RGB in transparent pixels and keeps transparent edges exact',()=>{
 const width=18,height=12,source=smoothingSource(width,height,(x,y)=>x<9?[40,90,150,x===8?128:255]:[255,0,255,0]);
 const {output,changes}=smoothed(source,width,height,[[8,6]],{radius:6,strength:1});assert.equal(changes,0);assert.deepEqual(output,source);
 const changed=smoothingSource(width,height,(x,y)=>x<9?[x===8?200:40,90,150,x===8?128:255]:[255,0,255,0]);
 const value=smoothed(changed,width,height,[[8,6]],{radius:6,strength:1}).output;assert.ok(value[(6*width+8)*4]<200);assert.equal(value[(6*width+8)*4+3],128);
 for(let y=0;y<height;y++)for(let x=9;x<width;x++){const at=(y*width+x)*4;assert.deepEqual(value.slice(at,at+4),changed.slice(at,at+4));}
});

test('flat colours are no-ops and smoothing uses the supplied edited composite',()=>{
 const width=20,height=12,flat=smoothingSource(width,height,()=>[42,87,149,255]);assert.equal(smoothed(flat,width,height,[[8,6],[12,6]],{radius:5,strength:.8}).changes,0);
 const edited=flat.slice();edited.set([255,255,255,255],(6*width+10)*4);const result=smoothed(edited,width,height,[[10,6]],{radius:5,strength:1});
 assert.ok(result.output[(6*width+10)*4]>42&&result.output[(6*width+10)*4]<255);assert.ok(result.output[(6*width+9)*4]>42,'Earlier painted pixels contribute to the neighbourhood');
});

test('straight smoothing is independent of pointer event spacing, direction, and repeated coordinates',()=>{
 const width=40,height=24,source=smoothingSource(width,height,(x,y)=>[x<20?0:255,y<12?48:192,90,255]),options={radius:5,strength:.6};
 const direct=smoothed(source,width,height,[[4,12],[35,12]],options).output,segmented=smoothed(source,width,height,[[4,12],[8,12],[8,12],[19,12],[25,12],[35,12],[35,12]],options).output,reversed=smoothed(source,width,height,[[35,12],[4,12]],options).output;
 assert.deepEqual(direct,segmented);assert.deepEqual(direct,reversed);
 const stroke=art.createSmoothingStroke(source,width,height,options);stroke.applySegment([20,12],[20,12]);assert.equal(stroke.applySegment([20,12],[20,12]).changes.length,0,'A pointerup at the same point must not blur twice');
});

test('rectangular and manual selections restrict both smoothing samples and changed pixels',()=>{
 const width=24,height=24,rectangle={x:4,y:4,width:8,height:12},source=smoothingSource(width,height,(x,y)=>x>=4&&x<12&&y>=4&&y<16?[50,90,130,255]:[255,255,255,255]);
 assert.equal(smoothed(source,width,height,[[8,9]],{radius:12,strength:1,selection:rectangle}).changes,0,'Unselected white pixels cannot contaminate the selection');
 const polygon={x:4,y:4,width:13,height:13,points:[[4,4],[16,4],[4,16]]},triangle=smoothingSource(width,height,(x,y)=>x>=4&&y>=4&&x+y<=20?[50,90,130,255]:[255,0,255,255]);
 assert.equal(smoothed(triangle,width,height,[[10,10]],{radius:12,strength:1,selection:polygon}).changes,0,'Bounding-box corners outside a manual shape must not enter the average');
 triangle.set([255,255,255,255],(8*width+8)*4);const output=smoothed(triangle,width,height,[[8,8]],{radius:12,strength:1,selection:polygon}).output;
 assert.ok(output[(8*width+8)*4]<255);for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(!(x>=4&&y>=4&&x+y<=20)){const at=(y*width+x)*4;assert.deepEqual(output.slice(at,at+4),triangle.slice(at,at+4));}
});

test('a protection mask excludes protected objects from smoothing and colour sampling',()=>{
 const width=24,height=16,source=smoothingSource(width,height,(x,y)=>x<12?[35,70,105,255]:[255,20,200,255]),mask=new Uint8Array(width*height);for(let y=0;y<height;y++)for(let x=12;x<width;x++)mask[y*width+x]=1;
 const output=smoothed(source,width,height,[[11,8]],{radius:10,strength:1,protectedMask:mask});assert.equal(output.changes,0);assert.deepEqual(output.output,source);
 assert.equal(art.createSmoothingStroke(source,width,height,{protectedMask:new Uint8Array(2)}),null);
});

test('brush limits are validated and a local dab does bounded work on a full arcade background',()=>{
 const width=1672,height=941,source=smoothingSource(width,height,(x,y)=>[x<836?30:220,80,120,255]);
 for(const radius of [0,65,-1,NaN])assert.equal(art.createSmoothingStroke(source,width,height,{radius}),null);
 for(const strength of [-.1,1.1,Infinity])assert.equal(art.createSmoothingStroke(source,width,height,{strength}),null);
 assert.equal(smoothed(source,width,height,[[836,470]],{radius:1,strength:0}).changes,0);
 const result=smoothed(source,width,height,[[836,470]],{radius:8,strength:.35});assert.ok(result.changes>0);assert.ok(result.stroke.getStats().sampled<4096,'A local dab must not convolve the full background');
 assert.ok(smoothed(source,width,height,[[836,470]],{radius:64,strength:1}).changes>0);
});
