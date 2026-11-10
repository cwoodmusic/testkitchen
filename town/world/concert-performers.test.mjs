import test from 'node:test';
import assert from 'node:assert/strict';
import {createStagePerformance,renderStagePerformance,stagePerformanceSignature,stageCollisionBoxes} from './concert-performers.mjs';
import {CONCERT_PROGRAMME} from './concert-programme.mjs';

const STAGE={x:768,y:300,w:2560,h:900,performerBounds:{x:1000,y:420,w:2096,h:680}};
const ctx=()=>({fillStyle:'',imageSmoothingEnabled:true,calls:[],save(){},restore(){},translate(){},scale(){},fillRect(...args){this.calls.push(['rect',...args,this.fillStyle]);},drawImage(...args){this.calls.push(['image',...args]);}});
const count=(a,section)=>a.filter(p=>p.section===section).length;

test('a complete orchestra has independent strings, winds, brass, percussion and a conductor',()=>{
 const p=createStagePerformance({kind:'orchestra',id:'symphony'});
 assert.equal(p.actors.length,52);
 assert.equal(count(p.actors,'strings')+count(p.actors,'double-bass'),34);
 assert.equal(count(p.actors,'woodwind'),8);
 assert.equal(count(p.actors,'brass'),6);
 assert.equal(count(p.actors,'percussion'),3);
 assert.equal(count(p.actors,'conductor'),1);
 for(const [instrument,total] of [['violin',18],['viola',6],['cello',6],['double-bass',4],['flute',2],['oboe',2],['clarinet',2],['bassoon',2],['horn',2],['trumpet',2],['trombone',1],['tuba',1]])assert.equal(p.actors.filter(a=>a.instrument===instrument).length,total,instrument);
 const conductor=p.actors.find(a=>a.section==='conductor');
 assert.equal(conductor.facing,'up');assert.equal(conductor.seated,false);
 assert.ok(p.actors.every(a=>a.walking===false));
 assert.equal(new Set(p.actors.map(a=>a.actorId)).size,52);
 assert.ok(p.props.some(a=>a.asset==='decor-03-12'));
 assert.ok(p.props.some(a=>a.asset==='decor-05-08'));
 assert.ok(!p.props.some(a=>a.role==='piano'));
});

test('New Orleans jazz uses an acoustic eight-piece band with two cornets',()=>{
 const p=createStagePerformance({kind:'new-orleans-jazz'});
 assert.equal(p.kind,'jazz');assert.equal(p.actors.length,8);
 assert.deepEqual(p.actors.map(a=>a.instrument).sort(),['banjo','clarinet','cornet','cornet','double-bass','drums','piano','trombone']);
 assert.ok(p.actors.every(a=>a.appearance.outfit==='waistcoat'));
 assert.equal(p.actors.filter(a=>a.seated).length,2);
 assert.ok(p.props.some(a=>a.asset==='decor-03-07'));
 assert.ok(p.props.some(a=>a.asset==='decor-03-02'));
 assert.ok(!p.assetIds.some(id=>['decor-03-03','decor-03-04','decor-02-08','decor-02-09'].includes(id)));
});

test('every real programme entry selects its advertised ensemble and pianist',()=>{
 for(const track of CONCERT_PROGRAMME){
  const p=createStagePerformance(track);
  assert.equal(p.kind,track.category,track.id);
  assert.equal(p.actors.length,{orchestra:52,jazz:8,piano:1}[track.category],track.id);
  if(track.category==='piano')assert.equal(p.actors[0].id,track.pianist,track.id);
 }
 assert.equal(stagePerformanceSignature({ensemble:'new-orleans-band',category:'jazz'}),'jazz');
});

test('solo recitals retain each pianist identity and use the native grand piano',()=>{
 for(const [pianist,name,hair,style] of [['chopin','Frédéric Chopin','#49312b','long'],['liszt','Franz Liszt','#c3bfb9','long'],['debussy','Claude Debussy','#372e2b','curly']]){
  const p=createStagePerformance({kind:'piano',pianist,id:'recital'}),a=p.actors[0];
  assert.equal(p.actors.length,1);assert.equal(p.pianist,pianist);
  assert.equal(a.id,pianist);assert.equal(a.name,name);assert.equal(a.appearance.hair,hair);assert.equal(a.appearance.hairstyle,style);
  assert.equal(a.appearance.accessory,'none');assert.equal(a.seated,true);assert.equal(a.facing,'up');
  assert.equal(p.props.length,1);assert.equal(p.props[0].asset,'decor-03-01');
 }
 assert.equal(createStagePerformance({ensemble:'solo-piano',composer:'Franz Liszt'}).pianist,'liszt');
});

test('stage formations fit the authored hall and move with a different stage geometry',()=>{
 const custom={x:100,y:100,w:1800,h:900,performerBounds:{x:250,y:220,w:1500,h:680}};
 for(const stage of [STAGE,custom])for(const kind of ['orchestra','jazz','piano']){
  const p=createStagePerformance({kind},{stage}),b=p.stage.performerBounds;
  for(const a of p.actors){
   assert.ok(a.x>=b.x&&a.x<=b.x+b.w,`${kind}/${a.id} x`);
   assert.ok(a.y>=b.y&&a.y<=stage.y+stage.h,`${kind}/${a.id} y`);
  }
  assert.equal(new Set(p.actors.map(a=>`${a.x},${a.y}`)).size,p.actors.length);
  const conductor=p.actors.find(a=>a.section==='conductor');
  if(conductor)assert.ok(p.actors.every(a=>a===conductor||a.y<conductor.y));
 }
});

test('programmes and stage input are untouched and the formation is deterministic',()=>{
 const program={kind:'orchestra',id:'beethoven-5',bpm:112,metadata:{source:'recording'}},stage=structuredClone(STAGE);
 const input=structuredClone({program,stage}),p=createStagePerformance(program,{stage});
 assert.deepEqual(p,createStagePerformance(program,{stage}));
 assert.deepEqual({program,stage},input);
 assert.equal(p.programmeId,'beethoven-5');assert.equal(p.bpm,112);
 assert.equal(stagePerformanceSignature({kind:'orchestra',id:'one'}),stagePerformanceSignature({kind:'orchestra',id:'two'}));
 assert.notEqual(stagePerformanceSignature({kind:'piano',pianist:'chopin'}),stagePerformanceSignature({kind:'piano',pianist:'liszt'}));
 assert.equal(stagePerformanceSignature({kind:'piano',pianist:'debussy'}),'piano:debussy');
});

test('malformed stage and tempo values remain finite and bounded',()=>{
 const p=createStagePerformance({kind:'unknown',bpm:Infinity},{stage:{x:NaN,y:NaN,w:-1,h:-1,performerBounds:{x:Infinity,w:-1,h:NaN}}});
 assert.equal(p.kind,'orchestra');assert.equal(p.bpm,92);
 assert.ok(p.actors.every(a=>Number.isFinite(a.x)&&Number.isFinite(a.y)));
 assert.ok(p.stage.w>=600&&p.stage.h>=420);
 assert.equal(createStagePerformance({bpm:999}).bpm,220);
});

test('rendering animates instrument poses without moving or respawning the model',()=>{
 const p=createStagePerformance({kind:'orchestra'}),before=structuredClone(p),g=ctx(),calls=[];
 const drawNPC=(c,a,time)=>calls.push({a,time});
 const result=renderStagePerformance(g,p,{drawNPC,time:.1});
 assert.equal(result.performers,52);assert.equal(calls.length,52);
 assert.ok(calls.every(({a})=>!a.walking&&a.activity==='playing'));
 assert.ok(calls.filter(({a})=>a.seated).every(({a})=>a.y===p.actors.find(o=>o.id===a.id).y-40));
 const pose=structuredClone(g.calls);g.calls=[];
 renderStagePerformance(g,p,{drawNPC,audioTime:.28,time:123});
 assert.notDeepEqual(g.calls,pose);assert.deepEqual(p,before);
});

test('reduced motion freezes playing while audio time continues',()=>{
 const p=createStagePerformance({kind:'piano',pianist:'liszt'}),g=ctx(),drawNPC=()=>{};
 renderStagePerformance(g,p,{drawNPC,reducedMotion:true,audioTime:1});const first=structuredClone(g.calls);g.calls=[];
 renderStagePerformance(g,p,{drawNPC,reducedMotion:true,audioTime:100});assert.deepEqual(g.calls,first);
});

test('the visitor shares stage depth sorting and offscreen performers are culled',()=>{
 const p=createStagePerformance({kind:'piano'}),g=ctx(),events=[];
 const a=p.actors[0];
 renderStagePerformance(g,p,{drawNPC:(c,npc)=>events.push(npc.id),extraDrawables:[{y:a.y-5,draw:()=>events.push('behind')},{y:a.y+5,draw:()=>events.push('in front')}]});
 assert.deepEqual(events,['behind','chopin','in front']);events.length=0;
 renderStagePerformance(g,p,{drawNPC:(c,npc)=>events.push(npc.id),view:{x:0,y:0,w:10,h:10},extraDrawables:[{y:0,bounds:{x:0,y:0,w:5,h:5},draw:()=>events.push('visible')},{y:0,bounds:{x:100,y:100,w:5,h:5},draw:()=>events.push('hidden')}]});
 assert.deepEqual(events,['visible']);
});

test('native character bodies are cached once while the instrument animation continues',()=>{
 const p=createStagePerformance({kind:'orchestra'}),g=ctx();let drawn=0,created=0;
 const drawNPC=()=>drawn++,createCanvas=()=>{created++;return {getContext:()=>ctx()};};
 renderStagePerformance(g,p,{drawNPC,createCanvas,audioTime:.1});
 assert.equal(drawn,52);assert.equal(created,52);
 assert.equal(g.calls.filter(c=>c[0]==='image').length,52);
 g.calls=[];renderStagePerformance(g,p,{drawNPC,createCanvas,audioTime:.2});
 assert.equal(drawn,52);assert.equal(created,52);
 assert.equal(g.calls.filter(c=>c[0]==='image').length,52);
 assert.ok(g.calls.some(c=>c[0]==='rect'));
});

test('stage collision follows musician feet and native instrument draw scaling',()=>{
 const p=createStagePerformance({kind:'orchestra'}),catalog=new Map();
 catalog.set('decor-02-01',{w:60,h:120,boxes:[{x:12,y:90,w:36,h:24}]});
 const boxes=stageCollisionBoxes(p,{catalog});
 assert.equal(boxes.filter(b=>b.role==='performer').length,52);
 const cello=p.props.find(p=>p.asset==='decor-02-01'),box=boxes.find(b=>b.asset==='decor-02-01');
 const scale=Math.min(cello.w/60,cello.h/120);
 assert.equal(box.x,cello.x-60*scale/2+12*scale);
 assert.equal(box.y,cello.y-120*scale+90*scale);
 assert.equal(box.w,36*scale);assert.equal(box.h,24*scale);
 assert.ok(boxes.every(b=>b.w>0&&b.h>0&&Number.isFinite(b.x)&&Number.isFinite(b.y)));
 // The front centre lane and broad staircase stay open to the podium.
 const centre=p.stage.x+p.stage.w/2,front=p.stage.y+p.stage.h;
 const hit=(x,y)=>boxes.some(b=>x>=b.x-16&&x<=b.x+b.w+16&&y>=b.y-16&&y<=b.y+b.h+16);
 for(let y=front+80;y>front-10;y-=10)assert.equal(hit(centre,y),false,`stage access y=${y}`);
 assert.equal(hit(centre-100,p.actors.find(a=>a.section==='conductor').y),false);
});

test('the recital grand piano blocks its soundboard and the performer, not the whole stage',()=>{
 const p=createStagePerformance({kind:'piano'}),grand={w:100,h:200,boxes:[{x:16,y:152,w:68,h:44}]};
 const boxes=stageCollisionBoxes(p,{catalog:new Map([['decor-03-01',grand]])}),body=boxes.find(b=>b.role==='piano-body');
 assert.equal(body.w,140);assert.equal(body.h,140);
 const player=p.actors[0];assert.ok(boxes.some(b=>b.role==='performer'&&b.x<player.x&&b.x+b.w>player.x));
 assert.ok(body.y<player.y-100);
 const sideX=p.stage.performerBounds.x+50;
 assert.ok(boxes.every(b=>sideX<b.x||sideX>b.x+b.w));
 assert.deepEqual(stageCollisionBoxes(null),[]);
});
