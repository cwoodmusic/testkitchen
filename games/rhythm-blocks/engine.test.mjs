import test from 'node:test';
import assert from 'node:assert/strict';
import {COLUMNS,ROWS,NOTE_KINDS,NOTE_KIND_BY_ID,MAX_TICK_MS,CLEAR_FLASH_MS,SETTLE_MS,createGame,findMatches,kindWeights,fallInterval} from './engine.mjs';

const empty=()=>Array.from({length:ROWS},()=>Array(COLUMNS).fill(null));
const put=(board,row,col,kinds)=>kinds.forEach((kind,index)=>{board[row][col+index]=kind;});
function advance(game,ms){for(let elapsed=0;elapsed<ms;elapsed+=MAX_TICK_MS)game.tick(Math.min(MAX_TICK_MS,ms-elapsed));}
function settle(game,limit=100){for(let step=0;['clearing','settling'].includes(game.state.phase)&&step<limit;step++)game.tick(MAX_TICK_MS);assert(!['clearing','settling'].includes(game.state.phase),'Resolution did not terminate');}
const clearEvents=game=>game.state.events.filter(event=>event.type==='clear');

test('ten stable note kinds use exact integer half-beats; groups and rests retain their full duration',()=>{
 assert.equal(COLUMNS,10);assert.equal(ROWS,24);
 assert.deepEqual(NOTE_KINDS.map(kind=>kind.id),['quarter','eighth-pair','sixteenth-group','half','whole','eighth','quarter-rest','half-rest','whole-rest','dotted-half']);
 assert.deepEqual(NOTE_KINDS.map(kind=>kind.units),[2,2,2,4,8,1,2,4,8,6]);
 assert(NOTE_KINDS.every(kind=>Number.isInteger(kind.units)&&kind.beats===kind.units/2&&kind.label));
 assert.deepEqual(NOTE_KINDS.filter(kind=>kind.rest).map(kind=>kind.id),['quarter-rest','half-rest','whole-rest']);
 assert(Object.isFrozen(NOTE_KINDS)&&NOTE_KINDS.every(Object.isFrozen));
});

test('eight beats take priority over all overlapping four-beat windows on the same axis',()=>{
 const board=empty();put(board,23,0,Array(8).fill('quarter'));
 const matches=findMatches(board);assert.equal(matches.length,1);assert.equal(matches[0].units,16);assert.equal(matches[0].cells.length,8);
 assert.deepEqual(matches[0].kinds,Array(8).fill('quarter'));
 const wholePair=empty();wholePair[22][4]=wholePair[23][4]='whole';
 const pair=findMatches(wholePair);assert.equal(pair.length,1,'Whole blocks inside an eight-beat line must not invent one-cell crossing combos');assert.equal(pair[0].axis,'vertical');assert.equal(pair[0].units,16);
});

test('four beats accept beamed groups, dotted halves, single eighths, rests and a single whole block',()=>{
 for(const kinds of [['eighth-pair','sixteenth-group','quarter-rest','quarter'],['dotted-half','eighth','eighth'],['half-rest','half'],['whole'],['whole-rest']]){
  const board=empty();put(board,21,2,kinds);const matches=findMatches(board);
  assert.equal(matches.length,1,kinds.join('+'));assert.equal(matches[0].units,8);assert.deepEqual(matches[0].kinds,kinds);
 }
 const eight=empty();put(eight,23,1,['dotted-half','dotted-half','half-rest']);const pattern=findMatches(eight);assert.equal(pattern.length,1);assert.equal(pattern[0].units,16);
});

test('matching never wraps rows, crosses a gap, bends a corner or accepts a near sum',()=>{
 const wrap=empty();put(wrap,10,8,['quarter','quarter']);put(wrap,11,0,['quarter','quarter']);assert.deepEqual(findMatches(wrap),[]);
 const gap=empty();put(gap,12,0,['quarter','quarter',null,'quarter','quarter']);assert.deepEqual(findMatches(gap),[]);
 const bend=empty();put(bend,12,1,['quarter','quarter']);bend[13][2]=bend[14][2]='quarter';assert.deepEqual(findMatches(bend),[]);
 const near=empty();put(near,23,0,['dotted-half','eighth']);assert.deepEqual(findMatches(near),[]);
 const malformed=empty();malformed[0][0]='unknown';assert.throws(()=>findMatches(malformed),/Unknown rhythm block/);assert.throws(()=>findMatches([[null]]),/24 rows and 10 columns/);
});

test('same-axis windows do not double-count shared blocks; distinct crossings are valid combos',()=>{
 const overlapping=empty();put(overlapping,23,0,Array(6).fill('quarter'));const one=findMatches(overlapping);assert.equal(one.length,1);assert.equal(one[0].cells.length,4);
 const cross=empty();put(cross,12,3,Array(4).fill('quarter'));for(let row=10;row<14;row++)cross[row][4]='quarter';
 const patterns=findMatches(cross);assert.equal(patterns.length,2);assert.deepEqual(new Set(patterns.map(p=>p.axis)),new Set(['horizontal','vertical']));
 const game=createGame({initialBoard:cross,rng:()=>0});game.start();assert.equal(game.state.phase,'clearing');settle(game);
 const clear=clearEvents(game)[0];assert.equal(clear.points,500);assert.equal(clear.cells.length,7);assert.equal(clear.patterns.length,2);assert.equal(game.state.score,500);assert(game.state.board.flat().every(kind=>kind===null));
 const disjoint=empty();put(disjoint,23,0,Array(4).fill('quarter'));put(disjoint,23,5,Array(4).fill('quarter'));const separate=findMatches(disjoint);assert.equal(separate.length,2);assert.equal(new Set(separate.flatMap(p=>p.cells.map(c=>c.row*COLUMNS+c.col))).size,8);
});

test('falling blocks are excluded from matching until they lock and the flash finishes automatically',()=>{
 const game=createGame({rng:()=>.78});game.start();assert.equal(game.state.active.kind,'whole');
 advance(game,1000);assert.equal(game.state.phase,'falling');assert.equal(game.state.score,0);assert(game.state.board.flat().every(kind=>kind===null));
 assert.equal(game.hardDrop(),23);assert.equal(game.state.phase,'clearing');assert.equal(game.state.board[23][4],'whole');assert.equal(game.state.score,0);
 const before=game.revision;assert.equal(game.move(1),false);assert.equal(game.softDrop(),false);assert.equal(game.hardDrop(),0);assert.equal(game.revision,before);
 advance(game,CLEAR_FLASH_MS-1);assert.equal(game.state.score,0);game.tick(1);assert.equal(game.state.phase,'settling');assert.equal(game.state.score,200);assert.equal(game.state.board[23][4],null);
 advance(game,SETTLE_MS);assert.equal(game.state.phase,'falling');assert.equal(clearEvents(game).length,1);assert.equal(game.state.active.row,0);
});

test('a landed half-note completes eight beats and earns the eight-beat priority score',()=>{
 const board=empty();put(board,23,2,['dotted-half','dotted-half']);const game=createGame({initialBoard:board,rng:()=>.74});game.start();assert.equal(game.state.active.kind,'half');
 game.hardDrop();assert.equal(game.state.phase,'clearing');assert.equal(game.state.clearingMatches.length,1);assert.equal(game.state.clearingMatches[0].units,16);settle(game);
 assert.equal(game.state.score,500);assert.equal(clearEvents(game)[0].patterns.length,1);assert.deepEqual(clearEvents(game)[0].patterns[0].kinds,['dotted-half','dotted-half','half']);
});

test('horizontal and vertical board boundaries, collisions and hard/soft drops preserve individual blocks',()=>{
 const board=empty();board[0][3]='dotted-half';const blocked=createGame({initialBoard:board,rng:()=>0});blocked.start();assert.equal(blocked.state.phase,'over','Any settled top-row block ends the game');
 const game=createGame({rng:()=>0});game.start();while(game.move(-1)){}assert.equal(game.state.active.col,0);assert.equal(game.move(-1),false);assert.equal(game.move(2),false);
 for(let i=0;i<9;i++)assert.equal(game.move(1),true);assert.equal(game.state.active.col,9);assert.equal(game.move(1),false);
 assert.equal(game.softDrop(),true);assert.equal(game.state.active.row,1);assert.equal(game.hardDrop(),22);assert.equal(game.state.board[23][9],'quarter');assert.equal(game.state.score,0);
 assert.equal(game.state.active.col,4);for(let i=0;i<5;i++)game.move(1);assert.equal(game.hardDrop(),22);assert.equal(game.state.board[22][9],'quarter');assert.equal(game.state.board[23][9],'quarter');
 const obstacle=empty();obstacle[1][3]='dotted-half';const collision=createGame({initialBoard:obstacle,rng:()=>0});collision.start();collision.softDrop();assert.equal(collision.move(-1),false);assert.equal(collision.state.active.col,4);assert.equal(collision.state.board[1][3],'dotted-half');
});

test('gravity compacts columns without changing order and completes a scored cascade before spawning',()=>{
 const board=empty();put(board,23,0,['quarter','quarter','quarter']);board[20][0]='half';board[21][1]='quarter';board[22][2]='quarter';
 const game=createGame({initialBoard:board,rng:()=>0});game.start();assert.equal(game.state.phase,'falling');assert.equal(game.move(-1),true);assert.equal(game.hardDrop(),23);
 assert.equal(game.state.phase,'clearing');settle(game);
 const clears=clearEvents(game);assert.equal(clears.length,2);assert.deepEqual(clears.map(c=>c.chain),[1,2]);assert.deepEqual(clears.map(c=>c.points),[200,400]);assert.equal(game.state.score,600);assert(game.state.board.flat().every(kind=>kind===null));
 assert.deepEqual(clears[1].patterns[0].kinds,['half','quarter','quarter']);assert.equal(game.state.phase,'falling');assert.equal(game.state.active.row,0);
 const order=empty();order[21][0]='dotted-half';order[22][0]='eighth';order[23][0]='whole';
 const compact=createGame({initialBoard:order,rng:()=>0});compact.start();advance(compact,CLEAR_FLASH_MS);const moved=compact.state.board;assert.equal(moved[23][0],'eighth');assert.equal(moved[22][0],'dotted-half');
});

test('top-out waits for rescue clears and their gravity; unrescued settled top rows end the game',()=>{
 const full=empty();for(let row=0;row<ROWS;row++)full[row][0]='dotted-half';
 const over=createGame({initialBoard:full,rng:()=>0});over.start();assert.equal(over.state.phase,'over');assert.equal(over.state.active,null);assert.equal(over.tick(10000),false);assert.equal(over.pause(),false);
 full[0][0]='whole';const rescued=createGame({initialBoard:full,rng:()=>0});rescued.start();assert.equal(rescued.state.phase,'clearing');assert.equal(rescued.state.events.some(e=>e.type==='over'),false);settle(rescued);
 assert.equal(rescued.state.phase,'falling');assert.equal(rescued.state.board[0][0],null);assert.equal(rescued.state.score,200);assert.equal(rescued.state.events.some(e=>e.type==='over'),false);
 const pending=empty();pending[0][0]='dotted-half';pending[23][8]='whole';const stillOver=createGame({initialBoard:pending,rng:()=>0});stillOver.start();assert.equal(stillOver.state.phase,'clearing');settle(stillOver);assert.equal(stillOver.state.phase,'falling','Rescue gravity can also bring a different top-row column back below the ceiling');
});

test('a newly locked ceiling block gets its rescue opportunity before the game can end',()=>{
 const board=empty();for(let row=1;row<ROWS;row++)board[row][4]='dotted-half';
 const saved=createGame({initialBoard:board,rng:()=>.78});saved.start();assert.equal(saved.state.active.kind,'whole');assert.equal(saved.hardDrop(),0);assert.equal(saved.state.phase,'clearing');assert.equal(saved.state.events.some(e=>e.type==='over'),false);settle(saved);
 assert.equal(saved.state.phase,'falling');assert.equal(saved.state.board[0][4],null);assert.equal(saved.state.score,200);
 const lost=createGame({initialBoard:board,rng:()=>.795});lost.start();assert.equal(lost.state.active.kind,'eighth');assert.equal(lost.softDrop(),true);assert.equal(lost.state.phase,'over');assert.equal(lost.state.board[0][4],'eighth');assert.equal(clearEvents(lost).length,0);
 const revision=lost.revision;assert.equal(lost.move(1),false);assert.equal(lost.softDrop(),false);assert.equal(lost.hardDrop(),0);assert.equal(lost.tick(100),false);assert.equal(lost.revision,revision);
});

test('pause freezes falling and clear clocks; resume discards a hidden-tab delta instead of catching up',()=>{
 const game=createGame({rng:()=>0});game.start();advance(game,1000);const row=game.state.active.row;assert.equal(game.pause(),true);const paused=game.revision;
 assert.equal(game.tick(600000),false);assert.equal(game.move(1),false);assert.equal(game.softDrop(),false);assert.equal(game.hardDrop(),0);assert.equal(game.revision,paused);assert.equal(game.resume(),true);
 assert.equal(game.tick(600000),false);assert.equal(game.state.active.row,row);game.tick(50);assert.equal(game.state.active.row,row+1);
 const whole=createGame({rng:()=>.78});whole.start();whole.hardDrop();whole.tick(100);whole.pause();whole.tick(5000);assert.equal(whole.state.score,0);whole.resume();whole.tick(5000);advance(whole,179);assert.equal(whole.state.score,0);whole.tick(1);assert.equal(whole.state.score,200);
});

test('tick bounds elapsed time, ignores invalid deltas and returns whether visible state changed',()=>{
 const game=createGame({rng:()=>0});assert.equal(game.tick(1000),false);game.start();const revision=game.revision;
 for(const dt of [undefined,NaN,Infinity,-1,0])assert.equal(game.tick(dt),false);assert.equal(game.revision,revision);
 assert.equal(game.tick(600000),false);assert.equal(game.state.active.row,0);advance(game,900);assert.equal(game.state.active.row,0);assert.equal(game.tick(50),true);assert.equal(game.state.active.row,1);
 const moved=game.revision;assert.equal(game.tick(16),false);assert.equal(game.revision,moved);
});

test('learning clears alone drive integer scores, 1000-point levels and bounded faster falls',()=>{
 const game=createGame({rng:()=>.78});game.start();for(let clear=0;clear<5;clear++){game.hardDrop();settle(game);}
 assert.equal(game.state.score,1000);assert.equal(game.state.level,2);assert.equal(game.state.fallIntervalMs,995);assert.equal(game.state.lastClear.points,200);
 for(let level=1;level<100;level++){assert(fallInterval(level)>=150);if(level>1)assert(fallInterval(level)<=fallInterval(level-1));}assert.equal(fallInterval(1),1050);assert.equal(fallInterval(100),150);
 for(const record of clearEvents(game))assert(Number.isSafeInteger(record.points)&&Number.isSafeInteger(record.score));
});

test('level-one selection is 85% one-beat kinds, with later increases for single eighths and dotted halves',()=>{
 const oneBeat=NOTE_KINDS.filter(kind=>kind.units===2).map(kind=>kind.id),initial=kindWeights(1);assert.equal(oneBeat.reduce((sum,id)=>sum+initial[id],0),8500);assert.equal(initial.eighth,100);assert.equal(initial['dotted-half'],100);
 for(let level=1;level<=100;level++){
  const weights=kindWeights(level);assert.equal(Object.values(weights).reduce((a,b)=>a+b,0),10000);assert(Object.values(weights).every(n=>Number.isInteger(n)&&n>0));
  if(level>1){assert(weights.eighth>=kindWeights(level-1).eighth);assert(weights['dotted-half']>=kindWeights(level-1)['dotted-half']);}
 }
 assert(kindWeights(16).eighth>initial.eighth);assert(kindWeights(16)['dotted-half']>initial['dotted-half']);
 let total=0;for(const kind of NOTE_KINDS){const rng=()=> (total+initial[kind.id]/2)/10000,game=createGame({rng});game.start();assert.equal(game.state.active.kind,kind.id);total+=initial[kind.id];}
});

test('clear events retain ordered rhythms/rests, are emitted once per wave and stay bounded with monotonic IDs',()=>{
 const board=empty();put(board,23,1,['dotted-half','eighth','eighth']);const game=createGame({initialBoard:board,rng:()=>0});game.start();settle(game);const event=clearEvents(game)[0];assert.deepEqual(event.patterns[0].kinds,['dotted-half','eighth','eighth']);assert.equal(event.patterns[0].units,8);
 advance(game,500);assert.equal(clearEvents(game).length,1);const oldID=game.state.events.at(-1).id;
 for(let i=0;i<30;i++){game.pause();game.resume();}const events=game.state.events;assert.equal(events.length,16);assert(events[0].id>oldID);assert(events.every((e,i)=>!i||e.id>events[i-1].id));
 const current=events.at(-1).id;game.restart();assert(game.state.events[0].id>current);assert.equal(game.state.score,0);assert.equal(game.state.lastClear,null);
});

test('snapshots and initial fixtures cannot mutate engine state; seeded runs are reproducible',()=>{
 const board=empty();board[23][0]='dotted-half';const game=createGame({initialBoard:board,rng:()=>0});board[23][0]=null;game.start();assert.equal(game.state.board[23][0],'dotted-half');
 const state=game.state;state.board[23][0]='whole';state.active.row=23;state.events[0].type='corrupted';assert.equal(game.state.board[23][0],'dotted-half');assert.equal(game.state.active.row,0);assert.equal(game.state.events[0].type,'start');
 game.pause();game.restart();assert.equal(game.state.paused,false);assert.equal(game.state.score,0);assert.equal(game.state.level,1);assert.equal(game.state.active.row,0);assert.equal(game.state.board[23][0],'dotted-half');
 const random=()=>{let seed=117;return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};};
 const left=createGame({rng:random()}),right=createGame({rng:random()});left.start();right.start();
 for(let i=0;i<40;i++)for(const g of [left,right]){g.move(i%2?1:-1);g.tick(100);if(i%4===0)g.hardDrop();if(['clearing','settling'].includes(g.state.phase))settle(g);}
 assert.deepEqual(left.state,right.state);assert.throws(()=>createGame({initialBoard:[[null]]}),/24 rows/);assert.throws(()=>createGame({rng:()=>1}).start(),/rng must return/);assert.throws(()=>createGame({rng:null}),/rng must be/);
});
