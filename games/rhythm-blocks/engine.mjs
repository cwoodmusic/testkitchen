export const COLUMNS=10,ROWS=24,MAX_TICK_MS=100,CLEAR_FLASH_MS=280,SETTLE_MS=90;
export const NOTE_KINDS=Object.freeze([
 ['quarter','Quarter note',2,false],['eighth-pair','Two eighth notes',2,false],
 ['sixteenth-group','Four sixteenth notes',2,false],['half','Half note',4,false],
 ['eighth','Eighth note',1,false],
 ['quarter-rest','Quarter rest',2,true],['half-rest','Half rest',4,true],
 ['dotted-half','Dotted half note',6,false],
 ['sixteenth-pair','Two sixteenth notes',1,false]
].map(([id,label,units,rest])=>Object.freeze({id,label,units,beats:units/2,rest})));
export const NOTE_KIND_BY_ID=Object.freeze(Object.fromEntries(NOTE_KINDS.map(kind=>[kind.id,kind])));
export const SHAPES=Object.freeze(['I','O','T','S','Z','J','L']);
export const SHAPE_CELLS=Object.freeze(Object.fromEntries([
 ['I',[[0,0],[0,1],[0,2],[0,3]]],['O',[[0,0],[0,1],[1,0],[1,1]]],
 ['T',[[0,1],[1,0],[1,1],[1,2]]],['S',[[0,1],[0,2],[1,0],[1,1]]],
 ['Z',[[0,0],[0,1],[1,1],[1,2]]],['J',[[0,0],[1,0],[1,1],[1,2]]],['L',[[0,2],[1,0],[1,1],[1,2]]]
].map(([shape,cells])=>[shape,Object.freeze(cells.map(([row,col])=>Object.freeze({row,col})))])));
const EMPTY=()=>Array.from({length:ROWS},()=>Array(COLUMNS).fill(null));
const copy=value=>Array.isArray(value)?value.map(copy):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,copy(item)])):value;
function checkedBoard(board){
 if(!Array.isArray(board)||board.length!==ROWS||board.some(row=>!Array.isArray(row)||row.length!==COLUMNS))throw TypeError('The rhythm board must have 24 rows and 10 columns.');
 for(const row of board)for(const kind of row)if(kind!==null&&(typeof kind!=='string'||!Object.hasOwn(NOTE_KIND_BY_ID,kind)))throw TypeError('Unknown rhythm block: '+kind);
 return board.map(row=>[...row]);
}
function checkedOwners(owners,board){
 if(owners===undefined){let id=0;return board.map(row=>row.map(kind=>kind===null?null:--id));}
 if(!Array.isArray(owners)||owners.length!==ROWS||owners.some(row=>!Array.isArray(row)||row.length!==COLUMNS))throw TypeError('Piece owners must have 24 rows and 10 columns.');
 for(let row=0;row<ROWS;row++)for(let col=0;col<COLUMNS;col++){
  const owner=owners[row][col];
  if(board[row][col]===null?owner!==null:!(typeof owner==='string'&&owner.length>0||Number.isSafeInteger(owner)))throw TypeError('Each occupied square needs a stable piece owner, and empty squares need null.');
 }
 return owners.map(row=>[...row]);
}
export const absoluteCells=(piece,row=piece.row??0,col=piece.col??0)=>piece.cells.map(cell=>({...cell,row:row+cell.row,col:col+cell.col}));
function rotatedCells(cells,direction){
 const width=1+Math.max(...cells.map(cell=>cell.col)),height=1+Math.max(...cells.map(cell=>cell.row));
 return cells.map(cell=>({...cell,row:direction===1?cell.col:width-1-cell.col,col:direction===1?height-1-cell.row:cell.row}));
}

/** Integer selection weights sum to 10,000 at every supported level. */
export function kindWeights(level=1){
 const step=Math.min(15,Math.max(0,Math.floor(level)-1));
 return {quarter:2700-step*60,'eighth-pair':2300-step*50,'sixteenth-group':2000-step*50,half:900,eighth:100+step*60,'quarter-rest':1400-step*40,'half-rest':400,'dotted-half':100+step*90,'sixteenth-pair':100+step*50};
}
export const fallInterval=level=>Math.max(150,1050-(Math.max(1,Math.floor(level))-1)*55);

/**
 * Any contiguous straight four-beat window clears, including one piece's
 * own notes or a window inside a longer line. Disjoint windows on an axis
 * count separately; genuine horizontal/vertical crossings make a combo.
 */
export function findMatches(input,owners){
 const board=checkedBoard(input),candidates=[];if(owners!==undefined)checkedOwners(owners,board);
 for(const axis of ['horizontal','vertical']){
  const lines=axis==='horizontal'?ROWS:COLUMNS,length=axis==='horizontal'?COLUMNS:ROWS;
  for(let line=0;line<lines;line++)for(let start=0;start<length;start++){
   let units=0;const cells=[],kinds=[];
   for(let end=start;end<length;end++){
    const row=axis==='horizontal'?line:end,col=axis==='horizontal'?end:line,kind=board[row][col];if(kind===null)break;
    units+=NOTE_KIND_BY_ID[kind].units;if(units>8)break;cells.push({row,col});kinds.push(kind);
    if(units===8)candidates.push({axis,units,cells:cells.map(cell=>({...cell})),kinds:[...kinds]});
   }
  }
 }
 // Equal-value interval scheduling: earliest finishing windows allow the most
 // disjoint runs on each line, instead of a longer middle window blocking two.
 candidates.sort((a,b)=>a.cells.at(-1).row-b.cells.at(-1).row||a.cells.at(-1).col-b.cells.at(-1).col||(a.axis===b.axis?0:a.axis==='horizontal'?-1:1));
 const used={horizontal:new Set(),vertical:new Set()},identical=new Set(),matches=[];
 for(const pattern of candidates){
  const keys=pattern.cells.map(({row,col})=>row*COLUMNS+col),key=keys.join(',');
  if(identical.has(key)||keys.some(cell=>used[pattern.axis].has(cell)))continue;
  identical.add(key);keys.forEach(cell=>used[pattern.axis].add(cell));matches.push(pattern);
 }
 return matches.sort((a,b)=>b.cells.length-a.cells.length||a.cells[0].row-b.cells[0].row||a.cells[0].col-b.cells[0].col);
}

function gravity(board,owners){
 const moves=[];
 for(let col=0;col<COLUMNS;col++){
  let bottom=ROWS-1;
  for(let row=ROWS-1;row>=0;row--)if(board[row][col]!==null){
   const kind=board[row][col],owner=owners[row][col];if(row!==bottom){board[bottom][col]=kind;owners[bottom][col]=owner;board[row][col]=null;owners[row][col]=null;moves.push({kind,owner,from:{row,col},to:{row:bottom,col}});}bottom--;
  }
 }
 return moves;
}

/** Four connected note squares move as one; provenance survives later gravity. */
export function createGame({rng=Math.random,initialBoard,initialOwners}={}){
 if(typeof rng!=='function')throw TypeError('rng must be a function.');
 const seedBoard=initialBoard===undefined?EMPTY():checkedBoard(initialBoard),seedOwners=checkedOwners(initialOwners,seedBoard);
 let board=EMPTY(),boardOwners=EMPTY(),phase='idle',paused=false,active=null,next=null,score=0,level=1,revision=0,eventId=0,events=[],clearingMatches=[],lastClear=null,chain=1,dropRuns=0,fallElapsed=0,phaseElapsed=0,discardNextTick=false,bag=[],pieceId=0;
 const changed=()=>{revision++;};
 function emit(type,details={}){events.push({...details,id:++eventId,type});if(events.length>16)events.shift();}
 function random(){const value=rng();if(!Number.isFinite(value)||value<0||value>=1)throw RangeError('rng must return a number from 0 (inclusive) to 1 (exclusive).');return value;}
 function choose(excludeUnits){
  const weights=kindWeights(level),available=NOTE_KINDS.filter(kind=>kind.units!==excludeUnits),total=available.reduce((sum,kind)=>sum+weights[kind.id],0);let target=random()*total;
  for(const kind of available){target-=weights[kind.id];if(target<0)return kind.id;}
  return available.at(-1).id;
 }
 function makePiece(){
  if(!bag.length){bag=[...SHAPES];for(let index=bag.length-1;index>0;index--){const other=Math.floor(random()*(index+1));[bag[index],bag[other]]=[bag[other],bag[index]];}}
  const shape=bag.shift(),kinds=[];
  for(let index=0;index<4;index++)kinds.push(choose(index===3&&new Set(kinds.map(kind=>NOTE_KIND_BY_ID[kind].units)).size===1?NOTE_KIND_BY_ID[kinds[0]].units:undefined));
  return {shape,rotation:0,cells:SHAPE_CELLS[shape].map((cell,index)=>({...cell,kind:kinds[index]}))};
 }
 function fits(piece,row=piece.row,col=piece.col){
  return piece.cells.every(cell=>{const r=row+cell.row,c=col+cell.col;return r>=0&&r<ROWS&&c>=0&&c<COLUMNS&&board[r][c]===null;});
 }
 function gameOver(){phase='over';active=null;clearingMatches=[];emit('over',{score,level});changed();}
 function spawn(){
  if(board[0].some(kind=>kind!==null)){gameOver();return;}
  const width=1+Math.max(...next.cells.map(cell=>cell.col)),candidate={...next,id:++pieceId,row:0,col:Math.floor((COLUMNS-width)/2)};
  if(!fits(candidate)){gameOver();return;}
  active=candidate;next=makePiece();phase='falling';fallElapsed=0;phaseElapsed=0;chain=1;dropRuns=0;
  emit('spawn',{shape:active.shape,pieceId:active.id});changed();
 }
 function resolve(){
  clearingMatches=findMatches(board,boardOwners);active=null;phaseElapsed=0;
  if(clearingMatches.length){phase='clearing';changed();}
  else spawn();
 }
 function lock(){
  if(!fits(active)){gameOver();return;}
  const cells=absoluteCells(active);for(const {row,col,kind}of cells){board[row][col]=kind;boardOwners[row][col]=active.id;}
  emit('lock',{shape:active.shape,pieceId:active.id,cells});active=null;fallElapsed=0;chain=1;dropRuns=0;changed();resolve();
 }
 function down(){
  if(fits(active,active.row+1,active.col)){active.row++;changed();return true;}
  lock();return false;
 }
 function clearWave(){
  const patterns=copy(clearingMatches),unique=new Map();
  for(const pattern of patterns)for(const cell of pattern.cells)unique.set(cell.row*COLUMNS+cell.col,cell);
  for(const {row,col}of unique.values()){board[row][col]=null;boardOwners[row][col]=null;}
  const extraRunsAdded=patterns.length-(dropRuns===0?1:0),points=200*patterns.length*chain+100*extraRunsAdded;dropRuns+=patterns.length;
  score+=points;const previousLevel=level;level=1+Math.floor(score/1000);
  emit('clear',{patterns,points,chain,comboRuns:dropRuns,cells:[...unique.values()],score,level});lastClear=copy(events.at(-1));
  if(previousLevel!==level)emit('level',{level});
  const moves=gravity(board,boardOwners);if(moves.length)emit('gravity',{moves});
  clearingMatches=[];phase='settling';phaseElapsed=0;chain++;changed();
 }
 function getState(){return {board:board.map(row=>[...row]),boardOwners:boardOwners.map(row=>[...row]),phase,paused,active:copy(active),next:copy(next),score,level,fallIntervalMs:fallInterval(level),clearingMatches:copy(clearingMatches),lastClear:copy(lastClear),events:copy(events),revision};}
 function start(){
  board=seedBoard.map(row=>[...row]);boardOwners=seedOwners.map(row=>[...row]);phase='idle';paused=false;active=null;score=0;level=1;events=[];clearingMatches=[];lastClear=null;chain=1;dropRuns=0;fallElapsed=phaseElapsed=0;discardNextTick=false;bag=[];pieceId=Math.max(0,...seedOwners.flat().filter(owner=>typeof owner==='number'));
  next=makePiece();emit('start');changed();resolve();return getState();
 }
 function canMove(){return phase==='falling'&&!paused&&active!==null;}
 return {
  start,restart:start,getState,get state(){return getState();},get revision(){return revision;},
  move(dx){
   if(!canMove()||![1,-1].includes(dx))return false;
   const col=active.col+dx;if(!fits(active,active.row,col))return false;
   active.col=col;changed();return true;
  },
  rotate(direction=1){
   if(!canMove()||![1,-1].includes(direction))return false;
   const cells=rotatedCells(active.cells,direction),candidate={...active,cells,rotation:(active.rotation+direction+4)%4};
   // At most three columns or rows, enough for the four-square I's extents.
   const kicks=[[0,0],[-1,0],[1,0],[-2,0],[2,0],[-3,0],[3,0],[0,-1],[-1,-1],[1,-1],[0,-2],[-1,-2],[1,-2],[0,-3]];
   for(const [dx,dy]of kicks)if(fits(candidate,active.row+dy,active.col+dx)){active={...candidate,row:active.row+dy,col:active.col+dx};changed();return true;}
   return false;
  },
  softDrop(){if(!canMove())return false;fallElapsed=0;down();return true;},
  hardDrop(){
   if(!canMove())return 0;let distance=0;
   while(fits(active,active.row+1,active.col)){active.row++;distance++;}
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
