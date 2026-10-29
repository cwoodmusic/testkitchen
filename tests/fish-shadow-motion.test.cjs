const test=require('node:test'),assert=require('node:assert/strict');
const motion=require('../fish-shadow-motion.js');
const lake=(x,y)=>((x-550)/360)**2+((y-350)/185)**2<.97;
const fish=(id,x=500,y=350)=>({id,fishId:'cave-minnow',seed:2.17,x,y,visible:true,respawnAt:0,rarity:'common'});
const difference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

test('shadows swim smoothly with individual speeds while preserving their catch identity',()=>{
 const controller=motion.create({isWater:lake,random:()=>.3}),shadows=[fish('one'),fish('two',620,340)];
 const original=shadows.map(value=>({...value}));controller.update(shadows,1/60);
 assert.ok(shadows.every(value=>Number.isFinite(value.heading)&&value.swimSpeed>=20&&value.swimSpeed<=45));
 assert.notEqual(shadows[0].heading,shadows[1].heading);assert.notEqual(shadows[0].swimSpeed,shadows[1].swimSpeed);
 for(let frame=0;frame<120;frame++){
  const previous=shadows.map(value=>({...value}));controller.update(shadows,1/60);
  for(let at=0;at<shadows.length;at++){
   const current=shadows[at],before=previous[at];assert.ok(Math.hypot(current.x-before.x,current.y-before.y)<=.751);
   assert.ok(Math.abs(difference(current.heading,before.heading))<=1.65/60+1e-8);
  }
 }
 for(let at=0;at<shadows.length;at++){
  assert.ok(Math.hypot(shadows[at].x-original[at].x,shadows[at].y-original[at].y)>20);
  for(const key of ['id','fishId','seed','visible','respawnAt','rarity'])assert.equal(shadows[at][key],original[at][key]);
 }
});

test('paused, hidden, and hooked shadows do not move or accumulate animation state',()=>{
 const controller=motion.create({isWater:lake}),shadows=[fish('hooked'),{...fish('hidden',600,350),visible:false}];
 const snapshot=JSON.stringify(shadows);controller.update(shadows,.1,{paused:true});assert.equal(JSON.stringify(shadows),snapshot);
 controller.update(shadows,.1,{selectedId:'hooked'});assert.equal(JSON.stringify(shadows),snapshot);
 controller.update(shadows,.1);assert.notEqual(JSON.stringify(shadows[0]),JSON.stringify(fish('hooked')));assert.deepEqual(shadows[1],{...fish('hidden',600,350),visible:false});
});

test('fish turn inside curved banks and a new shore exclusion instead of crossing land',()=>{
 const water=(x,y)=>lake(x,y)&&!(x<360&&y>270&&y<440),controller=motion.create({isWater:water,random:()=>.8});
 const shadows=[{...fish('east-bank',900,350),heading:0},{...fish('shore-bank',363,350),heading:Math.PI},{...fish('north-bank',550,170),heading:-Math.PI/2}];
 const start=shadows.map(value=>({x:value.x,y:value.y}));
 for(let frame=0;frame<7200;frame++){
  const previous=shadows.map(value=>({x:value.x,y:value.y}));controller.update(shadows,1/60);
  shadows.forEach((value,index)=>{
   assert.ok(water(value.x,value.y),'A swimmer must stay in navigable water');
   for(let part=1;part<=4;part++){const t=part/4;assert.ok(water(previous[index].x+(value.x-previous[index].x)*t,previous[index].y+(value.y-previous[index].y)*t),'The full movement segment stays out of the shore');}
  });
 }
 assert.ok(shadows.every((value,index)=>Math.hypot(value.x-start[index].x,value.y-start[index].y)>25),'Bank avoidance must not pin fish forever');
 assert.ok(controller.snapshot().maxStep<=.751);
});

test('seeded movement is repeatable, independent of hidden fish, and large deltas are bounded',()=>{
 const a=motion.create({isWater:lake,random:()=>.17}),b=motion.create({isWater:lake,random:()=>.17}),one=[fish('same')],two=[{...fish('hidden',600,350),visible:false},fish('same')];
 for(let frame=0;frame<120;frame++){a.update(one,.05);b.update(two,.05);}
 assert.deepEqual(one[0],two[1]);
 const before={...one[0]},steps=a.snapshot().substeps;a.update(one,10000);
 assert.ok(a.snapshot().substeps-steps<=15);assert.ok(Math.hypot(one[0].x-before.x,one[0].y-before.y)<=45*.25+1e-8);
 for(const dt of [0,-1,Infinity,NaN]){const state=JSON.stringify(one);a.update(one,dt);assert.equal(JSON.stringify(one),state);}
});

test('a second fish or a nearby boat cannot cause teleporting, and respawns receive fresh motion',()=>{
 const controller=motion.create({isWater:lake}),shadow=fish('one');controller.update([shadow],.05,{boat:{x:501,y:350}});
 assert.ok(Math.hypot(shadow.x-500,shadow.y-350)<=45*.05+1e-8);
 const initializations=controller.snapshot().initializations;
 Object.assign(shadow,fish('replacement',620,330));controller.update([shadow],.05);
 assert.equal(controller.snapshot().initializations,initializations+1);assert.equal(shadow.id,'replacement');assert.equal(shadow.fishId,'cave-minnow');
 const invalid={...fish('dry',50,50)};controller.update([invalid],.1);assert.deepEqual(invalid,fish('dry',50,50));
 assert.throws(()=>motion.create(),/water boundary/);
 const failing=motion.create({isWater(){throw Error('map unavailable');}}),safe=fish('no-map');failing.update([safe],.1);assert.deepEqual(safe,fish('no-map'));
});
