import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {blank,cell,height} from './model.mjs';
import {encodeMask,maskFronts} from './organic-mask.mjs';
import {frontEdge} from './round-geometry.mjs';

test('every south-facing organic run receives rock rather than leaving lawn gaps through the cliff',()=>{
 const doc=blank(),bits=new Uint8Array(256);for(let y=0;y<16;y++)for(let x=0;x<16;x++)bits[y*16+x]=y<4||y>=8&&y<12?1:0;
 const q={kind:'height',corner:'nw',cx:704,cy:704,r:64,underX:10,underY:10,under:{surface:'grass',level:0},mask:encodeMask(bits)};doc.cells['10,10']={surface:'grass',level:4,curves:[q]};
 assert.deepEqual(maskFronts(q,642),[656,688]);assert.deepEqual(maskFronts(q,639),[]);assert.deepEqual(maskFronts(q,704),[]);
 const before=JSON.stringify(doc),transforms=[],c={save(){},restore(){},transform(...args){transforms.push(args);},fillRect(){},drawImage(){},createLinearGradient(){return {addColorStop(){}};}};
 const source=readFileSync(new URL('./round-render.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export function /gm,'function ')+'\ndrawRoundCliff;';
 const draw=vm.runInNewContext(source,{cell,height,maskFronts,frontEdge,cliffArt:{width:512,height:256}});draw(c,doc,10,10);
 assert.equal(transforms.length,32);for(let i=0;i<16;i++){assert.equal(transforms[i*2][4],640+i*4);assert.equal(transforms[i*2][5],656-192);assert.equal(transforms[i*2+1][5],688-192);}
 assert.equal(JSON.stringify(doc),before,'Rendering never changes portable terrain geometry');
});
