const test=require('node:test'),assert=require('node:assert/strict');
const layout=require('../fishing-cave-layout.js');
test('the new landing connects spawn, ladder, captain and pier without crossing water',()=>{
 for(const target of [layout.LADDER,layout.BOARDING,{x:125,y:335}])for(let i=0;i<=100;i++){
  const t=i/100,x=layout.SPAWN.x+(target.x-layout.SPAWN.x)*t,y=layout.SPAWN.y+(target.y-layout.SPAWN.y)*t;
  assert.equal(layout.isShore(x,y),true,`Walking path ${x},${y}`);assert.equal(layout.isWater(x,y),false);
 }
 assert.equal(layout.near(layout.SPAWN,layout.LADDER),false,'Arrival does not immediately put E on the exit');
 assert.equal(layout.near(layout.SPAWN,layout.BOARDING),false,'Walk across the landing before boarding');
 assert.equal(layout.near(layout.LADDER,layout.LADDER),true);
});
test('boat and water boundaries exclude the pier, shoreline and cave rock',()=>{
 assert.equal(layout.isShore(160,260),true);assert.equal(layout.isShore(135,235),false);
 assert.equal(layout.isBoatWater(290,415),true);assert.equal(layout.isBoatWater(218,380),false);
 for(let y=150;y<550;y+=7)for(let x=100;x<960;x+=7)if(layout.isShore(x,y))assert.equal(layout.isWater(x,y),false);
 assert.equal(layout.isWater(NaN,350),false);assert.equal(layout.isShore(Infinity,270),false);
});
