'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {isGlassFloor,create,STRIPS}=require('../wall-reflections.js');
test('wall reflections reach reviewed glass while protecting carpet, tiles and rectangular walls',()=>{
 for(const [x,y]of [[800,210],[1110,280],[1480,390],[400,475],[755,690],[110,780]])assert.equal(isGlassFloor(x,y),true,`${x},${y}`);
 for(const [x,y]of [[250,250],[500,350],[650,580],[400,750],[835,650],[1610,500]])assert.equal(isGlassFloor(x,y),false,`${x},${y}`);
 assert.equal(new Set(STRIPS.map(s=>s.id)).size,STRIPS.length);
});
test('off and unavailable sources skip reflection generation',()=>{
 const document={createElement(){throw Error('Off must not allocate a canvas');}},reflections=create({document,getQuality:()=>'off'});
 assert.equal(reflections.draw({}, {width:1672,height:941}),false);assert.equal(reflections.getState().builds,0);
 assert.equal(create().draw({}, {width:100,height:100}),false);
});
test('the flat northwest face reflects onto its new glass and joins the existing north strip',()=>{
 const west=STRIPS.find(strip=>strip.id==='dance-west'),north=STRIPS.find(strip=>strip.id==='dance-north');
 assert.deepEqual(west.source,[50,507,186,141]);
 assert.deepEqual(west.floor,[50,650,186,166]);
 assert.equal(west.floor[0]+west.floor[2],north.floor[0]);
 for(const [x,y]of [[90,665],[110,690],[90,705],[90,730],[110,800]])assert.equal(isGlassFloor(x,y),true,`${x},${y}`);
 for(const [x,y]of [[70,665],[60,670],[100,620],[200,640],[170,700],[85,650],[85,665],[85,705],[85,800],[200,650],[246,658]])assert.equal(isGlassFloor(x,y),false,`${x},${y}`);
});
