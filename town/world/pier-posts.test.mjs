import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {blank,terrainHeight,surfaceAt} from './model.mjs';
import {pierGeometry,drawPier,submergedPierRuns} from './piers.mjs';
import {PIER_POST_WIDTH,PIER_POST_DEPTH,pierPostCentres} from './pier-post-layout.mjs';

const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas');
const alpha=(c,x,y)=>c.getImageData(x,y,1,1).data[3];

test('wide square posts keep the established end, outside-edge and alternating bent anchors',()=>{
 assert.equal(PIER_POST_WIDTH,22);assert.equal(PIER_POST_DEPTH,12);
 assert.deepEqual(pierPostCentres(10,11,{north:false,east:false,south:false,west:false}),[{x:651,y:760},{x:693,y:760}]);
 assert.deepEqual(pierPostCentres(10,11,{north:true,east:true,south:true,west:true}),[]);
 assert.deepEqual(pierPostCentres(10,12,{north:true,east:true,south:true,west:true}),[{x:651,y:824}]);
 assert.deepEqual(pierPostCentres(11,12,{north:true,east:true,south:true,west:true}),[]);
});

test('native post artwork fills the wider timber while the deck surface and drawing state remain intact',()=>{
 const d=blank();d.cells['10,10']={surface:'water',level:0,bridge:'ns',pier:{level:8,axis:'ns'}};
 const before=JSON.stringify(d),g=pierGeometry(d,10,10),cv=createCanvas(128,600),c=cv.getContext('2d'),wood=createCanvas(512,512),w=wood.getContext('2d');
 w.fillStyle='#b48752';w.fillRect(0,0,512,512);w.fillStyle='#755437';for(let y=0;y<512;y+=16)w.fillRect(0,y,512,2);
 c.translate(16-g.x,16-g.y);c.fillStyle='#123456';const transform=c.getTransform();drawPier(c,d,10,10,wood);
 assert.deepEqual(c.getTransform(),transform);assert.equal(JSON.stringify(d),before);
 // Read the actual restored paint: the native Canvas fillStyle getter keeps
 // its last setter even after a correct save/restore.
 c.fillRect(g.x+100,g.y+560,1,1);assert.deepEqual([...c.getImageData(116,576,1,1).data],[18,52,86,255]);
 for(const p of g.supports){
  const X=p.x-g.x+16,Y=p.y-g.y+66;
  assert.equal(alpha(c,X-1,Y),0);assert.equal(alpha(c,X+PIER_POST_WIDTH,Y),0);
  for(let offset=0;offset<PIER_POST_WIDTH;offset++)assert.equal(alpha(c,X+offset,Y),255,'Every exposed timber pixel is solid, including its widened sides');
 }
 assert.deepEqual([...c.getImageData(48,48,1,1).data],[...w.getImageData(160,160,1,1).data],'Posts remain behind the unchanged deck boards');
});

test('all authored piers share their actual post centres with under-deck physics without changing saved geometry',()=>{
 const d=JSON.parse(readFileSync(new URL('../maps/coda-town-plaza-boardwalk.json',import.meta.url))),before=JSON.stringify(d);let posts=0;
 for(const [key,cell]of Object.entries(d.cells)){
  if(!cell.pier)continue;const [x,y]=key.split(',').map(Number),g=pierGeometry(d,x,y);
  assert.deepEqual({x:g.x,y:g.y,w:g.w,h:g.h},{x:x*64,y:y*64-cell.pier.level*48,w:64,h:64});
  assert.deepEqual(g.supports.map(p=>({x:p.groundX,y:p.groundY})),pierPostCentres(x,y,g.joins));
  for(const p of g.supports){
   posts++;assert.equal(p.x+p.w/2,p.groundX);assert.equal(p.waterline+p.ground,p.groundY);assert.equal(p.ground,terrainHeight(d,p.groundX,p.groundY));assert.equal(p.water,surfaceAt(d,p.groundX,p.groundY)==='water');
   assert(p.x>=g.x&&p.x+p.w<=g.x+g.w,'The wider support stays beneath the same deck tile');
   for(const run of submergedPierRuns(d,p)){assert.equal(run.x,p.x);assert.equal(run.w,PIER_POST_WIDTH);}
  }
 }
 assert(posts>0);assert.equal(JSON.stringify(d),before);
});

test('under-deck foreground drawing leaves northern supports behind the walker without dropping deck boards',()=>{
 const d=blank();d.cells['10,10']={surface:'water',level:0,bridge:'ns',pier:{level:8,axis:'ns'}};
 const g=pierGeometry(d,10,10),paint=afterY=>{const cv=createCanvas(128,600),c=cv.getContext('2d');c.translate(16-g.x,16-g.y);drawPier(c,d,10,10,null,{afterY});return c;};
 const front=paint(696),behind=paint(697),post=g.supports[0],X=post.x-g.x+16,Y=post.y-g.y+66;
 assert.equal(alpha(front,X,Y),255);assert.equal(alpha(behind,X,Y),0,'A post north of the actor must stay behind their image');
 assert.deepEqual([...front.getImageData(48,48,1,1).data],[...behind.getImageData(48,48,1,1).data],'Every deck pixel remains in the foreground');
});
