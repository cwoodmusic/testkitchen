import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {registerAuthoredMotion} from './authored-motion.mjs';
import {AUTHORED_MOTION_CORRECTIONS} from './authored-motion-data.mjs';

const geometry={mask:[[.4,.2],[.6,.2],[.7,.6],[.3,.6]],bounds:[.3,.2,.4,.4]};
function fixture(motion){
 const faces=new Map();let readImages=0;
 const a={id:'lamp',w:52,h:110,boxes:[{x:12,y:90,w:28,h:18}],draw(){},ensureFull(){},motion};
 for(const facing of ['south','west','north','east']){
  const view={id:'lamp|'+facing,w:52,h:110,footCenter:{x:26,y:110},facing,motion};
  Object.defineProperties(view,{canvas:{enumerable:true,get(){readImages++;throw Error('No image warming');}},ready:{enumerable:true,get(){return false;}}});faces.set(facing,view);
 }
 a.getFacingView=function(facing='south',options){assert.equal(this,a);assert.equal(options?.image,false);return faces.get(facing)??null;};
 return {a,faces,catalog:new Map([['lamp',a]]),get readImages(){return readImages;}};
}
test('authored geometry preserves every identity field, lazy descriptor, physical box and untouched facing',()=>{
 const motion={kind:'lava',mask:[[.4,.2],[.6,.2],[.7,.7],[.3,.7]],bounds:[.3,.2,.4,.5],seed:17,game:'original-game',palette:['#010203'],other:{keep:true}},f=fixture(motion),draw=f.a.draw,ensure=f.a.ensureFull,boxes=f.a.boxes;
 const old=f.faces.get('south'),result=registerAuthoredMotion(f.catalog,{corrections:[{id:'lamp',facing:'south',world:{w:52,h:110},motionGeometry:geometry}]});
 const view=f.a.getFacingView('south',{image:false});assert.equal(f.readImages,0);assert.notStrictEqual(view,old);assert.deepEqual(view.motion.mask,geometry.mask);
 for(const [key,value]of Object.entries(motion))if(!['mask','bounds'].includes(key))assert.strictEqual(view.motion[key],value);
 assert.strictEqual(f.a.motion,view.motion);assert.strictEqual(view.footCenter,old.footCenter);assert.strictEqual(Object.getOwnPropertyDescriptor(view,'canvas').get,Object.getOwnPropertyDescriptor(old,'canvas').get);
 assert.equal(view.ready,false);assert.strictEqual(f.a.getFacingView('west',{image:false}),f.faces.get('west'));assert.strictEqual(f.a.draw,draw);assert.strictEqual(f.a.ensureFull,ensure);assert.strictEqual(f.a.boxes,boxes);assert.equal(result.length,1);
});
test('new lamp views receive stable shared identity without copying South glass onto another orientation',()=>{
 const f=fixture(),identity={kind:'lava',seed:'periwinkle',palette:['#645587','#fb7795']},east={mask:[[.45,.3],[.55,.3],[.65,.6],[.35,.6]]};
 registerAuthoredMotion(f.catalog,{corrections:[{id:'lamp',facing:'south',world:{w:52,h:110},motionGeometry:geometry,identity},{id:'lamp',facing:'east',world:{w:52,h:110},motionGeometry:east,identity}]});
 assert.equal(f.a.motion.seed,'periwinkle');assert.equal(f.a.getFacingView('east',{image:false}).motion.seed,'periwinkle');assert.deepEqual(f.a.getFacingView('east',{image:false}).motion.mask,east.mask);
 assert.equal(f.a.getFacingView('north',{image:false}).motion,undefined);assert.equal(f.readImages,0);
});
test('invalid registration is transactional and cannot invent facings, resize views or replace an existing identity',()=>{
 for(const invalid of [{facing:'diagonal'},{world:{w:53,h:110}},{motionGeometry:{mask:[[0,0],[1,0],[2,1]]}},{identity:{kind:'lava',seed:'replacement'}}]){
  const f=fixture({kind:'lava',...geometry,seed:19}),original=f.a.getFacingView,motion=f.a.motion;
  assert.throws(()=>registerAuthoredMotion(f.catalog,{corrections:[{id:'lamp',facing:'west',world:{w:52,h:110},motionGeometry:geometry},{id:'lamp',facing:'south',world:{w:52,h:110},motionGeometry:geometry,...invalid}]}));
  assert.strictEqual(f.a.getFacingView,original);assert.strictEqual(f.a.motion,motion);assert.equal(f.readImages,0);
 }
});
test('accepted geometry is tied to the audited native source bytes and contain rectangles',()=>{
 assert.equal(AUTHORED_MOTION_CORRECTIONS.length,6);
 for(const row of AUTHORED_MOTION_CORRECTIONS){
  const bytes=readFileSync(new URL('../../'+row.source.file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),row.source.sha256,row.id+'/'+row.facing);
  const {crop,draw}=row.source;assert([crop.w,crop.h,draw.w,draw.h].every(n=>n>0));
  assert(Math.abs(draw.w/crop.w-draw.h/crop.h)<1e-12,'Native glass was measured under a uniform contain scale');
 }
});
