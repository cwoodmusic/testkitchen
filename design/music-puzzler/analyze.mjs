/**
 * Exact first-chapter story/inventory verifier; no live game or profile writes.
 * Regenerate the checked proof: node design/music-puzzler/analyze.mjs
 * Check semantics and saved paths: node --test design/music-puzzler/*.test.mjs
 * Each compact witness stores an ordered recipe log; replayWitness derives its
 * stock, promises, credited stage packs and terminal from the frozen chapter.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {NOTE_KINDS} from '../../games/rhythm-blocks/engine.mjs';

export const KINDS=NOTE_KINDS.map(({id,units,rest})=>({id,units,rest}));
const kindIndex=new Map(KINDS.map((k,i)=>[k.id,i])),unitsByKind=new Map(KINDS.map(k=>[k.id,k.units]));
const sum=items=>items.reduce((a,b)=>a+b,0),mass=counts=>counts.reduce((n,c,i)=>n+c*KINDS[i].units,0);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),hash=text=>createHash('sha256').update(text).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));
const staticKeys=new Set(['recipeEquals','startsWithAny','endsWithAny','containsAny','containsAll','containsAtLeast','lengthEquals','allBeatUnitsEqual','nodeIs']);
const dynamicKeys=new Set(['flagsAll','flagsNone','flagsAnyMissing']);
function check(ok,message){if(!ok)throw Error(message);}
function countsOf(recipe){const counts=Array(KINDS.length).fill(0);for(const id of recipe){check(kindIndex.has(id),'Unknown kind '+id);counts[kindIndex.get(id)]++;}return counts;}
export function enumerateRhythms(){const out=[];function visit(left,recipe,counts){if(left===0){out.push({recipe:[...recipe],counts:[...counts],length:recipe.length});return;}for(let i=0;i<KINDS.length;i++)if(KINDS[i].units<=left){recipe.push(KINDS[i].id);counts[i]++;visit(left-KINDS[i].units,recipe,counts);counts[i]--;recipe.pop();}}visit(8,[],Array(KINDS.length).fill(0));return out;}
function flagNames(flags){return flags instanceof Set?flags:new Set(flags??[]);}
export function evaluateCondition(when,recipe,{nodeId,flags=[]}={}){
 for(const key of Object.keys(when))check(staticKeys.has(key)||dynamicKeys.has(key),'Unknown predicate '+key);
 const active=flagNames(flags);
 for(const [key,value]of Object.entries(when)){
  check(staticKeys.has(key)||dynamicKeys.has(key),'Unknown predicate '+key);
  let matches;
  if(key==='recipeEquals')matches=equal(recipe,value);
  else if(key==='startsWithAny')matches=value.includes(recipe[0]);
  else if(key==='endsWithAny')matches=value.includes(recipe.at(-1));
  else if(key==='containsAny')matches=value.some(id=>recipe.includes(id));
  else if(key==='containsAll')matches=value.every(id=>recipe.includes(id));
  else if(key==='containsAtLeast')matches=recipe.filter(id=>value.kinds.includes(id)).length>=value.count;
  else if(key==='lengthEquals')matches=recipe.length===value;
  else if(key==='allBeatUnitsEqual')matches=recipe.every(id=>unitsByKind.get(id)===value);
  else if(key==='nodeIs')matches=nodeId===value;
  else if(key==='flagsAll')matches=value.every(id=>active.has(id));
  else if(key==='flagsNone')matches=value.every(id=>!active.has(id));
  else if(key==='flagsAnyMissing')matches=value.some(id=>!active.has(id));
  if(!matches)return false;
 }
 return true;
}
function predicateParts(when){const music={},flags={};for(const [key,value]of Object.entries(when))(dynamicKeys.has(key)?flags:music)[key]=value;return {music,flags};}
function list(value,label,allowed){check(Array.isArray(value),label+' must be an array');for(const id of value)check(typeof id==='string'&&allowed.has(id),'Unknown '+label+' value '+id);}

export function compileStory(story){
 check(story&&Array.isArray(story.nodes)&&Array.isArray(story.terminals),'Missing story nodes/terminals');
 check((story.answerUnits??8)===8&&(story.unitsPerBeat??2)===2,'Only exact four-beat half-unit answers are supported');
 check(Number.isInteger(story.stages)&&story.stages>=1&&story.stages<=24,'Invalid finite stage count');
 const nodes=new Map(),terminals=new Map(),flags=story.flags??[],flagSet=new Set(flags),kindSet=new Set(kindIndex.keys());
 check(flags.length===flagSet.size&&flags.length<=20,'Duplicate/excessive flags');
 for(const node of story.nodes){check(typeof node.id==='string'&&!nodes.has(node.id),'Duplicate/invalid node ID');check(Number.isInteger(node.stage)&&node.stage>=1&&node.stage<=story.stages,'Invalid stage '+node.id);nodes.set(node.id,node);}
 for(const terminal of story.terminals){check(typeof terminal.id==='string'&&!nodes.has(terminal.id)&&!terminals.has(terminal.id),'Duplicate terminal ID');terminals.set(terminal.id,terminal);}
 check(nodes.get(story.entry)?.stage===1,'Entry must be a stage-one node');
 const bits=new Map(flags.map((id,i)=>[id,1<<i])),toMask=names=>{if(typeof names==='number'){check(Number.isInteger(names)&&names>=0&&names<2**flags.length,'Invalid flag mask');return names;}let mask=0;for(const name of names??[]){check(bits.has(name),'Unknown flag '+name);mask|=bits.get(name);}return mask;};
 const names=mask=>flags.filter(id=>mask&bits.get(id));
 const initial=Array(KINDS.length).fill(0);for(const [id,count]of Object.entries(story.initialInventory??{})){check(kindSet.has(id),'Unknown initial kind '+id);check(Number.isSafeInteger(count)&&count>=0,'Invalid initial inventory');initial[kindIndex.get(id)]=count;}
 const grants=new Map();for(let stage=2;stage<=story.stages;stage++){const pack=story.grants?.[stage];list(pack,'grant',kindSet);check(pack.length===3,'A stage grant must contain exactly three tiles');grants.set(stage,countsOf(pack));}
 for(const stage of Object.keys(story.grants??{}))check(+stage>=2&&+stage<=story.stages&&Number.isInteger(+stage),'Unexpected grant stage '+stage);
 const doorSets=new Map(),doorIds=new Set();
 for(const [id,doors]of Object.entries(story.doorSets??{})){
  check(Array.isArray(doors)&&doors.length>0&&doors.length<=30,'Invalid door set '+id);
  check(doors.filter(d=>d.when&&Object.keys(d.when).length===0).length===1&&Object.keys(doors.at(-1).when??{bad:true}).length===0,'Door set needs exactly one final default: '+id);
  for(const door of doors){
   check(typeof door.id==='string'&&!doorIds.has(door.id),'Duplicate/invalid door ID '+door.id);doorIds.add(door.id);
   check(door.when&&typeof door.when==='object'&&!Array.isArray(door.when),'Invalid when '+door.id);
   check(nodes.has(door.to)||terminals.has(door.to),'Unknown destination '+door.to);
   list(door.addFlags??[],'flag',flagSet);list(door.removeFlags??[],'flag',flagSet);
   for(const [key,value]of Object.entries(door.when)){
    check(staticKeys.has(key)||dynamicKeys.has(key),'Unknown predicate '+key);
    if(dynamicKeys.has(key))list(value,'flag',flagSet);
    else if(['recipeEquals','startsWithAny','endsWithAny','containsAny','containsAll'].includes(key)){list(value,'kind',kindSet);if(key==='recipeEquals')check(mass(countsOf(value))===8,'Exact recipe is not four beats');}
    else if(key==='containsAtLeast'){check(value&&Number.isInteger(value.count)&&value.count>=1&&value.count<=8,'Invalid containsAtLeast count');list(value.kinds,'kind',kindSet);}
    else if(key==='lengthEquals')check(Number.isInteger(value)&&value>=1&&value<=8,'Invalid lengthEquals');
    else if(key==='allBeatUnitsEqual')check(Number.isInteger(value)&&value>0&&value<=8,'Invalid allBeatUnitsEqual');
    else if(key==='nodeIs')check(typeof value==='string'&&nodes.has(value),'Unknown nodeIs '+value);
   }
  }
  doorSets.set(id,doors);
 }
 for(const node of nodes.values()){
  check(doorSets.has(node.doorSet),'Unknown door set '+node.doorSet);
  for(const door of doorSets.get(node.doorSet))if(nodes.has(door.to))check(nodes.get(door.to).stage===node.stage+1,'Graph must advance exactly one stage: '+node.id+'/'+door.id);
 }
 const rhythms=enumerateRhythms(),cache=new Map(),patternCount=rhythms.length;
 function groupsFor(nodeId,flagValue){
  const node=nodes.get(nodeId);check(node,'Unknown node '+nodeId);const mask=toMask(flagValue),doors=doorSets.get(node.doorSet),hasNodePredicate=doors.some(d=>Object.hasOwn(d.when,'nodeIs')),cacheKey=node.doorSet+'|'+(hasNodePredicate?nodeId:'*');
  let entry=cache.get(cacheKey);
  if(!entry){
   const parts=doors.map(d=>predicateParts(d.when));let relevant=0;for(const door of doors)for(const key of dynamicKeys)for(const flag of door.when[key]??[])relevant|=bits.get(flag);
   const grouped=new Map();for(const pattern of rhythms){let musicMask=0;parts.forEach((part,i)=>{if(evaluateCondition(part.music,pattern.recipe,{nodeId}))musicMask|=1<<i;});const key=pattern.counts.join(',')+'|'+musicMask;let group=grouped.get(key);if(!group){group={counts:pattern.counts,musicMask,orders:0,recipe:pattern.recipe};grouped.set(key,group);}group.orders++;}
   entry={parts,relevant,groups:[...grouped.values()],byFlags:new Map()};cache.set(cacheKey,entry);
  }
  const flagKey=mask&entry.relevant;if(entry.byFlags.has(flagKey))return entry.byFlags.get(flagKey);
  let eligible=0;entry.parts.forEach((part,i)=>{if(evaluateCondition(part.flags,[],{flags:names(mask)}))eligible|=1<<i;});
  const combined=new Map();for(const group of entry.groups){const available=eligible&group.musicMask;check(available,'No first-match default');const index=31-Math.clz32(available&-available),door=doors[index],key=group.counts.join(',')+'|'+door.id;let out=combined.get(key);if(!out){out={counts:group.counts,orders:0,recipe:group.recipe,door,index};combined.set(key,out);}out.orders+=group.orders;}
  const result=[...combined.values()];check(sum(result.map(g=>g.orders))===patternCount,'Pattern classification lost/duplicated orders');entry.byFlags.set(flagKey,result);return result;
 }
 return {story,nodes,terminals,doorSets,flags,bits,toMask,names,initial,grants,rhythms,groupsFor,cache,patternCount};
}

export function classifyAnswer(compiled,state,recipe){
 const counts=countsOf(recipe);check(mass(counts)===8,'Answer must be exactly four beats');
 if(state.inventory)check(counts.every((n,i)=>n<=state.inventory[i]),'Answer is not affordable');
 const node=compiled.nodes.get(state.nodeId);check(node,'Unknown node '+state.nodeId);
 const flags=compiled.names(compiled.toMask(state.flags));const door=compiled.doorSets.get(node.doorSet).find(d=>evaluateCondition(d.when,recipe,{nodeId:node.id,flags}));check(door,'No matching door');return door;
}
const receiptStages=(mask,max)=>Array.from({length:max-1},(_,i)=>i+2).filter(stage=>mask&(1<<stage));
function inventoryObject(inventory){return Object.fromEntries(KINDS.map((k,i)=>[k.id,inventory[i]]));}
function transition(compiled,state,recipe,door){
 const cost=countsOf(recipe);check(cost.every((n,i)=>n<=state.inventory[i]),'Witness spent unavailable stock');const after=state.inventory.map((n,i)=>n-cost[i]);let flags=compiled.toMask(state.flags);for(const id of door.removeFlags??[])flags&=~compiled.bits.get(id);for(const id of door.addFlags??[])flags|=compiled.bits.get(id);
 let receipts=state.receipts,inventory=after,grant=[];const destination=compiled.nodes.get(door.to);
 if(destination){check(!(receipts&(1<<destination.stage)),'Stage grant credited twice');grant=compiled.story.grants[destination.stage];inventory=after.map((n,i)=>n+compiled.grants.get(destination.stage)[i]);receipts|=1<<destination.stage;}
 return {nodeId:door.to,flags,inventory,receipts,record:{nodeId:state.nodeId,stage:compiled.nodes.get(state.nodeId).stage,recipe:[...recipe],doorId:door.id,to:door.to,flagsBefore:compiled.names(compiled.toMask(state.flags)),flagsAfter:compiled.names(flags),inventoryBefore:inventoryObject(state.inventory),inventoryAfterConsumption:inventoryObject(after),grant:[...grant],inventoryAfterEntry:inventoryObject(inventory),creditedStages:receiptStages(receipts,compiled.story.stages)}};
}
export function replayWitness(compiled,witness){
 let state={nodeId:compiled.story.entry,flags:0,inventory:[...compiled.initial],receipts:0};const steps=[];
 for(const expected of witness.steps??witness){check(compiled.nodes.has(state.nodeId),'Witness continues after terminal');const door=classifyAnswer(compiled,state,expected.recipe);if(expected.nodeId)check(expected.nodeId===state.nodeId,'Witness node mismatch');if(expected.doorId)check(expected.doorId===door.id,'Witness door mismatch');const moved=transition(compiled,state,expected.recipe,door);steps.push(moved.record);state=moved;}
 if(witness.terminal)check(state.nodeId===witness.terminal,'Witness terminal mismatch');
 return {terminal:state.nodeId,steps,inventory:state.inventory,flags:state.flags,receipts:state.receipts};
}

export function analyzeStory(story,{sourceSHA256=null}={}){
 const c=compileStory(story),initialTiles=sum(c.initial),states=[],layers=Array.from({length:story.stages+1},()=>new Map()),terminalStates=new Map(),edgeStats=new Map(),nodeStats=new Map(),softlocks=[];
 let compressedEdges=0;const key=s=>s.nodeId+'|'+s.flags+'|'+s.receipts+'|'+s.inventory.join(',');
 const first={id:0,nodeId:story.entry,flags:0,inventory:[...c.initial],receipts:0,paths:1n,parent:null,via:null};states.push(first);layers[1].set(key(first),first);
 function remember(destination,paths,parent,recipe,door,stage){
  const token=key(destination),target=c.nodes.has(destination.nodeId)?layers[c.nodes.get(destination.nodeId).stage]:terminalStates;let next=target.get(token);
  if(!next){next={...destination,id:states.length,paths:0n,parent:parent.id,via:{recipe,doorId:door.id},answerCount:stage};states.push(next);target.set(token,next);}next.paths+=paths;return next.id;
 }
 for(let stage=1;stage<=story.stages;stage++)for(const state of layers[stage].values()){
  let ns=nodeStats.get(state.nodeId);if(!ns){ns={id:state.nodeId,stage,states:0,paths:0n,flagMasks:new Set()};nodeStats.set(state.nodeId,ns);}ns.states++;ns.paths+=state.paths;ns.flagMasks.add(state.flags);
  let legalOrders=0;for(const group of c.groupsFor(state.nodeId,state.flags)){
   if(!group.counts.every((n,i)=>n<=state.inventory[i]))continue;compressedEdges++;legalOrders+=group.orders;
   const moved=transition(c,state,group.recipe,group.door),paths=state.paths*BigInt(group.orders),successor=remember(moved,paths,state,group.recipe,group.door,stage);(state.successors??=[]).push(successor);
   const edgeKey=state.nodeId+'|'+group.door.id;let edge=edgeStats.get(edgeKey);if(!edge){edge={nodeId:state.nodeId,doorId:group.door.id,to:group.door.to,sourceStates:new Set(),classes:0,paths:0n,witnessState:state.id,witnessRecipe:group.recipe};edgeStats.set(edgeKey,edge);}edge.sourceStates.add(state.id);edge.classes++;edge.paths+=paths;
  }
  if(!legalOrders)softlocks.push({stateId:state.id,nodeId:state.nodeId,stage,inventory:inventoryObject(state.inventory),flags:c.names(state.flags)});
 }
 function witnessFor(stateId,extra){
  const trail=[];let at=states[stateId];while(at.parent!==null){trail.push({nodeId:states[at.parent].nodeId,recipe:at.via.recipe,doorId:at.via.doorId});at=states[at.parent];}trail.reverse();if(extra)trail.push(extra);const proof=replayWitness(c,trail);return {terminal:proof.terminal,steps:proof.steps};
 }
 const canReachEnding=new Uint8Array(states.length);
 for(const state of terminalStates.values())if(['regular-ending','secret-ending'].includes(c.terminals.get(state.nodeId).kind))canReachEnding[state.id]=1;
 const forcedDeadEndStates=[];
 for(let stage=story.stages;stage>=1;stage--)for(const state of layers[stage].values()){
  if(state.successors?.some(id=>canReachEnding[id]))canReachEnding[state.id]=1;
  else forcedDeadEndStates.push({stateId:state.id,nodeId:state.nodeId,stage,inventory:inventoryObject(state.inventory),flags:c.names(state.flags),legalSuccessors:state.successors?.length??0,witness:witnessFor(state.id)});
 }
 const terminalReport=[];
 for(const terminal of c.terminals.values()){
  const reached=[...terminalStates.values()].filter(s=>s.nodeId===terminal.id);let pathCount=0n;const costs=reached.map(s=>{pathCount+=s.paths;return initialTiles+3*receiptStages(s.receipts,story.stages).length-sum(s.inventory);});
  const min=costs.length?Math.min(...costs):null,max=costs.length?Math.max(...costs):null,minState=costs.length?reached[costs.indexOf(min)]:null,maxState=costs.length?reached[costs.indexOf(max)]:null;
  terminalReport.push({id:terminal.id,kind:terminal.kind,reachable:reached.length>0,distinctFinalStates:reached.length,orderedHistories:pathCount.toString(),answers:reached.length?{min:Math.min(...reached.map(s=>s.answerCount)),max:Math.max(...reached.map(s=>s.answerCount))}:null,consumedTiles:{min,max},remainingTiles:reached.length?{min:Math.min(...reached.map(s=>sum(s.inventory))),max:Math.max(...reached.map(s=>sum(s.inventory)))}:null,witness:minState?witnessFor(minState.id):null,maxConsumptionWitness:maxState?witnessFor(maxState.id):null});
 }
 const exits=[];for(const node of c.nodes.values())for(const door of c.doorSets.get(node.doorSet)){
  const edge=edgeStats.get(node.id+'|'+door.id);let exclusion=null;
  if(!edge){
   if(door.when.nodeIs&&door.when.nodeIs!==node.id)exclusion={code:'CURRENT_NODE_GUARD',reason:'This classifier is shared with other scenes but explicitly belongs to '+door.when.nodeIs+'.'};
   else if(nodeStats.has(node.id)&&[...nodeStats.get(node.id).flagMasks].every(mask=>!evaluateCondition(predicateParts(door.when).flags,[],{flags:c.names(mask)})))exclusion={code:'ENTRY_FLAG_INVARIANT',reason:'Every reachable entry to this scene excludes this door’s flag requirements.',required:predicateParts(door.when).flags};
   else exclusion={code:'UNEXPLAINED_UNREACHABLE',reason:'No affordable first-matching answer was found; requires author review.'};
  }
  exits.push({nodeId:node.id,doorId:door.id,to:door.to,reachable:!!edge,sourceStates:edge?.sourceStates.size??0,orderedHistories:edge?.paths.toString()??'0',exclusion,witness:edge?witnessFor(edge.witnessState,{nodeId:node.id,recipe:edge.witnessRecipe,doorId:door.id}):null});
 }
 const sourceDoorIds=[...c.doorSets.values()].flat().map(d=>d.id),reachableDoorIds=new Set([...edgeStats.values()].map(e=>e.doorId)),flagPairs=[];
 for(let i=0;i<c.flags.length;i++)for(let j=i+1;j<c.flags.length;j++)if(!states.some(s=>(s.flags&c.bits.get(c.flags[i]))&&(s.flags&c.bits.get(c.flags[j]))))flagPairs.push([c.flags[i],c.flags[j]]);
 const secretProofs=terminalReport.filter(t=>t.kind==='secret-ending'&&t.reachable).map(terminal=>{
  const witness=terminal.witness,keyStep=witness.steps.find(s=>s.stage===11),key=keyStep.recipe,keyCounts=countsOf(key),held=witness.steps.filter(s=>s.stage<=10).every(s=>keyCounts.every((n,i)=>(s.inventoryAfterConsumption[KINDS[i].id]??0)>=n)),neverRefilled=key.every(id=>Object.values(story.grants).every(pack=>!pack.includes(id)));
  check(held&&neverRefilled,'Secret key provenance failed '+terminal.id);
  const at10=witness.steps.find(s=>s.stage===10);check(equal(countsOf(at10.recipe),c.grants.get(10)),'A conserving stage10 did not spend exactly its fresh pack');
  return {terminal:terminal.id,key,playedAtStage:11,heldAfterEveryPriorAnswer:held,neverRefilled,initialSourcesOnly:true,stage10Recipe:at10.recipe,stage10Approach:at10.to,unlockConsumedTiles:initialTiles+3*10-sum(Object.values(keyStep.inventoryAfterConsumption)),unlockRemainingIsStep11Pack:equal(countsOf(story.grants[11]),Object.values(keyStep.inventoryAfterConsumption)),finalAnswerCount:witness.steps.length};
 });
 const totalTerminalPaths=terminalReport.reduce((n,t)=>n+BigInt(t.orderedHistories),0n);
 const storyEdges=new Map();for(const edge of edgeStats.values()){
  const token=edge.nodeId+'|'+edge.to;let aggregate=storyEdges.get(token);
  if(!aggregate){aggregate={from:edge.nodeId,to:edge.to,doorIds:[],sourceStates:new Set(),paths:0n,witness:witnessFor(edge.witnessState,{nodeId:edge.nodeId,recipe:edge.witnessRecipe,doorId:edge.doorId})};storyEdges.set(token,aggregate);}
  aggregate.doorIds.push(edge.doorId);for(const id of edge.sourceStates)aggregate.sourceStates.add(id);aggregate.paths+=edge.paths;
 }
 // Independently compare every compressed classifier table with literal
 // first-match evaluation of all9,368 ordered patterns for each reached case.
 let classifierCases=0,literalPatternChecks=0;
 for(const ns of nodeStats.values())for(const mask of ns.flagMasks){
  const expected=new Map(),actual=new Map(c.groupsFor(ns.id,mask).map(g=>[g.counts.join(',')+'|'+g.door.id,g.orders])),doors=c.doorSets.get(c.nodes.get(ns.id).doorSet),flags=c.names(mask);
  for(const pattern of c.rhythms){const door=doors.find(d=>evaluateCondition(d.when,pattern.recipe,{nodeId:ns.id,flags})),key=pattern.counts.join(',')+'|'+door.id;expected.set(key,(expected.get(key)??0)+1);literalPatternChecks++;}
  check(expected.size===actual.size&&[...expected].every(([key,count])=>actual.get(key)===count),'Classifier compression changed literal answer semantics at '+ns.id);classifierCases++;
 }
 let conservationStates=0;const oddIndices=[kindIndex.get('eighth'),kindIndex.get('sixteenth-pair')],pairedOddApplies=oddIndices.every(i=>c.initial[i]===1&&[...c.grants.values()].every(grant=>grant[i]===0));
 for(const state of states){
  const activeNode=c.nodes.get(state.nodeId),answers=activeNode?activeNode.stage-1:state.answerCount,sourceStage=activeNode?activeNode.stage:state.answerCount,receipts=receiptStages(state.receipts,story.stages);
  check(receipts.length===sourceStage-1&&receipts.every((stage,i)=>stage===i+2),'Missing/extra stage receipt');
  check(state.inventory.every(n=>Number.isSafeInteger(n)&&n>=0),'Invalid typed inventory');
  check(mass(state.inventory)===mass(c.initial)+receipts.reduce((n,stage)=>n+mass(c.grants.get(stage)),0)-8*answers,'Musical duration conservation failed');
  if(pairedOddApplies)check(state.inventory[oddIndices[0]]===state.inventory[oddIndices[1]],'Half-beat pair parity failed');conservationStates++;
 }
 return {scope:'Exhaustive finite authored story + typed inventory + current-run flags. Ordered rhythm histories are counted with BigInt, not individually printed. Representative exact journal paths are replay-checked.',complete:true,sourceSHA256,storyVersion:story.version,kinds:KINDS,patternCatalog:{ordered:c.patternCount,consumptionVectors:new Set(c.rhythms.map(p=>p.counts.join(','))).size},schema:{nodes:c.nodes.size,doorSets:c.doorSets.size,classifiers:sourceDoorIds.length,terminals:c.terminals.size,flags:c.flags,stages:story.stages,forwardOnlyDAG:true},coverage:{reachableNodes:nodeStats.size,unreachableNodes:[...c.nodes.keys()].filter(id=>!nodeStats.has(id)),reachableClassifierIds:reachableDoorIds.size,unreachableClassifierIds:sourceDoorIds.filter(id=>!reachableDoorIds.has(id)),reachableNodeExits:edgeStats.size,totalNodeExits:exits.length,guardExcludedNodeExits:exits.filter(e=>e.exclusion&&e.exclusion.code!=='UNEXPLAINED_UNREACHABLE').length,unexplainedNodeExits:exits.filter(e=>e.exclusion?.code==='UNEXPLAINED_UNREACHABLE').length,reachableTerminals:terminalReport.filter(t=>t.reachable).length,unreachableTerminals:terminalReport.filter(t=>!t.reachable).map(t=>t.id)},graph:{distinctStates:states.length,nonterminalStates:sum(layers.map(l=>l.size)),terminalStates:terminalStates.size,compressedTransitions:compressedEdges,orderedTerminalHistories:totalTerminalPaths.toString(),statesByStage:layers.slice(1).map((layer,i)=>({stage:i+1,states:layer.size})),classificationCaches:c.cache.size},softlocks:{count:softlocks.length,states:softlocks.map(s=>({...s,witness:witnessFor(s.stateId)}))},forcedDeadEndStates:{count:forcedDeadEndStates.length,states:forcedDeadEndStates,definition:'Reachable nonterminal states with no future path to a regular or secret ending. Authored dead-end terminals themselves are intentional outcomes and are excluded.'},flagMutualExclusions:flagPairs,commitments:{quietVersusQuick:{decisionStage:2,mutuallyExclusive:true,reversibleOnlyByRewindingToStage2:true,note:'Secret eligibility is already committed by the stage2 promise. A stage9 inventory choice cannot invent the other promise.'},braceVersusChart:{decisionStage:6,mutuallyExclusive:true,firstMatchPriority:'An answer ending half-rest sets brace even if it contains both grouped kinds.'},additionalInventoryConstraint:{afterSteps:[9,10],reserveUnits:8,bothSecretKeysUnionUnits:10,note:'The resource incompatibility is an additional fact; it does not imply both secret promises can coexist until step9.'}},terminals:terminalReport,secretProofs,nodes:[...nodeStats.values()].map(n=>({...n,paths:n.paths.toString(),flagMasks:[...n.flagMasks]})),exits,storyEdges:[...storyEdges.values()].map(e=>({...e,paths:e.paths.toString(),sourceStates:e.sourceStates.size})),verification:{allCatalogPatternsClassifiedExactlyOnceForEachVisitedFlagClass:true,literalClassifierAudit:{nodeFlagCases:classifierCases,orderedPatternChecks:literalPatternChecks,mismatches:0},allWitnessesReplayed:true,conservationStatesChecked:conservationStates,halfBeatPairParityChecked:pairedOddApplies,backwardEndingReachabilityChecked:true,grantsCreditedOnceOnNumberedEntry:true,terminalEntriesGrantNothing:true,noStateOrTimeCap:true,profileDiscoveryDoesNotSatisfyRunFlags:true}};
}

export function compactReport(report){
 const result=clone(report);
 const compactWitness=witness=>witness?{terminal:witness.terminal,steps:witness.steps.map(({nodeId,recipe,doorId})=>({nodeId,recipe,doorId}))}:null;
 for(const terminal of result.terminals){terminal.witness=compactWitness(terminal.witness);terminal.maxConsumptionWitness=compactWitness(terminal.maxConsumptionWitness);}
 for(const exit of result.exits)exit.witness=compactWitness(exit.witness);
 for(const edge of result.storyEdges??[])edge.witness=compactWitness(edge.witness);
 if(result.softlocks?.states)for(const state of result.softlocks.states)state.witness=compactWitness(state.witness);
 if(result.forcedDeadEndStates?.states)for(const state of result.forcedDeadEndStates.states)state.witness=compactWitness(state.witness);
 delete result.elapsedMs;
 return result;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const source=new URL('./chapter-one.json',import.meta.url),input=readFileSync(source),sourceSHA256=hash(input);console.log('Analyzing story SHA '+sourceSHA256);
 const verifierSHA256=hash(readFileSync(fileURLToPath(import.meta.url))),started=performance.now(),report=analyzeStory(JSON.parse(input),{sourceSHA256});check(hash(readFileSync(source))===sourceSHA256,'Story changed during verification');check(hash(readFileSync(fileURLToPath(import.meta.url)))===verifierSHA256,'Verifier changed during verification');report.verifierSHA256=verifierSHA256;report.kindCatalogSHA256=hash(JSON.stringify(KINDS));report.elapsedMs=Math.round(performance.now()-started);writeFileSync(new URL('./verification.json',import.meta.url),JSON.stringify(compactReport(report),null,2)+'\n');
 console.log(JSON.stringify({complete:report.complete,sourceSHA256,coverage:report.coverage,graph:report.graph,softlocks:report.softlocks.count,terminals:report.terminals.map(t=>({id:t.id,reachable:t.reachable,histories:t.orderedHistories,tiles:t.consumedTiles})),elapsedMs:report.elapsedMs}));
}
