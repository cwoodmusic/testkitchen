import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {enumerateRhythms,evaluateCondition,compileStory,classifyAnswer,analyzeStory} from './analyze.mjs';

const KINDS=['quarter','eighth-pair','sixteenth-group','half','eighth','quarter-rest','half-rest','dotted-half','sixteenth-pair'];
const UNITS=[2,2,2,4,1,2,4,6,1],rich=()=>Array(9).fill(10),clone=value=>structuredClone(value);
const story=()=>JSON.parse(readFileSync(new URL('./chapter-one.json',import.meta.url),'utf8'));
const context=(nodeId='first',flags=[])=>({nodeId,flags});
function tiny(){
 return {
  version:1,entry:'first',stages:2,unitsPerBeat:2,answerUnits:8,
  initialInventory:Object.fromEntries(KINDS.map(id=>[id,1])),
  grants:{2:['half','quarter','eighth-pair']},flags:['quiet','quick','grouped','ticket','brace','chart'],
  nodes:[{id:'first',stage:1,doorSet:'one',entryClues:[]},{id:'second',stage:2,doorSet:'two',entryClues:[]}],
  doorSets:{
   one:[{id:'quiet-opening',when:{startsWithAny:['quarter-rest']},to:'second',addFlags:['quiet']},{id:'ordinary-opening',when:{},to:'second'}],
   two:[{id:'finish',when:{},to:'done'}]
  },
  terminals:[{id:'done',kind:'regular-ending'}],clues:[]
 };
}

test('the exact nine-kind catalog has 9368 ordered four-beat recipes and 246 consumption vectors',()=>{
 const rhythms=enumerateRhythms();assert.equal(rhythms.length,9368);
 const vectors=new Set(),orders=new Set();
 for(const rhythm of rhythms){
  assert(Array.isArray(rhythm.recipe));assert.equal(rhythm.counts.length,9);assert.equal(rhythm.length,rhythm.recipe.length);
  const counts=Array(9).fill(0);for(const id of rhythm.recipe){const at=KINDS.indexOf(id);assert(at>=0,'Only the declared nine kinds can occur');counts[at]++;}
  assert.deepEqual(rhythm.counts,counts);assert.equal(counts.reduce((n,count,i)=>n+count*UNITS[i],0),8);
  vectors.add(counts.join(','));orders.add(JSON.stringify(rhythm.recipe));
 }
 assert.equal(vectors.size,246);assert.equal(orders.size,9368);assert(rhythms.some(r=>JSON.stringify(r.recipe)===JSON.stringify(['dotted-half','eighth','sixteenth-pair'])));
});

test('all predicate properties are ANDed and empty conditions are unconditional',()=>{
 const recipe=['eighth-pair','sixteenth-group','half-rest'],when={
  nodeIs:'first',startsWithAny:['eighth-pair'],endsWithAny:['half-rest'],
  containsAny:['half-rest'],containsAll:['eighth-pair','sixteenth-group'],
  containsAtLeast:{kinds:['eighth-pair','sixteenth-group'],count:2},lengthEquals:3,
  flagsAll:['quiet'],flagsNone:['quick'],flagsAnyMissing:['brace','chart']
 };
 assert.equal(evaluateCondition(when,recipe,context('first',['quiet','chart'])),true);
 assert.equal(evaluateCondition(when,recipe,context('second',['quiet','chart'])),false);
 assert.equal(evaluateCondition(when,recipe,context('first',['quiet','quick'])),false);
 assert.equal(evaluateCondition(when,recipe,context('first',['chart'])),false);
 assert.equal(evaluateCondition({...when,endsWithAny:['quarter']},recipe,context('first',['quiet'])),false);
 assert.equal(evaluateCondition({},recipe,context()),true);
});

test('flagsNone means all absent; flagsAnyMissing means at least one absent',()=>{
 const recipe=['half','half'],names=['quick','grouped'];
 for(const [flags,none,missing]of [[[],true,true],[['quick'],false,true],[['grouped'],false,true],[['quick','grouped'],false,false]]){
  assert.equal(evaluateCondition({flagsNone:names},recipe,context('first',flags)),none);
  assert.equal(evaluateCondition({flagsAnyMissing:names},recipe,context('first',flags)),missing);
 }
});

test('exact recipes retain tile identity and order; grouped attacks do not become extra inventory tiles',()=>{
 const a=['dotted-half','eighth','sixteenth-pair'];assert.equal(evaluateCondition({recipeEquals:a},a,context()),true);
 assert.equal(evaluateCondition({recipeEquals:a},['dotted-half','sixteenth-pair','eighth'],context()),false);
 const groups=['quarter','eighth-pair','sixteenth-group','quarter-rest'];
 assert.equal(evaluateCondition({lengthEquals:4,allBeatUnitsEqual:2},groups,context()),true);
 assert.equal(evaluateCondition({containsAtLeast:{kinds:['eighth-pair','sixteenth-group'],count:2}},groups,context()),true);
 assert.equal(evaluateCondition({containsAtLeast:{kinds:['sixteenth-group'],count:2}},groups,context()),false);
 assert.equal(evaluateCondition({containsAny:['eighth']},groups,context()),false);
 assert.equal(evaluateCondition({allBeatUnitsEqual:2},a,context()),false);
});

test('nodeIs reads the current node, never a prior visit, door label or intended destination',()=>{
 const recipe=['half','quarter','eighth-pair'];
 assert.equal(evaluateCondition({nodeIs:'first'},recipe,context('first')),true);
 assert.equal(evaluateCondition({nodeIs:'second'},recipe,context('first')),false);
 assert.equal(evaluateCondition({nodeIs:'first'},recipe,{nodeId:'second',flags:[],seenNodes:['first']}),false);
});

test('unknown predicate spellings are rejected even when an earlier predicate would be false',()=>{
 assert.throws(()=>evaluateCondition({flagAll:['quiet']},['half','half'],context()));
 assert.throws(()=>evaluateCondition({startsWithAny:['quarter-rest'],invented:true},['half','half'],context()));
});

test('first-match priority gives the brace, not both brace and chart, for an overlapping stage-six recipe',()=>{
 const authored=story(),compiled=compileStory(authored),recipe=['eighth-pair','sixteenth-group','half-rest'],state={nodeId:'s06_archive',flags:[],inventory:rich()};
 assert.equal(evaluateCondition(authored.doorSets['6'][0].when,recipe,state),true);
 assert.equal(evaluateCondition(authored.doorSets['6'][1].when,recipe,state),true);
 const selected=classifyAnswer(compiled,state,recipe);assert.equal(selected.id,'set-the-stair-brace');assert.deepEqual(selected.addFlags,['brace']);
 const chart=classifyAnswer(compiled,state,['quarter','eighth-pair','sixteenth-group','quarter']);assert.equal(chart.id,'read-both-small-subdivisions');assert.deepEqual(chart.addFlags,['chart']);
});

test('secret routes require the right current node and flags before exact-key fallback dead ends',()=>{
 const authored=story(),compiled=compileStory(authored),quiet=['dotted-half','quarter-rest'],fast=['dotted-half','eighth','sixteenth-pair'];
 const classify=(nodeId,flags,recipe)=>classifyAnswer(compiled,{nodeId,flags,inventory:rich()},recipe);
 assert.equal(classify('s11_garden',['quiet'],quiet).to,'s12_secret_quiet');
 assert.equal(classify('s11_bell',['quiet'],quiet).to,'dead_seal');
 assert.equal(classify('s11_garden',[],quiet).to,'dead_seal');
 assert.equal(classify('s11_star',['quick','grouped'],fast).to,'s12_secret_fast');
 assert.equal(classify('s11_star',['quick'],fast).to,'dead_seal');
 assert.equal(classify('s11_garden',['quick','grouped'],fast).to,'dead_seal');
 assert.equal(classify('s11_garden',1<<authored.flags.indexOf('quiet'),quiet).to,'s12_secret_quiet');
});

test('all six fresh stage-ten pack orders preserve either key and offer garden/star/bell approaches equally',()=>{
 const compiled=compileStory(story()),orders=enumerateRhythms().filter(r=>r.length===3&&r.counts.every((n,i)=>n===(['half','quarter','eighth-pair'].includes(KINDS[i])?1:0)));
 assert.equal(orders.length,6);const destinations={};
 for(const {recipe}of orders){const door=classifyAnswer(compiled,{nodeId:'s10_public',flags:[],inventory:rich()},recipe);destinations[door.to]=(destinations[door.to]??0)+1;}
 assert.deepEqual(destinations,{s11_garden:2,s11_bell:2,s11_star:2});
});

test('classification enforces typed stock and exact duration before selecting a door, without mutating the input',()=>{
 const compiled=compileStory(tiny()),state={nodeId:'first',flags:[],inventory:Array(9).fill(1)},recipe=['half','quarter','eighth-pair'],before=clone(state);
 assert.equal(classifyAnswer(compiled,state,recipe).to,'second');assert.deepEqual(state,before);assert.deepEqual(recipe,['half','quarter','eighth-pair']);
 assert.throws(()=>classifyAnswer(compiled,state,['quarter']));
 assert.throws(()=>classifyAnswer(compiled,state,['half','half']));
 assert.throws(()=>classifyAnswer(compiled,state,Array(4).fill('quarter')));
 assert.throws(()=>classifyAnswer(compiled,state,['whole']));
 assert.throws(()=>classifyAnswer(compiled,{...state,nodeId:'missing'},recipe));
 const quiet=classifyAnswer(compiled,{...state,inventory:rich()},['quarter-rest','half','quarter']);assert.equal(quiet.id,'quiet-opening');
});

test('minimal authored graphs compile without depending on presentation titles',()=>{
 const authored=tiny();assert.doesNotThrow(()=>compileStory(authored));
 authored.nodes.forEach(node=>{node.title='A completely different theme';node.sceneText='Presentation is not a predicate.';});assert.doesNotThrow(()=>compileStory(authored));
});

test('compilation rejects unknown kinds, flags, predicate names and nodeIs targets',()=>{
 for(const mutate of [
  s=>{s.grants[2][0]='unknown';},
  s=>{s.doorSets.one[0].when.startsWithAny=['unknown'];},
  s=>{s.doorSets.one[0].addFlags=['unknown'];},
  s=>{s.doorSets.one[0].when.flagsAll=['unknown'];},
  s=>{s.doorSets.one[0].when.nodeIs='missing';},
  s=>{s.doorSets.one[0].when.nodeIs=['first'];},
  s=>{s.doorSets.one[0].when.invented=true;}
 ]){const authored=tiny();mutate(authored);assert.throws(()=>compileStory(authored));}
});

test('compilation requires exactly one final default and rejects missing references or cyclic/backward edges',()=>{
 for(const mutate of [
  s=>{s.doorSets.one.pop();},
  s=>{s.doorSets.one.reverse();},
  s=>{s.doorSets.one.unshift({id:'early-default',when:{},to:'second'});},
  s=>{s.doorSets.one[0].to='missing';},
  s=>{s.doorSets.two[0].to='first';},
  s=>{s.nodes[1].id='first';},
  s=>{s.nodes[0].doorSet='missing';}
 ]){const authored=tiny();mutate(authored);assert.throws(()=>compileStory(authored));}
});

test('each later stage needs one fixed three-tile pack and no extra undeclared stage grant',()=>{
 for(const mutate of [
  s=>{delete s.grants[2];},
  s=>{s.grants[2]=['quarter'];},
  s=>{s.grants[2]=['half','quarter','eighth-pair','quarter'];},
  s=>{s.grants[3]=['half','quarter','eighth-pair'];},
  s=>{s.grants[1]=['half','quarter','eighth-pair'];}
 ]){const authored=tiny();mutate(authored);assert.throws(()=>compileStory(authored));}
});

test('legal answers can still be a forced dead end when every actual future outcome is dead',()=>{
 const authored=tiny();authored.terminals[0].kind='dead-end';const report=analyzeStory(authored);
 assert.equal(report.softlocks.count,0,'This fixture has affordable answers at every nonterminal state');
 assert(report.forcedDeadEndStates.count>0,'Backward outcome reachability must detect the unavoidable dead ending');
 assert.equal(report.forcedDeadEndStates.count,report.forcedDeadEndStates.states.length);
 assert(report.forcedDeadEndStates.states.some(state=>state.nodeId==='first'));
 for(const state of report.forcedDeadEndStates.states){
  assert(['first','second'].includes(state.nodeId),'Selected dead terminal states themselves must not be counted');
  assert(Array.isArray(state.witness.steps),'Each forced state needs a replayable prefix witness');
 }
});

test('an intentional dead choice does not make a state forced when a regular continuation is available',()=>{
 const authored=tiny();authored.terminals.push({id:'dead',kind:'dead-end'});authored.doorSets.one[0].to='dead';
 const report=analyzeStory(authored);assert.equal(report.softlocks.count,0);
 assert(report.terminals.find(terminal=>terminal.id==='dead').reachable,'The optional dead choice is genuinely reachable');
 assert(report.terminals.find(terminal=>terminal.id==='done').reachable,'The regular alternative is genuinely reachable');
 assert.equal(report.forcedDeadEndStates.count,0);assert.deepEqual(report.forcedDeadEndStates.states,[]);
});
