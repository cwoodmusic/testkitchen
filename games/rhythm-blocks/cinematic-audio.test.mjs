import test from 'node:test';
import assert from 'node:assert/strict';
import {createCinematicAudio} from './cinematic-audio.mjs';

function fakeAudio(t,{initialState='running'}={}){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'AudioContext'),webkit=Object.getOwnPropertyDescriptor(globalThis,'webkitAudioContext'),contexts=[];
 class Parameter{events=[];setValueAtTime(value,time){this.events.push({type:'set',value,time});}linearRampToValueAtTime(value,time){this.events.push({type:'linear',value,time});}exponentialRampToValueAtTime(value,time){this.events.push({type:'exponential',value,time});}}
 class Node{connections=[];disconnects=0;connect(destination){this.connections.push(destination);}disconnect(){this.disconnects++;this.connections=[];}}
 class Oscillator extends Node{frequency=new Parameter();starts=[];stops=[];start(time){this.starts.push(time);}stop(time){this.stops.push(time);}finish(){this.onended?.();}}
 class Gain extends Node{gain=new Parameter();}
 class Context{
  currentTime=10;state=initialState;destination={};oscillators=[];gains=[];resumes=0;suspends=0;closes=0;
  constructor(){contexts.push(this);}createOscillator(){const node=new Oscillator();this.oscillators.push(node);return node;}createGain(){const node=new Gain();this.gains.push(node);return node;}
  async resume(){this.resumes++;this.state='running';}async suspend(){this.suspends++;this.state='suspended';}async close(){this.closes++;this.state='closed';}
 }
 Object.defineProperty(globalThis,'AudioContext',{value:Context,writable:true,configurable:true});delete globalThis.webkitAudioContext;
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'AudioContext',previous);else delete globalThis.AudioContext;if(webkit)Object.defineProperty(globalThis,'webkitAudioContext',webkit);else delete globalThis.webkitAudioContext;});
 return contexts;
}
const caption=(patch={})=>({phase:'story',playing:true,finished:false,currentTile:0,actors:[],activeClips:[],beat:{id:'line',speaker:'mira',text:'A, b! c'},...patch});
const glyph=(track,state,count,audible=true)=>track.sample(state,{visibleCharacters:count,audible});

 test('character audio is lazy, reuses one context and honors muted or unavailable browsers',async t=>{
 const contexts=fakeAudio(t,{initialState:'suspended'}),audio=createCinematicAudio({enabled:false});
 await audio.unlock();assert.equal(contexts.length,0);assert.equal(audio.bloop('mira'),false);assert.equal(audio.knock(),false);
 audio.setEnabled(true);await audio.unlock();await audio.unlock();assert.equal(contexts.length,1);assert.equal(contexts[0].resumes,1);
 audio.createTrack().destroy();await audio.unlock();assert.equal(contexts.length,1,'Room changes do not create another context.');
 await audio.destroy();assert.equal(contexts[0].closes,1);
 delete globalThis.AudioContext;await assert.doesNotReject(audio.unlock());assert.equal(audio.bloop(),false);
 globalThis.AudioContext=class{constructor(){throw Error('Not permitted');}};await assert.doesNotReject(audio.unlock());
 });

 test('the cast has distinct quiet voices with bounded attacks and a real-time rate limit',async t=>{
 const contexts=fakeAudio(t),audio=createCinematicAudio();await audio.unlock();const context=contexts[0];
 for(const id of ['nell','iris','pip','mira']){assert(audio.bloop(id));assert.equal(audio.bloop(id),false,'At most one voice per55ms.');context.currentTime+=.06;context.oscillators.at(-1).finish();}
 assert.equal(new Set(context.oscillators.map(osc=>osc.frequency.events[0].value)).size,4);
 for(const [index,osc]of context.oscillators.entries()){
  assert(osc.starts[0]<osc.stops[0]);assert(osc.stops[0]-osc.starts[0]<.05);assert.equal(osc.disconnects,1);
  const envelope=context.gains[index].gain.events;assert.equal(Math.max(...envelope.map(event=>event.value)),.025);assert(envelope[0].time<envelope[1].time&&envelope[1].time<envelope[2].time);
 }
 });

 test('Pip has a light trip knock and a lower soft landing, with no queued playback',async t=>{
 const contexts=fakeAudio(t),audio=createCinematicAudio();await audio.unlock();const context=contexts[0];
 assert(audio.knock('trip'));assert.equal(audio.knock('fallen'),false);context.currentTime+=.5;assert(audio.knock('fallen'));
 assert.deepEqual(context.oscillators.map(osc=>osc.frequency.events[0].value),[205,145]);
 assert.deepEqual(context.gains.map(gain=>Math.max(...gain.gain.events.map(event=>event.value))),[.035,.055]);
 assert(context.oscillators.every(osc=>osc.stops[0]-osc.starts[0]<.1));audio.stop();assert(context.oscillators.every(osc=>osc.stops.at(-1)===undefined));
 });

 test('only newly revealed letters sound, while punctuation, reveal-all and scrubbing stay silent',async t=>{
 const contexts=fakeAudio(t),audio=createCinematicAudio();await audio.unlock();const context=contexts[0],track=audio.createTrack();
 glyph(track,caption(),0,false);glyph(track,caption({currentTile:1}),1);assert.equal(context.oscillators.length,1);
 context.currentTime+=.1;glyph(track,caption({currentTile:2}),3);assert.equal(context.oscillators.length,1,'Comma and blank are not a voice.');
 glyph(track,caption({currentTile:3}),4);assert.equal(context.oscillators.length,2);
 context.currentTime+=.1;glyph(track,caption({currentTile:3}),7,false);glyph(track,caption({currentTile:4}),7);assert.equal(context.oscillators.length,2,'Reveal-all does not queue remaining glyphs.');
 glyph(track,caption({currentTile:0}),0,false);glyph(track,caption({currentTile:100}),7);assert.equal(context.oscillators.length,2,'A large seek never catches up as speech.');
 glyph(track,caption({currentTile:2}),3,false);glyph(track,caption({currentTile:3,playing:false}),4);assert.equal(context.oscillators.length,2,'Paused re-layouts remain silent.');
 });

 test('one natural frame creates at most one bloop and a suspended frame cannot replay a burst',async t=>{
 const contexts=fakeAudio(t),audio=createCinematicAudio();await audio.unlock();const context=contexts[0],track=audio.createTrack();
 const line={id:'long',speaker:'nell',text:'abcdefghijklmnopqrstuvwxyz'};
 glyph(track,caption({beat:line}),0,false);glyph(track,caption({beat:line,currentTile:1}),7);assert.equal(context.oscillators.length,1);
 context.currentTime+=.2;glyph(track,caption({beat:line,currentTile:2}),26);assert.equal(context.oscillators.length,1,'A long catchup range produces no burst.');
 glyph(track,caption({beat:{id:'other',speaker:'iris',text:'Yes.'},currentTile:3}),1);assert.equal(context.oscillators.length,2,'A naturally reached speaker has her own voice.');
 });

 test('trip and landing sound once per crossing; repeated paints, seek and recovery add no impacts',async t=>{
 const contexts=fakeAudio(t),audio=createCinematicAudio();await audio.unlock();const context=contexts[0],track=audio.createTrack();
 const state=(tile,gesture,id=gesture)=>caption({beat:null,currentTile:tile,actors:[{id:'pip',gesture}],activeClips:gesture?[{id,kind:'gesture',actor:'pip',gesture}]:[]});
 glyph(track,state(0,null),0,false);glyph(track,state(1,'trip'),0);assert.equal(context.oscillators.length,1);
 for(let tile=1.2;tile<3;tile+=.2){context.currentTime+=.1;glyph(track,state(tile,'trip'),0);}assert.equal(context.oscillators.length,1);
 context.currentTime+=.2;glyph(track,state(3,'fallen'),0);assert.equal(context.oscillators.length,2);
 glyph(track,state(4,'recover'),0);glyph(track,state(5,null),0);assert.equal(context.oscillators.length,2);
 glyph(track,state(1,'trip'),0,false);context.currentTime+=.2;glyph(track,state(1.5,'trip'),0);assert.equal(context.oscillators.length,2,'Scrubbing into a gesture does not strike it again.');
 track.destroy();glyph(track,state(2,'fallen'),0);assert.equal(context.oscillators.length,2);
 });

 test('manual speech keeps its voice after physical motion finishes, without replaying control reveals or paused text',async t=>{
 const contexts=fakeAudio(t),audio=createCinematicAudio();await audio.unlock();const context=contexts[0],track=audio.createTrack();
 const held=(dialogueElapsed,patch={})=>caption({manualDialogue:true,currentTile:20,dialogueElapsed,...patch});
 glyph(track,held(0),0,false);glyph(track,held(32),1);assert.equal(context.oscillators.length,1,'A live dialogue clock can reveal letters at unchanged feet.');
 context.currentTime+=.1;glyph(track,held(64),3);assert.equal(context.oscillators.length,1,'Punctuation and blanks remain silent.');
 glyph(track,held(96),4);assert.equal(context.oscillators.length,2);
 context.currentTime+=.1;glyph(track,held(96),7,false);glyph(track,held(128),7);assert.equal(context.oscillators.length,2,'Click-to-reveal does not catch up later.');
 glyph(track,held(0),0,false);glyph(track,held(32,{playing:false}),1);assert.equal(context.oscillators.length,2,'Pausing also silences the independent clock.');
 glyph(track,held(5000),7);assert.equal(context.oscillators.length,2,'A long seek does not become a burst of letters.');
 });

 test('advancing only a held caption cannot retrigger a physical impact',async t=>{
 const contexts=fakeAudio(t),audio=createCinematicAudio();await audio.unlock();const context=contexts[0],track=audio.createTrack();
 const held=dialogueElapsed=>caption({manualDialogue:true,currentTile:20,dialogueElapsed,beat:null,actors:[{id:'pip',gesture:'fallen'}],activeClips:[{id:'landing',kind:'gesture',actor:'pip',gesture:'fallen'}]});
 glyph(track,held(0),0,false);for(let age=32;age<200;age+=32){context.currentTime+=.1;glyph(track,held(age),0);}
 assert.equal(context.oscillators.length,0,'Impact sounds follow physical crossings, not a reader waiting.');
 });

 test('room narration types audibly with both physical clocks parked and no reveal-all backlog',async t=>{
 const contexts=fakeAudio(t),audio=createCinematicAudio();await audio.unlock();const context=contexts[0],track=audio.createTrack();
 const narration=dialogueElapsed=>caption({phase:'narration',manualDialogue:true,currentTile:0,dialogueElapsed,entry:{currentTile:0},beat:{id:'room-narration',speaker:'narrator',text:'A, b! c'}});
 glyph(track,narration(0),0,false);glyph(track,narration(32),1);
 assert.equal(context.oscillators.length,1,'Reading sounds do not depend on walking.');
 assert.equal(context.oscillators[0].type,'sine');assert.equal(context.oscillators[0].frequency.events[0].value,300,'Narration has its own quiet voice.');
 context.currentTime+=.1;glyph(track,narration(64),3);assert.equal(context.oscillators.length,1,'Spaces and punctuation stay silent.');
 glyph(track,narration(96),4);assert.equal(context.oscillators.length,2);
 context.currentTime+=.1;glyph(track,narration(96),7,false);glyph(track,narration(128),7);
 assert.equal(context.oscillators.length,2,'Revealing the remaining words never queues their sound.');
 for(let elapsed=160;elapsed<1000;elapsed+=32)glyph(track,narration(elapsed),7);
 assert.equal(context.oscillators.length,2,'A completed passage waits silently.');
 });

 test('narration audio respects mute, pause, disposal and phase boundaries without creating impacts',async t=>{
 const contexts=fakeAudio(t),audio=createCinematicAudio();await audio.unlock();const context=contexts[0],track=audio.createTrack();
 const narration=(elapsed,patch={})=>caption({phase:'narration',manualDialogue:true,currentTile:0,dialogueElapsed:elapsed,beat:{id:'intro',speaker:'narrator',text:'A long introduction'},actors:[{id:'pip',gesture:'fallen'}],...patch});
 glyph(track,narration(0),0,false);glyph(track,narration(32,{playing:false}),1);assert.equal(context.oscillators.length,0);
 audio.setEnabled(false);glyph(track,narration(64),2);assert.equal(context.oscillators.length,0);
 audio.setEnabled(true);glyph(track,narration(96),3);assert.equal(context.oscillators.length,1);
 context.currentTime+=.1;glyph(track,narration(5000),12);assert.equal(context.oscillators.length,1,'A seek cannot catch up as narration.');
 glyph(track,narration(5032,{finished:true}),13);assert.equal(context.oscillators.length,1);
 glyph(track,narration(5064,{beat:null,currentTile:1}),0);assert.equal(context.oscillators.length,1,'Narration cannot trigger a physical impact.');
 glyph(track,narration(5096,{phase:'entry',currentTile:2}),14);assert.equal(context.oscillators.length,1,'The doorway stays silent.');
 glyph(track,caption({manualDialogue:true,dialogueElapsed:0}),0,false);
 glyph(track,caption({manualDialogue:true,dialogueElapsed:32}),1);assert.equal(context.oscillators.length,2,'The following scene still has its character voice.');
 track.destroy();context.currentTime+=.1;glyph(track,narration(5128),15);assert.equal(context.oscillators.length,2);
 assert(context.oscillators.every(osc=>osc.stops.at(-1)===undefined),'Closing the text stops all remaining voices.');
 });

 test('mute, suspension and disposal stop all short voices and allow quiet clean resumption',async t=>{
 const contexts=fakeAudio(t),audio=createCinematicAudio();await audio.unlock();const context=contexts[0];
 audio.bloop('pip');audio.knock('trip');audio.setEnabled(false);assert(context.oscillators.every(osc=>osc.stops.at(-1)===undefined));
 context.currentTime++;assert.equal(audio.bloop(),false);assert.equal(audio.knock(),false);await audio.unlock();assert.equal(contexts.length,1);
 audio.setEnabled(true);await audio.unlock();assert(audio.bloop());await audio.suspend();assert.equal(context.state,'suspended');assert.equal(audio.bloop(),false);
 await audio.unlock();assert.equal(context.resumes,1);assert(audio.knock('fallen'));await audio.destroy();assert.equal(context.closes,1);assert.equal(contexts.length,1);
 });

 test('a stalled audio device retains at most six voices and stop clears them idempotently',async t=>{
 const contexts=fakeAudio(t),audio=createCinematicAudio();await audio.unlock();const context=contexts[0];
 for(let i=0;i<30;i++){audio.bloop('mira');context.currentTime+=.1;}
 assert.equal(context.oscillators.length,6);audio.stop();const counts=context.oscillators.map(osc=>osc.stops.length);audio.stop();assert.deepEqual(context.oscillators.map(osc=>osc.stops.length),counts);
 assert(audio.bloop('iris'));assert.equal(context.oscillators.length,7);
 });
