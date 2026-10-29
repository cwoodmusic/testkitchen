const test=require('node:test');
const assert=require('node:assert/strict');
const {frequency,noteName,noteLetter,keyPositionName,LESSONS,INTERVALS,paintedFloorKeys,polygonContains}=require('../piano-lab.js');
test('learner labels use letters and words to distinguish repeated keys',()=>{
 assert.equal(noteLetter(60),'C');assert.equal(noteLetter(61),'C♯');assert.equal(noteLetter(72),'C');
 assert.equal(keyPositionName(60,60),'lower C');assert.equal(keyPositionName(72,60),'higher C');assert.equal(keyPositionName(84,60),'highest C');
 for(let midi=48;midi<=96;midi++)assert.doesNotMatch(noteLetter(midi),/\d/);
});
test('piano tuning follows equal temperament and middle C naming',()=>{
 assert.equal(frequency(69),440);assert.equal(frequency(81),880);
 assert.ok(Math.abs(frequency(60)-261.625565)<.00001);
 assert.equal(noteName(60),'C4');assert.equal(noteName(61),'C♯4');assert.equal(noteName(84),'C6');
});
test('interval games cover higher and lower targets within the floor keyboard',()=>{
 assert.equal(INTERVALS.length,14);assert.equal(new Set(INTERVALS.map(item=>item.id)).size,14);
 for(const semitones of [1,2,3,4,5,7,12]){
  const up=INTERVALS.find(item=>item.id==='up-'+semitones),down=INTERVALS.find(item=>item.id==='down-'+semitones);
  assert.equal(up.target-up.start,semitones);assert.equal(down.start-down.target,semitones);
 }
 assert.ok(INTERVALS.every(item=>item.start>=0&&item.start<=12&&item.target>=0&&item.target<=12));
});
test('guided melodies fit the visible piano and have distinct stable reward ids',()=>{
 assert.equal(new Set(LESSONS.map(lesson=>lesson.id)).size,LESSONS.length);
 assert.ok(LESSONS.length>=3);
 for(const lesson of LESSONS){assert.ok(lesson.notes.length>=8);assert.ok(lesson.floorOffsets.every(note=>Number.isInteger(note)&&note>=0&&note<=21));assert.ok(lesson.description);}
});
test('painted perspective piano uses all 24 perspective keys and no floor outside them',()=>{
 const keys=paintedFloorKeys();assert.equal(keys.length,24);assert.equal(keys.filter(key=>key.black).length,10);
 assert.deepEqual(keys.map(key=>key.offset).sort((a,b)=>a-b),Array.from({length:24},(_,index)=>index));
 for(const key of keys){
  assert.equal(key.polygon.length,4);assert.ok(key.polygon.flat().every(Number.isFinite));
  const x=key.polygon.reduce((sum,point)=>sum+point[0],0)/4,y=key.polygon.reduce((sum,point)=>sum+point[1],0)/4;
  assert.equal(polygonContains(key.polygon,x,y),true);assert.equal(polygonContains(key.polygon,500,310),false);
 }
});
