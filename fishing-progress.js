/* Fishing rewards use the saved catch journal and the existing Notes/XP ledgers. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaFishingProgress=api;})(typeof window==='undefined'?null:window,function(root){
 'use strict';
 const METERS=Object.freeze(['4/4','6/8','2/2']);
 const RARITIES=Object.freeze(['common','uncommon','rare','epic','legendary']);
 const ACHIEVEMENTS=Object.freeze([
  {id:'fishing-first-catch',title:'First Catch',description:'Catch your first fish.',metric:'total',target:1},
  {id:'fishing-five-catches',title:'Lake Regular',description:'Catch five fish.',metric:'total',target:5},
  {id:'fishing-twenty-catches',title:'Seasoned Angler',description:'Catch twenty fish.',metric:'total',target:20},
  {id:'fishing-perfect-catch',title:'In Perfect Time',description:'Catch a fish without a missed note or extra tap.',metric:'perfect',target:1},
  {id:'fishing-rare-catch',title:'Something Special',description:'Catch a rare, epic, or legendary fish.',metric:'rare',target:1},
  {id:'fishing-legendary-catch',title:'Legend of the Lake',description:'Catch a legendary fish.',metric:'legendary',target:1},
  {id:'fishing-three-meters',title:'Master of Three Meters',description:'Catch fish in 4/4, 6/8, and cut time.',metric:'meters',target:3},
  {id:'fishing-ten-species',title:'Fish Finder',description:'Discover ten different kinds of fish.',metric:'species',target:10},
  {id:'fishing-all-species',title:'The Complete Catch',description:'Discover all thirty kinds of fish.',metric:'species',target:30}
 ].map(value=>Object.freeze({...value,xp:50})));
 const integer=(value,max=1000000)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
 const copy=value=>JSON.parse(JSON.stringify(value));
 const rewardKey=id=>'fishing:'+id;
 function catalogMap(catalog){
  const map=new Map();
  for(const fish of Array.isArray(catalog)?catalog:[]){
   if(!fish||typeof fish.id!=='string'||!/^[a-z0-9-]{1,80}$/.test(fish.id)||typeof fish.name!=='string'||!fish.name.trim()||!RARITIES.includes(fish.rarity)||!integer(fish.notes,1000)||fish.notes<1||!integer(fish.xp,1000)||fish.xp<1||map.has(fish.id))continue;
   map.set(fish.id,{id:fish.id,name:fish.name,rarity:fish.rarity,notes:fish.notes,xp:fish.xp});
  }
  return map;
 }
 function resultFrom(entry){return entry?.result&&typeof entry.result==='object'?entry.result:entry;}
 function validCatch(raw,catalog){
  const result=resultFrom(raw),byId=catalog instanceof Map?catalog:catalogMap(catalog),fish=byId.get(result?.fishId);
  return !!fish&&result.caught===true&&result.outcome==='caught'&&(result.reason===undefined||result.reason===null)&&typeof result.id==='string'&&/^[a-z0-9:_-]{1,92}$/i.test(result.id)&&result.rarity===fish.rarity&&METERS.includes(result.meter)&&(result.timeSignature===undefined||result.timeSignature===result.meter)&&integer(result.hits)&&result.hits>0&&integer(result.misses)&&integer(result.extras)&&typeof result.perfect==='boolean'&&result.perfect===(result.misses===0&&result.extras===0)&&result.notes===fish.notes&&result.xp===fish.xp;
 }
 function journalResults(entries,catalog){
  const seen=new Set(),results=[];
  for(const entry of Array.isArray(entries)?entries:[]){const result=resultFrom(entry);if(!validCatch(result,catalog)||seen.has(result.id))continue;seen.add(result.id);results.push(result);}
  return results;
 }
 function catchStats(entries,catalog){
  const byId=catalog instanceof Map?catalog:catalogMap(catalog),results=journalResults(entries,byId),species=new Set(),meters=new Set();let perfect=0,rare=0,legendary=0;
  for(const result of results){species.add(result.fishId);meters.add(result.meter);if(result.perfect)perfect++;if(RARITIES.indexOf(result.rarity)>=2)rare++;if(result.rarity==='legendary')legendary++;}
  return {total:results.length,species:species.size,speciesIds:Array.from(species),meters:meters.size,meterIds:METERS.filter(meter=>meters.has(meter)),perfect,rare,legendary};
 }
 function create(api={}){
  const catalog=catalogMap(api.catalog||root?.CodaRhythmFishing?.FISH);let lastError='';
  function readCatches(){try{const entries=api.getCatches?.();if(!Array.isArray(entries))return {ok:false,error:'Your catch must be saved before its reward can be collected.',entries:[]};return {ok:true,entries};}catch{return {ok:false,error:'Your catch journal could not be read. Keep this page open and try saving the reward again.',entries:[]};}}
  function getAchievements(){const journal=readCatches(),stats=catchStats(journal.entries,catalog);return ACHIEVEMENTS.map(achievement=>({...achievement,progress:Math.min(achievement.target,stats[achievement.metric]),earned:stats[achievement.metric]>=achievement.target}));}
  function snapshot(){const journal=readCatches();return {stats:catchStats(journal.entries,catalog),achievements:getAchievements(),error:lastError||journal.error||''};}
  function reward(fishInput,result){
   let notes=0,xp=0;const achievements=[];
   const fail=error=>{lastError=error;return {ok:false,amount:notes,notes,xp,alreadyClaimed:false,achievements,error};};
   const fish=catalog.get(typeof fishInput==='string'?fishInput:fishInput?.id);
   if(!fish||!validCatch(result,catalog)||fish.id!==result.fishId)return fail('Finish catching a fish before collecting its reward.');
   const journal=readCatches();if(!journal.ok)return fail(journal.error);
   const saved=journalResults(journal.entries,catalog).find(entry=>entry.id===result.id);
   if(!saved||['fishId','rarity','meter','hits','misses','extras','perfect','notes','xp'].some(key=>saved[key]!==result[key]))return fail('Save this completed catch in your journal before collecting its reward.');
   const key=rewardKey(result.id);let paid;
   try{paid=api.wallet?.grantReward(key,fish.notes);}catch{return fail('Your Notes could not be saved. Try collecting this catch’s reward again.');}
   if(!paid?.ok)return fail(paid?.error||'Your Notes could not be saved. Try collecting this catch’s reward again.');
   notes=integer(paid.amount,1000)?paid.amount:0;
   let experience;
   try{experience=api.progression?.awardXP(key,fish.xp,'Caught '+fish.name);}catch{return fail('Your catch XP could not be saved. Retry its reward; your Notes will stay safe.');}
   if(!experience?.ok)return fail(experience?.error||'Your catch XP could not be saved. Retry its reward; your Notes will stay safe.');
   xp=integer(experience.amount,1000)?experience.amount:0;
   for(const achievement of getAchievements().filter(value=>value.earned)){
    let award;try{award=api.progression?.awardXP('achievement:'+achievement.id,achievement.xp,achievement.title);}catch{return fail('Your fishing achievement XP could not be saved. Retry this reward to finish saving it.');}
    if(!award?.ok)return fail(award?.error||'Your fishing achievement XP could not be saved. Retry this reward to finish saving it.');
    const amount=integer(award.amount,1000)?award.amount:0;xp+=amount;if(amount>0)achievements.push({...achievement,amount});
   }
   lastError='';return {ok:true,amount:notes,notes,xp,alreadyClaimed:notes===0&&xp===0,achievements,error:''};
  }
  return {reward,getAchievements,snapshot};
 }
 return Object.freeze({ACHIEVEMENTS,METERS,RARITIES,catchStats,validCatch,create});
});
