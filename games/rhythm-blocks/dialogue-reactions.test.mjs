import test from 'node:test';
import assert from 'node:assert/strict';
import {getDialogueReaction,getDialogueStageCue,STOCK_DEPOT_DIALOGUE_EFFECTS,upgradeStockDepotDialogueEffects} from './dialogue-reactions.mjs';
import {ROOM_CUTSCENES} from './cutscene-content.mjs';
import {CAMPAIGN_SCENES} from './campaign-scenes.mjs';
import {createRoomCutscene} from './cutscene.mjs';
import {createDefaultProject,normalizeProject,validateProject} from './developer-project.mjs';
import {updateDialogue} from './cutscene-dialogue.mjs';

const clone=value=>structuredClone(value);
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const stockLine=(project,id)=>project.content.depot.cutscene.find(clip=>clip.id===id);
const performance=manualDialogue=>createRoomCutscene({scene:CAMPAIGN_SCENES.depot,beats:ROOM_CUTSCENES.depot,manualDialogue});
function advance(player,ms){for(let elapsed=0;elapsed<ms;elapsed+=100)player.update(Math.min(100,ms-elapsed));}

test('only the first depot discussion authors speech shock and the bird/radar story demonstrations',()=>{
 const project=createDefaultProject();
 assert(validateProject(project).valid);
 assert.equal(STOCK_DEPOT_DIALOGUE_EFFECTS.length,3);
 for(const stock of STOCK_DEPOT_DIALOGUE_EFFECTS){
  const clip=stockLine(project,stock.clipId),published=ROOM_CUTSCENES.depot.find(beat=>beat.id===stock.clipId);
  assert.equal(clip.text,published.text);assert.equal(clip.speaker,stock.speaker);
  for(const field of ['reaction','stageCue'])if(Object.hasOwn(stock,field))assert.deepEqual(clip[field],stock[field]);
 }
 assert.deepEqual(stockLine(project,'depot-arrival-2').reaction,{emote:'surprise',durationTiles:14});
 for(const [roomId,content]of Object.entries(project.content))if(roomId!=='depot'){
  assert(content.cutscene.every(clip=>!Object.hasOwn(clip,'reaction')&&!Object.hasOwn(clip,'stageCue')),roomId);
 }
 assert(Object.isFrozen(STOCK_DEPOT_DIALOGUE_EFFECTS));assert(Object.isFrozen(STOCK_DEPOT_DIALOGUE_EFFECTS[0].reaction));
});

test('Pip reacts at the actual manual speaking click both immediately and after a minute of waiting',()=>{
 for(const wait of [0,60000]){
  const player=performance(true);advance(player,wait);
  assert.equal(player.state.beat.id,'depot-arrival-1');assert.equal(getDialogueReaction(player.state),null);assert.equal(getDialogueStageCue(player.state),null);
  const before=clone(player.state.actors),tile=player.state.currentTile;
  assert(player.next());assert.equal(player.state.beat.id,'depot-arrival-2');
  assert.equal(player.state.currentTile,tile);assert.deepEqual(player.state.actors,before,'A speech click does not retime feet, walking or the tumble.');
  const reaction=getDialogueReaction(player.state);
  assert.deepEqual(reaction,{actorId:'pip',emote:'surprise',elapsedMs:0,durationMs:14*player.state.quantumMs,progress:0});
  assert.deepEqual(getDialogueStageCue(player.state),{cue:'courier-signal',elapsedMs:0});
  advance(player,500);assert.equal(getDialogueReaction(player.state).elapsedMs,500);
  player.pause();const paused=clone(player.state);advance(player,2000);assert.deepEqual(player.state,paused);assert.equal(getDialogueReaction(player.state).elapsedMs,500);
  player.play();advance(player,1300);assert.equal(getDialogueReaction(player.state),null,'Shock ends naturally without another click.');
  assert.deepEqual(getDialogueStageCue(player.state),{cue:'courier-signal',elapsedMs:1800});
  assert(player.next());assert.equal(getDialogueReaction(player.state),null);assert.equal(getDialogueStageCue(player.state),null,'The following speaker clears the cue.');
 }
});

test('Iris and Mira start their demonstrations on their own manual caption clocks; Skip clears them',()=>{
 const player=performance(true);advance(player,60000);
 player.next();advance(player,700);player.next();advance(player,800);player.next();
 assert.equal(player.state.beat.id,'depot-arrival-4');assert.deepEqual(getDialogueStageCue(player.state),{cue:'radar',elapsedMs:0});
 advance(player,1000);assert.deepEqual(getDialogueStageCue(player.state),{cue:'radar',elapsedMs:1000});
 player.next();assert.equal(getDialogueStageCue(player.state),null);
 player.next();assert.equal(player.state.beat.id,'depot-arrival-6');assert.deepEqual(getDialogueStageCue(player.state),{cue:'courier-signal',elapsedMs:0});
 player.skip();assert.equal(getDialogueStageCue(player.state),null);assert.equal(getDialogueReaction(player.state),null);
});

test('director scrubbing samples reactions and prop cues deterministically from authored tile positions',()=>{
 const player=performance(false),pip=player.timeline.clips.find(clip=>clip.id==='depot-arrival-2');
 player.seek(pip.startTile+4);
 const expected={actorId:'pip',emote:'surprise',elapsedMs:4*player.state.quantumMs,durationMs:14*player.state.quantumMs,progress:4/14};
 assert.deepEqual(getDialogueReaction(player.state),expected);
 assert.deepEqual(getDialogueStageCue(player.state),{cue:'courier-signal',elapsedMs:4*player.state.quantumMs});
 player.seek(pip.startTile+14);assert.equal(getDialogueReaction(player.state),null);
 player.seek(0);assert.equal(getDialogueStageCue(player.state),null);
 player.seek(pip.startTile+4);assert.deepEqual(getDialogueReaction(player.state),expected,'Repeated seek has no hidden animation clock.');
 const iris=player.timeline.clips.find(clip=>clip.id==='depot-arrival-4');player.seek(iris.startTile+2);
 assert.deepEqual(getDialogueStageCue(player.state),{cue:'radar',elapsedMs:2*player.state.quantumMs});
});

test('caption effects stay inert for entry, finished, blank, explicit off and malformed states',()=>{
 const player=performance(true);player.next();const state=player.state;
 assert(getDialogueReaction(state));assert(getDialogueStageCue(state));
 for(const value of [null,{}, {...state,phase:'entry'},{...state,finished:true},{...state,dialogueElapsed:-1},{...state,dialogueElapsed:NaN},{...state,quantumMs:0},{...state,beat:null},{...state,beat:{...state.beat,text:' '}},{...state,beat:{...state.beat,kind:'walk'}},{...state,beat:{...state.beat,reaction:null,stageCue:null}}]){
  assert.equal(getDialogueReaction(value),null);assert.equal(getDialogueStageCue(value),null);
 }
 for(const reaction of [{emote:'invalid',durationTiles:14},{emote:'surprise',durationTiles:0},{emote:'surprise',durationTiles:1.5},{emote:'surprise',durationTiles:513}])assert.equal(getDialogueReaction({...state,beat:{...state.beat,reaction}}),null);
 assert.equal(getDialogueStageCue({...state,beat:{...state.beat,stageCue:'unpublished'}}),null);
 assert.deepEqual(player.state,state,'Pure rendering selectors never mutate the transport.');
});

test('saved stock defaults gain only absent effects while authored clocks, lane owners, metadata and resources survive',()=>{
 const project=createDefaultProject();
 for(const stock of STOCK_DEPOT_DIALOGUE_EFFECTS){
  const clip=stockLine(project,stock.clipId);
  // Reproduce the saved stock version which predates speech effects and the
  // later reading-level rewrite, while retaining authored timeline changes.
  clip.text=stock.text;delete clip.reaction;delete clip.stageCue;clip.startTile+=7;clip.durationTiles+=3;clip.actor='iris';clip.author={memo:'Retain my frame plan.'};
 }
 const before=clone(project),upgraded=upgradeStockDepotDialogueEffects(freeze(project));
 for(const stock of STOCK_DEPOT_DIALOGUE_EFFECTS){
  const expected={...stockLine(before,stock.clipId)};
  for(const field of ['reaction','stageCue'])if(Object.hasOwn(stock,field))expected[field]=clone(stock[field]);
  assert.deepEqual(stockLine(upgraded,stock.clipId),expected);
 }
 for(const key of ['schemaVersion','settings','rooms','doors','sources','scenes','cast','player','noteKinds'])assert.deepEqual(upgraded[key],before[key]);
 for(const [roomId,room]of Object.entries(before.content))if(roomId!=='depot')assert.deepEqual(upgraded.content[roomId],room);
 assert.deepEqual(project,before);assert.deepEqual(upgradeStockDepotDialogueEffects(upgraded),upgraded);
 const loaded=normalizeProject(before);
 for(const stock of STOCK_DEPOT_DIALOGUE_EFFECTS){
  const published=ROOM_CUTSCENES.depot.find(beat=>beat.id===stock.clipId);
  assert.deepEqual(stockLine(loaded,stock.clipId),{...stockLine(upgraded,stock.clipId),text:published.text},'Normalization adds historical effects before refreshing stock words.');
 }
 assert.deepEqual(stockLine(loaded,'depot-arrival-2').reaction,{emote:'surprise',durationTiles:14});
 assert(validateProject(loaded).valid);assert(Object.isFrozen(stockLine(loaded,'depot-arrival-2').reaction));
});

test('custom Pip wording gains only the requested shock; cue, speaker, identity and explicit author optouts stay intact',()=>{
 const stock=STOCK_DEPOT_DIALOGUE_EFFECTS[0],base={id:stock.clipId,kind:'dialogue',actor:'pip',speaker:stock.speaker,text:stock.text};
 const clips=[{...base,text:base.text+' My authored ending.',stageCue:null,startTile:97,durationTiles:21,author:{memo:'My words and timing.'}},{...base,speaker:'mira'},{...base,id:'my-pip-line'},{...base,kind:undefined},{...base,reaction:null,stageCue:null},{...base,reaction:{emote:'idea',durationTiles:7},stageCue:'radar'},null];
 // Use JSON-compatible legacy data rather than an undefined property.
 delete clips[3].kind;
 const project={content:{depot:{cutscene:clips}}};
 const upgraded=upgradeStockDepotDialogueEffects(project);
 assert.deepEqual(upgraded.content.depot.cutscene[0],{...clips[0],reaction:{emote:'surprise',durationTiles:14}});
 assert.deepEqual(upgraded.content.depot.cutscene.slice(1),clips.slice(1));
 const customWithoutCue={...clips[0]};delete customWithoutCue.stageCue;
 const onlyShock=upgradeStockDepotDialogueEffects({content:{depot:{cutscene:[customWithoutCue]}}}).content.depot.cutscene[0];
 assert(!Object.hasOwn(onlyShock,'stageCue'),'Custom wording does not start a stock prop demonstration.');
 assert.deepEqual(onlyShock,{...customWithoutCue,reaction:{emote:'surprise',durationTiles:14}});
 for(const value of [null,7,{},[],{content:null},{content:{depot:{cutscene:null}}},{content:{depot:{cutscene:[null,3,'unfinished',{}]}}}])assert.deepEqual(upgradeStockDepotDialogueEffects(value),value);
});

test('project validation accepts editable effects and nullable off while rejecting invalid or non-dialogue effects',()=>{
 const valid=createDefaultProject(),line=stockLine(valid,'depot-arrival-2');line.reaction=null;line.stageCue=null;
 assert(validateProject(valid).valid);
 for(const reaction of [false,{},'surprise',{emote:'shock',durationTiles:14},{emote:'surprise',durationTiles:0},{emote:'surprise',durationTiles:513},{emote:'surprise',durationTiles:1.5}]){
  const project=clone(valid);stockLine(project,'depot-arrival-2').reaction=reaction;assert.equal(validateProject(project).valid,false,JSON.stringify(reaction));
 }
 for(const stageCue of [false,{},'other-cue']){const project=clone(valid);stockLine(project,'depot-arrival-2').stageCue=stageCue;assert.equal(validateProject(project).valid,false);}
 for(const field of ['reaction','stageCue']){
  const project=clone(valid),walk=project.content.depot.cutscene.find(clip=>clip.kind==='walk');walk[field]=field==='reaction'?{emote:'surprise',durationTiles:14}:'radar';assert.equal(validateProject(project).valid,false);
 }
});

test('dialogue editing round-trips effects independently and rejects malformed edits without mutating authored data',()=>{
 const project=createDefaultProject(),beats=project.content.depot.cutscene,index=beats.findIndex(clip=>clip.id==='depot-arrival-2');
 const source=freeze(clone(beats)),before=clone(source),reaction={emote:'idea',durationTiles:8};
 const changed=updateDialogue(source,index,{reaction,stageCue:'radar'});
 assert.deepEqual(changed[index],{...before[index],reaction:{emote:'idea',durationTiles:8},stageCue:'radar'});
 assert.deepEqual(changed.filter((_,i)=>i!==index),before.filter((_,i)=>i!==index));
 reaction.durationTiles=99;assert.equal(changed[index].reaction.durationTiles,8,'A UI patch cannot retain a mutable external reference.');
 assert.deepEqual(source,before);assert.equal(updateDialogue(changed,index,{reaction:{emote:'idea',durationTiles:8},stageCue:'radar'}),changed);
 const off=updateDialogue(changed,index,{reaction:null,stageCue:null});assert.equal(off[index].reaction,null);assert.equal(off[index].stageCue,null);
 const roundtrip=JSON.parse(JSON.stringify(off));assert.deepEqual(roundtrip,off);
 for(const patch of [{reaction:{emote:'wrong',durationTiles:8}},{reaction:{emote:'idea',durationTiles:513}},{reaction:{emote:'idea',durationTiles:0}},{stageCue:'wrong'}])assert.throws(()=>updateDialogue(source,index,patch));
 assert.deepEqual(source,before);
});
