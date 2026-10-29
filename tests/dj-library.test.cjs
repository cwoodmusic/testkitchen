const test=require('node:test');
const assert=require('node:assert/strict');
const library=require('../dj-library.js');

test('the guest DJ collection contains distinct playable original arrangements',()=>{
  assert.equal(library.songs.length,7);
  assert.equal(new Set(library.songs.map(song=>song.id)).size,7);
  assert.equal(new Set(library.songs.map(song=>JSON.stringify(song.composition))).size,7);
  for(const song of library.songs){assert.ok(library.valid(song.composition));assert.ok(song.composition.tracks.some(track=>track.notes.length>0));}
});

test('ordinary Song Machine drum notes do not need a melodic pitch field',()=>{
  const song=structuredClone(library.songs[0].composition);
  for(const row of song.drums)for(const note of row.notes)delete note.p;
  assert.equal(library.valid(song),true);
  song.tracks[0].notes[0].p=undefined;
  assert.equal(library.valid(song),false);
});

test('unlocked bonus instrument compositions remain playable in the DJ library',()=>{
 const song=structuredClone(library.songs[0].composition);song.tracks[0].sound=17;
 assert.equal(library.valid(song),true);song.tracks[0].sound=18;assert.equal(library.valid(song),false);
 song.tracks[0].sound=17;song.drums[0].sound=5;assert.equal(library.valid(song),false);
});

test('unsupported or unbounded imported songs cannot reach the audio scheduler',()=>{
  for(const edit of [
    song=>song.bpm=0,song=>song.bpm=Infinity,song=>song.bars=200,
    song=>song.meter='invalid',song=>song.tracks[0].volume=2,
    song=>song.tracks[0].notes[0].d=-1,song=>song.tracks[0].notes[0].p=300,
    song=>song.tracks[0].notes[0].t=9999,
    song=>song.tracks[0].notes=Array.from({length:9000},()=>({p:60,t:0,d:1}))
  ]){const song=structuredClone(library.songs[0].composition);edit(song);assert.equal(library.valid(song),false);}
});


test('every house track has a varied sixteen-bar form and a deliberate loop return',()=>{
 for(const record of library.songs){
  const song=record.composition,[top,bottom]=song.meter.split('/').map(Number),barSteps=top*16/bottom,end=16*barSteps;
  assert.equal(song.bars,16);assert.equal(record.sections.length,4);
  assert.deepEqual(record.sections.map(section=>[section.startBar,section.bars,section.role]),[[0,4,'theme'],[4,4,'answer'],[8,4,'breakdown'],[12,4,'return']]);
  const signatures=record.sections.map(section=>JSON.stringify([...song.tracks,...song.drums].map(track=>track.notes.filter(note=>note.t>=section.startBar*barSteps&&note.t<(section.startBar+4)*barSteps).map(note=>({...note,t:note.t-section.startBar*barSteps})))));
  assert.equal(new Set(signatures).size,4,record.id+' has four different sections, not a four-bar copy');
  const count=section=>[...song.tracks,...song.drums].reduce((sum,track)=>sum+track.notes.filter(note=>note.t>=section.startBar*barSteps&&note.t<(section.startBar+4)*barSteps).length,0);
  assert.ok(count(record.sections[2])<count(record.sections[3]),record.id+' breakdown leaves room before the return');
  for(const track of [...song.tracks,...song.drums])for(const note of track.notes){
   assert.ok(Number.isFinite(note.t)&&note.t>=0&&note.t<end);
   assert.ok(Number.isFinite(note.d)&&note.d>0&&note.t+note.d<=end+1e-8,record.id+' event tail fits the loop');
   assert.ok(Number.isInteger(note.p)&&note.p>=0&&note.p<=127);
  }
  const main=song.tracks[0].notes;assert.equal(Math.abs(main.at(-1).p-main[0].p),1,record.id+' leading tone resolves into the first melody note');
 }
});

test('the original sea shanty has a compound pulse, call/answer, and earned access',()=>{
 const shanty=library.songs.find(record=>record.id==='lanternwake-shanty'),song=shanty.composition;
 assert.equal(song.meter,'6/8');assert.equal(song.bars,16);assert.match(shanty.title,/Shanty/);
 assert.ok(song.tracks[0].notes.some(note=>note.t<48));assert.ok(song.tracks[1].notes.some(note=>note.t>=48&&note.t<96));
 assert.equal(song.tracks[0].sound,6,'Flute leads the call');assert.equal(song.tracks[1].sound,4,'Reed-like organ answers');
 assert.ok(song.drums[0].notes.some(note=>note.t===0));assert.ok(song.drums[0].notes.some(note=>note.t===6),'Compound beats are six sixteenth steps apart');
 assert.deepEqual(shanty.unlock,{kind:'fish',count:5});assert.equal(library.isUnlocked(shanty),false);
 assert.equal(library.isUnlocked(shanty,{fishCaught:4}),false);assert.equal(library.isUnlocked(shanty,{fishCaught:5}),true);
 assert.equal(library.isUnlocked(shanty,{fishCaught:'5'}),false);assert.equal(library.isUnlocked(shanty,null),false);
 assert.match(library.requirement(shanty),/Catch 5 fish/);
});

test('the three familiar selections stay free while the waltz unlocks from musician progress',()=>{
 const free=library.songs.filter(record=>library.isUnlocked(record,{}));assert.deepEqual(free.map(record=>record.id),['neon-afterhours','velvet-lounge','mirrorball-bounce']);
 for(const record of free)assert.equal(library.requirement(record),'');
 const waltz=library.songs.find(record=>record.id==='starlight-waltz');assert.equal(waltz.composition.meter,'3/4');
 assert.equal(library.isUnlocked(waltz,{level:3}),false);assert.equal(library.isUnlocked(waltz,{level:4}),true);assert.equal(library.isUnlocked('starlight-waltz',{level:5}),true);
 assert.equal(library.isUnlocked({id:'starlight-waltz'},{level:1}),false,'Known track IDs use the catalog requirement even if a caller omits metadata');
 assert.match(library.requirement(waltz),/musician level 4/);assert.equal(library.isUnlocked('unknown'),false);
 const progress={level:4,fishCaught:5,achievements:[]},before=structuredClone(progress);for(const record of library.songs.slice(0,5))assert.equal(library.isUnlocked(record,progress),true);assert.deepEqual(progress,before,'Checking a track never awards XP or changes progress');
});

test('new line-dance tracks require their saved achievements rather than level, fish, or borrowed metadata',()=>{
 for(const [id,achievement,label,bpm]of [['first-steps','dance-first-finish','First Steps',88],['midnight-headliner','dance-hard-groove','DJ Coda’s Headliner',100]]){
  const record=library.songs.find(song=>song.id===id);
  assert.equal(record.composition.bpm,bpm);assert.deepEqual(record.unlock,{kind:'achievement',id:achievement,label});
  for(const progress of [undefined,null,{level:50,fishCaught:30},{achievements:[]},{achievements:['dance-perfect-set']},{achievements:achievement}])assert.equal(library.isUnlocked(id,progress),false,id);
  const progress={level:1,fishCaught:0,achievements:[achievement]},before=structuredClone(progress);
  assert.equal(library.isUnlocked(id,progress),true);assert.equal(library.isUnlocked(id,{achievements:new Set([achievement])}),true);
  assert.equal(library.isUnlocked({id,unlock:null},{level:50}),false,'A known track always retains its catalog gate');
  assert.equal(library.requirement(id),'Earn '+label+' to unlock this track.');assert.deepEqual(progress,before);
 }
 assert.equal(library.isUnlocked('midnight-headliner',{achievements:['dance-first-finish']}),false);
 assert.equal(library.isUnlocked('first-steps',{achievements:['dance-hard-groove']}),false);
});

test('built-in arrangements use the ten guest voices with bounded density and balanced levels',()=>{
 for(const record of library.songs){
  const song=record.composition;assert.ok(song.tracks.every(track=>track.sound>=0&&track.sound<10));assert.ok(song.drums.every(track=>track.sound>=0&&track.sound<=4));
  assert.ok([...song.tracks,...song.drums].every(track=>track.volume>0&&track.volume<=.35));
  const events=[...song.tracks,...song.drums].flatMap(track=>track.notes.flatMap(note=>[[note.t,1,track.volume],[note.t+note.d,-1,track.volume]])).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  let voices=0,peakVoices=0,level=0,peakLevel=0;for(const [time,direction,volume]of events){voices+=direction;level+=direction*volume;peakVoices=Math.max(peakVoices,voices);peakLevel=Math.max(peakLevel,level);}
  assert.ok(peakVoices<=10,record.id+' avoids excessive simultaneous voices');assert.ok(peakLevel<=1.7+1e-8,record.id+' combined note levels stay bounded');
  assert.ok(events.length/2<400,record.id+' keeps the original synthesis light');
 }
});

test('ordinary one through sixteen bar Song Machine imports retain their format',()=>{
 for(const bars of [1,2,4,8,16]){
  const song={bpm:100,bars,meter:'4/4',tracks:[{sound:1,volume:.3,notes:[{p:60,t:0,d:4}]}],drums:Array.from({length:3},()=>({sound:0,volume:.2,notes:[]}))};
  assert.equal(library.valid(song),true,bars+' bars');
 }
});
