import test from 'node:test';
import assert from 'node:assert/strict';
import {createRhythmAudio} from './audio.mjs';

const BEAT=60/108,near=(actual,expected)=>assert(Math.abs(actual-expected)<1e-10,`${actual} differs from ${expected}`);
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
 audio.playPattern(['quarter']);await audio.unlock();assert.equal(contexts.length,0);
 audio.setEnabled(true);await audio.unlock();assert.equal(contexts.length,1);assert.equal(contexts[0].resumes,1);await audio.unlock();assert.equal(contexts[0].resumes,1);
 audio.playPattern(['quarter']);assert.equal(contexts[0].oscillators.length,1);audio.stop();
});

test('paired eighths and four-sixteenth groups schedule distinct attacks at their true subdivisions',async t=>{
 const {contexts}=fakeAudio(t),audio=createRhythmAudio();await audio.unlock();audio.playPattern(['eighth-pair','sixteenth-group']);
 const context=contexts[0],base=context.currentTime+.035;assert.equal(context.oscillators.length,6);
 const expected=[base,base+BEAT/2,base+BEAT,base+BEAT*1.25,base+BEAT*1.5,base+BEAT*1.75];
 context.oscillators.forEach((osc,index)=>{
  near(osc.starts[0],expected[index]);assert.equal(osc.type,'triangle');
  const duration=BEAT/(index<2?2:4)*.82;near(osc.stops[0],expected[index]+duration+.025);
  const gain=context.gains[index];assert.strictEqual(osc.connections[0],gain);assert.strictEqual(gain.connections[0],context.destination);
  assert.deepEqual(gain.gain.events.map(event=>event.type),['set','linear','exponential','set']);near(gain.gain.events[2].time,expected[index]+duration);
 });
});

test('rests advance the full silent duration before the following attacks',async t=>{
 const {contexts}=fakeAudio(t),audio=createRhythmAudio();await audio.unlock();audio.playPattern(['quarter-rest','half-rest','whole-rest','quarter','quarter-rest','half']);
 const context=contexts[0],base=context.currentTime+.035;assert.equal(context.oscillators.length,2);near(context.oscillators[0].starts[0],base+7*BEAT);near(context.oscillators[1].starts[0],base+9*BEAT);
 audio.playPattern(['quarter-rest','half-rest','whole-rest']);assert.equal(context.oscillators.length,2,'An all-rest pattern creates no oscillators');assert(context.oscillators.every(osc=>osc.stops.at(-1)===undefined),'Replacing the pattern stops its old voices immediately');
});

test('half, dotted-half and whole notes sustain proportionally; the whole is not truncated by a fixed cap',async t=>{
 const {contexts}=fakeAudio(t),audio=createRhythmAudio();await audio.unlock();audio.playPattern(['half','dotted-half','whole','eighth']);
 const context=contexts[0],base=context.currentTime+.035,beats=[2,3,4,.5],offsets=[0,2,5,9];
 context.oscillators.forEach((osc,index)=>{near(osc.starts[0],base+offsets[index]*BEAT);near(osc.stops[0]-osc.starts[0],beats[index]*BEAT*.82+.025);});
 assert(context.gains[2].gain.events[2].time-context.oscillators[2].starts[0]>1.8,'A four-beat note must keep its full musical gate');
});

test('a new pattern replaces every scheduled old voice without stale ended callbacks stopping its replacement',async t=>{
 const {contexts}=fakeAudio(t),audio=createRhythmAudio();await audio.unlock();audio.playPattern(['sixteenth-group','quarter']);const context=contexts[0],old=[...context.oscillators];
 audio.playPattern(['half']);assert.equal(context.oscillators.length,6);const replacement=context.oscillators.at(-1);
 for(const osc of old){assert.equal(osc.stops.length,2);assert.equal(osc.stops.at(-1),undefined);assert(osc.disconnects>=1);osc.finish();}
 assert.equal(replacement.stops.length,1);audio.stop();assert.equal(replacement.stops.length,2);assert.equal(replacement.stops.at(-1),undefined);assert(context.gains.every(gain=>gain.disconnects>=1));
 const stops=replacement.stops.length;audio.stop();assert.equal(replacement.stops.length,stops,'Repeated stop does not retain or revisit cleared voices');
});

test('naturally ended voices disconnect and leave the active collection',async t=>{
 const {contexts}=fakeAudio(t),audio=createRhythmAudio();await audio.unlock();audio.playPattern(['quarter']);const context=contexts[0],osc=context.oscillators[0],gain=context.gains[0];
 osc.finish();assert.equal(osc.disconnects,1);assert.equal(gain.disconnects,1);audio.stop();assert.equal(osc.stops.length,1,'A completed voice is no longer retained for stopping');
});

test('mute and pause suspension cancel future voices, prevent playback and can resume cleanly',async t=>{
 const {contexts}=fakeAudio(t),audio=createRhythmAudio();await audio.unlock();audio.playPattern(['quarter','whole']);const context=contexts[0];
 await audio.suspend();assert.equal(context.state,'suspended');assert.equal(context.suspends,1);assert(context.oscillators.every(osc=>osc.stops.at(-1)===undefined));
 audio.playPattern(['quarter']);assert.equal(context.oscillators.length,2);await audio.unlock();assert.equal(context.resumes,1);audio.playPattern(['quarter']);assert.equal(context.oscillators.length,3);
 audio.setEnabled(false);assert.equal(context.oscillators.at(-1).stops.at(-1),undefined);audio.playPattern(['whole']);await audio.unlock();assert.equal(context.oscillators.length,3);assert.equal(contexts.length,1);
 audio.setEnabled(true);await audio.unlock();audio.playPattern(['eighth']);assert.equal(context.oscillators.length,4);
});

test('destroy releases its captured context and a restored page can unlock a fresh one even while close is pending',async t=>{
 const {contexts}=fakeAudio(t,{deferClose:true}),audio=createRhythmAudio();await audio.unlock();audio.playPattern(['quarter']);const old=contexts[0],closing=audio.destroy();
 assert.equal(old.closes,1);assert.equal(old.oscillators[0].stops.at(-1),undefined);await audio.unlock();assert.equal(contexts.length,2,'A closed or closing context cannot be reused after page restoration');
 const fresh=contexts[1];audio.playPattern(['half']);assert.equal(fresh.oscillators.length,1);old.finishClose();await closing;assert.equal(old.state,'closed');assert.equal(fresh.state,'running','Late cleanup must not close the restored page’s context');
});

test('an unavailable or denied AudioContext keeps the game silent without throwing',async t=>{
 fakeAudio(t);delete globalThis.AudioContext;const unavailable=createRhythmAudio();await unavailable.unlock();assert.doesNotThrow(()=>unavailable.playPattern(['quarter']));
 globalThis.AudioContext=class{constructor(){throw Error('Audio denied');}};const denied=createRhythmAudio();await assert.doesNotReject(denied.unlock());assert.doesNotThrow(()=>denied.playPattern(['quarter']));
});
