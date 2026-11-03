/* Cabinet records come from completed game results, never from panel visits. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;if(root)root.CodaHallOfFame=value;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const KEY='codaHallOfFameV1';
 const TITLES={pitch:'Pitch Race',triad:'Music Triad',rhythm:'Rhythm Room'};
 const MODES={pitch:[['classic','Classic'],['endless','Endless'],['levels','Levels'],['multi','Multiplayer']],triad:[['computer','Play computer'],['multiplayer','Multiplayer']],rhythm:[['tap','Tap challenge']]};
 const unitFor=game=>game==='triad'?'cards':game==='rhythm'?'% accuracy':'points';
 const needsSignIn=code=>code==='sign-in-needed'||code==='unauthenticated';
 const number=(n,max=1000000)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
 function resultRow(game,runId,result,name){
  if(typeof runId!=='string'||!runId.length||runId.length>128||!result||typeof result!=='object')return null;
  const row={game,runId,name:typeof name==='string'?name.trim().slice(0,18)||'Guest':'Guest',at:Date.now()};
  if(game==='pitch'&&['classic','endless','levels','multi'].includes(result.mode)&&number(result.score)&&number(result.correct)&&number(result.streak)&&result.streak<=result.correct)
   return {...row,mode:result.mode,score:result.score,tiebreak:result.streak,detail:result.streak+' best streak',unit:'points'};
  if(game==='triad'&&['computer','multiplayer'].includes(result.mode)&&number(result.score,16)&&number(result.captures,1000))
   return {...row,mode:result.mode,score:result.score,tiebreak:result.captures,detail:result.captures+' captures',unit:'cards'};
  if(game==='rhythm'&&result.mode==='tap'&&number(result.total,128)&&result.total>0&&number(result.hits,128)&&result.hits<=result.total&&number(result.extra,1000))
   return {...row,mode:'tap',score:Math.round(10000*result.hits/(result.total+result.extra))/100,tiebreak:result.hits,detail:result.hits+' / '+result.total+' notes · '+result.extra+' extra taps',unit:'% accuracy'};
  return null;
 }
 const better=(a,b)=>!b||a.score>b.score||a.score===b.score&&a.tiebreak>b.tiebreak;
 function publicChampion(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  const rows=Object.values(raw).filter(row=>row&&/^[A-Z]{3}$/.test(row.initials)&&number(row.score)&&number(row.streak)&&number(row.level));
  rows.sort((a,b)=>b.score-a.score||b.streak-a.streak||(b.createdAt||0)-(a.createdAt||0));
  return rows.length?{name:rows[0].initials,score:rows[0].score,streak:rows[0].streak}:null;
 }
 function create(api={}){
  let storage=api.storage;try{if(storage===undefined)storage=window.localStorage;}catch{}
  const win=api.window||(typeof window==='undefined'?null:window),config=api.config||win?.ARCADE_ACCOUNTS_CONFIG;
  let classroomMode=config?.mode==='classroom'||config?.classroom?.privacy===true||config?.classroom?.enabled===true||storage?.__codaClassroomScoped===true;
  try{classroomMode=classroomMode||new URLSearchParams(win?.location?.search||'').get('classroom')==='1';}catch{}
  let records={},error='',section=null,publicState='idle',champion=null,request=null,activeTab='records',statusFilter='all',categoryFilter='all';
  let recordsScope='best',selectedGame='pitch',selectedMode='classic',selectedClassId='',contextSignature=null,loadGeneration=0,classesGeneration=0,publishState='idle';
  let shared={status:'idle',rows:[],code:'',ownId:'',key:''},classes={status:'idle',items:[],code:''},sharedRequest=null,classesRequest=null,syncAttemptedIdentity=null;
  let publishedRecords=new Set(),publicationRequests=new Map();
  function readRecords(){
   const value={};try{const saved=JSON.parse(storage?.getItem(KEY)||'null');if(saved?.version===1&&saved.records&&typeof saved.records==='object')for(const [key,row]of Object.entries(saved.records))
    if(row&&TITLES[row.game]&&MODES[row.game].some(item=>item[0]===row.mode)&&key===row.game+':'+row.mode&&Number.isFinite(row.score)&&row.score>=0&&row.score<=1000000&&Number.isFinite(row.tiebreak)&&row.tiebreak>=0&&typeof row.name==='string')value[key]={...row,name:row.name.slice(0,18)};
   }catch{}return value;
  }
  records=readRecords();
  function sharedContext(){
   try{const value=api.getSharedContext?.()||{};return {identity:typeof value.identity==='string'?value.identity:'',student:value.student===true,teacher:value.teacher===true,classId:typeof value.classId==='string'?value.classId:null,classLabel:typeof value.classLabel==='string'?value.classLabel:'My class',alias:typeof value.alias==='string'?value.alias:''};}
   catch{return {identity:'',student:false,teacher:false,classId:null,classLabel:'My class',alias:''};}
  }
  const contextKey=value=>JSON.stringify([value.identity,value.student,value.teacher,value.classId]);
  function syncContext(){
   const value=sharedContext(),signature=contextKey(value);
   if(signature!==contextSignature){
    contextSignature=signature;loadGeneration++;classesGeneration++;sharedRequest=null;classesRequest=null;
    shared={status:'idle',rows:[],code:'',ownId:'',key:''};classes={status:'idle',items:[],code:''};selectedClassId='';publishState='idle';syncAttemptedIdentity=null;publishedRecords=new Set();publicationRequests=new Map();
    recordsScope=value.student&&value.classId?'class':'best';records=readRecords();error='';
   }
   return value;
  }
  syncContext();
  function record(game,runId,result){
   syncContext();
   const row=resultRow(game,runId,result,api.getAvatar?.()?.name);if(!row)return false;
   const key=game+':'+row.mode;if(!better(row,records[key]))return false;
   const next={...records,[key]:row};
   try{if(!storage)throw Error('storage');storage.setItem(KEY,JSON.stringify({version:1,records:next}));records=next;error='';publishSaved(row);render();return true;}
   catch{error='Browser saving is unavailable. This record has not been saved.';render();return false;}
  }
  const node=(tag,text,className)=>{const element=api.panelBody.ownerDocument.createElement(tag);if(text!==undefined)element.textContent=text;if(className)element.className=className;return element;};
  function publishSaved(row,refreshBoard=true){
   if(typeof api.publishRecord!=='function')return Promise.resolve(false);
   const identity=contextKey(sharedContext()),signature=[row.game,row.mode,row.score,row.tiebreak].join(':');
   if(publishedRecords.has(signature))return Promise.resolve(true);
   if(publicationRequests.has(signature))return publicationRequests.get(signature);
   publishState='loading';
   const pending=Promise.resolve().then(()=>identity===contextKey(sharedContext())?api.publishRecord({game:row.game,mode:row.mode,score:row.score,tiebreak:row.tiebreak}):null).then(result=>{
    if(identity!==contextKey(sharedContext()))return false;
    if(result?.ok===true)publishedRecords.add(signature);
    publishState=result?.ok===true?'ready':needsSignIn(result?.code)?'sign-in':'error';
    if(result?.ok===true&&refreshBoard&&recordsScope!=='best')void refreshShared(true);else render();
    return result?.ok===true;
   }).catch(()=>{if(identity===contextKey(sharedContext())){publishState='error';render();}return false;}).finally(()=>{if(identity===contextKey(sharedContext()))publicationRequests.delete(signature);});
   publicationRequests.set(signature,pending);return pending;
  }
  async function syncRecords(force=false){
   syncContext();const identity=contextKey(sharedContext());
   if(typeof api.publishRecord!=='function'||syncAttemptedIdentity===identity&&!force)return;
   syncAttemptedIdentity=identity;
   const saved=Object.values(records).filter(row=>!publishedRecords.has([row.game,row.mode,row.score,row.tiebreak].join(':')));
   if(!saved.length)return;
   const results=await Promise.all(saved.map(row=>publishSaved(row,false)));
   if(identity!==contextKey(sharedContext()))return;
   if(results.some(value=>!value)&&publishState!=='sign-in')publishState='error';
   render();if(recordsScope!=='best')void refreshShared(true);
  }
  function achievementSnapshot(){
   try{
    const raw=api.getAchievements?.(),items=Array.isArray(raw?.items)?raw.items.filter(item=>item&&typeof item.id==='string'&&typeof item.title==='string'&&typeof item.description==='string'):[];
    const supplied=Array.isArray(raw?.categories)?raw.categories:[],categories=supplied.filter(item=>item&&typeof item.id==='string'&&typeof item.label==='string');
    return {items,categories,earned:items.filter(item=>item.earned===true).length,total:items.length,error:''};
   }catch{return {items:[],categories:[],earned:0,total:0,error:'Achievements could not load. Close the Hall of Fame and try again.'};}
  }
  function filteredAchievements(value){return value.items.filter(item=>(statusFilter==='all'||(item.earned===true)===(statusFilter==='earned'))&&(categoryFilter==='all'||item.category===categoryFilter));}
  function selectTab(tab,focus=false){
   if(!['records','achievements'].includes(tab))return false;
   activeTab=tab;render();if(focus)section?.querySelector('#fame-tab-'+tab)?.focus({preventScroll:true});
   if(tab==='records'){if(typeof api.loadShared==='function'){if(recordsScope!=='best')void syncRecords();void refreshShared();}else refreshPublic();}return true;
  }
  function selectScope(scope,focus=false){
   if(!['global','class','best'].includes(scope))return false;
   syncContext();recordsScope=scope;loadGeneration++;sharedRequest=null;shared={status:'idle',rows:[],code:'',ownId:'',key:''};render();
   if(focus)section?.querySelector('#fame-scope-'+scope)?.focus({preventScroll:true});
   if(scope!=='best'){void syncRecords();void refreshShared();}return true;
  }
  function changeBoard(game,mode){
   selectedGame=game;selectedMode=mode;loadGeneration++;sharedRequest=null;shared={status:'idle',rows:[],code:'',ownId:'',key:''};render();void refreshShared();
  }
  async function refreshClasses(force=false){
   if(classes.status==='ready'&&!force)return;
   if(classesRequest&&!force)return classesRequest;
   const identity=contextKey(sharedContext()),generation=++classesGeneration;
   classes={status:'loading',items:[],code:''};render();
   const pending=(async()=>{
    try{
     const result=typeof api.listSharedClasses==='function'?await api.listSharedClasses():{ok:false,code:'unavailable'};
     if(generation!==classesGeneration||identity!==contextKey(sharedContext()))return;
     if(result?.ok!==true){classes={status:'error',items:[],code:result?.code||'unavailable'};return;}
     const items=Array.isArray(result.classes)?result.classes.filter(item=>item&&typeof item.classId==='string'&&item.classId&&typeof item.label==='string').map(item=>({classId:item.classId,label:item.label.slice(0,80)})):[];
     classes={status:'ready',items,code:''};if(!items.some(item=>item.classId===selectedClassId))selectedClassId=items[0]?.classId||'';
    }catch{if(generation===classesGeneration&&identity===contextKey(sharedContext()))classes={status:'error',items:[],code:'unavailable'};}
    finally{if(generation===classesGeneration&&identity===contextKey(sharedContext())){classesRequest=null;render();}}
   })();classesRequest=pending;return pending;
  }
  async function refreshShared(force=false){
   const context=syncContext();if(recordsScope==='best')return;
   const scope=recordsScope,identity=contextKey(context),board=selectedGame+'-'+selectedMode;
   let classId=context.student?context.classId:null;
   if(scope==='class'){
    if(context.teacher){
     await refreshClasses(force);
     if(identity!==contextKey(sharedContext())||recordsScope!==scope||board!==selectedGame+'-'+selectedMode)return;
     if(classes.status==='error'){shared={status:needsSignIn(classes.code)?'sign-in':'error',rows:[],code:classes.code,ownId:'',key:''};render();return;}
     classId=selectedClassId;
     if(!classId){shared={status:'no-class',rows:[],code:'',ownId:'',key:''};render();return;}
    }else if(!context.student||!classId){shared={status:'sign-in',rows:[],code:'sign-in-needed',ownId:'',key:''};render();return;}
   }
   const key=JSON.stringify([identity,scope,board,classId]);
   if(!force&&shared.key===key&&(shared.status==='loading'||shared.status==='ready'))return sharedRequest;
   const generation=++loadGeneration;shared={status:'loading',rows:[],code:'',ownId:'',key};render();
   const pending=(async()=>{
    try{
     const result=typeof api.loadShared==='function'?await api.loadShared({scope,board,...(scope==='class'?{classId}:{})}):{ok:false,code:'unavailable'};
     if(generation!==loadGeneration||identity!==contextKey(sharedContext())||scope!==recordsScope||board!==selectedGame+'-'+selectedMode)return;
     if(result?.ok!==true){shared={status:needsSignIn(result?.code)?'sign-in':'error',rows:[],code:result?.code||'unavailable',ownId:'',key};return;}
     const rows=(Array.isArray(result.rows)?result.rows:[]).filter(row=>row&&typeof row.id==='string'&&row.id&&typeof row.alias==='string'&&row.alias.trim()&&Number.isFinite(row.score)&&row.score>=0&&row.score<=1000000)
      .map(row=>({id:row.id,alias:row.alias.trim().slice(0,40),score:row.score,tiebreak:Number.isFinite(row.tiebreak)?row.tiebreak:0,at:Number.isFinite(row.at)?row.at:0})).sort((a,b)=>b.score-a.score||b.tiebreak-a.tiebreak||a.at-b.at).slice(0,20);
     shared={status:'ready',rows,code:'',ownId:typeof result.ownId==='string'?result.ownId:'',key};
    }catch{if(generation===loadGeneration&&identity===contextKey(sharedContext()))shared={status:'error',rows:[],code:'unavailable',ownId:'',key};}
    finally{if(generation===loadGeneration&&identity===contextKey(sharedContext())){sharedRequest=null;render();}}
   })();sharedRequest=pending;return pending;
  }
  function renderScopeControls(host){
   const scopes=node('div',undefined,'fame-scopes');scopes.setAttribute('role','group');scopes.setAttribute('aria-label','Choose whose scores to see');
   for(const [id,label]of [['global','Global'],['class','My class'],['best','My best']]){
    const button=node('button',label);button.type='button';button.id='fame-scope-'+id;button.setAttribute('aria-pressed',String(recordsScope===id));button.onclick=()=>selectScope(id,true);scopes.append(button);
   }
   host.append(scopes);
  }
  function renderSharedRecords(host){
   const context=sharedContext(),controls=node('div',undefined,'fame-board-controls');
   const gameLabel=node('label','Game'),game=node('select');game.id='fame-game';
   for(const [id,title]of Object.entries(TITLES)){const option=node('option',title);option.value=id;game.append(option);}game.value=selectedGame;game.onchange=()=>changeBoard(game.value,MODES[game.value][0][0]);gameLabel.append(game);
   const modeLabel=node('label','Game mode'),mode=node('select');mode.id='fame-mode';
   for(const [id,title]of MODES[selectedGame]){const option=node('option',title);option.value=id;mode.append(option);}mode.value=selectedMode;mode.onchange=()=>changeBoard(selectedGame,mode.value);modeLabel.append(mode);controls.append(gameLabel,modeLabel);
   if(recordsScope==='class'&&context.teacher){
    const classLabel=node('label','Class'),select=node('select');select.id='fame-class';
    if(classes.status!=='ready'||!classes.items.length){const option=node('option',classes.status==='loading'?'Finding your classes…':'No class selected');option.value='';select.append(option);select.disabled=true;}
    for(const item of classes.items){const option=node('option',item.label);option.value=item.classId;select.append(option);}select.value=selectedClassId;
    select.onchange=()=>{selectedClassId=select.value;loadGeneration++;sharedRequest=null;shared={status:'idle',rows:[],code:'',ownId:'',key:''};render();void refreshShared();};classLabel.append(select);controls.append(classLabel);
   }
   host.append(controls);
   const title=recordsScope==='global'?'Players everywhere':context.teacher?classes.items.find(item=>item.classId===selectedClassId)?.label||'Your class':context.classLabel||'My class';
   host.append(node('h3',title,'fame-board-heading'),node('p','Shared boards use player aliases. Finish a game to set a score.','fame-board-help'));
   const status=node('div',undefined,'fame-shared-status');status.id='fame-shared-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
   if(classes.status==='loading'&&recordsScope==='class'&&context.teacher||shared.status==='loading'||shared.status==='idle'){status.append(node('p','Loading scores…'));host.append(status);return;}
   if(shared.status==='sign-in'){status.append(node('p',recordsScope==='class'?'Use your player card to see your class scores.':'Use your player card to share your score.'));host.append(status);return;}
   if(shared.status==='no-class'){status.append(node('p','No classes are ready yet. Add a class in Teacher tools, then try again.'));host.append(status);return;}
   if(shared.status==='error'){
    status.append(node('p','We couldn’t load these scores. Your saved best scores are still in My best.'));
    const retry=node('button','Try again','fame-retry');retry.type='button';retry.id='fame-shared-retry';retry.onclick=()=>void refreshShared(true);status.append(retry);host.append(status);return;
   }
   if(!shared.rows.length){status.append(node('p','No scores yet. Finish this game mode to set the first score!'));host.append(status);return;}
   const list=node('ol',undefined,'fame-leaderboard');list.setAttribute('aria-label',TITLES[selectedGame]+' · '+MODES[selectedGame].find(item=>item[0]===selectedMode)[1]+' scores');
   shared.rows.forEach((row,index)=>{
    const item=node('li',undefined,'fame-leaderboard-row'+(row.id===shared.ownId?' is-you':''));item.dataset.rowId=row.id;
    const rank=node('span',String(index+1),'fame-rank');rank.setAttribute('aria-label','Place '+(index+1));
    const player=node('div',undefined,'fame-player');player.append(node('strong',row.alias));if(row.id===shared.ownId)player.append(node('span','You','fame-you'));
    item.append(rank,player,node('span',row.score+(selectedGame==='rhythm'?'% accuracy':' '+unitFor(selectedGame)),'fame-shared-score'));list.append(item);
   });host.append(list);
  }
  function renderRecords(host){
   renderScopeControls(host);
   if(recordsScope!=='best'){renderSharedRecords(host);renderPublishStatus(host);return;}
   host.append(node('p','Your best completed score in each game mode. Play again to beat your best!','fame-board-help'));
   if(!classroomMode&&typeof api.loadShared!=='function'){
    const online=node('article',undefined,'fame-public'),heading=node('h3','Pitch Race · Public #1 · Classic');online.append(heading);
    online.append(node('p',publicState==='loading'?'Loading the shared Pitch Race leaderboard…':publicState==='error'?'Shared leaderboard is unavailable. Browser records below still work.':champion?champion.name+' · '+champion.score+' points · '+champion.streak+' best streak':'No public score recorded yet.'));
    host.append(online);
   }
   host.append(node('h3','My best scores'));
   for(const game of Object.keys(TITLES)){
    const card=node('article',undefined,'fame-record');card.append(node('h3',TITLES[game]));
    const modes=MODES[game].map(item=>item[0]);
    const rows=modes.map(mode=>records[game+':'+mode]).filter(Boolean);
    if(!rows.length)card.append(node('p','No completed score yet. Play through an arcade cabinet to set the first record.','muted'));
    for(const row of rows){const line=node('div',undefined,'fame-score'),name=node('strong',MODES[game].find(item=>item[0]===row.mode)?.[1]||row.mode),score=node('span',row.score+' '+row.unit),detail=node('small',row.detail);line.append(name,score,detail);card.append(line);}
    host.append(card);
   }
   const completed=(api.getNotes?.()?.rewards||[]).filter(id=>id.startsWith('piano-lesson:')||id.startsWith('piano-interval:')).length;
   const piano=node('article',undefined,'fame-record');piano.append(node('h3','Piano Lab · Challenge mastery'),node('p',completed?api.getAvatar?.()?.name+' · '+completed+' Chopin challenges completed':'Complete Chopin’s melody and interval challenges to build your mastery record.'));host.append(piano);
   const studio=node('article',undefined,'fame-record');studio.append(node('h3','Song Machine · Composition studio'),node('p','Create and share your own music. Your musician level unlocks eight additional instrument sounds.','muted'));host.append(studio);
   if(error)host.append(node('p',error,'panelMsg'));
   renderPublishStatus(host);
  }
  function renderPublishStatus(host){
   if(publishState!=='error')return;
   const message=node('div',undefined,'fame-save-note');message.append(node('p','Your best is saved here. Shared scores couldn’t update this time.'));
   const retry=node('button','Try sharing again','fame-retry');retry.type='button';retry.id='fame-publish-retry';retry.onclick=()=>void syncRecords(true);message.append(retry);host.append(message);
  }
  function renderAchievements(host){
   const value=achievementSnapshot();
   if(categoryFilter!=='all'&&!value.categories.some(item=>item.id===categoryFilter))categoryFilter='all';
   const summary=node('div',undefined,'fame-achievement-summary');summary.append(node('h3','Your achievements'),node('p',value.earned+' of '+value.total+' earned','fame-achievement-count'));
   summary.append(node('p','See what you have earned and choose your next goal. Locked achievements show how to earn them.','muted'));host.append(summary);
   const filters=node('div',undefined,'fame-achievement-filters');
   const statusLabel=node('label','Show'),status=node('select');status.id='fame-achievement-status';
   for(const [id,title]of [['all','All achievements'],['earned','Earned only'],['locked','Locked only']]){const option=node('option',title);option.value=id;status.append(option);}status.value=statusFilter;status.onchange=()=>{statusFilter=status.value;render();};statusLabel.append(status);
   const categoryLabel=node('label','Topic'),category=node('select');category.id='fame-achievement-category';
   const all=node('option','Every topic');all.value='all';category.append(all);
   for(const item of value.categories){const option=node('option',item.label);option.value=item.id;category.append(option);}category.value=categoryFilter;category.onchange=()=>{categoryFilter=category.value;render();};categoryLabel.append(category);
   filters.append(statusLabel,categoryLabel);host.append(filters);
   const visible=filteredAchievements(value),result=node('p',visible.length+' shown','fame-achievement-results');result.id='fame-achievement-results';result.setAttribute('role','status');result.setAttribute('aria-live','polite');host.append(result);
   if(value.error){const message=node('p',value.error,'panelMsg');message.setAttribute('role','status');host.append(message);return;}
   if(!visible.length){host.append(node('p',value.total?'No achievements match these filters. Try All achievements or Every topic.':'Your achievements will appear here when the arcade is ready.','fame-achievement-empty'));return;}
   const list=node('div',undefined,'fame-achievement-list');
   for(const item of visible){
    const earned=item.earned===true,card=node('article',undefined,'fame-achievement');card.dataset.achievementId=item.id;card.dataset.earned=String(earned);
    const top=node('div',undefined,'fame-achievement-top'),heading=node('h3',item.title),badge=node('span',undefined,'fame-achievement-state');
    const icon=node('span',earned?'✓':'🔒');icon.setAttribute('aria-hidden','true');badge.append(icon,node('span',earned?'Earned':'Locked'));top.append(heading,badge);card.append(top);
    const category=value.categories.find(category=>category.id===item.category);if(category)card.append(node('p',category.label,'fame-achievement-topic'));
    card.append(node('p',item.description,'fame-achievement-requirement'));
    if(Number.isFinite(item.target)&&item.target>0&&Number.isFinite(item.progress)){
     const progress=Math.max(0,Math.min(item.target,item.progress)),label=typeof item.progressLabel==='string'?item.progressLabel:progress+' of '+item.target;
     const meter=node('progress');meter.max=item.target;meter.value=progress;meter.setAttribute('aria-label',item.title+': '+label);card.append(meter,node('p',label,'fame-achievement-progress'));
    }
    if(item.pending===true&&!earned)card.append(node('p','Goal reached · not saved yet','fame-achievement-pending'));
    const rewards=Array.isArray(item.rewards)?item.rewards.filter(item=>typeof item==='string'&&item):[];
    if(rewards.length)card.append(node('p','Reward: '+rewards.join(' · '),'fame-achievement-rewards'));
    list.append(card);
   }
   host.append(list);
  }
  function render(){
   syncContext();
   if(!section?.isConnected||section.closest('[hidden]'))return;
   const focused=section.contains(section.ownerDocument.activeElement)?section.ownerDocument.activeElement:null,focusId=focused?.id;
   section.replaceChildren();
   const tabs=node('div',undefined,'fame-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Hall of Fame views');
   for(const [id,label]of [['records','Records'],['achievements','Achievements']]){
    const tab=node('button',label);tab.type='button';tab.id='fame-tab-'+id;tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(activeTab===id));tab.setAttribute('aria-controls','fame-panel-'+id);tab.tabIndex=activeTab===id?0:-1;tab.onclick=()=>selectTab(id,true);
    tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?'records':event.key==='End'?'achievements':id==='records'?'achievements':'records';selectTab(next,true);};tabs.append(tab);
   }
   section.append(tabs);
   const panel=node('div',undefined,'fame-tab-panel');panel.id='fame-panel-'+activeTab;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','fame-tab-'+activeTab);panel.tabIndex=0;section.append(panel);
   if(activeTab==='achievements')renderAchievements(panel);else renderRecords(panel);
   if(focusId)section.querySelector('#'+focusId)?.focus({preventScroll:true});
  }
  async function refreshPublic(){
   if(classroomMode)return;
   if(request)return request;publicState='loading';render();
   request=(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);try{
    const fetcher=api.fetch||globalThis.fetch;if(!fetcher)throw Error('offline');
    const response=await fetcher('https://pitch-race-default-rtdb.firebaseio.com/leaderboards/classic.json',{signal:controller.signal,credentials:'omit'});
    if(!response.ok)throw Error('leaderboard');const text=await response.text();if(text.length>2000000)throw Error('large leaderboard');champion=publicChampion(JSON.parse(text));publicState='ready';
   }catch{publicState='error';}finally{clearTimeout(timer);request=null;render();}})();return request;
  }
  function refresh(){syncContext();render();if(activeTab==='records'&&recordsScope!=='best')void refreshShared();}
  function open(tab='records'){syncContext();activeTab=tab==='achievements'?'achievements':'records';statusFilter='all';categoryFilter='all';api.openPanel('Hall of Fame');section=node('section',undefined,'hall-of-fame');section.setAttribute('aria-label','Hall of Fame');api.panelBody.append(section);render();if(activeTab==='records'){if(typeof api.loadShared==='function'){if(recordsScope!=='best')void syncRecords();void refreshShared(true);}else refreshPublic();}}
  function snapshot(){syncContext();const achievements=achievementSnapshot();return {records:JSON.parse(JSON.stringify(records)),publicState,champion:champion?{...champion}:null,error,activeTab,statusFilter,categoryFilter,recordsScope,board:selectedGame+'-'+selectedMode,selectedClassId,shared:{status:shared.status,rows:shared.rows.map(row=>({...row})),code:shared.code,ownId:shared.ownId},classes:{status:classes.status,items:classes.items.map(item=>({...item}))},publishState,achievements:{earned:achievements.earned,total:achievements.total,visibleCount:filteredAchievements(achievements).length}};}
  return {record,open,selectTab,selectScope,refresh,syncRecords,refreshShared,refreshPublic,snapshot};
 }
 return {KEY,resultRow,better,publicChampion,create};
});
