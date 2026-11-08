import {test} from 'node:test';
import assert from 'node:assert/strict';
import {supportsFountainMotion,fountainRegion,fountainMask} from './fountain-motion.mjs';

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
