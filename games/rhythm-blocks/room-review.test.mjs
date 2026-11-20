import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultProject,getPersonReplies,normalizeProject} from './developer-project.mjs';
import {getSceneDialogue} from './cutscene-dialogue.mjs';
import {STORY_INTRO_PARAGRAPHS} from './story-intro.mjs';
import {REVIEW_STORAGE_KEY,ROOM_REVIEW_TYPE,MAX_REVIEW_COMMENT_LENGTH,createRoomReviewCatalog,createRoomReview,normalizeRoomReview} from './room-review.mjs';

const project=normalizeProject(createDefaultProject()),catalog=createRoomReviewCatalog(project);
const lines=room=>room.sections.flatMap(section=>section.items);
const quoted=room=>new Set(lines(room).map(item=>item.text));
const fixture=()=>({schemaVersion:1,type:ROOM_REVIEW_TYPE,gameTitle:'The Quiet Bell',rooms:[]});
const first=catalog[0],firstItem=lines(first).find(item=>item.id.startsWith('scene/'));

test('the catalog covers all actual rooms, introductions, conversations, objects, locks and conclusions',()=>{
 assert.equal(catalog.length,26);
 assert.deepEqual(catalog.map(room=>room.id),[...Object.keys(project.rooms),...Object.keys(project.terminals)]);
 assert(Object.isFrozen(catalog));assert(Object.isFrozen(first.sections[0].items[0]));
 for(const room of catalog){
  const content=project.content[room.id],texts=quoted(room),items=lines(room);
  assert.equal(room.title,content.title);assert.equal(room.image,project.scenes[room.id].image);
  assert.deepEqual(room.scene,project.scenes[room.id]);assert.equal(new Set(items.map(item=>item.id)).size,items.length,room.id);
  for(const key of ['narration','arrival'])if(typeof content[key]==='string')assert(texts.has(content[key]),room.id+':'+key);
  assert.deepEqual(room.sections.find(section=>section.id==='scene')?.items.map(item=>item.text)??[],getSceneDialogue({scene:project.scenes[room.id],beats:content.cutscene}).map(line=>line.text));
  for(const person of content.people){
   if(typeof person.intro==='string')assert(texts.has(person.intro));
   for(const reply of getPersonReplies(person)){
    const item=items.find(item=>item.id===`characters/${person.id}/reply/${reply.id}`);
    assert.equal(item.text,reply.text);assert(item.label.includes(reply.label));assert.equal(item.speaker,person.id);
   }
  }
  for(const entry of content.inspections){assert(texts.has(entry.text));for(const line of entry.dialogue??[])assert(texts.has(line.text));}
  for(const door of Object.values(project.doors).filter(door=>door.from===room.id)){
   const copy=content.doorCopy[door.id]??content.doorCopy[door.canonicalId];
   for(const key of ['name','hint','warning','previewCopy','deadCopy','repair'])if(typeof copy?.[key]==='string')assert(texts.has(copy[key]),`${room.id}:${door.id}:${key}`);
  }
  for(const [source,keys]of [[content.outcome,['kicker','copy','repair']],[content.failure,['title','copy','lesson']]])for(const key of keys)if(typeof source?.[key]==='string')assert(texts.has(source[key]),room.id+':'+key);
 }
 for(const paragraph of STORY_INTRO_PARAGRAPHS)assert(quoted(first).has(paragraph));
 assert.equal(catalog.filter(room=>lines(room).some(item=>STORY_INTRO_PARAGRAPHS.includes(item.text))).length,1);
});

test('catalog creation leaves mutable authoring data untouched and reads explicit custom replies in source order',()=>{
 const custom=createDefaultProject();
 custom.content.depot.people[0].intro='A different opening.';
 custom.content.depot.people[0].replies=[{id:'my-question',label:'Did you hear that?',text:'I heard the return bell.'}];
 custom.content.depot.inspections[0].dialogue=[{id:'authored-line',speaker:'nell',text:'My inspection exchange.'}];
 const before=structuredClone(custom),view=createRoomReviewCatalog(custom),depot=view[0];
 assert.deepEqual(custom,before);assert.equal(Object.isFrozen(custom.scenes.depot),false);
 const character=lines(depot).filter(item=>item.id.startsWith('characters/nell/'));
 assert.equal(character.filter(item=>item.text==='A different opening.').length,1);
 assert(character.some(item=>item.label.includes('Did you hear that?')&&item.text==='I heard the return bell.'));
 assert(!character.some(item=>item.text===custom.content.depot.people[0].story),'Explicit replies replace the legacy reply list.');
 assert(lines(depot).some(item=>item.id.endsWith('/dialogue/authored-line')));
 const reordered=structuredClone(custom);
 reordered.content.depot.cutscene.reverse();
 const sameSpeech=createRoomReviewCatalog(reordered)[0].sections.find(section=>section.id==='scene').items;
 assert.deepEqual(sameSpeech.map(item=>item.id),depot.sections.find(section=>section.id==='scene').items.map(item=>item.id),'Playback time controls script order, not the raw clip array.');
});

test('room notes, per-line comments and check marks round-trip without touching game data',()=>{
 const before=JSON.stringify(project),review=createRoomReview({catalog,gameTitle:project.settings.title});
 assert.equal(REVIEW_STORAGE_KEY,'codaQuietBellRoomReviewV1');
 assert.equal(review.state.rooms.length,26);assert(review.state.rooms.every(room=>!room.reviewed&&room.comment===''&&room.items.length===0));
 assert.equal(review.setRoomComment(first.id,'Make Nell’s urgency clearer.\nKeep the warm wax clue.'),true);
 assert.equal(review.setRoomComment(first.id,'Make Nell’s urgency clearer.\nKeep the warm wax clue.'),false);
 assert.equal(review.setItemComment(first.id,firstItem.id,'Make this sound more patient.'),true);
 assert.equal(review.setReviewed(first.id,true),true);assert.equal(review.setReviewed(first.id,true),false);
 const saved=review.serialize(),restored=createRoomReview({catalog,saved:JSON.parse(JSON.stringify({...saved,activeRoomId:'depot'}))});
 assert.deepEqual(restored.state,review.state);assert(Object.isFrozen(restored.state.rooms[0]));
 saved.rooms[0].comment='Changed outside the notebook.';assert.notEqual(review.state.rooms[0].comment,saved.rooms[0].comment);
 assert.equal(restored.setItemComment(first.id,firstItem.id,''),true);assert.equal(restored.state.rooms[0].items.length,0);
 assert.equal(restored.setReviewed(first.id,false),true);assert.equal(restored.state.rooms[0].reviewed,false);
 assert.equal(JSON.stringify(project),before,'A review has no authoring or game-state mutations.');
});

test('exports include source text, stable field IDs, all room context and an explicit release',()=>{
 const review=createRoomReview({catalog,gameTitle:project.settings.title});review.setItemComment(first.id,firstItem.id,'Please rewrite this sentence.');
 const exported=review.export({now:'2026-11-20T12:00:00Z',release:'r-review-test'});
 assert.equal(exported.type,ROOM_REVIEW_TYPE);assert.equal(exported.schemaVersion,1);
 assert.equal(exported.generatedAt,'2026-11-20T12:00:00.000Z');assert.equal(exported.release,'r-review-test');
 const depot=exported.rooms.find(room=>room.id===first.id);
 assert.deepEqual(depot.sections,first.sections);
 assert.equal(depot.items[0].id,firstItem.id);assert.equal(depot.items[0].text,firstItem.text);assert.equal(depot.items[0].comment,'Please rewrite this sentence.');
 assert(!JSON.stringify(exported).includes('geometry'),'Export contains the reading context instead of the full game definition.');
 const restored=createRoomReview({catalog,saved:JSON.parse(JSON.stringify(exported))});
 assert.deepEqual(restored.export({now:exported.generatedAt}),exported);
 assert.throws(()=>review.export({now:'not a date'}),/date/);
});

test('saved comments keep their original wording when a later catalog changes a line',()=>{
 const review=createRoomReview({catalog});review.setItemComment(first.id,firstItem.id,'This needs a friendlier voice.');
 const changed=structuredClone(catalog);const changedLine=lines(changed[0]).find(item=>item.id===firstItem.id);changedLine.text='A newer version of the line.';
 const restored=createRoomReview({catalog:changed,saved:review.serialize()});
 restored.setItemComment(first.id,firstItem.id,'Still needs a friendlier voice.');
 const noted=restored.export().rooms[0].items[0];
 assert.equal(noted.text,firstItem.text);assert.equal(noted.currentText,'A newer version of the line.');
 assert.equal(noted.comment,'Still needs a friendlier voice.');
});

test('unknown rooms, removed lines and their quoted context survive import and re-export',()=>{
 const saved=fixture();saved.release='r-older';
 saved.rooms=[
  {id:first.id,title:'An older depot title',reviewed:true,comment:'Keep this general note.',items:[{id:'scene/removed-line',label:'Removed dialogue',text:'The old sentence.',speaker:'nell',comment:'Do not lose my comment.'}]},
  {id:'future-room',title:'A room from another draft',reviewed:true,comment:'Change its door.',items:[{id:'old/item',label:'A departed item',text:'Its original words.',comment:'My item note.'}],sections:[{id:'scene',label:'Scene dialogue',items:[{id:'old/item',label:'A departed item',text:'Its original words.'}]}]},
 ];
 const review=createRoomReview({catalog,saved});assert.equal(review.state.rooms.length,27);
 const exported=review.export({now:0});assert.equal(exported.release,'r-older');
 assert.deepEqual(exported.rooms.at(-1),saved.rooms.at(-1));
 assert.deepEqual(exported.rooms[0].items,saved.rooms[0].items);
 assert.deepEqual(createRoomReview({catalog,saved:exported}).serialize().rooms.at(-1),saved.rooms.at(-1));
});

test('invalid imports fail atomically and cannot erase an existing review',()=>{
 const review=createRoomReview({catalog});review.setRoomComment(first.id,'My notes must remain.');review.setReviewed(first.id,true);const before=review.serialize();
 const invalid=[null,{},[],{...fixture(),schemaVersion:2},{...fixture(),type:'some-other-file'},
  {...fixture(),rooms:{}},
  {...fixture(),rooms:[{id:'depot',title:'Depot',reviewed:'yes',comment:'',items:[]}]},
  {...fixture(),rooms:[{id:'depot',title:'Depot',reviewed:false,comment:'',items:[]},{id:'depot',title:'Depot again',reviewed:false,comment:'',items:[]}]},
  {...fixture(),rooms:[{id:'depot',reviewed:false,comment:'x'.repeat(MAX_REVIEW_COMMENT_LENGTH+1),items:[]}]},
  JSON.parse('{"schemaVersion":1,"type":"coda-quiet-bell-room-review","rooms":[],"__proto__":{"polluted":true}}'),
 ];
 for(const value of invalid){assert.throws(()=>review.import(value));assert.deepEqual(review.serialize(),before);}
 const getter={...fixture()};Object.defineProperty(getter,'rooms',{enumerable:true,get(){throw new Error('This accessor must never execute.');}});
 assert.throws(()=>normalizeRoomReview(getter),/executable/);assert.deepEqual(review.serialize(),before);
 const valid=fixture();valid.rooms=[{id:'canal-final',title:'Bell',reviewed:true,comment:'A replacement file.',items:[]}];
 assert.equal(review.import(valid),true);assert.equal(review.state.rooms.find(room=>room.id==='depot').comment,'');assert.equal(review.state.rooms.find(room=>room.id==='canal-final').comment,'A replacement file.');
 assert.equal({}.polluted,undefined);
});

test('mutations and oversized input obey bounded data rules without truncating comments',()=>{
 const review=createRoomReview({catalog});const max='x'.repeat(MAX_REVIEW_COMMENT_LENGTH);
 assert.equal(review.setRoomComment(first.id,max),true);assert.equal(review.setItemComment(first.id,firstItem.id,max),true);
 const before=review.serialize();
 for(const action of [()=>review.setRoomComment(first.id,max+'x'),()=>review.setItemComment(first.id,firstItem.id,max+'x'),()=>review.setRoomComment('missing-room','Note'),()=>review.setItemComment(first.id,'missing-line','Note'),()=>review.setReviewed(first.id,'yes'),()=>review.setRoomComment('__proto__','Note')]){
  assert.throws(action);assert.deepEqual(review.serialize(),before);
 }
 assert.throws(()=>normalizeRoomReview({...fixture(),rooms:Array.from({length:513},(_,i)=>({id:'room-'+i,title:'Room',reviewed:false,comment:'',items:[]}))}),/512/);
 assert.throws(()=>normalizeRoomReview({...fixture(),unused:'x'.repeat(4*1024*1024+1)}),/4 MiB/);
 const circular=fixture();circular.loop=circular;assert.throws(()=>normalizeRoomReview(circular),/circular/);
 assert.throws(()=>normalizeRoomReview({...fixture(),rooms:[{id:'depot',reviewed:false,items:new Array(2)}]}),/ordinary/);
});

test('import bounds include retained unknown rooms and the current catalog without losing current notes',()=>{
 const rooms=count=>Array.from({length:count},(_,index)=>({id:'unknown-room-'+index,title:'Another draft',reviewed:false,comment:'Retain this note.',items:[]}));
 const maximum={...fixture(),rooms:rooms(512-catalog.length)};
 const review=createRoomReview({catalog,saved:maximum});
 assert.equal(review.state.rooms.length,512);
 const exported=review.export({now:0});
 assert.equal(normalizeRoomReview(exported).rooms.length,512);
 assert.equal(createRoomReview({catalog,saved:exported}).state.rooms.length,512);
 review.setRoomComment(first.id,'My existing notes stay safe.');
 const before=review.serialize(),oversized={...fixture(),rooms:rooms(513-catalog.length)};
 assert.throws(()=>createRoomReview({catalog,saved:oversized}),/together.*512/);
 assert.throws(()=>review.import(oversized),/together.*512/);
 assert.deepEqual(review.serialize(),before);
 assert.throws(()=>createRoomReview({catalog,saved:{...fixture(),rooms:rooms(512)}}),/together.*512/);
});

test('oversized export context raises a clear error while preserving review notes',()=>{
 const largeCatalog=[{id:'large-room',title:'Large custom room',sections:[{id:'scene',label:'Scene dialogue',items:Array.from({length:220},(_,index)=>({id:'scene/line-'+index,label:'Line '+index,text:'x'.repeat(20000)}))}]}];
 const review=createRoomReview({catalog:largeCatalog});
 review.setRoomComment('large-room','Keep this comment even if the export is too large.');
 review.setReviewed('large-room',true);
 const before=review.serialize();
 assert.throws(()=>review.export({now:0}),/4 MiB/);
 assert.deepEqual(review.serialize(),before);
});
