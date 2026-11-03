/* Original fact and quiz identities support older project and player saves. */
(function(root,factory){const data=factory();if(typeof module==='object'&&module.exports)module.exports=data;if(root)root.CodaMusicHistoryLegacy=data;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const quizFactNumbers={"bach":[1,5,6,8,11,15,18,22,25,30],"mozart":[3,7,9,10,12,15,19,20,22,30],"beethoven":[2,5,7,9,12,18,20,22,26,28],"clara":[1,6,8,11,15,19,20,23,25,29],"joplin":[1,3,5,7,12,13,17,19,23,30],"ellington":[1,4,6,10,14,18,20,23,27,29],"ella":[3,4,6,9,13,17,19,24,28,29],"nina":[1,3,6,9,15,19,20,24,25,29],"miles":[3,6,8,11,14,16,18,20,25,29],"chopin":[1,5,8,10,12,15,18,20,24,30],"haydn":[2,3,7,10,12,16,19,22,26,28],"dj":[5,6,10,12,15,19,22,23,26,29],"vee-jay":[3,4,6,10,13,15,18,24,27,29],"zizi":[2,5,6,9,13,16,19,23,25,29],"metronome":[4,6,9,11,13,16,21,23,27,29],"schoenberg":[1,3,6,10,11,15,17,22,26,29],"handel":[2,6,12,13,16,17,20,24,28,30],"vivaldi":[2,5,7,13,16,20,22,23,26,28]};
 const pad=value=>String(value).padStart(2,'0');
 const FACT_IDS=Object.freeze(Object.keys(quizFactNumbers).flatMap(person=>Array.from({length:30},(_,index)=>person+'-'+pad(index+1))));
 const QUIZ_FACTS=Object.freeze(Object.fromEntries(Object.entries(quizFactNumbers).flatMap(([person,numbers])=>numbers.map((number,index)=>[person+'-quiz-'+pad(index+1),person+'-'+pad(number)]))));
 return Object.freeze({FACT_IDS,QUIZ_FACTS});
});
