import test from 'node:test';
import assert from 'node:assert/strict';
import {createRhythmAudio} from './audio.mjs';

const BEAT=60/108,near=(actual,expected)=>assert(Math.abs(actual-expected)<1e-10,`${actual} differs from ${expected}`);
const noteVoices=context=>context.oscillators.filter(osc=>osc.type==='triangle');
const clickVoices=context=>context.oscillators.filter(osc=>osc.type==='sine');
function fakeAudio(t,{initialState='running',deferClose=false}={}){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'AudioContext'),webkit=Object.getOwnPropertyDescriptor(globalThis,'webkitAudioContext'),contexts=[];
 class Parameter{
  events=[];
  setValueAtTime(value,time){this.events.push({type:'set',value,time});}
  linearRampToValueAtTime(value,time){this.events.push({type:'linear',value,time});}
  exponentialRampToValueAtTime(value,time){this.events.push({type:'exponential',value,time});}
 }
 class Node{
  connections=[];disconnects=0;
  connect(destination){this.connections.push(destination);}
  disconnect(){this.disconnects++;this.connections=[];}
 }
 class Oscillator extends Node{
  frequency=new Parameter();starts=[];stops=[];ended=false;
  start(time){this.starts.push(time);}
  stop(time){this.stops.push(time);}
  finish(){if(!this.ended){this.ended=true;this.onended?.();}}
 }
 class Gain extends Node{gain=new Parameter();}
 class Context{
  currentTime=10;state=initialState;destination={name:'speaker'};oscillators=[];gains=[];resumes=0;suspends=0;closes=0;
  constructor(){contexts.push(this);}
  createOscillator(){const oscillator=new Oscillator();this.oscillators.push(oscillator);return oscillator;}
  createGain(){const gain=new Gain();this.gains.push(gain);return gain;}
  async resume(){if(this.state==='closed')throw Error('Context is closed');this.resumes++;this.state='running';}
  async suspend(){this.suspends++;this.state='suspended';}
  async close(){this.closes++;if(deferClose)await new Promise(resolve=>{this.finishClose=resolve;});this.state='closed';}
 }
 Object.defineProperty(globalThis,'AudioContext',{value:Context,writable:true,configurable:true});delete globalThis.webkitAudioContext;
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'AudioContext',previous);else delete globalThis.AudioContext;if(webkit)Object.defineProperty(globalThis,'webkitAudioContext',webkit);else delete globalThis.webkitAudioContext;});
 return {contexts,Context};
}

test('unlock creates audio lazily, resumes a suspended context and does nothing while muted',async t=>{
 const {contexts}=fakeAudio(t,{initialState:'suspended'}),audio=createRhythmAudio({enabled:false});
 audio.playPattern(['quarter']);await audio.unlock();assert.equal(contexts.length,0);assert.equal(audio.state.phase,'idle');
 audio.setEnabled(true);await audio.unlock();assert.equal(contexts.length,1);assert.equal(contexts[0].resumes,1);await audio.unlock();assert.equal(contexts[0].resumes,1);
 audio.playPattern(['quarter']);assert.equal(noteVoices(contexts[0]).length,1);assert.equal(clickVoices(contexts[0]).length,5);audio.stop();
});

test('paired eighths and four-sixteenth groups keep their true attacks after the four-beat count-in',async t=>{
 const {contexts}=fakeAudio(t),audio=createRhythmAudio();await audio.unlock();audio.playPattern(['eighth-pair','sixteenth-group']);
 const context=contexts[0],base=context.currentTime+.035+4*BEAT,notes=noteVoices(context);assert.equal(notes.length,6);
 const expected=[base,base+BEAT/2,base+BEAT,base+BEAT*1.25,base+BEAT*1.5,base+BEAT*1.75];
 notes.forEach((osc,index)=>{
  near(osc.starts[0],expected[index]);assert.equal(osc.type,'triangle');
  const duration=BEAT/(index<2?2:4)*.82;near(osc.stops[0],expected[index]+duration+.025);
  const gain=osc.connections[0];assert.strictEqual(gain.connections[0],context.destination);
  assert.deepEqual(gain.gain.events.map(event=>event.type),['set','linear','exponential','set']);near(gain.gain.events[2].time,expected[index]+duration);
 });
});

test('rests retain their entire duration while the quieter metronome keeps the pulse audible',async t=>{
 const {contexts}=fakeAudio(t),audio=createRhythmAudio();await audio.unlock();audio.playPattern(['quarter-rest','half-rest','quarter-rest','quarter','quarter-rest','half']);
 const context=contexts[0],base=context.currentTime+.035+4*BEAT,notes=noteVoices(context);assert.equal(notes.length,2);near(notes[0].starts[0],base+4*BEAT);near(notes[1].starts[0],base+6*BEAT);
 const old=[...context.oscillators],priorClicks=clickVoices(context).length;
 audio.playPattern(['quarter-rest','half-rest','quarter-rest']);assert.equal(noteVoices(context).length,2,'All-rest playback adds no note tones.');assert.equal(clickVoices(context).length-priorClicks,8,'Four count-in clicks and four pattern beats remain audible.');assert(old.every(osc=>osc.stops.at(-1)===undefined),'Replacing playback cancels both its note tones and its metronome.');
});

test('half and dotted-half sustain proportionally, while a single eighth keeps its half-beat gate',async t=>{
 const {contexts}=fakeAudio(t),audio=createRhythmAudio();await audio.unlock();audio.playPattern(['half','dotted-half','eighth']);
 const context=contexts[0],base=context.currentTime+.035+4*BEAT,beats=[2,3,.5],offsets=[0,2,5],notes=noteVoices(context);
 notes.forEach((osc,index)=>{near(osc.starts[0],base+offsets[index]*BEAT);near(osc.stops[0]-osc.starts[0],beats[index]*BEAT*.82+.025);});
 assert(notes[1].connections[0].gain.events[2].time-notes[1].starts[0]>1.3,'The dotted half retains its full musical gate.');
});

test('a new pattern cancels every old note and click without stale ended callbacks stopping its replacement',async t=>{
 const {contexts}=fakeAudio(t),audio=createRhythmAudio();await audio.unlock();audio.playPattern(['sixteenth-group','quarter']);const context=contexts[0],old=[...context.oscillators];
 audio.playPattern(['half']);assert.equal(noteVoices(context).length,6);const replacement=context.oscillators.at(-1);
 for(const osc of old){assert.equal(osc.stops.length,2);assert.equal(osc.stops.at(-1),undefined);assert(osc.disconnects>=1);osc.finish();}
 assert.equal(replacement.stops.length,1);audio.stop();assert.equal(replacement.stops.length,2);assert.equal(replacement.stops.at(-1),undefined);assert(context.gains.every(gain=>gain.disconnects>=1));
 const stops=replacement.stops.length;audio.stop();assert.equal(replacement.stops.length,stops,'Repeated stop does not revisit cleared voices.');assert.equal(audio.state.phase,'idle');
});

test('naturally ended note and metronome voices disconnect and leave the active collection',async t=>{
 const {contexts}=fakeAudio(t),audio=createRhythmAudio();await audio.unlock();audio.playPattern(['quarter']);const context=contexts[0];
 for(const osc of context.oscillators){const gain=osc.connections[0];osc.finish();assert.equal(osc.disconnects,1);assert.equal(gain.disconnects,1);}
 audio.stop();assert(context.oscillators.every(osc=>osc.stops.length===1),'Completed voices are no longer retained for stopping.');
});

test('mute and suspension cancel future count-in, pulse and note voices, then resume cleanly',async t=>{
 const {contexts}=fakeAudio(t),audio=createRhythmAudio();await audio.unlock();audio.playPattern(['quarter','dotted-half']);const context=contexts[0];
 await audio.suspend();assert.equal(context.state,'suspended');assert.equal(context.suspends,1);assert(context.oscillators.every(osc=>osc.stops.at(-1)===undefined));assert.equal(audio.state.phase,'idle');
 audio.playPattern(['quarter']);assert.equal(noteVoices(context).length,2);await audio.unlock();assert.equal(context.resumes,1);audio.playPattern(['quarter']);assert.equal(noteVoices(context).length,3);
 audio.setEnabled(false);const mutedCount=context.oscillators.length;assert(context.oscillators.every(osc=>osc.stops.at(-1)===undefined));audio.playPattern(['dotted-half']);await audio.unlock();assert.equal(context.oscillators.length,mutedCount);assert.equal(contexts.length,1);
 audio.setEnabled(true);await audio.unlock();audio.playPattern(['eighth']);assert.equal(noteVoices(context).length,4);assert.equal(audio.state.phase,'count-in');
});

test('destroy captures its old context so a restored page can unlock while closing is pending',async t=>{
 const {contexts}=fakeAudio(t,{deferClose:true}),audio=createRhythmAudio();await audio.unlock();audio.playPattern(['quarter']);const old=contexts[0],closing=audio.destroy();
 assert.equal(old.closes,1);assert(old.oscillators.every(osc=>osc.stops.at(-1)===undefined));await audio.unlock();assert.equal(contexts.length,2,'A closing context cannot be reused after page restoration.');
 const fresh=contexts[1];audio.playPattern(['half']);assert.equal(noteVoices(fresh).length,1);old.finishClose();await closing;assert.equal(old.state,'closed');assert.equal(fresh.state,'running','Late cleanup must not close the replacement context.');
});

test('unavailable, denied and still-suspended AudioContexts remain silent without throwing',async t=>{
 const {contexts,Context}=fakeAudio(t,{initialState:'suspended'});delete globalThis.AudioContext;const unavailable=createRhythmAudio();await unavailable.unlock();assert.doesNotThrow(()=>unavailable.playPattern(['quarter']));assert.equal(unavailable.state.phase,'idle');
 globalThis.AudioContext=class{constructor(){throw Error('Audio denied');}};const denied=createRhythmAudio();await assert.doesNotReject(denied.unlock());assert.doesNotThrow(()=>denied.playPattern(['quarter']));
 globalThis.AudioContext=Context;const blocked=createRhythmAudio();await blocked.unlock();contexts[0].state='suspended';contexts[0].resume=async()=>{throw Error('Gesture required');};await assert.doesNotReject(blocked.unlock());assert.equal(blocked.playPattern(['quarter']),undefined);assert.equal(contexts[0].oscillators.length,0);
});

test('paired sixteenths fill half a beat with two attacks; a single eighth fills it with one',async t=>{
 const {contexts}=fakeAudio(t),audio=createRhythmAudio();await audio.unlock();audio.playPattern(['sixteenth-pair','eighth','quarter']);
 const context=contexts[0],base=context.currentTime+.035+4*BEAT,notes=noteVoices(context);assert.equal(notes.length,4);
 const starts=[0,.25,.5,1];notes.forEach((osc,index)=>near(osc.starts[0],base+starts[index]*BEAT));
 near(notes[0].stops[0]-notes[0].starts[0],.25*BEAT*.82+.025);near(notes[1].stops[0]-notes[1].starts[0],.25*BEAT*.82+.025);near(notes[2].stops[0]-notes[2].starts[0],.5*BEAT*.82+.025);audio.stop();
});

test('developer tempo, rests and subdivisions set both count-in and pattern timing with atomic validation',async t=>{
 const {contexts}=fakeAudio(t),audio=createRhythmAudio({bpm:60,noteKinds:[{id:'quarter',units:6,rest:true,subdivisions:1},{id:'eighth-pair',units:4,rest:false,subdivisions:4}]});await audio.unlock();const schedule=audio.playPattern(['quarter','eighth-pair']);
 const context=contexts[0],base=context.currentTime+.035+4,notes=noteVoices(context);assert.equal(notes.length,4);near(schedule.beatSeconds,1);near(schedule.patternStartTime-schedule.startTime,4);
 notes.forEach((osc,index)=>near(osc.starts[0],base+3+index*.5));
 assert.throws(()=>audio.setDefinition({bpm:0}),/Invalid/);audio.playPattern(['eighth-pair']);near(noteVoices(context).at(-1).starts[0],base+1.5,'Invalid definition changes retain the prior tempo and catalog.');
 audio.setDefinition();audio.playPattern(['quarter']);near(noteVoices(context).at(-1).stops[0]-noteVoices(context).at(-1).starts[0],BEAT*.82+.025);
});

test('very short edited subdivisions finish their attack before their decay',async t=>{
 const {contexts}=fakeAudio(t),audio=createRhythmAudio({bpm:400,noteKinds:[{id:'quarter',units:1,rest:false,subdivisions:16}]});await audio.unlock();audio.playPattern(['quarter']);assert.equal(noteVoices(contexts[0]).length,16);
 for(const osc of contexts[0].oscillators){const [start,attack,decay,end]=osc.connections[0].gain.events;assert(start.time<attack.time&&attack.time<decay.time&&decay.time<end.time);}
});

test('four evenly spaced count-in clicks lead into a quieter metronome with accented beat one in every bar',async t=>{
 const {contexts}=fakeAudio(t),audio=createRhythmAudio();await audio.unlock();const schedule=audio.playPattern(['half-rest','half','quarter','dotted-half']),context=contexts[0],clicks=clickVoices(context);
 assert.equal(schedule.countInBeats,4);assert.equal(schedule.totalBeats,8);assert.equal(clicks.length,12);near(schedule.patternStartTime-schedule.startTime,4*BEAT);
 clicks.forEach((osc,index)=>{near(osc.starts[0],schedule.startTime+index*BEAT);const accented=index===0||index===4||index===8;assert.equal(osc.frequency.events[0].value,accented?1760:1180);});
 const peaks=clicks.map(osc=>osc.connections[0].gain.events.find(event=>event.type==='linear').value);
 assert(peaks[0]>peaks[1]&&peaks[4]>peaks[5]&&peaks[8]>peaks[9],'The first beat is accented in the count-in and each pattern bar.');assert(peaks[1]>peaks[4],'Even an accented pattern click is quieter than the count-in.');
 assert(noteVoices(context).every(osc=>osc.connections[0].gain.events.find(event=>event.type==='linear').value>Math.max(...peaks)),'The pulse leaves the rhythm notes prominent.');
});

test('read-only beat state follows the audio clock and never starts a second transport',async t=>{
 const {contexts}=fakeAudio(t),audio=createRhythmAudio();await audio.unlock();const schedule=audio.playPattern(['dotted-half','quarter','half']),context=contexts[0],count=context.oscillators.length;
 assert.equal(audio.state.phase,'count-in');assert.equal(audio.state.beat,1);context.currentTime=schedule.startTime+2.1*BEAT;assert.equal(audio.state.beat,3);
 context.currentTime=schedule.patternStartTime+.1*BEAT;assert.equal(audio.state.phase,'pattern');assert.equal(audio.state.beat,1);context.currentTime=schedule.patternStartTime+4.1*BEAT;assert.equal(audio.state.beat,1);assert.equal(audio.state.beatIndex,4);
 assert(Object.isFrozen(schedule));assert(Object.isFrozen(schedule.ticks));assert(Object.isFrozen(audio.state));assert.throws(()=>{schedule.ticks[0].time=0;},TypeError);assert.equal(context.oscillators.length,count,'Reading a beat never schedules more voices.');
 context.currentTime=schedule.endTime;assert.deepEqual(audio.state,{playing:false,phase:'idle',beat:null,beatIndex:null});
});

test('empty and unknown patterns make no count-in, pulse or notes, and cancel any prior playback',async t=>{
 const {contexts}=fakeAudio(t),audio=createRhythmAudio();await audio.unlock();assert.equal(audio.playPattern([]),undefined);assert.equal(audio.playPattern(['unknown','constructor','__proto__']),undefined);assert.equal(contexts[0].oscillators.length,0);
 audio.playPattern(['quarter']);const count=contexts[0].oscillators.length;assert.equal(audio.playPattern([]),undefined);assert.equal(contexts[0].oscillators.length,count);assert(contexts[0].oscillators.every(osc=>osc.stops.at(-1)===undefined));assert.equal(audio.state.phase,'idle');
});
