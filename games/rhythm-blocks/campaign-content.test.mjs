import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CAMPAIGN_CONTENT,CAMPAIGN_LORE,CAMPAIGN_ART_BRIEFS,getCampaignContent} from './campaign-content.mjs';
import {ROOM_CONTENT} from './chapter-content.mjs';
import {getRoomPeople} from './party-content.mjs';
import {NOTE_KIND_BY_ID} from './engine.mjs';

const design=JSON.parse(readFileSync(new URL('../../design/music-puzzler/dungeon.json',import.meta.url),'utf8'));
const guide=JSON.parse(readFileSync(new URL('../../design/music-puzzler/worldbuilding.json',import.meta.url),'utf8'));
const roomById=new Map(design.rooms.map(room=>[room.id,room]));
const terminalById=new Map(design.terminals.map(room=>[room.id,room]));
const textValues=value=>typeof value==='string'?[value]:value&&typeof value==='object'?Object.values(value).flatMap(textValues):[];
const sameRecipe=(left,right)=>left.length===right.length&&left.every((kind,index)=>kind===right[index]);

test('every authored room and outcome is an actual narrated place',()=>{
 assert.deepEqual(new Set(Object.keys(CAMPAIGN_CONTENT)),new Set([...roomById.keys(),...terminalById.keys()]));
 assert.equal(Object.keys(CAMPAIGN_CONTENT).length,26);
 for(const [id,room]of Object.entries(CAMPAIGN_CONTENT)){
  assert.equal(getCampaignContent(id),room);
  assert(room.title.trim());assert(room.arrival.trim());
  assert(Object.isFrozen(room));assert(Object.isFrozen(room.people));
  assert.deepEqual(room.people.filter(person=>['nell','iris','pip'].includes(person.id)).map(person=>person.id),['nell','iris','pip']);
  for(const person of room.people){for(const key of ['story','route','inventory'])assert(person[key].trim(),`${id}/${person.id}/${key}`);assert(Object.isFrozen(person.demo));}
  if(!Object.hasOwn(ROOM_CONTENT,id))assert.equal(room.inspections.length,3,id);
 }
 for(const invalid of [undefined,null,'unknown','__proto__','constructor'])assert.equal(getCampaignContent(invalid),null);
 assert.equal(new Set(Object.values(CAMPAIGN_CONTENT).map(room=>room.arrival)).size,26,'Every location has its own arrival, not a shared placeholder.');
});

test('released opening conversations and observations remain intact while preview barriers are removed',()=>{
 for(const [id,original]of Object.entries(ROOM_CONTENT)){
  const room=CAMPAIGN_CONTENT[id];assert.equal(room.arrival,original.arrival);assert.equal(room.inspections,original.inspections);
  assert.equal(room.people,getRoomPeople(id));
  for(const [doorId,copy]of Object.entries(original.doorCopy)){
   const {previewCopy,...unchanged}=copy;assert.deepEqual(room.doorCopy[doorId],unchanged);
  }
 }
 const releaseText=textValues(CAMPAIGN_CONTENT).join('\n');
 assert.doesNotMatch(releaseText,/continuation preview|not playable|coming soon|this release yet|TODO/i);
});

test('door names, warnings and companion demonstrations agree with the verified puzzle catalog',()=>{
 for(const room of design.rooms){
  const content=CAMPAIGN_CONTENT[room.id];
  for(const door of room.doors){
   const copy=content.doorCopy[door.id]??content.doorCopy[door.id.replace(/^depot-/, '')];
   assert(copy?.name?.trim(),door.id);assert(copy.hint?.trim(),door.id);
   if(door.warning)assert(copy.warning?.trim(),`${door.id} needs the visible dead-end warning`);
  }
  for(const person of content.people){
   assert(room.doors.some(door=>sameRecipe(door.recipe,person.demo)),`${room.id}/${person.id} demonstrates an actual local lock`);
   assert.equal(person.demo.reduce((sum,kind)=>sum+NOTE_KIND_BY_ID[kind].units,0),8);
  }
 }
 for(const terminal of design.terminals){
  const room=CAMPAIGN_CONTENT[terminal.id];assert.deepEqual(room.doorCopy,{});
  for(const person of room.people)assert.deepEqual(person.demo,[],'An outcome cannot advertise another paid route.');
 }
});

test('sounded-first keys are taught in the same order in spoken clues and demonstrations',()=>{
 for(const room of design.rooms){
  for(const door of room.doors)assert.equal(NOTE_KIND_BY_ID[door.recipe[0]].rest,false,`${door.id} starts with a sound`);
  for(const person of CAMPAIGN_CONTENT[room.id].people)assert.equal(NOTE_KIND_BY_ID[person.demo[0]].rest,false,`${room.id}/${person.id} sounds beat one`);
 }
 for(const person of [CAMPAIGN_CONTENT.depot.people.find(person=>person.id==='iris'),...CAMPAIGN_CONTENT['garden-porch'].people]){
  assert(person.route.indexOf('half note')>=0,person.id);
  assert(person.route.indexOf('half note')<person.route.indexOf('half rest'),`${person.id} teaches sound before silence at the listening gate`);
 }
 for(const roomId of ['workshop-fork','workshop-final','canal-final'])for(const person of CAMPAIGN_CONTENT[roomId].people)
  assert.match(person.route,/single eighth.*paired sixteenths.*half rest.*quarter rest/i,`${roomId}/${person.id} keeps the two short replies before the rests`);
 assert.match(CAMPAIGN_CONTENT['canal-fork'].people.find(person=>person.id==='iris').route,/single eighth.*paired sixteenths.*half rest.*quarter rest/i);
 assert.match(CAMPAIGN_CONTENT['dead-brambles'].people.find(person=>person.id==='iris').route,/half note, then a half rest/);
});

test('only the existing authored gifts and hidden searches can offer notes',()=>{
 const npcSources=Object.entries(CAMPAIGN_CONTENT).flatMap(([roomId,room])=>room.people.filter(person=>person.sourceId).map(person=>[roomId,person.id,person.sourceId]));
 assert.deepEqual(npcSources,[['depot','nell','nell-parcel'],['garden-porch','iris','iris-gift'],['workshop-porch','pip','pip-gift']]);
 const searches=Object.entries(CAMPAIGN_CONTENT).flatMap(([roomId,room])=>room.inspections.filter(entry=>entry.sourceId).map(entry=>[roomId,entry.id,entry.sourceId,entry.placement]));
 assert.deepEqual(searches,[
  ['garden-alcove','garden-alcove-flower-stone','garden-hidden-notes','left'],
  ['workshop-alcove','workshop-alcove-hollow-perch','workshop-hidden-notes','left'],
 ]);
 for(const [roomId,inspectionId,sourceId]of searches){
  const entry=CAMPAIGN_CONTENT[roomId].inspections.find(entry=>entry.id===inspectionId);
  assert.match(entry.sourceLabel,/^Search /);assert(roomById.get(roomId).sources.some(source=>source.id===sourceId&&source.type==='hidden'));
 }
});

test('inspection IDs and placements preserve authored evidence and give every outcome its own props',()=>{
 assert.equal(CAMPAIGN_LORE.length,80);assert.equal(new Set(CAMPAIGN_LORE.map(entry=>entry.id)).size,80);
 for(const record of guide.rooms.filter(record=>roomById.has(record.id)&&!Object.hasOwn(ROOM_CONTENT,record.id))){
  const entries=CAMPAIGN_CONTENT[record.id].inspections;
  assert.deepEqual(entries.map(entry=>entry.id),record.props.map(prop=>prop.id));
  assert.deepEqual(new Set(entries.map(entry=>entry.placement)),new Set(['left','right','wall']));
 }
 for(const terminal of design.terminals){
  assert.deepEqual(CAMPAIGN_CONTENT[terminal.id].inspections.map(entry=>[entry.id,entry.placement]),[
   [terminal.id+'-memory','left'],[terminal.id+'-reply','right'],[terminal.id+'-trace','wall'],
  ]);
 }
 for(const entry of CAMPAIGN_LORE){assert(entry.title.trim());assert(entry.label.trim());assert(entry.text.trim());}
});

test('ending text and paid detours teach irreversible costs and persistent learning',()=>{
 for(const terminal of design.terminals){
  const room=CAMPAIGN_CONTENT[terminal.id],outcome=room.outcome;
  assert.equal(room.title,terminal.title);assert.equal(outcome.kind,terminal.kind);assert(outcome.kicker.trim());assert(outcome.copy.trim());
  if(terminal.kind==='dead-end'){
   assert.equal(outcome.repair,terminal.repair);
   for(const person of room.people){assert.match(person.route,/new run|next run|next try/i);assert.match(person.inventory,/new run|start again|next time/i);}
  }else assert.equal(outcome.repair,undefined,'A successful ending does not carry dead-end recovery instructions.');
 }
 assert.equal(new Set(design.terminals.map(terminal=>CAMPAIGN_CONTENT[terminal.id].outcome.copy)).size,7);
 for(const id of ['dead-brambles','dead-aviary','dead-echo']){
  const room=CAMPAIGN_CONTENT[id],authored=roomById.get(id);
  assert(authored&&authored.doors.length===1,id);
  assert.equal(room.outcome,undefined,'A paid detour is an explorable room, not an ending.');
  assert.match(room.arrival,/south/i);
  for(const person of room.people)assert.match(person.route,/south/i);
 }
 assert.doesNotMatch(textValues(CAMPAIGN_CONTENT).join('\n'),/Revisit previous choice|revisit (?:our |the )?last choice|recover (?:the |its )?(?:spent )?notes|refund/i,'Reading a clue must never promise recovery of a paid key.');
 assert.equal(Object.keys(CAMPAIGN_ART_BRIEFS).filter(id=>!Object.hasOwn(ROOM_CONTENT,id)).length,22);
});

test('the complete route turns journal knowledge into one fresh repair and resolves every service with all four friends',()=>{
 const meeting=CAMPAIGN_CONTENT['final-concourse'],heart=CAMPAIGN_CONTENT['final-heart'],ending=CAMPAIGN_CONTENT['ending-complete'];
 const meetingStory=meeting.people.map(person=>person.story).join(' '),endingStory=[ending.arrival,ending.outcome.copy,...ending.people.map(person=>person.story)].join(' ');
 assert.match(meetingStory,/reset.*repairs/i,'Earlier physical repairs reset with the run.');
 assert.match(meetingStory,/journal kept what worked and what failed/i,'Failed journeys preserve useful knowledge.');
 assert.match(meetingStory,/during this one trip/i,'The final group still has to make the connections now.');
 assert.equal(ending.outcome.kicker,'Complete ending');
 for(const detail of [/water and deliveries/i,/ferr(?:y|ies)/i,/music room/i,/repair/i,/birds.*own reply horn/i,/friend.*(?:arrived|reached).*safely/i,/all four/i])assert.match(endingStory,detail);
 assert.match(ending.outcome.copy,/all twelve beats.*spent/i);
 assert.match(ending.people.find(person=>person.id==='iris').inventory,/Earlier runs gave us knowledge, not extra notes or repairs that stayed fixed/);
 assert.match(ending.inspections.find(entry=>entry.id==='ending-complete-reply').text,/waiting at Nell’s depot with tea ready/,'Iris receives an arrival, rather than another unanswered promise.');
 for(const person of meeting.people)assert.match(person.route,/dotted half.*four sixteenths?/i,person.id);
 for(const person of heart.people)assert.match(person.route,/single eighth.*paired sixteenths.*half rest.*quarter rest/i,person.id);
 assert(heart.people.every(person=>!person.sourceId));
 assert([...meeting.inspections,...heart.inspections,...ending.inspections].every(entry=>!entry.sourceId),'The story never invents another pickup.');
 assert.match(guide.finalRoute.unlockRequirement,/all eleven prior outcomes/i);
 assert.match(guide.finalRoute.unlockRequirement,/six failed runs/i);
 assert.match(guide.finalRoute.unlockRequirement,/never its own prerequisite/i);
});
