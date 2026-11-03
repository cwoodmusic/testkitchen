/* Ten original sixteen-bar songs, fixed dance routines, and campaign rules. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaDanceCampaign=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const DIFFICULTIES=Object.freeze(['normal','hard','extreme']);
 const METERS=Object.freeze(Object.fromEntries([
  ['4/4',4,[0,1,2,3]],['2/4',2,[0,1]],['3/4',3,[0,1,2]],['6/8',3,[0,1.5]],['2/2',4,[0,2]],
  ['5/4',5,[0,1,2,3,4]],['7/8',3.5,[0,1,2]],['9/8',4.5,[0,1.5,3]],['12/8',6,[0,1.5,3,4.5]]
 ].map(([id,barBeats,pulses])=>[id,Object.freeze({id,barBeats,pulses:Object.freeze(pulses)})])));
 const rows=[
  ['neon-first-light','Neon First Light','4/4',60,[0,2,1,3,2,0,1,2],'left up right down', [0,-4,3,-2]],
  ['double-bounce','Double Bounce','2/4',62,[0,1,3,2,0,3,1,2],'left right left down', [0,3,-2,5]],
  ['mirrorball-waltz','Mirrorball Waltz','3/4',65,[0,2,3,1,2,0,3,2],'up right down left up down', [0,-3,-5,2]],
  ['electric-sway','Electric Sway','6/8',57,[0,1,2,3,2,1,0,2],'left up up right down down', [0,-2,5,0]],
  ['midnight-march','Midnight March','2/2',59,[3,2,0,1,3,0,2,1],'down up left right up down right left', [0,5,0,7]],
  ['five-star-strut','Five Star Strut','5/4',64,[0,2,4,1,3,2,0,3],'left up right down up right left down', [0,3,-2,-5]],
  ['seven-sparks','Seven Sparks','7/8',61,[2,0,1,3,4,2,1,0],'left right up down left up right', [0,5,-2,3]],
  ['triple-current','Triple Current','9/8',67,[0,3,2,1,4,2,3,0],'up up right down down left right left up', [0,-5,-3,2]],
  ['twelve-lights','Twelve Lights','12/8',58,[3,1,0,2,4,3,2,0],'left up right up right down left down', [0,3,5,7]],
  ['afterglow-finale','Afterglow Finale','4/4',63,[0,4,2,3,1,3,4,0],'up left down right down left up right', [0,-4,5,7]]
 ];
 const STYLES=Object.freeze([
  {id:'synthpop',label:'Synth-pop',sounds:[9,7,5,8],names:['Analog lead','Sub bass','Synth strings','Plucked answer'],qualities:[3,4,4,4]},
  {id:'funk',label:'Funk',sounds:[8,7,8,1],names:['Clavinet','Syncopated bass','Muted guitar','Horn answer'],qualities:[3,4,4,4]},
  {id:'waltz',label:'Ballroom waltz',sounds:[2,1,5,3],names:['Piano melody','Round bass','Waltz strings','Bell answer'],qualities:[4,3,4,3]},
  {id:'jig',label:'Celtic jig',sounds:[6,8,8,5],names:['Tin whistle','Picked bass','Strummed strings','Fiddle answer'],qualities:[3,4,4,3]},
  {id:'march',label:'Brass march',sounds:[1,1,1,6],names:['Trumpet call','Tuba','Brass section','Piccolo answer'],qualities:[4,4,4,4]},
  {id:'jazz',label:'Jazz in five',sounds:[2,1,2,3],names:['Electric piano','Walking bass','Seventh chords','Vibraphone answer'],qualities:[3,4,4,4]},
  {id:'latin',label:'Latin percussion',sounds:[3,8,8,3],names:['Marimba','Acoustic bass','Guitar offbeats','Mallet answer'],qualities:[3,3,4,4]},
  {id:'orchestral',label:'Orchestral',sounds:[5,1,5,8],names:['String melody','Low strings','Orchestral harmony','Harp'],qualities:[4,4,3,3]},
  {id:'blues',label:'Blues shuffle',sounds:[4,1,2,8],names:['Drawbar organ','Boogie bass','Piano backbeats','Guitar answer'],qualities:[4,4,4,4]},
  {id:'chiptune',label:'Chiptune',sounds:[0,1,0,0],names:['Pulse lead','Triangle bass','Pixel chords','Fast arpeggio'],qualities:[3,4,3,4]}
 ].map(style=>Object.freeze({...style,sounds:Object.freeze(style.sounds),names:Object.freeze(style.names),qualities:Object.freeze(style.qualities)})));
 // Two modal jig strains and four trumpet calls, composed independently of chord arpeggios.
 const JIG_STRAINS=[
  [[0,2,3,7,5,3],[2,0,-2,0,3,7],[9,7,5,7,3,2],[0,3,2,0,-2,0]],
  [[12,10,9,7,9,12],[10,9,7,5,7,10],[9,7,5,3,5,7],[5,3,2,0,-2,0]]
 ];
 const MARCH_CALLS=[[0,0,4,7,7,12],[9,5,4,2],[0,4,7,12,11,9],[7,4,2,0]];
 function composition(stage){
  const meter=METERS[stage.meter],style=stage.style,b=meter.barBeats;
  const tracks=style.sounds.map((sound,index)=>({id:index+1,name:style.names[index],sound,volume:[.30,.29,.10,.085][index],mute:false,notes:[]}));
  const drums=[{sound:0,volume:style.id==='orchestral'?.17:.31,mute:false,notes:[]},{sound:style.id==='latin'?3:1,volume:style.id==='waltz'?.095:.16,mute:false,notes:[]},{sound:style.id==='jazz'?2:style.id==='jig'?3:0,volume:style.id==='orchestral'?.04:.065,mute:false,notes:[]}];
  const add=(track,bar,at,pitch,length)=>{if(at<0||at>=b)return;track.notes.push({p:pitch,t:(bar*b+at)*4,d:Math.min(length,b-at)*4});};
  const grid=step=>Array.from({length:Math.ceil(b/step)},(_,i)=>i*step).filter(at=>at<b);
  for(let bar=0;bar<16;bar++){
   const section=Math.floor(bar/4),sparse=section===2&&bar%4<2,root=stage.tonic+stage.progression[bar%4],third=style.qualities[bar%4],palette=style.id==='blues'?[0,3,5,7,10]:[0,third,7,style.id==='jazz'?10:third===4?9:10,12];
   let bass=[],chords=[],lead=[],arps=[],kick=[],snare=[],hats=[],bassLength=.65,chordLength=.6;
   switch(style.id){
    case 'synthpop':bass=[0,.75,2,2.75];chords=[.5,2.5];lead=[0,.5,1.5,2.5,3];arps=[1,3.5];kick=[0,1,2,3];snare=[1,3];hats=[.5,1.5,2.5,3.5];break;
    case 'funk':bass=[0,.75,1.5];chords=[.5,1.25];lead=[.25,.75,1.5];arps=[1.75];kick=[0,1.5];snare=[1];hats=[0,.5,1,1.5];bassLength=.3;chordLength=.18;break;
    case 'waltz':bass=[0];chords=[1,2];lead=bar%2?[0,1,2]:[0,1.5];arps=[2.5];kick=[0];snare=[1,2];hats=[];bassLength=1.4;chordLength=.8;break;
    case 'jig':bass=[0,1.5];chords=[0,1.5];lead=[0,.5,1,1.5,2,2.5];arps=[1,2.5];kick=[0];snare=[1.5];hats=[0,.5,1,1.5,2,2.5];chordLength=.36;break;
    case 'march':bass=[0,2];chords=[1,3];lead=bar%2?[0,1,2,3]:[0,.75,1,2,2.75,3];arps=bar%2?[1.5,3.5]:[];kick=[0,2];snare=bar%4===3?[1,2.5,3,3.5]:[1,3];hats=[0,2];bassLength=1.2;chordLength=.75;break;
    case 'jazz':bass=[0,1,2,3,4];chords=[.5,2.5];lead=[0,1.5,3.5];arps=bar%2?[2,4.5]:[4];kick=[0];snare=[2,4];hats=[0,1,1.5,2,3,3.5,4];bassLength=.8;chordLength=1.05;break;
    case 'latin':bass=[0,1,2.5];chords=[.5,1.75,3];lead=[0,.5,1.5,2,2.5,3];arps=[.75,2.75];kick=[0,1.5,2.5];snare=[0,.75,1.5,2.5,3];hats=[.5,1,2,3];bassLength=.5;chordLength=.22;break;
    case 'orchestral':bass=[0,3];chords=[0];lead=[0,1.5,3];arps=[.5,1,2,2.5,3.5,4];kick=bar%4===0?[0]:[];snare=[];hats=bar%4===3?[3]:[];bassLength=2.4;chordLength=4.3;break;
    case 'blues':bass=[0,1.5,3,4.5];chords=[1.5,4.5];lead=[0,1,1.5,2.5,3,4,4.5,5.5];arps=bar%2?[2,5]:[];kick=[0,3];snare=[1.5,4.5];hats=grid(.5);bassLength=1.0;chordLength=.7;break;
    case 'chiptune':bass=[0,1.5,2,3.5];chords=[0,2];lead=grid(.5);arps=[.25,.75,1.25,1.75,2.25,2.75,3.25,3.75];kick=[0,1,2,3];snare=[1,3];hats=grid(.5);bassLength=.35;chordLength=.35;break;
   }
   if(sparse){bass=bass.slice(0,1);chords=chords.slice(0,1);lead=lead.slice(0,1);arps=[];kick=kick.slice(0,1);snare=[];hats=[];}
   bass.forEach((at,i)=>{const interval=style.id==='blues'?[0,7,9,10][i%4]:style.id==='jazz'?[0,third,7,9,10][(i+bar)%5]:i%2?7:0;add(tracks[1],bar,at,root-12+interval,bassLength);});
   for(const at of chords)for(const interval of style.id==='jazz'?[third,7,third===4?11:10]:[0,third,7])add(tracks[2],bar,at,root+interval,chordLength);
   lead.forEach((at,i)=>{const motif=stage.hook[(bar%4*2+i+(section===1?3:0))%stage.hook.length],next=lead[i+1]??b,length=Math.min(next-at,style.id==='orchestral'?1.45:style.id==='funk'?.24:style.id==='waltz'?1.25:1)*.86;add(tracks[0],bar,at,style.id==='jig'?stage.tonic+12+JIG_STRAINS[section%2][bar%4][i]:style.id==='march'?stage.tonic+12+MARCH_CALLS[(bar+ (section===1?2:0))%4][i]:root+12+palette[motif]+(section===3&&bar%2?12:0),length);});
   arps.forEach((at,i)=>add(tracks[3],bar,at,root+12+[0,third,7,12][(i+bar)%4],style.id==='orchestral'?.42:.18));
   kick.forEach(at=>add(drums[0],bar,at,45,.18));snare.forEach(at=>add(drums[1],bar,at,57,.12));hats.forEach(at=>add(drums[2],bar,at,88,.10));
   if(section===3&&bar%4===3&&style.id!=='orchestral')add(drums[1],bar,b-.25,57,.12);
  }
  if(['jig','march'].includes(style.id))tracks[0].notes.at(-1).p=tracks[0].notes[0].p;
  else tracks[0].notes.at(-1).p=tracks[0].notes[0].p-1;
  for(const track of [...tracks,...drums])track.notes.sort((a,b)=>a.t-b.t||a.p-b.p);
  return {bpm:80,bars:16,meter:stage.meter,root:0,scale:'chromatic',tracks,drums};
 }
 const STAGES=Object.freeze(rows.map(([id,title,meter,tonic,hook,directions,progression],index)=>{const stage={id,title,meter,tonic,hook,directions:directions.split(' '),progression,index,style:STYLES[index]};return Object.freeze({...stage,composition:composition(stage)});}));
 const stageFor=value=>STAGES.find(s=>s.id===value)||STAGES[Number.isInteger(value)?Math.max(0,Math.min(9,value)):0];
 function progress(events=[]){
  const ids=new Set(events.map(event=>typeof event==='string'?event:event?.id));
  const tiers=DIFFICULTIES.map((difficulty,index)=>{const passed=STAGES.filter(stage=>ids.has('dance-stage:'+difficulty+':'+stage.id)).map(stage=>stage.id);return {difficulty,passed,complete:passed.length===10,unlocked:index===0||DIFFICULTIES.slice(0,index).every(tier=>STAGES.every(stage=>ids.has('dance-stage:'+tier+':'+stage.id)))};});
  return {tiers,songs:STAGES.filter(stage=>ids.has('dance-song:'+stage.id)).map(stage=>stage.id)};
 }
 function canPlay(difficulty,stageId,events=[]){const stage=STAGES.find(s=>s.id===stageId),tier=(Array.isArray(events)?progress(events):events).tiers.find(t=>t.difficulty===difficulty);return !!stage&&!!tier?.unlocked&&(stage.index===0||tier.passed.includes(STAGES[stage.index-1].id));}
 const scorePercent=result=>result?.notesTotal>0?100*result.score/(100*(result.notesTotal+(result.extras||0))):0;
 function musicEvents(stageId,from,to){
  const song=stageFor(stageId).composition,events=[];
  for(const [part,tracks]of [['tone',song.tracks],['drum',song.drums]])for(const [trackIndex,track]of tracks.entries())for(const [index,note]of track.notes.entries())if(note.t/4>=from-1e-9&&note.t/4<to-1e-9)events.push({id:part+':'+trackIndex+':'+index,part,track:trackIndex,sound:track.sound,volume:track.volume,beat:note.t/4,duration:note.d/4,midi:note.p});
  return events.sort((a,b)=>a.beat-b.beat);
 }
 return Object.freeze({STAGES,STYLES,METERS,DIFFICULTIES,stageFor,progress,canPlay,scorePercent,musicEvents});
});
