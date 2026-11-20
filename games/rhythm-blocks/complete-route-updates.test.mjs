import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultProject as createPreviousProject} from './releases/r-5ec9a7d731dc2778/developer-project.mjs';
import {createDefaultProject as createEarlierProject} from './releases/r-3637c019ce1e150e/developer-project.mjs';
import {createDefaultProject,normalizeProject,validateProject,createProjectManifest} from './developer-project.mjs';
import {upgradeCompleteRouteProject,withoutCompleteRoute,COMPLETE_ROUTE_LOCATIONS,COMPLETE_ROUTE_DOORS} from './complete-route-updates.mjs';
import {PRIOR_OUTCOME_IDS} from './final-route.mjs';

const clone=value=>structuredClone(value);
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const valid=project=>{const result=validateProject(project);assert(result.valid,result.errors.join('\n'));assert.deepEqual(result.warnings,[]);};

test('the actual preceding stock project gains only the new locations, keys, and depot threshold',()=>{
 const previous=createPreviousProject();
 previous.settings.bpm=137;previous.rooms.depot.title='Our post office';
 previous.content.depot.people[0].story='Our class wrote this explanation.';
 previous.content.depot.cutscene[0].startTile+=8;
 previous.content.depot.cutscene[0].author={note:'Keep our entrance timing.'};
 previous.scenes.depot.entry={gait:'run',fadeTiles:11,staggerTiles:4};
 previous.scenes.depot.objects[0].label='My own doorway label';
 previous.content['canal-final'].failure=null;
 previous.authorNotes={keep:['Every existing location and puzzle.']};
 const defaults=createDefaultProject(),before=clone(previous),upgraded=upgradeCompleteRouteProject(freeze(previous),defaults);
 assert.deepEqual(previous,before,'Stored and frozen authoring data are not mutated.');
 assert.equal(upgraded.settings.completeRoute,true);
 assert.equal(Object.keys(upgraded.rooms).length,19);assert.equal(Object.keys(upgraded.doors).length,28);assert.equal(Object.keys(upgraded.terminals).length,7);
 for(const id of COMPLETE_ROUTE_LOCATIONS){assert.deepEqual(upgraded.content[id],defaults.content[id]);assert.deepEqual(upgraded.scenes[id],defaults.scenes[id]);}
 for(const id of COMPLETE_ROUTE_DOORS)assert.deepEqual(upgraded.doors[id],defaults.doors[id]);
 assert.deepEqual(upgraded.doors['final-route'].requiresProgress,{outcomes:PRIOR_OUTCOME_IDS});
 const restored=withoutCompleteRoute(upgraded);assert.deepEqual(restored,before,'Removing only the extension reproduces every old authored field.');
 valid(upgraded);assert.deepEqual(upgradeCompleteRouteProject(upgraded,defaults),upgraded,'A marked project never re-adds an author’s later removals.');
});

test('normalization stages the replay-risk upgrade before adding the final route',()=>{
 for(const project of [createPreviousProject(),createEarlierProject()]){
  project.content.depot.people[0].story='Keep this authored story.';
  const before=clone(project),loaded=normalizeProject(project);
  assert.equal(loaded.settings.replayRisk,true);assert.equal(loaded.settings.completeRoute,true);
  assert.equal(loaded.content.depot.people[0].story,'Keep this authored story.');
  assert.equal(Object.keys(loaded.rooms).length,19);assert.equal(createProjectManifest(loaded).outcomes.length,12);
  assert(loaded.content['final-concourse'].narration);assert(loaded.content['final-heart'].cutscene.length);
  assert(loaded.content['final-heart'].cutscene.every(clip=>clip.kind));
  valid(loaded);assert.deepEqual(normalizeProject(loaded),loaded);assert.deepEqual(project,before);
 }
});

test('changed puzzles, supplies, note timing, depot art, and collision bindings remain authored',()=>{
 const edits=[
  p=>{p.doors.garden.recipe=['quarter'];},
  p=>{p.sources['nell-parcel'].recipe=['quarter'];},
  p=>{p.settings.initialInventory.quarter=1;},
  p=>{p.settings.startRoomId='garden-porch';},
  p=>{p.settings.terminalRooms=false;},
  p=>{p.settings.replayRisk=false;},
  p=>{p.noteKinds[0].units=3;},
  p=>{p.scenes.depot.image='assets/our-depot.webp';},
  p=>{p.scenes.depot.geometry.speed+=1;},
  p=>{p.scenes.depot.geometry.bounds.y+=1;},
  p=>{p.scenes.depot.geometry.obstacles[0].x+=1;},
  p=>{p.scenes.depot.geometry.targets[0].approach.y+=1;},
  p=>{p.scenes.depot.objects[0].rect.x+=1;},
  p=>{p.scenes.depot.actors[0].feet.x+=1;},
  p=>{p.scenes.depot.occluders[0].depth+=1;},
 ];
 const defaults=createDefaultProject();
 for(const edit of edits){const project=createPreviousProject();edit(project);assert.deepEqual(upgradeCompleteRouteProject(project,defaults),project);}
});

test('explicit author policies and partially authored final routes are never filled back in',()=>{
 const defaults=createDefaultProject();
 for(const completeRoute of [false,true,null]){const project=createPreviousProject();project.settings.completeRoute=completeRoute;assert.deepEqual(upgradeCompleteRouteProject(project,defaults),project);}
 for(const edit of [
  p=>{p.rooms['final-concourse']={id:'final-concourse',title:'My different room'};},
  p=>{p.scenes['ending-complete']={image:'assets/my-ending.webp'};},
  p=>{p.doors['heart-complete']={id:'heart-complete'};},
 ]){const project=createPreviousProject();edit(project);assert.deepEqual(upgradeCompleteRouteProject(project,defaults),project);}
 const current=createDefaultProject();delete current.doors['heart-complete'];
 assert.deepEqual(upgradeCompleteRouteProject(current,defaults),current);
 const missingDefaults=clone(defaults);delete missingDefaults.scenes['final-heart'];
 const previous=createPreviousProject();assert.deepEqual(upgradeCompleteRouteProject(previous,missingDefaults),previous);
});

test('classic custom projects retain their prior completion catalog',()=>{
 const classic=createPreviousProject();classic.settings.replayRisk=false;
 const loaded=normalizeProject(classic),manifest=createProjectManifest(loaded);
 assert.equal(Object.keys(loaded.rooms).length,17);assert.equal(manifest.outcomes.length,6);
 assert(!manifest.hints.some(hint=>hint.id==='final-route-open'));
 assert(!loaded.doors['final-route']);assert.deepEqual(loaded.sources,classic.sources);
});

test('partial invalid projects remain the normal schema validator’s responsibility',()=>{
 for(const project of [null,{}, {settings:{}},{settings:{replayRisk:true},rooms:{depot:null},doors:{},sources:{},terminals:{}}])assert.deepEqual(upgradeCompleteRouteProject(project,createDefaultProject()),project);
});
