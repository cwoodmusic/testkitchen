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
