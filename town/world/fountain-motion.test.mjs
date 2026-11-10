import {test} from 'node:test';
import assert from 'node:assert/strict';
import {supportsFountainMotion,fountainRegion,fountainMask,fountainDisplacements,fountainFrame,FOUNTAIN_CYCLE,FOUNTAIN_FPS} from './fountain-motion.mjs';

test('only fountain assets opt into local water motion and the plaza crop excludes its architecture',()=>{
 for(const a of [{id:'music-square'},{id:'props-0-360'},{id:'decor-09-09',name:'Stone drinking fountain'}])assert(supportsFountainMotion(a));
 for(const a of [{id:'estate-bach',name:'Bach estate'},{id:'props-5-180',name:'Wishing well'},{id:'bench',name:'Bench'}])assert.equal(supportsFountainMotion(a),false);
 const r=fountainRegion({id:'music-square'},2400,1600);assert(r.x>900&&r.x+r.w<1500);assert(r.y>550&&r.y+r.h<920);
});

test('cyan water connects pale jets while stone, foliage and disconnected white details stay untouched',()=>{
 const width=7,height=5,data=new Uint8ClampedArray(width*height*4);
 const put=(x,y,r,g,b)=>data.set([r,g,b,255],(y*width+x)*4);
 put(3,3,30,165,190);put(3,2,180,235,245);put(3,1,235,250,253);
 put(2,2,200,185,160);put(4,2,35,130,40);put(0,0,240,245,250);
 const {mask,jets}=fountainMask({data,width,height});
 assert.equal(mask[3*width+3],1);assert.equal(mask[2*width+3],1);assert.equal(mask[width+3],1);
 assert.equal(jets[2*width+3],1);assert.equal(jets[3*width+3],0);
 assert.equal(mask[2*width+2],0);assert.equal(mask[2*width+4],0);assert.equal(mask[0],0);
});

test('row and column displacement buffers exactly match the original caustics at every animation phase',()=>{
 const frames=FOUNTAIN_CYCLE*FOUNTAIN_FPS;
 for(const bounds of [{width:1,height:1,x0:0,y0:0},{width:53,height:41,x0:0,y0:0},{width:513,height:289,x0:936,y0:560}]){
  const reusable={dx:new Float64Array(bounds.height),dy:new Float64Array(bounds.width)};
  for(let frame=0;frame<frames;frame++){
   const phase=frame/frames*(Math.PI*2),{dx,dy}=fountainDisplacements(bounds,phase,reusable);
   assert.strictEqual(dx,reusable.dx);assert.strictEqual(dy,reusable.dy);
   for(let y=0;y<bounds.height;y++){
    const Y=y+bounds.y0,original=Math.round((Math.sin(Y*.085+phase*2)-Math.sin(Y*.085))*1.8);
    assert.equal(dx[y],original);
   }
   for(let x=0;x<bounds.width;x++){
    const X=x+bounds.x0,original=Math.round((Math.sin(X*.07-phase)-Math.sin(X*.07))*1.2);
    assert.equal(dy[x],original);
   }
  }
 }
});

test('animated pool and jet pixels remain byte-identical to the original formula over the complete cycle',()=>{
 const previousDocument=globalThis.document,width=19,height=17,data=new Uint8ClampedArray(width*height*4);
 // A cropped, uneven pool, connected pale jets, a warm stone island and
 // transparent pixels exercise both the displacement bounds and water masks.
 for(let y=2;y<15;y++)for(let x=3;x<16;x++){
  if((x+y)%7===0)continue;
  data.set(y<6&&x>8&&x<12?[180,235,245,255]:[20+x,110+y*3,160+x*2,255],(y*width+x)*4);
 }
 data.set([200,185,160,255],(9*width+9)*4);
 const source={width,height,data},{mask,jets}=fountainMask(source),asset={id:'equivalence-fountain',name:'Test fountain'};
 globalThis.document={createElement(){
  const canvas={width:0,height:0};
  const context={drawImage(){},getImageData(){return {width:canvas.width,height:canvas.height,data:new Uint8ClampedArray(data)};},createImageData(w,h){return {width:w,height:h,data:new Uint8ClampedArray(w*h*4)};},putImageData(){}};
  canvas.getContext=()=>context;return canvas;
 }};
 try{
  const frames=FOUNTAIN_CYCLE*FOUNTAIN_FPS;
  for(let frame=0;frame<frames;frame++){
   const actual=fountainFrame(asset,source,(frame+.00001)/FOUNTAIN_FPS),expected=new Uint8ClampedArray(actual.width*actual.height*4),phase=frame/frames*(Math.PI*2);
   for(let y=0;y<actual.height;y++)for(let x=0;x<actual.width;x++){
    const X=x+actual.x0,Y=y+actual.y0,i=Y*width+X;if(!mask[i])continue;
    const dx=Math.round((Math.sin(Y*.085+phase*2)-Math.sin(Y*.085))*1.8),dy=Math.round((Math.sin(X*.07-phase)-Math.sin(X*.07))*1.2);
    const nx=X+dx,ny=Y+dy,j=nx>=0&&ny>=0&&nx<width&&ny<height&&mask[ny*width+nx]?ny*width+nx:i;
    const from=(jets[i]?i:j)*4,to=(y*actual.width+x)*4;
    const falling=jets[i]?((Math.sin(Y*.21+X*.013-phase*9)-Math.sin(Y*.21+X*.013))*13+(Math.sin(Y*.43-phase*11)-Math.sin(Y*.43))*5):0;
    for(let channel=0;channel<3;channel++)expected[to+channel]=Math.max(0,Math.min(255,data[from+channel]+falling));
    expected[to+3]=data[i*4+3];
   }
   assert.deepEqual(actual.pixels.data,expected,`Frame ${frame}`);
  }
 }finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});
