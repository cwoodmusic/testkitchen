import test from 'node:test';
import assert from 'node:assert/strict';
import {NOTE_KIND_BY_ID} from './engine.mjs';
import {createStoryGame,classifyPageOne,PAGE_ONE_INITIAL_INVENTORY,PAGE_TWO_GRANT,PAGE_ONE_ROUTES} from './story.mjs';

const totalUnits=stock=>Object.entries(stock).reduce((n,[kind,count])=>n+NOTE_KIND_BY_ID[kind].units*count,0);
const fill=(game,recipe)=>{for(const kind of recipe)assert.equal(game.add(kind),true,kind);};
const canal=['half','quarter','eighth-pair'];
const workshop=['half','eighth-pair','sixteenth-group'];
const garden=['quarter-rest','eighth-pair','sixteenth-group','quarter'];

test('the original parcel has nine distinct tiles and all returned resources are snapshots',()=>{
 const game=createStoryGame(),state=game.state;
 assert.equal(Object.keys(state.inventory).length,9);assert.deepEqual(state.inventory,PAGE_ONE_INITIAL_INVENTORY);
 assert.equal(totalUnits(state.inventory),24);assert.deepEqual(state.availableInventory,state.inventory);
 assert.equal(state.phase,'room');assert.equal(state.beats,0);assert.equal(state.canCommit,false);
 assert.deepEqual(state.creditedStages,[]);assert.equal(state.nextScene,null);assert.equal(state.receipt,null);
 state.inventory.quarter=100;state.availableInventory.half=100;state.phrase.push('quarter');state.creditedStages.push(2);state.discoveredRoutes.push('garden');
 assert.deepEqual(game.state.inventory,PAGE_ONE_INITIAL_INVENTORY);assert.deepEqual(game.state.phrase,[]);assert.deepEqual(game.state.discoveredRoutes,[]);
 assert(Object.isFrozen(PAGE_ONE_INITIAL_INVENTORY)&&Object.isFrozen(PAGE_TWO_GRANT)&&Object.isFrozen(PAGE_ONE_ROUTES.garden));
});

test('stock and exact duration reject repeat tiles, unknown types, overspending and underfilled commits',()=>{
 const game=createStoryGame();assert.equal(game.commit(),false);
 for(const kind of ['whole','whole-rest','unknown','constructor','__proto__',null,{},2])assert.equal(game.add(kind),false);
 assert.equal(game.add('dotted-half'),true);assert.equal(game.state.beats,3);assert.equal(game.commit(),false);
 assert.equal(game.add('half'),false);assert.equal(game.add('dotted-half'),false);
 assert.equal(game.add('quarter'),true);assert.equal(game.state.units,8);assert.equal(game.state.canCommit,true);
 assert.equal(game.add('eighth'),false);assert.equal(game.add('quarter'),false);assert.equal(game.commit(),true);
});

test('an opening rest takes priority over two grouped tiles and moving the same tiles changes that route',()=>{
 assert.equal(classifyPageOne(garden),'garden');
 const game=createStoryGame();fill(game,garden);const inventory=game.state.availableInventory;
 assert.equal(game.move(0,1),true);assert.deepEqual(game.state.phrase,['eighth-pair','quarter-rest','sixteenth-group','quarter']);
 assert.deepEqual(game.state.availableInventory,inventory);assert.equal(game.state.beats,4);
 assert.equal(game.commit(),true);assert.equal(game.state.routeId,'workshop');assert.equal(game.state.nextScene.id,'s02_workshop');
 assert.equal(game.undo(),true);fill(game,garden);assert.equal(game.commit(),true);assert.equal(game.state.routeId,'garden');
 assert.deepEqual(game.state.discoveredRoutes,['garden','workshop']);
});

test('half-beat tiles retain their identities and count as grouped only where authored',()=>{
 const game=createStoryGame();fill(game,['dotted-half','eighth']);assert.equal(game.state.beats,3.5);assert.equal(game.commit(),false);
 assert.equal(game.add('sixteenth-pair'),true);assert.equal(game.state.beats,4);assert.equal(game.commit(),true);assert.equal(game.state.routeId,'canal');
 assert.equal(classifyPageOne(['half','eighth','sixteenth-pair','eighth-pair']),'workshop');
 assert.equal(classifyPageOne(['half','eighth','sixteenth-pair','quarter']),'canal');
 assert.equal(classifyPageOne(['half-rest','half']),'garden');
 assert.equal(classifyPageOne(['half','half-rest']),'canal');
 assert.throws(()=>classifyPageOne(['half','half']),/original parcel/);assert.throws(()=>classifyPageOne(['unknown']),/four beats/);
});

test('placing and returning notes is free and movement cannot leave or duplicate the phrase',()=>{
 const game=createStoryGame();fill(game,canal);const stock=game.state.inventory;
 for(const args of [[-1,1],[0,-1],[2,1],[0,0],[0,99],[.5,1],[0,.5]])assert.equal(game.move(...args),false);
 for(const index of [-1,3,.5,NaN,Infinity,'0'])assert.equal(game.remove(index),false);
 assert.equal(game.move(2,-2),true);assert.deepEqual(game.state.phrase,['eighth-pair','half','quarter']);
 assert.equal(game.remove(1),true);assert.equal(game.state.availableInventory.half,1);assert.equal(game.state.beats,2);
 assert.equal(game.undo(),true);assert.equal(game.undo(),true);assert.equal(game.undo(),false);
 assert.deepEqual(game.state.phrase,[]);assert.deepEqual(game.state.inventory,stock);assert.deepEqual(game.state.availableInventory,stock);
});

test('each route consumes its actual answer, grants exactly three once, and stops at the next page',()=>{
 for(const [recipe,route] of [[garden,'garden'],[workshop,'workshop'],[canal,'canal']]){
  const game=createStoryGame();fill(game,recipe);assert.equal(game.commit(),true);
  const state=game.state,after={...PAGE_ONE_INITIAL_INVENTORY};for(const kind of recipe)after[kind]--;
  assert.equal(state.phase,'continued');assert.equal(state.canCommit,false);assert.deepEqual(state.phrase,[]);assert.equal(state.routeId,route);
  assert.deepEqual(state.receipt,{recipe,inventoryBefore:{...PAGE_ONE_INITIAL_INVENTORY},inventoryAfterConsumption:after,received:[...PAGE_TWO_GRANT],inventoryAfterEntry:state.inventory});
  for(const kind of PAGE_TWO_GRANT)after[kind]++;
  assert.deepEqual(state.inventory,after);assert.deepEqual(state.availableInventory,after);assert.equal(totalUnits(state.inventory),24);
  assert.deepEqual(state.creditedStages,[2]);assert.deepEqual(state.nextScene,PAGE_ONE_ROUTES[route]);
  assert.equal(game.commit(),false);assert.equal(game.add('quarter'),false);assert.equal(game.remove(0),false);assert.equal(game.move(0,1),false);
  assert.deepEqual(game.state,state);
  state.receipt.received.push('half');state.receipt.inventoryAfterEntry.half=99;state.nextScene.id='wrong';
  assert.deepEqual(game.state.inventory,after);assert.equal(game.state.receipt.received.length,3);assert.equal(game.state.nextScene.id,PAGE_ONE_ROUTES[route].id);
 }
});

test('undo and restart cannot farm parcels while local discoveries remain available',()=>{
 const game=createStoryGame();let committed;
 for(let pass=0;pass<5;pass++){
  fill(game,canal);assert.equal(game.commit(),true);committed??=game.state;assert.deepEqual(game.state,committed);
  assert.equal(game.undo(),true);assert.deepEqual(game.state.inventory,PAGE_ONE_INITIAL_INVENTORY);assert.deepEqual(game.state.creditedStages,[]);assert.equal(game.state.receipt,null);assert.equal(game.state.routeId,null);assert.deepEqual(game.state.phrase,[]);
 }
 fill(game,garden);game.commit();game.restart();
 assert.deepEqual(game.state.inventory,PAGE_ONE_INITIAL_INVENTORY);assert.deepEqual(game.state.discoveredRoutes,['garden','canal']);assert.deepEqual(game.state.creditedStages,[]);
 fill(game,workshop);game.restart();assert.deepEqual(game.state.phrase,[]);assert.deepEqual(game.state.discoveredRoutes,['garden','canal']);
});

test('saving partial and committed answers reconstructs exact stock and grants without trusting cached resources',()=>{
 const game=createStoryGame();fill(game,['dotted-half','eighth']);let saved=JSON.parse(JSON.stringify(game.serialize()));
 assert.deepEqual(createStoryGame({saved}).state,game.state);saved.phrase.push('quarter');assert.deepEqual(game.state.phrase,['dotted-half','eighth']);
 game.add('sixteenth-pair');game.commit();saved=JSON.parse(JSON.stringify(game.serialize()));
 saved.inventory={quarter:999};saved.receipt={received:Array(100).fill('half')};saved.routeId='garden';saved.creditedStages=[2,2,2];
 const restored=createStoryGame({saved});assert.deepEqual(restored.state,game.state);assert.equal(restored.commit(),false);
 const restoredSave=restored.serialize();restoredSave.answer[0]='quarter';restoredSave.discoveredRoutes.push('garden');assert.deepEqual(restored.state,game.state);
 restored.undo();fill(restored,workshop);restored.commit();assert.deepEqual(restored.state.discoveredRoutes,['workshop','canal']);
 assert.equal(createStoryGame({saved:{version:1,answer:canal,phrase:[],discoveredRoutes:[]}}).state.discoveredRoutes[0],'canal');
});

test('malformed saves cannot create excess resources, partial committed answers or staged notes after arrival',()=>{
 const invalid=[null,{},'bad',{version:2,answer:canal,phrase:[],discoveredRoutes:['garden']},
  {version:1,answer:['half','half'],phrase:[]},{version:1,answer:['quarter'],phrase:[]},
  {version:1,answer:['dotted-half','quarter','eighth'],phrase:[]},{version:1,answer:canal,phrase:['quarter']},
  {version:1,answer:canal,phrase:null},{version:1,answer:null,phrase:['quarter','quarter']},
  {version:1,answer:null,phrase:['dotted-half','half']},{version:1,answer:null,phrase:['constructor']},
  {version:1,answer:null,phrase:['unknown']},{version:1,answer:undefined,phrase:['quarter']}];
 for(const saved of invalid){const game=createStoryGame({saved});assert.equal(game.state.phase,'room');assert.deepEqual(game.state.inventory,PAGE_ONE_INITIAL_INVENTORY);assert.deepEqual(game.state.phrase,[]);assert.deepEqual(game.state.creditedStages,[]);}
 const known=createStoryGame({saved:{version:1,answer:['quarter','quarter'],phrase:[],discoveredRoutes:['garden','garden','unknown','constructor',{},'canal']}});
 assert.deepEqual(known.state.discoveredRoutes,['garden','canal']);assert.deepEqual(known.state.inventory,PAGE_ONE_INITIAL_INVENTORY);
});

test('every affordable four-beat ordering has a deterministic destination and conserves its typed inventory',()=>{
 const routes=new Set(),counts={garden:0,workshop:0,canal:0};let answers=0;
 function visit(recipe,remaining,beatUnits){
  if(beatUnits===8){const game=createStoryGame();fill(game,recipe);assert.equal(game.commit(),true);const state=game.state;
   const expected=NOTE_KIND_BY_ID[recipe[0]].rest?'garden':recipe.filter(kind=>['eighth-pair','sixteenth-group','sixteenth-pair'].includes(kind)).length>=2?'workshop':'canal';
   assert.equal(state.routeId,expected);assert.equal(totalUnits(state.receipt.inventoryAfterConsumption),16);assert.equal(totalUnits(state.inventory),24);assert(Object.values(state.inventory).every(count=>Number.isSafeInteger(count)&&count>=0));
   routes.add(state.routeId);counts[state.routeId]++;answers++;return;
  }
  for(const kind of remaining){const value=NOTE_KIND_BY_ID[kind].units;if(beatUnits+value<=8)visit([...recipe,kind],remaining.filter(other=>other!==kind),beatUnits+value);}
 }
 visit([],Object.keys(PAGE_ONE_INITIAL_INVENTORY),0);assert.equal(answers,784);assert.deepEqual(routes,new Set(['garden','workshop','canal']));assert(Object.values(counts).every(count=>count>0));
});
