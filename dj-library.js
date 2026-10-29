/* Original house music and the Song Machine JSON format, playable as a guest. */
(function(root){
 'use strict';
 const meters=['4/4','2/4','3/4','5/4','6/8','9/8','12/8'];
 function valid(song){
  if(!song||!Number.isFinite(song.bpm)||song.bpm<40||song.bpm>240||!Number.isInteger(song.bars)||song.bars<1||song.bars>16||!meters.includes(song.meter))return false;
  if(!Array.isArray(song.tracks)||song.tracks.length>12||!Array.isArray(song.drums)||song.drums.length!==3)return false;
  const [top,bottom]=song.meter.split('/').map(Number),end=song.bars*top*16/bottom;
  let count=0;
  return [...song.tracks,...song.drums].every((track,index)=>{
   if(!track||!Array.isArray(track.notes)||(count+=track.notes.length)>8192||!Number.isInteger(track.sound)||track.sound<0||track.sound>(index<song.tracks.length?17:4)||!Number.isFinite(track.volume)||track.volume<0||track.volume>1)return false;
   return track.notes.every(note=>note&&Number.isFinite(note.t)&&note.t>=0&&note.t<end&&Number.isFinite(note.d)&&note.d>0&&note.d<=64&&(index>=song.tracks.length||Number.isFinite(note.p)&&note.p>=0&&note.p<=127));
  });
 }
 // Composition time is measured in sixteenth-note steps, matching Song Machine.
 const sections=labels=>Object.freeze(labels.map((label,index)=>Object.freeze({startBar:index*4,bars:4,role:['theme','answer','breakdown','return'][index],label})));
 function builder(bpm,meter,voices){
  const [top,bottom]=meter.split('/').map(Number),barSteps=top*16/bottom;
  const tracks=voices.map(([name,sound,volume],index)=>({id:index+1,name,sound,volume,mute:false,notes:[]}));
  const drums=[{sound:0,volume:.19,mute:false,notes:[]},{sound:3,volume:.12,mute:false,notes:[]},{sound:3,volume:.065,mute:false,notes:[]}];
  const add=(track,bar,at,pitch,length)=>{
   if(!Number.isFinite(at)||at<0||at>=barSteps)return;
   const d=Math.min(length,barSteps-at);if(d<=0)return;
   track.notes.push({p:pitch,t:bar*barSteps+at,d});
  };
  return {tracks,drums,barSteps,n:(index,bar,at,pitch,length)=>add(tracks[index],bar,at,pitch,length),drum:(index,bar,at)=>add(drums[index],bar,at,[45,57,88][index],1),
   finish(){for(const track of [...tracks,...drums])track.notes.sort((a,b)=>a.t-b.t||a.p-b.p);return {bpm,bars:16,meter,root:0,scale:'chromatic',tracks,drums};}};
 }
 const min=root=>({root,third:3}),maj=root=>({root,third:4});
 function house(id,title,bpm,tonic,hook,sound,progressions,style){
  const b=builder(bpm,'4/4',[['Lead',sound,sound===0?.27:.34],['Bass',7,.35],['Harmony',style==='lounge'?2:4,.12],['Counter melody',style==='lounge'?3:8,.10]]);
  const opening=progressions[0][0],openingPalette=[0,opening.third,7,12,14,opening.third+12],firstPitch=tonic+opening.root+12+openingPalette[hook[0]];
  for(let bar=0;bar<16;bar++){
   const part=Math.floor(bar/4),within=bar%4,chord=progressions[part][within],root=tonic+chord.root,palette=[0,chord.third,7,12,14,chord.third+12];
   // The central four bars strip the groove back, then rebuild into the return.
   const sparse=part===2&&within<2;
   let positions=sparse?(within===0?[0,8]:[]):part===1?[0,3,6,8,11,14]:part===3&&within%2?[0,4,8,12,14]:[0,4,8,12];
   positions.forEach((at,index)=>{
    const motif=part===1?hook[(7-index+within)%hook.length]:hook[(within*4+index)%hook.length],pitch=root+12+palette[motif];
    const next=positions[index+1]??16;
    b.n(0,bar,at,bar===15&&index===positions.length-1?firstPitch-1:pitch,Math.min(next-at-.25,sparse?6:3.3));
   });
   const bassPositions=sparse?[0]:style==='bounce'?[0,6,8,14]:[0,8];
   bassPositions.forEach((at,index)=>b.n(1,bar,at,root-12+(bar!==15&&index%2?7:0),sparse?11:style==='lounge'?6.4:3.4));
   const harmonyAt=part===1?2:0,harmonyLength=sparse?14:style==='bounce'?5.5:13;
   for(const interval of [0,chord.third,7,...(style==='lounge'?[chord.third===3?10:11]:[])])b.n(2,bar,harmonyAt,root+interval,harmonyLength);
   if(part===1||part===3){for(const at of (within%2?[6,14]:[10]))b.n(3,bar,at,root+palette[part===3?1:2],1.6);}
   if(part===2&&within===1)b.n(3,bar,12,tonic+19,3);
   const kick=sparse?(within===0?[0]:[]):part===1&&within===3?[0,8,12]:[0,4,8,12];
   kick.forEach(at=>b.drum(0,bar,at));
   if(!sparse){[4,12].forEach(at=>b.drum(1,bar,at));const hats=part===1||part===3?[0,2,4,6,8,10,12,14]:[2,6,10,14];hats.forEach(at=>b.drum(2,bar,at));}
   if(within===3&&bar!==15)[12,14,15].forEach(at=>b.drum(1,bar,at));
   if(bar===15){b.drum(1,bar,14);b.drum(2,bar,15);}
  }
  return {id,title,description:style==='lounge'?'Warm flute and piano, a contrasting answer, a quiet middle, and a returning groove.':style==='bounce'?'A bouncy synth groove with offbeat bass, new answers, a breakdown, and a final lift.':'An original neon groove with a new answer, a spacious middle, and a bright return.',sections:sections(['Main groove','New answer','Breakdown and rebuild','Return and turnaround']),composition:b.finish()};
 }
 function shanty(){
  const b=builder(96,'6/8',[['Flute call',6,.31],['Reed answer',4,.16],['Round bass',1,.33],['Plucked chords',8,.13]]),tonic=62;
  const harmony=[min(0),maj(-2),maj(-4),maj(7)];
  for(let bar=0;bar<16;bar++){
   const part=Math.floor(bar/4),within=bar%4,chord=harmony[within],root=tonic+chord.root,tones=[0,chord.third,7,12];
   const call=part===0||part===3,breakdown=part===2;
   const positions=breakdown?(within<2?[0,6]:[0,4,6,10]):call?[0,2,4,6,8,10]:[0,3,6,9];
   const callMotifs=[[0,1,2,1,0,1],[1,2,3,2,1,0],[2,1,0,1,2,1],[1,2,1,0,2,1]],answerMotifs=[[3,2,1,0],[2,1,2,0],[1,2,3,2],[2,1,0,0]];
   positions.forEach((at,index)=>{
    const degree=(call?callMotifs[within]:answerMotifs[within])[index%(call?6:4)],next=positions[index+1]??12;
    const pitch=bar===15&&index===positions.length-1?tonic+11:root+12+tones[degree];
    b.n(call?0:1,bar,at,pitch,Math.min(next-at-.25,breakdown?5:2.7));
   });
   for(const at of (breakdown&&within<2?[0]:[0,6]))b.n(2,bar,at,root-12+(bar!==15&&at?7:0),4.8);
   if(!breakdown||within%2===0)for(const interval of [0,chord.third,7])b.n(3,bar,0,root+interval,10.5);
   if(part===3&&within<3)b.n(1,bar,9,root+tones[1],2.5);
   if(!breakdown||within>=2){[0,6].forEach(at=>b.drum(0,bar,at));b.drum(1,bar,6);[2,4,8,10].forEach(at=>b.drum(2,bar,at));}
   if(within===3&&bar!==15)[8,10,11].forEach(at=>b.drum(1,bar,at));
  }
  return {id:'lanternwake-shanty',title:'Lanternwake Shanty',description:'An original sea shanty in 6/8: a flute call, a reed response, a quiet deck, and all hands returning.',unlock:Object.freeze({kind:'fish',count:5}),sections:sections(['Captain’s call','Crew’s answer','Quiet deck','All hands return']),composition:b.finish()};
 }
 function waltz(){
  const b=builder(78,'3/4',[['Starlight bell',3,.23],['Piano answers',2,.16],['Waltz bass',1,.30],['Soft harmony',6,.10]]),tonic=55;
  const progressions=[[maj(0),maj(5),min(2),maj(7)],[min(4),maj(0),maj(5),maj(7)],[min(4),min(2),maj(5),maj(7)],[maj(0),maj(5),maj(0),maj(7)]];
  for(let bar=0;bar<16;bar++){
   const part=Math.floor(bar/4),within=bar%4,chord=progressions[part][within],root=tonic+chord.root,palette=[0,chord.third,7,12];
   const lead=part===1?1:0,positions=part===2?(within<2?[0]:[0,8]):part===3?[0,4,6,8,10]:[0,4,8];
   positions.forEach((at,index)=>{const next=positions[index+1]??12,pitch=bar===15&&index===positions.length-1?tonic+11:root+12+palette[(index+(part===1?2:within))%4];b.n(lead,bar,at,pitch,Math.min(next-at-.3,part===2?8:3.4));});
   b.n(2,bar,0,root-12,3.5);
   if(part!==2||within>=2)for(const at of [4,8])for(const interval of [chord.third,7])b.n(1,bar,at,root+interval,2.6);
   if(part===2||part===3)for(const interval of [0,chord.third,7])b.n(3,bar,0,root+interval,10.5);
   if(part!==2){b.drum(0,bar,0);[4,8].forEach(at=>b.drum(2,bar,at));if(part===3)b.drum(1,bar,8);}
   if(within===3&&bar!==15)[8,10].forEach(at=>b.drum(2,bar,at));
  }
  return {id:'starlight-waltz',title:'Starlight Waltz',description:'An original three-beat waltz with bell phrases, piano answers, a hushed bridge, and a sparkling return.',unlock:Object.freeze({kind:'level',level:4}),sections:sections(['Bell theme','Piano answer','Hushed bridge','Sparkling return']),composition:b.finish()};
 }
 const songs=Object.freeze([
  house('neon-afterhours','Neon Afterhours',110,60,[0,2,3,2,1,4,2,1],0,[[min(0),maj(-4),maj(3),maj(-2)],[min(5),min(0),maj(-4),maj(7)],[min(0),maj(3),min(5),maj(7)],[min(0),maj(-4),min(5),maj(7)]],'neon'),
  house('velvet-lounge','Velvet Lounge',86,57,[1,2,4,2,3,2,1,0],6,[[min(0),min(5),maj(-4),maj(7)],[maj(3),maj(-2),min(5),maj(7)],[min(0),maj(-4),min(5),maj(7)],[min(0),min(5),maj(-4),maj(7)]],'lounge'),
  house('mirrorball-bounce','Mirrorball Bounce',124,62,[0,3,2,4,1,2,3,2],1,[[min(0),maj(3),maj(-2),maj(7)],[min(5),maj(-4),min(0),maj(7)],[min(0),maj(3),min(5),maj(7)],[min(0),maj(3),min(5),maj(7)]],'bounce'),
  shanty(),waltz(),
  {...house('first-steps','First Steps',88,60,[0,1,2,3,2,1,0,4],8,[[maj(0),maj(5),min(9),maj(7)],[min(2),maj(5),maj(0),maj(7)],[min(9),min(2),maj(5),maj(7)],[maj(0),maj(5),min(9),maj(7)]],'neon'),description:'A bright plucked melody, an easygoing dance groove, and a joyful return to celebrate your first complete dance.',unlock:Object.freeze({kind:'achievement',id:'dance-first-finish',label:'First Steps'})},
  {...house('midnight-headliner','Midnight Headliner',100,57,[0,3,5,2,4,3,1,2],3,[[min(0),maj(3),maj(5),maj(7)],[maj(8),maj(3),min(0),maj(7)],[min(5),maj(8),maj(3),maj(7)],[min(0),maj(5),maj(3),maj(7)]],'bounce'),description:'Celebratory bell hooks and a bouncing bass answer build through a quiet middle into a sparkling headliner finale.',unlock:Object.freeze({kind:'achievement',id:'dance-hard-groove',label:'DJ Coda’s Headliner'})}
 ].map(record=>Object.freeze(record)));
 const recordFor=value=>typeof value==='string'?songs.find(record=>record.id===value):value&&typeof value==='object'?songs.find(record=>record.id===value.id)||value:null;
 function isUnlocked(value,progress={}){
  const record=recordFor(value);if(!record||typeof record!=='object')return false;progress=progress&&typeof progress==='object'?progress:{};
  const rule=record.unlock;if(!rule)return true;
  if(rule.kind==='fish')return Number.isSafeInteger(progress.fishCaught)&&progress.fishCaught>=rule.count;
  if(rule.kind==='level')return Number.isSafeInteger(progress.level)&&progress.level>=rule.level;
  if(rule.kind==='achievement')return (Array.isArray(progress.achievements)?progress.achievements:progress.achievements instanceof Set?[...progress.achievements]:[]).includes(rule.id);
  return false;
 }
 function requirement(value){const rule=recordFor(value)?.unlock;if(!rule)return '';if(rule.kind==='fish')return 'Catch '+rule.count+' fish to unlock this sea shanty.';if(rule.kind==='level')return 'Reach musician level '+rule.level+' to unlock this waltz.';if(rule.kind==='achievement')return 'Earn '+(rule.label||rule.id)+' to unlock this track.';return 'Keep exploring to unlock this track.';}
 const library=Object.freeze({songs,valid,isUnlocked,requirement});
 if(typeof module==='object'&&module.exports)module.exports=library;
 else root.CodaDJLibrary=library;
})(typeof window==='object'?window:globalThis);
