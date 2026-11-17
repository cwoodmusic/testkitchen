/** Short local character voices and wooden pratfalls, independent of music. */
const VOICES=Object.freeze({nell:[220,'triangle'],iris:[270,'sine'],pip:[440,'triangle'],mira:[350,'triangle'],oren:[185,'sine']});
const spoken=character=>/[\p{L}\p{N}]/u.test(character);

/** One lazy context survives room changes. No waveform or remote audio files. */
export function createCinematicAudio({enabled=true}={}){
 let context=null,allowed=!!enabled,lastBloop=-Infinity,lastKnock=-Infinity,serial=0;
 const voices=new Set();
 function stop(){
  for(const voice of voices){voice.osc.onended=null;try{voice.osc.stop();}catch{}try{voice.osc.disconnect();voice.gain.disconnect();}catch{}}
  voices.clear();lastBloop=-Infinity;lastKnock=-Infinity;
 }
 async function unlock(){
  if(!allowed)return;
  try{const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;context??=new Audio();if(context.state==='suspended')await context.resume();}catch{}
 }
 function tone(frequency,type,duration,volume,{endFrequency=frequency}={}){
  if(!allowed||context?.state!=='running'||voices.size>=6)return false;
  try{
   const osc=context.createOscillator(),gain=context.createGain(),voice={osc,gain},start=context.currentTime+.003;
   osc.type=type;osc.frequency.setValueAtTime(frequency,start);
   if(endFrequency!==frequency)osc.frequency.exponentialRampToValueAtTime(endFrequency,start+duration);
   gain.gain.setValueAtTime(.0001,start);gain.gain.linearRampToValueAtTime(volume,start+.003);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
   osc.connect(gain);gain.connect(context.destination);voices.add(voice);
   osc.onended=()=>{voices.delete(voice);osc.disconnect();gain.disconnect();};
   osc.start(start);osc.stop(start+duration+.008);return true;
  }catch{return false;}
 }
 function bloop(speaker='mira'){
  if(!allowed||context?.state!=='running'||context.currentTime-lastBloop<.055)return false;
  const [base,type]=VOICES[speaker]??VOICES.mira,frequency=base*[1,1.04,.98,1.02][serial++%4];
  if(!tone(frequency,type,.035,.025,{endFrequency:frequency*.92}))return false;
  lastBloop=context.currentTime;return true;
 }
 function knock(kind='fallen'){
  if(!allowed||context?.state!=='running'||context.currentTime-lastKnock<.08)return false;
  const falling=kind==='fallen',frequency=falling?145:205;
  if(!tone(frequency,'triangle',falling?.085:.055,falling?.055:.035,{endFrequency:falling?70:115}))return false;
  lastKnock=context.currentTime;return true;
 }
 function createTrack(){
  let previous=null,characters=[],caption='',disposed=false;
  function sample(state,{visibleCharacters=0,audible=false}={}){
   if(disposed||!state)return;
   const beat=state.beat,nextCaption=beat?`${beat.id??state.index}|${beat.speaker??beat.actor}|${beat.text??''}`:'',changed=caption!==nextCaption;
   if(changed){caption=nextCaption;characters=Array.from(beat?.text??'');}
   const count=Math.max(0,Math.min(characters.length,Math.floor(visibleCharacters)||0));
   const pip=state.actors?.find(actor=>actor.id==='pip'),gesture=pip?.gesture;
   const clip=state.activeClips?.find(clip=>clip.kind==='gesture'&&clip.actor==='pip'&&clip.gesture===gesture);
   const gestureId=clip?.id??(gesture?`${gesture}`:'');
   const advancing=!!previous&&state.phase==='story'&&previous.phase==='story'&&state.currentTile>previous.tile&&state.currentTile-previous.tile<=4;
   if(audible&&state.playing&&!state.finished&&advancing){
    const first=changed?0:previous.visible;
    // One short voice at most per paint; a stalled frame never replays a queue.
    if(count>first&&count-first<=8&&characters.slice(first,count).some(spoken))bloop(beat?.speaker??beat?.actor);
    if((gesture==='trip'||gesture==='fallen')&&gestureId!==previous.gestureId)knock(gesture);
   }
   previous={phase:state.phase,tile:state.currentTile,visible:count,gestureId};
  }
  return Object.freeze({sample,stop,destroy(){if(disposed)return;disposed=true;previous=null;stop();}});
 }
 return Object.freeze({unlock,bloop,knock,createTrack,stop,setEnabled(value){allowed=!!value;if(!allowed)stop();},async suspend(){stop();try{if(context?.state==='running')await context.suspend();}catch{}},async destroy(){stop();const old=context;context=null;try{await old?.close();}catch{}}});
}
