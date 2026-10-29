'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const curriculum=require('../classroom-exam-curriculum.js'),bank=require('../final-exam-bank.js');
const clone=value=>JSON.parse(JSON.stringify(value));
const allCards=()=>curriculum.IDS.flatMap(id=>curriculum.forLesson(id));
const linkedCards=id=>allCards().filter(card=>card.covers.includes(id));
const teaching=id=>linkedCards(id).map(card=>[card.title,card.teach,card.example,card.prompt,card.hint].join(' ')).join(' ');
const requireTeaching=(id,...patterns)=>{assert.ok(linkedCards(id).length,id+' has a teaching card');for(const pattern of patterns)assert.match(teaching(id),pattern,id+' teaches '+pattern);};

test('all 800 stable questions have explicit teaching, a worked example, and an answerable practice check',()=>{
 const report=curriculum.getCoverage();assert.equal(report.total,800);assert.equal(report.covered,800);assert.equal(report.complete,true);
 assert.deepEqual(report.missing,[]);assert.deepEqual(report.requiresReview,[]);assert.deepEqual(report.unknownReferences,[]);assert.deepEqual(report.invalidCards,[]);
 assert.deepEqual(curriculum.validateCurriculum(),{ok:true,errors:[]});
 assert.equal(new Set(allCards().map(card=>card.id)).size,allCards().length);
 for(const category of curriculum.IDS){
  const cards=curriculum.forLesson(category),section=report.byCategory[category];
  assert.equal(bank.pool(category).length,100);assert.equal(section.total,100);assert.equal(section.covered,100);assert.ok(cards.length>=5,category+' is taught through several short concepts');
  for(const card of cards){
   for(const [field,maxWords]of [['teach',40],['example',80],['prompt',40],['hint',50]])assert.ok(card[field].trim().split(/\s+/).length<=maxWords,card.id+' keeps '+field+' short');
   assert.ok(card.answers.length>=2&&card.answers.length<=6);assert.ok(card.answers[card.correct]);assert.equal(new Set(card.answers).size,card.answers.length);
   assert.ok(card.covers.length>0);for(const id of card.covers){assert.equal(bank.getQuestion(id)?.category,category,card.id+' links its own topic');assert.ok(report.questionLinks[id].some(link=>link.lessonId===category&&link.cardId===card.id));}
  }
  for(const question of bank.pool(category))assert.ok(section.concepts.some(concept=>concept.questionIds.includes(question.id)),question.id+' appears in the traceability report');
 }
});

test('staff lessons explicitly teach the previously missing signs, all line/space maps, and directional moves',()=>{
 requireTeaching('note-naming-095',/sharp/i,/rais|higher/i,/half.step/i);
 requireTeaching('note-naming-096',/flat/i,/lower/i,/half.step/i);
 requireTeaching('note-naming-097',/natural/i,/cancel/i);
 requireTeaching('note-naming-007',/E.?G.?B.?D.?F|E, G, B, D, F/i,/bottom/i);
 requireTeaching('note-naming-008',/F.?A.?C.?E|F, A, C, E/i,/top/i);
 requireTeaching('note-naming-035',/two/i,/down|below/i,/up|above/i);
 requireTeaching('note-naming-092',/F.?G.?A.?B|F, G, A, B/i,/black/i);
 requireTeaching('bass-clef-080',/F clef/i);
 requireTeaching('bass-clef-067',/three|3/i,/move/i,/start/i);
 requireTeaching('bass-clef-098',/Middle C/i,/ledger/i,/above/i);
 requireTeaching('grand-staff-072',/five|5/i,/ten|10/i);
 requireTeaching('grand-staff-073',/brace/i);
 requireTeaching('grand-staff-087',/right hand/i,/left hand/i);
 requireTeaching('grand-staff-091',/vertic|line.*up/i,/same time|together/i);
 requireTeaching('grand-staff-092',/notehead/i,/stem/i,/clef/i);
});

test('rhythm and meter teaching covers rests, fractions, dots, ties, beaming, and different big beats',()=>{
 requireTeaching('rhythm-tree-014',/sixteenth/i,/rest/i,/quarter|¼/i);
 requireTeaching('rhythm-tree-072',/dot/i,/half/i,/original/i);
 requireTeaching('rhythm-tree-074',/eighth/i,/¼|quarter/i);
 requireTeaching('rhythm-tree-086',/tie/i,/same pitch/i,/hold|held/i);
 requireTeaching('rhythm-tree-088',/1.*1.*2|one.*one.*two/i);
 requireTeaching('rhythm-tree-090',/beam/i,/two|2/i,/sixteenth/i);
 requireTeaching('rhythm-tree-035',/add/i,/length/i);
 requireTeaching('rhythm-tree-050',/subtract|empty|leav/i,/four|4/i);
 requireTeaching('time-signatures-002',/bottom/i,/half/i,/quarter/i,/eighth/i);
 requireTeaching('time-signatures-003',/quarter/i,/2\/4/i);
 requireTeaching('time-signatures-017',/quarter/i,/3\/4/i);
 requireTeaching('time-signatures-059',/quarter/i,/6\/8/i);
 requireTeaching('time-signatures-005',/sixteenth/i,/four|4/i);
 requireTeaching('time-signatures-009',/1¼|1.25/i,/¾|0.75/i);
 requireTeaching('time-signatures-014',/two|2/i,/bar/i,/twice|double|add/i);
 requireTeaching('time-signatures-077',/3\/4/i,/6\/8/i,/three.*two|3.*2/i,/two.*three|2.*3/i);
 requireTeaching('time-signatures-078',/4\/4/i,/2\/2/i,/equal|same/i,/quarter/i,/half/i);
 requireTeaching('time-signatures-094',/tempo/i,/speed/i,/not.*double|does not.*double/i);
});

test('keys and expression lessons teach transferable methods rather than unexplained exam-only facts',()=>{
 requireTeaching('major-minor-keys-003',/sixth|six|6/i,/relative/i,/minor/i);
 requireTeaching('major-minor-keys-004',/third|3/i,/count/i);
 requireTeaching('major-minor-keys-006',/letter|A.?G/i,/sharp|flat/i);
 requireTeaching('major-minor-keys-007',/outside|not in|missing/i,/shown|list|compare/i);
 requireTeaching('major-minor-keys-095',/triad/i,/1.*3.*5|first.*third.*fifth/i);
 requireTeaching('dynamics-001',/pp|pianissimo/i,/soft/i);
 requireTeaching('dynamics-043',/pp/i,/mp/i,/mf/i,/ff/i,/order|ladder/i);
 requireTeaching('dynamics-090',/silence|silent/i,/rest/i,/soft/i);
 requireTeaching('dynamics-097',/end|arrive|target|destination/i,/loud/i);
 requireTeaching('dynamics-100',/balance|listen/i,/instrument|force/i);
 requireTeaching('tempo-052',/beat/i,/rhythm/i,/even|steady/i);
 requireTeaching('tempo-067',/a tempo/i,/previous|earlier|original|return/i);
 requireTeaching('tempo-083',/60/i,/second/i);
 requireTeaching('tempo-084',/120/i,/½|half|0.5/i,/second/i);
 requireTeaching('tempo-085',/30/i,/2|two/i,/second/i);
 requireTeaching('tempo-096',/note/i,/unit|click/i,/half/i);
 requireTeaching('tempo-098',/ritardando/i,/decrescendo/i,/speed|slow/i,/soft|loud/i);
});

test('missing teaching, bad references, invalid cards, and edited exam wording cannot report complete coverage',()=>{
 const lesson='note-naming',id='note-naming-097';
 const overrides={[lesson]:curriculum.forLesson(lesson).filter(card=>!card.covers.includes(id))};
 const removed=curriculum.getCoverage(bank,overrides);assert.ok(removed.missing.includes(id));assert.equal(removed.complete,false);assert.equal(removed.byCategory[lesson].covered<100,true);
 const invalid=clone(curriculum.LESSONS);invalid[lesson][0].teach='';assert.equal(curriculum.validateCurriculum(invalid).ok,false);assert.ok(curriculum.getCoverage(bank,invalid).invalidCards.length>0);
 const badLink=clone(curriculum.LESSONS);badLink[lesson][0].covers.push('not-a-real-question');assert.equal(curriculum.validateCurriculum(badLink).ok,false);assert.equal(curriculum.getCoverage(bank,badLink).unknownReferences.length,1);
 const wrongTopic=clone(curriculum.LESSONS);wrongTopic[lesson][0].covers.push('tempo-001');assert.equal(curriculum.validateCurriculum(wrongTopic).ok,false);
 const edited={QUESTIONS:clone(bank.QUESTIONS)};edited.QUESTIONS[0].prompt='A different musical idea needs teaching.';
 const changed=curriculum.getCoverage(edited);assert.deepEqual(changed.requiresReview,['note-naming-001']);assert.equal(changed.covered,799);assert.equal(changed.complete,false);
});

test('authoring normalizations and choice order preserve coverage while new questions need deliberate links',()=>{
 const content=require('../education-content.js'),values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const store=content.createStore({storage,canEdit:()=>true}),document=store.getDocument();assert.equal(content.validate(document).ok,true);assert.equal(store.saveDocument(document).ok,true);
 assert.equal(curriculum.getCoverage(store.getExamBank()).complete,true);
 document.exam.questions.push({id:'teacher-new-question',category:'tempo',prompt:'What new idea is this?',answers:['One','Two'],correct:0,explanation:'An example explanation.',visual:null});
 assert.equal(store.saveDocument(document).ok,true);const report=curriculum.getCoverage(store.getExamBank());assert.equal(report.total,801);assert.equal(report.covered,800);assert.deepEqual(report.missing,['teacher-new-question']);assert.equal(report.complete,false);
 const plainBank={QUESTIONS:bank.QUESTIONS.map(question=>({...clone(question),choices:[...clone(question.choices)].reverse()}))};assert.equal(curriculum.getCoverage(plainBank).complete,true,'Choice order does not change the tested material');
});

test('curriculum data is immutable and identical in browsers without storage, networking, or random work',()=>{
 assert.equal(Object.isFrozen(curriculum.LESSONS),true);for(const card of allCards()){assert.equal(Object.isFrozen(card),true);assert.equal(Object.isFrozen(card.covers),true);assert.equal(Object.isFrozen(card.answers),true);}
 assert.deepEqual(curriculum.forLesson('unknown'),[]);assert.throws(()=>curriculum.forLesson('tempo').push({}),TypeError);
 const browser={window:{},Math:Object.create(Math)};browser.Math.random=()=>{throw Error('No random generation');};
 Object.defineProperty(browser.window,'localStorage',{get(){throw Error('No profile reads');}});browser.window.fetch=()=>{throw Error('No network');};
 for(const file of ['final-exam-bank.js','classroom-curriculum-staff.js','classroom-curriculum-rhythm.js','classroom-curriculum-expression.js','classroom-exam-curriculum.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),browser);
 assert.equal(JSON.stringify(browser.window.CodaExamCurriculum.LESSONS),JSON.stringify(curriculum.LESSONS));assert.equal(browser.window.CodaExamCurriculum.getCoverage().covered,800);
 const first=curriculum.getCoverage();first.questionLinks['tempo-001'].pop();assert.ok(curriculum.getCoverage().questionLinks['tempo-001'].length>0,'Coverage snapshots do not mutate teaching data');
});

test('the published human-readable coverage map matches every current teaching card',()=>{
 const document=fs.readFileSync(path.join(__dirname,'../docs/exam-lesson-coverage.md'),'utf8');assert.equal(document,curriculum.coverageMarkdown());
 for(const category of curriculum.CATEGORIES){assert.ok(document.includes('## '+category.title));for(const card of curriculum.forLesson(category.id))assert.ok(document.includes('`'+card.id+'`'));}
});
