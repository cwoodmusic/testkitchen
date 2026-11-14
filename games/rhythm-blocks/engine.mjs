export const COLUMNS=10,ROWS=24,MAX_TICK_MS=100,CLEAR_FLASH_MS=280,SETTLE_MS=90;
export const NOTE_KINDS=Object.freeze([
 ['quarter','Quarter note',2,false],['eighth-pair','Two eighth notes',2,false],
 ['sixteenth-group','Four sixteenth notes',2,false],['half','Half note',4,false],
 ['whole','Whole note',8,false],['eighth','Eighth note',1,false],
 ['quarter-rest','Quarter rest',2,true],['half-rest','Half rest',4,true],
 ['whole-rest','Whole rest',8,true],['dotted-half','Dotted half note',6,false]
].map(([id,label,units,rest])=>Object.freeze({id,label,units,beats:units/2,rest})));
export const NOTE_KIND_BY_ID=Object.freeze(Object.fromEntries(NOTE_KINDS.map(kind=>[kind.id,kind])));
const EMPTY=()=>Array.from({length:ROWS},()=>Array(COLUMNS).fill(null));
const copy=value=>Array.isArray(value)?value.map(copy):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,copy(item)])):value;
function checkedBoard(board){
 if(!Array.isArray(board)||board.length!==ROWS||board.some(row=>!Array.isArray(row)||row.length!==COLUMNS))throw TypeError('The rhythm board must have 24 rows and 10 columns.');
 for(const row of board)for(const kind of row)if(kind!==null&&(typeof kind!=='string'||!Object.hasOwn(NOTE_KIND_BY_ID,kind)))throw TypeError('Unknown rhythm block: '+kind);
 return board.map(row=>[...row]);
}

/** Integer selection weights sum to 10,000 at every supported level. */
export function kindWeights(level=1){
 const step=Math.min(15,Math.max(0,Math.floor(level)-1));
 return {quarter:2800-step*60,'eighth-pair':2300-step*50,'sixteenth-group':2000-step*50,half:600,whole:200,eighth:100+step*110,'quarter-rest':1400-step*40,'half-rest':300,'whole-rest':200,'dotted-half':100+step*90};
}
export const fallInterval=level=>Math.max(150,1050-(Math.max(1,Math.floor(level))-1)*55);

/**
 * Only consecutive occupied cells in one straight line form a pattern. Eight
 * beats win over intersecting four-beat windows on the same axis; genuine
 * horizontal/vertical crossings remain separate patterns in the same combo.
 */
export function findMatches(input){
 const board=checkedBoard(input),candidates=[];
 for(const axis of ['horizontal','vertical']){
  const lines=axis==='horizontal'?ROWS:COLUMNS,length=axis==='horizontal'?COLUMNS:ROWS;
  for(let line=0;line<lines;line++)for(let start=0;start<length;start++){
   let units=0;const cells=[],kinds=[];
   for(let end=start;end<length;end++){
    const row=axis==='horizontal'?line:end,col=axis==='horizontal'?end:line,kind=board[row][col];if(kind===null)break;
    units+=NOTE_KIND_BY_ID[kind].units;if(units>16)break;cells.push({row,col});kinds.push(kind);
    if(units===8||units===16)candidates.push({axis,units,cells:cells.map(cell=>({...cell})),kinds:[...kinds]});
   }
  }
 }
 candidates.sort((a,b)=>b.units-a.units||b.cells.length-a.cells.length||a.cells[0].row-b.cells[0].row||a.cells[0].col-b.cells[0].col||(a.axis===b.axis?0:a.axis==='horizontal'?-1:1));
 const used={horizontal:new Set(),vertical:new Set()},identical=new Set(),matches=[];
 for(const pattern of candidates){
  const keys=pattern.cells.map(({row,col})=>row*COLUMNS+col),key=keys.join(',');
  if(identical.has(key)||keys.some(cell=>used[pattern.axis].has(cell))||keys.length===1&&matches.some(match=>match.cells.some(({row,col})=>row*COLUMNS+col===keys[0])))continue;
  identical.add(key);keys.forEach(cell=>used[pattern.axis].add(cell));matches.push(pattern);
 }
 return matches;
}

function gravity(board){
 const moves=[];
 for(let col=0;col<COLUMNS;col++){
  let bottom=ROWS-1;
  for(let row=ROWS-1;row>=0;row--)if(board[row][col]!==null){
   const kind=board[row][col];if(row!==bottom){board[bottom][col]=kind;board[row][col]=null;moves.push({kind,from:{row,col},to:{row:bottom,col}});}bottom--;
  }
 }
 return moves;
}

/** One falling block, exact half-beat arithmetic and no external mutable state. */
export function createGame({rng=Math.random,initialBoard}={}){
 if(typeof rng!=='function')throw TypeError('rng must be a function.');
 const seedBoard=initialBoard===undefined?EMPTY():checkedBoard(initialBoard);
 let board=EMPTY(),phase='idle',paused=false,active=null,next=null,score=0,level=1,revision=0,eventId=0,events=[],clearingMatches=[],lastClear=null,chain=1,fallElapsed=0,phaseElapsed=0,discardNextTick=false;
 const changed=()=>{revision++;};
 function emit(type,details={}){events.push({id:++eventId,type,...details});if(events.length>16)events.shift();}
 function choose(){
  const value=rng();if(!Number.isFinite(value)||value<0||value>=1)throw RangeError('rng must return a number from 0 (inclusive) to 1 (exclusive).');
  const weights=kindWeights(level);let target=value*10000;
  for(const kind of NOTE_KINDS){target-=weights[kind.id];if(target<0)return kind.id;}
  return NOTE_KINDS.at(-1).id;
 }
 function gameOver(){phase='over';active=null;clearingMatches=[];emit('over',{score,level});changed();}
 function spawn(){
  if(board[0].some(kind=>kind!==null)){gameOver();return;}
  active={kind:next,row:0,col:Math.floor((COLUMNS-1)/2)};next=choose();phase='falling';fallElapsed=0;phaseElapsed=0;chain=1;
  emit('spawn',{kind:active.kind});changed();
 }
 function resolve(){
  clearingMatches=findMatches(board);active=null;phaseElapsed=0;
  if(clearingMatches.length){phase='clearing';changed();}
  else spawn();
 }
 function lock(){
  board[active.row][active.col]=active.kind;emit('lock',{...active});active=null;fallElapsed=0;chain=1;changed();resolve();
 }
 function down(){
  if(active.row+1<ROWS&&board[active.row+1][active.col]===null){active.row++;changed();return true;}
  lock();return false;
 }
 function clearWave(){
  const patterns=copy(clearingMatches),unique=new Map();
  for(const pattern of patterns)for(const cell of pattern.cells)unique.set(cell.row*COLUMNS+cell.col,cell);
  for(const {row,col}of unique.values())board[row][col]=null;
  const points=(patterns.reduce((total,pattern)=>total+(pattern.units===16?500:200),0)+100*(patterns.length-1))*chain;
  score+=points;const previousLevel=level;level=1+Math.floor(score/1000);
  emit('clear',{patterns,points,chain,cells:[...unique.values()],score,level});lastClear=copy(events.at(-1));
  if(previousLevel!==level)emit('level',{level});
  const moves=gravity(board);if(moves.length)emit('gravity',{moves});
  clearingMatches=[];phase='settling';phaseElapsed=0;chain++;changed();
 }
 function getState(){return {board:board.map(row=>[...row]),phase,paused,active:active?{...active}:null,next,score,level,fallIntervalMs:fallInterval(level),clearingMatches:copy(clearingMatches),lastClear:copy(lastClear),events:copy(events),revision};}
 function start(){
  board=seedBoard.map(row=>[...row]);phase='idle';paused=false;active=null;score=0;level=1;events=[];clearingMatches=[];lastClear=null;chain=1;fallElapsed=phaseElapsed=0;discardNextTick=false;
  next=choose();emit('start');changed();resolve();return getState();
 }
 function canMove(){return phase==='falling'&&!paused&&active!==null;}
 return {
  start,restart:start,getState,get state(){return getState();},get revision(){return revision;},
  move(dx){
   if(!canMove()||![1,-1].includes(dx))return false;
   const col=active.col+dx;if(col<0||col>=COLUMNS||board[active.row][col]!==null)return false;
   active.col=col;changed();return true;
  },
  softDrop(){if(!canMove())return false;fallElapsed=0;down();return true;},
  hardDrop(){
   if(!canMove())return 0;let distance=0;
   while(active.row+1<ROWS&&board[active.row+1][active.col]===null){active.row++;distance++;}
   emit('drop',{distance});lock();return distance;
  },
  tick(dtMs){
   const before=revision;if(paused||['idle','over'].includes(phase)||!Number.isFinite(dtMs)||dtMs<=0)return false;
   if(discardNextTick){discardNextTick=false;return false;}
   const elapsed=Math.min(MAX_TICK_MS,dtMs);
   if(phase==='falling'){
    fallElapsed+=elapsed;if(fallElapsed>=fallInterval(level)){fallElapsed-=fallInterval(level);down();}
   }else if(phase==='clearing'){
    phaseElapsed+=elapsed;if(phaseElapsed>=CLEAR_FLASH_MS)clearWave();
   }else if(phase==='settling'){
    phaseElapsed+=elapsed;if(phaseElapsed>=SETTLE_MS)resolve();
   }
   return revision!==before;
  },
  pause(){if(paused||['idle','over'].includes(phase))return false;paused=true;emit('pause');changed();return true;},
  resume(){if(!paused)return false;paused=false;discardNextTick=true;emit('resume');changed();return true;}
 };
}
