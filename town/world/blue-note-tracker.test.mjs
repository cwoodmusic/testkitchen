import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {blueNoteTrackerPose,drawBlueNoteTracker,goldNoteTrackerPose,drawGoldNoteTracker,BLUE_NOTE_TRACKER_RANGE_SCREENS} from './blue-note-tracker.mjs';
import {flyingNotePose} from './rhythm-hunt-motion.mjs';
const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas');
const player={x:1000,y:1000},anchor={x:1000,y:945};
const blue=(id,dx,dy=0,z=0)=>({id,color:'blue',x:anchor.x+dx,y:anchor.y+dy+z+80,z,phase:0});
const gold=(...args)=>({...blue(...args),color:'yellow'});
const options=extra=>({player,tokens:[blue('near',300)],cam:{x:1000,y:1000,zoom:1},width:1000,height:500,reducedMotion:true,...extra});
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} versus ${b}`);

test('a blue fairy begins tracking at about one and a half viewport screens in every direction',()=>{
 assert.equal(BLUE_NOTE_TRACKER_RANGE_SCREENS,1.5);
 for(const zoom of [.5,1,2])for(const [width,height]of [[1000,500],[500,1000]]){
  for(const [sx,sy]of [[1,0],[-1,0],[0,1],[0,-1],[Math.SQRT1_2,Math.SQRT1_2]]){
   const inside=blue('inside',sx*width*1.49/zoom,sy*height*1.49/zoom),outside=blue('outside',sx*width*1.51/zoom,sy*height*1.51/zoom);
   assert(blueNoteTrackerPose(options({tokens:[inside],width,height,cam:{zoom}})),'An offscreen fairy within sensing range should guide the player');
   assert.equal(blueNoteTrackerPose(options({tokens:[outside],width,height,cam:{zoom}})),null,'The tracker must not reveal distant fairies beyond its sensing range');
  }
 }
});

test('the tracker chooses the nearest eligible blue fairy and switches when it is caught',()=>{
 const yellow={...blue('yellow',1),color:'yellow'},far=blue('far',500),close=blue('close',60,30);
 assert.equal(blueNoteTrackerPose(options({tokens:[yellow,far,close]})).targetId,'close');
 assert.equal(blueNoteTrackerPose(options({tokens:[yellow,far]})).targetId,'far');
 assert.equal(blueNoteTrackerPose(options({tokens:[yellow]})),null);
 assert.equal(blueNoteTrackerPose(options({tokens:[]})),null);
 const outside=blue('outside-short-edge',0,800),inside=blue('inside-long-edge',1000,0);
 assert.equal(blueNoteTrackerPose(options({tokens:[outside,inside]})).targetId,inside.id,'Only nearby-sensed blue fairies are eligible, even on a wide display');
});

test('the arrow follows the visible flying glyph with terrain and body height accounted for',()=>{
 const token={...blue('flying',260,120,144),phase:.7},time=2.3,pose=blueNoteTrackerPose(options({playerZ:48,tokens:[token],time,reducedMotion:false,getHeight:t=>t.z}));
 assert.deepEqual(pose.target,flyingNotePose(token,time,144,false));assert.deepEqual(pose.anchor,{x:player.x,y:player.y-48-55});
 near(pose.angle,Math.atan2(pose.target.y-pose.anchor.y,pose.target.x-pose.anchor.x));
 const moved=blueNoteTrackerPose(options({playerZ:48,tokens:[{...token,x:token.x-100,y:token.y-160}],time:time+.25,reducedMotion:false}));
 assert.notEqual(moved.angle,pose.angle,'A flying fairy must move the compass heading');
 const panned=blueNoteTrackerPose(options({playerZ:48,tokens:[token],time,reducedMotion:false,getHeight:t=>t.z,cam:{zoom:1,x:-10000,y:20000}}));
 near(panned.angle,pose.angle);near(panned.x,pose.x);near(panned.y,pose.y);
});

test('the invisible orbit stays outside the avatar and the arrow points along its radius at every zoom',()=>{
 for(const zoom of [.2,.7,1,2,4]){
  const pose=blueNoteTrackerPose(options({tokens:[blue('diagonal',200/zoom,-100/zoom)],cam:{zoom}}));assert(pose);
  near(Math.hypot(pose.x-pose.anchor.x,pose.y-pose.anchor.y)*zoom,pose.radius);
  near(Math.atan2(pose.y-pose.anchor.y,pose.x-pose.anchor.x),pose.angle);
  assert(pose.radius>=50&&pose.radius>55*zoom,'Zooming in must not put the compass arrow inside the character');
 }
});

test('invalid viewport sizes and an indeterminate direction draw nothing',()=>{
 for(const extra of [{width:0},{height:NaN},{cam:{zoom:0}},{player:null},{tokens:[blue('overlap',0,0)]}]){
  const c=new Proxy({},{get(){return ()=>{throw Error('A hidden tracker must not touch the drawing context');};}});
  assert.equal(drawBlueNoteTracker(c,options(extra)),null);
 }
});

test('the drawing is only a small outlined arrow with no orbit circle or canvas-state leak',()=>{
 const calls=[],stack=[],state={fillStyle:'#123456',strokeStyle:'#abcdef',lineWidth:8,lineJoin:'miter'};
 const c=new Proxy({save(){stack.push({...state});calls.push(['save']);},restore(){Object.assign(state,stack.pop());calls.push(['restore']);}},
  {get(target,key){if(key in target)return target[key];if(key in state)return state[key];if(['arc','ellipse','fillText','strokeText'].includes(key))return ()=>{throw Error('The compass has no visible ring or panel');};return (...args)=>calls.push([key,...args]);},set(_target,key,value){state[key]=value;return true;}});
 const pose=drawBlueNoteTracker(c,options());assert(pose);assert.equal(stack.length,0);assert.deepEqual(state,{fillStyle:'#123456',strokeStyle:'#abcdef',lineWidth:8,lineJoin:'miter'});
 assert.equal(calls.filter(call=>call[0]==='fill').length,1);assert.equal(calls.filter(call=>call[0]==='stroke').length,1);
 const points=calls.filter(call=>['moveTo','lineTo'].includes(call[0]));assert(points.length>=3&&points.length<=5);assert(points.every(point=>point.slice(1).every(value=>Math.abs(value)<=10)),'The blue pointer stays small');
});

test('actual arrow pixels keep the same small size across camera zoom levels',()=>{
 const dimensions=[];
 for(const zoom of [.5,1,2]){
  const canvas=createCanvas(700,700),c=canvas.getContext('2d');c.translate(350,350);c.scale(zoom,zoom);c.translate(-anchor.x,-anchor.y);
  const pose=drawBlueNoteTracker(c,options({tokens:[blue('right',200/zoom)],cam:{zoom}})),pixels=c.getImageData(0,0,700,700),xs=[],ys=[];
  for(let y=0;y<700;y++)for(let x=0;x<700;x++){const i=(y*700+x)*4;if(pixels.data[i]===105&&pixels.data[i+1]===210&&pixels.data[i+2]===255&&pixels.data[i+3]===255){xs.push(x);ys.push(y);}}
  assert(xs.length>10);assert(Math.min(...xs)>350+pose.radius-10&&Math.max(...xs)<350+pose.radius+10);
  dimensions.push([Math.max(...xs)-Math.min(...xs)+1,Math.max(...ys)-Math.min(...ys)+1]);
 }
 assert.deepEqual(dimensions[0],dimensions[1]);assert.deepEqual(dimensions[1],dimensions[2]);assert(dimensions[0][0]<=18&&dimensions[0][1]<=12);
});

test('gold tracking senses one and a half screens in every direction at different zooms and display shapes',()=>{
 for(const zoom of [.5,1,2])for(const [width,height]of [[1000,500],[500,1000]]){
  for(const [sx,sy]of [[1,0],[-1,0],[0,1],[0,-1],[Math.SQRT1_2,Math.SQRT1_2]]){
   const inside=gold('inside',sx*width*1.49/zoom,sy*height*1.49/zoom),outside=gold('outside',sx*width*1.51/zoom,sy*height*1.51/zoom);
   assert(goldNoteTrackerPose(options({tokens:[inside],width,height,cam:{zoom}})));
   assert.equal(goldNoteTrackerPose(options({tokens:[outside],width,height,cam:{zoom}})),null);
  }
 }
});

test('gold tracking ignores nearby blue notes and retargets the nearest remaining yellow fairy without modifying tokens',()=>{
 const close=gold('close',60,30),far=gold('far',500),nearbyBlue=blue('blue',1),invalid={...gold('invalid',10),x:NaN};
 const tokens=[nearbyBlue,far,close,invalid],before=structuredClone(tokens);
 assert.equal(goldNoteTrackerPose(options({tokens})).targetId,'close');
 assert.equal(goldNoteTrackerPose(options({tokens:[nearbyBlue,far]})).targetId,'far');
 assert.equal(goldNoteTrackerPose(options({tokens:[nearbyBlue]})),null);
 assert.equal(blueNoteTrackerPose(options({tokens})).targetId,'blue');
 assert.deepEqual(tokens,before,'Tracking must not change map, fairy, or inventory state');
 const outside=gold('outside-short-edge',0,800),inside=gold('inside-long-edge',1000,0);
 assert.equal(goldNoteTrackerPose(options({tokens:[outside,inside]})).targetId,inside.id);
});

test('gold arrows follow elevated flying glyphs and keep the same avatar orbit as blue arrows',()=>{
 const token={...gold('flying',260,120,144),phase:.7},time=2.3;
 for(const zoom of [.2,.7,1,2,4]){
  const settings=options({playerZ:48,tokens:[token],time,reducedMotion:false,getHeight:t=>t.z,cam:{zoom},width:2000,height:1200});
  const pose=goldNoteTrackerPose(settings);assert(pose);
  assert.deepEqual(pose.target,flyingNotePose(token,time,144,false));
  assert.deepEqual(pose.anchor,{x:player.x,y:player.y-48-55});
  near(pose.angle,Math.atan2(pose.target.y-pose.anchor.y,pose.target.x-pose.anchor.x));
  near(Math.hypot(pose.x-pose.anchor.x,pose.y-pose.anchor.y)*zoom,pose.radius);
  assert(pose.radius>=50&&pose.radius>55*zoom);
  assert.deepEqual(pose,blueNoteTrackerPose({...settings,tokens:[{...token,color:'blue'}]}));
  assert.deepEqual(pose,goldNoteTrackerPose({...settings,cam:{zoom,x:-10000,y:20000}}));
 }
 const pose=goldNoteTrackerPose(options({tokens:[token],time,reducedMotion:false}));
 const moved=goldNoteTrackerPose(options({tokens:[{...token,x:token.x-100,y:token.y-160}],time:time+.25,reducedMotion:false}));
 assert.notEqual(moved.angle,pose.angle);
});

test('hidden, invalid, and directionless gold trackers never draw',()=>{
 for(const extra of [{},{width:0},{height:NaN},{cam:{zoom:0}},{player:null},{tokens:[]},{tokens:[gold('overlap',0,0)]}]){
  const c=new Proxy({},{get(){return ()=>{throw Error('A hidden tracker must not touch the drawing context');};}});
  assert.equal(drawGoldNoteTracker(c,options(extra)),null);
 }
});

test('gold drawing is a small outlined arrow that restores canvas state and adds no ring or panel',()=>{
 const calls=[],stack=[],state={fillStyle:'#123456',strokeStyle:'#abcdef',lineWidth:8,lineJoin:'miter'};
 const c=new Proxy({save(){stack.push({...state});},restore(){Object.assign(state,stack.pop());}},
  {get(target,key){if(key in target)return target[key];if(key in state)return state[key];if(['arc','ellipse','fillText','strokeText'].includes(key))return ()=>{throw Error('No visible orbit circle or panel');};return (...args)=>calls.push([key,...args]);},set(_target,key,value){state[key]=value;return true;}});
 assert(drawGoldNoteTracker(c,options({tokens:[gold('near',300)]})));
 assert.equal(stack.length,0);assert.deepEqual(state,{fillStyle:'#123456',strokeStyle:'#abcdef',lineWidth:8,lineJoin:'miter'});
 assert.equal(calls.filter(call=>call[0]==='fill').length,1);assert.equal(calls.filter(call=>call[0]==='stroke').length,1);
 const points=calls.filter(call=>['moveTo','lineTo'].includes(call[0]));assert(points.length>=3&&points.length<=5);assert(points.every(point=>point.slice(1).every(value=>Math.abs(value)<=10)));
});

test('actual gold arrow pixels remain small and consistently gold across zoom levels',()=>{
 const dimensions=[];
 for(const zoom of [.5,1,2]){
  const canvas=createCanvas(700,700),c=canvas.getContext('2d');c.translate(350,350);c.scale(zoom,zoom);c.translate(-anchor.x,-anchor.y);
  const pose=drawGoldNoteTracker(c,options({tokens:[gold('right',200/zoom)],cam:{zoom}})),pixels=c.getImageData(0,0,700,700),xs=[],ys=[];
  for(let y=0;y<700;y++)for(let x=0;x<700;x++){const i=(y*700+x)*4;if(pixels.data[i]===244&&pixels.data[i+1]===204&&pixels.data[i+2]===85&&pixels.data[i+3]===255){xs.push(x);ys.push(y);}}
  assert(xs.length>10);assert(Math.min(...xs)>350+pose.radius-10&&Math.max(...xs)<350+pose.radius+10);
  dimensions.push([Math.max(...xs)-Math.min(...xs)+1,Math.max(...ys)-Math.min(...ys)+1]);
 }
 assert.deepEqual(dimensions[0],dimensions[1]);assert.deepEqual(dimensions[1],dimensions[2]);assert(dimensions[0][0]<=18&&dimensions[0][1]<=12);
});
