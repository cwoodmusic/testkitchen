import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultProject as createPreviousProject} from './releases/r-3637c019ce1e150e/developer-project.mjs';
import {createDefaultProject,normalizeProject,validateProject,createProjectManifest} from './developer-project.mjs';
import {upgradeReplayRiskProject,REPLAY_RISK_DETOURS} from './replay-risk-updates.mjs';
import {CAMPAIGN_SCENES} from './campaign-scenes.mjs';

const clone=value=>structuredClone(value);
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

test('the real previous stock graph gains paid south exits while authored speech and clocks stay intact',()=>{
 const previous=createPreviousProject();
 previous.settings.bpm=137;previous.rooms.depot.title='Our station';
 previous.content['dead-brambles'].people[0].story='My own woodland advice.';
 previous.content['dead-brambles'].cutscene[0].startTile+=4;
 previous.content['dead-brambles'].cutscene[0].durationTiles+=7;
 previous.content['dead-brambles'].cutscene[0].author={direction:'Keep this timing.'};
 previous.content['dead-brambles'].outcome.copy='My own old conclusion, retained in the project.';
 previous.scenes['dead-brambles'].objects.find(item=>item.id==='return-previous').label='My old return label';
 previous.authorNotes={version:'Do not replace my notes.'};
 const before=clone(previous),upgraded=upgradeReplayRiskProject(freeze(previous));
 assert.equal(upgraded.settings.replayRisk,true);
 assert.equal(Object.keys(upgraded.rooms).length,17);assert.equal(Object.keys(upgraded.doors).length,25);assert.equal(Object.keys(upgraded.terminals).length,6);
 assert.deepEqual(previous,before,'Imported and frozen project data are never modified.');
 for(const [roomId,gateId]of Object.entries(REPLAY_RISK_DETOURS)){
  assert(!upgraded.terminals[roomId]);assert.deepEqual(upgraded.rooms[roomId].doors,[gateId]);
  assert.equal(upgraded.scenes[roomId].kind,'room');
  const door=upgraded.scenes[roomId].objects.find(item=>item.id===gateId),target=upgraded.scenes[roomId].geometry.targets.find(item=>item.id===gateId);
  assert.deepEqual(door,CAMPAIGN_SCENES[roomId].objects.find(item=>item.id===gateId));
  assert.deepEqual(target,CAMPAIGN_SCENES[roomId].geometry.targets.find(item=>item.id===gateId));
  assert.equal(target.y,960,'The new payment is at the visible south threshold, not the blocked north wall.');
  assert(!upgraded.scenes[roomId].objects.some(item=>item.id==='return-previous'));
  assert(!upgraded.scenes[roomId].geometry.targets.some(item=>item.id==='return-previous'));
  assert.deepEqual(upgraded.scenes[roomId].geometry.obstacles,before.scenes[roomId].geometry.obstacles);
  assert.deepEqual(upgraded.scenes[roomId].actors,before.scenes[roomId].actors);
  assert.deepEqual(upgraded.scenes[roomId].occluders,before.scenes[roomId].occluders);
  assert.deepEqual(upgraded.content[roomId].cutscene,before.content[roomId].cutscene);
  assert.deepEqual(upgraded.content[roomId].outcome,before.content[roomId].outcome,'Old authored boundary prose stays portable even though the place is now a passage.');
  assert(upgraded.content[roomId].doorCopy[gateId]);
 }
 assert.equal(upgraded.content['dead-brambles'].people[0].story,'My own woodland advice.');
 assert.deepEqual(upgraded.sources,before.sources);assert.deepEqual(upgraded.noteKinds,before.noteKinds);assert.deepEqual(upgraded.authorNotes,before.authorNotes);
 assert.equal(upgraded.settings.bpm,137);assert.equal(upgraded.rooms.depot.title,'Our station');
 for(const id of Object.keys(before.rooms))assert.deepEqual(upgraded.rooms[id],before.rooms[id]);
 const result=validateProject(upgraded);assert(result.valid,result.errors.join('\n'));
 assert.deepEqual(upgradeReplayRiskProject(upgraded),upgraded,'A later load never re-adds an author’s removed gate.');
});

test('custom puzzles, initial stock, note timing, affected art and geometry keep their original rules',()=>{
 const edits=[
  project=>{project.doors.garden.recipe=['quarter'];},
  project=>{project.sources['iris-gift'].recipe=['quarter'];},
  project=>{project.settings.initialInventory.quarter=1;},
  project=>{project.settings.startRoomId='garden-porch';},
  project=>{project.settings.terminalRooms=false;},
  project=>{project.noteKinds[0].units=3;},
  project=>{project.scenes['dead-brambles'].image='assets/my-garden.webp';},
  project=>{project.scenes['dead-aviary'].geometry.speed=280;},
  project=>{project.scenes['dead-echo'].objects[0].rect.x+=1;},
  project=>{project.scenes['dead-echo'].geometry.targets[0].approach.y+=1;},
  project=>{project.scenes['dead-echo'].actors[0].feet.x+=1;},
  project=>{project.scenes['dead-echo'].occluders[0].depth+=1;},
 ];
 for(const edit of edits){const project=createPreviousProject();edit(project);assert.deepEqual(upgradeReplayRiskProject(project),project);}
 for(const replayRisk of [false,true,null]){
  const project=createPreviousProject();project.settings.replayRisk=replayRisk;
  assert.deepEqual(upgradeReplayRiskProject(project),project,'An explicit author policy is never inferred away.');
 }
});

test('normalization upgrades a prior stock save without replacing custom text, failure passages, or timing',()=>{
 const previous=createPreviousProject();
 previous.content['dead-brambles'].people[0].story='A different clue from our class.';
 previous.content['dead-brambles'].failure=null;
 previous.content['canal-final'].failure={title:'My title',copy:'Our class lost its notes.',lesson:'Save these words exactly.'};
 previous.content['dead-echo'].cutscene[0].startTile+=3;
 const before=clone(previous),loaded=normalizeProject(previous);
 assert.equal(loaded.settings.replayRisk,true);
 assert.equal(loaded.content['dead-brambles'].people[0].story,'A different clue from our class.');
 assert.equal(loaded.content['dead-brambles'].failure,null);
 assert.deepEqual(loaded.content['canal-final'].failure,before.content['canal-final'].failure);
 assert.equal(loaded.content['dead-echo'].cutscene[0].startTile,before.content['dead-echo'].cutscene[0].startTile);
 for(const room of Object.values(REPLAY_RISK_DETOURS))assert(loaded.doors[room]);
 assert(loaded.content['dead-aviary'].failure);
 assert.deepEqual(previous,before);assert.deepEqual(normalizeProject(loaded),loaded);
});

test('current stock with an absent policy receives the policy once; custom edits and opt-outs remain explicit',()=>{
 const project=createDefaultProject();delete project.settings.replayRisk;
 const upgraded=upgradeReplayRiskProject(project);assert.equal(upgraded.settings.replayRisk,true);
 const opted=createDefaultProject();opted.settings.replayRisk=false;
 assert.deepEqual(upgradeReplayRiskProject(opted),opted);
 const removed=createDefaultProject();delete removed.doors['echo-return-gate'];
 assert.deepEqual(upgradeReplayRiskProject(removed),removed);
});

test('failure lessons are optional hints and cannot add required rooms, routes, or outcomes',()=>{
 const enabled=createDefaultProject(),disabled=clone(enabled);disabled.settings.replayRisk=false;
 const risk=createProjectManifest(enabled),classic=createProjectManifest(disabled);
 for(const key of ['nodes','edges','outcomes'])assert.deepEqual(risk[key],classic[key]);
 const lessons=risk.hints.filter(hint=>hint.id.startsWith('lesson-'));
 assert.equal(lessons.length,6);assert(!classic.hints.some(hint=>hint.id.startsWith('lesson-')));
 enabled.content['dead-brambles'].failure=null;enabled.content['dead-aviary'].failure.lesson='';
 const changed=createProjectManifest(normalizeProject(enabled));
 assert(!changed.hints.some(hint=>hint.id==='lesson-dead-brambles'));
 assert(!changed.hints.some(hint=>hint.id==='lesson-dead-aviary'));
});

test('failure authoring validates its policy and optional literal text without silently replacing opt-outs',()=>{
 const project=createDefaultProject();
 project.content['canal-final'].failure={title:'A title',copy:'<b>Literal words.</b>',lesson:'My own clue.'};
 project.content['dead-brambles'].failure=null;
 const loaded=normalizeProject(project);assert.deepEqual(loaded.content['canal-final'].failure,project.content['canal-final'].failure);assert.equal(loaded.content['dead-brambles'].failure,null);
 for(const bad of ['yes',null,1]){const invalid=clone(project);invalid.settings.replayRisk=bad;assert(validateProject(invalid).errors.some(error=>error.startsWith('settings.replayRisk:')));}
 for(const bad of [42,[],{copy:42},{lesson:'x'.repeat(2001)}]){const invalid=clone(project);invalid.content['canal-final'].failure=bad;assert(validateProject(invalid).errors.some(error=>error.startsWith('content.canal-final.failure')));}
});

test('partial invalid JSON records remain the project validator’s responsibility',()=>{
 for(const project of [null,{}, {settings:{}},{settings:{},rooms:{depot:null},doors:{},sources:{},terminals:{}}])assert.deepEqual(upgradeReplayRiskProject(project),project);
});
