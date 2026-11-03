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
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('only validated improved and saved completed records are published, without player names',async()=>{
 const calls=[],events=[],storage=memory(),save=storage.setItem;storage.setItem=(...args)=>{events.push('saved');save(...args);};
 const fame=create({storage,getAvatar:()=>({name:'Private avatar name'}),getSharedContext:()=>({identity:'student-a',student:true,classId:'class-a'}),publishRecord:async row=>{events.push('published');calls.push(row);return {ok:true};}});
 assert.equal(fame.record('triad','first',triad),true);
 assert.equal(fame.record('triad','lower',{...triad,score:6}),false);
 assert.equal(fame.record('triad','same',triad),false);
 assert.equal(fame.record('pitch','invalid',{mode:'classic',score:Infinity}),false);
 await flush();
 assert.deepEqual(calls,[{game:'triad',mode:'computer',score:7,tiebreak:3}]);assert.deepEqual(events,['saved','published']);
 assert.equal(fame.record('triad','better',{...triad,captures:4}),true);await flush();
 assert.deepEqual(calls[1],{game:'triad',mode:'computer',score:7,tiebreak:4});
 const failed=create({storage:{getItem(){},setItem(){throw Error('quota');}},publishRecord:async row=>calls.push(row)});
 assert.equal(failed.record('triad','not-saved',triad),false);await flush();assert.equal(calls.length,2);
});
test('switching identity reloads scoped bests and cancels a queued previous-player publication',async()=>{
 let identity='student-a',current=memory();const calls=[],storage={getItem:key=>current.getItem(key),setItem:(key,value)=>current.setItem(key,value)};
 const fame=create({storage,getSharedContext:()=>({identity,student:true,classId:'class-a'}),publishRecord:async row=>{calls.push(row);return {ok:true};}});
 assert.equal(fame.record('triad','a-record',triad),true);
 identity='student-b';current=memory();fame.refresh();await flush();
 assert.deepEqual(calls,[]);assert.deepEqual(fame.snapshot().records,{});
 assert.equal(fame.record('triad','b-record',{...triad,score:5}),true);await flush();
 assert.deepEqual(calls,[{game:'triad',mode:'computer',score:5,tiebreak:3}]);
});
test('saved completed bests retry after offline publication without resaving or repeating successful syncs',async()=>{
 const storage=memory();create({storage}).record('triad','saved-run',triad);
 const before=storage.getItem('codaHallOfFameV1'),calls=[];let online=false;
 const fame=create({storage,getSharedContext:()=>({identity:'student-a',student:true,classId:'class-a'}),publishRecord:async row=>{calls.push(row);return {ok:online,code:online?'':'unavailable'};}});
 await fame.syncRecords();assert.equal(calls.length,1);assert.equal(fame.snapshot().publishState,'error');
 await fame.syncRecords();assert.equal(calls.length,1,'An ordinary refresh must not retry every saved score');
 online=true;await fame.syncRecords(true);assert.equal(calls.length,2);assert.equal(fame.snapshot().publishState,'ready');
 await fame.syncRecords(true);assert.equal(calls.length,2,'Successful scores do not need another publication');
 assert.equal(storage.getItem('codaHallOfFameV1'),before,'Sharing never rewrites or awards personal progress');
});
test('a previous player’s delayed publication result cannot change the current player state',async()=>{
 let identity='student-a',current=memory(),finish;const storage={getItem:key=>current.getItem(key),setItem:(key,value)=>current.setItem(key,value)};
 const fame=create({storage,getSharedContext:()=>({identity,student:true,classId:'class-a'}),publishRecord:()=>new Promise(resolve=>{finish=resolve;})});
 fame.record('triad','a-record',triad);await Promise.resolve();
 identity='student-b';current=memory();fame.refresh();finish({ok:false,code:'unavailable'});await flush();
 assert.deepEqual(fame.snapshot().records,{});assert.equal(fame.snapshot().publishState,'idle');
});
