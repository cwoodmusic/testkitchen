const test=require('node:test'),assert=require('node:assert/strict');
const lesson=require('../time-signature-lesson.js'),tutorial=require('../classroom-tutorials.js');
test('three signatures distinguish written note values from the main pulse',()=>{
 assert.deepEqual(Object.keys(lesson.METERS),['4/4','6/8','2/2']);
 assert.equal(lesson.METERS['4/4'].pulses,4);assert.equal(lesson.METERS['4/4'].pulseBeats,1);
 assert.equal(lesson.METERS['6/8'].top,6);assert.equal(lesson.METERS['6/8'].bottom,8);assert.equal(lesson.METERS['6/8'].pulses,2);assert.equal(lesson.METERS['6/8'].pulseBeats,1.5);
 assert.equal(lesson.METERS['2/2'].pulses,2);assert.equal(lesson.METERS['2/2'].pulseBeats,2);
});
test('heard examples keep equal big-beat tempo and accurate 6/8 subdivision groups',()=>{
 for(const meter of Object.keys(lesson.METERS)){
  const model=lesson.METERS[meter],events=lesson.pulseSchedule(meter,{bpm:80,bars:2}),big=events.filter(event=>event.primary);
  assert.equal(big.length,model.pulses*2);for(let at=1;at<big.length;at++)assert.ok(Math.abs(big[at].time-big[at-1].time-.75)<1e-8);
  assert.equal(events.filter(event=>event.accent).length,2);
 }
 const six=lesson.pulseSchedule('6/8',{bpm:80,bars:1});assert.equal(six.length,6);assert.deepEqual(six.map(event=>event.label),['ONE','la','li','TWO','la','li']);
 assert.deepEqual(six.map(event=>event.primary),[true,false,false,true,false,false]);assert.deepEqual(six.map(event=>event.time),[0,.25,.5,.75,1,1.25]);
});
test('bar activities require their actual note recipe and reject wrong counts',()=>{
 assert.equal(lesson.validBar([1,1,1,1],2),true);assert.equal(lesson.validBar([4],2),false);
 assert.equal(lesson.validBar([.5,.5,.5,.5,.5,.5],5),true);assert.equal(lesson.validBar([1,1,1],5),false);
 assert.equal(lesson.validBar([2,2],7),true);assert.equal(lesson.validBar([1,1],7),false);assert.equal(lesson.validBar([2,2,2],7),false);
 for(const step of [2,5,7])assert.equal(lesson.STEPS[step].recipe.reduce((sum,n)=>sum+n,0),lesson.METERS[lesson.STEPS[step].meter].barBeats);
});
test('all eight activities have correct answers and the shared saved journal includes the new lesson',()=>{
 assert.equal(lesson.STEPS.length,lesson.LESSON.total);assert.equal(tutorial.LESSONS.find(item=>item.id==='time-signatures').total,8);
 for(const step of lesson.STEPS){assert.ok(step.prompt&&step.teach&&step.hint);if(step.kind==='choice')assert.ok(step.correct>=0&&step.correct<step.answers.length);}
 const old=tutorial.normalize({version:1,lessons:{'note-naming':{step:10,completed:true,completedAt:1}}});assert.equal(old.lessons['note-naming'].completed,true);assert.equal(old.lessons['time-signatures'].completed,false);
 const completed=tutorial.normalize({version:1,lessons:{'time-signatures':{step:8,completed:true,completedAt:12}}});assert.equal(completed.lessons['time-signatures'].completed,true);
 assert.equal(tutorial.normalize({version:1,lessons:{'time-signatures':{step:7,completed:true}}}).lessons['time-signatures'].completed,false);
});

test('meter teaching uses short child-friendly instructions before one clear task',()=>{
 for(const step of lesson.STEPS){
  assert.ok(step.teach.split(/\s+/).length<=14,step.id+' teaches one short idea');
  assert.ok(step.prompt.split(/\s+/).length<=10,step.id+' names one small action');
  assert.ok(step.hint.split(/\s+/).length<=10,step.id+' reveals one short hint');
 }
});
