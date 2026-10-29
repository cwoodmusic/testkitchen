const test=require('node:test'),assert=require('node:assert/strict');
const {create,resultRow,publicChampion}=require('../hall-of-fame.js');
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};};
const triad={mode:'computer',score:7,captures:3};
test('top scores improve only on a completed validated result, and persist per mode',()=>{
 const storage=memory(),fame=create({storage,getAvatar:()=>({name:'Coda'})});
 assert.equal(fame.record('triad','first',triad),true);
 assert.equal(fame.record('triad','lower',{...triad,score:6}),false);
 assert.equal(fame.record('triad','same',triad),false);
 assert.equal(fame.record('triad','better',{...triad,captures:4}),true);
 assert.equal(create({storage}).snapshot().records['triad:computer'].tiebreak,4);
 assert.equal(fame.record('pitch','invalid',{mode:'classic',score:Infinity}),false);
});
test('Rhythm rankings include extra taps in accuracy and validate bounds',()=>{
 assert.equal(resultRow('rhythm','run',{mode:'tap',total:10,hits:10,extra:10},'A').score,50);
 assert.equal(resultRow('rhythm','run',{mode:'tap',total:10,hits:11,extra:0},'A'),null);
});
test('public champion uses real initials and same score/streak tie break as Pitch Race',()=>{
 assert.deepEqual(publicChampion({a:{initials:'AAA',score:100,streak:3,level:0},b:{initials:'BBB',score:100,streak:5,level:0},c:{initials:'<bad>',score:999,streak:1,level:0}}),{name:'BBB',score:100,streak:5});
 assert.equal(publicChampion(null),null);
});
test('failed saving does not claim a new record',()=>{
 const fame=create({storage:{getItem(){},setItem(){throw Error('quota');}}});
 assert.equal(fame.record('triad','run',triad),false);assert.deepEqual(fame.snapshot().records,{});
});
