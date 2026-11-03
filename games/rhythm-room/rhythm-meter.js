/* Musical positions stay in quarter-note units, including compound and cut time. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.RhythmRoomMeter=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const EPS=.000001;
 const METERS=Object.freeze(Object.fromEntries([
  ['4/4',4,4,4,1],['2/2',2,2,4,2],['6/8',6,8,3,1.5]
 ].map(([id,numerator,denominator,measureBeats,pulseBeats])=>[id,Object.freeze({
  id,numerator,denominator,measureBeats,pulseBeats,pulsesPerMeasure:measureBeats/pulseBeats,
  measureUnits:measureBeats*8,phraseBeats:measureBeats*2
 })])));
 const getMeter=value=>METERS[typeof value==='string'?value:value?.id]||METERS['4/4'];
 const onGrid=(value,step)=>Math.abs(value/step-Math.round(value/step))<EPS;
 const blockUnits=block=>block.notes.reduce((total,value)=>total+Math.abs(value)*8,0);
 // Compound time gets its own vocabulary. Each short block fills one
 // dotted-quarter pulse; dotted halves fill both pulses of a complete bar.
 // Sixteenths replace an eighth in pairs, never as isolated single notes.
 const COMPOUND_BLOCKS=[
  {id:'compound-dotted-half',name:'Dotted half note',notes:[3],group:'basic'},
  {id:'compound-dotted-quarter',name:'Dotted quarter note',notes:[1.5],group:'basic'},
  {id:'compound-eighth-quarter',name:'Eighth + quarter',notes:[.5,1],group:'basic'},
  {id:'compound-quarter-eighth',name:'Quarter + eighth',notes:[1,.5],group:'basic'},
  {id:'compound-three-eighths',name:'Three eighth notes',notes:[.5,.5,.5],group:'basic'},
  {id:'compound-two-sixteenths-eighth-eighth',name:'Two sixteenths + two eighths',notes:[.25,.25,.5,.5],group:'advanced'},
  {id:'compound-eighth-two-sixteenths-eighth',name:'Eighth + two sixteenths + eighth',notes:[.5,.25,.25,.5],group:'advanced'},
  {id:'compound-eighth-eighth-two-sixteenths',name:'Two eighths + two sixteenths',notes:[.5,.5,.25,.25],group:'advanced'},
  {id:'compound-four-sixteenths-eighth',name:'Four sixteenths + eighth',notes:[.25,.25,.25,.25,.5],group:'advanced'},
  {id:'compound-eighth-four-sixteenths',name:'Eighth + four sixteenths',notes:[.5,.25,.25,.25,.25],group:'advanced'},
  {id:'compound-two-sixteenths-eighth-two-sixteenths',name:'Two sixteenths + eighth + two sixteenths',notes:[.25,.25,.5,.25,.25],group:'advanced'},
  {id:'compound-six-sixteenths',name:'Six sixteenth notes',notes:[.25,.25,.25,.25,.25,.25],group:'advanced'},
  {id:'compound-quarter-two-sixteenths',name:'Quarter + two sixteenths',notes:[1,.25,.25],group:'advanced'},
  {id:'compound-two-sixteenths-quarter',name:'Two sixteenths + quarter',notes:[.25,.25,1],group:'advanced'},
  {id:'compound-dotted-half-rest',name:'Dotted half rest',notes:[-3],preview:[-3],group:'rests',keepRestValue:true},
  {id:'compound-dotted-quarter-rest',name:'Dotted quarter rest',notes:[-1.5],preview:[-1.5],group:'rests',keepRestValue:true},
  {id:'compound-quarter-rest',name:'Quarter rest',notes:[-1,.5],variants:[[-1,.5],[.5,-1]],preview:[-1],group:'rests',keepRestValue:true},
  {id:'compound-eighth-rest',name:'Eighth rest',notes:[-.5,1],variants:[[-.5,1],[1,-.5],[-.5,.5,.5],[.5,-.5,.5],[.5,.5,-.5]],preview:[-.5],group:'rests',keepRestValue:true}
 ];
 const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
 freeze(COMPOUND_BLOCKS);

 function expandedPool(selection,meter='4/4'){
  const m=getMeter(meter),pool=selection.filter(block=>Array.isArray(block.notes)&&block.notes.length);
  const expanded=pool.flatMap(block=>block.variants?block.variants.map(notes=>({...block,notes})):block);
  const ids=new Set(pool.map(block=>block.id));
  // This is a simple-duple syncopation. Compound time has different beat groups.
  if(m.id!=='6/8'&&ids.has('eighth')&&ids.has('quarter'))expanded.push({id:'sync-eighth-quarter-eighth',notes:[.5,1,.5],syncopation:true});
  return expanded.filter(block=>block.notes.every(value=>Number.isFinite(value)&&value!==0&&onGrid(Math.abs(value),.25))&&blockUnits(block)<=m.measureUnits);
 }

 function validStart(block,units,meter='4/4'){
  const m=getMeter(meter),beat=units/8,duration=blockUnits(block)/8;
  if(m.id==='6/8'){
   if(duration===3)return beat===0;
   if(duration===2)return beat===0; // a half note can be completed by a quarter
   if(duration===1.5)return onGrid(beat,1.5);
   if(duration===.75)return onGrid(beat,.75);
   if(duration===.5)return onGrid(beat,.5);
   // Generated blocks may cross a dotted-quarter boundary; their individual
   // eighth/sixteenth notes are regrouped by notationBeams below.
   if(block.notes.length>1)return onGrid(beat,.5);
   if(duration===1)return onGrid(beat,.5);
   return onGrid(beat,.25);
  }
  // Preserve the established 4/4 building-block spellings in both simple meters.
  if(block.syncopation)return beat%2===0;
  if(block.notes.length>1)return beat%1===0;
  if(duration===4||duration===3)return beat===0;
  if(duration===2||duration===1.5)return beat%2===0;
  if(duration===1||duration===.75)return beat%1===0;
  if(duration===.5)return units%4===0;
  return true;
 }

 function nextRhythmState(block,left,tail,dotted,meter='4/4'){
  const m=getMeter(meter),size=blockUnits(block),units=m.measureUnits-left,rest=block.notes[0]<0;
  if(size>left||!validStart(block,units,m))return null;
  if(m.id!=='6/8'){
   if(dotted&&rest)return null;
   if(rest&&!tail&&size<8&&units%8===2)return null;
   if(tail&&!rest)return null;
  }
  const nextLeft=left-size;
  return {left:nextLeft,tail:rest&&nextLeft%8!==0,dotted:[3,1.5,.75].includes(block.notes.at(-1))};
 }

 function fillTable(pool,meter='4/4'){
  const m=getMeter(meter),memo=new Map();
  function finish(left,tail=false,dotted=false){
   if(left===0)return true;
   if(left<0||left>m.measureUnits)return false;
   const key=[left,tail,dotted].join(':');
   if(memo.has(key))return memo.get(key);
   const possible=pool.some(block=>{
    const next=nextRhythmState(block,left,tail,dotted,m);
    return next&&finish(next.left,next.tail,next.dotted);
   });
   memo.set(key,possible);return possible;
  }
  const can=Array.from({length:m.measureUnits+1},(_,left)=>finish(left));
  can.finish=finish;return can;
 }

 function generatePhrase(selection,rng=Math.random,meter='4/4'){
  const m=getMeter(meter),pool=expandedPool(selection,m),can=fillTable(pool,m),result=[];
  if(!can[m.measureUnits])throw Error('Selected rhythms cannot fill a clear '+m.id+' measure');
  for(let bar=0;bar<2;bar++){
   let state={left:m.measureUnits,tail:false,dotted:false};
   while(state.left){
    const valid=pool.map(block=>({block,next:nextRhythmState(block,state.left,state.tail,state.dotted,m)})).filter(value=>value.next&&can.finish(value.next.left,value.next.tail,value.next.dotted));
    const weights=valid.map(value=>value.block.notes[0]<0?.35:value.block.notes.length===1&&Math.abs(value.block.notes[0])>=1?1.5:1);
    const total=weights.reduce((sum,weight)=>sum+weight,0);
    let choice=Math.max(0,Math.min(1-EPS,Number(rng())||0))*total,index=0;
    while(index<valid.length-1&&choice>=weights[index])choice-=weights[index++];
    result.push(valid[index].block);state=valid[index].next;
   }
  }
  return result;
 }

 function restFits(beat,duration,m){
  if(m.id!=='6/8')return onGrid(beat,duration);
  const local=((beat%m.pulseBeats)+m.pulseBeats)%m.pulseBeats;
  if(local+duration>m.pulseBeats+EPS)return false;
  if(duration===1.5)return local<EPS;
  if(duration===1)return onGrid(local,.5);
  if(duration===.75)return onGrid(local,.75);
  return onGrid(local,duration);
 }

 // Keep rests within measures and musical beat groups. In any meter an entire
 // empty measure uses a whole-rest glyph, even when its performed duration is3.
 function consolidateRests(notes,meter='4/4'){
  const m=getMeter(meter),result=[];
  for(let i=0;i<notes.length;){
   const note=notes[i];
   if(!note.rest){result.push(note);i++;continue;}
   if(note.keepRestValue){result.push(note);i++;continue;}
   let end=note.beat+note.duration,j=i+1;
   while(j<notes.length&&notes[j].rest&&!notes[j].keepRestValue&&Math.abs(notes[j].beat-end)<EPS){end=notes[j].beat+notes[j].duration;j++;}
   let beat=note.beat;
   while(beat<end-EPS){
    const bar=Math.floor((beat+EPS)/m.measureBeats),barEnd=(bar+1)*m.measureBeats;
    const available=Math.min(end,barEnd)-beat,wholeMeasure=onGrid(beat,m.measureBeats)&&available>=m.measureBeats-EPS;
    const choices=m.id==='6/8'?[1.5,1,.75,.5,.25]:[4,2,1,.5,.25];
    const duration=wholeMeasure?m.measureBeats:choices.find(value=>value<=available+EPS&&restFits(beat,value,m));
    if(!duration)throw Error('Rest is outside the supported sixteenth-note grid');
    result.push({...note,beat,duration,value:wholeMeasure?-4:-duration,last:true,...(wholeMeasure?{fullMeasure:true}:{})});
    beat+=duration;
   }
   i=j;
  }
  return result;
 }

 function notationBeams(notes,meter='4/4'){
  const m=getMeter(meter),groups=[];let group=[];
  const key=note=>note.beamGroup??Math.floor((note.beat+EPS)/m.pulseBeats);
  const flush=()=>{if(group.length>1)groups.push(group);group=[];};
  notes.forEach((note,index)=>{
   if(note.rest||note.duration>=1){flush();return;}
   if(group.length&&(key(notes[group[0]])!==key(note)||Math.floor((notes[group[0]].beat+EPS)/m.measureBeats)!==Math.floor((note.beat+EPS)/m.measureBeats)||Math.abs(notes[index-1].beat+notes[index-1].duration-note.beat)>EPS))flush();
   group.push(index);
  });
  flush();return groups;
 }

 function notePositions(notes){
  const positions=[];let beat=0;
  for(const note of notes||[]){
   if(Array.isArray(note.notes)){
    for(const value of note.notes){positions.push(beat,beat+Math.abs(value));beat+=Math.abs(value);}
   }else{
    const duration=Math.abs(typeof note==='number'?note:note.duration??note.value??0);
    const start=typeof note==='object'&&Number.isFinite(note.beat)?note.beat:beat;
    if(Number.isFinite(start)&&Number.isFinite(duration))positions.push(start,start+duration);
    beat=start+duration;
   }
  }
  return positions;
 }

 function countPattern(notes=[],meter='4/4',mode='auto'){
  const m=getMeter(meter),allowed=m.id==='6/8'?[1,3,6]:m.id==='2/2'?[1,2,4,8]:[1,2,4];
  let subdivisions;
  if(mode==='off')return {subdivisions:0,tokens:[],label:''};
  if(mode==='beats')subdivisions=1;
  else if(mode==='basic')subdivisions=m.id==='6/8'?3:2;
  else if(mode==='fine')subdivisions=m.id==='6/8'?6:4;
  else if(mode==='eighths')subdivisions=m.pulseBeats/.5;
  else if(mode==='sixteenths')subdivisions=m.pulseBeats/.25;
  else if(Number.isFinite(+mode)&&allowed.includes(+mode))subdivisions=+mode;
  else{
   const positions=notePositions(notes),minimum=m.id==='6/8'?3:1;
   subdivisions=allowed.find(value=>value>=minimum&&positions.every(beat=>onGrid(beat,m.pulseBeats/value)))||allowed.at(-1);
  }
  const syllables=m.id==='6/8'?(subdivisions===6?['','&','la','&','li','&']:subdivisions===3?['','la','li']:['']):subdivisions===8?['','ta','e','ta','&','ta','a','ta']:subdivisions===4?['','e','&','a']:subdivisions===2?['','&']:[''];
  const tokens=Array.from({length:m.pulsesPerMeasure*subdivisions},(_,index)=>{
   const pulseIndex=Math.floor(index/subdivisions),part=index%subdivisions;
   return {index,text:part===0?String(pulseIndex+1):syllables[part],beat:index*m.pulseBeats/subdivisions,pulse:pulseIndex+1,pulseIndex,part};
  });
  return {subdivisions,tokens,label:tokens.map(token=>token.text).join(' ')};
 }

 function countAt(beat,notes=[],meter='4/4',mode='auto'){
  const m=getMeter(meter),pattern=countPattern(notes,m,mode);
  if(!pattern.tokens.length)return null;
  const phase=((beat%m.measureBeats)+m.measureBeats)%m.measureBeats;
  const index=Math.min(pattern.tokens.length-1,Math.floor((phase+EPS)/(m.pulseBeats/pattern.subdivisions)));
  return {...pattern.tokens[index],measure:Math.floor(beat/m.measureBeats)+1};
 }

 // Read the rhythm that is actually written. Short notes/rests get only their
 // onset syllable. Longer holds also show each main beat that passes inside
 // them, without inventing unused eighth/sixteenth-note subdivisions.
 function rhythmCounts(notes=[],meter='4/4'){
  const m=getMeter(meter),events=[];let cursor=0;
  for(const note of notes){
   if(Array.isArray(note?.notes)){
    for(const value of note.notes){events.push({beat:cursor,duration:Math.abs(value),rest:value<0});cursor+=Math.abs(value);}
   }else{
    const duration=Math.abs(typeof note==='number'?note:note?.duration??note?.value??0);
    const beat=Number.isFinite(note?.beat)?note.beat:cursor;
    if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(beat)||beat<0)continue;
    events.push({beat,duration,rest:typeof note==='number'?note<0:note.rest===true||note.value<0});cursor=beat+duration;
   }
  }
  const result=[];
  const append=(beat,note,noteIndex,held=false)=>{
   const counted=countAt(beat,[],m,'sixteenths');
   result.push({text:counted.text,beat,rest:note.rest,index:result.length,noteIndex,held});
  };
  events.forEach((note,noteIndex)=>{
   append(note.beat,note,noteIndex);
   if(note.duration>m.pulseBeats+EPS){
    const end=note.beat+note.duration;
    for(let beat=(Math.floor((note.beat+EPS)/m.pulseBeats)+1)*m.pulseBeats;beat<end-EPS;beat+=m.pulseBeats)append(beat,note,noteIndex,true);
   }
  });
  return result;
 }

 function beatLabel(beat,meter='4/4'){
  const m=getMeter(meter),token=countAt(Math.max(0,beat),[],m,'sixteenths');
  const part=token.part===0?'':' '+token.text;
  return `measure ${token.measure}, beat ${token.pulse}${part}`;
 }

 return Object.freeze({METERS,COMPOUND_BLOCKS,getMeter,expandedPool,blockUnits,validStart,nextRhythmState,fillTable,generatePhrase,consolidateRests,notationBeams,countPattern,countAt,rhythmCounts,beatLabel});
});
