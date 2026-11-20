import test from 'node:test';
import assert from 'node:assert/strict';
import {getSpeakerCues,getConversationActors,SPEAKER_CUE_DURATION_MS} from './speaker-cues.mjs';
import {createRoomCutscene} from './cutscene.mjs';
import {CAMPAIGN_SCENES} from './campaign-scenes.mjs';
import {ROOM_CUTSCENES} from './cutscene-content.mjs';

const clone=value=>structuredClone(value);
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const actor=(id,x,y,extra={})=>({id,x,y,facing:'down',moving:false,action:null,gesture:null,emote:null,...extra});
const fixture=()=>({phase:'story',finished:false,manualDialogue:true,dialogueElapsed:0,currentTile:900,totalTiles:900,quantumMs:100,
 beat:{id:'spoken',kind:'dialogue',actor:'iris',speaker:'nell',text:'Look over here.',startTile:10},
 actors:[actor('mira',100,100,{facing:'up',emote:'idea'}),actor('nell',240,100),actor('iris',100,260,{action:'examine',facing:'left'}),actor('pip',240,260,{facing:'right'})]});
function advance(player,ms){for(let passed=0;passed<ms;passed+=100)player.update(Math.min(100,ms-passed));}

test('every speaker gets a finite caption-clock badge with a final fade and static reduced-motion alternative',()=>{
 const state=freeze(fixture()),before=clone(state);
 assert.deepEqual(getSpeakerCues(state),{speakerId:'nell',elapsedMs:0,durationMs:1600,opacity:1,showMarker:true});
 assert.equal(SPEAKER_CUE_DURATION_MS,1600);
 const nearEnd={...state,dialogueElapsed:1500};
 assert.equal(getSpeakerCues(nearEnd).opacity,.5);
 assert.equal(getSpeakerCues(nearEnd,{reducedMotion:true}).opacity,1);
 const ended=getSpeakerCues({...state,dialogueElapsed:1600});
 assert.equal(ended.showMarker,false);assert.equal(ended.opacity,0);assert.equal(ended.speakerId,'nell');
 assert.equal(getSpeakerCues({...state,dialogueElapsed:60000}).showMarker,false,'Holding a line never creates a repeating badge.');
 assert.deepEqual(state,before);
});

test('a new manual line starts its own cue before and after the physical clock has finished',()=>{
 for(const wait of [0,60000]){
  const player=createRoomCutscene({scene:CAMPAIGN_SCENES.depot,beats:ROOM_CUTSCENES.depot,manualDialogue:true});
  advance(player,wait);const physical=clone(player.state.actors),tile=player.state.currentTile;
  assert.equal(player.state.beat.speaker,'nell');player.next();
  assert.equal(player.state.beat.speaker,'pip');assert.equal(getSpeakerCues(player.state).elapsedMs,0);
  assert.equal(getSpeakerCues(player.state).showMarker,true);assert.equal(player.state.currentTile,tile);assert.deepEqual(player.state.actors,physical);
  advance(player,700);const cue=getSpeakerCues(player.state),snapshot=clone(player.state);
  assert.equal(cue.elapsedMs,700);assert.deepEqual(getSpeakerCues(player.state),cue,'A repaint or reveal-all has no hidden reset.');
  player.pause();advance(player,900);assert.deepEqual(player.state,snapshot.playing?{...snapshot,playing:false}:snapshot);
  assert.deepEqual(getSpeakerCues(player.state),cue);
  player.play();advance(player,1000);assert.equal(getSpeakerCues(player.state).showMarker,false);
  player.next();assert.equal(getSpeakerCues(player.state).speakerId,'mira');assert.equal(getSpeakerCues(player.state).elapsedMs,0);
 }
});

test('idle speakers face a nearby listener and idle listeners face the voice without moving their feet',()=>{
 const state=freeze(fixture()),before=clone(state),visual=getConversationActors(state);
 assert.notEqual(visual,state.actors);
 assert.deepEqual(visual.map(pose=>[pose.id,pose.facing]),[['mira','right'],['nell','left'],['iris','left'],['pip','up']]);
 for(const [index,pose]of visual.entries()){
  const {facing,...rest}=pose,{facing:authored,...original}=state.actors[index];assert.deepEqual(rest,original);
 }
 assert.equal(visual[2],state.actors[2],'An examining actor keeps its exact authored pose.');
 assert.equal(visual[0].emote,'idea','A neutral speech cue never replaces authored emotions.');
 assert.deepEqual(state,before);
 const held=getConversationActors({...state,dialogueElapsed:60000});
 assert.deepEqual(held,visual,'Conversation headings last for the current line after the badge ends.');
});

test('walking, runs, falls, magnification and focused physical actions retain their authored headings',()=>{
 for(const busy of [{moving:true,gait:'walk'},{moving:true,gait:'run'},{gesture:'trip'},{gesture:'fallen'},{gesture:'recover'},{gesture:'magnify'},{action:'examine'},{action:'search'},{action:'listen'}]){
  const state=fixture();state.actors=state.actors.map(pose=>({...pose,...busy}));freeze(state);
  assert.equal(getConversationActors(state),state.actors,JSON.stringify(busy));
  assert.equal(getSpeakerCues(state).speakerId,'nell','A moving or busy speaker still gets a visible speaking badge.');
 }
 const movingSpeaker=fixture();movingSpeaker.actors[1].moving=true;
 const visual=getConversationActors(movingSpeaker);assert.equal(visual[1],movingSpeaker.actors[1]);assert.equal(visual[0].facing,'right');
 const looking=fixture();looking.actors[0].action='look';assert.equal(getConversationActors(looking)[0].facing,'right','An idle look can acknowledge another speaker.');
});

test('cardinal turn selection is stable, ignores coincident targets and never invents a party member',()=>{
 const state=fixture();state.actors=[actor('nell',100,100,{facing:'down'}),actor('mira',100,100,{facing:'up'})];
 assert.equal(getConversationActors(state),state.actors,'Coincident feet have no meaningful heading.');
 state.actors.push(actor('oren',40,100,{facing:'up'}));
 const visual=getConversationActors(state);assert.equal(visual.length,3);assert.equal(visual[0].facing,'left');assert.equal(visual[1].facing,'up');assert.equal(visual[2].facing,'right');
 for(const [x,y,expected]of [[200,100,'right'],[0,100,'left'],[100,200,'down'],[100,0,'up'],[200,200,'right']]){
  state.actors=[actor('nell',100,100),actor('mira',x,y)];assert.equal(getConversationActors(state)[0].facing,expected);
 }
});

test('entry, silence, missing speakers and malformed clocks create no visual dialogue effects',()=>{
 const state=freeze(fixture());
 for(const value of [null,{}, {...state,phase:'entry'},{...state,finished:true},{...state,beat:null},{...state,actors:[]},{...state,quantumMs:0},{...state,dialogueElapsed:-1},{...state,dialogueElapsed:NaN},
  {...state,beat:{...state.beat,speaker:''}},{...state,beat:{...state.beat,speaker:'missing'}},{...state,beat:{...state.beat,text:' '}},{...state,beat:{...state.beat,kind:'walk'}},
  {...state,actors:state.actors.map(pose=>pose.id==='nell'?{...pose,x:Infinity}:pose)}]){
  assert.equal(getSpeakerCues(value),null);
  const visual=getConversationActors(value);
  if(Array.isArray(value?.actors))assert.equal(visual,value.actors);
  else assert.deepEqual(visual,[]);
 }
 assert.equal(getSpeakerCues({...state,beat:{...state.beat,kind:undefined}}).speakerId,'nell','Compiled legacy combined speech remains identifiable.');
});

test('director seeking samples the same speaking badge and facing without retaining an invisible timer',()=>{
 const manual=fixture(),automatic={...manual,manualDialogue:false,currentTile:17};
 assert.deepEqual(getSpeakerCues({...manual,dialogueElapsed:700}),getSpeakerCues(automatic));
 assert.deepEqual(getConversationActors(manual),getConversationActors(automatic));
 const player=createRoomCutscene({scene:CAMPAIGN_SCENES.depot,beats:ROOM_CUTSCENES.depot});
 const clip=player.timeline.clips.find(clip=>clip.id==='depot-arrival-2');
 player.seek(clip.startTile+3);const cue=getSpeakerCues(player.state),actors=getConversationActors(player.state);
 player.seek(0);player.seek(clip.startTile+3);assert.deepEqual(getSpeakerCues(player.state),cue);assert.deepEqual(getConversationActors(player.state),actors);
 player.skip();assert.equal(getSpeakerCues(player.state),null);assert.equal(getConversationActors(player.state),player.state.actors);
});

test('all shipped rooms identify every spoken line while keeping authored performances and data intact',()=>{
 const before=clone(ROOM_CUTSCENES);let lines=0,rooms=0;
 for(const [roomId,scene]of Object.entries(CAMPAIGN_SCENES)){
  const player=createRoomCutscene({scene,beats:ROOM_CUTSCENES[roomId],manualDialogue:true});advance(player,60000);
  const poses=clone(player.state.actors),tile=player.state.currentTile;let position=0;
  while(player.state.beat){
   const state=player.state,original=clone(state),cue=getSpeakerCues(state),visual=getConversationActors(state);
   assert.equal(cue.speakerId,state.beat.speaker,roomId);assert.equal(cue.elapsedMs,state.dialogueElapsed);
   assert.equal(cue.showMarker,position>0,'New speakers cue immediately even after the physical performance ends.');
   assert.equal(visual.length,state.actors.length);
   for(const [index,actor]of visual.entries()){
    const {facing,...fields}=actor,{facing:authored,...old}=state.actors[index];assert.deepEqual(fields,old);
   }
   assert.deepEqual(state,original);assert.deepEqual(state.actors,poses);assert.equal(state.currentTile,tile);
   lines++;position++;player.next();
  }
  rooms++;
 }
 assert.equal(rooms,Object.keys(CAMPAIGN_SCENES).length);assert.equal(lines,Object.values(ROOM_CUTSCENES).flat().filter(beat=>beat.kind==='dialogue'&&beat.text?.trim()).length);assert.deepEqual(ROOM_CUTSCENES,before);
});
