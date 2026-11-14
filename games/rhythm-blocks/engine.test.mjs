import test from 'node:test';
import assert from 'node:assert/strict';
import {COLUMNS,ROWS,NOTE_KINDS,NOTE_KIND_BY_ID,SHAPES,SHAPE_CELLS,MAX_TICK_MS,CLEAR_FLASH_MS,SETTLE_MS,createGame,absoluteCells,findMatches,kindWeights,fallInterval} from './engine.mjs';

const empty=()=>Array.from({length:ROWS},()=>Array(COLUMNS).fill(null));
const put=(board,row,col,kinds)=>kinds.forEach((kind,index)=>{board[row][col+index]=kind;});
const ownersFor=(board,owner)=>board.map((row,r)=>row.map((kind,c)=>kind===null?null:typeof owner==='function'?owner(r,c):owner));
const rngForI=(note=0)=>{let calls=0;return ()=>calls++<6?.999:note;};
const seeded=initial=>{let seed=initial;return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};};
function advance(game,ms){for(let elapsed=0;elapsed<ms;elapsed+=MAX_TICK_MS)game.tick(Math.min(MAX_TICK_MS,ms-elapsed));}
function settle(game,limit=1000){for(let step=0;['clearing','settling'].includes(game.state.phase)&&step<limit;step++)game.tick(MAX_TICK_MS);assert(!['clearing','settling'].includes(game.state.phase),'Resolution did not terminate');}
const clears=game=>game.state.events.filter(event=>event.type==='clear');
function connected(cells){const keys=new Set(cells.map(c=>`${c.row}:${c.col}`)),seen=new Set(),todo=[cells[0]];while(todo.length){const cell=todo.pop(),key=`${cell.row}:${cell.col}`;if(seen.has(key))continue;seen.add(key);for(const [r,c]of [[1,0],[-1,0],[0,1],[0,-1]])if(keys.has(`${cell.row+r}:${cell.col+c}`))todo.push({row:cell.row+r,col:cell.col+c});}return seen.size===4;}
function validOwnership(state){for(let r=0;r<ROWS;r++)for(let c=0;c<COLUMNS;c++)assert.equal(state.board[r][c]===null,state.boardOwners[r][c]===null);}
function placeAt(game,target){let attempts=20;while(game.state.active?.col!==target&&attempts-->0&&game.move(Math.sign(target-game.state.active.col))){}game.hardDrop();settle(game);}

test('nine kinds exclude whole values and retain exact half-beats, including two and four sixteenths',()=>{
 assert.equal(COLUMNS,10);assert.equal(ROWS,24);assert.equal(NOTE_KINDS.length,9);
 assert.deepEqual(NOTE_KINDS.map(k=>k.units),[2,2,2,4,1,2,4,6,1]);assert.equal(NOTE_KIND_BY_ID.whole,undefined);assert.equal(NOTE_KIND_BY_ID['whole-rest'],undefined);
 assert.equal(NOTE_KIND_BY_ID['sixteenth-pair'].label,'Two sixteenth notes');assert.equal(NOTE_KIND_BY_ID['sixteenth-pair'].beats,.5);assert.equal(NOTE_KIND_BY_ID['sixteenth-group'].beats,1);
 assert(NOTE_KINDS.every(k=>Number.isInteger(k.units)&&k.beats===k.units/2&&k.label));assert.deepEqual(NOTE_KINDS.filter(k=>k.rest).map(k=>k.id),['quarter-rest','half-rest']);
 assert(Object.isFrozen(NOTE_KINDS)&&NOTE_KINDS.every(Object.isFrozen));
});

test('all seven tetrominoes are connected normalized four-square shapes and each shuffled bag contains all seven',()=>{
 assert.deepEqual(SHAPES,['I','O','T','S','Z','J','L']);
 for(const shape of SHAPES){const cells=SHAPE_CELLS[shape];assert.equal(cells.length,4);assert.equal(new Set(cells.map(c=>`${c.row}:${c.col}`)).size,4);assert.equal(Math.min(...cells.map(c=>c.row)),0);assert.equal(Math.min(...cells.map(c=>c.col)),0);assert(connected(cells));}
 const game=createGame({rng:seeded(117)});game.start();const shapes=[];
 for(let index=0;index<21;index++){
  const piece=game.state.active;assert(piece,'Enough distributed board space for three bags');shapes.push(piece.shape);assert.equal(piece.cells.length,4);assert(connected(piece.cells));
  const width=1+Math.max(...piece.cells.map(c=>c.col));placeAt(game,(index*3)%(COLUMNS-width+1));
 }
 for(let at=0;at<21;at+=7)assert.deepEqual(new Set(shapes.slice(at,at+7)),new Set(SHAPES));
 const other=createGame({rng:seeded(233)});other.start();assert.notEqual(other.state.active.shape,shapes[0],'The bag is actually shuffled');
});

test('every active and preview piece mixes at least two beat values, with an early majority of one-beat cells',()=>{
 let total=0,oneBeat=0;const seen=new Set();
 for(let seed=0;seed<300;seed++){
  const game=createGame({rng:seeded(seed+1)});game.start();
  for(const piece of [game.state.active,game.state.next]){const values=piece.cells.map(c=>NOTE_KIND_BY_ID[c.kind].units);assert(new Set(values).size>=2);for(const cell of piece.cells){seen.add(cell.kind);total++;if(NOTE_KIND_BY_ID[cell.kind].units===2)oneBeat++;}}
 }
 assert(oneBeat/total>.6&&oneBeat/total<=.75);assert(seen.has('eighth')&&seen.has('sixteenth-pair'));assert(!seen.has('whole')&&!seen.has('whole-rest'));
 for(const value of [0,.999]){const game=createGame({rng:()=>value});game.start();for(const p of [game.state.active,game.state.next])assert(new Set(p.cells.map(c=>NOTE_KIND_BY_ID[c.kind].units)).size>=2);}
});

test('four-beat windows clear inside longer rows and columns without overlapping same-axis notes',()=>{
 for(const count of [5,6,8,10]){const board=empty();put(board,23,0,Array(count).fill('quarter'));const patterns=findMatches(board);assert.equal(patterns.length,Math.floor(count/4));assert(patterns.every(p=>p.units===8&&p.cells.length===4));assert.equal(new Set(patterns.flatMap(p=>p.cells.map(c=>c.col))).size,patterns.length*4);}
 const vertical=empty();for(let row=5;row<11;row++)vertical[row][3]='quarter';const matches=findMatches(vertical);assert.equal(matches.length,1);assert.equal(matches[0].axis,'vertical');
 const totalEight=empty();put(totalEight,23,1,['dotted-half','dotted-half','half']);assert.deepEqual(findMatches(totalEight),[],'Eight total beats without a four-beat window is not a pattern');
});

test('four beats count groups, rests, single eighths and double-sixteenths exactly',()=>{
 for(const kinds of [['eighth-pair','sixteenth-group','quarter-rest','quarter'],['dotted-half','eighth','sixteenth-pair'],['half-rest','half']]){const board=empty();put(board,22,2,kinds);const patterns=findMatches(board);assert.equal(patterns.length,1);assert.equal(patterns[0].units,8);assert.deepEqual(patterns[0].kinds,kinds);}
 const board=empty();put(board,23,1,['quarter','dotted-half','eighth','sixteenth-pair','dotted-half']);const patterns=findMatches(board);assert.equal(patterns.length,2,'Earliest finishing windows preserve two runs instead of choosing an overlapping middle window');assert.deepEqual(patterns.map(p=>p.cells.map(c=>c.col)).sort((a,b)=>a[0]-b[0]),[[1,2],[3,4,5]]);
});

test('owners never restrict four-beat windows and crossing horizontal/vertical patterns are a valid combo',()=>{
 const board=empty();put(board,23,1,['quarter','eighth-pair','sixteenth-group','quarter-rest']);const owners=ownersFor(board,41);assert.equal(findMatches(board,owners).length,1);owners[23][4]=42;assert.equal(findMatches(board,owners).length,1);
 const cross=empty();put(cross,12,3,Array(4).fill('quarter'));for(let row=10;row<14;row++)cross[row][4]='quarter';
 const patterns=findMatches(cross);assert.equal(patterns.length,2);assert.deepEqual(new Set(patterns.map(p=>p.axis)),new Set(['horizontal','vertical']));
 const own=ownersFor(cross,'same');assert.equal(findMatches(cross,own).length,2);own[10][4]='other';assert.equal(findMatches(cross,own).length,2,'Ownership cannot change which notes count');
 const game=createGame({initialBoard:cross,rng:()=>0});game.start();settle(game);assert.equal(game.state.score,500);assert.equal(clears(game)[0].cells.length,7);
});

test('matching cannot wrap rows, jump gaps or bend, and malformed boards/owners are rejected',()=>{
 const wrap=empty();put(wrap,10,8,['quarter','quarter']);put(wrap,11,0,['quarter','quarter']);assert.deepEqual(findMatches(wrap),[]);
 const gap=empty();put(gap,12,0,['quarter','quarter',null,'quarter','quarter']);assert.deepEqual(findMatches(gap),[]);
 const bend=empty();put(bend,12,1,['quarter','quarter']);bend[13][2]=bend[14][2]='quarter';assert.deepEqual(findMatches(bend),[]);
 assert.throws(()=>findMatches([[null]]),/24 rows/);const board=empty();board[1][1]='unknown';assert.throws(()=>findMatches(board),/Unknown rhythm block/);
 const occupied=empty();occupied[1][1]='quarter';assert.throws(()=>findMatches(occupied,empty()),/stable piece owner/);assert.throws(()=>createGame({initialOwners:[[null]]}),/24 rows/);
});

test('absoluteCells is pure and a lock writes all four squares atomically, allowing a same-piece four-beat clear',()=>{
 const game=createGame({rng:rngForI()});game.start();const before=game.state.active,local=structuredClone(before.cells),absolute=absoluteCells(before,23,2);
 assert.deepEqual(absolute.map(c=>[c.row,c.col]),[[23,2],[23,3],[23,4],[23,5]]);assert.deepEqual(before.cells,local);
 assert.equal(game.hardDrop(),23);const state=game.state;assert.equal(state.score,0);assert.equal(state.phase,'clearing');assert.equal(state.board.flat().filter(Boolean).length,4);assert.equal(state.boardOwners.flat().filter(v=>v===before.id).length,4);validOwnership(state);
 assert.deepEqual(state.board[23].slice(3,7),local.map(c=>c.kind));settle(game);assert.equal(game.state.score,200);assert.equal(game.state.active.id,before.id+1);assert.equal(game.state.board.flat().filter(Boolean).length,1);assert.equal(clears(game).length,1);
 const self=empty();put(self,23,0,['half','half']);assert.equal(findMatches(self,ownersFor(self,1)).length,1);
});

test('movement and downward collision check every square, not only the anchor; blocked spawn never overwrites',()=>{
 const obstacle=empty();obstacle[1][6]='dotted-half';const game=createGame({initialBoard:obstacle,rng:()=>0});game.start();assert.equal(game.move(1),false);assert.equal(game.state.active.col,4);assert.equal(game.move(-1),true);
 while(game.move(-1)){}assert.equal(Math.min(...absoluteCells(game.state.active).map(c=>c.col)),0);assert.equal(game.move(-1),false);assert.equal(game.move(2),false);
 const wall=empty();wall[2][5]='dotted-half';const blocked=createGame({initialBoard:wall,rng:()=>0});blocked.start();blocked.softDrop();assert.equal(blocked.state.phase,'over');assert.equal(blocked.state.board[2][5],'dotted-half');assert.equal(blocked.state.board.flat().filter(Boolean).length,5);validOwnership(blocked.state);
 const spawn=empty();spawn[1][4]='dotted-half';const failed=createGame({initialBoard:spawn,rng:()=>0});failed.start();assert.equal(failed.state.phase,'over');assert.equal(failed.state.active,null);assert.deepEqual(failed.state.board,spawn);assert.equal(failed.state.boardOwners[1][4],-1);
});

test('rotations retain each cell kind and four turns restore geometry, including square-piece note positions',()=>{
 for(const rng of [rngForI(),()=>0]){const game=createGame({rng});game.start();const original=game.state.active;
  for(let turn=0;turn<4;turn++){assert.equal(game.rotate(),true);assert.deepEqual(game.state.active.cells.map(c=>c.kind),original.cells.map(c=>c.kind));assert(connected(game.state.active.cells));}
  assert.deepEqual(game.state.active,original);assert.equal(game.rotate(-1),true);assert.equal(game.state.active.rotation,3);assert.equal(game.rotate(1),true);assert.deepEqual(game.state.active,original);assert.equal(game.rotate(2),false);
 }
});

test('bounded wall and floor kicks keep all four cells inside the board, and an obstructed rotation is rejected',()=>{
 const game=createGame({rng:rngForI()});game.start();game.rotate();while(game.move(1)){}assert.equal(game.state.active.col,9);assert.equal(game.rotate(),true);assert.equal(game.state.active.col,6);assert(absoluteCells(game.state.active).every(c=>c.col>=0&&c.col<10));
 const floor=createGame({rng:rngForI()});floor.start();for(let row=0;row<23;row++)floor.softDrop();assert.equal(floor.state.active.row,23);assert.equal(floor.rotate(),true);assert.equal(floor.state.active.row,20);assert(absoluteCells(floor.state.active).every(c=>c.row>=0&&c.row<24));
 const board=empty();put(board,2,0,Array(10).fill('dotted-half'));const blocked=createGame({initialBoard:board,rng:rngForI()});blocked.start();blocked.softDrop();const before=blocked.state.active,revision=blocked.revision;assert.equal(blocked.rotate(),false);assert.deepEqual(blocked.state.active,before);assert.equal(blocked.revision,revision);
});

test('a real shaped drop clears four beats, flashes, settles and resumes automatically',()=>{
  const board=empty();board[23][6]='quarter';const game=createGame({initialBoard:board,rng:()=>0});game.start();assert.equal(game.state.phase,'falling');assert.equal(game.hardDrop(),22);assert.equal(game.state.phase,'clearing');assert.equal(game.state.clearingMatches[0].units,8);
  const revision=game.revision;assert.equal(game.rotate(),false);assert.equal(game.move(1),false);assert.equal(game.softDrop(),false);assert.equal(game.hardDrop(),0);assert.equal(game.revision,revision);
  advance(game,CLEAR_FLASH_MS-1);assert.equal(game.state.score,0);game.tick(1);assert.equal(game.state.score,200);assert.equal(game.state.phase,'settling');advance(game,SETTLE_MS);assert.equal(game.state.phase,'falling');assert.equal(clears(game).length,1);assert.equal(game.state.board.flat().filter(Boolean).length,2);validOwnership(game.state);
});

test('one drop can make disjoint four-beat runs, including eight quarters as a 500-point combo',()=>{
 const board=empty();put(board,22,1,Array(3).fill('quarter'));put(board,22,6,Array(3).fill('quarter'));const game=createGame({initialBoard:board,rng:()=>0});game.start();assert.equal(game.state.phase,'falling');game.hardDrop();assert.equal(game.state.clearingMatches.length,2);assert(game.state.clearingMatches.every(p=>p.units===8));settle(game);
 assert.equal(game.state.score,500);assert.equal(game.state.lastClear.comboRuns,2);assert.equal(game.state.lastClear.chain,1);assert.equal(game.state.board.flat().filter(Boolean).length,2);
 const three=empty();for(let row=12;row<24;row++)three[row][0]='quarter';const triple=createGame({initialBoard:three,rng:()=>0});triple.start();settle(triple);assert.equal(triple.state.score,800);assert.equal(triple.state.lastClear.comboRuns,3);assert.equal(triple.state.lastClear.patterns.length,3);
});

test('gravity preserves owner metadata, while same-owner cascades count toward this drop’s cumulative combo',()=>{
 const board=empty();put(board,23,0,Array(4).fill('quarter'));board[20][0]='half';board[21][1]='quarter';board[22][2]='quarter';
 for(const distinct of [false,true]){
  const owners=ownersFor(board,(r,c)=>r===23?`base:${c}`:distinct?`upper:${c}`:'one-piece'),game=createGame({initialBoard:board,initialOwners:owners,rng:()=>0});game.start();advance(game,CLEAR_FLASH_MS);
  assert.equal(game.state.phase,'settling');assert.deepEqual(game.state.board[23].slice(0,3),['half','quarter','quarter']);assert.deepEqual(game.state.boardOwners[23].slice(0,3),distinct?['upper:0','upper:1','upper:2']:Array(3).fill('one-piece'));assert.equal(findMatches(game.state.board,game.state.boardOwners).length,1);validOwnership(game.state);settle(game);
  assert.equal(game.state.score,700);assert.equal(clears(game).length,2);assert.deepEqual(clears(game).map(e=>e.chain),[1,2]);assert.deepEqual(clears(game).map(e=>e.comboRuns),[1,2]);assert.deepEqual(clears(game).map(e=>e.points),[200,500]);assert.deepEqual(clears(game)[1].patterns[0].kinds,['half','quarter','quarter']);
  const previous=game.state.lastClear.id;game.hardDrop();settle(game);game.hardDrop();settle(game);const nextDrop=clears(game).find(e=>e.id>previous);assert(nextDrop);assert.equal(nextDrop.chain,1);assert.equal(nextDrop.comboRuns,nextDrop.patterns.length,'A new drop starts its own combo count');assert.equal(nextDrop.points,200*nextDrop.patterns.length+100*(nextDrop.patterns.length-1));
 }
});

test('settled ceiling risk waits for a real rescue pattern and otherwise ends the game without overwriting',()=>{
 const full=empty();for(let row=0;row<ROWS;row++)full[row][0]='dotted-half';const over=createGame({initialBoard:full,rng:()=>0});over.start();assert.equal(over.state.phase,'over');assert.equal(over.state.active,null);
 full[0][0]='half';full[1][0]='half';const rescue=createGame({initialBoard:full,rng:()=>0});rescue.start();assert.equal(rescue.state.phase,'clearing','A four-beat window can rescue the ceiling even inside a longer column');assert.equal(rescue.state.events.some(e=>e.type==='over'),false);settle(rescue);assert.equal(rescue.state.phase,'falling');assert.equal(rescue.state.board[0][0],null);assert.equal(rescue.state.score,200);
});

test('a newly locked ceiling piece resolves crossing rescue and cascades before top-out and level progression',()=>{
 const board=empty();board[1][6]='quarter';board[2][4]=board[2][5]='dotted-half';const game=createGame({initialBoard:board,rng:()=>0});game.start();assert.equal(game.state.phase,'falling');assert.equal(game.hardDrop(),0);assert.equal(game.state.phase,'clearing');assert.equal(game.state.events.some(e=>e.type==='over'),false);
 settle(game);assert.equal(game.state.phase,'falling');assert.equal(game.state.score,1500);assert.equal(game.state.level,2);assert.equal(game.state.fallIntervalMs,995);assert.deepEqual(clears(game).map(e=>e.chain),[1,2]);assert.deepEqual(clears(game).map(e=>e.comboRuns),[2,4]);assert.deepEqual(clears(game).map(e=>e.points),[500,1000]);assert.equal(game.state.events.some(e=>e.type==='over'),false);assert(game.state.board.flat().every(c=>c===null));
});

test('pause freezes clocks and input; tick is bounded and revision changes only when visible state changes',()=>{
 const game=createGame({rng:()=>0});assert.equal(game.tick(1000),false);game.start();const revision=game.revision;
 for(const dt of [undefined,NaN,Infinity,-1,0])assert.equal(game.tick(dt),false);assert.equal(game.revision,revision);assert.equal(game.tick(600000),false);advance(game,900);assert.equal(game.state.active.row,0);
 game.pause();const paused=game.revision;assert.equal(game.move(1),false);assert.equal(game.rotate(),false);assert.equal(game.softDrop(),false);assert.equal(game.hardDrop(),0);game.tick(600000);assert.equal(game.revision,paused);game.resume();assert.equal(game.tick(600000),false);game.tick(50);assert.equal(game.state.active.row,1);
 const now=game.revision;assert.equal(game.tick(16),false);assert.equal(game.revision,now);
});

test('weights include double-sixteenths and stay normalized, increasing fractional and dotted values with level',()=>{
 const oneBeat=NOTE_KINDS.filter(k=>k.units===2).map(k=>k.id),initial=kindWeights(1);assert.equal(oneBeat.reduce((sum,id)=>sum+initial[id],0),8400);assert.equal(initial.eighth,100);assert.equal(initial['sixteenth-pair'],100);
 for(let level=1;level<=100;level++){const w=kindWeights(level);assert.equal(Object.values(w).reduce((a,b)=>a+b,0),10000);assert(Object.values(w).every(n=>Number.isInteger(n)&&n>0));if(level>1)for(const id of ['eighth','sixteenth-pair','dotted-half'])assert(w[id]>=kindWeights(level-1)[id]);assert(fallInterval(level)>=150);}
 assert.equal(fallInterval(1),1050);assert.equal(fallInterval(2),995);assert.equal(fallInterval(100),150);
 let total=0;for(const kind of NOTE_KINDS){const game=createGame({rng:rngForI((total+initial[kind.id]/2)/10000)});game.start();assert.equal(game.state.active.cells[0].kind,kind.id);total+=initial[kind.id];}
});

test('clear events keep ordered rhythm kinds, owner IDs never replace event IDs, and the ring survives restart',()=>{
 const board=empty();put(board,23,1,['dotted-half','eighth','sixteenth-pair']);const owners=ownersFor(board,(_,c)=>40+c),game=createGame({initialBoard:board,initialOwners:owners,rng:()=>0});game.start();settle(game);
 const event=clears(game)[0];assert.deepEqual(event.patterns[0].kinds,['dotted-half','eighth','sixteenth-pair']);assert.equal(event.patterns[0].units,8);assert(game.state.active.id>43);
 game.hardDrop();settle(game);const events=game.state.events;assert(events.every((e,i)=>!i||e.id>events[i-1].id));
 for(let i=0;i<20;i++){game.pause();game.resume();}assert.equal(game.state.events.length,16);const previous=game.state.events.at(-1).id;game.restart();assert(game.state.events[0].id>previous);assert.equal(game.state.score,0);assert.equal(game.state.lastClear,null);assert.equal(game.state.paused,false);
});

test('snapshots and fixtures isolate active/preview cells and owners; seeded play is reproducible',()=>{
 const board=empty();board[23][0]='dotted-half';const owner=ownersFor(board,'seed'),game=createGame({initialBoard:board,initialOwners:owner,rng:()=>0});board[23][0]=null;owner[23][0]='changed';game.start();
 const state=game.state;state.active.cells[0].kind='whole';state.next.cells[0].kind='whole';state.boardOwners[23][0]='changed';state.events[0].type='changed';assert.equal(game.state.active.cells[0].kind,'quarter');assert.equal(game.state.next.cells[0].kind,'quarter');assert.equal(game.state.boardOwners[23][0],'seed');assert.equal(game.state.events[0].type,'start');
 const a=createGame({rng:seeded(55)}),b=createGame({rng:seeded(55)});a.start();b.start();for(let i=0;i<15;i++)for(const g of [a,b])if(g.state.phase!=='over'){g.rotate(i%2?1:-1);placeAt(g,i%6);}
 assert.deepEqual(a.state,b.state);assert.throws(()=>createGame({rng:()=>1}).start(),/rng must return/);assert.throws(()=>createGame({rng:null}),/rng must be/);
});
