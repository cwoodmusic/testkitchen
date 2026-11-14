import test from 'node:test';
import assert from 'node:assert/strict';
import {correctedArtMotion} from './parallel-art-motion.mjs';

test('a corrected screen changes only geometry and owns immutable copies of its mask',()=>{
 const original={kind:'arcade',seed:17,game:'organ-loft',palette:['#123456'],mask:[[.1,.1],[.2,.1],[.2,.2]],bounds:[.1,.1,.1,.1]},geometry={mask:[[.2,.3],[.6,.3],[.6,.5],[.2,.5]]};
 const before=JSON.stringify(original),motion=correctedArtMotion(original,geometry);
 assert.equal(motion.kind,original.kind);assert.equal(motion.seed,17);assert.equal(motion.game,'organ-loft');assert.strictEqual(motion.palette,original.palette);
 assert(motion.bounds.every((value,index)=>Math.abs(value-[.2,.3,.4,.2][index])<1e-12));geometry.mask[0][0]=.9;assert.equal(motion.mask[0][0],.2);assert.equal(JSON.stringify(original),before);assert(Object.isFrozen(motion.mask[0]));
});

test('invalid or out-of-glass geometry is rejected before rendering',()=>{
 const original={kind:'arcade'};
 for(const geometry of [{mask:[]},{mask:[[0,0],[1,0],[1,2]]},{mask:[[0,0],[1,0],[1,1]],bounds:[.2,.2,.2,.2]}])assert.throws(()=>correctedArtMotion(original,geometry));
 assert.throws(()=>correctedArtMotion(null,{mask:[[0,0],[1,0],[1,1]]}));assert.equal(correctedArtMotion(original,undefined),null);
});
