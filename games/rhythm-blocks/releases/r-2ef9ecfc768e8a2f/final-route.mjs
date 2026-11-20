/** Journal outcomes open the last route; a run's notes still pay every lock. */
export const COMPLETE_ROUTE_ENTRY='final-route';
export const COMPLETE_ROUTE_CANONICAL_ENTRY='depot-final-route';
export const FINAL_OUTCOME_ID='ending-complete';
export const RESOURCE_FAILURE_OUTCOMES=Object.freeze([
 ['dead-brambles','missing-note-types','The wrong notes at the Overgrown Arch'],
 ['dead-aviary','missing-note-types','The wrong notes at the Silent Aviary'],
 ['garden-secret-final','out-of-notes','An empty bag at the listening window'],
 ['workshop-secret-final','out-of-notes','An empty bag at the birds’ route'],
 ['canal-final','out-of-notes','An empty bag at the bell connection']
].map(([roomId,reason,title])=>Object.freeze({id:'failure-'+roomId,roomId,reason,legacyHintId:'lesson-'+roomId,title})));
export const FAILURE_OUTCOMES=RESOURCE_FAILURE_OUTCOMES;
export const FAILURE_OUTCOME_IDS=Object.freeze(RESOURCE_FAILURE_OUTCOMES.map(outcome=>outcome.id));
export const PRIOR_OUTCOME_IDS=Object.freeze([
 'ending-home','ending-school','ending-public','ending-secret-quiet','ending-secret-birds','dead-ferry',
 ...FAILURE_OUTCOME_IDS
]);
export const FINAL_ROUTE_HINT=Object.freeze({id:'final-route-open',title:'A new route at Nell’s depot',text:'All eleven earlier outcomes are in the journal. A final route has opened at the depot. Take Nell’s note bag and the chest note, then use the new doorway to bring the repairs together.'});

const safeId=id=>typeof id==='string'&&id.length>0&&id.length<=120&&!['__proto__','constructor','prototype'].includes(id);
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

export function getFailureOutcomeId(failure){
 if(!isRecord(failure))return null;
 return RESOURCE_FAILURE_OUTCOMES.find(outcome=>outcome.roomId===failure.roomId&&outcome.reason===failure.reason)?.id??null;
}

/** Requirements are authored data, so malformed gates must fail validation. */
export function isProgressRequirement(value){
 return isRecord(value)&&Object.keys(value).length===1&&Array.isArray(value.outcomes)&&value.outcomes.length>0&&value.outcomes.length<=512&&value.outcomes.every(safeId)&&new Set(value.outcomes).size===value.outcomes.length;
}

function observedOutcomes(state){
 const values=isRecord(state)&&Array.isArray(state.outcomes)?state.outcomes:[];
 return new Set(values.map(value=>typeof value==='string'?value:isRecord(value)?value.id:null).filter(safeId));
}

/** Only the trusted journal's recorded outcomes count, never visits or hints. */
export function hasRequiredProgress(requirement,state){
 if(requirement===undefined)return true;
 if(!isProgressRequirement(requirement))return false;
 const observed=observedOutcomes(state);
 return requirement.outcomes.every(id=>observed.has(id));
}

export function getFinalRouteProgress(state){
 const observed=observedOutcomes(state),missingOutcomeIds=Object.freeze(PRIOR_OUTCOME_IDS.filter(id=>!observed.has(id)));
 return Object.freeze({unlocked:missingOutcomeIds.length===0,found:PRIOR_OUTCOME_IDS.length-missingOutcomeIds.length,total:PRIOR_OUTCOME_IDS.length,missingOutcomeIds});
}
