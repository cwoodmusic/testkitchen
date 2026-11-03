'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const world=require('../fishing-biomes.js'),layout=require('../fishing-cave-layout.js');
const pointFor={north:{x:550,y:26},south:{x:550,y:594},east:{x:974,y:350},west:{x:26,y:350}};

test('six fishing screens form a connected two-row map with reversible passages and cycles',()=>{
 assert.equal(world.SCREENS.length,6);assert.equal(new Set(world.SCREENS.map(s=>s.id)).size,6);
 assert.equal(world.DEFAULT_SCREEN,'lantern-lake');
 assert.deepEqual(world.SCREENS.map(s=>[s.column,s.row]),[[0,0],[0,1],[1,0],[1,1],[2,0],[2,1]]);
 const reached=new Set(),visit=id=>{if(reached.has(id))return;reached.add(id);for(const next of Object.values(world.screenFor(id).neighbors))if(next)visit(next);};visit(world.DEFAULT_SCREEN);
 assert.equal(reached.size,6);let directed=0;
 for(const screen of world.SCREENS)for(const portal of world.portalsFor(screen)){
  directed++;assert.equal(world.nextScreen(screen,portal.direction).id,portal.toId);
  assert.equal(world.nextScreen(portal.toId,world.oppositeDirection(portal.direction)).id,screen.id);
  assert.equal(world.screenFor(portal.toId).name,portal.label);
 }
 assert.equal(directed,14);
 let screen=world.DEFAULT_SCREEN;for(const direction of ['east','south','west','north'])screen=world.nextScreen(screen,direction).id;
 assert.equal(screen,world.DEFAULT_SCREEN,'The world has a navigable square loop, not a single linear strip');
 assert.ok(Object.isFrozen(world.BIOMES)&&Object.isFrozen(world.SCREENS)&&Object.isFrozen(world.SCREENS[0].neighbors));
});

test('home landing, dock and ladder remain dry while the south-facing berth stays in water',()=>{
 for(const p of [layout.SPAWN,layout.LADDER,layout.BOARDING,{x:125,y:335}]){
  assert.equal(layout.isShore(p.x,p.y),true);assert.equal(world.isWater(world.DEFAULT_SCREEN,p.x,p.y),false);
 }
 assert.equal(world.isBoatWater(world.DEFAULT_SCREEN,layout.BOAT_DOCK.x,layout.BOAT_DOCK.y),true);
 for(const dx of [-18,0,18])for(const dy of [-12,0,12])assert.equal(world.isWater(world.DEFAULT_SCREEN,layout.BOAT_DOCK.x+dx,layout.BOAT_DOCK.y+dy),true);
 assert.equal(world.isWater(world.DEFAULT_SCREEN,100,200),false,'The upper ladder shelf is still rock');
 for(let y=235;y<=410;y+=3)for(let x=70;x<=330;x+=3)if(layout.isShore(x,y))assert.equal(world.isWater(world.DEFAULT_SCREEN,x,y),false);
});

test('the dock departure connects into painted water while actual banks stay dry',()=>{
 const path=[];for(let y=435;y<=490;y++)path.push([270,y]);for(let x=270;x<=550;x++)path.push([x,490]);
 for(const [x,y]of path){
  assert.equal(world.isBoatWater(world.DEFAULT_SCREEN,x,y),true,`Home departure ${x},${y}`);
  for(const dx of [-18,0,18])for(const dy of [-12,0,12])assert.equal(world.isWater(world.DEFAULT_SCREEN,x+dx,y+dy),true);
 }
 assert.equal(world.isWater(world.DEFAULT_SCREEN,230,470),true,'The dock channel extends beyond the old ellipse');
 for(const screen of world.SCREENS)for(const [x,y]of require('../fishing-water-regions.js').screens[screen.id].dryWitnesses)assert.equal(world.isWater(screen,x,y),false,screen.id+' keeps its painted banks dry');
 for(const [x,y]of [[270,350],[270,395]])assert.equal(world.isWater(world.DEFAULT_SCREEN,x,y),false,'Landing and pier remain blocked');
 for(const [x,y]of [[219,490],[270,511]])assert.equal(world.isWater(world.DEFAULT_SCREEN,x,y),true,'The water does not stop at the former departure rectangle');
});

test('only connected edges have complete water corridors for a boat footprint',()=>{
 for(const screen of world.SCREENS)for(const direction of ['north','south','east','west']){
  const connected=!!screen.neighbors[direction],point=pointFor[direction];
  assert.equal(world.isBoatWater(screen,point.x,point.y),connected,screen.id+' '+direction);
  if(!connected)continue;
  for(let t=0;t<=1;t+=.025){
   let x=550,y=350;
   if(direction==='east')x=800+174*t;else if(direction==='west')x=300-274*t;else if(direction==='north')y=250-224*t;else y=450+144*t;
   assert.equal(world.isBoatWater(screen,x,y),true,screen.id+' complete corridor '+x+','+y);
  }
 }
 assert.equal(world.isWater('not-a-screen',550,350),false);
 assert.equal(world.isBoatWater(world.DEFAULT_SCREEN,NaN,350),false);
 assert.equal(world.isWater(world.DEFAULT_SCREEN,550,Infinity),false);
 assert.equal(world.isBoatWater('mistfen-channel',974,280),true,'The full painted swamp waterway is wider than the former exit rectangle');
 assert.equal(world.isBoatWater('mistfen-channel',100,80),false,'The actual mossy bank stays solid');
});

test('travel happens only at the real edge and puts the full boat safely on the neighboring screen',()=>{
 for(const screen of world.SCREENS)for(const portal of world.portalsFor(screen)){
  const crossing=world.transitionFor(screen,pointFor[portal.direction]);
  assert.ok(crossing,screen.id+' '+portal.direction);assert.equal(crossing.fromId,screen.id);assert.equal(crossing.toId,portal.toId);
  assert.equal(crossing.screen,world.screenFor(portal.toId));assert.equal(crossing.biome,world.biomeFor(crossing.screen));
  assert.equal(world.isBoatWater(crossing.toId,crossing.entry.x,crossing.entry.y),true);
  assert.equal(world.transitionFor(crossing.toId,crossing.entry),null,'Entering a screen cannot bounce immediately back');
 }
 for(const p of [{x:860,y:350},{x:240,y:350},{x:550,y:500},{x:550,y:200}])assert.equal(world.transitionFor(world.DEFAULT_SCREEN,p),null,'Interior waypoints must never teleport the player');
 assert.equal(world.transitionFor(world.DEFAULT_SCREEN,{x:26,y:350}),null);
 assert.equal(world.transitionFor(world.DEFAULT_SCREEN,{x:550,y:26}),null);
 assert.equal(world.transitionFor('lantern-lake',{x:974,y:315}).entry.y,320);
 assert.equal(world.transitionFor('lantern-lake',{x:974,y:385}).entry.y,380);
 assert.equal(world.transitionFor('lantern-lake',{x:519,y:594}).entry.x,520);
 assert.equal(world.transitionFor('lantern-lake',{x:581,y:594}).entry.x,580);
 assert.equal(world.transitionFor('unknown',{x:974,y:350}),null);
});

test('each biome has a distinct meter while practice can still list every meter',()=>{
 assert.deepEqual(world.BIOME_IDS,['cave','swamp','ocean']);
 for(const [id,meter]of [['cave','4/4'],['swamp','6/8'],['ocean','2/2']]){
  assert.equal(world.biomeFor(id).meter,meter);assert.deepEqual(world.availableMeters(id),[meter]);
  for(const screen of world.SCREENS.filter(s=>s.biome===id))assert.equal(world.biomeFor(screen),world.biomeFor(id));
 }
 assert.deepEqual(world.availableMeters(),['4/4','6/8','2/2']);assert.deepEqual(world.availableMeters('unknown'),[]);
 assert.equal(world.biomeFor('__proto__'),null);assert.equal(world.screenFor('__proto__'),null);
});

test('three common species span all biomes and every other existing fish has one viable habitat',()=>{
 const engine=require('../rhythm-fishing-engine.js'),fish=engine.FISH;
 assert.equal(fish.length,30);assert.deepEqual(world.SHARED_FISH_IDS,['silver-minnow','cave-guppy','bluegill']);
 for(const species of fish){
  const homes=world.fishHabitats(species);
  if(world.SHARED_FISH_IDS.includes(species.id)){assert.equal(species.rarity,'common');assert.deepEqual(homes,world.BIOME_IDS);}
  else{assert.equal(homes.length,1);assert.equal(world.biomeFor(homes[0]).meter,species.meter);}
  for(const id of homes){assert.equal(world.isFishInBiome(species,id),true);assert.equal(engine.canFishInMeter(species,world.biomeFor(id).meter),true);}
 }
 for(const id of world.BIOME_IDS){const pool=fish.filter(f=>world.isFishInBiome(f,id));assert.equal(pool.length,12);assert.equal(new Set(pool.map(f=>f.rarity)).size,5,'Every biome can yield all rarity tiers');}
 assert.deepEqual(world.fishHabitats({id:'unknown',meter:'bad'}),[]);assert.equal(world.isFishInBiome(fish[0],'unknown'),false);
});
