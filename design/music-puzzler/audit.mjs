// Independent dictionary/Set replay of the compact proof. No analyzer imports.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const base=new URL('./',import.meta.url),raw=readFileSync(new URL('chapter-one.json',base));
const chapter=JSON.parse(raw),proof=JSON.parse(readFileSync(new URL('verification.json',base)));
const catalog=[['quarter',2,false],['eighth-pair',2,false],['sixteenth-group',2,false],['half',4,false],['eighth',1,false],['quarter-rest',2,true],['half-rest',4,true],['dotted-half',6,false],['sixteenth-pair',1,false]].map(([id,units,rest])=>({id,units,rest}));
const units=Object.fromEntries(catalog.map(kind=>[kind.id,kind.units])),kinds=catalog.map(kind=>kind.id);
const hash=value=>createHash('sha256').update(value).digest('hex'),sum=stock=>Object.values(stock).reduce((n,value)=>n+value,0),mass=stock=>kinds.reduce((n,kind)=>n+(stock[kind]??0)*units[kind],0);
const nodes=new Map(chapter.nodes.map(node=>[node.id,node])),terminals=new Map(chapter.terminals.map(ending=>[ending.id,ending]));
const counters={paths:0,answers:0,creditedPacks:0,secretCarryProofs:0};
assert.equal(proof.sourceSHA256,hash(raw));
assert.equal(proof.verifierSHA256,hash(readFileSync(new URL('analyze.mjs',base))));
assert.equal(proof.kindCatalogSHA256,hash(JSON.stringify(catalog)));
assert.equal(chapter.budget.totalTiles,sum(chapter.initialInventory)+Object.values(chapter.grants).flat().length);
assert.equal(chapter.budget.totalHalfBeatUnits,mass(chapter.initialInventory)+Object.values(chapter.grants).flat().reduce((n,kind)=>n+units[kind],0));
assert.equal(chapter.budget.allTwelveAnswersCost,chapter.stages*chapter.answerUnits);
function matches(when,recipe,node,flags){return Object.entries(when).every(([key,value])=>{
 switch(key){
 case 'recipeEquals':return JSON.stringify(value)===JSON.stringify(recipe);
 case 'nodeIs':return node===value;
 case 'startsWithAny':return value.includes(recipe[0]);
 case 'endsWithAny':return value.includes(recipe.at(-1));
 case 'containsAny':return recipe.some(kind=>value.includes(kind));
 case 'containsAll':return value.every(kind=>recipe.includes(kind));
 case 'containsAtLeast':return recipe.filter(kind=>value.kinds.includes(kind)).length>=value.count;
 case 'lengthEquals':return recipe.length===value;
 case 'allBeatUnitsEqual':return recipe.every(kind=>units[kind]===value);
 case 'flagsAll':return value.every(flag=>flags.has(flag));
 case 'flagsNone':return value.every(flag=>!flags.has(flag));
 case 'flagsAnyMissing':return value.some(flag=>!flags.has(flag));
 default:throw Error('Unknown condition: '+key);
 }
});}
function replay(witness){
 let node=chapter.entry,stock={...chapter.initialInventory},flags=new Set(),receipts=new Set(),spent=0;
 const trace=[];
 for(const answer of witness.steps){
  assert.equal(answer.nodeId,node);assert(nodes.has(node));const recipe=answer.recipe;
  assert.equal(recipe.reduce((n,kind)=>n+units[kind],0),8);
  const door=chapter.doorSets[nodes.get(node).doorSet].find(candidate=>matches(candidate.when,recipe,node,flags));
  assert(door);assert.equal(answer.doorId,door.id);
  for(const kind of recipe){assert(stock[kind]>0,kind+' overspent');stock[kind]--;spent++;}
  for(const flag of door.removeFlags??[])flags.delete(flag);for(const flag of door.addFlags??[])flags.add(flag);
  const record={stage:nodes.get(node).stage,to:door.to,recipe:[...recipe],after:{...stock},flags:new Set(flags)};
  const destination=nodes.get(door.to);
  if(destination){
   assert(!receipts.has(destination.stage));receipts.add(destination.stage);
   const grant=chapter.grants[destination.stage];assert.equal(grant.length,3);
   for(const kind of grant)stock[kind]++;counters.creditedPacks++;
  }else assert(terminals.has(door.to));
  assert.equal(sum(stock)+spent,sum(chapter.initialInventory)+receipts.size*3);
  assert.equal(mass(stock)+(trace.length+1)*8,mass(chapter.initialInventory)+[...receipts].flatMap(stage=>chapter.grants[stage]).reduce((n,kind)=>n+units[kind],0));
  assert.equal(stock.eighth,stock['sixteenth-pair']);
  trace.push(record);node=door.to;counters.answers++;
 }
 assert.equal(node,witness.terminal);counters.paths++;return{node,stock,spent,trace};
}
const minReplays=new Map();
for(const terminal of proof.terminals){
 for(const [field,cost,remaining]of [['witness','min','max'],['maxConsumptionWitness','max','min']]){
  const run=replay(terminal[field]);assert.equal(run.node,terminal.id);assert.equal(run.spent,terminal.consumedTiles[cost]);assert.equal(sum(run.stock),terminal.remainingTiles[remaining]);
  if(field==='witness')minReplays.set(terminal.id,run);
  if(terminal.kind!=='dead-end'){assert.equal(run.trace.length,12);assert.equal(mass(run.stock),8);}
 }
}
for(const exit of proof.exits)if(exit.reachable)replay(exit.witness);
for(const secret of proof.secretProofs){
 const run=minReplays.get(secret.terminal),need={};for(const kind of secret.key)need[kind]=(need[kind]??0)+1;
 for(const answer of run.trace.filter(answer=>answer.stage<=10))for(const [kind,count]of Object.entries(need))assert(answer.after[kind]>=count);
 for(const kind of Object.keys(need))assert(Object.values(chapter.grants).every(grant=>!grant.includes(kind)));
 const approach=run.trace.find(answer=>answer.stage===10);assert.equal(approach.to,secret.stage10Approach);
 assert.deepEqual([...approach.recipe].sort(),[...chapter.grants[10]].sort());
 const unlock=run.trace.find(answer=>answer.stage===11),fresh=Object.fromEntries(kinds.map(kind=>[kind,chapter.grants[11].filter(item=>item===kind).length]));
 assert.deepEqual(unlock.after,fresh);assert.equal(sum(chapter.initialInventory)+30-sum(unlock.after),secret.unlockConsumedTiles);
 counters.secretCarryProofs++;
}
assert.equal(proof.softlocks.count,0);assert.equal(proof.forcedDeadEndStates.count,0);
assert.equal(proof.terminals.reduce((total,terminal)=>total+BigInt(terminal.orderedHistories),0n).toString(),proof.graph.orderedTerminalHistories);
const profile=JSON.parse(readFileSync(new URL('profile-plan.json',base)));
assert.deepEqual([...profile.collection.endingIds].sort(),chapter.terminals.filter(item=>item.kind!=='dead-end').map(item=>item.id).sort());
assert.deepEqual([...profile.collection.secretEndingIds].sort(),chapter.terminals.filter(item=>item.kind==='secret-ending').map(item=>item.id).sort());
assert.deepEqual([...profile.collection.deadEndIds].sort(),chapter.terminals.filter(item=>item.kind==='dead-end').map(item=>item.id).sort());
for(const id of profile.rewards.receiptExamples)assert(id.length<=100);
const result={status:'passed',sourceSHA256:proof.sourceSHA256,verifierSHA256:proof.verifierSHA256,...counters,method:'Independent dictionary/Set interpreter; all terminal min/max and reachable node-exit paths replayed with exact stock, promises, ordered routing, one-time packs, and rare-key conservation.'};
writeFileSync(new URL('audit.json',base),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
