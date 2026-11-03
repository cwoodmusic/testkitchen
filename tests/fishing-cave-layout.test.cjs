const test=require('node:test'),assert=require('node:assert/strict');
const layout=require('../fishing-cave-layout.js');
test('the landing and south-facing pier have square edges and an unbroken shore connection',()=>{
 assert.deepEqual(layout.LAND,[[70,235],[330,235],[330,355],[70,355]]);
 assert.deepEqual(layout.DOCK,[[220,340],[320,340],[320,410],[220,410]]);
 assert.equal(layout.DOCK[1][0]-layout.DOCK[0][0],100,'The pier has a uniform 100px walking width');
 for(let y=340;y<=355;y++)for(const x of [220,270,320]){
  assert.equal(layout.contains(layout.LAND,x,y),true);assert.equal(layout.contains(layout.DOCK,x,y),true);
 }
 for(const [x,y]of [[219,380],[321,380],[270,411],[69,285],[331,285],[135,234]])assert.equal(layout.isShore(x,y),false,`Outside the shore edge ${x},${y}`);
 // Preserve the open collision cells in the exported fishing-room project.
 for(const [x,y]of [[80,300],[90,300],[80,310],[90,310],[80,320],[80,330],[80,340]])assert.equal(layout.isShore(x,y),true);
});
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
 assert.equal(layout.isShore(160,260),true);assert.equal(layout.isShore(135,234),false);
 assert.equal(layout.isBoatWater(layout.BOAT_DOCK.x,layout.BOAT_DOCK.y),true);
 assert.equal(layout.BOAT_DOCK.x,layout.BOARDING.x,'The boat sits directly south of the boarding point');
 assert.ok(layout.BOAT_DOCK.y-12>410,'The entire boat clears the pier tip');
 for(const dx of [-18,0,18])for(const dy of [-12,0,12])assert.equal(layout.isWater(layout.BOAT_DOCK.x+dx,layout.BOAT_DOCK.y+dy),true,`Wet boat footprint ${dx},${dy}`);
 for(const [x,y]of [[270,395],[220,380],[320,380],[270,411]])assert.equal(layout.isBoatWater(x,y),false,`Boat cannot cross the pier edge ${x},${y}`);
 for(let y=150;y<550;y+=7)for(let x=100;x<960;x+=7)if(layout.isShore(x,y))assert.equal(layout.isWater(x,y),false);
 assert.equal(layout.isWater(NaN,350),false);assert.equal(layout.isShore(Infinity,270),false);
});
test('the south-facing berth has a full-width departure channel into the lake',()=>{
 assert.deepEqual(layout.DEPARTURE_WATER,[[220,350],[400,350],[400,510],[220,510]]);
 assert.ok(Object.isFrozen(layout.DEPARTURE_WATER)&&Object.isFrozen(layout.DEPARTURE_WATER[0]));
 const path=[];for(let y=435;y<=490;y++)path.push([270,y]);for(let x=270;x<=550;x++)path.push([x,490]);
 for(const [x,y]of path){
  assert.equal(layout.isBoatWater(x,y),true,`Boat departure ${x},${y}`);
  for(const dx of [-18,0,18])for(const dy of [-12,0,12])assert.equal(layout.isWater(x+dx,y+dy),true,`Full departure footprint ${x+dx},${y+dy}`);
 }
 assert.equal(layout.isBoatWater(270,498),true);assert.equal(layout.isBoatWater(270,499),true,'Painted water continues beyond the former departure rectangle');
 for(const [x,y]of [[270,350],[270,395]])assert.equal(layout.isWater(x,y),false,'A water polygon never floods the landing or pier');
 for(const [x,y]of [[219,490],[270,511]])assert.equal(layout.isWater(x,y),true,'Visible bays outside the former channel remain navigable');
 for(const [x,y]of [[100,150],[200,90],[850,550]])assert.equal(layout.isWater(x,y),false,'Actual cave rocks remain solid');
});
