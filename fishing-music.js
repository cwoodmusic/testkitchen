/* Original lake accompaniment. This module plans music; the room owns audio. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaFishingMusic=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const METERS=Object.freeze({
  '4/4':Object.freeze({barBeats:4,pulseBeats:1,secondPulse:2,melody:[1,3]}),
  '6/8':Object.freeze({barBeats:3,pulseBeats:1.5,secondPulse:1.5,melody:[.5,2.5]}),
  '2/2':Object.freeze({barBeats:4,pulseBeats:2,secondPulse:2,melody:[1,3]})
 });
 const CHORDS=Object.freeze([
  Object.freeze({name:'Am',bass:45,voices:Object.freeze([57,60,64])}),
  Object.freeze({name:'F',bass:41,voices:Object.freeze([53,57,60])}),
  Object.freeze({name:'Cmaj7',bass:48,voices:Object.freeze([55,59,64])}),
  Object.freeze({name:'G',bass:43,voices:Object.freeze([55,59,62])})
 ]);
 const MELODY=Object.freeze([[64,60],[62,57],[59,64],[62,59],[60,64],[57,55],[64,59],[57,62]].map(Object.freeze));
 const THEME=Object.freeze({title:'Lantern Lake',key:'A minor / C major',bars:8,credit:'Original Coda Arcade accompaniment',
  progression:Object.freeze(CHORDS.map(chord=>chord.name)),
  meterFeel:Object.freeze({'4/4':'Four quarter-note beats','6/8':'Two dotted-quarter beats, each divided into three','2/2':'Two half-note beats'})});
 // Original eight-bar arrangements. Encounter identity fixes the key, motif
 // and instruments before scheduling, so overlapping lookaheads agree.
 function arrangement(id,title,key,chords,melody,lead='sine'){
  return Object.freeze({id,title,key,lead,chords:Object.freeze(chords.map(([name,bass,voices])=>Object.freeze({name,bass,voices:Object.freeze(voices)}))),melody:Object.freeze(melody.map(Object.freeze))});
 }
 const ARRANGEMENTS=Object.freeze([
  arrangement('lantern','Lantern Lake','A minor / C major',CHORDS.map(c=>[c.name,c.bass,[...c.voices]]),MELODY.map(n=>[...n])),
  arrangement('silver','Silver Ripples','C major',[
   ['C',48,[60,64,67]],['Am',45,[60,64,69]],['F',41,[57,60,65]],['G',43,[59,62,67]]
  ],[[72,76],[74,72],[69,72],[71,74],[76,72],[72,69],[74,71],[67,72]],'triangle'),
  arrangement('reed','Reedwater Reel','D minor',[
   ['Dm',50,[57,62,65]],['C',48,[55,60,64]],['Gm',43,[58,62,67]],['A',45,[57,61,64]]
  ],[[69,65],[67,64],[70,67],[69,73],[74,69],[72,67],[70,65],[73,69]],'triangle'),
  arrangement('deep','Catfish Strut','D dorian',[
   ['Dm7',50,[60,65,69]],['G',43,[59,62,67]],['C',48,[60,64,67]],['Dm',50,[57,62,65]]
  ],[[65,69],[67,62],[64,67],[65,62],[69,72],[71,67],[67,64],[62,65]],'triangle'),
  arrangement('moon','Moonlit Drift','A minor',[
   ['Am',45,[60,64,69]],['Em',40,[59,64,67]],['Fmaj7',41,[57,60,64]],['Am',45,[57,60,64]]
  ],[[76,72],[71,67],[69,72],[76,69],[72,76],[67,71],[72,69],[64,69]]),
  arrangement('prism','Prism Waltz','F major',[
   ['F',41,[60,65,69]],['Dm',50,[62,65,69]],['Bb',46,[58,62,65]],['C',48,[60,64,67]]
  ],[[77,72],[74,69],[70,74],[76,72],[72,77],[69,74],[74,70],[67,72]],'triangle'),
  arrangement('ancient','The Ancient Current','E minor',[
   ['Em',52,[59,64,67]],['Cmaj7',48,[59,64,67]],['Am',45,[60,64,69]],['B',47,[59,63,66]]
  ],[[76,71],[79,76],[81,76],[78,75],[83,79],[76,71],[81,76],[75,71]])
 ]);
 function encounterArrangement(fish){
  if(!fish||typeof fish!=='object'||typeof fish.id!=='string')return{arrangement:ARRANGEMENTS[0],rotation:0,transpose:0};
  const shape=fish.shape||fish.silhouette||'',index=fish.rarity==='legendary'?6:['eel','long'].includes(shape)?4:shape==='catfish'?3:['round','angel','dragon'].includes(shape)?5:['slender','spotted','striped'].includes(shape)?1:2;
  let hash=0;for(const letter of fish.id)hash=(Math.imul(hash,31)+letter.charCodeAt(0))>>>0;
  return{arrangement:ARRANGEMENTS[index],rotation:hash%8,transpose:[-2,0,2][Math.floor(hash/8)%3]};
 }
 function getThemeInfo(fish){
  if(!fish)return THEME;
  const {arrangement:theme,transpose}=encounterArrangement(fish);
  return Object.freeze({...THEME,id:theme.id,title:theme.title,key:theme.key,transpose,progression:Object.freeze(theme.chords.map(chord=>chord.name))});
 }
 const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
 const frequency=midi=>440*Math.pow(2,(midi-69)/12);
 function meterFor(value){const id=typeof value==='string'?value:value?.id;return Object.hasOwn(METERS,id)?{id,...METERS[id]}:null;}
 function plan(state={},options={}){
  if(!state||typeof state!=='object'||!options||typeof options!=='object')return Object.freeze([]);
  const mode=options.mode||'battle',meter=meterFor(state.meter||state.meterInfo?.id||'4/4');
  if(!meter||!['battle','explore'].includes(mode)||state.paused||state.hiddenPause||mode==='battle'&&(state.result||['caught','escaped','aborted'].includes(state.phase)))return Object.freeze([]);
  const beat=finite(state.beat,0),from=Math.max(0,finite(options.fromBeat,beat-.25)),requestedEnd=finite(options.toBeat,beat+2),to=Math.min(requestedEnd,from+meter.barBeats*8);
  if(to<=from)return Object.freeze([]);
  let timeAtBeat=options.timeAtBeat||state.timeAtBeat;
  if(typeof timeAtBeat!=='function'){
   // Instantaneous seconds-per-beat cannot predict a changing tempo. A caller
   // without the exact map gets silence instead of an out-of-time backing.
   if(state.tempo?.change&&state.tempo.change!=='steady')return Object.freeze([]);
   const seconds=finite(state.secondsPerBeat,60/finite(state.quarterBpm,76)),origin=finite(state.musicStart,finite(state.startTime,0)+finite(state.countInSeconds,0));
   if(!(seconds>0))return Object.freeze([]);
   timeAtBeat=value=>origin+value*seconds;
  }
  // Decide the arrangement from immutable encounter metadata. It must not
  // change while a scheduled bar accelerates across a tempo threshold.
  const tempo=state.tempo||state.fish?.tempo||{},fast=mode==='battle'&&((state.fish?.rarityRank||0)>=3||Math.max(finite(tempo.startQuarterBpm,0),finite(tempo.endQuarterBpm,0),tempo.change==='steady'?finite(state.quarterBpm,0):0)>=156),level=mode==='explore'?.65:1,events=[];
  const {arrangement:theme,rotation,transpose}=encounterArrangement(mode==='battle'?state.fish:null);
  const first=Math.floor(from/meter.barBeats),last=Math.floor((to-1e-9)/meter.barBeats);
  function add(bar,part,slot,offset,durationBeats,midi,volume,accent=1){
   const at=bar*meter.barBeats+offset;if(at<from-1e-9||at>=to-1e-9)return;
   const time=timeAtBeat(at),end=timeAtBeat(at+durationBeats);
   if(!Number.isFinite(time)||!Number.isFinite(end)||end<=time)return;
   midi+=transpose;
   events.push(Object.freeze({id:'music:'+mode+':'+theme.id+':'+meter.id.replace('/','-')+':'+bar+':'+part+':'+slot,
    mode,meter:meter.id,bar,part,beat:at,durationBeats,time,durationSeconds:end-time,midi,frequency:frequency(midi),
    volume:volume*accent*level*2.7,accent,theme:theme.id,type:part==='melody'?theme.lead:'triangle'}));
  }
  for(let bar=first;bar<=last;bar++){
   const chord=theme.chords[bar%theme.chords.length],melody=theme.melody[(bar+rotation)%theme.melody.length],pulse=meter.pulseBeats,second=meter.secondPulse;
   add(bar,'bass','root',0,Math.min(1.2,pulse*.72),chord.bass,.12);
   chord.voices.forEach((midi,index)=>add(bar,'chord','down-'+index,0,pulse*(fast?.5:.78),midi,.035));
   add(bar,'bass','answer',second,Math.min(1.1,pulse*.6),chord.bass+7,.12,.72);
   if(fast){
    add(bar,'melody','answer',meter.melody[1],Math.min(.55,pulse*.5),melody[1],.07,.72);
   }else{
    add(bar,'melody','question',meter.melody[0],Math.min(.6,pulse*.5),melody[0],.07,.78);
    chord.voices.slice(1).forEach((midi,index)=>add(bar,'chord','answer-'+index,second,pulse*.55,midi,.035,.68));
    add(bar,'melody','answer',meter.melody[1],Math.min(.55,pulse*.5),melody[1],.07,.72);
   }
  }
  return Object.freeze(events.sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id)));
 }
 return Object.freeze({plan,frequency,getThemeInfo});
});
