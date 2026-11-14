import {NOTE_KIND_BY_ID} from './engine.mjs?v=rhythm-blocks-1';

/** A small, local synthesizer. Rests advance time without making a sound. */
export function createRhythmAudio({enabled=true}={}){
 let context=null,allowed=enabled,voices=new Set();
 function stop(){for(const voice of voices){try{voice.osc.stop();}catch{}voice.osc.disconnect();voice.gain.disconnect();}voices.clear();}
 async function unlock(){
  if(!allowed)return;
  try{const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;context??=new Audio();if(context.state==='suspended')await context.resume();}catch{}
 }
 function playPattern(kinds){
  stop();if(!allowed||!context||context.state!=='running')return;
  const beat=60/108;let cursor=context.currentTime+.035;
  for(const id of kinds){
   const kind=NOTE_KIND_BY_ID[id];if(!kind)continue;
   const divisions=id==='eighth-pair'?2:id==='sixteenth-group'?4:1;
   if(!kind.rest)for(let part=0;part<divisions;part++){
    const start=cursor+part*kind.beats*beat/divisions,duration=kind.beats*beat/divisions*.82;
    const osc=context.createOscillator(),gain=context.createGain(),voice={osc,gain};
    osc.type='triangle';osc.frequency.setValueAtTime(part===0?523.25:659.25,start);
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.11,start+.009);gain.gain.exponentialRampToValueAtTime(.001,start+duration);gain.gain.setValueAtTime(0,start+duration+.015);
    osc.connect(gain);gain.connect(context.destination);voices.add(voice);osc.onended=()=>{voices.delete(voice);osc.disconnect();gain.disconnect();};osc.start(start);osc.stop(start+duration+.025);
   }
   cursor+=kind.beats*beat;
  }
 }
 return {unlock,playPattern,stop,setEnabled(value){allowed=!!value;if(!allowed)stop();},async suspend(){stop();try{if(context?.state==='running')await context.suspend();}catch{}},async destroy(){stop();const previous=context;context=null;try{await previous?.close();}catch{}}};
}
