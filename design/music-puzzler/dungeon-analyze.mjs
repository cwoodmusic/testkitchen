/**
 * Exhaustive proof for authored physical doors and one-shot note sources.
 * No live game/profile writes. Regenerate with:
 *   node design/music-puzzler/dungeon-analyze.mjs [dungeon.json] [proof.json]
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {NOTE_KINDS} from '../../games/rhythm-blocks/engine.mjs';

const KINDS=NOTE_KINDS.map(({id,units})=>({id,units}));
const kindIndex=new Map(KINDS.map((kind,index)=>[kind.id,index]));
const blank=()=>Array(KINDS.length).fill(0);
const hash=value=>createHash('sha256').update(value).digest('hex');
const inventoryObject=stock=>Object.fromEntries(KINDS.map((kind,index)=>[kind.id,stock[index]]));
const mass=stock=>stock.reduce((total,count,index)=>total+count*KINDS[index].units,0);
const sum=stock=>stock.reduce((total,count)=>total+count,0);
const check=(condition,message)=>{if(!condition)throw Error(message);};
const validId=id=>typeof id==='string'&&id.trim().length>0;
const recipeCounts=(recipe,label)=>{
 check(Array.isArray(recipe)&&recipe.length>0,label+' must be a nonempty recipe');
 const stock=blank();
 for(const kind of recipe){check(kindIndex.has(kind),'Unknown note kind in '+label+': '+String(kind));stock[kindIndex.get(kind)]++;}
 return stock;
};
const affordable=(stock,cost)=>cost.every((count,index)=>stock[index]>=count);
const actionsCopy=actions=>actions.map(action=>({...action}));

export function compileDungeon(data){
 check(data&&typeof data==='object'&&data.version===1,'Dungeon version must be 1');
 check(Array.isArray(data.rooms)&&data.rooms.length>0,'Dungeon needs rooms');
 check(Array.isArray(data.terminals),'Dungeon terminals must be an array');
 const rooms=new Map(),terminals=new Map(),sources=new Map(),doors=new Map(),nodeIds=new Set();
 for(const room of data.rooms){
  check(room&&validId(room.id)&&!nodeIds.has(room.id),'Duplicate/invalid room ID: '+room?.id);nodeIds.add(room.id);
  check(typeof room.title==='string'&&room.title.trim(),'Room needs a title: '+room.id);
  check(Array.isArray(room.sources??[])&&Array.isArray(room.doors??[]),'Room sources/doors must be arrays: '+room.id);
  rooms.set(room.id,{...room,sources:room.sources??[],doors:room.doors??[]});
 }
 for(const terminal of data.terminals){
  check(terminal&&validId(terminal.id)&&!nodeIds.has(terminal.id),'Duplicate/invalid terminal ID: '+terminal?.id);nodeIds.add(terminal.id);
  check(typeof terminal.title==='string'&&terminal.title.trim(),'Terminal needs a title: '+terminal.id);
  check(['ending','secret-ending','dead-end'].includes(terminal.kind),'Invalid terminal kind: '+terminal.id);
  terminals.set(terminal.id,terminal);
 }
 check(rooms.has(data.entry),'Entry must name a room');
 const initial=blank(),initialObject=data.initialInventory??{};
 check(initialObject&&typeof initialObject==='object'&&!Array.isArray(initialObject),'Initial inventory must be an object');
 for(const [kind,count]of Object.entries(initialObject)){
  check(kindIndex.has(kind),'Unknown initial note kind: '+kind);
  check(Number.isSafeInteger(count)&&count>=0,'Invalid initial note count: '+kind);initial[kindIndex.get(kind)]=count;
 }
 for(const room of rooms.values())for(const source of room.sources){
  check(source&&validId(source.id)&&!sources.has(source.id),'Duplicate/invalid source ID: '+source?.id);
  check(['npc','chest','hidden'].includes(source.type),'Invalid source type: '+source.id);
  if(source.character!==undefined)check(typeof source.character==='string'&&source.character.trim(),'Invalid source character: '+source.id);
  const counts=recipeCounts(source.recipe,'source '+source.id),index=sources.size;
  sources.set(source.id,{...source,roomId:room.id,counts,index,bit:1n<<BigInt(index)});
 }
 for(const room of rooms.values())for(const door of room.doors){
  check(door&&validId(door.id)&&!doors.has(door.id),'Duplicate/invalid door ID: '+door?.id);
  check(nodeIds.has(door.to),'Unknown door destination: '+door.id);
  const counts=recipeCounts(door.recipe,'door '+door.id);check(mass(counts)===8,'Door must cost exactly four beats: '+door.id);
  if(door.revealAfter!==undefined)check(sources.get(door.revealAfter)?.roomId===room.id,'Door revealAfter must name a local source: '+door.id);
  doors.set(door.id,{...door,roomId:room.id,counts});
 }
 // A room DAG plus a strictly increasing claimed-source set makes every
 // action history finite, including every possible pickup order within a room.
 const indegree=new Map([...rooms.keys()].map(id=>[id,0]));
 for(const door of doors.values())if(rooms.has(door.to))indegree.set(door.to,indegree.get(door.to)+1);
 const queue=[...rooms.keys()].filter(id=>indegree.get(id)===0),topological=[];
 while(queue.length){const id=queue.shift();topological.push(id);for(const door of rooms.get(id).doors)if(rooms.has(door.to)){indegree.set(door.to,indegree.get(door.to)-1);if(indegree.get(door.to)===0)queue.push(door.to);}}
 check(topological.length===rooms.size,'Cycle in room graph; dungeon must be a finite DAG');
 // Every possible accumulated count must remain an exact safe integer.
 const totalSupply=initial.map((count,index)=>count+[...sources.values()].reduce((n,source)=>n+source.counts[index],0));
 check(totalSupply.every(Number.isSafeInteger)&&Number.isSafeInteger(mass(totalSupply)),'Inventory exceeds safe integer range');
 return{data,rooms,terminals,sources,doors,initial,topological};
}

function conservation(compiled,stock,claimed,spent){
 const earned=blank();for(const source of compiled.sources.values())if(claimed&source.bit)for(let index=0;index<earned.length;index++)earned[index]+=source.counts[index];
 for(let index=0;index<stock.length;index++)check(stock[index]>=0&&compiled.initial[index]+earned[index]-spent[index]===stock[index],'Per-note conservation failed: '+KINDS[index].id);
 return{valid:true,initial:inventoryObject(compiled.initial),claimed:inventoryObject(earned),spent:inventoryObject(spent),remaining:inventoryObject(stock)};
}
function replayCompiled(compiled,actions){
 check(Array.isArray(actions),'Dungeon actions must be an array');
 let nodeId=compiled.data.entry,inventory=[...compiled.initial],claimed=0n;const spent=blank(),hiddenGateSources=new Set(),trace=[];
 for(const rawAction of actions){
  check(compiled.rooms.has(nodeId),'Action after terminal: '+nodeId);
  check(rawAction&&typeof rawAction==='object','Invalid dungeon action');
  if(rawAction.roomId!==undefined)check(rawAction.roomId===nodeId,'Action room mismatch');
  const before=inventoryObject(inventory),from=nodeId;let recipe,action;
  if(rawAction.type==='claim'){
   const source=compiled.sources.get(rawAction.sourceId);check(source?.roomId===nodeId,'Source is not in current room: '+rawAction.sourceId);
   check(!(claimed&source.bit),'Source was already claimed: '+source.id);claimed|=source.bit;
   inventory=inventory.map((count,index)=>count+source.counts[index]);recipe=source.recipe;action={type:'claim',sourceId:source.id};
  }else if(rawAction.type==='door'){
   const door=compiled.doors.get(rawAction.doorId);check(door?.roomId===nodeId,'Door is not in current room: '+rawAction.doorId);
   check(!door.revealAfter||!!(claimed&compiled.sources.get(door.revealAfter).bit),'Door is not revealed: '+door.id);
   check(affordable(inventory,door.counts),'Door costs unavailable notes: '+door.id);
   inventory=inventory.map((count,index)=>count-door.counts[index]);for(let index=0;index<spent.length;index++)spent[index]+=door.counts[index];
   if(door.revealAfter&&compiled.sources.get(door.revealAfter).type==='hidden')hiddenGateSources.add(door.revealAfter);
   nodeId=door.to;recipe=door.recipe;action={type:'door',doorId:door.id};
  }else throw Error('Unknown dungeon action type: '+rawAction.type);
  trace.push({roomId:from,action,recipe:[...recipe],to:nodeId,inventoryBefore:before,inventoryAfter:inventoryObject(inventory),conservation:conservation(compiled,inventory,claimed,spent)});
 }
 return{nodeId,terminal:compiled.terminals.has(nodeId)?nodeId:null,actions:trace.map(step=>step.action),inventory:inventoryObject(inventory),claimedSources:[...compiled.sources.values()].filter(source=>claimed&source.bit).map(source=>source.id),hiddenGateSources:[...hiddenGateSources],trace,conservation:conservation(compiled,inventory,claimed,spent)};
}
export function replayDungeon(data,actions){return replayCompiled(compileDungeon(data),actions);}

export function analyzeDungeon(data,{sourceSHA256=null,maxStates=1_000_000}={}){
 const c=compileDungeon(data);check(Number.isSafeInteger(maxStates)&&maxStates>0,'Invalid state limit');
 const states=[],all=new Map(),roomLayers=new Map([...c.rooms.keys()].map(id=>[id,Array.from({length:c.sources.size+1},()=>new Map())])),terminalStates=new Map();
 const sourceStats=new Map(),doorStats=new Map();let transitions=0;
 const key=state=>JSON.stringify([state.nodeId,state.inventory,state.claimed.toString()]);
 const first={id:0,nodeId:data.entry,inventory:[...c.initial],claimed:0n,claimedCount:0,paths:1n,hiddenGatedPaths:0n,parent:null,via:null,ungatedParent:null,successors:[]};
 states.push(first);all.set(key(first),first);roomLayers.get(data.entry)[0].set(key(first),first);
 function remember(destination,parent,action,hiddenGate=false){
  const token=key(destination);let next=all.get(token);
  if(!next){check(states.length<maxStates,'Dungeon state limit exceeded; no complete proof was produced');next={...destination,id:states.length,paths:0n,hiddenGatedPaths:0n,parent:parent.id,via:{...action},ungatedParent:undefined,successors:[]};states.push(next);all.set(token,next);if(c.rooms.has(next.nodeId))roomLayers.get(next.nodeId)[next.claimedCount].set(token,next);else terminalStates.set(token,next);}
  next.paths+=parent.paths;const gated=hiddenGate?parent.paths:parent.hiddenGatedPaths;next.hiddenGatedPaths+=gated;
  if(parent.paths>gated&&next.ungatedParent===undefined)next.ungatedParent={parent:parent.id,action:{...action}};
  parent.successors.push(next.id);transitions++;return next;
 }
 function record(map,id,state,action){let stat=map.get(id);if(!stat){stat={transitions:0,paths:0n,parent:state.id,action:{...action}};map.set(id,stat);}stat.transitions++;stat.paths+=state.paths;}
 const liveOrder=[];
 for(const roomId of c.topological)for(const layer of roomLayers.get(roomId))for(const state of layer.values()){
  liveOrder.push(state.id);const room=c.rooms.get(roomId);
  for(const authored of room.sources){const source=c.sources.get(authored.id);if(state.claimed&source.bit)continue;const action={type:'claim',sourceId:source.id};record(sourceStats,source.id,state,action);remember({nodeId:roomId,inventory:state.inventory.map((count,index)=>count+source.counts[index]),claimed:state.claimed|source.bit,claimedCount:state.claimedCount+1},state,action);}
  for(const authored of room.doors){const door=c.doors.get(authored.id);if(door.revealAfter&&!(state.claimed&c.sources.get(door.revealAfter).bit))continue;if(!affordable(state.inventory,door.counts))continue;const action={type:'door',doorId:door.id};record(doorStats,door.id,state,action);remember({nodeId:door.to,inventory:state.inventory.map((count,index)=>count-door.counts[index]),claimed:state.claimed,claimedCount:state.claimedCount},state,action,!!door.revealAfter&&c.sources.get(door.revealAfter).type==='hidden');}
 }
 function actionsFor(id,{ungated=false}={}){
  const trail=[];let state=states[id];
  while(state.parent!==null){if(ungated){check(state.ungatedParent!==undefined,'No ungated witness for state');trail.push(state.ungatedParent.action);state=states[state.ungatedParent.parent];}else{trail.push(state.via);state=states[state.parent];}}
  return actionsCopy(trail.reverse());
 }
 function witnessFor(id,{extra=null,ungated=false}={}){const actions=actionsFor(id,{ungated});if(extra)actions.push({...extra});const replay=replayCompiled(c,actions);return{nodeId:replay.nodeId,actions,inventory:replay.inventory,claimedSources:replay.claimedSources,hiddenGateSources:replay.hiddenGateSources,conservation:replay.conservation};}
 const terminalList=[...terminalStates.values()],balanceViolations=terminalList.filter(state=>c.terminals.get(state.nodeId).kind!=='dead-end'&&state.inventory.some(count=>count!==0));
 const canReachZeroEnding=new Uint8Array(states.length);
 for(const state of terminalList)if(c.terminals.get(state.nodeId).kind!=='dead-end'&&state.inventory.every(count=>count===0))canReachZeroEnding[state.id]=1;
 for(const id of [...liveOrder].reverse())if(states[id].successors.some(next=>canReachZeroEnding[next]))canReachZeroEnding[id]=1;
 const softlocks=liveOrder.filter(id=>states[id].successors.length===0),forcedDead=liveOrder.filter(id=>!canReachZeroEnding[id]);
 const stateFinding=id=>({stateId:id,nodeId:states[id].nodeId,inventory:inventoryObject(states[id].inventory),claimedSources:[...c.sources.values()].filter(source=>states[id].claimed&source.bit).map(source=>source.id),witness:witnessFor(id)});
 const sources=[...c.sources.values()].map(source=>{const stat=sourceStats.get(source.id);return{id:source.id,roomId:source.roomId,type:source.type,character:source.character??null,recipe:[...source.recipe],reachable:!!stat,transitions:stat?.transitions??0,orderedHistories:stat?.paths.toString()??'0',witness:stat?witnessFor(stat.parent,{extra:stat.action}):null};});
 const doors=[...c.doors.values()].map(door=>{const stat=doorStats.get(door.id);return{id:door.id,roomId:door.roomId,to:door.to,recipe:[...door.recipe],revealAfter:door.revealAfter??null,reachable:!!stat,transitions:stat?.transitions??0,orderedHistories:stat?.paths.toString()??'0',witness:stat?witnessFor(stat.parent,{extra:stat.action}):null};});
 const terminals=[...c.terminals.values()].map(terminal=>{const reached=terminalList.filter(state=>state.nodeId===terminal.id),paths=reached.reduce((n,state)=>n+state.paths,0n);return{id:terminal.id,title:terminal.title,kind:terminal.kind,reachable:reached.length>0,distinctFinalStates:reached.length,orderedHistories:paths.toString(),zeroBalanceStates:reached.filter(state=>state.inventory.every(count=>count===0)).length,remainingTiles:reached.length?{min:Math.min(...reached.map(state=>sum(state.inventory))),max:Math.max(...reached.map(state=>sum(state.inventory)))}:null,remainingHalfBeatUnits:reached.length?{min:Math.min(...reached.map(state=>mass(state.inventory))),max:Math.max(...reached.map(state=>mass(state.inventory)))}:null,remainingByKind:reached.length?Object.fromEntries(KINDS.map((kind,index)=>[kind.id,{min:Math.min(...reached.map(state=>state.inventory[index])),max:Math.max(...reached.map(state=>state.inventory[index]))}])):null,witness:reached.length?witnessFor(reached[0].id):null};});
 const secretProofs=[...c.terminals.values()].filter(terminal=>terminal.kind==='secret-ending').map(terminal=>{const reached=terminalList.filter(state=>state.nodeId===terminal.id),paths=reached.reduce((n,state)=>n+state.paths,0n),gated=reached.reduce((n,state)=>n+state.hiddenGatedPaths,0n),bad=reached.find(state=>state.paths>state.hiddenGatedPaths);return{terminalId:terminal.id,reachable:reached.length>0,allPathsRequireHiddenClaimAndGate:paths>0n&&paths===gated,orderedHistories:paths.toString(),hiddenGatedHistories:gated.toString(),witness:reached.length?witnessFor(reached[0].id):null,ungatedWitness:bad?witnessFor(bad.id,{ungated:true}):null};});
 const reachableRooms=new Set(liveOrder.map(id=>states[id].nodeId)),coverage={unreachableRooms:[...c.rooms.keys()].filter(id=>!reachableRooms.has(id)),unreachableSources:sources.filter(source=>!source.reachable).map(source=>source.id),unreachableDoors:doors.filter(door=>!door.reachable).map(door=>door.id),unreachableTerminals:terminals.filter(terminal=>!terminal.reachable).map(terminal=>terminal.id)};
 const passed=!balanceViolations.length&&!softlocks.length&&!forcedDead.length&&Object.values(coverage).every(items=>!items.length)&&secretProofs.every(proof=>proof.allPathsRequireHiddenClaimAndGate);
 return{version:1,passed,sourceSHA256:sourceSHA256??hash(JSON.stringify(data)),verifierSHA256:hash(readFileSync(fileURLToPath(import.meta.url))),kindCatalog:KINDS,kindCatalogSHA256:hash(JSON.stringify(KINDS)),graph:{rooms:c.rooms.size,sources:c.sources.size,doors:c.doors.size,terminals:c.terminals.size,reachableStates:states.length,liveStates:liveOrder.length,terminalStates:terminalList.length,transitions,orderedTerminalHistories:terminalList.reduce((n,state)=>n+state.paths,0n).toString()},invariants:{finiteRoomDAG:true,allDoorCostsHalfBeatUnits:8,oneShotSources:true,noAutomaticEntryGrants:true,nonnegativeInventories:true,typedConservation:true,continuationTarget:'A declared non-dead terminal with zero of every note kind.'},coverage,balances:{successfulTerminalStates:terminalList.filter(state=>c.terminals.get(state.nodeId).kind!=='dead-end').length,violationCount:balanceViolations.length,violations:balanceViolations.map(state=>stateFinding(state.id))},softlocks:{count:softlocks.length,states:softlocks.map(stateFinding)},forcedDeadEndStates:{count:forcedDead.length,states:forcedDead.map(stateFinding)},sources,doors,terminals,secretProofs};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const input=process.argv[2]?resolve(process.argv[2]):fileURLToPath(new URL('./dungeon.json',import.meta.url));
 const output=process.argv[3]?resolve(process.argv[3]):fileURLToPath(new URL('./dungeon-verification.json',import.meta.url));
 const raw=readFileSync(input),report=analyzeDungeon(JSON.parse(raw),{sourceSHA256:hash(raw)});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,states:report.graph.reachableStates,transitions:report.graph.transitions,terminalHistories:report.graph.orderedTerminalHistories,balanceViolations:report.balances.violationCount,softlocks:report.softlocks.count,forcedDead:report.forcedDeadEndStates.count,coverage:report.coverage,output}));
 if(!report.passed)process.exitCode=1;
}
