const test=require('node:test'),assert=require('node:assert/strict');
const beams=require('../rhythm-beaming.js'),engine=require('../rhythm-fishing-engine.js');
function phrase(durations,start=0){let onset=start;return durations.map((value,index)=>{const rest=Array.isArray(value),duration=rest?value[0]:value,note={id:'n'+index,onset,duration,rest};onset+=duration;return note;});}
const lengths=value=>value.groups.map(group=>group.members.length);
test('simple, compound and cut meters beam their actual written beat groups',()=>{
 assert.deepEqual(lengths(beams.plan(phrase(Array(8).fill(.5)),{meter:'4/4'})),[2,2,2,2]);
 assert.deepEqual(lengths(beams.plan(phrase(Array(6).fill(.5)),{meter:'6/8'})),[3,3]);
 assert.deepEqual(lengths(beams.plan(phrase(Array(8).fill(.5)),{meter:'2/2'})),[4,4]);
 assert.deepEqual(lengths(beams.plan(phrase(Array(8).fill(.5)),{meter:'cut'})),[4,4]);
});
test('sixteenths have two beams while eighths retain only the primary beam',()=>{
 const sixteenths=beams.plan(phrase(Array(12).fill(.25)),{meter:'6/8'});
 assert.deepEqual(lengths(sixteenths),[6,6]);assert.ok(sixteenths.groups.every(group=>group.secondary.length===5&&group.secondary.every(beam=>!beam.hook)));
 const eighths=beams.plan(phrase(Array(6).fill(.5)),{meter:'6/8'});assert.ok(eighths.groups.every(group=>group.secondary.length===0));
});
test('mixed and dotted rhythms use secondary spans and inward beamlets correctly',()=>{
 const tail=beams.plan(phrase([.75,.25]),{meter:'4/4'}).groups[0];
 assert.deepEqual(tail.secondary,[{from:1,to:0,hook:true,direction:-1}]);
 const head=beams.plan(phrase([.25,.75]),{meter:'4/4'}).groups[0];assert.deepEqual(head.secondary,[{from:0,to:1,hook:true,direction:1}]);
 const pair=beams.plan(phrase([.5,.25,.25]),{meter:'4/4'}).groups[0];assert.deepEqual(pair.secondary,[{from:1,to:2,hook:false}]);
 const ends=beams.plan(phrase([.25,.5,.25]),{meter:'4/4'}).groups[0];assert.deepEqual(ends.secondary.map(beam=>beam.direction),[1,-1]);
});
test('rests, gaps, long notes, crossing pulses and bar lines all break beams',()=>{
 assert.equal(beams.plan(phrase([.25,[.25],.5]),{meter:'4/4'}).groups.length,0);
 assert.equal(beams.plan([{onset:0,duration:.25},{onset:.5,duration:.25}],{meter:'4/4'}).groups.length,0);
 assert.equal(beams.plan(phrase([.5,1,.5]),{meter:'2/2'}).groups.length,0);
 assert.equal(beams.plan(phrase([.75,.25],.5),{meter:'4/4'}).groups.length,0,'A syncopated note crossing a pulse is not connected across it');
 assert.equal(beams.plan(phrase([.5,.5],3.5),{meter:'4/4'}).groups.length,0);
});
test('all fishing phrases keep groups inside beats and never bridge silence',()=>{
 for(const pattern of engine.PATTERNS){
  const notes=pattern.events.map(note=>({...note})),before=JSON.stringify(notes),result=beams.plan(notes,{meter:pattern.meter}),info=engine.METERS[pattern.meter];
  assert.equal(JSON.stringify(notes),before,'Engraving never mutates the game timing events');
  const indices=new Set();
  for(const group of result.groups){
   assert.ok(group.members.length>=2);
   for(let index=0;index<group.members.length;index++){
    const item=group.members[index];assert.ok(!indices.has(item.index));indices.add(item.index);assert.ok(!item.note.rest&&item.levels>0);
    assert.equal(item.bar,group.bar);assert.equal(item.pulse,group.pulse);
    assert.ok(item.onset+item.note.duration<=(group.bar*info.barBeats+(group.pulse+1)*info.pulseBeats)+1e-7);
    if(index)assert.ok(Math.abs(group.members[index-1].onset+group.members[index-1].note.duration-item.onset)<1e-7);
   }
  }
  for(const note of result.singles){assert.ok(!indices.has(note.index));indices.add(note.index);}
  assert.equal(indices.size,notes.length,pattern.id+' must render every note and rest exactly once');
 }
});
function context(){const calls=[];return {calls,canvas:{height:240},save(){},restore(){},beginPath(){},rect(...args){calls.push({kind:'clip',args});},clip(){},fillRect(...args){calls.push({kind:'beam',args,color:this.fillStyle});},fillText(...args){calls.push({kind:'glyph',args,color:this.fillStyle,font:this.font});}};}
test('beamed glyphs have no flags, retain dots and judgement colors, and clip at the viewport',()=>{
 const ctx=context(),notes=phrase([.75,.25]);notes[0].judgement='hit';notes[1].judgement='miss';
 const drawing=beams.draw(ctx,{notes,meter:'4/4',xForNote:note=>100+note.onset*100,y:120,fontSize:64,left:40,right:600});
 const glyphs=ctx.calls.filter(call=>call.kind==='glyph');assert.deepEqual(glyphs.map(call=>call.args[0]),['\ue1d5','\ue1e7','\ue1d5']);
 assert.equal(glyphs[0].color,'#8ff3bf');assert.equal(glyphs.at(-1).color,'#ec879b');assert.ok(glyphs.every(call=>/CodaBravura/.test(call.font)));
 assert.equal(drawing.drawnGroups,1);assert.equal(drawing.drawnNotes,2);assert.ok(ctx.calls.some(call=>call.kind==='clip'));
 assert.ok(ctx.calls.some(call=>call.kind==='beam'&&call.args[1]===drawing.metrics.secondaryTop));
 const lone=context();beams.draw(lone,{notes:phrase([.5]),xForNote:()=>100,y:120});assert.deepEqual(lone.calls.filter(call=>call.kind==='glyph').map(call=>call.args[0]),['\ue1d7']);
});
test('scrolling across a visible boundary retains the full group and beam geometry',()=>{
 const notes=phrase([.25,.25,.25,.25]),before=beams.plan(notes,{meter:'4/4'});
 const first=beams.draw(context(),{notes,meter:'4/4',xForNote:note=>100+note.onset*100,y:120,fontSize:64,left:55,right:500});
 const second=beams.draw(context(),{notes,meter:'4/4',xForNote:note=>40+note.onset*100,y:120,fontSize:64,left:55,right:500});
 assert.equal(first.groups[0].id,before.groups[0].id);assert.equal(second.groups[0].id,first.groups[0].id);
 assert.equal(second.groups[0].members.length,4);assert.deepEqual(second.groups[0].secondary,first.groups[0].secondary);
 assert.equal(second.drawnGroups,1,'A partially visible group is drawn intact through a clip');
});

test('quarter, half, whole, eighth and sixteenth rests use the music font without beams or flags',()=>{
 const ctx=context(),notes=phrase([[1],[2],[4],[.5],[.25],[1.5],[.75]]),before=JSON.stringify(notes);
 const drawing=beams.draw(ctx,{notes,meter:'4/4',xForNote:(_,index)=>70+index*70,y:140,fontSize:64,left:0,right:600});
 const glyphs=ctx.calls.filter(call=>call.kind==='glyph');
 assert.deepEqual(glyphs.map(call=>call.args[0]),['\ue4e5','\ue4e4','\ue4e3','\ue4e6','\ue4e7','\ue4e5','\ue1e7','\ue4e6','\ue1e7']);
 assert.equal(drawing.groups.length,0);assert.equal(drawing.drawnNotes,notes.length);assert.ok(glyphs.every(call=>/CodaBravura/.test(call.font)));
 assert.equal(ctx.calls.filter(call=>call.kind==='beam').length,0);assert.equal(JSON.stringify(notes),before);
});

test('a full-bar rest keeps its whole-rest glyph while retaining the selected meter timing',()=>{
 for(const meter of Object.values(engine.METERS)){
  const note={id:'whole-bar',onset:0,duration:meter.barBeats,notationBeats:4,wholeBarRest:true,rest:true},ctx=context();
  const drawing=beams.draw(ctx,{notes:[note],meter:meter.id,xForNote:()=>120,y:140,fontSize:64,left:0,right:300});
  assert.deepEqual(ctx.calls.filter(call=>call.kind==='glyph').map(call=>call.args[0]),['\ue4e3']);
  assert.equal(drawing.groups.length,0);assert.equal(drawing.singles[0].note.duration,meter.barBeats,'The performance duration is never replaced by the engraved value');
  assert.equal(note.duration,meter.barBeats);assert.equal(note.notationBeats,4);
 }
});
