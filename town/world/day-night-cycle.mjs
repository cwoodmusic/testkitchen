export const DAY_NIGHT_PHASES=Object.freeze([
 Object.freeze({phase:'day',label:'Day',durationMs:600000,startMs:0}),
 Object.freeze({phase:'dusk',label:'Dusk',durationMs:180000,startMs:600000}),
 Object.freeze({phase:'night',label:'Night',durationMs:300000,startMs:780000}),
 Object.freeze({phase:'dawn',label:'Dawn',durationMs:180000,startMs:1080000})
]);
export const DAY_NIGHT_CYCLE_MS=1260000;
const KEY='codaTownDayNightCycleV1',MODES=new Set(['auto',...DAY_NIGHT_PHASES.map(p=>p.phase)]);
const smooth=t=>t*t*(3-2*t);

/** Elapsed wall time, rather than movement frames, controls the outdoor light. */
export function dayNightCycleAt(elapsedMs=0){
 const elapsed=Number.isFinite(elapsedMs)?Math.max(0,elapsedMs):0,cycleAt=elapsed%DAY_NIGHT_CYCLE_MS;
 const phase=DAY_NIGHT_PHASES.find(p=>cycleAt<p.startMs+p.durationMs),phaseProgress=(cycleAt-phase.startMs)/phase.durationMs;
 const transition=phase.phase==='dusk'||phase.phase==='dawn',p=phaseProgress;
 const darkness=phase.phase==='day'?0:phase.phase==='night'?1:phase.phase==='dusk'?smooth(p):1-smooth(p);
 return {phase:phase.phase,label:phase.label,phaseProgress,darkness,warmth:transition?16*p*p*(1-p)*(1-p):0};
}

/** The settings record never touches map, room, inventory or profile storage. */
export function createDayNightCycle({now=()=>Date.now(),storage}={}){
 if(typeof now!=='function')throw new TypeError('The day/night clock needs a time function.');
 let lastTime=0;
 const readTime=()=>{try{const value=now();if(Number.isFinite(value)&&value>=0)lastTime=value;}catch{}return lastTime;};
 const initialTime=readTime();
 if(storage===undefined){try{storage=globalThis.localStorage;}catch{storage=null;}}
 let saved;
 try{saved=JSON.parse(storage?.getItem(KEY)||'null');}catch{}
 const valid=saved&&typeof saved==='object'&&!Array.isArray(saved)&&saved.version===1&&Number.isFinite(saved.startedAt)&&saved.startedAt>=0&&saved.startedAt<=initialTime&&MODES.has(saved.mode);
 const startedAt=valid?saved.startedAt:initialTime;let mode=valid?saved.mode:'auto';
 const persist=()=>{try{storage?.setItem(KEY,JSON.stringify({version:1,startedAt,mode}));}catch{}};
 if(!valid)persist();
 function sample(){
  const timeline=dayNightCycleAt(readTime()-startedAt),fixed=mode==='auto'?null:DAY_NIGHT_PHASES.find(p=>p.phase===mode);
  const light=fixed?dayNightCycleAt(fixed.startMs+fixed.durationMs/2):timeline;
  return {...light,mode,timelinePhase:timeline.phase,timelineProgress:timeline.phaseProgress};
 }
 return {
  sample,
  setMode(next){if(!MODES.has(next))throw new RangeError('Unknown day/night lighting mode.');if(next!==mode){mode=next;persist();}return sample();},
  get mode(){return mode;}
 };
}
