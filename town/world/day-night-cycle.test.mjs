import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY_NIGHT_PHASES,DAY_NIGHT_CYCLE_MS,dayNightCycleAt,createDayNightCycle} from './day-night-cycle.mjs';

const KEY='codaTownDayNightCycleV1';
const close=(a,b,tolerance=1e-9)=>assert(Math.abs(a-b)<=tolerance,`${a} versus ${b}`);
function memory(entries={}){
 const data=new Map(Object.entries(entries));let reads=0,writes=0;
 return {data,get reads(){return reads;},get writes(){return writes;},getItem(key){reads++;return data.get(key)??null;},setItem(key,value){writes++;data.set(key,value);}};
}

test('the full cycle is ten minutes day, three dusk, five night and three dawn',()=>{
 assert.equal(DAY_NIGHT_CYCLE_MS,21*60*1000);
 assert.deepEqual(DAY_NIGHT_PHASES.map(p=>[p.phase,p.durationMs]),[['day',600000],['dusk',180000],['night',300000],['dawn',180000]]);
 assert(Object.isFrozen(DAY_NIGHT_PHASES));assert(DAY_NIGHT_PHASES.every(Object.isFrozen));
 for(const p of DAY_NIGHT_PHASES){
  const start=dayNightCycleAt(p.startMs),end=dayNightCycleAt(p.startMs+p.durationMs-.001);
  assert.equal(start.phase,p.phase);assert.equal(start.label,p.label);assert.equal(start.phaseProgress,0);
  assert.equal(end.phase,p.phase);assert(end.phaseProgress>.99999&&end.phaseProgress<1);
 }
 assert.deepEqual(dayNightCycleAt(DAY_NIGHT_CYCLE_MS),dayNightCycleAt(0));
});

test('dusk darkens and dawn brightens smoothly with a warm middle and continuous boundaries',()=>{
 assert.equal(dayNightCycleAt(0).darkness,0);assert.equal(dayNightCycleAt(900000).darkness,1);
 let dusk=-1,dawn=2;
 for(let i=0;i<=100;i++){
  const d=dayNightCycleAt(600000+180000*i/100),a=dayNightCycleAt(1080000+180000*i/100);
  assert(d.darkness>=dusk);assert(a.darkness<=dawn);dusk=d.darkness;dawn=a.darkness;
  for(const p of [d,a])assert(p.warmth>=0&&p.warmth<=1);
 }
 for(const at of [600000,780000,1080000,1260000]){
  const before=dayNightCycleAt(at-1),after=dayNightCycleAt(at+1);
  close(before.darkness,after.darkness,1e-9);close(before.warmth,after.warmth,1e-8);
 }
 for(const at of [690000,1170000]){const p=dayNightCycleAt(at);assert.equal(p.darkness,.5);assert.equal(p.warmth,1);}
});

test('large wall-clock jumps and repeating cycles retain exact timing without ticking frames',()=>{
 for(const n of [0,1,17,1000000])for(const at of [0,123456,600000,690000,780000,1000000,1170000]){
  assert.deepEqual(dayNightCycleAt(n*DAY_NIGHT_CYCLE_MS+at),dayNightCycleAt(at));
 }
 for(const at of [undefined,NaN,Infinity,-Infinity,-1,-DAY_NIGHT_CYCLE_MS])assert.deepEqual(dayNightCycleAt(at),dayNightCycleAt(0));
 const huge=dayNightCycleAt(Number.MAX_VALUE);assert(DAY_NIGHT_PHASES.some(p=>p.phase===huge.phase));
 assert(Object.values(huge).filter(value=>typeof value==='number').every(Number.isFinite));
});

test('a new cycle starts in daytime, is stored once, and ignores the legacy fixed-night setting',()=>{
 let time=1000000;const storage=memory({codaTownBuilderNightV1:'night','unrelated-map':'unchanged'}),clock=createDayNightCycle({now:()=>time,storage});
 assert.equal(clock.mode,'auto');assert.equal(clock.sample().phase,'day');assert.equal(storage.reads,1);assert.equal(storage.writes,1);
 assert.deepEqual(JSON.parse(storage.data.get(KEY)),{version:1,startedAt:1000000,mode:'auto'});
 const saved=storage.data.get(KEY);
 for(let i=0;i<500;i++){time+=17;clock.sample();}
 assert.equal(storage.reads,1);assert.equal(storage.writes,1);assert.equal(storage.data.get(KEY),saved);
 assert.equal(storage.data.get('unrelated-map'),'unchanged');assert.equal(storage.data.get('codaTownBuilderNightV1'),'night');
});

test('reload and Builder-to-Play navigation retain the original phase and transition progress',()=>{
 let time=1000000;const storage=memory(),first=createDayNightCycle({now:()=>time,storage});
 time+=690000;assert.equal(first.sample().phase,'dusk');assert.equal(first.sample().darkness,.5);
 const next=createDayNightCycle({now:()=>time,storage});assert.deepEqual(next.sample(),first.sample());assert.equal(storage.writes,1);
 time+=DAY_NIGHT_CYCLE_MS*14+117000;
 assert.deepEqual(next.sample(),first.sample());assert.equal(storage.writes,1);
});

test('manual lighting previews use phase midpoints while auto resumes the continuing timeline',()=>{
 let time=1234;const storage=memory(),clock=createDayNightCycle({now:()=>time,storage});
 const anchor=JSON.parse(storage.data.get(KEY)).startedAt;
 for(const mode of ['day','dusk','night','dawn']){
  const p=clock.setMode(mode);assert.equal(p.phase,mode);assert.equal(p.mode,mode);assert.equal(p.phaseProgress,.5);
  const fixed=DAY_NIGHT_PHASES.find(p=>p.phase===mode),expected=dayNightCycleAt(fixed.startMs+fixed.durationMs/2);
  for(const name of ['darkness','warmth'])assert.equal(p[name],expected[name]);
 }
 assert.equal(storage.writes,5);clock.setMode('dawn');assert.equal(storage.writes,5);
 time+=820000;const pausedPreview=clock.sample();assert.equal(pausedPreview.phase,'dawn');assert.equal(pausedPreview.timelinePhase,'night');
 const resumed=clock.setMode('auto');assert.equal(resumed.phase,'night');assert.equal(resumed.darkness,1);
 assert.equal(JSON.parse(storage.data.get(KEY)).startedAt,anchor);assert.equal(storage.writes,6);
 const reloaded=createDayNightCycle({now:()=>time,storage});assert.deepEqual(reloaded.sample(),resumed);
 for(const bad of ['automatic','Day',null,undefined,{},'__proto__'])assert.throws(()=>clock.setMode(bad),RangeError);
 assert.equal(clock.mode,'auto');assert.equal(storage.writes,6);
});

test('saved manual mode persists separately from the running phase on reload',()=>{
 let time=3000000;const storage=memory(),first=createDayNightCycle({now:()=>time,storage});first.setMode('night');time+=1170000;
 const loaded=createDayNightCycle({now:()=>time,storage}),sample=loaded.sample();
 assert.equal(loaded.mode,'night');assert.equal(sample.phase,'night');assert.equal(sample.darkness,1);assert.equal(sample.timelinePhase,'dawn');assert.equal(sample.timelineProgress,.5);
 loaded.setMode('auto');assert.equal(loaded.sample().phase,'dawn');assert.equal(loaded.sample().darkness,.5);assert.equal(storage.writes,3);
});

test('corrupt and unsupported settings safely initialize one fresh automatic daytime cycle',()=>{
 for(const value of ['{','null','[]','42',JSON.stringify({version:2,startedAt:0,mode:'night'}),JSON.stringify({version:1,startedAt:-1,mode:'auto'}),JSON.stringify({version:1,startedAt:1001,mode:'auto'}),JSON.stringify({version:1,startedAt:0,mode:'invalid'}),JSON.stringify({version:1,startedAt:'0',mode:'auto'})]){
  const storage=memory({[KEY]:value}),clock=createDayNightCycle({now:()=>1000,storage});
  assert.equal(clock.mode,'auto');assert.equal(clock.sample().phase,'day');assert.equal(clock.sample().phaseProgress,0);assert.equal(storage.writes,1);
 }
});

test('blocked storage and bad time samples retain a functional in-memory cycle',()=>{
 let time=5000,reads=0,writes=0;const storage={getItem(){reads++;throw Error('denied');},setItem(){writes++;throw Error('denied');}},clock=createDayNightCycle({now:()=>{if(time==='throw')throw Error('clock');return time;},storage});
 assert.equal(clock.sample().phase,'day');time+=690000;assert.equal(clock.sample().darkness,.5);
 const good=clock.sample();for(const invalid of [NaN,Infinity,undefined,-1,'throw']){time=invalid;assert.deepEqual(clock.sample(),good);}
 clock.setMode('night');assert.equal(clock.sample().phase,'night');assert.equal(reads,1);assert.equal(writes,2);
 const noStorage=createDayNightCycle({now:()=>0,storage:null});assert.equal(noStorage.sample().phase,'day');assert.equal(noStorage.setMode('dusk').warmth,1);
 assert.throws(()=>createDayNightCycle({now:42,storage:null}),TypeError);
});
