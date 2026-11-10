import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanAtlasComponents,adaptiveAtlasRegions,cleanAdaptiveAtlas} from './atlas-alpha-packing.mjs';

function fixture(width=100,height=100){
 const data=new Uint8ClampedArray(width*height*4);
 return {width,height,data,rect(x,y,w,h,alpha=241){for(let Y=y;Y<y+h;Y++)for(let X=x;X<x+w;X++)data.set([120+X%30,70+Y%40,35,alpha],(Y*width+X)*4);}};
}
test('packing removes a distant neighboring-row footer while preserving nearby detached ornaments',()=>{
 const f=fixture();f.rect(30,30,40,40);f.rect(20,1,60,3);f.rect(73,40,3,3);f.rect(95,95,1,1);
 const before=f.data.slice(),r=cleanAtlasComponents(f.data,100,100,{columns:1,rows:1});
 assert.deepEqual(f.data,before,'Source RGBA must remain untouched');
 assert.equal(r.pixels[(2*100+40)*4+3],0,'Detached footer must not be mistaken for chair artwork');
 assert.equal(r.pixels[(41*100+74)*4+3],241,'A nearby intentional ornament stays intact');
 assert.equal(r.pixels[(95*100+95)*4+3],0);
 for(let y=30;y<70;y++)for(let x=30;x<70;x++)assert.deepEqual(r.pixels.slice((y*100+x)*4,(y*100+x+1)*4),before.slice((y*100+x)*4,(y*100+x+1)*4));
});
test('a largest flat object and larger disconnected companion pieces are retained',()=>{
 const f=fixture();f.rect(10,0,80,3);f.rect(12,30,8,8);
 const r=cleanAtlasComponents(f.data,100,100,{columns:1,rows:1});assert.equal(r.pixels[10*4+3],241);assert.equal(r.pixels[(30*100+12)*4+3],241);
});
test('per-cell cleanup cannot assign a preceding row tail to the next object, or fill real transparency holes',()=>{
 const f=fixture(100,200);f.rect(25,25,50,60);f.rect(25,100,50,3);f.rect(30,130,40,40);
 f.data.fill(0,(145*100+45)*4,(145*100+46)*4);
 const r=cleanAtlasComponents(f.data,100,200,{columns:1,rows:2});
 assert.equal(r.cells[1].bounds.y,130);assert.equal(r.pixels[(101*100+40)*4+3],0);assert.equal(r.pixels[(145*100+45)*4+3],0);assert.equal(r.pixels[(140*100+40)*4+3],241);
});
test('adaptive row ownership retains drifted feet and independently follows each column gap',()=>{
 const f=fixture(100,200);f.rect(10,20,30,60);f.rect(10,75,8,35);f.rect(32,75,8,35);f.rect(10,135,30,45);
 f.rect(60,20,30,60);f.rect(60,95,30,70);
 const before=f.data.slice(),regions=adaptiveAtlasRegions(f.data,100,200,{columns:2,rows:2});
 assert.ok(regions[0].h>110,'First-column feet cross the nominal100px split');
 assert.ok(regions[1].h<95,'Second-column next object starts above the nominal split');
 const clean=cleanAdaptiveAtlas(f.data,100,200,{columns:2,rows:2});
 assert.deepEqual(f.data,before);assert.deepEqual(clean.pixels,before,'Every native body/foot sample is retained');
 assert.equal(clean.cells[0].bounds.y+clean.cells[0].bounds.h,110);
 assert.equal(clean.cells[2].bounds.y,135);assert.equal(clean.cells[3].bounds.y,95);
});
test('adaptive regions form a complete nonoverlapping atlas partition even with empty rows',()=>{
 const f=fixture(83,173),regions=adaptiveAtlasRegions(f.data,83,173,{columns:4,rows:8}),visits=new Uint8Array(83*173);
 for(const r of regions){assert.ok(r.w>0&&r.h>0);for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)visits[y*83+x]++;}
 assert.ok(visits.every(n=>n===1));
 const clean=cleanAdaptiveAtlas(f.data,83,173);assert.equal(clean.cells.length,32);assert.ok(clean.cells.every(c=>c.bounds===null));
});
