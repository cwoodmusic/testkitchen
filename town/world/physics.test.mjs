import {test} from 'node:test';import assert from 'node:assert/strict';
import {blank,height} from './model.mjs';import {findStart,movePlayer,toggleGate,follow} from './physics.mjs';
import {planStairs} from '../builder/stairs.mjs';
const catalog=new Map();
test('shared movement stops at water and crosses bridges',()=>{const d=blank();d.cells['3,2']={surface:'water',level:0};const p={x:170,y:160},keys=new Set(['d']);for(let i=0;i<40;i++)movePlayer(d,p,keys,.02,catalog);assert(p.x<192);d.cells['3,2'].bridge='ew';for(let i=0;i<40;i++)movePlayer(d,p,keys,.02,catalog);assert(p.x>256);});
test('shared gates and collision agree before and after opening',()=>{const d=blank();d.edges['v:3:2']={style:'iron',gate:true,open:false};const p={x:160,y:160},keys=new Set(['d']);for(let i=0;i<20;i++)movePlayer(d,p,keys,.02,catalog);assert(p.x<180);assert(toggleGate(d,p));for(let i=0;i<20;i++)movePlayer(d,p,keys,.02,catalog);assert(p.x>210);});
test('shared spawn fallback and camera use authored height',()=>{const d=blank();d.spawn={x:160,y:160};d.cells['2,2']={surface:'water',level:0};const p=findStart(d,catalog);assert.notDeepEqual(p,d.spawn);d.cells['1,1']={surface:'grass',level:2};const cam={};follow(cam,{x:96,y:96},d);assert.deepEqual(cam,{x:96,y:0});});
test('town walking and running cover the intended distance without diagonal acceleration',()=>{
 for(const [keys,speed]of [[['d'],450],[['d','shift'],780],[['d','s'],450],[['d','s','shift'],780]]){
  const d=blank(),p={x:4000,y:4000};let traveled=0;
  for(let i=0;i<50;i++)traveled+=movePlayer(d,p,new Set(keys),.02,catalog).distance;
  assert(Math.abs(Math.hypot(p.x-4000,p.y-4000)-speed)<1e-7);
  assert(Math.abs(traveled-speed)<1e-7);
 }
 const idle=movePlayer(blank(),{x:4000,y:4000},new Set(),.02,catalog);assert.equal(idle.distance,0);assert.equal(idle.walking,false);
});
test('fast running cannot tunnel through a closed gate or keep animating against it',()=>{
 const d=blank();d.edges['v:10:10']={style:'iron',gate:true,open:false};const p={x:600,y:672},keys=new Set(['d','shift']);
 for(let i=0;i<20;i++)movePlayer(d,p,keys,.08,catalog);
 assert(p.x<627);const blocked=movePlayer(d,p,keys,.08,catalog);assert.equal(blocked.distance,0);assert.equal(blocked.walking,false);assert.equal(blocked.facing,'right');
 assert(toggleGate(d,p));movePlayer(d,p,keys,.08,catalog);assert(p.x>640);
});
test('running climbs and descends generated multi-level stairs without skipping cliff collision',()=>{
 const d=blank();for(let y=19;y<=21;y++)d.cells['24,'+y]={surface:'grass',level:3};
 const plan=planStairs(d,{x:20,y:20},{x:24,y:20},{width:3});assert(plan.valid);Object.assign(d.cells,Object.fromEntries(plan.edits));const p={x:1312,y:1312};
 for(let i=0;i<25;i++)movePlayer(d,p,new Set(['d','shift']),.02,catalog);
 assert(p.x>=1568&&p.x<1600);assert.equal(height(d,p.x,p.y),144);
 for(let i=0;i<25;i++)movePlayer(d,p,new Set(['a','shift']),.02,catalog);
 assert(p.x<=1312);assert.equal(height(d,p.x,p.y),0);
});
