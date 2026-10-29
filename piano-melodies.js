/* Familiar beginner arrangements. Beats are quarter-note units; pitch judging
 * uses only sounding notes. Written rests are quiet breaths, never tap targets. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaPianoMelodies=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const VALUES={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
 const note=(name,beats=1)=>[name,beats],rest=beats=>[null,beats];
 const q=(...names)=>names.map(name=>note(name));
 function parsePitch(name){
  const match=/^([A-G])([#♯b♭]?)(-?\d)$/.exec(name||'');
  if(!match)throw Error('A melody pitch needs its letter and register.');
  const accidental=match[2]==='#'||match[2]==='♯'?1:match[2]==='b'||match[2]==='♭'?-1:0;
  return {midi:12*(Number(match[3])+1)+VALUES[match[1]]+accidental,spelling:match[1]+(accidental===1?'♯':accidental===-1?'♭':'')};
 }
 const DEFINITIONS=[
  {id:'twinkle',name:'Twinkle, Twinkle, Little Star',meter:'4/4',description:'Play this familiar tune one note at a time. The wall shows the tune’s written rhythm; you may play at your own speed.',bars:[
   q('C4','C4','G4','G4'),[note('A4'),note('A4'),note('G4',2)],
   q('F4','F4','E4','E4'),[note('D4'),note('D4'),note('C4',2)],
   q('G4','G4','F4','F4'),[note('E4'),note('E4'),note('D4',2)],
   q('G4','G4','F4','F4'),[note('E4'),note('E4'),note('D4',2)],
   q('C4','C4','G4','G4'),[note('A4'),note('A4'),note('G4',2)],
   q('F4','F4','E4','E4'),[note('D4'),note('D4'),note('C4',2)]
  ]},
  {id:'mary',name:'Mary Had a Little Lamb',meter:'4/4',description:'Follow the little lamb’s tune. Repeated notes need a fresh press. Take your time.',bars:[
   q('E4','D4','C4','D4'),[note('E4'),note('E4'),note('E4',2)],
   [note('D4'),note('D4'),note('D4',2)],[note('E4'),note('G4'),note('G4',2)],
   q('E4','D4','C4','D4'),q('E4','E4','E4','E4'),q('D4','D4','E4','D4'),[note('C4',4)]
  ]},
  {id:'london-bridge',name:'London Bridge Is Falling Down',meter:'4/4',description:'Play London Bridge one pitch at a time. Listen for the long-short rhythm at the start.',bars:[
   [note('G4',1.5),note('A4',.5),note('G4'),note('F4')],
   [note('E4'),note('F4'),note('G4',2)],
   [note('D4'),note('E4'),note('F4',2)],
   [note('E4'),note('F4'),note('G4',2)],
   [note('G4',1.5),note('A4',.5),note('G4'),note('F4')],
   [note('E4'),note('F4'),note('G4',2)],
   [note('D4',2),note('G4',2)],[note('E4',2),note('C4',2)]
  ]},
  {id:'hot-cross-buns',name:'Hot Cross Buns',meter:'4/4',description:'A short tune with three pitches. The middle part uses quick pairs of eighth notes, but your challenge only checks the next pitch.',bars:[
   [note('E4'),note('D4'),note('C4',2)],
   [note('E4'),note('D4'),note('C4',2)],
   [...Array.from({length:4},()=>note('C4',.5)),...Array.from({length:4},()=>note('D4',.5))],
   [note('E4'),note('D4'),note('C4',2)]
  ]},
  {id:'row-your-boat',name:'Row, Row, Row Your Boat',meter:'6/8',quarterBpm:90,description:'A swaying rowing song in 6/8. Listen for two big beats in each bar and a quiet breath after “stream.”',arrangement:'A dotted-quarter breath separates the two lines.',bars:[
   [note('C4',1.5),note('C4',1.5)],
   [note('C4'),note('D4',.5),note('E4',1.5)],
   [note('E4'),note('D4',.5),note('E4'),note('F4',.5)],
   [note('G4',1.5),rest(1.5)],
   ['C5','C5','C5','G4','G4','G4'].map(name=>note(name,.5)),
   ['E4','E4','E4','C4','C4','C4'].map(name=>note(name,.5)),
   [note('G4'),note('F4',.5),note('E4'),note('D4',.5)],
   [note('C4',3)]
  ]},
  {id:'frere-jacques',name:'Frère Jacques',meter:'4/4',description:'Play this familiar round. The closing bell pattern goes down to a lower G, then returns to C.',bars:[
   q('C4','D4','E4','C4'),q('C4','D4','E4','C4'),
   [note('E4'),note('F4'),note('G4',2)],[note('E4'),note('F4'),note('G4',2)],
   [note('G4',.5),note('A4',.5),note('G4',.5),note('F4',.5),note('E4'),note('C4')],
   [note('G4',.5),note('A4',.5),note('G4',.5),note('F4',.5),note('E4'),note('C4')],
   [note('C4'),note('G3'),note('C4',2)],[note('C4'),note('G3'),note('C4',2)]
  ]},
  {id:'ode-to-joy',name:'Ode to Joy',meter:'4/4',description:'Beethoven’s joyful theme. The wall shows its long-short endings, while you choose a comfortable playing speed.',bars:[
   q('E4','E4','F4','G4'),q('G4','F4','E4','D4'),q('C4','C4','D4','E4'),
   [note('E4',1.5),note('D4',.5),note('D4',2)],
   q('E4','E4','F4','G4'),q('G4','F4','E4','D4'),q('C4','C4','D4','E4'),
   [note('D4',1.5),note('C4',.5),note('C4',2)]
  ]},
  {id:'jingle-bells',name:'Jingle Bells',meter:'4/4',description:'Play the first half of the familiar chorus. Listen for the little quiet breaths after “bells.”',arrangement:'The first two bars use a quarter-note breath after the third bell.',bars:[
   [note('E4'),note('E4'),note('E4'),rest(1)],
   [note('E4'),note('E4'),note('E4'),rest(1)],
   [note('E4'),note('G4'),note('C4',1.5),note('D4',.5)],
   [note('E4',4)],
   [note('F4'),note('F4'),note('F4',1.5),note('F4',.5)],
   [note('F4'),note('E4'),note('E4',1.5),note('E4',.5)],
   q('E4','D4','D4','E4'),[note('D4',2),note('G4',2)]
  ]},
  {id:'old-macdonald',name:'Old MacDonald Had a Farm',meter:'4/4',description:'Play the familiar opening line twice. A quiet breath gives each “E-I-E-I-O” a clear ending.',arrangement:'The four-bar opening line repeats, with a half-note breath at each ending.',bars:[
   q('C4','C4','C4','G4'),[note('A4'),note('A4'),note('G4',2)],q('E4','E4','D4','D4'),[note('C4',2),rest(2)],
   q('C4','C4','C4','G4'),[note('A4'),note('A4'),note('G4',2)],q('E4','E4','D4','D4'),[note('C4',2),rest(2)]
  ]}
 ];
 function build(definition){
  const barBeats=definition.meter==='6/8'?3:4,pulseBeats=definition.meter==='6/8'?1.5:1,events=[];let onset=0,pitchIndex=0;
  definition.bars.forEach((bar,barIndex)=>{
   const length=bar.reduce((total,event)=>total+event[1],0);
   if(Math.abs(length-barBeats)>1e-9)throw Error(definition.id+' bar '+(barIndex+1)+' needs '+barBeats+' beats, got '+length);
   let beatWithinBar=0;
   for(const [name,beats]of bar){
    if(![.25,.5,.75,1,1.5,2,3,4].includes(beats))throw Error('Unsupported written note length.');
    const silent=name===null,pitch=silent?{midi:null,spelling:null}:parsePitch(name);
    events.push(Object.freeze({...pitch,index:events.length,pitchIndex:silent?null:pitchIndex++,pitchOffset:silent?null:pitch.midi-60,beats,duration:beats,rest:silent,dotted:[.75,1.5,3].includes(beats),onset,bar:barIndex,beatWithinBar,beamingGroup:!silent&&beats<1?'melody-beam-'+barIndex+'-'+Math.floor((beatWithinBar+1e-9)/pulseBeats):null}));
    onset+=beats;beatWithinBar+=beats;
   }
  });
  const sounding=events.filter(event=>!event.rest),notes=Object.freeze(sounding.map(event=>event.pitchOffset)),spellings=Object.freeze(sounding.map(event=>event.spelling)),score=Object.freeze(events);
  const minMidi=Math.min(...sounding.map(event=>event.midi)),maxMidi=Math.max(...sounding.map(event=>event.midi)),floorBaseMidi=12*Math.floor(minMidi/12);
  if(maxMidi-floorBaseMidi>21)throw Error(definition.id+' cannot fit the painted floor without changing its register.');
  return Object.freeze({id:definition.id,name:definition.name,description:definition.description,arrangement:definition.arrangement||'A beginner arrangement of the familiar tune.',meter:definition.meter,timeSignature:definition.meter,quarterBpm:definition.quarterBpm||100,barBeats,bars:definition.bars.length,totalBeats:onset,events:score,score,notes,spellings,range:Object.freeze({min:minMidi,max:maxMidi}),floorBaseMidi,floorOctave:floorBaseMidi/12-1,floorOffsets:Object.freeze(sounding.map(event=>event.midi-floorBaseMidi))});
 }
 const LESSONS=Object.freeze(DEFINITIONS.map(build));
 const lessonFor=id=>LESSONS.find(lesson=>lesson.id===id)||null;
 return Object.freeze({LESSONS,lessonFor,parsePitch});
});
