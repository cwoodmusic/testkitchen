const test=require('node:test'),assert=require('node:assert/strict');
const study=require('../classroom-exam-study.js');
function memory(seed={}){const values=new Map(Object.entries(seed));return {values,fail:false,getItem:key=>values.get(key)??null,setItem(key,value){if(this.fail)throw Error('quota');values.set(key,value);},removeItem:key=>values.delete(key)};}
const cards=Array.from({length:3},(_,index)=>({id:'study-card-'+index,title:'One idea',teach:'Learn the idea.',example:'Here is an example.',prompt:'Which answer?',answers:['First','Second','Third'],correct:index,hint:'Use the example.'}));
const create=(options={})=>study.createSession({lessonId:'note-naming',cards,storage:memory(),...options});
function answer(session){session.tryIt();assert.equal(session.answer(session.card().correct),true);}

test('practice requires a correct check per card, persists only IDs, and resumes the next card',()=>{
 const storage=memory({codaClassroomLessonsV1:'untouched canonical lesson',codaClassroomQuizzesV1:'untouched canonical quiz'}),session=create({storage});
 assert.equal(session.getState().stage,'look');assert.equal(session.answer(0),false);assert.equal(session.next(),false);
 session.tryIt();assert.equal(session.answer(1),false);assert.equal(session.getState().correct,false);assert.equal(session.getState().passed.length,0);assert.equal(session.next(),false);
 answer(session);assert.equal(session.getState().answered,true);assert.equal(session.next(),true);assert.equal(session.getState().index,1);
 const resumed=create({storage});assert.equal(resumed.getState().index,1);assert.deepEqual(resumed.getState().passed,['study-card-0']);
 answer(resumed);resumed.next();answer(resumed);assert.equal(resumed.getState().completed,true);assert.equal(resumed.next(),true);
 const raw=storage.getItem(study.KEY);for(const text of ['Learn the idea','Which answer','Use the example','First','Second'])assert.ok(!raw.includes(text));
 assert.equal(storage.getItem('codaClassroomLessonsV1'),'untouched canonical lesson');assert.equal(storage.getItem('codaClassroomQuizzesV1'),'untouched canonical quiz');
});

test('wrong and read-only actions cannot forge completion or alter an owned save',()=>{
 const storage=memory();let allowed=true,revision='r1';const session=create({storage,revision,getRevision:()=>revision,canRecord:()=>allowed});
 answer(session);const bytes=storage.getItem(study.KEY);allowed=false;
 assert.equal(session.next(),false);assert.equal(session.restart(),false);assert.equal(session.goTo(2),false);assert.equal(session.save(),false);assert.equal(storage.getItem(study.KEY),bytes);
 allowed=true;revision='r2';assert.equal(session.next(),false);assert.equal(session.tryIt(),false);assert.equal(storage.getItem(study.KEY),bytes);
 assert.match(session.getState().error,/profile or lesson changed/);
});

test('failed writes keep the correct answer available for retry and block advancement',()=>{
 const storage=memory(),session=create({storage});storage.fail=true;answer(session);
 assert.equal(session.getState().answered,true);assert.equal(session.getState().saved,false);assert.equal(session.next(),false);assert.equal(session.getState().index,0);
 storage.fail=false;assert.equal(session.save(),true);assert.equal(session.next(),true);assert.equal(session.getState().index,1);
});

test('separate lesson journals merge while stale sessions cannot overwrite the same lesson',()=>{
 const storage=memory(),a=create({storage}),b=create({storage}),other=create({storage,lessonId:'bass-clef'});
 answer(a);answer(other);assert.equal(other.getState().saved,true);assert.equal(a.next(),true);
 const bytes=storage.getItem(study.KEY);answer(b);assert.equal(b.getState().saved,false);assert.match(b.getState().error,/saved study changed/);assert.equal(storage.getItem(study.KEY),bytes);
 const journal=JSON.parse(bytes);assert.deepEqual(Object.keys(journal.lessons).sort(),['bass-clef','note-naming']);
});

test('a content revision starts fresh without deleting another topic or copying old success',()=>{
 const storage=memory(),old=create({storage,revision:'old'});answer(old);old.next();
 const fresh=create({storage,revision:'new'});assert.equal(fresh.getState().index,0);assert.deepEqual(fresh.getState().passed,[]);assert.equal(fresh.getState().completed,false);
 answer(fresh);assert.equal(JSON.parse(storage.getItem(study.KEY)).lessons['note-naming'].revision,'new');assert.equal(old.next(),false);
});

test('unknown lesson IDs, duplicate cards and malformed answer keys are rejected',()=>{
 assert.throws(()=>create({lessonId:'unknown'}),/valid lesson/);
 assert.throws(()=>create({cards:[cards[0],cards[0]]}),/valid lesson/);
 assert.throws(()=>create({cards:[{...cards[0],correct:8}]}),/valid lesson/);
 assert.throws(()=>create({cards:[{...cards[0],answers:['one']}]}),/valid lesson/);
});

const checksFor=card=>[card,
 {prompt:'Try a second example.',answers:['Hold','Play again','Stop counting'],correct:0,hint:'A held note keeps sounding.'},
 {prompt:'Explain the idea.',answers:['The beat stops','Keep the steady beat','Always play louder'],correct:1,hint:'Counting continues through the sound.'}];
test('three checks must each be correct before a teaching step completes or advances',()=>{
 const session=create({getChecks:checksFor});session.tryIt();
 assert.equal(session.getState().checkTotal,3);assert.equal(session.next(),false);
 assert.equal(session.answer(0),true);assert.deepEqual(session.getState().passed,[]);assert.equal(session.getState().checkIndex,0);
 assert.equal(session.next(),true);assert.equal(session.getState().index,0);assert.equal(session.getState().checkIndex,1);assert.equal(session.getState().stage,'try');
 assert.equal(session.answer(1),false);assert.equal(session.next(),false);assert.match(session.getState().feedback,/held note/);
 assert.equal(session.answer(0),true);assert.deepEqual(session.getState().passed,[]);session.next();
 assert.equal(session.getState().checkIndex,2);assert.equal(session.answer(1),true);assert.deepEqual(session.getState().passed,['study-card-0']);
 assert.equal(session.next(),true);assert.equal(session.getState().index,1);assert.equal(session.getState().checkIndex,0);
});

test('partial checks resume at the next question without storing prompts or correct answers',()=>{
 const storage=memory(),first=create({storage,getChecks:checksFor});first.tryIt();first.answer(0);first.next();
 const resumed=create({storage,getChecks:checksFor});assert.equal(resumed.getState().index,0);assert.equal(resumed.getState().checkIndex,1);assert.deepEqual(resumed.getState().passed,[]);
 resumed.tryIt();resumed.answer(0);resumed.next();resumed.answer(1);
 const complete=create({storage,getChecks:checksFor});assert.deepEqual(complete.getState().passed,['study-card-0']);
 const raw=storage.getItem(study.KEY);for(const text of ['Try a second','Keep the steady','held note'])assert.ok(!raw.includes(text));
});

test('failed check saves prevent progression until retry and profile changes prevent all writes',()=>{
 const storage=memory();let allowed=true;const session=create({storage,getChecks:checksFor,canRecord:()=>allowed});
 session.tryIt();storage.fail=true;session.answer(0);assert.equal(session.getState().saved,false);assert.equal(session.next(),false);
 storage.fail=false;assert.equal(session.save(),true);session.next();const bytes=storage.getItem(study.KEY);
 allowed=false;assert.equal(session.answer(0),false);assert.equal(session.next(),false);assert.equal(storage.getItem(study.KEY),bytes);
});

test('old completed cards remain completed when extra local practice checks are introduced',()=>{
 const storage=memory(),old=create({storage});answer(old);const bytes=storage.getItem(study.KEY);
 const expanded=create({storage,getChecks:checksFor});assert.deepEqual(expanded.getState().passed,['study-card-0']);assert.equal(storage.getItem(study.KEY),bytes);
 assert.equal(expanded.getState().checkIndex,2);expanded.tryIt();expanded.next();assert.equal(expanded.getState().index,1);
 assert.equal(expanded.restart(),true);assert.deepEqual(expanded.getState().passed,[]);assert.equal(expanded.getState().checkIndex,0);
});
