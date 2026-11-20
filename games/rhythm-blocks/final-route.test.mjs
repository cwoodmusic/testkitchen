import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPLETE_ROUTE_ENTRY,COMPLETE_ROUTE_CANONICAL_ENTRY,FINAL_OUTCOME_ID,PRIOR_OUTCOME_IDS,RESOURCE_FAILURE_OUTCOMES,FAILURE_OUTCOME_IDS,FINAL_ROUTE_HINT,getFinalRouteProgress,getFailureOutcomeId,hasRequiredProgress,isProgressRequirement} from './final-route.mjs';

test('the final route requires all eleven earlier outcomes and excludes its own ending',()=>{
 assert.equal(COMPLETE_ROUTE_ENTRY,'final-route');assert.equal(COMPLETE_ROUTE_CANONICAL_ENTRY,'depot-final-route');assert.equal(FINAL_OUTCOME_ID,'ending-complete');
 assert.equal(PRIOR_OUTCOME_IDS.length,11);assert.equal(new Set(PRIOR_OUTCOME_IDS).size,11);assert(!PRIOR_OUTCOME_IDS.includes(FINAL_OUTCOME_ID));
 assert.deepEqual(getFinalRouteProgress(null),{unlocked:false,found:0,total:11,missingOutcomeIds:[...PRIOR_OUTCOME_IDS]});
 for(const missing of PRIOR_OUTCOME_IDS){
  const state={outcomes:PRIOR_OUTCOME_IDS.filter(id=>id!==missing),complete:true,achievements:[{id:'complete-score'}],hints:[{id:missing}],nodes:[{id:missing}]};
  assert.deepEqual(getFinalRouteProgress(state),{unlocked:false,found:10,total:11,missingOutcomeIds:[missing]});
 }
 for(const outcomes of [[...PRIOR_OUTCOME_IDS],PRIOR_OUTCOME_IDS.map(id=>({id,title:'An outcome'}))]){
  const result=getFinalRouteProgress({outcomes});assert.deepEqual(result,{unlocked:true,found:11,total:11,missingOutcomeIds:[]});assert(Object.isFrozen(result));assert(Object.isFrozen(result.missingOutcomeIds));
 }
 assert.equal(getFinalRouteProgress({outcomes:[FINAL_OUTCOME_ID]}).found,0);
 assert.equal(getFinalRouteProgress({hints:PRIOR_OUTCOME_IDS,nodes:PRIOR_OUTCOME_IDS,edges:PRIOR_OUTCOME_IDS,complete:true}).unlocked,false);
 assert.equal(getFinalRouteProgress({outcomes:Array(11).fill(PRIOR_OUTCOME_IDS[0])}).found,1);
 assert.equal(FINAL_ROUTE_HINT.id,'final-route-open');assert.match(FINAL_ROUTE_HINT.text,/eleven/);assert(Object.isFrozen(FINAL_ROUTE_HINT));assert(Object.isFrozen(PRIOR_OUTCOME_IDS));
});

test('failure outcome identity requires the exact room and failure reason',()=>{
 assert.equal(RESOURCE_FAILURE_OUTCOMES.length,5);assert.deepEqual(FAILURE_OUTCOME_IDS,RESOURCE_FAILURE_OUTCOMES.map(outcome=>outcome.id));
 for(const outcome of RESOURCE_FAILURE_OUTCOMES){
  assert(Object.isFrozen(outcome));assert.equal(outcome.id,'failure-'+outcome.roomId);assert.equal(outcome.legacyHintId,'lesson-'+outcome.roomId);
  assert.equal(getFailureOutcomeId({roomId:outcome.roomId,reason:outcome.reason,remainingNotes:0}),outcome.id);
  for(const reason of ['dead-end','unknown',outcome.reason==='out-of-notes'?'missing-note-types':'out-of-notes'])assert.equal(getFailureOutcomeId({roomId:outcome.roomId,reason}),null);
 }
 for(const value of [null,[],{},'dead-brambles',{roomId:'depot',reason:'out-of-notes'},{roomId:'dead-brambles'}])assert.equal(getFailureOutcomeId(value),null);
 assert(Object.isFrozen(RESOURCE_FAILURE_OUTCOMES));assert(Object.isFrozen(FAILURE_OUTCOME_IDS));
});

test('generic authored progress gates validate exact unique IDs and fail closed',()=>{
 const valid={outcomes:['ending-home','failure-dead-brambles']};assert.equal(isProgressRequirement(valid),true);
 assert.equal(hasRequiredProgress(valid,{outcomes:['ending-home',{id:'failure-dead-brambles'}]}),true);
 assert.equal(hasRequiredProgress(valid,{outcomes:['ending-home']}),false);
 assert.equal(hasRequiredProgress(undefined,null),true);
 for(const value of [null,[],{},true,{outcomes:[]},{outcomes:['ending-home','ending-home']},{outcomes:['__proto__']},{outcomes:['constructor']},{outcomes:['prototype']},{outcomes:['']},{outcomes:[{}]},{outcomes:'ending-home'},{outcomes:['ending-home'],hints:['lesson-dead-brambles']},{outcomes:Array.from({length:513},(_,index)=>'outcome-'+index)}]){
  assert.equal(isProgressRequirement(value),false,JSON.stringify(value));assert.equal(hasRequiredProgress(value,{outcomes:PRIOR_OUTCOME_IDS}),false);
 }
 assert.equal(hasRequiredProgress(valid,{outcomes:[null,{},1,[],{id:'ending-home'},{id:'failure-dead-brambles'}]}),true);
});
