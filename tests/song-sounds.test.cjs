const test=require('node:test'),assert=require('node:assert/strict');
const sounds=require('../song-machine/sound-library.js');
function context(){
 const oscillators=[];const param=()=>({setValueAtTime(value,time){this.value=value;},exponentialRampToValueAtTime(){}});
 return {destination:{},oscillators,createGain(){return {gain:param(),connect(){return this;}};},createOscillator(){const oscillator={frequency:param(),detune:param(),connect(){return this;},start(time){this.started=time;},stop(time){this.stopped=time;}};oscillators.push(oscillator);return oscillator;}};
}
test('each bonus sound schedules a distinct playable synthesis profile with bounded voices',()=>{
 const signatures=[];
 for(const sound of sounds.EXTRA){const ctx=context(),voices=[];assert.equal(sounds.scheduleTone(ctx,69,3,.5,sound.id,.7,ctx.destination,voices),true);assert.ok(voices.length>=2&&voices.length<=4);assert.equal(voices.length,ctx.oscillators.length);assert.ok(voices.every(voice=>voice.started===3&&voice.stopped>3.5&&voice.stopped<4));signatures.push(JSON.stringify(voices.map(voice=>[voice.type,voice.frequency.value,voice.detune.value])));}
 assert.equal(new Set(signatures).size,8,'Bonus instruments must differ in their audio synthesis, beyond names');
});
test('unrecognized old voices fall through and muted bonus sounds schedule no audio',()=>{
 const ctx=context();assert.equal(sounds.scheduleTone(ctx,60,0,1,9,.7),false);assert.equal(sounds.scheduleTone(ctx,60,0,1,17,0),true);assert.equal(ctx.oscillators.length,0);
});
