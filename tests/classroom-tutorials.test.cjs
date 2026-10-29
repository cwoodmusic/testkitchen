const test=require('node:test'),assert=require('node:assert/strict');
const {KEY,LESSONS,VALUES,NOTE_STEPS,BASS_STEPS,GRAND_STEPS,KEY_STEPS,staffSVG,validBar,normalize,readProgress}=require('../classroom-tutorials.js');
test('every rhythm-tree level preserves a four-beat bar while halving each note',()=>{
 assert.deepEqual(VALUES.map(value=>value.units),[16,8,4,2,1]);
 assert.deepEqual(VALUES.map(value=>value.count),[1,2,4,8,16]);
 for(let at=0;at<VALUES.length;at++){assert.equal(VALUES[at].units*VALUES[at].count/4,4);if(at)assert.equal(VALUES[at].units,VALUES[at-1].units/2);}
});
test('note-name teaching and staff positions agree with the actual musical pitches',()=>{
 const pitchLetters=['C','','D','','E','F','','G','','A','','B'];
 for(const step of NOTE_STEPS){assert.equal(pitchLetters[step.pitch%12],step.answer);assert.doesNotMatch(step.teach+' '+step.prompt+' '+step.hint,/\b[A-G][0-8]\b/);}
 const staff=NOTE_STEPS.filter(step=>step.kind==='staff');assert.deepEqual(staff.map(step=>step.position),[0,1,2,3,4,5]);assert.deepEqual(staff.map(step=>step.answer),['E','F','G','A','B','C']);
 assert.equal(new Set(LESSONS.map(lesson=>lesson.id)).size,8);
});
test('the build-a-bar check accepts any supported notes totaling four beats',()=>{
 for(const notes of [[4,2,2,8],[8,2,4,2],[16],[8,8],[4,4,4,4],Array(16).fill(1),[8,4,2,1,1]])assert.equal(validBar(notes),true);
 for(const notes of [[],[4,2,2],[4,2,2,8,1],[15,1],[0,16],[-4,16,4],[.5,.5,15],null,['4',2,2,8]])assert.equal(validBar(notes),false);
});
test('progress never accepts an incomplete lesson as completed and handles damaged saves',()=>{
 const state=normalize({version:1,lessons:{'note-naming':{step:3,completed:true},'rhythm-tree':{step:4,completed:true,completedAt:12}}});
 assert.equal(state.lessons['note-naming'].completed,false);assert.equal(state.lessons['rhythm-tree'].completed,true);
 const saved=readProgress({getItem:key=>key===KEY?JSON.stringify(state):null});assert.deepEqual(saved.completed,['rhythm-tree']);assert.equal(saved.completedCount,1);assert.equal(saved.total,8);
 const damaged=readProgress({getItem(){throw Error('blocked');}});assert.equal(damaged.completedCount,0);assert.equal(damaged.persistent,false);assert.ok(damaged.error);
});
test('bass and grand staff steps teach the requested bottom-up reminders and real pitches',()=>{
 const pitchLetters=['C','','D','','E','F','','G','','A','','B'];
 for(const step of [...BASS_STEPS,...GRAND_STEPS]){
  assert.equal(pitchLetters[step.pitch%12],step.answer);
  const scale=step.clef==='bass'?[43,45,47,48,50,52,53,55,57,59,60]:[64,65,67,69,71,72,74,76,77];
  if(step.position>=0&&step.position<scale.length)assert.equal(scale[step.position],step.pitch);
  assert.doesNotMatch(step.teach+' '+step.example+' '+step.hint,/\b[A-G][0-8]\b/);
 }
 const bass=BASS_STEPS.map(step=>step.teach+' '+step.example).join(' '),grand=GRAND_STEPS.map(step=>step.teach+' '+step.example).join(' ');
 assert.match(bass,/Great Big Dreams For America/);assert.match(bass,/All Cows Eat Grass/);
 assert.match(grand,/Every Good Boy Does Fine/);assert.match(grand,/FACE/);
 const middle=GRAND_STEPS.filter(step=>step.pitch===60);assert.deepEqual(middle.map(step=>[step.clef,step.position]),[['treble',-2],['bass',10]]);
 assert.ok(GRAND_STEPS.every(step=>step.grand));
 const legacy=normalize({version:1,lessons:{'note-naming':{step:10,completed:true,completedAt:1}}});
 assert.equal(legacy.lessons['note-naming'].completed,true);assert.equal(legacy.lessons['bass-clef'].step,0);assert.equal(legacy.lessons['grand-staff'].completed,false);
});
test('lesson pictures reuse engraved clefs and join two staffs with one question note',()=>{
 const notation=require('../music-notation.js'),bass=staffSVG(6,{clef:'bass'}),grand=staffSVG(10,{clef:'bass',grand:true});
 assert.ok(bass.includes(notation.glyph('fClef')));assert.ok(!bass.includes(notation.glyph('gClef')));assert.match(bass,/staff-clef" x="36" y="65"/);
 assert.equal((grand.match(/class="staff-line"/g)||[]).length,10);
 assert.ok(grand.includes(notation.glyph('fClef'))&&grand.includes(notation.glyph('gClef')));
 assert.equal((grand.match(/class="coda-music-glyph staff-note"/g)||[]).length,1);
 assert.match(grand,/data-staff-position="10"/);assert.match(grand,/class="staff-ledger"/);assert.match(grand,/translate\(0 120\)/);
});

test('both clefs explain the staff and their landmarks before either mnemonic map',()=>{
 const {CLEF_REMINDERS,clefReminderSVG}=require('../classroom-tutorials.js'),notation=require('../music-notation.js');
 for(const clef of ['treble','bass']){
  const cards=CLEF_REMINDERS[clef];assert.deepEqual(cards.map(card=>card.id),['staff','clef','lines','spaces']);
  assert.match(cards[0].teach,/five lines and four spaces/);assert.match(cards[1].teach,/clef tells us which note letters/);
  assert.match(cards[2].teach,/BOTTOM to the TOP/);assert.match(cards[3].teach,/BOTTOM to the TOP/);
  assert.ok(Object.isFrozen(cards)&&cards.every(Object.isFrozen));
  for(const card of cards)assert.doesNotMatch(card.teach+' '+card.example,/\b[A-G][0-8]\b/);
  const picture=clefReminderSVG(clef,'clef');assert.ok(picture.includes(notation.glyph(clef==='bass'?'fClef':'gClef')));
  assert.match(picture,new RegExp((clef==='bass'?'F':'G')+' line'));
 }
 assert.match(CLEF_REMINDERS.treble[1].example,/curls around the G line/);
 assert.match(CLEF_REMINDERS.bass[1].example,/two dots point to the F line/);
 assert.deepEqual(CLEF_REMINDERS.treble[2].letters,['E','G','B','D','F']);
 assert.deepEqual(CLEF_REMINDERS.treble[3].letters,['F','A','C','E']);
 assert.deepEqual(CLEF_REMINDERS.bass[2].letters,['G','B','D','F','A']);
 assert.deepEqual(CLEF_REMINDERS.bass[3].letters,['A','C','E','G']);
 assert.deepEqual(LESSONS.filter(lesson=>['note-naming','bass-clef'].includes(lesson.id)).map(lesson=>lesson.total),[10,9],'Teaching introductions do not rewrite canonical saved checkpoints');
});

test('little learner pages keep one short instruction and preserve every saved exercise',()=>{
 const {SIMPLE_NOTE_COPY,NOTE_LESSONS}=require('../classroom-tutorials.js');
 for(const [id,steps]of Object.entries(NOTE_LESSONS)){
  assert.equal(SIMPLE_NOTE_COPY[id].length,steps.length,id+' keeps its saved step count');
  for(const [index,copy]of SIMPLE_NOTE_COPY[id].entries()){
   const [guide,caption,prompt,hint]=copy;
   assert.ok(guide.trim().split(/\s+/).length<=12,id+' guide '+index+' is one small idea');
   assert.ok(hint.trim().split(/\s+/).length<=16,id+' hint '+index+' stays short');
   assert.ok(prompt.trim().split(/\s+/).length<=6,id+' action '+index+' is simple');
   assert.doesNotMatch([guide,caption,prompt,hint].join(' '),/\b[A-G][0-8]\b/,'No octave labels in child-facing text');
   if(steps[index].kind==='keys')assert.equal(prompt,'Tap '+steps[index].answer+'.');
  }
 }
 const all=Object.values(SIMPLE_NOTE_COPY).flat().flat().join(' ');
 for(const saying of ['Every Good Boy Does Fine','FACE','Great Big Dreams For America','All Cows Eat Grass','Middle C'])assert.ok(all.includes(saying),saying+' remains available in the teaching');
});


test('a tiny split picture and its sound always describe the same local amount of music',()=>{
 const {splitExample}=require('../classroom-tutorials.js');
 assert.deepEqual([0,1,2,3,4].map(level=>splitExample(level).counts),[4,4,2,1,.5]);
 for(let level=0;level<5;level++){
  const example=splitExample(level);assert.equal(example.notes.length,level?2:1);
  assert.ok(example.notes.every(units=>units===VALUES[level].units));
  if(level)assert.equal(example.notes.reduce((sum,n)=>sum+n,0),example.parentUnits,'The two children last exactly as long as their pictured parent');
 }
});

test('major and minor keys teach musical homes through short, correctly pitched examples',()=>{
 assert.equal(LESSONS.find(lesson=>lesson.id==='major-minor-keys').total,8);
 assert.equal(KEY_STEPS.length,8);
 for(const question of KEY_STEPS){
  assert.ok(question.guide.split(/\s+/).length<=13,'One small teaching idea at a time');
  assert.equal(question.answers.length,3);assert.ok(question.answers[question.answer]);
  assert.ok(question.hint&&question.caption);assert.ok(question.sounds.length>0);
  assert.doesNotMatch(JSON.stringify({guide:question.guide,caption:question.caption,prompt:question.prompt,notes:question.notes}),/\b[A-G][♯♭]?[0-8]\b/);
  for(const sound of question.sounds)assert.ok(sound.notes.every(note=>Number.isInteger(note)&&note>=48&&note<=84));
 }
 assert.deepEqual(KEY_STEPS[2].sounds.map(sound=>sound.notes[1]),[64,63],'C major uses E, C minor E-flat');
 assert.deepEqual(KEY_STEPS[1].sounds[0].notes,[60,62,64,65,67,69,71,72,71,69,67,65,64,62,60]);
 assert.deepEqual(KEY_STEPS[5].sounds[0].notes,[62,64,66,67,69,71,73,74],'D major has F-sharp and C-sharp');
 assert.deepEqual(KEY_STEPS[6].sounds[0].notes,[57,59,60,62,64,65,67,69],'A natural minor has no altered notes');
 assert.match(KEY_STEPS[4].caption,/Either.*happy or sad/,'Mood is not a rigid major/minor rule');
 const legacy=normalize({version:1,lessons:{'note-naming':{step:10,completed:true,completedAt:123}}});
 assert.equal(legacy.lessons['note-naming'].completed,true);assert.deepEqual(legacy.lessons['major-minor-keys'],{step:0,completed:false,completedAt:0});
});

test('dynamics and tempo teach different musical controls using matching examples',()=>{
 const {DYNAMIC_LEVELS,DYNAMICS_STEPS,TEMPO_STEPS,EXPRESSION_NOTES}=require('../classroom-tutorials.js');
 assert.deepEqual(DYNAMIC_LEVELS.map(value=>value.mark),['pp','p','mp','mf','f','ff']);
 assert.ok(DYNAMIC_LEVELS.every((value,index)=>value.gain>0&&value.gain<=.14&&(!index||value.gain>DYNAMIC_LEVELS[index-1].gain)));
 for(const [id,steps]of [['dynamics',DYNAMICS_STEPS],['tempo',TEMPO_STEPS]]){
  assert.equal(steps.length,8);assert.equal(LESSONS.find(lesson=>lesson.id===id).total,8);
  for(const step of steps){
   assert.ok(step.guide.split(/\s+/).length<=13,'One short teaching idea');
   assert.equal(new Set(step.answers).size,3);assert.ok(step.answers[step.answer]);assert.ok(step.hint&&step.caption);
   for(const sound of step.sounds){
    assert.equal(sound.bpms.length,EXPRESSION_NOTES.length);assert.equal(sound.gains.length,EXPRESSION_NOTES.length);
    assert.ok(sound.bpms.every(bpm=>Number.isFinite(bpm)&&bpm>=60&&bpm<=168));
    if(id==='dynamics')assert.ok(sound.bpms.every(bpm=>bpm===100),'Dynamics must not change speed');
    else assert.ok(sound.gains.every(gain=>gain===.075),'Tempo must not change loudness');
   }
  }
 }
 const dynamicsCopy=JSON.stringify(DYNAMICS_STEPS),tempoCopy=JSON.stringify(TEMPO_STEPS);
 for(const term of ['pianissimo','piano','mezzo piano','mezzo forte','forte','fortissimo'])assert.ok(DYNAMIC_LEVELS.some(level=>level.name===term));
 for(const term of ['crescendo','diminuendo','decrescendo'])assert.ok(dynamicsCopy.includes(term));
 for(const term of ['Largo','Adagio','Andante','Moderato','Allegro','Presto','accelerando','ritardando','BPM'])assert.ok(tempoCopy.includes(term));
 const louder=DYNAMICS_STEPS[5].sounds[0].gains,softer=DYNAMICS_STEPS[6].sounds[0].gains;
 assert.ok(louder.every((value,index)=>!index||value>louder[index-1]));assert.deepEqual(softer,[...louder].reverse());
 const faster=TEMPO_STEPS[5].sounds[0].bpms,slower=TEMPO_STEPS[6].sounds[0].bpms;
 assert.ok(faster.every((value,index)=>!index||value>faster[index-1]));assert.deepEqual(slower,[...faster].reverse());
 const old=normalize({version:1,lessons:{'note-naming':{step:10,completed:true,completedAt:1}}});
 assert.equal(old.lessons['note-naming'].completed,true);assert.equal(old.lessons.dynamics.step,0);assert.equal(old.lessons.tempo.completed,false);
});
