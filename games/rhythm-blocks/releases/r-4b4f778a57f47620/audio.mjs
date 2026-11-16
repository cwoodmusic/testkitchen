import {NOTE_KIND_BY_ID} from './engine.mjs';

/** A small, local synthesizer. Rests advance time without making a sound. */
export function createRhythmAudio({enabled=true,bpm=108,noteKinds=NOTE_KIND_BY_ID}={}){
 let context=null,allowed=enabled,voices=new Set(),tempo=108,catalog=NOTE_KIND_BY_ID;
 function setDefinition({bpm:nextTempo=108,noteKinds:nextKinds=NOTE_KIND_BY_ID}={}){
  const entries=Array.isArray(nextKinds)?nextKinds:Object.values(nextKinds??{});
  if(!Number.isFinite(nextTempo)||nextTempo<20||nextTempo>400||!entries.length)throw new TypeError('Invalid rhythm playback settings.');
  const checked={};
  for(const kind of entries){
   if(typeof kind.id!=='string'||!Number.isFinite(kind.units)||kind.units<=0||typeof kind.rest!=='boolean'||kind.subdivisions!==undefined&&(!Number.isInteger(kind.subdivisions)||kind.subdivisions<1||kind.subdivisions>16))throw new TypeError('Invalid rhythm note timing.');
   checked[kind.id]={...kind,beats:kind.units/2};
  }
  stop();tempo=nextTempo;catalog=checked;
 }
 setDefinition({bpm,noteKinds});
 function stop(){for(const voice of voices){try{voice.osc.stop();}catch{}voice.osc.disconnect();voice.gain.disconnect();}voices.clear();}
 async function unlock(){
  if(!allowed)return;
  try{const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;context??=new Audio();if(context.state==='suspended')await context.resume();}catch{}
 }
 function playPattern(kinds){
  stop();if(!allowed||!context||context.state!=='running')return;
  const beat=60/tempo;let cursor=context.currentTime+.035;
  for(const id of kinds){
   const kind=catalog[id];if(!kind)continue;
   const divisions=kind.subdivisions??((id==='eighth-pair'||id==='sixteenth-pair')?2:id==='sixteenth-group'?4:1);
   if(!kind.rest)for(let part=0;part<divisions;part++){
    const start=cursor+part*kind.beats*beat/divisions,duration=kind.beats*beat/divisions*.82;
    const osc=context.createOscillator(),gain=context.createGain(),voice={osc,gain};
    osc.type='triangle';osc.frequency.setValueAtTime(part===0?523.25:659.25,start);
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.11,start+Math.min(.009,duration*.25));gain.gain.exponentialRampToValueAtTime(.001,start+duration);gain.gain.setValueAtTime(0,start+duration+.015);
    osc.connect(gain);gain.connect(context.destination);voices.add(voice);osc.onended=()=>{voices.delete(voice);osc.disconnect();gain.disconnect();};osc.start(start);osc.stop(start+duration+.025);
   }
   cursor+=kind.beats*beat;
  }
 }
 return {unlock,playPattern,stop,setDefinition,setEnabled(value){allowed=!!value;if(!allowed)stop();},async suspend(){stop();try{if(context?.state==='running')await context.suspend();}catch{}},async destroy(){stop();const previous=context;context=null;try{await previous?.close();}catch{}}};
}
