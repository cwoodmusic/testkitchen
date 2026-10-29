/* Cabinet records come from completed game results, never from panel visits. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;if(root)root.CodaHallOfFame=value;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const KEY='codaHallOfFameV1';
 const TITLES={pitch:'Pitch Race',triad:'Music Triad',rhythm:'Rhythm Room'};
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
  try{const saved=JSON.parse(storage?.getItem(KEY)||'null');if(saved?.version===1&&saved.records&&typeof saved.records==='object')for(const [key,row]of Object.entries(saved.records))
   if(row&&TITLES[row.game]&&key===row.game+':'+row.mode&&Number.isFinite(row.score)&&row.score>=0&&row.score<=1000000&&Number.isFinite(row.tiebreak)&&typeof row.name==='string')records[key]={...row,name:row.name.slice(0,18)};
  }catch{}
  function record(game,runId,result){
   const row=resultRow(game,runId,result,api.getAvatar?.()?.name);if(!row)return false;
   const key=game+':'+row.mode;if(!better(row,records[key]))return false;
   const next={...records,[key]:row};
   try{if(!storage)throw Error('storage');storage.setItem(KEY,JSON.stringify({version:1,records:next}));records=next;error='';render();return true;}
   catch{error='Browser saving is unavailable. This record has not been saved.';render();return false;}
  }
  const node=(tag,text,className)=>{const element=api.panelBody.ownerDocument.createElement(tag);if(text!==undefined)element.textContent=text;if(className)element.className=className;return element;};
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
   if(tab==='records')refreshPublic();return true;
  }
  function renderRecords(host){
   host.append(node('p','The number one recorded score for each competitive game. Cabinet results update this board automatically.','muted'));
   if(!classroomMode){
    const online=node('article',undefined,'fame-public'),heading=node('h3','Pitch Race · Public #1 · Classic');online.append(heading);
    online.append(node('p',publicState==='loading'?'Loading the shared Pitch Race leaderboard…':publicState==='error'?'Shared leaderboard is unavailable. Browser records below still work.':champion?champion.name+' · '+champion.score+' points · '+champion.streak+' best streak':'No public score recorded yet.'));
    host.append(online);
   }
   host.append(node('h3',classroomMode?'Your best scores':'Best in this browser'));
   for(const game of Object.keys(TITLES)){
    const card=node('article',undefined,'fame-record');card.append(node('h3',TITLES[game]));
    const modes=game==='pitch'?['classic','endless','levels','multi']:game==='triad'?['computer','multiplayer']:['tap'];
    const rows=modes.map(mode=>records[game+':'+mode]).filter(Boolean);
    if(!rows.length)card.append(node('p','No completed score yet. Play through an arcade cabinet to set the first record.','muted'));
    for(const row of rows){const line=node('div',undefined,'fame-score'),name=node('strong','#1 '+row.name),score=node('span',row.score+' '+row.unit),detail=node('small',row.mode+' · '+row.detail);line.append(name,score,detail);card.append(line);}
    host.append(card);
   }
   const completed=(api.getNotes?.()?.rewards||[]).filter(id=>id.startsWith('piano-lesson:')||id.startsWith('piano-interval:')).length;
   const piano=node('article',undefined,'fame-record');piano.append(node('h3','Piano Lab · Challenge mastery'),node('p',completed?api.getAvatar?.()?.name+' · '+completed+' Chopin challenges completed':'Complete Chopin’s melody and interval challenges to build your mastery record.'));host.append(piano);
   const studio=node('article',undefined,'fame-record');studio.append(node('h3','Song Machine · Composition studio'),node('p','Create and share your own music. Your musician level unlocks eight additional instrument sounds.','muted'));host.append(studio);
   if(error)host.append(node('p',error,'panelMsg'));
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
  function open(tab='records'){activeTab=tab==='achievements'?'achievements':'records';statusFilter='all';categoryFilter='all';api.openPanel('Hall of Fame');section=node('section',undefined,'hall-of-fame');section.setAttribute('aria-label','Hall of Fame');api.panelBody.append(section);render();if(activeTab==='records')refreshPublic();}
  function snapshot(){const achievements=achievementSnapshot();return {records:JSON.parse(JSON.stringify(records)),publicState,champion:champion?{...champion}:null,error,activeTab,statusFilter,categoryFilter,achievements:{earned:achievements.earned,total:achievements.total,visibleCount:filteredAchievements(achievements).length}};}
  return {record,open,selectTab,refresh:render,refreshPublic,snapshot};
 }
 return {KEY,resultRow,better,publicChampion,create};
});
