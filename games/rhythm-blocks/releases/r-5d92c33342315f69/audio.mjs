import {NOTE_KIND_BY_ID} from './engine.mjs';

const COUNT_IN_BEATS=4;
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

/** A local synthesizer with a four-beat count-in and a quiet, accented pulse. */
export function createRhythmAudio({enabled=true,bpm=108,noteKinds=NOTE_KIND_BY_ID}={}){
 let context=null,allowed=enabled,voices=new Set(),tempo=108,catalog=NOTE_KIND_BY_ID,playback=null;
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
 function stop(){playback=null;for(const voice of voices){try{voice.osc.stop();}catch{}voice.osc.disconnect();voice.gain.disconnect();}voices.clear();}
 async function unlock(){
  if(!allowed)return;
  try{const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;context??=new Audio();if(context.state==='suspended')await context.resume();}catch{}
 }
 function connectVoice(osc,gain,start,end){
  const voice={osc,gain};osc.connect(gain);gain.connect(context.destination);voices.add(voice);
  osc.onended=()=>{voices.delete(voice);osc.disconnect();gain.disconnect();};osc.start(start);osc.stop(end);
 }
 function click({time:start,accent,countIn}){
  const osc=context.createOscillator(),gain=context.createGain(),duration=.035;
  osc.type='sine';osc.frequency.setValueAtTime(accent?1760:1180,start);osc.frequency.exponentialRampToValueAtTime(accent?880:590,start+.026);
  const peak=countIn?(accent ? .045 : .033):(accent ? .022 : .015);
  gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(peak,start+.0015);gain.gain.exponentialRampToValueAtTime(.001,start+duration);gain.gain.setValueAtTime(0,start+duration+.004);
  connectVoice(osc,gain,start,start+duration+.008);
 }
 function state(){
  if(!playback||!allowed||context?.state!=='running'||context.currentTime>=playback.endTime)return freeze({playing:false,phase:'idle',beat:null,beatIndex:null});
  const countIn=context.currentTime<playback.patternStartTime,offset=context.currentTime-(countIn?playback.startTime:playback.patternStartTime),index=Math.max(0,Math.floor(offset/playback.beatSeconds));
  return freeze({...playback,playing:true,phase:countIn?'count-in':'pattern',beat:index%4+1,beatIndex:index});
 }
 function playPattern(kinds){
  stop();if(!allowed||!context||context.state!=='running')return;
  const checked=Array.isArray(kinds)?kinds.filter(id=>Object.hasOwn(catalog,id)):[];
  if(!checked.length)return;
  const beat=60/tempo,startTime=context.currentTime+.035,patternStartTime=startTime+COUNT_IN_BEATS*beat,totalBeats=checked.reduce((sum,id)=>sum+catalog[id].beats,0),ticks=[],notes=[];
  for(let index=0;index<COUNT_IN_BEATS;index++)ticks.push({time:startTime+index*beat,beat:index+1,beatIndex:index,accent:index===0,countIn:true});
  for(let index=0;index<totalBeats;index++)ticks.push({time:patternStartTime+index*beat,beat:index%4+1,beatIndex:index,accent:index%4===0,countIn:false});
  for(const tick of ticks)click(tick);
  let cursor=patternStartTime;
  for(const id of checked){
   const kind=catalog[id];
   const divisions=kind.subdivisions??((id==='eighth-pair'||id==='sixteenth-pair')?2:id==='sixteenth-group'?4:1);
   if(!kind.rest)for(let part=0;part<divisions;part++){
    const start=cursor+part*kind.beats*beat/divisions,duration=kind.beats*beat/divisions*.82;
    const osc=context.createOscillator(),gain=context.createGain();
    osc.type='triangle';osc.frequency.setValueAtTime(part===0?523.25:659.25,start);
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.11,start+Math.min(.009,duration*.25));gain.gain.exponentialRampToValueAtTime(.001,start+duration);gain.gain.setValueAtTime(0,start+duration+.015);
    connectVoice(osc,gain,start,start+duration+.025);notes.push({id,part,time:start,duration});
   }
   cursor+=kind.beats*beat;
  }
  playback=freeze({startTime,patternStartTime,endTime:patternStartTime+totalBeats*beat,beatSeconds:beat,countInBeats:COUNT_IN_BEATS,totalBeats,bpm:tempo,ticks,notes});
  return playback;
 }
 return {unlock,playPattern,stop,setDefinition,get state(){return state();},setEnabled(value){allowed=!!value;if(!allowed)stop();},async suspend(){stop();try{if(context?.state==='running')await context.suspend();}catch{}},async destroy(){stop();const previous=context;context=null;try{await previous?.close();}catch{}}};
}
