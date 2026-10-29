'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const bank=require('../final-exam-bank.js');
const ids=['note-naming','bass-clef','grand-staff','rhythm-tree','time-signatures','major-minor-keys','dynamics','tempo'];
const correct=q=>q.choices.find(choice=>choice.id===q.answer).text;
const questions=skill=>bank.QUESTIONS.filter(q=>q.skill===skill);
const alphabet='ABCDEFG';
const wrap=(index,length)=>((index%length)+length)%length;
const letterAt=(clef,position)=>alphabet[wrap(alphabet.indexOf(clef==='bass'?'G':'E')+position,7)];
const noteNames=new Map([[.25,'sixteenth'],[.5,'eighth'],[.75,'dotted eighth'],[1,'quarter'],[1.5,'dotted quarter'],[2,'half'],[3,'dotted half'],[4,'whole']]);
const fractions={'¼':.25,'½':.5,'¾':.75};
function beats(text){
 const token=text.split(' ')[0],match=token.match(/^(\d+)?([¼½¾])?$/);
 if(!match)return Number(token);
 return Number(match[1]||0)+(fractions[match[2]]||0);
}
const meterQuarterLength=meter=>{const [top,bottom]=meter.split('/').map(Number);return top*4/bottom;};
function pitchClass(name){
 const [letter,alter]=name.split('-');
 return wrap({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[letter]+(alter==='sharp'?1:alter==='flat'?-1:0),12);
}
function scale(root,minor=false){
 const intervals=minor?[2,1,2,2,1,2,2]:[2,2,1,2,2,2,1];
 let pitch=pitchClass(root);const result=[pitch];
 for(const interval of intervals.slice(0,6)){pitch=wrap(pitch+interval,12);result.push(pitch);}
 return result;
}
function walk(value,visit,path='question'){
 visit(value,path);if(value&&typeof value==='object')for(const [key,item]of Object.entries(value))walk(item,visit,path+'.'+key);
}

test('versioned bank has exactly 100 stable unique questions in each of eight categories',()=>{
 assert.equal(bank.VERSION,1);assert.equal(bank.version,1);
 assert.deepEqual(bank.CATEGORIES.map(value=>value.id),ids);assert.equal(bank.QUESTIONS.length,800);
 const fingerprints=new Set();
 for(const category of ids){
  const pool=bank.pool(category);assert.equal(pool.length,100);
  assert.ok(new Set(pool.map(q=>q.skill)).size>=4,'Varied question families: '+category);
  pool.forEach((q,index)=>{
   assert.equal(q.id,category+'-'+String(index+1).padStart(3,'0'));
   assert.equal(q.category,category);assert.equal(bank.getQuestion(q.id),q);
   assert.ok(q.prompt.length>8&&q.prompt.length<250,q.id+' readable prompt');
   assert.ok(q.explanation.length>12,q.id+' explanation');
   assert.equal(q.choices.length,3);assert.equal(new Set(q.choices.map(c=>c.id)).size,3);
   assert.equal(new Set(q.choices.map(c=>c.text)).size,3,q.id+' unique alternatives');
   assert.equal(q.choices.filter(choice=>choice.id===q.answer).length,1);
   const fingerprint=JSON.stringify([category,q.prompt,q.stimulus||null]);
   assert.ok(!fingerprints.has(fingerprint),q.id+' duplicates a question');fingerprints.add(fingerprint);
   walk(q,(value,path)=>{
    assert.notEqual(value,undefined,path+' is undefined');
    if(typeof value==='string'){
     assert.ok(!/\b(?:undefined|NaN)\b/.test(value),q.id+' unresolved content '+path);
     assert.ok(!/<(?:script|iframe)|javascript:/i.test(value),q.id+' unsafe text');
    }
   });
   assert.ok(!/\b[A-G][0-9]\b/.test(q.prompt),q.id+' avoids octave numbers');
  });
 }
 assert.deepEqual(bank.pool('unknown'),[]);assert.equal(bank.getQuestion('unknown'),null);
 assert.equal(new Set(bank.QUESTIONS.map(q=>q.id)).size,800);
 for(const answer of ['a','b','c'])assert.ok(bank.QUESTIONS.filter(q=>q.answer===answer).length>250);
});

test('the browser and CommonJS bank agree without storage, network, or random generation',()=>{
 const source=fs.readFileSync(require.resolve('../final-exam-bank.js'),'utf8');
 const context={window:{},console};vm.runInNewContext(source,context);
 assert.equal(JSON.stringify(context.window.CodaFinalExamBank.QUESTIONS),JSON.stringify(bank.QUESTIONS));
 assert.ok(Object.isFrozen(bank.QUESTIONS));assert.ok(Object.isFrozen(bank.QUESTIONS[0].choices));
 assert.throws(()=>bank.QUESTIONS[0].choices.push({id:'x',text:'changed'}),TypeError);
 assert.ok(!/localStorage|sessionStorage|fetch\(|XMLHttpRequest|firebase|Math\.random/.test(source));
});

test('staff pictures are bounded, use neutral labels, and read correctly in both clefs',()=>{
 const pictures=bank.QUESTIONS.filter(q=>q.stimulus?.kind==='staff');assert.ok(pictures.length>100);
 for(const q of pictures){
  const s=q.stimulus;assert.ok(['treble','bass'].includes(s.clef));
  assert.ok(Number.isInteger(s.position));
  assert.ok(s.position>=0&&s.position<=8||s.position===(s.clef==='bass'?10:-2),q.id+' only Middle C needs a ledger line');
  assert.ok(!/\b[A-G]\b/.test(s.label),q.id+' picture label must not reveal a letter');
  if(q.category==='grand-staff')assert.equal(s.grand,true);
  if(q.skill==='read-note')assert.equal(correct(q),letterAt(s.clef,s.position),q.id);
  if(q.skill==='staff-place'){
   assert.equal(correct(q),(s.position%2===0?'Line ':'Space ')+(Math.floor(s.position/2)+1)+' from the bottom',q.id);
  }
  if(q.skill==='step'||q.skill==='skip'){
   const distance=q.prompt.includes('one step')?1:q.prompt.includes('two steps')?2:3;
   const direction=q.prompt.includes('higher')?1:-1;
   assert.equal(correct(q),letterAt(s.clef,s.position+distance*direction),q.id);
  }
 }
});

test('alphabet and mnemonic answers follow bottom-to-top classroom conventions',()=>{
 for(const q of questions('musical-alphabet')){
  const [,direction,letter]=q.prompt.match(/just (after|before) ([A-G])/);
  assert.equal(correct(q),alphabet[wrap(alphabet.indexOf(letter)+(direction==='after'?1:-1),7)],q.id);
 }
 for(const q of questions('letter-sequence')){
  const [,first,last]=q.prompt.match(/up: ([A-G]) — \? — ([A-G])/);
  const answer=alphabet[wrap(alphabet.indexOf(first)+1,7)];
  assert.equal(correct(q),answer,q.id);assert.equal(last,alphabet[wrap(alphabet.indexOf(first)+2,7)]);
 }
 for(const q of questions('mnemonic')){
  const quoted=q.prompt.match(/“([^”]+)”/);
  if(quoted)assert.equal(correct(q),quoted[1][0],q.id);
  else {const number=Number(q.prompt.match(/space (\d)/)[1]);assert.equal(correct(q),'FACE'[number-1],q.id);}
  assert.ok(/bottom to top/.test(q.prompt));
 }
});

test('rhythm questions preserve note/rest lengths, dots, equivalent groups and 4/4 arithmetic',()=>{
 for(const q of bank.pool('rhythm-tree')){
  const values=q.stimulus?.notes?.map(note=>note.beats),answer=correct(q);
  if(q.stimulus){assert.equal(q.stimulus.meter,'4/4');for(const note of q.stimulus.notes){assert.ok(noteNames.has(note.beats));assert.equal(typeof note.rest,'boolean');}}
  if(q.skill==='duration')assert.equal(beats(answer),values[0],q.id);
  if(q.skill==='equivalent-length'||q.skill==='rhythm-tree')assert.equal(Number(answer),values[0]/values[1],q.id);
  if(q.skill==='compare-length')assert.equal(answer,values[0]>values[1]?'The first note':'The second note',q.id);
  if(q.skill==='add-lengths')assert.equal(beats(answer),values.reduce((a,b)=>a+b,0),q.id);
  if(q.skill==='complete-bar')assert.equal(beats(answer)+values.reduce((a,b)=>a+b,0),4,q.id);
  if(q.skill==='match-rest')assert.equal(answer,'A '+noteNames.get(values[0])+' rest',q.id);
  if(q.skill==='augmentation-dot')assert.equal(beats(answer),values[0]/3,q.id);
 }
 assert.deepEqual(new Set(questions('compare-length').map(correct)),new Set(['The first note','The second note']),'Comparison pictures must require reading both note orders');
 for(const q of questions('duration').filter(q=>[3,1.5].includes(q.stimulus.notes[0].beats)))assert.match(q.prompt,/dot adds half the plain length/);
 for(const q of questions('augmentation-dot'))assert.match(q.prompt,/dot adds half the plain length/);
});

test('meter arithmetic separates written units from the felt big beat in 6/8 and cut time',()=>{
 for(const q of bank.pool('time-signatures')){
  const m=q.stimulus?.meter,answer=correct(q);
  if(q.skill==='read-meter')assert.equal(Number(answer),Number(m.split('/')[0]),q.id);
  if(q.skill==='denominator')assert.equal(answer,{'2':'Half note','4':'Quarter note','8':'Eighth note'}[m.split('/')[1]],q.id);
  if(q.skill==='bar-length'){
   const unit=q.prompt.includes('quarter notes')?1:q.prompt.includes('eighth notes')?.5:.25;
   assert.equal(Number(answer)*unit,meterQuarterLength(m),q.id);
  }
  if(q.skill==='equivalent-bar')assert.equal(Number(answer.split(' ')[0]),meterQuarterLength(m),q.id);
  if(q.skill==='finish-meter-bar'){
   assert.ok(!/quarter-note beats?/.test(q.prompt));
   const used=q.prompt.match(/holds (\S+) quarter-note/)[1];
   assert.equal(beats(used)+beats(answer),meterQuarterLength(m),q.id);
  }
  if(q.skill==='pulse')assert.equal(Number(answer),m==='6/8'||m==='2/2'?2:Number(m.split('/')[0]),q.id);
  if(q.skill==='pulse-unit')assert.equal(answer,m==='6/8'?'Dotted quarter note':m==='2/2'?'Half note':'Quarter note',q.id);
  if(q.skill==='two-bars')assert.equal(Number(answer),2*meterQuarterLength(m),q.id);
  if(q.skill==='compare-bars'){
   const [a,b]=q.prompt.match(/\d\/\d/g),x=meterQuarterLength(a),y=meterQuarterLength(b);
   assert.equal(answer,x>y?a:y>x?b:'They have equal written length',q.id);
  }
 }
 const six=bank.pool('time-signatures').find(q=>q.skill==='pulse'&&q.stimulus.meter==='6/8');
 assert.equal(correct(six),'2');
 assert.ok(!bank.pool('time-signatures').some(q=>/halves.*value|doubles.*value/i.test(q.explanation)));
});

test('all twelve major and natural minor scales use correct tonics, thirds, relatives and accidentals',()=>{
 const majorHomes=new Set(),minorHomes=new Set();
 for(const q of bank.pool('major-minor-keys')){
  const answer=correct(q);
  if(q.skill==='tonic'){
   const [,home,mode]=q.prompt.match(/of (\S+) (major|minor)/);
   assert.equal(answer,home,q.id);(mode==='major'?majorHomes:minorHomes).add(pitchClass(home));
  }
  if(q.skill==='relative-keys'){
   const root=q.prompt.match(/(\S+) major has/)[1],minor=answer.replace(' minor','');
   assert.equal(pitchClass(minor),wrap(pitchClass(root)+9,12),q.id);
   assert.deepEqual([...scale(root)].sort((a,b)=>a-b),[...scale(minor,true)].sort((a,b)=>a-b),q.id);
  }
  if(q.skill==='major-third'||q.skill==='minor-third'){
   const [,root]=q.prompt.match(/of the (\S+) /);assert.equal(pitchClass(answer),wrap(pitchClass(root)+(q.skill==='major-third'?4:3),12),q.id);
  }
  if(q.skill==='scale-pattern'){
   const root=q.prompt.match(/this (\S+) major/)[1],expected=scale(root),notes=q.stimulus.notes;
   assert.equal(notes.length,7);assert.equal(notes.filter(n=>n==='?').length,1);
   notes.forEach((n,index)=>assert.equal(pitchClass(n==='?'?answer:n),expected[index],q.id+' scale step '+index));
  }
  if(q.skill==='key-membership'){
   const root=q.prompt.match(/the (\S+) major/)[1],pitches=scale(root);
   assert.ok(!pitches.includes(pitchClass(answer)),q.id);
   for(const wrong of q.choices.filter(c=>c.id!==q.answer))assert.ok(pitches.includes(pitchClass(wrong.text)),q.id+' distractor must actually be in key');
  }
 }
 assert.equal(majorHomes.size,12);assert.equal(minorHomes.size,12);
 const mood=bank.pool('major-minor-keys').filter(q=>/Must every.*sound/.test(q.prompt));
 assert.equal(mood.length,2);for(const q of mood)assert.match(correct(q),/^No,/);
});

test('scale extensions supply the information needed instead of requiring untaught key memorization',()=>{
 for(const q of questions('relative-keys')){assert.match(q.prompt,/starts on note 6/);assert.equal(q.stimulus.kind,'scale');assert.equal(q.stimulus.notes.length,7);}
 for(const q of [...questions('major-third'),...questions('minor-third')]){assert.match(q.prompt,/Count the home as 1/);assert.equal(q.stimulus.kind,'scale');assert.equal(q.stimulus.notes.length,7);}
 for(const q of questions('key-membership')){assert.match(q.prompt,/Use the shown notes/);assert.equal(q.stimulus.kind,'scale');}
 for(const q of questions('scale-pattern'))assert.match(q.prompt,/Follow the letter names/);
 for(const number of ['085','086','087','088','089','090'])assert.ok(!/Which pattern builds|Between which.*half steps|Which step is the relative/.test(bank.getQuestion('major-minor-keys-'+number).prompt));
});

test('dynamic marks and comparisons use loudness, not tempo',()=>{
 const ladder=['pp','p','mp','mf','f','ff'],meaning=['very soft','soft','medium soft','medium loud','loud','very loud'];
 for(const q of bank.pool('dynamics')){
  const answer=correct(q);
  if(q.skill==='dynamic-mark')assert.equal(answer,meaning[ladder.indexOf(q.stimulus.mark)],q.id);
  if(q.skill==='choose-mark')assert.equal(answer,ladder[meaning.indexOf(q.prompt.match(/“([^”]+)”/)[1])],q.id);
  if(q.skill==='compare-dynamics'){
   const [,direction,a,b]=q.prompt.match(/Which is (louder|softer): (\w+) or (\w+)/);
   assert.equal(answer,ladder[(direction==='louder'?Math.max:Math.min)(ladder.indexOf(a),ladder.indexOf(b))],q.id);
  }
  if(q.skill==='dynamic-order'){
   const order=answer.split(' → ').map(mark=>ladder.indexOf(mark));assert.deepEqual([...order].sort((a,b)=>a-b),order,q.id);
  }
  if(q.skill==='gradual-change')assert.equal(answer,'Get gradually '+(q.stimulus.mark==='crescendo'?'louder':'softer'),q.id);
 }
});

test('tempo comparisons name the beat unit and BPM facts remain correct',()=>{
 const meanings={Largo:'very slow and broad',Adagio:'slow',Andante:'at a walking pace',Moderato:'at a moderate pace',Allegro:'fast and lively',Presto:'very fast'};
 for(const q of bank.pool('tempo')){
  const answer=correct(q);
  if(q.skill==='tempo-word')assert.equal(answer,meanings[q.stimulus.text],q.id);
  if(q.skill==='choose-tempo')assert.equal(meanings[answer],q.prompt.match(/“([^”]+)”/)[1],q.id);
  if(q.skill==='compare-bpm'){
   assert.match(q.prompt,/same beat unit/);
   const [,direction,a,b]=q.prompt.match(/(faster|slower): (\d+) or (\d+)/);
   assert.equal(Number(answer.split(' ')[0]),(direction==='faster'?Math.max:Math.min)(Number(a),Number(b)),q.id);
  }
  if(q.skill==='bpm-meaning')assert.equal(Number(answer),q.stimulus.bpm,q.id);
  if(q.skill==='tempo-change')assert.equal(answer,q.stimulus.text==='accelerando'?'Gradually speed up':'Gradually slow down',q.id);
 }
});
