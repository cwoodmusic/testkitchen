import test from 'node:test';
import assert from 'node:assert/strict';
import {drawNoteFairy} from './note-fairy-render.mjs';
import {flyingNotePose} from './rhythm-hunt-motion.mjs';
import {NOTE_VALUES} from './town-game-rules.mjs';

function context(){
 const calls=[],stack=[],state={fillStyle:'#123456',strokeStyle:'#abcdef',globalAlpha:.7,lineWidth:9};
 const c=new Proxy({calls,save(){stack.push({...state});calls.push(['save']);},restore(){assert(stack.length);Object.assign(state,stack.pop());calls.push(['restore']);},get depth(){return stack.length;}},{
  get(target,key){if(key in target)return target[key];if(key in state)return state[key];if(key==='arc'||String(key).includes('Gradient'))return ()=>{throw Error('Fairies must not draw circular badges or expensive gradients');};return (...args)=>calls.push([key,...args]);},
  set(_target,key,value){if(key==='shadowBlur')assert.equal(value,0);state[key]=value;calls.push(['set',key,value]);return true;}
 });return c;
}
const values=NOTE_VALUES;
const token={x:300,y:400,phase:.4,vx:90,vy:-45,color:'yellow'};
test('every allowed notation stays bare and compact, with both fairy palettes and restored drawing state',()=>{
 for(const color of ['yellow','blue'])for(const value of values){
  const c=context(),result=drawNoteFairy(c,{...token,color,value},{time:3.2,z:48});
  assert.equal(c.depth,0);assert.equal(c.fillStyle,'#123456');assert.equal(c.strokeStyle,'#abcdef');assert.equal(c.globalAlpha,.7);assert.equal(c.lineWidth,9);
  assert(result.glyphBounds.w<=34);assert(result.glyphBounds.h<=40);
  const ellipses=c.calls.filter(call=>call[0]==='ellipse');assert(ellipses.length>=4);assert(ellipses.every(call=>call[3]<=14&&call[4]<=7),'Only tiny wings and note heads can be elliptical');
  assert(c.calls.some(call=>call[0]==='set'&&call[1]==='fillStyle'&&call[2]===(color==='blue'?'#dcf8ff':'#fff0a5')));
 }
});
test('the fairy keeps the catch target center and its glitter is deterministic and contained',()=>{
 const note={...token,value:'sixteenth-group'},a=context(),b=context(),result=drawNoteFairy(a,note,{time:4.25,z:96});drawNoteFairy(b,note,{time:4.25,z:96});
 assert.deepEqual({x:result.x,y:result.y},flyingNotePose(note,4.25,96,false));assert.deepEqual(a.calls,b.calls);
 for(const call of a.calls.filter(call=>['moveTo','lineTo'].includes(call[0])))assert(call.slice(1).every(value=>Math.abs(value)<=47),'Glitter and glyph paths must stay bounded');
 assert(a.calls.filter(call=>call[0]==='closePath').length>=3,'Tiny stars provide glitter without a backing disk');
});
test('reduced motion freezes the wings, glitter and bob while keeping recognizable notation',()=>{
 const note={...token,value:'eighth-pair',color:'blue'},a=context(),b=context();const first=drawNoteFairy(a,note,{time:0,z:12,reducedMotion:true}),last=drawNoteFairy(b,note,{time:100,z:12,reducedMotion:true});
 assert.deepEqual(first,last);assert.deepEqual(a.calls,b.calls);assert.equal(first.y,token.y-12-80);assert(a.calls.some(call=>call[0]==='ellipse'));
});
