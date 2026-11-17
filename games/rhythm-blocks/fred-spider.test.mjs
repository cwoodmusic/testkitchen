import test from 'node:test';
import assert from 'node:assert/strict';
import {addFredSpider,FRED_SPIDER_ID,FRED_SPIDER_ROOM} from './fred-spider.mjs';
import {createDefaultProject,createProjectManifest,validateProject} from './developer-project.mjs';
import {createRoomWalker,isWalkable} from './room.mjs';
import {createJourney} from './journey.mjs';

const clone=value=>JSON.parse(JSON.stringify(value));
function stockWithoutFred(){
 const project=createDefaultProject(),scene=project.scenes[FRED_SPIDER_ROOM];
 delete scene.fredSpider;
 scene.objects=scene.objects.filter(entry=>entry.id!==FRED_SPIDER_ID);
 scene.geometry.targets=scene.geometry.targets.filter(entry=>entry.id!==FRED_SPIDER_ID);
 project.content[FRED_SPIDER_ROOM].inspections=project.content[FRED_SPIDER_ROOM].inspections.filter(entry=>entry.id!==FRED_SPIDER_ID);
 return project;
}
const entries=project=>[project.scenes[FRED_SPIDER_ROOM].objects,project.scenes[FRED_SPIDER_ROOM].geometry.targets,project.content[FRED_SPIDER_ROOM].inspections];

test('Fred is added once without mutating stock data or changing any puzzle resources',()=>{
 const stock=stockWithoutFred(),before=clone(stock),project=addFredSpider(stock);
 assert.deepEqual(stock,before);assert.notEqual(project,stock);
 assert.deepEqual(addFredSpider(project),project);
 for(const list of entries(project))assert.equal(list.filter(entry=>entry.id===FRED_SPIDER_ID).length,1);
 for(const key of ['settings','noteKinds','rooms','doors','sources','previews','terminals','cast','player'])assert.deepEqual(project[key],stock[key],key);
 for(const id of Object.keys(stock.scenes))if(id!==FRED_SPIDER_ROOM){assert.deepEqual(project.scenes[id],stock.scenes[id]);assert.deepEqual(project.content[id],stock.content[id]);}
 assert.deepEqual(project.scenes[FRED_SPIDER_ROOM].geometry.obstacles,stock.scenes[FRED_SPIDER_ROOM].geometry.obstacles);
 const inspection=entries(project)[2].find(entry=>entry.id===FRED_SPIDER_ID);
 assert.equal(inspection.dialogue.length,4);assert.match(inspection.title,/Fred the wolf spider/);
 assert.equal(inspection.sourceId,undefined);
 assert(entries(project).every(list=>!list.find(entry=>entry.id===FRED_SPIDER_ID).sourceId));
 const validation=validateProject(project);assert(validation.valid,validation.errors.join('\n'));
});

test('Fred and every existing attic interaction remain reachable around the actual furniture',()=>{
 const project=addFredSpider(stockWithoutFred()),room=project.scenes[FRED_SPIDER_ROOM].geometry;
 const fred=room.targets.find(target=>target.id===FRED_SPIDER_ID);
 assert(isWalkable(room,fred));assert(isWalkable(room,fred.approach));
 for(const target of room.targets){
  const walker=createRoomWalker({room});assert(walker.approach(target.id),target.id);
  let frames=0;while(walker.state.moving&&frames++<1000){walker.update(50);assert(isWalkable(room,walker.state),target.id);}
  assert(frames<1000,target.id);assert(walker.withinReach(target.id),target.id);
 }
});

test('custom art, room geometry, props, and explicit opt-outs are left unchanged',()=>{
 const changes=[
  scene=>{scene.image='assets/my-own-attic.webp';},
  scene=>{scene.geometry.bounds.width-=32;},
  scene=>{scene.geometry.obstacles[0].x+=1;},
  scene=>{scene.geometry.targets[0].approach.y+=1;},
  scene=>{scene.objects[0].rect.x+=1;},
  scene=>{scene.actors[0].feet.x+=1;},
  scene=>{scene.occluders[0].depth+=1;},
  scene=>{scene.fredSpider=false;},
  scene=>{scene.fredSpider=null;},
 ];
 for(const change of changes){const project=stockWithoutFred();change(project.scenes[FRED_SPIDER_ROOM]);assert.deepEqual(addFredSpider(project),project);}
 const missing=stockWithoutFred();delete missing.scenes[FRED_SPIDER_ROOM];assert.deepEqual(addFredSpider(missing),missing);
});

test('custom Fred wording, partial entries, and author removal are never repaired over',()=>{
 const custom=addFredSpider(stockWithoutFred());
 custom.content[FRED_SPIDER_ROOM].inspections.find(entry=>entry.id===FRED_SPIDER_ID).dialogue[0].text='Our own spider story.';
 assert.deepEqual(addFredSpider(custom),custom);
 for(let listIndex=0;listIndex<3;listIndex++){
  const partial=stockWithoutFred();entries(partial)[listIndex].push(clone(entries(custom)[listIndex].find(entry=>entry.id===FRED_SPIDER_ID)));
  assert.deepEqual(addFredSpider(partial),partial);
 }
 const removed=clone(custom);for(const list of entries(removed)){const index=list.findIndex(entry=>entry.id===FRED_SPIDER_ID);list.splice(index,1);}
 assert.deepEqual(addFredSpider(removed),removed,'The stored migration marker honors an author’s removal.');
});

test('the journal hides Fred until inspected and adds no chart path, ending, or achievement',()=>{
 const stock=stockWithoutFred(),before=createProjectManifest(stock),manifest=createProjectManifest(addFredSpider(stock));
 for(const key of ['nodes','edges','outcomes'])assert.deepEqual(manifest[key],before[key]);
 const journey=createJourney({manifest});journey.visit('depot');
 assert(!JSON.stringify(journey.state).includes('Fred'));
 journey.visit(FRED_SPIDER_ROOM);assert(!JSON.stringify(journey.state).includes('Fred'),'Merely entering the room is not discovery.');
 assert(journey.discoverHint('lore-'+FRED_SPIDER_ID));
 assert.match(journey.state.hints.find(entry=>entry.id==='lore-'+FRED_SPIDER_ID).title,/Fred/);
 assert.equal(journey.discoverHint('lore-'+FRED_SPIDER_ID),false);
 assert.deepEqual(journey.state.edges,[]);assert.deepEqual(journey.state.outcomes,[]);assert.deepEqual(journey.state.achievements,[]);
 const reloaded=createJourney({manifest,saved:journey.serialize()});assert.deepEqual(reloaded.state,journey.state);
});
