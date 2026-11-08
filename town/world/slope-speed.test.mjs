import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,height} from './model.mjs';
import {movePlayer,toggleGate} from './physics.mjs';
import {planStairs} from '../builder/stairs.mjs';

const catalog=new Map();
const directions=[
 {name:'north',dx:0,dy:-1,up:'w',down:'s'},
 {name:'south',dx:0,dy:1,up:'s',down:'w'},
 {name:'east',dx:1,dy:0,up:'d',down:'a'},
 {name:'west',dx:-1,dy:0,up:'a',down:'d'}
];
function steepFixture(direction){
 const d=blank(),low={x:40,y:40},high={x:40+direction.dx,y:40+direction.dy};
 // A broad high landing lets the actor finish the flight and continue moving.
 for(let y=34;y<=46;y++)for(let x=34;x<=46;x++)if((x-40)*direction.dx+(y-40)*direction.dy>=1)d.cells[`${x},${y}`]={surface:'grass',level:8};
 const plan=planStairs(d,low,high,{width:3});assert(plan.valid);Object.assign(d.cells,Object.fromEntries(plan.edits));
 return {d,low:{x:2592-direction.dx*32,y:2592-direction.dy*32},high:{x:(high.x+.5)*64+direction.dx*32,y:(high.y+.5)*64+direction.dy*32}};
}
function projection(d,p){return {x:p.x,y:p.y-height(d,p.x,p.y)};}

test('flat ground keeps walking, running and normalized diagonal travel unchanged',()=>{
 for(const [keys,speed]of [[['d'],450],[['w','shift'],780],[['a','s'],450]]){
  const d=blank(),p={x:4000,y:4000};for(let i=0;i<50;i++)movePlayer(d,p,new Set(keys),.02,catalog);
  assert(Math.abs(Math.hypot(p.x-4000,p.y-4000)-speed)<1e-7);
 }
});

test('maximum-grade stairs cannot amplify projected speed in any direction, uphill or downhill',()=>{
 for(const direction of directions)for(const descending of [false,true])for(const running of [false,true]){
  const {d,low,high}=steepFixture(direction),p={...(descending?high:low)},target=descending?low:high;
  const keys=new Set([descending?direction.down:direction.up,...(running?['shift']:[])]),speed=running?780:450,dt=.02;
  const dx=target.x-p.x,dy=target.y-p.y,total=Math.hypot(dx,dy),start={...p};let frames=0;
  while(((p.x-start.x)*dx+(p.y-start.y)*dy)/total<total&&frames<300){
   const before=projection(d,p),motion=movePlayer(d,p,keys,dt,catalog),after=projection(d,p);
   const traveled=Math.hypot(after.x-before.x,after.y-before.y);
   assert(traveled<=speed*dt+.05,`${direction.name} ${descending?'down':'up'} ${running?'run':'walk'} projected ${traveled} > ${speed*dt}`);
   assert(motion.distance>0,`${direction.name} stalls on a valid landing`);frames++;
  }
  assert(frames<300,`${direction.name} cannot complete the flight`);
  assert.equal(height(d,p.x,p.y),descending?0:384);
 }
});

test('slope pacing preserves closed gates and permits the same flight after opening',()=>{
 const direction=directions[0],{d,low}=steepFixture(direction),p={...low},keys=new Set(['w','shift']);
 d.edges['h:40:40']={style:'iron',gate:true,open:false};
 for(let i=0;i<150;i++)movePlayer(d,p,keys,.02,catalog);
 assert(p.y>=2574);assert.equal(movePlayer(d,p,keys,.02,catalog).distance,0);
 assert(toggleGate(d,p));for(let i=0;i<60;i++)movePlayer(d,p,keys,.02,catalog);
 assert(p.y<2560);assert.equal(height(d,p.x,p.y),384);
});

test('stairs cannot pace the actor through water or an unmatched cliff at a landing',()=>{
 for(const surface of ['water','grass']){
  const {d,low}=steepFixture(directions[0]),p={...low},keys=new Set(['w','shift']);
  d.cells['40,38']={surface,level:surface==='water'?8:0};
  for(let i=0;i<150;i++)movePlayer(d,p,keys,.02,catalog);
  assert(p.y>=2496,`${surface} landing barrier was crossed`);assert.equal(height(d,p.x,p.y),384);
  if(surface==='water'){
   d.cells['40,38'].bridge='ns';for(let i=0;i<20;i++)movePlayer(d,p,keys,.02,catalog);
   assert(p.y<2496,'bridge did not restore passage');assert.equal(height(d,p.x,p.y),384);
  }
 }
});
