import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CATCH_PATTERNS,NOTE_VALUES,catchAttacks,remainingNotes,sameRhythm,reachableNoteSpots,scatterNotes,findFishingDock,TOWN_FISH,FISH_MODES,fishingPattern,createFishingChallenge,updateFishingChallenge,fishingPress,fishingRelease} from './town-game-rules.mjs';

test('catch cards fill four beats using notes only, with no rests or isolated subdivisions',()=>{
 assert.deepEqual(NOTE_VALUES,['quarter','eighth-pair','sixteenth-group']);
 for(const target of CATCH_PATTERNS){assert.equal(target.length,4);assert(target.every(t=>NOTE_VALUES.includes(t)));assert.deepEqual(remainingNotes(target,[...target].reverse()),[]);assert(sameRhythm(target,[...target]));}
 assert.deepEqual(catchAttacks('quarter'),[0]);assert.deepEqual(catchAttacks('eighth-pair'),[0,.5]);assert.deepEqual(catchAttacks('sixteenth-group'),[0,.25,.5,.75]);assert.deepEqual(catchAttacks('quarter-rest'),[]);
 assert(!sameRhythm(CATCH_PATTERNS[0],[...CATCH_PATTERNS[0]].reverse()));
});
test('floating notes remain on connected walkable ground and do not change the saved map',()=>{
 const doc={cells:{},objects:[],edges:{},spawn:{x:500,y:500}},before=JSON.stringify(doc),spots=reachableNoteSpots(doc,new Map(),doc.spawn,{radius:1000,limit:1000}),tokens=scatterNotes(CATCH_PATTERNS[0],spots,()=>.4);
 assert(tokens.length>=40);assert.equal(new Set(tokens.map(t=>`${t.x},${t.y}`)).size,tokens.length);assert.equal(JSON.stringify(doc),before);
 assert(tokens.every(t=>spots.some(p=>p.x===t.x&&p.y===t.y)));assert(tokens.every(token=>NOTE_VALUES.includes(token.value)), 'Every scattered decoy and target must be a note');
 const island={cells:{},objects:[],edges:{},spawn:{x:32,y:32}};for(let y=0;y<30;y++)for(let x=0;x<30;x++)island.cells[`${x},${y}`]={surface:'water',level:0};island.cells['0,0']={surface:'grass',level:0};
 assert.deepEqual(scatterNotes([1,1],reachableNoteSpots(island,new Map(),island.spawn)),[]);
});
test('the apartment pier gets an anchored boat without editing any map data',async()=>{
 const doc=JSON.parse(await readFile(new URL('../maps/coda-town-plaza-boardwalk.json',import.meta.url),'utf8')),before=JSON.stringify(doc),dock=findFishingDock(doc,new Map());assert(dock);assert(dock.stand.x<4000);assert(dock.boat.x<dock.stand.x);assert.equal(JSON.stringify(doc),before);
 assert.equal(findFishingDock({objects:[],cells:{},spawn:{x:100,y:100}},new Map()),null);
});
test('24 coastal species have unique IDs and complete bars in all four fishing games',()=>{
 assert.equal(TOWN_FISH.length,24);assert.equal(new Set(TOWN_FISH.map(f=>f.id)).size,24);assert.equal(FISH_MODES.length,4);
 for(const f of TOWN_FISH){const p=fishingPattern(f);assert.equal(p.values.reduce((a,b)=>a+b,0),p.bar);for(const mode of FISH_MODES){const s=createFishingChallenge(f,mode.id);assert(s.events.length>0);assert(s.events.every(e=>e.at>=s.countEnd&&e.duration>0));}}
});
test('each fishing mode can be completed using its actual audio-clock event times',()=>{
 for(const mode of FISH_MODES){const s=createFishingChallenge(TOWN_FISH[1],mode.id,{start:10});assert.equal(fishingPress(s,10),'wait');
  for(const item of [...s.cues.map(e=>({e,cue:true})),...s.events.map(e=>({e,cue:false}))].sort((a,b)=>a.e.at-b.e.at)){const {e,cue}=item;const result=fishingPress(s,e.at);if(cue)assert.equal(result,'listen');else{assert(['hit','hold'].includes(result),mode.id);if(e.hold)fishingRelease(s,e.at+e.duration*.88);}}
  updateFishingChallenge(s,s.end+.01);assert.equal(s.caught,true,mode.id);assert.equal(s.accuracy,1);assert.equal(s.misses,0);
 }
});
test('early hold release and random tapping cannot bypass a fishing rhythm',()=>{
 const s=createFishingChallenge(TOWN_FISH[0],'hold'),e=s.events[0];assert.equal(fishingPress(s,e.at),'hold');fishingRelease(s,e.at+.02);assert.equal(e.judgement,'miss');updateFishingChallenge(s,s.end+.1);assert.equal(s.caught,false);
 const spam=createFishingChallenge(TOWN_FISH[0],'current');for(let t=spam.countEnd;t<spam.end;t+=.04)fishingPress(spam,t);updateFishingChallenge(spam,spam.end+.1);assert.equal(spam.caught,false);assert(spam.extras>spam.hits);
});

test('the first fishing beat has the same early-input tolerance as later beats',()=>{
 const s=createFishingChallenge(TOWN_FISH[0],'current');assert.equal(fishingPress(s,s.events[0].at-.1),'hit');
 const echo=createFishingChallenge(TOWN_FISH[0],'echo');assert.equal(fishingPress(echo,echo.cues[0].at-.1),'listen');
});
