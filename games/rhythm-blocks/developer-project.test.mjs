import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultProject,validateProject,normalizeProject,createProjectManifest,getProjectDoor,getPersonReplies,upgradeLegacyProject} from './developer-project.mjs';
import {CHAPTER_ROOMS,CHAPTER_DOORS,CHAPTER_SOURCES} from './chapter.mjs';
import {ROOM_CONTENT} from './chapter-content.mjs';
import {createJourney,CHAPTER_JOURNEY_MANIFEST} from './journey.mjs';

const valid=project=>{const result=validateProject(project);assert.equal(result.valid,true,result.errors.join('\n'));return result;};
const invalid=(project,fragment)=>{const result=validateProject(project);assert.equal(result.valid,false);assert(result.errors.some(error=>error.includes(fragment)),JSON.stringify(result));return result;};
const person=(project,room,id)=>project.content[room].people.find(value=>value.id===id);
const clone=value=>JSON.parse(JSON.stringify(value));
function legacyProject(){
 const project=createDefaultProject(),roomIds=['depot','garden-porch','workshop-porch','canal-porch'];
 const pick=(entries,ids)=>Object.fromEntries(ids.map(id=>[id,entries[id]]));
 project.rooms=pick(project.rooms,roomIds);project.content=pick(project.content,roomIds);project.scenes=pick(project.scenes,roomIds);
 project.doors=Object.fromEntries(Object.entries(project.doors).filter(([,door])=>roomIds.includes(door.from)));
 project.sources=Object.fromEntries(Object.entries(project.sources).filter(([,source])=>roomIds.includes(source.roomId)));
 project.terminals=pick(project.terminals,['dead-brambles','dead-aviary','dead-ferry']);
 project.previews=Object.fromEntries(['garden-fork','workshop-fork','canal-fork'].map(id=>[id,{id,title:CHAPTER_ROOMS[id].title,stage:3,kind:'preview'}]));
 delete project.settings.terminalRooms;delete project.settings.completionReady;
 return project;
}

test('the portable default includes the complete shipped data and creates no edits or warnings',()=>{
 const project=createDefaultProject(),result=valid(project);
 assert.deepEqual(result.warnings,[]);
 assert.deepEqual(project.rooms,CHAPTER_ROOMS);assert.equal(Object.keys(project.rooms).length,14);
 assert.equal(Object.keys(project.content).length,23);assert.equal(Object.keys(project.scenes).length,23);
 assert.equal(project.settings.terminalRooms,true);assert.equal(project.settings.completionReady,true);
 assert.deepEqual(project.doors,CHAPTER_DOORS);assert.deepEqual(project.sources,CHAPTER_SOURCES);
 assert.deepEqual(project.content.depot.people.map(value=>value.id),['nell','iris','pip']);
 assert.deepEqual(project.content['canal-porch'].people.map(value=>value.id),['nell','iris','pip','oren']);
 assert.equal(project.settings.castImage,'assets/party-cast.webp');assert.equal(project.player.image,'assets/mira-walk.webp');
 const again=createDefaultProject();project.content.depot.people[0].story='changed';project.doors.garden.recipe.reverse();
 assert.notEqual(again.content.depot.people[0].story,'changed');
 assert.equal(ROOM_CONTENT.depot.people[0].story,again.content.depot.people[0].story);
 assert.deepEqual(CHAPTER_DOORS.garden.recipe,['half-rest','half']);
});

test('normalization derives note timing, fills omitted stock and preserves extra authored JSON',()=>{
 const project=createDefaultProject();
 project.noteKinds[0].units=3;project.noteKinds[0].beats=999;
 project.settings.initialInventory={quarter:37};project.authorNotes={plot:['Something new'],enabled:true};
 const normalized=normalizeProject(project);
 assert.equal(normalized.noteKinds[0].beats,1.5);assert.equal(normalized.settings.initialInventory.quarter,37);
 assert.equal(normalized.settings.initialInventory.half,0);assert.deepEqual(normalized.authorNotes,project.authorNotes);
 assert(Object.isFrozen(normalized));assert(Object.isFrozen(normalized.content.depot.people[0]));assert(Object.isFrozen(normalized.authorNotes.plot));
 project.authorNotes.plot[0]='edited later';assert.equal(normalized.authorNotes.plot[0],'Something new');
 assert.throws(()=>{normalized.content.depot.people[0].story='mutate';},TypeError);
});

test('legacy draft and applied projects gain the campaign while preserving existing authored edits',()=>{
 const old=legacyProject();old.settings.bpm=137;old.settings.initialInventory.quarter=7;
 old.noteKinds[0].units=3;old.rooms.depot.title='My station';old.previews['garden-fork'].title='My glasshouse';
 old.doors.garden.recipe=['quarter'];old.sources['nell-parcel'].recipe=['half','half'];
 old.content.depot.people[0].replies=[{id:'question',label:'My own question',text:'My own answer'}];
 old.content.depot.people[1].replies=[];old.content['garden-porch'].inspections[0].text='My garden inscription';
 old.scenes.depot.image='assets/my-station.webp';old.scenes.depot.geometry.speed=321;old.authorNotes={story:'Keep this.'};
 const before=clone(old),upgraded=upgradeLegacyProject(old),normalized=normalizeProject(JSON.parse(JSON.stringify(old)));
 assert.deepEqual(old,before,'migration must not mutate a stored draft');
 assert.equal(Object.keys(upgraded.rooms).length,14);assert.equal(Object.keys(upgraded.content).length,23);assert.equal(Object.keys(upgraded.scenes).length,23);
 assert.equal(Object.keys(upgraded.doors).length,22);assert.equal(Object.keys(upgraded.sources).length,7);assert.equal(Object.keys(upgraded.terminals).length,9);
 assert.deepEqual(upgraded.previews,{});assert.equal(upgraded.settings.terminalRooms,true);assert.equal(upgraded.settings.completionReady,true);
 for(const key of ['rooms','doors','sources','content','scenes'])for(const id of Object.keys(old[key]))assert.deepEqual(upgraded[key][id],old[key][id],`${key}.${id}`);
 assert.equal(normalized.rooms['garden-fork'].title,'My glasshouse');assert.equal(normalized.content['garden-fork'].title,'My glasshouse');
 assert.equal(normalized.noteKinds[0].beats,1.5);assert.equal(normalized.settings.initialInventory.quarter,7);assert.equal(normalized.settings.bpm,137);
 assert.deepEqual(normalized.authorNotes,old.authorNotes);assert.deepEqual(getPersonReplies(person(normalized,'depot','iris')),[]);
 assert.equal(normalized.sources['garden-hidden-notes'].type,'hidden');
 assert.equal(normalized.content['garden-alcove'].inspections.filter(entry=>entry.sourceId==='garden-hidden-notes').length,1);
 assert.equal(normalized.scenes['workshop-alcove'].objects.filter(entry=>entry.sourceId==='workshop-hidden-notes').length,1);
 assert.deepEqual(upgradeLegacyProject(upgraded),upgraded,'migration must be idempotent');
 assert.deepEqual(normalizeProject(normalized),normalized);
});

test('migration leaves unrelated custom projects and invalid JSON intact for normal validation',()=>{
 const custom=legacyProject();delete custom.previews['garden-fork'];custom.settings.completionReady=false;
 assert.deepEqual(upgradeLegacyProject(custom),custom);assert.equal(Object.keys(upgradeLegacyProject(custom).rooms).length,4);
 const full=createDefaultProject();full.settings.terminalRooms=false;full.settings.completionReady=false;
 assert.deepEqual(upgradeLegacyProject(full),full);
 const poisoned=legacyProject();Object.defineProperty(poisoned.settings,'bpm',{enumerable:true,get(){throw Error('must not invoke');}});
 assert.throws(()=>upgradeLegacyProject(poisoned),/accessors are not JSON/);
});

test('walkable outcomes need authored scenes and dialogue and can be selected as developer starting rooms',()=>{
 const project=createDefaultProject();project.settings.startRoomId='ending-home';valid(project);
 assert.equal(normalizeProject(project).settings.startRoomId,'ending-home');
 delete project.scenes['ending-home'];invalid(project,'scenes.ending-home');
 project.scenes['ending-home']=createDefaultProject().scenes['ending-home'];delete project.content['ending-home'];invalid(project,'content.ending-home');
 const disabled=createDefaultProject();disabled.settings.terminalRooms=false;disabled.settings.startRoomId='ending-home';invalid(disabled,'settings.startRoomId');
 disabled.settings.terminalRooms='yes';invalid(disabled,'settings.terminalRooms');
});

test('hidden inspection sources and door reveal conditions are checked against the authored local bindings',()=>{
 const project=createDefaultProject(),room='garden-alcove';valid(project);
 const entry=project.content[room].inspections.find(entry=>entry.sourceId),object=project.scenes[room].objects.find(object=>object.sourceId);
 entry.sourceId='workshop-hidden-notes';invalid(project,'hidden note source in this room');
 entry.sourceId='garden-hidden-notes';object.sourceId='iris-gift';invalid(project,'matching local source');
 object.sourceId='garden-hidden-notes';project.doors['garden-hidden-exit'].revealAfter='missing-cache';invalid(project,'revealAfter');
 project.doors['garden-hidden-exit'].revealAfter='garden-hidden-notes';project.sources['garden-hidden-notes'].type='spell';invalid(project,'npc, chest or hidden');
 const unbound=createDefaultProject();delete unbound.scenes[room].objects.find(object=>object.sourceId).sourceId;
 assert(valid(unbound).warnings.some(warning=>warning.includes('matching inspection')));
});

test('default and authored manifests describe the same released discoveries while custom completion remains explicit',()=>{
 const manifest=createProjectManifest(normalizeProject(createDefaultProject()));
 assert.deepEqual(manifest,CHAPTER_JOURNEY_MANIFEST);
 const project=createDefaultProject();delete project.settings.completionReady;
 assert.equal(createProjectManifest(normalizeProject(project)).completionReady,false);
 project.settings.completionReady='yes';invalid(project,'settings.completionReady');
});

test('arbitrary ordered lock answers and source quantities do not retain the four-beat constraint',()=>{
 const project=createDefaultProject();project.doors.garden.recipe=Array(12).fill('quarter');
 project.sources['nell-parcel'].recipe=Array(128).fill('quarter');
 valid(project);assert.equal(normalizeProject(project).doors.garden.recipe.length,12);
 project.doors.garden.recipe=[];invalid(project,'at least one');
 project.doors.garden.recipe=Array(33).fill('quarter');invalid(project,'at most 32');
 project.doors.garden.recipe=['not-a-note'];invalid(project,'known note');
 project.doors.garden.recipe=['quarter'];project.sources['nell-parcel'].recipe=Array(129).fill('quarter');invalid(project,'at most 128');
});

test('notes keep known engraving IDs while allowing authored labels, colors and musical timing',()=>{
 const project=createDefaultProject(),note=project.noteKinds.find(value=>value.id==='eighth');
 Object.assign(note,{label:'A strange chime',shortName:'Chime',units:5,rest:true,subdivisions:2,color:'#abcdef',symbol:'half'});
 assert(valid(project).warnings.some(warning=>warning.includes('conventional')));
 const normalized=normalizeProject(project);assert.equal(normalized.noteKinds.find(value=>value.id==='eighth').beats,2.5);
 note.color='red; background:url(https://example.com)';invalid(project,'hex color');
 note.color='#abcdef';note.id='custom-engraving';invalid(project,'engraved note ID');
});

test('clearing a gift is a warning while assigning it to another resident is atomic and room checked',()=>{
 const project=createDefaultProject(),giver=person(project,'garden-porch','iris');
 delete giver.sourceId;delete giver.sourceLabel;delete project.scenes['garden-porch'].objects.find(value=>value.id==='iris').sourceId;
 assert(valid(project).warnings.some(warning=>warning.includes('no local person')));
 const nell=person(project,'garden-porch','nell');nell.sourceId='iris-gift';nell.sourceLabel='Take the phrase';
 project.sources['iris-gift'].character='nell';project.scenes['garden-porch'].objects.find(value=>value.id==='nell').sourceId='iris-gift';
 valid(project);assert.equal(normalizeProject(project).sources['iris-gift'].character,'nell');
 nell.sourceId='pip-gift';invalid(project,'this person');
});

test('an intentionally empty note source or unaffordable draft lock warns rather than blocking authoring',()=>{
 const project=createDefaultProject();project.sources['iris-gift'].recipe=[];project.doors.garden.recipe=Array(32).fill('dotted-half');
 const result=valid(project);assert(result.warnings.some(warning=>warning.includes('without giving notes')));
 assert(result.warnings.some(warning=>warning.includes('more of a note kind')));
});

test('advanced JSON can add playable rooms and connections without exposing them in the discovered journal',()=>{
 const project=createDefaultProject();
 project.rooms['quiet-room']={id:'quiet-room',title:'The Quiet Room',stage:2,sources:[],doors:[]};
 project.content['quiet-room']={title:'The Quiet Room',arrival:'A new stop.',people:[],inspections:[],doorCopy:{}};
 project.scenes['quiet-room']={id:'quiet-room',title:'The Quiet Room',image:'assets/garden-porch.webp',actors:[],objects:[],occluders:[],geometry:{width:512,height:512,gridSize:32,radius:12,speed:260,maxDeltaMs:50,bounds:{x:0,y:0,width:512,height:512},start:{x:256,y:256,facing:'up'},obstacles:[],targets:[]}};
 project.doors.garden.to='quiet-room';
 assert(valid(project).warnings.some(warning=>warning.includes('rooms.garden-porch')));
 const manifest=createProjectManifest(normalizeProject(project)),journey=createJourney({manifest});
 journey.visit('depot');assert.deepEqual(journey.state.nodes.map(node=>node.id),['depot']);
 assert(journey.traverse('depot-garden'));assert.deepEqual(journey.state.nodes.map(node=>node.id),['depot','quiet-room']);
 assert.equal(journey.state.outcomes.length,0);assert.equal(journey.complete,false);
});

test('the authored manifest uses edited literal text and preserves every shipped discovery ID',()=>{
 const project=createDefaultProject(),nell=person(project,'depot','nell');
 const literal='<img src=x onerror="alert(1)"> & a story';nell.route=literal;nell.name='New Nell';
 project.content.depot.inspections[0].text='A changed observation';project.rooms.depot.title='My station';
 const manifest=createProjectManifest(normalizeProject(project));
 assert.equal(manifest.nodes.find(node=>node.id==='depot').title,'My station');
 assert.equal(manifest.hints.find(hint=>hint.id==='nell-route').text,literal);
 assert.equal(manifest.hints.find(hint=>hint.id==='lore-returned-letter').text,'A changed observation');
 assert.equal(manifest.hints.length,141);assert.equal(manifest.nodes.length,23);assert.equal(manifest.edges.length,22);
 assert.equal(manifest.outcomes.length,9);assert.equal(manifest.completionReady,true);
 nell.route='';project.content.depot.inspections[0].text='';
 const cleared=createProjectManifest(normalizeProject(project));assert(!cleared.hints.some(hint=>hint.id==='nell-route'));
 assert(!cleared.hints.some(hint=>hint.id==='lore-returned-letter'));
});

test('door aliases remain unique and every destination/source/room reference is checked',()=>{
 const project=createDefaultProject();assert.equal(getProjectDoor(project,'garden'),project.doors.garden);
 assert.equal(getProjectDoor(project,'depot-garden'),project.doors.garden);
 assert.equal(getProjectDoor(project,'__proto__'),null);assert.equal(getProjectDoor(project,'constructor'),null);
 project.doors.garden.canonicalId='workshop';invalid(project,'unambiguous');
 project.doors.garden.canonicalId='depot-garden';project.previews.depot={...project.previews['garden-fork'],id:'depot'};invalid(project,'only one');
 delete project.previews.depot;project.doors.garden.to='missing-room';invalid(project,'existing room');
 project.doors.garden.to='garden-porch';project.rooms.depot.sources.push('canal-chest');invalid(project,'belonging to this room');
});

test('safe JSON rejects code, getters, prototype keys, nonfinite numbers and circular/sparse data',()=>{
 for(const mutate of [
  p=>{p.extra=()=>{};},p=>{p.extra=Infinity;},p=>{p.extra=new Date();},p=>{p.extra=p;},
  p=>{p.extra=Object.create({inherited:true});},p=>{p.extra=Array(2);},p=>{p.extra={[Symbol('x')]:1};},
  p=>{p.extra=[];p.extra.additional='not JSON';},p=>Object.defineProperty(p,'extra',{enumerable:true,get(){throw new Error('must not invoke');}}),
 ]){const project=createDefaultProject();mutate(project);assert.equal(validateProject(project).valid,false);}
 const poisoned=JSON.parse(JSON.stringify(createDefaultProject()).replace('"schemaVersion":1','"__proto__":{"polluted":true},"schemaVersion":1'));
 invalid(poisoned,'reserved object key');assert.equal({}.polluted,undefined);
 assert.throws(()=>normalizeProject(poisoned),TypeError);
});

test('selectors, artwork URLs, colors and silhouette shapes reject executable or ambiguous input',()=>{
 const mutateCases=[
  [p=>{p.content.depot.people[0].id='nell"] [x';},'start with a letter'],
  [p=>{p.scenes.depot.image='javascript:alert(1)';},'artwork'],
  [p=>{p.settings.castImage='data:image/svg+xml;base64,PHN2Zy8+';},'artwork'],
  [p=>{p.player.image='https://name:password@example.com/sheet.png';},'credentials'],
  [p=>{p.scenes.depot.occluders[0].clipPath='url(https://example.com/mask.svg)';},'CSS shape'],
  [p=>{p.cast.nell.anchor=[.5,2];},'from 0 to 1'],
  [p=>{p.player.directions=['up','up','left','right'];},'once each'],
 ];
 for(const [mutate,error]of mutateCases){const project=createDefaultProject();mutate(project);invalid(project,error);}
 const project=createDefaultProject();project.scenes.depot.image='https://example.com/room.webp';project.player.image='data:image/png;base64,AAAA';valid(project);
});

test('missing actors, mismatched interactions and invalid walking geometry block applying a project',()=>{
 const project=createDefaultProject();project.scenes.depot.actors.pop();invalid(project,'visible foreground actor');
 const other=createDefaultProject();other.scenes.depot.objects.pop();invalid(other,'exactly match');
 const noFloor=createDefaultProject();noFloor.scenes.depot.geometry.bounds.width=-20;invalid(noFloor,'bounds.width');
 const blocked=createDefaultProject();blocked.scenes.depot.geometry.obstacles=[{x:0,y:0,width:1536,height:1024}];invalid(blocked,'no walkable floor');
});

test('blocked interaction approaches remain editable with a concrete reachability warning',()=>{
 const project=createDefaultProject(),target=project.scenes.depot.geometry.targets.find(value=>value.id==='garden');
 target.approach={x:1480,y:260};target.x=0;target.y=0;target.range=1;
 assert(valid(project).warnings.some(warning=>warning.includes('targets.garden')));
});

test('malformed nested structures return validation errors rather than throwing during reference checks',()=>{
 const paths=[['settings'],['noteKinds'],['rooms','depot','doors'],['rooms','depot','sources'],['content','depot','people'],['content','depot','inspections'],['content','depot','doorCopy'],['scenes','depot','geometry'],['scenes','depot','geometry','targets'],['scenes','depot','objects'],['scenes','depot','actors'],['player','anchors'],['cast','nell']];
 for(const path of paths)for(const value of [null,7,'wrong',{},[null]]){
  const project=createDefaultProject();let owner=project;for(const key of path.slice(0,-1))owner=owner[key];owner[path.at(-1)]=value;
  assert.doesNotThrow(()=>validateProject(project),path.join('.'));assert.equal(validateProject(project).valid,false,path.join('.'));
 }
});


test('explicit replies can replace, add or remove every legacy choice without restoring deleted choices',()=>{
 const project=createDefaultProject(),nell=person(project,'depot','nell');
 const legacy=getPersonReplies(nell);assert.deepEqual(legacy.map(reply=>reply.id),['story','route','inventory']);
 assert.equal(legacy[1].text,nell.route);assert.deepEqual(legacy[1].demo,nell.demo);
 assert.equal(nell.replies,undefined);legacy[0].text='detached virtual text';assert.notEqual(nell.story,'detached virtual text');
 nell.intro='Ask me anything.';nell.replies=[{id:'parcel_origin',label:'Where did it come from?',text:'A new authored answer.'},{id:'route',label:'Hear the door',text:'My changed route clue',demo:['half-rest','half']}];
 for(const field of ['story','route','inventory','demo'])delete nell[field];
 valid(project);assert.equal(getPersonReplies(nell),nell.replies);
 const normalized=normalizeProject(project);assert(Object.isFrozen(normalized.content.depot.people[0].replies[0]));
 assert.equal(createProjectManifest(normalized).hints.find(hint=>hint.id==='nell-route').text,'My changed route clue');
 nell.replies.splice(1,1);valid(project);assert(!createProjectManifest(normalizeProject(project)).hints.some(hint=>hint.id==='nell-route'));
 nell.replies=[];valid(project);assert.deepEqual(getPersonReplies(nell),[]);assert.equal(normalizeProject(project).content.depot.people[0].intro,'Ask me anything.');
});

test('reply IDs, labels, demos and JSON round trips are validated without rejecting literal text',()=>{
 const project=createDefaultProject(),nell=person(project,'depot','nell');
 nell.replies=[{id:'lore',label:'<b>Ask about the bell</b>',text:'<script>literal text</script>',demo:[]}];
 const restored=normalizeProject(JSON.parse(JSON.stringify(project)));
 assert.deepEqual(getPersonReplies(restored.content.depot.people[0]),nell.replies);
 for(const mutate of [
  reply=>{reply.id='bad id';},reply=>{reply.id='x'.repeat(65);},reply=>{reply.label='';},reply=>{reply.demo=['unknown'];},reply=>{reply.text=7;},
 ]){const copy=createDefaultProject();person(copy,'depot','nell').replies=[{...nell.replies[0]}];mutate(person(copy,'depot','nell').replies[0]);invalid(copy,'replies');}
 nell.replies.push({...nell.replies[0]});invalid(project,'duplicate ID');
 nell.replies=Array.from({length:65},(_,index)=>({id:'reply'+index,label:'Ask',text:''}));invalid(project,'at most 64');
 nell.replies={};invalid(project,'replies');
});

test('several simultaneous malformed edits still return concrete errors rather than throwing',()=>{
 const project=createDefaultProject();project.content.depot.people=[null];project.scenes.depot.objects=[null];
 project.sources['nell-parcel'].character=undefined;
 assert.doesNotThrow(()=>validateProject(project));assert.equal(validateProject(project).valid,false);
 const other=createDefaultProject();other.content.depot.people=[null];other.scenes.depot.objects=[null];delete other.sources['nell-parcel'].character;
 assert.doesNotThrow(()=>validateProject(other));assert.equal(validateProject(other).valid,false);
});

test('room introductions are portable authored data and leave the economy and journal catalog unchanged',()=>{
 const project=createDefaultProject(),before={doors:clone(project.doors),sources:clone(project.sources),inventory:clone(project.settings.initialInventory),manifest:createProjectManifest(project)};
 assert.equal(Object.values(project.content).filter(room=>room.cutscene?.length).length,23);
 for(const [roomId,content]of Object.entries(project.content)){
  assert.equal(content.cutscene.length,4,roomId);assert(content.cutscene.some(beat=>beat.emote==='idea'));assert(content.cutscene.some(beat=>beat.emote==='question'));
 }
 project.content.depot.cutscene=[{id:'opening-line',speaker:'mira',actor:'pip',text:'<b>A literal thought.</b>',startTile:7,durationTiles:12,target:'clockwork-roost',action:'listen',emote:'idea'},{id:'silent-search',actor:'iris',destination:{x:950,y:840},startTile:22,durationTiles:5,action:'search',emote:'question'}];
 const restored=normalizeProject(JSON.parse(JSON.stringify(project)));valid(restored);
 assert.deepEqual(restored.content.depot.cutscene,project.content.depot.cutscene);assert(Object.isFrozen(restored.content.depot.cutscene[0]));
 assert.deepEqual(restored.doors,before.doors);assert.deepEqual(restored.sources,before.sources);assert.deepEqual(restored.settings.initialInventory,before.inventory);assert.deepEqual(createProjectManifest(restored),before.manifest);
 project.content.depot.cutscene[0].text='A later edit';assert.equal(restored.content.depot.cutscene[0].text,'<b>A literal thought.</b>');
});

test('older projects receive only missing room introductions and preserve intentionally disabled or edited scenes',()=>{
 const project=createDefaultProject(),before=clone(project);
 for(const content of Object.values(project.content))delete content.cutscene;
 project.content.depot.cutscene=[];
 project.content['garden-porch'].cutscene=[{speaker:'mira',text:'My own entrance line.',emote:'happy'}];
 project.content['workshop-porch'].people[0].intro='Keep my NPC edits.';
 const source=clone(project),restored=normalizeProject(project);
 assert.deepEqual(project,source,'normalizing must not edit the imported snapshot');
 assert.deepEqual(restored.content.depot.cutscene,[]);assert.deepEqual(restored.content['garden-porch'].cutscene,project.content['garden-porch'].cutscene);
 assert.equal(restored.content['workshop-porch'].people[0].intro,'Keep my NPC edits.');
 assert.deepEqual(restored.content['canal-porch'].cutscene,before.content['canal-porch'].cutscene);
 assert.deepEqual(restored.doors,before.doors);assert.deepEqual(restored.sources,before.sources);assert.deepEqual(normalizeProject(restored),restored);
 const old=legacyProject();for(const content of Object.values(old.content))delete content.cutscene;
 const expanded=normalizeProject(old);assert.equal(Object.values(expanded.content).filter(content=>content.cutscene.length).length,23);
});

test('missing legacy scene actors and renamed objects do not make introductory migration break custom projects',()=>{
 const project=createDefaultProject(),room='ending-home';delete project.content[room].cutscene;
 const nell=project.content[room].people.find(person=>person.id==='nell');nell.id='keeper';nell.name='My keeper';
 const scene=project.scenes[room];scene.actors.find(actor=>actor.id==='nell').id='keeper';scene.objects.find(item=>item.id==='nell').id='keeper';scene.geometry.targets.find(item=>item.id==='nell').id='keeper';scene.geometry.obstacles.find(item=>item.id==='nell').id='keeper';
 const oldTarget=scene.objects.find(item=>item.type==='inspect').id,newTarget='changed-object';scene.objects.find(item=>item.id===oldTarget).id=newTarget;scene.geometry.targets.find(item=>item.id===oldTarget).id=newTarget;project.content[room].inspections.find(item=>item.id===oldTarget).id=newTarget;
 const restored=normalizeProject(project);valid(restored);
 assert(!restored.content[room].cutscene.some(beat=>beat.speaker==='nell'||beat.actor==='nell'));
 assert(!restored.content[room].cutscene.some(beat=>beat.target===oldTarget));
 assert.equal(restored.content[room].people.find(person=>person.id==='keeper').name,'My keeper');
});

test('timeline times use integer walk tiles and validate local characters, destinations, actions and emotes',()=>{
 const badCases=[
  [beat=>{beat.startTile=.5;},'startTile'],[beat=>{beat.startTile=-1;},'startTile'],[beat=>{beat.durationTiles=0;},'durationTiles'],[beat=>{beat.durationTiles=2.5;},'durationTiles'],
  [beat=>{beat.speaker='visitor';},'speaker'],[beat=>{beat.actor='visitor';},'actor'],[beat=>{beat.emote='javascript';},'emote'],[beat=>{beat.action='claim-notes';},'action'],
  [beat=>{beat.text='x'.repeat(601);},'600'],[beat=>{beat.destination={x:1600,y:400};},'inside the room'],[beat=>{beat.destination={x:500,y:400};beat.target='clockwork-roost';},'either an object target'],
 ];
 for(const [mutate,error]of badCases){const project=createDefaultProject(),beat={speaker:'mira',text:'Look over there.'};mutate(beat);project.content.depot.cutscene=[beat];invalid(project,error);}
 const duplicate=createDefaultProject();duplicate.content.depot.cutscene=[{id:'same',speaker:'mira',text:'One.'},{id:'same',speaker:'pip',text:'Two.'}];invalid(duplicate,'unique within the room');
 const long=createDefaultProject();long.content.depot.cutscene=Array.from({length:33},()=>({speaker:'mira',text:'A line.'}));invalid(long,'at most 32');
 const blank=createDefaultProject();blank.content.depot.cutscene=[{speaker:'mira',text:''}];invalid(blank,'dialogue, movement');
 const silent=createDefaultProject();silent.content.depot.cutscene=[{actor:'mira',action:'look'}];valid(silent);
});

test('timeline authoring warns about missing props, blocked points and overlapping clips without losing the draft',()=>{
 const project=createDefaultProject();project.content.depot.cutscene=[{speaker:'mira',text:'A room can change.',target:'not-here',startTile:0,durationTiles:10},{actor:'mira',action:'search',destination:{x:0,y:0},startTile:3,durationTiles:2}];
 const warnings=valid(project).warnings;assert(warnings.some(message=>message.includes('object is missing')));assert(warnings.some(message=>message.includes('nearest reachable floor')));assert(warnings.some(message=>message.includes('overlapping clips')));
 assert.deepEqual(normalizeProject(project).content.depot.cutscene,project.content.depot.cutscene);
 for(const value of [null,7,'a scene',{},[null]]){const broken=createDefaultProject();broken.content.depot.cutscene=value;assert.doesNotThrow(()=>validateProject(broken));invalid(broken,'cutscene');}
});
