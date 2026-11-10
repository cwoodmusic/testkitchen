import test from 'node:test';
import assert from 'node:assert/strict';
import {artSourceVersion,invalidateArtSource} from './art-revision.mjs';

test('art revision reads are stable and do not read pixels',()=>{
 let contexts=0;const source={getContext(){contexts++;return {getImageData(){throw Error('unexpected pixel read');}};}};
 assert.equal(artSourceVersion(source),0);assert.equal(artSourceVersion(source),0);assert.equal(contexts,1);
});

test('native canvas pixel writes invalidate while preserving receiver, arguments and return values',()=>{
 const calls=[],ctx={};
 for(const name of ['clearRect','fillRect','strokeRect','drawImage','putImageData','fill','stroke','fillText','strokeText','reset'])ctx[name]=function(...args){calls.push({name,args,receiver:this});return name;};
 const source={getContext:()=>ctx};assert.equal(artSourceVersion(source),0);
 let expected=0;
 for(const name of Object.keys(ctx)){assert.equal(ctx[name](1,2),name);assert.equal(artSourceVersion(source),++expected);assert.equal(calls.at(-1).receiver,ctx);assert.deepEqual(calls.at(-1).args,[1,2]);}
});

test('source revisions are independent and non-canvas art supports explicit invalidation',()=>{
 const image={},ctx={fillRect(){}},canvas={getContext:()=>ctx};
 artSourceVersion(canvas);artSourceVersion(image);ctx.fillRect();
 assert.equal(artSourceVersion(canvas),1);assert.equal(artSourceVersion(image),0);
 invalidateArtSource(image);assert.equal(artSourceVersion(image),1);assert.equal(artSourceVersion(canvas),1);
 assert.equal(artSourceVersion(null),0);
});
